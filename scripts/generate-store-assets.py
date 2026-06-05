#!/usr/bin/env python3
"""Play Store icon (512) + feature graphic (1024x500) for 0원의품격."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets"

# App + design spec palette
INK = "#0F0F0F"
INK_ELEVATED = "#1A1A1A"
INK_RAISED = "#252525"
LIME = "#D4FF00"
LIME_SOFT = "#EFFF7A"
VIOLET = "#8B5CF6"
PINK = "#EC4899"
ICE = "#00C2FF"
WHITE = "#FFFFFF"
MUTED = "#9A9A9A"


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 6 if bold else 4),
        ("/System/Library/Fonts/Supplemental/AppleGothic.ttf", None),
        ("/Library/Fonts/Arial Unicode.ttf", None),
    ]
    for path, index in candidates:
        p = Path(path)
        if not p.exists():
            continue
        try:
            if index is None:
                return ImageFont.truetype(str(p), size)
            return ImageFont.truetype(str(p), size, index=index)
        except Exception:
            continue
    return ImageFont.load_default()


def lerp_color(a: str, b: str, t: float) -> tuple[int, int, int]:
    def hex_rgb(h: str) -> tuple[int, int, int]:
        h = h.lstrip("#")
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)

    ar, ag, ab = hex_rgb(a)
    br, bg, bb = hex_rgb(b)
    return (
        int(ar + (br - ar) * t),
        int(ag + (bg - ag) * t),
        int(ab + (bb - ab) * t),
    )


def radial_gradient(size: int, inner: str, outer: str) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    cx = cy = (size - 1) / 2
    max_r = math.hypot(cx, cy)
    for y in range(size):
        for x in range(size):
            t = min(1.0, math.hypot(x - cx, y - cy) / max_r)
            px[x, y] = lerp_color(inner, outer, t)
    return img


def draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: str | tuple[int, int, int],
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def create_icon_512() -> Image.Image:
    size = 512
    base = radial_gradient(size, INK_ELEVATED, INK)
    img = base.convert("RGBA")
    draw = ImageDraw.Draw(img)

    # Soft lime glow
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((96, 96, 416, 416), fill=(212, 255, 0, 38))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # Outer ring (zero)
    cx, cy = 256, 268
    draw.ellipse((118, 130, 394, 406), outline=LIME, width=28)

    # Inner fill disc
    draw.ellipse((158, 170, 354, 366), fill=INK_RAISED)

    # Map pin (cultural place)
    pin_cx, pin_cy = 256, 248
    pin_r = 52
    draw.ellipse(
        (pin_cx - pin_r, pin_cy - pin_r, pin_cx + pin_r, pin_cy + pin_r),
        fill=LIME,
    )
    draw.ellipse(
        (pin_cx - 18, pin_cy - 18, pin_cx + 18, pin_cy + 18),
        fill=INK,
    )
    draw.polygon(
        [
            (pin_cx, pin_cy + pin_r - 4),
            (pin_cx - 34, pin_cy + pin_r + 54),
            (pin_cx + 34, pin_cy + pin_r + 54),
        ],
        fill=LIME,
    )

    # Small orbit dots (events / discovery)
    for angle, color, r in [
        (35, VIOLET, 14),
        (145, PINK, 12),
        (250, ICE, 10),
    ]:
        rad = math.radians(angle)
        ox = cx + int(math.cos(rad) * 168)
        oy = cy + int(math.sin(rad) * 148)
        draw.ellipse((ox - r, oy - r, ox + r, oy + r), fill=color)

    # "0원" hint — small won badge
    badge_font = load_font(22, bold=True)
    draw.rounded_rectangle((332, 88, 418, 132), radius=16, fill=LIME)
    draw.text((348, 96), "0원", fill=INK, font=badge_font)

    # Subtle grain overlay
    noise = Image.effect_noise((size, size), 12).convert("RGBA")
    noise.putalpha(18)
    img = Image.alpha_composite(img, noise)

    # Play-safe rounded mask (preview; Play also masks)
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle((0, 0, size, size), radius=112, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out.convert("RGB")


def draw_chip(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    bg: str,
    fg: str,
    font: ImageFont.ImageFont,
    pad_x: int = 18,
    pad_y: int = 10,
) -> None:
    x, y = xy
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    w, h = tw + pad_x * 2, th + pad_y * 2
    draw.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=bg)
    draw.text((x + pad_x, y + pad_y - 2), text, fill=fg, font=font)


def create_feature_1024x500() -> Image.Image:
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), INK)
    draw = ImageDraw.Draw(img)

    # Background gradient bands
    for i in range(h):
        t = i / h
        color = lerp_color(INK, INK_ELEVATED, t * 0.55)
        draw.line([(0, i), (w, i)], fill=color)

    # Lime accent sweep
    sweep = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(sweep)
    sdraw.polygon([(0, h), (0, 180), (620, 0), (760, 0), (0, h)], fill=(212, 255, 0, 42))
    sdraw.ellipse((680, -120, 1180, 380), fill=(139, 92, 246, 55))
    sdraw.ellipse((820, 220, 1080, 520), fill=(236, 72, 153, 40))
    sweep = sweep.filter(ImageFilter.GaussianBlur(40))
    img = Image.alpha_composite(img.convert("RGBA"), sweep).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Left content card
    draw.rounded_rectangle((48, 56, 640, 444), radius=28, fill=INK_ELEVATED, outline="#2E2E2E", width=2)

    title_font = load_font(64, bold=True)
    sub_font = load_font(28)
    chip_font = load_font(22, bold=True)

    draw.text((88, 108), "0원의품격", fill=LIME, font=title_font)
    draw.text((88, 188), "서울 무료·저렴한 문화생활", fill=WHITE, font=sub_font)
    draw.text((88, 228), "지도에서 찾고, 저장하고, 후기를 남기세요", fill=MUTED, font=sub_font)

    draw_chip(draw, (88, 300), "무료 전시", LIME, INK, chip_font)
    draw_chip(draw, (230, 300), "공연", VIOLET, WHITE, chip_font)
    draw_chip(draw, (310, 300), "도서관", ICE, INK, chip_font)
    draw_chip(draw, (88, 368), "지도 탐색", "#2A2A2A", LIME, chip_font)
    draw_chip(draw, (220, 368), "후기", "#2A2A2A", PINK, chip_font)

    # Right: stylized phone + map nodes
    phone_x, phone_y = 700, 72
    draw.rounded_rectangle(
        (phone_x, phone_y, phone_x + 248, phone_y + 356),
        radius=36,
        fill=INK_RAISED,
        outline="#3A3A3A",
        width=3,
    )
    draw.rounded_rectangle(
        (phone_x + 16, phone_y + 48, phone_x + 232, phone_y + 308),
        radius=20,
        fill=INK,
    )

    # Mini map grid
    grid = ImageDraw.Draw(img)
    for gx in range(4):
        for gy in range(3):
            grid.ellipse(
                (
                    phone_x + 40 + gx * 44,
                    phone_y + 90 + gy * 52,
                    phone_x + 52 + gx * 44,
                    phone_y + 102 + gy * 52,
                ),
                fill="#2E2E2E",
            )
    grid.ellipse((phone_x + 118, phone_y + 168, phone_x + 142, phone_y + 192), fill=LIME)
    grid.line(
        [(phone_x + 130, phone_y + 192), (phone_x + 130, phone_y + 228)],
        fill=LIME,
        width=4,
    )

    # Floating cards
    draw.rounded_rectangle((668, 56, 956, 132), radius=18, fill=LIME)
    draw.text((696, 78), "오늘도 0원으로", fill=INK, font=chip_font)
    draw.rounded_rectangle((872, 360, 988, 444), radius=18, fill=VIOLET)
    draw.text((894, 392), "저장함", fill=WHITE, font=chip_font)

    # Bottom lime bar
    draw.rectangle((0, 468, w, 500), fill=LIME)
    bar_font = load_font(20, bold=True)
    draw.text((48, 476), "0원의품격 · Google Play", fill=INK, font=bar_font)

    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon_path = OUT / "play-icon-512.png"
    feature_path = OUT / "play-feature-1024x500.png"

    icon = create_icon_512()
    icon.save(icon_path, "PNG", optimize=True)

    feature = create_feature_1024x500()
    feature.save(feature_path, "PNG", optimize=True)

    print(f"Wrote {icon_path} ({icon_path.stat().st_size} bytes)")
    print(f"Wrote {feature_path} ({feature_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
