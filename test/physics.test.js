var assert = require('assert');
var P = require('../lib/physics.js');
var D2R = Math.PI / 180;
var tests = [];
function t(name, f) { tests.push([name, f]); }
function near(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= (tol || 1e-9), (msg || '') + ' expected ' + b + ' got ' + a); }
var NOSMOOTH = P.cfg({ betaAlpha: 1 });

// world velocity for travel direction theta (clockwise from +z toward +x) at speed s
function wv(theta, s) { return [Math.sin(theta) * s, 0, Math.cos(theta) * s]; }

t('straight line: beta = 0 for any heading', function () {
  [0, 0.7, -2.1, 3.0].forEach(function (h) {
    var r = P.bodySlip({}, wv(h, 40), h, NOSMOOTH);
    near(r.beta, 0, 1e-9, 'heading ' + h);
    assert.strictEqual(r.gated, false);
  });
});
t('steady-state cornering: small constant beta stays constant and green', function () {
  var st = {}, i, r, h = 1.0, d = 1.5 * D2R;
  for (i = 0; i < 50; i++) { r = P.bodySlip(st, wv(h + d, 30), h, P.cfg()); }
  near(r.beta, d, 1e-6);
  assert.strictEqual(P.slipBand(r.beta, P.cfg()), 'green');
});
t('pure drift: known angle, sign and band', function () {
  var h = 0.4, r;
  r = P.bodySlip({}, wv(h + 20 * D2R, 25), h, NOSMOOTH);    // travelling 20 deg right of the nose
  near(r.beta, 20 * D2R, 1e-9);
  assert.ok(r.beta > 0, 'nose left of travel is positive');
  assert.strictEqual(P.slipBand(r.beta, P.cfg()), 'red');
  r = P.bodySlip({}, wv(h - 6 * D2R, 25), h, NOSMOOTH);
  near(r.beta, -6 * D2R, 1e-9);
  assert.strictEqual(P.slipBand(r.beta, P.cfg()), 'amber');
});
t('local frame velocity works without heading', function () {
  var c = P.cfg({ betaAlpha: 1, velFrame: 'local', localLongIdx: 0, localLatIdx: 1 });
  var r = P.bodySlip({}, [30, 30 * Math.tan(10 * D2R), 0], null, c);
  near(r.beta, 10 * D2R, 1e-9);
});
t('low speed gate returns 0 and resets smoothing', function () {
  var st = {}, r;
  P.bodySlip(st, wv(1, 30), 0.5, P.cfg());
  assert.ok(st.beta !== null);
  r = P.bodySlip(st, wv(1, 2), 0.2, P.cfg());
  assert.strictEqual(r.beta, 0); assert.strictEqual(r.gated, true); assert.strictEqual(st.beta, null);
});
t('smoothing converges to the raw value', function () {
  var st = {}, i, r;
  for (i = 0; i < 60; i++) { r = P.bodySlip(st, wv(0.2, 30), 0, P.cfg({ betaAlpha: 0.3 })); }
  near(r.beta, 0.2, 1e-6);
});
t('null, NaN and short inputs give null and never throw', function () {
  var c = P.cfg(), st = {};
  assert.strictEqual(P.bodySlip(st, null, 0, c), null);
  assert.strictEqual(P.bodySlip(st, [NaN, 0, 1], 0, c), null);
  assert.strictEqual(P.bodySlip(st, [1, 0, 1], NaN, c), null);
  assert.strictEqual(P.bodySlip(st, [1, 0], 0, c), null);
  assert.strictEqual(P.slipBand(NaN, c), null);
  assert.strictEqual(P.loadCenter({}, [1, NaN, 1, 1], 20, c), null);
  assert.strictEqual(P.balance({}, null, 20, 1, c), null);
  assert.strictEqual(P.damperUpdate({}, [NaN, 0, 0, 0], 0.016, null, c), null);
  assert.strictEqual(P.fuelRecordLap({}, NaN, 1, true, c), null);
  assert.deepStrictEqual(P.lockups({}, NaN, 1, 0, null, null, c), [false, false, false, false]);
});

