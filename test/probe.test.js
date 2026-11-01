// Validates the generated probe dash (TMSProbe): same schema/type rules as the main dash, ES5 formulas, and the formulas return the right text for present and missing properties.
var fs = require('fs'), vm = require('vm'), assert = require('assert'), acorn = require('acorn');
var root = __dirname + '/../';
var file = root + 'dash/out/TMSProbe/TMSProbe.djson';
if (!fs.existsSync(file)) { console.log('skip  probe dash not built (node build/build_probe.js)'); process.exit(0); }
var dash = JSON.parse(fs.readFileSync(file, 'utf8')), items = dash.Screens[0].Items;
// the reference dashboards are someone else's work: local-only, not in the repo. Tests that compare against them skip when the folder is absent.
var refFile = root + 'friend_extracted/TrackThirtyTwo Race Control Dashboard Ultrawide/TrackThirtyTwo Race Control Dashboard Ultrawide.djson';
var ref = fs.existsSync(refFile) ? JSON.parse(fs.readFileSync(refFile, 'utf8')) : null, SKIP = { skip: 'reference dashboards (friend_extracted/) are local-only' };
var tests = [];
function t(name, f) { tests.push([name, f]); }
function typeOf(o) { return o['$type'].split(',')[0].split('.').pop(); }
var refKeys = {};
(function walk(o) { if (o && typeof o === 'object') { if (o['$type'] && o.Bindings !== undefined && !Array.isArray(o)) { var ty = typeOf(o); refKeys[ty] = refKeys[ty] || {}; Object.keys(o).forEach(function (k) { refKeys[ty][k] = 1; }); } for (var k in o) { walk(o[k]); } } })(ref);

t('probe: title equals folder name, 1920x1080, unique names, inside the canvas, whole-number geometry', function () {
  var meta = JSON.parse(fs.readFileSync(root + 'dash/out/TMSProbe/TMSProbe.djson.metadata', 'utf8')), names = {}, bad = [];
  assert.strictEqual(meta.Title, 'TMSProbe'); assert.strictEqual(dash.BaseWidth, 1920); assert.strictEqual(dash.BaseHeight, 1080); assert.strictEqual(dash.Images.length, 0);
  items.forEach(function (it) { assert.ok(!names[it.Name], 'dup ' + it.Name); names[it.Name] = 1;
    ['Left', 'Top', 'Width', 'Height'].forEach(function (k) { if (it[k] % 1 !== 0) { bad.push(it.Name + ' ' + k); } });
    if (it.Left < 0 || it.Top < 0 || it.Left + it.Width > 1920 || it.Top + it.Height > 1080) { bad.push(it.Name + ' outside canvas'); } });
  assert.deepStrictEqual(bad, []);
});
t('probe: every key exists in the reference dash for that item type', function () {
  if (!ref) { throw SKIP; }
  var bad = {}; items.forEach(function (it) { var allowed = refKeys[typeOf(it)]; Object.keys(it).forEach(function (k) { if (!allowed || !allowed[k]) { bad[typeOf(it) + '.' + k] = 1; } }); });
  assert.deepStrictEqual(Object.keys(bad), []);
});
t('probe: formulas are ES5 and show the raw value, the type, and "undefined" for missing properties', function () {
  var n = 0;
  items.forEach(function (it) { Object.keys(it.Bindings).forEach(function (p) {
    var e = it.Bindings[p].Formula.Expression; acorn.parse('function f(){' + e + '}', { ecmaVersion: 5 }); n++;
    function run(val, root) { var ctx = vm.createContext({ $prop: function () { return val; } }); return vm.runInContext('(function(root){' + e + '})', ctx)(root || {}); }
    if (p === 'Text') {
      assert.ok(/ = undefined$/.test(run(undefined))); assert.ok(/ = 0\.5   min 0\.5  max 0\.5$/.test(run(0.5))); assert.ok(/ = Left  \[string\]$/.test(run('Left')));
      assert.ok(/ = 00:00:20  \[object\]$/.test(run({ toString: function () { return '00:00:20'; } })));
      var rt = {}, ctx2 = vm.createContext({ $prop: function () { return ctx2.val; } }), f = vm.runInContext('(function(root){' + e + '})', ctx2), out;
      [0.2, -0.9, 1, 0.5].forEach(function (x) { ctx2.val = x; out = f(rt); }); assert.ok(/ = 0\.5   min -0\.9  max 1$/.test(out), out);
      assert.ok(out.length <= 77, 'row must fit the 596 px box at 7.7 px per character: ' + out.length);
    }
    if (p === 'TextColor') { assert.strictEqual(run(undefined), '#FFFF5A5A'); assert.strictEqual(run(1), '#FF4AE06B'); assert.strictEqual(run('x'), '#FFFFB020'); }
  }); });
  assert.ok(n >= 190, 'expected one Text and one TextColor binding per probed property, got ' + n);
});
var fail = 0;
tests.forEach(function (x) { try { x[1](); console.log('ok   ' + x[0]); } catch (e) { if (e === SKIP) { console.log('skip ' + x[0] + ' (' + SKIP.skip + ')'); } else { fail++; console.log('FAIL ' + x[0] + '\n     ' + e.message); } } });
process.exit(fail ? 1 : 0);
