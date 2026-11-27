# BC TCG Hero Video: Frame-by-Frame Production Brief

Build the BC TCG home page hero animation as a real rendered video, frame by frame, and export it as
the image sequences the scroll hero already reads (`public/frames/desktop` and `public/frames/mobile`).

Render it as a real-time 3D scene (Three.js with post-processing), step it one frame at a time with a
fixed clock, capture each frame in a headless browser, and save the frames as WebP. Do not use AI video
generation. Every object must stay sharp, consistent and correctly textured in every frame.

Before writing any code, list the image files you need from me (see "Assets") and wait for me to
provide them. Do not invent or download artwork.

---

## 1. The vision in one paragraph

A single, unbroken, cinematic shot in a pure black void. A sealed booster pack hangs in the dark,
lit only by warm yellow rim light. It tears open, and one card slides out face-down, so we only ever
see its back. The card floats to the center, tips back, and is sent into a swirling black-and-gold
void, like a letter posted into the unknown. The void breathes with drifting yellow particles while we
wait. Then light pulses inside it and a PSA graded slab glides out back-first, hiding its secret.
It floats to center, slowly turns around, and reveals a 1st Edition Base Set holographic Charizard,
graded PSA 10 GEM MINT, as a holo light sweep races across it. The scene settles and holds, calm and
premium, ready for the call-to-action button. It should feel like an Apple product reveal: slow,
weighty, precise, and dramatic.

---

## 2. Global look (applies to every frame)

| Property | Value |
|---|---|
| Background | Pure black `#000000`. No gradient, no floor, no visible horizon |
| Palette | Black, yellow `#FFD400`, warm gold `#FFB800`, white highlights only |
| Key light | Yellow/gold rim light from behind-left and behind-right, outlining every object |
| Fill light | Very low, cool-neutral, just enough to read object shapes |
| Camera | Locked. One continuous shot, no cuts. Allowed: a very slow push-in of at most 5% over the whole video |
| Lens | 35 mm equivalent, mild depth of field (subject sharp, particles slightly soft) |
| Post-processing | Soft bloom on yellow highlights, subtle film grain, light vignette. No chromatic aberration |
| Particles | Fine gold dust drifting slowly in the background in every scene. It thickens in scenes 3 and 4 |
| Motion feel | Ease-in-out on every move. Nothing linear, nothing jerky. Objects drift gently when "still" |
| Text in frame | None. Captions are added later as HTML overlays, so leave the left third of the desktop frame calm |

---

## 3. Assets (I provide these)

| File | What it is | Size |
|---|---|---|
| `assets/hero/pack-front.png` | Booster pack front, transparent background | at least 1200 px tall |
| `assets/hero/pack-back.png` | Booster pack back, transparent background | same as front |
| `assets/hero/card-back.png` | Pokémon card back | 734 × 1024 |
| `assets/hero/charizard-front.png` | 1st Edition Base Set Holo Charizard front | 734 × 1024 |
| `assets/hero/slab-front.png` | PSA slab front with label reading "PSA 10 GEM MINT", card window empty or transparent | at least 1000 px tall |
| `assets/hero/slab-back.png` | PSA slab back | same as front |

Build the pack as a thin pillow-shaped mesh with crimped top and bottom edges, the card as a thin
rounded-corner box with the textures on each face, and the slab as a clear acrylic box (with
refraction and reflections) with the Charizard card sitting inside it.

---

## 4. Timeline: 200 frames

The scroll hero maps scroll progress to frame number. Each scene must start exactly where the previous
one ends. The end state of one scene is the start state of the next.

| Scene | Frames | Scroll % | Caption shown over it (added later in HTML) |
|---|---|---|---|
| 1. The rip | 1–30 | 0–15% | "Every pack holds a secret." |
| 2. Into the void | 31–70 | 15–35% | "Send your pull for grading." |
| 3. The wait | 71–110 | 35–55% | "Authenticated. Graded. Sealed." |
| 4. The slab returns | 111–150 | 55–75% | "The moment of truth…" |
| 5. The reveal | 151–190 | 75–95% | "1st Edition Holo Charizard — PSA 10." |
| 6. The hold | 191–200 | 95–100% | CTA button "Rip your first pack" |

### Scene 1: The rip (frames 1–30)
- **Start:** The sealed pack floats at center-right of the frame, front facing camera, tilted about 8°,
  bobbing gently. Yellow rim light traces its crimped edges.
- **Frames 1–10:** The pack drifts and slowly rotates about 10° toward camera. The rim light brightens.
- **Frames 11–18:** The top crimp tears open from left to right, with small foil fragments and a burst
  of gold sparks at the tear line.
