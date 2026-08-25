"""
Packs Moon/*.png into a horizontal sprite sheet for the profile poster.

Run once after changing the frames; the output is committed so the Node
generator stays dependency-free:

    python scripts/build-moon-sprite.py

Two variants are produced. The frames are desaturated to keep the poster
strictly monochrome, and the light-theme copy is darkened so the moon still
reads against a white background.
"""

import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
FRAMES = ROOT / "Moon"
ASSETS = ROOT / "assets"

VARIANTS = {
    "dark": {"gain": 1.0, "lift": 0},
    "light": {"gain": 0.52, "lift": 0},
}


def load_frames() -> list[Image.Image]:
    paths = sorted(FRAMES.glob("*.png"), key=lambda p: int(p.stem))
    if not paths:
        raise SystemExit(f"no frames found in {FRAMES}")
    return [Image.open(p).convert("RGBA") for p in paths]


def tone(frame: Image.Image, gain: float, lift: int) -> Image.Image:
    """Greyscale the frame, scale its luminance, and keep the original alpha."""
    grey = frame.convert("L").point(lambda v: max(0, min(255, int(v * gain) + lift)))
    out = Image.merge("RGBA", (grey, grey, grey, frame.getchannel("A")))
    return out


def build(name: str, frames: list[Image.Image], gain: float, lift: int) -> pathlib.Path:
    size = frames[0].size[0]
    sheet = Image.new("RGBA", (size * len(frames), size), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(tone(frame, gain, lift), (i * size, 0))

    # Quantise to a small palette: a greyscale moon needs nowhere near 8-bit
    # colour, and this roughly halves the bytes that get base64'd into the SVG.
    alpha = sheet.getchannel("A")
    flat = sheet.convert("RGB").quantize(colors=64, method=Image.MEDIANCUT)
    flat = flat.convert("RGBA")
    flat.putalpha(alpha)

    out = ASSETS / f"moon-{name}.png"
    flat.save(out, optimize=True)
    return out


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    frames = load_frames()
    size = frames[0].size[0]
    print(f"{len(frames)} frames at {size}x{size}")

    for name, settings in VARIANTS.items():
        out = build(name, frames, **settings)
        print(f"  {out.relative_to(ROOT)}  {out.stat().st_size} bytes  "
              f"({size * len(frames)}x{size})")


main()
