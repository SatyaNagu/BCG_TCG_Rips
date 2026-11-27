"use client";

import { type MotionValue, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

export type RingItem = { key: string; color: string; render: (isFront: boolean) => ReactNode; label: string };

type Props = {
  items: RingItem[];
  /** Index of the pack facing the viewer. */
  active: number;
  onActiveChange: (index: number) => void;
  /** Tapping the front pack. */
  onPick: (index: number) => void;
  /** When set, every other pack fades away and this one comes forward. */
  picked?: number | null;
  /** Width of one pack in px. */
  itemWidth: number;
  /** Arc radius multiplier (larger = neighbours further apart). */
  spread?: number;
  /** Cursor label over the front pack. */
  pickLabel?: string;
  /** On first show, the ring rolls in from a few packs back and lands on the active one. */
  introSpin?: boolean;
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Packs standing on a 3D arc that wraps endlessly, like a carousel ring. Drag sideways, use the arrow keys or the
 * side buttons to spin it; it snaps so one pack faces front. Packs facing away
 * dim and blur so the front one reads first.
 */
export function PackRing({ items, active, onActiveChange, onPick, picked = null, itemWidth, spread = 1, pickLabel = "Pick", introSpin = false }: Props) {
  const reduce = useReducedMotion();
  const n = items.length;
  /** Angle between neighbours on the arc, and the arc's radius. */
  const step = 34;
  const radius = itemWidth * 2.4 * spread;

  // Unbounded position, so spinning past the last pack wraps the short way round.
  const [pos, setPos] = useState(active);
  useEffect(() => {
    // Follow outside changes (e.g. arriving from /packs#rare) by the shortest turn.
    setPos((p) => {
      const diff = mod(active - mod(p, n) + n / 2, n) - n / 2;
      return p + Math.round(diff);
    });
  }, [active, n]);

  // Playhead in pack units (1 = one pack along); springs to whole numbers.
  const target = useMotionValue(active);
  const rotation = useSpring(target, reduce ? { duration: 0 } : { stiffness: 120, damping: 20, mass: 0.9 });
  // introSpin: for a moment after the ring appears, wherever it lands (the default pack,
  // or one picked on the home page via /packs#rare) it rolls in from three packs back.
  const introUntil = useRef(introSpin && !reduce ? Date.now() + 400 : 0);
  useEffect(() => {
    if (Date.now() < introUntil.current) {
      // Put both the ring and its target three packs back, so setting the target is a real change the spring follows.
      target.jump(pos - 3);
      rotation.jump(pos - 3);
    }
    target.set(pos);
  }, [pos, target, rotation]);

  const go = (delta: number) => {
    const next = pos + delta;
    setPos(next);
    onActiveChange(mod(next, n));
  };

  // Drag to spin.
  const drag = useRef<{ x: number; base: number; moved: boolean } | null>(null);
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (picked !== null) return;
    drag.current = { x: e.clientX, base: pos, moved: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      // Capture only once it is a real drag, so a plain tap still clicks the pack.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    target.set(d.base - dx / (itemWidth * 1.1));
  };
  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    // Clear after the click event that follows pointerup has seen `moved`.
    window.setTimeout(() => {
      if (drag.current === d) drag.current = null;
    }, 0);
    if (!d.moved) {
      target.set(d.base);
      return;
    }
    const next = Math.round(target.get());
    setPos(next);
    target.set(next);
    onActiveChange(mod(next, n));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (picked !== null) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(mod(pos, n));
    }
  };

  const height = itemWidth * (1224 / 720);

  return (
    <div className="relative w-full select-none">
      <div
        role="listbox"
        tabIndex={0}
        aria-label="Packs. Use the left and right arrow keys to rotate, Enter to choose."
        aria-activedescendant={`ring-${items[mod(pos, n)].key}`}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative mx-auto touch-pan-y outline-none [perspective:1700px] focus-visible:ring-2 focus-visible:ring-accent/60"
        style={{ height: height * 1.12 }}
      >
        <div
          className="absolute left-1/2 top-1/2 [transform-style:preserve-3d]"
          style={{ width: itemWidth, height, marginLeft: -itemWidth / 2, marginTop: -height / 2 }}
        >
          {items.map((item, i) => (
            <RingSlot
              key={item.key}
              id={`ring-${item.key}`}
              item={item}
              index={i}
              count={n}
              step={step}
              radius={radius}
              rotation={rotation}
              isFront={mod(pos, n) === i}
              picked={picked}
              pickLabel={pickLabel}
              onClick={() => {
                if (drag.current?.moved || picked !== null) return;
                if (mod(pos, n) === i) onPick(i);
                else {
                  const diff = mod(i - mod(pos, n) + n / 2, n) - n / 2;
                  go(Math.round(diff));
                }
              }}
            />
          ))}
        </div>
      </div>

      {picked === null && (
        <>
          <ArrowButton side="left" onClick={() => go(-1)} />
          <ArrowButton side="right" onClick={() => go(1)} />
        </>
      )}
    </div>
  );
}

