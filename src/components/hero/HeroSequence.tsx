"use client";

import {
  AnimatePresence,
  type MotionValue,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FrameSet, type Scene, framePath, heroConfig } from "@/lib/hero-config";
import { CaptionText, captionClass } from "./Caption";
import { HeroStatic } from "./HeroStatic";
import { useFrameSequence } from "./useFrameSequence";
import { VideoScrub } from "./VideoScrub";
import { StoryCaptions, TearIntro, useTextStyle } from "./CinematicOverlay";

const { frames, scenes } = heroConfig;
const MAX_DPR = 2;
/** Frames kept decoded ahead of / behind the playhead (each 1920×1080 frame is ~8 MB decoded). */
const AHEAD = 30;
const BEHIND = 10;
/** Furthest a ready (decoded) frame may be from the playhead before we fall back to an undecoded one. */
const MAX_SUBSTITUTE = 6;
/** Decodes in flight at once, so the frames nearest the playhead finish first. */
const MAX_DECODES = 4;

function pickSet(): FrameSet {
  return window.innerWidth / window.innerHeight < frames.mobileBelowAspect ? frames.mobile : frames.desktop;
}

/** Draws a frame like object-fit: cover. */
function drawCover(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, src: HTMLImageElement | ImageBitmap) {
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const scale = Math.max(canvas.width / sw, canvas.height / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(src, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

export function HeroSequence() {
  const reduce = useReducedMotion();
  // The server can't know the preference, so swap only after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (mounted && reduce) return <HeroStatic />;
  return <ScrollSequence />;
}

function ScrollSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [set, setSet] = useState<FrameSet | null>(null);
  /** Phones play the hero as a scrubbed video; larger screens draw image frames on a canvas. */
  const useVideo = set === frames.mobile;
  const canvasSet = useVideo ? null : set;
  const [videoPercent, setVideoPercent] = useState(0);
  const textStyle = useTextStyle();

  const imagesRef = useRef<(Blob | null)[]>([]);
  /** Pre-decoded frames around the playhead, so drawing never waits on a decode. */
  const bitmaps = useRef(new Map<number, ImageBitmap>());
  const decoding = useRef(new Set<number>());
  const generation = useRef(0);
  /** Fractional frame index: 12.4 shows frame 12 blended 40% into frame 13. */
  const position = useRef(0);
  /** +1 while scrolling down, -1 while scrolling up. */
  const direction = useRef(1);
  const drawnKey = useRef("");
  const rafId = useRef(0);
  const prepareRef = useRef<() => void>(() => {});

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  /**
   * Video playhead (0–1). In the cinematic look the video holds its first frame
   * while the opening tears open, then plays over the rest of the scroll.
   */
  const videoStart = heroConfig.look === "cinematic" ? heroConfig.intro.tearEnd : 0;
  const videoProgress = useTransform(scrollYProgress, (p) =>
    Math.min(1, Math.max(0, (p - videoStart) / (1 - videoStart)))
  );

  // Choose the frame set from the viewport shape; swap if it changes on resize.
  useEffect(() => {
    setSet(pickSet());
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setSet((prev) => (pickSet() === prev ? prev : pickSet())), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const draw = useCallback(() => {
    rafId.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const list = imagesRef.current;
    if (!canvas || !ctx || !list.length) return;

    const pos = position.current;
    const a = Math.floor(pos);
    const b = Math.min(a + 1, list.length - 1);
    const t = pos - a;

    // Prefer the nearest already-decoded frame: drawing an undecoded image makes the
    // browser decode it synchronously, which freezes scrolling for several frames.
    const ready = bitmaps.current;
    let base = -1;
    for (let d = 0; d <= MAX_SUBSTITUTE && base < 0; d++) {
      if (ready.has(a - d)) base = a - d;
      else if (ready.has(a + d)) base = a + d;
    }
    // Nothing decoded nearby (first paint or a huge jump): show the nearest decoded frame,
    // or keep what is on screen until the window around the playhead is ready.
    for (let d = MAX_SUBSTITUTE + 1; base < 0 && d < list.length; d++) {
      if (ready.has(a - d)) base = a - d;
      else if (ready.has(a + d)) base = a + d;
    }
    if (base < 0) return;
    // Blend into the next frame only when both neighbours are decoded and exactly in place.
    const blend = base === a && b !== a && ready.has(b) && t > 0.02 ? Math.round(t * 32) / 32 : 0;

    const key = `${base}:${blend}:${bitmaps.current.has(base)}:${bitmaps.current.has(b)}`;
    if (key === drawnKey.current) return;

    ctx.globalAlpha = 1;
    drawCover(ctx, canvas, ready.get(base)!);
    if (blend) {
      ctx.globalAlpha = blend;
      drawCover(ctx, canvas, ready.get(b)!);
      ctx.globalAlpha = 1;
    }
    drawnKey.current = key;
  }, []);

  const requestDraw = useCallback(() => {
    if (!rafId.current) rafId.current = requestAnimationFrame(draw);
  }, [draw]);

  // Decode frames near the playhead ahead of time and release ones far behind it.
  const prepareWindow = useCallback(() => {
    const list = imagesRef.current;
    const center = Math.round(position.current);
    // Decode further ahead in the direction the visitor is scrolling.
    const forward = direction.current >= 0;
    const lo = center - (forward ? BEHIND : AHEAD);
    const hi = center + (forward ? AHEAD : BEHIND);
    for (const [i, bitmap] of bitmaps.current) {
      if (i < lo - 4 || i > hi + 4) {
        bitmap.close();
        bitmaps.current.delete(i);
      }
    }
    // Nearest frames first, leading side before trailing side.
    const order: number[] = [];
    for (let d = 0; d <= AHEAD; d++) {
      const lead = forward ? center + d : center - d;
      const trail = forward ? center - d : center + d;
      if (lead >= lo && lead <= hi) order.push(lead);
      if (d > 0 && d <= BEHIND && trail >= lo && trail <= hi) order.push(trail);
    }
    for (const i of order) {
      const blob = list[i];
      if (!blob || bitmaps.current.has(i) || decoding.current.has(i)) continue;
      if (decoding.current.size >= MAX_DECODES) break;
      decoding.current.add(i);
      const gen = generation.current;
      createImageBitmap(blob)
        .then((bitmap) => {
          decoding.current.delete(i);
          const c = Math.round(position.current);
          if (gen !== generation.current || i < c - AHEAD - 4 || i > c + AHEAD + 4) {
            bitmap.close();
            return;
          }
          bitmaps.current.set(i, bitmap);
          if (Math.abs(i - position.current) <= MAX_SUBSTITUTE || !drawnKey.current) {
            drawnKey.current = "";
            requestDraw();
          }
          prepareRef.current(); // keep the window filling as decode slots free up
        })
        .catch(() => decoding.current.delete(i));
    }
  }, [requestDraw]);
  prepareRef.current = prepareWindow;

  const loaded = useFrameSequence(canvasSet, imagesRef, (index) => {
    // A newly loaded frame may be closer to the playhead than the one on screen.
    if (Math.abs(index - position.current) <= AHEAD) prepareWindow();
    if (Math.abs(index - position.current) <= 2 || !drawnKey.current) {
      drawnKey.current = "";
      requestDraw();
    }
  });

  // Scroll position = playhead position, kept fractional so frames blend instead of stepping.
  useMotionValueEvent(videoProgress, "change", (p) => {
    const set = canvasSet;
    if (!set) return;
    const next = Math.min(1, Math.max(0, p)) * (set.count - 1);
    if (Math.abs(next - position.current) < 0.001) return;
    const crossed = Math.round(next) !== Math.round(position.current);
    direction.current = next > position.current ? 1 : -1;
    position.current = next;
    if (crossed) prepareWindow();
    requestDraw();
  });

  // Keep the canvas backing store matched to its CSS size × devicePixelRatio.
  useEffect(() => {
    const canvas = canvasRef.current;
    const set = canvasSet;
    if (!canvas || !set) return;
    const cache = bitmaps.current;
    const inFlight = decoding.current;
    position.current = videoProgress.get() * (set.count - 1);
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      drawnKey.current = ""; // resizing clears the canvas
      requestDraw();
    });
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
      // A new frame set (or unmount) invalidates every decoded bitmap.
      generation.current += 1;
      for (const bitmap of cache.values()) bitmap.close();
      cache.clear();
      inFlight.clear();
      drawnKey.current = "";
    };
  }, [canvasSet, requestDraw, videoProgress]);

  const ready = useVideo
    ? videoPercent >= 100
    : canvasSet
      ? loaded >= Math.ceil(canvasSet.count * heroConfig.readyThreshold)
      : false;
  const percent = useVideo ? videoPercent : canvasSet ? Math.round((loaded / canvasSet.count) * 100) : 0;

  return (
    <section
      ref={sectionRef}
      aria-label="Pull, grade, reveal"
      className="relative"
      style={{ height: `${heroConfig.scrollLengthVh}vh` }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-bg">
        {/* Frame 1 paints before any JS runs; the canvas covers it once drawing starts. */}
        <picture>
          <source media={`(max-aspect-ratio: ${aspectFraction(frames.mobileBelowAspect)})`} srcSet={framePath(frames.mobile, 0)} />
          <img src={framePath(frames.desktop, 0)} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
        </picture>
        {useVideo ? (
          <VideoScrub src={frames.mobileVideo} progress={videoProgress} onLoadProgress={setVideoPercent} />
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
        )}

        {/* Legibility gradient behind captions */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg/85 via-bg/30 to-transparent" />

        {heroConfig.look === "cinematic" ? (
          <>
            <StoryCaptions progress={videoProgress} textStyle={textStyle} />
            <TearIntro progress={scrollYProgress} />
          </>
        ) : (
          <div className="pointer-events-none absolute inset-0 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {scenes.map((scene) => (
              <SceneCaption key={scene.id} scene={scene} progress={videoProgress} />
            ))}
          </div>
        )}

        <ScrollHint progress={scrollYProgress} />

        <AnimatePresence>
          {!ready && (
            <motion.div
              role="status"
              aria-live="polite"
              className="absolute bottom-6 right-6 z-20 flex items-center gap-2.5 rounded-pill border border-border bg-bg/70 py-1.5 pl-1.5 pr-3.5 text-xs font-medium text-text-muted backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
            >
              <LoadingRing percent={percent} />
              Loading {percent}%
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function aspectFraction(ratio: number) {
  return `${Math.round(ratio * 100)}/100`;
}

/** Fades and slides in over the start of its scroll range, out over the end; exact reverse on the way up. */
function SceneCaption({ scene, progress }: { scene: Scene; progress: MotionValue<number> }) {
  const fade = (scene.end - scene.start) * heroConfig.captionFade;
  const first = scene.start === 0;
  const input = [scene.start, scene.start + fade, scene.end - fade, scene.end];
  const opacity = useTransform(progress, input, [first ? 1 : 0, 1, 1, 0]);
  const y = useTransform(progress, input, [first ? 0 : 40, 0, 0, -40]);
  const visibility = useTransform(opacity, (o) => (o < 0.01 ? "hidden" : "visible"));

  return (
    <motion.p
      className={`absolute bottom-[14vh] left-4 right-4 max-w-[14ch] sm:left-6 md:bottom-[9vh] md:max-w-[18ch] lg:left-8 ${captionClass}`}
      style={{ opacity, y, visibility }}
    >
      <CaptionText text={scene.caption} />
    </motion.p>
  );
}

function ScrollHint({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.03], [1, 0]);
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-subtle"
      style={{ opacity }}
    >
      Scroll
      <span className="relative h-8 w-px overflow-hidden bg-border-strong">
        <span className="absolute inset-x-0 top-0 h-1/2 animate-[scroll-hint_1.6s_var(--ease-in-out)_infinite] bg-accent" />
      </span>
    </motion.div>
  );
}

function LoadingRing({ percent }: { percent: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2.5" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - percent / 100)}
        className="transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}
