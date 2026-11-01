"""Cut the four car views out of the line-art sheet and make light-on-transparent PNGs.
Run with: python tools/cut_cars.py   (needs Pillow + numpy). Windows were measured on the 1600x2000 sheet;
they deliberately exclude the 'FIG. n' labels and the partially cropped drawing at the top of the sheet."""
import numpy as np
from PIL import Image

SRC = 'mock/assets/car_sheet.webp'
OUT = 'mock/assets/'
im = Image.open(SRC).convert('RGBA')
a = np.asarray(im).astype(np.float32)
# white-ish background -> 0 ink; dark lines -> 1 ink (respect any existing transparency)
gray = a[..., :3].mean(axis=2)
ink = (255.0 - gray) / 255.0
ink = ink * (a[..., 3] / 255.0)

# (name, x0, y0, x1, y1, optional mask function to drop overlapping pieces)
def side_mask(h, w, x0, y0):
    m = np.ones((h, w), bool)
    yy, xx = np.mgrid[0:h, 0:w]
    X, Y = xx + x0, yy + y0
    # the cropped drawing above the sheet overlaps the front of the side view: keep only where it cannot be that piece
    m &= (X >= 835) | (Y >= 485)
    return m

views = [
    ('top',   180,  600,  545, 1385, None),
    ('side',  630,  420, 1410,  668, side_mask),
    ('rear',  590,  700, 1075, 1008, None),
    ('front', 940, 1050, 1410, 1375, None),
]

THRESH = 0.18
for name, x0, y0, x1, y1, mfn in views:
    crop = ink[y0:y1, x0:x1].copy()
    if mfn is not None:
        crop *= mfn(crop.shape[0], crop.shape[1], x0, y0)
    ys, xs = np.where(crop > THRESH)
    if len(xs) == 0:
        raise SystemExit('empty window for ' + name)
    # tight box with a small margin
    bx0, bx1, by0, by1 = max(xs.min() - 4, 0), min(xs.max() + 5, crop.shape[1]), max(ys.min() - 4, 0), min(ys.max() + 5, crop.shape[0])
    t = crop[by0:by1, bx0:bx1]
    alpha = np.clip(t * 1.5, 0, 1)          # boost thin lines a little for a dark background
    rgba = np.zeros(t.shape + (4,), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 222, 229, 244
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    out.save(OUT + 'car_' + name + '.png')
    print(name, 'sheet box', (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1), 'size', out.size)

# contact sheet on the dashboard background for a visual check
bg = Image.new('RGBA', (1500, 900), (18, 18, 21, 255))
x = 20
for name in ['top', 'side', 'rear', 'front']:
    p = Image.open(OUT + 'car_' + name + '.png')
    s = min(1.0, 420.0 / max(p.size))
    p2 = p.resize((max(1, int(p.size[0] * s)), max(1, int(p.size[1] * s))), Image.LANCZOS)
    bg.alpha_composite(p2, (x, 20 if name != 'top' else 20))
    x += p2.size[0] + 30
bg.convert('RGB').save(OUT + 'contact_sheet.png')
print('contact sheet written')
