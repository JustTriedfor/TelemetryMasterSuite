// Tests for dash/js/tms_dash.js: runs it in a sandbox with a fake $prop built from the simulated lap (real ACC catalog names).
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var root = __dirname + '/../';
function load(ctx, f) { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); }

function makeCtx(props) {
  var ctx = vm.createContext({ console: console, Math: Math, __now: 1000000 });
  ctx.Date = function () { this.getTime = function () { return ctx.__now; }; };
  ctx.$prop = function (n) { return props.hasOwnProperty(n) ? props[n] : undefined; };
  load(ctx, 'lib/physics.js'); load(ctx, 'lib/adapters.js'); load(ctx, 'dash/js/tms_dash.js'); load(ctx, 'mock/sim.js');
  return ctx;
}
var POS = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'];
function accProps(f) {
  var P = 'DataCorePlugin.GameRawData.Physics.', G = 'DataCorePlugin.GameData.', p = {}, i;
  p['DataCorePlugin.CurrentGame'] = 'AssettoCorsaCompetizione'; p['TemperatureUnit'] = 'Celsius';
  p[G + 'Throttle'] = f.throttle * 100; p[G + 'Brake'] = f.brake * 100; p[G + 'Clutch'] = 0; p[G + 'Gear'] = String(f.gear); p[G + 'SpeedKmh'] = f.speed * 3.6;
  p[G + 'Rpms'] = f.rpm; p[G + 'MaxRpm'] = f.maxRpm; p[G + 'ABSActive'] = f.absActive; p[G + 'TCActive'] = f.tcActive; p[G + 'OrientationYawVelocity'] = f.yawRate;
  p[G + 'DeltaToSessionBest'] = 0.355; p[G + 'CurrentLapTime'] = 26.2; p[G + 'BestLapTime'] = 60.62; p[G + 'LastLapTime'] = 61.4; p[G + 'CurrentLap'] = 13; p[G + 'CompletedLaps'] = 12;
  p[G + 'Fuel'] = f.fuel; p[G + 'OilTemperature'] = f.oilTemp; p[G + 'WaterTemperature'] = f.waterTemp; p[G + 'Position'] = 4; p[G + 'RemainingLaps'] = 22; p[G + 'CarId'] = 'mock';
  p[G + 'SessionTimeLeft'] = 1774; p[G + 'RoadTemperature'] = 38; p[G + 'AirTemperature'] = 24; p[G + 'Flag_Name'] = '';
  p['DataCorePlugin.Computed.Fuel_LitersPerLap'] = 2.41; p['DataCorePlugin.Computed.Fuel_RemainingLaps'] = 16.1;
  p['DataCorePlugin.GameRawData.Graphics.gapAhead'] = 2200; p['DataCorePlugin.GameRawData.Graphics.gapBehind'] = 2200;
  p[G + 'Sector1Time'] = 20.0; p[G + 'Sector2Time'] = 20.2; p[G + 'Sector3LastLapTime'] = 20.4; p[G + 'Sector1BestTime'] = 19.9; p[G + 'Sector2BestTime'] = 20.2; p[G + 'Sector3BestLapTime'] = 20.4;
  p[P + 'LocalVelocity01'] = f.vel[0]; p[P + 'LocalVelocity02'] = f.vel[1]; p[P + 'LocalVelocity03'] = f.vel[2];
  p[P + 'AccG01'] = f.latG; p[P + 'AccG03'] = f.longG; p[P + 'SteerAngle'] = f.steer / 0.45; p[P + 'Pitch'] = f.pitch; p[P + 'Roll'] = f.roll; p[P + 'Turbo'] = f.turbo;
  for (i = 0; i < 4; i++) {
    var n = '0' + (i + 1);
    p[P + 'SlipAngle' + n] = f.slipAngle[i]; p[P + 'SlipRatio' + n] = f.slipRatio[i]; p[P + 'WheelLoad' + n] = f.tyreLoad[i]; p[P + 'SuspensionTravel' + n] = f.suspTravel[i];
    p[P + 'TyreCoreTemperature' + n] = f.tyreCore[i]; p[P + 'BrakeTemp' + n] = f.brakeTemp[i]; p[P + 'padLife' + n] = f.brakePad[i]; p[P + 'discLife' + n] = f.brakeDisc[i];
    p[G + 'TyrePressure' + POS[i]] = f.tyrePressure[i]; p[G + 'TyreWear' + POS[i]] = f.tyreWear[i];
    p[G + 'TyreTemperature' + POS[i] + 'Inner'] = f.tyreInner[i]; p[G + 'TyreTemperature' + POS[i] + 'Middle'] = f.tyreMid[i]; p[G + 'TyreTemperature' + POS[i] + 'Outer'] = f.tyreOuter[i];
  }
  return p;
}
var KEYS = ['thr', 'brk', 'clu', 'steer', 'steerRot', 'steerText', 'gear', 'speed', 'rpm', 'rpmFrac', 'abs', 'tc', 'beta', 'betaRot', 'betaText', 'bandWord', 'bandColor', 'phaseColor', 'phaseText', 'balWord', 'balColor', 'balNeedle', 'steerRawText', 'balSeg', 'flagColor', 'wearLabel', 'sectorColor', 'sessLabel', 'hdrALabel', 'hdrA', 'hdrBLabel', 'hdrB', 'hlLap', 'hlTime', 'hlDelta', 'hlColor', 'deltaRange', 'deltaLo', 'deltaHiText', 'deltaLoText', 'znRow', 'znColor', 'evRow', 'evColor', 'lockN', 'lockText', 'lockColor', 'revText', 'smoothText', 'engText', 'fuelMargin', 'mapX', 'mapY', 'mapCol', 'carX', 'carY', 'carCol', 'grip', 'gripText', 'gripColor',
  'latG', 'longG', 'yaw', 'pitchRot', 'rollRot', 'pitchText', 'rollText', 'core', 'coreText', 'coreColor', 'treadI', 'treadM', 'treadO', 'press', 'pressText', 'pressDeltaText', 'pressDeltaColor', 'wearText', 'slipText', 'slipDeg', 'loadText', 'load', 'loadBar', 'travelText', 'travel',
  'disc', 'discText', 'discColor', 'discWord', 'discPeak', 'discRate', 'padDisc', 'delta', 'deltaLabel', 'deltaText', 'deltaColor', 'curLap', 'bestLap', 'lastLap', 'predLap', 'lapNo', 'sector', 'sectorBest', 'fuel', 'fuelText', 'lplText', 'lapsLeft', 'lapsLeftText', 'lapsLeftColor', 'raceLapsLeft', 'toAddText',
  'pos', 'gapA', 'gapB', 'flag', 'sessLeft', 'temps', 'dataTag', 'oilText', 'oil', 'waterText', 'water', 'boostText', 'boost'];

