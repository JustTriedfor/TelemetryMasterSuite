"""Make the steering-wheel image square so it can rotate without being re-fitted to a wide box.

wheel_moza.png is 900x500; rotating a wide image inside a wide box looked stretched in SimHub, so the dash now uses a square canvas
(side = the wheel's diagonal, so no rotation can clip it) with the wheel centred, at half resolution (it is drawn ~92 px wide).
Run from the project root:  python tools/make_wheel_sq.py   (Pillow). Output: dash/assets/wheel_sq.png"""
import math
from PIL import Image

src = Image.open('dash/assets/wheel_moza.png').convert('RGBA')
half = src.resize((src.width // 2, src.height // 2), Image.LANCZOS)
side = int(math.ceil(math.hypot(half.width, half.height))) + 2
side += side % 2                                   # even, so the centre is a whole pixel
out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
out.alpha_composite(half, ((side - half.width) // 2, (side - half.height) // 2))
out.save('dash/assets/wheel_sq.png', optimize=True)
print('wheel_sq', out.size, 'wheel inside', half.size, 'ratio wheel/canvas width %.4f' % (half.width / side))