t('frame calibration learns an unknown heading sign and offset from straight running', function () {
  var st = {}, c = P.cfg(), i, seg, h, th, r, res;
  // truth in this fake sim: travel direction = -heading + 0.7. Eight straights on different headings.
  for (seg = 0; seg < 8; seg++) {
    for (i = 0; i < 60; i++) {
      h = seg * 0.8 - 2.5 + i * 0.0002;
      th = -h + 0.7;
      r = P.frameCalib(st, wv(th, 40), h, 0.016, c);
    }
  }
  assert.strictEqual(r.calibrated, true);
  assert.strictEqual(r.sign, -1);
  near(r.offset, 0.7, 1e-6);
  var cc = P.calibratedCfg(st, P.cfg({ betaAlpha: 1 }));
  res = P.bodySlip({}, wv(-(1.2) + 0.7 + 10 * D2R, 40), 1.2, cc);       // 10 deg drift under that mapping
  near(res.beta, 10 * D2R, 1e-6);
});
t('frame calibration refuses to decide from a single heading', function () {
  var st = {}, c = P.cfg(), i, r;
  for (i = 0; i < 400; i++) { r = P.frameCalib(st, wv(0.7, 40), 1.0 + i * 0.0001, 0.016, c); }
  assert.strictEqual(r.calibrated, false);
});
t('frame calibration ignores corners, low speed and bad data', function () {
  var st = {}, c = P.cfg(), i, r, h = 0;
  for (i = 0; i < 400; i++) { h += 0.05; r = P.frameCalib(st, wv(h + 0.3, 40), h, 0.016, c); }   // turning hard: 3 rad/s
  assert.strictEqual(r.calibrated, false);
  assert.strictEqual(r.n, 0);
  for (i = 0; i < 400; i++) { r = P.frameCalib(st, wv(0.3, 5), 0.3, 0.016, c); }                  // too slow
  assert.strictEqual(r.n, 0);
  r = P.frameCalib(st, [NaN, 0, 1], 0.3, 0.016, c);
  assert.strictEqual(r.calibrated, false);
  assert.strictEqual(P.calibratedCfg({}, c), c);
});

t('ring buffer wraparound keeps the newest n, oldest first', function () {
  var rb = P.rbNew(4), i;
  for (i = 1; i <= 3; i++) { P.rbPush(rb, i); }
  assert.deepStrictEqual(P.rbToArray(rb), [1, 2, 3]);
  for (i = 4; i <= 10; i++) { P.rbPush(rb, i); }
  assert.deepStrictEqual(P.rbToArray(rb), [7, 8, 9, 10]);
  assert.strictEqual(rb.count, 4);
});
t('trace buffers hold 3 s at the configured size', function () {
  var st = {}, c = P.cfg({ traceN: 5 }), i;
  for (i = 0; i < 12; i++) { P.tracePush(st, c, i, 0, 0, 0); }
  assert.deepStrictEqual(P.rbToArray(st.trace.beta), [7, 8, 9, 10, 11]);
});

t('load centre: static point is learned, offsets are signed and clamped', function () {
  var st = {}, c = P.cfg(), r, i;
  for (i = 0; i < 40; i++) { P.loadCenter(st, [2200, 2200, 2800, 2800], 0, c); }   // static 44% front, 50% left
  r = P.loadCenter(st, [2200, 2200, 2800, 2800], 30, c);
  near(r.x, 0, 1e-6); near(r.y, 0, 1e-6); assert.strictEqual(r.learned, true);
  r = P.loadCenter(st, [2600, 2600, 2400, 2400], 30, c);     // forward weight transfer (braking)
  assert.ok(r.y > 0);
  r = P.loadCenter(st, [1500, 3000, 1500, 3000], 30, c);     // load on the right
  assert.ok(r.x > 0);
  r = P.loadCenter(st, [0, 9000, 0, 9000], 30, c);
  assert.strictEqual(r.x, 1);
});

