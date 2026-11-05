// Builds the SimHub dash: three pages (balance, tyres and car, brakes), a pop-up system (alerts, flags) and a pager, 1920 x 1080.
// Run: node build/build_dash.js      Output: dash/out/<name from build/dash_name.js>/*  (then build/package.py zips it)
// The layout follows docs/notes/DESIGN_1_4.md: a side panel for detailed telemetry next to a main dash and a DDU, read in half a second in bright sun from 75 cm.
// Rules the design lives by: everything read live is 40 px or bigger (labels 32 px), strokes are 6 px or more. Colour tells the eye which cluster and which signal it is looking at (one colour per signal, one per tyre,
// one per cluster, heat colours on temperatures), but in bright sun every colour but white and yellow loses most of its contrast, so a state is always also a plate (an inverted block), a glyph, a position, a size or
// flashing (critical states flash their plate). Every live element is a JavaScript formula calling dash/js/tms_dash.js.
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var I = require('./items.js');
var NAME = require('./dash_name.js');
var root = path.join(__dirname, '..');

// ---------- colours, sizes ----------
var WHITE = '#F6F6F1', YEL = '#F3FF3D', INK = '#08080A', PANEL = '#121215', MUTED = '#26262B', GREY = '#4A4A52';
// state, signal and cluster colours (the library has the same ones in TMS_SC): ok green is also the throttle, bad red also the brake, steer pale blue, cold blue, violet suspension, pink corners, cyan g forces; the tyres FL cyan, FR mint, RL pink, RR sand
var C = { ok: '#3DF08F', warn: '#FFA31F', bad: '#FF4D5E', cold: '#5DB3FF', viol: '#B66DFF', pink: '#FF7EDC', cyan: '#3DDCFF', mint: '#7DFFC4', sand: '#FFD27A', steer: '#8FD3FF', blue: '#4F9BFF' }, TY = [C.cyan, C.mint, C.pink, C.sand];
var report = { live: 0, static: 0, charts: 0 };

// ---------- the longest value of each text key, for the width check in test/dash_build.test.js (characters of the widest plausible value) ----------
var MAXCH = { alertWord: 'TYRE HOT FL', flagWord: 'WHITE: SLOW CAR', flagChipWord: '○ WHITE', balVerdict: 'UNDERSTEER', balDelta: '+9.9°', balPhaseWord: 'ENTRY', balEst: 'EST', betaShow: '99.9°', bandName: 'TRANSITION',
  bandGlyph: '▲', slipAbsText: '99.9°', cnNum: 'T99', cnChip: 'ENTRY US 9.9', loadSplitFR: 'F 99 · R 99', loadSplitLR: 'L 99 · R 99', steerText: 'L 999°', coreNum: '999°', coreGlyph: '▲',
  pressNum: '-9.9', pressGlyph: '▲', treadIText: '999°', treadMText: '999°', treadOText: '999°', spreadNum: '+99', spreadGlyph: '▲', travelText: '999 mm', bumpText: 'x99', gPeaksText: 'LAT 9.99   BRK 9.99   ACC 9.99',
  bzRow: '>T9 999>999 99% 9.9g A9 LOCK', cnRow2: 'T99  999  9.99g  US  OS  US', discText: '999°', discGlyph: '▲', discStateWord: 'COLD', discPeakText: 'PK 999', discMinText: 'MIN 999', discMeanText: 'FRONT 999   REAR 999 °C',
  lastLockText: 'LAST LOCK  T99 FL 999', lastSlideText: 'LAST SLIDE  T99  99.9°', ggMag: '9.99 g', lockTile: 'FL 99', evRowN: 'T99  BOTTOM RR  999', perf: 'PERF  v1.4  PRIVATE  pass 999/s  slow 99.9/s  hidden 99.9/s' };

