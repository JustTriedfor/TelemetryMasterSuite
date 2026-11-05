// Validates the generated dash without SimHub: (1) schema vs the reference dash, (2) every formula is ES5, (3) every formula runs against
// simulated ACC and AC telemetry and returns a sane type for the property it drives, (4) geometry sanity.
var fs = require('fs'), vm = require('vm'), assert = require('assert'), acorn = require('acorn');
var root = __dirname + '/../';
var NAME = require('../build/dash_name.js'), builtFile = root + 'dash/out/' + NAME + '/' + NAME + '.djson';
// dash/out/ is build output (only the .simhubdash packages are committed), so a fresh clone has nothing to validate until it is built
if (!fs.existsSync(builtFile)) {
  console.error('FAIL  the generated dash is missing (dash/out/' + NAME + '/). Build it first, then run npm test again:\n  node build/build_dash.js\n  node build/build_probe.js\n  python build/package.py');
  process.exit(1);
}
var dash = JSON.parse(fs.readFileSync(builtFile, 'utf8'));
// the reference dashboards are someone else's work: local-only, not in the repo. Tests that compare against them skip when the folder is absent.
var refFile = root + 'friend_extracted/TrackThirtyTwo Race Control Dashboard Ultrawide/TrackThirtyTwo Race Control Dashboard Ultrawide.djson';
var ref = fs.existsSync(refFile) ? JSON.parse(fs.readFileSync(refFile, 'utf8')) : null, SKIP = { skip: 'reference dashboards (friend_extracted/) are local-only' };
var items = [].concat.apply([], dash.Screens.map(function (s) { return s.Items; }));       // every page
var tests = [];
function t(name, f) { tests.push([name, f]); }
function typeOf(o) { return o['$type'].split(',')[0].split('.').pop(); }

// reference: allowed keys and bindable properties per item type (from the friend's dash, used as a format reference only)
var refKeys = {}, refBind = {};
(function walk(o) {
  if (o && typeof o === 'object') {
    if (o['$type'] && o.Bindings !== undefined && !Array.isArray(o)) {
      var ty = typeOf(o); refKeys[ty] = refKeys[ty] || {}; refBind[ty] = refBind[ty] || {};
      Object.keys(o).forEach(function (k) { refKeys[ty][k] = 1; }); Object.keys(o.Bindings || {}).forEach(function (k) { refBind[ty][k] = 1; });
    }
    for (var k in o) { walk(o[k]); }
  }
})(ref);
// the reference never binds these on these types but they are base item properties in Dash Studio (assumed, listed in TO_VERIFY)
var ASSUMED = { Rotation: 1, Width: 1, Height: 1, Left: 1, Top: 1, Visible: 1, BackgroundColor: 1, Opacity: 1, Minimum: 1, Maximum: 1 };   // Minimum/Maximum on ChartItem: never bound in the reference (TO_VERIFY)

