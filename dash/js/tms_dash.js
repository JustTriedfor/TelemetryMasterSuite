// Telemetry Master Suite: binding library for the dash (ES5.1 only, no modern syntax).
// Every dash formula is a one-liner such as:  return tms('core', root, 0);
// `root` is SimHub's per-formula persistent object (one Array per binding, never shared). Version 1.0.0 kept all state on it, so every row ran its own
// copy of every detector. Version 1.1 keeps the detector state in one shared object (TMS_GR below) that every formula of the dash steps at most once per
// data frame, and falls back to the old per-formula layout when SimHub does not share the extension globals between formulas.
// Needs lib/physics.js (SHP) and lib/adapters.js (SHA) loaded in the same JavascriptExtensions folder.
// Property names: ACC and AC confirmed in the user's property catalogs; iRacing is not supported yet (returns null).
var TMS_COL = { ok: '#FF38E08C', warn: '#FFFF8A1F', bad: '#FFFF3D5A', cold: '#FF5DB3FF', best: '#FFB66DFF', y: '#FFF3FF3D', white: '#FFF6F6F1', dim: '#FF80808B', off: '#FF2A2A31', text: '#FFD6D6DC' };
var TMS_POSN = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'];
var TMS_CFG = { steerFull: 1, steerLockDeg: 270, steerRightPositive: true, targetPsi: 27.5, lapsTarget: 5 };   // steerRightPositive: AC/ACC SteerAngle > 0 = steering right (verify: turn the wheel right, the dash wheel must turn clockwise)   // lapsTarget: planning laps when the session gives no lap count or time (edit to taste)   // steerFull: raw SteerAngle value that means full lock (verify)
var TMS_PHYS = null;