// ---------- drawing helpers: every one appends to a page list L ----------
function key(k, i) { return "tms2('" + k + "', root, " + (i === undefined ? 0 : i) + ")"; }
function bindText(it, k, i) { I.bind(it, 'Text', "var v = " + key(k, i) + "; return (v === null || v === undefined) ? '--' : v;"); report.live++; }
function bindProp(it, prop, expr) { I.bind(it, prop, expr); report.live++; }
function vis(it, k, i) { bindProp(it, 'Visible', 'return ' + key(k, i) + ';'); return it; }
function rect(L, x, y, w, h, color, o) { var it = I.rect(x, y, w, h, color); if (o && o.vis) { vis(it, o.vis, o.i); } L.push(it); report.static++; return it; }
// a hollow rectangle: four strips, so the inside stays whatever is under it
function frame(L, x, y, w, h, st, color, o) {
  rect(L, x, y, w, st, color, o); rect(L, x, y + h - st, w, st, color, o); rect(L, x, y + st, st, h - 2 * st, color, o); rect(L, x + w - st, y + st, st, h - 2 * st, color, o);
}
function label(L, x, y, w, h, fs, str, o) {         // static text; o: { color, ha }
  o = o || {}; var it = I.text(x, y, w, h, str, { fs: fs, fw: 'Bold', color: o.color || WHITE, ha: o.ha || 0, va: 1 }); L.push(it); report.static++; return it;
}
function live(L, x, y, w, h, fs, k, i, o) {         // live text; o: { color, ha, ink (key of a colour formula), vis (key of a visibility formula) }
  o = o || {}; var it = I.text(x, y, w, h, '--', { fs: fs, fw: 'Bold', color: o.color || WHITE, ha: o.ha || 0, va: 1 });
  bindText(it, k, i); if (o.ink) { bindProp(it, 'TextColor', 'return ' + key(o.ink, o.inkI === undefined ? i : o.inkI) + ';'); } if (o.vis) { vis(it, o.vis, o.visI === undefined ? i : o.visI); }
  L.push(it); return it;
}
// a bar that fills from the left, a bar that fills from the bottom: a full white bar with a cover over the empty part (one formula: the cover's width or height)
function barRight(L, x, y, w, h, k, i, bg, color, colKey) {
  var full = rect(L, x, y, w, h, color || WHITE), c; if (colKey) { bindProp(full, 'BackgroundColor', 'return ' + key(colKey, i) + ';'); }
  c = I.rect(x, y, 0, h, bg); bindProp(c, 'Width', 'return Math.round((1 - tms2(\'' + k + '\', root, ' + i + ')) * ' + w + ');'); c.Left = x + w; L.push(c);
  bindProp(c, 'Left', 'return ' + (x + w) + ' - Math.round((1 - tms2(\'' + k + '\', root, ' + i + ')) * ' + w + ');'); return c;
}
function barUp(L, x, y, w, h, k, i, bg, color, colKey) {
  var full = rect(L, x, y, w, h, color || WHITE), c; if (colKey) { bindProp(full, 'BackgroundColor', 'return ' + key(colKey, i) + ';'); }
  c = I.rect(x, y, w, 0, bg); bindProp(c, 'Height', 'return Math.round((1 - tms2(\'' + k + '\', root, ' + i + ')) * ' + h + ');'); L.push(c); return c;
}
function tickAt(L, x, y, w, h, k, i, color) {         // a 6 px mark at a live fraction (0 = bottom) of a vertical range y .. y + h
  var t = I.rect(x, y + h, w, 6, color || WHITE); bindProp(t, 'Top', 'return ' + (y + h) + ' - Math.round(tms2(\'' + k + '\', root, ' + i + ') * ' + h + ') - 3;'); L.push(t); return t;
}
function chartLane(L, x, y, w, h, k, o) {         // a trace in the box x y w h (the chart draws inside a 10 px margin of its item)
  var ch = I.chart(x - 10, y - 10, w + 20, h + 20, { min: o.min, max: o.max, points: 80, color: o.color || WHITE, thick: o.thick || 6 }, 'trace_' + k);
  I.bind(ch, 'CurrentValue', 'return ' + key(k, 0) + ';'); ch.MinimumRefreshIntervalMS = 100; report.charts++; report.live++; L.push(ch); return ch;
}
function ring(L, x, y, d, st, color, fill) { var e = I.base('EllipseItem', 'Ring', x, y, d, d, { FillColor: I.argb(fill || '#00000000'), EllipseColor: I.argb(color), EllipseThickness: st }); L.push(e); report.static++; return e; }

// ---------- colour helpers ----------
// a plate: a rectangle that shows when the state says so (st_<kind>_vis) in the state's colour (st_<kind>_col); the text on it asks st_<kind>_ink for dark ink on the plate and the state colour off it
function plate(L, x, y, w, h, kind, i) { var it = rect(L, x, y, w, h, WHITE, { vis: 'st_' + kind + '_vis', i: i }); bindProp(it, 'BackgroundColor', 'return ' + key('st_' + kind + '_col', i) + ';'); return it; }
function tinted(it, k, i) { bindProp(it, 'TextColor', 'return ' + key(k, i) + ';'); return it; }
function mixHex(a, b, t) { var q, o = '#', x, y; for (q = 1; q < 7; q += 2) { x = parseInt(a.substr(q, 2), 16); y = parseInt(b.substr(q, 2), 16); o += ('0' + Math.round(x + (y - x) * t).toString(16)).slice(-2); } return o.toUpperCase(); }
function tint(acc, t) { return mixHex(PANEL, acc, t); }       // a panel with a hint of its cluster's colour
// a cluster: a panel with a hint of its colour and a bar of the full colour down its left edge
function cluster(L, x, y, w, h, acc, bar) { var bg = tint(acc, 0.09); rect(L, x, y, w, h, bg); rect(L, x, y, bar || 8, h, acc); return bg; }

// ---------- the pager and the page name (top right) ----------
function pager(L, pi, name) {
  var k, x;
  label(L, 1496, 14, 300, 44, 32, name, { color: YEL, ha: 2 });
  for (k = 0; k < 3; k++) { x = 1816 + k * 32; if (k === pi) { rect(L, x, 26, 24, 24, YEL); } else { frame(L, x, 26, 24, 24, 6, WHITE); } }
}

