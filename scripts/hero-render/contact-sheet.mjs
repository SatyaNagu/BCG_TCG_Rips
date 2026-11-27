// Tiles rendered frames into one labeled image for review.
// Usage: node scripts/hero-render/contact-sheet.mjs <frames-dir> <out.jpg> [frame numbers...]
import sharp from "sharp";
import path from "node:path";
import { KEY_FRAMES } from "./config.mjs";

const [dir, out, ...rest] = process.argv.slice(2);
const frames = rest.length ? rest.map(Number) : KEY_FRAMES;
const first = await sharp(path.join(dir, `frame_${String(frames[0]).padStart(4, "0")}.webp`)).metadata();
const tileW = first.width > first.height ? 960 : 360;
const tileH = Math.round((tileW * first.height) / first.width);
const cols = first.width > first.height ? 2 : 4;
const rows = Math.ceil(frames.length / cols);
const gap = 8;

const tiles = await Promise.all(
  frames.map(async (f, i) => {
    const label = Buffer.from(
      `<svg width="${tileW}" height="${tileH}"><rect x="8" y="8" width="96" height="30" fill="#000" opacity="0.7"/>` +
        `<text x="16" y="30" font-family="Arial" font-size="18" fill="#FFD400">#${f}</text></svg>`,
    );
    const input = await sharp(path.join(dir, `frame_${String(f).padStart(4, "0")}.webp`))
      .resize(tileW, tileH)
      .composite([{ input: label }])
      .toBuffer();
    return { input, left: (i % cols) * (tileW + gap), top: Math.floor(i / cols) * (tileH + gap) };
  }),
);

await sharp({ create: { width: cols * (tileW + gap) - gap, height: rows * (tileH + gap) - gap, channels: 3, background: "#333" } })
  .composite(tiles)
  .jpeg({ quality: 88 })
  .toFile(out);
console.log(out);
