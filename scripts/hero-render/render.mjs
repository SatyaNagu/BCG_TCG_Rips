// Renders the hero scene frame by frame in headless Chrome.
// Usage:
//   node scripts/hero-render/render.mjs                       all frames (FRAME_COUNT), desktop + mobile, into public/frames
//   node scripts/hero-render/render.mjs --format=desktop --frames=key --out=<dir>
//   node scripts/hero-render/render.mjs --frames=1,30,70
//   node scripts/hero-render/render.mjs --source=scene       the 3D version instead of the keyframe sequence
import http from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { FRAME_COUNT, FORMATS, KEY_FRAMES } from "./config.mjs";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ROOT = process.cwd();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
// sequence = built from the 8 keyframes (default); scene = the 3D version.
const SOURCE = args.source ?? "sequence";
const formats = (args.format ?? "desktop,mobile").split(",");
const frames =
  args.frames === "key"
    ? KEY_FRAMES
    : args.frames
      ? args.frames.split(",").map(Number)
      : Array.from({ length: FRAME_COUNT }, (_, i) => i + 1);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer(async (req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11", "--enable-unsafe-swiftshader"],
});

try {
  for (const name of formats) {
    const { width, height } = FORMATS[name];
    const out = path.resolve(args.out ? path.join(args.out, name) : `public/frames/${name}`);
    await mkdir(out, { recursive: true });

    const page = await browser.newPage();
    page.on("console", (m) => m.type() === "error" && console.error(`[${name}] ${m.text()}`));
    page.on("pageerror", (e) => console.error(`[${name}] ${e.message}`));
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/scripts/hero-render/${SOURCE}.html?format=${name}`);
    await page.waitForFunction("window.heroReady === true", { timeout: 120_000 });

    const started = Date.now();
    for (const f of frames) {
      const url = await page.evaluate((n) => window.renderFrame(n), f);
      await writeFile(path.join(out, `frame_${String(f).padStart(4, "0")}.webp`), Buffer.from(url.split(",")[1], "base64"));
      process.stdout.write(`\r${name}: frame ${f} (${frames.indexOf(f) + 1}/${frames.length})`);
    }
    console.log(`\n${name}: ${frames.length} frames in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