t('phase detector walks Straight, Braking, Trail, Rotation, Power', function () {
  var st = {}, c = P.cfg({ minDwell: 0 }), seq = [];
  function s(b, th, steer, beta) { seq.push(P.phaseStep(st, b, th, steer, beta, 0.016, c)); }
  s(0, 1, 0, 0);
  s(0.8, 0, 0, 0);
  s(0.5, 0, 0.3, 0);
  s(0, 0, 0.3, 6 * D2R);
  s(0, 0.6, 0.3, 1 * D2R);
  assert.deepStrictEqual(seq, ['STRAIGHT', 'BRAKING', 'TRAIL', 'ROTATION', 'POWER']);
});
t('phase detector hysteresis: no flicker around the brake threshold', function () {
  var st = {}, c = P.cfg({ minDwell: 0 }), i, changes = 0, prev = null, s;
  for (i = 0; i < 20; i++) {
    s = P.phaseStep(st, i % 2 ? 0.13 : 0.08, 0, 0, 0, 0.016, c);   // between on (0.12) and off (0.05)
    if (prev !== null && s !== prev) { changes++; }
    prev = s;
  }
  assert.ok(changes <= 1, 'changes ' + changes);
});
t('phase detector minimum dwell delays a switch', function () {
  var st = {}, c = P.cfg({ minDwell: 0.1 }), i, s;
  P.phaseStep(st, 0, 1, 0, 0, 0.016, c);
  s = P.phaseStep(st, 0.8, 0, 0, 0, 0.016, c);
  assert.strictEqual(s, 'STRAIGHT');
  for (i = 0; i < 8; i++) { s = P.phaseStep(st, 0.8, 0, 0, 0, 0.016, c); }
  assert.strictEqual(s, 'BRAKING');
});

t('balance meter: left and right turns read the same (understeer positive)', function () {
  var c = P.cfg({ balanceAlpha: 1 });
  var left = P.balance({}, [0.10, 0.10, 0.04, 0.04], 30, 1.2, c);     // front slips more
  var right = P.balance({}, [-0.10, -0.10, -0.04, -0.04], 30, -1.2, c);
  near(left.value, right.value, 1e-9);
  assert.ok(left.value > 0); assert.strictEqual(left.label, 'understeer');
  var over = P.balance({}, [0.03, 0.03, 0.09, 0.09], 30, 1.2, c);
  assert.ok(over.value < 0); assert.strictEqual(over.label, 'oversteer');
});
t('balance meter: peak hold per corner, stored on exit, reset for next corner', function () {
  var st = {}, c = P.cfg({ balanceAlpha: 1 }), r;
  P.balance(st, [0.10, 0.10, 0.04, 0.04], 30, 1.2, c);
  r = P.balance(st, [0.14, 0.14, 0.04, 0.04], 30, 1.2, c);
  assert.ok(r.peakUnder > 5);
  r = P.balance(st, [0, 0, 0, 0], 30, 0.0, c);              // corner over
  assert.strictEqual(r.peakUnder, 0); assert.ok(r.lastUnder > 5);
});
t('estimated balance: needs calibration, then reads understeer when yaw rate falls short', function () {
  var st = {}, c = P.cfg({ estCalN: 20, estAlpha: 1 }), i, r, v = 30, steer = 0.1;
  assert.strictEqual(P.estBalance(st, v, steer, 0.5, 1.0, c), null, 'uncalibrated');
  for (i = 0; i < 40; i++) { P.estBalance(st, v, steer, 0.2 * v * steer, 0.1, c); }   // k = 0.2 in the linear range
  r = P.estBalance(st, v, steer, 0.2 * v * steer * 0.7, 1.4, c);                       // yaw rate 30% short
  near(r.value, 0.3, 1e-9); assert.strictEqual(r.label, 'understeer'); assert.strictEqual(r.estimated, true);
  r = P.estBalance(st, v, steer, 0.2 * v * steer * 1.3, 1.4, c);
  assert.strictEqual(r.label, 'oversteer');
  r = P.estBalance(st, v, -steer, -0.2 * v * steer * 0.7, 1.4, c);                      // opposite direction reads the same
  near(r.value, 0.3, 1e-9);
});
t('estimated balance borrows the nearest calibrated speed bucket and says so', function () {
  var st = {}, c = P.cfg({ estCalN: 20, estAlpha: 1 }), i, r, steer = 0.1;
  for (i = 0; i < 40; i++) { P.estBalance(st, 25, steer, 0.2 * 25 * steer, 0.1, c); }      // calibrated in the 20-30 m/s bucket only
  r = P.estBalance(st, 35, steer, 0.2 * 35 * steer * 0.7, 1.4, c);                       // 30-40 m/s, never calibrated
  assert.ok(r, 'falls back to the neighbour'); assert.strictEqual(r.extrapolated, true);
  r = P.estBalance(st, 75, steer, 0.5, 1.4, c);                                          // far from any calibrated bucket
  assert.strictEqual(r, null);
  r = P.estBalance(st, 25, steer, 0.2 * 25 * steer * 0.7, 1.4, c);
  assert.strictEqual(r.extrapolated, false);
});
t('estimated load centre: shock based and accel fallback are marked estimated', function () {
  var st = {}, c = P.cfg(), r, i;
  for (i = 0; i < 40; i++) { P.estLoadCenter(st, [0.03, 0.03, 0.04, 0.04], 0, 0, 0, c); }
  r = P.estLoadCenter(st, [0.05, 0.05, 0.03, 0.03], 0, 0, 30, c);
  assert.strictEqual(r.estimated, true); assert.strictEqual(r.source, 'shock'); assert.ok(r.y > 0);
  r = P.estLoadCenter({}, null, 1.5, 0, 30, c);
  assert.strictEqual(r.source, 'accel'); near(r.x, 1, 1e-9);
  assert.strictEqual(P.estLoadCenter({}, null, NaN, 0, 30, c), null);
});

