// Renders the generated dash to HTML by evaluating every binding against the simulated lap (ACC or AC).
// This is a model of what SimHub should draw, not SimHub itself. Usage: node build/preview.js [acc|ac] [seconds-into-lap] [scenario] [page 1-3]
var fs = require('fs'), vm = require('vm'), path = require('path');
var root = path.join(__dirname, '..');
var game = process.argv[2] || 'acc', target = parseFloat(process.argv[3] || '25.5'), scenario = process.argv[4] || '', pageNo = +(process.argv[5] || 1);
var dash = JSON.parse(fs.readFileSync(path.join(root, 'dash/out', require('./dash_name.js'), require('./dash_name.js') + '.djson'), 'utf8'));
var items = dash.Screens[pageNo - 1].Items;

// reuse the property faker from the validation test
var props = require('../test/props.js');

var ctx = vm.createContext({ Math: Math, __now: 7000000 }); ctx.Date = function () { this.getTime = function () { return ctx.__now; }; };
['lib/physics.js', 'lib/adapters.js', 'dash/js/tms_dash.js', 'mock/sim.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); });
var sim = vm.runInContext('SIM.create()', ctx); ctx.__sim = sim;
vm.runInContext('__sim.lap = 13;', ctx);
var fns = [];
items.forEach(function (it) { Object.keys(it.Bindings).forEach(function (p) { fns.push({ it: it, p: p, fn: vm.runInContext('(function(root){' + it.Bindings[p].Formula.Expression + '})', ctx), root: {}, last: -1e9 }); }); });
var series = {}, vals = {};     // chart name -> samples ; item name -> {prop: value}
var steps = Math.round(target * 60) + 60 * 8, n, k, res, p, fr;
for (n = 0; n < steps; n++) {
  res = vm.runInContext('SIM.step(__sim, 1/60)', ctx); fr = res.frame; p = props(fr, game); ctx.__now += 16;
  if (scenario === 'practice') {      // lap 1 of a practice session on a banked corner: no best lap, no lap count, negative session time, absolute roll 14 degrees
    var G = 'DataCorePlugin.GameData.'; delete p[G + 'DeltaToSessionBest']; p[G + 'BestLapTime'] = 0; p[G + 'LastLapTime'] = 0; p[G + 'CurrentLap'] = 1; p[G + 'CompletedLaps'] = 0; p[G + 'TotalLaps'] = 0; p[G + 'RemainingLaps'] = 0; p[G + 'SessionTimeLeft'] = -517;
    p[G + 'Sector1Time'] = 180.27; p[G + 'Sector2Time'] = 0; p[G + 'Sector3LastLapTime'] = 0; p[G + 'Sector1BestTime'] = 0; p[G + 'Fuel'] = 43.1; p['DataCorePlugin.Computed.Fuel_LitersPerLap'] = 11.17; p['DataCorePlugin.Computed.Fuel_RemainingLaps'] = 43.1 / 11.17;
    p['DataCorePlugin.GameRawData.Physics.Roll'] = 0.245; p['DataCorePlugin.GameRawData.Physics.Pitch'] = -0.08;
  }
  if (/^flag:/.test(scenario) && n > steps - 150) { p['DataCorePlugin.GameData.Flag_Name'] = scenario.slice(5); }       // flag:Yellow ... the flag is raised for the last 2.5 s
  if (scenario === 'alert') { var G2 = 'DataCorePlugin.GameData.'; p[G2 + 'MaxRpm'] = 8000; p[G2 + 'Rpms'] = 7700; p[G2 + 'Flag_Name'] = 'Yellow'; p[G2 + 'OilTemperature'] = 131; p[G2 + 'DeltaToSessionBest'] = -0.62; p[G2 + 'TCActive'] = 1; p[G2 + 'ABSActive'] = 0; }       // a busy moment for the glance page: near the shift point, a yellow flag, hot oil, faster than the best lap, TC working
  ctx.$prop = function (nm) { return p.hasOwnProperty(nm) ? p[nm] : undefined; };
  for (k = 0; k < fns.length; k++) {
    var f = fns[k], isChartVal = f.it['$type'].indexOf('ChartItem') > 0 && f.p === 'CurrentValue';
    if (isChartVal) { if (ctx.__now - f.last < (f.it.MinimumRefreshIntervalMS || 16)) { continue; } f.last = ctx.__now; }
    var r; try { r = f.fn(f.root); } catch (e) { r = null; }
    vals[f.it.Name] = vals[f.it.Name] || {}; vals[f.it.Name][f.p] = r;
    if (isChartVal) { var s = series[f.it.Name] = series[f.it.Name] || []; s.push(r); if (s.length > f.it.PointsCount) { s.shift(); } }
  }
}
function css(argb) { var a = parseInt(argb.slice(1, 3), 16) / 255, r = parseInt(argb.slice(3, 5), 16), g = parseInt(argb.slice(5, 7), 16), b = parseInt(argb.slice(7, 9), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')'; }
var html = ['<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><div style="position:relative;width:1920px;height:1080px;background:#08080A;overflow:hidden;font-family:\'Bahnschrift SemiCondensed\',\'Segoe UI\',sans-serif">'];
items.forEach(function (it) {
  var v = vals[it.Name] || {}, ty = it['$type'].split(',')[0].split('.').pop();
  if (v.Visible === false || it.Visible === false) { return; }       // a bound or fixed Visible = false draws nothing
  var L = v.Left !== undefined ? v.Left : it.Left, Tp = v.Top !== undefined ? v.Top : it.Top, W = v.Width !== undefined ? v.Width : it.Width, H = v.Height !== undefined ? v.Height : it.Height;
  var pos = 'position:absolute;left:' + L + 'px;top:' + Tp + 'px;width:' + W + 'px;height:' + H + 'px;';
  if (ty === 'RectangleItem') { html.push('<div style="' + pos + 'background:' + css(v.BackgroundColor || it.BackgroundColor) + '"></div>'); }
  else if (ty === 'TextItem') {
    var al = ['left', 'center', 'right'][it.HorizontalAlignment] || 'left', txt = v.Text !== undefined ? v.Text : it.Text;
    html.push('<div style="' + pos + 'color:' + css(v.TextColor || it.TextColor) + ';font-size:' + it.FontSize + 'px;font-weight:' + ({ Bold: 700, SemiBold: 600, Medium: 500, Normal: 400 }[it.FontWeight] || 400) + ';text-align:' + al + ';line-height:' + H + 'px;white-space:nowrap">' + String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>');
  } else if (ty === 'ImageItem') { html.push('<img src="../assets/' + it.Image + '.png" style="' + pos + 'transform:rotate(' + (v.Rotation || 0) + 'deg)">'); }
  else if (ty === 'EllipseItem') { html.push('<div style="' + pos + 'border:' + (it.EllipseThickness || 3) + 'px solid ' + css(it.EllipseColor) + ';background:' + css(it.FillColor || '#00000000') + ';border-radius:50%;box-sizing:border-box"></div>'); }
  else if (ty === 'ChartItem') {
    var s = series[it.Name] || [], lo = v.Minimum !== undefined ? v.Minimum : it.Minimum, hi = v.Maximum !== undefined ? v.Maximum : it.Maximum, pts = [], i;
    for (i = 0; i < s.length; i++) { if (s[i] === null) { continue; } var x = 10 + (it.PointsCount - s.length + i) / (it.PointsCount - 1) * (it.Width - 20), y = 10 + (1 - (Math.max(lo, Math.min(hi, s[i])) - lo) / (hi - lo)) * (it.Height - 20); pts.push(x.toFixed(1) + ',' + y.toFixed(1)); }
    html.push('<svg style="' + pos + 'overflow:visible"><polyline fill="none" stroke="' + css(v.LineColor || it.LineColor) + '" stroke-width="' + it.LineTickness + '" points="' + pts.join(' ') + '"/></svg>');
  }
});
html.push('</div>');
var out = path.join(root, 'dash/out/preview_' + game + (scenario ? '_' + scenario.replace(/\W+/g, '_') : '') + (pageNo > 1 ? '_p' + pageNo : '') + '.html'); fs.writeFileSync(out, html.join('\n'));
console.log('preview written', out, 'items', items.length, 'chart series', Object.keys(series).length);
