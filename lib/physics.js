// Physics library: pure ES5.1 functions. All state lives in a plain object `st` that the caller
// keeps (in SimHub: `root`), so nothing here touches globals. Every function tolerates null,
// undefined and NaN input and then returns null (or leaves state untouched), never throws.
//
// Conventions (also shown in the UI):
//  - Angles in radians internally. Body slip angle beta > 0 means the nose points LEFT of the
//    direction of travel (the car is travelling to the right of its nose).
//  - Per-corner arrays are FL, FR, RL, RR.
//  - Load centre: x > 0 = load towards the right, y > 0 = load towards the front.
//  - Balance: > 0 understeer, < 0 oversteer.
var SHP = (function () {
  var PI = Math.PI;

  var DEFAULTS = {
    // body slip
    gateSpeed: 5,            // m/s, below this beta is reported as 0
    betaAlpha: 0.35,         // EMA weight of the newest sample (1 = no smoothing)
    velFrame: 'world',       // 'world' (rotate by heading) or 'local' (already in the car frame)
    headingSign: 1,          // flip if heading increases anticlockwise in your sim
    headingOffset: 0,        // rad, added to heading
    localLongIdx: 2, localLatIdx: 0, localLatSign: 1,   // used when velFrame === 'local'
    // world-frame self calibration (heading vs travel direction)
    calSpeed: 20, calYawRate: 0.02, calMinN: 150, calMinR: 0.9, calMargin: 0.05, calDecay: 0.9995,
    // slip bands (degrees of |beta|)
    amberDeg: 4, redDeg: 9,
    // load centre
    staticSpeed: 0.5, minTotal: 1, loadRange: 0.2, defaultFront: 0.5, defaultLeft: 0.5,
    // phase detector
    brakeOn: 0.12, brakeOff: 0.05, steerOn: 0.10, steerOff: 0.06, powerThrottle: 0.3,
    coastThrottle: 0.05, minDwell: 0.12,
    // balance
    balanceNeutralDeg: 0.8, balanceAlpha: 0.2, balanceMinLatG: 0.3, balanceMinSpeed: 8,
    // estimated balance (yaw rate vs steering)
    estMinSpeed: 12, estMinSteer: 0.02, estLinearG: 0.3, estCalN: 60, estAlpha: 0.2,
    estKAlpha: 0.03, estNeutral: 0.12, estBucket: 10, estBuckets: 12,
    // estimated load centre
    estShockMin: 0.001,      // m, minimum summed shock deflection to trust
    estGRange: 1.5, latGSign: 1, longGSign: 1, shockSign: 1,
    // grip
    minPeak: 0.02, gripWarmup: 1800,      // frames before utilization is trusted (about 30 s of running at 60 Hz)
    // damper
    maxDt: 0.25, minRange: 0.01, limitMargin: 0.03, limitWarmup: 120,
    damperEdges: [-0.5, -0.3, -0.15, -0.05, 0.05, 0.15, 0.3, 0.5],
    // events
    eventN: 50, eventGap: 1.0, lockRatio: 0.2, lockBrake: 0.2, lockMinSpeed: 5,
    // driver input
    overlapOn: 0.1, revDeadband: 0.05,
    // braking zones
    zoneMinSpeed: 15, zoneGap: 0.4, zoneMinDur: 0.5, zoneMinPeak: 0.25, zoneN: 24,
    // traces
    traceN: 180,
    // fuel
    fuelLaps: 3
  };

  function cfg(over) {
    var o = {}, k;
    for (k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { o[k] = DEFAULTS[k]; } }
    if (over) { for (k in over) { if (over.hasOwnProperty(k)) { o[k] = over[k]; } } }
    return o;
  }

  // ---------- small helpers ----------
  function ok(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
  function sign(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }
  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function abs(x) { return x < 0 ? -x : x; }
  function ema(prev, x, a) { return (prev === null || prev === undefined) ? x : prev + a * (x - prev); }
  function allOk(a, n) { var i; if (!a || a.length < n) { return false; } for (i = 0; i < n; i++) { if (!ok(a[i])) { return false; } } return true; }
  function nulls(n) { var o = [], i; for (i = 0; i < n; i++) { o.push(null); } return o; }
  function zeros(n) { var o = [], i; for (i = 0; i < n; i++) { o.push(0); } return o; }
  function wrapPi(a) { while (a > PI) { a -= 2 * PI; } while (a < -PI) { a += 2 * PI; } return a; }

  // ---------- ring buffer ----------
  function rbNew(n) { return { n: n, head: 0, count: 0, d: zeros(n) }; }
  function rbPush(rb, v) {
    rb.d[rb.head] = v; rb.head = (rb.head + 1) % rb.n;
    if (rb.count < rb.n) { rb.count++; }
  }
  function rbToArray(rb) {
    var out = [], i, s = (rb.head - rb.count + rb.n) % rb.n;
    for (i = 0; i < rb.count; i++) { out.push(rb.d[(s + i) % rb.n]); }
    return out;
  }

  // 3 s traces of beta, brake, throttle, steering
  function tracePush(st, c, beta, brake, throttle, steer) {
    var t = st.trace;
    if (!t) { t = st.trace = { beta: rbNew(c.traceN), brake: rbNew(c.traceN), throttle: rbNew(c.traceN), steer: rbNew(c.traceN) }; }
    rbPush(t.beta, ok(beta) ? beta : 0);
    rbPush(t.brake, ok(brake) ? brake : 0);
    rbPush(t.throttle, ok(throttle) ? throttle : 0);
    rbPush(t.steer, ok(steer) ? steer : 0);
    return t;
  }

  // ---------- body slip angle ----------
  // Returns {beta, raw, gated} (radians) or null on bad input. Updates the EMA held in st.
  function bodySlip(st, vel, heading, c) {
    var vlong, vlat, h, sp, raw;
    if (!allOk(vel, 3)) { return null; }
    if (c.velFrame === 'local') {
      vlong = vel[c.localLongIdx];
      vlat = vel[c.localLatIdx] * c.localLatSign;
    } else {
      if (!ok(heading)) { return null; }
      h = c.headingSign * heading + c.headingOffset;
      // world x,z ground plane; forward = (sin h, cos h), right = (cos h, -sin h)
      vlong = vel[0] * Math.sin(h) + vel[2] * Math.cos(h);
      vlat = vel[0] * Math.cos(h) - vel[2] * Math.sin(h);
    }
    sp = Math.sqrt(vlong * vlong + vlat * vlat);
    if (sp < c.gateSpeed) {
      st.beta = null;                      // restart smoothing after a stop
      return { beta: 0, raw: 0, gated: true };
    }
    raw = Math.atan2(vlat, vlong);
    st.beta = ema(st.beta, raw, c.betaAlpha);
    return { beta: st.beta, raw: raw, gated: false };
  }

  // ---------- world-frame self calibration ----------
  // When the heading/velocity convention is unknown (AC, or ACC world velocity), learn it from straight
  // running: with no yaw (heading barely changing) and real speed, the travel direction equals the heading.
  // Two hypotheses are scored by the resultant length of the angle difference: travel = +heading + k or
  // travel = -heading + k. The better, consistent one wins. Returns {calibrated, sign, offset, r, n}.
  function frameCalib(st, vel, heading, dt, c) {
    var f = st.fc, th, dh, a, b, sp;
    if (!f) { f = st.fc = { cp: 0, sp: 0, cm: 0, sm: 0, n: 0, w: 0, prevH: null }; }
    if (!allOk(vel, 3) || !ok(heading) || !ok(dt) || dt <= 0 || dt > c.maxDt) { f.prevH = ok(heading) ? heading : null; return calibResult(f, c); }
    sp = Math.sqrt(vel[0] * vel[0] + vel[2] * vel[2]);
    dh = f.prevH === null ? null : abs(wrapPi(heading - f.prevH)) / dt;
    f.prevH = heading;
    if (dh === null || sp < c.calSpeed || dh > c.calYawRate) { return calibResult(f, c); }
    th = Math.atan2(vel[0], vel[2]);
    a = th - heading; b = th + heading;
    f.cp = f.cp * c.calDecay + Math.cos(a); f.sp = f.sp * c.calDecay + Math.sin(a);
    f.cm = f.cm * c.calDecay + Math.cos(b); f.sm = f.sm * c.calDecay + Math.sin(b);
    f.w = f.w * c.calDecay + 1;
    f.n++;
    return calibResult(f, c);
  }
  function calibResult(f, c) {
    var eff = f.w || 1, rp, rm, plus;
    if (f.n < c.calMinN) { return { calibrated: false, sign: 1, offset: 0, r: 0, n: f.n }; }
    rp = Math.sqrt(f.cp * f.cp + f.sp * f.sp) / eff; rm = Math.sqrt(f.cm * f.cm + f.sm * f.sm) / eff;
    plus = rp >= rm;
    return {
      calibrated: Math.max(rp, rm) >= c.calMinR && abs(rp - rm) >= c.calMargin, sign: plus ? 1 : -1,
      offset: plus ? Math.atan2(f.sp, f.cp) : Math.atan2(f.sm, f.cm), r: Math.max(rp, rm), n: f.n
    };
  }
  // Config with the learned heading sign/offset applied (unchanged until calibrated).
  function calibratedCfg(st, c) {
    var r = calibResult(st.fc || { cp: 0, sp: 0, cm: 0, sm: 0, n: 0, w: 0 }, c), o = {}, k;
    if (!r.calibrated) { return c; }
    for (k in c) { if (c.hasOwnProperty(k)) { o[k] = c[k]; } }
    o.headingSign = r.sign; o.headingOffset = r.offset;
    return o;
  }

  function slipBand(beta, c) {
    var d;
    if (!ok(beta)) { return null; }
    d = abs(beta) * 180 / PI;
    if (d >= c.redDeg) { return 'red'; }
    if (d >= c.amberDeg) { return 'amber'; }
    return 'green';
  }

  // Momentum arrow relative to the nose, clockwise positive: the velocity points beta to the right.
  function momentumArrow(beta, speed) {
    if (!ok(beta) || !ok(speed)) { return null; }
    return { angle: beta, length: speed };
  }

  // ---------- load centre ----------
  function fractions(w) {
    var t;
    if (!allOk(w, 4)) { return null; }
    t = w[0] + w[1] + w[2] + w[3];
    if (!(t > 0)) { return null; }
    return { front: (w[0] + w[1]) / t, left: (w[0] + w[2]) / t, total: t };
  }
  // Generic: offset from the learned static balance point. `box` holds the learned point.
  function centreFrom(box, w, speed, c, minTotal) {
    var f = fractions(w), sf, sl;
    if (!f || f.total < minTotal) { return null; }
    if (ok(speed) && speed < c.staticSpeed) {
      box.front = ema(box.front, f.front, 0.05);
      box.left = ema(box.left, f.left, 0.05);
      box.n = (box.n || 0) + 1;
    }
    sf = ok(box.front) ? box.front : c.defaultFront;
    sl = ok(box.left) ? box.left : c.defaultLeft;
    return {
      x: clamp((sl - f.left) / c.loadRange, -1, 1),     // + = load to the right
      y: clamp((f.front - sf) / c.loadRange, -1, 1),    // + = load to the front
      learned: (box.n || 0) > 10
    };
  }
  // Centre of tyre load (includes aero downforce, so it is not a pure CG).
  function loadCenter(st, loads, speed, c) {
    if (!st.lc) { st.lc = { front: null, left: null, n: 0 }; }
    return centreFrom(st.lc, loads, speed, c, c.minTotal);
  }

  // ---------- estimated alternatives (for sims without per-tyre load / slip) ----------
  // Load centre from shock deflection when available, else from accelerations. Always estimated.
  function estLoadCenter(st, shock, latG, longG, speed, c) {
    var w, i, r;
    if (allOk(shock, 4)) {
      w = [];
      for (i = 0; i < 4; i++) { w.push(shock[i] * c.shockSign); }
      if (!st.elc) { st.elc = { front: null, left: null, n: 0 }; }
      r = centreFrom(st.elc, w, speed, c, c.estShockMin);
      if (r) { r.estimated = true; r.source = 'shock'; return r; }
    }
    if (ok(latG) && ok(longG)) {
      return {
        x: clamp(latG * c.latGSign / c.estGRange, -1, 1),
        y: clamp(-longG * c.longGSign / c.estGRange, -1, 1),
        learned: true, estimated: true, source: 'accel'
      };
    }
    return null;
  }

  // Balance estimate from yaw rate vs steering. Learns yaw_rate/(speed*steer) per speed bucket
  // while the car is in its linear range (|latG| small), then compares at higher lateral g.
  // Returns {value, label, estimated:true} or null while uncalibrated. Positive = understeer.
  function estBalance(st, speed, steer, yawRate, latG, c) {
    var e, b, k, expected, v, kb, extrap, d;
    if (!ok(speed) || !ok(steer) || !ok(yawRate) || !ok(latG)) { return null; }
    if (speed < c.estMinSpeed || abs(steer) < c.estMinSteer) { return null; }
    if (!st.est) { st.est = { k: nulls(c.estBuckets), n: zeros(c.estBuckets), v: null }; }
    e = st.est;
    b = clamp(Math.floor(speed / c.estBucket), 0, c.estBuckets - 1);
    k = yawRate / (speed * steer);
    if (abs(latG) <= c.estLinearG) {
      e.k[b] = ema(e.k[b], k, c.estKAlpha);
      e.n[b] = e.n[b] + 1;
      return null;
    }
    kb = e.k[b];
    extrap = false;
    if (kb === null || e.n[b] < c.estCalN) {          // not calibrated here: borrow the nearest calibrated speed bucket
      kb = null;
      for (d = 1; d <= 2 && kb === null; d++) {
        if (b - d >= 0 && e.k[b - d] !== null && e.n[b - d] >= c.estCalN) { kb = e.k[b - d]; }
        else if (b + d < c.estBuckets && e.k[b + d] !== null && e.n[b + d] >= c.estCalN) { kb = e.k[b + d]; }
      }
      extrap = kb !== null;
    }
    if (kb === null || abs(kb) < 1e-9) { return null; }
    expected = kb * speed * steer;
    v = clamp(1 - yawRate / expected, -1, 1);
    e.v = ema(e.v, v, c.estAlpha);
    return { value: e.v, label: e.v > c.estNeutral ? 'understeer' : (e.v < -c.estNeutral ? 'oversteer' : 'neutral'), estimated: true, extrapolated: extrap };
  }

  // ---------- corner phase detector ----------
  function phaseStep(st, brake, throttle, steer, beta, dt, c) {
    var p = st.ph, target, a;
    if (!ok(brake) || !ok(throttle) || !ok(steer)) { return p ? p.state : null; }
    if (!p) { p = st.ph = { brk: false, cor: false, state: 'STRAIGHT', cand: null, candT: 0 }; }
    if (p.brk) { if (brake < c.brakeOff) { p.brk = false; } } else if (brake >= c.brakeOn) { p.brk = true; }
    a = abs(steer);
    if (p.cor) { if (a < c.steerOff) { p.cor = false; } } else if (a >= c.steerOn) { p.cor = true; }
    if (p.brk) { target = p.cor ? 'TRAIL' : 'BRAKING'; }
    else if (p.cor) {
      if (throttle >= c.powerThrottle) { target = 'POWER'; }
      else if (ok(beta) && abs(beta) * 180 / PI >= c.amberDeg) { target = 'ROTATION'; }
      else { target = 'COAST'; }
    } else { target = throttle >= c.coastThrottle ? 'STRAIGHT' : 'COAST'; }
    if (target === p.state) { p.cand = null; p.candT = 0; }
    else if (!(c.minDwell > 0)) { p.state = target; }
    else if (target === p.cand) {
      p.candT += ok(dt) ? dt : 0;
      if (p.candT >= c.minDwell) { p.state = target; p.cand = null; p.candT = 0; }
    } else { p.cand = target; p.candT = ok(dt) ? dt : 0; }
    return p.state;
  }

  // ---------- balance meter (real per-tyre slip: ACC / AC) ----------
  // slip: signed slip angles FL,FR,RL,RR (rad). Value = |front mean| - |rear mean| in degrees.
  // Same result for left and right turns. Positive = understeer.
  function balance(st, slip, speed, latG, c) {
    var f, r, raw, b, cornering;
    if (!st.bal) { st.bal = { v: null, cornering: false, peakU: 0, peakO: 0, lastU: 0, lastO: 0 }; }
    b = st.bal;
    if (!allOk(slip, 4) || !ok(speed) || !ok(latG)) { return null; }
    cornering = speed >= c.balanceMinSpeed && abs(latG) >= c.balanceMinLatG;
    if (cornering) {
      f = (slip[0] + slip[1]) / 2; r = (slip[2] + slip[3]) / 2;
      raw = (abs(f) - abs(r)) * 180 / PI;
      b.v = ema(b.v, raw, c.balanceAlpha);
      if (b.v > b.peakU) { b.peakU = b.v; }
      if (-b.v > b.peakO) { b.peakO = -b.v; }
    } else {
      if (b.cornering) { b.lastU = b.peakU; b.lastO = b.peakO; }   // corner just ended
      b.peakU = 0; b.peakO = 0;
      b.v = b.v === null ? null : b.v * 0.9;
    }
    b.cornering = cornering;
    return {
      value: b.v === null ? 0 : b.v,
      label: b.v > c.balanceNeutralDeg ? 'understeer' : (b.v < -c.balanceNeutralDeg ? 'oversteer' : 'neutral'),
      peakUnder: b.peakU, peakOver: b.peakO, lastUnder: b.lastU, lastOver: b.lastO, estimated: false
    };
  }

  // ---------- grip utilization (estimate) ----------
  // Combined slip per tyre as a fraction of the highest seen for that tyre. Resets on car change.
  function gripUpdate(st, carId, slipAngle, slipRatio, c) {
    var g = st.grip, i, a, r, cur, util = [], mx = 0, my = 0, nx = 0, ny = 0;
    if (!g || g.carId !== carId) {
      g = st.grip = { carId: carId, peak: zeros(4), peakA: c.minPeak, peakR: c.minPeak, n: 0 };
    }
    if (!allOk(slipAngle, 4)) { return null; }
    g.n = (g.n || 0) + 1;
    for (i = 0; i < 4; i++) {
      a = slipAngle[i];
      r = (slipRatio && ok(slipRatio[i])) ? slipRatio[i] : 0;
      cur = Math.sqrt(a * a + r * r);
      if (cur > g.peak[i]) { g.peak[i] = cur; }
      util.push(g.peak[i] > c.minPeak ? cur / g.peak[i] : 0);
      mx += a; nx++;
      if (slipRatio && ok(slipRatio[i])) { my += r; ny++; }
      if (abs(a) > g.peakA) { g.peakA = abs(a); }
      if (slipRatio && ok(slipRatio[i]) && abs(r) > g.peakR) { g.peakR = abs(r); }
    }
    return { learning: g.n < c.gripWarmup, util: util, dotX: clamp(mx / nx / g.peakA, -1, 1), dotY: ny ? clamp(my / ny / g.peakR, -1, 1) : 0, estimated: true };
  }

  // ---------- damper velocity / limits ----------
  // travel in metres (FL,FR,RL,RR), dt = real frame time in seconds. velOverride: optional
  // direct velocities (iRacing shockVel). Bins into per-corner histograms and flags limit hits.
  function damperUpdate(st, travel, dt, velOverride, c, maxTravel) {
    var d = st.damp, i, v, b, n = c.damperEdges.length, edges = c.damperEdges, r, vel = nulls(4), bottom = [false, false, false, false], top = [false, false, false, false];
    if (!d) {
      d = st.damp = { prev: nulls(4), hist: [], min: nulls(4), max: nulls(4), n: 0, bottomN: zeros(4), topN: zeros(4), inB: [false, false, false, false], inT: [false, false, false, false] };
      for (i = 0; i < 4; i++) { d.hist.push(zeros(n + 1)); }
    }
    if (!allOk(travel, 4)) { return null; }
    d.n++;
    if (allOk(maxTravel, 4) && !d.known) { d.known = true; for (i = 0; i < 4; i++) { d.min[i] = 0; d.max[i] = maxTravel[i]; } }
    for (i = 0; i < 4; i++) {
      if (ok(travel[i]) && !d.known) {
        d.min[i] = d.min[i] === null ? travel[i] : Math.min(d.min[i], travel[i]);
        d.max[i] = d.max[i] === null ? travel[i] : Math.max(d.max[i], travel[i]);
      }
      v = null;
      if (velOverride && ok(velOverride[i])) { v = velOverride[i]; }
      else if (ok(dt) && dt > 0 && dt <= c.maxDt && d.prev[i] !== null) { v = (travel[i] - d.prev[i]) / dt; }
      d.prev[i] = travel[i];
      vel[i] = v;
      if (v !== null) {
        b = 0;
        while (b < n && v >= edges[b]) { b++; }
        d.hist[i][b]++;
      }
      r = d.max[i] - d.min[i];
      if ((d.known || d.n > c.limitWarmup) && r >= c.minRange) {
        bottom[i] = travel[i] >= d.max[i] - c.limitMargin * r;
        top[i] = travel[i] <= d.min[i] + c.limitMargin * r;
        if (bottom[i] && !d.inB[i]) { d.bottomN[i]++; }
        if (top[i] && !d.inT[i]) { d.topN[i]++; }
      }
      d.inB[i] = bottom[i]; d.inT[i] = top[i];
    }
    return { vel: vel, bottom: bottom, top: top, hist: d.hist, bottomCount: d.bottomN, topCount: d.topN };
  }

  // ---------- lock-up detection ----------
  // Uses slip ratio when provided (negative = wheel slower than the car). Otherwise wheel speed
  // against car speed with a per-wheel rolling radius learned while coasting. Returns bool[4].
  function lockups(st, speed, brake, throttle, wheelSpeed, slipRatio, c, radius) {
    var out = [false, false, false, false], i, ratio;
    if (!ok(speed) || !ok(brake)) { return out; }
    if (!st.lock) { st.lock = { r: nulls(4) }; }
    for (i = 0; i < 4; i++) {
      ratio = null;
      if (slipRatio && ok(slipRatio[i])) { ratio = slipRatio[i]; }
      else if (wheelSpeed && ok(wheelSpeed[i]) && wheelSpeed[i] > 0.1) {
        if (radius && ok(radius[i]) && radius[i] > 0) { st.lock.r[i] = radius[i]; }
        else if (speed > c.lockMinSpeed && brake < 0.02 && ok(throttle) && throttle < 0.05) {
          st.lock.r[i] = ema(st.lock.r[i], speed / wheelSpeed[i], 0.02);
        }
        if (st.lock.r[i] !== null && speed > 0) { ratio = (wheelSpeed[i] * st.lock.r[i]) / speed - 1; }
      } else if (wheelSpeed && ok(wheelSpeed[i]) && speed > c.lockMinSpeed && st.lock.r[i] !== null) {
        ratio = -1;   // wheel stopped while the car moves
      }
      out[i] = ratio !== null && speed >= c.lockMinSpeed && brake >= c.lockBrake && ratio <= -c.lockRatio;
    }
    return out;
  }

  // ---------- event log ----------
  function eventPush(st, c, ev) {
    if (!st.events) { st.events = rbNew(c.eventN); }
    rbPush(st.events, ev);
  }
  function eventList(st) { return st.events ? rbToArray(st.events) : []; }
  // frame: {t, lap, band, lock:[4 bool], absActive, tcActive, offTrack}. Edge-triggered, with a
  // minimum gap per event type so a long ABS stab does not flood the log.
  function eventsUpdate(st, frame, c) {
    var ev = st.evState, i, now = frame.t, added = [];
    if (!ev) { ev = st.evState = { last: {}, prev: {} }; }
    if (!ok(now)) { return added; }
    function fire(type, detail, active) {
      var was = ev.prev[type] === true;
      ev.prev[type] = !!active;
      if (active && !was && (ev.last[type] === undefined || now - ev.last[type] >= c.eventGap)) {
        ev.last[type] = now;
        var e = { t: now, lap: ok(frame.lap) ? frame.lap : null, type: type, detail: detail, lt: ok(frame.lapTime) ? frame.lapTime : null, v: ok(frame.speed) ? frame.speed : null };
        eventPush(st, c, e); added.push(e);
      }
    }
    for (i = 0; i < 4; i++) { fire('LOCKUP' + i, ['FL', 'FR', 'RL', 'RR'][i], !!(frame.lock && frame.lock[i])); }
    fire('SLIDE', 'beta red', frame.band === 'red');
    fire('ABS', 'ABS active', frame.absActive === true);
    fire('TC', 'TC active', frame.tcActive === true);
    fire('OFFTRACK', 'off track', frame.offTrack === true);
    return added;
  }

  // ---------- driver-input metrics ----------
  function metricsNew() {
    return { trail: 0, brakePeak: 0, overlap: 0, reversals: 0, smooth: 0, smoothN: 0, lastSteerSide: 0, prevThr: null };
  }
  function metricsUpdate(st, brake, throttle, steer, dt, c) {
    var m = st.mc, side, rate;
    if (!m) { m = st.mc = metricsNew(); }
    if (!ok(brake) || !ok(throttle) || !ok(steer) || !ok(dt) || dt <= 0 || dt > c.maxDt) { m.prevThr = null; return m; }
    if (brake >= c.brakeOn && abs(steer) >= c.steerOn) { m.trail += dt; }
    if (brake > m.brakePeak) { m.brakePeak = brake; }
    if (brake >= c.overlapOn && throttle >= c.overlapOn) { m.overlap += dt; }
    if (abs(steer) >= c.revDeadband) {
      side = sign(steer);
      if (m.lastSteerSide !== 0 && side !== m.lastSteerSide) { m.reversals++; }
      m.lastSteerSide = side;
    }
    if (m.prevThr !== null && throttle > 0.02 && throttle < 0.98) {
      rate = abs(throttle - m.prevThr) / dt;
      m.smooth += rate; m.smoothN++;
    }
    m.prevThr = throttle;
    return m;
  }
  function metricsSnapshot(m) {
    return { trail: m.trail, brakePeak: m.brakePeak, overlap: m.overlap, reversals: m.reversals,
      smoothness: m.smoothN > 0 ? m.smooth / m.smoothN : null };   // lower = smoother
  }
  // Call at the end of each lap. Keeps the best valid lap's metrics for comparison.
  function metricsLapEnd(st, lapTime, valid) {
    var snap = metricsSnapshot(st.mc || metricsNew());
    st.mcLast = snap;
    if (valid && ok(lapTime) && lapTime > 0 && (!st.mcBest || lapTime < st.mcBest.lapTime)) {
      st.mcBest = { lapTime: lapTime, m: snap };
    }
    st.mc = metricsNew();
    return snap;
  }

  // ---------- braking zones ----------
  // One record per braking zone: where, entry speed, peak pedal, peak decel (g), duration, trail-braking time,
  // ABS hits, lock-up flag. A zone starts when the pedal passes brakeOn (above zoneMinSpeed) and ends after the
  // pedal has stayed under brakeOff for zoneGap seconds. Blips shorter than zoneMinDur are ignored.
  // f: { lap, pos (0..1 lap position), speed (m/s), brake (0..1), steer, longG (g, negative = braking), abs, lock }
  function zoneInit(st, c) { if (!st.zn) { st.zn = { cur: null, list: rbNew(c.zoneN), lapZones: [], best: null, lastAbs: false }; } return st.zn; }
  function zoneUpdate(st, f, dt, c) {
    var z = zoneInit(st, c), cur = z.cur;
    if (!f || !ok(f.brake) || !ok(f.speed) || !ok(dt) || dt <= 0) { return cur; }
    if (!cur) {
      if (f.brake >= c.brakeOn && f.speed >= c.zoneMinSpeed) {
        z.cur = cur = { lap: f.lap, idx: z.lapZones.length + 1, pos: ok(f.pos) ? f.pos : null, entry: f.speed, minSpeed: f.speed, peak: f.brake, decel: 0, dur: 0, trail: 0, abs: 0, lock: false, quiet: 0 };
      } else { z.lastAbs = !!f.abs; return null; }
    }
    cur.dur += dt;
    if (f.brake > cur.peak) { cur.peak = f.brake; }
    if (ok(f.longG) && -f.longG > cur.decel) { cur.decel = -f.longG; }
    if (f.speed < cur.minSpeed) { cur.minSpeed = f.speed; }
    if (f.brake >= c.brakeOff && ok(f.steer) && abs(f.steer) >= c.steerOn) { cur.trail += dt; }
    if (f.abs && !z.lastAbs) { cur.abs++; }
    if (f.lock) { cur.lock = true; }
    z.lastAbs = !!f.abs;
    if (f.brake < c.brakeOff) { cur.quiet += dt; } else { cur.quiet = 0; }
    if (cur.quiet >= c.zoneGap) {
      cur.dur -= cur.quiet; z.cur = null;
      if (cur.dur >= c.zoneMinDur && cur.peak >= c.zoneMinPeak) { delete cur.quiet; rbPush(z.list, cur); z.lapZones.push(cur); }
    }
    return z.cur;
  }
  // Call at the end of each lap: the best valid lap keeps its zones for comparison by zone number.
  function zoneLapEnd(st, lapTime, valid, c) {
    var z = zoneInit(st, c);
    if (valid && ok(lapTime) && lapTime > 0 && (!z.best || lapTime < z.best.lapTime)) { z.best = { lapTime: lapTime, zones: z.lapZones.slice() }; }
    z.prev = z.lapZones; z.lapZones = [];
  }
  function zoneSeedBest(st, lapTime, zones, c) { var z = zoneInit(st, c); z.best = { lapTime: lapTime, zones: zones.slice() }; z.prev = zones.slice(); }
  function zonePrev(st) { return (st.zn && st.zn.prev) ? st.zn.prev : []; }
  function zoneList(st) { var z = st.zn; return z ? z.lapZones.slice() : []; }
  function zoneLive(st) { return st.zn ? st.zn.cur : null; }
  function zoneBest(st) { return (st.zn && st.zn.best) ? st.zn.best.zones : []; }

  // ---------- fuel ----------
  // Record one finished lap. `clean` must be false for invalid laps, in-laps and out-laps.
  function fuelRecordLap(st, startFuel, endFuel, clean, c) {
    var used;
    if (!st.fuel) { st.fuel = { laps: [] }; }
    if (!clean || !ok(startFuel) || !ok(endFuel)) { return null; }
    used = startFuel - endFuel;
    if (!(used > 0)) { return null; }     // refuelled or no consumption: not usable
    st.fuel.laps.push(used);
    while (st.fuel.laps.length > c.fuelLaps) { st.fuel.laps.shift(); }
    return used;
  }
  function fuelPerLap(st) {
    var l = st.fuel ? st.fuel.laps : [], i, s = 0;
    if (!l.length) { return null; }
    for (i = 0; i < l.length; i++) { s += l[i]; }
    return s / l.length;
  }
  function fuelLapsRemaining(st, fuel) {
    var a = fuelPerLap(st);
    return (a && ok(fuel)) ? fuel / a : null;
  }
  function fuelToAdd(st, fuel, targetLaps) {
    var a = fuelPerLap(st);
    if (!a || !ok(fuel) || !ok(targetLaps)) { return null; }
    return Math.max(0, targetLaps * a - fuel);
  }

  return {
    DEFAULTS: DEFAULTS, cfg: cfg,
    rbNew: rbNew, rbPush: rbPush, rbToArray: rbToArray, tracePush: tracePush,
    bodySlip: bodySlip, frameCalib: frameCalib, calibratedCfg: calibratedCfg, slipBand: slipBand, momentumArrow: momentumArrow,
    loadCenter: loadCenter, estLoadCenter: estLoadCenter, estBalance: estBalance,
    phaseStep: phaseStep, balance: balance, gripUpdate: gripUpdate, damperUpdate: damperUpdate,
    lockups: lockups, eventsUpdate: eventsUpdate, eventList: eventList,
    metricsUpdate: metricsUpdate, metricsSnapshot: metricsSnapshot, metricsLapEnd: metricsLapEnd,
    zoneInit: zoneInit, zoneUpdate: zoneUpdate, zoneLapEnd: zoneLapEnd, zoneSeedBest: zoneSeedBest, zoneList: zoneList, zoneLive: zoneLive, zoneBest: zoneBest, zonePrev: zonePrev,
    fuelRecordLap: fuelRecordLap, fuelPerLap: fuelPerLap, fuelLapsRemaining: fuelLapsRemaining, fuelToAdd: fuelToAdd,
    wrapPi: wrapPi
  };
})();
if (typeof module !== 'undefined' && module.exports) { module.exports = SHP; }
