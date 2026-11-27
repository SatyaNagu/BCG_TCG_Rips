"use client";

/**
 * The "cinematic" hero overlay (heroConfig.look = "cinematic"), drawn on top of
 * the scroll video:
 *  - TearIntro: gold headline on black that splits apart, then a diagonal tear reveals the video
 *  - StoryCaptions: per-shot captions that glide in from opposite sides and drift with the scroll
 */

import { AnimatePresence, type MotionValue, motion, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { ShutterText } from "@/components/ui/HeroShutterText";
import { type Scene, heroConfig } from "@/lib/hero-config";
import { captionClass } from "./Caption";

const { scenes, intro } = heroConfig;
const EASE = [0.22, 1, 0.36, 1] as const;

export type TextStyle = "solid" | "liquid" | "glass";

/** Config default, overridable with ?text=solid|liquid|glass for side-by-side review. */
export function useTextStyle(): TextStyle {
  const [style, setStyle] = useState<TextStyle>(heroConfig.textStyle);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("text");
    if (q === "solid" || q === "liquid" || q === "glass") setStyle(q);
  }, []);
  return style;
}

type Piece = { text: string; kw: boolean };

/**
 * Splits "One [chance]." into words made of pieces, flagging bracketed keywords.
 * Punctuation that touches a keyword stays in the same word ("chance" + "."), so
 * it never wraps or gets its own gap.
 */
function toWords(text: string): Piece[][] {
  const words: Piece[][] = [];
  let joinNext = false;
  for (const part of text.split(/(\[[^\]]+\])/g).filter(Boolean)) {
    const kw = part.startsWith("[");
    const body = kw ? part.slice(1, -1) : part;
    const chunks = body.split(/(\s+)/);
    for (const chunk of chunks) {
      if (!chunk) continue;
      if (/^\s+$/.test(chunk)) {
        joinNext = false;
        continue;
      }
      if (joinNext && words.length) words[words.length - 1].push({ text: chunk, kw });
      else words.push([{ text: chunk, kw }]);
      joinNext = true;
    }
  }
  return words;
}

function pieceClass(style: TextStyle, kw: boolean) {
  if (style === "liquid") return kw ? "text-liquid kw" : "text-liquid";
  return kw ? "kw" : "";
}

function Pieces({ word, style }: { word: Piece[]; style: TextStyle }) {
  return (
    <>
      {word.map((p, i) => (
        <span key={i} className={pieceClass(style, p.kw)}>
          {p.text}
        </span>
      ))}
    </>
  );
}


/* ------------------------------------------------------------------ */
/* Opening: gold headline on black, then a diagonal tear               */
/* ------------------------------------------------------------------ */

/**
 * Jagged tear running corner to corner, top-right to bottom-left, in % of the
 * screen. Points sit on the diagonal and wobble sideways off it; the ends overshoot
 * the corners so no sliver of video shows. Fixed numbers so server and client match.
 */
const WOBBLE = [0, 2.4, -1.6, 3, -2.6, 1.4, -3.2, 2.6, -1.8, 2.4, -3, 1.6, -2.2, 1.2, 0];
const TEAR: [number, number][] = WOBBLE.map((o, i) => {
  const t = -2 + (104 * i) / (WOBBLE.length - 1);
  return [+(100 - t - o * 0.7).toFixed(2), +(t - o * 0.7).toFixed(2)];
});
const tearPath = TEAR.map(([x, y]) => `${x}% ${y}%`).join(", ");
/** Triangle above the tear (top-left corner). */
const UPPER_CLIP = `polygon(${tearPath}, -2% -2%)`;
/** Triangle below the tear (bottom-right corner). */
const LOWER_CLIP = `polygon(${tearPath}, 102% 102%)`;
const SEAM = TEAR.map(([x, y]) => `${x},${y}`).join(" ");