t('structure: 1920x1080, three pages, images registered, unique names', function () {
  assert.strictEqual(dash.BaseWidth, 1920); assert.strictEqual(dash.BaseHeight, 1080); assert.strictEqual(dash.Screens.length, 3);
  var names = {}, imgs = {}; dash.Images.forEach(function (i) { imgs[i.Name] = 1; assert.ok(i.Width > 0 && i.Height > 0 && i.Length > 0 && /^[0-9a-f]{32}$/.test(i.MD5)); });
  items.forEach(function (it) { assert.ok(!names[it.Name], 'dup name ' + it.Name); names[it.Name] = 1; if (it.Image) { assert.ok(imgs[it.Image], 'unregistered image ' + it.Image); } });
});
t('schema: every key on every item type exists in the reference dash (format conformance)', function () {
  if (!ref) { throw SKIP; }
  var bad = {};
  items.forEach(function (it) { var ty = typeOf(it), allowed = refKeys[ty]; if (!allowed) { bad['unknown type ' + ty] = 1; return; } Object.keys(it).forEach(function (k) { if (!allowed[k]) { bad[ty + '.' + k] = 1; } }); });
  assert.deepStrictEqual(Object.keys(bad), []);
});
t('schema: bound properties are ones the reference binds (or documented base properties)', function () {
  if (!ref) { throw SKIP; }
  var bad = {};
  items.forEach(function (it) { var ty = typeOf(it); Object.keys(it.Bindings).forEach(function (p) { if (!(refBind[ty] && refBind[ty][p]) && !ASSUMED[p]) { bad[ty + '.' + p] = 1; } }); });
  assert.deepStrictEqual(Object.keys(bad), []);
});
// the dash draws no pictures any more (1.4); if one comes back it must keep its picture's proportions (a turned wheel in a wide box looked stretched in SimHub)
t('images: any image item keeps the proportions of its picture', function () {
  var imgs = {}, bad = [];
  dash.Images.forEach(function (i) { imgs[i.Name] = i; });
  items.forEach(function (it) { if (!it.Image) { return; } var i = imgs[it.Image], d = (it.Width / it.Height) / (i.Width / i.Height) - 1; if (Math.abs(d) > 0.02) { bad.push(it.Name + ' ' + (d * 100).toFixed(1) + '%'); } });
  assert.deepStrictEqual(bad, []);
});
t('geometry: finite numbers, positive sizes, inside the 1920x1080 canvas', function () {
  var bad = [];
  items.forEach(function (it) { ['Left', 'Top', 'Width', 'Height'].forEach(function (k) { if (typeof it[k] !== 'number' || it[k] !== it[k]) { bad.push(it.Name + ' ' + k); } });
    if (it.Width < 0 || it.Height < 0) { bad.push(it.Name + ' negative size'); }
    if (it.Left < -2 || it.Top < -2 || it.Left + it.Width > 1922 || it.Top + it.Height > 1082) { bad.push(it.Name + ' outside canvas ' + it.Left + ',' + it.Top + ' ' + it.Width + 'x' + it.Height); } });
  assert.deepStrictEqual(bad.slice(0, 8), []);
});
// numeric types: where SimHub's own dashboards only ever store whole numbers (e.g. ChartItem.LineTickness), mine must too
t('numeric types: no decimals where every reference item holds a whole number', function () {
  if (!ref) { throw SKIP; }
  var dirs = [root + 'friend_extracted/TrackThirtyTwo Race Control Dashboard Ultrawide/'];
  ['endurance', 'halo', 'rally'].forEach(function (k) { var d = root + 'ref_extracted/' + k + '/'; if (fs.existsSync(d)) { dirs.push(d + fs.readdirSync(d)[0] + '/'); } });
  var refInt = {};
  dirs.forEach(function (d) { fs.readdirSync(d).filter(function (f) { return /\.djson$/.test(f); }).forEach(function (f) {
    (function walk(o) { if (o && typeof o === 'object') { if (o['$type'] && o.Bindings !== undefined) { var ty = typeOf(o); Object.keys(o).forEach(function (k) { if (typeof o[k] === 'number') { var key = ty + '.' + k, r = refInt[key] = refInt[key] || { n: 0, dec: 0 }; r.n++; if (o[k] % 1 !== 0) { r.dec++; } } }); } for (var k in o) { walk(o[k]); } } })(JSON.parse(fs.readFileSync(d + f, 'utf8')));
  }); });
  var bad = {};
  items.forEach(function (it) { var ty = typeOf(it); Object.keys(it).forEach(function (k) { if (typeof it[k] === 'number' && it[k] % 1 !== 0) { var r = refInt[ty + '.' + k]; if (!r || (r.n >= 3 && r.dec === 0)) { bad[ty + '.' + k] = it[k]; } } }); });
  assert.deepStrictEqual(bad, {});
});
// Bahnschrift SemiCondensed Bold is about 0.42 to 0.45 em per character; the check uses 0.5, so it keeps a margin
// SimHub clips a Text item to its box: every live text box must fit the longest string its key can produce (build/maxchars.json, written by the builder)
t('live text boxes are wide enough for the longest value of their key (SimHub clips text to the box)', function () {
  var maxch = JSON.parse(fs.readFileSync(root + 'build/maxchars.json', 'utf8')), bad = [];
  items.forEach(function (it) { if (typeOf(it) !== 'TextItem' || !it.Bindings.Text) { return; } var m = /tms2?\('([A-Za-z0-9]+)'/.exec(it.Bindings.Text.Formula.Expression); if (!m || !maxch[m[1]]) { return; }
    var need = Math.ceil(maxch[m[1]].length * it.FontSize * 0.5); if (it.Width + 6 < need) { bad.push(it.Name + ' ' + m[1] + ' needs ' + need + ' has ' + it.Width + ' (fs ' + it.FontSize + ')'); } });
  assert.deepStrictEqual(bad.slice(0, 12), []);
});
var formulas = [];
items.forEach(function (it) { Object.keys(it.Bindings).forEach(function (p) { formulas.push({ item: it, prop: p, expr: it.Bindings[p].Formula.Expression, type: typeOf(it) }); }); });
t('every formula is a JS formula with JSExt and parses as ES5', function () {
  var bad = [];
  formulas.forEach(function (f) { var b = f.item.Bindings[f.prop]; if (b.Formula.Interpreter !== 1 || b.Formula.JSExt !== 1 || b.Mode !== 2) { bad.push(f.item.Name + '.' + f.prop + ' flags'); }
    try { acorn.parse('function f(root){' + f.expr + '}', { ecmaVersion: 5 }); } catch (e) { bad.push(f.item.Name + '.' + f.prop + ': ' + e.message); }
    if (!/\breturn\b/.test(f.expr)) { bad.push(f.item.Name + '.' + f.prop + ' has no return'); } });
  assert.deepStrictEqual(bad.slice(0, 5), []);
});

// ---- run all formulas against simulated telemetry
var props = require('./props');
function runAll(game, frames, unknown) {
  var ctx = vm.createContext({ Math: Math, __now: 5000000 }); ctx.Date = function () { this.getTime = function () { return ctx.__now; }; };
  ['lib/physics.js', 'lib/adapters.js', 'dash/js/tms_dash.js', 'mock/sim.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); });
  var sim = vm.runInContext('SIM.create()', ctx), fns = formulas.map(function (f) { return { f: f, fn: vm.runInContext('(function(root){' + f.expr + '})', ctx), root: {} }; });
  var errors = [], kinds = {}, n, k, res, fr, p;
  for (n = 0; n < frames; n++) {
    ctx.__sim = sim; res = vm.runInContext('SIM.step(__sim, 1/60)', ctx); fr = res.frame; p = unknown ? { 'DataCorePlugin.CurrentGame': 'SomeOtherSim' } : props(fr, game); ctx.__now += 16;
    ctx.$prop = function (nm) { return p.hasOwnProperty(nm) ? p[nm] : undefined; };
    for (k = 0; k < fns.length; k++) {
      var r; try { r = fns[k].fn(fns[k].root); } catch (e) { errors.push(fns[k].f.item.Name + '.' + fns[k].f.prop + ': ' + e.message); continue; }
      var prop = fns[k].f.prop, key = fns[k].f.type + '.' + prop;
      if (/Color$/.test(prop) && prop !== 'BackgroundColor' || prop === 'BackgroundColor') { if (typeof r !== 'string' || !/^#[0-9A-Fa-f]{8}$/.test(r)) { errors.push(key + ' not a colour: ' + r); } }
      else if (prop === 'Visible') { if (typeof r !== 'boolean') { errors.push(key + ' visibility is not true or false: ' + r + ' (' + fns[k].f.item.Name + ')'); } }
      else if (prop === 'Text') { if (!(typeof r === 'string' || typeof r === 'number')) { errors.push(key + ' text type ' + typeof r + ' (' + fns[k].f.item.Name + ')'); } }
      else if (typeof r !== 'number' || r !== r || r === Infinity || r === -Infinity) { if (!(r === null && prop === 'CurrentValue')) { errors.push(key + ' not a finite number: ' + r + ' (' + fns[k].f.item.Name + ')'); } else { kinds['null chart value ' + fns[k].f.item.Name] = 1; } }
    }
  }
  return { errors: errors, nullCharts: Object.keys(kinds) };
}
t('ACC: all formulas run for 500 frames, colours/text/numbers have the right type', function () { var r = runAll('acc', 500); assert.deepStrictEqual(r.errors.slice(0, 6), []); });
t('AC: all formulas run for 500 frames without errors', function () { var r = runAll('ac', 500); assert.deepStrictEqual(r.errors.slice(0, 6), []); });
t('unknown game: no formula throws and none returns a bad type', function () { var r = runAll('acc', 60, true); assert.deepStrictEqual(r.errors.slice(0, 6), []); });

var fail = 0;
tests.forEach(function (x) { try { x[1](); console.log('ok   ' + x[0]); } catch (e) { if (e === SKIP) { console.log('skip ' + x[0] + ' (' + SKIP.skip + ')'); } else { fail++; console.log('FAIL ' + x[0] + '\n     ' + e.message); } } });
console.log(formulas.length + ' formulas checked across ' + items.length + ' items');
process.exit(fail ? 1 : 0);
