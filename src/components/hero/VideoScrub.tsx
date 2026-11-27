"use client";

import { type MotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useRef } from "react";

type Props = {
  src: string;
  progress: MotionValue<number>;
  /** Download progress, 0–100. */
  onLoadProgress: (percent: number) => void;
};

/**
 * Scroll-scrubbed video for phones. Phones decode video in dedicated hardware,
 * so jumping to any frame is near-instant, while decoding hundreds of separate
 * images per second (the desktop canvas path) is more than a phone CPU can keep
 * up with on a fast flick. The file is encoded with every frame as a keyframe
 * (-g 1), so each seek decodes exactly one frame.
 */
export function VideoScrub({ src, progress, onLoadProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const target = useRef(0);
  const seeking = useRef(false);
  const onLoadRef = useRef(onLoadProgress);
  onLoadRef.current = onLoadProgress;

  const seek = () => {
    const v = videoRef.current;
    if (!v || !v.duration || seeking.current) return;
    const t = target.current;
    if (Math.abs(v.currentTime - t) < 1 / 120) return;
    seeking.current = true;
    v.currentTime = t;
  };

  const toTime = (p: number) => {
    const v = videoRef.current;
    if (!v?.duration) return 0;
    // Stay just inside the last frame so the video never reports "ended".
    return Math.min(1, Math.max(0, p)) * Math.max(0, v.duration - 0.05);
  };

  // Download the whole file into memory first: seeks into a fully buffered blob
  // never wait on the network, which is what makes scrubbing instant on iOS.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let url = "";

    (async () => {
      try {
        const res = await fetch(src);
        const total = Number(res.headers.get("content-length")) || 0;
        const reader = res.body?.getReader();
        let blob: Blob;
        if (reader && total) {
          const chunks: BlobPart[] = [];
          let received = 0;
          let lastPct = -1;
          for (;;) {
            const { done, value } = await reader.read();
            if (done || cancelled) break;
            chunks.push(value);
            received += value.length;
            const pct = Math.min(99, Math.floor((received / total) * 100));
            if (pct !== lastPct) {
              lastPct = pct;
              onLoadRef.current(pct);
            }
          }
          blob = new Blob(chunks, { type: "video/mp4" });
        } else {
          blob = await res.blob();
        }
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        video.src = url;
      } catch {
        // Network failure: fall back to streaming the file directly.
        if (!cancelled) video.src = src;
      }
    })();

    const onLoaded = async () => {
      // iOS Safari only paints seeked frames after the video has played once.
      try {
        await video.play();
      } catch {
        // Autoplay refused: seeking still works on Android and desktop.
      }
      video.pause();
      onLoadRef.current(100);
      target.current = toTime(progress.get());
      seek();
    };
    const onSeeked = () => {
      seeking.current = false;
      seek(); // catch up if the visitor kept scrolling during the seek
    };

    video.addEventListener("loadeddata", onLoaded, { once: true });
    video.addEventListener("seeked", onSeeked);
    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
      video.removeAttribute("src");
      video.load();
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useMotionValueEvent(progress, "change", (p) => {
    target.current = toTime(p);
    seek();
  });

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 size-full object-cover"
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
