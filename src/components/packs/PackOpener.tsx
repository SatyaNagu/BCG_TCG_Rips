"use client";

import {
  AnimatePresence,
  type MotionValue,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import Link from "next/link";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { CARD_BACK, type Pack, type PullCard, rarityColor, rarityLabel, rollCard } from "@/lib/packs";
import { FaceShade, PackWalls, packHalfDepth } from "./Pack3D";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The band across the top of the pack that a swipe can slice through (y, % of pack height). */
const CUT_TOP = 4;
const CUT_BOTTOM = 16;
/** Dashed "cut here" guide. */
const GUIDE_Y = 11;
/** A released cut this wide (% of the pack) is finished off to the edges; shorter ones heal. */
const CUT_MIN_SPAN = 50;

/** Card sits inside the pack: 82% of its width. */
const CARD_W = 0.82;

type Phase = "idle" | "tearing" | "torn" | "rising" | "card" | "revealed";
type Pt = { x: number; y: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const poly = (pts: Pt[]) => pts.map((p) => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`).join(", ");

/** Sorts a cut left to right and runs it out to both edges of the pack. */
function completeCut(pts: Pt[]): Pt[] {
  const s = [...pts].sort((a, b) => a.x - b.x);
  if (s[0].x > 0) s.unshift({ x: 0, y: s[0].y });
  if (s[s.length - 1].x < 100) s.push({ x: 100, y: s[s.length - 1].y });
  return s;
}

/** Resamples the cut every 2.5% and roughens it, so the foil edge looks torn rather than drawn. */
function roughen(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  let j = 0;
  for (let x = 0; x <= 100.001; x += 2.5, j++) {
    let i = 1;
    while (i < pts.length - 1 && pts[i].x < x) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const t = b.x === a.x ? 0 : clamp((x - a.x) / (b.x - a.x), 0, 1);
    const jitter = j === 0 || x >= 100 ? 0 : (j % 2 ? 0.55 : -0.45) + ((j * 37) % 5) * 0.08;
    out.push({ x, y: clamp(a.y + (b.y - a.y) * t + jitter, CUT_TOP - 1, CUT_BOTTOM + 1) });
  }
  return out;
}

/** The same cut seen from the other face of the pack. */
const mirror = (pts: Pt[]) => pts.map((p) => ({ x: 100 - p.x, y: p.y })).reverse();

type OpenerProps = {
  pack: Pack;
  /** Pack width in px. When it matches the picked pack in the ring, the hand-off is seamless. */
  width?: number;
  /** Start in place with no entrance animation (continuing straight from the pick). */
  seamless?: boolean;
  /** Start turned over (the picked pack was showing its back). */
  startFlipped?: boolean;
  /** Shows a "pick a different pack" button next to the rip controls. */
  onBack?: () => void;
};

/**
 * A two-sided 3D pack. Drag its body to turn it over. Slice across its top band
 * (starting on the pack or just beside it, from either side, along any line) and a
 * glowing slash follows the finger; the pack tears exactly along that cut, the strip flies
 * off, the card slides up out of the opening, and a tap reveals it.
 */
export function PackOpener({ pack, width, seamless = false, startFlipped = false, onBack }: OpenerProps) {
  const reduce = useReducedMotion();
  const w = width ?? 300;
  const h = w * (1224 / 720);
  const cardW = w * CARD_W;
  const cardH = cardW * (88 / 63);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pull, setPull] = useState<PullCard | null>(null);
  /** Direction of the cut on screen: 1 = left to right, -1 = right to left. */
  const [dir, setDir] = useState<1 | -1>(1);
  /** Which face the pack was cut on (snapped turn angle at the moment of cutting). */
  const [tornAngle, setTornAngle] = useState(0);
  /** The finished cut, in screen % of the pack as it faced the viewer. */
  const [cut, setCut] = useState<Pt[] | null>(null);

  const turn = useMotionValue(startFlipped ? 180 : 0); // pack's Y rotation (degrees)
  const turnSpring = useSpring(turn, { stiffness: 140, damping: 18 });
  const tiltX = useSpring(0, { stiffness: 150, damping: 18 });
  const tiltY = useSpring(0, { stiffness: 150, damping: 18 });
  const rotateY = useTransform([turnSpring, tiltY] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const cardTurn = useMotionValue(0);
  const cardTurnSpring = useSpring(cardTurn, { stiffness: 120, damping: 17 });

  // Slash trail (SVG paths in a 0–100 box): the whole cut, plus its freshest stretch drawn
  // fatter and brighter, so the head of the swipe blazes and the tail cools behind it.
  const trail = useMotionValue("");
  const trailHead = useMotionValue("");
  const trailOpacity = useMotionValue(0);
  const bladeX = useMotionValue(0);
  const bladeY = useMotionValue(0);
  const bladeOpacity = useMotionValue(0);
  const bladeLeft = useTransform(bladeX, (x) => `${x}%`);
  const bladeTop = useTransform(bladeY, (y) => `${y}%`);

  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "turn" | "card"; x: number; y: number; base: number; moved: boolean } | null>(null);
  const cutting = useRef<{ pts: Pt[]; dir: 0 | 1 | -1; start: Pt; last: Pt } | null>(null);

  // Reset whenever another pack is chosen.
  useEffect(() => {
    setPhase("idle");
    setPull(null);
    setCut(null);
    trail.set("");
  }, [pack.id, trail]);

  const snapTurn = (deg: number) => Math.round(deg / 180) * 180;
  const facingBack = (deg: number) => Math.abs(Math.round(deg / 180)) % 2 === 1;

  /** Pointer position in % of the pack box (x unclamped, so a cut can start beside the pack). */
  const toPct = (e: { clientX: number; clientY: number }): Pt | null => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  const drawTrail = (pts: Pt[]) => {
    const d = (list: Pt[]) => (list.length > 1 ? `M ${list.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}` : "");
    trail.set(d(pts));
    trailHead.set(d(pts.slice(-9)));
  };

  const openPack = (screenCut: Pt[], d: 1 | -1) => {
    if (phase !== "idle" && phase !== "tearing") return;
    const angle = snapTurn(turn.get());
    turn.set(angle);
    tiltX.set(0);
    tiltY.set(0);
    const full = roughen(completeCut(screenCut));
    setCut(full);
    drawTrail(full);
    setDir(d);
    setTornAngle(angle);
    // cardTurn is the card's angle as seen on screen: 0 = its back faces the viewer.
    cardTurn.jump(0);
    setPull(rollCard(pack).card);
    setPhase("torn");
    animate(bladeOpacity, 0, { duration: 0.2 });
    animate(trailOpacity, [1, 1, 0], { duration: reduce ? 0 : 0.9, times: [0, 0.4, 1] });
    // Strip flies, card slides up out of the opening, then the wrapper drops away.
    window.setTimeout(() => setPhase("rising"), reduce ? 0 : 650);
    window.setTimeout(() => setPhase("card"), reduce ? 0 : 1500);
  };

  // ---------- Slice: swipe across the top band ----------
  const onCutDown = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== "idle") return;
    const p = toPct(e);
    if (!p) return;
    turn.set(snapTurn(turn.get()));
    tiltX.set(0);
    tiltY.set(0);
    const start = { x: p.x, y: clamp(p.y, CUT_TOP, CUT_BOTTOM) };
    cutting.current = { pts: [], dir: 0, start, last: start };
    trailOpacity.set(1);
    bladeX.set(start.x);
    bladeY.set(start.y);
    bladeOpacity.set(1);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the cut still works while over the band */
    }
  };

  const onCutMove = (e: PointerEvent<HTMLDivElement>) => {
    const c = cutting.current;
    const p = toPct(e);
    if (!c || !p) return;
    const y = clamp(p.y, CUT_TOP, CUT_BOTTOM);
    // The glow at the head of the slash rides the finger.
    bladeX.set(clamp(p.x, -8, 108));
    bladeY.set(y);
    c.last = { x: p.x, y };

    if (!c.dir) {
      if (Math.abs(p.x - c.start.x) < 3) return;
      c.dir = p.x > c.start.x ? 1 : -1;
      setDir(c.dir);
      setPhase("tearing");
      c.pts.push({ x: clamp(c.start.x, 0, 100), y: c.start.y });
    }
    // The cut only grows forward; up and down it follows the pointer freely.
    const tip = c.pts[c.pts.length - 1];
    const x = clamp(p.x, 0, 100);
    if ((x - tip.x) * c.dir > 0.4) {
      c.pts.push({ x, y });
      drawTrail(c.pts);
    }
    if ((c.dir === 1 && x >= 100) || (c.dir === -1 && x <= 0)) {
      const d = c.dir;
      const pts = c.pts;
      cutting.current = null;
      openPack(pts, d);
    }
  };

  const onCutUp = () => {
    const c = cutting.current;
    cutting.current = null;
    if (!c) return;
    const span = c.pts.length ? Math.abs(c.pts[c.pts.length - 1].x - c.pts[0].x) : 0;
    if (c.dir && span >= CUT_MIN_SPAN) {
      openPack(c.pts, c.dir);
    } else {
      // Too short: the scratch fades and the pack stays sealed.
      animate(bladeOpacity, 0, { duration: 0.2 });
      animate(trailOpacity, 0, { duration: 0.35 }).then(() => trail.set(""));
      setPhase("idle");
    }
  };

  /** "Rip it for me": the slash makes a slightly wavy cut across the pack on its own. */
  const autoCut = () => {
    if (phase !== "idle") return;
    turn.set(snapTurn(turn.get()));
    const wave = (x: number) => GUIDE_Y + Math.sin(x / 14) * 1.6;
    const pts: Pt[] = [];
    setPhase("tearing");
    setDir(1);
    trailOpacity.set(1);
    bladeOpacity.set(1);
    animate(0, 100, {
      duration: reduce ? 0 : 0.6,
      ease: [0.45, 0, 0.55, 1],
      onUpdate: (x) => {
        pts.push({ x, y: wave(x) });
        bladeX.set(x);
        bladeY.set(wave(x));
        drawTrail(pts);
      },
      onComplete: () => openPack(pts.length > 1 ? pts : [{ x: 0, y: GUIDE_Y }, { x: 100, y: GUIDE_Y }], 1),
    });
  };

  const reveal = () => {
    if (phase !== "card") return;
    setPhase("revealed");
    cardTurn.set(cardTurn.get() + 180);
  };

  // ---------- Pointer on the pack: turn it (sealed), turn the card (after) ----------
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (phase === "card" || phase === "revealed") {
      drag.current = { mode: "card", x: e.clientX, y: e.clientY, base: cardTurn.get(), moved: false };
    } else if (phase === "idle") {
      drag.current = { mode: "turn", x: e.clientX, y: e.clientY, base: turn.get(), moved: false };
    } else return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the drag still works while over the pack */
    }
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current?.getBoundingClientRect();
    const d = drag.current;
    if (!r) return;
    if (!d) {
      // Hover: the sealed pack leans toward the pointer.
      if (phase === "idle" && e.pointerType !== "touch" && !reduce) {
        tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 18);
        tiltX.set((0.5 - (e.clientY - r.top) / r.height) * 12);
      }
      return;
    }
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6 || Math.abs(e.clientY - d.y) > 6) d.moved = true;
    if (d.mode === "turn") {
      tiltY.set(0);
      turn.set(d.base + dx * 0.55);
    } else {
      cardTurn.set(d.base + dx * 0.6);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "turn") {
      // A tap turns the pack over; a drag snaps to the nearest face.
      turn.set(d.moved ? snapTurn(turn.get()) : snapTurn(d.base) + 180);
    } else if (!d.moved) {
      if (phase === "card") reveal();
      else cardTurn.set(cardTurn.get() + 180);
    } else {
      cardTurn.set(snapTurn(cardTurn.get()));
    }
  };

  const onLeave = () => {
    if (!drag.current) {
      tiltX.set(0);
      tiltY.set(0);
    }
  };

  const reset = () => {
    setPull(null);
    setCut(null);
    trail.set("");
    turn.set(0);
    cardTurn.jump(0);
    setPhase("idle");
  };

  const sealed = phase === "idle" || phase === "tearing";
  const wrapperGone = phase === "card" || phase === "revealed";
  // Keep the pack's colour until the reveal, so the glow never spoils the pull.
  const color = pull && phase === "revealed" ? rarityColor[pull.rarity] : pack.color;
  const big = pull && (pull.rarity === "legendary" || pull.rarity === "mythic");

  // The card waits just under the deepest point of the cut.
  const cutLow = cut ? Math.max(...cut.map((p) => p.y)) : CUT_BOTTOM;
  const cutMid = cut ? cut.reduce((s, p) => s + p.y, 0) / cut.length : GUIDE_Y;
  const cardTop = ((cutLow + 2.5) / 100) * h;
  // Card height above its starting spot: inside → peeking out of the opening → centred in the stage.
  const cardY = phase === "rising" ? -cardH * 0.48 : wrapperGone ? (h - cardH) / 2 - cardTop - h * 0.03 : 0;
  const showingBack = facingBack(tornAngle);
  // Slash glow: the pack's colour, or gold on the silver Common pack where grey would vanish.
  const slash = pack.id === "common" ? "#ffd400" : pack.color;
  // Image on the face toward the viewer right now (for the dimming mask while slicing).
  const facingSrc = facingBack(turn.get()) ? pack.back : pack.image;

  return (
    <div className="relative flex flex-col items-center">
      {/* Stage glow in the pack's colour, flaring to the pull's colour */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-[min(760px,110vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        animate={{ background: color, opacity: phase === "revealed" ? (big ? 0.4 : 0.26) : 0.14, scale: phase === "torn" ? 1.25 : 1 }}
        transition={{ duration: 0.8, ease: EASE }}
      />

      {/* The room dims while you slice, and lights back up when you stop or the pack opens */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-black"
        initial={false}
        animate={{ opacity: phase === "tearing" ? 0.55 : 0 }}
        transition={{ duration: phase === "tearing" ? 0.35 : 0.5, ease: EASE }}
      />

      {/* Same box as the pack ring (pack height × 1.12), so the picked pack lands in place */}
      <div className="relative flex items-center justify-center" style={{ height: h * 1.12 }}>
        <div ref={boxRef} className="relative [perspective:1600px]" style={{ width: w, height: h, marginTop: -20 }}>
          <motion.div
            className={`absolute inset-0 touch-none select-none [transform-style:preserve-3d] ${
              sealed ? "cursor-grab active:cursor-grabbing" : wrapperGone ? "cursor-pointer" : ""
            }`}
            style={{ rotateY, rotateX: tiltX }}
            data-cursor={sealed ? "Turn" : phase === "card" ? "Flip" : phase === "revealed" ? "Turn" : undefined}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onLeave}
            initial={seamless ? false : { opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {(["front", "back"] as const).map((side) => (
              <PackFace
                key={side}
                pack={pack}
                side={side}
                // The face turned away from the viewer sees the cut mirrored.
                cut={cut && ((side === "back") !== showingBack ? mirror(cut) : cut)}
                dir={(side === "back") !== showingBack ? (-dir as 1 | -1) : dir}
                phase={phase}
                gone={wrapperGone}
                z={packHalfDepth(w)}
              />
            ))}
            {/* Folded side seams give the pack its thickness; they lose the top once it is cut */}
            <PackWalls
              pack={pack}
              width={w}
              clipTop={cut ? cutLow : 0}
              style={{ opacity: wrapperGone ? 0 : 1, transition: "opacity 0.35s ease-in" }}
            />

            {/* The card lives between the two faces, so it can only be seen through the opening */}
            {pull && (
              <InnerCard
                card={pull}
                width={cardW}
                height={cardH}
                top={cardTop}
                left={(w - cardW) / 2}
                y={cardY}
                tornAngle={tornAngle}
                rotate={cardTurnSpring}
                revealed={phase === "revealed"}
                big={!!big}
              />
            )}
          </motion.div>

          {/* The pack itself dims with the room while you slice, so the slash blazes over it */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[5] bg-black"
            style={{ WebkitMask: `url(${facingSrc}) center / 100% 100% no-repeat`, mask: `url(${facingSrc}) center / 100% 100% no-repeat` }}
            initial={false}
            animate={{ opacity: phase === "tearing" ? 0.5 : 0 }}
            transition={{ duration: phase === "tearing" ? 0.3 : 0.25, ease: EASE }}
          />

          {/* Slice zone: the top band of the pack and the empty space either side of it */}
          {phase === "idle" || phase === "tearing" ? (
            <div
              className="absolute z-10 touch-none select-none"
              style={{ left: "-24%", right: "-24%", top: "-7%", height: `${CUT_BOTTOM + 9}%`, cursor: "crosshair" }}
              data-cursor="Slice"
              onPointerDown={onCutDown}
              onPointerMove={onCutMove}
              onPointerUp={onCutUp}
              onPointerCancel={onCutUp}
            />
          ) : null}

          {/* The slash: a glowing trail in the pack's colour with a white-hot core, drawn flat over the pack */}
          <motion.svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ opacity: trailOpacity }}
          >
            <motion.path d={trail} fill="none" stroke={slash} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.75} style={{ filter: "blur(6px)" }} />
            <motion.path d={trail} fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 2px rgb(0 0 0 / 0.6))" }} />
            <motion.path d={trailHead} fill="none" stroke={slash} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.9} style={{ filter: "blur(9px)" }} />
            <motion.path d={trailHead} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 8px ${slash})` }} />
          </motion.svg>
          {/* Hot spot at the finger */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute z-30 size-0"
            style={{ left: bladeLeft, top: bladeTop, opacity: bladeOpacity }}
          >
            <span className="absolute -left-5 -top-5 size-10 rounded-full blur-[6px]" style={{ background: `radial-gradient(circle, #ffffff 0%, ${slash} 45%, transparent 72%)` }} />
          </motion.div>

          {/* White flash beam along the cut, wider than the pack, the instant it opens */}
          <AnimatePresence>
            {phase === "torn" && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute z-30 h-[2.6%] w-[190%] -translate-y-1/2 rounded-full"
                style={{ left: "-45%", top: `${cutMid}%`, background: `linear-gradient(90deg, transparent, ${pack.color} 18%, #ffffff 40%, #ffffff 60%, ${pack.color} 82%, transparent)`, boxShadow: `0 0 40px 10px ${pack.color}88` }}
                initial={{ opacity: 0, scaleX: 0.2, scaleY: 0.6 }}
                animate={{ opacity: [0, 1, 0], scaleX: [0.2, 1, 1.15], scaleY: [0.6, 1.6, 0.4] }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut", times: [0, 0.25, 1] }}
              />
            )}
          </AnimatePresence>

          {/* Light bursting out of the opening */}
          <AnimatePresence>
            {(phase === "torn" || phase === "rising") && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 h-[70%] w-[130%] -translate-x-1/2 mix-blend-screen"
                style={{ top: `${cutMid - 62}%`, background: `radial-gradient(50% 60% at 50% 100%, #fff8d6, ${pack.color} 35%, transparent 70%)` }}
                initial={{ opacity: 0, scaleY: 0.3 }}
                animate={{ opacity: [0, 1, 0.5], scaleY: [0.3, 1.2, 1] }}
                exit={{ opacity: 0, transition: { duration: 0.5 } }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          {/* Foil flakes */}
          {phase === "torn" && !reduce && <FoilFlakes color={pack.color} dir={dir} top={cutMid} />}
        </div>
      </div>

      {/* ---------- Controls & result: centred under the pack, side by side ---------- */}
      <motion.div
        className="relative mt-4 flex w-full flex-col items-center px-4 text-center"
        // The revealed card leaves empty room at the bottom of the pack's box: tuck the result up into it.
        animate={{ marginTop: phase === "revealed" ? -Math.round(w * 0.14) : 32 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <AnimatePresence mode="wait">
          {sealed && (
            <motion.div
              key="hint"
              className="flex flex-wrap items-center justify-center gap-4 sm:gap-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <button type="button" onClick={autoCut} data-magnetic="" className={buttonClasses({ size: "lg" })}>
                Rip it for me
              </button>
              {onBack && (
                <button type="button" onClick={onBack} data-magnetic="" className={buttonClasses({ variant: "outline", size: "lg" })}>
                  ← Pick a different pack
                </button>
              )}
            </motion.div>
          )}
          {phase === "card" && (
            <motion.p
              key="flip"
              className="flex h-16 items-center text-base font-semibold uppercase tracking-[0.24em] text-accent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.4 } }}
              exit={{ opacity: 0 }}
            >
              Tap the card to reveal
            </motion.p>
          )}
          {phase === "revealed" && pull && (
            <motion.div
              key="result"
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.55, duration: 0.6, ease: EASE } }}
              exit={{ opacity: 0 }}
            >
              <p className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2">
                <span className="text-sm font-bold uppercase tracking-[0.24em]" style={{ color: rarityColor[pull.rarity] }}>
                  {rarityLabel[pull.rarity]} pull
                </span>
                <span className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{pull.name}</span>
                <span className="text-base text-text-muted">~${pull.value}</span>
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
                <button type="button" onClick={reset} data-magnetic="" className={buttonClasses({ size: "lg" })}>
                  Rip another · ${pack.price.toFixed(2)}
                </button>
                <Link href="/collection" data-magnetic="" className={buttonClasses({ variant: "outline", size: "lg" })}>
                  View collection
                </Link>
                {onBack && (
                  <button type="button" onClick={onBack} data-magnetic="" className={buttonClasses({ variant: "outline", size: "lg" })}>
                    ← Packs
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One face of the pack: body below the cut + the strip above it       */
/* ------------------------------------------------------------------ */

function PackFace({
  pack,
  side,
  cut,
  dir,
  phase,
  gone,
  z,
}: {
  pack: Pack;
  side: "front" | "back";
  /** The cut in this face's own coordinates (left to right), or null while sealed. */
  cut: Pt[] | null;
  /** Cut direction in this face's own coordinates. */
  dir: 1 | -1;
  phase: Phase;
  gone: boolean;
  z: number;
}) {
  const isBack = side === "back";
  const src = isBack ? pack.back : pack.image;
  const bodyClip = cut ? `polygon(${poly(cut)}, 100% 100%, 0% 100%)` : undefined;
  const stripClip = cut ? `polygon(0% 0%, 100% 0%, ${poly([...cut].reverse())})` : undefined;
  // The strip hinges on the end where the cut finished, then flies off that way.
  const end = cut ? (dir === 1 ? cut[cut.length - 1] : cut[0]) : null;
  const pivot = end ? `50% ${end.y / 2}%` : "50% 6%";

  return (
    <div
      className="absolute inset-0 [backface-visibility:hidden]"
      style={{ transform: `${isBack ? "rotateY(180deg) " : ""}translateZ(${z}px)` }}
    >
      {/* Body: drops away once the card is out */}
      <motion.div
        className="absolute inset-0"
        style={{ filter: `drop-shadow(0 0 30px ${pack.color}99)` }}
        animate={gone ? { y: "55%", opacity: 0, rotate: dir * 6 } : { y: 0, opacity: 1, rotate: 0 }}
        transition={{ duration: gone ? 0.8 : 0.5, ease: gone ? [0.5, 0, 0.75, 0] : EASE }}
      >
        <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-contain" style={{ clipPath: bodyClip }} />
        <FaceShade src={src} style={{ clipPath: bodyClip }} />
      </motion.div>

      {/* Strip above the cut: lifts at the start of the cut and flies off past the far end */}
      {cut && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ transformOrigin: pivot, filter: "drop-shadow(0 6px 10px rgb(0 0 0 / 0.5))" }}
          // Pops up and away toward the end of the cut, tilting, and flattens as it turns edge-on.
          initial={{ x: 0, y: 0, rotate: 0, scaleY: 1, scale: 1, opacity: 1 }}
          animate={{
            x: ["0%", `${dir * 10}%`, `${dir * 48}%`],
            y: ["0%", "-16%", "-34%"],
            rotate: [0, dir * 10, dir * 22],
            scaleY: [1, 0.85, 0.12],
            scale: [1, 0.95, 0.75],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 0.95, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.3, 1] }}
        >
          <div className="absolute inset-0" style={{ clipPath: stripClip }}>
            <img src={src} alt="" draggable={false} className="absolute inset-0 size-full object-contain" />
            <FaceShade src={src} />
          </div>
        </motion.div>
      )}

      {/* Slice-here line: a thin seam of light with a glint sweeping along it */}
      {phase === "idle" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: `${GUIDE_Y}%` }}>
          <div className="h-[2px] w-full -translate-y-1/2 opacity-70" style={{ background: "linear-gradient(90deg, transparent, #ffffff 12%, #ffffff 88%, transparent)", boxShadow: `0 0 8px ${pack.color}` }} />
          <motion.span
            className="absolute -top-[9px] h-[18px] w-[22%] -translate-x-1/2 rounded-full blur-[5px]"
            style={{ background: `radial-gradient(closest-side, #ffffff, ${pack.color}aa 55%, transparent)` }}
            animate={{ left: ["-10%", "110%"], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.9, ease: "easeInOut", times: [0, 0.15, 0.85, 1] }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The card: starts inside the pack, slides up, can be turned over     */
/* ------------------------------------------------------------------ */

function InnerCard({
  card,
  width,
  height,
  top,
  left,
  y,
  tornAngle,
  rotate,
  revealed,
  big,
}: {
  card: PullCard;
  width: number;
  height: number;
  top: number;
  left: number;
  y: number;
  tornAngle: number;
  rotate: MotionValue<number>;
  revealed: boolean;
  big: boolean;
}) {
  const color = rarityColor[card.rarity];
  // `rotate` is the card's angle on screen; the card sits inside the turned pack, so undo the pack's turn.
  const local = useTransform(rotate, (r) => r - tornAngle);
  return (
    <motion.div
      className="absolute [transform-style:preserve-3d]"
      style={{ width, height, top, left, rotateY: local }}
      initial={{ y: 0, scale: 1 }}
      animate={{ y, scale: revealed ? 1.08 : 1 }}
      transition={{ duration: 0.85, ease: EASE }}
      role="img"
      aria-label={revealed ? `${card.name}, ${rarityLabel[card.rarity]}` : "Your card, face down"}
    >
      {/* Back of the card (Pokémon card back) */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[4.5%] [backface-visibility:hidden] shadow-[0_18px_50px_rgb(0_0_0/0.55)]"
        style={{ transform: "translateZ(0.5px)" }}
      >
        <img src={CARD_BACK} alt="" draggable={false} className="pointer-events-none size-full object-cover" />
      </div>
      {/* Face of the card */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[4.5%] [backface-visibility:hidden]"
        style={{ transform: "rotateY(180deg) translateZ(0.5px)", boxShadow: `0 0 0 1px ${color}55, 0 0 ${big ? 80 : 50}px ${color}88` }}
      >
        <img src={card.image} alt="" draggable={false} className="pointer-events-none size-full object-cover" />
        {revealed && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 mix-blend-color-dodge"
            style={{ background: "linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.7) 45%, rgb(255 220 120 / 0.4) 52%, transparent 65%)", backgroundSize: "250% 100%" }}
            initial={{ backgroundPosition: "100% 0" }}
            animate={{ backgroundPosition: "-50% 0" }}
            transition={{ duration: 1.1, delay: 0.5, ease: EASE }}
          />
        )}
      </div>
    </motion.div>
  );
}

/** A quick spray of foil flakes from the tear. */
function FoilFlakes({ color, dir, top }: { color: string; dir: 1 | -1; top: number }) {
  const flakes = Array.from({ length: 16 }, (_, i) => {
    const a = (i * 137.5) % 360;
    return { i, x: Math.cos((a * Math.PI) / 180) * (40 + (i % 5) * 18) + dir * 40, y: -60 - (i % 4) * 30, r: (i * 47) % 360, s: 4 + (i % 3) * 3 };
  });
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: `${top}%` }}>
      {flakes.map((f) => (
        <motion.span
          key={f.i}
          className="absolute left-1/2 rounded-[2px]"
          style={{ width: f.s, height: f.s * 1.6, background: f.i % 3 === 0 ? "#fff6c4" : color, boxShadow: `0 0 6px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: f.x * 1.6, y: [0, f.y, f.y + 160], opacity: [1, 1, 0], rotate: f.r * 2 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
