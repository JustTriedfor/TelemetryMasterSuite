"""Makes the pictures of version 1.4 for README.md (docs/images/v14-*.png).

They are the generated dash drawn by build/preview.js from a simulated Assetto Corsa Competizione lap (the numbers are made up, the layout, colours,
wording and flashing states are what the dash really draws), not recordings of a real session. Each picture is taken on a frame where every flash phase is on.

Needs: Node, Microsoft Edge (headless screenshots), Pillow, and a built dash.   node build/build_dash.js  then  python tools/readme_pictures.py
"""
import os
import re
import subprocess
import sys
import tempfile
import time

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'images')
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
FONT = r'C:\Windows\Fonts\bahnschrift.ttf'
TMP = tempfile.mkdtemp(prefix='tms_pictures_')
CACHE = {}


def preview(game, target, scenario, page):
    """Runs build/preview.js and returns the path of the HTML it wrote."""
    out = subprocess.run(['node', os.path.join(ROOT, 'build', 'preview.js'), game, str(target), scenario, str(page)],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return re.search(r'preview written (.+?) items', out).group(1)


def shot(target, scenario='', page=1, game='acc'):
    """A 1920 x 1080 picture of one page of the dash at `target` seconds of the simulated lap (preview time; the lap itself is 8 s further on)."""
    key = (game, target, scenario, page)
    if key in CACHE:
        return CACHE[key].copy()
    html = preview(game, target, scenario, page)
    png = os.path.join(TMP, 'shot_%d.png' % len(CACHE))
    for attempt in range(6):       # headless Edge sometimes writes nothing: try again with a fresh profile
        if os.path.exists(png):
            os.remove(png)
        try:
            subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080',
                            '--user-data-dir=' + os.path.join(TMP, 'profile_%d_%d' % (len(CACHE), attempt)), '--screenshot=' + png,
                            'file:///' + html.replace('\\', '/')], timeout=90, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.TimeoutExpired:
            pass
        for _ in range(60):       # Edge may hand the work to another process: wait for the file to appear and stop growing
            if os.path.exists(png) and os.path.getsize(png) > 0:
                time.sleep(0.5)
                break
            time.sleep(0.5)
        if os.path.exists(png) and os.path.getsize(png) > 0:
            break
    else:
        sys.exit('no screenshot for %s' % (key,))
    img = Image.open(png).convert('RGB')
    CACHE[key] = img
    return img.copy()


def crop(img, box):
    return img.crop(box)


def caption(img, text, size=30):
    """The picture under a caption bar (the text wraps to the width of the picture)."""
    font = ImageFont.truetype(FONT, size)
    lines, line = [], ''
    for word in text.split(' '):
        trial = (line + ' ' + word).strip()
        if font.getlength(trial) <= img.width - 28 or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    bar = Image.new('RGB', (img.width, len(lines) * (size + 6) + 14), (27, 27, 32))
    for k, ln in enumerate(lines):
        ImageDraw.Draw(bar).text((14, 7 + k * (size + 6)), ln, font=font, fill=(246, 246, 241))
    out = Image.new('RGB', (img.width, img.height + bar.height), (8, 8, 10))
    out.paste(bar, (0, 0))
    out.paste(img, (0, bar.height))
    return out


def pad(img, width):
    """The picture on a wider canvas (so a caption under it has room)."""
    out = Image.new('RGB', (max(width, img.width), img.height), (8, 8, 10))
    out.paste(img, (0, 0))
    return out


def stack(parts, gap=12):
    w = max(p.width for p in parts)
    out = Image.new('RGB', (w, sum(p.height for p in parts) + gap * (len(parts) - 1)), (8, 8, 10))
    y = 0
    for p in parts:
        out.paste(p, (0, y))
        y += p.height + gap
    return out


def row(parts, gap=12):
    h = max(p.height for p in parts)
    out = Image.new('RGB', (sum(p.width for p in parts) + gap * (len(parts) - 1), h), (8, 8, 10))
    x = 0
    for p in parts:
        out.paste(p, (x, 0))
        x += p.width + gap
    return out


