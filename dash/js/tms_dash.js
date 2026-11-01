// Telemetry Master Suite: binding library for the dash (ES5.1 only, no modern syntax).
// Every dash formula is a one-liner such as:  return tms('core', root, 0);
// `root` is SimHub's per-formula persistent object. Anything stateful (beta smoothing, phase machine, grip learning,
// per-lap peaks) lives on it, so each formula keeps its own copy (shared state needs the C# plugin).
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
function tms_sg(v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d); }
function tms_secs(v) { return SHA.secs(v); }
function tms_fmtTime(v) { var t = tms_secs(v), m, s; if (t === null || t <= 0) { return '--:--.---'; } m = Math.floor(t / 60); s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); }
function tms_fmtShort(v) { var t = tms_secs(v), m, s; if (t === null || t <= 0) { return '--:--.--'; } m = Math.floor(t / 60); s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
function tms_fmtSec(v) { var t = tms_secs(v), m, s; if (t === null || t <= 0) { return '--'; } if (t < 60) { return t.toFixed(2); } m = Math.floor(t / 60); s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
// Body pitch and roll RELATIVE TO THE ROAD from suspension travel (left vs right, front vs rear). The sim's own Pitch/Roll are absolute,
// so banking (Karussell) or a hill would look like body roll. Assumes travel grows with compression (verify). Returns radians or null.
var TMS_GEO = { track: 1.6, wheelbase: 2.5, pitchX: 10, rollX: 6, maxDraw: 25 };
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
  var c = tms_n($prop('DataCorePlugin.Computed.Fuel_LitersPerLap')), f = tms_n(tms_gd('Fuel')), l = tms_n(tms_gd('CompletedLaps')), d;
  if (c !== null && c > 0.05) { return c; }
  if (f === null || l === null) { return null; }
  if (root.fl === undefined) { root.fl = l; root.ff = f; root.fv = null; return null; }
  if (l !== root.fl) { d = root.ff - f; if (l === root.fl + 1 && d > 0.2 && d < 60) { root.fv = d; } root.fl = l; root.ff = f; }
  if (f > root.ff) { root.ff = f; }
  return root.fv;
}
function tms_lapsLeft(root) { var c = tms_n($prop('DataCorePlugin.Computed.Fuel_RemainingLaps')), l, f; if (c !== null && c > 0) { return c; } l = tms_lpl(root); f = tms_n(tms_gd('Fuel')); return (l === null || f === null) ? null : f / l; }
// Delta to the best lap: only while there is a best lap. AC has no GameData.DeltaToSessionBest (probe), SimHub's own tracker should provide one (name from the catalog, unverified at runtime).
function tms_delta() { var b = tms_secs(tms_gd('BestLapTime')), v; if (b === null || b <= 0) { return null; } v = tms_n(tms_gd('DeltaToSessionBest')); return v !== null ? v : tms_n($prop('PersistantTrackerPlugin.SessionBestLiveDeltaSeconds')); }
function tms_temp(c) { var u = $prop('TemperatureUnit'), x = tms_n(c); if (x === null) { return null; } if (u === 'Kelvin') { return x - 273.15; } if (u === 'Fahrenheit') { return (x - 32) / 1.8; } return x; }
function tms_phys() { if (!TMS_PHYS) { TMS_PHYS = SHP.cfg({ velFrame: 'local', localLongIdx: 2, localLatIdx: 0, steerOn: 0.22, steerOff: 0.13, brakeOn: 0.12, brakeOff: 0.05 }); } return TMS_PHYS; }
function tms_steerRaw() { return tms_ph('SteerAngle'); }
// steer fraction used everywhere on the dash: + = LEFT, - = RIGHT (so the sign flip lives in one place)
function tms_steerFrac() { var s = tms_ph('SteerAngle'); if (s === null) { return null; } s = tms_cl(s / TMS_CFG.steerFull, -1.2, 1.2); return TMS_CFG.steerRightPositive ? -s : s; }

// ---- body slip angle in radians (null when unknown), smoothed on root
function tms_betaRad(root) {
  var g = tms_game(), c = tms_phys(), r, v, h, now, dt, cc;
  if (!root.bs) { root.bs = {}; root.fc = {}; }
  if (g === 'acc') {
    v = [tms_ph('LocalVelocity', 0), tms_ph('LocalVelocity', 1), tms_ph('LocalVelocity', 2)];
    r = SHP.bodySlip(root.bs, v, null, c);
  } else if (g === 'ac') {
    v = [tms_ph('Velocity', 0), tms_ph('Velocity', 1), tms_ph('Velocity', 2)]; h = tms_ph('Heading');
    now = new Date().getTime(); dt = root.t0 ? (now - root.t0) / 1000 : 0.016; if (!(dt > 0)) { dt = 0.016; } root.t0 = now;
    SHP.frameCalib(root.fc, v, h, dt, c);
    cc = SHP.calibratedCfg(root.fc, SHP.cfg({ velFrame: 'world' }));
    r = SHP.bodySlip(root.bs, v, h, cc);
  } else { return null; }
  return r ? r.beta : null;
}
function tms_band(root) { var b = tms_betaRad(root); return b === null ? null : SHP.slipBand(b, tms_phys()); }
function tms_bandCol(b) { return b === 'red' ? TMS_COL.bad : (b === 'amber' ? TMS_COL.warn : (b === 'green' ? TMS_COL.ok : TMS_COL.dim)); }
function tms_tempState(c) { if (c === null) { return null; } if (c < 78) { return 'cold'; } if (c <= 98) { return 'ok'; } if (c <= 106) { return 'warn'; } return 'bad'; }
function tms_discState(t) { if (t === null) { return null; } if (t < 300) { return 'cold'; } if (t <= 650) { return 'ok'; } if (t <= 750) { return 'warn'; } return 'bad'; }
function tms_slipOf(i) { var a = tms_ph('SlipAngle', i); return a !== null ? a : tms_ph('WheelSlip', i); }
function tms_phase(root) {
  var th = tms_pedal(tms_gd('Throttle')), br = tms_pedal(tms_gd('Brake')), st = tms_steerFrac(), b = tms_betaRad(root);
  if (th === null || br === null || st === null) { return null; }
  if (!root.ph) { root.ph = {}; root.pt = 0; }
  var now = new Date().getTime(), dt = root.pt ? (now - root.pt) / 1000 : 0.016; if (!(dt > 0)) { dt = 0.016; } root.pt = now;
  return SHP.phaseStep(root.ph, br, th, st, b, dt, tms_phys());
}
var TMS_PHASES = ['STRAIGHT', 'BRAKING', 'TRAIL', 'COAST', 'ROTATION', 'POWER'];
function tms_grip(root, i) {
  var a = [tms_slipOf(0), tms_slipOf(1), tms_slipOf(2), tms_slipOf(3)], r = [tms_ph('SlipRatio', 0), tms_ph('SlipRatio', 1), tms_ph('SlipRatio', 2), tms_ph('SlipRatio', 3)], g;
  if (!root.gr) { root.gr = {}; }
  g = SHP.gripUpdate(root.gr, tms_gd('CarId'), a, r[0] === null ? null : r, tms_phys());
  return (g && !g.learning) ? g.util[i] : null;
}
// Balance as a normalised number in -1..1 (+ understeer, - oversteer): mean |slip| of the front pair vs the rear pair, only while cornering.
function tms_balNorm(root) {
  var a = [tms_slipOf(0), tms_slipOf(1), tms_slipOf(2), tms_slipOf(3)], s = tms_n(tms_gd('SpeedKmh')), lg = tms_ph('AccG', 0), f, r, tot, target = 0;
  if (root.bn === undefined) { root.bn = 0; }
  if (a[0] !== null && a[1] !== null && a[2] !== null && a[3] !== null && s !== null && lg !== null) {
    f = (Math.abs(a[0]) + Math.abs(a[1])) / 2; r = (Math.abs(a[2]) + Math.abs(a[3])) / 2; tot = f + r;
    if (s > 30 && Math.abs(lg) > 0.3 && tot > 1e-6) { target = (f - r) / tot; }
  }
  root.bn = root.bn + 0.2 * (target - root.bn);
  return root.bn;
}
function tms_balance(root) {
  var a = [tms_slipOf(0), tms_slipOf(1), tms_slipOf(2), tms_slipOf(3)], s = tms_gd('SpeedKmh'), lg = tms_ph('AccG', 0);
  if (!root.bl) { root.bl = {}; }
  return SHP.balance(root.bl, a, s === null ? null : s / 3.6, lg, tms_phys());
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
    case 'pitchRot': r = tms_attitude(); return r === null ? 0 : tms_cl(r.pitch * 180 / Math.PI * TMS_GEO.pitchX, -TMS_GEO.maxDraw, TMS_GEO.maxDraw);       // drawn x10, degrees, nose up = clockwise
    case 'rollRot': r = tms_attitude(); return r === null ? 0 : tms_cl(r.roll * 180 / Math.PI * TMS_GEO.rollX, -TMS_GEO.maxDraw, TMS_GEO.maxDraw);         // drawn x6, leaning right = clockwise
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
    case 'loadBar': v = tms_ph('WheelLoad', i); return v === null ? 0 : tms_cl(v / 4500, 0, 1);
    case 'travelText': v = tms_ph('SuspensionTravel', i); return v === null ? 'n/a' : Math.round(v * 1000) + ' mm';
    case 'travel': v = tms_ph('SuspensionTravel', i); return v === null ? null : v * 1000;
    // brakes
    case 'disc': return tms_temp(tms_ph('BrakeTemp', i));
    case 'discText': v = tms_temp(tms_ph('BrakeTemp', i)); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'discColor': v = tms_temp(tms_ph('BrakeTemp', i)); t = tms_discState(v); return t === null ? TMS_COL.dim : TMS_COL[t];
    case 'discWord': v = tms_temp(tms_ph('BrakeTemp', i)); t = tms_discState(v); return t === null ? 'n/a' : ({ cold: '▼ COLD', ok: '● OK', warn: '▲ HOT', bad: '▲▲ FADE RISK' })[t];
    case 'discPeak': v = tms_temp(tms_ph('BrakeTemp', i)); if (!root.pk) { root.pk = 0; root.lp = null; } x = tms_n(tms_gd('CompletedLaps')); if (root.lp !== x) { root.lp = x; root.pk = 0; } if (v !== null && v > root.pk) { root.pk = v; } return Math.round(root.pk) + '°';
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
    case 'sector': return tms_fmtSec(i === 0 ? tms_gd('Sector1Time') : (i === 1 ? tms_gd('Sector2Time') : tms_gd('Sector3LastLapTime')));
    case 'sectorBest': t = tms_secs(i === 0 ? tms_gd('Sector1BestTime') : (i === 1 ? tms_gd('Sector2BestTime') : tms_gd('Sector3BestLapTime'))); return (t === null || t <= 0) ? '--' : 'best ' + tms_fmtSec(t);
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
      if (v === 'GREEN') { return TMS_COL.ok; } if (v.indexOf('YELLOW') >= 0) { return '#FFFFD60A'; } if (v.indexOf('BLUE') >= 0) { return TMS_COL.cold; } if (v.indexOf('RED') >= 0 || v.indexOf('BLACK') >= 0) { return TMS_COL.bad; } return TMS_COL.white;
    case 'sessLeft': t = tms_secs(tms_gd('SessionTimeLeft')); return (t === null || t <= 0) ? '--' : Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2);
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
function tmsr(key, root, i, minSpan, which) {
  var now = new Date().getTime(), v, k, lo = 1e9, hi = -1e9, sp, c;
  if (!root.rb) { root.rb = []; root.rt = 0; }
  if (now - root.rt >= 100) { root.rt = now; v = tms(key, root, i); if (v !== null && v !== undefined) { root.rb.push(v); if (root.rb.length > 200) { root.rb.shift(); } } }
  for (k = 0; k < root.rb.length; k++) { if (root.rb[k] < lo) { lo = root.rb[k]; } if (root.rb[k] > hi) { hi = root.rb[k]; } }
  if (lo > hi) { return which === 'lo' ? 0 : minSpan; }
  sp = Math.max(minSpan, (hi - lo) * 1.25); c = (hi + lo) / 2;
  return which === 'lo' ? c - sp / 2 : c + sp / 2;
}

function tms2(key, root, i) {
  var v, b, x, th, br, st, r, dt, lg;
  switch (key) {
    case 'ovl': th = tms_pedal(tms_gd('Throttle')); br = tms_pedal(tms_gd('Brake')); return (th !== null && br !== null && th > 0.1 && br > 0.1) ? 1 : 0;
    case 'absAct': return tms_gd('ABSActive') ? 1 : 0;
    case 'ovlTime': dt = tms_dtRoot(root); if (tms_lapReset(root) || root.ov === undefined) { root.ov = 0; } if (tms2('ovl', root, 0) === 1) { root.ov += dt; } return root.ov.toFixed(2) + 's';
    case 'absHits': if (tms_lapReset(root) || root.ah === undefined) { root.ah = 0; root.pa = false; } x = !!tms_gd('ABSActive'); if (x && !root.pa) { root.ah++; } root.pa = x; return 'hits this lap ' + root.ah;
    case 'absWord': return tms_gd('ABSActive') ? 'ACTIVE' : 'idle';
    case 'absColor': return tms_gd('ABSActive') ? TMS_COL.warn : TMS_COL.text;
    case 'tcWord': return tms_gd('TCActive') ? 'TC ACTIVE' : 'TC idle';
    case 'peakBrake': if (tms_lapReset(root) || root.pb === undefined) { root.pb = 0; } br = tms_pedal(tms_gd('Brake')); if (br !== null && br > root.pb) { root.pb = br; } return Math.round(root.pb * 100) + '%';
    case 'trailTime': dt = tms_dtRoot(root); if (tms_lapReset(root) || root.tt === undefined) { root.tt = 0; } br = tms_pedal(tms_gd('Brake')); st = tms_steerFrac(); if (br !== null && st !== null && br >= 0.12 && Math.abs(st) >= 0.22) { root.tt += dt; } return root.tt.toFixed(2) + 's';
    case 'peakDecel': if (tms_lapReset(root) || root.pd === undefined) { root.pd = 0; } lg = tms_ph('AccG', 2); if (lg !== null && -lg > root.pd && -lg < 8) { root.pd = -lg; } return root.pd.toFixed(2) + ' g';      // spikes above 8 g are kerb/impact noise
    case 'bias': v = tms_n(tms_gd('BrakeBias')); return v === null ? 'n/a' : v.toFixed(1) + '%';
    case 'lcx': case 'lcy': if (!root.lc) { root.lc = {}; } x = [tms_ph('WheelLoad', 0), tms_ph('WheelLoad', 1), tms_ph('WheelLoad', 2), tms_ph('WheelLoad', 3)]; v = tms_gd('SpeedKmh'); r = SHP.loadCenter(root.lc, x, v === null ? null : v / 3.6, tms_phys()); return r ? (key === 'lcx' ? r.x : r.y) : 0;
    case 'loadShare': x = [tms_ph('WheelLoad', 0), tms_ph('WheelLoad', 1), tms_ph('WheelLoad', 2), tms_ph('WheelLoad', 3)]; if (x[0] === null || x[1] === null || x[2] === null || x[3] === null) { return 'no tyre load'; } v = x[0] + x[1] + x[2] + x[3]; return 'F ' + Math.round((x[0] + x[1]) / v * 100) + '%  R ' + Math.round((x[2] + x[3]) / v * 100) + '%     L ' + Math.round((x[0] + x[2]) / v * 100) + '%  R ' + Math.round((x[1] + x[3]) / v * 100) + '%';
    case 'raceTotal': v = tms_n(tms_gd('TotalLaps')); return v === null ? 0 : v;
    case 'raceProg': v = tms_n(tms_gd('TotalLaps')); x = tms_n(tms_gd('CompletedLaps')); return (!v || x === null) ? 0 : tms_cl(x / v, 0, 1);
    case 'raceText': b = tms_lapsToGo(); v = tms_n(tms_gd('TotalLaps')); x = tms_n(tms_gd('CurrentLap')); if (b === null) { return 'TO GO  (no lap count, time or plan)'; } if (b.src === 'race' && v) { return 'RACE  lap ' + x + ' of ' + v; } return 'TO GO  ' + b.n + ' laps  (' + (b.src === 'time' ? 'from session time' : 'plan: edit TMS_CFG.lapsTarget') + ')';
    case 'rangeFrac': v = tms_lapsLeft(root); b = tms_lapsToGo(); return (v === null || b === null || !b.n) ? 0 : tms_cl(v / b.n, 0, 1);
    case 'rangeColor': v = tms_lapsLeft(root); b = tms_lapsToGo(); if (v === null || b === null) { return TMS_COL.off; } return v >= b.n ? TMS_COL.ok : (b.n - v < 1 ? TMS_COL.warn : TMS_COL.bad);
    case 'rangeText': v = tms_lapsLeft(root); b = tms_lapsToGo(); if (v === null || b === null) { return 'FUEL RANGE  n/a'; } return v >= b.n ? 'FUEL RANGE  reaches the end' : 'FUEL RANGE  short by ' + (b.n - v).toFixed(1) + ' laps';
    case 'balTag': return tms_game() === 'acc' ? 'FROM TYRE SLIP' : 'ESTIMATED';
    case 'lapSub': v = tms_n(tms_gd('CurrentLap')); return v === null ? 'live' : 'lap ' + v + '  |  best-lap overlays need the plugin';
    case 'treadIText': v = tms('treadI', root, i); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'treadMText': v = tms('treadM', root, i); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'treadOText': v = tms('treadO', root, i); return v === null ? 'n/a' : Math.round(v) + '°';
    case 'thrPct': v = tms('thr', root, 0); return v === null ? 'n/a' : Math.round(v * 100) + '%';
    case 'brkPct': v = tms('brk', root, 0); return v === null ? 'n/a' : Math.round(v * 100) + '%';
    case 'cluPct': v = tms('clu', root, 0); return v === null ? 'n/a' : Math.round(v * 100) + '%';
    case 'loadN': v = tms_ph('WheelLoad', i); return v === null ? 'n/a' : String(Math.round(v));
    default: return tms(key, root, i);
  }
}
