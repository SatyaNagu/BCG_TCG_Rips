"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";
import type { Pack } from "@/lib/packs";

/** Pack image ratio (height / width). */
export const PACK_RATIO = 1224 / 720;
/** Thickness of a sealed pack at its fattest point, as a share of its width. */
const DEPTH = 0.1;

/** How far each face sits out from the pack's centre plane, in px. */
export const packHalfDepth = (width: number) => (width * DEPTH) / 2;

/**
 * A solid two-sided pack: front and back faces held apart by foil side walls, so it
 * has real thickness when it turns. `flipped` turns it over on a spring.
 */
export function Pack3D({ pack, width, flipped = false }: { pack: Pack; width: number; flipped?: boolean }) {
  const z = packHalfDepth(width);
  return (
    <motion.div
      className="relative size-full [transform-style:preserve-3d]"
      initial={false}
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 16 }}
    >
      <PackSide src={pack.image} z={z} />
      <PackSide src={pack.back} z={z} back />
      <PackWalls pack={pack} width={width} />
    </motion.div>
  );
}

function PackSide({ src, z, back = false }: { src: string; z: number; back?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 [backface-visibility:hidden]"
      style={{ transform: `${back ? "rotateY(180deg) " : ""}translateZ(${z}px)` }}
    >
      <img src={src} alt="" draggable={false} className="absolute inset-0 size-full object-contain" />
      <FaceShade src={src} />
    </div>
  );
}

/**
 * Pillow shading on a face: the foil curves away toward the folded sides, so the
 * edges darken and the middle catches the light. Masked by the pack's own shape.
 */
export function FaceShade({ src, style }: { src: string; style?: CSSProperties }) {
  const mask = `url(${src}) center / 100% 100% no-repeat`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "linear-gradient(90deg, rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.12) 9%, transparent 22%, rgb(255 255 255 / 0.07) 50%, transparent 78%, rgb(0 0 0 / 0.12) 91%, rgb(0 0 0 / 0.5))",
        WebkitMask: mask,
        mask,
        ...style,
      }}
    />
  );
}

/**
 * The two folded side seams that join front and back. Each wall is textured with
 * the pack's own edge column, shaded like a rounded fold, and tapers to nothing at
 * the flat crimped ends.
 */
export function PackWalls({ pack, width, clipTop = 0, style }: { pack: Pack; width: number; clipTop?: number; style?: CSSProperties }) {
  const h = width * PACK_RATIO;
  const d = width * DEPTH;
  // Full thickness through the body, pinched flat into the crimps top and bottom.
  const taper = `polygon(50% ${clipTop}%, 50% ${clipTop}%, 100% ${Math.max(9, clipTop + 2)}%, 100% 91%, 50% 100%, 50% 100%, 0 91%, 0 ${Math.max(9, clipTop + 2)}%)`;
  const wall = (right: boolean): CSSProperties => ({
    width: d,
    height: h,
    left: (width - d) / 2,
    transform: `rotateY(${right ? 90 : -90}deg) translateZ(${width / 2 - 0.5}px)`,
    backgroundImage: `linear-gradient(90deg, rgb(0 0 0 / 0.55), rgb(255 255 255 / 0.18) 50%, rgb(0 0 0 / 0.55)), url(${pack.image})`,
    // Stretch a ~1px column just inside the pack's left or right edge across the wall.
    backgroundSize: `100% 100%, ${width * 60}px ${h}px`,
    backgroundPosition: `0 0, ${-((right ? 708 : 11) / 720) * width * 60}px 0`,
    backgroundRepeat: "no-repeat",
    clipPath: taper,
  });
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute top-0" style={{ ...wall(false), ...style }} />
      <div aria-hidden="true" className="pointer-events-none absolute top-0" style={{ ...wall(true), ...style }} />
    </>
  );
}
