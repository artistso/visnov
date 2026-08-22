#!/usr/bin/env python3
"""MELANCHOLY FALLS art pipeline.
1. Chroma-keys raw sprite renders (magenta -> alpha), autocrops, resizes.
2. Cover-crops backgrounds to 1920x1080.
3. Builds 'rehearsal stand-in' cue-card sprites for any character with no
   raw art yet, so the game is always fully playable.
Drop final art into assets/raw/ with the same filename and re-run:
   python3 tools/prep_art.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = os.path.join(ROOT, 'assets', 'img')
os.makedirs(OUT, exist_ok=True)

CHARS = {
    'spr_bram':    ('BRAM WELLINGTON', '#8fb573'),
    'spr_tuesday': ('TUESDAY WINTERS', '#7db3e8'),
    'spr_dex':     ('DEX LUXURY',      '#d9b36c'),
    'spr_junie':   ('JUNIE LAKE',      '#c1a3d4'),
    'spr_chad':    ('CHAD MORGAN',     '#a3b1bc'),
    'spr_brick':   ('BRICK STONE',     '#d97e6a'),
    'spr_ma':      ('MA WELLINGTON',   '#e0b06e'),
    'spr_pa':      ('PA WELLINGTON',   '#a9a06b'),
    'spr_grant':   ('PRINCIPAL GRANT', '#c98d8d'),
    'spr_nurse':   ('NURSE BARGAIN',   '#84b5ad'),
}

def chroma_key(img):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # magenta-ish: red+blue high, green clearly lower
            if r > 120 and b > 120 and g < min(r, b) - 40 and (r + b) / 2 - g > 45:
                px[x, y] = (r, g, b, 0)
            elif r > 90 and b > 90 and g < min(r, b) - 15:  # fringe: despill
                ng = int((r + g + b) / 3 * 0.5 + g * 0.5)
                px[x, y] = (int(r * 0.6), min(255, ng + 30), int(b * 0.85), a)
    return img

def trim_and_scale(img, max_h=1600):
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    if img.height > max_h:
        ratio = max_h / img.height
        img = img.resize((int(img.width * ratio), max_h), Image.LANCZOS)
    return img

def find_font(size, bold=True):
    cands = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
        '/Library/Fonts/Georgia.ttf',
        'C:/Windows/Fonts/arial.ttf',
    ]
    for c in cands:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

def stand_in(name, color):
    """Rehearsal stand-in: silhouette + cue card. Clearly temporary, thematically correct."""
    W, H = 760, 1500
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    col = ImageColor_get(color)
    dark = tuple(max(0, c - 70) for c in col)
    # silhouette
    d.ellipse([W//2-105, 90, W//2+105, 300], fill=col, outline=dark, width=8)          # head
    d.rounded_rectangle([W//2-185, 320, W//2+185, 1180], 90, fill=col, outline=dark, width=8)  # torso
    d.rounded_rectangle([W//2-260, 1180, W//2+260, 1480], 40, fill=dark)               # base shadow
    # cue card
    card = Image.new('RGBA', (620, 300), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([4, 4, 616, 296], 18, fill=(247, 241, 224, 255), outline=(38, 34, 28, 255), width=8)
    f1 = find_font(52); f2 = find_font(30, bold=False)
    w1 = d.textlength(name, font=f1)
    w2 = d.textlength('REHEARSAL STAND-IN', font=f2)
    cd.text(((620 - w1) / 2, 70), name, font=f1, fill=(38, 34, 28))
    cd.text(((620 - w2) / 2, 170), 'REHEARSAL STAND-IN', font=f2, fill=(110, 90, 60))
    cd.text((70, 225), 'final art goes here', font=f2, fill=(150, 130, 100))
    card = card.rotate(-2, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(card, (int(W/2 - card.width/2), 430))
    return img

def ImageColor_get(hexstr):
    h = hexstr.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# ---------- backgrounds: cover-crop to 1920x1080 ----------
bgs = [f for f in os.listdir(RAW) if f.startswith('bg_')]
for f in sorted(bgs):
    p = os.path.join(RAW, f)
    img = Image.open(p).convert('RGB')
    img = ImageOps.fit(img, (1920, 1080), Image.LANCZOS)
    img.save(os.path.join(OUT, f), optimize=True)
    print(f'bg  ✓ {f} -> {img.size}')

# ---------- logo ----------
logo = os.path.join(RAW, 'logo.png')
if os.path.exists(logo):
    img = Image.open(logo).convert('RGB')
    if img.width > 1600:
        img = img.resize((1600, int(img.height * 1600 / img.width)), Image.LANCZOS)
    img.save(os.path.join(OUT, 'logo.png'), optimize=True)
    print('logo ✓')

# ---------- sprites ----------
for fname, (name, color) in CHARS.items():
    rawp = os.path.join(RAW, fname + '.png')
    outp = os.path.join(OUT, fname + '.png')
    if os.path.exists(rawp):
        img = trim_and_scale(chroma_key(Image.open(rawp)))
        img.save(outp)
        print(f'spr ✓ {fname} (keyed from raw) -> {img.size}')
    elif not os.path.exists(outp):
        stand_in(name, color).save(outp)
        print(f'spr ◦ {fname} (stand-in cue card)')

print('done.')
