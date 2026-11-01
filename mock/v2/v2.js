// Glance layout v2. Runs the real lib/physics.js on the simulated lap. Browser-only mock.
// Rule: every state is shown as a big number or word, with colour AND a symbol (up / down / dot).
(function () {
  var P = SHP, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var K = { y: '#f3ff3d', amber: '#ff8a1f', green: '#38e08c', red: '#ff3d5a', purple: '#b66dff', cold: '#5db3ff', white: '#fbfbf6', dim: '#8a8a95' };
  var CLS = { y: 'y', amber: 'a', green: 'g', red: 'r', purple: 'pu', cold: 'c' };
  var mode = 'acc', mul = 1, paused = false;
  var S = SIM.create(), st = {}, cfg = P.cfg({ velFrame: 'local', localLongIdx: 2, localLatIdx: 0 });
  var U = {}, laps = [], bestLap = 60.62, bestSec = [19.9, 20.2, 20.4], lastSec = [20.0, 20.3, 20.5], secT = [null, null, null];
  var secMark = { t: 0, loss: 0, idx: 0 }, tyreH = [[], [], [], []], W = ['FL', 'FR', 'RL', 'RR'], NAMES = ['FRONT LEFT', 'FRONT RIGHT', 'REAR LEFT', 'REAR RIGHT'];
  var PH = ['STRAIGHT', 'BRAKING', 'TRAIL', 'COAST', 'ROTATION', 'POWER'], PHN = { TRAIL: 'TRAIL BRAKE' };
  var $ = function (id) { return document.getElementById(id); };
  function n(v, d) { return (v === null || v === undefined || v !== v) ? 'n/a' : v.toFixed(d); }
  function sg(v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d); }
  function mmss(t) { if (t === null || t !== t) { return 'n/a'; } var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); }
  function paint(el, col) { el.classList.remove('g', 'a', 'r', 'c', 'pu', 'y'); if (col) { el.classList.add(CLS[col]); } }
  function setT(id, txt, col) { var e = $(id); e.textContent = txt; e.classList.toggle('na', txt === 'n/a'); if (col !== undefined) { paint(e, txt === 'n/a' ? null : col); } }

  // ----- state classification: always colour + symbol -----
  function tempState(c) { if (c === null) { return null; } if (c < 78) { return { col: 'cold', sym: '▼' }; } if (c <= 98) { return { col: 'green', sym: '●' }; } if (c <= 106) { return { col: 'amber', sym: '▲' }; } return { col: 'red', sym: '▲▲' }; }
  function brakeState(t) { if (t < 300) { return { col: 'cold', sym: '▼' }; } if (t <= 650) { return { col: 'green', sym: '●' }; } if (t <= 750) { return { col: 'amber', sym: '▲' }; } return { col: 'red', sym: '▲▲' }; }

  // ----- build repeated markup -----
  $('phase').innerHTML = PH.map(function (p) { return '<div class="ph" id="ph' + p + '"><span>' + (PHN[p] || p) + '</span></div>'; }).join('');
  var order = [0, 2, 1, 3];   // not used for layout; cards are placed explicitly
  var pos = [[0, 270], [604, 270], [0, 460], [604, 460]];
  $('tyres').innerHTML = W.map(function (w, i) {
    return '<div class="tc" id="tc' + i + '" style="left:' + pos[i][0] + 'px;top:' + pos[i][1] + 'px"><h4><span>' + NAMES[i] + '</span><span id="tg' + i + '"></span></h4>' +
      '<div class="t" id="tt' + i + '">0<small>°</small></div>' +
      '<div class="r2"><span id="tp' + i + '">0</span><em id="td' + i + '"></em></div>' +
      '<div class="r3"><span id="ti' + i + '"></span><span id="tw' + i + '"></span></div></div>';
  }).join('');
  $('discs').innerHTML = W.map(function (w, i) { return '<div class="disc" id="dc' + i + '"><b>' + w + ' DISC</b><span id="dv' + i + '">0</span><i id="ds' + i + '"></i></div>'; }).join('');
  $('balSeg').innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
  var REFS = ['PITCH', 'ROLL', 'YAW RATE', 'STEER', 'THROTTLE', 'BRAKE', 'OIL', 'WATER', 'TRACK', 'AIR', 'DAMPER LIMITS', 'DATA'];
  $('ref').innerHTML = REFS.map(function (r, i) { return '<div class="cell"><b>' + r + '</b><span id="rf' + i + '">-</span></div>'; }).join('');

  // ----- seeds so comparisons exist -----
  S.lap = 6;
  st.mcBest = { lapTime: bestLap, m: { trail: 1.9, brakePeak: 0.93, overlap: 0.12, reversals: 6, smoothness: 2.1 } };
  st.fuel = { laps: [2.39, 2.42, 2.41] };
  st.grip = { carId: 'mock_gt3', peak: [0.34, 0.31, 0.30, 0.30], peakA: 0.30, peakR: 0.38, n: 99999 };
  [[1, 61.42], [2, 60.91], [3, 60.62], [4, 61.03], [5, 60.77]].forEach(function (l) { laps.push({ n: l[0], t: l[1], v: true }); });
  (function () { var i, j; for (j = 0; j < 4; j++) { for (i = 0; i < 24; i++) { tyreH[j].push(72 + 14 * (1 - Math.exp(-i / 8))); } } })();

  function degrade(f, m) {
    var d = {}, k, nul = [null, null, null, null];
    for (k in f) { d[k] = f[k]; }
    if (m === 'ac') { d.slipAngle = nul; d.slipRatio = nul; d.suspMax = nul; d.tyreRadius = nul; d.gapAhead = null; d.gapBehind = null; d.sim = 'ac'; }
    if (m === 'iracing') { d.tyreLoad = nul; d.slipAngle = nul; d.slipRatio = nul; d.slipCombined = nul; d.wheelSpeed = nul; d.suspMax = nul; d.tyreRadius = nul; d.tyreCore = f.tyreMid; d.camber = nul; d.turbo = null; d.sim = 'iracing'; }
    return d;
  }
  function trainEst(laps) { var s2 = SIM.create(), i, r, d; for (i = 0; i < laps * 3600; i++) { r = SIM.step(s2, 1 / 60); d = r.frame; P.estBalance(st, d.speed, d.steer, d.yawRate, d.latG, cfg); } }

  function process(res, dt) {
    var f = degrade(res.frame, mode), bs, secNow, p, le, i;
    U.f = f; U.n = (U.n || 0) + 1;
    bs = P.bodySlip(st, f.vel, null, cfg); U.beta = bs ? bs.beta : null; U.gated = bs ? bs.gated : false; U.band = P.slipBand(U.beta, cfg);
    U.phase = P.phaseStep(st, f.brake, f.throttle, f.steer, U.beta, dt, cfg);
    if (f.tyreLoad[0] !== null) { U.lc = P.loadCenter(st, f.tyreLoad, f.speed, cfg); U.lcEst = false; } else { U.lc = P.estLoadCenter(st, f.suspTravel, f.latG, f.longG, f.speed, cfg); U.lcEst = true; }
    var sb = f.slipAngle[0] !== null ? f.slipAngle : (f.slipCombined && f.slipCombined[0] !== null ? f.slipCombined : null);
    if (sb) { U.bal = P.balance(st, sb, f.speed, f.latG, cfg); U.balEst = mode === 'ac'; } else { U.bal = P.estBalance(st, f.speed, f.steer, f.yawRate, f.latG, cfg) || { calibrating: true }; U.balEst = true; }
    U.grip = sb ? P.gripUpdate(st, f.carId, sb, f.slipRatio[0] !== null ? f.slipRatio : null, cfg) : null;
    U.damp = P.damperUpdate(st, f.suspTravel, dt, mode === 'iracing' ? f.suspVel : null, cfg, f.suspMax[0] !== null ? f.suspMax : null);
    U.lock = P.lockups(st, f.speed, f.brake, f.throttle, f.wheelSpeed[0] !== null ? f.wheelSpeed : null, f.slipRatio[0] !== null ? f.slipRatio : null, cfg, f.tyreRadius[0] !== null ? f.tyreRadius : null);
    P.eventsUpdate(st, { t: f.t, lap: f.lap, band: U.band, lock: U.lock, absActive: f.absActive, tcActive: f.tcActive, offTrack: f.offTrack }, cfg);
    P.metricsUpdate(st, f.brake, f.throttle, f.steer, dt, cfg);
    if (U.n % 30 === 0) { for (i = 0; i < 4; i++) { tyreH[i].push(f.tyreCore[i]); if (tyreH[i].length > 24) { tyreH[i].shift(); } } }
    secNow = f.tn < 20 ? 0 : (f.tn < 40 ? 1 : 2);
    if (secNow !== secMark.idx) { secT[secMark.idx] = (f.lapT - secMark.t) + (S.slideLoss - secMark.loss); secMark.t = f.lapT; secMark.loss = S.slideLoss; secMark.idx = secNow; }
    p = f.tn / SIM.LAP; U.delta = f.lapT + S.slideLoss - p * bestLap; U.pred = bestLap + U.delta;
    if (res.lapEnded) {
      le = res.lapEnded; P.metricsLapEnd(st, le.time, le.valid); P.fuelRecordLap(st, le.startFuel, le.endFuel, le.valid && le.lap > 6, cfg);
      laps.push({ n: le.lap, t: le.time, v: le.valid }); if (laps.length > 5) { laps.shift(); } if (le.valid && le.time < bestLap) { bestLap = le.time; }
      lastSec = secT.slice(); secT = [null, null, null]; secMark = { t: 0, loss: 0, idx: 0 }; S.slideLoss = 0;
    }
  }

  // ----- car canvas (every frame) -----
  var cc = $('car').getContext('2d');
  function drawCar() {
    var c = cc, f = U.f, cx = 400, cy = 285, bw = 120, bl = 300, i, col = U.band === 'red' ? K.red : (U.band === 'amber' ? K.amber : K.green), ww = 34, wl = 70;
    c.clearRect(0, 0, 800, 560);
    // wedge between nose direction and travel direction: the glanceable slip cue
    if (U.beta !== null) {
      c.fillStyle = col; c.globalAlpha = 0.35; c.beginPath(); c.moveTo(cx, cy);
      var a0 = -Math.PI / 2, a1 = a0 + U.beta; c.arc(cx, cy, 255, Math.min(a0, a1), Math.max(a0, a1)); c.closePath(); c.fill(); c.globalAlpha = 1;
    }
    // band ticks
    [cfg.amberDeg, cfg.redDeg].forEach(function (dg, k) { [-1, 1].forEach(function (s) { var a = -Math.PI / 2 + s * dg * D2R; c.strokeStyle = k ? K.red : K.amber; c.lineWidth = 4; c.beginPath(); c.moveTo(cx + Math.cos(a) * 262, cy + Math.sin(a) * 262); c.lineTo(cx + Math.cos(a) * 278, cy + Math.sin(a) * 278); c.stroke(); }); });
    // wheels coloured by grip use
    var wx = [cx - bw / 2 - ww + 6, cx + bw / 2 - 6, cx - bw / 2 - ww + 6, cx + bw / 2 - 6], wy = [cy - bl / 2 + 20, cy - bl / 2 + 20, cy + bl / 2 - 20 - wl, cy + bl / 2 - 20 - wl];
    for (i = 0; i < 4; i++) {
      var u = (U.grip && !U.grip.learning) ? U.grip.util[i] : null, lk = U.lock && U.lock[i];
      c.fillStyle = lk ? K.red : (u === null ? '#2a2a31' : (u > 0.9 ? K.red : (u > 0.7 ? K.amber : '#2a7d54')));
      c.fillRect(wx[i], wy[i], ww, wl);
      // connector to the tyre card
      var left = i % 2 === 0, yy = wy[i] + wl / 2; c.strokeStyle = '#34343c'; c.lineWidth = 2; c.beginPath(); c.moveTo(left ? 200 : 600, yy); c.lineTo(left ? wx[i] : wx[i] + ww, yy); c.stroke();
    }
    c.fillStyle = '#1c1c21'; c.strokeStyle = '#74747f'; c.lineWidth = 3; c.beginPath(); c.rect(cx - bw / 2, cy - bl / 2, bw, bl); c.fill(); c.stroke();
    c.fillStyle = '#2b2b32'; c.fillRect(cx - bw / 2 + 14, cy - 60, bw - 28, 70);
    // load centre dot (hollow when estimated)
    if (U.lc) { c.strokeStyle = K.white; c.fillStyle = K.white; c.lineWidth = 4; c.beginPath(); c.arc(cx + U.lc.x * 40, cy - U.lc.y * 90 - 10, 13, 0, 7); if (!U.lcEst) { c.fill(); } c.stroke(); }
    // nose arrow (white)
    c.strokeStyle = K.white; c.fillStyle = K.white; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, cy - bl / 2); c.lineTo(cx, cy - 238); c.stroke();
    c.beginPath(); c.moveTo(cx, cy - 258); c.lineTo(cx - 14, cy - 232); c.lineTo(cx + 14, cy - 232); c.fill();
    // travel arrow (yellow), true angle
    if (U.beta !== null) { c.save(); c.translate(cx, cy); c.rotate(U.beta); c.strokeStyle = K.y; c.fillStyle = K.y; c.lineWidth = 8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -222); c.stroke(); c.beginPath(); c.moveTo(0, -248); c.lineTo(-14, -222); c.lineTo(14, -222); c.fill(); c.restore(); }
    c.font = '600 14px Bahnschrift SemiCondensed, Segoe UI'; c.fillStyle = K.dim; c.fillText('NOSE', cx + 24, cy - 250); c.fillText('TRAVEL', cx + 40, cy - 214);
  }

  // ----- DOM (10 Hz) -----
  function update() {
    var f = U.f, i, dg = U.beta === null ? null : U.beta * R2D, bn = { green: 'GRIP', amber: 'TRANSITION', red: 'SLIDE' }[U.band] || '', bs = { green: '● ', amber: '◐ ', red: '▲ ' }[U.band] || '', bc = U.band === 'red' ? 'red' : (U.band === 'amber' ? 'amber' : 'green');
    // tier 1
    PH.forEach(function (p) { $('ph' + p).className = 'ph ' + p + (p === U.phase ? ' on' : ''); });
    setT('beta', dg === null ? 'n/a' : sg(dg, 1) + '°', U.band === 'green' ? null : bc); if (U.band === 'green') { paint($('beta'), null); }
    setT('band', bs + bn, bc);
    var dl = U.delta; setT('delta', sg(dl, 3), Math.abs(dl) < 0.05 ? null : (dl > 0 ? 'amber' : 'green')); if (Math.abs(dl) < 0.05) { paint($('delta'), null); }
    $('deltaArrow').textContent = Math.abs(dl) < 0.05 ? '●' : (dl > 0 ? '▲ SLOWER' : '▼ FASTER'); paint($('deltaArrow'), Math.abs(dl) < 0.05 ? null : (dl > 0 ? 'amber' : 'green'));
    $('deltaArrow').style.fontSize = '30px';
    setT('pred', mmss(U.pred)); setT('best', mmss(bestLap));
    // balance
    var b = U.bal, seg = $('balSeg').children, lit = -1, bcol = null, word = '-', wcol = null, idx;
    for (i = 0; i < 7; i++) { seg[i].style.background = '#1f1f25'; }
    if (!b) { word = 'n/a'; } else if (b.calibrating) { word = 'CALIBRATING'; } else {
      idx = Math.max(0, Math.min(6, Math.round((b.estimated === true ? b.value * 3 : b.value / 1.5)) * -1 + 3)); // understeer (+) to the right
      idx = 3 + Math.max(-3, Math.min(3, Math.round(b.estimated === true ? b.value * 3 : b.value / 1.5)));
      var off = idx - 3; seg[3].style.background = K.green;
      for (i = Math.min(3, idx); i <= Math.max(3, idx); i++) { seg[i].style.background = i === 3 ? K.green : (Math.abs(i - 3) >= 3 ? K.red : K.amber); }
      word = b.label === 'understeer' ? 'UNDERSTEER ►' : (b.label === 'oversteer' ? '◄ OVERSTEER' : 'NEUTRAL ●'); wcol = b.label === 'neutral' ? 'green' : 'amber';
    }
    setT('balWord', word, wcol); $('balTag').textContent = (U.balEst ? 'ESTIMATED' : '') + (b && b.extrapolated ? ' (borrowed speed band)' : '');
    setT('latg', n(f.latG, 2)); setT('longg', n(f.longG, 2)); setT('lc', U.lc ? sg(U.lc.x, 2) + ' / ' + sg(U.lc.y, 2) + (U.lcEst ? ' est' : '') : 'n/a');
    // tyre cards
    for (i = 0; i < 4; i++) {
      var ts = tempState(f.tyreCore[i]), h = tyreH[i], tr = h.length > 12 ? f.tyreCore[i] - h[h.length - 12] : 0, arrow = tr > 1.5 ? '↑' : (tr < -1.5 ? '↓' : '→');
      var tt = $('tt' + i); tt.innerHTML = n(f.tyreCore[i], 0) + '<small>° ' + (ts ? ts.sym : '') + ' ' + arrow + '</small>'; paint(tt, ts ? ts.col : null);
      var d = f.tyrePressure[i] - 27.5; $('tp' + i).textContent = n(f.tyrePressure[i], 1) + ' psi'; var td = $('td' + i); td.textContent = sg(d, 1); paint(td, Math.abs(d) <= 0.6 ? 'green' : (Math.abs(d) <= 1.2 ? 'amber' : 'red'));
      $('ti' + i).textContent = 'I ' + n(f.tyreInner[i], 0) + '  M ' + n(f.tyreMid[i], 0) + '  O ' + n(f.tyreOuter[i], 0);
      var bot = U.damp ? U.damp.bottomCount[i] : null; $('tw' + i).textContent = 'WEAR ' + n(f.tyreWear[i], 0) + '%' + (bot ? '  BOT ' + bot : '');
      var lk = U.lock && U.lock[i]; $('tc' + i).classList.toggle('lock', !!lk); var gu = (U.grip && !U.grip.learning) ? U.grip.util[i] : null; $('tg' + i).textContent = lk ? 'LOCK' : (gu !== null ? Math.round(gu * 100) + '%' : (U.grip ? 'learning' : '')); paint($('tg' + i), lk ? 'red' : (gu !== null && gu > 0.9 ? 'red' : (gu !== null && gu > 0.7 ? 'amber' : null)));
    }
    // braking
    var cs = P.metricsSnapshot(st.mc || { trail: 0, brakePeak: 0, overlap: 0, reversals: 0, smooth: 0, smoothN: 0 }), bm = st.mcBest ? st.mcBest.m : null;
    setT('bpk', Math.round(cs.brakePeak * 100) + '%'); var dp = bm ? Math.round((cs.brakePeak - bm.brakePeak) * 100) : null; setT('bpkv', dp === null ? 'n/a' : (dp === 0 ? '● same as best' : (dp > 0 ? '▲ ' + dp + ' vs best' : '▼ ' + (-dp) + ' vs best')));
    setT('btr', n(cs.trail, 2) + 's'); var dt2 = bm ? cs.trail - bm.trail : null; setT('btrv', dt2 === null ? 'n/a' : (dt2 >= 0 ? '▲ +' : '▼ ') + Math.abs(dt2).toFixed(2) + ' vs best');
    var hot = 0; for (i = 0; i < 4; i++) { var bst = brakeState(f.brakeTemp[i]); hot = Math.max(hot, f.brakeTemp[i]); var dv = $('dv' + i); dv.textContent = n(f.brakeTemp[i], 0) + '°'; paint(dv, bst.col); $('ds' + i).textContent = U.lock[i] ? 'LOCK' : bst.sym; paint($('ds' + i), U.lock[i] ? 'red' : bst.col); $('dc' + i).classList.toggle('lock', !!U.lock[i]); }
    var fd = $('fade'); fd.textContent = hot > 750 ? '▲ FADE RISK' : (hot > 650 ? '▲ HOT' : '● BRAKES OK'); paint(fd, hot > 750 ? 'red' : (hot > 650 ? 'amber' : 'green'));
    $('absC').className = 'chip' + (f.absActive ? ' on a' : ''); $('absC').textContent = f.absActive ? 'ABS ACTIVE' : 'ABS idle'; setT('bias', n(f.brakeBias, 1) + '%');
    $('brkTag').textContent = mode === 'iracing' ? 'lock-ups: ABS only' : '';
    // lap
    $('secs').innerHTML = [0, 1, 2].map(function (j) { var t = secT[j], cls = '', txt; if (t === null) { txt = j === secMark.idx ? 'live' : '--'; cls = ''; } else { txt = t.toFixed(2); cls = t < bestSec[j] ? 'pu' : (t < lastSec[j] ? 'g' : 'a'); } return '<div class="sec"><b>S' + (j + 1) + '</b><span class="' + cls + '">' + txt + '</span></div>'; }).join('');
    $('laps').innerHTML = laps.slice().reverse().slice(0, 5).map(function (l) { var dd = l.t - bestLap; return '<tr><td>L' + l.n + (l.v ? '' : ' INVALID') + '</td><td>' + mmss(l.t) + '</td><td class="' + (dd <= 0.001 ? 'pu' : (dd < 0.5 ? 'g' : 'a')) + '">' + (dd <= 0.001 ? 'BEST' : sg(dd, 3)) + '</td></tr>'; }).join('');
    // drive
    setT('gear', String(f.gear)); setT('speed', Math.round(f.speed * 3.6)); setT('rpm', Math.round(f.rpm).toString());
    $('tcC').className = 'chip' + (f.tcActive ? ' on a' : ''); $('tcC').textContent = f.tcActive ? 'TC ACTIVE' : 'TC idle'; $('abs2C').className = $('absC').className; $('abs2C').textContent = $('absC').textContent;
    // fuel
    var rem = P.fuelLapsRemaining(st, f.fuel), tgt = 25, fcol = rem === null ? null : (rem < 3 ? 'red' : (rem < tgt ? 'amber' : 'green'));
    setT('fLaps', n(rem, 1), fcol); setT('fNow', n(f.fuel, 1) + ' L'); setT('fLap', n(P.fuelPerLap(st), 2) + ' L'); setT('fAdd', n(P.fuelToAdd(st, f.fuel, tgt), 1) + ' L'); setT('fWin', rem === null ? 'n/a' : 'lap ' + (f.lap + Math.max(0, Math.floor(rem) - 2)));
    // race
    setT('pos', 'P' + f.position); setT('gA', f.gapAhead === null ? 'n/a' : '-' + f.gapAhead.toFixed(1) + 's'); setT('gB', f.gapBehind === null ? 'n/a' : '+' + f.gapBehind.toFixed(1) + 's');
    var tl = f.sessionTimeLeft; setT('tleft', Math.floor(tl / 60) + ':' + ('0' + Math.floor(tl % 60)).slice(-2));
    // events (last 3, big)
    var ev = P.eventList(st).slice().reverse().slice(0, 3);
    $('events').innerHTML = ev.map(function (e) { var col = (e.type === 'SLIDE' || e.type.indexOf('LOCK') === 0) ? K.red : (e.type === 'ABS' || e.type === 'TC' ? K.amber : K.y); var nm = e.type.indexOf('LOCK') === 0 ? 'LOCK-UP ' + e.detail : (e.type === 'SLIDE' ? 'BIG SLIDE' : e.type); return '<div><small>L' + e.lap + ' ' + e.t.toFixed(0) + 's</small><span style="color:' + col + '">' + (e.type === 'SLIDE' || e.type.indexOf('LOCK') === 0 ? '▲ ' : '● ') + nm + '</span></div>'; }).join('') || '<div><small></small><span style="color:#6a6a75">no events yet</span></div>';
    // driver inputs: arrow vs best, lower is better for these three
    var di = [['OVERLAP', cs.overlap, bm && bm.overlap, 's', 2], ['REVERSALS', cs.reversals, bm && bm.reversals, '', 0], ['SMOOTH', cs.smoothness, bm && bm.smoothness, '', 1]];
    $('drv').innerHTML = di.map(function (r) { var dd = (r[1] === null || r[2] === null) ? null : r[1] - r[2], cls = dd === null ? '' : (dd <= 0 ? 'g' : 'a'); return '<div><b>' + r[0] + ' vs best</b><span class="' + cls + '">' + (dd === null ? 'n/a' : (dd <= 0 ? '▼ ' : '▲ ') + Math.abs(dd).toFixed(r[4]) + r[3]) + '</span></div>'; }).join('');
    // reference strip (quiet)
    var rv = [n(f.pitch * R2D, 1) + '°', n(f.roll * R2D, 1) + '°', n(f.yawRate === null ? null : f.yawRate * R2D, 1) + '°/s', n(f.steer, 2) + ' rad', Math.round(f.throttle * 100) + '%', Math.round(f.brake * 100) + '%', n(f.oilTemp, 0) + '°C', n(f.waterTemp, 0) + '°C', n(f.trackTemp, 0) + '°C', n(f.airTemp, 0) + '°C',
      U.damp ? 'bottom ' + U.damp.bottomCount.reduce(function (a, x) { return a + x; }, 0) + '  top ' + U.damp.topCount.reduce(function (a, x) { return a + x; }, 0) : 'n/a',
      mode === 'acc' ? 'full' : (mode === 'ac' ? 'AC: slip est.' : 'iRacing: est.')];
    rv.forEach(function (v, j) { $('rf' + j).textContent = v; });
  }

  // ----- loop -----
  var acc = 0, last = performance.now(), frameNo = 0;
  function loop(now) {
    var dtReal = Math.min(0.1, (now - last) / 1000), dt = 1 / 60, steps = 0; last = now;
    if (!paused) { acc += dtReal * mul; while (acc >= dt && steps < 40) { process(SIM.step(S, dt), dt); acc -= dt; steps++; frameNo++; } }
    if (U.f) { drawCar(); if (frameNo % 6 === 0 || paused) { update(); } }
    requestAnimationFrame(loop);
  }
  (function () { for (var i = 0; i < 480; i++) { process(SIM.step(S, 1 / 60), 1 / 60); } update(); })();
  requestAnimationFrame(loop);

  // ----- mock controls -----
  function setMode(m) { mode = m; document.querySelectorAll('#ctl button[data-sim]').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-sim') === m); }); st.grip = null; st.est = null; st.bal = null; if (m === 'iracing' && /[?&]cal=1/.test(location.search)) { trainEst(2); } for (var q = 0; q < 90; q++) { process(SIM.step(S, 1 / 60), 1 / 60); } update(); }
  document.querySelectorAll('#ctl button[data-sim]').forEach(function (b) { b.onclick = function () { setMode(b.getAttribute('data-sim')); }; });
  document.querySelectorAll('#ctl button[data-spd]').forEach(function (b) { b.onclick = function () { mul = +b.getAttribute('data-spd'); document.querySelectorAll('#ctl button[data-spd]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  $('pause').onclick = function () { paused = !paused; $('pause').classList.toggle('on', paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  // glance test: show for 700 ms, then hide so you can check what you could read
  var gt = null;
  function glance() { var cv = $('cover'); clearTimeout(gt); cv.classList.remove('on'); gt = setTimeout(function () { $('coverTxt').textContent = 'What did you read?   (G = again, Esc = close)'; cv.classList.add('on'); }, 700); }
  $('glance').onclick = glance;
  document.addEventListener('keydown', function (e) { if (e.key === 'g' || e.key === 'G') { glance(); } if (e.key === 'Escape') { clearTimeout(gt); $('cover').classList.remove('on'); } });
  var q = /[?&]t=([\d.]+)/.exec(location.search); if (q) { var g = 0, tg = +q[1]; while (S.lapT < tg && g++ < 20000) { process(SIM.step(S, 1 / 60), 1 / 60); } update(); }
  var mm = /[?&]mode=(\w+)/.exec(location.search); if (mm) { setMode(mm[1]); }
  if (/[?&]pause=1/.test(location.search)) { $('pause').click(); }
  function fit() { var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080); $('app').style.transform = 'scale(' + s + ')'; }
  window.addEventListener('resize', fit); fit();
})();
