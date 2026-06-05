from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import random

W, H = 1024, 500
S = 2
OUT = "store-assets/play-feature-1024x500-v2.png"
ICON = "assets/icon-v2.png"
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def sc(v):
    return int(round(v * S))


def font(size):
    return ImageFont.truetype(FONT, sc(size))


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def gradient_bg():
    img = Image.new("RGB", (sc(W), sc(H)), "#fbf5df")
    pix = img.load()
    c1 = (255, 249, 224)
    c2 = (211, 246, 244)
    c3 = (255, 218, 117)
    for y in range(sc(H)):
        for x in range(sc(W)):
            nx = x / sc(W)
            ny = y / sc(H)
            t = (nx * 0.45 + ny * 0.55)
            base = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
            glow = max(0, 1 - math.hypot(nx - 0.18, ny - 0.28) * 2.6)
            pix[x, y] = tuple(min(255, int(base[i] + c3[i] * glow * 0.22)) for i in range(3))
    return img.convert("RGBA")


def add_soft_blob(layer, center, radius, color, blur):
    blob = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(blob)
    cx, cy = sc(center[0]), sc(center[1])
    rx, ry = sc(radius[0]), sc(radius[1])
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=color)
    layer.alpha_composite(blob.filter(ImageFilter.GaussianBlur(sc(blur))))


def text_with_shadow(draw, xy, text, fnt, fill, shadow=(255, 255, 255, 165), offset=(0, 3)):
    x, y = sc(xy[0]), sc(xy[1])
    draw.text((x + sc(offset[0]), y + sc(offset[1])), text, font=fnt, fill=shadow)
    draw.text((x, y), text, font=fnt, fill=fill)


def draw_chip(draw, xy, label, fill, ink):
    x, y = sc(xy[0]), sc(xy[1])
    f = font(22)
    bbox = draw.textbbox((0, 0), label, font=f)
    w = bbox[2] - bbox[0] + sc(34)
    h = sc(42)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=sc(21), fill=fill)
    draw.text((x + sc(17), y + sc(8)), label, font=f, fill=ink)
    return w // S + 10


canvas = gradient_bg()
add_soft_blob(canvas, (820, 120), (260, 170), (104, 63, 255, 42), 44)
add_soft_blob(canvas, (350, 430), (300, 110), (0, 194, 255, 44), 36)
add_soft_blob(canvas, (105, 120), (210, 170), (255, 216, 0, 54), 34)

decor = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
d = ImageDraw.Draw(decor)

random.seed(7)
for _ in range(38):
    x = random.randint(sc(40), sc(980))
    y = random.randint(sc(40), sc(460))
    r = random.randint(sc(3), sc(8))
    col = random.choice(
        [
            (255, 201, 28, 70),
            (0, 194, 255, 58),
            (110, 63, 255, 48),
            (255, 61, 139, 45),
            (120, 224, 184, 55),
        ]
    )
    d.ellipse((x - r, y - r, x + r, y + r), fill=col)

for offset, col, width in [(0, (255, 205, 37, 190), 10), (18, (0, 194, 255, 150), 8), (34, (120, 224, 184, 150), 8)]:
    points = []
    for i in range(0, 470, 8):
        x = sc(540 + i)
        y = sc(355 + offset + math.sin(i / 46) * 30)
        points.append((x, y))
    d.line(points, fill=col, width=sc(width), joint="curve")

canvas.alpha_composite(decor)

shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle((sc(74), sc(58), sc(402), sc(386)), radius=sc(72), fill=(25, 24, 18, 54))
canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(sc(24))))

icon = Image.open(ICON).convert("RGBA").resize((sc(300), sc(300)), Image.Resampling.LANCZOS)
icon_mask = rounded_mask(icon.size, sc(68))
canvas.paste(icon, (sc(88), sc(72)), icon_mask)

draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((sc(675), sc(62), sc(940), sc(116)), radius=sc(27), fill=(10, 10, 10, 222))
draw.text((sc(707), sc(75)), "오늘도 0원으로", font=font(25), fill=(212, 255, 0, 255))

text_with_shadow(draw, (455, 135), "0원의품격", font(68), (10, 10, 10, 255))
text_with_shadow(draw, (458, 218), "무료 문화생활을", font(42), (10, 10, 10, 235))
text_with_shadow(draw, (458, 270), "가까이에서 발견하세요", font(42), (10, 10, 10, 235))

x = 458
x += draw_chip(draw, (x, 348), "예술", (255, 255, 255, 235), (10, 10, 10, 245))
x += draw_chip(draw, (x, 348), "전시", (212, 255, 0, 245), (10, 10, 10, 245))
x += draw_chip(draw, (x, 348), "공연", (110, 63, 255, 235), (255, 255, 255, 255))
x += draw_chip(draw, (x, 348), "행사", (255, 61, 139, 225), (255, 255, 255, 255))

draw.rounded_rectangle((sc(455), sc(414), sc(782), sc(456)), radius=sc(21), fill=(255, 255, 255, 178))
draw.text((sc(480), sc(423)), "지도에서 찾고 저장하고 후기까지", font=font(22), fill=(61, 61, 61, 255))

canvas = canvas.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
canvas.save(OUT, quality=95)
print(OUT)
