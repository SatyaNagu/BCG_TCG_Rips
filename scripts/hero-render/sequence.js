// BC TCG hero built from the 8 keyframes plus the in-between frames FILM generated for each pair
// (assets/hero/interp/pair_A_B/0000.jpg ... 0064.jpg, 1920x1072, endpoints are the keyframes).
// This file plays those frames on a timeline, frames them for desktop or mobile, and adds light effects.
// Driven only by frame number. The Node renderer calls window.renderFrame(n) and stores the returned WebP.
import { FORMATS, FRAME_COUNT } from "./config.mjs";

const name = new URLSearchParams(location.search).get("format") ?? "desktop";
const { width: W, height: H } = FORMATS[name];
const MOBILE = name === "mobile";

const canvas = document.getElementById("c");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");

const IW = 1920, IH = 1072;
const STEPS = 64; // in-betweens per pair, endpoints included = STEPS + 1 files
// Everything below is timed on a 1-200 timeline; output frames are spread evenly across it.
const TIMELINE_END = 200;
// Pixel scale for "1.0" zoom. Desktop crops the letterbox bars; mobile shows the subject at ~80% width.
const BASE = MOBILE ? 1.15 : (H / IH) * 1.1;
// Where the focus point lands: desktop leaves the left third calm for captions.
const OFF_X = MOBILE ? 0 : W * 0.1;
const OFF_Y = MOBILE ? -H * 0.05 : 0;

// Subject focus per keyframe, in normalized image coordinates. Mobile frames tighter, so it tracks the action.
const FOCUS = {
  1: [0.49, 0.5],
  2: [0.5, 0.5],
  3: [0.5, 0.48],
  4: [MOBILE ? 0.6 : 0.5, 0.5],
  5: [0.497, 0.475],
  6: [0.494, 0.49],
  7: [0.51, 0.5],
  8: [0.5, 0.5],
};
const VOID_CENTER = [0.497, 0.475];
// The graded card inside the slab in keyframe 8, in image pixels.
const CARD_8 = { x: 746, y: 330, w: 444, h: 601 };

// Which source plays when. pair = FILM in-betweens from keyframe a to b; hold = keyframe k.
const TRACK = [
  { f: [1, 5], hold: 1 },
  { f: [5, 18], pair: [1, 2] },
  { f: [18, 21], hold: 2 },
  { f: [21, 32], pair: [2, 3] },
  { f: [32, 36], hold: 3 },
  { f: [36, 50], pair: [3, 4] },
  { f: [50, 56], hold: 4 },
  // Kept short: FILM breaks the card up as it enters the vortex, and a flash covers the middle.
  { f: [56, 65], pair: [4, 5] },
  { f: [65, 112], hold: 5 },
  { f: [112, 128], pair: [5, 6] },
  { f: [128, 132], hold: 6 },
  { f: [132, 148], pair: [6, 7] },
  { f: [148, 154], hold: 7 },
  // Back and front of the slab are different images, which FILM melts together, so this one is a turn.
  { f: [154, 178], flip: [7, 8] },
  { f: [178, 200], hold: 8 },
];