t('grip utilization: fraction of the session peak, reset when the car changes', function () {
  var st = {}, c = P.cfg(), r;
  P.gripUpdate(st, 'car1', [0.10, 0.10, 0.10, 0.10], [0, 0, 0, 0], c);
  r = P.gripUpdate(st, 'car1', [0.05, 0.05, 0.05, 0.05], [0, 0, 0, 0], c);
  near(r.util[0], 0.5, 1e-9); assert.strictEqual(r.estimated, true);
  r = P.gripUpdate(st, 'car2', [0.05, 0.05, 0.05, 0.05], [0, 0, 0, 0], c);   // new car: peak starts over
  near(r.util[0], 1, 1e-9);
  assert.strictEqual(st.grip.carId, 'car2');
});

t('grip utilization reports learning until it has enough samples', function () {
  var st = {}, c = P.cfg({ gripWarmup: 5 }), r, i;
  for (i = 0; i < 4; i++) { r = P.gripUpdate(st, 'c', [0.1, 0.1, 0.1, 0.1], [0, 0, 0, 0], c); }
  assert.strictEqual(r.learning, true);
  r = P.gripUpdate(st, 'c', [0.1, 0.1, 0.1, 0.1], [0, 0, 0, 0], c);
  assert.strictEqual(r.learning, false);
  r = P.gripUpdate(st, 'c2', [0.1, 0.1, 0.1, 0.1], [0, 0, 0, 0], c);
  assert.strictEqual(r.learning, true, 'car change restarts learning');
});
t('damper velocity: irregular frame times, histogram bins, bad dt skipped', function () {
  var st = {}, c = P.cfg(), r;
  P.damperUpdate(st, [0, 0, 0, 0], 0.016, null, c);
  r = P.damperUpdate(st, [0.002, 0, 0, 0], 0.010, null, c);      // 0.2 m/s
  near(r.vel[0], 0.2, 1e-9);
  r = P.damperUpdate(st, [0.002 + 0.0045, 0, 0, 0], 0.045, null, c);  // 0.1 m/s, different dt
  near(r.vel[0], 0.1, 1e-9);
  r = P.damperUpdate(st, [0.5, 0, 0, 0], 0.5, null, c);          // dt too long: no velocity
  assert.strictEqual(r.vel[0], null);
  r = P.damperUpdate(st, [0.5, 0, 0, 0], 0, null, c);            // dt zero: no velocity
  assert.strictEqual(r.vel[0], null);
  assert.strictEqual(st.damp.hist[0][6], 1, '0.15..0.3 bin');
  assert.strictEqual(st.damp.hist[0][5], 1, '0.05..0.15 bin');
});
t('damper limits: bottoming and topping are learned and counted once per hit', function () {
  var st = {}, c = P.cfg({ limitWarmup: 5 }), i, r, x;
  for (i = 0; i < 40; i++) { x = 0.05 + 0.03 * Math.sin(i / 3); P.damperUpdate(st, [x, 0.05, 0.05, 0.05], 0.016, null, c); }
  P.damperUpdate(st, [0.05, 0.05, 0.05, 0.05], 0.016, null, c);
  r = P.damperUpdate(st, [0.0801, 0.05, 0.05, 0.05], 0.016, null, c);
  assert.strictEqual(r.bottom[0], true);
  P.damperUpdate(st, [0.0801, 0.05, 0.05, 0.05], 0.016, null, c);    // still bottomed: same hit
  r = P.damperUpdate(st, [0.05, 0.05, 0.05, 0.05], 0.016, null, c);
  assert.strictEqual(r.bottom[0], false);
  assert.ok(r.bottomCount[0] >= 1);
  r = P.damperUpdate(st, [0.05, 0.05, 0.05, 0.05], 0.016, [1, 2, 3, 4], c);   // direct velocities win
  assert.deepStrictEqual(r.vel, [1, 2, 3, 4]);
});

