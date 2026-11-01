// Layout mock driver. Runs the REAL lib/physics.js on simulated frames and draws every panel.
// Browser-only, not shipped to SimHub.
(function () {
  var P = SHP, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var THEME = /[?&]theme=classic/.test(location.search) ? 'classic' : 'race';
  var PALS = {
    classic: { cyan: '#38bdf8', amber: '#f5b041', green: '#34d399', red: '#f87171', purple: '#a78bfa', white: '#eef4ff', dim: '#6f84a8', line: '#1a2c4b', g1: '#101f3a', g2: '#1a2c4b', g3: '#13233f', track: '#0b182e', body: '#122240', stroke: '#3a5688', glass: '#18305a', off: '#1a2740', bar: '#38bdf8', font: 'Segoe UI', cyanRgb: '56,189,248', amberRgb: '245,176,65', redRgb: '248,113,113', greenRgb: '52,211,153' },
    race: { cyan: '#f3ff3d', amber: '#ff8a1f', green: '#38e08c', red: '#ff3d5a', purple: '#b66dff', white: '#fbfbf6', dim: '#8a8a95', line: '#26262c', g1: '#222228', g2: '#2c2c33', g3: '#26262c', track: '#1f1f25', body: '#1c1c21', stroke: '#74747f', glass: '#2b2b32', off: '#2a2a31', bar: '#aab0bc', font: 'Bahnschrift SemiCondensed, Segoe UI', cyanRgb: '243,255,61', amberRgb: '255,138,31', redRgb: '255,61,90', greenRgb: '56,224,140' }
  };
  var PAL = PALS[THEME], CL = { cyan: PAL.cyan, amber: PAL.amber, green: PAL.green, red: PAL.red, purple: PAL.purple, white: PAL.white, dim: PAL.dim, line: PAL.line };
  if (THEME === 'race') { var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'theme-race.css'; document.head.appendChild(lk); }
  var mode = 'acc', mul = 1, paused = false;
  var S = SIM.create(), st = {}, cfg = P.cfg({ velFrame: 'local', localLongIdx: 2, localLatIdx: 0 });
  var U = {}, frameNo = 0, hist = { lapsT: [], temp: [[], [], [], []], press: [[], [], [], []], lastHist: 0 };
  var W = ['FL', 'FR', 'RL', 'RR'], PHASES = ['STRAIGHT', 'BRAKING', 'TRAIL', 'COAST', 'ROTATION', 'POWER'];
  var gg = [], laps = [], bestLap = 60.62, bestSec = [19.9, 20.2, 20.4], lastSec = [20.0, 20.3, 20.5];
  var curTrace = { thr: [], brk: [], str: [] }, bestTrace = null, secT = [null, null, null], secMark = { t: 0, loss: 0, idx: 0 };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- helpers ----------
  function n(v, d) { return (v === null || v === undefined || v !== v) ? 'n/a' : v.toFixed(d); }
  function setT(id, txt, cls) { var e = $(id); if (!e) { return; } e.textContent = txt; e.classList.toggle('na', txt === 'n/a'); if (cls !== undefined) { e.className = (e.className.replace(/\b(g|a|r|c|pu)\b/g, '') + ' ' + cls).trim(); if (txt === 'n/a') { e.classList.add('na'); } } }
  function setBar(id, frac, color) { var e = $(id); if (!e) { return; } e.style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%'; e.style.background = (!color || color === CL.cyan) ? PAL.bar : color; }
  function ctx(id) { var c = $(id); return c ? c.getContext('2d') : null; }
  function mmss(t) { if (t === null || t !== t) { return 'n/a'; } var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); }
  function sgn(v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d); }
  function colFor(v, a, r) { return v >= r ? CL.red : (v >= a ? CL.amber : CL.green); }
  function html(id, h) { $(id).innerHTML = h; }

  // ---------- build static markup ----------
  var KPI = [
    ['SPEED', 'km/h', 'ground speed', function (d) { return d.speed * 3.6; }, 0, 0, 300],
    ['RPM / GEAR', 'rpm', 'gear', function (d) { return d.rpm; }, 0, 3000, 8500],
    ['BETA', '°', 'body slip angle', function () { return U.beta === null ? null : U.beta * R2D; }, 1, -15, 15],
    ['YAW RATE', '°/s', 'rotation speed', function (d) { return d.yawRate === null ? null : d.yawRate * R2D; }, 1, -40, 40],
    ['LATERAL G', 'g', 'cornering', function (d) { return d.latG; }, 2, -2, 2],
    ['BRAKE', '%', 'pedal', function (d) { return d.brake * 100; }, 0, 0, 100],
    ['THROTTLE', '%', 'pedal', function (d) { return d.throttle * 100; }, 0, 0, 100],
    ['FUEL', 'L', 'in tank', function (d) { return d.fuel; }, 1, 0, 60],
    ['FUEL / LAP', 'L', '3-lap average', function () { return P.fuelPerLap(st); }, 2, 2, 3],
    ['LAP DELTA', 's', 'vs best lap', function () { return U.delta; }, 3, -1, 1],
    ['OIL TEMP', '°C', 'engine oil', function (d) { return d.oilTemp; }, 0, 80, 130],
    ['WATER TEMP', '°C', 'coolant', function (d) { return d.waterTemp; }, 0, 70, 110]
  ];
  KPI.forEach(function (k, i) {
    var t = document.createElement('div'); t.className = 'tile'; t.id = 'kt' + i;
    t.innerHTML = '<div class="l">' + k[0] + '</div><div><span class="v" id="kv' + i + '">0</span><span class="u">' + k[1] + '</span></div><div class="c" id="kc' + i + '">' + k[2] + '</div><canvas id="ks' + i + '" width="64" height="26"></canvas>';
    $('kpi').appendChild(t); k.hist = [];
  });
  html('phases', PHASES.map(function (p) { return '<div class="ph" id="ph' + p + '">' + p.replace('TRAIL', 'TRAIL BRAKING') + '</div>'; }).join(''));

  // corner panels
  var cr = '';
  W.forEach(function (w, i) {
    cr += '<section class="p"><h3><span>' + ['Front left', 'Front right', 'Rear left', 'Rear right'][i] + '</span><span class="tag" id="c' + i + 'tag"></span></h3>' +
      ['Inner', 'Middle', 'Outer'].map(function (z, j) { return '<div class="row"><span class="k">Tread ' + z[0] + '</span><div class="bar"><i id="c' + i + 't' + j + 'b"></i></div><span class="n" id="c' + i + 't' + j + '">0</span></div>'; }).join('') +
      [['Press', 'pr', 'psi'], ['Slip', 'sl', '°'], ['Load', 'ld', 'N'], ['Travel', 'tr', 'mm'], ['Brake', 'bk', '°C']].map(function (r) {
        return '<div class="row"><span class="k">' + r[0] + '</span><div class="bar"><i id="c' + i + r[1] + 'b"></i></div><span class="n" id="c' + i + r[1] + '">0</span></div>'; }).join('') + '</section>';
  });
  html('corners', cr);

  html('pLap', '<h3><span>Lap and sector timing</span><span class="tag" id="lapTag"></span></h3>' +
    '<div style="display:flex;align-items:baseline;gap:8px"><span class="big" id="dlt" style="font-size:34px">+0.000</span><span style="color:var(--dim)">delta</span><span class="mono" style="margin-left:auto;font-size:13px" id="cur">0:00.000</span></div>' +
    '<div class="row"><span class="k">Predicted</span><span class="n" id="pred" style="width:auto">0:00.000</span><span style="margin-left:auto;color:var(--dim)">best <span class="mono" id="bst">0:00.000</span></span></div>' +
    '<div style="display:flex;gap:6px;margin:3px 0 4px" id="secs"></div>' +
    '<table><thead><tr><th>Lap</th><th>Time</th><th>vs best</th></tr></thead><tbody id="lapRows"></tbody></table>');
  html('pBal', '<h3><span>Balance and grip</span><span class="tag" id="balTag"></span></h3>' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--dim)"><span>OVERSTEER</span><span>NEUTRAL</span><span>UNDERSTEER</span></div>' +
    '<canvas id="balc" width="300" height="34"></canvas>' +
    '<div class="row" style="height:20px"><span class="k" style="width:auto">Reading</span><span class="big" id="balTxt" style="margin-left:4px">n/a</span><span style="margin-left:auto;color:var(--dim);font-size:11px">peak U <span class="mono" id="pkU">0</span> / O <span class="mono" id="pkO">0</span></span></div>' +
    '<div class="flex" style="margin-top:2px"><div class="col" style="flex:1">' + W.map(function (w, i) { return '<div class="row" style="height:20px"><span class="k" style="width:22px">' + w + '</span><div class="bar"><i id="gu' + i + '"></i></div><span class="n" style="width:36px" id="guv' + i + '">0</span></div>'; }).join('') +
    '</div><canvas id="fc" width="92" height="92"></canvas></div><div style="font-size:11px;color:var(--dim)">grip use: estimate vs best seen this session</div>');
  html('pFuel', '<h3><span>Fuel and strategy</span></h3>' +
    '<div class="row"><span class="k" style="width:100px">Fuel now</span><span class="n" id="fNow">0</span><span style="color:var(--dim)">L</span></div>' +
    '<div class="row"><span class="k" style="width:100px">Per lap (3)</span><span class="n" id="fLap">0</span><span style="color:var(--dim)">L</span></div>' +
    '<div class="row"><span class="k" style="width:100px">Laps left</span><span class="n" id="fRem">0</span><span style="color:var(--dim)">laps</span></div>' +
    '<div class="row"><span class="k" style="width:100px">Target laps</span><span class="n" id="fTgt">25</span><span style="color:var(--dim)">laps</span></div>' +
    '<div class="row"><span class="k" style="width:100px">Fuel to add</span><span class="n" id="fAdd">0</span><span style="color:var(--dim)">L</span></div>' +
    '<div class="row"><span class="k" style="width:100px">Pit window</span><span class="mono" id="fWin" style="margin-left:auto">n/a</span></div>' +
    '<div class="row"><span class="k" style="width:100px">Clean laps</span><span class="mono" id="fClean" style="margin-left:auto">0/3</span></div>');
  html('pDrv', '<h3><span>Driver input quality</span><span class="tag">this lap vs best</span></h3>' +
    '<table><thead><tr><th></th><th>Now</th><th>Best</th><th>Diff</th></tr></thead><tbody id="drvRows"></tbody></table>' +
    '<div style="font-size:11px;color:var(--dim);margin-top:auto">smoothness = mean throttle rate; lower is smoother</div>');
  html('pBrk', '<h3><span>Braking analysis</span><span class="tag" id="brkTag"></span></h3><div class="flex">' +
    '<div class="col" style="width:300px"><canvas id="brkc" width="300" height="92"></canvas>' +
    '<div class="row" style="margin-top:4px"><span class="chip" id="absChip">ABS idle</span><span class="k" style="width:auto;margin-left:10px">Lock-up</span>' + W.map(function (w, i) { return '<span class="chip" id="lk' + i + '">' + w + '</span>'; }).join('') + '</div>' +
    '<div class="row"><span class="k" style="width:90px">Bias</span><span class="n" id="bbias" style="width:auto">0</span><span style="color:var(--dim)">% front</span></div></div>' +
    '<div class="col" style="flex:1;min-width:0"><table style="margin-bottom:4px"><thead><tr><th>Disc</th><th>Temp °C</th><th></th></tr></thead><tbody>' +
    W.map(function (w, i) { return '<tr><td style="padding:0 4px;line-height:16px">' + w + '</td><td class="m" style="padding:0 4px;line-height:16px" id="bt' + i + '">0</td><td style="width:170px"><div class="bar"><i id="btb' + i + '"></i></div></td></tr>'; }).join('') + '</tbody></table>' +
    '<div class="row"><span class="k" style="width:100px">Peak brake</span><span class="n" id="bpk">0</span><span class="n" style="color:var(--dim);width:90px;white-space:nowrap" id="bpkb">0</span></div>' +
    '<div class="row"><span class="k" style="width:100px">Trail brake</span><span class="n" id="btr">0</span><span class="n" style="color:var(--dim);width:90px;white-space:nowrap" id="btrb">0</span></div>' +
    '<div id="fade" style="font-size:12px;font-weight:700;letter-spacing:.06em"></div></div></div>');
  html('pTyre', '<h3><span>Tyre stint trends</span><span class="legend"><span><b style="background:var(--cyan)"></b>FL</span><span><b style="background:var(--green)"></b>FR</span><span><b style="background:var(--amber)"></b>RL</span><span><b style="background:var(--purple)"></b>RR</span></span></h3>' +
    '<div class="flex"><div class="col" style="flex:1"><div style="font-size:11px;color:var(--dim)">TEMPERATURE (°C)</div><canvas id="ttc" width="450" height="62"></canvas>' +
    '<div style="font-size:11px;color:var(--dim)">PRESSURE (psi), dashed = hot target</div><canvas id="tpc" width="450" height="62"></canvas></div>' +
    '<div class="col" style="width:150px"><div style="font-size:11px;color:var(--dim)">WEAR</div>' + W.map(function (w, i) { return '<div class="row"><span class="k" style="width:22px">' + w + '</span><div class="bar"><i id="wr' + i + '"></i></div><span class="n" style="width:42px" id="wrv' + i + '">0</span></div>'; }).join('') + '</div></div>');
  html('pDyn', '<h3><span>Dynamics</span></h3><div class="flex"><canvas id="ggc" width="112" height="112"></canvas><div class="col" style="flex:1">' +
    ['Front', 'Rear', 'Left', 'Right'].map(function (z, i) { return '<div class="row" style="height:20px"><span class="k" style="width:36px">' + z + '</span><div class="bar"><i id="lt' + i + '"></i></div><span class="n" style="width:36px" id="ltv' + i + '">0</span></div>'; }).join('') +
    '<div style="font-size:11px;color:var(--dim)" id="ltNote">load share, %</div></div></div>');
  html('pSys', '<h3><span>Systems</span></h3>' + [['Fuel', 'sf', 'L'], ['Oil', 'so', '°C'], ['Water', 'sw', '°C'], ['Boost', 'sb', 'bar'], ['ERS', 'se', '']].map(function (r) {
    return '<div class="row"><span class="k">' + r[0] + '</span><div class="bar"><i id="' + r[1] + 'b"></i></div><span class="n" id="' + r[1] + '">0</span></div>'; }).join('') +
    '<div class="row"><span class="k">TC</span><span class="chip" id="tcChip">TC idle</span><span class="chip" id="absChip2" style="margin-left:6px">ABS idle</span></div>');
  html('pSusp', '<h3><span>Suspension and ride</span><span class="tag" id="suspTag"></span></h3><div class="flex">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;flex:1">' + W.map(function (w, i) { return '<div class="col"><div style="font-size:11px;color:var(--dim)">' + w + ' damper velocity</div><canvas id="dh' + i + '" width="130" height="86"></canvas><div class="mono" style="font-size:12px" id="dc' + i + '">0</div></div>'; }).join('') + '</div>' +
    '<div class="col" style="width:170px"><div class="row"><span class="k">Pitch</span><span class="n" id="sPitch">0</span><span style="color:var(--dim)">°</span></div><div class="row"><span class="k">Roll</span><span class="n" id="sRoll">0</span><span style="color:var(--dim)">°</span></div>' +
    '<div class="row"><span class="k">Roll bal.</span><span class="n" id="sRb" style="width:auto">n/a</span></div><div style="font-size:11px;color:var(--dim)">bottom / top counts shown under each histogram; limits learned or from the sim</div></div></div>');
  html('pEvt', '<h3><span>Event log</span><span class="tag" id="evtN"></span></h3><div id="events"></div>');
  html('pTab', '<h3><span>All parameters</span></h3><table><tbody id="tabRows"></tbody></table>');
  html('pRace', '<h3><span>Race context</span></h3>' +
    '<div class="row"><span class="k" style="width:90px">Position</span><span class="big" style="font-size:20px" id="rPos">P4</span></div>' +
    '<div class="row"><span class="k" style="width:90px">Gap ahead</span><span class="n" id="rGa" style="width:auto">0</span></div>' +
    '<div class="row"><span class="k" style="width:90px">Gap behind</span><span class="n" id="rGb" style="width:auto">0</span></div>' +
    '<div class="row"><span class="k" style="width:90px">Flag</span><span class="chip on g" id="rFlag">GREEN</span></div>' +
    '<div class="row"><span class="k" style="width:90px">Time left</span><span class="n" id="rTime" style="width:auto">0</span></div>' +
    '<div class="row"><span class="k" style="width:90px">Track / air</span><span class="n" id="rTemp" style="width:auto">0</span></div>');
  html('pPed', '<h3><span>Pedals and steering</span><span class="tag" style="color:var(--dim)">solid: this lap, dashed: best</span></h3><canvas id="pedc" width="300" height="150"></canvas>' +
    '<div class="legend" style="margin-top:2px"><span><b style="background:var(--green)"></b>throttle</span><span><b style="background:var(--red)"></b>brake</span><span><b style="background:var(--amber)"></b>steer</span></div>');

  // ---------- seed history so comparisons exist ----------
  S.lap = 6;
  P.metricsLapEnd(st, 1, false);
  st.mcBest = { lapTime: bestLap, m: { trail: 1.9, brakePeak: 0.93, overlap: 0.12, reversals: 6, smoothness: 2.1 } };
  st.fuel = { laps: [2.39, 2.42, 2.41] };
  [[1, 61.42], [2, 60.91], [3, 60.62], [4, 61.03], [5, 60.77]].forEach(function (l) { laps.push({ n: l[0], t: l[1], v: true }); });
  (function () { // precompute the "best lap" pedal trace with a clean lap
    var s = SIM.create(), r, bt = { thr: [], brk: [], str: [] }; s.slide = 0.4;
    for (var i = 0; i < 600; i++) { r = SIM.step(s, 0.1); bt.thr.push(r.frame.throttle); bt.brk.push(r.frame.brake); bt.str.push(r.frame.steer); }
    bestTrace = bt;
  })();

  st.grip = { carId: 'mock_gt3', peak: [0.34, 0.31, 0.30, 0.30], peakA: 0.30, peakR: 0.38 };
  (function () { var i, j; for (j = 0; j < 4; j++) { for (i = 0; i < 100; i++) { hist.temp[j].push(72 + 16 * (1 - Math.exp(-i / 25)) + 2 * Math.sin(i / 3 + j) + j); hist.press[j].push(26.2 + 1.5 * (1 - Math.exp(-i / 30)) + 0.2 * Math.sin(i / 4 + j)); } } })();

  // ---------- sim-specific degradation ----------
  function trainEst(laps) { var s2 = SIM.create(), i, r, d; for (i = 0; i < laps * 60 * 60; i++) { r = SIM.step(s2, 1 / 60); d = r.frame; P.estBalance(st, d.speed, d.steer, d.yawRate, d.latG, cfg); } }
  function degrade(f, m) {
    var d = {}, k, nul = [null, null, null, null];
    for (k in f) { d[k] = f[k]; }
    if (m === 'ac') { d.slipAngle = nul; d.slipRatio = nul; d.suspMax = nul; d.tyreRadius = nul; d.gapAhead = null; d.gapBehind = null; }
    if (m === 'iracing') {
      d.tyreLoad = nul; d.slipAngle = nul; d.slipRatio = nul; d.slipCombined = nul; d.wheelSpeed = nul; d.suspMax = nul; d.tyreRadius = nul;
      d.tyreCore = f.tyreMid; d.camber = nul; d.turbo = null; d.gapAhead = f.gapAhead; d.gapBehind = f.gapBehind;
    }
    if (m !== 'acc') { d.sim = m; }
    return d;
  }

  // ---------- per-frame processing ----------
  function process(res, dt) {
    var f = degrade(res.frame, mode), bs, ln, i, add, secNow;
    U.f = f; U.dt = dt; U.n = (U.n || 0) + 1;
    bs = P.bodySlip(st, f.vel, null, cfg);
    U.beta = bs ? bs.beta : null; U.gated = bs ? bs.gated : false;
    U.band = P.slipBand(U.beta, cfg);
    U.phase = P.phaseStep(st, f.brake, f.throttle, f.steer, U.beta, dt, cfg);
    if (f.tyreLoad[0] !== null) { U.lc = P.loadCenter(st, f.tyreLoad, f.speed, cfg); U.lcEst = false; }
    else { U.lc = P.estLoadCenter(st, f.suspTravel, f.latG, f.longG, f.speed, cfg); U.lcEst = true; }
    var slipForBal = f.slipAngle[0] !== null ? f.slipAngle : (f.slipCombined && f.slipCombined[0] !== null ? f.slipCombined : null);
    if (slipForBal) { U.bal = P.balance(st, slipForBal, f.speed, f.latG, cfg); U.balEst = mode === 'ac'; }
    else { U.bal = P.estBalance(st, f.speed, f.steer, f.yawRate, f.latG, cfg); U.balEst = true; if (!U.bal) { U.bal = { calibrating: true }; } }
    var gripIn = f.slipAngle[0] !== null ? f.slipAngle : (f.slipCombined && f.slipCombined[0] !== null ? f.slipCombined : null);
    U.grip = gripIn ? P.gripUpdate(st, f.carId, gripIn, f.slipRatio[0] !== null ? f.slipRatio : null, cfg) : null;
    U.damp = P.damperUpdate(st, f.suspTravel, dt, mode === 'iracing' ? f.suspVel : null, cfg, f.suspMax[0] !== null ? f.suspMax : null);
    U.lock = P.lockups(st, f.speed, f.brake, f.throttle, f.wheelSpeed[0] !== null ? f.wheelSpeed : null, f.slipRatio[0] !== null ? f.slipRatio : null, cfg, f.tyreRadius[0] !== null ? f.tyreRadius : null);
    P.eventsUpdate(st, { t: f.t, lap: f.lap, band: U.band, lock: U.lock, absActive: f.absActive, tcActive: f.tcActive, offTrack: f.offTrack }, cfg);
    P.metricsUpdate(st, f.brake, f.throttle, f.steer, dt, cfg);
    P.tracePush(st, cfg, U.beta === null ? 0 : U.beta, f.brake, f.throttle, f.steer);
    gg.push([f.latG, f.longG]); if (gg.length > 180) { gg.shift(); }
    // sector bookkeeping
    secNow = f.tn < 20 ? 0 : (f.tn < 40 ? 1 : 2);
    if (secNow !== secMark.idx) {
      secT[secMark.idx] = (f.lapT - secMark.t) + (S.slideLoss - secMark.loss);
      secMark.t = f.lapT; secMark.loss = S.slideLoss; secMark.idx = secNow;
    }
    if (U.n % 6 === 0) { KPI.forEach(function (kp) { var kv = kp[3](f); kp.hist.push(kv); if (kp.hist.length > 90) { kp.hist.shift(); } }); }
    var p = f.tn / SIM.LAP;
    U.delta = f.lapT + S.slideLoss - p * bestLap;
    U.pred = bestLap + U.delta;
    // pedal traces (10 Hz index)
    var idx = Math.floor(f.tn * 10);
    curTrace.thr[idx] = f.throttle; curTrace.brk[idx] = f.brake; curTrace.str[idx] = f.steer;
    // stint history every 1.5 s
    if (f.t - hist.lastHist > 1.5) {
      hist.lastHist = f.t;
      for (i = 0; i < 4; i++) { hist.temp[i].push(f.tyreCore[i]); hist.press[i].push(f.tyrePressure[i]); if (hist.temp[i].length > 100) { hist.temp[i].shift(); hist.press[i].shift(); } }
    }
    if (res.lapEnded) {
      var le = res.lapEnded, snap = P.metricsLapEnd(st, le.time, le.valid);
      var clean = le.valid && le.lap > 6;
      P.fuelRecordLap(st, le.startFuel, le.endFuel, clean, cfg);
      laps.push({ n: le.lap, t: le.time, v: le.valid });
      if (laps.length > 5) { laps.shift(); }
      if (le.valid && le.time < bestLap) { bestLap = le.time; }
      lastSec = secT.slice(); curTrace = { thr: [], brk: [], str: [] }; secT = [null, null, null]; secMark = { t: 0, loss: 0, idx: 0 }; S.slideLoss = 0;
    }
  }

  // ---------- drawing ----------
  function drawSpark(i, hv, lo, hi) {
    var c = ctx('ks' + i), w = 64, h = 26, j, x, y;
    c.clearRect(0, 0, w, h); c.strokeStyle = CL.cyan; c.lineWidth = 1.2; c.beginPath();
    for (j = 0; j < hv.length; j++) { if (hv[j] === null) { continue; } x = j / 89 * w; y = h - 2 - (Math.max(lo, Math.min(hi, hv[j])) - lo) / (hi - lo) * (h - 4); if (j === 0) { c.moveTo(x, y); } else { c.lineTo(x, y); } }
    c.stroke();
  }
  function drawCar() {
    var c = ctx('car'), f = U.f, cx = 150, cy = 150, i, g, bw = 62, bl = 136, tw = 14, tl = 30, bc = U.band === 'red' ? CL.red : (U.band === 'amber' ? CL.amber : CL.green);
    c.clearRect(0, 0, 300, 296);
    c.strokeStyle = PAL.g3; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, 120, 0, 7); c.stroke(); c.beginPath(); c.arc(cx, cy, 60, 0, 7); c.stroke();
    // band arcs on outer ring for scale (amber/red thresholds)
    [cfg.amberDeg, cfg.redDeg].forEach(function (dg, k) { [-1, 1].forEach(function (sd) { var a = -Math.PI / 2 + sd * dg * D2R; c.strokeStyle = k ? CL.red : CL.amber; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + Math.cos(a) * 112, cy + Math.sin(a) * 112); c.lineTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128); c.stroke(); }); });
    // tyres
    var tx = [-bw / 2 - 8, bw / 2 - 6, -bw / 2 - 8, bw / 2 - 6], ty = [-bl / 2 + 8, -bl / 2 + 8, bl / 2 - 38, bl / 2 - 38];
    for (i = 0; i < 4; i++) {
      var u = U.grip ? U.grip.util[i] : null;
      c.fillStyle = u === null ? PAL.off : (u > 0.9 ? CL.red : (u > 0.7 ? CL.amber : '#1f6f55'));
      c.fillRect(cx + tx[i], cy + ty[i], tw, tl);
    }
    c.fillStyle = PAL.body; c.strokeStyle = PAL.stroke; c.lineWidth = 2; c.beginPath();
    c.rect(cx - bw / 2, cy - bl / 2, bw, bl); c.fill(); c.stroke();
    c.fillStyle = PAL.glass; c.fillRect(cx - bw / 2 + 8, cy - 28, bw - 16, 34);
    // load centre dot
    if (U.lc) { var dx = U.lc.x * 24, dy = -U.lc.y * 50; c.fillStyle = U.lcEst ? 'transparent' : CL.white; c.strokeStyle = CL.white; c.lineWidth = 2; c.beginPath(); c.arc(cx + dx, cy + dy - 6, 8, 0, 7); if (!U.lcEst) { c.fill(); } c.stroke(); }
    // heading arrow (nose)
    c.strokeStyle = CL.white; c.fillStyle = CL.white; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy - bl / 2); c.lineTo(cx, cy - 128); c.stroke();
    c.beginPath(); c.moveTo(cx, cy - 138); c.lineTo(cx - 7, cy - 124); c.lineTo(cx + 7, cy - 124); c.fill();
    // velocity arrow: rotated by beta (true angle)
    if (U.beta !== null) {
      c.save(); c.translate(cx, cy); c.rotate(U.beta); c.strokeStyle = CL.cyan; c.fillStyle = CL.cyan; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -112); c.stroke();
      c.beginPath(); c.moveTo(0, -126); c.lineTo(-8, -110); c.lineTo(8, -110); c.fill(); c.restore();
      // arc between nose and velocity
      c.strokeStyle = bc; c.lineWidth = 3; c.beginPath(); var a0 = -Math.PI / 2, a1 = a0 + U.beta; c.arc(cx, cy, 96, Math.min(a0, a1), Math.max(a0, a1)); c.stroke();
    }
    c.fillStyle = CL.dim; c.font = '11px ' + PAL.font; c.fillText('nose', cx + 10, cy - 140); c.fillText('travel', cx + 14, cy - 98);
      }
  function drawTrace() {
    var c = ctx('trace'), w = 616, h = 104, t = st.trace, i, arr, x, y, defs;
    c.clearRect(0, 0, w, h); c.strokeStyle = PAL.g1; c.lineWidth = 1;
    for (i = 0; i <= 3; i++) { c.beginPath(); c.moveTo(0, i * h / 3 + 0.5); c.lineTo(w, i * h / 3 + 0.5); c.stroke(); }
    if (!t) { return; }
    [cfg.amberDeg, -cfg.amberDeg].forEach(function (dg) { y = h / 2 - dg / 15 * (h / 2); c.strokeStyle = 'rgba(' + PAL.amberRgb + ',.5)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); });
    [cfg.redDeg, -cfg.redDeg].forEach(function (dg) { y = h / 2 - dg / 15 * (h / 2); c.strokeStyle = 'rgba(' + PAL.redRgb + ',.5)'; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); });
    c.setLineDash([]);
    defs = [['brake', CL.red, function (v) { return h - v * (h - 4) - 2; }, 1.5], ['throttle', CL.green, function (v) { return h - v * (h - 4) - 2; }, 1.5], ['steer', CL.amber, function (v) { return h / 2 - v / 0.45 * (h / 2); }, 1.5], ['beta', CL.cyan, function (v) { return h / 2 - v * R2D / 15 * (h / 2); }, 2.5]];
    defs.forEach(function (d) {
      arr = P.rbToArray(t[d[0]]); c.strokeStyle = d[1]; c.lineWidth = d[3]; c.beginPath();
      for (i = 0; i < arr.length; i++) { x = (i + (cfg.traceN - arr.length)) / (cfg.traceN - 1) * w; y = Math.max(1, Math.min(h - 1, d[2](arr[i]))); if (i === 0) { c.moveTo(x, y); } else { c.lineTo(x, y); } }
      c.stroke();
    });
    c.fillStyle = CL.dim; c.font = '11px ' + PAL.font; c.fillText('+15°', 3, 11); c.fillText('-15°', 3, h - 3); c.fillText('-3 s', w - 30, h - 3);
  }
  function drawBal() {
    var c = ctx('balc'), w = 300, h = 34, b = U.bal, v, x, pk;
    c.clearRect(0, 0, w, h); c.fillStyle = PAL.track; c.fillRect(0, 12, w, 10);
    c.fillStyle = 'rgba(' + PAL.greenRgb + ',.25)'; c.fillRect(w / 2 - 15, 12, 30, 10);
    c.strokeStyle = CL.dim; c.beginPath(); c.moveTo(w / 2 + .5, 6); c.lineTo(w / 2 + .5, 28); c.stroke();
    if (!b || b.calibrating) { return; }
    var scale = b.estimated === true ? 1 : 8;       // estimated is -1..1, real is degrees
    v = b.value / scale; x = w / 2 + Math.max(-1, Math.min(1, v)) * (w / 2 - 6);
    c.fillStyle = Math.abs(v) < (b.estimated ? cfg.estNeutral : cfg.balanceNeutralDeg / 8) ? CL.green : CL.amber;
    c.beginPath(); c.moveTo(x, 6); c.lineTo(x - 6, 0); c.lineTo(x + 6, 0); c.fill(); c.fillRect(x - 2, 6, 4, 22);
    if (b.peakUnder !== undefined) { [b.peakUnder / 8, -b.peakOver / 8].forEach(function (pv) { var px = w / 2 + Math.max(-1, Math.min(1, pv)) * (w / 2 - 6); c.strokeStyle = CL.red; c.lineWidth = 2; c.beginPath(); c.moveTo(px, 8); c.lineTo(px, 26); c.stroke(); }); }
  }
  function drawFc() {
    var c = ctx('fc'), w = 92, g = U.grip, i;
    c.clearRect(0, 0, w, w); c.strokeStyle = PAL.g2; c.beginPath(); c.arc(46, 46, 42, 0, 7); c.stroke(); c.beginPath(); c.arc(46, 46, 21, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(4, 46); c.lineTo(88, 46); c.moveTo(46, 4); c.lineTo(46, 88); c.stroke();
    if (!g) { c.fillStyle = CL.dim; c.font = 'italic 11px ' + PAL.font; c.fillText('n/a', 34, 50); return; }
    c.fillStyle = CL.cyan; c.beginPath(); c.arc(46 + g.dotX * 40, 46 - g.dotY * 40, 5, 0, 7); c.fill();
    if (mode === 'ac') { c.fillStyle = CL.dim; c.font = '11px ' + PAL.font; c.fillText('no ratio', 26, 86); }
  }
  function drawGG() {
    var c = ctx('ggc'), i, p;
    c.clearRect(0, 0, 128, 128); c.save(); c.scale(0.875, 0.875); c.strokeStyle = PAL.g2; [60, 40, 20].forEach(function (r) { c.beginPath(); c.arc(64, 64, r, 0, 7); c.stroke(); });
    c.beginPath(); c.moveTo(2, 64); c.lineTo(126, 64); c.moveTo(64, 2); c.lineTo(64, 126); c.stroke();
    for (i = 0; i < gg.length; i++) { p = gg[i]; c.fillStyle = 'rgba(' + PAL.cyanRgb + ',' + (0.1 + 0.6 * i / gg.length) + ')'; c.fillRect(64 - p[0] * 30 - 1, 64 - p[1] * 30 - 1, 2, 2); }
    p = gg[gg.length - 1]; if (p) { c.fillStyle = CL.white; c.beginPath(); c.arc(64 - p[0] * 30, 64 - p[1] * 30, 4, 0, 7); c.fill(); }
    c.fillStyle = CL.dim; c.font = '11px ' + PAL.font; c.fillText('accel', 52, 11); c.fillText('brake', 52, 124); c.fillText('R', 118, 60); c.fillText('L', 3, 60); c.restore();
  }
  function lines(id, w, h, series, lo, hi, cols, target) {
    var c = ctx(id), i, j, a, x, y;
    c.clearRect(0, 0, w, h); c.strokeStyle = PAL.g1; c.beginPath(); c.moveTo(0, h / 2 + .5); c.lineTo(w, h / 2 + .5); c.stroke();
    if (target !== undefined) { y = h - (target - lo) / (hi - lo) * h; c.strokeStyle = 'rgba(' + PAL.amberRgb + ',.7)'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); c.setLineDash([]); }
    for (j = 0; j < series.length; j++) {
      a = series[j]; c.strokeStyle = cols[j]; c.lineWidth = 1.6; c.beginPath();
      for (i = 0; i < a.length; i++) { x = i / 99 * w; y = h - 1 - (Math.max(lo, Math.min(hi, a[i])) - lo) / (hi - lo) * (h - 2); if (i === 0) { c.moveTo(x, y); } else { c.lineTo(x, y); } }
      c.stroke();
    }
    c.fillStyle = CL.dim; c.font = '11px ' + PAL.font; c.fillText(hi, 2, 11); c.fillText(lo, 2, h - 2);
  }
  function drawBrk() {
    var c = ctx('brkc'), t = st.trace, arr, i, x, y, w = 300, h = 92;
    c.clearRect(0, 0, w, h); c.strokeStyle = PAL.g1; c.beginPath(); c.moveTo(0, h / 2 + .5); c.lineTo(w, h / 2 + .5); c.stroke();
    if (!t) { return; }
    arr = P.rbToArray(t.brake); c.fillStyle = 'rgba(' + PAL.redRgb + ',.25)'; c.strokeStyle = CL.red; c.lineWidth = 2; c.beginPath(); c.moveTo(0, h);
    for (i = 0; i < arr.length; i++) { x = (i + (cfg.traceN - arr.length)) / (cfg.traceN - 1) * w; y = h - arr[i] * (h - 6) - 2; c.lineTo(x, y); }
    c.lineTo(w, h); c.fill(); c.stroke();
    c.fillStyle = CL.dim; c.font = '11px ' + PAL.font; c.fillText('brake pressure, last 3 s', 4, 11);
  }
  function drawHist(i) {
    var c = ctx('dh' + i), hs = U.damp ? U.damp.hist[i] : null, mx = 1, j, w = 130, h = 86, bw;
    c.clearRect(0, 0, w, h);
    if (!hs) { c.fillStyle = CL.dim; c.font = 'italic 11px ' + PAL.font; c.fillText('n/a', 50, 46); return; }
    for (j = 0; j < hs.length; j++) { mx = Math.max(mx, hs[j]); }
    bw = w / hs.length;
    for (j = 0; j < hs.length; j++) { var mid = Math.abs(j - (hs.length - 1) / 2); c.fillStyle = mid > 3 ? CL.amber : CL.cyan; var bh = Math.sqrt(hs[j] / mx) * (h - 16); c.fillRect(j * bw + 1, h - 12 - bh, bw - 2, bh); }
    c.fillStyle = CL.dim; c.font = '11px ' + PAL.font; c.fillText('rebound', 0, h - 1); c.fillText('bump', w - 32, h - 1);
  }
  function drawPed() {
    var c = ctx('pedc'), w = 300, h = 150, i, defs, x, y, series;
    c.clearRect(0, 0, w, h); c.strokeStyle = PAL.g1; for (i = 0; i <= 2; i++) { c.beginPath(); c.moveTo(0, i * h / 2 + .5); c.lineTo(w, i * h / 2 + .5); c.stroke(); }
    defs = [['thr', CL.green, function (v) { return h - v * (h - 4) - 2; }], ['brk', CL.red, function (v) { return h - v * (h - 4) - 2; }], ['str', CL.amber, function (v) { return h / 2 - v / 0.45 * (h / 2); }]];
    defs.forEach(function (d) {
      [[bestTrace, true], [curTrace, false]].forEach(function (s) {
        var a = s[0][d[0]]; c.strokeStyle = d[1]; c.lineWidth = s[1] ? 1 : 2; c.globalAlpha = s[1] ? 0.55 : 1; c.setLineDash(s[1] ? [4, 3] : []); c.beginPath(); var started = false;
        for (i = 0; i < 600; i++) { if (a[i] === undefined) { continue; } x = i / 599 * w; y = d[2](a[i]); if (!started) { c.moveTo(x, y); started = true; } else { c.lineTo(x, y); } }
        c.stroke();
      });
    });
    c.globalAlpha = 1; c.setLineDash([]);
    x = Math.min(1, U.f.tn / SIM.LAP) * w; c.strokeStyle = CL.white; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
  }

  // ---------- DOM updates (10 Hz) ----------
  function updateDom() {
    var f = U.f, i, k, v, dgr = U.beta === null ? null : U.beta * R2D, bandName = { green: 'GRIP', amber: 'TRANSITION', red: 'SLIDE' }[U.band] || '', bandIcon = { green: '● ', amber: '◐ ', red: '▲ ' }[U.band] || '';
    // KPI
    KPI.forEach(function (kp, j) {
      v = kp[3](f);
      var el = $('kv' + j); el.textContent = v === null ? 'n/a' : (j === 9 ? sgn(v, 3) : (j === 2 ? sgn(v, 1) : v.toFixed(kp[4]))); el.classList.toggle('na', v === null);
      drawSpark(j, kp.hist, kp[5], kp[6]);
    });
    $('kc1').textContent = 'gear ' + f.gear + ' / ' + f.maxRpm;
    $('kc2').textContent = (bandName ? bandName.toLowerCase() : '') + (U.gated ? ' (below gate)' : '');
    $('kt2').className = 'tile' + (U.band === 'red' ? ' crit' : (U.band === 'amber' ? ' hot' : ''));
    $('kv2').style.color = U.band === 'red' ? CL.red : (U.band === 'amber' ? CL.amber : CL.white);
    $('kv9').style.color = U.delta > 0.05 ? CL.amber : (U.delta < -0.05 ? CL.green : CL.white);
    $('kt10').className = 'tile' + (f.oilTemp > 125 ? ' crit' : '');
    // phase
    PHASES.forEach(function (p) { $('ph' + p).className = 'ph ' + p + (p === U.phase ? ' on' : ''); });
    // slip view
    $('betaBig').textContent = dgr === null ? 'n/a' : sgn(dgr, 1) + '°'; $('betaBig').style.color = U.band === 'red' ? CL.red : (U.band === 'amber' ? CL.amber : CL.white);
    $('bandTxt').textContent = bandIcon + bandName; $('bandTxt').style.color = U.band === 'red' ? CL.red : (U.band === 'amber' ? CL.amber : CL.green);
    setT('slSpeed', n(f.speed * 3.6, 0)); setT('slYaw', n(f.yawRate === null ? null : f.yawRate * R2D, 1));
    setT('slLc', U.lc ? ('x ' + sgn(U.lc.x, 2) + '  y ' + sgn(U.lc.y, 2) + (U.lcEst ? ' (estimated)' : '')) : 'n/a');
    $('slipTag').textContent = mode === 'acc' ? 'ACC: real per-tyre data' : (mode === 'ac' ? 'AC: slip estimated from combined slip' : 'iRacing: load centre and balance estimated');
    // corners
    for (i = 0; i < 4; i++) {
      var zones = [f.tyreInner[i], f.tyreMid[i], f.tyreOuter[i]];
      zones.forEach(function (z, j) { setT('c' + i + 't' + j, n(z, 0)); setBar('c' + i + 't' + j + 'b', z === null ? 0 : (z - 50) / 70, z === null ? CL.dim : (z > 105 ? CL.red : (z > 95 ? CL.amber : (z < 70 ? CL.cyan : CL.green)))); });
      setT('c' + i + 'pr', n(f.tyrePressure[i], 1)); setBar('c' + i + 'prb', f.tyrePressure[i] === null ? 0 : (f.tyrePressure[i] - 24) / 8, Math.abs(f.tyrePressure[i] - 27.5) < 0.8 ? CL.green : CL.amber);
      var sa = f.slipAngle[i] === null ? (f.slipCombined && f.slipCombined[i] !== null ? f.slipCombined[i] : null) : f.slipAngle[i];
      setT('c' + i + 'sl', n(sa === null ? null : sa * R2D, 1)); setBar('c' + i + 'slb', sa === null ? 0 : Math.abs(sa * R2D) / 12, colFor(sa === null ? 0 : Math.abs(sa * R2D), 6, 9));
      setT('c' + i + 'ld', n(f.tyreLoad[i], 0)); setBar('c' + i + 'ldb', f.tyreLoad[i] === null ? 0 : f.tyreLoad[i] / 6000);
      setT('c' + i + 'tr', n(f.suspTravel[i] === null ? null : f.suspTravel[i] * 1000, 0)); setBar('c' + i + 'trb', f.suspTravel[i] === null ? 0 : f.suspTravel[i] / 0.1, f.suspMax[0] !== null && f.suspTravel[i] > f.suspMax[i] * 0.97 ? CL.red : CL.cyan);
      setT('c' + i + 'bk', n(f.brakeTemp[i], 0)); setBar('c' + i + 'bkb', (f.brakeTemp[i] - 200) / 700, f.brakeTemp[i] > 750 ? CL.red : (f.brakeTemp[i] > 650 ? CL.amber : CL.cyan));
      $('c' + i + 'tag').textContent = U.lock && U.lock[i] ? 'LOCK-UP' : (mode === 'iracing' && i >= 0 ? '' : ''); $('c' + i + 'tag').style.color = CL.red;
    }
    // lap panel
    setT('dlt', sgn(U.delta, 3)); $('dlt').style.color = U.delta > 0.05 ? CL.amber : (U.delta < -0.05 ? CL.green : CL.white);
    setT('cur', mmss(f.lapT + S.slideLoss)); setT('pred', mmss(U.pred)); setT('bst', mmss(bestLap)); $('lapTag').textContent = 'lap ' + f.lap;
    $('secs').innerHTML = [0, 1, 2].map(function (j) { var t = secT[j], cls, txt; if (t === null) { txt = (j === secMark.idx ? 'live' : '--'); cls = 'dim'; } else { txt = t.toFixed(2); cls = t < bestSec[j] ? 'pu' : (t < lastSec[j] ? 'g' : 'a'); }
      return '<div style="flex:1;border:1px solid var(--line);border-radius:3px;padding:1px 5px"><span style="color:var(--dim);font-size:11px">S' + (j + 1) + '</span> <span class="mono ' + cls + '" style="float:right">' + txt + '</span></div>'; }).join('');
    $('lapRows').innerHTML = laps.slice().reverse().map(function (l) { var d = l.t - bestLap; return '<tr><td>L' + l.n + (l.v ? '' : ' (inv)') + '</td><td class="m">' + mmss(l.t) + '</td><td class="m ' + (d <= 0.001 ? 'pu' : (d < 0.5 ? 'g' : 'a')) + '">' + (d <= 0.001 ? 'best' : sgn(d, 3)) + '</td></tr>'; }).join('');
    // balance and grip
    var b = U.bal;
    if (!b) { setT('balTxt', 'n/a'); } else if (b.calibrating) { setT('balTxt', 'calibrating'); } else { $('balTxt').textContent = b.label; $('balTxt').classList.remove('na'); $('balTxt').style.color = b.label === 'neutral' ? CL.green : CL.amber; }
    $('balTag').textContent = U.balEst ? (b && b.extrapolated ? 'estimated, borrowed band' : 'estimated') : 'from tyre slip';
    setT('pkU', b && b.peakUnder !== undefined ? b.peakUnder.toFixed(1) : 'n/a'); setT('pkO', b && b.peakOver !== undefined ? b.peakOver.toFixed(1) : 'n/a');
    for (i = 0; i < 4; i++) { var gu = U.grip ? U.grip.util[i] : null; setT('guv' + i, gu === null ? 'n/a' : Math.round(gu * 100) + '%'); setBar('gu' + i, gu === null ? 0 : gu, gu > 0.9 ? CL.red : (gu > 0.7 ? CL.amber : CL.green)); }
    // fuel
    var fpl = P.fuelPerLap(st), tgt = 25;
    setT('fNow', n(f.fuel, 1)); setT('fLap', n(fpl, 2)); setT('fRem', n(P.fuelLapsRemaining(st, f.fuel), 1)); setT('fTgt', String(tgt)); setT('fAdd', n(P.fuelToAdd(st, f.fuel, tgt), 1));
    var rem = P.fuelLapsRemaining(st, f.fuel); setT('fWin', rem === null ? 'n/a' : 'by lap ' + (f.lap + Math.max(0, Math.floor(rem) - 2)));
    setT('fClean', Math.min(3, st.fuel ? st.fuel.laps.length : 0) + '/3');
    // driver quality
    var cs = P.metricsSnapshot(st.mc || { trail: 0, brakePeak: 0, overlap: 0, reversals: 0, smooth: 0, smoothN: 0 }), bm = st.mcBest ? st.mcBest.m : null;
    var rows = [['Overlap s', cs.overlap, bm && bm.overlap, 2, true], ['Reversals', cs.reversals, bm && bm.reversals, 0, true], ['Smoothness', cs.smoothness, bm && bm.smoothness, 2, true], ['Trail brake s', cs.trail, bm && bm.trail, 2, false], ['Brake peak %', cs.brakePeak * 100, bm && bm.brakePeak * 100, 0, false]];
    $('drvRows').innerHTML = rows.map(function (r) { var dd = (r[1] === null || r[2] === null) ? null : r[1] - r[2], good = r[4] ? dd <= 0 : true; return '<tr><td>' + r[0] + '</td><td class="m">' + n(r[1], r[3]) + '</td><td class="m" style="color:var(--dim)">' + n(r[2], r[3]) + '</td><td class="m ' + (dd === null ? '' : (r[4] ? (good ? 'g' : 'a') : 'c')) + '">' + (dd === null ? 'n/a' : sgn(dd, r[3])) + '</td></tr>'; }).join('');
    // braking
    var hot = Math.max.apply(null, f.brakeTemp);
    $('absChip').className = 'chip' + (f.absActive ? ' on a' : ''); $('absChip2').className = $('absChip').className; $('tcChip').className = 'chip' + (f.tcActive ? ' on a' : '');
    $('absChip').textContent = f.absActive ? 'ABS ACTIVE' : 'ABS idle'; $('absChip2').textContent = $('absChip').textContent; $('tcChip').textContent = f.tcActive ? 'TC ACTIVE' : 'TC idle';
    for (i = 0; i < 4; i++) { $('lk' + i).className = 'chip' + (U.lock[i] ? ' on r' : ''); setT('bt' + i, n(f.brakeTemp[i], 0)); setBar('btb' + i, (f.brakeTemp[i] - 200) / 700, f.brakeTemp[i] > 750 ? CL.red : (f.brakeTemp[i] > 650 ? CL.amber : CL.cyan)); }
    setT('bbias', n(f.brakeBias, 1)); setT('bpk', n(cs.brakePeak * 100, 0) + '%'); setT('bpkb', bm ? 'best ' + (bm.brakePeak * 100).toFixed(0) + '%' : 'n/a'); setT('btr', n(cs.trail, 2) + 's'); setT('btrb', bm ? 'best ' + bm.trail.toFixed(2) + 's' : 'n/a');
    $('fade').textContent = hot > 750 ? '▲ BRAKE FADE RISK' : (hot > 650 ? '◐ BRAKES HOT' : '● BRAKES OK'); $('fade').style.color = hot > 750 ? CL.red : (hot > 650 ? CL.amber : CL.green);
    $('brkTag').textContent = mode === 'iracing' ? 'lock-ups: ABS only' : '';
    // tyre trend wear
    for (i = 0; i < 4; i++) { setT('wrv' + i, n(f.tyreWear[i], 1) + '%'); setBar('wr' + i, f.tyreWear[i] / 100 * 6, CL.cyan); }
    // dynamics
    var tot = f.tyreLoad[0] === null ? null : f.tyreLoad[0] + f.tyreLoad[1] + f.tyreLoad[2] + f.tyreLoad[3];
    var shares = tot === null ? [null, null, null, null] : [(f.tyreLoad[0] + f.tyreLoad[1]) / tot, (f.tyreLoad[2] + f.tyreLoad[3]) / tot, (f.tyreLoad[0] + f.tyreLoad[2]) / tot, (f.tyreLoad[1] + f.tyreLoad[3]) / tot];
    for (i = 0; i < 4; i++) { setT('ltv' + i, shares[i] === null ? 'n/a' : Math.round(shares[i] * 100) + '%'); setBar('lt' + i, shares[i] === null ? 0 : shares[i]); }
    $('ltNote').textContent = tot === null ? 'no tyre load data' : 'load share, %';
    // systems
    setT('sf', n(f.fuel, 1)); setBar('sfb', f.fuel / f.maxFuel); setT('so', n(f.oilTemp, 0)); setBar('sob', (f.oilTemp - 60) / 80, f.oilTemp > 125 ? CL.red : CL.cyan); setT('sw', n(f.waterTemp, 0)); setBar('swb', (f.waterTemp - 60) / 60);
    setT('sb', n(f.turbo, 2)); setBar('sbb', f.turbo === null ? 0 : f.turbo); setT('se', 'n/a'); setBar('seb', 0);
    // suspension
    for (i = 0; i < 4; i++) { setT('dc' + i, U.damp ? ('bottom ' + U.damp.bottomCount[i] + '  top ' + U.damp.topCount[i]) : 'n/a'); }
    setT('sPitch', n(f.pitch * R2D, 1)); setT('sRoll', n(f.roll * R2D, 1));
    var rb = f.tyreLoad[0] === null ? null : ((f.tyreLoad[0] + f.tyreLoad[1]) - (f.tyreLoad[2] + f.tyreLoad[3])) / tot; setT('sRb', rb === null ? 'n/a' : 'F/R ' + sgn(rb * 100, 0) + '%');
    $('suspTag').textContent = mode === 'iracing' ? 'velocity direct from shock' : '';
    // events
    var ev = P.eventList(st).slice().reverse().slice(0, 9);
    $('events').innerHTML = ev.map(function (e) { var col = e.type === 'SLIDE' ? CL.red : (e.type.indexOf('LOCK') === 0 ? CL.red : (e.type === 'ABS' || e.type === 'TC' ? CL.amber : CL.cyan)); var nm = e.type.indexOf('LOCK') === 0 ? 'LOCK ' + e.detail : e.type; return '<div><span style="color:var(--dim)">L' + e.lap + ' ' + e.t.toFixed(1).padStart(6) + 's</span> <span style="color:' + col + '">' + nm.padEnd(8) + '</span> <span style="color:var(--dim)">' + e.detail + '</span></div>'; }).join('') || '<div style="color:var(--dim)">no events yet</div>';
    $('evtN').textContent = P.eventList(st).length + ' / ' + cfg.eventN;
    // table
    var T = [['Altitude-free', null], ['Speed km/h', f.speed * 3.6, 0], ['RPM', f.rpm, 0], ['Gear', f.gear, 0], ['Throttle %', f.throttle * 100, 0], ['Brake %', f.brake * 100, 0], ['Steer rad', f.steer, 2], ['Beta deg', dgr, 1], ['Yaw deg/s', f.yawRate === null ? null : f.yawRate * R2D, 1], ['Lat g', f.latG, 2], ['Long g', f.longG, 2], ['Pitch deg', f.pitch * R2D, 1], ['Roll deg', f.roll * R2D, 1], ['Fuel L', f.fuel, 1], ['Oil C', f.oilTemp, 0], ['Water C', f.waterTemp, 0], ['Brake bias %', f.brakeBias, 1], ['Track C', f.trackTemp, 0]].slice(1);
    var half = Math.ceil(T.length / 2), tr = '';
    for (i = 0; i < half; i++) { var a = T[i], b2 = T[i + half]; tr += '<tr><td>' + a[0] + '</td><td class="m">' + n(a[1], a[2]) + '</td><td>' + (b2 ? b2[0] : '') + '</td><td class="m">' + (b2 ? n(b2[1], b2[2]) : '') + '</td></tr>'; }
    $('tabRows').innerHTML = tr;
    // race
    setT('rPos', 'P' + f.position); setT('rGa', f.gapAhead === null ? 'n/a' : '-' + f.gapAhead.toFixed(1) + ' s'); setT('rGb', f.gapBehind === null ? 'n/a' : '+' + f.gapBehind.toFixed(1) + ' s');
    var tl = f.sessionTimeLeft; setT('rTime', Math.floor(tl / 60) + ':' + ('0' + Math.floor(tl % 60)).slice(-2)); setT('rTemp', f.trackTemp + ' / ' + f.airTemp + ' °C');
  }

  function drawAll() {
    var f = U.f, i;
    drawCar(); drawTrace(); drawBal(); drawFc(); drawGG(); drawBrk(); drawPed();
    for (i = 0; i < 4; i++) { drawHist(i); }
    lines('ttc', 450, 62, hist.temp, 65, 100, [CL.cyan, CL.green, CL.amber, CL.purple]);
    lines('tpc', 450, 62, hist.press, 25, 30, [CL.cyan, CL.green, CL.amber, CL.purple], 27.5);
  }

  // ---------- main loop ----------
  var acc = 0, last = performance.now();
  function loop(now) {
    var dtReal = Math.min(0.1, (now - last) / 1000), dt = 1 / 60, steps;
    last = now;
    if (!paused) {
      acc += dtReal * mul;
      steps = 0;
      while (acc >= dt && steps < 40) { process(SIM.step(S, dt), dt); acc -= dt; steps++; frameNo++; }
    }
    if (U.f) { drawAll(); if (frameNo % 6 === 0 || paused) { updateDom(); } }
    requestAnimationFrame(loop);
  }
  // warm start so the screen is populated at once
  (function () { for (var i = 0; i < 60 * 8; i++) { process(SIM.step(S, 1 / 60), 1 / 60); } updateDom(); })();
  requestAnimationFrame(loop);

  // controls
  document.querySelectorAll('#ctl button[data-sim]').forEach(function (b) { b.onclick = function () { mode = b.getAttribute('data-sim'); document.querySelectorAll('#ctl button[data-sim]').forEach(function (x) { x.classList.toggle('on', x === b); }); st.grip = null; st.est = null; st.bal = null; if (mode === 'iracing' && /[?&]cal=1/.test(location.search)) { trainEst(2); } for (var q2 = 0; q2 < 90; q2++) { process(SIM.step(S, 1 / 60), 1 / 60); } updateDom(); }; });
  document.querySelectorAll('#ctl button[data-spd]').forEach(function (b) { b.onclick = function () { mul = +b.getAttribute('data-spd'); document.querySelectorAll('#ctl button[data-spd]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  $('pause').onclick = function () { paused = !paused; $('pause').classList.toggle('on', paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  // jump to a moment: ?t=25 seeks the lap (used for screenshots)
  var q = /[?&]t=([\d.]+)/.exec(location.search);
  if (q) { var target = +q[1], g = 0; while (S.lapT < target && g++ < 20000) { process(SIM.step(S, 1 / 60), 1 / 60); } updateDom(); }
  var mm = /[?&]mode=(\w+)/.exec(location.search); if (mm) { var bt = document.querySelector('#ctl button[data-sim=' + mm[1] + ']'); if (bt) { bt.click(); } }
  if (/[?&]pause=1/.test(location.search)) { $('pause').click(); }
  // scale to fit window
  function fit() { var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080); $('app').style.transform = 'scale(' + s + ')'; }
  window.addEventListener('resize', fit); fit();
})();
