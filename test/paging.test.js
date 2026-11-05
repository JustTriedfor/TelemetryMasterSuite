// Paging must not change what a panel shows once it is on screen again. SimHub does not evaluate the formulas of a page that is not shown, so a hidden page is simulated here:
// run A evaluates every formula on every frame (all pages shown at once, as in 1.1); run B evaluates only the pump (the one formula every page carries) on every frame, and the other
// formulas only at the checkpoints (the page is shown again). At every checkpoint the two runs must show the same thing, except for the few values that are a smoothing or a
// short-time rate and are allowed to differ for a moment (listed in SETTLES, each with the reason).
//   node test/paging.test.js          check (about 40 s)
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var root = __dirname + '/../', props = require('./props'), NAME = require('../build/dash_name.js');
var builtFile = root + 'dash/out/' + NAME + '/' + NAME + '.djson', CUR = root + 'dash/js/tms_dash.js';
if (!fs.existsSync(builtFile)) { console.error('FAIL  the generated dash is missing (dash/out/' + NAME + '/). Build it first: node build/build_dash.js'); process.exit(1); }
var dash = JSON.parse(fs.readFileSync(builtFile, 'utf8')), formulas = [], seen = {}, CHECK = 200, WARM = 30;      // the dash starts on a page that shows everything; the page goes away after WARM frames
dash.Screens.forEach(function (sc) {
  sc.Items.forEach(function (it) {
    Object.keys(it.Bindings).forEach(function (p) {
      var b = it.Bindings[p], e = b.Formula && b.Formula.Expression;
      if (e && !/'perf(Hid)?'/.test(e) && !seen[e]) { seen[e] = 1; formulas.push({ name: it.Name + '.' + p, expr: e, pump: /tms2\('(betaRot|pump)'/.test(e) }); }
    });
  });
});
// formulas whose value legitimately depends on being evaluated continuously (a smoothing or a rate over the last second), by the name of the key; each has to settle within SETTLE frames
var SETTLES = {
  core: 'a low-pass filtered chart value: still about 0.002 off a moment after the page returns',
  press: 'a low-pass filtered chart value: still about 0.00005 off a moment after the page returns',
  discRate: 'a rate over the last second: needs a second of readings',
  yaw: 'a rate from the last two readings: the first value after a gap is off'
};
function engine() {
  var ctx = vm.createContext({ Math: Math, __now: 5000000 });
  ctx.Date = function () { this.getTime = function () { return ctx.__now; }; };
  [root + 'lib/physics.js', root + 'lib/adapters.js', CUR, root + 'mock/sim.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }); });
  ctx.__sim = vm.runInContext('SIM.create()', ctx);
  return ctx;
}
function step(ctx, game) { var fr = vm.runInContext('SIM.step(__sim, 1/60)', ctx).frame, p = props(fr, game); ctx.__now += 16; ctx.$prop = function (nm) { return p.hasOwnProperty(nm) ? p[nm] : undefined; }; }
// mode 'all': every formula on every frame. mode 'hidden': the pump every frame, everything else only on checkpoint frames.
function run(game, frames, mode) {
  var ctx = engine(), fns = formulas.map(function (f) { return vm.runInContext('(function(root){' + f.expr + '})', ctx); }), roots = formulas.map(function () { return []; }), out = {}, n, k, v;
  for (n = 1; n <= frames; n++) {
    step(ctx, game);
    for (k = 0; k < formulas.length; k++) {
      if (mode === 'hidden' && n > WARM && !formulas[k].pump && n % CHECK !== 0) { continue; }
      try { v = fns[k](roots[k]); } catch (e) { v = 'ERR ' + e.message; }
      if (n % CHECK === 0) { (out[formulas[k].name] = out[formulas[k].name] || []).push(String(v)); }
    }
  }
  return out;
}
var coords = [];       // bindings that return a screen position (Left or Top)
dash.Screens.forEach(function (sc) { sc.Items.forEach(function (it) { ['Left', 'Top'].forEach(function (p) { if (it.Bindings[p]) { coords.push({ name: it.Name + '.' + p, expr: it.Bindings[p].Formula.Expression, at: it[p] }); } }); }); });
var tests = [], fail = 0;
function t(name, f) { tests.push([name, f]); }
function compare(game, frames) {
  var a = run(game, frames, 'all'), b = run(game, frames, 'hidden'), bad = {}, nameKey = {};
  formulas.forEach(function (f) { nameKey[f.name] = (/tms2?r?\('([A-Za-z0-9_]+)'/.exec(f.expr) || [])[1] || f.name; });
  Object.keys(a).forEach(function (nm) { var c; for (c = 0; c < a[nm].length; c++) { if (a[nm][c] !== b[nm][c]) { bad[nameKey[nm]] = (bad[nameKey[nm]] || '') + (bad[nameKey[nm]] ? '' : 'checkpoint ' + (c + 1) + ': "' + a[nm][c] + '" shown vs "' + b[nm][c] + '" after a hidden spell'); } } });
  Object.keys(SETTLES).forEach(function (k) { delete bad[k]; });
  return bad;
}
t('after a hidden spell every panel shows what it would have shown (ACC, one lap and the lap change)', function () { assert.deepStrictEqual(compare('acc', 3800), {}); });
t('after a hidden spell every panel shows what it would have shown (AC)', function () { assert.deepStrictEqual(compare('ac', 3800), {}); });
t('coordinates: a formula that returns a screen position gives a finite number inside the canvas (the balance cell, its pointer, the g-g dot, the marks on the bars)', function () {
  var ctx = engine(), fns = coords.map(function (c) { return vm.runInContext('(function(root){' + c.expr + '})', ctx); }), roots = coords.map(function () { return []; }), n, k, v, bad = [];
  assert.ok(coords.length >= 8, 'expected the balance cell, the pointer, the g-g dot and the bar marks, found ' + coords.length);
  for (n = 1; n <= 600; n++) { step(ctx, 'acc'); for (k = 0; k < coords.length; k++) { v = fns[k](roots[k]); if (!(isFinite(v) && v >= -2 && v <= 1922) && bad.length < 6) { bad.push(coords[k].name + ': ' + v); } } }
  assert.deepStrictEqual(bad, []);
});
tests.forEach(function (x) { try { x[1](); console.log('ok   ' + x[0]); } catch (e) { fail++; console.log('FAIL ' + x[0] + '\n     ' + (e.message || e).toString().split('\n').slice(0, 40).join('\n     ')); } });
console.log(formulas.length + ' distinct formulas compared');
process.exit(fail ? 1 : 0);
