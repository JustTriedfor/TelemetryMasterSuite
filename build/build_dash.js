// Builds the SimHub dash from the approved v3 mock: geometry (build/geometry.json) + binding table -> .djson.
// Run: node build/build_dash.js      Output: dash/out/TelemetryMasterSuite/*  (then build/package.py zips it)
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var I = require('./items.js');
var root = path.join(__dirname, '..');
var G = JSON.parse(fs.readFileSync(path.join(__dirname, 'geometry.json'), 'utf8'));
var byId = {}; G.forEach(function (e) { if (e.id) { byId[e.id] = e; } });
(function relayout() {
  var DY = 54, pIn = byId.pIn, pDyn = byId.pDyn, pSusp = byId.pSusp, lg, sw;
  G.forEach(function (e) { var d = byId.drv; if (e.i >= d.i && e.i < pDyn.i && e.y >= d.y - 2 && e.y <= d.y + d.h + 2) { e.skip = true; } });      // the row's own elements
  pIn.h -= DY;                                                          // the row of overlap / steer reversal / throttle numbers is gone
  G.forEach(function (e) { if (e.i > pDyn.i && e.i < pSusp.i) { e.y -= DY; } });
  pDyn.y -= DY; pDyn.h += DY;                                            // the dynamics panel grows upward into the freed space
  byId.cDyn.w = 192; byId.cDyn.h = 192;                                  // 1:1 graph
  lg = G.filter(function (e) { return e.tag === 'div' && /(^| )legend( |$)/.test(e.cls); })[0];
  sw = G.filter(function (e) { return e.tag === 'i' && e.i > lg.i && e.y >= lg.y - 1 && e.y <= lg.y + lg.h && e.x >= lg.x - 1 && e.x < lg.x + lg.w; }).sort(function (a, b) { return a.x - b.x; });
  sw[1].skip = true; sw[2].skip = true; sw[3].x = sw[1].x; sw[0].lab = 'beta °'; sw[3].lab = 'steer';               // the slip view's pedal graph is gone: only beta and steer stay in its legend
  byId.mapSub.skip = true;                                                // "lap position" belonged to the track map
})();
var items = [], report = { live: 0, static: 0, plugin: [], charts: 0, images: 0 };
var CC = ['#4CC9F0', '#7BF1A8', '#F6A5FF', '#FFD166'], W4 = ['FL', 'FR', 'RL', 'RR'];
var C = { panel: '#121215', border: '#26262D', top: '#34343C', card: '#18181C', track: '#23232A', dim: '#80808B', white: '#F6F6F1', text: '#D6D6DC', y: '#F3FF3D', ok: '#38E08C', warn: '#FF8A1F', bad: '#FF3D5A', cold: '#5DB3FF', thr: '#38E08C', brake: '#FF3D5A', steer: '#AEBBD6', lat: '#3DD6D0', lon: '#8F8CFF', yaw: '#B66DFF' };
function add(it) { items.push(it); return it; }
function tmsx(key, i) { return "return tms2('" + key + "', root, " + (i === undefined ? 0 : i) + ");"; }
function B(it, prop, key, i) {
  if (prop === 'Text') { fit(it, key); I.bind(it, prop, "var v = tms2('" + key + "', root, " + (i === undefined ? 0 : i) + "); return (v === null || v === undefined) ? 'n/a' : v;"); } else { I.bind(it, prop, tmsx(key, i)); }
  report.live++; return it;
}

// ---------- small drawing helpers ----------
function label(x, y, w, h, str, o) { report.static++; return add(I.text(x, y, w, h, str, o || { fs: 11, fw: 'Medium', color: C.dim })); }
function para(x, y, w, str, o) {
  var cpl = Math.max(8, Math.floor(w / ((o.fs || 12) * 0.47))), words = str.split(' '), line = '', lines = [], k;
  words.forEach(function (wd) { if ((line + ' ' + wd).trim().length > cpl) { lines.push(line); line = wd; } else { line = (line + ' ' + wd).trim(); } }); if (line) { lines.push(line); }
  for (k = 0; k < lines.length; k++) { label(x, y + k * ((o.fs || 12) + 4), w, (o.fs || 12) + 4, lines[k], o); }
}
var MAXCH = {"cnRow":"L99 C99 999 9.99 999° 99.9° OS 99.9°","cnTrend":"TREND  UNDERSTEER 99.9°  (last 8)","latGText":"9.99 g","latGDir":"\u25c4 BRAKING","lonGText":"9.99 g","lonGDir":"\u25c4 BRAKING","peakLatText":"9.99 g","peakBrkGText":"9.99 g","peakAccText":"9.99 g","peakYawText":"999\u00b0/s","betaPeakText":"99.9\u00b0","slideTimeText":"999.9 s","cornerLastText":"UNDERSTEER 99.9\u00b0","cornerCountText":"US 99   OS 99   N 99","sdTime":"99:59.99","sdDelta":"+99.999","theoText":"99:59.999","theoGapText":"-9.999 s possible","avgText":"AVG  99:59.999","spreadText":"SPREAD  \u00b199.99 s","hdrA":"-99.9s","hdrB":"99:59.99","hdrALabel":"GAP BEHIND","hdrBLabel":"GAP BEHIND","sessLabel":"SESSION LEFT","hlLap":"L99","hlTime":"99:59.999","hlDelta":"+99.999","znRow":"> #99 312>298 100% 2.5g 9.9s A99 L","evRow":"L99   99:59.99   LOCK-UP FL   999 km/h","lockText":"LOCK-UPS THIS LAP    FL 99    FR 99    RL 99    RR 99","revText":"999","smoothText":"99.9/s","engText":"OIL 999\u00b0    WATER 999\u00b0","fuelMargin":"SHORT by 99.9 laps","deltaHiText":"+99.5s","deltaLoText":"-99.5s","wearLabel":"WEAR","pos":"P99","gapA":"-99.9s","gapB":"+99.9s","flag":"CHEQUERED","sessLeft":"999:59","temps":"99° / 99°","dataTag":"AC: slip est.","deltaText":"+99.999","deltaLabel":"LAP TIME (no best lap yet)","predLap":"99:59.999","bestLap":"99:59.999","lastLap":"99:59.999","curLap":"99:59.999","lapSub":"lap 99 | best-lap overlays need the plugin","betaText":"-99.9°","bandWord":"◐ TRANSITION","balWord":"UNDERSTEER","balTag":"FROM TYRE SLIP","coreText":"999° ▲","pressText":"99.9 psi","pressDeltaText":"-9.9","wearText":"100.0%","slipText":"-99.9°","loadText":"9999 N","travelText":"999 mm","gripTag":"grip 100%","gripText":"100%","discText":"999°","discWord":"▲▲ FADE RISK","discPeak":"999°","discRate":"▲999°/s","padDisc":"999 / 999","sector":"99:59.99","sectorBest":"best 99:59.99","oilText":"999°","waterText":"999°","boostText":"9.99","fuelText":"99.9 L","lplText":"99.99 L","lapsLeftText":"999.9","raceLapsLeft":"99 (plan)","toAddText":"999.9 L","raceText":"TO GO  99 laps  (session time)","rangeText":"FUEL RANGE  short by 99.9 laps","steerText":"L 999°","steerRawText":"raw -9.99","pitchText":"PITCH -9.99°","rollText":"ROLL -9.99°","loadShare":"FRONT 100%  REAR 100%     LEFT 100%  RIGHT 100%","ovlTime":"99.99s","absHits":"hits this lap 999","absWord":"ACTIVE","peakBrake":"100%","trailTime":"999.99s","peakDecel":"9.99 g","bias":"99.9%","thrPct":"100%","brkPct":"100%","cluPct":"100%","loadN":"9999","gear":"N","speed":"999","rpm":"99999","treadIText":"999°","treadMText":"999°","treadOText":"999°"};
function fit(it, key) {
  var m = MAXCH[key]; if (!m) { return; }
  var need = Math.ceil(m.length * it.FontSize * 0.56) + 6, d;
  if (need > it.Width) { d = need - it.Width; if (it.HorizontalAlignment === 2) { it.Left -= d; } else if (it.HorizontalAlignment === 1) { it.Left -= Math.round(d / 2); } it.Width = need; }
  if (it.Left + it.Width > 1916) { it.Width = 1916 - it.Left; }
}
function livetext(x, y, w, h, o, key, i, colorKey) { var t = add(I.text(x, y, w, h, '--', o)); B(t, 'Text', key, i); if (colorKey) { B(t, 'TextColor', colorKey, i); } return t; }
function chartAt(c, o, key, i, name) {        // one ChartItem = one line; the plot area is inset for the axis labels
  var pl = o.pl === undefined ? 28 : o.pl, pt = o.pt === undefined ? 3 : o.pt, pb = o.pb === undefined ? 13 : o.pb, ch = I.chart(c.x + pl, c.y + pt, c.w - pl - 4, c.h - pt - pb, o, name || key);
  I.bind(ch, 'CurrentValue', tmsx(key, i)); ch.MinimumRefreshIntervalMS = o.ms; if (o.colorKey) { B(ch, 'LineColor', o.colorKey, i); }
  if (o.minExpr) { I.bind(ch, 'Minimum', o.minExpr); I.bind(ch, 'Maximum', o.maxExpr); }
  report.charts++; report.live++; return add(ch);
}
function plotRect(c, o) { var pl = o.pl === undefined ? 28 : o.pl, pt = o.pt === undefined ? 3 : o.pt, pb = o.pb === undefined ? 13 : o.pb; return { x: c.x + pl, y: c.y + pt, w: c.w - pl - 4, h: c.h - pt - pb }; }
function band(c, o, lo, hi, color, alpha) { var p = plotRect(c, o), y = function (v) { return p.y + (1 - (v - o.min) / (o.max - o.min)) * p.h; }; add(I.rect(p.x, y(hi), p.w, y(lo) - y(hi), color)); items[items.length - 1].BackgroundColor = I.argb(color, alpha); }
function yLabel(c, o, v, str) { var p = plotRect(c, o), y = p.y + (1 - (v - o.min) / (o.max - o.min)) * p.h; label(c.x, y - 7, 28, 13, str, { fs: 11, fw: 'Normal', color: C.dim }); }
function xLabels(c, o, labels) { var p = plotRect(c, o), k; for (k = 0; k < labels.length; k++) { label(p.x + p.w * labels[k][0] - (k === labels.length - 1 ? 22 : 8), c.y + c.h - 13, 40, 12, labels[k][1], { fs: 11, color: C.dim }); } }
function zeroLine(c, o, v) { var p = plotRect(c, o), y = p.y + (1 - (v - o.min) / (o.max - o.min)) * p.h; add(I.rect(p.x, y, p.w, 1, '#3A3A42')); }
var T20 = [[0, '-20s'], [0.5, '-10'], [1, 'now']];

