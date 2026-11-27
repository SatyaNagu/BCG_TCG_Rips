"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Gold cursor for mouse and trackpad users (touch devices keep their normal behaviour):
 *  - a glowing gold arrow whose tip sits exactly on the pointer (tilts over links),
 *  - a glowing outline that springs around any `[data-magnetic]` element (buttons),
 *  - a short label beside the arrow for elements with `data-cursor="Drag"` etc.
 * Magnetic elements also lean toward the pointer while hovered (CSS `translate`,
 * so it never fights the element's own transforms).
 */

const RING = 34;
const MAGNET_PULL = 0.28;
const INTERACTIVE = "a, button, [role='button'], label, select, summary";
const TEXT_INPUT = "input, textarea, [contenteditable='true']";

export function GoldCursor() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !calm.matches);
    update();
    fine.addEventListener("change", update);
    calm.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      calm.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("has-gold-cursor", enabled);
    return () => document.documentElement.classList.remove("has-gold-cursor");
  }, [enabled]);

  return enabled ? <Cursor /> : null;
}

type Mode = "default" | "link" | "magnet" | "label" | "text" | "hidden";

function Cursor() {
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  // Ring geometry (centre + size) follows on a spring.
  const spring = { stiffness: 420, damping: 34, mass: 0.6 };
  const ringX = useSpring(-100, spring);
  const ringY = useSpring(-100, spring);
  const ringW = useSpring(RING, spring);
  const ringH = useSpring(RING, spring);
  const [mode, setMode] = useState<Mode>("default");
  const [label, setLabel] = useState("");
  const [pressed, setPressed] = useState(false);
  const magnet = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const release = () => {
      if (magnet.current) magnet.current.style.translate = "";
      magnet.current = null;
    };

    const last = { x: -100, y: -100, active: false };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      last.x = e.clientX;
      last.y = e.clientY;
      last.active = true;
      evaluate(e.clientX, e.clientY, e.target instanceof Element ? e.target : null);
    };

    const evaluate = (x: number, y: number, target: Element | null) => {
      dotX.set(x);
      dotY.set(y);
      const e = { clientX: x, clientY: y };

      const labelled = target?.closest<HTMLElement>("[data-cursor]");
      const magnetic = target?.closest<HTMLElement>("[data-magnetic]");

      if (magnet.current && magnet.current !== magnetic) release();

      if (target?.closest(TEXT_INPUT)) {
        // Text fields keep the normal I-beam; the gold cursor steps aside.
        setMode("text");
        follow(e.clientX, e.clientY, RING, RING);
      } else if (magnetic) {
        // Lean the element toward the pointer, and wrap the ring around it.
        magnet.current = magnetic;
        const r = magnetic.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) * MAGNET_PULL;
        const dy = (e.clientY - cy) * MAGNET_PULL;
        magnetic.style.translate = `${dx}px ${dy}px`;
        setMode("magnet");
        follow(cx + dx, cy + dy, r.width + 14, r.height + 14);
      } else if (labelled) {
        setMode("label");
        setLabel(labelled.dataset.cursor ?? "");
        follow(e.clientX, e.clientY, RING, RING);
      } else if (target?.closest(INTERACTIVE)) {
        setMode("link");
        follow(e.clientX, e.clientY, RING, RING);
      } else {
        setMode("default");
        follow(e.clientX, e.clientY, RING, RING);
      }
    };

    const follow = (x: number, y: number, w: number, h: number) => {
      ringX.set(x);
      ringY.set(y);
      ringW.set(w);
      ringH.set(h);
    };

    const onLeaveWindow = () => {
      last.active = false;
      release();
      setMode("hidden");
    };

    // The page can change under a still pointer (a button disappears after a click,
    // the page scrolls), so re-check what is under it a few times a second.
    const recheck = () => {
      if (!last.active) return;
      evaluate(last.x, last.y, document.elementFromPoint(last.x, last.y));
    };
    const timer = window.setInterval(recheck, 120);
    const onClick = () => window.setTimeout(recheck, 30);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", recheck, { passive: true });
    return () => {
      release();
      window.clearInterval(timer);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", recheck);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
    };
  }, [dotX, dotY, ringX, ringY, ringW, ringH]);

  const ringVisible = mode === "magnet";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[200]">
      {/* Glowing outline that wraps magnetic buttons */}
      <motion.div
        className="absolute left-0 top-0 rounded-full border-[1.5px] border-[#ffd400] shadow-[0_0_18px_rgba(255,196,0,0.45),inset_0_0_12px_rgba(255,196,0,0.18)]"
        style={{ x: ringX, y: ringY, width: ringW, height: ringH, translateX: "-50%", translateY: "-50%" }}
        animate={{ opacity: ringVisible ? 1 : 0, scale: ringVisible ? (pressed ? 0.94 : 1) : 0.6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      />

      {/* The gold arrow: its tip sits exactly on the pointer */}
      <motion.div className="absolute left-0 top-0" style={{ x: dotX, y: dotY }}>
        <motion.svg
          width="30"
          height="34"
          viewBox="0 0 30 34"
          className="block -translate-x-[3px] -translate-y-[2px]"
          style={{ filter: "drop-shadow(0 0 6px rgba(255,212,0,0.85)) drop-shadow(0 0 16px rgba(255,170,0,0.45))" }}
          animate={{ opacity: mode === "hidden" || mode === "text" ? 0 : 1, scale: pressed ? 0.86 : 1, rotate: mode === "link" || mode === "magnet" ? -8 : 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <defs>
            <linearGradient id="gold-arrow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff6c4" />
              <stop offset="0.35" stopColor="#ffd400" />
              <stop offset="0.7" stopColor="#ffb800" />
              <stop offset="1" stopColor="#c98a00" />
            </linearGradient>
          </defs>
          <path
            d="M3 2 L3 27 L9.5 20.8 L14.2 31.2 L18.6 29.2 L13.9 18.9 L22.8 18.9 Z"
            fill="url(#gold-arrow)"
            stroke="#fff3b0"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </motion.svg>

        {/* Action label beside the arrow (Drag, Flip, Rip…) */}
        <AnimatePresence>
          {mode === "label" && (
            <motion.span
              key={label}
              className="absolute left-7 top-7 whitespace-nowrap rounded-full bg-[#ffd400] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-on-accent shadow-[0_0_18px_rgba(255,196,0,0.6)]"
              initial={{ opacity: 0, scale: 0.6, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.16 }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
