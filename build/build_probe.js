// Builds TMSProbe: a one-screen diagnostic dash that prints the RAW value, JS type and min/max seen of every property the main dash depends on.
// Text and rectangles only (plus a small rotation test with the two wheel images), plain $prop() bindings. Drive a lap with it (full lock both ways, full throttle, hard brake), screenshot it, and the
// unverified signs, scales and units are settled. Run after build/build_dash.js:  node build/build_probe.js && python build/package.py
var fs = require('fs'), path = require('path'), I = require('./items.js');
var root = path.join(__dirname, '..');
var main = JSON.parse(fs.readFileSync(path.join(root, 'dash/out/TelemetryMasterSuite/TelemetryMasterSuite.djson'), 'utf8'));
var LABELW = 30, NAME = 'TMSProbe', G = 'DataCorePlugin.GameData.', P = 'DataCorePlugin.GameRawData.Physics.', C = 'DataCorePlugin.Computed.', T = 'PersistantTrackerPlugin.';

function row(full, label) {
  label = label || full.replace('DataCorePlugin.GameRawData.', '').replace('DataCorePlugin.', '').replace('PersistantTrackerPlugin.', 'Tracker.');
  if (label.length > LABELW) { throw new Error('probe label too long for its box (' + label.length + ' > ' + LABELW + '): ' + label); }
  return [full, label];
}
var groups = [
  { title: 'DRIVER INPUTS  (full lock both ways, full throttle, hard brake)', rows: [
    row(P + 'SteerAngle'), row(G + 'Throttle'), row(G + 'Brake'), row(G + 'Clutch'), row(G + 'Gear'), row(G + 'SpeedKmh'), row(G + 'Rpms'), row(G + 'MaxRpm'), row(G + 'ABSActive'), row(G + 'TCActive'), row(G + 'BrakeBias') ] },
  { title: 'ATTITUDE AND VELOCITY  (units: rad or deg? axes? signs?)', rows: [
    row(P + 'Heading'), row(P + 'Pitch'), row(P + 'Roll'), row(G + 'OrientationYawVelocity', 'GameData.OrientYawVelocity'), row(P + 'AccG01'), row(P + 'AccG02'), row(P + 'AccG03'),
    row(P + 'Velocity01'), row(P + 'Velocity02'), row(P + 'Velocity03'), row(P + 'LocalVelocity01'), row(P + 'LocalVelocity02'), row(P + 'LocalVelocity03') ] },
  { title: 'TYRES AND WHEELS  (FL / FR / RL / RR = 01..04)', rows: [
    row(P + 'SlipAngle01'), row(P + 'SlipRatio01'), row(P + 'WheelSlip01'), row(P + 'WheelSlip02'), row(P + 'WheelSlip03'), row(P + 'WheelSlip04'),
    row(P + 'WheelLoad01'), row(P + 'WheelLoad02'), row(P + 'WheelLoad03'), row(P + 'WheelLoad04'),
    row(P + 'SuspensionTravel01'), row(P + 'SuspensionTravel02'), row(P + 'SuspensionTravel03'), row(P + 'SuspensionTravel04') ] },
  { title: 'TYRE TEMPS, PRESSURE, WEAR, BRAKES', rows: [
    row(P + 'TyreCoreTemperature01'), row(G + 'TyreTemperatureFrontLeftInner', 'GameData.TyreTempFL Inner'), row(G + 'TyreTemperatureFrontLeftMiddle', 'GameData.TyreTempFL Middle'), row(G + 'TyreTemperatureFrontLeftOuter', 'GameData.TyreTempFL Outer'),
    row(G + 'TyrePressureFrontLeft', 'GameData.TyrePressureFL'), row(G + 'TyreWearFrontLeft', 'GameData.TyreWearFL'),
    row(P + 'BrakeTemp01'), row(P + 'BrakeTemp02'), row(P + 'BrakeTemp03'), row(P + 'BrakeTemp04'), row(P + 'padLife01', 'Physics.padLife01 (ACC)'), row(P + 'discLife01', 'Physics.discLife01 (ACC)'), row(P + 'Turbo') ] },
  { title: 'LAP TIMING  (number, or a TimeSpan object?)', rows: [
    row(G + 'CurrentLap'), row(G + 'CompletedLaps'), row(G + 'TotalLaps'), row(G + 'RemainingLaps'), row(G + 'CurrentLapTime'), row(G + 'BestLapTime'), row(G + 'LastLapTime'), row(G + 'DeltaToSessionBest'),
    row(G + 'Sector1Time'), row(G + 'Sector2Time'), row(G + 'Sector3LastLapTime'), row(G + 'Sector1BestTime'), row(G + 'SessionTimeLeft') ] },
  { title: 'FUEL, ENGINE, SESSION', rows: [
    row(G + 'Fuel'), row(C + 'Fuel_LitersPerLap'), row(C + 'Fuel_RemainingLaps'), row(G + 'OilTemperature'), row(G + 'WaterTemperature'), row(G + 'RoadTemperature'), row(G + 'AirTemperature'),
    row(G + 'Position'), row(G + 'CarId'), row(G + 'Flag_Name'), row('DataCorePlugin.CurrentGame', 'CurrentGame'), row('DataCorePlugin.GameRawData.Graphics.gapAhead', 'Graphics.gapAhead (ACC)'), row('DataCorePlugin.GameRawData.Graphics.gapBehind', 'Graphics.gapBehind (ACC)') ] },
  { title: 'DELTA, SECTORS, LAP HISTORY  (used by the new panels)', rows: [
    row(T + 'SessionBestLiveDeltaSeconds', 'Tracker.SessionBestLiveDelta'), row(T + 'PreviousLap_00'), row(T + 'PreviousLap_01'), row(T + 'PreviousLap_04'), row(T + 'PreviousLap_00_DeltaToSessionBest', 'Tracker.PrevLap00 DeltaSB'),
    row(G + 'CurrentSectorIndex'), row(G + 'LastSectorTime'), row('DataCorePlugin.GameRawData.Graphics.CurrentSectorIndex'), row('DataCorePlugin.GameRawData.Graphics.LastSectorTime'), row(G + 'Sector1BestTime') ] },
  { title: 'RAW PEDALS AND WHEEL SPEEDS  (scale: 0..1 or 0..100?)', rows: [
    row(P + 'Gas'), row(P + 'Brake'), row(P + 'Clutch'), row(P + 'WheelAngularSpeed01'), row(P + 'WheelAngularSpeed02'), row(P + 'WheelAngularSpeed03'), row(P + 'WheelAngularSpeed04'), row('DataCorePlugin.GameRawData.Graphics.NormalizedCarPosition'), row(G + 'CarCoordinates01'), row(G + 'CarCoordinates03') ] }
];