// ---------- the pop-up lanes: lane A (alert, a solid block in the colour of the alert), lane B (flag, an outlined block in the colour of the flag, chip), the red lane, the black edge bar. Drawn last, on top of the page ----------
function popups(L) {
  var a, fb;
  a = rect(L, 440, 10, 1040, 88, WHITE, { vis: 'alertVis' }); bindProp(a, 'BackgroundColor', 'return ' + key('st_alert_col') + ';'); live(L, 440, 10, 1040, 88, 72, 'alertWord', 0, { ha: 1, color: INK, vis: 'alertVis', visI: 0 });      // centred on the panel, and clear of the page name at the top right
  fb = rect(L, 574, 110, 772, 92, WHITE, { vis: 'flagBlockVis' }); bindProp(fb, 'BackgroundColor', 'return ' + key('st_flag_col') + ';'); rect(L, 582, 118, 756, 76, INK, { vis: 'flagBlockVis' });      // lane B: an outlined block with the flag's shape and word
  [0, 1, 2, 4, 5, 6].forEach(function (i) {
    var o = { vis: 'flagShape', i: i }, t;
    if (i === 0) { t = label(L, 582, 112, 96, 96, 84, '▲', { color: YEL, ha: 1 }); vis(t, 'flagShape', 0); }
    if (i === 1) { t = label(L, 582, 112, 96, 96, 96, '»', { color: C.blue, ha: 1 }); vis(t, 'flagShape', 1); }
    if (i === 2) { rect(L, 590, 122, 72, 72, WHITE, o); rect(L, 600, 132, 52, 52, '#000000', o); }
    if (i === 4) { t = label(L, 582, 112, 96, 96, 84, '▦', { ha: 1 }); vis(t, 'flagShape', 4); }
    if (i === 5) { t = ring(L, 594, 124, 70, 10, WHITE); vis(t, 'flagShape', 5); }
    if (i === 6) { t = ring(L, 600, 130, 58, 29, C.ok, C.ok); vis(t, 'flagShape', 6); }
  });
  live(L, 700, 112, 640, 88, 70, 'flagWord', 0, { vis: 'flagBlockVis', visI: 0, ink: 'st_flag_col' });
  fb = rect(L, 780, 124, 360, 64, WHITE, { vis: 'flagChipVis' }); bindProp(fb, 'BackgroundColor', 'return ' + key('st_flag_col') + ';'); rect(L, 786, 130, 348, 52, INK, { vis: 'flagChipVis' });      // the chip: a flag that is still active, after its block
  live(L, 786, 124, 348, 64, 52, 'flagChipWord', 0, { ha: 1, vis: 'flagChipVis', visI: 0, ink: 'st_flag_col' });
  rect(L, 20, 8, 1880, 200, C.bad, { vis: 'redPlateVis' }); label(L, 20, 8, 1880, 200, 96, 'RED: STOP', { color: INK, ha: 1 }); vis(L[L.length - 1], 'redPlateVis');      // the red lane: a flashing red plate, then a white outline
  rect(L, 20, 8, 1880, 12, WHITE, { vis: 'redOutVis' }); rect(L, 20, 196, 1880, 12, WHITE, { vis: 'redOutVis' }); rect(L, 20, 20, 12, 176, WHITE, { vis: 'redOutVis' }); rect(L, 1888, 20, 12, 176, WHITE, { vis: 'redOutVis' });
  label(L, 20, 8, 1880, 200, 96, 'RED: STOP', { color: C.bad, ha: 1 }); vis(L[L.length - 1], 'redOutVis');
  rect(L, 0, 0, 120, 1080, WHITE, { vis: 'edgeBigVis' }); rect(L, 0, 0, 24, 1080, WHITE, { vis: 'edgeStripVis' });      // a black flag also lights the left edge
}

