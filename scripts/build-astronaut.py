"""
Packs assets/Astronaut.png down to the size the poster actually draws it.

The source is ~1 MB at 1199x1312. The poster inlines its art as base64 data
URIs (an SVG behind an <img> cannot fetch anything), so shipping the original
would add roughly 1.4 MB to *each* theme. This writes a 2x-of-display copy,
which is all the detail that can ever be seen.

Re-run only when the source art changes:

    python scripts/build-astronaut.py
"""

import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "Astronaut.png"
OUT = ROOT / "assets" / "astronaut-sprite.png"

# The poster draws it ~150px wide. 240 keeps it sharp without the base64 cost
# running away: at 300px the inlined copy alone was ~140 KB per theme.
TARGET_WIDTH = 240
PALETTE_COLOURS = 64


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source art: {SOURCE}")

    # Windows paths are case-insensitive, so an output that differs from the
    # source only by case is the *same file* — writing it destroys the original.
    if SOURCE.resolve() == OUT.resolve():
        raise SystemExit(f"refusing to overwrite the source: {SOURCE} and {OUT} resolve to one file")

    art = Image.open(SOURCE).convert("RGBA")

    # Trim fully transparent margins so the drawn box is all astronaut.
    bbox = art.getchannel("A").getbbox()
    art = art.crop(bbox)

    height = round(art.height * TARGET_WIDTH / art.width)
    # NEAREST, not LANCZOS: this is pixel art, and resampling invents
    # intermediate colours that cost bytes and soften the edges.
    art = art.resize((TARGET_WIDTH, height), Image.NEAREST)

    # Pixel art uses few colours, so a palette costs nothing visually and
    # roughly halves the bytes that get base64'd into the SVG.
    alpha = art.getchannel("A")
    flat = art.convert("RGB").quantize(colors=PALETTE_COLOURS, method=Image.MEDIANCUT).convert("RGBA")
    flat.putalpha(alpha)
    flat.save(OUT, optimize=True)

    print(f"source {SOURCE.name}: {SOURCE.stat().st_size:,} bytes")
    print(f"output {OUT.name}: {OUT.stat().st_size:,} bytes at {flat.width}x{flat.height}")


main()
