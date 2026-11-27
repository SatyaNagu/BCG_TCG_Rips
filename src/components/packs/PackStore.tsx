"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLenis } from "@/components/providers/SmoothScroll";
import { OddsBar } from "@/components/home/PackShowcase";
import { buttonClasses } from "@/components/ui/Button";
import { type Pack, type Rarity, packs, rarityColor, rarityLabel, rarityOrder, topHitOdds } from "@/lib/packs";
import { Pack3D } from "./Pack3D";
import { PackOpener } from "./PackOpener";
import { PackRing, type RingItem } from "./PackRing";

const EASE = [0.22, 1, 0.36, 1] as const;
/** Copies of the chosen pack in the second ring. */
const STACK_SIZE = 8;

type Stage = "ring" | "stack" | "rip";

/**
 * Packs page, in three steps (after the TCG Pocket pack select):
 *  1. ring  – the five rarities stand in a 3D ring; spin it, the front pack's details show below.
 *  2. stack – choosing a rarity brings up a ring of that pack; spin and tap the one you want.
 *  3. rip   – the other packs fall away and the chosen one is ready to tear open.
 */
export function PackStore() {
  const [stage, setStage] = useState<Stage>("ring");
  const [active, setActive] = useState(rarityOrder.indexOf("mythic"));
  const [stackActive, setStackActive] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  /** The front pack is turned over to show its back. */
  const [flipped, setFlipped] = useState(false);
  // Ring step: name line and odds panel under it.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 639px)");
    const u = () => setNarrow(m.matches);
    u();
    m.addEventListener("change", u);
    return () => m.removeEventListener("change", u);
  }, []);
  const ringWidth = usePackWidth(narrow ? 330 : 250);
  // Stack and rip steps share one size, so the picked pack hands over in place.
  const width = usePackWidth(narrow ? 300 : 230);
  const pack = packs[active];

  // Arriving from "Rip this pack" on the home page (/packs#rare) turns the ring to that pack.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const i = packs.findIndex((p) => p.id === id);
    if (i >= 0) setActive(i);
  }, []);

  // Each step starts at the top of the page, wherever the button that led there was.
  const lenis = useLenis();
  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { duration: 0.6 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage, lenis]);

  const changeActive = (i: number) => {
    setActive(i);
    setFlipped(false);
    history.replaceState(null, "", `#${packs[i].id}`);
  };

  const chooseRarity = () => {
    setFlipped(false);
    setStackActive(0);
    setPicked(null);
    setStage("stack");
  };

  const pickFromStack = (i: number) => {
    setPicked(i);
    // Let the other packs fall away before the rip stage takes over.
    window.setTimeout(() => setStage("rip"), 750);
  };

  const back = () => {
    setPicked(null);
    setFlipped(false);
    setStage(stage === "rip" ? "stack" : "ring");
  };

  const ringItems: RingItem[] = useMemo(
    () =>
      packs.map((p) => ({
        key: p.id,
        color: p.color,
        label: `${p.name}, $${p.price.toFixed(2)}`,
        render: (isFront: boolean) => <Pack3D pack={p} width={ringWidth} flipped={isFront && flipped} />,
      })),
    [flipped, ringWidth]
  );
  const stackItems: RingItem[] = useMemo(
    () =>
      Array.from({ length: STACK_SIZE }, (_, i) => ({
        key: `${pack.id}-${i}`,
        color: pack.color,
        label: `${pack.name} ${i + 1} of ${STACK_SIZE}`,
        render: () => <Pack3D pack={pack} width={width} />,
      })),
    [pack, width]
  );

  return (
    <div className="relative min-h-[100svh] overflow-hidden pt-header">
      {/* Stage light in the active pack's colour */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] size-[min(900px,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        animate={{ background: pack.color, opacity: 0.16 }}
        transition={{ duration: 0.8, ease: EASE }}
      />

      {/* Heading */}
      <div className="relative mx-auto max-w-7xl px-4 pt-6 text-center sm:px-6 lg:px-8 lg:pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">
              {stage === "ring" ? "BC Rip's packs" : stage === "stack" ? "Step 2 of 3" : "Step 3 of 3"}
            </p>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,4.25rem)] font-bold leading-[0.95] tracking-[-0.04em]">
              {stage === "ring" && <span className="text-liquid">Choose your rarity.</span>}
              {stage === "stack" && (
                <>
                  <span className="text-liquid">Pick your </span>
                  <span style={{ color: pack.color }}>{rarityLabel[pack.id]}</span>
                  <span className="text-liquid"> pack.</span>
                </>
              )}
              {stage === "rip" && (
                <>
                  <span className="text-liquid">Rip it </span>
                  <span style={{ color: pack.color }}>open.</span>
                </>
              )}
            </h1>
            <p className="mx-auto mt-4 max-w-[72ch] text-base text-text-muted sm:text-lg">
              {stage === "ring" && "Spin the ring and tap the front pack to choose it."}
              {stage === "stack" && "Every pack is sealed and random. Spin the stack and tap the one that calls you."}
              {stage === "rip" && "Drag the pack to turn it over. Slice across the top of the pack, from either side, to cut it open."}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stage */}
      <div className="relative mx-auto mt-8 max-w-[1400px] px-2 sm:px-6">
        <AnimatePresence mode="wait">
          {stage === "ring" && (
            <motion.div key="ring" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }} transition={{ duration: 0.55, ease: EASE }}>
              <PackRing items={ringItems} active={active} onActiveChange={changeActive} onPick={chooseRarity} itemWidth={ringWidth} spread={1} pickLabel="Choose" introSpin />
              <PackDetails pack={pack} />
            </motion.div>
          )}

          {stage === "stack" && (
            <motion.div
              key={`stack-${pack.id}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              // Going on to the rip, the picked pack is already in place: swap instantly.
              exit={picked !== null ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <PackRing items={stackItems} active={stackActive} onActiveChange={setStackActive}
                onPick={pickFromStack} picked={picked} itemWidth={width} spread={1} pickLabel="Pick" />
              <div className="mt-12 flex flex-wrap justify-center gap-4 sm:gap-5">
                <button type="button" data-magnetic="" onClick={back} className={buttonClasses({ variant: "outline", size: "lg" })}>
                  ← Change rarity
                </button>
              </div>
            </motion.div>
          )}

          {stage === "rip" && (
            <motion.div key="rip" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              <PackOpener pack={pack} width={Math.round(width * 1.12)} seamless startFlipped={flipped} onBack={back} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Details of the pack at the front of the ring. */
function PackDetails({ pack }: { pack: Pack }) {
  const hit = topHitOdds(pack);
  return (
    <div className="relative mx-auto mt-6 w-full max-w-4xl px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={pack.id}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex flex-col items-center gap-5"
        >
          {/* Name, price and line on one row */}
          <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight" style={{ color: pack.color }}>
              {rarityLabel[pack.id]}
            </h2>
            <span className="font-display text-2xl font-bold text-accent">${pack.price.toFixed(2)}</span>
            <span className="text-base text-text-muted">{pack.tagline}</span>
          </div>

          {/* Odds (tap the front pack to choose it) */}
          <div className="flex w-full flex-col items-center gap-5 sm:flex-row sm:justify-center">
            <div className="w-full max-w-xl rounded-lg border border-border bg-bg-raised/50 px-5 py-4 backdrop-blur-md">
              <OddsBar pack={pack} />
              <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
                {rarityOrder.map((r: Rarity) => (
                  <div key={r} className={pack.odds[r] ? "" : "opacity-30"}>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-text-subtle">{rarityLabel[r]}</dt>
                    <dd className="mt-0.5 font-display text-lg font-bold" style={{ color: rarityColor[r] }}>
                      {pack.odds[r]}%
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-center text-sm text-text-subtle">
                {hit.label} or better: <span className="font-semibold text-text">1 in {hit.oneIn}</span>
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Pack width for the ring, sized to the viewport. */
/**
 * Pack width for a ring, sized so the whole step fits one screen with no scrolling.
 * `below` is the height needed under the ring (details, buttons, result).
 */
function usePackWidth(below: number) {
  const [w, setW] = useState(230);
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const header = vw < 768 ? 72 : 88;
      // Step heading (eyebrow + title + one line) and the gap above the ring.
      const heading = vw < 640 ? 215 : 205;
      const byWidth = vw < 640 ? vw * 0.5 : vw * 0.21;
      const byHeight = (vh - header - heading - below) / ((1224 / 720) * 1.12);
      setW(Math.round(Math.max(130, Math.min(byWidth, byHeight, 400))));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [below]);
  return w;
}
