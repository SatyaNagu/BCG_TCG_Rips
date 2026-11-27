"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { type FrameSet, framePath } from "@/lib/hero-config";

const CONCURRENCY = 6;

/** Frame 0 first, then every 128th, 64th, ... 1st, so the whole range fills in coarse-to-fine. */
function loadOrder(count: number) {
  const order = [0];
  const seen = new Set(order);
  for (let step = 2 ** Math.floor(Math.log2(count)); step >= 1; step >>= 1) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

export type FrameImages = MutableRefObject<(Blob | null)[]>;

/**
 * Progressively preloads a frame set into `images` as compressed bytes (Blobs).
 * Decoding happens later, near the playhead, via createImageBitmap(blob), which
 * runs off the main thread. (createImageBitmap on an <img> blocks ~12 ms per frame.)
 * Blobs live in a ref (not state) so drawing never waits on a React render.
 */
export function useFrameSequence(
  set: FrameSet | null,
  images: FrameImages,
  onFrameLoaded: (index: number) => void
) {
  const [loaded, setLoaded] = useState(0);
  const onLoadRef = useRef(onFrameLoaded);
  onLoadRef.current = onFrameLoaded;

  useEffect(() => {
    if (!set) return;
    let cancelled = false;
    images.current = new Array(set.count).fill(null);
    setLoaded(0);

    const queue = loadOrder(set.count);
    let cursor = 0;
    let done = 0;

    const loadOne = async (index: number) => {
      let blob: Blob;
      try {
        const res = await fetch(framePath(set, index));
        if (!res.ok) return; // missing frame: the player falls back to the nearest ready one
        blob = await res.blob();
      } catch {
        return;
      }
      if (cancelled) return;
      images.current[index] = blob;
      done += 1;
      // Re-render only every few frames: a React render per frame competes with scrolling.
      if (done % 24 === 0 || done === set.count) setLoaded(done);
      onLoadRef.current(index);
    };

    const worker = async () => {
      while (!cancelled && cursor < queue.length) await loadOne(queue[cursor++]);
    };
    for (let i = 0; i < CONCURRENCY; i++) void worker();

    return () => {
      cancelled = true;
    };
  }, [set, images]);

  return loaded;
}