// ---------- containers whose children are built by hand (their DOM content is generated by innerHTML in the mock) ----------
var SKIP = ['secs', 'laps', 'brkStats', 'ovlCard', 'absCard', 'zones', 'events', 'fuelL', 'inTop', 'lockRow', 'sys', 'ds0', 'ds1', 'ds2', 'ds3'].map(function (id) { return byId[id]; }).filter(Boolean);
var SKIPPAD = { fuelL: 24 };
function inSkip(e) { var cx = e.x + e.w / 2, cy = e.y + e.h / 2; return SKIP.some(function (s) { var pad = SKIPPAD[s.id] || 0; return e.i > s.i && cx >= s.x - 2 && cx <= s.x + s.w + 2 && cy >= s.y - 2 && cy <= s.y + s.h + 2 + pad; }); }

// ---------- text bindings by element id: [textKey, colorKey, textKeyIndex] ----------
var TB = { balTag: ['balTag'], rc0: ['pos'], deltaLabel: ['deltaLabel'], rc1: ['hdrA'], rc2: ['hdrB'], rc3: ['flag', 'flagColor', 0], rc4: ['sessLeft'], rc5: ['temps'], rc6: ['dataTag'],
  delta: ['deltaText', 'deltaColor'], lapSub: ['lapSub'], slipSub: ['dataTag'],
  beta: ['betaText', 'bandColor'], band: ['bandWord', 'bandColor'], balWord: ['balWord', 'balColor'], sv0: ['oilText'], sv1: ['waterText'], sv2: ['boostText'] };
for (var q = 0; q < 4; q++) {
  TB['tc' + q] = ['coreText', 'coreColor', q]; TB['tp' + q] = ['pressText', null, q]; TB['td' + q] = ['pressDeltaText', 'pressDeltaColor', q]; TB['tw' + q] = ['wearText', null, q];
  TB['ts' + q] = ['slipText', null, q]; TB['tl' + q] = ['loadText', null, q]; TB['tt' + q] = ['travelText', null, q]; TB['tg' + q] = ['gripTag', null, q];
  TB['dn' + q] = ['discText', 'discColor', q]; TB['dw' + q] = ['discWord', 'discColor', q]; TB['gv' + q] = ['gripText', 'gripColor', q];
}
var HDRL = { 'GAP AHEAD': ['hdrALabel', null, 0], 'GAP BEHIND': ['hdrBLabel', null, 0], 'SESSION LEFT': ['sessLabel', null, 0] };
var STATIC_OVERRIDE = { slipSub: null };    // none
var PHN = ['STRAIGHT', 'BRAKING', 'TRAIL', 'COAST', 'ROTATION', 'POWER'];