export function TearIntro({ progress }: { progress: MotionValue<number> }) {
  const { textEnd, tearEnd } = intro;
  const tearStart = textEnd * 0.8;

  // Headline: line 1 exits left, line 2 exits right, eyebrow fades.
  const line1X = useTransform(progress, [0, textEnd], ["0vw", "-115vw"]);
  const line2X = useTransform(progress, [0, textEnd], ["0vw", "115vw"]);
  const eyebrowOpacity = useTransform(progress, [0, textEnd * 0.5], [1, 0]);

  // Tear: each triangle slides away from the diagonal toward its own corner.
  const upX = useTransform(progress, [tearStart, tearEnd], ["0%", "-38%"]);
  const upY = useTransform(progress, [tearStart, tearEnd], ["0%", "-96%"]);
  const upR = useTransform(progress, [tearStart, tearEnd], [0, -4]);
  const loX = useTransform(progress, [tearStart, tearEnd], ["0%", "38%"]);
  const loY = useTransform(progress, [tearStart, tearEnd], ["0%", "96%"]);
  const loR = useTransform(progress, [tearStart, tearEnd], [0, -4]);
  // The torn edge flares gold as it splits, then cools.
  const seamOpacity = useTransform(progress, [tearStart * 0.9, tearStart, tearEnd], [0, 1, 0.25]);
  const visibility = useTransform(progress, (p) => (p >= tearEnd ? "hidden" : "visible"));
  const backdropOpacity = useTransform(progress, (p) => (p < tearStart ? 1 : 0));

  const half = (clip: string, x: MotionValue<string>, y: MotionValue<string>, rotate: MotionValue<number>, origin: string) => (
    <motion.div
      className="absolute inset-0 bg-bg"
      style={{ clipPath: clip, x, y, rotate, transformOrigin: origin }}
    >
      <motion.svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        style={{ opacity: seamOpacity }}
        aria-hidden="true"
      >
        <polyline
          points={SEAM}
          fill="none"
          stroke="#ffd400"
          strokeWidth={10}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          style={{ filter: "blur(6px)" }}
        />
        <polyline
          points={SEAM}
          fill="none"
          stroke="#fff3b0"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  );

  return (
    <motion.div className="pointer-events-none absolute inset-0 z-10" style={{ visibility }}>
      {/* Solid black under both halves until the tear starts, so no hairline shows along the seam */}
      <motion.div className="absolute inset-0 bg-bg" style={{ opacity: backdropOpacity }} />
      {half(UPPER_CLIP, upX, upY, upR, "0% 0%")}
      {half(LOWER_CLIP, loX, loY, loR, "100% 100%")}

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <motion.p
          className="mb-5 text-xs font-semibold uppercase tracking-[0.4em] text-accent sm:text-sm"
          style={{ opacity: eyebrowOpacity }}
          initial={{ opacity: 0, letterSpacing: "0.8em" }}
          animate={{ opacity: 1, letterSpacing: "0.4em" }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          {intro.eyebrow}
        </motion.p>
        <h1 className="font-display text-[clamp(3rem,11vw,10rem)] font-bold leading-[0.9] tracking-[-0.045em]">
          {intro.lines.map((line, i) => (
            <motion.span key={line} className="block whitespace-nowrap" style={{ x: i === 0 ? line1X : line2X }}>
              {/* Shutters in letter by letter on load, running on from one line to the next */}
              <ShutterText
                delay={0.2}
                startIndex={intro.lines.slice(0, i).reduce((n, l) => n + l.replace(/[\s[\]]/g, "").length, 0)}
                segments={toWords(line).flatMap((w, wi) =>
                  w.map((p, pi) => ({
                    text: (wi > 0 && pi === 0 ? " " : "") + p.text,
                    className: p.kw ? "text-gold-glow text-gold-glow--hot" : "text-gold-glow",
                  }))
                )}
              />
            </motion.span>
          ))}
        </h1>
      </div>
    </motion.div>
  );
}

function activeIndex(p: number) {
  return scenes.findIndex((s) => p >= s.start && p < s.end);
}

/* ------------------------------------------------------------------ */
/* Story captions                                                      */
/* ------------------------------------------------------------------ */

/** Where each caption sits, so it frames the shot instead of always the same corner. */
const PLACE: Record<Scene["place"], { box: string; text: string; side: 1 | -1 }> = {
  bl: { box: "items-end justify-start pb-[16vh] md:pb-[11vh]", text: "text-left", side: -1 },
  br: { box: "items-end justify-end pb-[16vh] md:pb-[11vh]", text: "text-right", side: 1 },
  tl: { box: "items-start justify-start pt-[calc(var(--header-h)+7vh)]", text: "text-left", side: -1 },
  tr: { box: "items-start justify-end pt-[calc(var(--header-h)+7vh)]", text: "text-right", side: 1 },
  ml: { box: "items-center justify-start", text: "text-left", side: -1 },
  mr: { box: "items-center justify-end", text: "text-right", side: 1 },
};

export function StoryCaptions({ progress, textStyle }: { progress: MotionValue<number>; textStyle: TextStyle }) {
  const [active, setActive] = useState(-1);
  useMotionValueEvent(progress, "change", (p) => setActive(activeIndex(p)));

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence>
        {active >= 0 && (
          <FlowCaption key={scenes[active].id} scene={scenes[active]} progress={progress} textStyle={textStyle} />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A caption in the spirit of the opening headline: a small kicker naming the part of
 * the site, then two lines that glide in from opposite sides out of a blur, drift
 * slowly with the scroll while the shot plays, and slide out the other way.
 */
function FlowCaption({ scene, progress, textStyle }: { scene: Scene; progress: MotionValue<number>; textStyle: TextStyle }) {
  const place = PLACE[scene.place];
  const lines = scene.caption.split("|");
  // Gentle parallax while this shot is on screen.
  const y = useTransform(progress, [scene.start, scene.end], [36, -36]);
  const x = useTransform(progress, [scene.start, scene.end], [0, place.side * -24]);

  return (
    <div className={`absolute inset-0 mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8 ${place.box}`}>
      <motion.div
        className={`relative max-w-[92vw] ${place.text} before:absolute before:-inset-x-[25%] before:-inset-y-[35%] before:-z-10 before:bg-[radial-gradient(closest-side,rgb(0_0_0/0.5),transparent)]`}
        style={{ x, y }}
      >
        <motion.p
          className="mb-3 text-[11px] font-semibold uppercase text-accent sm:text-xs"
          initial={{ opacity: 0, letterSpacing: "0.7em" }}
          animate={{ opacity: 1, letterSpacing: "0.32em" }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          {scene.kicker}
        </motion.p>
        <p className={`${captionClass} ${textStyle === "glass" ? "text-glass-panel inline-block" : ""}`}>
          {lines.map((line, i) => {
            // Lines arrive from opposite sides and leave the way the other one came.
            const from = (i % 2 === 0 ? -1 : 1) * place.side;
            return (
              <motion.span
                key={i}
                className="block sm:whitespace-nowrap"
                initial={{ opacity: 0, x: `${from * 14}vw`, filter: "blur(16px)" }}
                animate={{ opacity: 1, x: "0vw", filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  x: `${-from * 12}vw`,
                  filter: "blur(12px)",
                  transition: { duration: 0.55, delay: i * 0.05, ease: EASE },
                }}
                transition={{ duration: 1, delay: 0.08 + i * 0.12, ease: EASE }}
              >
                {toWords(line).map((w, wi) => (
                  <span key={wi} className="inline-block pr-[0.24em] last:pr-0">
                    <Pieces word={w} style={textStyle} />
                  </span>
                ))}
              </motion.span>
            );
          })}
        </p>
      </motion.div>
    </div>
  );
}