// ---------- page 1: balance ----------
function pageBalance(L) {
  var k, x, y, p = [[40, 232], [352, 232], [40, 424], [352, 424]], panel, cells = [C.bad, C.bad, C.warn, C.warn, C.ok, C.cold, C.cold, C.viol, C.viol];
  // the car and the load on each tyre (blue cluster): a bar in the tyre's colour from the bottom scaled to that tyre's own peak, a mark at its average, two weight-split numbers
  panel = cluster(L, 24, 216, 400, 488, C.cold);
  // the g-meter between the load bars: the 1.5 g ring, the 1 g ring, a dot where the car's g is (left is left, accelerating is up) and the total g under it. The heading and trajectory arrows live in it:
  // both start at its centre, the white one (where the nose points) fixed pointing up, the yellow one (where the car is going) turned by beta times three, so the angle between them is beta
  label(L, 108, 256, 104, 36, 32, 'HEAD', { color: WHITE }); label(L, 214, 256, 134, 36, 32, 'TRAJ ×3', { color: YEL, ha: 2 });
  ring(L, 124, 313, 200, 6, C.cyan); ring(L, 157, 346, 134, 6, GREY); rect(L, 124, 411, 200, 4, GREY); rect(L, 222, 313, 4, 200, GREY);
  var tr = I.image('arrow_travel', 212, 323, 24, 180, 'arrow_travel'); bindProp(tr, 'Rotation', 'return ' + key('headRot') + ';'); L.push(tr); L.push(I.image('arrow_nose', 212, 353, 24, 60, 'arrow_nose'));
  var gd = I.base('EllipseItem', 'GGDotS', 210, 399, 28, 28, { FillColor: I.argb(C.cyan), EllipseColor: I.argb(WHITE), EllipseThickness: 4 });
  bindProp(gd, 'Left', 'return 210 + ' + key('ggSx') + ';'); bindProp(gd, 'Top', 'return 399 + ' + key('ggSy') + ';'); L.push(gd);
  live(L, 124, 522, 200, 56, 44, 'ggMag', 0, { ha: 1, color: C.cyan });
  for (k = 0; k < 4; k++) {
    x = p[k][0]; y = p[k][1]; frame(L, x, y, 56, 170, 6, TY[k]); barUp(L, x + 6, y + 6, 44, 158, 'loadFill', k, panel, TY[k]); tickAt(L, x - 8, y + 6, 72, 158, 'loadAvgPos', k);
  }
  live(L, 24, 608, 400, 44, 49, 'loadSplitFR', 0, { ha: 1 }); live(L, 24, 652, 400, 44, 49, 'loadSplitLR', 0, { ha: 1 });
  // the hero: beta in yellow (a number from 2 degrees, with an arrow for the way the tail swings), the grip state, the balance verdict
  label(L, 440, 222, 140, 40, 32, 'BETA', { color: YEL });
  live(L, 440, 232, 460, 104, 100, 'betaShow', 0, { ha: 2, color: YEL });
  vis(label(L, 930, 244, 130, 90, 80, '►', { ha: 1, color: YEL }), 'betaArrowR'); vis(label(L, 930, 244, 130, 90, 80, '◄', { ha: 1, color: YEL }), 'betaArrowL');
  live(L, 1070, 246, 80, 80, 60, 'bandGlyph', 0, { ha: 1, ink: 'st_band_col' });
  plate(L, 1160, 252, 320, 70, 'band', 0); live(L, 1168, 252, 308, 70, 60, 'bandName', 0, { ink: 'st_band_ink' });
  frame(L, 432, 212, 1056, 122, 6, C.bad, { vis: 'st_band_vis' });       // a slide: a red frame round the whole hero, flashing
  live(L, 440, 346, 150, 64, 40, 'balEst', 0, { color: YEL });
  plate(L, 596, 336, 528, 84, 'bal', 0); live(L, 612, 336, 390, 84, 72, 'balVerdict', 0, { ink: 'st_bal_ink' }); live(L, 1008, 346, 112, 64, 40, 'balPhaseWord', 0, { ha: 2, ink: 'st_bal_ink' });
  live(L, 1160, 336, 320, 84, 64, 'balDelta', 0, { ha: 2, ink: 'st_bal_col' });
  for (k = 0; k < 9; k++) { frame(L, 440 + 116 * k, 440, 108, 100, 6, cells[k]); }       // nine cells, oversteer (red, orange) on the left, understeer (blue, violet) on the right, one of them solid in its colour with a pointer under it
  var on = I.rect(440, 440, 108, 100, WHITE); bindProp(on, 'Left', 'return 440 + 116 * ' + key('balIdx') + ';'); bindProp(on, 'BackgroundColor', 'return ' + key('st_cell_col') + ';'); vis(on, 'balCellVis'); L.push(on);
  var pt = I.text(440, 542, 108, 60, '▲', { fs: 56, fw: 'Bold', color: WHITE, ha: 1, va: 1 }); bindProp(pt, 'Left', 'return 440 + 116 * ' + key('balIdx') + ';'); tinted(pt, 'st_cell_col'); vis(pt, 'balOn'); L.push(pt);
  rect(L, 958, 546, 6, 52, WHITE); label(L, 440, 404, 100, 36, 32, 'OS', { color: C.bad }); label(L, 1376, 404, 100, 36, 32, 'US', { ha: 2, color: C.cold });       // above the end cells: the pointer under an end cell would cover them
  // the last corner (pink cluster): its number and what the balance was in each phase of it
  live(L, 440, 622, 76, 64, 48, 'cnNum', 0, { color: C.pink });
  [520, 839, 1152].forEach(function (cx, q) { frame(L, cx, 620, 300, 64, 6, C.pink); plate(L, cx, 620, 300, 64, 'cn', q); live(L, cx, 620, 300, 64, 40, 'cnChip', q, { ha: 1, ink: 'st_cn_ink' }); });
  // the traces: beta, steering, brake, throttle on the same 8 s, each in its signal colour, the cause under the effect
  [[716, 84, 'BETA', 'beta', -6, 6, YEL, 6], [806, 84, 'STEER', 'steerUp', -1, 1, C.steer, 6], [896, 84, 'BRAKE', 'brk', 0, 1, C.bad, 8], [986, 80, 'THROT', 'thr', 0, 1, C.ok, 6]].forEach(function (ln) {
    rect(L, 164, ln[0], 650, ln[1], tint(ln[6], 0.07)); rect(L, 158, ln[0], 6, ln[1], ln[6]); label(L, 20, ln[0] + ln[1] / 2 - 20, 140, 40, 32, ln[2], { color: ln[6] });
    if (ln[4] < 0) { rect(L, 164, ln[0] + ln[1] / 2 - 2, 650, 4, GREY); }
    chartLane(L, 164, ln[0], 650, ln[1], ln[3], { min: ln[4], max: ln[5], color: ln[6], thick: ln[7] });
  });
  // the freed half of the trace area (red cluster): the last lock-up (a flashing plate for 3 s), the lock-ups this lap per wheel, the last slide with its peak angle and corner
  cluster(L, 826, 716, 654, 350, C.bad, 6); label(L, 840, 722, 600, 36, 32, 'LOCK-UPS THIS LAP', { color: C.bad });
  frame(L, 840, 764, 626, 76, 6, C.bad); plate(L, 840, 764, 626, 76, 'last', 0); live(L, 840, 764, 626, 76, 49, 'lastLockText', 0, { ha: 1, ink: 'st_last_ink' });
  for (k = 0; k < 4; k++) { x = 840 + 156 * k; frame(L, x, 854, 148, 84, 6, TY[k]); plate(L, x, 854, 148, 84, 'tile', k); live(L, x, 854, 148, 84, 48, 'lockTile', k, { ha: 1, ink: 'st_tile_ink' }); }
  frame(L, 840, 952, 626, 76, 6, C.warn); plate(L, 840, 952, 626, 76, 'lsl', 0); live(L, 840, 952, 626, 76, 49, 'lastSlideText', 0, { ha: 1, ink: 'st_lsl_ink' });
  // the slip angle of each tyre (in the tyre's colour) against a fixed 0 to 8 degree window with marks at 3 and 6: amber plate from 6, a flashing red plate from 8
  [[1496, 216, 0], [1700, 216, 1], [1496, 408, 2], [1700, 408, 3]].forEach(function (t) {
    var tx0 = t[0], ty = t[1], q = t[2];
    rect(L, tx0, ty, 196, 180, tint(TY[q], 0.09)); rect(L, tx0, ty, 8, 180, TY[q]); plate(L, tx0, ty, 196, 180, 'slip', q);
    tinted(label(L, tx0 + 16, ty + 8, 64, 50, 40, TMS_WHEEL[q], { color: WHITE }), 'st_slip_ink', q);
    live(L, tx0 + 76, ty + 8, 112, 50, 44, 'slipAbsText', q, { ha: 2, ink: 'st_slip_ink' });
    rect(L, tx0 + 18, ty + 95, 166, 50, MUTED);
    var f = I.rect(tx0 + 18, ty + 98, 4, 44, WHITE); bindProp(f, 'Width', 'return Math.max(4, ' + key('slipPx', q) + ');'); bindProp(f, 'BackgroundColor', 'return ' + key('st_slip_ink', q) + ';'); L.push(f);
    [3, 6].forEach(function (deg) { var m = I.rect(tx0 + 18 + deg * 20 - 3, ty + 84, 6, 72, WHITE); bindProp(m, 'BackgroundColor', 'return ' + key('st_slip_ink', q) + ';'); L.push(m); });
  });
  // the driver inputs: steering in its colour, brake red, throttle green, TC amber and ABS blue squares that flash while active
  live(L, 1500, 616, 230, 60, 49, 'steerText', 0, { color: C.steer });
  label(L, 1504, 698, 100, 56, 52, 'BRK', { ha: 1, color: C.bad }); label(L, 1636, 698, 100, 56, 52, 'THR', { ha: 1, color: C.ok });
  frame(L, 1504, 760, 100, 300, 6, C.bad); barUp(L, 1510, 766, 88, 288, 'brk', 0, INK, C.bad); frame(L, 1636, 760, 100, 300, 6, C.ok); barUp(L, 1642, 766, 88, 288, 'thr', 0, INK, C.ok);
  [[770, 'tcSolid', 'tcInk', 'TC', C.warn], [850, 'absSolid', 'absInk', 'ABS', C.cold]].forEach(function (q) {
    frame(L, 1772, q[0], 112, 64, 6, q[4]); rect(L, 1772, q[0], 112, 64, q[4], { vis: q[1] }); tinted(label(L, 1772, q[0], 112, 64, 40, q[3], { ha: 1 }), q[2]);
  });
}
var TMS_WHEEL = ['FL', 'FR', 'RL', 'RR'];