function RingSlot({
  id,
  item,
  count,
  step,
  radius,
  rotation,
  isFront,
  picked,
  index,
  pickLabel,
  onClick,
}: {
  id: string;
  item: RingItem;
  count: number;
  step: number;
  radius: number;
  rotation: MotionValue<number>;
  isFront: boolean;
  picked: number | null;
  index: number;
  pickLabel: string;
  onClick: () => void;
}) {
  // Signed distance from the front, wrapped so the ring has no ends.
  const offset = useTransform(rotation, (p) => {
    const d = (((index - p) % count) + count) % count;
    return d > count / 2 ? d - count : d;
  });
  const transform = useTransform(offset, (d) => {
    const a = (d * step * Math.PI) / 180;
    return `translateX(${Math.sin(a) * radius}px) translateZ(${(Math.cos(a) - 1) * radius}px) rotateY(${d * step}deg)`;
  });
  const reach = Math.min(2.2, count / 2 - 0.3);
  const opacity = useTransform(offset, (d) => Math.max(0, Math.min(1, (reach - Math.abs(d)) / 0.6)));
  const zIndex = useTransform(offset, (d) => Math.round(100 - Math.abs(d) * 10));
  const brightness = useTransform(offset, (d) => Math.max(0.35, 1 - Math.abs(d) * 0.32));
  const blur = useTransform(offset, (d) => Math.min(4, Math.max(0, Math.abs(d) - 0.6) * 2.4));
  const filter = useTransform(
    [brightness, blur] as MotionValue<number>[],
    ([b, bl]) => `brightness(${b}) blur(${bl}px) drop-shadow(0 0 ${isFront ? 34 : 14}px ${item.color}${isFront ? "aa" : "44"})`
  );

  const isPicked = picked === index;
  const gone = picked !== null && !isPicked;

  return (
    <motion.div
      id={id}
      role="option"
      aria-selected={isFront}
      aria-label={item.label}
      data-cursor={isFront && picked === null ? pickLabel : undefined}
      className="absolute inset-0"
      style={{ transform, opacity, zIndex }}
      onClick={onClick}
    >
      <motion.div
        className="size-full"
        style={{ filter }}
        animate={
          gone
            ? { opacity: 0, scale: 0.7, y: 60, transition: { duration: 0.55, delay: Math.abs(index - (picked ?? 0)) * 0.04, ease: [0.4, 0, 0.2, 1] } }
            : isPicked
              ? { opacity: 1, scale: 1.12, y: -10, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
              : { opacity: 1, scale: isFront ? 1.04 : 0.92, y: isFront ? -6 : 0 }
        }
        transition={{ type: "spring", stiffness: 160, damping: 20 }}
        whileHover={picked === null ? { y: isFront ? -14 : -4 } : undefined}
      >
        {item.render(isFront)}
      </motion.div>
    </motion.div>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      data-magnetic=""
      onClick={onClick}
      aria-label={side === "left" ? "Rotate left" : "Rotate right"}
      className={`absolute top-1/2 z-10 grid size-16 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-bg/60 text-2xl text-text backdrop-blur-md transition-[border-color,color,translate] duration-200 hover:border-accent hover:text-accent ${
        side === "left" ? "left-2 sm:left-6" : "right-2 sm:right-6"
      }`}
    >
      <span aria-hidden="true">{side === "left" ? "←" : "→"}</span>
    </button>
  );
}