t('lock-up: by slip ratio', function () {
  var c = P.cfg();
  assert.deepStrictEqual(P.lockups({}, 40, 0.8, 0, null, [-0.5, -0.05, 0, 0], c), [true, false, false, false]);
  assert.deepStrictEqual(P.lockups({}, 40, 0.1, 0, null, [-0.5, 0, 0, 0], c), [false, false, false, false], 'light braking is not a lock-up');
});
t('lock-up: known tyre radius needs no learning', function () {
  var c = P.cfg(), ws = 40 / 0.33, rad = [0.33, 0.33, 0.33, 0.33];
  assert.deepStrictEqual(P.lockups({}, 40, 0.8, 0, [ws * 0.5, ws, ws, ws], null, c, rad), [true, false, false, false]);
});
t('damper limits: known max travel flags bottoming at once', function () {
  var st = {}, c = P.cfg(), r;
  r = P.damperUpdate(st, [0.05, 0.05, 0.05, 0.05], 0.016, null, c, [0.1, 0.1, 0.1, 0.1]);
  assert.strictEqual(r.bottom[0], false);
  r = P.damperUpdate(st, [0.099, 0.05, 0.05, 0.05], 0.016, null, c, [0.1, 0.1, 0.1, 0.1]);
  assert.strictEqual(r.bottom[0], true);
  assert.strictEqual(r.bottomCount[0], 1);
  r = P.damperUpdate(st, [0.001, 0.05, 0.05, 0.05], 0.016, null, c, [0.1, 0.1, 0.1, 0.1]);
  assert.strictEqual(r.top[0], true);
});
t('lock-up: by wheel speed with a learned rolling radius', function () {
  var st = {}, c = P.cfg(), i, r, ws = 40 / 0.33;
  for (i = 0; i < 400; i++) { P.lockups(st, 40, 0, 0, [ws, ws, ws, ws], null, c); }   // coasting teaches the radius
  r = P.lockups(st, 40, 0.8, 0, [ws * 0.5, ws, ws, ws], null, c);
  assert.deepStrictEqual(r, [true, false, false, false]);
  r = P.lockups(st, 40, 0.8, 0, [0, ws, ws, ws], null, c);                              // fully stopped wheel
  assert.strictEqual(r[0], true);
});

t('event buffer: overflow keeps the newest 50, oldest first, with lap numbers', function () {
  var st = {}, c = P.cfg({ eventGap: 0 }), i;
  for (i = 0; i < 80; i++) {
    P.eventsUpdate(st, { t: i * 2, lap: i, band: 'red' }, c);
    P.eventsUpdate(st, { t: i * 2 + 1, lap: i, band: 'green' }, c);   // release so the next red is an edge
  }
  var list = P.eventList(st);
  assert.strictEqual(list.length, 50);
  assert.strictEqual(list[0].lap, 30); assert.strictEqual(list[49].lap, 79);
  assert.strictEqual(list[0].type, 'SLIDE');
});
t('events: edge triggered with a minimum gap, all types', function () {
  var st = {}, c = P.cfg({ eventGap: 1 }), added;
  added = P.eventsUpdate(st, { t: 10, lap: 2, band: 'red', lock: [false, true, false, false], absActive: true, tcActive: true, offTrack: true }, c);
  assert.strictEqual(added.length, 5);
  added = P.eventsUpdate(st, { t: 10.2, lap: 2, band: 'red', lock: [false, true, false, false], absActive: true }, c);
  assert.strictEqual(added.length, 0, 'held, not re-fired');
  P.eventsUpdate(st, { t: 10.3, lap: 2, band: 'green' }, c);
  added = P.eventsUpdate(st, { t: 10.5, lap: 2, band: 'red' }, c);
  assert.strictEqual(added.length, 0, 'inside the minimum gap');
  P.eventsUpdate(st, { t: 10.6, lap: 2, band: 'green' }, c);
  added = P.eventsUpdate(st, { t: 12, lap: 2, band: 'red' }, c);
  assert.strictEqual(added.length, 1);
});