// ---------- page 2: tyres and car ----------
function pageTyres(L) {
  var cards = [[24, 216], [1296, 216], [24, 640], [1296, 640]], bars = [[660, 240], [1180, 240], [660, 640], [1180, 640]], i, x, y, card, g;
  for (i = 0; i < 4; i++) {
    x = cards[i][0]; y = cards[i][1];
    card = cluster(L, x, y, 600, 410, TY[i], 10); label(L, x + 22, y + 16, 70, 50, 40, TMS_WHEEL[i], { color: TY[i] });
    plate(L, x + 92, y + 16, 268, 104, 'core', i); live(L, x + 100, y + 16, 250, 104, 88, 'coreNum', i, { ink: 'st_core_ink' }); live(L, x + 390, y + 16, 90, 100, 84, 'coreGlyph', i, { ha: 1, ink: 'st_core_col' });
    frame(L, x + 16, y + 124, 568, 32, 6, WHITE); barRight(L, x + 22, y + 130, 556, 20, 'coreFrac', i, card, C.ok, 'st_core_col'); frame(L, x + 204, y + 112, 145, 56, 6, WHITE);      // core 60 to 120, window 80 to 95
    plate(L, x + 12, y + 186, 232, 72, 'press', i); live(L, x + 16, y + 188, 150, 72, 64, 'pressNum', i, { ink: 'st_press_ink' }); tinted(label(L, x + 160, y + 214, 70, 36, 32, 'psi', { color: YEL }), 'st_press_ink', i);
    live(L, x + 252, y + 194, 56, 64, 44, 'pressGlyph', i, { ha: 1, ink: 'st_press_col' });
    ['I', 'M', 'O'].forEach(function (zn, zi) {
      var yy = y + 262 + 44 * zi, kf = ['treadFI', 'treadFM', 'treadFO'][zi], kt = ['treadIText', 'treadMText', 'treadOText'][zi], kc = 'st_' + ['tri', 'trm', 'tro'][zi] + '_col';
      label(L, x + 22, yy - 4, 40, 40, 40, zn, { color: TY[i] }); frame(L, x + 63, yy, 354, 32, 6, WHITE); barRight(L, x + 69, yy + 6, 342, 20, kf, i, card, C.ok, kc); live(L, x + 430, yy - 4, 76, 40, 40, kt, i, { ink: kc });
    });
    frame(L, x + 180, y + 258, 120, 136, 6, WHITE);      // window 80 to 100 around all three (it starts where the pressure plate ends)
    plate(L, x + 488, y + 258, 104, 140, 'spread', i); live(L, x + 488, y + 262, 104, 60, 44, 'spreadGlyph', i, { ha: 1, ink: 'st_spread_ink' }); live(L, x + 488, y + 326, 104, 64, 64, 'spreadNum', i, { ha: 1, ink: 'st_spread_ink' });
  }
  // the suspension (violet): the frame in the tyre's colour, the fill violet, amber from 90% of the stroke and red from 95% (ACC), a flashing red plate when it bottoms
  for (i = 0; i < 4; i++) {
    x = bars[i][0]; y = bars[i][1]; frame(L, x, y, 80, 220, 6, TY[i]); barUp(L, x + 6, y + 6, 68, 208, 'travelFrac', i, INK, C.viol, 'st_trav_col'); rect(L, x - 8, y + 6 + 21, 96, 6, WHITE, { vis: 'travelStatic' }); tickAt(L, x, y + 6, 80, 208, 'travelPkFrac', i);
    live(L, i % 2 === 0 ? x + 92 : x - 176, y + 86, 164, 56, 48, 'travelText', i, { ha: i % 2 === 0 ? 0 : 2, color: TY[i] });
    plate(L, x, y + 228, 80, 44, 'bump', i); frame(L, x, y + 228, 80, 44, 6, C.bad, { vis: 'bumpNVis', i: i }); live(L, x, y + 228, 80, 44, 40, 'bumpText', i, { ha: 1, ink: 'st_bump_ink', vis: 'bumpNVis' });
  }
  g = cluster(L, 780, 392, 360, 320, C.cyan, 8);
  ring(L, 810, 400, 300, 6, C.cyan); ring(L, 860, 450, 200, 6, GREY); rect(L, 810, 547, 300, 6, GREY); rect(L, 957, 400, 6, 300, GREY);      // the g-g circle: 1.5 g outer, 1 g inner
  var dot = I.base('EllipseItem', 'GGDot', 940, 530, 40, 40, { FillColor: I.argb(YEL), EllipseColor: I.argb(WHITE), EllipseThickness: 6 });
  bindProp(dot, 'Left', 'return 940 + ' + key('ggDx') + ';'); bindProp(dot, 'Top', 'return 530 + ' + key('ggDy') + ';'); L.push(dot);
  label(L, 810, 898, 300, 36, 32, 'LAP PEAK g', { color: C.cyan, ha: 1 }); live(L, 660, 934, 600, 56, 40, 'gPeaksText', 0, { ha: 1 });
}

