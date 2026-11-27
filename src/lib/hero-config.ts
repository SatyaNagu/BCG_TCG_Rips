/**
 * Hero scroll sequence: every timing, caption and asset path lives here.
 *
 * Progress values run from 0 (top of the hero) to 1 (bottom of the hero).
 * Wrap a word in [square brackets] to render it in yellow.
 */

export type FrameSet = {
  /** Number of frames in the folder. */
  count: number;
  /** Folder under /public. Files are named frame_0001.webp, frame_0002.webp, ... */
  dir: string;
  width: number;
  height: number;
};

export type Scene = {
  id: string;
  name: string;
  start: number;
  end: number;
  /** Caption text. "|" splits it into two lines; [brackets] mark the gold keyword. */
  caption: string;
  /** Small label above the caption naming the part of the site it talks about. */
  kicker: string;
  /** Where the caption sits: b/t/m = bottom/top/middle, l/r = left/right. */
  place: "bl" | "br" | "tl" | "tr" | "ml" | "mr";
  /** Still frame (1-based) used when the visitor prefers reduced motion. */
  keyFrame: number;
};

export const heroConfig = {
  /** Height of the pinned section, in viewport heights. */
  scrollLengthVh: 2750,

  frames: {
    desktop: { count: 1604, dir: "/frames/desktop", width: 1920, height: 1080 } satisfies FrameSet,
    mobile: { count: 1604, dir: "/frames/mobile", width: 720, height: 1280 } satisfies FrameSet,
    /** Viewports narrower than this aspect ratio (width / height) use the mobile set. */
    mobileBelowAspect: 0.8,
    /**
     * Phones scrub this video instead of the mobile image frames: hardware video
     * decoding keeps up with fast flicks. Every frame is a keyframe (ffmpeg -g 1).
     */
    mobileVideo: "/video/hero-mobile.mp4",
    extension: "webp",
  },

  /** Hide the loading indicator once this share of frames is ready. */
  readyThreshold: 0.15,

  /** Share of each scene used to fade its caption in and out. */
  captionFade: 0.22,

  /**
   * Hero look. "cinematic" = opening headline + chapter bar + shutter captions.
   * "classic" = the previous plain captions (set this to undo the restyle).
   */
  look: "cinematic" as "cinematic" | "classic",

  /**
   * Caption text style. "solid" = white with yellow keywords, "liquid" = liquid-glass
   * lettering, "glass" = text on a frosted glass panel. Preview any of them without
   * editing code by adding ?text=solid|liquid|glass to the page URL.
   */
  textStyle: "liquid" as "solid" | "liquid" | "glass",

  /**
   * Black opening screen (scroll progress 0 → tearEnd): gold headline whose lines
   * slide off left and right by `textEnd`, then the black tears diagonally and
   * both halves slide apart to reveal the video. The video holds on its first
   * frame until the tear is done.
   */
  intro: {
    eyebrow: "BC TCG",
    lines: ["Rip packs.", "Pull [legends]."],
    textEnd: 0.03,
    tearEnd: 0.075,
  },

  // Scene start/end are fractions of the VIDEO (seconds / 53.5), not of the page scroll.
  // Each caption names what the site lets you do at that moment of the story.
  scenes: [
    {
      id: "night",
      name: "Night",
      start: 0,
      end: 0.168,
      caption: "New packs drop|[every night].",
      kicker: "Daily drops",
      place: "bl",
      keyFrame: 151,
    },
    {
      id: "shop",
      name: "The shop",
      start: 0.168,
      end: 0.337,
      caption: "Five rarities.|[One stop.]",
      kicker: "Packs",
      place: "br",
      keyFrame: 361,
    },
    {
      id: "pick",
      name: "The pick",
      start: 0.337,
      end: 0.486,
      caption: "Every pack shows|its [real odds].",
      kicker: "Live odds",
      place: "ml",
      keyFrame: 721,
    },
    {
      id: "rip",
      name: "The rip",
      start: 0.486,
      end: 0.636,
      caption: "Rip it [instantly],|right here.",
      kicker: "Instant rip",
      place: "br",
      keyFrame: 961,
    },
    {
      id: "pull",
      name: "The pull",
      start: 0.636,
      end: 0.767,
      caption: "Keep the hit|or [sell it].",
      kicker: "Wallet",
      place: "ml",
      keyFrame: 1111,
    },
    {
      id: "keep",
      name: "The keep",
      start: 0.767,
      end: 0.94,
      caption: "Your binder lives|in [Collection].",
      kicker: "Collection",
      place: "tl",
      keyFrame: 1561,
    },
  ] satisfies Scene[],

  cta: {
    start: 0.95,
    label: "Rip your first pack",
    href: "/packs",
  },
} as const;

export function framePath(set: FrameSet, index: number) {
  return `${set.dir}/frame_${String(index + 1).padStart(4, "0")}.${heroConfig.frames.extension}`;
}