const FEATHER = MOBILE ? { x: 0.06, barY: 0.045, y: 0.1 } : { x: 0.06, barY: 0.04, y: 0.06 };
const BLACK_POINT = 16;
// The site's "Night" background (--bg in globals.css); the frames' blacks land exactly on it.
const NIGHT = [15, 15, 15];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (f, a, b) => clamp01((f - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const pulse = (f, at, width) => Math.exp(-((f - at) ** 2) / (2 * width * width));

// ---------- source frames ----------
const pad = (n) => String(n).padStart(4, "0");
const sourcePath = (a, b, i) => `/assets/hero/interp/pair_${a}_${b}/${pad(i)}.jpg`;
// The 7 -> 8 turn is a flip, not FILM frames, so keyframe 8 comes straight from the original.
const keyPath = (k) => (k < 8 ? sourcePath(k, k + 1, 0) : "/assets/hero/keyframes/8.jpg");

// The frames' "black" is a dark brown-grey: pull it down to Night, and feather the edges to transparent,
// so moving, rotating or zooming never shows a seam against the background.
const LUT = new Uint8ClampedArray(256);
for (let i = 0; i < 256; i++)
  LUT[i] = Math.round(NIGHT[0] + (255 - NIGHT[0]) * Math.pow(Math.max(0, (i - BLACK_POINT) / (255 - BLACK_POINT)), 1.05));

function prepare(img) {
  const c = document.createElement("canvas");
  c.width = IW;
  c.height = IH;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, IW, IH);
  const px = g.getImageData(0, 0, IW, IH);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = LUT[d[i]];
    d[i + 1] = LUT[d[i + 1]];
    d[i + 2] = LUT[d[i + 2]];
  }
  g.putImageData(px, 0, 0);
  g.globalCompositeOperation = "destination-in";
  const v = g.createLinearGradient(0, 0, 0, IH);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(FEATHER.barY, "rgba(0,0,0,0)");
  v.addColorStop(FEATHER.y, "rgba(0,0,0,1)");
  v.addColorStop(1 - FEATHER.y, "rgba(0,0,0,1)");
  v.addColorStop(1 - FEATHER.barY, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = v;
  g.fillRect(0, 0, IW, IH);
  const h = g.createLinearGradient(0, 0, IW, 0);
  h.addColorStop(0, "rgba(0,0,0,0)");
  h.addColorStop(FEATHER.x, "rgba(0,0,0,1)");
  h.addColorStop(1 - FEATHER.x, "rgba(0,0,0,1)");
  h.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = h;
  g.fillRect(0, 0, IW, IH);
  return c;
}

// Small cache: frames render in order, so only the last few sources are ever reused.
const cache = new Map();
async function source(path) {
  if (cache.has(path)) return cache.get(path);
  const img = new Image();
  img.src = path;
  await img.decode();
  const prepared = prepare(img);
  cache.set(path, prepared);
  if (cache.size > 6) cache.delete(cache.keys().next().value);
  return prepared;
}

// ---------- timeline ----------
// Returns the source frames for f (one, or two neighbours blended), plus the keyframe-space position t
// (e.g. 4.5 = halfway from keyframe 4 to 5) that drives the camera.
function sourcesAt(f) {
  const step = TRACK.find((s) => f >= s.f[0] && f <= s.f[1]) ?? TRACK[TRACK.length - 1];
  if (step.hold) return { pos: step.hold, parts: [{ path: keyPath(step.hold), alpha: 1 }] };
  if (step.flip) {
    // Turn edge-on (squash to nothing while straightening), then swing the front into view.
    const mid = (step.f[0] + step.f[1]) / 2;
    const out = Math.pow(seg(f, step.f[0], mid), 3);
    const back = 1 - Math.pow(1 - seg(f, mid, step.f[1]), 3);
    return f < mid
      ? { pos: step.flip[0], parts: [{ path: keyPath(step.flip[0]), alpha: 1, squash: 1 - out, rot: 0.42 * out }] }
      : { pos: step.flip[1], parts: [{ path: keyPath(step.flip[1]), alpha: 1, squash: Math.max(0.001, back), rot: -0.12 * (1 - back) }] };
  }
  const [a, b] = step.pair;
  const t = inOut(seg(f, step.f[0], step.f[1]));
  const exact = t * STEPS;
  const lo = Math.floor(exact), hi = Math.min(STEPS, lo + 1), frac = exact - lo;
  const parts = [{ path: sourcePath(a, b, lo), alpha: 1 }];
  if (frac > 0.02 && hi !== lo) parts.push({ path: sourcePath(a, b, hi), alpha: frac });
  return { pos: a + t, parts };
}

function cameraAt(f, pos) {
  const k = Math.min(7, Math.floor(pos));
  const focus = pos >= 8 ? FOCUS[8] : lerp2(FOCUS[k], FOCUS[k + 1], pos - k);
  // Slow push-in through each act, the vortex turning while we wait, and unwinding as the slab arrives.
  let zoom = 1 + 0.05 * seg(f, 1, 36) + 0.04 * seg(f, 68, 112) - 0.04 * seg(f, 112, 128) + 0.04 * seg(f, 178, 200);
  const rot = -0.0045 * (Math.min(f, 112) - 68) * (f >= 68 ? 1 : 0) * (1 - inOut(seg(f, 112, 130)));
  // On desktop the slab is taller than the frame at full zoom, so the camera eases back as it arrives.
  if (!MOBILE) zoom *= lerp(1, 0.82, inOut(seg(f, 126, 152)));
  return { zoom, rot, focus };
}

function withCamera(cam, draw, part = {}) {
  ctx.save();
  ctx.translate(W / 2 + OFF_X, H / 2 + OFF_Y);
  ctx.rotate(cam.rot + (part.rot ?? 0));
  ctx.scale(BASE * cam.zoom * (part.squash ?? 1), BASE * cam.zoom);
  ctx.translate(-cam.focus[0] * IW, -cam.focus[1] * IH);
  draw();
  ctx.restore();
}

function toScreen(cam, px, py) {
  const s = BASE * cam.zoom;
  const lx = (px - cam.focus[0] * IW) * s, ly = (py - cam.focus[1] * IH) * s;
  const c = Math.cos(cam.rot), sn = Math.sin(cam.rot);
  return [W / 2 + OFF_X + lx * c - ly * sn, H / 2 + OFF_Y + lx * sn + ly * c];
}

// ---------- overlays ----------
function glow(x, y, radius, alpha, inner = "255,244,214", outer = "255,184,0") {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${inner},${Math.min(1, alpha)})`);
  g.addColorStop(0.25, `rgba(${outer},${Math.min(1, alpha * 0.55)})`);
  g.addColorStop(1, `rgba(${outer},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function holoSweep(cam, progress, shimmer) {
  withCamera(cam, () => {
    const { x, y, w, h } = CARD_8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    if (progress > 0 && progress < 1) {
      const span = w + h;
      const centre = lerp(-0.25, 1.25, progress) * span;
      const g = ctx.createLinearGradient(x, y, x + span * 0.5, y + span * 0.5);
      const stop = (t, c) => g.addColorStop(clamp01((centre + t * span) / span), c);
      stop(-0.12, "rgba(255,200,80,0)");
      stop(-0.05, "rgba(255,120,200,0.18)");
      stop(-0.015, "rgba(255,230,140,0.42)");
      stop(0, "rgba(255,255,240,0.6)");
      stop(0.015, "rgba(140,220,255,0.38)");
      stop(0.06, "rgba(180,255,170,0.14)");
      stop(0.12, "rgba(255,200,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    }
    if (shimmer > 0) {
      ctx.fillStyle = `rgba(255,214,120,${0.05 * shimmer})`;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  });
}

// Fine gold dust over everything, so the whole piece shares one living atmosphere.
let seed = 20261103;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const DUST = Array.from({ length: 170 }, () => ({
  x: rand(), y: rand(), z: rand(), vx: (rand() - 0.5) * 0.0012, vy: -0.0006 - rand() * 0.0014, tw: rand() * 6.28,
}));

function dust(f) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of DUST) {
    const x = ((p.x + p.vx * f) % 1 + 1) % 1;
    const y = ((p.y + p.vy * f) % 1 + 1) % 1;
    const r = (0.6 + p.z * 1.8) * (H / 1080) * (MOBILE ? 1.4 : 1);
    const a = (0.12 + 0.4 * p.z) * (0.6 + 0.4 * Math.sin(f * 0.15 + p.tw));
    ctx.fillStyle = `rgba(255,196,70,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x * W, y * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function captionShade() {
  // Desktop captions sit in the left third: keep it calm.
  if (MOBILE) return;
  const g = ctx.createLinearGradient(0, 0, W * 0.16, 0);
  g.addColorStop(0, `rgba(${NIGHT},1)`);
  g.addColorStop(1, `rgba(${NIGHT},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W * 0.16, H);
}

// ---------- frame ----------
window.renderFrame = async (frame) => {
  const f = 1 + ((frame - 1) * (TIMELINE_END - 1)) / (FRAME_COUNT - 1);
  const { pos, parts } = sourcesAt(f);
  const images = await Promise.all(parts.map((p) => source(p.path)));
  const cam = cameraAt(f, pos);
  const unit = Math.min(W, H);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgb(${NIGHT})`;
  ctx.fillRect(0, 0, W, H);
  parts.forEach((p, i) => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    withCamera(cam, () => ctx.drawImage(images[i], 0, 0), p);
    ctx.restore();
  });
  // A thin gold glint while the slab is edge-on.
  if (f > 160 && f < 172) {
    const [x, y] = toScreen(cam, IW * FOCUS[7][0], IH * FOCUS[7][1]);
    const a = 0.7 * pulse(f, 166, 2);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(x - unit * 0.05, 0, x + unit * 0.05, 0);
    g.addColorStop(0, "rgba(255,190,40,0)");
    g.addColorStop(0.5, `rgba(255,236,170,${a})`);
    g.addColorStop(1, "rgba(255,190,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - unit * 0.05, y - unit * 0.42, unit * 0.1, unit * 0.84);
    ctx.restore();
    glow(x, y, unit * 0.4, 0.45 * pulse(f, 166, 2));
  }

  // Tear flash as the pack splits.
  {
    const [x, y] = toScreen(cam, IW * 0.5, IH * 0.3);
    glow(x, y, unit * 0.3, 0.6 * pulse(f, 12, 2.5));
  }
  // The card vanishing into the vortex, heartbeat pulses while we wait, and the flare that releases the slab.
  {
    const [x, y] = toScreen(cam, IW * VOID_CENTER[0], IH * VOID_CENTER[1]);
    // Timed over the in-betweens where the card breaks up into the vortex.
    const [cx, cy] = toScreen(cam, IW * 0.6, IH * 0.45);
    glow(cx, cy, unit * 0.7, 1.15 * pulse(f, 60.5, 2.2));
    glow(x, y, unit * 0.3, 0.35 * pulse(f, 85, 2.6) + 0.5 * pulse(f, 95, 2.6) + 0.7 * pulse(f, 105, 2.6));
    glow(x, y, unit * 0.75, 1.0 * pulse(f, 113, 3), "255,250,235", "255,190,40");
  }
  // Holo light sweep across the Charizard, then a faint shimmer on the hold.
  if (f >= 178) holoSweep(cam, seg(f, 180, 193), smooth(seg(f, 190, 197)) * (0.7 + 0.3 * Math.sin(f * 0.4)));

  dust(f);
  captionShade();
  return canvas.toDataURL("image/webp", 0.8);
};
window.heroReady = true;
