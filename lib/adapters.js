// Adapter layer: maps ACC / AC / iRacing SimHub properties into one common schema.
// ES5.1 only. Pure: all property access goes through the injected `prop` function
// (in SimHub: function (n) { return $prop(n); }), so it can be tested with fake data.
// Per-corner arrays are always ordered FL, FR, RL, RR. Missing data is null, never 0.
// Units out: speed m/s, angles rad, temps C, loads N, travel m, pressure in `pressureUnit`.
// Property names are listed in property-map.md; unverified ones are in TO_VERIFY.md.
var SHA = (function () {
  var WHEELS = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'];
  var IR = ['LF', 'RF', 'LR', 'RR'];

  function num(v) {
    if (v === null || v === undefined || typeof v === 'boolean') { return null; }
    if (typeof v === 'string') { if (v === '') { return null; } v = Number(v); }
    if (typeof v !== 'number' || v !== v || v === Infinity || v === -Infinity) { return null; }
    return v;
  }
  function nulls(n) { var o = [], i; for (i = 0; i < n; i++) { o.push(null); } return o; }
  // Seconds from a number, a TimeSpan-like object ({TotalSeconds}) or a "mm:ss.fff" string.
  function secs(v) {
    var n = num(v), m, parts, i, t;
    if (n !== null) { return n; }
    var s, neg = false;
    if (v && typeof v === 'object') { n = num(v.TotalSeconds); if (n !== null) { return n; } s = String(v); }     // a .NET TimeSpan: TotalSeconds, else its text '-00:05:26.7380000'
    else if (typeof v === 'string') { s = v; }
    else { return null; }
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
    parts = s.split(':'); t = 0;
    for (i = 0; i < parts.length; i++) { m = num(parts[i]); if (m === null) { return null; } t = t * 60 + m; }
    return neg ? -t : t;
  }
  function arrN(v, n) {
    var out = [], i, ok = false, x;
    for (i = 0; i < n; i++) {
      x = (v !== null && v !== undefined && typeof v === 'object') ? num(v[i]) : null;
      if (x !== null) { ok = true; }
      out.push(x);
    }
    return ok ? out : nulls(n);
  }
  function mapArr(a, f) { var o = [], i; for (i = 0; i < a.length; i++) { o.push(a[i] === null ? null : f(a[i])); } return o; }
  function four(prop, names) { var o = [], i; for (i = 0; i < 4; i++) { o.push(num(prop(names[i]))); } return o; }
  function mapNames(base) { var o = [], i; for (i = 0; i < 4; i++) { o.push(base + WHEELS[i]); } return o; }
  // Pedals as 0..1. SimHub may report 0..100; values above 1 are treated as percent.
  function pedal(v) { var n = num(v); return n === null ? null : (n > 1 ? n / 100 : n); }
  function bool(v) { return (v === undefined || v === null) ? null : !!v; }
  function div(v, k) { var n = num(v); return n === null ? null : n / k; }
  function tempC(c, unit) {
    if (c === null) { return null; }
    if (unit === 'Kelvin') { return c - 273.15; }
    if (unit === 'Fahrenheit') { return (c - 32) / 1.8; }
    return c;
  }

  function detectSim(prop) {
    var g = prop('DataCorePlugin.CurrentGame');
    if (g === 'IRacing') { return 'iracing'; }
    if (g === 'AssettoCorsaCompetizione') { return 'acc'; }
    if (g === 'AssettoCorsa') { return 'ac'; }
    return null;
  }

  function empty() {
    return {
      sim: null,
      speed: null, vel: nulls(3), velFrame: null, heading: null, pitch: null, roll: null,
      yawRate: null, latG: null, longG: null,
      throttle: null, brake: null, clutch: null, steer: null, gear: null, rpm: null, maxRpm: null,
      tyreLoad: nulls(4), tyrePressure: nulls(4), tyreCore: nulls(4),
      tyreInner: nulls(4), tyreMid: nulls(4), tyreOuter: nulls(4), tyreTempAvg: nulls(4),
      slipAngle: nulls(4), slipRatio: nulls(4), wheelSpeed: nulls(4),
      suspTravel: nulls(4), suspVel: nulls(4), brakeTemp: nulls(4), camber: nulls(4), tyreWear: nulls(4),
      fuel: null, maxFuel: null, oilTemp: null, waterTemp: null, airTemp: null, trackTemp: null,
      brakeBias: null, absActive: null, absLevel: null, tcActive: null, tcLevel: null,
      currentLap: null, completedLaps: null, currentLapTime: null, bestLapTime: null, lastLapTime: null,
      lapInvalid: null, inPitLane: null, position: null, opponents: null, totalLaps: null,
      sessionTimeLeft: null, turbo: null, pressureUnit: null, brakePad: nulls(4), brakeDisc: nulls(4),
      worldVel: nulls(3), slipCombined: nulls(4), suspMax: nulls(4), tyreRadius: nulls(4), carId: null,
      gapAhead: null, gapBehind: null, deltaBest: null
    };
  }

  // Normalised SimHub (DataCore) values shared by all sims.
  function common(prop, out) {
    var tu = prop('TemperatureUnit');
    out.pressureUnit = prop('TyrePressureUnit') || null;
    out.speed = div(prop('SpeedKmh'), 3.6);
    out.throttle = pedal(prop('Throttle'));
    out.brake = pedal(prop('Brake'));
    out.clutch = pedal(prop('Clutch'));
    out.gear = prop('Gear') === undefined ? null : prop('Gear');
    out.rpm = num(prop('Rpms'));
    out.maxRpm = num(prop('MaxRpm'));
    out.fuel = num(prop('Fuel'));
    out.maxFuel = num(prop('MaxFuel'));
    out.oilTemp = tempC(num(prop('OilTemperature')), tu);       // name unverified
    out.waterTemp = tempC(num(prop('WaterTemperature')), tu);   // name unverified
    out.airTemp = tempC(num(prop('AirTemperature')), tu);
    out.trackTemp = tempC(num(prop('RoadTemperature')), tu);
    out.brakeBias = num(prop('BrakeBias'));
    out.absActive = bool(prop('ABSActive'));
    out.absLevel = num(prop('ABSLevel'));
    out.tcActive = bool(prop('TCActive'));
    out.tcLevel = num(prop('TCLevel'));
    out.currentLap = num(prop('CurrentLap'));
    out.completedLaps = num(prop('DataCorePlugin.GameData.CompletedLaps'));
    out.currentLapTime = secs(prop('CurrentLapTime'));
    out.bestLapTime = secs(prop('BestLapTime'));
    out.lastLapTime = secs(prop('LastLapTime'));
    out.lapInvalid = bool(prop('DataCorePlugin.GameData.LapInvalidated'));
    out.inPitLane = bool(prop('IsInPitLane'));
    out.position = num(prop('Position'));
    out.opponents = num(prop('OpponentsCount'));
    out.totalLaps = num(prop('TotalLaps'));
    out.sessionTimeLeft = secs(prop('SessionTimeLeft'));
    out.tyrePressure = four(prop, mapNames('DataCorePlugin.GameData.TyrePressure'));
    out.tyreWear = four(prop, mapNames('DataCorePlugin.GameData.TyreWear'));
    out.brakeTemp = mapArr(four(prop, mapNames('DataCorePlugin.GameData.BrakeTemperature')), function (x) { return tempC(x, tu); });
    out.tyreTempAvg = mapArr(four(prop, mapNames('DataCorePlugin.GameData.TyreTemperature')), function (x) { return tempC(x, tu); });
  }

  // Per-corner / per-axis values. In SimHub 9.12.9 the ACC/AC raw struct is flattened into scalar
  // properties named <Base>01..04 (see SimHub-property-catalog.json), so read those first and fall
  // back to an array-valued property of `altName` if it exists (the reference dash reads one that way).
  function suffixed(prop, base, n, altName) {
    var o = [], i, ok = false, x, alt;
    for (i = 0; i < n; i++) {
      x = num(prop(base + '0' + (i + 1)));
      if (x !== null) { ok = true; }
      o.push(x);
    }
    if (ok) { return o; }
    if (altName) { alt = arrN(prop(altName), n); return alt; }
    return nulls(n);
  }

  // ACC and AC share the shared-memory Physics struct. Names below are confirmed for ACC in the
  // property catalog; AC has not been catalogued yet (see TO_VERIFY.md).
  function sharedMemory(prop, out, isAcc) {
    var P = 'DataCorePlugin.GameRawData.Physics.';
    var S = 'DataCorePlugin.GameRawData.StaticInfo.';
    var tu = prop('TemperatureUnit');
    var av, g, i, w, pos = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'];
    out.worldVel = suffixed(prop, P + 'Velocity', 3);        // world frame
    if (isAcc) { out.vel = suffixed(prop, P + 'LocalVelocity', 3); out.velFrame = 'local'; }   // ACC only: preferred for beta
    else { out.vel = out.worldVel; out.velFrame = 'world'; }                                          // AC: world + heading (self-calibrated)
    out.heading = num(prop(P + 'Heading'));
    out.pitch = num(prop(P + 'Pitch'));
    out.roll = num(prop(P + 'Roll'));
    av = isAcc ? suffixed(prop, P + 'LocalAngularVelocity', 3) : nulls(3);
    out.yawRate = isAcc ? av[1] : num(prop('DataCorePlugin.GameData.OrientationYawVelocity'));   // sign and units unverified
    g = suffixed(prop, P + 'AccG', 3);
    out.latG = g[0];
    out.longG = g[2];
    out.steer = num(prop(P + 'SteerAngle'));
    out.tyreLoad = suffixed(prop, P + 'WheelLoad', 4);
    if (isAcc) {
      out.slipAngle = suffixed(prop, P + 'SlipAngle', 4);
      out.slipRatio = suffixed(prop, P + 'SlipRatio', 4);
      if (out.slipAngle.join('') === '') { out.slipAngle = suffixed(prop, P + 'slipAngle', 4); }      // the ACC catalog spells them slipAngle01 / slipRatio01
      if (out.slipRatio.join('') === '') { out.slipRatio = suffixed(prop, P + 'slipRatio', 4); }
    }
    out.slipCombined = suffixed(prop, P + 'WheelSlip', 4);   // AC: the only slip value; magnitude, not split into angle/ratio
    out.suspTravel = suffixed(prop, P + 'SuspensionTravel', 4, P + 'suspensionTravel');
    out.suspMax = isAcc ? suffixed(prop, S + 'SuspensionMaxTravel', 4) : nulls(4);
    out.wheelSpeed = suffixed(prop, P + 'WheelAngularSpeed', 4);
    out.tyreRadius = isAcc ? suffixed(prop, S + 'TyreRadius', 4) : nulls(4);
    out.camber = suffixed(prop, P + 'CamberRad', 4);
    out.tyreCore = mapArr(suffixed(prop, P + 'TyreCoreTemperature', 4, P + 'tyreCoreTemperature'), function (x) { return tempC(x, tu); });
    for (i = 0; i < 4; i++) {
      w = 'DataCorePlugin.GameData.TyreTemperature' + pos[i];
      out.tyreInner[i] = tempC(num(prop(w + 'Inner')), tu);
      out.tyreMid[i] = tempC(num(prop(w + 'Middle')), tu);
      out.tyreOuter[i] = tempC(num(prop(w + 'Outer')), tu);
    }
    out.turbo = num(prop(P + 'Turbo'));
    if (isAcc) { out.brakePad = suffixed(prop, P + 'padLife', 4); out.brakeDisc = suffixed(prop, P + 'discLife', 4); }   // units unverified
    out.carId = prop('DataCorePlugin.GameData.CarId') === undefined ? null : prop('DataCorePlugin.GameData.CarId');
    out.gapAhead = isAcc ? num(prop('DataCorePlugin.GameRawData.Graphics.gapAhead')) : null;
    out.gapBehind = isAcc ? num(prop('DataCorePlugin.GameRawData.Graphics.gapBehind')) : null;
    out.deltaBest = num(prop('DataCorePlugin.GameData.DeltaToSessionBest'));
  }

  function iracing(prop, out) {
    var T = 'GameRawData.Telemetry.';
    var i, tu = prop('TemperatureUnit');
    out.vel = [num(prop(T + 'VelocityX')), num(prop(T + 'VelocityY')), num(prop(T + 'VelocityZ'))];
    out.velFrame = 'unknown';                      // car-local vs world not verified
    out.heading = num(prop(T + 'Yaw'));
    out.pitch = num(prop(T + 'Pitch'));
    out.roll = num(prop(T + 'Roll'));
    out.yawRate = num(prop(T + 'YawRate'));
    out.latG = div(prop(T + 'LatAccel'), 9.80665);     // m/s^2, SDK says gravity included
    out.longG = div(prop(T + 'LongAccel'), 9.80665);
    out.steer = num(prop(T + 'SteeringWheelAngle'));
    for (i = 0; i < 4; i++) {
      out.suspTravel[i] = num(prop(T + IR[i] + 'shockDefl'));
      out.suspVel[i] = num(prop(T + IR[i] + 'shockVel'));
      out.tyreCore[i] = tempC(num(prop(T + IR[i] + 'tempCM')), tu);   // tempCM is used by the reference dash
      out.tyreInner[i] = tempC(num(prop(T + IR[i] + 'tempCL')), tu);
      out.tyreMid[i] = tempC(num(prop(T + IR[i] + 'tempCM')), tu);
      out.tyreOuter[i] = tempC(num(prop(T + IR[i] + 'tempCR')), tu);
    }
    // iRacing exposes no per-tyre load, slip angle or slip ratio: they stay null (panels show n/a).
  }

  function read(prop) {
    var out = empty(), sim = detectSim(prop);
    out.sim = sim;
    if (sim === null) { return out; }
    common(prop, out);
    if (sim === 'iracing') { iracing(prop, out); } else { sharedMemory(prop, out, sim === 'acc'); }
    return out;
  }

  // Fields with no data this frame; the UI draws "n/a" for panels that depend on them.
  function missing(d) {
    var keys = ['vel', 'heading', 'tyreLoad', 'slipAngle', 'slipRatio', 'slipCombined', 'wheelSpeed', 'suspTravel',
      'suspVel', 'brakeTemp', 'camber', 'tyreCore', 'tyreInner', 'tyrePressure', 'tyreWear', 'yawRate'];
    var out = [], i, k, v, any, j;
    for (i = 0; i < keys.length; i++) {
      k = keys[i]; v = d[k]; any = false;
      if (v instanceof Array) { for (j = 0; j < v.length; j++) { if (v[j] !== null) { any = true; } } }
      else { any = v !== null; }
      if (!any) { out.push(k); }
    }
    return out;
  }

  return { read: read, detectSim: detectSim, missing: missing, num: num, secs: secs, arrN: arrN };
})();
if (typeof module !== 'undefined' && module.exports) { module.exports = SHA; }