// ---------- 1. generic walk in DOM order ----------
G.forEach(function (e) {
  if (e.tag === 'canvas' || e.skip || inSkip(e) || e.id === 'ctl' || e.tag === 'button' || e.w < 0.5 || e.h < 0.5) { return; }
  var isPanel = /(^| )p( |$)/.test(e.cls) && e.tag === 'section';
  if (isPanel) {
    add(I.rect(e.x, e.y, e.w, e.h, C.border)); add(I.rect(e.x + 1, e.y + 1, e.w - 2, e.h - 2, C.panel)); add(I.rect(e.x + 1, e.y + 1, e.w - 2, 2, C.top));
    var title = G.filter(function (t) { return t.i > e.i && t.p === 'h3' && t.y >= e.y && t.y < e.y + 20; })[0];
    if (title) { add(I.rect(title.x - 16, title.y + 1, 6, 11, C.y)); }
    report.static += 3; return;
  }
  var ph = /(^| )ph( |$)/.test(e.cls) ? PHN.indexOf(e.id.slice(2)) : -1;
  if (ph >= 0) { var seg = add(I.rect(e.x, e.y, e.w, e.h, '#16161A')); B(seg, 'BackgroundColor', 'phaseColor', ph); return; }
  if (e.p && /^ph[A-Z]+$/.test(e.p) && e.text) {    // phase label: the parent is the tab (id phSTRAIGHT ...); dark on the lit tab, grey otherwise
    var pi = PHN.indexOf(e.p.slice(2)), lt = add(I.text(e.x - 20, e.y - 2, e.w + 40, e.h + 4, e.text, { fs: e.fs, fw: 'Bold', color: '#565660', ha: 1 })); B(lt, 'TextColor', 'phaseText', pi); return;
  }
  if (/^gb[0-3]$/.test(e.id)) {                // grip bars: width and colour live
    var gi = +e.id.slice(2), tr = G.filter(function (t) { return /(^| )bar( |$)/.test(t.cls) && Math.abs(t.x - e.x) < 1 && Math.abs(t.y - e.y) < 1.5; })[0], tw = tr ? tr.w : 150, gb = add(I.rect(e.x, e.y, tw, e.h, '#2A2A31'));
    I.bind(gb, 'Width', "var v = tms2('grip', root, " + gi + "); return v === null ? 0 : Math.round(v * " + Math.round(tw) + ");"); B(gb, 'BackgroundColor', 'gripColor', gi); return;
  }
  if (e.bg && !(e.tag === 'i' && /^(dl|dw)/.test(e.id))) {
    if (!/^(head|phase|race|colA|colB|colC|tyres|discs)$/.test(e.id)) { var rr = add(I.rect(e.x, e.y, e.w, e.h, e.bg)); report.static++; if (/(^| )ty( |$)/.test(e.cls)) { var ti = +e.id.slice(2); add(I.rect(e.x, e.y, e.w, 3, CC[ti])); } }
  }
  if (e.id === 'pred' || e.id === 'best' || e.text === 'PRED BEST' || (e.text === 'DELTA VS BEST' && e.cls.indexOf('lab') >= 0)) { return; }
  if (e.text && (e.id === 'balTag' || (e.text === 'BALANCE' && e.cls.indexOf('lab') >= 0))) { return; }
  if (e.text && !(e.tag === 'div' && /(^| )(legend|ldg)( |$)/.test(e.cls))) {
    var spec = TB[e.id] || (e.text === 'WEAR' && e.p === 'kv' ? ['wearLabel', null, 0] : (HDRL[e.text] && e.y < 40 ? HDRL[e.text] : null)), ha = e.ta === 'right' ? 2 : (e.ta === 'center' ? 1 : 0), pad = Math.max(10, e.w * 0.3), tx = e.x, tw2 = e.w + pad;
    if (ha === 2) { tx = e.x - pad; } else if (spec && ha === 0) { tw2 = e.w + pad; }
    var fw = I.weight(e.fw), col = e.color, str = e.text, va = e.h > e.fs * 1.9 ? 0 : 1;
    if (tx + tw2 > 1916) { tw2 = 1916 - tx; }
    if (str === 'Systems, events and track') { str = 'Events'; }
    if (str === 'last 6 s, and load on each corner') { str = 'last 6 s'; }
    if (e.p === 'h3' && !/(^| )sub( |$)/.test(e.cls)) { str = str.toUpperCase(); fw = 'Bold'; }
    var fsz = e.fs, ty = e.y - 1, th = e.h + 2;
    if (/^gv[0-3]$/.test(e.id)) { fsz = 28; ty = e.y - 3; th = e.h + 6; }
    if (/^gs[0-3]$/.test(e.id)) { str = 'of recent peak'; col = '#A8A8B2'; }
    var t = add(I.text(tx, ty, tw2, th, str, { fs: fsz, fw: fw, color: col, ha: ha, va: va }, e.id || 'Label'));
    if (spec) { B(t, 'Text', spec[0], spec[2]); if (spec[1]) { B(t, 'TextColor', spec[1], spec[2]); } } else { report.static++; }
  }
});

// ---------- 1b. legends: swatch (already emitted from the geometry) + label ----------
(function legends() {
  var sets = [{ cls: 'legend', labels: ['beta \u00b0', 'brake', 'throttle', 'steer'] }, { cls: 'ldg', labels: ['lateral g (+ left)', 'longitudinal g (+ accel)', 'yaw rate (lower trace)'] }];
  sets.forEach(function (st) {
    var box = G.filter(function (e) { return e.tag === 'div' && new RegExp('(^| )' + st.cls + '( |$)').test(e.cls); })[0];
    if (!box) { return; }
    var sw = G.filter(function (e) { return e.tag === 'i' && e.i > box.i && e.y >= box.y - 1 && e.y <= box.y + box.h && e.x >= box.x - 1 && e.x < box.x + box.w; }).sort(function (a, b) { return a.x - b.x; });
    sw.forEach(function (e, k) { if (e.skip) { return; } label(e.x + 18, box.y, 120, box.h, e.lab !== undefined ? e.lab : (st.labels[k] || ''), { fs: 11, fw: 'Normal', color: C.dim }); });
  });
})();

(function lapRow() {
  var d = byId.delta, y = d.y + d.h + 3;
  livetext(d.x, d.y - 15, 208, 14, { fs: 11, fw: 'SemiBold', color: C.dim }, 'deltaLabel');
  label(d.x, y, 40, 14, 'PRED', { fs: 12, fw: 'SemiBold', color: C.dim }); livetext(d.x + 40, y - 1, 84, 15, { fs: 13, fw: 'Bold', color: C.white }, 'predLap');
  label(d.x + 130, y, 36, 14, 'BEST', { fs: 12, fw: 'SemiBold', color: C.dim }); livetext(d.x + 166, y - 1, 84, 15, { fs: 13, fw: 'Bold', color: C.white }, 'bestLap');
})();
(function balLabels() { var b = byId.balTag; label(b.x, b.y - 13, 80, 13, 'BALANCE', { fs: 11, fw: 'Medium', color: C.dim }); livetext(b.x, b.y + 1, 100, 13, { fs: 11, fw: 'Bold', color: '#FF8A1F' }, 'balTag'); })();

