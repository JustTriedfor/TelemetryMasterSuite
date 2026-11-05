// The performance work in 1.1 must not change what the dash shows. Every formula of the built dash is run on the same simulated lap with the current library and
// its outputs are checked against what the frozen 1.0.0 library (test/fixtures/tms_dash.v1.0.0.js, every formula running its own detectors) gave: a rolling hash of
// every output, checkpointed every 100 frames, stored in test/fixtures/identity_golden.json. The current library is also run the ways SimHub might host it: formulas
// in a shuffled order, spread over several JavaScript engines (nothing shared between them), and with the kill switch (TMS_SHARE = false) that restores the 1.0.0 layout.
//   node test/identity.test.js            check (about 20 s)
//   node test/identity.test.js --record   rebuild the golden file from the 1.0.0 library (slow, about 1 minute; only needed when the formula texts change)
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var root = __dirname + '/../', props = require('./props'), NAME = require('../build/dash_name.js');
var builtFile = root + 'dash/out/' + NAME + '/' + NAME + '.djson', goldFile = root + 'test/fixtures/identity_golden.json', V1 = root + 'test/fixtures/tms_dash.v1.0.0.js', CUR = root + 'dash/js/tms_dash.js';
if (!fs.existsSync(builtFile)) { console.error('FAIL  the generated dash is missing (dash/out/' + NAME + '/). Build it first: node build/build_dash.js'); process.exit(1); }
var dash = JSON.parse(fs.readFileSync(builtFile, 'utf8')), formulas = [], STEP = 100, SCEN = { acc: 3800, ac: 1200 };       // frames per scenario: one 61 s lap plus a little (the lap change is part of the test)
[].concat.apply([], dash.Screens.map(function (s) { return s.Items; })).forEach(function (it) {       // every page
  Object.keys(it.Bindings).forEach(function (p) { var b = it.Bindings[p]; if (b.Formula && b.Formula.Expression && !/'perf(Hid)?'/.test(b.Formula.Expression)) { formulas.push({ name: it.Name + '.' + p, expr: b.Formula.Expression }); } });
});