// ---------- page 3: brakes and review ----------
function pageBrakes(L) {
  var discs = [[628, 216], [964, 216], [628, 528], [964, 528]], tiles = [[1366, 724], [1606, 724], [1366, 868], [1606, 868]], i, x, y, card;
  cluster(L, 16, 218, 600, 380, C.bad, 6); label(L, 24, 226, 590, 36, 32, 'BRAKE ZONES   IN>MIN  PK  G  ABS  LOCK', { color: C.bad });
  for (i = 0; i < 5; i++) { plate(L, 24, 272 + 64 * i, 590, 56, 'bz', i); live(L, 32, 272 + 64 * i, 580, 56, 40, 'bzRow', i, { ink: 'st_bz_ink' }); }
  cluster(L, 16, 626, 600, 330, C.pink, 6); label(L, 24, 634, 590, 36, 32, 'CORNERS   MIN  LAT G  ENTRY MID EXIT', { color: C.pink });
  for (i = 0; i < 4; i++) { live(L, 32, 684 + 64 * i, 580, 56, 40, 'cnRow2', i); }
  for (i = 0; i < 4; i++) {
    x = discs[i][0]; y = discs[i][1];
    card = tint(TY[i], 0.07); rect(L, x, y, 330, 300, card); bindProp(rect(L, x, y, 10, 300, C.ok), 'BackgroundColor', 'return ' + key('st_disc_col', i) + ';');       // the strip is the disc's heat colour
    frame(L, x + 14, y + 16, 90, 268, 6, WHITE); barUp(L, x + 20, y + 22, 78, 256, 'discFrac', i, card, C.ok, 'st_disc_col'); frame(L, x + 8, y + 62, 102, 138, 6, WHITE);      // 0 to 900, window 300 to 750
    label(L, x + 120, y + 2, 80, 36, 32, TMS_WHEEL[i], { color: TY[i] });
    plate(L, x + 116, y + 40, 214, 80, 'disc', i); live(L, x + 124, y + 40, 200, 80, 72, 'discText', i, { ink: 'st_disc_ink' });
    live(L, x + 124, y + 124, 56, 56, 40, 'discGlyph', i, { ha: 1, ink: 'st_disc_col' }); live(L, x + 180, y + 124, 146, 56, 49, 'discStateWord', i, { ink: 'st_disc_col' });
    live(L, x + 124, y + 186, 200, 44, 40, 'discPeakText', i);
    plate(L, x + 116, y + 236, 208, 50, 'dmin', i); live(L, x + 124, y + 238, 196, 46, 40, 'discMinText', i, { ink: 'st_dmin_ink' });
    frame(L, x, y, 330, 300, 6, C.bad, { vis: 'lockFlash', i: i });
  }
  frame(L, 631, 860, 660, 70, 6, C.bad); plate(L, 631, 860, 660, 70, 'last', 0); live(L, 631, 860, 660, 70, 49, 'lastLockText', 0, { ha: 1, ink: 'st_last_ink' });
  live(L, 628, 944, 666, 52, 40, 'discMeanText', 0, { ha: 1 });
  cluster(L, 1308, 218, 592, 440, YEL, 6); label(L, 1316, 226, 300, 36, 32, 'EVENTS', { color: YEL });
  for (i = 0; i < 5; i++) { plate(L, 1316, 276 + 72 * i, 580, 62, 'ev', i); live(L, 1328, 276 + 72 * i, 560, 62, 44, 'evRowN', i, { ink: 'st_ev_ink' }); }
  cluster(L, 1308, 668, 592, 360, C.bad, 6); label(L, 1316, 676, 400, 36, 32, 'LOCK-UPS THIS LAP', { color: C.bad });
  for (i = 0; i < 4; i++) { x = tiles[i][0]; y = tiles[i][1]; frame(L, x, y, 220, 128, 6, TY[i]); plate(L, x, y, 220, 128, 'tile', i); live(L, x, y, 220, 128, 56, 'lockTile', i, { ha: 1, ink: 'st_tile_ink' }); }
}

