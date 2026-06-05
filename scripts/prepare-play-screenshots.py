#!/usr/bin/env python3
"""
Play Console용 스크린샷 준비:
- 10인치 태블릿: 각 변 1080~7680px (9:16 → 1080x1920 이상)
- 7인치 / 중복 방지: 별도 폴더·파일명으로 복사본 생성

사용:
  python3 scripts/prepare-play-screenshots.py ~/Desktop/스크린샷폴더
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_7 = ROOT / "store-assets" / "screenshots-7inch"
OUT_10 = ROOT / "store-assets" / "screenshots-10inch"
OUT_PHONE = ROOT / "store-assets" / "screenshots-phone"

# Play 10" tablet: min 1080 per side (portrait 9:16)
TARGET_W = 1080
TARGET_H = 1920


def fit_cover(img: Image.Image, tw: int, th: int) -> Image.Image:
    src_w, src_h = img.size
    scale = max(tw / src_w, th / src_h)
    nw, nh = int(src_w * scale), int(src_h * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def process_one(path: Path, index: int) -> None:
    img = Image.open(path).convert("RGB")
    stem = f"screen-{index:02d}"

    # Phone / 7": 원본 비율 유지, 긴 변 최대 2400 (이미 크면 그대로)
    phone = img.copy()
    long_side = max(phone.size)
    if long_side < 1080:
        scale = 1080 / long_side
        phone = phone.resize(
            (int(phone.width * scale), int(phone.height * scale)),
            Image.Resampling.LANCZOS,
        )
    if max(phone.size) > 2400:
        scale = 2400 / max(phone.size)
        phone = phone.resize(
            (int(phone.width * scale), int(phone.height * scale)),
            Image.Resampling.LANCZOS,
        )
    phone.save(OUT_PHONE / f"{stem}-phone.png", "PNG", optimize=True)

    # 7": phone과 동일 파일(다른 경로 = Play 중복 완화)
    phone.save(OUT_7 / f"{stem}-7inch.png", "PNG", optimize=True)

    # 10": 반드시 1080x1920 (9:16)
    ten = fit_cover(img, TARGET_W, TARGET_H)
    ten.save(OUT_10 / f"{stem}-10inch.png", "PNG", optimize=True)

    print(
        f"{path.name} -> phone {phone.size} | 7\" {phone.size} | 10\" {ten.size}",
    )


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/prepare-play-screenshots.py <screenshots-folder>")
        sys.exit(1)

    src = Path(sys.argv[1]).expanduser()
    if not src.is_dir():
        print(f"Not a directory: {src}")
        sys.exit(1)

    files = sorted(
        [
            p
            for p in src.iterdir()
            if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
        ]
    )
    if not files:
        print(f"No images in {src}")
        sys.exit(1)

    for out in (OUT_PHONE, OUT_7, OUT_10):
        out.mkdir(parents=True, exist_ok=True)

    print(f"Processing {len(files)} images...\n")
    for i, path in enumerate(files, start=1):
        process_one(path, i)

    print(f"\nDone.\n  Phone: {OUT_PHONE}\n  7\":   {OUT_7}\n  10\":  {OUT_10}")
    print("\nPlay Console:")
    print("  휴대전화  -> screenshots-phone/")
    print("  7인치     -> screenshots-7inch/")
    print("  10인치    -> screenshots-10inch/  (새 파일만, 라이브러리 X)")


if __name__ == "__main__":
    main()
