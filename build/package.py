"""Package every variant listed in build/variants.json into dash/out/<name>.simhubdash (zip, backslash entry names like SimHub's own).
Run after build/build_dash.js:  python build/package.py"""
import io, json, os, time, zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, 'template_extracted', 'test')
BS = chr(92)   # backslash
# Entry times are the build time, not a constant: SimHub caches each dash definition by the file's modified time, so a package whose files all
# carry the same fixed time looks unchanged after a re-import and SimHub keeps serving the old definition (blank dash, seen 2026-11-02).
STAMP = time.localtime()[:6]


def read(p):
    with open(p, 'rb') as f:
        return f.read()


def put(z, name, data):
    # SimHub's own packages use backslash separators in the entry name; ZipInfo would rewrite them to '/', so set it afterwards
    zi = zipfile.ZipInfo('x', date_time=STAMP)
    zi.filename = name
    zi.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(zi, data)


def preview():
    shot = os.path.join(ROOT, 'mock', 'shots', 'v3_acc_slide.png')
    im = Image.open(shot).convert('RGB').crop((0, 0, 1920, 1080)).resize((640, 360), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return b.getvalue()


png = preview()
tpl_png = read(os.path.join(TPL, 'test.djson.png'))
tpl_png00 = read(os.path.join(TPL, 'test.djson.00.png'))
variants = json.load(open(os.path.join(ROOT, 'build', 'variants.json')))
for v in variants:
    name = v['name']
    d = os.path.join(ROOT, 'dash', 'out', name)
    target = os.path.join(ROOT, 'dash', 'out', name + '.simhubdash')
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
        put(z, name + BS + name + '.djson', read(os.path.join(d, name + '.djson')))
        # the ladder's first rungs reuse the template's own tiny previews; the full dash gets a real thumbnail
        put(z, name + BS + name + '.djson.png', png if v['ext'] else tpl_png)
        put(z, name + BS + name + '.djson.00.png', png if v['ext'] else tpl_png00)
        put(z, name + BS + name + '.djson.carclasses', read(os.path.join(TPL, 'test.djson.carclasses')))
        put(z, name + BS + name + '.djson.metadata', read(os.path.join(d, name + '.djson.metadata')))
        if v['images']:
            res = io.BytesIO()
            with zipfile.ZipFile(res, 'w', zipfile.ZIP_DEFLATED) as rz:
                for n in v['images']:
                    rz.writestr(n + '.png', read(os.path.join(ROOT, 'dash', 'assets', n + '.png')))
            put(z, name + BS + name + '.djson.ressources', res.getvalue())
        if v['ext']:
            for js in ['lib/physics.js', 'lib/adapters.js', 'dash/js/tms_dash.js']:
                put(z, name + BS + 'JavascriptExtensions' + BS + os.path.basename(js), read(os.path.join(ROOT, js)))
        else:
            put(z, name + BS + 'JavascriptExtensions' + BS + 'sample.js', read(os.path.join(TPL, 'JavascriptExtensions', 'sample.js')))
    print(name.ljust(22), os.path.getsize(target), 'bytes |', v['items'], 'items |', v['what'])
