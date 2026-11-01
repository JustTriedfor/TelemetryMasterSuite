var assert = require('assert');
var SHA = require('../lib/adapters.js');
function fake(map) { return function (n) { return map[n]; }; }
var tests = [];
function t(name, f) { tests.push([name, f]); }

t('unknown game gives all null and does not throw', function () {
  var d = SHA.read(fake({}));
  assert.strictEqual(d.sim, null);
  assert.strictEqual(d.speed, null);
  assert.deepStrictEqual(d.tyreLoad, [null, null, null, null]);
});
t('num rejects NaN, Infinity, empty string, booleans', function () {
  assert.strictEqual(SHA.num(NaN), null);
  assert.strictEqual(SHA.num(Infinity), null);
  assert.strictEqual(SHA.num(''), null);
  assert.strictEqual(SHA.num(true), null);
  assert.strictEqual(SHA.num('3.5'), 3.5);
});
t('ACC slip properties are found under the catalog spelling slipAngle01 / slipRatio01', function () {
  var P = 'DataCorePlugin.GameRawData.Physics.';
  var d = SHA.read(fake({ 'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione', 'DataCorePlugin.GameRawData.Physics.slipAngle02': 0.07, 'DataCorePlugin.GameRawData.Physics.slipRatio03': -0.2 }));
  assert.strictEqual(d.slipAngle[1], 0.07); assert.strictEqual(d.slipAngle[0], null); assert.strictEqual(d.slipRatio[2], -0.2);
});
t('ACC reads the flattened 01..04 properties in FL,FR,RL,RR order', function () {
  var P = 'DataCorePlugin.GameRawData.Physics.';
  var d = SHA.read(fake({
    'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione', SpeedKmh: 180, TemperatureUnit: 'Celsius',
    'DataCorePlugin.GameRawData.Physics.LocalVelocity01': 1, 'DataCorePlugin.GameRawData.Physics.LocalVelocity02': 0, 'DataCorePlugin.GameRawData.Physics.LocalVelocity03': 50,
    'DataCorePlugin.GameRawData.Physics.WheelLoad01': 3000, 'DataCorePlugin.GameRawData.Physics.WheelLoad02': 3100,
    'DataCorePlugin.GameRawData.Physics.WheelLoad03': 2500, 'DataCorePlugin.GameRawData.Physics.WheelLoad04': 2600,
    'DataCorePlugin.GameRawData.Physics.SlipAngle01': 0.05, 'DataCorePlugin.GameRawData.Physics.SlipRatio04': -0.1,
    'DataCorePlugin.GameRawData.Physics.TyreCoreTemperature03': 82,
    'DataCorePlugin.GameRawData.Physics.AccG01': 0.5, 'DataCorePlugin.GameRawData.Physics.AccG03': -0.2,
    'DataCorePlugin.GameData.TyreTemperatureFrontLeftInner': 70
  }));
  assert.strictEqual(d.sim, 'acc');
  assert.strictEqual(d.speed, 50);
  assert.deepStrictEqual(d.vel, [1, 0, 50]);
  assert.strictEqual(d.velFrame, 'local');
  assert.deepStrictEqual(d.tyreLoad, [3000, 3100, 2500, 2600]);
  assert.deepStrictEqual(d.slipAngle, [0.05, null, null, null]);
  assert.deepStrictEqual(d.slipRatio, [null, null, null, -0.1]);
  assert.strictEqual(d.tyreCore[2], 82);
  assert.strictEqual(d.tyreInner[0], 70);
  assert.strictEqual(d.latG, 0.5);
  assert.strictEqual(d.longG, -0.2);
});
t('ACC reads pad and disc life; AC and iRacing leave them null', function () {
  var P = 'DataCorePlugin.GameRawData.Physics.';
  var m = { 'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione' };
  m[P + 'padLife01'] = 18.5; m[P + 'padLife04'] = 17; m[P + 'discLife02'] = 31;
  var d = SHA.read(fake(m));
  assert.deepStrictEqual(d.brakePad, [18.5, null, null, 17]); assert.deepStrictEqual(d.brakeDisc, [null, 31, null, null]);
  m['DataCorePlugin.CurrentGame'] = 'AssettoCorsa'; d = SHA.read(fake(m));
  assert.deepStrictEqual(d.brakePad, [null, null, null, null]);
});
t('ACC falls back to an array-valued property when no suffixed ones exist', function () {
  var d = SHA.read(fake({ 'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione', 'DataCorePlugin.GameRawData.Physics.tyreCoreTemperature': [80, 81, 82, 83] }));
  assert.deepStrictEqual(d.tyreCore, [80, 81, 82, 83]);
});
t('AC: world velocity + heading, combined slip only, no tyre radius', function () {
  var P = 'DataCorePlugin.GameRawData.Physics.';
  var d = SHA.read(fake({
    'DataCorePlugin.CurrentGame': 'AssettoCorsa', 'DataCorePlugin.GameRawData.Physics.Velocity01': 3, 'DataCorePlugin.GameRawData.Physics.Velocity03': 40,
    'DataCorePlugin.GameRawData.Physics.Heading': 0.1, 'DataCorePlugin.GameRawData.Physics.WheelSlip02': 0.4,
    'DataCorePlugin.GameData.OrientationYawVelocity': 0.2, 'DataCorePlugin.GameRawData.Physics.TyreTempI01': 60
  }));
  assert.strictEqual(d.sim, 'ac');
  assert.strictEqual(d.velFrame, 'world');
  assert.deepStrictEqual(d.vel, [3, null, 40]);
  assert.strictEqual(d.heading, 0.1);
  assert.deepStrictEqual(d.slipCombined, [null, 0.4, null, null]);
  assert.deepStrictEqual(d.slipAngle, [null, null, null, null]);
  assert.deepStrictEqual(d.tyreRadius, [null, null, null, null]);
  assert.strictEqual(d.yawRate, 0.2);
});
t('iRacing: no tyre load or slip, missing() reports them', function () {
  var d = SHA.read(fake({
    'DataCorePlugin.CurrentGame': 'IRacing', SpeedKmh: 100,
    'GameRawData.Telemetry.VelocityX': 20, 'GameRawData.Telemetry.LFshockDefl': 0.03,
    'GameRawData.Telemetry.LFtempCM': 70
  }));
  var miss = SHA.missing(d);
  assert.strictEqual(d.sim, 'iracing');
  assert.strictEqual(d.suspTravel[0], 0.03);
  assert.strictEqual(d.suspTravel[1], null);
  assert.strictEqual(d.tyreCore[0], 70);
  assert.ok(miss.indexOf('tyreLoad') >= 0 && miss.indexOf('slipAngle') >= 0);
  assert.strictEqual(d.velFrame, 'unknown');
});
t('temperature units convert to C', function () {
  var g = 'DataCorePlugin.CurrentGame';
  var d = SHA.read(fake({ 'DataCorePlugin.CurrentGame': 'AssettoCorsa', TemperatureUnit: 'Fahrenheit', AirTemperature: 212 }));
  assert.ok(Math.abs(d.airTemp - 100) < 1e-9);
  d = SHA.read(fake({ 'DataCorePlugin.CurrentGame': 'AssettoCorsa', TemperatureUnit: 'Kelvin', AirTemperature: 373.15 }));
  assert.ok(Math.abs(d.airTemp - 100) < 1e-9);
  assert.ok(g);
});
t('garbage values never leak NaN', function () {
  var d = SHA.read(fake({
    'DataCorePlugin.CurrentGame': 'AssettoCorsaCompetizione', SpeedKmh: NaN, Rpms: 'abc',
    'DataCorePlugin.GameRawData.Physics.LocalVelocity01': NaN, 'DataCorePlugin.GameRawData.Physics.LocalVelocity03': 'x', 'DataCorePlugin.GameRawData.Physics.WheelLoad01': undefined
  }));
  assert.strictEqual(d.speed, null);
  assert.strictEqual(d.rpm, null);
  assert.deepStrictEqual(d.vel, [null, null, null]);
  assert.deepStrictEqual(d.tyreLoad, [null, null, null, null]);
});
t('pedals normalise to 0..1 whether SimHub gives 0..1 or 0..100', function () {
  var g = 'DataCorePlugin.CurrentGame';
  var d = SHA.read(fake({ 'DataCorePlugin.CurrentGame': 'AssettoCorsa', Throttle: 80, Brake: 0.5, Clutch: 100 }));
  assert.strictEqual(d.throttle, 0.8);
  assert.strictEqual(d.brake, 0.5);
  assert.strictEqual(d.clutch, 1);
  assert.ok(g);
});
t('lap time parsing: seconds, TimeSpan-like, string', function () {
  assert.strictEqual(SHA.secs(83.5), 83.5);
  assert.strictEqual(SHA.secs({ TotalSeconds: 90 }), 90);
  assert.strictEqual(SHA.secs('01:23.500'), 83.5);
  assert.strictEqual(SHA.secs('zz'), null);
  assert.strictEqual(SHA.secs({ toString: function () { return '-00:05:26.7380000'; } }), -326.738);     // a TimeSpan whose TotalSeconds is not reachable
  assert.strictEqual(SHA.secs({ toString: function () { return '00:02:07.7250000'; } }), 127.725);
  assert.strictEqual(SHA.secs({}), null);
});

var fail = 0;
tests.forEach(function (x) {
  try { x[1](); console.log('ok   ' + x[0]); }
  catch (e) { fail++; console.log('FAIL ' + x[0] + '\n     ' + e.message); }
});
process.exit(fail ? 1 : 0);
