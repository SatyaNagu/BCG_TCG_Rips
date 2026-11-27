// Cuts flat, front-on textures out of the AI keyframes for the 3D hero render.
// Usage: node scripts/hero-render/extract-textures.mjs [keyframes-dir]
// Corners are in the keyframes' native 2752x1536 pixel space, ordered TL, TR, BR, BL.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = process.argv[2] ?? "assets/hero/keyframes";
const OUT = path.resolve("assets/hero");
const S = 1.376; // keyframes were inspected at 2000px wide

const JOBS = [
  {
    name: "pack-front.png",
    file: "1.jpg",
    size: [640, 1200],
    quad: [[866, 146], [1273, 192], [1141, 948], [731, 903]].map(([x, y]) => [x * S, y * S]),
  },
  {
    name: "card-back.png",
    file: "3.jpg",
    size: [734, 1024],
    quad: [[880, 163], [1253, 203], [1165, 727], [790, 690]].map(([x, y]) => [x * S, y * S]),
  },
  {
    name: "slab-front.png",
    file: "8.jpg",
    size: [812, 1335],
    quad: [[713, 78], [1303, 78], [1303, 1048], [713, 1048]].map(([x, y]) => [x * S, y * S]),
  },
];

// Projective map from the unit square onto a quad (Heckbert, "Fundamentals of Texture Mapping").
function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}

async function rectify({ name, file, size: [W, H], quad }) {
  const { data, info } = await sharp(path.join(SRC, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const map = squareToQuad(quad);
  const out = Buffer.alloc(W * H * 3);
  const px = (x, y, ch) => data[(Math.min(info.height - 1, Math.max(0, y)) * info.width + Math.min(info.width - 1, Math.max(0, x))) * 3 + ch];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const [sx, sy] = map((i + 0.5) / W, (j + 0.5) / H);
      const x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5);
      const fx = sx - 0.5 - x0, fy = sy - 0.5 - y0;
      for (let ch = 0; ch < 3; ch++) {
        const top = px(x0, y0, ch) * (1 - fx) + px(x0 + 1, y0, ch) * fx;
        const bot = px(x0, y0 + 1, ch) * (1 - fx) + px(x0 + 1, y0 + 1, ch) * fx;
        out[(j * W + i) * 3 + ch] = top * (1 - fy) + bot * fy;
      }
    }
  }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(OUT, name));
  console.log(`${name} ${W}x${H}`);
}

await mkdir(OUT, { recursive: true });
for (const job of JOBS) await rectify(job);