def save(img, name, width=None):
    if width and img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print('%-26s %4d x %-4d %4d KB' % (name, img.width, img.height, os.path.getsize(path) // 1024))


def main():
    os.makedirs(OUT, exist_ok=True)
    # the three pages (page 1 in an oversteer slide, page 2 mid corner, page 3 after the lock-up and the slide)
    save(shot(17.5, '', 1), 'v14-balance.png', 1500)
    save(shot(20.5, '', 2), 'v14-tyres.png', 1500)
    save(shot(22.5, '', 3), 'v14-brakes.png', 1500)

    # the alert lane: one word with its value on a block in the colour of its kind
    top = (400, 0, 1520, 112)       # the alert block only
    top_chip = (400, 0, 1520, 200)       # the alert block and the flag lane under it
    save(stack([
        caption(crop(shot(10.5, '', 1), top), 'LOCK-UP FL: a wheel locked under braking (3 s)'),
        caption(crop(shot(17.5, '', 1), top), 'SLIDE 11: the body slip angle was 6 degrees or more for 0.2 s; the word carries the peak (3 s)'),
        caption(crop(shot(5, 'alert', 1), top_chip), 'OIL 131 (flashes for 3 s, then stays), with a yellow flag that has already shrunk to a chip'),
        caption(crop(shot(5, 'hot', 1), top), 'Several alerts take turns every 2 s: TYRE HOT FL, PRESS HIGH FR, BRAKES 830'),
    ]), 'v14-alerts.png')

    # the flag lane: a shape and a word in the flag's own colour, full width because red takes the whole top and black lights the left edge
    band = (0, 0, 1920, 215)
    save(stack([
        caption(crop(shot(6, 'flag:Yellow', 1), band), 'YELLOW: two quick flashes, steady for 4 s'),
        caption(crop(shot(6, 'flag:Yellow:6', 1), band), 'YELLOW after 4 s: a small chip (the block comes back for 2 s every 10 s)'),
        caption(crop(shot(6, 'flag:Blue', 1), band), 'BLUE: LET PASS, 4 s, then a chip'),
        caption(crop(shot(6, 'flag:Black', 1), band), 'BLACK FLAG: PIT, flashing for 6 s together with a bar down the left edge, then steady'),
        caption(crop(shot(6, 'flag:Red', 1), band), 'RED: STOP takes the whole top and hides the alert (a flashing plate for 6 s, then an outline)'),
        caption(crop(shot(6, 'flag:Checkered', 1), band), 'CHEQUERED: 6 s'),
        caption(crop(shot(6, 'flag:White', 1), band), 'WHITE: SLOW CAR, 3 s'),
    ]), 'v14-flags.png', 1500)

    # the balance indicator is always live: oversteer, understeer and neutral
    hero = (430, 205, 1490, 612)
    save(stack([
        caption(crop(shot(17.5, '', 1), hero), 'OVERSTEER, 5 degrees out: the plate and the active cell flash, and a slide puts a red frame round beta'),
        caption(crop(shot(24, '', 1), hero), 'UNDERSTEER, under 2 degrees out: a steady plate, a blue cell, the pointer under it'),
        caption(crop(shot(26.5, '', 1), hero), 'NEUTRAL on a straight: green, no plate. The indicator is always there above 20 km/h'),
    ]), 'v14-balance-states.png')

    # the g-meter with the heading (white) and trajectory (yellow, beta times 3) arrows
    meter = (24, 216, 424, 704)
    save(row([
        caption(crop(shot(17.5, '', 1), meter), 'In a slide (beta 11): the yellow trajectory arrow leans', 24),
        caption(crop(shot(26.5, '', 1), meter), 'On a straight: heading and trajectory agree', 24),
    ]), 'v14-gmeter.png')

    # critical states flash a plate: a hot tyre, a high pressure, a hot disc, a bottoming
    p2 = shot(17.5, 'hot', 2)
    p3 = shot(17.5, 'hot', 3)
    save(stack([
        row([caption(crop(p2, (24, 216, 624, 626)), 'Core over 105: a flashing red plate', 24), caption(crop(p2, (1296, 216, 1896, 626)), 'Pressure 1.7 psi over: a flashing red plate', 24)]),
        row([caption(crop(p3, (628, 216, 958, 516)), 'Disc over 750: a flashing plate', 24), caption(pad(crop(p2, (640, 230, 745, 520)), 300), 'Bottoming: the bar goes red, a flashing plate counts it', 24)]),
    ]), 'v14-critical.png')


if __name__ == '__main__':
    main()
