// Generates labelled placeholder frames for the hero scroll sequence.
// Usage: node scripts/generate-placeholder-frames.mjs
// Replace the output folders with real frames later; no code changes needed.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const FRAME_COUNT = 200;
const SETS = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "mobile", width: 1080, height: 1920 },
];

// Keep in sync with src/lib/hero-config.ts
const SCENES = [
  { name: "1 · The rip", start: 0, end: 0.15 },
  { name: "2 · Into the void", start: 0.15, end: 0.35 },
  { name: "3 · The wait", start: 0.35, end: 0.55 },
  { name: "4 · The slab returns", start: 0.55, end: 0.75 },
  { name: "5 · The reveal", start: 0.75, end: 0.95 },
  { name: "6 · Call to action", start: 0.95, end: 1.0001 },
];

const Y = "#FFD60A";
const BG = "#0A0A0A";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - t, 3);

// Deterministic pseudo-random so particles don't flicker between frames.
function rand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function cardBack(cx, cy, w, h, rot = 0, scale = 1, opacity = 1) {
  return `
  <g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale})" opacity="${opacity}">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w * 0.06}" fill="#1a1a1a" stroke="${Y}" stroke-width="${w * 0.025}"/>
    <circle r="${w * 0.26}" fill="none" stroke="${Y}" stroke-width="${w * 0.04}"/>
    <circle r="${w * 0.08}" fill="${Y}"/>
    <text y="${h * 0.38}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${w * 0.09}" fill="${Y}">CARD BACK</text>
  </g>`;
}

function slab(cx, cy, w, h, { face = "back", scaleX = 1, scale = 1, labelHidden = true } = {}) {
  const lw = w * 0.86;
  const lh = h * 0.14;
  const front =
    face === "front"
      ? `
    <rect x="${-w * 0.38}" y="${-h * 0.22}" width="${w * 0.76}" height="${h * 0.62}" rx="${w * 0.03}" fill="#ff7a1a"/>
    <text y="${h * 0.08}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${w * 0.08}" fill="#fff">CHARIZARD</text>
    <text y="${h * 0.15}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${w * 0.05}" fill="#fff">stand-in art</text>`
      : `
    <rect x="${-w * 0.38}" y="${-h * 0.22}" width="${w * 0.76}" height="${h * 0.62}" rx="${w * 0.03}" fill="#151515" stroke="#333" stroke-width="2"/>
    <text y="${h * 0.1}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${w * 0.07}" fill="#555">SLAB BACK</text>`;
  const label =
    face === "front" && !labelHidden
      ? `<text y="${-h * 0.45 + lh * 0.48}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${lh * 0.32}" fill="${BG}">GRADE 10</text>
         <text y="${-h * 0.45 + lh * 0.85}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${lh * 0.26}" fill="${BG}">GEM MINT</text>`
      : `<text y="${-h * 0.45 + lh * 0.66}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${lh * 0.45}" fill="#666">? ? ?</text>`;
  return `
  <g transform="translate(${cx} ${cy}) scale(${scale * scaleX} ${scale})">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w * 0.05}" fill="rgba(255,255,255,0.06)" stroke="#e8e8e8" stroke-width="${w * 0.015}"/>
    <rect x="${-lw / 2}" y="${-h * 0.45}" width="${lw}" height="${lh}" rx="${w * 0.02}" fill="${face === "front" && !labelHidden ? Y : "#222"}"/>
    ${label}
    ${front}
  </g>`;
}

