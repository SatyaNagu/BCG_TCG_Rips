# Build: BC TCG, a Pokémon card website with a scroll-driven "pull → grade → reveal" hero

This is a school project. You are building **BC TCG**, a modern, premium website for buying and
selling Pokémon cards (packs, a personal collection, and a wallet). The site should feel like a
2025–2026 award-winning product site (think Apple product pages, Awwwards-level scroll
storytelling): cinematic, smooth, and fast.

## Use these tools I have installed
- Skills: `ui-ux-pro-max`, `taste-skill`, `emil-design-eng`, `design-system`, `ui-styling`, and the
  animation skills (`animate`, `animation-performance`, `improve-animations`, `review-animations`).
  Read the relevant skill before each part of the work (design system, layout, motion, review).
- 21st.dev Magic MCP (`magic`): use it to search for and pull high-quality components
  (navbar, auth forms, pack cards, wallet widgets, buttons) instead of hand-rolling generic UI.
- Motion (motion.dev, `npm install motion`) for UI animation, plus Lenis for smooth scrolling.

## Tech stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Motion (`motion/react`) for UI animation and scroll progress (`useScroll`, `useTransform`)
- An HTML `<canvas>` image sequence for the hero scroll video (details below)
- Mock data / local JSON for now (no real payments or backend yet), but structure the code so a
  backend and auth provider can be plugged in later.

## Branding: BC TCG
- Website name: **BC TCG**
- Logo: design a bold, clean **BC TCG** logo as an SVG (wordmark or monogram + wordmark) in
  yellow on black. It must look sharp at small sizes in the header and work as a favicon.