// ---------- 2. hand-built containers ----------
(function secs() {
  var c = byId.secs, k, w = 188.7, x;
  for (k = 0; k < 3; k++) {
    x = c.x + k * (w + 6); add(I.rect(x, c.y, w, c.h, C.card)); add(I.rect(x, c.y, 3, c.h, '#3A3A42'));
    label(x + 11, c.y + 2, 60, 13, 'SECTOR ' + (k + 1), { fs: 11, fw: 'Medium', color: C.dim });
    livetext(x + w - 96, c.y + 2, 90, 13, { fs: 11, fw: 'Medium', color: C.dim, ha: 2 }, 'sectorBest', k);
    livetext(x + 11, c.y + 15, 120, 26, { fs: 24, fw: 'Bold', color: C.white }, 'sector', k, 'sectorColor');
  }
})();
(function laps() {
  var c = byId.laps, cols = [['LAP', 0, 50], ['TIME', 50, 94], ['VS BEST', 150, 87], ['GAP TO SESSION BEST  (bar = seconds slower, purple = the best lap)', 245, 330]], k, y;
  cols.forEach(function (cl) { label(c.x + cl[1], c.y, cl[2], 15, cl[0], { fs: 11, fw: 'SemiBold', color: C.dim }); });
  for (k = 0; k < 5; k++) {
    y = c.y + 17 + k * 20;
    livetext(c.x, y, 50, 19, { fs: 14, fw: 'SemiBold', color: C.dim }, 'hlLap', k);
    livetext(c.x + 50, y, 100, 19, { fs: 15, fw: 'Bold', color: C.white }, 'hlTime', k, 'hlColor');
    livetext(c.x + 150, y, 87, 19, { fs: 15, fw: 'Bold', color: C.white }, 'hlDelta', k, 'hlColor');
    var gb = add(I.rect(c.x + 245, y + 5, 3, 10, C.dim, 'gapbar')); I.bind(gb, 'Width', tmsx('hlBar', k)); B(gb, 'BackgroundColor', 'hlColor', k); report.live++;
  }
})();
(function brk() {
  var c = byId.brkStats, defs = [['PEAK BRAKE', 'peakBrake'], ['TRAIL BRAKE', 'trailTime'], ['PEAK DECEL', 'peakDecel'], ['BRAKE BIAS', 'bias']], k, x, w = (c.w - 18) / 4;
  defs.forEach(function (d, k2) { x = c.x + k2 * (w + 6); add(I.rect(x, c.y, w, c.h, C.card)); add(I.rect(x, c.y, 3, c.h, '#3A3A42')); label(x + 11, c.y + 3, w - 14, 13, d[0], { fs: 11, fw: 'SemiBold', color: C.dim }); livetext(x + 11, c.y + 17, w - 14, 34, { fs: 30, fw: 'Bold', color: C.white }, d[1]); label(x + 11, c.y + 56, w - 14, 13, ['this lap', 'this lap, brake and steer', 'this lap', 'front share of braking'][k2], { fs: 11, color: C.dim }); });
})();
(function ovlabs() {
  var o = byId.ovlCard, a = byId.absCard;
  [o, a].forEach(function (c) { add(I.rect(c.x, c.y, c.w, c.h, C.card)); add(I.rect(c.x, c.y, 3, c.h, '#3A3A42')); });
  label(o.x + 11, o.y + 3, 120, 13, 'PEDAL OVERLAP', { fs: 11, fw: 'SemiBold', color: C.dim }); livetext(o.x + 11, o.y + 17, 120, 34, { fs: 30, fw: 'Bold', color: C.white }, 'ovlTime'); label(o.x + 11, o.y + 52, 124, 14, 'both pedals on, this lap', { fs: 11, color: C.dim });
  label(a.x + 11, a.y + 3, 120, 13, 'ABS', { fs: 11, fw: 'SemiBold', color: C.dim }); livetext(a.x + 11, a.y + 17, 120, 34, { fs: 30, fw: 'Bold', color: C.text }, 'absWord', 0, 'absColor'); livetext(a.x + 11, a.y + 52, 124, 13, { fs: 11, color: C.dim }, 'absHits');
  label(a.x + 11, a.y + 66, 124, 13, 'activity, last 20 s', { fs: 11, color: C.dim });
})();
(function zones() {
  var c = byId.zones, k; add(I.rect(c.x, c.y, c.w, c.h, C.card)); label(c.x + 8, c.y + 4, c.w - 16, 14, 'BRAKING ZONES  entry>min km/h, peak, decel, trail', { fs: 11, fw: 'SemiBold', color: C.dim });
  label(c.x + 8, c.y + 20, c.w - 16, 12, '> = live now, newest first, A = ABS hits, L = lock-up', { fs: 11, color: '#6C6C78' });
  for (k = 0; k < 5; k++) { var zt = livetext(c.x + 8, c.y + 36 + k * 20, c.w - 16, 19, { fs: 13, fw: 'Bold', color: C.white, font: 'Consolas' }, 'znRow', k, 'znColor'); zt.MinimumRefreshIntervalMS = 100; }
})();
(function drv() { /* removed on request: the useful numbers live in the braking analysis */ })();
(function events() {
  var c = byId.sys, k, ev;
  label(c.x, c.y, 300, 13, 'EVENT LOG  (this session, newest first)', { fs: 11, fw: 'SemiBold', color: C.dim });
  for (k = 0; k < 7; k++) { ev = livetext(c.x, c.y + 16 + k * 15, 290, 16, { fs: 13, fw: 'Bold', color: C.text }, 'evRow', k, 'evColor'); ev.MinimumRefreshIntervalMS = 100; }
  livetext(c.x, c.y + 124, 290, 14, { fs: 11, fw: 'SemiBold', color: C.dim }, 'engText');
})();
(function corners() {          // beside the event log: one row per corner with the steering and balance numbers
  var c = byId.sys, x = c.x + 298, y = c.y, w = 1903 - x, h = 136, k, r, F = { fs: 12, fw: 'Normal', color: C.dim, font: 'Consolas' };
  add(I.rect(x, y, w, h, C.card)); add(I.rect(x, y, 3, h, '#3A3A42'));
  label(x + 10, y + 3, w - 14, 13, 'CORNER LOG  (newest first, peaks held 0.3 s)', { fs: 11, fw: 'SemiBold', color: C.dim });
  label(x + 10, y + 18, w - 14, 14, 'LAP C#  KMH LATG STEER SLIP BALANCE', F);
  for (k = 0; k < 6; k++) { r = livetext(x + 10, y + 33 + k * 14, w - 14, 14, { fs: 12, fw: 'Bold', color: C.text, font: 'Consolas' }, 'cnRow', k, 'cnColor'); r.MinimumRefreshIntervalMS = 100; }
  r = livetext(x + 10, y + 119, w - 14, 14, { fs: 12, fw: 'Bold', color: C.dim }, 'cnTrend', 0, 'cnTrendColor'); r.MinimumRefreshIntervalMS = 200;
})();
(function fuelL() {
  var c = byId.fuelL, rows = [['FUEL', 'fuelText'], ['PER LAP (3-lap avg)', 'lplText'], ['RACE LAPS LEFT', 'raceLapsLeft'], ['TO ADD TO FINISH', 'toAddText']], k;
  label(c.x, c.y, 120, 13, 'FUEL LAPS LEFT', { fs: 11, fw: 'SemiBold', color: C.dim });
  livetext(c.x, c.y + 13, 200, 42, { fs: 40, fw: 'Bold', color: C.white }, 'lapsLeftText', 0, 'lapsLeftColor');
  rows.forEach(function (r, k2) { var y = c.y + 53 + k2 * 15; label(c.x, y, 150, 15, r[0], { fs: 12, color: C.dim }); livetext(c.x + 120, y - 1, 100, 15, { fs: 13, fw: 'Bold', color: C.white, ha: 2 }, r[1]); });
})();
(function inTop() {
  var c = byId.inTop, x = c.x;
  label(x, c.y - 3, 60, 12, 'GEAR', { fs: 11, color: C.dim }); livetext(x, c.y + 9, 50, 42, { fs: 38, fw: 'Bold', color: C.y }, 'gear');
  label(x + 62, c.y - 3, 80, 12, 'SPEED km/h', { fs: 11, color: C.dim }); livetext(x + 62, c.y + 9, 100, 42, { fs: 38, fw: 'Bold', color: C.white }, 'speed');
  label(x + 168, c.y - 3, 60, 12, 'RPM', { fs: 11, color: C.dim }); livetext(x + 168, c.y + 15, 110, 34, { fs: 26, fw: 'Bold', color: C.white }, 'rpm');
  add(I.rect(x + 262, c.y + 30, 190, 12, '#23232A')); add(I.rect(x + 262 + 190 * 0.82, c.y + 30, 190 * 0.18, 12, '#59202B'));
  var rev = add(I.rect(x + 262, c.y + 30, 190, 12, C.y)); I.bind(rev, 'Width', "var v = tms2('rpmFrac', root, 0); return Math.round(v * 190);"); report.live++;
  [['TC', 'tcWord', 'tc'], ['ABS', 'absWord', 'abs']].forEach(function (d, k) { var cx = x + 470 + k * 52; var chip = add(I.rect(cx, c.y + 22, 46, 20, '#1F1F25')); I.bind(chip, 'BackgroundColor', "return tms2('" + (k === 0 ? 'tc' : 'abs') + "', root, 0) ? '#FFFF8A1F' : '#FF1F1F25';"); report.live++; label(cx, c.y + 22, 46, 20, d[0], { fs: 12, fw: 'Bold', color: '#9A9AA6', ha: 1 }); });
})();
(function lockRow() {
  var c = byId.lockRow, lk = livetext(c.x, c.y + 4, 570, 20, { fs: 13, fw: 'Bold', color: C.text }, 'lockText', 0, 'lockColor'); lk.MinimumRefreshIntervalMS = 100;
})();
[0, 1, 2, 3].forEach(function (k) {
  var c = byId['ds' + k], cw = [52.9, 52.9, 74.1], xs = [c.x, c.x + 56.9, c.x + 113.8], labs = ['PEAK LAP', 'RATE', 'PAD / DISC'], keys = ['discPeak', 'discRate', 'padDisc'];
  for (var m = 0; m < 3; m++) { label(xs[m], c.y, cw[m], 12, labs[m], { fs: 11, fw: 'Medium', color: C.dim }); livetext(xs[m], c.y + 12, cw[m] + 6, 17, { fs: 15, fw: 'Bold', color: C.white }, keys[m], k); }
});