var tests = [];
function t(name, f) { tests.push([name, f]); }
function okType(v) { return v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'; }

t('every key returns a plain value (never throws, never NaN) for ACC, every wheel, 400 frames', function () {
  var ctx = makeCtx({}), sim = vm.runInContext('SIM.create()', ctx), roots = {}, n, k, i, r, res, f, bad = [];
  ctx.__sim = sim;
  for (n = 0; n < 400; n++) {
    res = vm.runInContext('SIM.step(__sim, 1/60)', ctx); f = res.frame;
    var props = accProps(f); ctx.$prop = function (name) { return props.hasOwnProperty(name) ? props[name] : undefined; };
    ctx.__roots = roots;
    KEYS.forEach(function (key) { for (i = 0; i < 4; i++) {
      var rk = key + i; roots[rk] = roots[rk] || {}; ctx.__root = roots[rk]; ctx.__key = key; ctx.__i = i;
      try { r = vm.runInContext('tms(__key, __root, __i)', ctx); } catch (e) { bad.push(key + ': ' + e.message); return; }
      if (!okType(r) || (typeof r === 'number' && r !== r)) { bad.push(key + ' -> ' + r); }
    } });
  }
  assert.deepStrictEqual(bad.slice(0, 5), []);
});
t('values: beta tracks the simulated slip, pedals normalise, text formats', function () {
  var ctx = makeCtx({}), sim = vm.runInContext('SIM.create()', ctx), root = {}, f, n, res, props;
  ctx.__sim = sim; ctx.__root = root;
  for (n = 0; n < 60 * 26; n++) { res = vm.runInContext('SIM.step(__sim, 1/60)', ctx); f = res.frame; props = accProps(f); ctx.$prop = function (nm) { return props.hasOwnProperty(nm) ? props[nm] : undefined; }; ctx.__key = 'beta'; ctx.__i = 0; vm.runInContext('tms(__key, __root, __i)', ctx); }
  var beta = vm.runInContext("tms('beta', __root, 0)", ctx);
  assert.ok(Math.abs(beta - f.beta_true * 180 / Math.PI) < 3, 'beta ' + beta + ' vs ' + f.beta_true * 180 / Math.PI);
  assert.strictEqual(vm.runInContext("tms('thr', {}, 0)", ctx), f.throttle);
  assert.ok(/^[+-]\d+\.\d°$/.test(vm.runInContext("tms('betaText', {}, 0)", ctx)));
  assert.strictEqual(vm.runInContext("tms('curLap', {}, 0)", ctx), '0:26.200');
  assert.strictEqual(vm.runInContext("tms('deltaText', {}, 0)", ctx), '+0.355');
  assert.strictEqual(vm.runInContext("tms('gapA', {}, 0)", ctx), '-2.2s');
  assert.strictEqual(vm.runInContext("tms('pos', {}, 0)", ctx), 'P4');
  assert.strictEqual(vm.runInContext("tms('dataTag', {}, 0)", ctx), 'ACC full');
});
t('phase colours: exactly one segment is lit', function () {
  var ctx = makeCtx({}), p = accProps(vm.runInContext('(function(){var s=SIM.create(),r;for(var i=0;i<60*17.2;i++){r=SIM.step(s,1/60);}return r.frame;})()', ctx));
  ctx.$prop = function (n) { return p.hasOwnProperty(n) ? p[n] : undefined; };
  var roots = [{}, {}, {}, {}, {}, {}], lit = 0, i, c;
  for (var rep = 0; rep < 10; rep++) { lit = 0; for (i = 0; i < 6; i++) { ctx.__r = roots[i]; ctx.__i = i; c = vm.runInContext("tms('phaseColor', __r, __i)", ctx); if (c !== '#FF16161A') { lit++; } } }
  assert.strictEqual(lit, 1);
});
t('unknown game and missing props: null / n/a, no throw', function () {
  var ctx = makeCtx({ 'DataCorePlugin.CurrentGame': 'SomeOtherSim' });
  KEYS.forEach(function (key) { ctx.__key = key; var r = vm.runInContext('tms(__key, {}, 0)', ctx); assert.ok(okType(r) && !(typeof r === 'number' && r !== r), key); });
  assert.strictEqual(vm.runInContext("tms('beta', {}, 0)", ctx), null);
  assert.strictEqual(vm.runInContext("tms('coreText', {}, 0)", ctx), 'n/a');
});
t('AC: beta from world velocity and heading after calibration, not before', function () {
  var P = 'DataCorePlugin.GameRawData.Physics.', p = { 'DataCorePlugin.CurrentGame': 'AssettoCorsa', 'TemperatureUnit': 'Celsius' };
  var ctx = makeCtx(p), root = {}, i, h, th, seg;
  ctx.__root = root;
  // fake sim where travel direction = -heading + 0.7; eight straights on different headings, then a 10 degree drift
  for (seg = 0; seg < 8; seg++) { for (i = 0; i < 60; i++) { h = seg * 0.8 - 2.5 + i * 0.0002; th = -h + 0.7; ctx.__now += 16; p[P + 'Velocity01'] = Math.sin(th) * 40; p[P + 'Velocity02'] = 0; p[P + 'Velocity03'] = Math.cos(th) * 40; p[P + 'Heading'] = h; vm.runInContext("tms('beta', __root, 0)", ctx); } }
  h = 1.2; th = -h + 0.7 + 10 * Math.PI / 180; p[P + 'Velocity01'] = Math.sin(th) * 40; p[P + 'Velocity03'] = Math.cos(th) * 40; p[P + 'Heading'] = h;
  var b = 0; for (i = 0; i < 40; i++) { b = vm.runInContext("tms('beta', __root, 0)", ctx); }
  assert.ok(Math.abs(b - 10) < 1.5, 'beta ' + b);
});

function one(props, key, i) { var ctx = makeCtx(props); ctx.__key = key; ctx.__i = i || 0; return vm.runInContext('tms2(__key, {}, __i)', ctx); }
var AC = 'AssettoCorsa', P = 'DataCorePlugin.GameRawData.Physics.', G = 'DataCorePlugin.GameData.';
function susp(l, r, fl, fr) { var o = {}; o[P + 'SuspensionTravel01'] = fl; o[P + 'SuspensionTravel02'] = fr; o[P + 'SuspensionTravel03'] = l; o[P + 'SuspensionTravel04'] = r; return o; }
t('banked corner: a 14 degree absolute roll with level suspension draws no body roll (the Karussell bug)', function () {
  var p = susp(0.05, 0.05, 0.05, 0.05); p['DataCorePlugin.CurrentGame'] = AC; p[P + 'Roll'] = 0.245; p[P + 'Pitch'] = -0.1;
  assert.strictEqual(one(p, 'rollRot'), 0); assert.strictEqual(one(p, 'pitchRot'), 0); assert.strictEqual(one(p, 'rollText'), 'ROLL +0.00\u00b0');
});
t('attitude: right side more compressed leans right, rear more compressed is nose up, drawing is clamped', function () {
  var p = susp(0.05, 0.07, 0.05, 0.07); p['DataCorePlugin.CurrentGame'] = AC;           // FL=.05 FR=.07 RL=.05 RR=.07 -> right compressed 20 mm
  var roll = Math.atan2(0.02, 1.6) * 180 / Math.PI; assert.ok(Math.abs(one(p, 'rollRot') - roll * 1) < 1e-6);
  var q = susp(0.07, 0.07, 0.05, 0.05); q['DataCorePlugin.CurrentGame'] = AC;           // rear (set via args order below) compressed more
  q = {}; q['DataCorePlugin.CurrentGame'] = AC; q[P + 'SuspensionTravel01'] = 0.05; q[P + 'SuspensionTravel02'] = 0.05; q[P + 'SuspensionTravel03'] = 0.08; q[P + 'SuspensionTravel04'] = 0.08;
  assert.ok(one(q, 'pitchRot') > 0, 'nose up'); assert.ok(/^PITCH \+/.test(one(q, 'pitchText')));
  var big = susp(0.0, 1.0, 0.0, 1.0); big['DataCorePlugin.CurrentGame'] = AC; assert.strictEqual(one(big, 'rollRot'), 25);
  assert.strictEqual(one({ 'DataCorePlugin.CurrentGame': AC }, 'rollRot'), 0); assert.strictEqual(one({ 'DataCorePlugin.CurrentGame': AC }, 'rollText'), 'n/a');
});
t('fuel: laps to go from the race, else from session time, else the plan; fuel to add follows', function () {
  var base = { 'DataCorePlugin.CurrentGame': AC, 'DataCorePlugin.Computed.Fuel_LitersPerLap': 11.17, 'DataCorePlugin.Computed.Fuel_RemainingLaps': 3.86 }; base[G + 'Fuel'] = 43.1;
  var race = JSON.parse(JSON.stringify(base)); race[G + 'RemainingLaps'] = 6;
  assert.strictEqual(one(race, 'raceLapsLeft'), '6'); assert.strictEqual(one(race, 'toAddText'), (6 * 11.17 - 43.1).toFixed(1) + ' L'); assert.ok(/^FUEL RANGE  short by 2\.1/.test(one(race, 'rangeText')));
  var timed = JSON.parse(JSON.stringify(base)); timed[G + 'SessionTimeLeft'] = 3600; timed[G + 'BestLapTime'] = 500;      // 8:20 laps, an hour left -> 8 laps
  assert.strictEqual(one(timed, 'raceLapsLeft'), '8 (time)');
  var practice = JSON.parse(JSON.stringify(base)); practice[G + 'SessionTimeLeft'] = -517; practice[G + 'RemainingLaps'] = 0;   // the screenshot: practice, no lap count, negative time
  assert.strictEqual(one(practice, 'raceLapsLeft'), '5 (plan)'); assert.strictEqual(one(practice, 'toAddText'), (5 * 11.17 - 43.1).toFixed(1) + ' L'); assert.strictEqual(one(practice, 'sessLeft'), '8:37'); assert.strictEqual(one(practice, 'sessLabel'), 'SESSION TIME'); assert.strictEqual(one(timed, 'sessLabel'), 'SESSION LEFT');
  assert.ok(/plan/.test(one(practice, 'raceText')));
  var okfuel = JSON.parse(JSON.stringify(race)); okfuel['DataCorePlugin.Computed.Fuel_RemainingLaps'] = 9; assert.strictEqual(one(okfuel, 'rangeText'), 'FUEL RANGE  reaches the end'); assert.strictEqual(one(okfuel, 'toAddText'), '24.0 L'.replace('24.0', Math.max(0, 6 * 11.17 - 43.1).toFixed(1)));
});
t('lap timing on lap 1: no best lap shows the live lap time, long sectors read m:ss, zero times are hidden', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }; p[G + 'CurrentLapTime'] = 83.1; p[G + 'BestLapTime'] = 0; p[G + 'LastLapTime'] = 0; p[G + 'Sector1Time'] = 180.27; p[G + 'Sector2Time'] = 0;
  assert.strictEqual(one(p, 'deltaText'), '1:23.10'); assert.strictEqual(one(p, 'deltaLabel'), 'LAP TIME (no best lap yet)'); assert.strictEqual(one(p, 'predLap'), '--:--.---');
  assert.strictEqual(one(p, 'bestLap'), '--:--.---'); assert.strictEqual(one(p, 'lastLap'), '--:--.---');
  assert.strictEqual(one(p, 'sector', 0), '3:00.27'); assert.strictEqual(one(p, 'sector', 1), '--');
  p[G + 'DeltaToSessionBest'] = 0.355; p[G + 'BestLapTime'] = 60.62; assert.strictEqual(one(p, 'deltaText'), '+0.355'); assert.strictEqual(one(p, 'deltaLabel'), 'DELTA VS BEST'); assert.strictEqual(one(p, 'predLap'), '1:00.975');
  p[G + 'Sector1Time'] = 20.0; assert.strictEqual(one(p, 'sector', 0), '20.00'); p[G + 'Sector1BestTime'] = 19.9; assert.strictEqual(one(p, 'sectorBest', 0), 'best 19.90');
});
t('peak decel ignores impact spikes above 8 g', function () {
  var ctx = makeCtx({}), root = {}, vals = [0.5, 54.06, 1.2, 0.9], i, r;
  ctx.__root = root; ctx.$prop = function (n) { return n === 'DataCorePlugin.GameData.CompletedLaps' ? 3 : (n === 'DataCorePlugin.GameRawData.Physics.AccG03' ? ctx.__g : undefined); };
  for (i = 0; i < vals.length; i++) { ctx.__g = -vals[i]; r = vm.runInContext("tms2('peakDecel', __root, 0)", ctx); }
  assert.strictEqual(r, '1.20 g');
});
t('steering: a positive raw SteerAngle (right) turns the drawn wheel clockwise, the raw value is shown, the text says R', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }; p[P + 'SteerAngle'] = 0.5;
  assert.ok(one(p, 'steerRot') > 0, 'right = clockwise = positive rotation'); assert.strictEqual(one(p, 'steerRot'), 0.5 * 270); assert.strictEqual(one(p, 'steerRawText'), 'raw 0.50');
  assert.ok(/^R /.test(one(p, 'steerText')), one(p, 'steerText'));
  p[P + 'SteerAngle'] = -0.25; assert.ok(one(p, 'steerRot') < 0); assert.ok(/^L /.test(one(p, 'steerText')));
  assert.strictEqual(one({ 'DataCorePlugin.CurrentGame': AC }, 'steerRawText'), 'raw n/a'); assert.strictEqual(one({ 'DataCorePlugin.CurrentGame': AC }, 'steerRot'), 0);
});
t('yaw rate comes from the heading, wraps at +-pi and rejects spikes', function () {
  var ctx = makeCtx({}), root = {}, h = [3.10, 3.14, -3.12, -3.08], i, r, p = {};
  ctx.__root = root; ctx.$prop = function (n) { return n === 'DataCorePlugin.GameRawData.Physics.Heading' ? ctx.__h : undefined; };
  for (i = 0; i < h.length; i++) { ctx.__h = h[i]; ctx.__now += 100; r = vm.runInContext("tms2('yaw', __root, 0)", ctx); }
  assert.ok(r > 5 && r < 150, 'wrapping through pi must give a small positive rate, got ' + r);
  ctx.__h = 0; ctx.__now += 100; r = vm.runInContext("tms2('yaw', __root, 0)", ctx); assert.ok(Math.abs(r) <= 150, 'clamped');
});
t('balance bar: oversteer lights the left segments, understeer the right, neutral only the centre, nothing while not cornering', function () {
  function bal(front, rear, lat, speed) { var p = { 'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione' }, k, ctx, root = {}, r = [], s, n; p[G + 'SpeedKmh'] = speed; p[P + 'AccG01'] = lat;
    for (k = 0; k < 4; k++) { p[P + 'SlipAngle0' + (k + 1)] = k < 2 ? front : rear; }
    ctx = makeCtx(p); ctx.__root = root; for (n = 0; n < 40; n++) { vm.runInContext("tms2('balSeg', __root, 0)", ctx); }
    for (s = 0; s < 9; s++) { ctx.__i = s; r.push(vm.runInContext("tms2('balSeg', __root, __i)", ctx)); } return r; }
  function lit(a) { return a.map(function (c, i) { return c === '#FF1F1F25' ? '' : i; }).filter(function (x) { return x !== ''; }); }
  assert.deepStrictEqual(lit(bal(0.10, 0.02, 1.2, 120)).filter(function (i) { return i > 4; }).length > 0, true, 'understeer lights the right side');
  assert.deepStrictEqual(lit(bal(0.10, 0.02, 1.2, 120)).filter(function (i) { return i < 4; }), [], 'and nothing on the left');
  assert.deepStrictEqual(lit(bal(0.02, 0.10, 1.2, 120)).filter(function (i) { return i < 4; }).length > 0, true, 'oversteer lights the left side');
  assert.deepStrictEqual(lit(bal(0.05, 0.05, 1.2, 120)), [4], 'neutral lights the centre only');
  assert.deepStrictEqual(lit(bal(0.10, 0.02, 0.1, 120)), [4], 'not cornering: neutral');
});
t('AC probe values: WheelSlip shows as a unitless number, tyre wear is labelled LIFE, oil/water 0 read n/a', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }; p[P + 'WheelSlip01'] = 0.41253384947776794; p[G + 'TyreWearFrontLeft'] = 98.4547; p[G + 'OilTemperature'] = 0; p[G + 'WaterTemperature'] = 0;
  assert.strictEqual(one(p, 'slipText', 0), '0.41'); assert.strictEqual(one(p, 'wearLabel'), 'LIFE'); assert.strictEqual(one(p, 'oilText'), 'n/a'); assert.strictEqual(one(p, 'waterText'), 'n/a');
  assert.strictEqual(one({ 'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione' }, 'wearLabel'), 'WEAR');
  var q = { 'DataCorePlugin.CurrentGame': AC }; q[P + 'SlipAngle01'] = 0.1; assert.strictEqual(one(q, 'slipText', 0), (0.1 * 180 / Math.PI).toFixed(1) + '\u00b0');
});
t('delta: no best lap = lap time; AC without DeltaToSessionBest uses the tracker delta; with neither it says live delta n/a', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }; p[G + 'CurrentLapTime'] = 20.286; p[G + 'BestLapTime'] = 127.725;
  assert.strictEqual(one(p, 'deltaLabel'), 'LAP TIME (live delta n/a)'); assert.strictEqual(one(p, 'deltaText'), '0:20.29'); assert.strictEqual(one(p, 'predLap'), '--:--.---');
  p['PersistantTrackerPlugin.SessionBestLiveDeltaSeconds'] = -0.412; assert.strictEqual(one(p, 'deltaLabel'), 'DELTA VS BEST'); assert.strictEqual(one(p, 'deltaText'), '-0.412'); assert.strictEqual(one(p, 'predLap'), '2:07.313');
  p[G + 'BestLapTime'] = 0; assert.strictEqual(one(p, 'deltaLabel'), 'LAP TIME (no best lap yet)');
});
t('fuel per lap: SimHub value 0 is ignored, one clean lap of our own is measured, refuelling and pit laps are not', function () {
  var ctx = makeCtx({}), root = {}, state = { f: 44.26, l: 2 };
  ctx.__root = root; ctx.$prop = function (n) { return n === G + 'Fuel' ? state.f : (n === G + 'CompletedLaps' ? state.l : (n === 'DataCorePlugin.Computed.Fuel_LitersPerLap' || n === 'DataCorePlugin.Computed.Fuel_RemainingLaps' ? 0 : undefined)); };
  function ask(k) { return vm.runInContext("tms2('" + k + "', __root, 0)", ctx); }
  assert.strictEqual(ask('lplText'), 'n/a'); assert.strictEqual(ask('lapsLeftText'), '--');
  state.f = 41.76; state.l = 3; assert.strictEqual(ask('lplText'), '2.50 L'); assert.strictEqual(ask('lapsLeftText'), (41.76 / 2.5).toFixed(1));
  state.f = 60; state.l = 4; assert.strictEqual(ask('lplText'), '2.50 L', 'a refuelled lap does not replace the estimate');
  state.f = 57.2; state.l = 5; assert.strictEqual(ask('lplText'), '2.80 L');
});
t('ACC lower-case slipAngle01 (catalog spelling) reads as degrees; fuel range bar uses the same laps-left as the text', function () {
  var p = { 'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione' }; p[P + 'slipAngle01'] = 0.1;
  assert.strictEqual(one(p, 'slipText', 0), (0.1 * 180 / Math.PI).toFixed(1) + '\u00b0');
  var f = { 'DataCorePlugin.CurrentGame': AC, 'DataCorePlugin.Computed.Fuel_LitersPerLap': 0, 'DataCorePlugin.Computed.Fuel_RemainingLaps': 0 }; f[G + 'Fuel'] = 40; f[G + 'CompletedLaps'] = 3; f[G + 'RemainingLaps'] = 6;
  assert.strictEqual(one(f, 'rangeFrac'), 0); assert.strictEqual(one(f, 'rangeColor'), '#FF2A2A31');
});
// ---- the annotated-screenshot round -------------------------------------------------------------------------------------------------------------
// drive(frames, keys): each key has its own root, like separate formulas in SimHub; one frame = 100 ms
function drive(frames, keys) {
  var ctx = makeCtx({}), roots = keys.map(function () { return {}; }), out = [], n, k;
  ctx.__r = roots;
  for (n = 0; n < frames.length; n++) {
    ctx.$prop = (function (p) { return function (nm) { return p.hasOwnProperty(nm) ? p[nm] : undefined; }; })(frames[n]); ctx.__now += 100;
    for (k = 0; k < keys.length; k++) { ctx.__k = keys[k][0]; ctx.__i = keys[k][1]; ctx.__ri = k; out[k] = vm.runInContext('tms2(__k, __r[__ri], __i)', ctx); }
  }
  return out;
}
function acFrame(lap, t, idx, ls, last) {
  var p = { 'DataCorePlugin.CurrentGame': AC }; p[G + 'CompletedLaps'] = lap; p[G + 'CurrentLapTime'] = t; p[G + 'LastLapTime'] = last || 0; p[G + 'CurrentSectorIndex'] = idx; p[G + 'LastSectorTime'] = ls || 0;
  p[G + 'Sector1BestTime'] = 20.3; p[G + 'BestLapTime'] = 61.4; return p;
}
function lapFrames() {       // AC lap 3 (2 completed): sectors of 20.3, 20.7 and 20.4 s, then lap 4 begins
  var fr = [], t, last = 61.4;
  for (t = 0; t < 61.4; t += 0.1) { fr.push(acFrame(2, t, t < 20.3 ? 0 : (t < 41.0 ? 1 : 2), t < 20.3 ? 0 : (t < 41.0 ? 20.3 : 20.7))); }
  for (t = 0; t < 3; t += 0.1) { fr.push(acFrame(3, t, 0, 20.7, last)); }
  return fr;
}
t('AC sectors: timed from the sector index when the game gives no Sector1Time; last lap shows dim until replaced', function () {
  var keys = [['sector', 0], ['sector', 1], ['sector', 2], ['sectorColor', 0], ['sectorColor', 2]], mid = lapFrames().slice(0, 450), a = drive(mid, keys), b = drive(lapFrames(), keys);
  assert.strictEqual(a[0], '20.30'); assert.strictEqual(a[1], '20.70'); assert.ok(/^[0-9]\.[0-9]{2}$/.test(a[2]), 'sector 3 is running: ' + a[2]); assert.strictEqual(a[3], '#FFB66DFF', 'sector 1 equals the best, purple');
  assert.strictEqual(b[2], '20.40', 'last sector = lap time minus the first two, shown for the finished lap'); assert.strictEqual(b[4], '#FF80808B', 'and dim');
  assert.ok(/^[0-9]\.[0-9]{2}$/.test(b[0]) || b[0] === '20.30', 'sector 1 of the new lap is running or still last lap: ' + b[0]);
});
t('AC sectors with no sector index at all show dashes, no throw', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }; p[G + 'CurrentLapTime'] = 12; p[G + 'CompletedLaps'] = 2;
  assert.deepStrictEqual(drive([p, p, p], [['sector', 0], ['sector', 2]]), ['--', '--']);
});
t('lap history: last five laps from the tracker, lap numbers, delta and colour; row 0 falls back to the last lap', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }, PT = 'PersistantTrackerPlugin.', i;
  p[G + 'CompletedLaps'] = 6; p[G + 'BestLapTime'] = 61.2; p[G + 'LastLapTime'] = 61.9;
  for (i = 0; i < 5; i++) { p[PT + 'PreviousLap_0' + i] = 61.9 + i * 0.1; p[PT + 'PreviousLap_0' + i + '_DeltaToSessionBest'] = i === 3 ? 0 : 0.7 + i * 0.1; }
  var o = drive([p], [['hlLap', 0], ['hlTime', 0], ['hlDelta', 0], ['hlLap', 4], ['hlDelta', 3], ['hlColor', 3], ['hlColor', 0]]);
  assert.deepStrictEqual(o.slice(0, 5), ['L6', '1:01.900', '+0.700', 'L2', '+0.000']); assert.strictEqual(o[5], '#FFB66DFF'); assert.strictEqual(o[6], '#FFFF8A1F');
  var q = { 'DataCorePlugin.CurrentGame': AC }; q[G + 'CompletedLaps'] = 2; q[G + 'LastLapTime'] = 62.5; q[G + 'BestLapTime'] = 62.0;
  assert.deepStrictEqual(drive([q], [['hlLap', 0], ['hlTime', 0], ['hlDelta', 0], ['hlLap', 1]]), ['L2', '1:02.500', '+0.500', '']);      // only row 0 has the last-lap fallback; row 1 needs the tracker
  assert.deepStrictEqual(drive([{ 'DataCorePlugin.CurrentGame': AC }], [['hlLap', 0], ['hlTime', 3]]), ['', '']);
});
t('header: AC shows LAP and LAST LAP where ACC shows the gaps; practice session shows elapsed time', function () {
  var a = { 'DataCorePlugin.CurrentGame': AC }; a[G + 'CurrentLap'] = 3; a[G + 'TotalLaps'] = 0; a[G + 'LastLapTime'] = 111.553;
  assert.deepStrictEqual(drive([a], [['hdrALabel', 0], ['hdrA', 0], ['hdrBLabel', 0], ['hdrB', 0]]), ['LAP', '3', 'LAST LAP', '1:51.55']);
  a[G + 'TotalLaps'] = 34; assert.strictEqual(drive([a], [['hdrA', 0]])[0], '3 / 34');
  var c = { 'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione' }; c['DataCorePlugin.GameRawData.Graphics.gapAhead'] = 2200; c['DataCorePlugin.GameRawData.Graphics.gapBehind'] = 2600;
  assert.deepStrictEqual(drive([c], [['hdrALabel', 0], ['hdrA', 0], ['hdrBLabel', 0], ['hdrB', 0]]), ['GAP AHEAD', '-2.2s', 'GAP BEHIND', '+2.6s']);
});
t('grip use: one huge slip spike does not pin the reference peak (the 1% / 0% cards)', function () {
  var fr = [], i, p;
  for (i = 0; i < 400; i++) { p = { 'DataCorePlugin.CurrentGame': AC, 'DataCorePlugin.GameData.CarId': 'x' }; for (var k = 1; k <= 4; k++) { p[P + 'WheelSlip0' + k] = i === 300 ? 40 : 0.4 + 0.1 * Math.sin(i / 7); } fr.push(p); }
  var o = drive(fr.slice(0, 100), [['grip', 0]]); assert.strictEqual(o[0], null, 'still learning in the first 100 samples');
  o = drive(fr, [['grip', 0], ['gripText', 0]]); assert.ok(o[0] > 0.3, 'grip use after a spike must stay readable, got ' + o[0]); assert.ok(/^[0-9]+%$/.test(o[1]));
});
t('delta chart range follows the data in 0.5 s steps and never drops below +-1 s', function () {
  var fr = [], i, p;
  for (i = 0; i < 40; i++) { p = { 'DataCorePlugin.CurrentGame': AC }; p[G + 'BestLapTime'] = 111.5; p['PersistantTrackerPlugin.SessionBestLiveDeltaSeconds'] = -6.73; fr.push(p); }
  assert.deepStrictEqual(drive(fr, [['deltaRange', 0], ['deltaLo', 0], ['deltaHiText', 0], ['deltaLoText', 0]]), [8.5, -8.5, '+8.5s', '-8.5s']);
  assert.strictEqual(drive([{ 'DataCorePlugin.CurrentGame': AC }], [['deltaRange', 0]])[0], 1);
});
t('braking zones, events and lock-ups from the simulated lap: each row formula builds the same list on its own', function () {
  var ctx0 = makeCtx({}), sim = vm.runInContext('SIM.create()', ctx0), fr = [], n, res;
  ctx0.__sim = sim; for (n = 0; n < 60 * 45; n++) { res = vm.runInContext('SIM.step(__sim, 1/60)', ctx0); fr.push(accProps(res.frame)); }
  // one 60 fps frame per call here, so use a drive() that advances 16 ms
  var ctx = makeCtx({}), roots = [{}, {}, {}, {}, {}], keys = [['znRow', 0], ['znRow', 1], ['znColor', 0], ['evRow', 0], ['lockText', 0]], out = [], k;
  ctx.__r = roots;
  for (n = 0; n < fr.length; n++) { ctx.$prop = (function (p) { return function (nm) { return p.hasOwnProperty(nm) ? p[nm] : undefined; }; })(fr[n]); ctx.__now += 16; for (k = 0; k < keys.length; k++) { ctx.__k = keys[k][0]; ctx.__i = keys[k][1]; ctx.__ri = k; out[k] = vm.runInContext('tms2(__k, __r[__ri], __i)', ctx); } }
  assert.ok(/#\s*\d+ +\d+> *\d+ +\d+% \d\.\dg \d\.\ds/.test(out[0]), 'zone row: ' + out[0]); assert.ok(out[1] === '' || /#/.test(out[1]), 'row 2: ' + out[1]);
  assert.ok(/^#FF/.test(out[2])); assert.ok(out[3] !== '', 'event row: ' + out[3]); assert.ok(/^LOCK-UPS THIS LAP +FL \d +FR \d +RL \d +RR \d$/.test(out[4]), out[4]);
});
t('track map: dots remember the lap, share one scale, stay inside 0..1; nothing is drawn before 30 m of path', function () {
  var fr = [], i, p, u, a;
  for (i = 0; i < 400; i++) { u = i / 400; a = 2 * Math.PI * u; p = { 'DataCorePlugin.CurrentGame': AC }; p['DataCorePlugin.GameRawData.Graphics.NormalizedCarPosition'] = u; p[G + 'CarCoordinates01'] = 300 * Math.cos(a); p[G + 'CarCoordinates03'] = 150 * Math.sin(a); fr.push(p); }
  var o = drive(fr, [['mapX', 0], ['mapY', 0], ['mapCol', 0], ['mapX', 36], ['mapY', 36], ['carX', 0], ['carCol', 0]]);
  o.slice(0, 2).concat(o.slice(3, 6)).forEach(function (v) { assert.ok(v >= 0 && v <= 1, 'inside the box: ' + v); });
  assert.strictEqual(o[2], '#FF6A6A76'); assert.strictEqual(o[6], '#FFF3FF3D'); assert.ok(Math.abs(o[3] - 0) < 0.05, 'half a lap round: x at the far end ' + o[3]);
  assert.strictEqual(drive([fr[0], fr[1]], [['mapCol', 0]])[0], '#00000000');
});
// sector index as SimHub reports it for AC: 1, 2, 3 (the probe showed index 2 with only Sector1Time set)
function lapSeq(base, laps, startAt, lag) {      // laps of 20.3 / 20.7 / 20.4 s; the index lags 'lag' frames behind the lap line
  var fr = [], lap, t, lt, idx, last = 0, n = 0;
  for (lap = 2; lap < 2 + laps; lap++) {
    for (t = 0; t < 61.4; t += 0.1) {
      if (lap === 2 && t < startAt) { continue; }
      idx = base + (t < 20.3 ? 0 : (t < 41.0 ? 1 : 2));
      if (lap > 2 && t < lag * 0.1) { idx = base + 2; }
      fr.push(acFrame(lap, t, idx, t < 20.3 ? last : (t < 41.0 ? 20.3 : 20.7), 61.4));
    }
  }
  for (t = 0; t < 0.6; t += 0.1) { fr.push(acFrame(2 + laps, t, base + (t < lag * 0.1 ? 2 : 0), 20.7, 61.4)); }      // the first frames of the next lap close the last sector
  return fr;
}
t('sectors count with a 1-based index (as SimHub reports it) and with a 0-based one: S2 and S3 are timed, S3 from the lap time', function () {
  var keys = [['sector', 0], ['sector', 1], ['sector', 2]], b;
  [0, 1].forEach(function (base) {
    b = drive(lapSeq(base, 2, 0, 0), keys);
    assert.ok(/^0.[0-9]{2}$/.test(b[0]), 'base ' + base + ': sector 1 of the new lap is running: ' + b.join('|')); assert.strictEqual(b[1], '20.70', 'base ' + base + ': ' + b.join('|')); assert.strictEqual(b[2], '20.40', 'sector 3 of the lap just finished: ' + b[2]);
    b = drive(lapSeq(base, 2, 0, 0).slice(0, -6), keys); assert.deepStrictEqual(b, ['20.30', '20.70', '20.30'].slice(0, 2).concat([b[2]]), 'at the end of the lap sectors 1 and 2 are final: ' + b.join('|'));
  });
});
t('sectors: the index lagging behind the lap line does not start a phantom sector', function () {
  var keys = [['sector', 0], ['sector', 1], ['sector', 2]], b = drive(lapSeq(1, 3, 0, 4), keys);
  assert.ok(/^0.[0-9]{2}$/.test(b[0]), b.join('|')); assert.strictEqual(b[1], '20.70'); assert.strictEqual(b[2], '20.40');
});
t('sectors: a dash opened mid-lap waits for the next lap line, then times every sector; best sectors are kept here when the game has none', function () {
  var keys = [['sector', 1], ['sector', 2], ['sectorBest', 1], ['sectorBest', 2], ['sectorColor', 1]], mid = drive(lapSeq(1, 1, 30, 0), keys), full = drive(lapSeq(1, 3, 30, 0), keys);
  assert.strictEqual(mid[1], '--', 'unknown until the next lap line: ' + mid[1]);
  assert.deepStrictEqual(full.slice(0, 4), ['20.70', '20.40', 'best 20.70', 'best 20.40']); assert.strictEqual(full[4], '#FF80808B', 'last lap value until this lap replaces it: dim');
  assert.strictEqual(drive(lapSeq(1, 3, 30, 0).slice(0, -6), keys)[4], '#FFB66DFF', 'a finished sector equal to the best is purple');
});
t('lap history gap bars: stub for the best lap, longer for slower laps, scaled to the slowest of the five, capped at 300 px', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }, PT = 'PersistantTrackerPlugin.', i, d = [0, 1, 2, 4, 0.5];
  p[G + 'CompletedLaps'] = 9; p[G + 'BestLapTime'] = 100;
  for (i = 0; i < 5; i++) { p[PT + 'PreviousLap_0' + i] = 100 + d[i]; p[PT + 'PreviousLap_0' + i + '_DeltaToSessionBest'] = d[i]; }
  assert.deepStrictEqual(drive([p], [['hlBar', 0], ['hlBar', 1], ['hlBar', 2], ['hlBar', 3], ['hlBar', 4]]), [3, 75, 150, 300, 38]);
  assert.strictEqual(drive([{ 'DataCorePlugin.CurrentGame': AC }], [['hlBar', 0]])[0], 0);
});
t('tweak round: tyre load split never shows NaN (idle game: all loads 0), wording, G-force peaks reset per lap and ignore spikes', function () {
  var p = { 'DataCorePlugin.CurrentGame': AC }, k;
  for (k = 1; k <= 4; k++) { p[P + 'WheelLoad0' + k] = 0; }
  assert.strictEqual(drive([p], [['loadShare', 0]])[0], 'no tyre load');
  p[P + 'WheelLoad01'] = 5615; p[P + 'WheelLoad02'] = 964; p[P + 'WheelLoad03'] = 6838; p[P + 'WheelLoad04'] = 1639;
  assert.strictEqual(drive([p], [['loadShare', 0]])[0], 'FRONT 44%  REAR 56%     LEFT 83%  RIGHT 17%');
  assert.strictEqual(drive([p], [['loadBar', 2], ['loadN', 2]]).join('|'), (6838 / 8000) + '|6838');
  function gf(lat, lon, lap) { var q = { 'DataCorePlugin.CurrentGame': AC }; q[P + 'AccG01'] = lat; q[P + 'AccG03'] = lon; q[G + 'CompletedLaps'] = lap; return q; }
  var keys = [['peakLatText', 0], ['peakBrkGText', 0], ['peakAccText', 0], ['latGDir', 0], ['lonGDir', 0], ['latGText', 0]];
  var o = drive([gf(0.5, -0.2, 3), gf(1.4, -1.8, 3), gf(-1.7, 0.6, 3), gf(40, -54, 3), gf(0.2, 0.1, 3)], keys);
  assert.deepStrictEqual(o.slice(0, 3), ['1.70 g', '1.80 g', '0.60 g'], 'peaks, with the 40 g and 54 g spikes ignored: ' + o.join('|'));
  o = drive([gf(0.5, -0.2, 3), gf(1.4, -1.8, 3), gf(0.3, 0.2, 4)], keys); assert.deepStrictEqual(o.slice(0, 3), ['0.30 g', '0.00 g', '0.20 g'], 'a new lap starts the peaks again: ' + o.join('|'));
  assert.strictEqual(drive([gf(1.2, 0, 1)], [['latGDir', 0]])[0], '◄ LEFT'); assert.strictEqual(drive([gf(-1.2, 0, 1)], [['latGDir', 0]])[0], 'RIGHT ►'); assert.strictEqual(drive([gf(0.01, 0, 1)], [['latGDir', 0]])[0], '');
});
t('slip statistics: peak slip angle and time sliding count up within a lap and restart on the next; corners are classified when they end', function () {
  var fr = [], i, p, k;
  for (i = 0; i < 120; i++) {      // 12 s: a steady corner with the front sliding more than the rear (understeer), then a straight
    p = { 'DataCorePlugin.CurrentGame': AC }; p[G + 'CompletedLaps'] = 2; p[G + 'SpeedKmh'] = 100; p[P + 'AccG01'] = i < 80 ? 1.2 : 0.05;
    for (k = 1; k <= 4; k++) { p[P + 'WheelSlip0' + k] = i < 80 ? (k <= 2 ? 0.12 : 0.05) : 0.01; }
    fr.push(p);
  }
  var o = drive(fr, [['cornerCountText', 0], ['cornerLastText', 0], ['cornerLastColor', 0]]);
  assert.strictEqual(o[0], 'US 1   OS 0   N 0', o.join('|')); assert.ok(/^UNDERSTEER [0-9.]+°$/.test(o[1]), o[1]); assert.strictEqual(o[2], '#FFFF8A1F');
  assert.ok(/^[0-9]+.[0-9]°$/.test(drive(fr, [['betaPeakText', 0]])[0])); assert.ok(/^[0-9]+.[0-9] s$/.test(drive(fr, [['slideTimeText', 0]])[0]));
});
t('lap statistics: sector deltas, theoretical best, average and spread of the last five laps (an out-lap beyond 107% is left out)', function () {
  var fr = lapSeq(1, 3, 0, 0), keys = [['sdTime', 1], ['sdDelta', 1], ['sdColor', 1], ['theoText', 0], ['theoGapText', 0], ['avgText', 0], ['spreadText', 0]], p = fr[fr.length - 1], PT = 'PersistantTrackerPlugin.', i, tt = [98.5, 98.9, 99.1, 138.0, 98.7];
  p[G + 'Sector1BestTime'] = 20.2; p[G + 'Sector2BestTime'] = 20.5; p[G + 'Sector3BestLapTime'] = 20.3; p[G + 'BestLapTime'] = 61.5; p[G + 'CompletedLaps'] = 7;
  for (i = 0; i < 5; i++) { p[PT + 'PreviousLap_0' + i] = tt[i]; p[PT + 'PreviousLap_0' + i + '_DeltaToSessionBest'] = tt[i] - 98.5; }
  var o = drive(fr.slice(0, -1).concat([p]), keys);
  assert.strictEqual(o[3], '1:01.000'); assert.strictEqual(o[4], '-0.500 s possible'); assert.strictEqual(o[1], '+0.200'); assert.strictEqual(o[2], '#FFFF8A1F');
  var avg = (98.5 + 98.9 + 99.1 + 98.7) / 4, sd = Math.sqrt([98.5, 98.9, 99.1, 98.7].reduce(function (s, x) { return s + (x - avg) * (x - avg); }, 0) / 4);
  assert.strictEqual(o[5], 'AVG  1:38.800'); assert.strictEqual(o[6], 'SPREAD  ±' + sd.toFixed(2) + ' s');
  assert.deepStrictEqual(drive([{ 'DataCorePlugin.CurrentGame': AC }], [['theoText', 0], ['avgText', 0], ['spreadText', 0], ['sdDelta', 0]]), ['--:--.---', 'AVG  --', 'SPREAD  --', '']);
});
// corner log: frames of AC data (WheelSlip as the slip), 100 ms each
function cornerFrames(lap, spec) {      // spec: [seconds, km/h, lat g, steer, front slip, rear slip, slowest km/h]
  var fr = [], i, k, p, n;
  spec.forEach(function (c) {
    n = Math.round(c[0] * 10);
    for (i = 0; i < n; i++) {
      p = { 'DataCorePlugin.CurrentGame': AC }; p[G + 'CompletedLaps'] = lap; p[G + 'SpeedKmh'] = i === 3 && c[6] ? c[6] : c[1]; p[P + 'AccG01'] = c[2]; p[P + 'SteerAngle'] = c[3];
      for (k = 1; k <= 4; k++) { p[P + 'WheelSlip0' + k] = k <= 2 ? c[4] : c[5]; }
      fr.push(p);
    }
  });
  return fr;
}
t('corner log: each corner is filed when it ends with lap, number, slowest speed, peak g, peak steering and the balance verdict; blips are ignored; newest first', function () {
  var S = [0.05, 0.01], fr = cornerFrames(4, [[2, 160, 0.05, 0, 0.01, 0.01], [4, 100, 1.5, -0.4, 0.12, 0.05, 90], [2, 160, 0.05, 0, 0.01, 0.01], [0.5, 100, 1.2, -0.3, 0.1, 0.1], [2, 160, 0.05, 0, 0.01, 0.01],
    [4, 140, -1.3, 0.3, 0.04, 0.11], [2, 160, 0.05, 0, 0.01, 0.01], [4, 120, 1.1, -0.2, 0.11, 0.04], [2, 160, 0.05, 0, 0.01, 0.01]]);
  var keys = [['cnRow', 0], ['cnRow', 1], ['cnRow', 2], ['cnRow', 3], ['cnColor', 0], ['cnColor', 1], ['cnColor', 3], ['cnTrend', 0], ['cnTrendColor', 0], ['cornerLastText', 0]], o = drive(fr, keys);
  assert.ok(/^ L5 C03 120 1\.10  54° +-- US [34]\.\d°$/.test(o[0]), 'newest: ' + JSON.stringify(o[0]));
  assert.ok(/^ L5 C02 140 1\.30  81° +-- OS [34]\.\d°$/.test(o[1]), 'second: ' + JSON.stringify(o[1]));
  assert.ok(/^ L5 C01  90 1\.50 108° +-- US [34]\.\d°$/.test(o[2]), 'first: ' + JSON.stringify(o[2]));
  assert.strictEqual(o[3], '', 'only three corners were filed (the half-second blip is not one)');
  assert.deepStrictEqual(o.slice(4, 7), ['#FFFF8A1F', '#FFFF3D5A', '#FF80808B'], o.slice(4, 7).join('|'));
  assert.ok(/^TREND  UNDERSTEER [01]\.\d°  \(last 3\)$/.test(o[7]), o[7]); assert.strictEqual(o[8], '#FFFF8A1F');
  assert.ok(/^UNDERSTEER [34]\.\d°$/.test(o[9]) && o[0].slice(-7) === o[9].replace('UNDERSTEER', 'US'), 'the last-corner card and the first log row agree: ' + o[9] + ' / ' + o[0]);
  assert.deepStrictEqual(drive(fr.slice(0, 15), [['cnRow', 0], ['cnTrend', 0], ['cnTrendColor', 0]]), ['no corner yet (30 km/h and 0.3 g)', 'TREND  needs 3 corners', '#FF80808B']);
  var q = cornerFrames(4, [[4, 100, 1.5, -0.4, 0.12, 0.05], [2, 160, 0.05, 0, 0.01, 0.01]]); q.forEach(function (p) { p[G + 'CurrentLap'] = 7; });
  assert.ok(/^ L7 C01/.test(drive(q, [['cnRow', 0]])[0]), 'the lap in progress is CurrentLap when the game gives it');
});
t('corner log: a two-sample spike (kerb strike) does not set the peak g; a third sample does', function () {
  var mk = function (n) { var fr = cornerFrames(4, [[4, 100, 1.5, -0.4, 0.12, 0.05], [2, 160, 0.05, 0, 0.01, 0.01]]), k; for (k = 0; k < n; k++) { fr[10 + k][P + 'AccG01'] = 4; } return fr; };
  assert.ok(/ 1\.50 /.test(drive(mk(2), [['cnRow', 0]])[0]), drive(mk(2), [['cnRow', 0]])[0]);
  assert.ok(/ 4\.00 /.test(drive(mk(3), [['cnRow', 0]])[0]), drive(mk(3), [['cnRow', 0]])[0]);
});
t('event log lap numbers are the lap in progress (what the header shows), not the completed count', function () {
  var fr = cornerFrames(4, [[1, 150, 0.05, 0, 0.01, 0.01]]).concat(cornerFrames(4, [[2, 150, 0.05, 0, 0.01, 0.01]]).map(function (p) { p[G + 'Brake'] = 100; p[G + 'Throttle'] = 0; p[G + 'ABSActive'] = true; return p; }));
  var o = drive(fr.concat(cornerFrames(4, [[1, 150, 0.05, 0, 0.01, 0.01]])), [['evRow', 0]]);
  assert.ok(/^L5 /.test(o[0]), 'event row: ' + o[0]);
});
var fail = 0;
tests.forEach(function (x) { try { x[1](); console.log('ok   ' + x[0]); } catch (e) { fail++; console.log('FAIL ' + x[0] + '\n     ' + e.message); } });
process.exit(fail ? 1 : 0);
