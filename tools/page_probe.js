// TMSPageProbe: a throw-away dash that answers, on the real SimHub, the questions the paging plan depends on.
//   Which formulas does SimHub evaluate: the active screen only? a foreground / background layer? a disabled screen? children of a layer whose Visible is bound to false?
//   Does SimHub's NCalc have if(), Round(), the ?: operator, format()?
// Every counting formula calls pg_hit('<key>'); the report text prints hits per second per key. ES5 on purpose, like the real dash.
// Usage: node tools/page_probe.js      writes <SimHub>/DashTemplates/TMSPageProbe/... (a new folder; nothing else is touched). Build the main dash first (node build/build_dash.js).
//        SIMHUB=D:/path/to/SimHub node tools/page_probe.js    if SimHub is not in C:/Program Files (x86)/SimHub
//        node tools/page_check.js     then opens it in SimHub's web client, switches screens and prints what runs. Delete the DashTemplates/TMSPageProbe folder afterwards.
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var REPO = path.join(__dirname, '..').replace(/\\/g, '/') + '/', I = require(REPO + 'build/items.js'), MAIN = require(REPO + 'build/dash_name.js');
var T = 'SimHub.Plugins.OutputPlugins.GraphicalDash.Models.', NAME = 'TMSPageProbe', DEST = (process.env.SIMHUB || 'C:/Program Files (x86)/SimHub').replace(/\\/g, '/') + '/DashTemplates/' + NAME + '/';
var TPL = REPO + 'template_extracted/test/';
var main = JSON.parse(fs.readFileSync(REPO + 'dash/out/' + MAIN + '/' + MAIN + '.djson', 'utf8').replace(/^\uFEFF/, ''));
var KEYS = ['A', 'LV', 'LHp', 'LH', 'SH', 'B', 'FG', 'BG', 'DISen', 'DIS'];

var EXT = [
  'var PG = { n: {}, t0: new Date().getTime(), txt: "measuring" };',
  'function pg_hit(k) { PG.n[k] = (PG.n[k] || 0) + 1; }',
  'function pg_report() {',
  '  var now = new Date().getTime(), keys = ' + JSON.stringify(KEYS) + ', i, dt, s = "";',
  '  if (now - PG.t0 >= 3000) {',
  '    dt = (now - PG.t0) / 1000;',
  '    for (i = 0; i < keys.length; i++) { s += keys[i] + " " + ((PG.n[keys[i]] || 0) / dt).toFixed(1) + "/s   "; }',
  '    PG.txt = s; PG.n = {}; PG.t0 = now;',
  '  }',
  '  return PG.txt;',
  '}',
  ''
].join('\r\n');

function ncalc(item, prop, expr) { item.Bindings[prop] = { FormatString: '', Formula: { Expression: expr }, Mode: 2 }; return item; }
function layer(name, visExpr, kids) { return { '$type': T + 'Layer, SimHub.Plugins', Group: false, Repetitions: 0, Childrens: kids, Visible: true, BlinkPhasisInverted: false, Name: name, RenderingSkip: 0, MinimumRefreshIntervalMS: 0, Bindings: visExpr ? { Visible: I.js(visExpr) } : {} }; }
function counter(key, x, y, label) { var t = I.text(x, y, 300, 22, label || key, { fs: 16, font: 'Consolas' }, 'cnt_' + key); return I.bind(t, 'Text', "pg_hit('" + key + "'); return '" + (label || key) + " alive';"); }
function title(s) { return I.text(20, 10, 1500, 30, s, { fs: 24, fw: 'Bold', color: '#FFD60A' }, 'title'); }
function report(key, extra) { var t = I.text(20, 50, 1880, 60, '', { fs: 20, font: 'Consolas', va: 0 }, 'rep'); return I.bind(t, 'Text', "pg_hit('" + key + "'); return '" + extra + "\\n' + pg_report();"); }