// ---------- 3. charts and widgets ----------
var CV = byId;
(function slipTrace() {
  var c = CV.cSlip, top = { x: c.x, y: c.y, w: c.w, h: c.h };
  var ob = { min: -15, max: 15, pl: 30, pb: 13, points: 180, ms: 33, color: C.y, thick: 2.5 }, os = { min: -1, max: 1, pl: 30, pb: 13, points: 180, ms: 33, color: C.steer, thick: 1.4 };
  band(top, ob, 4, 9, C.warn, 0.14); band(top, ob, 9, 15, C.bad, 0.14); band(top, ob, -9, -4, C.warn, 0.14); band(top, ob, -15, -9, C.bad, 0.14); zeroLine(top, ob, 0);
  chartAt(top, os, 'steer', 0, 'slip_steer'); chartAt(top, ob, 'beta', 0, 'slip_beta');
  yLabel(top, ob, 10, '10\u00b0'); yLabel(top, ob, 5, '5\u00b0'); yLabel(top, ob, 0, '0\u00b0'); yLabel(top, ob, -5, '-5\u00b0'); yLabel(top, ob, -10, '-10\u00b0'); xLabels(top, ob, [[0, '-6s'], [0.5, '-3'], [1, 'now']]);
})();
(function pedals() {
  var c = CV.cPed, a = { x: c.x, y: c.y, w: c.w, h: 74 }, b = { x: c.x, y: c.y + 76, w: c.w, h: 36 };
  var o1 = { min: 0, max: 1, pl: 30, pb: 2, points: 200, ms: 100, color: C.thr, thick: 1.8 }, o2 = { min: 0, max: 1, pl: 30, pb: 2, points: 200, ms: 100, color: C.brake, thick: 1.8 }, o3 = { min: -1, max: 1, pl: 30, pb: 12, points: 200, ms: 100, color: C.steer, thick: 1.8 };
  chartAt(a, o1, 'thr', 0, 'ped_thr'); chartAt(a, o2, 'brk', 0, 'ped_brk'); chartAt(b, o3, 'steer', 0, 'ped_steer'); zeroLine(b, o3, 0);
  yLabel(a, o1, 1, '100%'); yLabel(a, o1, 0, '0%'); yLabel(b, o3, 0.6, 'L'); yLabel(b, o3, -0.6, 'R'); xLabels(b, o3, [[0, '-20s'], [0.5, '-10'], [1, 'now']]); report.plugin.push('best-lap dashed overlay on pedal graph');
})();
(function dyn() {
  var c = CV.cDyn, a = { x: c.x, y: c.y, w: c.w, h: 118 }, b = { x: c.x, y: c.y + 122, w: c.w, h: 70 };
  var o1 = { min: -2, max: 2, pl: 30, pb: 2, points: 180, ms: 33, color: C.lat, thick: 1.8 }, o2 = { min: -2, max: 2, pl: 30, pb: 2, points: 180, ms: 33, color: C.lon, thick: 1.8 }, o3 = { min: -40, max: 40, pl: 30, pb: 12, points: 180, ms: 33, color: C.yaw, thick: 1.8 };
  zeroLine(a, o1, 0); chartAt(a, o1, 'latG', 0, 'dyn_lat'); chartAt(a, o2, 'longG', 0, 'dyn_lon'); chartAt(b, o3, 'yaw', 0, 'dyn_yaw'); zeroLine(b, o3, 0);
  yLabel(a, o1, 1, '1g'); yLabel(a, o1, 0, '0g'); yLabel(a, o1, -1, '-1g'); xLabels(b, o3, [[0, '-6s'], [0.5, '-3'], [1, 'now']]);
  // G-force: live numbers, two centred bars (2 g full scale) and the peaks of this lap
  var gx = c.x + 192 + 14, gw = 1903 - gx, gy = c.y, bx = gx + 8, bw = gw - 16, mid = bx + Math.round(bw / 2), half = Math.round(bw / 2) - 2;
  add(I.rect(gx, gy, gw, 192, '#0F0F12')); label(gx + 8, gy + 5, 300, 13, 'G-FORCE   (bars: 2 g full scale, ticks at 1 g)', { fs: 11, fw: 'SemiBold', color: C.dim });
  [['LATERAL', 'latG', 'latGText', 'latGDir', C.lat, gy + 22, 'v > 0'], ['LONGITUDINAL', 'longG', 'lonGText', 'lonGDir', C.lon, gy + 90, 'v < 0']].forEach(function (d) {
    var y = d[5];
    label(bx, y, 130, 12, d[0], { fs: 11, fw: 'SemiBold', color: C.dim });
    livetext(bx, y + 12, 160, 36, { fs: 30, fw: 'Bold', color: d[4] }, d[2]);
    livetext(bx + 160, y + 22, bw - 160, 22, { fs: 15, fw: 'Bold', color: C.text, ha: 2 }, d[3]);
    add(I.rect(bx, y + 50, bw, 12, '#1F1F25'));
    var f = add(I.rect(mid, y + 50, 0, 12, d[4]));
    I.bind(f, 'Width', "var v = tms2('" + d[1] + "', root, 0); return v === null ? 0 : Math.round(Math.min(Math.abs(v), 2) / 2 * " + half + ");");
    I.bind(f, 'Left', "var v = tms2('" + d[1] + "', root, 0); if (v === null) { return " + mid + "; } var w = Math.round(Math.min(Math.abs(v), 2) / 2 * " + half + "); return " + d[6] + " ? " + mid + " - w : " + mid + ";"); report.live += 2;
    add(I.rect(mid, y + 47, 1, 18, '#8A8A94')); add(I.rect(mid - Math.round(half / 2), y + 50, 1, 12, '#3A3A44')); add(I.rect(mid + Math.round(half / 2), y + 50, 1, 12, '#3A3A44'));
  });
  [['PEAK LAT', 'peakLatText'], ['PEAK BRAKE', 'peakBrkGText'], ['PEAK ACCEL', 'peakAccText'], ['MAX YAW', 'peakYawText']].forEach(function (d, k) {
    var x = bx + k * 90; label(x, gy + 160, 86, 12, d[0] + '  (lap)', { fs: 10, fw: 'SemiBold', color: C.dim }); livetext(x, gy + 172, 86, 18, { fs: 15, fw: 'Bold', color: C.white }, d[1]);
  });
})();
[0, 1, 2, 3].forEach(function (k) {
  var d = CV['cD' + k], od = { min: 150, max: 900, pl: 28, pb: 12, points: 200, ms: 100, color: CC[k], thick: 1.8 };
  band(d, od, 150, 300, C.cold, 0.1); band(d, od, 650, 750, C.warn, 0.14); band(d, od, 750, 900, C.bad, 0.16); chartAt(d, od, 'disc', k, 'disc' + k);
  yLabel(d, od, 750, '750'); yLabel(d, od, 300, '300'); xLabels(d, od, T20);
  var tcv = CV['cT' + k], ot = { min: 60, max: 115, pl: 26, pb: 12, points: 200, ms: 100, color: CC[k], thick: 1.8, minExpr: "return tmsr('core', root, " + k + ", 8, 'lo');", maxExpr: "return tmsr('core', root, " + k + ", 8, 'hi');" };
  chartAt(tcv, ot, 'core', k, 'core' + k); label(tcv.x + 30, tcv.y + 2, 150, 12, 'CORE °C (auto range)', { fs: 11, color: C.dim }); xLabels(tcv, ot, T20);
  var pc = CV['cP' + k], op = { min: 25, max: 30, pl: 26, pb: 12, points: 200, ms: 100, color: CC[k], thick: 1.8, minExpr: "return tmsr('press', root, " + k + ", 0.6, 'lo');", maxExpr: "return tmsr('press', root, " + k + ", 0.6, 'hi');" };
  chartAt(pc, op, 'press', k, 'press' + k); label(pc.x + 30, pc.y + 2, 150, 12, 'PRESSURE psi (auto range)', { fs: 11, color: C.dim });
  var rc = CV['cR' + k], z = [['I', 'treadI'], ['M', 'treadM'], ['O', 'treadO']];                  // tread temperature bars
  z.forEach(function (zz, m) {
    var y = rc.y + 4 + m * 16; label(rc.x, y - 2, 50, 14, 'TREAD ' + zz[0], { fs: 11, color: C.dim }); add(I.rect(rc.x + 52, y, 100, 10, '#1F1F25'));
    var bar = add(I.rect(rc.x + 52, y, 50, 10, C.ok)); I.bind(bar, 'Width', "var v = tms2('" + zz[1] + "', root, " + k + "); return v === null ? 0 : Math.round(Math.max(0, Math.min(100, (v - 50) / 70 * 100)));");
    I.bind(bar, 'BackgroundColor', "var v = tms2('" + zz[1] + "', root, " + k + "); return v === null ? '#FF2A2A31' : (v < 78 ? '#FF5DB3FF' : (v <= 98 ? '#FF38E08C' : (v <= 106 ? '#FFFF8A1F' : '#FFFF3D5A')));"); report.live += 2;
    livetext(rc.x + 156, y - 2, 34, 14, { fs: 11, fw: 'Bold', color: C.white, ha: 2 }, zz[1] === 'treadI' ? 'treadIText' : (zz[1] === 'treadM' ? 'treadMText' : 'treadOText'), k);
  });
});
(function susp() {
  [0, 1, 2, 3].forEach(function (k) { var c = CV['cS' + k], o = { min: 0, max: 100, pl: 26, pb: 2, points: 180, ms: 33, color: CC[k], thick: 1.7 }; band(c, o, 95, 100, C.bad, 0.2); band(c, o, 0, 5, C.cold, 0.2); chartAt(c, o, 'travel', k, 'travel' + k); label(c.x + 30, c.y + 2, 200, 12, W4[k] + ' travel mm', { fs: 11, color: CC[k] }); });
  report.plugin.push('bottom-out / top-out counters');
})();
(function car() {
  var c = CV.car, cx = c.x + 150, cy = c.y + 172, bl = 214, bw = bl * 344 / 765, top = cy - bl / 2, axY = [top + 0.235 * bl, top + 0.235 * bl, top + 0.765 * bl, top + 0.765 * bl], wx = [cx - bw / 2 - 11, cx + bw / 2 - 1, cx - bw / 2 - 11, cx + bw / 2 - 1], k;
  for (k = 0; k < 4; k++) { var w = add(I.rect(wx[k], axY[k] - 20, 12, 40, '#3A3A42')); B(w, 'BackgroundColor', 'gripColor', k); label(k % 2 === 0 ? wx[k] - 24 : wx[k] + 16, axY[k] - 7, 24, 14, W4[k], { fs: 11, fw: 'Normal', color: CC[k] }); }
  label(c.x + 6, c.y + 4, 290, 13, 'TYRE LOAD  N, bar = share of 8000 N   (white dot = load centre)', { fs: 11, color: C.dim });
  for (k = 0; k < 4; k++) {
    var lx = k % 2 === 0 ? c.x + 6 : c.x + 244;
    livetext(lx, axY[k] - 20, 62, 18, { fs: 15, fw: 'Bold', color: C.white, ha: k % 2 === 0 ? 2 : 0 }, 'loadN', k);
    add(I.rect(lx, axY[k] + 2, 56, 7, '#1F1F25')); var lb = add(I.rect(lx, axY[k] + 2, 0, 7, CC[k]));
    I.bind(lb, 'Width', "var v = tms2('loadBar', root, " + k + "); return Math.max(2, Math.round(v * 56));"); report.live++;
  }
  add(I.image('car_top', cx - bw / 2, top, bw, bl, 'car_top')); report.images++;
  add(I.image('arrow_nose', cx - 12, top - 40, 24, 60, 'arrow_nose')); report.images++;
  var tv = add(I.image('arrow_travel', cx - 20, cy - 150, 40, 300, 'arrow_travel')); I.bind(tv, 'Rotation', tmsx('betaRot')); report.live++; report.images++;
  var dot = add(base('EllipseItem', 'LoadCentre', cx - 8, cy - 8, 16, 16, { FillColor: I.argb(C.white), EllipseColor: I.argb(C.white), EllipseThickness: 3 }));
  I.bind(dot, 'Left', "return Math.round(" + (cx - 8) + " + tms2('lcx', root, 0) * " + (bw * 0.3).toFixed(1) + ");"); I.bind(dot, 'Top', "return Math.round(" + (cy - 8) + " - tms2('lcy', root, 0) * " + (bl * 0.26).toFixed(1) + ");"); report.live += 2;
  livetext(c.x + 6, c.y + 296, 288, 16, { fs: 12, fw: 'Bold', color: C.text, ha: 1 }, 'loadShare');
})();
function base(type, name, x, y, w, h, extra) { return I.base(type, name, x, y, w, h, extra); }
(function balance() {
  var c = CV.cBal, x = c.x, y = c.y, k;
  for (k = 0; k < 9; k++) { var seg = add(I.rect(x + k * 52 + 1, y + 8, 48, 20, '#1F1F25')); B(seg, 'BackgroundColor', 'balSeg', k); }
  label(x + 2, y + 30, 90, 13, 'OVERSTEER', { fs: 11, color: C.dim }); label(x + 470 / 2 - 24, y + 30, 60, 13, 'NEUTRAL', { fs: 11, color: C.dim }); label(x + 470 - 80, y + 30, 90, 13, 'UNDERSTEER', { fs: 11, color: C.dim, ha: 2 });
})();
(function wheel() {
  var c = CV.cWheel, bs = 106;     // square box: the wheel image is a square canvas (tools/make_wheel_sq.py) so rotating it never re-fits a wide box; the wheel itself is 92 px wide in it
  add(I.rect(c.x, c.y, c.w, c.h, '#0F0F12')); label(c.x + 6, c.y + 2, 80, 13, 'STEERING', { fs: 11, color: C.dim });
  var im = add(I.image('wheel_sq', c.x + 58 - bs / 2, c.y + 54 - bs / 2, bs, bs, 'wheel')); I.bind(im, 'Rotation', tmsx('steerRot')); report.live++; report.images++;
  livetext(c.x + 6, c.y + 98, 60, 14, { fs: 12, fw: 'Bold', color: C.white }, 'steerText'); livetext(c.x + 66, c.y + 98, 52, 14, { fs: 11, color: C.dim }, 'steerRawText');
  [['THR', 'thr', C.thr], ['BRK', 'brk', C.brake], ['CLU', 'clu', '#AAB0BC']].forEach(function (d, k) {
    var x = c.x + 118 + k * 46; add(I.rect(x, c.y + 16, 34, 76, '#1F1F25')); var f = add(I.rect(x, c.y + 92, 34, 0, d[2]));
    I.bind(f, 'Height', "var v = tms2('" + d[1] + "', root, 0); return v === null ? 0 : Math.round(v * 76);"); I.bind(f, 'Top', "var v = tms2('" + d[1] + "', root, 0); return " + (c.y + 92) + " - (v === null ? 0 : Math.round(v * 76));"); report.live += 2;
    label(x + 6, c.y + 2, 30, 13, d[0], { fs: 11, color: C.dim }); livetext(x + 2, c.y + 94, 34, 14, { fs: 11, fw: 'Bold', color: C.white }, d[1] + 'Pct');
  });
})();
// (the tyre load widget moved into the top-down view)
(function att() {
  var c = CV.cAtt, sw = 190, sh = sw * 233 / 773, rw = 100, rh = rw * 305 / 462;
  add(I.rect(c.x, c.y, c.w, c.h, '#0F0F12')); label(c.x + 6, c.y + 2, 150, 13, 'SIDE: PITCH (1x)', { fs: 11, color: C.dim }); label(c.x + 6, c.y + 94, 150, 13, 'REAR: ROLL (1x)', { fs: 11, color: C.dim });
  livetext(c.x + 130, c.y + 2, 122, 13, { fs: 11, fw: 'Bold', color: C.white, ha: 2 }, 'pitchText'); livetext(c.x + 130, c.y + 94, 122, 13, { fs: 11, fw: 'Bold', color: C.white, ha: 2 }, 'rollText');
  add(I.rect(c.x + 10, c.y + 92, 236, 1, '#3A3A42')); add(I.rect(c.x + 10, c.y + 184, 236, 1, '#3A3A42'));
  var s = add(I.image('car_side_pivot', c.x + 128 - sw / 2, c.y + 92 - sh, sw, sh * 2, 'pitch_car')); I.bind(s, 'Rotation', tmsx('pitchRot')); report.live++; report.images++;
  var r = add(I.image('car_rear_pivot', c.x + 128 - rw / 2, c.y + 184 - rh, rw, rh * 2, 'roll_car')); I.bind(r, 'Rotation', tmsx('rollRot')); report.live++; report.images++;
})();
(function strategy() {
  var c = CV.cFuel, x0 = c.x + 8, w = 322;
  livetext(c.x + 8, c.y + 2, 330, 18, { fs: 14, fw: 'Bold', color: C.text }, 'raceText');
  livetext(c.x + 8, c.y + 22, 330, 32, { fs: 26, fw: 'Bold', color: C.ok }, 'fuelMargin', 0, 'rangeColor');
  add(I.rect(x0, c.y + 62, w, 22, '#26262E'));
  var fill = add(I.rect(x0, c.y + 62, 0, 22, C.ok));
  I.bind(fill, 'Width', "var f = tms2('rangeFrac', root, 0); return Math.round(f * " + w + ");"); I.bind(fill, 'BackgroundColor', tmsx('rangeColor')); report.live += 2;
  add(I.rect(x0 + w - 3, c.y + 58, 3, 30, C.white));
  label(x0, c.y + 88, 120, 13, 'NOW', { fs: 11, fw: 'SemiBold', color: C.dim }); label(x0 + w - 120, c.y + 88, 120, 13, 'FINISH', { fs: 11, fw: 'SemiBold', color: C.dim, ha: 2 });
  label(x0 + 110, c.y + 88, 110, 13, 'bar = fuel range', { fs: 11, color: '#6C6C78', ha: 1 });
})();
(function lapStats() {
  var c = CV.cBrake, x0 = c.x + 296, w = 282, y0 = c.y, k, y;
  add(I.rect(x0, y0, w, c.h, C.card)); add(I.rect(x0, y0, 3, c.h, '#3A3A42'));
  label(x0 + 10, y0 + 4, 220, 12, 'SECTORS vs BEST  (latest finished)', { fs: 11, fw: 'SemiBold', color: C.dim });
  for (k = 0; k < 3; k++) {
    y = y0 + 20 + k * 20;
    label(x0 + 10, y + 1, 24, 18, 'S' + (k + 1), { fs: 13, fw: 'Bold', color: C.dim });
    livetext(x0 + 36, y, 74, 19, { fs: 16, fw: 'Bold', color: C.white }, 'sdTime', k);
    livetext(x0 + 114, y + 3, 90, 15, { fs: 12, fw: 'Medium', color: C.dim }, 'sectorBest', k);
    livetext(x0 + 206, y, 68, 19, { fs: 16, fw: 'Bold', color: C.white, ha: 2 }, 'sdDelta', k, 'sdColor');
  }
  add(I.rect(x0 + 10, y0 + 84, w - 20, 1, '#2A2A31'));
  label(x0 + 10, y0 + 89, 150, 12, 'THEORETICAL BEST', { fs: 11, fw: 'SemiBold', color: C.dim });
  livetext(x0 + 10, y0 + 100, 150, 26, { fs: 22, fw: 'Bold', color: C.best }, 'theoText');
  livetext(x0 + 150, y0 + 106, 126, 16, { fs: 12, fw: 'Bold', color: C.text, ha: 2 }, 'theoGapText');
  livetext(x0 + 10, y0 + 123, 140, 15, { fs: 12, fw: 'Bold', color: C.text }, 'avgText');
  livetext(x0 + 150, y0 + 123, 126, 15, { fs: 12, fw: 'Bold', color: C.text, ha: 2 }, 'spreadText');
})();
(function slipStrip() {
  var g = byId.gripRow, xs = [619, 791, 963, 1135], y = g.y + g.h + 6, k, d = [['PEAK SLIP ANGLE  this lap', 'betaPeakText', null], ['TIME SLIDING  this lap', 'slideTimeText', null], ['LAST CORNER', 'cornerLastText', 'cornerLastColor'], ['CORNERS  US / OS / N', 'cornerCountText', null]];
  for (k = 0; k < 4; k++) {
    add(I.rect(xs[k], y, 166, 30, C.card));
    label(xs[k] + 8, y + 2, 156, 12, d[k][0], { fs: 11, fw: 'SemiBold', color: C.dim });
    livetext(xs[k] + 8, y + 13, 156, 17, { fs: 15, fw: 'Bold', color: C.white }, d[k][1], 0, d[k][2]);
  }
})();
(function cDeltaBrake() {
  var d = CV.cDelta, od = { min: -1, max: 1, pl: 34, pb: 13, points: 600, ms: 100, color: C.white, thick: 3, colorKey: 'deltaColor', minExpr: tmsx('deltaLo'), maxExpr: tmsx('deltaRange') };
  add(I.rect(d.x + 34, d.y + 3 + (d.h - 16) / 2, d.w - 38, 1, '#4A4A54')); chartAt(d, od, 'delta', 0, 'delta'); (function () { var p = plotRect(d, od); livetext(d.x, p.y - 2, 34, 13, { fs: 11, fw: 'SemiBold', color: C.dim }, 'deltaHiText'); label(d.x, p.y + p.h / 2 - 7, 34, 13, '0s', { fs: 11, fw: 'SemiBold', color: C.dim }); livetext(d.x, p.y + p.h - 11, 34, 13, { fs: 11, fw: 'SemiBold', color: C.dim }, 'deltaLoText'); })(); xLabels(d, od, [[0, '-60s'], [0.5, '-30'], [1, 'now']]);
  var b = { x: CV.cBrake.x, y: CV.cBrake.y, w: 286, h: CV.cBrake.h }, ob = { min: 0, max: 1, pl: 30, pb: 13, points: 100, ms: 100, color: C.brake, thick: 2 };
  chartAt(b, ob, 'brk', 0, 'brake'); yLabel(b, ob, 1, '100%'); yLabel(b, ob, 0.5, '50%'); yLabel(b, ob, 0, '0%'); xLabels(b, ob, [[0, '-10s'], [0.5, '-5'], [1, 'now']]);
  label(b.x + 34, b.y + 3, 250, 13, 'BRAKE  rolling 10 s', { fs: 11, color: C.dim }); 
  [['cOv', 'ovl'], ['cAbs', 'absAct']].forEach(function (d2) { var c2 = CV[d2[0]], o2 = { min: 0, max: 1, pl: 2, pb: 2, points: 200, ms: 100, color: C.warn, thick: 1.4 }; chartAt(c2, o2, d2[1], 0, d2[0]); });
})();

