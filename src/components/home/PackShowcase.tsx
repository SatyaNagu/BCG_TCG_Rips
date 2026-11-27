"use client";

import {
  type AnimationPlaybackControls,
  animate,
  motion,
  useAnimationFrame,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import Image from "next/image";
import Link from "next/link";
import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { PackWalls, packHalfDepth } from "@/components/packs/Pack3D";
import {
  type Pack,
  packs,
  rarityColor,
  rarityLabel,
  rarityOrder,
  topHitOdds,
} from "@/lib/packs";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Pick your rarity": the five BC Rip's packs as solid two-sided foil packs that
 * slowly spin in place. Hovering a pack pauses it (and it tilts toward the pointer
 * with a holographic sheen), dragging spins it by hand, and a small toggle stops
 * or restarts every pack. Each shows its price and real odds.
 */
export function PackShowcase() {
  const reduce = useReducedMotion();
  const [spinning, setSpinning] = useState(true);
  // Respect reduced motion: packs start still (the toggle can still start them).
  useEffect(() => {
    if (reduce) setSpinning(false);
  }, [reduce]);

  return (
    <section
      aria-labelledby="packs-heading"
      className="relative overflow-hidden bg-bg py-24 sm:py-32"
    >
      {/* Soft gold haze so the section reads as a stage, not a flat page */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(255_196_0/0.10),transparent)]" />

      <div className="relative mx-auto w-full max-w-[2200px] px-4 sm:px-6 lg:px-[4vw]">
        {/* Stop / start the spinning packs */}
        <button
          type="button"
          data-magnetic=""
          onClick={() => setSpinning((v) => !v)}
          aria-pressed={!spinning}
          aria-label={spinning ? "Pause the spinning packs" : "Spin the packs"}
          className="absolute right-4 top-0 inline-flex h-11 items-center gap-2 rounded-full border border-border-strong bg-bg/60 px-5 text-sm font-semibold text-text backdrop-blur-md transition-colors duration-150 hover:border-accent hover:text-accent sm:right-6 lg:right-[4vw]"
        >
          <span aria-hidden="true" className="text-xs">
            {spinning ? "❚❚" : "▶"}
          </span>
          {spinning ? "Pause" : "Spin"}
        </button>

        <motion.p
          className="text-xs font-semibold uppercase tracking-[0.32em] text-accent"
          initial={{ opacity: 0, letterSpacing: "0.6em" }}
          whileInView={{ opacity: 1, letterSpacing: "0.32em" }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          The shop
        </motion.p>
        <motion.h2
          id="packs-heading"
          className="mt-4 font-display text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.95] tracking-[-0.04em]"
          initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 1, ease: EASE }}
        >
          <span className="text-liquid">Pick your </span>
          <span className="text-liquid kw">rarity.</span>
        </motion.h2>
        <motion.p
          className="mt-5 max-w-[46ch] text-base text-text-muted sm:text-lg"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
        >
          Every pack holds one card. Higher tiers raise the odds of a Legendary
          or Mythic pull, and every pack shows its real odds before you rip.
        </motion.p>

        {/* Phones: swipeable row. Larger screens: all five in a line. */}
        <ul className="-mx-4 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-5 lg:gap-[2.5vw] lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {packs.map((pack, i) => (
            <motion.li
              key={pack.id}
              className="w-[72vw] max-w-[300px] shrink-0 snap-center sm:w-[42vw] lg:w-auto lg:max-w-none"
              initial={{ opacity: 0, y: 60, rotate: (i - 2) * 3 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: EASE }}
            >
              <PackCard pack={pack} index={i} spinning={spinning} />
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PackCard({
  pack,
  index,
  spinning,
}: {
  pack: Pack;
  index: number;
  spinning: boolean;
}) {
  const hit = topHitOdds(pack);
  return (
    <Link
      href={`/packs#${pack.id}`}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
      style={{ "--pack": pack.color } as React.CSSProperties}
    >
      <SpinPack pack={pack} index={index} spinning={spinning} />

      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-2xl font-bold tracking-tight">
            {rarityLabel[pack.id]}
          </h3>
          <span className="font-display text-xl font-bold text-accent">
            ${pack.price.toFixed(2)}
          </span>
        </div>
        <p className="mt-1 text-base text-text-muted">{pack.tagline}</p>

        <OddsBar pack={pack} />
        <p className="mt-2 text-sm text-text-subtle">
          <span
            className="font-semibold"
            style={{
              color: rarityColor[pack.id === "common" ? "rare" : pack.id],
            }}
          >
            {hit.label}
          </span>{" "}
          or better: 1 in {hit.oneIn}
        </p>

        <span className="mt-5 inline-flex items-center gap-2 text-base font-semibold text-text transition-colors duration-150 group-hover:text-accent">
          Rip this pack
          <span
            aria-hidden="true"
            className="transition-transform duration-200 ease-out group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

/** Stacked bar of the pack's rarity odds. */
export function OddsBar({ pack }: { pack: Pack }) {
  const tiers = rarityOrder.filter((r) => pack.odds[r] > 0);
  return (
    <div className="mt-4">
      <div
        className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Odds: ${tiers.map((r) => `${rarityLabel[r]} ${pack.odds[r]}%`).join(", ")}`}
      >
        {tiers.map((r) => (
          <span
            key={r}
            className="h-full"
            style={{
              flexGrow: pack.odds[r],
              flexBasis: 0,
              minWidth: 3,
              background: rarityColor[r],
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The pack itself: a solid two-sided pack that spins slowly on its own axis. The
 * pointer pauses it and tilts it, with a rainbow foil sheen and a glare spot that
 * follow; dragging spins it by hand with a little momentum. It only ever turns in
 * place, so its outline never grows past its own column.
 */
function SpinPack({
  pack,
  index,
  spinning,
}: {
  pack: Pack;
  index: number;
  spinning: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "120px" });

  // Real width, for the side walls' depth.
  const [w, setW] = useState(260);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spin angle (degrees, unbounded). Packs start a little out of step with each other.
  const angle = useMotionValue(-index * 30);
  const hovered = useRef(false);
  // The outline glow and foil layers only run while hovered (when the pack is paused);
  // a spinning pack gets a still glow behind it instead, which costs nothing per frame.
  const [isHover, setIsHover] = useState(false);
  const settling = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{
    x: number;
    base: number;
    moved: boolean;
    lastX: number;
    lastT: number;
    v: number;
  } | null>(null);
  const justDragged = useRef(false);

  // Auto spin: about one turn every 12 s, paused on hover, while dragging or settling, and off screen.
  useAnimationFrame((_, delta) => {
    if (
      !spinning ||
      !inView ||
      hovered.current ||
      drag.current ||
      settling.current
    )
      return;
    angle.set(angle.get() + Math.min(delta, 50) * 0.03);
  });

  // Turning the spin off brings every pack round to face front.
  useEffect(() => {
    if (spinning) return;
    settling.current?.stop();
    const a = angle.get();
    settling.current = animate(angle, Math.round(a / 360) * 360, {
      type: "spring",
      stiffness: 50,
      damping: 14,
      onComplete: () => {
        settling.current = null;
      },
    });
  }, [spinning, angle]);

  // Pointer position over the card, 0–1 (tilt, sheen and glare).
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const hover = useMotionValue(0);
  const spring = { stiffness: 180, damping: 18, mass: 0.6 };
  const tiltY = useSpring(useTransform(px, [0, 1], [-14, 14]), spring);
  const rotateX = useSpring(useTransform(py, [0, 1], [12, -12]), spring);
  const rotateY = useTransform(
    [angle, tiltY] as never,
    ([a, t]: number[]) => a + t,
  );
  const lift = useSpring(hover, spring);
  const scale = useTransform(lift, [0, 1], [1, 1.04]);
  const glowPct = useTransform(lift, [0, 1], [35, 75]);
  const glowBlur = useTransform(lift, [0, 1], [22, 40]);
  const glow = useMotionTemplate`drop-shadow(0 0 ${glowBlur}px color-mix(in srgb, var(--pack) ${glowPct}%, transparent))`;
  const sheenOpacity = useTransform(lift, [0, 1], [0.25, 0.9]);

  const gx = useTransform(px, (v) => `${v * 100}%`);
  const gy = useTransform(py, (v) => `${v * 100}%`);
  const bgPos = useTransform(px, (v) => `${(1 - v) * 100}% 50%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgb(255 255 255 / 0.75), rgb(255 255 255 / 0) 42%)`;

  // Clip the foil layers to the pack's own outline (its transparent PNG/WebP alpha).
  const packMask = {
    maskImage: `url(${pack.image})`,
    WebkitMaskImage: `url(${pack.image})`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  } as const;

  const onEnter = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    hovered.current = true;
    setIsHover(true);
    if (!reduce) hover.set(1);
  };
  const onLeave = () => {
    hovered.current = false;
    setIsHover(false);
    px.set(0.5);
    py.set(0.5);
    hover.set(0);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    settling.current?.stop();
    settling.current = null;
    drag.current = {
      x: e.clientX,
      base: angle.get(),
      moved: false,
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
    };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 6) {
        d.moved = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* still spins while over the pack */
        }
      }
      if (d.moved) {
        angle.set(d.base + dx * 0.7);
        const dt = Math.max(1, e.timeStamp - d.lastT);
        d.v = ((e.clientX - d.lastX) * 0.7 * 1000) / dt; // degrees per second
        d.lastX = e.clientX;
        d.lastT = e.timeStamp;
      }
      return;
    }
    if (reduce || e.pointerType === "touch") return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    justDragged.current = true;
    // Let it coast a little with the flick, then come to rest.
    const v = Math.max(-1400, Math.min(1400, d.v));
    settling.current = animate(angle, angle.get() + v * 0.3, {
      type: "spring",
      velocity: v,
      stiffness: 30,
      damping: 14,
      onComplete: () => {
        settling.current = null;
      },
    });
  };
  // A drag is not a click: don't follow the link after spinning the pack.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (justDragged.current) {
      e.preventDefault();
      justDragged.current = false;
    }
  };

  const z = packHalfDepth(w);

  return (
    <div
      ref={ref}
      data-cursor="Rip"
      className="relative touch-pan-y select-none [perspective:1400px]"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={onClick}
    >
      {/* Still glow behind the pack (doesn't turn with it, so it never repaints) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[14%] inset-y-[10%] rounded-[30%] opacity-45 blur-[38px]"
        style={{ background: "var(--pack)" }}
      />
      <motion.div
        className="relative aspect-[720/1224] [transform-style:preserve-3d] will-change-transform"
        style={{ rotateX, rotateY, scale }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: `translateZ(${z}px)` }}
        >
          {/* Glow follows the pack's own outline (drop-shadow of its transparent edges) */}
          <motion.div
            className="absolute inset-0"
            style={{ filter: isHover ? glow : "none" }}
          >
            <Image
              src={pack.image}
              alt={`${pack.name}, a BC Rip's mystery pack`}
              fill
              sizes="(min-width: 1024px) 18vw, (min-width: 640px) 42vw, 72vw"
              className="select-none object-contain"
              // Served as-is: the optimizer re-encodes to JPEG and would drop the transparent edges.
              unoptimized
              draggable={false}
              priority={pack.id === "mythic"}
            />
          </motion.div>
          {/* Rainbow foil sheen that slides with the pointer */}
          {isHover && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
              style={{
                ...packMask,
                opacity: sheenOpacity,
                backgroundImage:
                  "linear-gradient(115deg, transparent 20%, rgb(255 80 160 / 0.55) 32%, rgb(255 220 80 / 0.55) 40%, rgb(80 255 200 / 0.55) 48%, rgb(90 140 255 / 0.55) 56%, transparent 68%)",
                backgroundSize: "250% 250%",
                backgroundPosition: bgPos,
              }}
            />
          )}
          {/* Glare spot under the pointer */}
          {isHover && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
              style={{ ...packMask, backgroundImage: glare, opacity: lift }}
            />
          )}
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: `rotateY(180deg) translateZ(${z}px)` }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ filter: isHover ? glow : "none" }}
          >
            <img
              src={pack.back}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full select-none object-contain"
            />
          </motion.div>
        </div>

        {/* Folded side seams: the pack's thickness as it turns */}
        <PackWalls pack={pack} width={w} />
      </motion.div>
    </div>
  );
}