// ---------- assemble the pages ----------
var PAGES = [{ name: 'Balance', build: pageBalance }, { name: 'Tyres and car', build: pageTyres }, { name: 'Brakes', build: pageBrakes }];
var pages = PAGES.map(function (pg, pi) {
  var L = [], pc, pf, ph;
  rect(L, 0, 0, 1920, 1080, INK);
  pg.build(L); pager(L, pi, pg.name.toUpperCase()); popups(L);
  pc = I.text(1898, 1062, 14, 14, '', { fs: 8, color: '#00000000' }, 'pump'); bindText(pc, 'pump', 0); L.push(pc);      // the pump: the per-frame step that keeps the detectors, the events and the lap totals running on every page
  pf = I.text(1316, 1067, 596, 12, '--', { fs: 10, fw: 'Normal', color: '#6C6C78', font: 'Consolas' }, 'perf'); bindText(pf, 'perf', 0); L.push(pf);       // the self-check line (tms_perf in dash/js/tms_dash.js)
  ph = I.text(1316, 1067, 10, 12, '--', { fs: 10, fw: 'Normal', color: '#6C6C78', font: 'Consolas' }, 'perfHid'); bindText(ph, 'perfHid', 0); ph.Visible = false; L.push(ph);       // hidden twin: counts how often SimHub runs a hidden item
  return { name: pg.name, items: L };
});
var ALL = [].concat.apply([], pages.map(function (pg) { return pg.items; }));
report.live = ALL.reduce(function (n, it) { return n + Object.keys(it.Bindings).length; }, 0);