function screen(name, flags, items) {
  var s = JSON.parse(JSON.stringify(main.Screens[0])), k;
  s.Name = name; s.ScreenId = crypto.randomUUID(); s.Items = items;
  s.InGameScreen = !!flags.game; s.IdleScreen = false; s.PitScreen = false; s.IsForegroundLayer = !!flags.fg; s.IsBackgroundLayer = !!flags.bg; s.IsOverlayLayer = false;
  s.ScreenEnabledExpression = flags.enabled ? I.js(flags.enabled).Formula : { Expression: '' };
  return s;
}

// ---- screen A: the first screen. Layers, a statically hidden item, and the NCalc syntax checks
var A = [title('TMS PAGE PROBE   screen A (active at start)'), report('A', 'SCREEN A')];
A.push(layer('layerVisible', "return true;", [counter('LV', 20, 130, 'LV child of a layer bound visible')]));
A.push(layer('layerHidden', "pg_hit('LHp'); return false;", [counter('LH', 20, 160, 'LH child of a layer bound hidden')]));
var sh = counter('SH', 20, 190, 'SH static Visible=false'); sh.Visible = false; A.push(sh);
var NC = [
  ['if(1 == 1, \'if-ok\', \'if-bad\')', 'if()'], ['Round(3.14159, 2)', 'Round()'], ['round(3.14159, 2)', 'round()'], ['format(3.14159, \'0.00\')', 'format()'],
  ['1 == 1 ? \'tern-ok\' : \'tern-bad\'', '?: operator'], ['isnull([DataCorePlugin.NoSuchProperty], \'null-default\')', 'isnull()'], ['Floor(3.7) + Max(2, 5)', 'Floor+Max (=8)'],
  ['[DataCorePlugin.GameData.Gear]', 'plain property'], ['format([DataCorePlugin.GameData.SpeedKmh], \'0.0\')', 'format(property)']
];
NC.forEach(function (c, i) {
  A.push(I.text(20, 240 + i * 26, 360, 22, 'NCALC ' + c[1], { fs: 15, font: 'Consolas', color: '#8A8A94' }, 'ncl'));
  A.push(ncalc(I.text(400, 240 + i * 26, 600, 22, '', { fs: 15, font: 'Consolas', color: '#4AE06B' }, 'nc' + i), 'Text', c[0]));
});

// ---- screen B: a second ordinary in-game screen
var B = [title('TMS PAGE PROBE   screen B'), report('B', 'SCREEN B')];
// ---- foreground and background layers: shown with every screen
var FG = [counter('FG', 1500, 1040, 'FG foreground layer')], BG = [counter('BG', 1500, 1010, 'BG background layer')];
// ---- a disabled screen: its enable expression runs (DISen), its items must not (DIS)
var DIS = [title('TMS PAGE PROBE   disabled screen'), counter('DIS', 20, 130, 'DIS item on a disabled screen')];

var d = JSON.parse(JSON.stringify(main));
d.Id = crypto.randomUUID(); d.Images = [];
d.Screens = [screen('A', { game: true }, A), screen('B', { game: true }, B), screen('FG', { game: true, fg: true }, FG), screen('BG', { game: true, bg: true }, BG),
  screen('DIS', { game: true, enabled: "pg_hit('DISen'); return false;" }, DIS)];
var meta = JSON.parse(fs.readFileSync(REPO + 'dash/out/' + MAIN + '/' + MAIN + '.djson.metadata', 'utf8').replace(/^\uFEFF/, ''));
meta.Title = NAME; meta.Description = 'Throw-away test dash for the paging plan. Safe to delete.';

function put(rel, data) { var f = DEST + rel; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); }
put(NAME + '.djson', JSON.stringify(d));
put(NAME + '.djson.metadata', JSON.stringify(meta, null, 2));
put(NAME + '.djson.png', fs.readFileSync(TPL + 'test.djson.png'));
put(NAME + '.djson.00.png', fs.readFileSync(TPL + 'test.djson.00.png'));
put(NAME + '.djson.carclasses', fs.readFileSync(TPL + 'test.djson.carclasses'));
put('JavascriptExtensions/pgprobe.js', EXT);
console.log('wrote', DEST, 'screens:', d.Screens.map(function (s) { return s.Name; }).join(','));
