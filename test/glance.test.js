// The side panel's own logic (docs/notes/DESIGN_1_4.md): flag lane, alert pop-up, balance gate and verdict, beta and band, slip tiles, per-phase corner chips, loads, tyre and
// suspension keys, bottoming, g-g dot, discs, lock-ups, the event list. Each test sets the SimHub properties it needs and reads the keys the dash formulas call (tms2 keys).
// Time is a mock clock (ctx.__now, ms); the library steps once per data frame, so time moves in 16 ms frames while the pump and the alert formula run (as on a page that shows alerts).
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var root = __dirname + '/../', G = 'DataCorePlugin.GameData.', P = 'DataCorePlugin.GameRawData.Physics.', GR = 'DataCorePlugin.GameRawData.Graphics.', SI = 'DataCorePlugin.GameRawData.StaticInfo.';
function engine() {
  var ctx = vm.createContext({ Math: Math, __now: 5000000, __p: {} });
  ctx.Date = function () { this.getTime = function () { return ctx.__now; }; };
  ['lib/physics.js', 'lib/adapters.js', 'dash/js/tms_dash.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); });
  ctx.$prop = function (n) { return ctx.__p.hasOwnProperty(n) ? ctx.__p[n] : undefined; };
  ctx.__r = [];
  vm.runInContext("tms2('gripText', [], 0); tms2('gripText', [], 0);", ctx);       // two formulas have used the library: it is shared, the pump works (as on the real dash)
  return ctx;
}
function key(ctx, k, i) { return vm.runInContext("tms2('" + k + "', __r, " + (i || 0) + ")", ctx); }
function advance(ctx, ms) { var left = ms; while (left > 0) { ctx.__now += Math.min(16, left); left -= 16; key(ctx, 'pump'); key(ctx, 'alertWord'); } }
var tests = [], fail = 0;
function t(name, f) { tests.push([name, f]); }
var WHITE = '#FFF6F6F1', INK = '#FF08080A', DEG = '°';
var AMBER = '#FFFFA31F', RED = '#FFFF4D5E', GREEN = '#FF3DF08F', BLUE = '#FF5DB3FF', VIOLET = '#FFB66DFF', MINT = '#FF7DFFC4', YELLOW = '#FFF3FF3D', FLAGBLUE = '#FF4F9BFF';
// the colour layer: st_<kind>_<vis|col|ink>. A flashing plate is on and off when sampled over time, a steady one is always on.
function st(c, kind, what, i) { return key(c, 'st_' + kind + '_' + what, i); }
function flashes(c, kind, i) { var seen = {}, k; for (k = 0; k < 16; k++) { c.__now += 40; seen[st(c, kind, 'vis', i)] = 1; } return Object.keys(seen).length === 2; }
function steady(c, kind, i) { var k; for (k = 0; k < 16; k++) { c.__now += 40; if (st(c, kind, 'vis', i) !== true) { return false; } } return true; }
function bs(c) { var o = {}; ['lane', 'chip', 'red', 'redOut', 'edgeBig', 'edgeStrip'].forEach(function (k) { o[k] = false; }); o.lane = key(c, 'flagBlockVis'); o.chip = key(c, 'flagChipVis'); o.red = key(c, 'redPlateVis'); o.redOut = key(c, 'redOutVis'); o.edgeBig = key(c, 'edgeBigVis'); o.edgeStrip = key(c, 'edgeStripVis'); return o; }

t('flags: yellow is a block with two quick flashes for 4 s, then a chip, and re-pops as a block for 2 s every 10 s; blue a block for 4 s then a chip; green only after a yellow or red clears', function () {
  var c = engine(), seen = {}, k;
  advance(c, 64); assert.strictEqual(key(c, 'flagBlockVis'), false); assert.strictEqual(key(c, 'flagChipVis'), false, 'green at the start shows nothing');
  c.__p[G + 'Flag_Name'] = 'Yellow'; c.__now += 16; key(c, 'pump');
  for (k = 0; k < 12; k++) { c.__now += 50; seen[key(c, 'flagBlockVis')] = 1; } assert.deepStrictEqual(Object.keys(seen).sort(), ['false', 'true'], 'it flashes on and off at the start');
  assert.strictEqual(key(c, 'flagWord'), 'YELLOW'); assert.strictEqual(key(c, 'flagShape', 0), c.__flagOn = key(c, 'flagBlockVis'));
  advance(c, 1500); assert.strictEqual(key(c, 'flagBlockVis'), true, 'steady after the first 600 ms');
  advance(c, 3000); assert.strictEqual(key(c, 'flagBlockVis'), false); assert.strictEqual(key(c, 'flagChipVis'), true, 'a chip after 4 s'); assert.ok(/YELLOW/.test(key(c, 'flagChipWord')));
  advance(c, 6000); assert.strictEqual(key(c, 'flagBlockVis'), true, 'the re-pop at 10 s'); advance(c, 2200); assert.strictEqual(key(c, 'flagChipVis'), true);
  c.__p[G + 'Flag_Name'] = 'Green'; advance(c, 100); assert.strictEqual(key(c, 'flagBlockVis'), true, 'green right after a yellow'); assert.strictEqual(key(c, 'flagWord'), 'GREEN'); advance(c, 1600); assert.strictEqual(key(c, 'flagBlockVis'), false);
  c.__p[G + 'Flag_Name'] = 'Blue'; advance(c, 100); assert.strictEqual(key(c, 'flagBlockVis'), true); assert.strictEqual(key(c, 'flagWord'), 'BLUE: LET PASS'); advance(c, 4000); assert.strictEqual(key(c, 'flagChipVis'), true);
});
t('flags: black flashes the block and the edge bar for 6 s, then stays steady with a thin edge strip; red takes the full lane (a flashing plate for 6 s, then an outline) and hides the alert; chequered 6 s; white 3 s', function () {
  var c = engine(), a, b, k, seen = {};
  c.__p[G + 'Flag_Name'] = 'Black'; advance(c, 80);
  for (k = 0; k < 10; k++) { c.__now += 130; seen[key(c, 'edgeBigVis')] = 1; } assert.deepStrictEqual(Object.keys(seen).sort(), ['false', 'true'], 'the big edge bar flashes');
  advance(c, 6000); assert.strictEqual(key(c, 'edgeBigVis'), false); assert.strictEqual(key(c, 'edgeStripVis'), true); assert.strictEqual(key(c, 'flagBlockVis'), true); assert.strictEqual(key(c, 'flagWord'), 'BLACK FLAG: PIT');
  c = engine(); c.__p[G + 'OilTemperature'] = 140; advance(c, 3200); assert.strictEqual(key(c, 'alertVis'), true);
  c.__p[G + 'Flag_Name'] = 'Red'; advance(c, 80); assert.strictEqual(key(c, 'alertVis'), false, 'red hides the alert lane'); a = key(c, 'redPlateVis'); b = key(c, 'redOutVis'); assert.ok(a !== b, 'plate and outline alternate');
  advance(c, 6200); assert.strictEqual(key(c, 'redPlateVis'), false); assert.strictEqual(key(c, 'redOutVis'), true, 'an outline after 6 s'); assert.strictEqual(key(c, 'flagBlockVis'), false, 'red is not the lane B block');
  c = engine(); c.__p[G + 'Flag_Name'] = 'Checkered'; advance(c, 100); assert.strictEqual(key(c, 'flagBlockVis'), true); assert.strictEqual(key(c, 'flagWord'), 'CHEQUERED'); assert.strictEqual(key(c, 'flagShape', 4), true, 'CHECKERED contains RED, it is still the chequered flag');
  advance(c, 6200); assert.strictEqual(key(c, 'flagBlockVis'), false); assert.strictEqual(key(c, 'flagChipVis'), false);
  c = engine(); c.__p[G + 'Flag_Name'] = 'White'; advance(c, 100); assert.strictEqual(key(c, 'flagBlockVis'), true); advance(c, 3200); assert.strictEqual(key(c, 'flagBlockVis'), false);
});
t('alerts: oil and water need 3 s over the limit (130 and 105) and fall back only below the lower one; the word carries the value; several alerts rotate every 2 s', function () {
  var c = engine(), seen = {}, k;
  assert.strictEqual(key(c, 'alertWord'), '');
  c.__p[G + 'OilTemperature'] = 135; advance(c, 2900); assert.strictEqual(key(c, 'alertWord'), ''); advance(c, 200); assert.strictEqual(key(c, 'alertWord'), 'OIL 135');
  c.__p[G + 'OilTemperature'] = 127; advance(c, 50); assert.strictEqual(key(c, 'alertWord'), 'OIL 127', 'between the limits it stays');
  c.__p[G + 'WaterTemperature'] = 110; advance(c, 3200);
  for (k = 0; k < 40; k++) { c.__now += 100; seen[key(c, 'alertWord')] = 1; } assert.deepStrictEqual(Object.keys(seen).sort(), ['OIL 127', 'WATER 110'], 'two alerts take turns');
  c.__p[G + 'OilTemperature'] = 100; c.__p[G + 'WaterTemperature'] = 90; advance(c, 100); assert.strictEqual(key(c, 'alertWord'), '');
});
t('alerts: brakes after 2 s over 750, a hot tyre (core over 105) and a high hot pressure (over 0.7 psi above target) name their wheel; fuel for two laps outranks nothing but is persistent', function () {
  var c = engine();
  c.__p[P + 'BrakeTemp02'] = 800; advance(c, 2100); assert.strictEqual(key(c, 'alertWord'), 'BRAKES 800');
  c.__p[P + 'BrakeTemp02'] = 300; c.__p[P + 'TyreCoreTemperature03'] = 110; advance(c, 1700); assert.strictEqual(key(c, 'alertWord'), 'TYRE HOT RL');
  c.__p[P + 'TyreCoreTemperature03'] = 90; c.__p[G + 'TyrePressureRearRight'] = 28.5; advance(c, 3200); assert.strictEqual(key(c, 'alertWord'), 'PRESS HIGH RR');
  c.__p[G + 'TyrePressureRearRight'] = 27.5; advance(c, 100); assert.strictEqual(key(c, 'alertWord'), '');
  c.__p[G + 'RemainingLaps'] = 10; c.__p['DataCorePlugin.Computed.Fuel_RemainingLaps'] = 1.8; advance(c, 100); assert.strictEqual(key(c, 'alertWord'), 'FUEL 1.8 LAPS');
  c.__p[G + 'RemainingLaps'] = 1; advance(c, 100); assert.strictEqual(key(c, 'alertWord'), '', 'enough to finish: no fuel alert');
});
t('alerts: a lock-up (3 s) outranks a slide (3 s) and a bias change (2 s), which outrank the persistent ones; momentary words are steady, a new persistent alert flashes for 3 s then stays', function () {
  var c = engine(), seen = {}, k;
  c.__p[G + 'OilTemperature'] = 140; advance(c, 3100);
  for (k = 0; k < 8; k++) { c.__now += 50; seen[key(c, 'alertVis')] = 1; } assert.deepStrictEqual(Object.keys(seen).sort(), ['false', 'true'], 'a new persistent alert flashes');
  advance(c, 3200); seen = {}; for (k = 0; k < 8; k++) { c.__now += 50; seen[key(c, 'alertVis')] = 1; } assert.deepStrictEqual(Object.keys(seen), ['true'], 'then it stays');
  c.__p[G + 'BrakeBias'] = 57.5; advance(c, 50); c.__p[G + 'BrakeBias'] = 58; advance(c, 50); assert.strictEqual(key(c, 'alertWord'), 'BIAS 58.0');
  advance(c, 2100); assert.strictEqual(key(c, 'alertWord'), 'OIL 140');
  vm.runInContext("var __beta = 0.2; tms_betaRad = function () { return __beta; };", c); advance(c, 400); assert.strictEqual(key(c, 'alertWord'), 'SLIDE 11' + DEG, 'a slide: 6 degrees for 200 ms, the word carries the peak');
  vm.runInContext("TMS_GR.gl.lockT = __now; TMS_GR.gl.lockW = 'FL';", c); assert.strictEqual(key(c, 'alertWord'), 'LOCK-UP FL');
  seen = {}; for (k = 0; k < 6; k++) { c.__now += 50; seen[key(c, 'alertVis')] = 1; } assert.deepStrictEqual(Object.keys(seen), ['true'], 'a lock-up is steady');
  vm.runInContext("__beta = 0;", c); advance(c, 3300); assert.strictEqual(key(c, 'alertWord'), 'OIL 140');
});
t('game not running: SimHub keeps the last values, and no pop-up (alert, flag, red lane, edge bar) shows until the game runs again', function () {
  var c = engine(), ok;
  c.__p[G + 'OilTemperature'] = 140; c.__p[G + 'Flag_Name'] = 'Black'; advance(c, 7000); assert.strictEqual(key(c, 'alertVis'), true, 'steady by now'); assert.strictEqual(key(c, 'flagBlockVis'), true);
  [false, 0, 'False'].forEach(function (v) {
    c.__p['DataCorePlugin.GameRunning'] = v; advance(c, 100);
    assert.strictEqual(key(c, 'alertVis'), false, 'alert hidden for ' + v); assert.strictEqual(key(c, 'flagBlockVis'), false); assert.strictEqual(key(c, 'flagChipVis'), false); assert.strictEqual(key(c, 'edgeBigVis'), false); assert.strictEqual(key(c, 'edgeStripVis'), false); assert.strictEqual(key(c, 'redPlateVis'), false);
  });
  c.__p['DataCorePlugin.GameRunning'] = true; advance(c, 100); assert.strictEqual(key(c, 'alertVis'), true); assert.strictEqual(key(c, 'flagBlockVis'), true);
  delete c.__p['DataCorePlugin.GameRunning']; advance(c, 100); assert.strictEqual(key(c, 'alertVis'), true, 'a missing property counts as running');
  // a held frame must not flash for ever: a plate that flashes while the game runs is steady while it does not
  c.__p[P + 'TyreCoreTemperature01'] = 110; assert.ok(flashes(c, 'core', 0), 'flashes while the game runs');
  c.__p['DataCorePlugin.GameRunning'] = false; advance(c, 100); assert.ok(steady(c, 'core', 0), 'steady once it stops'); assert.strictEqual(st(c, 'core', 'col', 0), RED, 'with its colour');
  c.__p['DataCorePlugin.GameRunning'] = true; advance(c, 100); assert.ok(flashes(c, 'core', 0), 'and flashes again when the game runs');
});
t('balance: in a spin (20 degrees of body slip or more) the verdict says SPIN with a flashing red plate and the cells go out, and it comes back under 20', function () {
  var c = engine(), i;
  for (i = 0; i < 4; i++) { c.__p[P + 'SlipAngle0' + (i + 1)] = i < 2 ? 0.07 : 0.035; }
  c.__p[G + 'SpeedKmh'] = 120; c.__p[P + 'AccG01'] = 1; vm.runInContext("var __beta = 0.1; tms_betaRad = function () { return __beta; };", c); advance(c, 800);
  assert.strictEqual(key(c, 'balOn'), true); assert.strictEqual(key(c, 'balVerdict'), 'UNDERSTEER');
  vm.runInContext("__beta = 0.4;", c); advance(c, 100); assert.strictEqual(key(c, 'balOn'), false, 'a spin is not understeer'); assert.strictEqual(key(c, 'balVerdict'), 'SPIN'); assert.strictEqual(key(c, 'balDelta'), '--'); assert.ok(flashes(c, 'bal', 0), 'a flashing plate'); assert.strictEqual(st(c, 'bal', 'col', 0), RED); assert.strictEqual(key(c, 'betaShow'), '22.9' + DEG, 'beta still shows');
  vm.runInContext("__beta = 0.1;", c); advance(c, 100); assert.strictEqual(key(c, 'balOn'), true);
});
t('slide: a spike under 200 ms does not show, and the slide goes into the event list when it ends with its peak angle', function () {
  var c = engine();
  vm.runInContext("var __beta = 0.2; tms_betaRad = function () { return __beta; };", c); advance(c, 100); vm.runInContext("__beta = 0.01;", c); advance(c, 200); assert.strictEqual(key(c, 'alertWord'), '');
  advance(c, 3000); vm.runInContext("__beta = 0.2;", c); advance(c, 400); vm.runInContext("__beta = 0.3;", c); advance(c, 100); vm.runInContext("__beta = 0.01;", c); advance(c, 100);
  assert.ok(/^T1  SLIDE  17\.\d°$/.test(key(c, 'evRowN', 0)), key(c, 'evRowN', 0)); assert.ok(flashes(c, 'ev', 0), 'the newest event flashes for its first 2 s'); assert.strictEqual(st(c, 'ev', 'col', 0), AMBER, 'a slide is amber');
  advance(c, 2000); assert.ok(steady(c, 'ev', 0), 'then a steady plate until it is 5 s old'); assert.strictEqual(st(c, 'ev', 'ink', 0), INK);
  advance(c, 3200); assert.strictEqual(st(c, 'ev', 'vis', 0), false); assert.strictEqual(st(c, 'ev', 'ink', 0), AMBER, 'an old event keeps its colour');
});
t('balance: always live from 20 km/h (no corner needed, a margin to let go); understeer is front minus rear slip, the cell index and plate follow it', function () {
  var c = engine(), i;
  for (i = 0; i < 4; i++) { c.__p[P + 'SlipAngle0' + (i + 1)] = i < 2 ? 0.07 : 0.035; }       // radians: front 4.0 degrees, rear 2.0
  c.__p[G + 'SpeedKmh'] = 12; c.__p[P + 'AccG01'] = 1; advance(c, 800); assert.strictEqual(key(c, 'balOn'), false, 'under 20 km/h the slip angles are noise'); assert.strictEqual(key(c, 'balVerdict'), '--'); assert.strictEqual(key(c, 'balDelta'), '--');
  c.__p[G + 'SpeedKmh'] = 30; advance(c, 800); assert.strictEqual(key(c, 'balOn'), true, 'and it is live from 20');
  c.__p[G + 'SpeedKmh'] = 120; c.__p[P + 'AccG01'] = 0.1; advance(c, 800); assert.strictEqual(key(c, 'balOn'), true, 'no lateral g needed: the balance reads on a straight too'); assert.strictEqual(key(c, 'balVerdict'), 'UNDERSTEER');
  c.__p[P + 'AccG01'] = 1; advance(c, 800); assert.strictEqual(key(c, 'balOn'), true); assert.strictEqual(key(c, 'balVerdict'), 'UNDERSTEER'); assert.strictEqual(key(c, 'balDelta'), '+2.0' + DEG); assert.strictEqual(key(c, 'balIdx'), 6);
  assert.ok(flashes(c, 'bal', 0), 'a balance 2 degrees out or more flashes its plate'); assert.strictEqual(st(c, 'bal', 'col', 0), BLUE, 'understeer is blue'); assert.strictEqual(st(c, 'cell', 'col'), BLUE, 'and so is its cell');
  var seen = {}, q; for (q = 0; q < 16; q++) { c.__now += 40; seen[key(c, 'balCellVis')] = 1; } assert.deepStrictEqual(Object.keys(seen).sort(), ['false', 'true'], 'the solid cell flashes too');
  for (i = 0; i < 4; i++) { c.__p[P + 'SlipAngle0' + (i + 1)] = i < 2 ? 0.03 : 0.06; }
  advance(c, 1500); assert.strictEqual(key(c, 'balVerdict'), 'OVERSTEER'); assert.strictEqual(key(c, 'balIdx'), 2); assert.ok(steady(c, 'bal', 0), 'under 2 degrees out the plate is steady'); assert.strictEqual(st(c, 'bal', 'col', 0), RED, 'oversteer is red'); assert.strictEqual(st(c, 'cell', 'col'), AMBER);
  for (i = 0; i < 4; i++) { c.__p[P + 'SlipAngle0' + (i + 1)] = 0.04; }
  advance(c, 1500); assert.strictEqual(key(c, 'balVerdict'), 'NEUTRAL'); assert.strictEqual(key(c, 'balIdx'), 4); assert.strictEqual(st(c, 'bal', 'vis', 0), false); assert.strictEqual(st(c, 'bal', 'ink', 0), GREEN, 'neutral is green, no plate');
  c.__p[G + 'SpeedKmh'] = 17; advance(c, 100); assert.strictEqual(key(c, 'balOn'), true, 'hysteresis: still on just under 20'); c.__p[G + 'SpeedKmh'] = 12; advance(c, 100); assert.strictEqual(key(c, 'balOn'), false);
});
t('beta and band: the number is always there, an arrow for the way the tail swings from 2 degrees, the trajectory arrow at beta times 3, a glyph and a name for grip, transition and slide', function () {
  var c = engine();
  c.__p[G + 'SpeedKmh'] = 120; c.__p[P + 'AccG01'] = 1; advance(c, 100);
  vm.runInContext("var __beta = 0.02; tms_betaRad = function () { return __beta; };", c); advance(c, 50); assert.strictEqual(key(c, 'betaShow'), '1.1' + DEG, 'a small angle still shows'); assert.strictEqual(key(c, 'betaArrowR'), false, 'but no tail arrow under 2 degrees'); assert.strictEqual(key(c, 'headRot'), 3.4, 'the trajectory arrow is turned 3 times beta');
  vm.runInContext("__beta = 0.07;", c); advance(c, 50); assert.strictEqual(key(c, 'betaShow'), '4.0' + DEG); assert.strictEqual(key(c, 'headRot'), 12, 'clockwise for a positive beta'); assert.strictEqual(key(c, 'betaArrowR'), true); assert.strictEqual(key(c, 'betaArrowL'), false);
  vm.runInContext("__beta = -0.07;", c); advance(c, 50); assert.strictEqual(key(c, 'headRot'), -12, 'anticlockwise for a negative one'); assert.strictEqual(key(c, 'betaArrowL'), true); assert.strictEqual(key(c, 'betaArrowR'), false);
  assert.strictEqual(key(c, 'bandName'), 'TRANSITION'); assert.strictEqual(key(c, 'bandGlyph'), '◐');
  vm.runInContext("__beta = 0.01;", c); advance(c, 50); assert.strictEqual(key(c, 'bandName'), 'GRIP'); assert.strictEqual(key(c, 'bandGlyph'), '●'); assert.strictEqual(st(c, 'band', 'col'), GREEN); assert.strictEqual(st(c, 'band', 'vis'), false);
  vm.runInContext("__beta = 0.2;", c); advance(c, 50); assert.strictEqual(key(c, 'bandName'), 'SLIDE'); assert.strictEqual(key(c, 'bandGlyph'), '▲'); assert.ok(flashes(c, 'band', 0), 'a slide flashes the plate and the frame round the hero'); assert.strictEqual(st(c, 'band', 'col'), RED);
  vm.runInContext("__beta = 0.2;", c); advance(c, 100); assert.strictEqual(key(c, 'betaShow'), '11.5' + DEG); assert.strictEqual(key(c, 'betaArrowR'), true); assert.strictEqual(key(c, 'headRot'), 34.4);
  vm.runInContext("__beta = 0.9;", c); advance(c, 100); assert.strictEqual(key(c, 'headRot'), 75, 'the arrow stops at 75 degrees'); vm.runInContext("__beta = -0.9;", c); advance(c, 100); assert.strictEqual(key(c, 'headRot'), -75);
  vm.runInContext("tms_betaRad = function () { return null; };", c); advance(c, 100); assert.strictEqual(key(c, 'betaShow'), '--', 'no beta known: --'); assert.strictEqual(key(c, 'headRot'), 0);
});
t('slip tiles: degrees against a fixed 0 to 8 window (160 px), a plate from 6 degrees', function () {
  var c = engine();
  c.__p[P + 'SlipAngle01'] = 0.0873; c.__p[P + 'SlipAngle02'] = 0.0349; c.__p[P + 'SlipAngle03'] = -0.14; c.__p[P + 'SlipAngle04'] = 0.1134;
  assert.strictEqual(key(c, 'slipAbsText', 0), '5.0' + DEG); assert.strictEqual(key(c, 'slipPx', 0), 100); assert.strictEqual(st(c, 'slip', 'vis', 0), false); assert.strictEqual(st(c, 'slip', 'ink', 0), AMBER, '3 to 6 degrees: amber text');
  assert.strictEqual(st(c, 'slip', 'ink', 1), MINT, 'under 3 degrees: the tyre\'s own colour (FR is mint)');
  assert.strictEqual(key(c, 'slipAbsText', 2), '8.0' + DEG); assert.strictEqual(key(c, 'slipPx', 2), 160); assert.ok(flashes(c, 'slip', 2), '8 degrees and more: a flashing plate'); assert.strictEqual(st(c, 'slip', 'col', 2), RED);
  assert.ok(steady(c, 'slip', 3), '6 to 8 degrees: a steady amber plate'); assert.strictEqual(st(c, 'slip', 'col', 3), AMBER); assert.strictEqual(st(c, 'slip', 'ink', 3), INK);
});
t('corner chips and log: the last corner with its number and the verdict and size per phase (entry, mid, exit), latched until the next corner', function () {
  var c = engine();
  assert.strictEqual(key(c, 'cnNum'), '--'); assert.strictEqual(key(c, 'cnChip', 0), 'ENTRY --'); assert.strictEqual(key(c, 'cnRow2', 0), 'no corner yet');
  vm.runInContext("TMS_GR.cn.list.push({ n: 2, v: 118, g: 1.31, p: [{ k: 'US', d: 2.4 }, { k: 'N', d: 0.3 }, { k: 'OS', d: 1.9 }] }); TMS_GR.cn.list.push({ n: 3, v: 91, g: 1.42, p: [{ k: 'US', d: 1.1 }, null, null] });", c);
  assert.strictEqual(key(c, 'cnNum'), 'T3'); assert.strictEqual(key(c, 'cnChip', 0), 'ENTRY US 1.1'); assert.strictEqual(key(c, 'cnChip', 1), 'MID --'); assert.strictEqual(st(c, 'cn', 'vis', 0), true); assert.strictEqual(st(c, 'cn', 'col', 0), BLUE, 'understeer in that phase: blue'); assert.strictEqual(st(c, 'cn', 'vis', 1), false);
  assert.strictEqual(key(c, 'cnRow2', 0), 'T3  91  1.42g  US  --  --'); assert.strictEqual(key(c, 'cnRow2', 1), 'T2  118  1.31g  US  N  OS');
});
t('loads: a bar against each tyre\'s own peak (rising gradually, fading slowly), a mark at its average, and the front-rear and left-right split', function () {
  var c = engine(), k;
  for (k = 0; k < 4; k++) { c.__p[P + 'WheelLoad0' + (k + 1)] = [3000, 3600, 2400, 3000][k]; }
  advance(c, 3000); assert.ok(key(c, 'loadFill', 0) > 0.95 && key(c, 'loadFill', 0) <= 1, 'at its own peak the bar is full: ' + key(c, 'loadFill', 0));
  assert.ok(key(c, 'loadAvgPos', 0) > 0 && key(c, 'loadAvgPos', 0) < 0.3, 'the average is slow (about 30 s): ' + key(c, 'loadAvgPos', 0));
  advance(c, 180000); assert.ok(key(c, 'loadAvgPos', 0) > 0.7 && key(c, 'loadAvgPos', 0) <= 1, 'after minutes at the peak it sits near it (the test clock gives a frame about every 45 ms): ' + key(c, 'loadAvgPos', 0));
  c.__p[P + 'WheelLoad01'] = 1500; advance(c, 50); assert.ok(Math.abs(key(c, 'loadFill', 0) - 0.5) < 0.06, 'half the peak: ' + key(c, 'loadFill', 0));
  c.__p[P + 'WheelLoad01'] = 3000; assert.strictEqual(key(c, 'loadSplitFR'), 'F 55 · R 45'); assert.strictEqual(key(c, 'loadSplitLR'), 'L 45 · R 55');
  c.__p[P + 'WheelLoad01'] = undefined; assert.strictEqual(key(c, 'loadSplitFR'), 'F -- · R --');
});
t('tyre cards: core number, bar fraction (60 to 120), glyph (below 80, 80 to 95, above 95) and plate (below 70, above 105); pressure delta glyph and plate; spread only after two laps', function () {
  var c = engine();
  c.__p[P + 'TyreCoreTemperature01'] = 89; assert.strictEqual(key(c, 'coreNum', 0), '89' + DEG); assert.ok(Math.abs(key(c, 'coreFrac', 0) - 29 / 60) < 1e-9); assert.strictEqual(key(c, 'coreGlyph', 0), '●'); assert.strictEqual(st(c, 'core', 'vis', 0), false); assert.strictEqual(st(c, 'core', 'col', 0), GREEN, 'in the window: green');
  c.__p[P + 'TyreCoreTemperature01'] = 97; assert.strictEqual(key(c, 'coreGlyph', 0), '▲'); assert.strictEqual(st(c, 'core', 'vis', 0), false); assert.strictEqual(st(c, 'core', 'col', 0), AMBER, 'warm: amber');
  c.__p[P + 'TyreCoreTemperature01'] = 108; assert.ok(flashes(c, 'core', 0), 'a tyre over 105 flashes its plate'); assert.strictEqual(st(c, 'core', 'col', 0), RED);
  c.__p[P + 'TyreCoreTemperature01'] = 66; assert.strictEqual(key(c, 'coreGlyph', 0), '▼'); assert.ok(steady(c, 'core', 0), 'a cold tyre: a steady plate'); assert.strictEqual(st(c, 'core', 'col', 0), BLUE);
  c.__p[P + 'TyreCoreTemperature01'] = 75; assert.strictEqual(st(c, 'core', 'vis', 0), false); assert.strictEqual(st(c, 'core', 'ink', 0), BLUE, 'a little cold: blue text, no plate');
  c.__p[G + 'TyrePressureFrontLeft'] = 27.1; assert.strictEqual(key(c, 'pressNum', 0), '-0.4'); assert.strictEqual(key(c, 'pressGlyph', 0), '▼'); assert.strictEqual(st(c, 'press', 'vis', 0), false);
  assert.strictEqual(st(c, 'press', 'ink', 0), AMBER, 'the number and its unit take the state colour off the plate');
  c.__p[G + 'TyrePressureFrontLeft'] = 28.4; assert.strictEqual(key(c, 'pressGlyph', 0), '▲'); assert.ok(steady(c, 'press', 0), '0.7 to 1.2 psi over: a steady plate'); assert.strictEqual(st(c, 'press', 'ink', 0), INK, 'dark on the plate'); assert.strictEqual(st(c, 'press', 'col', 0), AMBER);
  c.__p[G + 'TyrePressureFrontLeft'] = 29; assert.ok(flashes(c, 'press', 0), 'over 1.2 psi: it flashes'); assert.strictEqual(st(c, 'press', 'col', 0), RED);
  c.__p[G + 'TyreTemperatureFrontLeftInner'] = 92; c.__p[G + 'TyreTemperatureFrontLeftMiddle'] = 99; c.__p[G + 'TyreTemperatureFrontLeftOuter'] = 86;
  assert.strictEqual(key(c, 'spreadNum', 0), '--', 'no verdict before two laps'); c.__p[G + 'CompletedLaps'] = 2;
  assert.strictEqual(key(c, 'spreadNum', 0), '+10'); assert.strictEqual(key(c, 'spreadGlyph', 0), '▲'); assert.strictEqual(st(c, 'spread', 'vis', 0), true); assert.strictEqual(st(c, 'spread', 'col', 0), AMBER);
  assert.ok(Math.abs(key(c, 'treadFM', 0) - 39 / 60) < 1e-9);
  assert.strictEqual(st(c, 'tri', 'col', 0), GREEN, 'a tread zone in 80 to 100 is green'); c.__p[G + 'TyreTemperatureFrontLeftOuter'] = 112; assert.strictEqual(st(c, 'tro', 'col', 0), RED, 'over 110 is red'); c.__p[G + 'TyreTemperatureFrontLeftOuter'] = 70; assert.strictEqual(st(c, 'tro', 'col', 0), BLUE);
});
t('suspension: travel as a share of the full stroke (the game\'s figure when there is one), a bottoming count with a plate for 3 s, the lap peak, and an event; the count restarts on a new lap', function () {
  var c = engine();
  c.__p[SI + 'SuspensionMaxTravel01'] = 0.1; c.__p[P + 'SuspensionTravel01'] = 0.05; c.__p[G + 'CompletedLaps'] = 3; advance(c, 50);
  assert.ok(Math.abs(key(c, 'travelFrac', 0) - 0.5) < 1e-9); assert.strictEqual(key(c, 'bumpNVis', 0), false); assert.strictEqual(st(c, 'bump', 'vis', 0), false); assert.strictEqual(st(c, 'trav', 'col', 0), VIOLET, 'half the stroke: violet');
  c.__p[P + 'SuspensionTravel01'] = 0.092; advance(c, 50); assert.strictEqual(st(c, 'trav', 'col', 0), AMBER, 'from 90% of the stroke: amber');
  c.__p[P + 'SuspensionTravel01'] = 0.097; advance(c, 50); assert.strictEqual(st(c, 'trav', 'col', 0), RED, 'from 95%: red'); assert.ok(flashes(c, 'bump', 0), 'a bottoming flashes a red plate'); assert.strictEqual(st(c, 'bump', 'col', 0), RED); assert.strictEqual(key(c, 'bumpNVis', 0), true); assert.strictEqual(key(c, 'bumpText', 0), 'x1');
  assert.ok(/^T1  BOTTOM FL  /.test(key(c, 'evRowN', 0)), key(c, 'evRowN', 0));
  advance(c, 200); assert.strictEqual(key(c, 'bumpText', 0), 'x1', 'still pressed: one bottoming, not many'); c.__p[P + 'SuspensionTravel01'] = 0.05; advance(c, 100); c.__p[P + 'SuspensionTravel01'] = 0.098; advance(c, 50); assert.strictEqual(key(c, 'bumpText', 0), 'x2');
  assert.ok(key(c, 'travelPkFrac', 0) >= 0.97); advance(c, 3200); assert.strictEqual(st(c, 'bump', 'vis', 0), false); assert.strictEqual(key(c, 'bumpNVis', 0), true, 'the outlined count stays for the lap'); assert.strictEqual(st(c, 'bump', 'ink', 0), RED);
  c.__p[P + 'SuspensionTravel01'] = 0.05; advance(c, 50); c.__p[G + 'CompletedLaps'] = 4; advance(c, 50); assert.strictEqual(key(c, 'bumpNVis', 0), false); assert.strictEqual(key(c, 'travelPkFrac', 0) < 0.6, true);
  assert.strictEqual(key(c, 'travelStatic'), true);
  // AC: no full stroke from the game (real values: 53 to 75 mm in a lap, 71 mm and 129 mm at rest). The bar is the range seen so far, it never starts full, and nothing is counted as bottoming.
  c = engine(); c.__p[P + 'SuspensionTravel01'] = 0.071; advance(c, 50); assert.strictEqual(key(c, 'travelFrac', 0), 0, 'the first sample is not a full bar'); assert.strictEqual(key(c, 'bumpNVis', 0), false); assert.strictEqual(key(c, 'evRowN', 0), 'no events yet'); assert.strictEqual(key(c, 'travelStatic'), false);
  c.__p[P + 'SuspensionTravel01'] = 0.06; advance(c, 50); c.__p[P + 'SuspensionTravel01'] = 0.08; advance(c, 50);
  assert.ok(Math.abs(key(c, 'travelFrac', 0) - 1) < 1e-9, 'at the top of the range seen: ' + key(c, 'travelFrac', 0)); assert.strictEqual(st(c, 'bump', 'vis', 0), false); assert.strictEqual(key(c, 'bumpNVis', 0), false); assert.strictEqual(key(c, 'evRowN', 0), 'no events yet'); assert.strictEqual(st(c, 'trav', 'col', 0), VIOLET, 'AC: violet, there is no stroke to be 90% of');
  c.__p[P + 'SuspensionTravel01'] = 0.07; advance(c, 50); assert.ok(Math.abs(key(c, 'travelFrac', 0) - 0.5) < 1e-9, 'halfway in the range: ' + key(c, 'travelFrac', 0));
});
t('g-g dot: lateral g to the left or right, acceleration up, clamped to the 1.5 g ring (150 px); the lap peaks as text', function () {
  var c = engine();
  c.__p[P + 'AccG01'] = 1; c.__p[P + 'AccG03'] = 0.5; assert.strictEqual(key(c, 'ggDx'), -100); assert.strictEqual(key(c, 'ggDy'), -50);
  c.__p[P + 'AccG01'] = -2; c.__p[P + 'AccG03'] = 0; assert.strictEqual(key(c, 'ggDx'), 150); assert.strictEqual(key(c, 'ggDy'), 0);
  c.__p[P + 'AccG01'] = 3; c.__p[P + 'AccG03'] = -4; var x = key(c, 'ggDx'), y = key(c, 'ggDy'); assert.ok(Math.abs(Math.sqrt(x * x + y * y) - 150) < 1.5, x + ',' + y);
  assert.ok(/^LAT \d\.\d\d   BRK \d\.\d\d   ACC \d\.\d\d$/.test(key(c, 'gPeaksText')), key(c, 'gPeaksText'));
});
t('discs: fraction of 900 C, COLD below 300, HOT above 750 (plate), the lap peak and lap minimum (a plate below 250), front and rear means', function () {
  var c = engine();
  c.__p[P + 'BrakeTemp01'] = 612; c.__p[P + 'BrakeTemp02'] = 786; c.__p[P + 'BrakeTemp03'] = 286; c.__p[P + 'BrakeTemp04'] = 240; advance(c, 50);
  assert.ok(Math.abs(key(c, 'discFrac', 0) - 612 / 900) < 1e-9); assert.strictEqual(key(c, 'discStateWord', 0), 'OK'); assert.strictEqual(key(c, 'discGlyph', 0), '●');
  assert.strictEqual(st(c, 'disc', 'col', 0), GREEN); assert.strictEqual(st(c, 'disc', 'vis', 0), false);
  assert.strictEqual(key(c, 'discStateWord', 1), 'HOT'); assert.ok(flashes(c, 'disc', 1), 'a hot disc flashes a red plate'); assert.strictEqual(st(c, 'disc', 'col', 1), RED); assert.strictEqual(key(c, 'discStateWord', 2), 'COLD'); assert.strictEqual(key(c, 'discGlyph', 2), '▼'); assert.strictEqual(st(c, 'disc', 'col', 2), BLUE);
  c.__p[P + 'BrakeTemp04'] = 300; advance(c, 50); assert.strictEqual(key(c, 'discPeakText', 3), 'PK 300'); assert.strictEqual(key(c, 'discMinText', 3), 'MIN 240'); assert.strictEqual(st(c, 'dmin', 'vis', 3), true); assert.strictEqual(st(c, 'dmin', 'col', 3), BLUE); assert.strictEqual(st(c, 'dmin', 'vis', 0), false);
  assert.strictEqual(key(c, 'discMeanText'), 'FRONT 699   REAR 293 ' + DEG + 'C');
});
t('TC and ABS squares flash while active; the TC held for over a second goes into the event list when it lets go', function () {
  var c = engine(), seen = {}, k;
  assert.strictEqual(key(c, 'tcSolid'), false); c.__p[G + 'TCActive'] = 1; for (k = 0; k < 12; k++) { c.__now += 60; seen[key(c, 'tcSolid')] = 1; } assert.deepStrictEqual(Object.keys(seen).sort(), ['false', 'true'], 'flashes at 4 Hz'); assert.strictEqual(key(c, 'absSolid'), false);
  c.__p[G + 'TCActive'] = 0; assert.strictEqual(key(c, 'tcInk'), AMBER, 'TC is amber'); assert.strictEqual(key(c, 'absInk'), BLUE, 'ABS is blue'); advance(c, 50); assert.strictEqual(key(c, 'evRowN', 0), 'no events yet', 'a short TC is not an event');
  c.__p[G + 'TCActive'] = 1; advance(c, 1500); c.__p[G + 'TCActive'] = 0; advance(c, 50); assert.ok(/^T1  TC HELD 1\.\ds$/.test(key(c, 'evRowN', 0)), key(c, 'evRowN', 0));
});
t('g-meter on the balance page: a small ring (1.5 g is 100 px), the total g as text; and the last slide with its corner and peak, flashing for 3 s', function () {
  var c = engine();
  c.__p[P + 'AccG01'] = 1; c.__p[P + 'AccG03'] = 0.5; assert.strictEqual(key(c, 'ggSx'), -67, 'left g puts the dot left'); assert.strictEqual(key(c, 'ggSy'), -33, 'accelerating puts it up'); assert.strictEqual(key(c, 'ggMag'), '1.12 g');
  c.__p[P + 'AccG01'] = -2; c.__p[P + 'AccG03'] = 0; assert.strictEqual(key(c, 'ggSx'), 100, 'clamped to the ring'); assert.strictEqual(key(c, 'ggSy'), 0);
  c.__p[P + 'AccG01'] = 3; c.__p[P + 'AccG03'] = -4; var x = key(c, 'ggSx'), y = key(c, 'ggSy'); assert.ok(Math.abs(Math.sqrt(x * x + y * y) - 100) < 1.5, x + ',' + y);
  delete c.__p[P + 'AccG01']; assert.strictEqual(key(c, 'ggMag'), '-- g'); assert.strictEqual(key(c, 'ggSx'), 0);
  c = engine(); assert.strictEqual(key(c, 'lastSlideText'), 'LAST SLIDE  --'); assert.strictEqual(st(c, 'lsl', 'vis', 0), false);
  vm.runInContext("var __beta = 0.2; tms_betaRad = function () { return __beta; };", c); advance(c, 400); vm.runInContext("__beta = 0.3;", c); advance(c, 100); vm.runInContext("__beta = 0.01;", c); advance(c, 100);
  assert.ok(/^LAST SLIDE  T1  17\.\d°$/.test(key(c, 'lastSlideText')), key(c, 'lastSlideText')); assert.ok(flashes(c, 'lsl', 0), 'flashes for 3 s'); assert.strictEqual(st(c, 'lsl', 'col', 0), AMBER);
  advance(c, 3300); assert.strictEqual(st(c, 'lsl', 'vis', 0), false); assert.strictEqual(st(c, 'lsl', 'ink', 0), AMBER, 'then amber text, no plate'); assert.ok(/^LAST SLIDE  T1/.test(key(c, 'lastSlideText')), 'it stays until the next slide');
});
t('lock-up tiles: a lock-up counts on its wheel for the current lap (events carry the current lap, the completed laps are one lower) and keeps its tile a steady plate', function () {
  var props = require('./props'), c2 = vm.createContext({ Math: Math, __now: 7000000 }), n, p, res;
  c2.Date = function () { this.getTime = function () { return c2.__now; }; };
  ['lib/physics.js', 'lib/adapters.js', 'dash/js/tms_dash.js', 'mock/sim.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(root + f, 'utf8'), c2, { filename: f }); });
  c2.__sim = vm.runInContext('SIM.create()', c2); vm.runInContext('__sim.lap = 13;', c2); c2.__r = [];
  c2.$prop = function () { return undefined; }; vm.runInContext("tms2('gripText', [], 0); tms2('gripText', [], 0);", c2);       // two formulas have used the library: it is shared and the pump works, as on the real dash
  for (n = 0; n < 60 * 25; n++) {       // the simulated lap locks the front left wheel at about 17.5 s
    res = vm.runInContext('SIM.step(__sim, 1/60)', c2); p = props(res.frame, 'acc'); c2.__now += 16;
    c2.$prop = function (nm) { return p.hasOwnProperty(nm) ? p[nm] : undefined; };
    key(c2, 'pump');
    if (n === 60 * 15) { assert.strictEqual(key(c2, 'lockTile', 0), 'FL 0', 'before the lock-up'); }
  }
  assert.strictEqual(p['DataCorePlugin.GameData.CurrentLap'] - p['DataCorePlugin.GameData.CompletedLaps'], 1, 'the case that broke it: the current lap is one above the completed laps');
  assert.strictEqual(key(c2, 'lockTile', 0), 'FL 1'); assert.strictEqual(key(c2, 'lockTile', 1), 'FR 0');
  assert.ok(steady(c2, 'tile', 0), 'a steady plate on the wheel that locked'); assert.strictEqual(st(c2, 'tile', 'vis', 1), false);
});
t('colour: the alert block takes the colour of its kind, the flag lane the colour of its flag', function () {
  var c = engine();
  c.__p[G + 'OilTemperature'] = 140; advance(c, 3300); assert.strictEqual(key(c, 'alertWord'), 'OIL 140'); assert.strictEqual(st(c, 'alert', 'col'), RED, 'oil is red');
  c.__p[G + 'OilTemperature'] = 100; c.__p[G + 'RemainingLaps'] = 10; c.__p['DataCorePlugin.Computed.Fuel_RemainingLaps'] = 1.8; advance(c, 200); assert.strictEqual(key(c, 'alertWord'), 'FUEL 1.8 LAPS'); assert.strictEqual(st(c, 'alert', 'col'), AMBER, 'fuel is amber');
  c.__p[G + 'BrakeBias'] = 57.5; advance(c, 50); c.__p[G + 'BrakeBias'] = 58; advance(c, 50); assert.strictEqual(key(c, 'alertWord'), 'BIAS 58.0'); assert.strictEqual(st(c, 'alert', 'col'), BLUE, 'a bias change is blue');
  assert.strictEqual(st(c, 'flag', 'col'), GREEN, 'no flag counts as green (and shows nothing)');
  c.__p[G + 'Flag_Name'] = 'Yellow'; advance(c, 100); assert.strictEqual(st(c, 'flag', 'col'), YELLOW); assert.strictEqual(st(c, 'flag', 'ink'), YELLOW, 'the flag word has the colour of the flag');
  c.__p[G + 'Flag_Name'] = 'Blue'; advance(c, 100); assert.strictEqual(st(c, 'flag', 'col'), FLAGBLUE);
  c.__p[G + 'Flag_Name'] = 'Red'; advance(c, 100); assert.strictEqual(st(c, 'flag', 'col'), RED);
  c.__p[G + 'Flag_Name'] = 'Green'; advance(c, 100); assert.strictEqual(st(c, 'flag', 'col'), GREEN, 'green after a red');
  c.__p[G + 'Flag_Name'] = 'Black'; advance(c, 100); assert.strictEqual(st(c, 'flag', 'col'), WHITE, 'black is drawn as a white outline');
  assert.strictEqual(st(c, 'nothing', 'col'), WHITE, 'an unknown kind is neutral');
});
t('colour: a fresh lock-up flashes its wheel tile and the last-lock plate for 3 s, the tile then stays a steady plate while the lap\'s count is not zero', function () {
  var c = engine();
  advance(c, 50); vm.runInContext("TMS_GR.gl.lockTs[1] = __now; TMS_GR.gl.ll = { k: 'LOCK', w: 'FR', v: 140, cn: 2, t: __now };", c);
  assert.ok(flashes(c, 'tile', 1), 'the tile flashes'); assert.strictEqual(st(c, 'tile', 'col', 1), RED); assert.ok(flashes(c, 'last', 0), 'and the last-lock plate'); assert.strictEqual(st(c, 'tile', 'vis', 0), false, 'the other wheels are quiet');
  advance(c, 3200); assert.strictEqual(st(c, 'tile', 'vis', 1), false); assert.strictEqual(st(c, 'last', 'vis', 0), false); assert.strictEqual(st(c, 'last', 'ink', 0), WHITE);
});
t('colour: one colour per signal and per cluster (the library and the dash agree on the palette)', function () {
  var b = fs.readFileSync(root + 'build/build_dash.js', 'utf8'), m = /var C = \{([^}]*)\}/.exec(b), lib = vm.runInContext('TMS_SC', engine()), k, n = 0;
  assert.ok(m, 'the dash has a palette'); m[1].split(',').forEach(function (kv) { var p = kv.split(':'), name = p[0].trim(), hex = p[1].trim().replace(/'/g, ''); assert.strictEqual('#FF' + hex.slice(1), lib[name], name); n++; });
  assert.ok(n >= 11, n + ' colours compared');
});
tests.forEach(function (x) { try { x[1](); console.log('ok   ' + x[0]); } catch (e) { fail++; console.log('FAIL ' + x[0] + '\n     ' + (e.message || e).toString().split('\n').slice(0, 6).join('\n     ')); } });
process.exit(fail ? 1 : 0);