t('driver metrics: trail brake, overlap, reversals, smoothness, best lap compare', function () {
  var st = {}, c = P.cfg(), i, snap;
  for (i = 0; i < 100; i++) { P.metricsUpdate(st, 0.5, 0.0, 0.3, 0.01, c); }     // 1 s trail braking
  for (i = 0; i < 50; i++) { P.metricsUpdate(st, 0.3, 0.3, 0.0, 0.01, c); }      // 0.5 s overlap
  P.metricsUpdate(st, 0, 0, 0.3, 0.01, c); P.metricsUpdate(st, 0, 0, -0.3, 0.01, c); P.metricsUpdate(st, 0, 0, 0.3, 0.01, c);
  snap = P.metricsLapEnd(st, 90, true);
  near(snap.trail, 1.0, 1e-9); near(snap.overlap, 0.5, 1e-9); near(snap.brakePeak, 0.5, 1e-9);
  assert.strictEqual(snap.reversals, 2);
  assert.strictEqual(st.mcBest.lapTime, 90);
  P.metricsUpdate(st, 0.9, 0, 0, 0.01, c);
  P.metricsLapEnd(st, 95, true);                                                  // slower lap does not replace best
  assert.strictEqual(st.mcBest.lapTime, 90);
  P.metricsLapEnd(st, 80, false);                                                 // invalid lap never becomes best
  assert.strictEqual(st.mcBest.lapTime, 90);
  var st2 = {}, a, b;
  for (i = 0; i < 20; i++) { P.metricsUpdate(st2, 0, 0.3 + i * 0.01, 0, 0.016, c); }
  a = P.metricsSnapshot(st2.mc).smoothness;
  st2 = {};
  for (i = 0; i < 20; i++) { P.metricsUpdate(st2, 0, i % 2 ? 0.8 : 0.2, 0, 0.016, c); }
  b = P.metricsSnapshot(st2.mc).smoothness;
  assert.ok(a < b, 'steady application is smoother');
});