function tms_n(v) {
  if (v === null || v === undefined || typeof v === 'boolean') { return null; }
  if (typeof v === 'string') { if (v === '') { return null; } v = Number(v); }
  return (typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity) ? v : null;
}
function tms_game() {
  var g = $prop('DataCorePlugin.CurrentGame');
  return g === 'AssettoCorsaCompetizione' ? 'acc' : (g === 'AssettoCorsa' ? 'ac' : (g === 'IRacing' ? 'iracing' : null));
}
// the ACC catalog spells some physics names with a lower-case first letter (slipAngle01), the AC one does not: try both
function tms_ph(name, i) { var sx = i === undefined ? '' : '0' + (i + 1), p = 'DataCorePlugin.GameRawData.Physics.', v = tms_n($prop(p + name + sx)); return v !== null ? v : tms_n($prop(p + name.charAt(0).toLowerCase() + name.slice(1) + sx)); }
function tms_gd(name) { return $prop('DataCorePlugin.GameData.' + name); }
function tms_pedal(v) { var n = tms_n(v); return n === null ? null : (n > 1 ? n / 100 : n); }
function tms_cl(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
function tms_pad(v, n) { var t = String(v); while (t.length < n) { t = ' ' + t; } return t; }
function tms_sg(v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d); }
function tms_secs(v) { return SHA.secs(v); }
function tms_fmtTime(v) { var t = tms_secs(v), m, s; if (t === null || t <= 0) { return '--:--.---'; } m = Math.floor(t / 60); s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); }
function tms_fmtShort(v) { var t = tms_secs(v), m, s; if (t === null || t <= 0) { return '--:--.--'; } m = Math.floor(t / 60); s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
function tms_fmtSec(v) { var t = tms_secs(v), m, s; if (t === null || t <= 0) { return '--'; } if (t < 60) { return t.toFixed(2); } m = Math.floor(t / 60); s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
// Body pitch and roll RELATIVE TO THE ROAD from suspension travel (left vs right, front vs rear). The sim's own Pitch/Roll are absolute,
// so banking (Karussell) or a hill would look like body roll. Assumes travel grows with compression (verify). Returns radians or null.
var TMS_GEO = { track: 1.6, wheelbase: 2.5, pitchX: 1, rollX: 1, maxDraw: 25 };
function tms_attitude() {
  var t = [tms_ph('SuspensionTravel', 0), tms_ph('SuspensionTravel', 1), tms_ph('SuspensionTravel', 2), tms_ph('SuspensionTravel', 3)];
  if (t[0] === null || t[1] === null || t[2] === null || t[3] === null) { return null; }
  return { roll: Math.atan2((t[1] + t[3]) / 2 - (t[0] + t[2]) / 2, TMS_GEO.track), pitch: Math.atan2((t[2] + t[3]) / 2 - (t[0] + t[1]) / 2, TMS_GEO.wheelbase) };   // roll + = leaning right, pitch + = nose up
}
// How many laps are left to plan fuel for: the race, else the session time, else the planning target. {n, src} or null.
function tms_lapsToGo() {
  var rl = tms_n(tms_gd('RemainingLaps')), tl = tms_n(tms_gd('TotalLaps')), cl = tms_n(tms_gd('CompletedLaps')), ts = tms_secs(tms_gd('SessionTimeLeft')), lt = tms_secs(tms_gd('BestLapTime'));
  if (lt === null || lt <= 0) { lt = tms_secs(tms_gd('LastLapTime')); }
  if (rl !== null && rl > 0) { return { n: rl, src: 'race' }; }
  if (tl !== null && tl > 0 && cl !== null && tl - cl > 0) { return { n: tl - cl, src: 'race' }; }
  if (ts !== null && ts > 0 && lt !== null && lt > 0) { return { n: Math.ceil(ts / lt), src: 'time' }; }
  if (TMS_CFG.lapsTarget > 0) { return { n: TMS_CFG.lapsTarget, src: 'plan' }; }
  return null;
}
// Fuel per lap: SimHub's computed value when it has one (it reads 0 for the first laps in AC), else one clean lap of our own: fuel at the line minus fuel now.
function tms_lpl(root) {
  var c = tms_n($prop('DataCorePlugin.Computed.Fuel_LitersPerLap')), f = tms_n(tms_gd('Fuel')), l = tms_n(tms_gd('CompletedLaps')), d, s;
  if (c !== null && c > 0.05) { return c; }
  if (f === null || l === null) { return null; }
  root = tms_gr(root); s = root.lq;       // 1.2: shared state, stepped by the pump, so a lap line crossed on another page is still seen
  if (!s) { root.lq = { fl: l, ff: f, fv: null }; return null; }
  if (l !== s.fl) { d = s.ff - f; if (l === s.fl + 1 && d > 0.2 && d < 60) { s.fv = d; } s.fl = l; s.ff = f; }
  if (f > s.ff) { s.ff = f; }
  return s.fv;
}
function tms_lapsLeft(root) { var c = tms_n($prop('DataCorePlugin.Computed.Fuel_RemainingLaps')), l, f; if (c !== null && c > 0) { return c; } l = tms_lpl(root); f = tms_n(tms_gd('Fuel')); return (l === null || f === null) ? null : f / l; }
// Delta to the best lap: only while there is a best lap. AC has no GameData.DeltaToSessionBest (probe), SimHub's own tracker should provide one (name from the catalog, unverified at runtime).
function tms_delta() { var b = tms_secs(tms_gd('BestLapTime')), v; if (b === null || b <= 0) { return null; } v = tms_n(tms_gd('DeltaToSessionBest')); return v !== null ? v : tms_n($prop('PersistantTrackerPlugin.SessionBestLiveDeltaSeconds')); }
function tms_temp(c) { var u = $prop('TemperatureUnit'), x = tms_n(c); if (x === null) { return null; } if (u === 'Kelvin') { return x - 273.15; } if (u === 'Fahrenheit') { return (x - 32) / 1.8; } return x; }
function tms_phys() { if (!TMS_PHYS) { TMS_PHYS = SHP.cfg({ velFrame: 'local', localLongIdx: 2, localLatIdx: 0, steerOn: 0.22, steerOff: 0.13, brakeOn: 0.12, brakeOff: 0.05 }); } return TMS_PHYS; }
function tms_steerRaw() { return tms_ph('SteerAngle'); }
// steer fraction used everywhere on the dash: + = LEFT, - = RIGHT (so the sign flip lives in one place)
function tms_steerFrac() { var s = tms_ph('SteerAngle'); if (s === null) { return null; } s = tms_cl(s / TMS_CFG.steerFull, -1.2, 1.2); return TMS_CFG.steerRightPositive ? -s : s; }

// ---- v2: one frame clock and one shared state object ------------------------------------------------------
// TMS_GR is the "shared root": the detector state that v1.0.0 kept (and recomputed) on every formula's own root.
// TMS_FR is the frame clock: f = frame number, now = the clock of the frame (ms). Every stateful helper steps at most once per frame.
// If SimHub does not share extension globals between formulas, each formula simply sees its own copy of both, i.e. it runs
// the detectors it needs for itself (the v1.0.0 cost). TMS_SHARE = false forces the v1.0.0 layout (state on each formula's root).
var TMS_SHARE = true;
var TMS_GR = {};
var TMS_VERSION = '1.4';
var TMS_FR = { f: 0, now: 0, real: -1e9, tok: null, nid: 0, ev0: 0, hid: 0 };     // ev0 = runs of the formula that is never throttled, hid = runs of a hidden test item (both only for the on-screen self-check)     // nid = how many different formulas have used this copy of the library (1 = nobody else shares it)
var TMS_FR_WIN = 8;      // ms after the first reader of a frame during which nobody even looks at the data token (half a 60 Hz frame)
var TMS_FR_MAX = 40;     // ms: a frame is renewed after this even if the token did not change (a frozen token must not freeze the dash)
function tms_gr(root) { if (root !== TMS_GR && root.sid === undefined) { root.sid = ++TMS_FR.nid; } return TMS_SHARE ? TMS_GR : root; }
// token = three values that change on every data frame (the examples do the same: DNR_RaceData_rows.js _dnrrows_frame, three $prop reads)
function tms_tok() { return String($prop('DataCorePlugin.GameRawData.Physics.packetId')) + '|' + String($prop('DataCorePlugin.GameRawData.Physics.PacketId')) + '|' + String(tms_gd('CurrentLapTime')) + '|' + String(tms_gd('SpeedKmh')); }
function tms_frame() {
  var F = TMS_FR, real = new Date().getTime(), tok;
  if (real - F.real < TMS_FR_WIN && real >= F.real) { return F; }       // hot path: one clock read, no property read
  tok = F.nid > 1 ? tms_tok() : String(real);       // alone in this copy of the library (globals not shared): no data token, a frame per window, no extra property reads
  if (tok !== F.tok || real - F.now >= TMS_FR_MAX || real < F.now) { F.f++; F.now = real; F.tok = tok; }
  F.real = real;
  return F;
}

// ---- body slip angle in radians (null when unknown), smoothed on root
function tms_betaRad(root) {
  var F = tms_frame(), g, c = tms_phys(), r, v, h, now, dt, cc;
  root = tms_gr(root);
  if (root.bf === F.f) { return root.bv; }                                    // v2: stepped already in this frame
  root.bf = F.f; root.bv = null; g = tms_game();
  if (!root.bs) { root.bs = {}; root.fc = {}; }
  if (g === 'acc') {
    v = [tms_ph('LocalVelocity', 0), tms_ph('LocalVelocity', 1), tms_ph('LocalVelocity', 2)];
    r = SHP.bodySlip(root.bs, v, null, c);
  } else if (g === 'ac') {
    v = [tms_ph('Velocity', 0), tms_ph('Velocity', 1), tms_ph('Velocity', 2)]; h = tms_ph('Heading');
    now = F.now; dt = root.t0 ? (now - root.t0) / 1000 : 0.016; if (!(dt > 0)) { dt = 0.016; } root.t0 = now;
    SHP.frameCalib(root.fc, v, h, dt, c);
    cc = SHP.calibratedCfg(root.fc, SHP.cfg({ velFrame: 'world' }));
    r = SHP.bodySlip(root.bs, v, h, cc);
  } else { return null; }
  root.bv = r ? r.beta : null;
  return root.bv;
}
function tms_band(root) { var b = tms_betaRad(root); return b === null ? null : SHP.slipBand(b, tms_phys()); }
function tms_bandCol(b) { return b === 'red' ? TMS_COL.bad : (b === 'amber' ? TMS_COL.warn : (b === 'green' ? TMS_COL.ok : TMS_COL.dim)); }
function tms_tempState(c) { if (c === null) { return null; } if (c < 78) { return 'cold'; } if (c <= 98) { return 'ok'; } if (c <= 106) { return 'warn'; } return 'bad'; }
function tms_discState(t) { if (t === null) { return null; } if (t < 300) { return 'cold'; } if (t <= 650) { return 'ok'; } if (t <= 750) { return 'warn'; } return 'bad'; }
function tms_slipOf(i) { var a = tms_ph('SlipAngle', i); return a !== null ? a : tms_ph('WheelSlip', i); }
function tms_phase(root) {
  var F = tms_frame(), th, br, st, b, now, dt;
  root = tms_gr(root);
  if (root.phF === F.f) { return root.phV; }
  root.phF = F.f; root.phV = null;
  th = tms_pedal(tms_gd('Throttle')); br = tms_pedal(tms_gd('Brake')); st = tms_steerFrac(); b = tms_betaRad(root);
  if (th === null || br === null || st === null) { return null; }
  if (!root.ph) { root.ph = {}; root.pt = 0; }
  now = F.now; dt = root.pt ? (now - root.pt) / 1000 : 0.016; if (!(dt > 0)) { dt = 0.016; } root.pt = now;
  root.phV = SHP.phaseStep(root.ph, br, th, st, b, dt, tms_phys());
  return root.phV;
}
var TMS_PHASES = ['STRAIGHT', 'BRAKING', 'TRAIL', 'COAST', 'ROTATION', 'POWER'];
// Balance as a normalised number in -1..1 (+ understeer, - oversteer): mean |slip| of the front pair vs the rear pair, only while cornering.
function tms_balNorm(root) {
  var F = tms_frame(), a, s, lg, f, r, tot, target = 0;
  root = tms_gr(root);
  if (root.bnF === F.f) { return root.bn; }
  root.bnF = F.f;
  a = [tms_slipOf(0), tms_slipOf(1), tms_slipOf(2), tms_slipOf(3)]; s = tms_n(tms_gd('SpeedKmh')); lg = tms_ph('AccG', 0);
  if (root.bn === undefined) { root.bn = 0; }
  if (a[0] !== null && a[1] !== null && a[2] !== null && a[3] !== null && s !== null && lg !== null) {
    f = (Math.abs(a[0]) + Math.abs(a[1])) / 2; r = (Math.abs(a[2]) + Math.abs(a[3])) / 2; tot = f + r;
    if (s > 30 && Math.abs(lg) > 0.3 && tot > 1e-6) { target = (f - r) / tot; }
  }
  root.bn = root.bn + 0.2 * (target - root.bn);
  return root.bn;
}
function tms_balance(root) {
  var F = tms_frame(), a, s, lg;
  root = tms_gr(root);
  if (root.blF === F.f) { return root.blV; }
  root.blF = F.f;
  a = [tms_slipOf(0), tms_slipOf(1), tms_slipOf(2), tms_slipOf(3)]; s = tms_gd('SpeedKmh'); lg = tms_ph('AccG', 0);
  if (!root.bl) { root.bl = {}; }
  root.blV = SHP.balance(root.bl, a, s === null ? null : s / 3.6, lg, tms_phys());
  return root.blV;
}

// ---- main entry: tms(key, root, i)
function tms(key, root, i) {
  var v, b, x, t, g, r, st;
  switch (key) {
    // pedals and driver
    case 'thr': return tms_pedal(tms_gd('Throttle'));
    case 'brk': return tms_pedal(tms_gd('Brake'));
    case 'clu': return tms_pedal(tms_gd('Clutch'));
    case 'steer': return tms_steerFrac();
    case 'steerRot': st = tms_steerFrac(); return st === null ? 0 : -st * TMS_CFG.steerLockDeg;   // degrees; + = clockwise = right
    case 'steerRawText': v = tms_steerRaw(); return v === null ? 'raw n/a' : 'raw ' + v.toFixed(2);
    case 'steerText': st = tms_steerFrac(); return st === null ? 'n/a' : (st >= 0 ? 'L ' : 'R ') + Math.round(Math.abs(st) * TMS_CFG.steerLockDeg) + '°';
    case 'gear': v = tms_gd('Gear'); return (v === null || v === undefined) ? '-' : String(v);
    case 'speed': v = tms_n(tms_gd('SpeedKmh')); return v === null ? null : Math.round(v);
    case 'rpm': v = tms_n(tms_gd('Rpms')); return v === null ? null : Math.round(v);
    case 'rpmFrac': v = tms_n(tms_gd('Rpms')); x = tms_n(tms_gd('MaxRpm')); return (v === null || !x) ? 0 : tms_cl(v / x, 0, 1);
    case 'abs': return !!tms_gd('ABSActive');
    case 'tc': return !!tms_gd('TCActive');
    // slip
    case 'beta': b = tms_betaRad(root); return b === null ? null : b * 180 / Math.PI;
    case 'betaRot': b = tms_betaRad(root); return b === null ? 0 : b * 180 / Math.PI;     // degrees, image turns clockwise
    case 'betaText': b = tms_betaRad(root); return b === null ? 'n/a' : tms_sg(b * 180 / Math.PI, 1) + '°';
    case 'bandWord': b = tms_band(root); return b === 'red' ? '▲ SLIDE' : (b === 'amber' ? '◐ TRANSITION' : (b === 'green' ? '● GRIP' : 'n/a'));
    case 'bandColor': return tms_bandCol(tms_band(root));
    case 'phaseColor': v = tms_phase(root); return v === TMS_PHASES[i] ? (v === 'TRAIL' ? TMS_COL.warn : (v === 'ROTATION' ? TMS_COL.bad : (v === 'POWER' ? TMS_COL.ok : TMS_COL.y))) : '#FF16161A';
    case 'phaseText': v = tms_phase(root); return v === TMS_PHASES[i] ? (v === 'ROTATION' ? '#FFFFFFFF' : '#FF08080A') : '#FF565660';
    case 'balWord': v = tms_balNorm(root); return v > 0.12 ? 'UNDERSTEER' : (v < -0.12 ? 'OVERSTEER' : 'NEUTRAL');
    case 'balColor': v = tms_balNorm(root); return Math.abs(v) <= 0.12 ? TMS_COL.ok : (Math.abs(v) > 0.5 ? TMS_COL.bad : TMS_COL.warn);
    case 'balSeg': v = tms_balNorm(root); b = Math.max(-4, Math.min(4, Math.round(v * 8))); x = i - 4; if (x === 0) { return TMS_COL.ok; } if ((x > 0 && b >= x) || (x < 0 && b <= x)) { return Math.abs(x) >= 3 ? TMS_COL.bad : TMS_COL.warn; } return '#FF1F1F25';
    case 'balNeedle': v = tms_balNorm(root); return tms_cl(0.5 + v / 2, 0, 1);     // 0..1 across the meter (kept for compatibility)
    case 'grip': return tms_grip(root, i);
    case 'gripText': v = tms_grip(root, i); return v === null ? '--' : Math.round(v * 100) + '%';
    case 'gripTag': v = tms_grip(root, i); return v === null ? 'learning' : 'grip ' + Math.round(v * 100) + '%';
    case 'gripColor': v = tms_grip(root, i); return v === null ? TMS_COL.off : (v > 0.9 ? TMS_COL.bad : (v > 0.7 ? TMS_COL.warn : '#FF2A9D68'));
    // dynamics
    case 'latG': return tms_ph('AccG', 0);
    case 'longG': v = tms_ph('AccG', 2); return v;
    case 'yaw': v = tms_ph('Heading'); if (v === null) { return null; } t = new Date().getTime(); if (root.yh === undefined) { root.yh = v; root.yt = t; root.yv = 0; return 0; } x = (t - root.yt) / 1000; if (x >= 0.05) { b = v - root.yh; while (b > Math.PI) { b -= 2 * Math.PI; } while (b < -Math.PI) { b += 2 * Math.PI; } root.yv = root.yv + 0.5 * (tms_cl(b / x * 180 / Math.PI, -150, 150) - root.yv); root.yh = v; root.yt = t; } return root.yv;   // deg/s, heading increasing = clockwise = turning right is positive
    case 'pitchRot': r = tms_attitude(); return r === null ? 0 : tms_cl(r.pitch * 180 / Math.PI * TMS_GEO.pitchX, -TMS_GEO.maxDraw, TMS_GEO.maxDraw);       // drawn 1x (true angle), degrees, nose up = clockwise
    case 'rollRot': r = tms_attitude(); return r === null ? 0 : tms_cl(r.roll * 180 / Math.PI * TMS_GEO.rollX, -TMS_GEO.maxDraw, TMS_GEO.maxDraw);         // drawn 1x (true angle), leaning right = clockwise
    case 'pitchText': r = tms_attitude(); return r === null ? 'n/a' : 'PITCH ' + tms_sg(r.pitch * 180 / Math.PI, 2) + '\u00b0';
    case 'rollText': r = tms_attitude(); return r === null ? 'n/a' : 'ROLL ' + tms_sg(r.roll * 180 / Math.PI, 2) + '\u00b0';
    // tyres
    case 'core': return tms_temp(tms_ph('TyreCoreTemperature', i));
    case 'coreText': v = tms_temp(tms_ph('TyreCoreTemperature', i)); t = tms_tempState(v); return v === null ? 'n/a' : Math.round(v) + '° ' + (t === 'cold' ? '▼' : (t === 'ok' ? '●' : '▲'));
    case 'coreColor': v = tms_temp(tms_ph('TyreCoreTemperature', i)); t = tms_tempState(v); return t === null ? TMS_COL.dim : TMS_COL[t];
    case 'treadI': return tms_temp(tms_gd('TyreTemperature' + TMS_POSN[i] + 'Inner'));
    case 'treadM': return tms_temp(tms_gd('TyreTemperature' + TMS_POSN[i] + 'Middle'));
    case 'treadO': return tms_temp(tms_gd('TyreTemperature' + TMS_POSN[i] + 'Outer'));
    case 'press': return tms_n(tms_gd('TyrePressure' + TMS_POSN[i]));
    case 'pressText': v = tms_n(tms_gd('TyrePressure' + TMS_POSN[i])); return v === null ? 'n/a' : v.toFixed(1) + ' psi';
    case 'pressDeltaText': v = tms_n(tms_gd('TyrePressure' + TMS_POSN[i])); return v === null ? 'n/a' : tms_sg(v - TMS_CFG.targetPsi, 1);
    case 'pressDeltaColor': v = tms_n(tms_gd('TyrePressure' + TMS_POSN[i])); if (v === null) { return TMS_COL.dim; } x = Math.abs(v - TMS_CFG.targetPsi); return x <= 0.6 ? TMS_COL.ok : (x <= 1.2 ? TMS_COL.warn : TMS_COL.bad);
    case 'wearText': v = tms_n(tms_gd('TyreWear' + TMS_POSN[i])); return v === null ? 'n/a' : v.toFixed(1) + '%';
    case 'slipText': v = tms_ph('SlipAngle', i); if (v !== null) { return (v * 180 / Math.PI).toFixed(1) + '\u00b0'; } v = tms_ph('WheelSlip', i); return v === null ? 'n/a' : v.toFixed(2);   // AC WheelSlip is unitless (0.41 at 1.3 g in the probe), not an angle
    case 'slipDeg': v = tms_ph('SlipAngle', i); return v === null ? null : v * 180 / Math.PI;
    case 'wearLabel': return tms_game() === 'ac' ? 'LIFE' : 'WEAR';   // AC TyreWear is remaining life (98.5 on new tyres in the probe); ACC unverified
    case 'loadText': v = tms_ph('WheelLoad', i); return v === null ? 'n/a' : Math.round(v) + ' N';
    case 'load': return tms_ph('WheelLoad', i);
    case 'loadBar': v = tms_ph('WheelLoad', i); return v === null ? 0 : tms_cl(v / 8000, 0, 1);      // 8000 N = a full bar (a GT3 outside tyre reaches about 7000)
    case 'travelText': v = tms_ph('SuspensionTravel', i); return v === null ? 'n/a' : Math.round(v * 1000) + ' mm';
    case 'travel': v = tms_ph('SuspensionTravel', i); return v === null ? null : v * 1000;
    // brakes
    case 'disc': return tms_temp(tms_ph('BrakeTemp', i));
    case 'discText': v = tms_temp(tms_ph('BrakeTemp', i)); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'discColor': v = tms_temp(tms_ph('BrakeTemp', i)); t = tms_discState(v); return t === null ? TMS_COL.dim : TMS_COL[t];
    case 'discWord': v = tms_temp(tms_ph('BrakeTemp', i)); t = tms_discState(v); return t === null ? 'n/a' : ({ cold: '▼ COLD', ok: '● OK', warn: '▲ HOT', bad: '▲▲ FADE RISK' })[t];
    case 'discPeak': return Math.round(tms_discPk(root).pk[i]) + '°';
    case 'discRate': v = tms_temp(tms_ph('BrakeTemp', i)); t = new Date().getTime(); if (root.dv === undefined) { root.dv = v; root.dt = t; root.dr = 0; } if (t - root.dt >= 1000) { root.dr = v === null || root.dv === null ? 0 : (v - root.dv) / ((t - root.dt) / 1000); root.dv = v; root.dt = t; } return (root.dr >= 0 ? '▲' : '▼') + Math.abs(Math.round(root.dr)) + '°/s';
    case 'padDisc': v = tms_ph('padLife', i); x = tms_ph('discLife', i); return v === null ? 'n/a' : v.toFixed(0) + ' / ' + (x === null ? '-' : x.toFixed(0));
    // lap timing
    case 'delta': return tms_delta();
    case 'deltaText': v = tms_delta(); return v === null ? tms_fmtShort(tms_gd('CurrentLapTime')) : tms_sg(v, 3);    // no delta: show the live lap time instead
    case 'deltaLabel': v = tms_delta(); if (v !== null) { return 'DELTA VS BEST'; } x = tms_secs(tms_gd('BestLapTime')); return (x !== null && x > 0) ? 'LAP TIME (live delta n/a)' : 'LAP TIME (no best lap yet)';
    case 'deltaColor': v = tms_delta(); return (v === null || Math.abs(v) < 0.05) ? TMS_COL.white : (v > 0 ? TMS_COL.warn : TMS_COL.ok);
    case 'curLap': return tms_fmtTime(tms_gd('CurrentLapTime'));
    case 'bestLap': return tms_fmtTime(tms_gd('BestLapTime'));
    case 'lastLap': return tms_fmtTime(tms_gd('LastLapTime'));
    case 'predLap': v = tms_secs(tms_gd('BestLapTime')); x = tms_delta(); return (v === null || v <= 0 || x === null) ? '--:--.---' : tms_fmtTime(v + x);
    case 'lapNo': return tms_n(tms_gd('CurrentLap'));
    case 'sector': v = tms_secVal(root, i); return v === null ? '--' : tms_fmtSec(v.t);
    case 'sectorColor': v = tms_secVal(root, i); if (v === null || v.k === 'prev') { return TMS_COL.dim; } x = tms_secBest(root, i); return (v.k === 'cur' && x !== null && v.t <= x + 0.0005) ? TMS_COL.best : TMS_COL.white;
    case 'sectorBest': t = tms_secBest(root, i); return t === null ? '--' : 'best ' + tms_fmtSec(t);
    // fuel
    case 'fuel': return tms_n(tms_gd('Fuel'));
    case 'fuelText': v = tms_n(tms_gd('Fuel')); return v === null ? 'n/a' : v.toFixed(1) + ' L';
    case 'lplText': v = tms_lpl(root); return v === null ? 'n/a' : v.toFixed(2) + ' L';
    case 'lapsLeft': return tms_lapsLeft(root);
    case 'lapsLeftText': v = tms_lapsLeft(root); return v === null ? '--' : v.toFixed(1);
    case 'lapsLeftColor': v = tms_lapsLeft(root); b = tms_lapsToGo(); if (v === null) { return TMS_COL.dim; } if (v < 3) { return TMS_COL.bad; } return (b !== null && v < b.n) ? TMS_COL.warn : TMS_COL.ok;
    case 'raceLapsLeft': b = tms_lapsToGo(); return b === null ? 'n/a' : (b.n + (b.src === 'race' ? '' : (b.src === 'time' ? ' (time)' : ' (plan)')));
    case 'toAddText': v = tms_lpl(root); b = tms_lapsToGo(); x = tms_n(tms_gd('Fuel')); return (v === null || b === null || x === null) ? 'n/a' : Math.max(0, b.n * v - x).toFixed(1) + ' L';
    // race
    case 'pos': v = tms_n(tms_gd('Position')); return v === null ? '-' : 'P' + Math.round(v);
    case 'gapA': v = tms_n($prop('DataCorePlugin.GameRawData.Graphics.gapAhead')); return v === null ? 'n/a' : '-' + (Math.abs(v) / 1000).toFixed(1) + 's';
    case 'gapB': v = tms_n($prop('DataCorePlugin.GameRawData.Graphics.gapBehind')); return v === null ? 'n/a' : '+' + (Math.abs(v) / 1000).toFixed(1) + 's';
    case 'flag': v = tms_gd('Flag_Name'); return (v === null || v === undefined || v === '') ? 'GREEN' : String(v).toUpperCase();
    case 'flagColor': v = tms_gd('Flag_Name'); v = (v === null || v === undefined || v === '') ? 'GREEN' : String(v).toUpperCase();
      if (v === 'GREEN') { return TMS_COL.ok; } if (v.indexOf('YELLOW') >= 0) { return '#FFFFD60A'; } if (v.indexOf('BLUE') >= 0) { return TMS_COL.cold; } if (v.indexOf('CHEQ') >= 0 || v.indexOf('CHEC') >= 0) { return TMS_COL.white; } if (v.indexOf('RED') >= 0 || v.indexOf('BLACK') >= 0) { return TMS_COL.bad; } return TMS_COL.white;
    case 'sessLeft': t = tms_secs(tms_gd('SessionTimeLeft')); if (t === null || t === 0) { return '--'; } t = Math.abs(t); return Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2);   // negative = time elapsed (practice, seen in the AC probe)
    case 'temps': v = tms_temp(tms_gd('RoadTemperature')); x = tms_temp(tms_gd('AirTemperature')); return (v === null || x === null) ? 'n/a' : Math.round(v) + '° / ' + Math.round(x) + '°';
    case 'dataTag': g = tms_game(); return g === 'acc' ? 'ACC full' : (g === 'ac' ? 'AC: slip est.' : 'unsupported');
    // systems
    case 'oilText': v = tms_temp(tms_gd('OilTemperature')); return (v === null || v <= 0) ? 'n/a' : Math.round(v) + '\u00b0';   // AC reads 0 (probe)
    case 'oil': return tms_temp(tms_gd('OilTemperature'));
    case 'waterText': v = tms_temp(tms_gd('WaterTemperature')); return (v === null || v <= 0) ? 'n/a' : Math.round(v) + '\u00b0';
    case 'water': return tms_temp(tms_gd('WaterTemperature'));
    case 'boostText': v = tms_ph('Turbo'); return v === null ? 'n/a' : v.toFixed(2);
    case 'boost': return tms_ph('Turbo');
    case 'boostX10': v = tms_ph('Turbo'); return v === null ? null : v * 10;
    default: return null;
  }
}

// ---- per-lap and per-widget state (kept on root, so each formula has its own copy) ----
function tms_dtRoot(root) { var now = new Date().getTime(), dt = root.dtT ? (now - root.dtT) / 1000 : 0.016; if (!(dt > 0)) { dt = 0.016; } if (dt > 0.25) { dt = 0.016; } root.dtT = now; return dt; }
function tms_lapReset(root) { var l = tms_n($prop('DataCorePlugin.GameData.CompletedLaps')); if (root.lapId !== l) { root.lapId = l; return true; } return false; }

// Rolling auto-range for a slow signal: returns the low or high end of the last 20 s (kept on root), never narrower than minSpan.
// ---- panels that need state: every row formula runs its own copy of the detector on the same inputs, so they all agree without a plugin ----
// One step of the braking-zone, event, lock-up and driver-metric detectors per distinct clock tick (the result is reused within a tick).
function tms_step(root) {
  var F = tms_frame(), now = F.now, s, c = tms_phys(), dt, sp, br, th, steer, lap, ab, tc, ws, sr, lock, f, k, ll, wo = true, ro = true, band, added;
  root = tms_gr(root); s = root.sd;
  if (s && s.f === F.f) { return s; }
  if (!s) { s = root.sd = { t: 0, f: -1, lap: null, st: {}, n: 0, evV: 0, evB: -1, znB: null, lkB: null }; }
  dt = s.t ? (now - s.t) / 1000 : 0; s.t = now; s.f = F.f;
  sp = tms_n(tms_gd('SpeedKmh')); br = tms_pedal(tms_gd('Brake')); th = tms_pedal(tms_gd('Throttle')); steer = tms_steerFrac(); lap = tms_n(tms_gd('CompletedLaps'));
  if (sp === null || br === null || th === null || !(dt > 0) || dt > 0.5) { return s; }
  if (steer === null) { steer = 0; }
  ab = tms_gd('ABSActive') ? true : false; tc = tms_gd('TCActive') ? true : false;
  ws = [tms_ph('WheelAngularSpeed', 0), tms_ph('WheelAngularSpeed', 1), tms_ph('WheelAngularSpeed', 2), tms_ph('WheelAngularSpeed', 3)];
  sr = [tms_ph('SlipRatio', 0), tms_ph('SlipRatio', 1), tms_ph('SlipRatio', 2), tms_ph('SlipRatio', 3)];
  for (k = 0; k < 4; k++) { if (ws[k] === null) { wo = false; } if (sr[k] === null) { ro = false; } }
  lock = SHP.lockups(s.st, sp / 3.6, br, th, wo ? ws : null, ro ? sr : null, c, null); s.lk = lock;       // 1.3: s.lk = the wheels locked right now (the glance alert reads it)
  if (lap !== null && s.lap !== null && lap !== s.lap) { ll = tms_secs(tms_gd('LastLapTime')); SHP.zoneLapEnd(s.st, ll, true, c); SHP.metricsLapEnd(s.st, ll, true); }
  if (lap !== null) { s.lap = lap; }
  f = { lap: s.lap, pos: null, speed: sp / 3.6, brake: br, steer: steer, longG: tms_ph('AccG', 2), abs: ab, lock: lock[0] || lock[1] || lock[2] || lock[3] };
  SHP.zoneUpdate(s.st, f, dt, c);
  SHP.metricsUpdate(s.st, br, th, steer, dt, c);
  band = tms_band(root);
  added = SHP.eventsUpdate(s.st, { t: now / 1000, lap: tms_curLap(), band: band, lock: lock, absActive: ab, tcActive: tc, offTrack: false, lapTime: tms_secs(tms_gd('CurrentLapTime')), speed: sp }, c);
  if (added.length) { s.evV++; }
  s.n++;
  return s;
}
// ---- v2 row caches: the strings of a panel are rebuilt only when the thing they show changed (event pushed, zone live or finished, corner filed)
function tms_evTxt(s, i) {
  var l, k, v, out = [], t = [];
  if (s.evB !== s.evV) {
    l = tms_evrows(s);
    for (k = 0; k < 8; k++) {
      v = l[k];
      if (!v) { out.push(k === 0 ? 'no events yet: slides, lock-ups, ABS, TC' : ''); t.push(TMS_COL.dim); continue; }
      out.push('L' + (v.lap === null ? '-' : v.lap) + '   ' + (v.lt === null ? '--' : tms_fmtShort(v.lt)) + '   ' + tms_evText(v) + (v.v === null ? '' : '   ' + Math.round(v.v) + ' km/h'));
      t.push(v.type.indexOf('LOCKUP') === 0 ? TMS_COL.bad : (v.type === 'SLIDE' ? TMS_COL.warn : TMS_COL.text));
    }
    s.evB = s.evV; s.evS = out; s.evC = t;
  }
  return s;
}
function tms_znTxt(s, i) {
  var z = s.st.zn, sig = (z && z.cur) ? 'live' : (z ? z.list.head + ':' + z.list.count : '-'), l, k, v, x, out, t;
  if (sig === 'live' || s.znB !== sig || s.znN !== (s.n < 10)) {
    l = tms_zrows(s); out = []; t = [];
    for (k = 0; k < 5; k++) {
      v = l[k];
      if (!v) { out.push(k === 0 ? (s.n < 10 ? 'waiting for data' : 'no braking zone yet') : ''); t.push(TMS_COL.dim); continue; }
      x = v.z;
      out.push((v.live ? '>' : ' ') + '#' + tms_pad(x.idx, 2) + ' ' + tms_pad(Math.round(x.entry * 3.6), 3) + '>' + tms_pad(Math.round(x.minSpeed * 3.6), 3) + ' ' + tms_pad(Math.round(x.peak * 100), 3) + '% ' + x.decel.toFixed(1) + 'g ' + x.trail.toFixed(1) + 's' + (x.abs ? ' A' + x.abs : '') + (x.lock ? ' L' : ''));
      t.push(x.lock ? TMS_COL.bad : (v.live ? TMS_COL.y : (x.abs ? TMS_COL.warn : TMS_COL.white)));
    }
    s.znB = sig; s.znN = (s.n < 10); s.znS = out; s.znC = t;
  }
  return s;
}
// lock-ups of the current lap per wheel: depends on the event list and the lap only
function tms_lkTxt(s) {
  var key = s.evV + ':' + s.lap, x, v, r;
  if (s.lkB !== key) {
    x = [0, 0, 0, 0]; v = SHP.eventList(s.st);
    for (r = 0; r < v.length; r++) { if (v[r].type.indexOf('LOCKUP') === 0 && v[r].lap === s.lap) { x[+v[r].type.slice(6)]++; } }
    s.lkB = key; s.lkN = x; s.lkT = 'LOCK-UPS THIS LAP    FL ' + x[0] + '    FR ' + x[1] + '    RL ' + x[2] + '    RR ' + x[3];
    s.lkC = (x[0] + x[1] + x[2] + x[3]) > 0 ? TMS_COL.bad : TMS_COL.text;
  }
  return s;
}
// braking zones, newest first: the live one (if any) then the finished ones, at most 5
function tms_zrows(s) {
  var z = s.st.zn, l = z ? SHP.rbToArray(z.list) : [], out = [], k;
  if (z && z.cur) { out.push({ z: z.cur, live: true }); }
  for (k = l.length - 1; k >= 0 && out.length < 5; k--) { out.push({ z: l[k], live: false }); }
  return out;
}
function tms_evrows(s) { var l = SHP.eventList(s.st), out = [], k; for (k = l.length - 1; k >= 0 && out.length < 6; k--) { out.push(l[k]); } return out; }
var TMS_EVNAME = { SLIDE: 'SLIDE', ABS: 'ABS active', TC: 'TC active', OFFTRACK: 'OFF TRACK' };
function tms_evText(e) { return e.type.indexOf('LOCKUP') === 0 ? 'LOCK-UP ' + e.detail : (TMS_EVNAME[e.type] || e.type); }
// Sector times of the current lap, timed here from the sector index because the game's Sector2Time / Sector3LastLapTime are missing in AC.
// The index is not assumed to start at 0 (SimHub's AC value counts from 1): a sector is complete when the index goes up by one, and the number of
// the sector being run is counted from the lap line, so only increases matter. A decrease (the index wrapping at the lap line) is ignored.
// 1.2: one shared sector timer, stepped once per frame (and by the pump), so a sector crossed while another page is shown is still timed
function tms_sec(root) { var F = tms_frame(), s; root = tms_gr(root); s = root.sc; if (s && s.f === F.f) { return s; } s = tms_secStep(root); s.f = F.f; return s; }
function tms_secStep(root) {
  var s = root.sc, idx = tms_n(tms_gd('CurrentSectorIndex')), lap = tms_n(tms_gd('CompletedLaps')), clt = tms_secs(tms_gd('CurrentLapTime')), lst = tms_secs(tms_gd('LastLapTime')), ls, k;
  if (idx === null) { idx = tms_n($prop('DataCorePlugin.GameRawData.Graphics.CurrentSectorIndex')); }
  if (!s) { s = root.sc = { cur: [null, null, null], prev: [null, null, null], best: [null, null, null], n: null, last: null, lap: lap, start: null, ls: null }; }
  if (clt === null || idx === null) { return s; }
  if (s.last === null) { s.last = idx; if (clt < 2) { s.n = 0; s.start = 0; } return s; }      // first look: at the very start of a lap the numbering is known
  if (lap !== s.lap) {            // lap line: close the last sector from the lap time, keep the finished lap, start counting again
    if (s.n === 2 && s.cur[0] !== null && s.cur[1] !== null && lst !== null && lst > 0) { s.cur[2] = lst - s.cur[0] - s.cur[1]; }
    for (k = 0; k < 3; k++) { if (s.cur[k] !== null) { s.prev[k] = s.cur[k]; if (s.best[k] === null || s.cur[k] < s.best[k]) { s.best[k] = s.cur[k]; } } }
    s.cur = [null, null, null]; s.lap = lap; s.n = 0; s.start = 0; s.last = idx;
    return s;
  }
  if (s.n === null) { s.last = idx; return s; }     // the dash was opened mid-lap: the sector number is unknown until the next lap line
  if (idx > s.last) {
    if (idx === s.last + 1 && s.n < 2 && s.start !== null) {
      ls = tms_secs(tms_gd('LastSectorTime')); if (ls !== null && ls > 1000) { ls = ls / 1000; }
      s.cur[s.n] = (ls !== null && ls > 0 && ls !== s.ls) ? ls : clt - s.start;
      s.ls = ls; s.n++; s.start = clt;
    } else { s.n = null; }
  }
  s.last = idx;
  return s;
}
// {t, k}: k = 'cur' (finished this lap), 'run' (running now) or 'prev' (last lap's, until this lap replaces it); null when unknown
function tms_secVal(root, i) {
  var s = tms_sec(root), g, clt;
  if (s.n !== null) {
    if (s.cur[i] !== null) { return { t: s.cur[i], k: 'cur' }; }
    if (s.n === i && s.start !== null) { clt = tms_secs(tms_gd('CurrentLapTime')); if (clt !== null) { return { t: clt - s.start, k: 'run' }; } }
    return s.prev[i] !== null ? { t: s.prev[i], k: 'prev' } : null;
  }
  g = tms_secs(i === 0 ? tms_gd('Sector1Time') : (i === 1 ? tms_gd('Sector2Time') : tms_gd('Sector3LastLapTime')));      // not tracking yet: the game's own values where it has them
  if (g !== null && g > 0) { return { t: g, k: 'cur' }; }
  return s.prev[i] !== null ? { t: s.prev[i], k: 'prev' } : null;
}
// best time of sector i: the game's, else the best of the laps timed here
function tms_secBest(root, i) { var t = tms_secs(i === 0 ? tms_gd('Sector1BestTime') : (i === 1 ? tms_gd('Sector2BestTime') : tms_gd('Sector3BestLapTime'))); if (t === null || t <= 0) { t = tms_sec(root).best[i]; } return (t === null || t <= 0) ? null : t; }
// Lap history row k (0 = the lap just finished): SimHub's own PersistantTracker keeps the last laps; row 0 falls back to LastLapTime.
function tms_hist(k) {
  var n = tms_n(tms_gd('CompletedLaps')), t = tms_secs($prop('PersistantTrackerPlugin.PreviousLap_0' + k)), d = tms_n($prop('PersistantTrackerPlugin.PreviousLap_0' + k + '_DeltaToSessionBest')), b = tms_secs(tms_gd('BestLapTime'));
  if ((t === null || t <= 0) && k === 0) { t = tms_secs(tms_gd('LastLapTime')); }
  if (t === null || t <= 0 || n === null || n - k < 1) { return null; }
  if (d === null && b !== null && b > 0) { d = t - b; }
  return { lap: n - k, t: t, d: d };
}
// Grip use: combined slip as a share of the recent peak for that tyre. The peak rises gradually (one kerb or impact spike cannot pin it) and halves every 90 s.
function tms_grip(root, i) {
  var F = tms_frame(), g, now = F.now, dt, k, a, r, cur, pk, mn = 0.02, car;
  root = tms_gr(root); g = root.gp;
  if (g && g.f === F.f) { return g.ok && g.n >= 120 ? g.u[i] : null; }        // v2: all four tyres were stepped already in this frame
  car = tms_gd('CarId');
  if (!g) { g = root.gp = { pk: [0, 0, 0, 0], u: [0, 0, 0, 0], n: 0, t: now, car: car, f: -1, ok: false }; }
  g.f = F.f; g.ok = false;
  if (g.car !== car) { g.car = car; g.pk = [0, 0, 0, 0]; g.n = 0; }
  dt = (now - g.t) / 1000; g.t = now; if (!(dt > 0) || dt > 1) { dt = 0.016; }
  for (k = 0; k < 4; k++) {
    a = tms_slipOf(k); if (a === null) { return null; }
    r = tms_ph('SlipRatio', k); cur = r === null ? Math.abs(a) : Math.sqrt(a * a + r * r);
    pk = g.pk[k] * Math.pow(0.5, dt / 90);
    if (cur > pk) { pk = pk + 0.05 * (Math.min(cur, 2 * pk + mn) - pk); }
    g.pk[k] = pk; g.u[k] = pk > mn ? tms_cl(cur / pk, 0, 1) : 0;
  }
  g.n++; g.ok = true;
  return g.n < 120 ? null : g.u[i];
}
// symmetric +-range for the delta chart from the last minute (steps of 0.5 s so the scale does not flicker)
function tms_dRange(root) {
  var now = tms_frame().now, d, k, m = 0, r;
  root = tms_gr(root);
  if (!root.dr) { root.dr = { a: [], t: 0, v: 1, dirty: true }; }
  r = root.dr;
  if (now - r.t >= 250) { r.t = now; d = tms_delta(); if (d !== null) { r.a.push(Math.abs(d)); if (r.a.length > 240) { r.a.shift(); } r.dirty = true; } }
  if (r.dirty) { for (k = 0; k < r.a.length; k++) { if (r.a[k] > m) { m = r.a[k]; } } r.v = Math.max(1, Math.ceil(m * 1.2 * 2) / 2); r.dirty = false; }
  return r.v;
}
// Track map without a plugin: dot k remembers where the car was in 1/72 of the lap (NormalizedCarPosition) and every dot keeps the same min/max of the path, so they all share one scale.
function tms_mapPos() {
  var u = tms_n($prop('DataCorePlugin.GameRawData.Graphics.NormalizedCarPosition')), x = tms_n(tms_gd('CarCoordinates01')), z = tms_n(tms_gd('CarCoordinates03'));
  if (u === null) { u = tms_n(tms_gd('TrackPositionPercent')); if (u !== null && u > 1) { u = u / 100; } }
  if (x === null) { x = tms_n($prop('DataCorePlugin.GameRawData.Graphics.CarCoordinates01')); }
  if (z === null) { z = tms_n($prop('DataCorePlugin.GameRawData.Graphics.CarCoordinates03')); }
  return (u === null || x === null || z === null) ? null : { u: u, x: x, z: z };
}
function tms_map(root, k, n) {
  var p = tms_mapPos(), m = root.mp, sc;
  if (!m) { m = root.mp = { x0: 1e18, x1: -1e18, z0: 1e18, z1: -1e18, px: null, pz: null }; }
  if (p) {
    if (p.x < m.x0) { m.x0 = p.x; } if (p.x > m.x1) { m.x1 = p.x; } if (p.z < m.z0) { m.z0 = p.z; } if (p.z > m.z1) { m.z1 = p.z; }
    if (k < 0 || Math.floor(tms_cl(p.u, 0, 0.9999) * n) === k) { m.px = p.x; m.pz = p.z; }
  }
  sc = Math.max(m.x1 - m.x0, m.z1 - m.z0);
  if (m.px === null || !(sc >= 30)) { return null; }          // nothing recorded yet, or less than 30 m of path
  return { x: 0.5 + (m.px - (m.x0 + m.x1) / 2) / sc, y: 0.5 - (m.pz - (m.z0 + m.z1) / 2) / sc };
}
// Per-lap g peaks (spikes above 8 g are kerb or impact noise): lateral, braking, acceleration, yaw rate.
function tms_gpk(root) {
  var F = tms_frame(), g, lap = tms_n(tms_gd('CompletedLaps')), lg, lo, yw;
  root = tms_gr(root); g = root.gk;
  if (!g) { g = root.gk = { t: 0, f: -1, lap: lap, lat: 0, brk: 0, acc: 0, yaw: 0 }; }
  if (g.f === F.f) { return g; }
  g.t = F.now; g.f = F.f;
  if (lap !== g.lap) { g.lap = lap; g.lat = 0; g.brk = 0; g.acc = 0; g.yaw = 0; }
  lg = tms_ph('AccG', 0); lo = tms_ph('AccG', 2); yw = tms('yaw', root, 0);
  if (lg !== null && Math.abs(lg) < 8 && Math.abs(lg) > g.lat) { g.lat = Math.abs(lg); }
  if (lo !== null && Math.abs(lo) < 8) { if (-lo > g.brk) { g.brk = -lo; } if (lo > g.acc) { g.acc = lo; } }
  if (yw !== null && Math.abs(yw) > g.yaw) { g.yaw = Math.abs(yw); }
  return g;
}
// Slip statistics for the strip under the grip cards: peak slip angle and time sliding this lap, the last corner's balance, corner counts.
function tms_slipStats(root) {
  var F = tms_frame(), now = F.now, s, lap = tms_n(tms_gd('CompletedLaps')), c = tms_phys(), dt, bd, band, st, deg;
  root = tms_gr(root); s = root.ss;
  if (!s) { s = root.ss = { t: 0, f: -1, lap: lap, peak: 0, slide: 0, us: 0, os: 0, n: 0, cor: false, last: null }; }
  if (s.f === F.f) { return s; }
  dt = s.t ? (now - s.t) / 1000 : 0; s.t = now; s.f = F.f;
  if (lap !== s.lap) { s.lap = lap; s.peak = 0; s.slide = 0; s.us = 0; s.os = 0; s.n = 0; }
  bd = tms_betaRad(root); band = bd === null ? null : SHP.slipBand(bd, c);
  if (bd !== null) { deg = Math.abs(bd) * 180 / Math.PI; if (deg < 60 && deg > s.peak) { s.peak = deg; } }
  if ((band === 'amber' || band === 'red') && dt > 0 && dt < 0.5) { s.slide += dt; }
  tms_balance(root); st = root.bl && root.bl.bal;
  if (st) {
    if (s.cor && !st.cornering) { s.last = tms_verdict(st, c); s[s.last.k]++; }       // a corner just ended
    s.cor = st.cornering;
  }
  return s;
}
// How a corner that just ended is called: understeer or oversteer by the larger smoothed peak of front-minus-rear slip, else neutral.
function tms_verdict(st, c) {
  if (st.lastU > c.balanceNeutralDeg && st.lastU >= st.lastO) { return { k: 'us', d: st.lastU }; }
  return st.lastO > c.balanceNeutralDeg ? { k: 'os', d: st.lastO } : { k: 'n', d: 0 };
}
// the lap in progress, as the header shows it: CurrentLap, else completed laps + 1
function tms_curLap() { var l = tms_n(tms_gd('CurrentLap')), n; if (l !== null && l > 0) { return l; } n = tms_n(tms_gd('CompletedLaps')); return n === null ? null : n + 1; }
// Peaks in the corner log are the third highest sample, so a one- or two-sample spike (a kerb strike, a glitch in the slip estimate) cannot set them.
function tms_top3(a, v) { a.push(v); a.sort(function (x, y) { return y - x; }); if (a.length > 3) { a.length = 3; } }
function tms_third(a) { return a.length === 0 ? null : a[a.length - 1]; }
// Corner log: while cornering (the balance meter's test, 30 km/h and 0.3 g) it tracks the slowest speed, peak lateral g, peak steering angle and peak body slip;
// a corner that lasted at least a second is filed when it ends, with the same verdict the "last corner" card gives. Keeps the last eight.
function tms_corners(root) {
  var F = tms_frame(), now = F.now, s, c = tms_phys(), dt, sp, lg, sf, bd, st, cur, deg, v, ph;
  root = tms_gr(root); s = root.cn;
  if (!s) { s = root.cn = { t: 0, f: -1, lap: null, n: 0, cor: false, cur: null, list: [], v: 0, sv: -1, trB: -1 }; }
  if (s.f === F.f) { return s; }
  dt = s.t ? (now - s.t) / 1000 : 0; s.t = now; s.f = F.f;
  sp = tms_n(tms_gd('SpeedKmh')); lg = tms_ph('AccG', 0); sf = tms_steerFrac(); bd = tms_betaRad(root);
  tms_balance(root); st = root.bl && root.bl.bal;
  if (!st || sp === null || lg === null) { return s; }
  if (st.cornering) {
    if (!s.cor || !s.cur) { s.cur = { lap: tms_curLap(), v: sp, gt: [], st: 0, bt: [], dur: 0 }; }
    cur = s.cur;
    if (sp < cur.v) { cur.v = sp; }
    ph = tms_phase(root); ph = (ph === 'BRAKING' || ph === 'TRAIL') ? 0 : ((ph === 'COAST' || ph === 'ROTATION') ? 1 : (ph === 'POWER' ? 2 : -1));
    if (ph >= 0 && st.v !== null) { if (!cur.pp) { cur.pp = [null, null, null]; } if (cur.pp[ph] === null || Math.abs(st.v) > Math.abs(cur.pp[ph])) { cur.pp[ph] = st.v; } }       // 1.4: the biggest balance (degrees, + = understeer) of each phase of the corner
    if (Math.abs(lg) < 8) { tms_top3(cur.gt, Math.abs(lg)); }
    if (sf !== null) { deg = Math.abs(sf) * TMS_CFG.steerLockDeg; if (deg > cur.st) { cur.st = deg; } }
    if (bd !== null) { deg = Math.abs(bd) * 180 / Math.PI; if (deg < 60) { tms_top3(cur.bt, deg); } }
    if (dt > 0 && dt < 0.5) { cur.dur += dt; }
  } else if (s.cor && s.cur) {
    cur = s.cur; s.cur = null;
    if (cur.dur >= 1) {
      cur.g = tms_third(cur.gt); if (cur.g === null) { cur.g = 0; }
      cur.b = tms_third(cur.bt);
      cur.p = [0, 1, 2].map(function (q) { var d = cur.pp && cur.pp[q] !== null ? cur.pp[q] : null; return d === null ? null : { k: d > c.balanceNeutralDeg ? 'US' : (d < -c.balanceNeutralDeg ? 'OS' : 'N'), d: Math.abs(d) }; });       // 1.4: verdict and size per phase, null where the corner had no such phase
      v = tms_verdict(st, c);
      if (cur.lap !== s.lap) { s.lap = cur.lap; s.n = 0; }
      s.n++; cur.n = s.n; cur.k = v.k; cur.d = v.d;
      s.list.push(cur); if (s.list.length > 8) { s.list.shift(); }
      s.v++;
    }
  }
  s.cor = st.cornering;
  return s;
}
// corner row i, newest first (null when there is none)
function tms_cnrow(root, i) { var l = tms_corners(root).list; return l[l.length - 1 - i] || null; }
// v2: the corner log only changes when a corner is filed (s.v), so its strings are built once per filed corner, not once per row per frame
function tms_cnTxt(root) {
  var s = tms_corners(root), l = s.list, k, v, out, col;
  if (s.sv !== s.v) {
    out = []; col = [];
    for (k = 0; k < 8; k++) {
      v = l[l.length - 1 - k] || null;
      if (v === null) { out.push(k === 0 ? 'no corner yet (30 km/h and 0.3 g)' : ''); col.push(TMS_COL.dim); continue; }
      out.push(tms_pad('L' + (v.lap === null ? '-' : v.lap), 3) + ' C' + (v.n < 10 ? '0' : '') + v.n + ' ' + tms_pad(Math.round(v.v), 3) + ' ' + v.g.toFixed(2) + ' ' + tms_pad(Math.round(v.st), 3) + '\u00b0 ' + (v.b === null ? tms_pad('--', 5) : tms_pad(v.b.toFixed(1), 4) + '\u00b0') + ' ' + (v.k === 'us' ? 'US ' + v.d.toFixed(1) + '\u00b0' : (v.k === 'os' ? 'OS ' + v.d.toFixed(1) + '\u00b0' : 'NEUTRAL')));
      col.push(v.k === 'us' ? TMS_COL.warn : (v.k === 'os' ? TMS_COL.bad : TMS_COL.ok));
    }
    s.sv = s.v; s.cnS = out; s.cnC = col;
  }
  return s;
}
// average balance over the logged corners: + understeer, - oversteer
function tms_cnTrend(root) {
  var s = tms_corners(root), l = s.list, sum = 0, k;
  if (s.trB === s.v) { return s.tr; }
  s.trB = s.v;
  if (l.length < 3) { s.tr = null; return null; }
  for (k = 0; k < l.length; k++) { sum += l[k].k === 'us' ? l[k].d : (l[k].k === 'os' ? -l[k].d : 0); }
  s.tr = { m: sum / l.length, n: l.length };
  return s.tr;
}
// the most recent finished time of sector i (this lap's, else last lap's), for the delta against its best
function tms_secLast(root, i) { var v = tms_secVal(root, i); return (v === null || v.k === 'run') ? null : v.t; }
// theoretical best lap: the sum of the best sector times
function tms_theo(root) { var a = tms_secBest(root, 0), b = tms_secBest(root, 1), c = tms_secBest(root, 2); return (a === null || b === null || c === null) ? null : a + b + c; }
// average and spread (standard deviation) of the last five laps within 107% of the fastest of them (an out-lap or an off does not count)
function tms_lapSpread() {
  var t = [], k, h, m = 1e9, sum = 0, ss = 0, n, a, d;
  for (k = 0; k < 5; k++) { h = tms_hist(k); if (h !== null) { t.push(h.t); if (h.t < m) { m = h.t; } } }
  t = t.filter(function (x) { return x <= m * 1.07; }); n = t.length;
  if (n < 2) { return null; }
  for (k = 0; k < n; k++) { sum += t[k]; } a = sum / n;
  for (k = 0; k < n; k++) { d = t[k] - a; ss += d * d; }
  return { avg: a, sd: Math.sqrt(ss / n), n: n };
}
function tmsr(key, root, i, minSpan, which) {
  var now = tms_frame().now, v, k, lo = 1e9, hi = -1e9, sp, c, g = tms_gr(root), id = key + i, R;
  if (!g.rg) { g.rg = {}; }
  R = g.rg[id];
  if (!R) { R = g.rg[id] = { b: [], t: 0, ms: minSpan, lo: 0, hi: minSpan, dirty: false }; }       // v2: lo/hi twins share one ring per tyre
  if (now - R.t >= 100) { R.t = now; v = tms(key, g, i); if (v !== null && v !== undefined) { R.b.push(v); if (R.b.length > 200) { R.b.shift(); } R.dirty = true; } }
  if (R.dirty || R.ms !== minSpan) {
    for (k = 0; k < R.b.length; k++) { if (R.b[k] < lo) { lo = R.b[k]; } if (R.b[k] > hi) { hi = R.b[k]; } }
    if (lo > hi) { R.lo = 0; R.hi = minSpan; }
    else { sp = Math.max(minSpan, (hi - lo) * 1.25); c = (hi + lo) / 2; R.lo = c - sp / 2; R.hi = c + sp / 2; }
    R.dirty = false; R.ms = minSpan;
  }
  return which === 'lo' ? R.lo : R.hi;
}

// v2 pump: steps every shared accumulator once for this frame. It rides on a formula that stays at frame rate anyway (the beta arrow), so the
// detectors and smoothers keep their per-frame step even when the rows that only read them are throttled to 100-500 ms.
// 1.2: per-lap braking totals and disc peaks, kept in the shared state and stepped once per frame (and by the pump), so they keep counting while another page is shown.
// They reset at the lap line. dt is the time between frames (the formulas used to measure it between their own, throttled, calls).
function tms_brkStats(root) {
  var F = tms_frame(), s, dt, th, br, st, lg, l, x;
  root = tms_gr(root); s = root.bk;
  if (!s) { s = root.bk = { f: -1, t: 0, lapId: undefined, ov: 0, ah: 0, pa: false, pb: 0, tt: 0, pd: 0 }; }
  if (s.f === F.f) { return s; }
  s.f = F.f;
  dt = s.t ? (F.now - s.t) / 1000 : 0.016; if (!(dt > 0)) { dt = 0.016; } if (dt > 0.25) { dt = 0.016; } s.t = F.now;
  l = tms_n(tms_gd('CompletedLaps')); if (s.lapId !== l) { s.lapId = l; s.ov = 0; s.ah = 0; s.pa = false; s.pb = 0; s.tt = 0; s.pd = 0; }
  th = tms_pedal(tms_gd('Throttle')); br = tms_pedal(tms_gd('Brake')); st = tms_steerFrac(); lg = tms_ph('AccG', 2);
  if (th !== null && br !== null && th > 0.1 && br > 0.1) { s.ov += dt; }
  x = !!tms_gd('ABSActive'); if (x && !s.pa) { s.ah++; } s.pa = x;
  if (br !== null && br > s.pb) { s.pb = br; }
  if (br !== null && st !== null && br >= 0.12 && Math.abs(st) >= 0.22) { s.tt += dt; }
  if (lg !== null && -lg > s.pd && -lg < 8) { s.pd = -lg; }
  return s;
}
function tms_discPk(root) {
  var F = tms_frame(), s, k, v, l;
  root = tms_gr(root); s = root.dk;
  if (!s) { s = root.dk = { f: -1, lap: undefined, pk: [0, 0, 0, 0], mn: [null, null, null, null] }; }
  if (s.f === F.f) { return s; }
  s.f = F.f;
  l = tms_n(tms_gd('CompletedLaps')); if (s.lap !== l) { s.lap = l; s.pk = [0, 0, 0, 0]; s.mn = [null, null, null, null]; }
  for (k = 0; k < 4; k++) { v = tms_temp(tms_ph('BrakeTemp', k)); if (v !== null) { if (v > s.pk[k]) { s.pk[k] = v; } if (s.mn[k] === null || v < s.mn[k]) { s.mn[k] = v; } } }
  return s;
}
// ---- 1.4: the side panel (docs/notes/DESIGN_1_4.md): balance with a gate, flag lane, alert pop-up, latched events, loads and suspension travel ---------------------------------
// Defaults to tune, none measured on a real car. Temperatures in degrees C (tms_temp converts), times in milliseconds, slip in degrees. Sun leaves white and yellow at the same brightness,
// so nothing here is a state by colour alone: plates (an inverted block), glyphs, positions and on / off flashing carry it.
var TMS_GL = { alertMs: 250, flashMs: 125, critMs: 170, spinDeg: 20, alertFlashFor: 3000, hint: 3000, biasMs: 2000, slideDeg: 6, slideMin: 200,
  oilHot: 130, oilClear: 125, oilHold: 3000, waterHot: 105, waterClear: 100, waterHold: 3000, brakeHot: 750, brakeClear: 650, brakeHold: 2000,
  tyreHot: 105, tyreClear: 100, tyreHold: 1500, pressHigh: 0.7, pressClear: 0.5, pressHold: 3000, fuelLaps: 2,
  gateKmh: 20, headK: 3, neutralDeg: 0.7, neutralClear: 0.5, bump: 0.95, bumpClear: 0.9, bumpHold: 3000, tcHeld: 1000, spreadLaps: 2, lockShow: 3000, eventShow: 5000 };
var TMS_FLAGS = ['YELLOW', 'BLUE', 'BLACK', 'RED', 'CHECK', 'WHITE', 'GREEN'];
var TMS_FLAGWORD = { YELLOW: 'YELLOW', BLUE: 'BLUE: LET PASS', BLACK: 'BLACK FLAG: PIT', RED: 'RED: STOP', CHECK: 'CHEQUERED', WHITE: 'WHITE: SLOW CAR', GREEN: 'GREEN' };
var TMS_FLAGCHIP = { YELLOW: '▲ YELLOW', BLUE: '» BLUE', BLACK: '■ BLACK', RED: 'X RED', CHECK: 'CHEQUERED', WHITE: '○ WHITE', GREEN: '● GREEN' };
var TMS_WHEEL = ['FL', 'FR', 'RL', 'RR'], TMS_INK = '#FF08080A', TMS_WHITE = '#FFF6F6F1', TMS_YELLOW = '#FFF3FF3D', TMS_RUN = true;
// a limit that must be exceeded for holdMs before it counts and falls back only below the lower limit
function tms_hot(s, id, val, hi, lo, holdMs, now) {
  var h = s.hot[id];
  if (!h) { h = s.hot[id] = { t0: -1, on: false }; }
  if (val !== null && (val > hi || (h.on && val > lo))) { if (h.t0 < 0) { h.t0 = now; } if (now - h.t0 >= holdMs) { h.on = true; } } else { h.t0 = -1; h.on = false; }
  return h.on;
}
// the flag as one of YELLOW BLUE BLACK RED CHECK WHITE GREEN, '' for a flag this dash does not know ('CHECKERED' contains 'RED': it is tested first)
function tms_flagKind() {
  var v = tms_gd('Flag_Name');
  if (v === null || v === undefined || v === '') { return 'GREEN'; }
  v = String(v).toUpperCase();
  if (v.indexOf('BLACK') >= 0) { return 'BLACK'; }
  if (v.indexOf('CHE') >= 0) { return 'CHECK'; }
  if (v.indexOf('RED') >= 0) { return 'RED'; }
  if (v.indexOf('YELLOW') >= 0) { return 'YELLOW'; }
  if (v.indexOf('BLUE') >= 0) { return 'BLUE'; }
  if (v.indexOf('WHITE') >= 0) { return 'WHITE'; }
  return v.indexOf('GREEN') >= 0 ? 'GREEN' : '';
}
function tms_evPush(s, e) { s.ev.unshift(e); if (s.ev.length > 8) { s.ev.length = 8; } }
// the corner in progress or coming up, as the corner log counts them (restarts every lap)
function tms_cornerNo(root) { var c = tms_corners(root); return (c.lap === tms_curLap() ? c.n : 0) + 1; }
// shared panel state, stepped once per frame and by the pump so it keeps running on the page that is not shown: lock-ups, slides, TC held, the event list, the balance gate and verdict,
// the flag timers, the brake bias, per-tyre load peaks and averages, suspension travel with bottoming
function tms_glance(root) {
  var F = tms_frame(), s, g = TMS_GL, now, k, lk, bd, dg, sp, m, v, ld, x, bt, d, bl, tt, bb, a;
  root = tms_gr(root); s = root.gl;
  if (!s) {
    s = root.gl = { f: -1, hot: {}, aIds: '', aT: -1e9, lockT: -1e9, lockW: '', lockTs: [-1e9, -1e9, -1e9, -1e9], lockPrev: [false, false, false, false], ll: null,
      sl: { on: false, t0: 0, tL: -1e9, pk: 0 }, tc: { on: false, t0: 0, tL: 0 }, ev: [], bias: null, biasT: -1e9, fk: null, fT: 0, gT: -1e9, bg: false, sp: false, bv: null, bw: 'n', bd: null,
      lp: [], mx: [null, null, null, null], mn: [null, null, null, null], mxS: [null, null, null, null], mxN: 0, bt: [], btLap: undefined, ls: null };
    for (k = 0; k < 4; k++) { s.lp.push({ pk: 0, av: 0 }); s.bt.push({ n: 0, t: -1e9, pk: 0, hi: false }); }
  }
  if (s.f === F.f) { return s; }
  s.f = F.f; now = F.now;
  v = $prop('DataCorePlugin.GameRunning'); s.run = !(v === false || v === 0 || v === 'False' || v === 'false'); TMS_RUN = s.run;       // SimHub keeps the last values after the game closes: with the game not running, the pop-ups stay away (unknown counts as running)
  sp = tms_n(tms_gd('SpeedKmh'));
  v = tms_n(tms_gd('CompletedLaps')); if (v !== s.btLap) { s.btLap = v; for (k = 0; k < 4; k++) { s.bt[k].n = 0; s.bt[k].pk = 0; } }       // a new lap: the bottoming counts and the lap peak of travel restart
  lk = tms_step(root).lk;       // lock-ups: the wheel and speed of the last one, and a time stamp per wheel
  if (lk) { for (k = 0; k < 4; k++) { if (lk[k]) { s.lockTs[k] = now; if (!s.lockPrev[k]) { s.lockT = now; s.lockW = TMS_WHEEL[k]; d = { k: 'LOCK', w: TMS_WHEEL[k], v: sp === null ? 0 : Math.round(sp), cn: tms_cornerNo(root), t: now }; s.ll = d; tms_evPush(s, d); } } s.lockPrev[k] = !!lk[k]; } }
  bd = tms_betaRad(root); dg = bd === null ? 0 : Math.abs(bd) * 180 / Math.PI;       // a slide: the body slip angle over slideDeg for slideMin ms, with its peak; it goes into the event list when it ends
  if (dg >= g.slideDeg) { if (!s.sl.on) { s.sl.on = true; s.sl.t0 = now; s.sl.pk = 0; } s.sl.tL = now; if (dg > s.sl.pk) { s.sl.pk = dg; } }
  else if (s.sl.on) { s.sl.on = false; if (s.sl.tL - s.sl.t0 >= g.slideMin) { s.ls = { k: 'SLIDE', m: s.sl.pk, cn: tms_cornerNo(root), t: now }; tms_evPush(s, s.ls); } }
  tt = !!tms_gd('TCActive');       // traction control held on for more than tcHeld ms goes into the event list when it lets go
  if (tt) { if (!s.tc.on) { s.tc.on = true; s.tc.t0 = now; } s.tc.tL = now; }
  else if (s.tc.on) { s.tc.on = false; if (s.tc.tL - s.tc.t0 >= g.tcHeld) { tms_evPush(s, { k: 'TC', m: (s.tc.tL - s.tc.t0) / 1000, cn: tms_cornerNo(root), t: now }); } }
  for (k = 0; k < 4; k++) {
    m = tms_ph('SuspensionTravel', k);       // metres; the full stroke is the game's own figure where it gives one (ACC); AC gives none, so there the range seen so far (min and max) stands in for it
    if (s.mxS[k] === null && s.mxN % 300 === 0) { v = tms_n($prop('DataCorePlugin.GameRawData.StaticInfo.SuspensionMaxTravel0' + (k + 1))); if (v !== null && v > 0.01) { s.mxS[k] = v; } }
    if (m !== null) {
      if (s.mxS[k] === null) { if (s.mn[k] === null || m < s.mn[k]) { s.mn[k] = m; } if (s.mx[k] === null || m > s.mx[k]) { s.mx[k] = m; } }
      v = tms_travelOf(s, k, m); bt = s.bt[k];
      if (v > bt.pk) { bt.pk = v; }
      // bottoming is only counted against a real full stroke: a range learned from driving would call the first bump at the top of its range a bottoming
      if (s.mxS[k] !== null && v >= g.bump && !bt.hi) { bt.hi = true; bt.n++; bt.t = now; tms_evPush(s, { k: 'BOTTOM', w: TMS_WHEEL[k], v: sp === null ? 0 : Math.round(sp), cn: tms_cornerNo(root), t: now }); }
      else if (v < g.bumpClear) { bt.hi = false; }
    }
    ld = tms_ph('WheelLoad', k);       // load: a peak that rises gradually and fades slowly, and a slow average, so a bar shows weight transfer against what that tyre has carried
    if (ld !== null && ld > 0) { x = s.lp[k]; if (ld > x.pk) { x.pk += (ld - x.pk) * 0.2; } else { x.pk *= 0.99995; } x.av += (ld - x.av) * 0.0005; }
  }
  s.mxN++;
  if (sp !== null) { s.bg = s.bg ? !(sp < g.gateKmh - 5) : sp >= g.gateKmh; } else { s.bg = false; }       // the balance is live from gateKmh up (below that the slip angles are noise); it no longer waits for a corner
  s.sp = dg >= g.spinDeg;       // a spin (20 degrees of body slip or more): front and rear slip say nothing about understeer, so the verdict says SPIN and the cells go out
  // the live balance: front minus rear mean |slip angle| in degrees, smoothed; unlike the corner log's balance (SHP.balance, which only measures in a corner) it reads whenever the speed gate is open
  a = [tms_slipOf(0), tms_slipOf(1), tms_slipOf(2), tms_slipOf(3)];
  if (s.bg && a[0] !== null && a[1] !== null && a[2] !== null && a[3] !== null) {
    bl = ((Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(a[2]) + Math.abs(a[3]))) / 2 * 180 / Math.PI;
    s.bv = s.bv === null ? bl : s.bv + tms_phys().balanceAlpha * (bl - s.bv); d = s.bv; s.bd = d;
  } else { s.bv = null; d = 0; s.bd = null; }
  if (s.bw === 'n') { if (d > g.neutralDeg) { s.bw = 'u'; } else if (d < -g.neutralDeg) { s.bw = 'o'; } }
  else if (s.bw === 'u') { if (d < -g.neutralDeg) { s.bw = 'o'; } else if (d < g.neutralClear) { s.bw = 'n'; } }
  else { if (d > g.neutralDeg) { s.bw = 'u'; } else if (d > -g.neutralClear) { s.bw = 'n'; } }
  v = tms_flagKind();       // flag timers: when the flag changed, and when a yellow or red went green
  if (v !== s.fk) { if (v === 'GREEN' && (s.fk === 'YELLOW' || s.fk === 'RED')) { s.gT = now; } s.fk = v; s.fT = now; }
  bb = tms_n(tms_gd('BrakeBias')); if (bb !== null) { if (s.bias !== null && Math.abs(bb - s.bias) >= 0.05) { s.biasT = now; } s.bias = bb; }
  return s;
}
// what the flag lane shows now: k = the flag, m = 'block' (the 780x100 block in lane B), 'chip' (the small chip), 'red' (the full-width red lane) or 'none'; on = the visible phase of a flashing block; edge = 2 the big edge bar, 1 the strip
function tms_flagLane(root) {
  var s = tms_glance(root), now = new Date().getTime(), k = s.fk, age = now - s.fT, r = { k: k, m: 'none', on: true, edge: 0 };
  if (!s.run) { r.on = false; return r; }
  if (k === 'RED') { r.m = 'red'; r.on = age < 6000 ? tms_blink(TMS_GL.alertMs) : false; return r; }
  if (k === 'BLACK') { r.m = 'block'; if (age < 6000) { r.on = tms_blink(TMS_GL.alertMs); r.edge = r.on ? 2 : 0; } else { r.edge = 1; } return r; }
  if (k === 'YELLOW') { if (age < 4000) { r.m = 'block'; r.on = age >= 600 || (age % 300) >= 150; return r; } r.m = (age >= 10000 && age % 10000 < 2000) ? 'block' : 'chip'; return r; }
  if (k === 'BLUE') { r.m = age < 4000 ? 'block' : 'chip'; return r; }
  if (k === 'CHECK') { r.m = age < 6000 ? 'block' : 'none'; return r; }
  if (k === 'WHITE') { r.m = age < 3000 ? 'block' : 'none'; return r; }
  if (k === 'GREEN') { r.m = now - s.gT < 1500 ? 'block' : 'none'; return r; }
  return r;
}
// the one alert word to show now. Momentary events first (a lock-up, then a slide, then a brake-bias change); otherwise the persistent ones, one at a time, rotating every 2 s when there are several:
// oil, water, fuel for two laps or less when it cannot finish, brakes, a hot tyre, a high hot pressure. Each limit has its own timer and falls back only well below it. The word carries its value.
function tms_alert(root) {
  var g = TMS_GL, s = tms_glance(root), now = new Date().getTime(), k, v, x, l, b, vb = null, ids = [], words = [], hot, tg;
  v = tms_temp(tms_gd('OilTemperature')); if (tms_hot(s, 'oil', v, g.oilHot, g.oilClear, g.oilHold, now)) { ids.push('oil'); words.push('OIL ' + Math.round(v)); }
  v = tms_temp(tms_gd('WaterTemperature')); if (tms_hot(s, 'water', v, g.waterHot, g.waterClear, g.waterHold, now)) { ids.push('water'); words.push('WATER ' + Math.round(v)); }
  l = tms_lapsLeft(root); b = tms_lapsToGo(); if (l !== null && l > 0 && l <= g.fuelLaps && (b === null || l < b.n)) { ids.push('fuel'); words.push('FUEL ' + l.toFixed(1) + ' LAPS'); }
  for (k = 0; k < 4; k++) { x = tms_temp(tms_ph('BrakeTemp', k)); if (x !== null && (vb === null || x > vb)) { vb = x; } }
  if (tms_hot(s, 'brake', vb, g.brakeHot, g.brakeClear, g.brakeHold, now)) { ids.push('brake'); words.push('BRAKES ' + Math.round(vb)); }
  for (k = 0; k < 4; k++) {
    x = tms_temp(tms_ph('TyreCoreTemperature', k)); hot = tms_hot(s, 'ty' + k, x, g.tyreHot, g.tyreClear, g.tyreHold, now); if (hot) { ids.push('ty' + k); words.push('TYRE HOT ' + TMS_WHEEL[k]); }
    x = tms_n(tms_gd('TyrePressure' + TMS_POSN[k])); x = x === null ? null : x - TMS_CFG.targetPsi; hot = tms_hot(s, 'pr' + k, x, g.pressHigh, g.pressClear, g.pressHold, now); if (hot) { ids.push('pr' + k); words.push('PRESS HIGH ' + TMS_WHEEL[k]); }
  }
  tg = ids.join(',');
  if (now - s.lockT < g.hint) { return 'LOCK-UP ' + s.lockW; }
  if (s.sl.tL - s.sl.t0 >= g.slideMin && now - s.sl.tL < g.hint) { return 'SLIDE ' + Math.round(s.sl.pk) + '°'; }
  if (s.bias !== null && now - s.biasT < g.biasMs) { return 'BIAS ' + s.bias.toFixed(1); }
  if (tg !== s.aIds) { s.aIds = tg; s.aT = now; }       // the set of persistent alerts changed: a new alert flashes
  return words.length === 0 ? '' : words[Math.floor(now / 2000) % words.length];
}
// shown: a persistent alert flashes at 2 Hz for the first alertFlashFor ms after the set of alerts changed, then stays; a lock-up, a slide or a bias change is a steady hint; a red flag hides it
function tms_alertVis(root) {
  var w = tms_alert(root), s = tms_glance(root), now = new Date().getTime();
  if (w === '' || s.fk === 'RED' || !s.run) { return false; }
  return (w.indexOf('LOCK-UP') === 0 || w.indexOf('SLIDE') === 0 || w.indexOf('BIAS') === 0 || now - s.aT >= TMS_GL.alertFlashFor) ? true : tms_blink(TMS_GL.alertMs);
}
// travel as a share of the stroke: of the game's full stroke where there is one, else of the range seen so far (at least 20 mm wide, so the first samples do not read as full)
function tms_travelOf(s, k, m) {
  var sp;
  if (s.mxS[k] !== null) { return tms_cl(m / s.mxS[k], 0, 1); }
  if (s.mn[k] === null) { return 0; }
  sp = s.mx[k] - s.mn[k]; if (sp < 0.02) { sp = 0.02; }
  return tms_cl((m - s.mn[k]) / sp, 0, 1);
}
function tms_travelFrac(root, i) { var s = tms_glance(root), m = tms_ph('SuspensionTravel', i); return m === null ? null : tms_travelOf(s, i, m); }
function tms_lastCorner(root) { var l = tms_corners(root).list; return l.length ? l[l.length - 1] : null; }
// tyre temperatures: core, and the spread middle minus the mean of inner and outer (needs two laps of data)
function tms_treadT(i, z) { return tms_temp(tms_gd('TyreTemperature' + TMS_POSN[i] + z)); }
function tms_spread(i) {
  var n = tms_n(tms_gd('CompletedLaps')), a = tms_treadT(i, 'Inner'), m = tms_treadT(i, 'Middle'), o = tms_treadT(i, 'Outer');
  return (n === null || n < TMS_GL.spreadLaps || a === null || m === null || o === null) ? null : m - (a + o) / 2;
}
// ---------- the colour layer of the side panel ----------
// Colour is the second cue: in bright sun everything but white and yellow loses most of its contrast (and those two have the same brightness), so a state is also a plate, a glyph or a flash.
// Every coloured or plated element asks tms_st(kind, root, i) for { l, c }: l = 0 no plate, 1 a steady plate, 2 a flashing plate (critMs); c = the colour of the state: the plate's, a bar's, or the text's when there is no plate.
// The dash reaches it with three keys per kind: st_<kind>_vis (is the plate shown now), st_<kind>_col (the colour) and st_<kind>_ink (dark on the plate, the state colour otherwise).
var TMS_SC = { ok: '#FF3DF08F', warn: '#FFFFA31F', bad: '#FFFF4D5E', cold: '#FF5DB3FF', viol: '#FFB66DFF', pink: '#FFFF7EDC', cyan: '#FF3DDCFF', mint: '#FF7DFFC4', sand: '#FFFFD27A', steer: '#FF8FD3FF', blue: '#FF4F9BFF' };
var TMS_TYC = [TMS_SC.cyan, TMS_SC.mint, TMS_SC.pink, TMS_SC.sand];
var TMS_CELLC = [TMS_SC.bad, TMS_SC.bad, TMS_SC.warn, TMS_SC.warn, TMS_SC.ok, TMS_SC.cold, TMS_SC.cold, TMS_SC.viol, TMS_SC.viol];
var TMS_FLAGCOL = { YELLOW: TMS_YELLOW, BLUE: TMS_SC.blue, BLACK: TMS_WHITE, RED: TMS_SC.bad, CHECK: TMS_WHITE, WHITE: TMS_WHITE, GREEN: TMS_SC.ok };
function tms_stTemp(v, a, b, c) { return v < a ? TMS_SC.cold : (v <= b ? TMS_SC.ok : (v <= c ? TMS_SC.warn : TMS_SC.bad)); }
function tms_st(kind, root, i) {
  var s, v, d, e, a, c, p, w, now = new Date().getTime(), C = TMS_SC, N = { l: 0, c: TMS_WHITE }, g = TMS_GL;
  switch (kind) {
    case 'slip': v = tms_slipOf(i); if (v === null) { return { l: 0, c: TMS_TYC[i] }; } d = Math.abs(v) * 180 / Math.PI; return d >= 8 ? { l: 2, c: C.bad } : (d >= 6 ? { l: 1, c: C.warn } : { l: 0, c: d >= 3 ? C.warn : TMS_TYC[i] });
    case 'core': v = tms_temp(tms_ph('TyreCoreTemperature', i)); if (v === null) { return N; } return v > 105 ? { l: 2, c: C.bad } : (v > 95 ? { l: 0, c: C.warn } : (v >= 80 ? { l: 0, c: C.ok } : { l: v < 70 ? 1 : 0, c: C.cold }));
    case 'press': v = tms_n(tms_gd('TyrePressure' + TMS_POSN[i])); if (v === null) { return N; } d = v - TMS_CFG.targetPsi; return d > 1.2 ? { l: 2, c: C.bad } : (d > 0.7 ? { l: 1, c: C.warn } : (d < -0.7 ? { l: 1, c: C.cold } : { l: 0, c: Math.abs(d) > 0.3 ? C.warn : C.ok }));
    case 'tri': v = tms_treadT(i, 'Inner'); return v === null ? N : { l: 0, c: tms_stTemp(v, 80, 100, 110) };
    case 'trm': v = tms_treadT(i, 'Middle'); return v === null ? N : { l: 0, c: tms_stTemp(v, 80, 100, 110) };
    case 'tro': v = tms_treadT(i, 'Outer'); return v === null ? N : { l: 0, c: tms_stTemp(v, 80, 100, 110) };
    case 'spread': v = tms_spread(i); if (v === null) { return N; } return Math.abs(v) > 3 ? { l: 1, c: v > 0 ? C.warn : C.cold } : { l: 0, c: C.ok };
    case 'disc': v = tms_temp(tms_ph('BrakeTemp', i)); if (v === null) { return N; } return v > 750 ? { l: 2, c: C.bad } : { l: 0, c: v > 650 ? C.warn : (v >= 300 ? C.ok : C.cold) };
    case 'dmin': v = tms_discPk(root).mn[i]; return (v !== null && v < 250) ? { l: 1, c: C.cold } : N;
    case 'bump': e = tms_glance(root).bt[i]; return now - e.t < g.bumpHold ? { l: 2, c: C.bad } : (e.n > 0 ? { l: 0, c: C.bad } : N);
    case 'tile': s = tms_glance(root); return now - s.lockTs[i] < g.lockShow ? { l: 2, c: C.bad } : (tms_lkTxt(tms_step(root)).lkN[i] > 0 ? { l: 1, c: C.bad } : N);
    case 'last': s = tms_glance(root); return (!!s.ll && now - s.ll.t < g.lockShow) ? { l: 2, c: C.bad } : N;
    case 'lsl': s = tms_glance(root); return s.ls ? { l: now - s.ls.t < g.lockShow ? 2 : 0, c: C.warn } : N;
    case 'ev': e = tms_glance(root).ev[i]; if (!e) { return N; } c = e.k === 'LOCK' ? C.bad : (e.k === 'SLIDE' ? C.warn : (e.k === 'BOTTOM' ? C.viol : C.cold)); d = now - e.t; return { l: (i === 0 && d < 2000) ? 2 : ((i === 0 && d < g.eventShow) ? 1 : 0), c: c };
    case 'bz': a = tms_zrows(tms_step(root)); e = a[i]; if (!e) { return N; } return e.z.lock ? { l: 1, c: C.bad } : (e.z.abs >= 3 ? { l: 1, c: C.warn } : N);
    case 'bal': s = tms_glance(root); if (!(s.bg && s.bd !== null)) { return N; } if (s.sp) { return { l: 2, c: C.bad }; } if (s.bw === 'n') { return { l: 0, c: C.ok }; } return { l: Math.abs(s.bd) >= 2 ? 2 : 1, c: s.bw === 'u' ? C.cold : C.bad };
    case 'band': v = tms_band(root); return v === 'red' ? { l: 2, c: C.bad } : (v === 'amber' ? { l: 0, c: C.warn } : (v === 'green' ? { l: 0, c: C.ok } : N));
    case 'cn': c = tms_lastCorner(root); p = c && c.p ? c.p[i] : null; if (!p) { return N; } return p.k === 'N' ? { l: 0, c: C.ok } : { l: 1, c: p.k === 'US' ? C.cold : C.bad };
    case 'cell': s = tms_glance(root); return { l: 1, c: TMS_CELLC[(s.bg && s.bd !== null && !s.sp) ? 4 + Math.round(tms_cl(s.bd, -4, 4)) : 4] };
    case 'alert': w = tms_alert(root); return { l: 0, c: (w.indexOf('BIAS') === 0) ? C.cold : ((w.indexOf('FUEL') === 0 || w.indexOf('PRESS') === 0) ? C.warn : C.bad) };
    case 'flag': return { l: 0, c: TMS_FLAGCOL[tms_flagLane(root).k] || TMS_WHITE };
    case 'trav': s = tms_glance(root); v = tms_travelFrac(root, i); if (v === null || s.mxS[i] === null) { return { l: 0, c: C.viol }; } return { l: 0, c: v >= g.bump ? C.bad : (v >= g.bumpClear ? C.warn : C.viol) };
  }
  return N;
}
function tms_stVis(r) { return r.l >= 2 ? tms_blink(TMS_GL.critMs) : r.l === 1; }
// st_<kind>_<vis|col|ink>
function tms_col(key, root, i) {
  var p = key.split('_'), r = tms_st(p[1], root, i);
  if (p[2] === 'col') { return r.c; }
  if (p[2] === 'vis') { return tms_stVis(r); }
  return tms_stVis(r) ? TMS_INK : r.c;
}
// the keys of the side panel; a formula calls tms2('key', root, i) like every other
function tms_side(key, root, i) {
  var s, r, v, x, a, b, l, c, now = new Date().getTime(), W = TMS_WHEEL, n, d, e, t, p;
  switch (key) {
    case 'alertWord': return tms_alert(root);
    case 'alertVis': return tms_alertVis(root);
    case 'flagBlockVis': r = tms_flagLane(root); return r.m === 'block' && r.on;
    case 'flagChipVis': return tms_flagLane(root).m === 'chip';
    case 'flagWord': r = tms_flagLane(root); return r.m === 'none' ? '' : (TMS_FLAGWORD[r.k] || '');
    case 'flagChipWord': r = tms_flagLane(root); return r.m === 'none' ? '' : (TMS_FLAGCHIP[r.k] || '');
    case 'flagShape': r = tms_flagLane(root); return r.m === 'block' && r.on && r.k === TMS_FLAGS[i];
    case 'redPlateVis': r = tms_flagLane(root); return r.m === 'red' && r.on;
    case 'redOutVis': r = tms_flagLane(root); return r.m === 'red' && !r.on;
    case 'edgeBigVis': return tms_flagLane(root).edge === 2;
    case 'edgeStripVis': return tms_flagLane(root).edge === 1;
    case 'balGate': return tms_glance(root).bg;
    case 'balOn': s = tms_glance(root); return s.bg && s.bd !== null && !s.sp;
    case 'balCellVis': s = tms_glance(root); return s.bg && s.bd !== null && !s.sp && (Math.abs(s.bd) < 2 || tms_blink(TMS_GL.critMs));       // the solid cell flashes once the balance is 2 degrees or more out
    case 'balVerdict': s = tms_glance(root); if (!(s.bg && s.bd !== null)) { return '--'; } return s.sp ? 'SPIN' : (s.bw === 'u' ? 'UNDERSTEER' : (s.bw === 'o' ? 'OVERSTEER' : 'NEUTRAL'));
    case 'balDelta': s = tms_glance(root); return (s.bg && s.bd !== null && !s.sp) ? tms_sg(s.bd, 1) + '°' : '--';
    case 'balIdx': s = tms_glance(root); return (s.bg && s.bd !== null && !s.sp) ? 4 + Math.round(tms_cl(s.bd, -4, 4)) : 4;
    case 'balPhaseWord': s = tms_glance(root); if (!s.bg) { return ''; } v = tms_phase(root); return (v === 'BRAKING' || v === 'TRAIL') ? 'ENTRY' : ((v === 'COAST' || v === 'ROTATION') ? 'MID' : (v === 'POWER' ? 'EXIT' : ''));
    case 'balEst': return tms_game() === 'ac' ? 'EST' : '';
    case 'betaShow': b = tms_betaRad(root); return b === null ? '--' : (Math.abs(b) * 180 / Math.PI).toFixed(1) + '°';       // always: the angle between where the nose points and where the car is going
    case 'betaArrowR': b = tms_betaRad(root); return b !== null && b * 180 / Math.PI >= 2;       // beta > 0 is the nose left of travel, so the tail swings right
    case 'betaArrowL': b = tms_betaRad(root); return b !== null && b * 180 / Math.PI <= -2;
    case 'headRot': b = tms_betaRad(root); return b === null ? 0 : Math.round(tms_cl(b * 180 / Math.PI * TMS_GL.headK, -75, 75) * 10) / 10;       // the trajectory arrow's angle to the heading arrow: beta times headK (a few degrees would not show), clockwise
    case 'travelStatic': return tms_glance(root).mxS[0] !== null;       // the 90% line only means something against a real full stroke
    case 'bandGlyph': v = tms_band(root); return v === 'red' ? '▲' : (v === 'amber' ? '◐' : (v === 'green' ? '●' : ''));
    case 'bandName': v = tms_band(root); return v === 'red' ? 'SLIDE' : (v === 'amber' ? 'TRANSITION' : (v === 'green' ? 'GRIP' : '--'));
    case 'slipAbsText': v = tms_slipOf(i); return v === null ? '--' : (Math.abs(v) * 180 / Math.PI).toFixed(1) + '°';
    case 'slipPx': v = tms_slipOf(i); return v === null ? 0 : Math.round(tms_cl(Math.abs(v) * 180 / Math.PI, 0, 8) / 8 * 160);
    case 'cnNum': c = tms_lastCorner(root); return c ? 'T' + c.n : '--';
    case 'cnChip': c = tms_lastCorner(root); p = c && c.p ? c.p[i] : null; return ['ENTRY', 'MID', 'EXIT'][i] + ' ' + (p ? p.k + ' ' + p.d.toFixed(1) : '--');
    case 'loadFill': s = tms_glance(root); v = tms_ph('WheelLoad', i); return (v === null || s.lp[i].pk < 100) ? 0 : tms_cl(v / s.lp[i].pk, 0, 1);
    case 'loadAvgPos': s = tms_glance(root); return s.lp[i].pk < 100 ? 0 : tms_cl(s.lp[i].av / s.lp[i].pk, 0, 1);
    case 'loadSplitFR': x = [tms_ph('WheelLoad', 0), tms_ph('WheelLoad', 1), tms_ph('WheelLoad', 2), tms_ph('WheelLoad', 3)]; if (x[0] === null || x[1] === null || x[2] === null || x[3] === null) { return 'F -- · R --'; } v = x[0] + x[1] + x[2] + x[3]; if (v < 1) { return 'F -- · R --'; } return 'F ' + Math.round((x[0] + x[1]) / v * 100) + ' · R ' + Math.round((x[2] + x[3]) / v * 100);
    case 'loadSplitLR': x = [tms_ph('WheelLoad', 0), tms_ph('WheelLoad', 1), tms_ph('WheelLoad', 2), tms_ph('WheelLoad', 3)]; if (x[0] === null || x[1] === null || x[2] === null || x[3] === null) { return 'L -- · R --'; } v = x[0] + x[1] + x[2] + x[3]; if (v < 1) { return 'L -- · R --'; } return 'L ' + Math.round((x[0] + x[2]) / v * 100) + ' · R ' + Math.round((x[1] + x[3]) / v * 100);
    case 'steerUp': v = tms_steerFrac(); return v === null ? 0 : -v;       // right is up
    case 'tcSolid': return !!tms_gd('TCActive') && tms_blink(TMS_GL.flashMs);
    case 'tcInk': return (!!tms_gd('TCActive') && tms_blink(TMS_GL.flashMs)) ? TMS_INK : TMS_SC.warn;
    case 'absSolid': return !!tms_gd('ABSActive') && tms_blink(TMS_GL.flashMs);
    case 'absInk': return (!!tms_gd('ABSActive') && tms_blink(TMS_GL.flashMs)) ? TMS_INK : TMS_SC.cold;
    case 'coreNum': v = tms_temp(tms_ph('TyreCoreTemperature', i)); return v === null ? '--' : Math.round(v) + '°';
    case 'coreFrac': v = tms_temp(tms_ph('TyreCoreTemperature', i)); return v === null ? 0 : tms_cl((v - 60) / 60, 0, 1);
    case 'coreGlyph': v = tms_temp(tms_ph('TyreCoreTemperature', i)); return v === null ? '' : (v < 80 ? '▼' : (v <= 95 ? '●' : '▲'));
    case 'pressNum': v = tms_n(tms_gd('TyrePressure' + TMS_POSN[i])); return v === null ? '--' : tms_sg(v - TMS_CFG.targetPsi, 1);
    case 'pressGlyph': v = tms_n(tms_gd('TyrePressure' + TMS_POSN[i])); if (v === null) { return ''; } d = v - TMS_CFG.targetPsi; return d < -0.3 ? '▼' : (d > 0.3 ? '▲' : '●');
    case 'treadFI': v = tms_treadT(i, 'Inner'); return v === null ? 0 : tms_cl((v - 60) / 60, 0, 1);
    case 'treadFM': v = tms_treadT(i, 'Middle'); return v === null ? 0 : tms_cl((v - 60) / 60, 0, 1);
    case 'treadFO': v = tms_treadT(i, 'Outer'); return v === null ? 0 : tms_cl((v - 60) / 60, 0, 1);
    case 'treadNums': a = tms_treadT(i, 'Inner'); b = tms_treadT(i, 'Middle'); c = tms_treadT(i, 'Outer'); return (a === null ? '--' : Math.round(a)) + '\n' + (b === null ? '--' : Math.round(b)) + '\n' + (c === null ? '--' : Math.round(c));
    case 'spreadNum': v = tms_spread(i); return v === null ? '--' : (v >= 0 ? '+' : '') + Math.round(v);
    case 'spreadGlyph': v = tms_spread(i); return v === null ? '' : (v > 3 ? '▲' : (v < -3 ? '▼' : '●'));
    case 'travelFrac': v = tms_travelFrac(root, i); return v === null ? 0 : v;
    case 'travelPkFrac': return tms_glance(root).bt[i].pk;
    case 'bumpText': return 'x' + tms_glance(root).bt[i].n;
    case 'bumpNVis': return tms_glance(root).bt[i].n > 0;
    case 'ggDx': v = tms_ph('AccG', 0); x = tms_ph('AccG', 2); if (v === null || x === null) { return 0; } d = Math.sqrt(v * v + x * x) * 100; return Math.round(d > 150 ? -v * 100 * 150 / d : -v * 100) || 0;       // left is left on the screen (|| 0 turns a negative zero into 0)
    case 'ggDy': v = tms_ph('AccG', 0); x = tms_ph('AccG', 2); if (v === null || x === null) { return 0; } d = Math.sqrt(v * v + x * x) * 100; return Math.round(d > 150 ? -x * 100 * 150 / d : -x * 100) || 0;       // accelerating is up
    case 'ggSx': v = tms_ph('AccG', 0); x = tms_ph('AccG', 2); if (v === null || x === null) { return 0; } d = Math.sqrt(v * v + x * x) * 200 / 3; return Math.round(d > 100 ? -v * 200 / 3 * 100 / d : -v * 200 / 3) || 0;       // the small g-meter on the balance page: 1.5 g is 100 px
    case 'ggSy': v = tms_ph('AccG', 0); x = tms_ph('AccG', 2); if (v === null || x === null) { return 0; } d = Math.sqrt(v * v + x * x) * 200 / 3; return Math.round(d > 100 ? -x * 200 / 3 * 100 / d : -x * 200 / 3) || 0;
    case 'ggMag': v = tms_ph('AccG', 0); x = tms_ph('AccG', 2); return (v === null || x === null) ? '-- g' : Math.sqrt(v * v + x * x).toFixed(2) + ' g';
    case 'lastSlideText': s = tms_glance(root); return s.ls ? 'LAST SLIDE  T' + s.ls.cn + '  ' + s.ls.m.toFixed(1) + '°' : 'LAST SLIDE  --';
    case 'gPeaksText': e = tms_gpk(root); return 'LAT ' + e.lat.toFixed(2) + '   BRK ' + e.brk.toFixed(2) + '   ACC ' + e.acc.toFixed(2);
    case 'bzRow': a = tms_zrows(tms_step(root)); e = a[i]; if (!e) { return i === 0 ? 'no braking zone yet' : ''; } x = e.z; return (e.live ? '>' : '') + 'T' + x.idx + ' ' + Math.round(x.entry * 3.6) + '>' + Math.round(x.minSpeed * 3.6) + ' ' + Math.round(x.peak * 100) + '% ' + x.decel.toFixed(1) + 'g ' + (x.abs ? 'A' + x.abs : '--') + ' ' + (x.lock ? 'LOCK' : '--');
    case 'cnRow2': l = tms_corners(root).list; c = l[l.length - 1 - i]; if (!c) { return i === 0 ? 'no corner yet' : ''; } p = c.p || [null, null, null]; return 'T' + c.n + '  ' + Math.round(c.v) + '  ' + c.g.toFixed(2) + 'g  ' + (p[0] ? p[0].k : '--') + '  ' + (p[1] ? p[1].k : '--') + '  ' + (p[2] ? p[2].k : '--');
    case 'discFrac': v = tms_temp(tms_ph('BrakeTemp', i)); return v === null ? 0 : tms_cl(v / 900, 0, 1);
    case 'discStateWord': v = tms_temp(tms_ph('BrakeTemp', i)); return v === null ? '--' : (v < 300 ? 'COLD' : (v > 750 ? 'HOT' : 'OK'));
    case 'discGlyph': v = tms_temp(tms_ph('BrakeTemp', i)); return v === null ? '' : (v < 300 ? '▼' : (v > 750 ? '▲' : '●'));
    case 'discPeakText': return 'PK ' + Math.round(tms_discPk(root).pk[i]);
    case 'discMinText': v = tms_discPk(root).mn[i]; return 'MIN ' + (v === null ? '--' : Math.round(v));
    case 'discMeanText': a = [tms_temp(tms_ph('BrakeTemp', 0)), tms_temp(tms_ph('BrakeTemp', 1)), tms_temp(tms_ph('BrakeTemp', 2)), tms_temp(tms_ph('BrakeTemp', 3))]; if (a[0] === null || a[1] === null || a[2] === null || a[3] === null) { return 'FRONT --   REAR -- °C'; } return 'FRONT ' + Math.round((a[0] + a[1]) / 2) + '   REAR ' + Math.round((a[2] + a[3]) / 2) + ' °C';
    case 'lastLockText': s = tms_glance(root); return s.ll ? 'LAST LOCK  T' + s.ll.cn + ' ' + s.ll.w + ' ' + s.ll.v : 'LAST LOCK  --';
    case 'lockFlash': return now - tms_glance(root).lockTs[i] < TMS_GL.lockShow && tms_blink(TMS_GL.alertMs);
    case 'lockTile': return W[i] + ' ' + tms_lkTxt(tms_step(root)).lkN[i];
    case 'evRowN': s = tms_glance(root); e = s.ev[i]; if (!e) { return i === 0 ? 'no events yet' : ''; }
      t = 'T' + e.cn + '  ';
      if (e.k === 'LOCK') { return t + 'LOCK ' + e.w + '  ' + e.v; }
      if (e.k === 'SLIDE') { return t + 'SLIDE  ' + e.m.toFixed(1) + '°'; }
      if (e.k === 'BOTTOM') { return t + 'BOTTOM ' + e.w + '  ' + e.v; }
      return t + 'TC HELD ' + e.m.toFixed(1) + 's';
  }
  return undefined;
}
// a flash phase; with the game not running SimHub holds the last frame, and a held frame stays on (steady) instead of flashing for ever
function tms_blink(ms) { return !TMS_RUN || Math.floor(new Date().getTime() / ms) % 2 === 0; }
function tms_pump(root) { TMS_FR.ev0++; if (TMS_FR.nid < 2) { return; } tms_step(root); tms_corners(root); tms_slipStats(root); tms_gpk(root); tms_grip(root, 0); tms_phase(root); tms_balNorm(root); tms_sec(root); tms_lpl(root); tms_brkStats(root); tms_discPk(root); tms_glance(root); }
// Self-check line at the bottom edge of the dash, refreshed every 5 s: is the library shared between the formulas (SHARED n = how many formulas use one copy,
// PRIVATE = every formula has its own), how often SimHub runs a formula that is never throttled (pass), how often it runs a formula set to 1 s (slow),
// and how often it runs a formula on a hidden item (hidden). Read off the screen to see what SimHub really does with the refresh intervals.
function tms_perf(root) {
  var now = new Date().getTime(), F = TMS_FR, sh = F.nid > 1, w = root.pw, dt;
  if (!w) { w = root.pw = { t: now, n: 0, e0: F.ev0, h0: F.hid, txt: 'measuring' }; }
  w.n++;
  if (now - w.t >= 5000) {
    dt = (now - w.t) / 1000;
    w.txt = 'pass ' + (sh ? Math.round((F.ev0 - w.e0) / dt) + '/s' : 'n/a') + '  slow ' + (w.n / dt).toFixed(1) + '/s  hidden ' + (sh ? ((F.hid - w.h0) / dt).toFixed(1) + '/s' : 'n/a');
    w.t = now; w.n = 0; w.e0 = F.ev0; w.h0 = F.hid;
  }
  return 'PERF  v' + TMS_VERSION + (sh ? '  SHARED ' + F.nid : '  PRIVATE') + '  ' + w.txt;
}
function tms2(key, root, i) {
  var v, b, x, t, th, br, st, r, dt, lg;
  if (key.charAt(0) === 's' && key.charAt(1) === 't' && key.charAt(2) === '_') { return tms_col(key, root, i); }       // the colour layer: st_<kind>_<vis|col|ink>
  switch (key) {
    case 'perf': return tms_perf(root);
    case 'perfHid': TMS_FR.hid++; return '';
    case 'betaRot': tms_pump(root); return tms('betaRot', root, i);
    case 'alertWord': case 'alertVis': case 'flagBlockVis': case 'flagChipVis': case 'flagWord': case 'flagChipWord': case 'flagShape': case 'redPlateVis': case 'redOutVis': case 'edgeBigVis': case 'edgeStripVis': case 'balGate': case 'balOn': case 'balCellVis': case 'headRot': case 'ggSx': case 'ggSy': case 'ggMag': case 'lastSlideText': case 'balVerdict': case 'balDelta': case 'balIdx': case 'balPhaseWord': case 'balEst': case 'betaShow': case 'betaArrowR': case 'betaArrowL': case 'bandGlyph': case 'bandName': case 'slipAbsText': case 'slipPx': case 'cnNum': case 'cnChip': case 'loadFill': case 'loadAvgPos': case 'loadSplitFR': case 'loadSplitLR': case 'steerUp': case 'tcSolid': case 'tcInk': case 'absSolid': case 'absInk': case 'coreNum': case 'coreFrac': case 'coreGlyph': case 'pressNum': case 'pressGlyph': case 'travelStatic': case 'treadFI': case 'treadFM': case 'treadFO': case 'treadNums': case 'spreadNum': case 'spreadGlyph': case 'travelFrac': case 'travelPkFrac': case 'bumpText': case 'bumpNVis': case 'ggDx': case 'ggDy': case 'gPeaksText': case 'bzRow': case 'cnRow2': case 'discFrac': case 'discStateWord': case 'discGlyph': case 'discPeakText': case 'discMinText': case 'discMeanText': case 'lastLockText': case 'lockFlash': case 'lockTile': case 'evRowN': return tms_side(key, root, i);
    case 'pump': tms_pump(root); return '';      // the same pump on pages that do not show the slip view (a tiny invisible text item per page)
    case 'ovl': th = tms_pedal(tms_gd('Throttle')); br = tms_pedal(tms_gd('Brake')); return (th !== null && br !== null && th > 0.1 && br > 0.1) ? 1 : 0;
    case 'absAct': return tms_gd('ABSActive') ? 1 : 0;
    case 'ovlTime': return tms_brkStats(root).ov.toFixed(2) + 's';
    case 'absHits': return 'hits this lap ' + tms_brkStats(root).ah;
    case 'absWord': return tms_gd('ABSActive') ? 'ACTIVE' : 'idle';
    case 'absColor': return tms_gd('ABSActive') ? TMS_COL.warn : TMS_COL.text;
    case 'tcWord': return tms_gd('TCActive') ? 'TC ACTIVE' : 'TC idle';
    case 'peakBrake': return Math.round(tms_brkStats(root).pb * 100) + '%';
    case 'trailTime': return tms_brkStats(root).tt.toFixed(2) + 's';
    case 'peakDecel': return tms_brkStats(root).pd.toFixed(2) + ' g';      // spikes above 8 g are kerb/impact noise (filtered in tms_brkStats)
    case 'bias': v = tms_n(tms_gd('BrakeBias')); return v === null ? 'n/a' : v.toFixed(1) + '%';
    case 'lcx': case 'lcy': if (!root.lc) { root.lc = {}; } x = [tms_ph('WheelLoad', 0), tms_ph('WheelLoad', 1), tms_ph('WheelLoad', 2), tms_ph('WheelLoad', 3)]; v = tms_gd('SpeedKmh'); r = SHP.loadCenter(root.lc, x, v === null ? null : v / 3.6, tms_phys()); return r ? (key === 'lcx' ? r.x : r.y) : 0;
    case 'loadShare': x = [tms_ph('WheelLoad', 0), tms_ph('WheelLoad', 1), tms_ph('WheelLoad', 2), tms_ph('WheelLoad', 3)]; if (x[0] === null || x[1] === null || x[2] === null || x[3] === null) { return 'no tyre load'; } v = x[0] + x[1] + x[2] + x[3]; if (v < 1) { return 'no tyre load'; } return 'FRONT ' + Math.round((x[0] + x[1]) / v * 100) + '%  REAR ' + Math.round((x[2] + x[3]) / v * 100) + '%     LEFT ' + Math.round((x[0] + x[2]) / v * 100) + '%  RIGHT ' + Math.round((x[1] + x[3]) / v * 100) + '%';
    case 'raceTotal': v = tms_n(tms_gd('TotalLaps')); return v === null ? 0 : v;
    case 'raceProg': v = tms_n(tms_gd('TotalLaps')); x = tms_n(tms_gd('CompletedLaps')); return (!v || x === null) ? 0 : tms_cl(x / v, 0, 1);
    case 'raceText': b = tms_lapsToGo(); v = tms_n(tms_gd('TotalLaps')); x = tms_n(tms_gd('CurrentLap')); if (b === null) { return 'TO GO  (no lap count, time or plan)'; } if (b.src === 'race' && v) { return 'RACE  lap ' + x + ' of ' + v; } return 'TO GO  ' + b.n + ' laps  (' + (b.src === 'time' ? 'session time' : 'plan') + ')';
    case 'rangeFrac': v = tms_lapsLeft(root); b = tms_lapsToGo(); return (v === null || b === null || !b.n) ? 0 : tms_cl(v / b.n, 0, 1);
    case 'rangeColor': v = tms_lapsLeft(root); b = tms_lapsToGo(); if (v === null || b === null) { return TMS_COL.off; } return v >= b.n ? TMS_COL.ok : (b.n - v < 1 ? TMS_COL.warn : TMS_COL.bad);
    case 'rangeText': v = tms_lapsLeft(root); b = tms_lapsToGo(); if (v === null || b === null) { return 'FUEL RANGE  n/a'; } return v >= b.n ? 'FUEL RANGE  reaches the end' : 'FUEL RANGE  short by ' + (b.n - v).toFixed(1) + ' laps';
    case 'balTag': return tms_game() === 'acc' ? 'FROM TYRE SLIP' : 'ESTIMATED';
    case 'lapSub': v = tms_n(tms_gd('CurrentLap')); return v === null ? 'live' : 'lap ' + v;
    case 'treadIText': v = tms('treadI', root, i); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'treadMText': v = tms('treadM', root, i); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'treadOText': v = tms('treadO', root, i); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'thrPct': v = tms('thr', root, 0); return v === null ? 'n/a' : Math.round(v * 100) + '%';
    case 'brkPct': v = tms('brk', root, 0); return v === null ? 'n/a' : Math.round(v * 100) + '%';
    case 'cluPct': v = tms('clu', root, 0); return v === null ? 'n/a' : Math.round(v * 100) + '%';
    case 'loadN': v = tms_ph('WheelLoad', i); return v === null ? 'n/a' : String(Math.round(v));
    case 'sessLabel': t = tms_secs(tms_gd('SessionTimeLeft')); return (t !== null && t < 0) ? 'SESSION TIME' : 'SESSION LEFT';
    case 'hdrALabel': return tms_game() === 'acc' ? 'GAP AHEAD' : 'LAP';
    case 'hdrA': if (tms_game() === 'acc') { return tms('gapA', root, i); } v = tms_n(tms_gd('CurrentLap')); x = tms_n(tms_gd('TotalLaps')); return v === null ? 'n/a' : (x !== null && x > 0 ? v + ' / ' + x : String(v));
    case 'hdrBLabel': return tms_game() === 'acc' ? 'GAP BEHIND' : 'LAST LAP';
    case 'hdrB': if (tms_game() === 'acc') { return tms('gapB', root, i); } return tms_fmtShort(tms_gd('LastLapTime'));
    case 'hlLap': v = tms_hist(i); return v === null ? '' : 'L' + v.lap;
    case 'hlTime': v = tms_hist(i); return v === null ? '' : tms_fmtTime(v.t);
    case 'hlDelta': v = tms_hist(i); return (v === null || v.d === null) ? '' : tms_sg(v.d, 3);
    case 'hlColor': v = tms_hist(i); return (v === null || v.d === null) ? TMS_COL.dim : (v.d <= 0.0005 ? TMS_COL.best : (v.d < 0.3 ? TMS_COL.white : TMS_COL.warn));
    case 'hlBar': v = tms_hist(i); if (v === null || v.d === null) { return 0; } x = 2; for (r = 0; r < 5; r++) { b = tms_hist(r); if (b !== null && b.d !== null && b.d > x) { x = b.d; } } return v.d <= 0.0005 ? 3 : Math.max(3, Math.round(tms_cl(v.d / x, 0, 1) * 300));
    case 'deltaRange': return tms_dRange(root);
    case 'deltaLo': return -tms_dRange(root);
    case 'deltaHiText': return '+' + tms_dRange(root) + 's';
    case 'deltaLoText': return '-' + tms_dRange(root) + 's';
    case 'znRow': b = tms_znTxt(tms_step(root), i); return b.znS[i];
    case 'znColor': b = tms_znTxt(tms_step(root), i); return b.znC[i];
    case 'evRow': b = tms_evTxt(tms_step(root), i); return b.evS[i];
    case 'evColor': b = tms_evTxt(tms_step(root), i); return b.evC[i];
    case 'lockN': b = tms_lkTxt(tms_step(root)); return b.lkN[i];
    case 'lockText': b = tms_lkTxt(tms_step(root)); return b.lkT;
    case 'lockColor': b = tms_lkTxt(tms_step(root)); return b.lkC;
    case 'revText': b = tms_step(root); return b.st.mc ? String(SHP.metricsSnapshot(b.st.mc).reversals) : '--';
    case 'smoothText': b = tms_step(root); v = b.st.mc ? SHP.metricsSnapshot(b.st.mc).smoothness : null; return v === null ? '--' : v.toFixed(1) + '/s';
    case 'engText': v = tms_temp(tms_gd('OilTemperature')); x = tms_temp(tms_gd('WaterTemperature')); return ((v !== null && v > 0) ? 'OIL ' + Math.round(v) + '\u00b0' : '') + ((v !== null && v > 0 && x !== null && x > 0) ? '    ' : '') + ((x !== null && x > 0) ? 'WATER ' + Math.round(x) + '\u00b0' : '');
    case 'fuelMargin': v = tms_lapsLeft(root); b = tms_lapsToGo(); if (v === null || b === null) { return 'range n/a'; } return v >= b.n ? '+' + (v - b.n).toFixed(1) + ' laps spare' : 'SHORT by ' + (b.n - v).toFixed(1) + ' laps';
    case 'mapX': b = tms_map(root, i, 72); return b === null ? 0 : b.x;
    case 'mapY': b = tms_map(root, i, 72); return b === null ? 0 : b.y;
    case 'mapCol': b = tms_map(root, i, 72); return b === null ? '#00000000' : (i < 0 ? TMS_COL.y : '#FF6A6A76');
    case 'carX': b = tms_map(root, -1, 72); return b === null ? 0 : b.x;
    case 'carY': b = tms_map(root, -1, 72); return b === null ? 0 : b.y;
    case 'carCol': b = tms_map(root, -1, 72); return b === null ? '#00000000' : TMS_COL.y;
    case 'latGText': v = tms_ph('AccG', 0); return v === null ? 'n/a' : Math.abs(v).toFixed(2) + ' g';
    case 'latGDir': v = tms_ph('AccG', 0); return (v === null || Math.abs(v) < 0.05) ? '' : (v > 0 ? '\u25c4 LEFT' : 'RIGHT \u25ba');
    case 'lonGText': v = tms_ph('AccG', 2); return v === null ? 'n/a' : Math.abs(v).toFixed(2) + ' g';
    case 'lonGDir': v = tms_ph('AccG', 2); return (v === null || Math.abs(v) < 0.05) ? '' : (v < 0 ? '\u25c4 BRAKING' : 'ACCEL \u25ba');
    case 'peakLatText': return tms_gpk(root).lat.toFixed(2) + ' g';
    case 'peakBrkGText': return tms_gpk(root).brk.toFixed(2) + ' g';
    case 'peakAccText': return tms_gpk(root).acc.toFixed(2) + ' g';
    case 'peakYawText': return Math.round(tms_gpk(root).yaw) + '\u00b0/s';
    case 'betaPeakText': return tms_slipStats(root).peak.toFixed(1) + '\u00b0';
    case 'slideTimeText': return tms_slipStats(root).slide.toFixed(1) + ' s';
    case 'cornerLastText': b = tms_slipStats(root); x = b.last; return x === null ? '--' : (x.k === 'us' ? 'UNDERSTEER ' + x.d.toFixed(1) + '\u00b0' : (x.k === 'os' ? 'OVERSTEER ' + x.d.toFixed(1) + '\u00b0' : 'NEUTRAL'));
    case 'cornerLastColor': b = tms_slipStats(root); x = b.last; return x === null ? TMS_COL.dim : (x.k === 'us' ? TMS_COL.warn : (x.k === 'os' ? TMS_COL.bad : TMS_COL.ok));
    case 'cornerCountText': b = tms_slipStats(root); return 'US ' + b.us + '   OS ' + b.os + '   N ' + b.n;
    case 'sdTime': v = tms_secLast(root, i); return v === null ? '--' : tms_fmtSec(v);
    case 'sdDelta': v = tms_secLast(root, i); x = tms_secBest(root, i); if (v === null || x === null) { return ''; } return Math.abs(v - x) < 0.0005 ? '0.000' : tms_sg(v - x, 3);
    case 'sdColor': v = tms_secLast(root, i); x = tms_secBest(root, i); if (v === null || x === null) { return TMS_COL.dim; } return v - x < 0.0005 ? TMS_COL.best : (v - x < 0.15 ? TMS_COL.white : TMS_COL.warn);
    case 'theoText': v = tms_theo(root); return v === null ? '--:--.---' : tms_fmtTime(v);
    case 'theoGapText': v = tms_theo(root); x = tms_secs(tms_gd('BestLapTime')); if (v === null || x === null || x <= 0) { return ''; } return x - v > 0.0005 ? '-' + (x - v).toFixed(3) + ' s possible' : 'on your best';
    case 'avgText': b = tms_lapSpread(); return b === null ? 'AVG  --' : 'AVG  ' + tms_fmtTime(b.avg);
    case 'spreadText': b = tms_lapSpread(); return b === null ? 'SPREAD  --' : 'SPREAD  \u00b1' + b.sd.toFixed(2) + ' s';
    case 'cnRow': b = tms_cnTxt(root); return b.cnS[i];
    case 'cnColor': b = tms_cnTxt(root); return b.cnC[i];
    case 'cnTrend': v = tms_cnTrend(root); if (v === null) { return 'TREND  needs 3 corners'; } return 'TREND  ' + (v.m > tms_phys().balanceNeutralDeg ? 'UNDERSTEER ' + v.m.toFixed(1) + '\u00b0' : (v.m < -tms_phys().balanceNeutralDeg ? 'OVERSTEER ' + (-v.m).toFixed(1) + '\u00b0' : 'NEUTRAL')) + '  (last ' + v.n + ')';
    case 'cnTrendColor': v = tms_cnTrend(root); return v === null ? TMS_COL.dim : (v.m > tms_phys().balanceNeutralDeg ? TMS_COL.warn : (v.m < -tms_phys().balanceNeutralDeg ? TMS_COL.bad : TMS_COL.ok));
    default: return tms(key, root, i);
  }
}
