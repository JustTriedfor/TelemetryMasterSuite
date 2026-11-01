"""Crop the MOZA wheel (already transparent) and add a thin light rim so the black wheel stays visible on the dark dash.
Run: python tools/cut_wheel.py   (Pillow + numpy). Output: mock/assets/wheel_moza.png"""
import numpy as np
from PIL import Image, ImageFilter

SRC = 'mock/assets/wheel_src.webp'
OUT = 'mock/assets/wheel_moza.png'
im = Image.open(SRC).convert('RGBA')
a = np.asarray(im)
alpha = a[..., 3]
ys, xs = np.where(alpha > 24)
box = (max(xs.min() - 14, 0), max(ys.min() - 14, 0), min(xs.max() + 15, im.width), min(ys.max() + 15, im.height))
im = im.crop(box)
w, h = im.size
# work at 900 px wide: plenty for a widget that shows it ~100 px wide, and light for the dash
s = 900.0 / w
im = im.resize((900, int(round(h * s))), Image.LANCZOS)

alpha = im.getchannel('A')
# rim: dilate the silhouette by ~7 px, keep only the new ring, paint it light grey (also lights the edges of the two grip holes)
dil = alpha.filter(ImageFilter.MaxFilter(15))
dil_a = np.asarray(dil).astype(np.int32)
a_a = np.asarray(alpha).astype(np.int32)
ring = np.clip(dil_a - a_a, 0, 255)
ring = (ring * 0.75).astype(np.uint8)
rim = np.zeros(ring.shape + (4,), np.uint8)
rim[..., 0], rim[..., 1], rim[..., 2] = 150, 158, 176
rim[..., 3] = ring
out = Image.fromarray(rim, 'RGBA')
out.alpha_composite(im)          # the wheel on top of its rim
out.save(OUT)
print('wheel size', out.size, 'source box', box)
# quick check on the dashboard background
bg = Image.new('RGBA', (out.width + 40, out.height + 40), (15, 15, 18, 255))
bg.alpha_composite(out, (20, 20))
bg.convert('RGB').save('mock/assets/wheel_check.png')