t('braking zones: start, peak, decel, trail, ABS edges, end after the gap', function () {
  var st = {}, c = P.cfg(), dt = 0.01, i, live, z;
  function fr(b, sp, steer, lg, abs) { return { lap: 3, pos: 0.4, speed: sp, brake: b, steer: steer, longG: lg, abs: abs, lock: false }; }
  for (i = 0; i < 50; i++) { P.zoneUpdate(st, fr(0, 60, 0, 0, false), dt, c); }
  assert.strictEqual(P.zoneLive(st), null);
  for (i = 0; i < 100; i++) { live = P.zoneUpdate(st, fr(0.9, 60 - i * 0.2, 0, -1.5, i > 20 && i < 40), dt, c); }   // 1 s hard braking with one ABS stab
  for (i = 0; i < 60; i++) { live = P.zoneUpdate(st, fr(0.3, 40, 0.3, -0.5, false), dt, c); }                          // 0.6 s trail braking
  assert.ok(live, 'zone still open'); assert.strictEqual(live.idx, 1);
  for (i = 0; i < 60; i++) { live = P.zoneUpdate(st, fr(0, 40, 0.3, 0, false), dt, c); }
  assert.strictEqual(live, null, 'closed after the quiet gap');
  z = P.zoneList(st);
  assert.strictEqual(z.length, 1);
  near(z[0].peak, 0.9, 1e-9); near(z[0].decel, 1.5, 1e-9); assert.strictEqual(z[0].abs, 1, 'one ABS edge, not one per frame');
  near(z[0].trail, 0.6, 0.02); near(z[0].dur, 1.6, 0.03); near(z[0].entry, 60, 1e-9); assert.ok(z[0].minSpeed < 41 + 1e-9);
});
t('braking zones: blips, low speed and bad data do not create zones', function () {
  var st = {}, c = P.cfg(), i;
  for (i = 0; i < 20; i++) { P.zoneUpdate(st, { lap: 1, pos: 0.1, speed: 50, brake: 0.8, steer: 0, longG: -1, abs: false, lock: false }, 0.01, c); }   // 0.2 s: too short
  for (i = 0; i < 80; i++) { P.zoneUpdate(st, { lap: 1, pos: 0.1, speed: 50, brake: 0, steer: 0, longG: 0, abs: false, lock: false }, 0.01, c); }
  for (i = 0; i < 300; i++) { P.zoneUpdate(st, { lap: 1, pos: 0.2, speed: 5, brake: 0.8, steer: 0, longG: -1, abs: false, lock: false }, 0.01, c); }     // pit-lane crawl
  P.zoneUpdate(st, { lap: 1, speed: NaN, brake: 1 }, 0.01, c); P.zoneUpdate(st, null, 0.01, c);
  assert.strictEqual(P.zoneList(st).length, 0);
});
t('braking zones: best lap keeps its zones, a slower or invalid lap does not replace them', function () {
  var st = {}, c = P.cfg(), i;
  function lapWith(peak) { var k; for (k = 0; k < 100; k++) { P.zoneUpdate(st, { lap: 1, pos: 0.2, speed: 60, brake: peak, steer: 0, longG: -1, abs: false, lock: false }, 0.01, c); } for (k = 0; k < 60; k++) { P.zoneUpdate(st, { lap: 1, pos: 0.3, speed: 40, brake: 0, steer: 0, longG: 0, abs: false, lock: false }, 0.01, c); } }
  lapWith(0.8); P.zoneLapEnd(st, 90, true, c);
  assert.strictEqual(P.zoneBest(st).length, 1); near(P.zoneBest(st)[0].peak, 0.8, 1e-9); assert.strictEqual(P.zoneList(st).length, 0, 'lap list resets');
  assert.strictEqual(P.zonePrev(st).length, 1, 'finished lap becomes the previous lap'); near(P.zonePrev(st)[0].peak, 0.8, 1e-9);
  lapWith(0.95); P.zoneLapEnd(st, 95, true, c); near(P.zoneBest(st)[0].peak, 0.8, 1e-9); near(P.zonePrev(st)[0].peak, 0.95, 1e-9, 'previous lap is the latest, not the best');
  lapWith(0.99); P.zoneLapEnd(st, 80, false, c); near(P.zoneBest(st)[0].peak, 0.8, 1e-9);
  lapWith(0.7); P.zoneLapEnd(st, 88, true, c); near(P.zoneBest(st)[0].peak, 0.7, 1e-9);
});
t('fuel: average of last 3 clean laps; invalid, in-lap and refuel laps are ignored', function () {
  var st = {}, c = P.cfg();
  assert.strictEqual(P.fuelPerLap(st), null);
  P.fuelRecordLap(st, 50, 48, true, c);        // 2.0
  P.fuelRecordLap(st, 48, 45, false, c);       // invalid lap: ignored
  P.fuelRecordLap(st, 48, 45.5, true, c);      // 2.5
  P.fuelRecordLap(st, 45.5, 60, true, c);      // refuel (fuel went up): ignored
  P.fuelRecordLap(st, 45.5, 43, true, c);      // 2.5
  P.fuelRecordLap(st, 43, 40, true, c);        // 3.0 (pushes out the first 2.0)
  near(P.fuelPerLap(st), (2.5 + 2.5 + 3.0) / 3, 1e-9);
  near(P.fuelLapsRemaining(st, 40), 40 / ((2.5 + 2.5 + 3.0) / 3), 1e-9);
  near(P.fuelToAdd(st, 10, 10), 10 * (8 / 3) - 10, 1e-9);
  assert.strictEqual(P.fuelToAdd(st, 100, 10), 0, 'never negative');
  assert.strictEqual(P.fuelToAdd({}, 10, 10), null);
});

var fail = 0;
tests.forEach(function (x) {
  try { x[1](); console.log('ok   ' + x[0]); }
  catch (e) { fail++; console.log('FAIL ' + x[0] + '\n     ' + e.message); }
});
console.log((tests.length - fail) + '/' + tests.length + ' passed');
process.exit(fail ? 1 : 0);
