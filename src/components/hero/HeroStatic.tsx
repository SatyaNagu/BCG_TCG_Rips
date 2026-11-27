import { ButtonLink } from "@/components/ui/Button";
import { framePath, heroConfig } from "@/lib/hero-config";
import { CaptionText, captionClass } from "./Caption";

const { frames, scenes, cta } = heroConfig;

/** Reduced-motion hero: a few still key frames with the same captions, no scrubbing. */
export function HeroStatic() {
  return (
    <section aria-label="Pull, grade, reveal" className="pt-header">
      {scenes.map((scene) => (
        <figure key={scene.id} className="relative h-[85svh] min-h-[480px] w-full overflow-hidden">
          <picture>
            <source
              media={`(max-aspect-ratio: ${Math.round(frames.mobileBelowAspect * 100)}/100)`}
              srcSet={framePath(frames.mobile, scene.keyFrame - 1)}
            />
            <img
              src={framePath(frames.desktop, scene.keyFrame - 1)}
              alt={`${scene.name} (still frame)`}
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          </picture>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg/85 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-[10vh] mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className={`max-w-[18ch] ${captionClass}`}>
              <CaptionText text={scene.caption} />
            </p>
          </figcaption>
        </figure>
      ))}
      <div className="flex justify-center py-20">
        <ButtonLink href={cta.href} size="lg">
          {cta.label}
          <span aria-hidden="true">→</span>
        </ButtonLink>
      </div>
    </section>
  );
}