- Theme: **black and yellow**.
  - Backgrounds: deep black / near-black (e.g. #0A0A0A, #111111) with dark grey surfaces for
    cards and panels.
  - Primary accent: a vivid yellow (e.g. #FFD60A or #FACC15) for buttons, active nav items,
    highlights, links, focus rings, and key headings.
  - Text: white / off-white body text, muted grey for secondary text, yellow for emphasis.
  - Holo/gold shimmer effects allowed sparingly for card reveals, but the site must read clearly
    as black and yellow.
- Put all colors, fonts and spacing in design tokens (Tailwind config / CSS variables).

## Layout: header (all pages)
- Top-left: the **BC TCG** logo (clickable → home).
- Top-center: main navigation with three items: **Packs**, **Collection**, **Wallet**.
- Top-right: **Sign in** (outlined button) and **Sign up** (solid yellow button with black text).
- Header is fixed, transparent over the hero, and turns into a blurred/frosted black bar once the
  user scrolls. The active page is highlighted in yellow.
- Mobile: logo left, hamburger right that opens a full-screen black menu with the same items + auth.

## Home page hero: scroll-scrubbed, frame-by-frame "video"
This is the most important part of the project. Get it exactly right.

### How it must behave
- The animation is a pre-rendered video turned into an **image sequence** (e.g. 180–240 frames)
  drawn onto a full-screen `<canvas>` inside a **pinned/sticky section** (about 500–600vh tall).
- **Scroll position = frame number.** The video never autoplays. Scrolling down moves forward
  frame by frame. When the user **stops scrolling, the animation stops on that exact frame.**
  Scrolling **back up plays it in reverse**, frame by frame, the same way.
- Keep the smoothing light (Lenis with a small lerp) so it feels smooth but still stops almost
  instantly when the user stops.
- **Text overlays** are tied to scroll progress, not time: each caption fades/slides in during
  its scroll range and fades out after, and does the exact reverse when scrolling up.
  Style captions in white with yellow keywords.
- Canvas must look sharp (handle `devicePixelRatio`), cover the viewport like `object-fit: cover`,
  and re-render correctly on resize.
- Performance: show frame 1 immediately, preload the rest progressively (show a small yellow
  loading indicator until enough frames are ready), use WebP/AVIF, draw only when the frame index
  changes (requestAnimationFrame), and serve a smaller, vertical frame set on mobile.
- Accessibility: if `prefers-reduced-motion` is on, replace the sequence with a few static key
  images and the same captions.

### The story (scroll progress → scene → caption)
1. **0–15%: The rip.** A sealed booster pack tears open and a single card slides out
   **face-down**. Only the card back is ever visible; the front must NOT be shown.
   Caption: "Every pack holds a secret."
2. **15–35%: Into the void.** The face-down card floats forward and is pulled into a swirling
   **black void** (this represents sending the card off for professional grading).
   Caption: "Send your pull for grading."
3. **35–55%: The wait.** Darkness with subtle yellow particles/light streaks inside the void.
   Caption: "Authenticated. Graded. Sealed."
4. **55–75%: The slab returns.** A **PSA graded slab** emerges from the void, but the card and
   the grade are still **hidden** (slab is seen from the back, the label is shadowed or blurred,
   or a light flare covers it).
   Caption: "The moment of truth…"
5. **75–95%: The reveal.** The slab rotates to the front and reveals a **vintage 1st Edition Base
   Set holographic Charizard**, PSA label reading **PSA 10 GEM MINT**, with a holo light sweep
   across it.
   Caption: "1st Edition Holo Charizard — PSA 10."
6. **95–100%: Call to action.** The scene settles; show a yellow CTA button:
   "Rip your first pack" → /packs.

Put all scene timings and caption text in one config file so I can easily adjust them.

### Getting the frames: ask me
You cannot film this video yourself, so:
1. **Ask me first** whether I already have the video or frames. If I have a video, give me the
   exact `ffmpeg` command to turn it into frames, for example:
   `ffmpeg -i hero.mp4 -vf "fps=30,scale=1920:-1" -c:v libwebp -quality 80 public/frames/desktop/frame_%04d.webp`
   (plus a vertical/mobile version), and wire the result in.
2. If I don't have one yet, **build everything with placeholder frames** so the scroll system is
   fully working now: write a script that generates a simple placeholder sequence (pack shape,
   face-down card, dark void, slab outline, reveal flash) with the frame number and scene name
   drawn on each frame. That way I can swap in the real frames later with no code changes.
3. Also give me **ready-to-use prompts for an AI video tool** (e.g. Veo, Kling, Runway or Sora),
   one per scene, with matching start/end frames so the shots join smoothly, OR a short plan for
   making it in Blender. Keep the black-and-yellow mood in the lighting. Tell me the exact frame
   count, resolution and file naming you expect.
4. Whenever you need any other resources (card images, pack art, PSA slab images, fonts, help
   with the frame-by-frame scroll video integration), **stop and ask me** instead of guessing.
   Use clearly labeled placeholders in the meantime.

## Other home page sections (below the hero)
- Featured packs (cards with hover tilt/holo shine effect and yellow glow)
- "How it works": Buy packs → Rip → Grade → Collect/Sell
- Recently pulled / trending cards strip
- Footer with the BC TCG logo, links, socials

## Other pages (working UI with mock data)
- **/packs**: grid of packs (name, set, price, odds), pack detail with an "Open pack" animation.
- **/collection**: user's cards in a filterable grid (raw vs. graded, set, rarity, value), card
  detail modal with a flip animation.
- **/wallet**: balance, add-funds UI (mock only), transaction history, list-for-sale flow.
- **/signin** and **/signup**: clean auth forms (email + password, "continue with Google"
  placeholder), validation states. UI only for now.

## Design direction
- Black and yellow, premium and cinematic, with strong contrast.
- Strong display font for headings plus a clean sans for body text; generous spacing.
- Subtle, purposeful micro-interactions (hover, press, page transitions). No cheap or generic
  "AI-looking" layouts; follow `taste-skill` and `emil-design-eng`.
- Fully responsive (mobile-first) and accessible (keyboard nav, focus states, contrast, alt text).

## How to work
1. Briefly confirm the plan and list the resources you need from me.
2. Set up the project and the BC TCG design system (black/yellow tokens, type, spacing, logo).
3. Build the header and the hero scroll sequence first, with placeholder frames, and let me test it.
4. Then build the other sections and pages.
5. Finally run a review pass using `review-animations` and `animation-performance`, test on mobile
   width, and report what's done, what uses placeholders, and what you still need from me.

## Decisions (answers to the build-plan questions)
1. Old Vite/Express app: move client/, server/, package.json, package-lock.json into _old_backup/. Delete node_modules.
2. No hero video yet. Use placeholder frames. Write one prompt per scene for Kling (plus a Veo version), with matching start and end frames.
3. Frames: 200 per set, desktop 1920x1080, mobile 1080x1920, WebP quality 80, named frame_0001.webp.
4. I will supply real images (Charizard card, booster pack, PSA slab) later. Use stand-in designs until then and list the files and sizes needed. The site is only shown in class, not published.
5. Fonts: suggest 3 free Google Font pairings for a black and yellow premium look; I pick one.
6. Footer links and socials: "#" placeholders.
7. Mock data: realistic sample packs, sets, prices and odds.

## Build phases
- Phase 0: Project setup (Next.js, TypeScript, Tailwind, Motion, Lenis, folder structure, data/auth stubs)
- Phase 1: Design system and BC TCG logo
- Phase 2: Header and navigation
- Phase 3: Hero scroll sequence with placeholder frames (pause for my testing)
- Phase 4: Rest of the home page
- Phase 5: Packs, Collection, Wallet, Sign in/Sign up pages
- Phase 6: Review, accessibility, responsive testing, final report

## Progress
- (Update this list after each phase is finished.)