var items = [], COLX = [24, 656, 1288], COLW = 608, ROW = 21, BANDY = [70, 420, 770];
items.push(I.text(24, 12, 1700, 34, 'TMS PROBE   raw property values and JS types - drive a lap (full lock both ways, full throttle, hard brake) and screenshot this whole screen', { fs: 22, fw: 'Bold', color: '#FFD60A' }, 'title'));
items.push(I.text(24, 40, 1700, 16, 'green = number, then the min and max seen since the dash started   amber = string or object   red = undefined (property missing in this game)', { fs: 12, color: '#8A8A94' }, 'legend'));
function pad(s, n) { while (s.length < n) { s += ' '; } return s; }
groups.forEach(function (g, gi) {
  var x = COLX[gi % 3], y = BANDY[Math.floor(gi / 3)];
  items.push(I.rect(x, y, COLW, 22, '#26262C', 'hd'));
  items.push(I.text(x + 6, y + 2, COLW - 12, 18, g.title, { fs: 13, fw: 'Bold', color: '#FFD60A', va: 1 }, 'gt'));
  g.rows.forEach(function (r, ri) {
    var yy = y + 26 + ri * ROW, lab = pad(r[1], LABELW) + ' = ', q = "'" + r[0] + "'";
    var expr = "var v = $prop(" + q + "), lo, hi;" +
      " if (v === null || v === undefined) { return '" + lab + "undefined'; }" +
      " if (typeof v !== 'number') { return '" + lab + "' + String(v) + '  [' + (typeof v) + ']'; }" +
      " if (root.lo === undefined || v < root.lo) { root.lo = v; } if (root.hi === undefined || v > root.hi) { root.hi = v; }" +
      " return '" + lab + "' + Number(v.toPrecision(5)) + '   min ' + Number(root.lo.toPrecision(4)) + '  max ' + Number(root.hi.toPrecision(4));";
    var cexpr = "var v = $prop(" + q + "); return v === null || v === undefined ? '#FFFF5A5A' : (typeof v === 'number' ? '#FF4AE06B' : '#FFFFB020');";
    var t = I.text(x + 6, yy, COLW - 12, ROW, r[1] + ' = ?', { fs: 14, color: '#D6D6DC', font: 'Consolas' }, 'p');
    I.bind(t, 'Text', expr); I.bind(t, 'TextColor', cexpr); items.push(t);
  });
});

