// Builds TMSProbe: a one-screen diagnostic dash that prints the RAW value, JS type and min/max seen of every property the main dash depends on.
// Text and rectangles only, plain $prop() bindings. Drive a lap with it (full lock both ways, full throttle, hard brake), screenshot it, and the
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
  { title: 'DELTA, SECTORS, LAP HISTORY  (names in the catalog, values unknown)', rows: [
    row(T + 'SessionBestLiveDeltaSeconds', 'Tracker.SessionBestLiveDelta'), row(T + 'SessionBestLiveDeltaProgressSeconds', 'Tracker.SessionBestDeltaProg'), row(T + 'AllTimeBestLiveDeltaSeconds', 'Tracker.AllTimeBestLiveDelta'), row(T + 'PreviousLap_00'), row(T + 'PreviousLap_01'), row(T + 'SessionBest'),
    row(G + 'CurrentSectorIndex'), row(G + 'LastSectorTime'), row(G + 'Sector1LastLapTime'), row(G + 'Sector2LastLapTime') ] },
  { title: 'RAW PEDALS AND WHEEL SPEEDS  (scale: 0..1 or 0..100?)', rows: [
    row(P + 'Gas'), row(P + 'Brake'), row(P + 'Clutch'), row(P + 'WheelAngularSpeed01'), row(P + 'WheelAngularSpeed02'), row(P + 'WheelAngularSpeed03'), row(P + 'WheelAngularSpeed04'), row(P + 'RideHeight01'), row(P + 'Gear'), row(P + 'Rpms') ] },
  { title: 'SESSION AND CAR', rows: [
    row(G + 'SessionTypeName'), row(G + 'TrackName'), row(G + 'TrackCode'), row(G + 'CarModel'), row(G + 'CarClass'), row(G + 'IsInPit'), row(G + 'IsInPitLane'), row(G + 'PitLimiterOn'), row(G + 'LapInvalidated') ] }
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

var d = JSON.parse(JSON.stringify(main));
d.Id = 'e1d3c6a0-5b7c-4f0e-9a41-0c5d7a1f2b90'; d.Images = []; d.Screens[0].Items = items; d.Screens[0].ScreenId = '0f5c2a9e-6a3d-4a77-b5e0-2c8d9b3a1e44';
var dir = path.join(root, 'dash/out', NAME); if (!fs.existsSync(dir)) { fs.mkdirSync(dir); }
fs.writeFileSync(path.join(dir, NAME + '.djson'), JSON.stringify(d));
var meta = JSON.parse(fs.readFileSync(path.join(root, 'dash/out/TelemetryMasterSuite/TelemetryMasterSuite.djson.metadata'), 'utf8')); meta.Title = NAME;
fs.writeFileSync(path.join(dir, NAME + '.djson.metadata'), JSON.stringify(meta, null, 2));
fs.writeFileSync(path.join(root, 'build', 'probe_props.json'), JSON.stringify(groups.reduce(function (a, g) { return a.concat(g.rows.map(function (r) { return r[0]; })); }, [])));
var vp = path.join(root, 'build/variants.json'), variants = JSON.parse(fs.readFileSync(vp, 'utf8')).filter(function (v) { return v.name !== NAME; });
variants.push({ name: NAME, items: items.length, images: [], ext: false, what: 'probe: raw property values, types and min/max for the unverified signs and units' });
fs.writeFileSync(vp, JSON.stringify(variants, null, 1));
console.log(NAME, items.length, 'items,', groups.reduce(function (a, b) { return a + b.rows.length; }, 0), 'probed properties');