function drawScene(p, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  const u = Math.min(W, H); // unit that keeps shapes proportional on both sets
  const cardW = u * 0.28;
  const cardH = cardW * 1.4;
  let body = "";

  if (p < 0.15) {
    // The rip: pack top tears off, face-down card slides out
    const t = p / 0.15;
    const packW = u * 0.38;
    const packH = packW * 1.55;
    const tear = ease(clamp(t / 0.45));
    const slide = ease(clamp((t - 0.35) / 0.65));
    body += cardBack(cx, cy - slide * packH * 0.4, cardW, cardH, 0, 1, clamp(slide * 3));
    body += `
    <g transform="translate(${cx} ${cy})">
      <rect x="${-packW / 2}" y="${-packH / 2 + packH * 0.12}" width="${packW}" height="${packH * 0.88}" rx="${packW * 0.04}" fill="#1f1f1f" stroke="${Y}" stroke-width="4"/>
      <text y="${packH * 0.15}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${packW * 0.14}" fill="${Y}">BOOSTER</text>
      <g transform="translate(${tear * packW * 0.5} ${-packH / 2 - tear * packH * 0.25}) rotate(${tear * 28})" opacity="${1 - tear}">
        <rect x="${-packW / 2}" y="0" width="${packW}" height="${packH * 0.12}" fill="#1f1f1f" stroke="${Y}" stroke-width="4"/>
      </g>
    </g>`;
  } else if (p < 0.35) {
    // Into the void: card floats forward then spirals into darkness
    const t = (p - 0.15) / 0.2;
    const forward = ease(clamp(t / 0.35));
    const pull = ease(clamp((t - 0.3) / 0.7));
    for (let i = 0; i < 9; i++) {
      const r = u * (0.06 + i * 0.055) * (1 - pull * 0.25);
      body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${Y}" stroke-opacity="${0.05 + i * 0.03}" stroke-width="2" stroke-dasharray="${r * 0.6} ${r * 0.4}" transform="rotate(${t * 360 + i * 25} ${cx} ${cy})"/>`;
    }
    body += cardBack(cx, cy - u * 0.2 * (1 - forward), cardW, cardH, pull * 540, (1 + forward * 0.3) * (1 - pull * 0.95), 1 - pull * 0.6);
  } else if (p < 0.55) {
    // The wait: darkness with drifting yellow particles
    const t = (p - 0.35) / 0.2;
    body += `<circle cx="${cx}" cy="${cy}" r="${u * 0.35}" fill="url(#glow)" opacity="${0.3 + 0.2 * Math.sin(t * Math.PI)}"/>`;
    for (let i = 0; i < 70; i++) {
      const a = rand(i) * Math.PI * 2 + t * (0.6 + rand(i + 99));
      const d = u * (0.08 + rand(i + 7) * 0.45);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d * 0.7;
      const len = 4 + rand(i + 3) * 18;
      body += `<line x1="${x}" y1="${y}" x2="${x + Math.cos(a + 1.57) * len}" y2="${y + Math.sin(a + 1.57) * len}" stroke="${Y}" stroke-opacity="${0.25 + rand(i + 5) * 0.6}" stroke-width="2" stroke-linecap="round"/>`;
    }
  } else if (p < 0.75) {
    // The slab returns: back view, label hidden
    const t = (p - 0.55) / 0.2;
    const grow = ease(clamp(t));
    body += `<circle cx="${cx}" cy="${cy}" r="${u * 0.45}" fill="url(#glow)" opacity="${0.25 * grow}"/>`;
    body += slab(cx, cy, u * 0.36, u * 0.36 * 1.65, { face: "back", scale: lerp(0.15, 1, grow) });
  } else {
    // The reveal (rotate to front, holo sweep) then the settled CTA frame
    const t = clamp((p - 0.75) / 0.2);
    const turn = ease(clamp(t / 0.55));
    const angle = turn * Math.PI;
    const face = angle > Math.PI / 2 ? "front" : "back";
    const scaleX = Math.max(0.02, Math.abs(Math.cos(angle)));
    const labelHidden = t < 0.6;
    body += `<circle cx="${cx}" cy="${cy}" r="${u * 0.5}" fill="url(#glow)" opacity="${0.25 + 0.35 * turn}"/>`;
    body += slab(cx, cy, u * 0.36, u * 0.36 * 1.65, { face, scaleX, labelHidden });
    const sweep = clamp((t - 0.55) / 0.4);
    if (sweep > 0 && sweep < 1) {
      const sx = lerp(cx - u * 0.4, cx + u * 0.4, sweep);
      body += `<rect x="${sx - u * 0.04}" y="${cy - u * 0.4}" width="${u * 0.08}" height="${u * 0.8}" fill="#fff" opacity="0.35" transform="rotate(18 ${sx} ${cy})"/>`;
    }
  }
  return body;
}

function frameSvg(i, W, H) {
  const p = i / (FRAME_COUNT - 1);
  const scene = SCENES.find((s) => p >= s.start && p < s.end) ?? SCENES.at(-1);
  const pad = Math.round(Math.min(W, H) * 0.035);
  const fs = Math.round(Math.min(W, H) * 0.026);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow"><stop offset="0" stop-color="${Y}" stop-opacity="0.5"/><stop offset="1" stop-color="${Y}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="${BG}"/>
  ${drawScene(p, W, H)}
  <g font-family="Arial, sans-serif" fill="#ffffff" fill-opacity="0.55" text-anchor="middle">
    <text x="${W / 2}" y="${H * 0.1 + pad}" font-size="${fs}" font-weight="700" fill="${Y}" fill-opacity="0.9">PLACEHOLDER FRAME ${String(i + 1).padStart(4, "0")} / ${FRAME_COUNT}</text>
    <text x="${W / 2}" y="${H * 0.1 + pad + fs * 1.4}" font-size="${fs * 0.85}">Scene ${scene.name} · ${(p * 100).toFixed(1)}%</text>
  </g>
</svg>`;
}

async function run() {
  const root = path.resolve("public/frames");
  for (const set of SETS) {
    const dir = path.join(root, set.name);
    await mkdir(dir, { recursive: true });
    const jobs = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const file = path.join(dir, `frame_${String(i + 1).padStart(4, "0")}.webp`);
      jobs.push(() => sharp(Buffer.from(frameSvg(i, set.width, set.height))).webp({ quality: 80 }).toFile(file));
    }
    // Small worker pool so we don't spawn 200 conversions at once.
    let next = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (next < jobs.length) await jobs[next++]();
      })
    );
    console.log(`✓ ${set.name}: ${FRAME_COUNT} frames → ${path.relative(process.cwd(), dir)}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
