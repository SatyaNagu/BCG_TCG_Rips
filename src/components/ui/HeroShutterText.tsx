"use client";

import { motion, useReducedMotion } from "motion/react";

/** A run of text with its own look (e.g. the gold keyword in a headline). */
export type ShutterSegment = { text: string; className?: string };

type Props = {
  /** The text, split into styled runs. Words never break inside. */
  segments: ShutterSegment[];
  /** Characters already shown by earlier lines, so the stagger runs on across lines. */
  startIndex?: number;
  /** Seconds before the first character starts. */
  delay?: number;
  /** Seconds between characters. */
  stagger?: number;
  /** Colours of the three shutter slices (top, middle, bottom). */
  sliceColors?: [string, string, string];
};

/** Horizontal bands each shutter slice covers (as clip-paths over one character). */
const SLICES = [
  { clip: "polygon(0 0, 100% 0, 100% 35%, 0 35%)", from: "-100%", to: "100%", lag: 0 },
  { clip: "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)", from: "100%", to: "-100%", lag: 0.1 },
  { clip: "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)", from: "-100%", to: "100%", lag: 0.2 },
] as const;

/**
 * Shutter-in text: each character resolves out of a blur while three coloured
 * slices of it (top, middle, bottom) sweep across in alternating directions, like
 * a camera shutter. Sizes follow the surrounding font, so it drops into any heading.
 * Adapted from the "hero shutter text" component for this site's motion library and
 * black-and-gold theme; plays once on mount.
 */
export function ShutterText({ segments, startIndex = 0, delay = 0, stagger = 0.04, sliceColors = ["#ffd400", "#ffffff", "#ffd400"] }: Props) {
  const reduce = useReducedMotion();

  // Split into words (keeping each run's look) so a word never wraps mid-way.
  const words: { char: string; className?: string }[][] = [];
  let current: { char: string; className?: string }[] = [];
  for (const seg of segments) {
    for (const char of seg.text) {
      if (/\s/.test(char)) {
        if (current.length) words.push(current);
        current = [];
      } else current.push({ char, className: seg.className });
    }
  }
  if (current.length) words.push(current);

  let i = startIndex;
  return (
    <>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap pr-[0.2em] last:pr-0">
          {word.map(({ char, className }, ci) => {
            const at = delay + i++ * stagger;
            return (
              <span key={ci} className="relative inline-block">
                {/* The character itself, resolving out of a blur */}
                {/* Padding with matching negative margin lets a gradient fill (background-clip: text)
                    reach ascenders and descenders that poke out of a tight line height, without moving the letter. */}
                <motion.span
                  className={`-mb-[0.25em] -mt-[0.1em] inline-block pb-[0.25em] pt-[0.1em] ${className ?? ""}`}
                  initial={reduce ? false : { opacity: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: at + 0.3, duration: 0.8 }}
                >
                  {char}
                </motion.span>

                {/* Shutter slices sweeping across it. Clipped to the character's width only,
                    so ascenders, descenders and glows above and below are never cut. */}
                {!reduce && (
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ clipPath: "inset(-30% 0 -40% 0)" }}>
                    {SLICES.map((s, si) => (
                      <motion.span
                        key={si}
                        className="absolute inset-0"
                        style={{ clipPath: s.clip, color: sliceColors[si] }}
                        initial={{ x: s.from, opacity: 0 }}
                        animate={{ x: s.to, opacity: [0, 1, 0] }}
                        transition={{ duration: 0.7, delay: at + s.lag, ease: "easeInOut" }}
                      >
                        {char}
                      </motion.span>
                    ))}
                  </span>
                )}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}
