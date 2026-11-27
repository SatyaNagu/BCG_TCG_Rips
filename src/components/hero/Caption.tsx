import { Fragment } from "react";

/** Renders "[word]" segments of a caption in yellow. */
export function CaptionText({ text }: { text: string }) {
  const parts = text.replace(/\|/g, " ").split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[") ? (
          <span key={i} className="kw">
            {part.slice(1, -1)}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

export const captionClass =
  "font-display text-[clamp(2rem,4.6vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.03em] text-text text-balance";
