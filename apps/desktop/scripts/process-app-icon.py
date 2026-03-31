#!/usr/bin/env python3
"""
Prepare apps/desktop/assets/icon.png for Electron / electron-builder:
- Remove solid black background (transparent via edge flood-fill).
- Apply a rounded-rect alpha mask so the asset is not a sharp square (helpful
  on platforms where the OS does not apply a squircle mask).

Requires: Pillow (pip install pillow)
Usage: python3 scripts/process-app-icon.py [path/to/icon.png]
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def remove_black_flood(im: Image.Image, tol: int = 10) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    pix = im.load()

    def is_bg(r: int, g: int, b: int) -> bool:
        return r <= tol and g <= tol and b <= tol

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(*pix[x, y][:3]) and not visited[y][x]:
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(*pix[x, y][:3]) and not visited[y][x]:
                visited[y][x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if (
                0 <= nx < w
                and 0 <= ny < h
                and not visited[ny][nx]
                and is_bg(*pix[nx, ny][:3])
            ):
                visited[ny][nx] = True
                q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                pix[x, y] = (0, 0, 0, 0)
    return im


def apply_rounded_rect_alpha(im: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    """Corner radius ~22% of side — common for 1024×1024 app icon artboards."""
    w, h = im.size
    r = max(8, int(min(w, h) * radius_ratio))
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    r_, g_, b_, a_ = im.split()
    new_a = ImageChops.multiply(a_, mask)
    return Image.merge("RGBA", (r_, g_, b_, new_a))


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "assets" / "icon.png"
    if not out.is_file():
        print(f"Not found: {out}", file=sys.stderr)
        sys.exit(1)
    im = Image.open(out)
    im = remove_black_flood(im)
    im = apply_rounded_rect_alpha(im)
    im.save(out, "PNG", optimize=True)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