// ---------- refresh intervals ----------
// SimHub runs an item's formulas at most once per MinimumRefreshIntervalMS (0 = every frame) and it costs about 25 us per formula even when the formula does nothing, so every value is grouped
// by how fast it can change. RenderingSkip is ms / 10, as SimHub saves it. ChartItems keep the interval they were drawn with: a chart draws one point per refresh, so the interval is its time axis.
var INTERVALS = {
  0: ['pump'],       // carries the shared per-frame step (tms_pump), so the detectors keep stepping once per frame on every page
  33: ['thr', 'brk', 'loadFill', 'loadAvgPos', 'travelFrac', 'travelPkFrac', 'ggDx', 'ggDy', 'ggSx', 'ggSy', 'headRot', 'tcSolid', 'tcInk', 'absSolid', 'absInk'],
  50: ['flagBlockVis', 'flagChipVis', 'flagShape', 'redPlateVis', 'redOutVis', 'edgeBigVis', 'edgeStripVis', 'alertVis', 'lockFlash', 'balCellVis'],
  100: ['balOn', 'balIdx', 'balVerdict', 'balDelta', 'balPhaseWord', 'betaShow', 'betaArrowR', 'betaArrowL', 'bandGlyph', 'bandName', 'slipAbsText', 'slipPx', 'discFrac', 'coreFrac', 'treadFI', 'treadFM', 'treadFO', 'bumpNVis',
    'flagWord', 'flagChipWord'],
  200: ['alertWord', 'steerText', 'coreNum', 'coreGlyph', 'pressNum', 'pressGlyph', 'treadIText', 'treadMText', 'treadOText', 'spreadNum', 'spreadGlyph', 'travelText', 'bumpText', 'gPeaksText', 'bzRow', 'cnRow2',
    'discText', 'discGlyph', 'discStateWord', 'discPeakText', 'discMinText', 'discMeanText', 'lastLockText', 'lastSlideText', 'ggMag', 'lockTile', 'evRowN', 'cnNum', 'cnChip', 'loadSplitFR', 'loadSplitLR', 'balEst'],
  1000: ['perf', 'perfHid', 'travelStatic']
};
// the colour layer: st_<kind>_vis and _ink flash for the kinds that have a critical state (so they run at 50 ms), everything else at 100 ms
var FLASHY = { slip: 1, core: 1, press: 1, disc: 1, bump: 1, tile: 1, last: 1, ev: 1, bal: 1, band: 1, lsl: 1 };
function stInterval(k) { var m = /^st_([A-Za-z0-9]+)_(vis|ink|col)$/.exec(k); return m ? ((m[2] !== 'col' && FLASHY[m[1]]) ? 50 : 100) : null; }
var INTERVAL_COUNT = {};
(function applyIntervals() {
  var map = {}, miss = {};
  Object.keys(INTERVALS).forEach(function (ms) { INTERVALS[ms].forEach(function (k) { map[k] = +ms; }); });
  ALL.forEach(function (it) {
    var ms = null;
    if (/ChartItem/.test(it['$type']) || !Object.keys(it.Bindings).length) { return; }
    Object.keys(it.Bindings).forEach(function (p) {
      var m = /tms[r2]?\('([A-Za-z0-9_]+)'/.exec(it.Bindings[p].Formula.Expression), k = m ? m[1] : null;
      if (k !== null && !(k in map) && stInterval(k) !== null) { map[k] = stInterval(k); }
      if (k === null || !(k in map)) { miss[k] = 1; return; }
      ms = ms === null ? map[k] : Math.min(ms, map[k]);
    });
    if (ms === null) { return; }
    it.MinimumRefreshIntervalMS = ms; it.RenderingSkip = Math.round(ms / 10); INTERVAL_COUNT[ms] = (INTERVAL_COUNT[ms] || 0) + 1;
  });
  if (Object.keys(miss).length) { throw new Error('refresh interval missing for: ' + Object.keys(miss).join(', ') + ' (add them to INTERVALS in build/build_dash.js)'); }
})();

// ---------- output ----------
var IMGS = ['arrow_nose', 'arrow_travel'];       // the heading and trajectory arrows (dash/assets), embedded in the package
function imageMeta(names) {
  return names.map(function (n) {
    var buf = fs.readFileSync(path.join(root, 'dash', 'assets', n + '.png')), w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    return { Name: n, Extension: '.png', Modified: false, Optimized: true, Width: w, Height: h, Length: buf.length, MD5: crypto.createHash('md5').update(buf).digest('hex') };
  });
}
var tplDjson = JSON.parse(fs.readFileSync(path.join(root, 'template_extracted', 'test', 'test.djson'), 'utf8'));
var tplMeta = JSON.parse(fs.readFileSync(path.join(root, 'template_extracted', 'test', 'test.djson.metadata'), 'utf8'));
function emit(name, pgs, ext, what) {         // pgs = [{ name, items }]: one dash screen per page; every page is both an in-game and an idle screen, so the next / previous action works with or without a game
  var dir = path.join(root, 'dash', 'out', name); fs.mkdirSync(dir, { recursive: true });
  var d = JSON.parse(JSON.stringify(tplDjson)), tplScreen = d.Screens[0], idx = pgs.map(function (pg, k) { return k; }), total = 0, meta;
  d.Id = crypto.randomUUID(); d.BaseWidth = 1920; d.BaseHeight = 1080; d.BackgroundColor = '#FF08080A';
  d.Screens = pgs.map(function (pg) { var s = JSON.parse(JSON.stringify(tplScreen)); s.Name = pg.name; s.ScreenId = crypto.randomUUID(); s.BackgroundColor = '#FF08080A'; s.InGameScreen = true; s.IdleScreen = true; s.Items = pg.items; total += pg.items.length; return s; });
  d.Images = imageMeta(IMGS);
  d.Metadata = { SettingsBuilder: { Settings: [], IsEditMode: false }, ScreenCount: pgs.length, InGameScreensIndexs: idx, IdleScreensIndexs: idx, MainPreviewIndex: 0, IsOverlay: false, OverlaySizeWarning: false, MetadataVersion: 2, EnableOnDashboardMessaging: true, PitScreensIndexs: [], PreferredTouchMode: 0, Width: 1920, Height: 1080, DashboardVersion: '' };
  fs.writeFileSync(path.join(dir, name + '.djson'), JSON.stringify(d));
  meta = JSON.parse(JSON.stringify(tplMeta));
  meta.Title = name; meta.Width = 1920; meta.Height = 1080; meta.OverlaySizeWarning = false;
  meta.Author = 'JustTriedfor'; meta.Description = "Side panel for detailed telemetry in Assetto Corsa Competizione and Assetto Corsa, built for a quick look in bright sun (1920 x 1080): slip angle and understeer / oversteer balance, tyres and suspension, brakes and logs, with lock-up, slide, flag and alert pop-ups on every page. Version 1.4, much lighter on SimHub's formula engine.";
  fs.writeFileSync(path.join(dir, name + '.djson.metadata'), JSON.stringify(meta, null, 2));
  return { name: name, items: total, images: IMGS, ext: ext, what: what };
}
var variants = [emit(NAME, pages, true, 'the full dash: three pages, pop-ups, bindings and extension scripts')];
fs.writeFileSync(path.join(root, 'build', 'maxchars.json'), JSON.stringify(MAXCH));
fs.writeFileSync(path.join(root, 'build', 'variants.json'), JSON.stringify(variants, null, 1));
fs.writeFileSync(path.join(root, 'build', 'build_report.json'), JSON.stringify({ items: ALL.length, pages: pages.map(function (pg) { return { name: pg.name, items: pg.items.length }; }), report: report }, null, 1));
console.log('refresh intervals (ms: items):', JSON.stringify(INTERVAL_COUNT));
console.log('pages:', pages.map(function (pg) { return pg.name + ' ' + pg.items.length; }).join(' | '));
console.log('items:', ALL.length, '| live bindings:', report.live, '| charts:', report.charts, '| variants:', variants.map(function (v) { return v.name + '(' + v.items + ')'; }).join(', '));
