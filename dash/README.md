# Telemetry Master Suite: SimHub dash, build 0.1 (JS only)

**File to import:** `dash/out/TelemetryMasterSuite.simhubdash` (1920x1080, one screen, ACC and Assetto Corsa).
**Status:** generated and validated offline. It has **not been opened in SimHub yet**; see `TO_VERIFY.md` sections K and L for everything that needs eyes on a real SimHub.

## Install
1. Copy `TelemetryMasterSuite.simhubdash` somewhere you can browse to.
2. SimHub, Dash Studio: import the file (the exact menu wording may differ by version). It contains the screen, the images and three JavaScript extension files (`physics.js`, `adapters.js`, `tms_dash.js`).
3. Start ACC or AC and open the dash on your second monitor.
4. If anything shows "n/a" that should not, note which panel and send me a property catalog taken while driving (see `TO_VERIFY.md` section F).

## What is live (works without the plugin)
- **Header:** corner phase bar (straight, braking, trail, coast, rotation, power), position, gaps (ACC), flag, session time, temperatures, data tag.
- **Slip view:** body slip angle (ACC from local velocity, AC from world velocity with self-calibrating heading), band word and colour, the car drawing with the travel arrow turning with beta, grip-coloured wheel indicators, load-centre dot, 6 s traces (beta, steer, brake, throttle), balance meter and word, grip use per tyre.
- **Tyres (4 cards):** core temperature with state, pressure vs target, wear, slip, load, travel, tread inner/middle/outer bars, 20 s core-temperature and pressure graphs (auto-ranged).
- **Braking:** four disc cards (temperature, state word, peak this lap, rate, pad/disc life, 20 s graph with bands), peak brake, trail time, peak decel, bias, pedal overlap, ABS state and hits, rolling 20 s brake trace.
- **Lap timing:** delta (SimHub's own delta to session best) with a rolling delta graph, predicted/best/last lap, sector times and bests.
- **Driver inputs:** gear, speed, rpm and rev bar, TC/ABS, the MOZA wheel turning with your steering input, throttle/brake/clutch bars, 20 s pedal and steering graph.
- **Dynamics:** lateral g, longitudinal g and yaw rate (6 s), corner-load bars on the car drawing with front/rear and left/right shares.
- **Suspension:** four 6 s travel traces, pitch and roll cars (drawn x10 and x6).
- **Fuel:** laps left (coloured), fuel, per lap, race laps left, fuel to add, race timeline over a fuel-range bar ("short by X laps").
- **Systems:** oil, water, boost with 90 s sparklines.

## What needs the C# plugin (shown as labelled placeholders, nothing fake is drawn)
Lap history table, best-lap comparison on the brake cards, braking-zone roadbook, steer reversals and throttle smoothness, event log, lock-up counters, best-lap dashed overlays (pedal graph and brake trace), bottom-out counters, track map. These all need state that SimHub does not keep (best lap stored by track position, lap lists, event history).

## Known limits
- Not supported yet: iRacing (side project), other sims. On an unsupported game the dash shows "n/a" and the data tag says "unsupported".
- Each JavaScript formula keeps its own state, so anything that learns (grip reference, phase, load-centre reference) restarts independently per formula. The plugin will replace this.
- Skewed phase segments, angled panel corners and the slip wedge from the mock are not reproduced (no skew or clip in Dash Studio).
- Pad and disc life are shown as raw numbers until the unit is verified.

## Rebuild
```
node build/build_dash.js      # geometry + bindings -> .djson
python build/package.py       # -> dash/out/TelemetryMasterSuite.simhubdash
npm test                      # unit tests, ES5 check, dash validation (schema, ES5, all formulas run)
node build/preview.js acc 25.5   # render the generated dash from simulated telemetry (HTML)
```
The layout comes from `build/geometry.json`, extracted from the approved mock (`mock/v3`) by `mock/geom.ps1`. To change the layout, change the mock, re-extract, rebuild.