// ---- rotation test (bottom right): wide image in a wide box above, square image in a square box below ----
var RX = COLX[2], RY = BANDY[2], ANG = [0, 45, 90, 135, 'spin'];
items.push(I.rect(RX, RY, COLW, 22, '#26262C', 'hd'));
items.push(I.text(RX + 6, RY + 2, COLW - 12, 18, 'ROTATION TEST  (does the wheel keep its shape?)  top: wide image, bottom: square image', { fs: 13, fw: 'Bold', color: '#FFD60A', va: 1 }, 'gt'));
ANG.forEach(function (ang, k) {
  var cx = RX + 4 + k * 121, lab = ang === 'spin' ? 'spin (bound)' : ang + ' deg';
  items.push(I.text(cx, RY + 25, 118, 14, 'WIDE   ' + lab, { fs: 11, color: '#8A8A94', font: 'Consolas' }, 'rl'));
  items.push(I.rect(cx + 17, RY + 62, 84, 47, '#1B1B20', 'rbox'));       // 84 px wheel, so even turned 90 degrees it stays clear of the labels above and below
  var w = I.image('wheel_moza', cx + 17, RY + 62, 84, 47, 'rot_wide');
  items.push(I.text(cx, RY + 131, 118, 14, 'SQUARE ' + lab, { fs: 11, color: '#8A8A94', font: 'Consolas' }, 'rl'));
  items.push(I.rect(cx + 10, RY + 148, 97, 97, '#1B1B20', 'rbox'));
  var q = I.image('wheel_sq', cx + 10, RY + 148, 97, 97, 'rot_sq');
  if (ang === 'spin') { I.bind(w, 'Rotation', 'return Math.round((new Date().getTime() / 10) % 360);'); I.bind(q, 'Rotation', 'return Math.round((new Date().getTime() / 10) % 360);'); }
  else { w.Rotation = ang; q.Rotation = ang; }
  items.push(w); items.push(q);
});

var d = JSON.parse(JSON.stringify(main));
var crypto = require('crypto');
function imageMeta(names) { return names.map(function (n) { var buf = fs.readFileSync(path.join(root, 'dash', 'assets', n + '.png')); return { Name: n, Extension: '.png', Modified: false, Optimized: true, Width: buf.readUInt32BE(16), Height: buf.readUInt32BE(20), Length: buf.length, MD5: crypto.createHash('md5').update(buf).digest('hex') }; }); }
d.Id = 'e1d3c6a0-5b7c-4f0e-9a41-0c5d7a1f2b90'; d.Images = imageMeta(['wheel_moza', 'wheel_sq']); d.Screens[0].Items = items; d.Screens[0].ScreenId = '0f5c2a9e-6a3d-4a77-b5e0-2c8d9b3a1e44';
var dir = path.join(root, 'dash/out', NAME); if (!fs.existsSync(dir)) { fs.mkdirSync(dir); }
fs.writeFileSync(path.join(dir, NAME + '.djson'), JSON.stringify(d));
var meta = JSON.parse(fs.readFileSync(path.join(root, 'dash/out/TelemetryMasterSuite/TelemetryMasterSuite.djson.metadata'), 'utf8')); meta.Title = NAME;
fs.writeFileSync(path.join(dir, NAME + '.djson.metadata'), JSON.stringify(meta, null, 2));
fs.writeFileSync(path.join(root, 'build', 'probe_props.json'), JSON.stringify(groups.reduce(function (a, g) { return a.concat(g.rows.map(function (r) { return r[0]; })); }, [])));
var vp = path.join(root, 'build/variants.json'), variants = JSON.parse(fs.readFileSync(vp, 'utf8')).filter(function (v) { return v.name !== NAME; });
variants.push({ name: NAME, items: items.length, images: ['wheel_moza', 'wheel_sq'], ext: false, what: 'probe: raw property values, types and min/max for the unverified signs and units' });
fs.writeFileSync(vp, JSON.stringify(variants, null, 1));
console.log(NAME, items.length, 'items,', groups.reduce(function (a, b) { return a + b.rows.length; }, 0), 'probed properties');
