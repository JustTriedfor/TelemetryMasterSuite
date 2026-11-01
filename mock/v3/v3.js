// Dense layout v3. Real lib/physics.js on the simulated lap. Browser-only mock.
// One colour per signal everywhere; every live trace shares the same 6 s window.
(function () {
  var P = SHP, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var C = { beta: '#f3ff3d', brake: '#ff3d5a', thr: '#38e08c', steer: '#aebbd6', yaw: '#b66dff', lat: '#3dd6d0', lon: '#8f8cff', ok: '#38e08c', warn: '#ff8a1f', bad: '#ff3d5a', cold: '#5db3ff', best: '#b66dff', dim: '#80808b', grid: '#24242b', white: '#f6f6f1' };
  var CC = ['#4cc9f0', '#7bf1a8', '#f6a5ff', '#ffd166'], W4 = ['FL', 'FR', 'RL', 'RR'], NAMES = ['FRONT LEFT', 'FRONT RIGHT', 'REAR LEFT', 'REAR RIGHT'];
  var FONT = '11px Bahnschrift SemiCondensed, Segoe UI';
  var mode = 'acc', mul = 1, paused = false;
  var S = SIM.create(), st = {}, cfg = P.cfg({ velFrame: 'local', localLongIdx: 2, localLatIdx: 0 });
  var U = {}, bestLap = 60.62, bestSec = [19.9, 20.2, 20.4], lastSec = [20.0, 20.3, 20.5], secT = [null, null, null], secMark = { t: 0, loss: 0, idx: 0 };
  var laps = [], fuelHist = [2.39, 2.42, 2.41, 2.45, 2.38, 2.40, 2.43, 2.41];
  var $ = function (id) { return document.getElementById(id); };
  function n(v, d) { return (v === null || v === undefined || v !== v) ? 'n/a' : v.toFixed(d); }
  function sg(v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d); }
  function mmss(t) { if (t === null || t !== t) { return 'n/a'; } var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); }
  function cls(el, c) { ['ok', 'warn', 'bad', 'cold', 'best', 'y', 'na'].forEach(function (k) { el.classList.remove(k); }); if (c) { el.classList.add(c); } }
  function setT(id, txt, c) { var e = $(id); e.textContent = txt; cls(e, txt === 'n/a' ? 'na' : c); }

  // ---------- data buffers ----------
  var NF = 180, fast = {};
  ['beta', 'brk', 'thr', 'str', 'lat', 'lon', 'yaw', 'pit', 'rol', 't0', 't1', 't2', 't3'].forEach(function (k) { fast[k] = P.rbNew(NF); });
  var slow = { core: [[], [], [], []], press: [[], [], [], []], disc: [[], [], [], []], oil: [], water: [], boost: [] };
  (function () { var i, j; for (i = 0; i < 90; i++) { for (j = 0; j < 4; j++) { slow.core[j].push(72 + 16 * (1 - Math.exp(-i / 25)) + 2 * Math.sin(i / 7 + j) + j * 0.5); slow.press[j].push(26.2 + 1.5 * (1 - Math.exp(-i / 30)) + 0.18 * Math.sin(i / 5 + j)); slow.disc[j].push(330 + 230 * Math.abs(Math.sin(i / 8 + j * 0.3)) * (j < 2 ? 1 : 0.75)); } slow.oil.push(100 + 7 * (1 - Math.exp(-i / 40))); slow.water.push(90 + 3 * (1 - Math.exp(-i / 40))); slow.boost.push(0.5 + 0.3 * Math.sin(i / 3)); } })();
  var cur = { thr: [], brk: [], str: [], dlt: [], ph: [] }, bestT = null, prevBrk = null, TOTAL_LAPS = 34;
  var discPeak = [0, 0, 0, 0];
  var fast10 = { core: [[], [], [], []], press: [[], [], [], []], disc: [[], [], [], []] };   // last 20 s at 10 Hz, same rate as the driver-input graph
  var roll = { thr: [], brk: [], str: [], ph: [], bthr: [], bbrk: [], bstr: [], ovl: [], abs: [] };
  [61.8, 61.5, 61.2, 61.0, 60.9, 61.1, 60.7, 60.62, 61.03, 60.77, 60.91, 61.42].forEach(function (t, i) { laps.push({ n: i + 1, t: t, v: true }); });
  (function () { var s = SIM.create(), r, b = { thr: [], brk: [], str: [] }; s.slide = 0.4; for (var i = 0; i < 600; i++) { r = SIM.step(s, 0.1); b.thr.push(r.frame.throttle); b.brk.push(r.frame.brake); b.str.push(r.frame.steer); } bestT = b; prevBrk = b.brk.slice(); })();
  S.lap = 13;
  st.mcBest = { lapTime: bestLap, m: { trail: 1.9, brakePeak: 0.93, overlap: 0.12, reversals: 6, smoothness: 2.1 } };
  st.fuel = { laps: [2.39, 2.42, 2.41] };
  (function () { var s2 = SIM.create(), st2 = {}, r, f, i; s2.slide = 0.4; for (i = 0; i < 3600; i++) { r = SIM.step(s2, 1 / 60); f = r.frame; P.zoneUpdate(st2, { lap: 1, pos: f.tn / SIM.LAP, speed: f.speed, brake: f.brake, steer: f.steer, longG: f.longG, abs: f.absActive, lock: false }, 1 / 60, cfg); } P.zoneSeedBest(st, bestLap, P.zoneList(st2), cfg); })();
  st.grip = { carId: 'mock_gt3', peak: [0.34, 0.31, 0.30, 0.30], peakA: 0.30, peakR: 0.38, n: 99999 };

  // ---------- generic chart ----------
  // o: region (rx,ry,rw,rh), x0,x1,y0,y1, yt (tick values), yfmt, bands [[lo,hi,color,alpha]], hl [[y,color,dash]], series [{y, c, w, dash, fill, dx, right}], pre(c,X,Y), vx, title
  function chart(id, o) {
    var cv = $(id), c = cv.getContext('2d'), rx = o.rx || 0, ry = o.ry || 0, rw = o.rw || cv.width, rh = o.rh || cv.height;
    var pl = o.pl === undefined ? 30 : o.pl, pr = 4, pt = 3, pb = o.pb === undefined ? 13 : o.pb, iw = rw - pl - pr, ih = rh - pt - pb;
    function X(v) { return rx + pl + (v - o.x0) / (o.x1 - o.x0) * iw; } function Y(v) { return ry + pt + (1 - (v - o.y0) / (o.y1 - o.y0)) * ih; }
    c.clearRect(rx, ry, rw, rh);
    c.font = FONT; c.lineJoin = 'round';
    (o.bands || []).forEach(function (b) { c.globalAlpha = b[3] || 0.14; c.fillStyle = b[2]; c.fillRect(rx + pl, Y(b[1]), iw, Y(b[0]) - Y(b[1])); c.globalAlpha = 1; });
    if (o.pre) { o.pre(c, X, Y); }
    c.strokeStyle = C.grid; c.fillStyle = C.dim; c.lineWidth = 1;
    (o.yt || []).forEach(function (t) { var y = Math.round(Y(t)) + 0.5; c.beginPath(); c.moveTo(rx + pl, y); c.lineTo(rx + pl + iw, y); c.stroke(); c.fillText(o.yfmt ? o.yfmt(t) : String(t), rx + 1, y + 4); });
    (o.xt || []).forEach(function (t) { var x = Math.round(X(t[0])) + 0.5; c.beginPath(); c.moveTo(x, ry + pt); c.lineTo(x, ry + pt + ih); c.stroke(); c.fillText(t[1], Math.min(x - 8, rx + rw - 24), ry + rh - 2); });
    (o.hl || []).forEach(function (h) { c.strokeStyle = h[1]; c.setLineDash(h[2] || []); c.beginPath(); c.moveTo(rx + pl, Y(h[0])); c.lineTo(rx + pl + iw, Y(h[0])); c.stroke(); c.setLineDash([]); });
    (o.series || []).forEach(function (s) {
      var a = s.y, len = a.length, dx = s.dx !== undefined ? s.dx : (o.x1 - o.x0) / (Math.max(2, s.nmax || len) - 1), i, started = false, x, y, x0;
      if (!len) { return; }
      x0 = s.right ? o.x1 - (len - 1) * dx : (s.x0 || o.x0);
      c.beginPath(); c.strokeStyle = s.c; c.lineWidth = s.w || 1.6; c.setLineDash(s.dash || []);
      for (i = 0; i < len; i++) { if (a[i] === null || a[i] === undefined) { started = false; continue; } x = X(x0 + i * dx); y = Y(Math.max(o.y0, Math.min(o.y1, a[i]))); if (!started) { c.moveTo(x, y); started = true; } else { c.lineTo(x, y); } }
      c.stroke(); c.setLineDash([]);
      if (s.fill !== undefined) { c.lineTo(X(x0 + (len - 1) * dx), Y(s.fill)); c.lineTo(X(x0), Y(s.fill)); c.closePath(); c.globalAlpha = s.fa || 0.2; c.fillStyle = s.c; c.fill(); c.globalAlpha = 1; }
    });
    if (o.vx !== undefined) { c.strokeStyle = C.white; c.lineWidth = 1; c.beginPath(); c.moveTo(Math.round(X(o.vx)) + 0.5, ry + pt); c.lineTo(Math.round(X(o.vx)) + 0.5, ry + pt + ih); c.stroke(); }
    if (o.title) { c.fillStyle = C.dim; c.fillText(o.title, rx + pl + 4, ry + pt + 10); }
  }
  function arange(arr, minSpan) { var lo = 1e9, hi = -1e9, k, c, sp; for (k = 0; k < arr.length; k++) { if (arr[k] === null || arr[k] === undefined) { continue; } if (arr[k] < lo) { lo = arr[k]; } if (arr[k] > hi) { hi = arr[k]; } } if (lo > hi) { return { lo: 0, hi: minSpan }; } sp = Math.max(minSpan, (hi - lo) * 1.25); c = (hi + lo) / 2; return { lo: c - sp / 2, hi: c + sp / 2 }; }
  function clipBand(b, r) { var lo = Math.max(b[0], r.lo), hi = Math.min(b[1], r.hi); return hi > lo ? [lo, hi, b[2], b[3]] : null; }
  var T20 = [[-20, '-20s'], [-15, '-15'], [-10, '-10'], [-5, '-5'], [0, 'now']];
  var T6 = [[-6, '-6s'], [-4, '-4'], [-2, '-2'], [0, 'now']];
  function ring(k) { return P.rbToArray(fast[k]); }

  // ---------- markup ----------
  var PH = ['STRAIGHT', 'BRAKING', 'TRAIL', 'COAST', 'ROTATION', 'POWER'], PHN = { TRAIL: 'TRAIL BRAKE' };
  $('phase').innerHTML = PH.map(function (p) { return '<div class="ph" id="ph' + p + '"><span>' + (PHN[p] || p) + '</span></div>'; }).join('');
  var RC = ['POSITION', 'GAP AHEAD', 'GAP BEHIND', 'FLAG', 'SESSION LEFT', 'TRACK / AIR', 'DATA'];
  $('race').innerHTML = RC.map(function (r, i) { return '<div><span class="lab">' + r + '</span><b id="rc' + i + '">-</b></div>'; }).join('');
  $('discs').innerHTML = W4.map(function (w, i) { return '<div class="disc" id="dk' + i + '"><div class="dh"><span class="lab" style="color:' + CC[i] + '">' + w + ' DISC</span><b id="dw' + i + '" class="dwd"></b><span id="dl' + i + '" class="dlk"></span></div><div class="dm"><div class="dn" id="dn' + i + '">0</div><div class="ds" id="ds' + i + '"></div></div><canvas id="cD' + i + '" width="268" height="58"></canvas></div>'; }).join('');
  $('tyres').innerHTML = W4.map(function (w, i) {
    return '<div class="ty" id="ty' + i + '" style="--c:' + CC[i] + '"><h4><span>' + NAMES[i] + '</span><span id="tg' + i + '"></span></h4>' +
      '<div class="kv"><div class="core" id="tc' + i + '">0</div><div>PRESS<b id="tp' + i + '"></b></div><div>VS TARGET<b id="td' + i + '"></b></div><div>WEAR<b id="tw' + i + '"></b></div><div>SLIP<b id="ts' + i + '"></b></div><div>LOAD<b id="tl' + i + '"></b></div><div>TRAVEL<b id="tt' + i + '"></b></div></div>' +
      '<div class="gr"><canvas id="cT' + i + '" width="188" height="78"></canvas><canvas id="cP' + i + '" width="188" height="62"></canvas><canvas id="cR' + i + '" width="188" height="50"></canvas></div></div>';
  }).join('');
  $('susp').innerHTML = W4.map(function (w, i) { return '<canvas id="cS' + i + '" width="316" height="44"></canvas>'; }).join('');
  $('sys').innerHTML = ['OIL \u00b0C', 'WATER \u00b0C', 'BOOST bar'].map(function (t, i) { return '<div class="sr"><span class="lab">' + t + '</span><b id="sv' + i + '">0</b><canvas id="cY' + i + '" width="150" height="20"></canvas></div>'; }).join('');
  $('gripRow').innerHTML = W4.map(function (w, i) { return '<div class="g1"><div class="t"><span class="lab" style="color:' + CC[i] + '">' + w + ' GRIP USE</span><b id="gv' + i + '">0</b></div><div class="bar"><i id="gb' + i + '"></i></div><div class="lab" id="gs' + i + '"></div></div>'; }).join('');

  // ---------- classification ----------
  function tempWin(c) { if (c === null) { return null; } if (c < 78) { return 'cold'; } if (c <= 98) { return 'ok'; } if (c <= 106) { return 'warn'; } return 'bad'; }
  function discWin(t) { if (t < 300) { return ['cold', 'COLD']; } if (t <= 650) { return ['ok', 'OK']; } if (t <= 750) { return ['warn', 'HOT']; } return ['bad', 'FADE RISK']; }

  function degrade(f, m) {
    var d = {}, k, nul = [null, null, null, null];
    for (k in f) { d[k] = f[k]; }
    if (m !== 'acc') { d.brakePad = nul; d.brakeDisc = nul; }
    if (m === 'ac') { d.slipAngle = nul; d.slipRatio = nul; d.suspMax = nul; d.tyreRadius = nul; d.gapAhead = null; d.gapBehind = null; d.sim = 'ac'; }
    if (m === 'iracing') { d.tyreLoad = nul; d.slipAngle = nul; d.slipRatio = nul; d.slipCombined = nul; d.wheelSpeed = nul; d.suspMax = nul; d.tyreRadius = nul; d.tyreCore = f.tyreMid; d.camber = nul; d.turbo = null; d.sim = 'iracing'; }
    return d;
  }
  function trainEst(laps) { var s2 = SIM.create(), i, r, d; for (i = 0; i < laps * 3600; i++) { r = SIM.step(s2, 1 / 60); d = r.frame; P.estBalance(st, d.speed, d.steer, d.yawRate, d.latG, cfg); } }

  function process(res, dt) {
    var f = degrade(res.frame, mode), bs, secNow, p, le, i, idx, sb;
    U.f = f; U.n = (U.n || 0) + 1;
    for (i = 0; i < 4; i++) { if (f.brakeTemp[i] > discPeak[i]) { discPeak[i] = f.brakeTemp[i]; } }
    bs = P.bodySlip(st, f.vel, null, cfg); U.beta = bs ? bs.beta : null; U.band = P.slipBand(U.beta, cfg);
    U.phase = P.phaseStep(st, f.brake, f.throttle, f.steer, U.beta, dt, cfg);
    if (f.tyreLoad[0] !== null) { U.lc = P.loadCenter(st, f.tyreLoad, f.speed, cfg); U.lcEst = false; } else { U.lc = P.estLoadCenter(st, f.suspTravel, f.latG, f.longG, f.speed, cfg); U.lcEst = true; }
    sb = f.slipAngle[0] !== null ? f.slipAngle : (f.slipCombined && f.slipCombined[0] !== null ? f.slipCombined : null);
    if (sb) { U.bal = P.balance(st, sb, f.speed, f.latG, cfg); U.balEst = mode === 'ac'; } else { U.bal = P.estBalance(st, f.speed, f.steer, f.yawRate, f.latG, cfg) || { calibrating: true }; U.balEst = true; }
    U.grip = sb ? P.gripUpdate(st, f.carId, sb, f.slipRatio[0] !== null ? f.slipRatio : null, cfg) : null;
    U.damp = P.damperUpdate(st, f.suspTravel, dt, mode === 'iracing' ? f.suspVel : null, cfg, f.suspMax[0] !== null ? f.suspMax : null);
    U.lock = P.lockups(st, f.speed, f.brake, f.throttle, f.wheelSpeed[0] !== null ? f.wheelSpeed : null, f.slipRatio[0] !== null ? f.slipRatio : null, cfg, f.tyreRadius[0] !== null ? f.tyreRadius : null);
    P.eventsUpdate(st, { t: f.t, lap: f.lap, band: U.band, lock: U.lock, absActive: f.absActive, tcActive: f.tcActive, offTrack: f.offTrack }, cfg);
    P.metricsUpdate(st, f.brake, f.throttle, f.steer, dt, cfg);
    P.zoneUpdate(st, { lap: f.lap, pos: f.tn / SIM.LAP, speed: f.speed, brake: f.brake, steer: f.steer, longG: f.longG, abs: f.absActive, lock: !!(U.lock[0] || U.lock[1] || U.lock[2] || U.lock[3]) }, dt, cfg);
    if (U.n % 6 === 0) { for (i = 0; i < 4; i++) { [['core', f.tyreCore[i]], ['press', f.tyrePressure[i]], ['disc', f.brakeTemp[i]]].forEach(function (a) { var arr = fast10[a[0]][i]; arr.push(a[1]); if (arr.length > 200) { arr.shift(); } }); } }
    if (U.n % 2 === 0) {
      P.rbPush(fast.beta, U.beta === null ? 0 : U.beta * R2D); P.rbPush(fast.brk, f.brake); P.rbPush(fast.thr, f.throttle); P.rbPush(fast.str, f.steer);
      P.rbPush(fast.lat, f.latG); P.rbPush(fast.lon, f.longG); P.rbPush(fast.yaw, f.yawRate === null ? 0 : f.yawRate * R2D); P.rbPush(fast.pit, f.pitch * R2D); P.rbPush(fast.rol, f.roll * R2D);
      for (i = 0; i < 4; i++) { P.rbPush(fast['t' + i], f.suspTravel[i] === null ? 0 : f.suspTravel[i] * 1000); }
    }
    if (U.n % 60 === 0) { for (i = 0; i < 4; i++) { slow.core[i].push(f.tyreCore[i]); slow.press[i].push(f.tyrePressure[i]); slow.disc[i].push(f.brakeTemp[i]); [slow.core[i], slow.press[i], slow.disc[i]].forEach(function (a) { if (a.length > 90) { a.shift(); } }); }
      slow.oil.push(f.oilTemp); slow.water.push(f.waterTemp); slow.boost.push(f.turbo === null ? 0 : f.turbo); ['oil', 'water', 'boost'].forEach(function (k) { if (slow[k].length > 90) { slow[k].shift(); } }); }
    secNow = f.tn < 20 ? 0 : (f.tn < 40 ? 1 : 2);
    if (secNow !== secMark.idx) { secT[secMark.idx] = (f.lapT - secMark.t) + (S.slideLoss - secMark.loss); secMark.t = f.lapT; secMark.loss = S.slideLoss; secMark.idx = secNow; }
    p = f.tn / SIM.LAP; U.delta = f.lapT + S.slideLoss - p * bestLap; U.pred = bestLap + U.delta;
    if (U.n % 6 === 0) { idx = Math.floor(f.tn * 10); cur.thr[idx] = f.throttle; cur.brk[idx] = f.brake; cur.str[idx] = f.steer; cur.dlt[idx] = Math.max(-1, Math.min(1, U.delta)); cur.ph[idx] = U.phase;
      [['thr', f.throttle], ['brk', f.brake], ['str', f.steer], ['ph', U.phase], ['bthr', bestT.thr[idx]], ['bbrk', bestT.brk[idx]], ['bstr', bestT.str[idx]], ['ovl', (f.brake > 0.1 && f.throttle > 0.1) ? 1 : 0], ['abs', f.absActive ? 1 : 0]].forEach(function (a) { roll[a[0]].push(a[1]); if (roll[a[0]].length > 200) { roll[a[0]].shift(); } }); }
    if (res.lapEnded) {
      le = res.lapEnded; P.metricsLapEnd(st, le.time, le.valid); P.zoneLapEnd(st, le.time, le.valid, cfg); P.fuelRecordLap(st, le.startFuel, le.endFuel, le.valid && le.lap > 12, cfg); fuelHist.push(le.startFuel - le.endFuel); if (fuelHist.length > 8) { fuelHist.shift(); }
      laps.push({ n: le.lap, t: le.time, v: le.valid }); if (laps.length > 12) { laps.shift(); } if (le.valid && le.time < bestLap) { bestLap = le.time; }
      lastSec = secT.slice(); secT = [null, null, null]; secMark = { t: 0, loss: 0, idx: 0 }; S.slideLoss = 0; discPeak = f.brakeTemp.slice(); prevBrk = cur.brk; cur = { thr: [], brk: [], str: [], dlt: [], ph: [] };
    }
  }

  // ---------- car canvas (every frame) ----------
  // car line drawings (light lines on transparent), cut from the supplied sheet by tools/cut_cars.py
  var IMG = {};
  ['top', 'side', 'rear', 'front', 'wheel'].forEach(function (k) { var im = new Image(); im.src = k === 'wheel' ? '../assets/wheel_moza.png' : '../assets/car_' + k + '.png'; IMG[k] = im; });
  function img(k) { var im = IMG[k]; return (im && im.complete && im.naturalWidth) ? im : null; }
  var cc = $('car').getContext('2d');
  function drawCar() {
    var c = cc, f = U.f, cx = 150, cy = 172, bl = 214, im = img('top'), bw = im ? bl * im.naturalWidth / im.naturalHeight : 96, i, ww = 12, wl = 40;
    var band = U.band === 'red' ? C.bad : (U.band === 'amber' ? C.warn : C.ok);
    c.clearRect(0, 0, 300, 316);
    if (U.beta !== null) { c.fillStyle = band; c.globalAlpha = 0.38; c.beginPath(); c.moveTo(cx, cy); var a0 = -Math.PI / 2, a1 = a0 + U.beta; c.arc(cx, cy, 150, Math.min(a0, a1), Math.max(a0, a1)); c.closePath(); c.fill(); c.globalAlpha = 1; }
    [cfg.amberDeg, cfg.redDeg].forEach(function (dg, k) { [-1, 1].forEach(function (s) { var a = -Math.PI / 2 + s * dg * D2R; c.strokeStyle = k ? C.bad : C.warn; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + Math.cos(a) * 154, cy + Math.sin(a) * 154); c.lineTo(cx + Math.cos(a) * 166, cy + Math.sin(a) * 166); c.stroke(); }); });
    // wheel grip indicators sit just outside the body at the real axle positions of the drawing
    var top = cy - bl / 2, axY = [top + 0.235 * bl, top + 0.235 * bl, top + 0.765 * bl, top + 0.765 * bl], wx = [cx - bw / 2 - ww + 1, cx + bw / 2 - 1, cx - bw / 2 - ww + 1, cx + bw / 2 - 1];
    for (i = 0; i < 4; i++) {
      var u = (U.grip && !U.grip.learning) ? U.grip.util[i] : null, lk = U.lock && U.lock[i];
      c.fillStyle = lk ? C.bad : (u === null ? '#3a3a42' : (u > 0.9 ? C.bad : (u > 0.7 ? C.warn : '#2a9d68'))); c.fillRect(wx[i], axY[i] - wl / 2, ww, wl);
      c.fillStyle = CC[i]; c.font = FONT; c.fillText(W4[i], i % 2 === 0 ? wx[i] - 20 : wx[i] + ww + 4, axY[i] + 4);
    }
    if (im) { c.drawImage(im, cx - bw / 2, top, bw, bl); } else { c.fillStyle = '#1c1c21'; c.strokeStyle = '#74747f'; c.lineWidth = 2; c.beginPath(); c.rect(cx - bw / 2, top, bw, bl); c.fill(); c.stroke(); }
    if (U.lc) { c.strokeStyle = C.white; c.fillStyle = C.white; c.lineWidth = 3; c.beginPath(); c.arc(cx + U.lc.x * bw * 0.3, cy - U.lc.y * bl * 0.26, 8, 0, 7); if (!U.lcEst) { c.fill(); } c.stroke(); }
    c.strokeStyle = C.white; c.fillStyle = C.white; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, top); c.lineTo(cx, cy - 142); c.stroke(); c.beginPath(); c.moveTo(cx, cy - 156); c.lineTo(cx - 9, cy - 140); c.lineTo(cx + 9, cy - 140); c.fill();
    if (U.beta !== null) { c.save(); c.translate(cx, cy); c.rotate(U.beta); c.strokeStyle = C.beta; c.fillStyle = C.beta; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -134); c.stroke(); c.beginPath(); c.moveTo(0, -150); c.lineTo(-9, -132); c.lineTo(9, -132); c.fill(); c.restore(); }
    c.font = FONT; c.fillStyle = C.dim; c.fillText('NOSE', cx + 14, cy - 150); c.fillText('TRAVEL', cx + 26, cy - 126);
    c.fillText('load centre ' + (U.lc ? (U.lcEst ? 'estimated' : 'tyre load') : 'n/a'), 6, 310);
  }

  // slip trace (every frame): top = beta + steer, bottom = brake + throttle
  function drawSlip() {
    var bandsB = [[-15, -cfg.redDeg, C.bad, 0.12], [-cfg.redDeg, -cfg.amberDeg, C.warn, 0.12], [cfg.amberDeg, cfg.redDeg, C.warn, 0.12], [cfg.redDeg, 15, C.bad, 0.12]];
    chart('cSlip', { rx: 0, ry: 0, rw: 372, rh: 144, x0: -6, x1: 0, y0: -15, y1: 15, yt: [-10, 0, 10], yfmt: function (v) { return v + '°'; }, bands: bandsB, xt: [], pb: 2, hl: [[0, '#3a3a42']],
      series: [{ y: ring('str').map(function (v) { return v / 0.45 * 15; }), c: C.steer, w: 1.4, right: true, dx: 6 / (NF - 1) }, { y: ring('beta'), c: C.beta, w: 2.4, right: true, dx: 6 / (NF - 1) }] });
    chart('cSlip', { keep: true, rx: 0, ry: 148, rw: 372, rh: 78, x0: -6, x1: 0, y0: 0, y1: 1, yt: [0, 0.5, 1], yfmt: function (v) { return Math.round(v * 100) + '%'; }, xt: T6,
      series: [{ y: ring('brk'), c: C.brake, w: 1.8, right: true, dx: 6 / (NF - 1), fill: 0, fa: 0.18 }, { y: ring('thr'), c: C.thr, w: 1.8, right: true, dx: 6 / (NF - 1) }] });
  }

  // ---------- slow redraws + DOM (10 Hz) ----------
  function update() {
    var f = U.f, i, dg = U.beta === null ? null : U.beta * R2D, bc = U.band === 'red' ? 'bad' : (U.band === 'amber' ? 'warn' : 'ok'), bn = { green: 'GRIP', amber: 'TRANSITION', red: 'SLIDE' }[U.band] || '', bsym = { green: '● ', amber: '◐ ', red: '▲ ' }[U.band] || '';
    var cs = P.metricsSnapshot(st.mc || { trail: 0, brakePeak: 0, overlap: 0, reversals: 0, smooth: 0, smoothN: 0 }), bm = st.mcBest ? st.mcBest.m : null, now = f.tn;
    PH.forEach(function (p) { $('ph' + p).className = 'ph ' + p + (p === U.phase ? ' on' : ''); });
    // header race cells
    var tl = f.sessionTimeLeft, rc = ['P' + f.position, f.gapAhead === null ? 'n/a' : '-' + f.gapAhead.toFixed(1) + 's', f.gapBehind === null ? 'n/a' : '+' + f.gapBehind.toFixed(1) + 's', 'GREEN', Math.floor(tl / 60) + ':' + ('0' + Math.floor(tl % 60)).slice(-2), f.trackTemp + '° / ' + f.airTemp + '°', mode === 'acc' ? 'ACC full' : (mode === 'ac' ? 'AC: slip est.' : 'iRacing: est.')];
    rc.forEach(function (v, j) { setT('rc' + j, v, j === 3 ? 'ok' : undefined); });
    // lap timing
    var dl = U.delta; setT('delta', sg(dl, 3), Math.abs(dl) < 0.05 ? undefined : (dl > 0 ? 'warn' : 'ok')); if (Math.abs(dl) < 0.05) { cls($('delta'), null); }
    setT('pred', mmss(U.pred)); setT('best', mmss(bestLap)); $('lapSub').textContent = 'lap ' + f.lap + '  |  ' + (dl > 0 ? 'slower' : 'faster') + ' than best  |  graph by lap position, not time';
    chart('cDelta', { x0: 0, x1: 100, y0: -1, y1: 1, yt: [-1, 0, 1], yfmt: function (v) { return (v > 0 ? '+' : '') + v + 's'; }, xt: [[0, 'S/F'], [33, 'S2'], [67, 'S3'], [100, 'F']], hl: [[0, '#4a4a54']], bands: [[0, 1, C.warn, 0.07], [-1, 0, C.ok, 0.07]], vx: now / SIM.LAP * 100,
      series: [{ y: cur.dlt, c: dl > 0 ? C.warn : C.ok, w: 2, dx: 100 / 600, fill: 0, fa: 0.2 }] });
    $('secs').innerHTML = [0, 1, 2].map(function (j) { var t = secT[j], c = '', txt, d = ''; if (t === null) { txt = j === secMark.idx ? 'live' : '--'; } else { txt = t.toFixed(2); c = t < bestSec[j] ? 'best' : (t < lastSec[j] ? 'ok' : 'warn'); d = sg(t - bestSec[j], 2); }
      return '<div class="sec" style="border-left-color:' + (c === 'best' ? C.best : (c === 'ok' ? C.ok : (c === 'warn' ? C.warn : '#3a3a42'))) + '"><i><span>SECTOR ' + (j + 1) + '</span><span>best ' + bestSec[j].toFixed(2) + '</span></i><span class="' + c + '">' + txt + '</span><span class="lab">' + d + '</span></div>'; }).join('');
    var rows = laps.slice(-5).reverse();
    $('laps').innerHTML = '<tr><th>LAP</th><th>TIME</th><th>VS BEST</th><th style="width:150px">GAP BAR</th><th>S1</th><th>S2</th><th>S3</th></tr>' + rows.map(function (l, k) { var dd = l.t - bestLap, w = Math.min(140, Math.abs(dd) * 120);
      return '<tr><td>' + 'L' + l.n + (l.v ? '' : ' INV') + '</td><td>' + mmss(l.t) + '</td><td class="' + (dd <= 0.001 ? 'best' : (dd < 0.5 ? 'ok' : 'warn')) + '">' + (dd <= 0.001 ? 'BEST' : sg(dd, 3)) + '</td><td style="text-align:left"><span class="mb" style="width:' + w + 'px;background:' + (dd <= 0.001 ? C.best : (dd < 0.5 ? C.ok : C.warn)) + '"></span></td><td class="dim">' + (19.9 + (k * 0.07 % 0.3)).toFixed(2) + '</td><td class="dim">' + (20.2 + (k * 0.05 % 0.3)).toFixed(2) + '</td><td class="dim">' + (20.4 + (k * 0.06 % 0.3)).toFixed(2) + '</td></tr>'; }).join('');
    // braking
    var evs = P.eventList(st).filter(function (e) { return e.t > S.t - 20; });
    chart('cBrake', { x0: -20, x1: 0, y0: 0, y1: 1, yt: [0, 0.5, 1], yfmt: function (v) { return Math.round(v * 100) + '%'; }, xt: [[-20, '-20s'], [-15, '-15'], [-10, '-10'], [-5, '-5'], [0, 'now']],
      pre: function (c, X, Y) { var L = roll.ph.length, j, t0; for (j = 0; j < L; j++) { if (roll.ph[j] === 'BRAKING' || roll.ph[j] === 'TRAIL') { t0 = -(L - 1 - j) * 0.1; c.fillStyle = roll.ph[j] === 'TRAIL' ? C.warn : C.bad; c.globalAlpha = 0.16; c.fillRect(X(t0), Y(1), X(0.1) - X(0), Y(0) - Y(1)); c.globalAlpha = 1; } }
        c.fillStyle = C.dim; c.fillText('BRAKE rolling 20 s: this lap (red) vs best lap at the same track position (dashed)  |  shaded = braking / trail braking', X(-20) + 6, Y(1) + 11);
        evs.forEach(function (e) { var x = X(e.t - S.t); c.fillStyle = e.type === 'ABS' ? C.warn : C.bad; c.beginPath(); c.moveTo(x, Y(1) + 14); c.lineTo(x - 5, Y(1) + 18); c.lineTo(x + 5, Y(1) + 18); c.fill(); }); },
      series: [{ y: roll.bbrk, c: C.dim, w: 1.4, dash: [4, 3], dx: 0.1, right: true }, { y: roll.brk, c: C.brake, w: 2, dx: 0.1, right: true, fill: 0, fa: 0.22 }] });
    var dpk = bm ? cs.brakePeak - bm.brakePeak : null, dtr = bm ? cs.trail - bm.trail : null, dov = bm ? cs.overlap - bm.overlap : null;
    function st4(t, v, best, max, vs, col) { return '<div class="st"><span class="lab">' + t + '</span><b class="' + (col || '') + '">' + v + '</b><span class="vs">' + vs + '</span><div class="bar"><i style="width:' + Math.min(100, (best === null ? 0 : 0) + 0) + '%"></i></div></div>'; }
    function sbar(t, v, vtxt, best, max, vs) { return '<div class="st"><span class="lab">' + t + '</span><b>' + vtxt + '</b><span class="vs">' + vs + '</span><div class="bar"><i style="width:' + Math.min(100, v / max * 100) + '%"></i><u style="left:' + Math.min(100, best / max * 100) + '%"></u></div></div>'; }
    var zl = P.zoneList(st), zlive = P.zoneLive(st), zb = P.zoneBest(st), maxDec = 0, maxDecB = 0;
    zl.concat(zlive ? [zlive] : []).forEach(function (z) { if (z.decel > maxDec) { maxDec = z.decel; } }); zb.forEach(function (z) { if (z.decel > maxDecB) { maxDecB = z.decel; } });
    var ddc = zb.length ? maxDec - maxDecB : null;
    $('brkStats').innerHTML = sbar('PEAK BRAKE', cs.brakePeak, Math.round(cs.brakePeak * 100) + '%', bm ? bm.brakePeak : 0, 1, dpk === null ? 'n/a' : (dpk >= 0 ? '\u25b2 +' : '\u25bc ') + Math.abs(Math.round(dpk * 100)) + ' vs best') +
      sbar('TRAIL BRAKE', cs.trail, cs.trail.toFixed(2) + 's', bm ? bm.trail : 0, 3, dtr === null ? 'n/a' : (dtr >= 0 ? '\u25b2 +' : '\u25bc ') + Math.abs(dtr).toFixed(2) + 's vs best') +
      sbar('PEAK DECEL', maxDec, maxDec.toFixed(2) + ' g', maxDecB, 2.5, ddc === null ? 'n/a' : (ddc >= 0 ? '\u25b2 +' : '\u25bc ') + Math.abs(ddc).toFixed(2) + ' g vs best') +
      '<div class="st"><span class="lab">BRAKE BIAS</span><b>' + n(f.brakeBias, 1) + '%</b><span class="vs">front</span><div class="bar"><i style="width:' + (f.brakeBias || 0) + '%;background:' + C.dim + '"></i></div></div>';
    var absThis = P.eventList(st).filter(function (e) { return e.type === 'ABS' && e.lap === f.lap; }).length, absPrev = P.eventList(st).filter(function (e) { return e.type === 'ABS' && e.lap === f.lap - 1; }).length;
    $('ovlCard').innerHTML = '<span class="lab">PEDAL OVERLAP</span><b class="' + (dov === null ? '' : (dov > 0 ? 'warn' : 'ok')) + '">' + cs.overlap.toFixed(2) + 's</b><span class="vs">' + (dov === null ? 'n/a' : (dov >= 0 ? '\u25b2 +' : '\u25bc ') + Math.abs(dov).toFixed(2) + 's vs best') + '</span><span class="vs">throttle + brake both on, last 20 s</span><canvas id="cOv" width="122" height="44"></canvas>';
    chart('cOv', { x0: -20, x1: 0, y0: 0, y1: 1, pl: 2, pb: 2, bands: [[0, 1, C.warn, 0.05]], series: [{ y: roll.ovl, c: C.warn, w: 1.4, right: true, dx: 0.1, fill: 0, fa: 0.4 }] });
    $('absCard').innerHTML = '<span class="lab">ABS</span><b class="' + (f.absActive ? 'warn' : '') + '">' + (f.absActive ? 'ACTIVE' : 'idle') + '</b><span class="vs">hits this lap ' + absThis + '   last lap ' + absPrev + '</span><span class="vs">activity, last 20 s</span><canvas id="cAbs" width="122" height="44"></canvas>';
    chart('cAbs', { x0: -20, x1: 0, y0: 0, y1: 1, pl: 2, pb: 2, bands: [[0, 1, C.warn, 0.05]], series: [{ y: roll.abs, c: C.warn, w: 1.4, right: true, dx: 0.1, fill: 0, fa: 0.4 }] });
    var zrows = zl.map(function (z) { return z; }); if (zlive) { zrows.push(Object.assign({ live: true }, zlive)); }
    var lastIdx = zrows.length ? zrows[zrows.length - 1].idx : 0, upcoming = P.zonePrev(st).filter(function (z) { return z.idx > lastIdx; }).map(function (z) { return Object.assign({ up: true }, z); });
    zrows = zrows.slice(-2).concat(upcoming).slice(0, 5);
    $('zones').innerHTML = '<span class="lab">BRAKING ZONES   ● live  ▶ next (last lap)  tick = best</span><div class="zr h"><span>ZONE</span><span>AT</span><span>ENTRY</span><span>PEAK</span><span>DECEL</span><span>TRAIL</span><span>FLAGS</span></div>' +
      (zrows.map(function (z) { var b = zb[z.idx - 1], pc = Math.round(z.peak * 100), col = b ? (z.peak >= b.peak - 0.03 ? C.ok : C.warn) : C.white;
        return '<div class="zr' + (z.live ? ' live' : '') + (z.up ? ' up' : '') + '"><span>Z' + z.idx + (z.live ? '\u25cf' : (z.up ? '\u25b6' : '')) + '</span><span>' + (z.pos === null ? '-' : Math.round(z.pos * 100) + '%') + '</span><span>' + Math.round(z.entry * 3.6) + '</span><span class="pk"><em style="color:' + col + '">' + pc + '%</em><i style="width:' + Math.round(z.peak * 100 * 0.42) + 'px;background:' + col + '"></i>' + (b ? '<u style="left:' + Math.round(b.peak * 100 * 0.42) + 'px"></u>' : '') + '</span><span>' + z.decel.toFixed(2) + 'g</span><span>' + z.trail.toFixed(1) + 's</span><span class="fl">' + (z.abs ? '<span style="background:' + C.warn + '">A' + z.abs + '</span>' : '') + (z.lock ? '<span style="background:' + C.bad + '">LK</span>' : '') + (!z.abs && !z.lock ? '<span style="color:#5d5d68;background:none">-</span>' : '') + '</span></div>'; }).join('') || '<div class="zr"><span style="grid-column:1/8;text-align:left;color:#80808b">no braking zone yet this lap</span></div>');
    var hot = 0;
    function dstat(l, v) { return '<div><span class="lab">' + l + '</span><b' + (v === 'n/a' ? ' class="na"' : '') + '>' + v + '</b></div>'; }
    for (i = 0; i < 4; i++) {
      var dw = discWin(f.brakeTemp[i]), sy = { cold: '\u25bc', ok: '\u25cf', warn: '\u25b2', bad: '\u25b2\u25b2' }[dw[0]], hd = slow.disc[i], rate = hd.length > 1 ? hd[hd.length - 1] - hd[hd.length - 2] : 0;
      hot = Math.max(hot, f.brakeTemp[i]);
      setT('dn' + i, Math.round(f.brakeTemp[i]) + '\u00b0', dw[0]); setT('dw' + i, sy + ' ' + dw[1], dw[0]); setT('dl' + i, U.lock[i] ? 'LOCK-UP' : '', 'bad');
      $('ds' + i).innerHTML = dstat('PEAK LAP', Math.round(discPeak[i]) + '\u00b0') + dstat('RATE', (rate >= 0 ? '\u25b2' : '\u25bc') + Math.abs(Math.round(rate)) + '\u00b0/s') + dstat('PAD / DISC', f.brakePad && f.brakePad[i] !== null ? f.brakePad[i].toFixed(0) + ' / ' + f.brakeDisc[i].toFixed(0) : 'n/a');
      $('dk' + i).classList.toggle('lock', !!U.lock[i]);
      chart('cD' + i, { x0: -20, x1: 0, y0: 150, y1: 900, yt: [300, 650, 750], pl: 28, pb: 12, xt: [[-20, '-20s'], [-10, '-10'], [0, 'now']], bands: [[150, 300, C.cold, 0.1], [650, 750, C.warn, 0.14], [750, 900, C.bad, 0.16]], series: [{ y: fast10.disc[i], c: CC[i], w: 1.8, right: true, dx: 0.1 }] });
    }
    $('brkSub').textContent = (hot > 750 ? 'BRAKE FADE RISK' : (hot > 650 ? 'brakes hot' : 'brakes ok')) + (mode === 'iracing' ? '  |  lock-ups: ABS only' : ''); $('brkSub').className = 'sub ' + (hot > 750 ? 'bad' : (hot > 650 ? 'warn' : ''));
    var nl = [0, 0, 0, 0], nabs = 0; P.eventList(st).forEach(function (e) { if (e.lap !== f.lap) { return; } if (e.type.indexOf('LOCKUP') === 0) { nl[+e.type.slice(6)]++; } if (e.type === 'ABS') { nabs++; } });
    $('lockRow').innerHTML = '<span class="lab">LOCK-UPS THIS LAP</span>' + W4.map(function (w, j) { return '<span class="chip' + (U.lock[j] ? ' on bad' : '') + '" style="' + (nl[j] ? 'color:#fff;background:#6b1d2a' : '') + '">' + w + ' ' + nl[j] + '</span>'; }).join('') + '<span class="chip' + (f.absActive ? ' on warn' : '') + '">ABS HITS ' + nabs + '</span><span class="chip' + (f.tcActive ? ' on warn' : '') + '" style="margin-left:auto">TC ' + (f.tcActive ? 'ACTIVE' : 'idle') + '</span>';
    // slip panel
    setT('beta', dg === null ? 'n/a' : sg(dg, 1) + '°', U.band === 'green' ? undefined : bc); if (U.band === 'green') { cls($('beta'), null); }
    setT('band', bsym + bn, bc); $('slipSub').textContent = mode === 'acc' ? 'ACC: per-tyre data' : (mode === 'ac' ? 'AC: slip estimated from combined slip' : 'iRacing: load centre and balance estimated');
    drawBal();
    for (i = 0; i < 4; i++) { var gu = (U.grip && !U.grip.learning) ? U.grip.util[i] : null, g = $('gv' + i); g.textContent = gu === null ? 'n/a' : Math.round(gu * 100) + '%'; cls(g, gu === null ? 'na' : (gu > 0.9 ? 'bad' : (gu > 0.7 ? 'warn' : 'ok'))); var gb = $('gb' + i); gb.style.width = (gu === null ? 0 : gu * 100) + '%'; gb.style.background = gu === null ? '#2a2a31' : (gu > 0.9 ? C.bad : (gu > 0.7 ? C.warn : C.ok)); $('gs' + i).textContent = U.grip ? (U.grip.learning ? 'learning reference' : 'vs best seen (estimate)') : (mode === 'iracing' ? 'no tyre data' : ''); }
    // tyres
    for (i = 0; i < 4; i++) {
      var tw = tempWin(f.tyreCore[i]), h = slow.core[i], tr = h.length > 6 ? f.tyreCore[i] - h[h.length - 6] : 0, d = f.tyrePressure[i] - 27.5, tc = $('tc' + i);
      tc.textContent = n(f.tyreCore[i], 0) + '°' + (tw === 'cold' ? ' ▼' : (tw === 'ok' ? ' ●' : ' ▲')) + (tr > 1.2 ? ' ↑' : (tr < -1.2 ? ' ↓' : '')); cls(tc, tw);
      setT('tp' + i, n(f.tyrePressure[i], 1) + ' psi'); setT('td' + i, sg(d, 1), Math.abs(d) <= 0.6 ? 'ok' : (Math.abs(d) <= 1.2 ? 'warn' : 'bad')); setT('tw' + i, n(f.tyreWear[i], 1) + '%');
      var sa = f.slipAngle[i] === null ? (f.slipCombined && f.slipCombined[i] !== null ? f.slipCombined[i] : null) : f.slipAngle[i]; setT('ts' + i, sa === null ? 'n/a' : n(sa * R2D, 1) + '°'); setT('tl' + i, f.tyreLoad[i] === null ? 'n/a' : Math.round(f.tyreLoad[i]) + ' N');
      setT('tt' + i, f.suspTravel[i] === null ? 'n/a' : Math.round(f.suspTravel[i] * 1000) + ' mm'); $('ty' + i).classList.toggle('lock', !!U.lock[i]);
      var gu2 = (U.grip && !U.grip.learning) ? U.grip.util[i] : null; $('tg' + i).textContent = U.lock[i] ? 'LOCK-UP' : (gu2 !== null ? 'grip ' + Math.round(gu2 * 100) + '%' : ''); $('tg' + i).style.color = U.lock[i] ? C.bad : C.dim;
      var rc = arange(fast10.core[i], 8), rp = arange(fast10.press[i], 0.6), bnd = [clipBand([78, 98, C.ok, 0.1], rc), clipBand([106, 200, C.bad, 0.12], rc), clipBand([0, 78, C.cold, 0.08], rc)].filter(function (b) { return b; });
      chart('cT' + i, { x0: -20, x1: 0, y0: rc.lo, y1: rc.hi, yt: [rc.lo + (rc.hi - rc.lo) * 0.2, rc.lo + (rc.hi - rc.lo) * 0.8], yfmt: function (v) { return v.toFixed(0); }, pl: 26, pb: 12, xt: [[-20, '-20s'], [-10, '-10'], [0, 'now']], bands: bnd, title: 'CORE \u00b0C (green = window)', series: [{ y: fast10.core[i], c: CC[i], w: 1.8, right: true, dx: 0.1 }] });
      chart('cP' + i, { x0: -20, x1: 0, y0: rp.lo, y1: rp.hi, yt: [rp.lo + (rp.hi - rp.lo) * 0.25, rp.lo + (rp.hi - rp.lo) * 0.75], yfmt: function (v) { return v.toFixed(1); }, pl: 26, pb: 12, xt: [[-20, ''], [0, '']], hl: (27.5 > rp.lo && 27.5 < rp.hi) ? [[27.5, C.warn, [4, 3]]] : [], title: 'PRESSURE psi (dashed = target)', series: [{ y: fast10.press[i], c: CC[i], w: 1.8, right: true, dx: 0.1 }] });
      drawTread(i, f);
    }
    // inputs: rolling 20 s, best lap overlaid at the same track position
    var rpmF = Math.min(1, f.rpm / f.maxRpm);
    $('inTop').innerHTML = '<div><span class="u">GEAR</span><span class="big y">' + f.gear + '</span></div><div><span class="u">SPEED km/h</span><span class="big">' + Math.round(f.speed * 3.6) + '</span></div><div><span class="u">RPM</span><span class="mid">' + Math.round(f.rpm) + '</span></div><div class="rev"><i style="width:' + rpmF * 100 + '%"></i><u></u></div><div style="margin-left:auto;display:flex;gap:6px"><span class="chip' + (f.tcActive ? ' on warn' : '') + '">TC</span><span class="chip' + (f.absActive ? ' on warn' : '') + '">ABS</span></div>';
    chart('cPed', { rx: 0, ry: 0, rw: 316, rh: 74, x0: -20, x1: 0, y0: 0, y1: 1, yt: [0, 0.5, 1], yfmt: function (v) { return Math.round(v * 100) + '%'; }, pb: 2,
      series: [{ y: roll.bthr, c: C.thr, w: 1, dash: [3, 3], dx: 0.1, right: true }, { y: roll.bbrk, c: C.brake, w: 1, dash: [3, 3], dx: 0.1, right: true }, { y: roll.thr, c: C.thr, w: 1.8, dx: 0.1, right: true }, { y: roll.brk, c: C.brake, w: 1.8, dx: 0.1, right: true }] });
    chart('cPed', { keep: true, rx: 0, ry: 76, rw: 316, rh: 36, x0: -20, x1: 0, y0: -0.45, y1: 0.45, yt: [-0.3, 0.3], yfmt: function (v) { return v > 0 ? 'L' : 'R'; }, pb: 12, xt: [[-20, '-20s'], [-10, '-10'], [0, 'now']], hl: [[0, '#3a3a42']],
      series: [{ y: roll.bstr, c: C.steer, w: 1, dash: [3, 3], dx: 0.1, right: true }, { y: roll.str, c: C.steer, w: 1.8, dx: 0.1, right: true }] });
    var di = [['PEDAL OVERLAP s', cs.overlap, bm && bm.overlap, 0.5, 2], ['STEER REVERSALS', cs.reversals, bm && bm.reversals, 12, 0], ['THROTTLE SMOOTH', cs.smoothness, bm && bm.smoothness, 4, 1]];
    $('drv').innerHTML = di.map(function (r) { var dd = (r[1] === null || r[2] === null) ? null : r[1] - r[2]; return '<div class="dq"><div class="t"><span>' + r[0] + '</span><b class="' + (dd === null ? '' : (dd <= 0 ? 'ok' : 'warn')) + '">' + n(r[1], r[4]) + '</b></div><div class="bar"><i style="width:' + Math.min(100, (r[1] || 0) / r[3] * 100) + '%;background:' + (dd !== null && dd > 0 ? C.warn : C.ok) + '"></i><u style="left:' + Math.min(100, (r[2] || 0) / r[3] * 100) + '%"></u></div></div>'; }).join('');
    drawWheel(f);
    // dynamics
    chart('cDyn', { rx: 0, ry: 0, rw: 316, rh: 88, x0: -6, x1: 0, y0: -2, y1: 2, yt: [-1, 0, 1], yfmt: function (v) { return v + 'g'; }, pb: 2, hl: [[0, '#3a3a42']], series: [{ y: ring('lat'), c: C.lat, w: 1.8, right: true, dx: 6 / (NF - 1) }, { y: ring('lon'), c: C.lon, w: 1.8, right: true, dx: 6 / (NF - 1) }] });
    chart('cDyn', { keep: true, rx: 0, ry: 90, rw: 316, rh: 50, x0: -6, x1: 0, y0: -40, y1: 40, yt: [0], yfmt: function (v) { return '0'; }, pb: 12, xt: T6, hl: [[0, '#3a3a42']], series: [{ y: ring('yaw'), c: C.yaw, w: 1.8, right: true, dx: 6 / (NF - 1) }] });
    drawLoad(f);
    // suspension
    for (i = 0; i < 4; i++) { var mx = f.suspMax[i] !== null ? f.suspMax[i] * 1000 : 100;
      chart('cS' + i, { x0: -6, x1: 0, y0: 0, y1: mx, yt: [mx * 0.5], yfmt: function (v) { return Math.round(v) + ''; }, pl: 26, pb: 2, bands: [[mx * 0.95, mx, C.bad, 0.2], [0, mx * 0.05, C.cold, 0.2]],
        pre: function (c, X, Y) { c.font = FONT; c.fillStyle = CC[i]; c.fillText(W4[i] + ' travel mm   bottom ' + (U.damp ? U.damp.bottomCount[i] : 'n/a') + '  top ' + (U.damp ? U.damp.topCount[i] : 'n/a'), X(-6) + 6, Y(mx) + 10); }, series: [{ y: ring('t' + i), c: CC[i], w: 1.7, right: true, dx: 6 / (NF - 1) }] }); }
    $('suspSub').textContent = (mode === 'iracing' ? 'velocity direct from shock  |  ' : '') + 'red band = bottoming, blue = topping';
    drawAtt(f);
    // fuel and strategy: can I finish on this fuel?
    var remLaps = TOTAL_LAPS - f.lap + 1, rem = P.fuelLapsRemaining(st, f.fuel), fpl = P.fuelPerLap(st), short = rem === null ? null : remLaps - rem, fcol = rem === null ? '' : (short > 0 ? 'bad' : (short > -1 ? 'warn' : 'ok'));
    $('fuelL').innerHTML = '<span class="lab">FUEL LAPS LEFT</span><div class="big ' + fcol + '">' + n(rem, 1) + '</div><div class="r">FUEL<b>' + n(f.fuel, 1) + ' L</b></div><div class="r">PER LAP (3-lap avg)<b>' + n(fpl, 2) + ' L</b></div><div class="r">RACE LAPS LEFT<b>' + remLaps + '</b></div><div class="r">TO ADD TO FINISH<b>' + n(fpl === null ? null : P.fuelToAdd(st, f.fuel, remLaps), 1) + ' L</b></div>';
    drawStrat(f, rem, remLaps);
    // systems
    [['oil', f.oilTemp, 60, 130, 'sv0', 0], ['water', f.waterTemp, 60, 120, 'sv1', 1], ['boost', f.turbo, 0, 1.2, 'sv2', 2]].forEach(function (s) { setT(s[4], s[1] === null ? 'n/a' : (s[5] === 2 ? s[1].toFixed(2) : Math.round(s[1]) + '\u00b0'), s[5] === 0 && s[1] > 125 ? 'bad' : undefined);
      chart('cY' + s[5], { x0: -90, x1: 0, y0: s[2], y1: s[3], pl: 2, pb: 2, series: [{ y: slow[s[0]], c: s[5] === 2 ? C.longg : '#aab0bc', w: 1.4, right: true, dx: 1 }] }); });
    var ev = P.eventList(st).slice().reverse().slice(0, 3);
    $('events').innerHTML = ev.map(function (e) { var col = (e.type === 'SLIDE' || e.type.indexOf('LOCK') === 0) ? C.bad : (e.type === 'ABS' || e.type === 'TC' ? C.warn : C.beta); var nm = e.type.indexOf('LOCK') === 0 ? 'LOCK-UP ' + e.detail : (e.type === 'SLIDE' ? 'BIG SLIDE' : e.type + ' active'); return '<div><small>L' + e.lap + '  ' + e.t.toFixed(1) + 's</small><span style="color:' + col + '">' + ((e.type === 'SLIDE' || e.type.indexOf('LOCK') === 0) ? '\u25b2 ' : '\u25cf ') + nm + '</span></div>'; }).join('') || '<div><small></small><span class="dim">no events yet</span></div>';
    drawMap(f);
  }

  // ---------- right-column widgets ----------
  function drawWheel(f) {
    var c = $('cWheel').getContext('2d'), cx = 58, cy = 54, r = 38, ang = -(f.steer / 0.45) * 270 * D2R, side = f.steer > 0 ? 'L ' : 'R ', k;
    c.clearRect(0, 0, 256, 112); c.font = FONT;
    var wi = img('wheel');
    if (wi) { var ww = 92, wh = ww * wi.naturalHeight / wi.naturalWidth; c.save(); c.translate(cx, cy); c.rotate(ang); c.drawImage(wi, -ww / 2, -wh / 2, ww, wh); c.fillStyle = C.beta; c.beginPath(); c.moveTo(0, -wh / 2 - 2); c.lineTo(-5, -wh / 2 - 10); c.lineTo(5, -wh / 2 - 10); c.fill(); c.restore(); }
    else { c.save(); c.translate(cx, cy); c.rotate(ang); c.strokeStyle = '#cfd6e6'; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); c.fillStyle = C.beta; c.fillRect(-4, -r - 5, 8, 12); c.restore(); }
    c.fillStyle = C.dim; c.fillText('STEERING', 6, 12); c.fillStyle = C.white; c.fillText(side + Math.round(Math.abs(f.steer) / 0.45 * 270) + '\u00b0', 22, 108);
    [['THR', f.throttle, C.thr], ['BRK', f.brake, C.brake], ['CLU', f.clutch || 0, '#aab0bc']].forEach(function (q, j) { var x = 118 + j * 46; c.fillStyle = '#1f1f25'; c.fillRect(x, 16, 34, 76); c.fillStyle = q[2]; var h = Math.round(76 * q[1]); c.fillRect(x, 92 - h, 34, h); c.fillStyle = C.dim; c.fillText(q[0], x + 6, 12); c.fillStyle = C.white; c.fillText(Math.round(q[1] * 100) + '%', x + 4, 106); });
  }
  function drawLoad(f) {
    var c = $('cLoad').getContext('2d'), L = f.tyreLoad, i, tot, W = 256, base = [72, 72, 124, 124], bx = [70, 160, 70, 160], im = img('top'), ih = 100, iw = im ? ih * im.naturalWidth / im.naturalHeight : 44;
    c.clearRect(0, 0, W, 140); c.font = FONT;
    if (im) { c.drawImage(im, 128 - iw / 2, 26, iw, ih); } else { c.strokeStyle = '#74747f'; c.lineWidth = 2; c.beginPath(); c.rect(106, 26, 44, 100); c.stroke(); }
    c.fillStyle = C.dim; c.fillText('LOAD ON EACH CORNER', 6, 12);
    if (L[0] === null) { c.fillStyle = C.dim; c.fillText('no tyre load in this sim', 70, 137); if (U.lc) { c.strokeStyle = C.white; c.lineWidth = 3; c.beginPath(); c.arc(128 + U.lc.x * 24, 70 - U.lc.y * 36, 8, 0, 7); c.stroke(); c.fillText('estimated centre', 82, 126); } return; }
    tot = L[0] + L[1] + L[2] + L[3];
    for (i = 0; i < 4; i++) { var h = Math.max(2, Math.min(40, L[i] / 4500 * 40)); c.fillStyle = '#1f1f25'; c.fillRect(bx[i], base[i] - 40, 26, 40); c.fillStyle = CC[i]; c.fillRect(bx[i], base[i] - h, 26, h); c.fillStyle = C.white; c.fillText(String(Math.round(L[i])), i % 2 === 0 ? bx[i] - 36 : bx[i] + 30, base[i] - 4); }
    c.fillStyle = C.white; c.fillText('F ' + Math.round((L[0] + L[1]) / tot * 100) + '%   R ' + Math.round((L[2] + L[3]) / tot * 100) + '%      L ' + Math.round((L[0] + L[2]) / tot * 100) + '%   R ' + Math.round((L[1] + L[3]) / tot * 100) + '%', 40, 136);
  }
  function drawAtt(f) {
    var c = $('cAtt').getContext('2d'), K = 10, KR = 6, pd = f.pitch * R2D, rd = f.roll * R2D, si = img('side'), ri = img('rear');
    c.clearRect(0, 0, 256, 188); c.font = FONT; c.textAlign = 'left'; c.fillStyle = C.dim; c.fillText('SIDE: PITCH (drawn x' + K + ')', 6, 12); c.fillText('REAR: ROLL (drawn x' + KR + ')', 6, 104);
    c.textAlign = 'right'; c.fillStyle = C.white; c.fillText('PITCH ' + sg(pd, 2) + '\u00b0 ' + (pd > 0.05 ? 'nose up' : (pd < -0.05 ? 'nose down' : 'level')), 250, 12); c.fillText('ROLL ' + sg(rd, 2) + '\u00b0 ' + (rd > 0.1 ? 'right' : (rd < -0.1 ? 'left' : 'level')), 250, 104); c.textAlign = 'left';
    c.strokeStyle = '#3a3a42'; c.lineWidth = 1; c.beginPath(); c.moveTo(10, 92); c.lineTo(246, 92); c.moveTo(10, 184); c.lineTo(246, 184); c.stroke();
    // side view faces left, so nose-up is a clockwise turn
    if (si) { var sw = 190, sh = sw * si.naturalHeight / si.naturalWidth; c.save(); c.translate(128, 92); c.rotate(f.pitch * K); c.drawImage(si, -sw / 2, -sh, sw, sh); c.restore(); }
    if (ri) { var rw = 100, rh = rw * ri.naturalHeight / ri.naturalWidth; c.save(); c.translate(128, 184); c.rotate(-f.roll * KR); c.drawImage(ri, -rw / 2, -rh, rw, rh); c.restore(); }
  }

  function drawStrat(f, rem, remLaps) {
    var c = $('cFuel').getContext('2d'), W = 340, x0 = 8, x1 = 330, total = TOTAL_LAPS, lap = f.lap, k;
    function X(l) { return x0 + (l - 1) / total * (x1 - x0); }
    c.clearRect(0, 0, W, 104); c.font = FONT; c.fillStyle = C.dim; c.fillText('RACE  lap ' + lap + ' of ' + total, x0, 12);
    c.fillStyle = '#1f1f25'; c.fillRect(x0, 18, x1 - x0, 20); c.fillStyle = '#3a3a44'; c.fillRect(x0, 18, X(lap) - x0, 20); c.fillStyle = C.beta; c.fillRect(X(lap), 14, Math.max(3, X(lap + 1) - X(lap)), 28);
    for (k = 5; k <= total; k += 5) { c.fillStyle = '#34343c'; c.fillRect(X(k), 38, 1, 5); c.fillStyle = C.dim; c.fillText(String(k), X(k) - 5, 52); }
    c.fillStyle = C.white; c.fillRect(x1, 12, 3, 62); c.fillText('FIN', x1 - 8, 100);
    var end = rem === null ? lap : lap + rem, endC = Math.min(end, total + 1), ok = rem !== null && end >= total + 1, col = rem === null ? '#2a2a31' : (ok ? C.ok : (total + 1 - end < 1 ? C.warn : C.bad));
    c.fillStyle = C.dim; c.fillText('FUEL RANGE  ' + (rem === null ? 'n/a' : (ok ? 'reaches the flag' : 'empty at lap ' + end.toFixed(1) + ', short by ' + (total + 1 - end).toFixed(1) + ' laps')), x0, 68);
    c.fillStyle = '#1f1f25'; c.fillRect(x0, 72, x1 - x0, 14); c.fillStyle = col; c.fillRect(X(lap), 72, Math.max(0, X(endC) - X(lap)), 14);
    if (rem !== null && !ok) { c.fillStyle = C.bad; c.fillRect(X(endC) - 1, 68, 3, 22); c.fillStyle = C.warn; c.globalAlpha = 0.35; c.fillRect(X(Math.max(lap, endC - 3)), 18, X(endC) - X(Math.max(lap, endC - 3)), 20); c.globalAlpha = 1; c.fillStyle = C.warn; c.fillText('PIT WINDOW', X(Math.max(lap, endC - 3)), 30); }
  }
  // synthetic track outline (the real dash uses SimHub's generated map)
  var TRK = (function () { var a = [], i, t, r; for (i = 0; i < 240; i++) { t = i / 240 * 2 * Math.PI; r = (1 + 0.28 * Math.cos(3 * t) + 0.14 * Math.sin(5 * t + 1)) / 1.42; a.push([128 + 112 * r * Math.cos(t - Math.PI / 2), 70 + 54 * r * Math.sin(t - Math.PI / 2)]); } return a; })();
  function mp(p) { var q = (((p % 1) + 1) % 1) * 240, i = Math.floor(q), u = q - i, A = TRK[i % 240], B = TRK[(i + 1) % 240]; return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]; }
  function drawMap(f) {
    var c = $('cMap').getContext('2d'), j, A, B, p = f.tn / SIM.LAP, lapStart = S.t - f.lapT, ev = P.eventList(st);
    c.clearRect(0, 0, 256, 136); c.font = FONT; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#34343c'; c.lineWidth = 8; c.beginPath(); for (j = 0; j <= 240; j++) { A = TRK[j % 240]; if (j === 0) { c.moveTo(A[0], A[1]); } else { c.lineTo(A[0], A[1]); } } c.stroke();
    if (prevBrk) { c.strokeStyle = 'rgba(255,61,90,.4)'; c.lineWidth = 9; for (j = 0; j < 600; j++) { if (prevBrk[j] > 0.15) { A = mp(j / 600); B = mp((j + 1) / 600); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); } } }
    c.strokeStyle = '#d6d6dc'; c.lineWidth = 3; c.beginPath(); for (j = 0; j <= Math.floor(p * 240); j++) { A = TRK[j % 240]; if (j === 0) { c.moveTo(A[0], A[1]); } else { c.lineTo(A[0], A[1]); } } c.stroke();
    c.strokeStyle = C.brake; c.lineWidth = 4; for (j = 0; j < cur.brk.length; j++) { if (cur.brk[j] > 0.15) { A = mp(j / 600); B = mp((j + 1) / 600); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); } }
    [[0, 'S/F'], [0.33, 'S2'], [0.67, 'S3']].forEach(function (s) { A = mp(s[0]); c.fillStyle = C.white; c.fillRect(A[0] - 1, A[1] - 8, 2, 16); c.fillStyle = C.dim; c.fillText(s[1], A[0] + 4, A[1] - 8); });
    ev.forEach(function (e) { var pe = null; if (e.lap === f.lap) { pe = (e.t - lapStart) / f.lapLen; } else if (e.lap === f.lap - 1) { pe = (e.t - (lapStart - f.lapLen)) / f.lapLen; } if (pe === null || pe < 0 || pe > 1) { return; } A = mp(pe); c.fillStyle = e.type === 'ABS' || e.type === 'TC' ? C.warn : C.bad; c.beginPath(); c.moveTo(A[0], A[1] - 9); c.lineTo(A[0] - 5, A[1] - 1); c.lineTo(A[0] + 5, A[1] - 1); c.closePath(); c.fill(); });
    A = mp(p); c.fillStyle = C.beta; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.arc(A[0], A[1], 6, 0, 7); c.fill(); c.stroke();
    c.fillStyle = C.dim; c.fillText('red = braking zones (dim = last lap)   \u25b2 = incident', 6, 131);
    $('mapSub').textContent = 'lap position ' + Math.round(p * 100) + '%';
  }

  function drawBal() {
    var cv = $('cBal'), c = cv.getContext('2d'), w = 470, h = 44, b = U.bal, x, v, pk;
    c.clearRect(0, 0, w, h); c.font = FONT;
    c.fillStyle = '#1b1b21'; c.fillRect(0, 14, w, 14); c.fillStyle = 'rgba(56,224,140,.22)'; c.fillRect(w / 2 - 28, 14, 56, 14);
    [-3, -2, -1, 0, 1, 2, 3].forEach(function (k) { var px = w / 2 + k * (w / 2 - 8) / 3; c.fillStyle = '#34343c'; c.fillRect(px - 0.5, 10, 1, 22); });
    c.fillStyle = C.dim; c.fillText('OVERSTEER', 2, 41); c.fillText('NEUTRAL', w / 2 - 22, 41); c.fillText('UNDERSTEER', w - 72, 41);
    var word = '-', col = null;
    if (!b) { word = 'n/a'; } else if (b.calibrating) { word = 'CALIBRATING'; } else {
      var sc = b.estimated === true ? 1 : 8; v = Math.max(-1, Math.min(1, b.value / sc)); x = w / 2 + v * (w / 2 - 8);
      c.fillStyle = b.label === 'neutral' ? C.ok : C.warn; c.fillRect(Math.min(w / 2, x), 14, Math.abs(x - w / 2), 14);
      c.fillStyle = C.white; c.beginPath(); c.moveTo(x, 8); c.lineTo(x - 6, 0); c.lineTo(x + 6, 0); c.fill(); c.fillRect(x - 2, 8, 4, 22);
      if (b.peakUnder !== undefined) { [b.peakUnder / 8, -b.peakOver / 8].forEach(function (pv) { var px = w / 2 + Math.max(-1, Math.min(1, pv)) * (w / 2 - 8); c.fillStyle = C.bad; c.fillRect(px - 1, 8, 3, 24); }); }
      word = b.label === 'understeer' ? 'UNDERSTEER' : (b.label === 'oversteer' ? 'OVERSTEER' : 'NEUTRAL'); col = b.label === 'neutral' ? 'ok' : 'warn';
    }
    setT('balWord', word, col || undefined); $('balTag').textContent = U.balEst ? 'ESTIMATED' + (b && b.extrapolated ? ' (borrowed)' : '') : 'FROM TYRE SLIP';
  }
  function drawTread(i, f) {
    var c = $('cR' + i).getContext('2d'), z = [['I', f.tyreInner[i]], ['M', f.tyreMid[i]], ['O', f.tyreOuter[i]]], j, v, w = 188, col;
    c.clearRect(0, 0, w, 50); c.font = FONT;
    for (j = 0; j < 3; j++) { v = z[j][1]; col = v === null ? '#2a2a31' : C[tempWin(v) === 'cold' ? 'cold' : tempWin(v)]; c.fillStyle = C.dim; c.fillText('TREAD ' + z[j][0], 0, 12 + j * 16); c.fillStyle = '#1f1f25'; c.fillRect(52, 4 + j * 16, 100, 10); c.fillStyle = col; c.fillRect(52, 4 + j * 16, v === null ? 0 : Math.max(0, Math.min(100, (v - 50) / 70 * 100)), 10); c.fillStyle = C.ok; c.globalAlpha = 0.6; c.fillRect(52 + (78 - 50) / 70 * 100, 2 + j * 16, 1, 14); c.fillRect(52 + (98 - 50) / 70 * 100, 2 + j * 16, 1, 14); c.globalAlpha = 1; c.fillStyle = v === null ? C.dim : C.white; c.fillText(v === null ? 'n/a' : Math.round(v) + '°', 158, 12 + j * 16); }
  }

  // ---------- loop ----------
  var acc = 0, last = performance.now(), frameNo = 0;
  function loop(now) {
    var dtReal = Math.min(0.1, (now - last) / 1000), dt = 1 / 60, steps = 0; last = now;
    if (!paused) { acc += dtReal * mul; while (acc >= dt && steps < 40) { process(SIM.step(S, dt), dt); acc -= dt; steps++; frameNo++; } }
    if (U.f) { drawCar(); drawSlip(); if (frameNo % 6 === 0 || paused) { update(); } }
    requestAnimationFrame(loop);
  }
  (function () { for (var i = 0; i < 480; i++) { process(SIM.step(S, 1 / 60), 1 / 60); } update(); })();
  requestAnimationFrame(loop);

  function setMode(m) { mode = m; document.querySelectorAll('#ctl button[data-sim]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-sim') === m); }); st.grip = null; st.est = null; st.bal = null; if (m === 'iracing' && /[?&]cal=1/.test(location.search)) { trainEst(2); } for (var q = 0; q < 90; q++) { process(SIM.step(S, 1 / 60), 1 / 60); } update(); }
  document.querySelectorAll('#ctl button[data-sim]').forEach(function (b) { b.onclick = function () { setMode(b.getAttribute('data-sim')); }; });
  document.querySelectorAll('#ctl button[data-spd]').forEach(function (b) { b.onclick = function () { mul = +b.getAttribute('data-spd'); document.querySelectorAll('#ctl button[data-spd]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  $('pause').onclick = function () { paused = !paused; $('pause').classList.toggle('on', paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  var q = /[?&]t=([\d.]+)/.exec(location.search); if (q) { var g = 0, tg = +q[1]; while (S.lapT < tg && g++ < 20000) { process(SIM.step(S, 1 / 60), 1 / 60); } update(); }
  var mm = /[?&]mode=(\w+)/.exec(location.search); if (mm) { setMode(mm[1]); }
  if (/[?&]pause=1/.test(location.search)) { $('pause').click(); }
  function fit() { var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080); $('app').style.transform = 'scale(' + s + ')'; }
  window.addEventListener('resize', fit); fit();
})();