- **Frames 19–30:** One card slides upward out of the opening, **back facing camera**. The card front
  must never be visible.
- **End:** The card is half out of the pack, back facing camera.

### Scene 2: Into the void (frames 31–70)
- **Frames 31–42:** The card slides fully out and floats to the exact center of the frame. The empty
  pack drifts down and out of frame bottom-right, fading into darkness.
- **Frames 43–52:** The card hovers at center, back facing camera, gently bobbing. Behind it, a
  circular void starts to form: a slow black-and-gold spiral, darker than the background at its core,
  with glowing gold edges.
- **Frames 53–60:** The card tilts backward until it is almost flat, its top edge pointing into the void.
- **Frames 61–70:** The card shoots forward into the center of the void, accelerating fast like a letter
  being posted, with a short gold light streak behind it. It disappears with a small flash at the void's core.
- **End:** An empty swirling void at center. No card visible.

### Scene 3: The wait (frames 71–110)
- The void swirls slowly and steadily at center.
- Fine yellow particles and thin light streaks spiral inward toward the core.
- At frames 85, 95 and 105, a soft pulse of gold light breathes out from the core, each brighter than the last.
- This scene should feel calm, suspenseful and quiet. No objects.
- **End:** The void's core is glowing noticeably brighter, about to release something.

### Scene 4: The slab returns (frames 111–150)
- **Frames 111–118:** A strong flare at the core. The PSA slab begins to emerge from the center of the
  void, **back facing camera**, small at first.
- **Frames 119–140:** The slab glides forward out of the void, growing to its full size at the center of
  the frame. The void shrinks and fades behind it. The slab's back is visible and the front label is
  never seen.
- **Frames 141–150:** The slab floats at center, bobbing gently, with gold rim light outlining the
  acrylic edges.
- **End:** The slab at center, back facing camera, the void almost gone.

### Scene 5: The reveal (frames 151–190)
- **Frames 151–175:** The slab rotates 180° around its vertical axis, smoothly (ease-in-out), revealing
  its front: the Charizard card and the "PSA 10 GEM MINT" label.
- **Frames 172–185:** A diagonal holographic light sweep (rainbow-tinted, mostly gold) moves across the
  card from top-left to bottom-right. The acrylic catches a bright specular glint.
- **Frames 186–190:** The slab settles facing camera, tilted about 3°, with the card art and label sharp
  and fully readable.
- **End:** The slab front facing camera, perfectly legible.

### Scene 6: The hold (frames 191–200)
- The slab holds still with only a slight gentle bob and a faint shimmer on the holo.
- The gold particles slow down.
- Leave clear empty space below the slab for the CTA button overlay.

---

## 5. Framing per format

| | Desktop (1920 × 1080) | Mobile (1080 × 1920) |
|---|---|---|
| Subject position | Center-right, leaving the left third calm for captions | Center, slightly above middle |
| Subject size | Card/slab about 55% of frame height | Card/slab about 45% of frame height |
| Caption space | Left third | Bottom quarter |
| CTA space (scene 6) | Below the slab, centered | Bottom fifth |

Re-frame the camera for mobile. Do not just crop the desktop frames.

---

## 6. Output

- 200 frames per set, at 30 fps of animation time (about 6.7 seconds per set).
- Desktop: `public/frames/desktop/frame_0001.webp` to `frame_0200.webp`, 1920 × 1080.
- Mobile: `public/frames/mobile/frame_0001.webp` to `frame_0200.webp`, 1080 × 1920.
- WebP, quality 80. Replace the current placeholder frames. The file names stay the same so no site
  code changes are needed.
- Also export `hero-preview-desktop.mp4` and `hero-preview-mobile.mp4` with ffmpeg from the frames, so I
  can watch the whole thing as a normal video.
- Keep the scene source and the render script in the project (for example `scripts/hero-render/`),
  with one config file holding all scene frame ranges, so timings can be changed and re-rendered with
  one command.

---

## 7. Done when

- [ ] It plays as one continuous shot with no jumps between scenes.
- [ ] The card front is never visible before scene 5.
- [ ] The slab front and label are never visible before frame 151.
- [ ] The Charizard art and "PSA 10 GEM MINT" are sharp and readable in frames 186–200.
- [ ] The background is pure black in every frame, and the only colors are black, yellow, gold and white.
- [ ] Desktop frames keep the left third calm, and mobile frames keep the bottom quarter calm.
- [ ] Scrubbing forward and backward on the live site looks smooth.
- [ ] You show me a few key frames (1, 30, 70, 110, 150, 175, 200) for approval before the final full render.
