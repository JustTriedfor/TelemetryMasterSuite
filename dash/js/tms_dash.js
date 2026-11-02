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
      if (v === 'GREEN') { return TMS_COL.ok; } if (v.indexOf('YELLOW') >= 0) { return '#FFFFD60A'; } if (v.indexOf('BLUE') >= 0) { return TMS_COL.cold; } if (v.indexOf('RED') >= 0 || v.indexOf('BLACK') >= 0) { return TMS_COL.bad; } return TMS_COL.white;
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
  var now = new Date().getTime(), s = root.sd, c = tms_phys(), dt, sp, br, th, steer, lap, ab, tc, ws, sr, lock, f, k, ll, wo = true, ro = true, band;
  if (s && s.t === now) { return s; }
  if (!s) { s = root.sd = { t: 0, lap: null, st: {}, n: 0 }; }
  dt = s.t ? (now - s.t) / 1000 : 0; s.t = now;
  sp = tms_n(tms_gd('SpeedKmh')); br = tms_pedal(tms_gd('Brake')); th = tms_pedal(tms_gd('Throttle')); steer = tms_steerFrac(); lap = tms_n(tms_gd('CompletedLaps'));
  if (sp === null || br === null || th === null || !(dt > 0) || dt > 0.5) { return s; }
  if (steer === null) { steer = 0; }
  ab = tms_gd('ABSActive') ? true : false; tc = tms_gd('TCActive') ? true : false;
  ws = [tms_ph('WheelAngularSpeed', 0), tms_ph('WheelAngularSpeed', 1), tms_ph('WheelAngularSpeed', 2), tms_ph('WheelAngularSpeed', 3)];
  sr = [tms_ph('SlipRatio', 0), tms_ph('SlipRatio', 1), tms_ph('SlipRatio', 2), tms_ph('SlipRatio', 3)];
  for (k = 0; k < 4; k++) { if (ws[k] === null) { wo = false; } if (sr[k] === null) { ro = false; } }
  lock = SHP.lockups(s.st, sp / 3.6, br, th, wo ? ws : null, ro ? sr : null, c, null);
  if (lap !== null && s.lap !== null && lap !== s.lap) { ll = tms_secs(tms_gd('LastLapTime')); SHP.zoneLapEnd(s.st, ll, true, c); SHP.metricsLapEnd(s.st, ll, true); }
  if (lap !== null) { s.lap = lap; }
  f = { lap: s.lap, pos: null, speed: sp / 3.6, brake: br, steer: steer, longG: tms_ph('AccG', 2), abs: ab, lock: lock[0] || lock[1] || lock[2] || lock[3] };
  SHP.zoneUpdate(s.st, f, dt, c);
  SHP.metricsUpdate(s.st, br, th, steer, dt, c);
  band = tms_band(root);
  SHP.eventsUpdate(s.st, { t: now / 1000, lap: tms_curLap(), band: band, lock: lock, absActive: ab, tcActive: tc, offTrack: false, lapTime: tms_secs(tms_gd('CurrentLapTime')), speed: sp }, c);
  s.n++;
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
function tms_sec(root) {
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
  var g = root.gp, now = new Date().getTime(), dt, k, a, r, cur, pk, mn = 0.02, car = tms_gd('CarId');
  if (!g) { g = root.gp = { pk: [0, 0, 0, 0], u: [0, 0, 0, 0], n: 0, t: now, car: car }; }
  if (g.car !== car) { g.car = car; g.pk = [0, 0, 0, 0]; g.n = 0; }
  dt = (now - g.t) / 1000; g.t = now; if (!(dt > 0) || dt > 1) { dt = 0.016; }
  for (k = 0; k < 4; k++) {
    a = tms_slipOf(k); if (a === null) { return null; }
    r = tms_ph('SlipRatio', k); cur = r === null ? Math.abs(a) : Math.sqrt(a * a + r * r);
    pk = g.pk[k] * Math.pow(0.5, dt / 90);
    if (cur > pk) { pk = pk + 0.05 * (Math.min(cur, 2 * pk + mn) - pk); }
    g.pk[k] = pk; g.u[k] = pk > mn ? tms_cl(cur / pk, 0, 1) : 0;
  }
  g.n++;
  return g.n < 120 ? null : g.u[i];
}
// symmetric +-range for the delta chart from the last minute (steps of 0.5 s so the scale does not flicker)
function tms_dRange(root) {
  var now = new Date().getTime(), d, k, m = 0;
  if (!root.dr) { root.dr = { a: [], t: 0 }; }
  if (now - root.dr.t >= 250) { root.dr.t = now; d = tms_delta(); if (d !== null) { root.dr.a.push(Math.abs(d)); if (root.dr.a.length > 240) { root.dr.a.shift(); } } }
  for (k = 0; k < root.dr.a.length; k++) { if (root.dr.a[k] > m) { m = root.dr.a[k]; } }
  return Math.max(1, Math.ceil(m * 1.2 * 2) / 2);
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
  var now = new Date().getTime(), g = root.gk, lap = tms_n(tms_gd('CompletedLaps')), lg, lo, yw;
  if (!g) { g = root.gk = { t: 0, lap: lap, lat: 0, brk: 0, acc: 0, yaw: 0 }; }
  if (g.t === now) { return g; }
  g.t = now;
  if (lap !== g.lap) { g.lap = lap; g.lat = 0; g.brk = 0; g.acc = 0; g.yaw = 0; }
  lg = tms_ph('AccG', 0); lo = tms_ph('AccG', 2); yw = tms('yaw', root, 0);
  if (lg !== null && Math.abs(lg) < 8 && Math.abs(lg) > g.lat) { g.lat = Math.abs(lg); }
  if (lo !== null && Math.abs(lo) < 8) { if (-lo > g.brk) { g.brk = -lo; } if (lo > g.acc) { g.acc = lo; } }
  if (yw !== null && Math.abs(yw) > g.yaw) { g.yaw = Math.abs(yw); }
  return g;
}
// Slip statistics for the strip under the grip cards: peak slip angle and time sliding this lap, the last corner's balance, corner counts.
function tms_slipStats(root) {
  var now = new Date().getTime(), s = root.ss, lap = tms_n(tms_gd('CompletedLaps')), c = tms_phys(), dt, bd, band, st, deg;
  if (!s) { s = root.ss = { t: 0, lap: lap, peak: 0, slide: 0, us: 0, os: 0, n: 0, cor: false, last: null }; }
  if (s.t === now) { return s; }
  dt = s.t ? (now - s.t) / 1000 : 0; s.t = now;
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
  var now = new Date().getTime(), s = root.cn, c = tms_phys(), dt, sp, lg, sf, bd, st, cur, deg, v;
  if (!s) { s = root.cn = { t: 0, lap: null, n: 0, cor: false, cur: null, list: [] }; }
  if (s.t === now) { return s; }
  dt = s.t ? (now - s.t) / 1000 : 0; s.t = now;
  sp = tms_n(tms_gd('SpeedKmh')); lg = tms_ph('AccG', 0); sf = tms_steerFrac(); bd = tms_betaRad(root);
  tms_balance(root); st = root.bl && root.bl.bal;
  if (!st || sp === null || lg === null) { return s; }
  if (st.cornering) {
    if (!s.cor || !s.cur) { s.cur = { lap: tms_curLap(), v: sp, gt: [], st: 0, bt: [], dur: 0 }; }
    cur = s.cur;
    if (sp < cur.v) { cur.v = sp; }
    if (Math.abs(lg) < 8) { tms_top3(cur.gt, Math.abs(lg)); }
    if (sf !== null) { deg = Math.abs(sf) * TMS_CFG.steerLockDeg; if (deg > cur.st) { cur.st = deg; } }
    if (bd !== null) { deg = Math.abs(bd) * 180 / Math.PI; if (deg < 60) { tms_top3(cur.bt, deg); } }
    if (dt > 0 && dt < 0.5) { cur.dur += dt; }
  } else if (s.cor && s.cur) {
    cur = s.cur; s.cur = null;
    if (cur.dur >= 1) {
      cur.g = tms_third(cur.gt); if (cur.g === null) { cur.g = 0; }
      cur.b = tms_third(cur.bt);
      v = tms_verdict(st, c);
      if (cur.lap !== s.lap) { s.lap = cur.lap; s.n = 0; }
      s.n++; cur.n = s.n; cur.k = v.k; cur.d = v.d;
      s.list.push(cur); if (s.list.length > 8) { s.list.shift(); }
    }
  }
  s.cor = st.cornering;
  return s;
}
// corner row i, newest first (null when there is none)
function tms_cnrow(root, i) { var l = tms_corners(root).list; return l[l.length - 1 - i] || null; }
// average balance over the logged corners: + understeer, - oversteer
function tms_cnTrend(root) {
  var l = tms_corners(root).list, sum = 0, k;
  if (l.length < 3) { return null; }
  for (k = 0; k < l.length; k++) { sum += l[k].k === 'us' ? l[k].d : (l[k].k === 'os' ? -l[k].d : 0); }
  return { m: sum / l.length, n: l.length };
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
    case 'znRow': b = tms_step(root); v = tms_zrows(b)[i]; if (!v) { return i === 0 ? (b.n < 10 ? 'waiting for data' : 'no braking zone yet') : ''; } x = v.z; return (v.live ? '>' : ' ') + '#' + tms_pad(x.idx, 2) + ' ' + tms_pad(Math.round(x.entry * 3.6), 3) + '>' + tms_pad(Math.round(x.minSpeed * 3.6), 3) + ' ' + tms_pad(Math.round(x.peak * 100), 3) + '% ' + x.decel.toFixed(1) + 'g ' + x.trail.toFixed(1) + 's' + (x.abs ? ' A' + x.abs : '') + (x.lock ? ' L' : '');
    case 'znColor': b = tms_step(root); v = tms_zrows(b)[i]; if (!v) { return TMS_COL.dim; } return v.z.lock ? TMS_COL.bad : (v.live ? TMS_COL.y : (v.z.abs ? TMS_COL.warn : TMS_COL.white));
    case 'evRow': b = tms_step(root); v = tms_evrows(b)[i]; if (!v) { return i === 0 ? 'no events yet: slides, lock-ups, ABS, TC' : ''; } return 'L' + (v.lap === null ? '-' : v.lap) + '   ' + (v.lt === null ? '--' : tms_fmtShort(v.lt)) + '   ' + tms_evText(v) + (v.v === null ? '' : '   ' + Math.round(v.v) + ' km/h');
    case 'evColor': b = tms_step(root); v = tms_evrows(b)[i]; if (!v) { return TMS_COL.dim; } return v.type.indexOf('LOCKUP') === 0 ? TMS_COL.bad : (v.type === 'SLIDE' ? TMS_COL.warn : TMS_COL.text);
    case 'lockN': b = tms_step(root); x = [0, 0, 0, 0]; v = SHP.eventList(b.st); for (r = 0; r < v.length; r++) { if (v[r].type.indexOf('LOCKUP') === 0 && v[r].lap === b.lap) { x[+v[r].type.slice(6)]++; } } return x[i];
    case 'lockText': b = tms_step(root); x = [0, 0, 0, 0]; v = SHP.eventList(b.st); for (r = 0; r < v.length; r++) { if (v[r].type.indexOf('LOCKUP') === 0 && v[r].lap === b.lap) { x[+v[r].type.slice(6)]++; } } return 'LOCK-UPS THIS LAP    FL ' + x[0] + '    FR ' + x[1] + '    RL ' + x[2] + '    RR ' + x[3];
    case 'lockColor': b = tms_step(root); v = SHP.eventList(b.st); for (r = 0; r < v.length; r++) { if (v[r].type.indexOf('LOCKUP') === 0 && v[r].lap === b.lap) { return TMS_COL.bad; } } return TMS_COL.text;
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
    case 'cnRow': v = tms_cnrow(root, i); if (v === null) { return i === 0 ? 'no corner yet (30 km/h and 0.3 g)' : ''; } return tms_pad('L' + (v.lap === null ? '-' : v.lap), 3) + ' C' + (v.n < 10 ? '0' : '') + v.n + ' ' + tms_pad(Math.round(v.v), 3) + ' ' + v.g.toFixed(2) + ' ' + tms_pad(Math.round(v.st), 3) + '\u00b0 ' + (v.b === null ? tms_pad('--', 5) : tms_pad(v.b.toFixed(1), 4) + '\u00b0') + ' ' + (v.k === 'us' ? 'US ' + v.d.toFixed(1) + '\u00b0' : (v.k === 'os' ? 'OS ' + v.d.toFixed(1) + '\u00b0' : 'NEUTRAL'));
    case 'cnColor': v = tms_cnrow(root, i); return v === null ? TMS_COL.dim : (v.k === 'us' ? TMS_COL.warn : (v.k === 'os' ? TMS_COL.bad : TMS_COL.ok));
    case 'cnTrend': v = tms_cnTrend(root); if (v === null) { return 'TREND  needs 3 corners'; } return 'TREND  ' + (v.m > tms_phys().balanceNeutralDeg ? 'UNDERSTEER ' + v.m.toFixed(1) + '\u00b0' : (v.m < -tms_phys().balanceNeutralDeg ? 'OVERSTEER ' + (-v.m).toFixed(1) + '\u00b0' : 'NEUTRAL')) + '  (last ' + v.n + ')';
    case 'cnTrendColor': v = tms_cnTrend(root); return v === null ? TMS_COL.dim : (v.m > tms_phys().balanceNeutralDeg ? TMS_COL.warn : (v.m < -tms_phys().balanceNeutralDeg ? TMS_COL.bad : TMS_COL.ok));
    default: return tms(key, root, i);
  }
}