function engine(libFile, tail) {       // one JavaScript engine: libraries and the simulator; the formulas it hosts each get their own persistent root (an Array, as in SimHub)
  var ctx = vm.createContext({ Math: Math, __now: 5000000 });
  ctx.Date = function () { this.getTime = function () { return ctx.__now; }; };
  [root + 'lib/physics.js', root + 'lib/adapters.js', libFile, root + 'mock/sim.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }); });
  if (tail) { vm.runInContext(tail, ctx); }
  ctx.__sim = vm.runInContext('SIM.create()', ctx);
  return ctx;
}
function step(ctx, game) {       // advance the simulated car one frame and publish its properties
  var fr = vm.runInContext('SIM.step(__sim, 1/60)', ctx).frame, p = props(fr, game);
  ctx.__now += 16; ctx.$prop = function (nm) { return p.hasOwnProperty(nm) ? p[nm] : undefined; };
}
function mix(h, s) { var k; for (k = 0; k < s.length; k++) { h = Math.imul(h ^ s.charCodeAt(k), 16777619) >>> 0; } return h; }
// -> { expression text: [checkpoint hash every STEP frames] }. engines = how many separate JavaScript engines host the formulas (formula k lives in engine k % engines).
function run(libFile, game, frames, engines, order, tail) {
  var hosts = [], fns, roots = [], hs = [], idx = [], out = {}, k, j, n, v, r, tmp, seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (k = 0; k < engines; k++) { hosts.push(engine(libFile, tail)); }
  fns = formulas.map(function (f, i) { return vm.runInContext('(function(root){' + f.expr + '})', hosts[i % engines]); });
  formulas.forEach(function (f, i) { roots.push([]); hs.push(2166136261); idx.push(i); out[f.expr] = out[f.expr] || []; });
  for (n = 1; n <= frames; n++) {
    hosts.forEach(function (h) { step(h, game); });
    if (order === 'shuffle') { for (j = idx.length - 1; j > 0; j--) { r = Math.floor(rnd() * (j + 1)); tmp = idx[j]; idx[j] = idx[r]; idx[r] = tmp; } }
    for (k = 0; k < formulas.length; k++) {
      j = idx[k];
      try { v = fns[j](roots[j]); } catch (e) { v = 'ERR ' + e.message; }
      hs[j] = mix(hs[j], typeof v + ':' + String(v));
    }
    if (n % STEP === 0) { formulas.forEach(function (f, i) { (out[f.expr][Math.floor(n / STEP) - 1] = out[f.expr][Math.floor(n / STEP) - 1] || []).push(hs[i]); }); }
  }
  return out;       // several formulas can share one text; each contributes its hash to the same checkpoint, so all of them must match
}
if (process.argv.indexOf('--record') >= 0) {
  var gold = {}; Object.keys(SCEN).forEach(function (g) { console.log('recording ' + g + ' (' + SCEN[g] + ' frames) with the 1.0.0 library'); gold[g] = run(V1, g, SCEN[g], 1, 'natural'); });
  fs.writeFileSync(goldFile, JSON.stringify(gold)); console.log('wrote ' + goldFile + ' for ' + formulas.length + ' formulas'); process.exit(0);
}
if (!fs.existsSync(goldFile)) { console.error('FAIL  test/fixtures/identity_golden.json is missing: node test/identity.test.js --record'); process.exit(1); }
var G = JSON.parse(fs.readFileSync(goldFile, 'utf8')), tests = [], fail = 0;
function t(name, f) { tests.push([name, f]); }
function uniq(a) { return (a || []).filter(function (h, i, all) { return all.indexOf(h) === i; }).sort(); }       // the header strip is on every page: the same formula text several times, which must all agree
// Two references. The frozen 1.0.0 library only knows the formulas the 1.0.0 dash had, and the side panel was rewritten in 1.4 (new keys), so only the formulas both dashes share can be
// compared with it (known). Every formula of the current dash is compared with the current library hosted the plain way (one engine, natural order): the hosting must not change the output.
function compare(got, ref, bad) {
  var known = 0;
  Object.keys(got).forEach(function (expr) {
    var c;
    if (!ref[expr]) { return; }
    known++;
    for (c = 0; c < got[expr].length; c++) { if (JSON.stringify(uniq(got[expr][c])) !== JSON.stringify(uniq(ref[expr][c]))) { if (bad.length < 6) { bad.push('frames ' + (c * STEP + 1) + '-' + (c * STEP + STEP) + ': ' + expr.slice(0, 90)); } break; } }
  });
  return known;
}
function check(game, frames, engines, order, tail) {       // against the frozen 1.0.0 library (the shared formulas)
  var bad = [], known = compare(run(CUR, game, frames, engines, order, tail), G[game], bad);
  assert.ok(known >= 1, 'no formula of this dash is in the golden file: nothing is compared with 1.0.0');
  return bad;
}
var BASE = {};
function checkHosting(frames, engines, order, tail) {       // against the current library hosted the plain way, for every formula
  var bad = [], base = BASE[frames] = BASE[frames] || run(CUR, 'acc', frames, 1, 'natural'), known = compare(run(CUR, 'acc', frames, engines, order, tail), base, bad);
  assert.strictEqual(known, Object.keys(base).length, 'every formula is compared');
  return bad;
}
t('same output as 1.0.0 for the formulas the dashes share, over one lap and the lap change (ACC)', function () { assert.deepStrictEqual(check('acc', SCEN.acc, 1, 'natural'), []); });
t('same output as 1.0.0 for the formulas the dashes share (AC)', function () { assert.deepStrictEqual(check('ac', SCEN.ac, 1, 'natural'), []); });
t('same output for every formula when the formulas run in a different order every frame', function () { assert.deepStrictEqual(checkHosting(1200, 1, 'shuffle'), []); });
t('same output for every formula when they are spread over 4 separate JavaScript engines (nothing shared between them)', function () { assert.deepStrictEqual(checkHosting(1200, 4, 'shuffle'), []); });
t('same output for every formula with the kill switch TMS_SHARE = false (the 1.0.0 state layout)', function () { assert.deepStrictEqual(checkHosting(1200, 1, 'natural', 'TMS_SHARE = false;'), []); });
t('the self-check line says PRIVATE while one formula uses the library and SHARED once several do', function () {
  var ctx = engine(CUR), k, txt;
  ctx.$prop = function () { return undefined; }; ctx.__r1 = []; ctx.__r2 = []; ctx.__r3 = [];
  for (k = 0; k < 3; k++) { ctx.__now += 6000; txt = vm.runInContext("tms2('perf', __r1, 0)", ctx); }
  assert.ok(/PRIVATE/.test(txt), txt);
  vm.runInContext("tms2('evRowN', __r2, 0); tms2('evRowN', __r3, 0);", ctx); ctx.__now += 6000; txt = vm.runInContext("tms2('perf', __r1, 0)", ctx);
  assert.ok(/SHARED 2/.test(txt), txt);
});
tests.forEach(function (x) { try { x[1](); console.log('ok   ' + x[0]); } catch (e) { fail++; console.log('FAIL ' + x[0] + '\n     ' + (e.message || e).toString().split('\n').slice(0, 8).join('\n     ')); } });
console.log(formulas.length + ' formulas checked against the plain hosting of the current library (and the shared ones against 1.0.0)');
process.exit(fail ? 1 : 0);
