// Fake telemetry for the layout mock. Not shipped to SimHub (browser only, modern JS is fine here).
// Produces frames in the same common schema that lib/adapters.js outputs, so the real physics
// library can run on them. Convention: steer > 0 = left turn, latG > 0 = left, beta > 0 = nose left of travel.
var SIM = (function () {
  var LAP = 60;                       // nominal lap length, s
  // keyframes: t, speed m/s, throttle, brake, steer (rad, + = left)
  var K = [
    [0, 60, 1, 0, 0], [14, 78, 1, 0, 0], [16, 77, 0.1, 0, 0], [17, 76, 0, 0.9, 0], [19, 62, 0, 0.85, 0],
    [21, 50, 0, 0.55, 0.05], [23, 40, 0, 0.35, 0.2], [25, 33, 0, 0.1, 0.33], [27, 32, 0.15, 0, 0.33],
    [29, 36, 0.5, 0, 0.25], [32, 48, 0.9, 0, 0.1], [35, 58, 1, 0, 0], [42, 66, 1, 0, 0],
    [44, 65, 0, 0.3, 0], [46, 55, 0, 0.4, -0.15], [48, 50, 0.3, 0.05, -0.25], [51, 52, 0.6, 0, -0.22],
    [54, 60, 1, 0, -0.05], [57, 62, 1, 0, 0], [60, 60, 1, 0, 0]
  ];
  function smooth(x) { return x * x * (3 - 2 * x); }
  function key(t) {
    var i = 0, a, b, u, j, o = [];
    while (i < K.length - 2 && t >= K[i + 1][0]) { i++; }
    a = K[i]; b = K[i + 1]; u = smooth(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))));
    for (j = 1; j < 5; j++) { o.push(a[j] + (b[j] - a[j]) * u); }
    return o;
  }
  function gauss(t, m, s) { var d = (t - m) / s; return Math.exp(-0.5 * d * d); }
  var STATIC = [2300, 2300, 2700, 2700];
  var best = null;

  function create() {
    return { t: 0, lapT: 0, lap: 1, scale: 1, slide: 1, fuel: 40, lapFuelStart: 40, prev: null, bt: [250, 250, 250, 250],
      tt: [82, 82, 82, 82], tp: [27.0, 27.0, 27.0, 27.0], wear: [8.2, 8.0, 9.1, 9.4], pad: [91.5, 91.2, 93.8, 93.6], disc: [96.8, 96.7, 98.1, 98.0], rnd: 1 };
  }
  function rand(s) { s.rnd = (s.rnd * 16807) % 2147483647; return s.rnd / 2147483647 - 0.5; }

  // advance by dt; returns {frame, lapEnded: {lap, time, valid, startFuel, endFuel} | null}
  function step(s, dt) {
    var tn, k, v, thr, brk, st, vPrev, longG, yaw, latG, beta, f, i, ended = null, p, sx, side;
    s.t += dt; s.lapT += dt;
    var lapLen = LAP * s.scale;
    if (s.lapT >= lapLen) {
      ended = { lap: s.lap, time: s.lapT + s.slideLoss, valid: s.lap !== 3, startFuel: s.lapFuelStart, endFuel: s.fuel, sectors: s.sectors || [20, 20, 20] };
      s.lap++; s.lapT -= lapLen; s.lapFuelStart = s.fuel; s.slideLoss = 0;
      s.scale = 1 + 0.004 * Math.sin(s.lap * 2.3);
      s.slide = s.lap % 2 === 0 ? 1.3 : 0.5;          // even laps: bigger slide
      lapLen = LAP * s.scale;
    }
    if (s.slideLoss === undefined) { s.slideLoss = 0; }
    tn = (s.lapT / lapLen) * LAP;
    k = key(tn); v = k[0]; thr = k[1]; brk = k[2]; st = k[3];
    vPrev = s.prev ? s.prev.v : v;
    longG = dt > 0 ? (v - vPrev) / dt / 9.81 : 0;
    yaw = v * st * 0.055 / (1 + Math.pow(v / 45, 2));
    yaw *= 1 + 0.3 * s.slide * gauss(tn, 25.6, 1.1);   // the slide adds rotation
    latG = yaw * v / 9.81;
    sx = Math.sign(st) || 1;
    beta = 0.10 * st + 0.09 * brk * st + sx * 0.16 * s.slide * gauss(tn, 25.6, 1.1);
    if (Math.abs(st) < 0.02) { beta = 0.02 * Math.sin(tn); }
    // loads
    var ltf = -longG * 900, ltr = latG * 1100, load = [], q;
    load.push(STATIC[0] + ltf / 2 - ltr / 2 + 80 * (v / 70) * (v / 70));
    load.push(STATIC[1] + ltf / 2 + ltr / 2 + 80 * (v / 70) * (v / 70));
    load.push(STATIC[2] - ltf / 2 - ltr / 2 + 120 * (v / 70) * (v / 70));
    load.push(STATIC[3] - ltf / 2 + ltr / 2 + 120 * (v / 70) * (v / 70));
    for (i = 0; i < 4; i++) { load[i] = Math.max(300, load[i] + rand(s) * 40); }
    var travel = [], vel = [];
    for (i = 0; i < 4; i++) { travel.push(0.03 + (load[i] - 2500) / 140000 + rand(s) * 0.002 + (i === 3 && tn > 28.5 && tn < 28.8 ? 0.03 : 0)); }
    if (s.prev) { for (i = 0; i < 4; i++) { vel.push((travel[i] - s.prev.travel[i]) / dt); } } else { vel = [0, 0, 0, 0]; }
    // slip
    var sf = 0.55 * st - 0.2 * beta, sr = 1.0 * beta + 0.12 * st, ang = [sf * 1.08, sf * 0.92, sr * 0.96, sr * 1.04];
    var ratio = [-brk * 0.10, -brk * 0.10, -brk * 0.06 + thr * 0.03 * (tn > 28 && tn < 31 ? 4 : 0), -brk * 0.06 + thr * 0.03 * (tn > 28 && tn < 31 ? 4 : 0)];
    if (tn > 17.4 && tn < 17.9) { ratio[0] = -0.38; }               // front-left lock-up
    var wheelSpeed = [], R = 0.33;
    for (i = 0; i < 4; i++) { wheelSpeed.push(Math.max(0, v * (1 + ratio[i]) / R)); }
    // temps
    for (i = 0; i < 4; i++) {
      s.bt[i] += ((250 + 520 * brk * (i < 2 ? 1 : 0.7) * Math.min(1, v / 60) - s.bt[i]) * 0.25 * dt) - (s.bt[i] - 250) * 0.01 * dt;
      s.tt[i] += ((80 + 22 * Math.abs(latG) * (i % 2 === 0 === (latG > 0) ? 0.7 : 1.1) + 6 * brk - s.tt[i]) * 0.05 * dt);
      s.tp[i] += ((27.0 + (s.tt[i] - 80) * 0.06 - s.tp[i]) * 0.02 * dt);
      s.wear[i] += dt * 0.0006 * (1 + Math.abs(latG) * 0.6);
    }
    for (i = 0; i < 4; i++) { s.pad[i] -= dt * 0.002 * brk * (i < 2 ? 1.3 : 0.8); s.disc[i] -= dt * 0.0003 * brk; }
    // fuel
    s.fuel -= dt * (0.036 + 0.02 * thr);
    // sectors (fake)
    var secIdx = tn < 20 ? 0 : (tn < 40 ? 1 : 2);
    if (!s.sectors) { s.sectors = [null, null, null]; }
    s.sectors[secIdx] = (s.sectors[secIdx] || 0) + 0;
    s.sec = secIdx;
    var gear = Math.max(2, Math.min(6, Math.round(2 + v / 16)));
    var rpm = 4200 + ((v * 60) % 3000) + thr * 800;
    var drift = Math.abs(beta) * 180 / Math.PI;
    if (drift > 4) { s.slideLoss += dt * 0.35; }
    f = {
      sim: 'acc', t: s.t, lap: s.lap, lapT: s.lapT, lapLen: lapLen, tn: tn,
      speed: v, vel: [v * Math.sin(beta), 0, v * Math.cos(beta)], velFrame: 'local', beta_true: beta,
      pitch: longG * 0.012, roll: -latG * 0.02, yawRate: yaw, latG: latG, longG: longG,
      throttle: thr, brake: brk, clutch: 0, steer: st, gear: gear, rpm: rpm, maxRpm: 8200,
      tyreLoad: load, tyrePressure: s.tp.slice(), tyreCore: s.tt.slice(),
      tyreInner: s.tt.map(function (x, j) { return x + (j % 2 ? -3 : 3) * (1 + Math.abs(latG) * 0.5); }),
      tyreMid: s.tt.slice(), tyreOuter: s.tt.map(function (x, j) { return x + (j % 2 ? 3 : -3) * (1 + Math.abs(latG) * 0.5); }),
      slipAngle: ang, slipRatio: ratio, slipCombined: ang.map(function (a, j) { return Math.sqrt(a * a + ratio[j] * ratio[j]); }),
      wheelSpeed: wheelSpeed, tyreRadius: [R, R, R, R], suspTravel: travel, suspVel: vel, suspMax: [0.09, 0.09, 0.1, 0.1],
      brakeTemp: s.bt.slice(), brakePad: s.pad.slice(), brakeDisc: s.disc.slice(), camber: [-0.05, -0.05, -0.04, -0.04], tyreWear: s.wear.slice(),
      fuel: s.fuel, maxFuel: 60, oilTemp: 104 + 4 * Math.sin(s.t / 30), waterTemp: 92 + 2 * Math.sin(s.t / 40),
      airTemp: 24, trackTemp: 38, brakeBias: 57.5,
      absActive: brk > 0.85, tcActive: thr > 0.8 && st > 0.2, offTrack: false, lapInvalid: s.lap === 3,
      position: 4, gapAhead: 1.8 + 0.4 * Math.sin(s.t / 20), gapBehind: 2.6 - 0.5 * Math.sin(s.t / 25),
      sessionTimeLeft: 1800 - s.t, turbo: 0.8 * thr, carId: 'mock_gt3'
    };
    s.prev = { v: v, travel: travel };
    return { frame: f, lapEnded: ended };
  }
  return { create: create, step: step, LAP: LAP };
})();
