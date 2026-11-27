"""Turns a hero video into a dense frame sequence: every source frame plus one FILM in-between
for each neighbouring pair (240 frames in -> 479 out), saved as lossless PNGs.

Usage:  python -I scripts/hero-render/video_frames.py <video.mp4> <out-dir>
Then scale/compose the PNGs into public/frames with ffmpeg (see the hero README notes in render.mjs).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import torch
from PIL import Image

MODEL = Path(__file__).resolve().parent / "models" / "film_net_fp16.pt"


def to_tensor(path):
    arr = np.array(Image.open(path).convert("RGB"))
    return torch.from_numpy(arr).permute(2, 0, 1).float().div(255).unsqueeze(0)


def pad64(t):
    _, _, h, w = t.shape
    return torch.nn.functional.pad(t, (0, (-w) % 64, 0, (-h) % 64), mode="replicate"), (h, w)


def save(t, path, size):
    h, w = size
    arr = t[0, :, :h, :w].clamp(0, 1).mul(255).round().byte().permute(1, 2, 0).cpu().numpy()
    Image.fromarray(arr).save(path)


def main():
    video, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.float16 if device.type == "cuda" else torch.float32
    model = torch.jit.load(str(MODEL), map_location="cpu").eval().to(device=device, dtype=dtype)

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(video), str(Path(tmp) / "%04d.png")], check=True)
        src = sorted(Path(tmp).glob("*.png"))
        n = 0
        prev, size = pad64(to_tensor(src[0]))
        prev = prev.to(device, dtype)
        for path in src[1:]:
            cur, _ = pad64(to_tensor(path))
            cur = cur.to(device, dtype)
            with torch.no_grad():
                mid = model(prev, cur, prev.new_full((1, 1), 0.5))
            n += 1; save(prev.float(), out / f"{n:04d}.png", size)
            n += 1; save(mid.float(), out / f"{n:04d}.png", size)
            prev = cur
        n += 1; save(prev.float(), out / f"{n:04d}.png", size)
    print(f"{len(src)} source frames -> {n} frames in {out}")


if __name__ == "__main__":
    main()
