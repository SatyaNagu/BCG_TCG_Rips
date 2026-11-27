"""Generates real in-between frames for each neighbouring keyframe pair with FILM
(Google Research, "Frame Interpolation for Large Motion"; PyTorch export by dajes).

Usage:  python -I scripts/hero-render/interpolate.py [--levels 5] [--width 1920]
Reads   assets/hero/keyframes/1.jpg ... 8.jpg
Writes  assets/hero/interp/pair_1_2/0000.jpg ... (2**levels + 1 frames per pair, endpoints included)

FILM handles large motion best by recursive bisection at dt = 0.5, which is what this does.
"""
import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
KEYFRAMES = ROOT / "assets" / "hero" / "keyframes"
OUT = ROOT / "assets" / "hero" / "interp"
MODEL = Path(__file__).resolve().parent / "models" / "film_net_fp16.pt"


def load(path, width):
    img = Image.open(path).convert("RGB")
    height = round(img.height * width / img.width / 2) * 2
    img = img.resize((width, height), Image.LANCZOS)
    return torch.from_numpy(np.asarray(img)).permute(2, 0, 1).float().div(255).unsqueeze(0)


def pad64(t):
    _, _, h, w = t.shape
    ph, pw = (-h) % 64, (-w) % 64
    return torch.nn.functional.pad(t, (0, pw, 0, ph), mode="replicate"), (h, w)


def save(t, path, size):
    h, w = size
    arr = t[0, :, :h, :w].clamp(0, 1).mul(255).round().byte().permute(1, 2, 0).cpu().numpy()
    Image.fromarray(arr).save(path, quality=93)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--levels", type=int, default=5)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--pairs", default="1-2,2-3,3-4,4-5,5-6,6-7,7-8")
    ap.add_argument("--refine", action="store_true", help="add one level: a new frame between every existing neighbour")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.float16 if device.type == "cuda" else torch.float32
    model = torch.jit.load(str(MODEL), map_location="cpu").eval().to(device=device, dtype=dtype)

    if args.refine:
        for pair in args.pairs.split(","):
            a, b = pair.split("-")
            out = OUT / f"pair_{a}_{b}"
            paths = sorted(out.glob("*.jpg"))
            frames = [pad64(load(p, args.width)) for p in paths]
            size = frames[0][1]
            result = []
            for (lo, _), (hi, _) in zip(frames, frames[1:]):
                dt = torch.full((1, 1), 0.5, device=device, dtype=dtype)
                with torch.no_grad():
                    mid = model(lo.to(device, dtype), hi.to(device, dtype), dt).float().cpu()
                result += [lo, mid]
            result.append(frames[-1][0])
            for i, t in enumerate(result):
                save(t, out / f"{i:04d}.jpg", size)
            print(f"pair {a}->{b}: refined {len(paths)} -> {len(result)} frames", flush=True)
            torch.cuda.empty_cache()
        return

    for pair in args.pairs.split(","):
        a, b = pair.split("-")
        out = OUT / f"pair_{a}_{b}"
        out.mkdir(parents=True, exist_ok=True)
        A, size = pad64(load(KEYFRAMES / f"{a}.jpg", args.width))
        B, _ = pad64(load(KEYFRAMES / f"{b}.jpg", args.width))
        n = 2 ** args.levels
        frames = {0: A.to(device, dtype), n: B.to(device, dtype)}

        def fill(lo, hi):
            if hi - lo < 2:
                return
            mid = (lo + hi) // 2
            dt = frames[lo].new_full((1, 1), 0.5)
            with torch.no_grad():
                frames[mid] = model(frames[lo], frames[hi], dt)
            fill(lo, mid)
            fill(mid, hi)

        fill(0, n)
        for i in range(n + 1):
            save(frames[i].float(), out / f"{i:04d}.jpg", size)
        print(f"pair {a}->{b}: {n + 1} frames at {size[1]}x{size[0]} -> {out}", flush=True)
        del frames
        torch.cuda.empty_cache()


if __name__ == "__main__":
    main()