// ---------- 4. output: the main dash plus a diagnostic ladder. The metadata Title always equals the folder/file name (both known-good packages do) ----------
var IMGS = ['car_top', 'car_side_pivot', 'car_rear_pivot', 'wheel_sq', 'arrow_nose', 'arrow_travel'];
var tplDjson = JSON.parse(fs.readFileSync(path.join(root, 'template_extracted', 'test', 'test.djson'), 'utf8'));
var tplMeta = JSON.parse(fs.readFileSync(path.join(root, 'template_extracted', 'test', 'test.djson.metadata'), 'utf8'));
function imageMeta(names) {
  return names.map(function (n) {
    var buf = fs.readFileSync(path.join(root, 'dash', 'assets', n + '.png')), w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    return { Name: n, Extension: '.png', Modified: false, Optimized: true, Width: w, Height: h, Length: buf.length, MD5: crypto.createHash('md5').update(buf).digest('hex') };
  });
}
function emit(name, list, imgNames, ext, what) {
  var dir = path.join(root, 'dash', 'out', name); fs.mkdirSync(dir, { recursive: true });
  var d = JSON.parse(JSON.stringify(tplDjson));
  d.Id = crypto.randomUUID(); d.BaseWidth = 1920; d.BaseHeight = 1080; d.BackgroundColor = '#FF08080A';
  d.Screens[0].Name = 'Screen'; d.Screens[0].BackgroundColor = '#FF08080A'; d.Screens[0].Items = list; d.Images = imageMeta(imgNames);
  d.Metadata = { SettingsBuilder: { Settings: [], IsEditMode: false }, ScreenCount: 1, InGameScreensIndexs: [0], IdleScreensIndexs: [0], MainPreviewIndex: 0, IsOverlay: false, OverlaySizeWarning: false, MetadataVersion: 2, EnableOnDashboardMessaging: true, PitScreensIndexs: [], PreferredTouchMode: 0, Width: 1920, Height: 1080, DashboardVersion: '' };
  fs.writeFileSync(path.join(dir, name + '.djson'), JSON.stringify(d));
  var meta = JSON.parse(JSON.stringify(tplMeta));
  meta.Title = name; meta.Width = 1920; meta.Height = 1080; meta.OverlaySizeWarning = false;
  fs.writeFileSync(path.join(dir, name + '.djson.metadata'), JSON.stringify(meta, null, 2));
  return { name: name, items: list.length, images: imgNames, ext: ext, what: what };
}
function strip(list, types) { return list.filter(function (it) { return types.indexOf(it['$type'].split(',')[0].split('.').pop()) >= 0; }).map(function (it) { var c = JSON.parse(JSON.stringify(it)); c.Bindings = {}; return c; }); }
var variants = [
  emit('TelemetryMasterSuite', items, IMGS, true, 'the full dash: bindings and extension scripts')
];
fs.writeFileSync(path.join(root, 'build', 'maxchars.json'), JSON.stringify(MAXCH));
fs.writeFileSync(path.join(root, 'build', 'variants.json'), JSON.stringify(variants, null, 1));
fs.writeFileSync(path.join(root, 'build', 'build_report.json'), JSON.stringify({ items: items.length, report: report }, null, 1));
console.log('items:', items.length, '| live bindings:', report.live, '| charts:', report.charts, '| images:', report.images, '| plugin placeholders:', report.plugin.length, '| variants:', variants.map(function (v) { return v.name + '(' + v.items + ')'; }).join(', '));
