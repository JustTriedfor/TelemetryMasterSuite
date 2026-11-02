// Renders the probe dash to HTML with the real AC values from the user's first probe screenshot (so the layout is checked against real-length numbers).
var fs = require('fs'), vm = require('vm'), path = require('path');
var root = path.join(__dirname, '..');
var d = JSON.parse(fs.readFileSync(path.join(root, 'dash/out/TMSProbe/TMSProbe.djson'), 'utf8')), items = d.Screens[0].Items;
var P = 'DataCorePlugin.GameRawData.Physics.', G = 'DataCorePlugin.GameData.', v = {};
v[P + 'SteerAngle'] = 0.19889968633651733; v[P + 'Heading'] = -2.2891812324523926; v[P + 'Pitch'] = -0.011961650103330612; v[P + 'Roll'] = -0.023894041776657104; v[P + 'AccG01'] = -1.2718770503997803; v[P + 'AccG02'] = -0.030816033482551575; v[P + 'AccG03'] = -0.16643796861171722;
v[P + 'Velocity01'] = 19.026735305786133; v[P + 'Velocity02'] = -0.2639465034008026; v[P + 'Velocity03'] = -17.154098510742188; v[P + 'WheelSlip01'] = 0.41253384947776794; v[P + 'WheelLoad01'] = 5615.30859375; v[P + 'SuspensionTravel01'] = 0.07527721673250198;
v[P + 'TyreCoreTemperature01'] = 83.45668029785156; v[P + 'BrakeTemp01'] = 490.47021484375; v[G + 'Gear'] = '2'; v[G + 'SpeedKmh'] = 92.23; v[G + 'Rpms'] = 5723; v[G + 'MaxRpm'] = 9370; v[G + 'BrakeBias'] = 62; v[G + 'Fuel'] = 44.26487350463867;
v[G + 'CurrentLapTime'] = { toString: function () { return '00:00:20.2860000'; } }; v[G + 'SessionTimeLeft'] = { toString: function () { return '-00:05:26.7380000'; } }; v[G + 'CarId'] = 'rss_gtm_protech_p92_f6'; v['DataCorePlugin.CurrentGame'] = 'AssettoCorsa';
v[G + 'TyreWearFrontLeft'] = 98.4547119140625; v[G + 'TyreTemperatureFrontLeftInner'] = 85.46; v[G + 'Flag_Name'] = '';
function css(argb) { var a = parseInt(argb.slice(1, 3), 16) / 255, r = parseInt(argb.slice(3, 5), 16), g = parseInt(argb.slice(5, 7), 16), b = parseInt(argb.slice(7, 9), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')'; }
var html = ['<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><div style="position:relative;width:1920px;height:1080px;background:#08080A;overflow:hidden;font-family:\'Bahnschrift SemiCondensed\',sans-serif">'];
items.forEach(function (it) {
  var ctx = vm.createContext({ $prop: function (n) { return v.hasOwnProperty(n) ? v[n] : undefined; } }), txt = it.Text, col = it.TextColor, root = {};
  if (it.Bindings.Text) { var f = vm.runInContext('(function(root){' + it.Bindings.Text.Formula.Expression + '})', ctx); f(root); txt = f(root); }
  if (it.Bindings.TextColor) { col = vm.runInContext('(function(root){' + it.Bindings.TextColor.Formula.Expression + '})', ctx)(root); }
  var pos = 'position:absolute;left:' + it.Left + 'px;top:' + it.Top + 'px;width:' + it.Width + 'px;height:' + it.Height + 'px;';
  if (it['$type'].indexOf('ImageItem') > 0) {
    var rot = it.Rotation || 0; if (it.Bindings.Rotation) { rot = vm.runInContext('(function(root){' + it.Bindings.Rotation.Formula.Expression + '})', ctx)(root); }
    html.push('<img src="../assets/' + it.Image + '.png" style="' + pos + 'transform:rotate(' + rot + 'deg)">');
  } else if (it['$type'].indexOf('RectangleItem') > 0) { html.push('<div style="' + pos + 'background:' + css(it.BackgroundColor) + '"></div>'); }
  else { html.push('<div style="' + pos + 'overflow:hidden;color:' + css(col) + ';font-family:\'' + it.Font + '\';font-size:' + it.FontSize + 'px;font-weight:' + (it.FontWeight === 'Bold' ? 700 : 400) + ';line-height:' + it.Height + 'px;white-space:pre">' + String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>'); }
});
html.push('</div>'); fs.writeFileSync(path.join(root, 'dash/out/preview_probe.html'), html.join('\n')); console.log('written');
