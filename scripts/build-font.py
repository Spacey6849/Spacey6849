"""
Subsets Space Grotesk down to the glyphs the poster actually draws and writes
it to assets/space-grotesk.woff2.

The poster inlines that file as a base64 data URI. An SVG behind an <img> is
not allowed to fetch anything, so a normal webfont link renders nothing —
embedding is the only way to use a non-system face. Verified that a data-URI
@font-face does apply in that context by rasterising to canvas and diffing
against a fallback-only control.

Space Grotesk is SIL OFL 1.1, which permits embedding. Re-run only when the
character set changes:

    python scripts/build-font.py
"""

import pathlib
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
CSS_URL = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

# Everything the poster can render in the display face, plus room to grow.
CHARS = (
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789"
    " .,:;!?'\"/\\|-_+=()[]{}@#%&*<>~^$"
    "·–—…°"
)


def fetch(url, **headers):
    request = urllib.request.Request(url, headers={"User-Agent": UA, **headers})
    return urllib.request.urlopen(request, timeout=30).read()


def latin_woff2_url():
    css = fetch(CSS_URL).decode("utf-8")
    blocks = re.findall(
        r"src: url\((https://[^)]+\.woff2)\).*?unicode-range: ([^;]+);", css, re.S
    )
    for url, unicode_range in blocks:
        if unicode_range.strip().startswith("U+0000-00FF"):
            return url
    raise SystemExit("no latin subset found in the Google Fonts CSS")


def main():
    ASSETS.mkdir(exist_ok=True)
    url = latin_woff2_url()
    source = ASSETS / "_space-grotesk-full.woff2"
    source.write_bytes(fetch(url))

    out = ASSETS / "space-grotesk.woff2"
    subset.main([
        str(source),
        f"--text={CHARS}",
        "--flavor=woff2",
        "--layout-features=",
        "--no-hinting",
        "--desubroutinize",
        f"--output-file={out}",
    ])

    font = TTFont(out)
    variable = "fvar" in font
    source_size = source.stat().st_size
    source.unlink()

    print(f"glyphs kept : {len(font.getGlyphOrder())}")
    print(f"variable    : {variable} (one file covers 400 and 700)")
    print(f"{source_size} bytes -> {out.stat().st_size} bytes  ({out.relative_to(ROOT)})")


main()
