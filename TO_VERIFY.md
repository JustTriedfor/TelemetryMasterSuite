# TO_VERIFY: things only you can confirm inside SimHub

> **Working checklist.** Kept while the dash was built and written as notes to its owner (hence "you" and "I"). Later sections and updates replace earlier ones, and some boxes were settled in later rounds without being ticked, so read it together with *Known limits* in [README.md](README.md), which is the current summary.

Open SimHub, start a session in each sim, then check the **Properties** tab (search box) for each item. Tick them off here.

> **Update (property catalog received):** ACC names are now confirmed to exist (see property-map.md, status C). This resolves the ACC part of section B and the `wheelSlip` question in C. ACC has real `SlipAngle`/`SlipRatio`. Open items are meaning/sign/units (needs a catalog or readout taken while driving), plus everything for AC and iRacing, which were not catalogued.
> Also corrected: there is no "use JavaScript" tick box in your Dash Studio, so ignore my earlier test-formula steps. Where a check needs a formula, we build it into the dash from the reference file format instead.

> **Update 2 (AC catalog received, no rig access right now):** AC names confirmed. AC has no car-local velocity and no split slip angle/ratio. The dash will work from what is available: AC beta uses world velocity and heading with a **self-calibrating** convention (learns from straights), and AC grip/balance are labelled estimated. Everything that needs a real drive is listed below and will be handled by in-dash settings or self-calibration where possible.

## A. Engine and format
- [ ] Which JS engine does `Interpreter: 1` use? The friend's dash (SimHub 9.12.9) uses `const`, `?.`, `??`. Test: make a throwaway formula `var a = 1; return a;` and another `const a = 1; return a;` in your SimHub version and see if the second errors. We keep ES5 regardless.
- [ ] Your SimHub version (Settings or About) and .NET target of its plugin SDK.
- [ ] A hand-built `.djson` imports cleanly. Plan: you save an empty 1920x1080 dashboard from Dash Studio, and our build script fills in its screens.
- [ ] Whether functions in `JavascriptExtensions/*.js` really are visible to every formula on your install (the friend's dash relies on this).

## B. Names that I could not verify (all `D` or `?` rows in property-map.md)
- [ ] `OilTemperature`, `WaterTemperature` exist (bare names).
- [ ] ACC/AC: `GameRawData.Physics.velocity`, `heading`, `pitch`, `roll`, `localAngularVel`, `accG`, `steerAngle`, `wheelLoad`, `wheelSlip`, `suspensionTravel`, `wheelAngularSpeed`, `camberRAD`, `turboBoost` exist, and each array property returns an array (like `tyreCoreTemperature` does in the friend's code).
- [ ] AC: `tyreTempI`, `tyreTempM`, `tyreTempO`.
- [ ] iRacing: `GameRawData.Telemetry.VelocityX/Y/Z`, `Yaw`, `Pitch`, `Roll`, `YawRate`, `LatAccel`, `LongAccel`, `SteeringWheelAngle`, `LFshockDefl`, `LFshockVel`, `LFtempCL`, `LFtempCR`.

## C. Meaning, units and sign conventions (these decide whether beta is right)
- [ ] ACC/AC: are `heading` and `velocity` in the same world frame? What is the relation (does `velocity` rotated by `heading` give forward speed, or do I need a 90-degree offset or a sign flip)? **Probe:** drive straight at 150 km/h; the physics library's beta must read near 0. I will build a one-click "convention probe" into the mock/dash so you can read the raw numbers.
- [ ] iRacing: are `VelocityX/Y/Z` car-local or world? If car-local, beta is `atan2(VelocityY, VelocityX)` or similar and needs no heading. Probe: stand still then drive straight and look at which axis moves.
- [ ] `Yaw` vs `YawNorth` in iRacing and which one pairs with the velocity vector.
- [ ] ACC `wheelSlip`: slip angle or slip ratio? Units?
- [ ] Throttle, brake, clutch scale: 0..1 or 0..100 (the friend multiplies `Physics.brake` by 100, so raw is 0..1; the bare `Brake` is unknown).
- [ ] Units of `TyrePressureUnit` values (strings) and of `BrakeBias`.
- [ ] Type of `CurrentLapTime`, `BestLapTime`, `LastLapTime`, `SessionTimeLeft` (number of seconds or TimeSpan). The adapter accepts both, but formatting depends on it.
- [ ] Sign of yaw rate and steering angle for a left turn.
- [ ] `DataCorePlugin.CurrentGame` string for Assetto Corsa (the friend's code compares to `AssettoCorsa`).

## D. Performance
- [ ] With the final dash running, note SimHub's CPU / frame-time readout with the dash on vs. hidden. Target: no measurable frame drops at your usual dash refresh rate.

## E. Estimated alternatives for iRacing (physics.js: `estBalance`, `estLoadCenter`)
These are shown in the UI with an "estimated" label and are kept apart from the real per-tyre ACC/AC versions (`balance`, `loadCenter`). iRacing gives no tyre load or slip, so they are inferred from other channels.
- [ ] **Estimated balance** compares measured yaw rate with what the steering input predicts. It learns `yawRate / (speed * steer)` per 10 m/s speed bucket while lateral g is low, then flags understeer when yaw rate falls short at higher g. Check: the first laps show "calibrating" (null) until each speed bucket has data; after that, a deliberate understeer push should read positive and a snap of oversteer negative. It cannot tell a front slide from a rear slide in a tyre-level sense and it will lag at speeds you rarely drive in the linear range. Treat it as a trend.
- [ ] Sign and units of `SteeringWheelAngle` and `YawRate` in iRacing. The estimate learns the sign of `k` itself, so it still works if both are flipped, but not if only one is wrong in the middle of a session (it doesn't happen within a session).
- [ ] **Estimated load centre**, source "shock": uses `LFshockDefl` etc. as a proxy for corner load and the static point learned while stopped. Check: sign of shock deflection (is compression positive? config `shockSign` flips it) and that the dot moves forward under braking and to the outside in a corner. Springs differ front and rear, so the dot's scale is only relative.
- [ ] Source "accel" (fallback when shock data is missing): uses lateral and longitudinal acceleration only. Check the signs with config `latGSign` and `longGSign`: under braking the dot must move forward, and in a left turn it must move right.
- [ ] iRacing `LatAccel` and `LongAccel` include gravity per the SDK; the adapter divides by 9.80665 but does not remove the gravity term. Check at standstill on flat ground that they read about 0 (if not, subtract the standstill value).
- [ ] ACC/AC lock-up detection relies on `wheelAngularSpeed` and a rolling radius learned while coasting; check wheel speed is rad/s and not rpm.

## F. Next catalogs (replaces most manual checking)
You can generate the property catalog JSON again with the same method you used for the first one. Please send:
- [ ] **ACC while driving:** one catalog captured while stopped in the pits, and one captured mid-corner or under hard braking (values are in the file). Say which direction you were turning. This settles the sign of `SteerAngle`, `AccG`, `LocalVelocity`, `LocalAngularVelocity` and the units of `Brake`, `Throttle`, `SlipAngle`.
- [ ] **ACC driving straight at ~150 km/h:** one capture. Beta computed from `LocalVelocity` must be about 0.
- [ ] **iRacing** (any session, on track) and **Assetto Corsa**: one catalog each while driving. Those two sims are not in the first file.

## G. Things that stay unverified until you can drive (no catalog values yet)
- [ ] ACC `LocalVelocity`: assumed x = lateral, z = longitudinal, lateral positive to the right (`localLongIdx` 2, `localLatIdx` 0, `localLatSign` 1). If beta reads backwards in a corner, flip `localLatSign`; if it reads near 90 degrees on a straight, swap the indices. Drive straight: beta must be about 0.
- [ ] AC world frame assumes x,z is the ground plane (y up). The self-calibration shows a `calibrated` flag; after a lap of straights it should be true. If it stays false, the assumption is wrong and we need one drive capture.
- [ ] Units of `OrientationYawVelocity` (rad/s vs deg/s) and sign for a left turn. Only the estimated balance uses it and it learns its own scale and sign, so a mismatch does not break it.
- [ ] `Brake`, `Throttle` scale (0..1 vs 0..100): until verified the dash normalises by treating values above 1 as percent.
- [ ] Whether SimHub reports `TyreCoreTemperature` etc. in Celsius (the adapter honours `TemperatureUnit`).
- [ ] iRacing: still no catalog, so every iRacing name is unverified (property-map.md, status D).

## H. Stage 4 import checks
- [ ] A `.simhubdash` with `BaseWidth/BaseHeight` and metadata `Width/Height` changed from 1280x720 to 1920x1080 imports and shows at 1920x1080.
- [ ] Bahnschrift SemiCondensed renders in Dash Studio on your machine (it is a Windows system font). If not, I embed a font in `_SHFonts` instead.
- [ ] Tinted PNG shapes (angled corners, slanted segments) can have their colour changed by a binding (the reference dash does this with images, but I have not confirmed the exact property).

## I. Brake pad and disc life (ACC)
- [ ] `Physics.padLife01..04` and `discLife01..04`: unit (percent remaining, millimetres, or something else), direction (does it count down as it wears?), and typical starting values. The dash shows the raw number until this is known.
- [ ] AC: the AC catalog has no pad/disc life; iRacing: not catalogued. Both show n/a.

## J. Car drawings in Dash Studio
- [ ] PNG with transparency (light lines on nothing) renders correctly on the dash's dark background in an image item, and the image item's `Rotation` binding turns it about its centre. The roll view looks best turning about the bottom edge (the tyres); if only a centre pivot is available I will pad the image so the pivot sits at the ground line.
- [ ] Final image sizes: the PNGs are 340-770 px wide; I will downscale them to the size they are shown at to keep dash memory low.
- [ ] Pitch and roll sign for ACC (`Pitch`, `Roll`) and iRacing (`Pitch`, `Roll`): which direction is positive. Accelerate hard in a straight line (nose should go up) and take a left corner (body should lean to the right).
- [ ] The drawings are manufacturer design-patent artwork. Fine for your own dash; if you ever share the `.simhubdash` publicly, check you are happy to include them.

## K. Stage 4 dash: first import (nothing below has been seen in a real SimHub)
Correction to an earlier note: in a formula, `"Interpreter": 1` is the **JavaScript** switch and `"JSExt": 1` lets the formula call the JavascriptExtensions functions. Plain NCalc formulas have neither field. The dash uses `Interpreter 1` + `JSExt 1` everywhere.
- [ ] The `.simhubdash` imports without errors, shows at 1920x1080 and lists three extension scripts. If SimHub rejects it, send me the error text and the SimHub log file.
- [ ] Extension globals: `SHP`, `SHA`, `tms2`, `tms`, `tmsr` are visible from formulas, and `new Date().getTime()` works inside a formula.
- [ ] Text items: `HorizontalAlignment` 0 = left, 1 = centre, 2 = right; `VerticalAlignment` 1 = centre; `FontSize` is in pixels; the font "Bahnschrift SemiCondensed" is installed and used.
- [ ] Image items accept a `Rotation` binding, in degrees, clockwise positive, turning about the image centre. The wheel, the travel arrow, the pitch car and the roll car depend on it (the pitch/roll images are padded so the pivot is at the ground line).
- [ ] Rectangle items accept `Width`, `Height`, `Left`, `Top` and `BackgroundColor` bindings (bars, needle, load bars use them).
- [ ] Charts: `MinimumRefreshIntervalMS` sets how often a chart takes a point (so 200 points at 100 ms = 20 s), `PointsCount` is the window, and `Minimum`/`Maximum` can be bound (used for the auto-ranged tyre graphs; if not, the graphs fall back to the fixed 60-115 degC and 25-30 psi ranges).
- [ ] Ellipse item `Left`/`Top` bindings (load-centre dot).
- [ ] Colours: bindings return `#AARRGGBB` strings.
- [ ] Performance: 624 items, 270 formulas, 33 chart items. Check SimHub's CPU/frame time with the dash running; if it is heavy, I will reduce chart refresh rates and merge items.

## L. Raw-value assumptions in `tms_dash.js` (all ACC/AC)
- [ ] `Physics.SteerAngle` scale: the dash assumes +-1 is full lock (`TMS_CFG.steerFull`), and the wheel turns +-270 degrees. If SteerAngle is in radians or degrees the wheel will look wrong; one constant fixes it.
- [ ] `DataCorePlugin.GameData.Throttle/Brake/Clutch` scale (0..1 or 0..100): handled by treating values above 1 as percent.
- [ ] `Graphics.gapAhead/gapBehind` unit: assumed milliseconds.
- [ ] Lap/sector time property types (number, TimeSpan or text): all go through one parser; if lap times show `--:--.---` the type needs checking.
- [ ] `Sector3LastLapTime` and `Sector3BestLapTime` are used for sector 3 because those are the sector-3 names in your catalog; sector 1 and 2 use `Sector1Time`/`Sector2Time`.
- [ ] `Fuel_RemainingLaps` / `Fuel_LitersPerLap` need a few completed laps before SimHub fills them.
- [ ] Total race laps (`TotalLaps`) is 0 or missing in timed sessions: the strategy bar shows "laps unknown" there.

## M. "This dash doesn't exist anymore" (first import failed)
**Suspected cause, now fixed:** the first package had the metadata `Title` "Telemetry Master Suite" (with spaces) while the folder and files were `TelemetryMasterSuite`. In both known-good packages (the template: Title null; the friend's dash: Title identical to the folder and file names) the two agree. The main package now has Title == folder == file name (`TelemetryMasterSuite`).
**Diagnostic ladder** (in `dash/out/`, import in this order and stop at the first one that fails):
1. `TMSL0.simhubdash`: empty 1920x1080 screen (your template renamed). Fails: packaging, naming or the import location is the problem, not the dash content.
2. `TMSL1.simhubdash`: 583 rectangles and text items, no bindings, no images. Fails: item content (text, fonts, colours, numbers).
3. `TMSL2.simhubdash`: adds images and chart items, still no bindings or scripts. Fails: images/resources or the chart items.
4. `TelemetryMasterSuite.simhubdash`: bindings and extension scripts. Fails: a formula, a bound property name or the extension scripts.
For any failure, the most useful thing is the SimHub log (it records why a dash could not be loaded) and the exact rung that failed.

## M2. Ladder result so far and the second fix
- TMSL0 (empty) and TMSL1 (rectangles + text) imported. **TMSL2 failed** with the same "dash doesn't exist anymore" message. So packaging, naming and the Title are fine, and the problem is in images, chart items or the ellipse.
- Compared against 4 of SimHub's own packages (the friend's four dashes, ~3400 images, 30 chart items, 59 ellipses, 320 image items): image registration already matched (name+extension, `Modified`/`Optimized`, Length and MD5 equal to the zip entry, zip compression 8). The difference found: **chart properties are always whole numbers in SimHub's files** (`LineTickness` 30 of 30, `Maximum`, `Height`, `Top`), while mine had `1.4`, `1.7`, `2.5`, `1.2`. If `LineTickness` is an integer property, the decimal makes the loader throw.
- Fix: all geometry values and chart settings are now whole numbers (chart min/max/points are enforced in the generator; boost chart now 0..12 on a x10 key). A test now fails the build if any decimal appears where every reference item holds a whole number.
- Because I cannot prove that was the only cause, TMSL2 is split: **TMSL2A** images only, **TMSL2B** charts only, **TMSL2C** ellipse only. Test **TMSL2** first (all three fixed together). If it fails, test 2A, 2B, 2C to see which one; send the SimHub log for the failing one.

## N. Fixes after the first real run (AC, Nordschleife practice)
- Pitch/roll are now **relative to the road**, computed from suspension travel (left vs right, front vs rear) using a track width of 1.6 m and a wheelbase of 2.5 m (`TMS_GEO`), so banking (Karussell, about 17 degrees) and hills no longer look like body roll. Assumes `SuspensionTravel` increases with compression: if the cars lean the wrong way (accelerating should lift the nose, a left corner should lean the body right), tell me and I flip the sign. The drawing is clamped to +-25 degrees.
- Fuel: laps to go now comes from the race (`RemainingLaps` or `TotalLaps`-`CompletedLaps`), else session time divided by your best or last lap, else a **planning target of 5 laps** (`TMS_CFG.lapsTarget` at the top of `tms_dash.js`; edit it for long runs). The label says which source it used.
- Lap timing: with no session best yet, the big number is the live lap time (label says so); times of 0 show dashes; sectors of a minute or more read `m:ss.xx`; session time left at or below 0 shows `--`.
- Peak decel ignores spikes above 8 g (the screenshot showed 54 g, probably a kerb hit); the real axis order of `AccG` in AC is still unverified.
- Not changed yet, seen in the screenshot: tyre "WEAR 97%" looks like remaining life in AC (label may need to read LIFE); grip use stays at "learning" for about 30 s after a restart.

## O. Second real run: layout and signal fixes (read the screenshot, not the preview)
Found by looking at the user's real AC screenshot instead of trusting my HTML preview. Fixed and covered by tests; **none of it re-checked in a real SimHub yet**.
- **Text clipping**: SimHub clips a Text item to its box. Every live text box is now sized for the longest string its key can produce (`MAXCH` table in `build_dash.js`, written to `build/maxchars.json`; a test fails the build when a box is too narrow). This fixed the clipped disc state word ("COL"). The 0.56 em per character estimate is for Bahnschrift SemiCondensed and is conservative. If anything is still clipped on your screen, tell me which box.
- **Labels overlapping digits**: GEAR / SPEED / RPM labels moved above the digits, disc graph "650" label dropped (it sat on "750"), load numbers moved clear of the bars.
- **Phase tabs**: the six header labels were static (TRAIL BRAKE was near-black on dark because the mock was captured while trail braking was lit). They now switch with the phase (`phaseText`). Flag text colour now follows the flag (`flagColor`; flag names GREEN / YELLOW / BLUE / RED / BLACK are a guess, other names show white).
- **Balance**: the thin needle (a `Left` binding, never proven) is replaced by a nine-segment bar lit with `BackgroundColor` bindings, the mechanism already proven by the phase bar and grip bars. Value is (mean front |slip| - mean rear |slip|) / sum, only while speed > 30 km/h and |lateral g| > 0.3, smoothed. Word and colour come from the same number (`balWord`, `balColor`), so they can no longer disagree with the bar.
- **Steering wheel**: sign was probably inverted. `TMS_CFG.steerRightPositive` (default true) assumes SteerAngle > 0 = steering right and draws it clockwise. The dash now prints `raw -0.37` next to the angle. **Check: turn your real wheel right; the dash wheel must turn clockwise and say R.** If not, set `steerRightPositive: false`. Scale: `steerFull` 1 = raw 1.0 is full lock (270 degrees drawn); the raw value you read will confirm or refute that.
- **Yaw trace**: now derived from the change of `Physics.Heading` (wrap-safe, clamped to 150 deg/s). Assumes Heading is radians.
- **Probe dash `TMSProbe`**: import it, drive one lap and screenshot it. It prints the raw value and JS type of 78 properties (SteerAngle, Heading, Pitch/Roll, AccG, Velocity, LocalVelocity, slip, load, travel, temps, pad/disc life, lap times, fuel). Red rows mean the property does not exist in that game. That settles most of section L at once.

## P. First TMSProbe run (real AC, car rss_gtm_protech_p92_f6, lap 3, 92 km/h in a right-hand corner) - screenshot: `build/inspect/probe_ac_run1.png`
**Measured** (read straight off the screenshot):
- Types: every numeric property is a JS number; `Gear` is a **string** ("2"); `CurrentLapTime`, `BestLapTime`, `LastLapTime`, `Sector1BestTime`, `SessionTimeLeft` are **.NET TimeSpan objects** (typeof object, text "00:00:20.2860000", practice session time left is negative "-00:05:26.7380000"). `Flag_Name` is an empty string.
- **Missing in AC** (undefined): `SlipAngle01..04`, `SlipRatio01`, `LocalVelocity01..03`, `padLife01`, `discLife01`, `Graphics.gapAhead/gapBehind`, **`GameData.DeltaToSessionBest`**, `Sector1Time`, `Sector2Time`, `Sector3LastLapTime`. (The AC catalog lists `Sector1Time` etc., so a name in the catalog does not mean AC fills it.)
- `OrientationYawVelocity` is **0** (unusable in AC; yaw now comes from Heading). `OilTemperature` and `WaterTemperature` are **0** in AC (now shown as n/a). `Computed.Fuel_LitersPerLap` and `Fuel_RemainingLaps` are **0** on lap 3 (now estimated from our own measured lap).
- `WheelSlip01` = 0.41, `WheelSlip02` = 0.36 at 1.27 g: not an angle in degrees or radians that fits a road car, so the dash now shows it as a plain number (e.g. `0.41`) when there is no slip angle (AC).
- `TyreWearFL` = 98.45 on a nearly new tyre: AC reports **remaining life** (label now says LIFE in AC; ACC unverified).
- Magnitudes: Heading -2.289, Pitch -0.012, Roll -0.024 are small radians-looking numbers (Heading within +-pi); `Velocity01..03` is world velocity in m/s (its length 25.6 m/s = 92.2 km/h, matches `SpeedKmh`); `WheelLoad01..04` = 5615 / 964 / 6838 / 1639 N (sum 15056 N, about a 1535 kg car); `SuspensionTravel` 0.053..0.075 (metres); `BrakeTemp` 490 / 434 / 395 / 387 C; `TyreCoreTemperature01` 83 C; `TyrePressureFL` 26.7 (psi).
**Inferred, not proven** (one frame): all four wheel loads and the suspension say the left side was loaded and compressed, so the car was in a **right-hand** corner. In it `SteerAngle` was **+0.199** and `AccG01` **-1.27**. That agrees with `steerRightPositive: true` (SteerAngle > 0 = steering right) and with `AccG01 > 0` meaning a left turn (the lateral-g legend says "+ left"). `AccG03` = -0.166 while coasting at 0% throttle and 0% brake suggests negative = decelerating. `Heading` came out as about -(atan2(Velocity01, Velocity03)) (-2.289 vs -2.300): the sign is opposite to the world velocity angle, which the frame calibration is built to learn.
**Found while checking names against the catalogs**: the ACC catalog spells `slipAngle01` / `slipRatio01` with a lower-case first letter; the code asked for `SlipAngle01`. It now tries both spellings (whether `$prop` is case-insensitive was never verified).
**Still to measure** (probe v2 adds min/max so one lap is enough): full-lock SteerAngle both ways (scale), pedal scale, brake and throttle peaks, `AccG03` under braking, whether `PersistantTrackerPlugin.SessionBestLiveDeltaSeconds` has a value in AC (the delta now falls back to it), sector alternatives, lap history `PersistantTrackerPlugin.PreviousLap_00..`.

## Q. Steering wheel image stretched when it turned (user report, 2026-11-02)
- Symptom (user): the wheel PNG stretches "up and down". Cause not seen directly. Hypothesis: SimHub re-fits a rotated image to the item box, and the wheel was a wide 900x500 image in a wide 92x51 box, so every rotation changed its aspect. The other rotating images (cars, arrows) turn only a few degrees, so a mild version would be hard to notice.
- Fix: `dash/assets/wheel_sq.png` (518x518, the wheel centred at half resolution; made by `tools/make_wheel_sq.py`) in a **square 106x106 box**, so the box aspect never changes; the wheel is still 92 px wide. A test requires the wheel to be a square image in a square box and every image box to match its image aspect within 2%.
- **To verify**: the new `TMSProbe` has a ROTATION TEST in the bottom-right: the old wide image (top row) and the new square one (bottom row) at 0 / 45 / 90 / 135 degrees (static `Rotation`) and one spinning (bound `Rotation`), each inside a faint outline of its box. If the top row stretches and the bottom row does not, the hypothesis is right. If both stretch, the stretching comes from somewhere else and the screenshot will show how (also compare static against spinning: a bound Rotation might behave differently from a static one).
- The probe's former "SESSION AND CAR" group (session type, track, car model, pit flags) was dropped to make room; its names are in the catalogs and can come back.

## R. The annotated screenshot (user's improvement map, 2026-11-02): checks = fine, circles = unclear, crosses = broken
Image saved as `build/inspect/annot/user_annotated_1.png` (panel crops next to it). **Checks** (left alone): phase tabs, position, flag, track/air, data tag, delta number, brake trace, pedal overlap, ABS, the four brake cards, disc cards, slip view (beta, car, traces, balance), tyre cards, driver inputs including the wheel, dynamics, suspension and ride, fuel numbers.
**Crosses, and what I did** (none of it seen in a real SimHub yet):
- GAP AHEAD / GAP BEHIND: AC has no gap data (no `gapAhead`, and the catalog has no opponent gap property). In AC the two cells now read LAP and LAST LAP; in ACC they stay gaps. Real gaps need the C# plugin.
- SESSION LEFT `--`: in practice the time left is negative (the AC probe showed `-00:05:26`), so it now counts elapsed time and the label switches to SESSION TIME.
- SECTOR 1/2/3: AC does not fill `Sector1Time` etc. They are now timed from `GameData.CurrentSectorIndex` (fallback `Graphics.CurrentSectorIndex`) with `LastSectorTime` when it changes, else from `CurrentLapTime`. Purple = equals the best sector, dim = last lap's value until this lap replaces it. **Unverified: that the index exists in AC and counts from 0.**
- LAP / TIME / VS BEST and the "lap history needs the plugin" line: five rows from SimHub's own `PersistantTrackerPlugin.PreviousLap_00..04` and `_DeltaToSessionBest`; row 0 falls back to `LastLapTime`. **Unverified: that the tracker fills them in AC.**
- BRAKING ZONES, EVENT LOG, LOCK-UPS, STEER REVERSALS, THROTTLE SMOOTH: no plugin after all. Every row formula runs its own copy of the detector in `physics.js` on the same inputs, so all rows agree (`tms_step` in `tms_dash.js`, one step per clock tick). The cost is some duplicated work and the lists start empty when the dash starts. Lock-ups need `WheelAngularSpeed01..04` (in both catalogs, **unverified at runtime**).
- SYSTEMS panel: oil, water and boost are 0 or n/a in AC, so the rows are gone. The panel is now EVENTS AND TRACK: event log on the left (one line `OIL .. WATER ..` appears at its bottom only when the game gives temperatures), track map on the right.
- TRACK MAP: 72 dots each remember the car's position in 1/72 of the lap (`NormalizedCarPosition`, `CarCoordinates01/03`), so the outline draws itself over the first lap and then stays; one yellow dot is the car. Depends on `Left`/`Top` bindings on rectangles (the load-centre dot already moves, so they work) and on the position properties (**unverified**: probe v4 rows).
**Circles**:
- Delta chart: the range was fixed at +-1 s, so a -6.7 s delta sat off the scale. The range now follows the last minute in 0.5 s steps (never below +-1 s), the axis labels show it, and the line is thicker.
- Grip use cards: 0 to 1 % came from the reference peak being pinned by one spike. The peak now rises gradually, halves every 90 s, and the percentage is bigger and says "of recent peak". Test: one slip spike of 100x leaves the card readable.
- Fuel bars: the race-progress bar and the fuel-range bar are replaced by one verdict ("+1.7 laps spare" / "SHORT by 0.8 laps") above one bar (fuel range against the laps left, NOW to FINISH).
**Cost**: the dash went from 621 items / 271 live bindings to 700 / 541 (the map dots are 219 of them, refreshed at 4 Hz; the zone, event and lock-up rows at 10 Hz). Watch SimHub's CPU on the first run. If it is heavy, reduce `N` in the map block of `build_dash.js` or the row counts.
**Probe v4** adds the rows these panels need (sector index and time in both `GameData` and `Graphics`, the tracker's previous laps, `NormalizedCarPosition`, `CarCoordinates01/03`, wheel speeds).

## S. Blank dashes after the map-round import (2026-11-02): SimHub served a stale definition
- **Symptom**: `TelemetryMasterSuite` and `TMSProbe` imported fine but showed only black. SimHub's log had no error.
- **Cause (measured)**: SimHub's web server builds the definition the client renders (`/Dashtemplates/Definition/?dash=...`) and caches it **by the dash file's modified time**. My packages stamped every file with a fixed time (2026-11-01 12:00), so after a re-import the file on disk was new but looked unchanged, and the server kept serving the previous build: 92 items for the probe (the file had 147) and 621 for the main dash (the file had 700). The server then pushed values for components the client never received, the client threw `Cannot read properties of undefined (reading 'Item')` in `registration.js`, and the screen stayed black.
- **Fix**: `build/package.py` now stamps entries with the build time, so every re-import changes the modified times. For the copies already installed I changed only the modified time of the files in `Program Files (x86)\SimHub\DashTemplates\TelemetryMasterSuite` and `...\TMSProbe` (no content change); both then loaded. If a re-imported dash ever shows blank again, restarting SimHub clears the cache.
- **How it was found, and a live acceptance test**: `node tools/cdp_dash.js <DashName> [seconds] [out.png] [--caught]` opens the dash in SimHub's real web client (headless Edge over the DevTools protocol, SimHub must be running), prints console output and uncaught exceptions, counts rendered items, saves the served definition to `build/inspect/served_<name>.json` and a screenshot. A healthy dash renders as many items as the file holds and prints no exception. It already runs the dash against whatever values SimHub holds, so it is also the closest thing to a real-SimHub test that needs no one at the wheel.
- **What the real render showed** (game not running, last values frozen, so layout and data sources only): the header (LAP / LAST LAP / SESSION TIME), delta, sector 1, the five-lap history and the event log all work; `Tracker.SessionBestLiveDelta` and `PreviousLap_00/01` exist in AC; `CurrentSectorIndex` is a number and `LastSectorTime` a TimeSpan; `WheelAngularSpeed01..04` are in rad/s (about 132 at 163 km/h); `Sector1Time` exists in some states but `Sector2Time` and `Sector3LastLapTime` do not; `Computed.Fuel_LitersPerLap` still reads 0 although SimHub's log says it aggregated about 2.2 L per lap (probe v5 adds `Fuel_LastLapConsumption` and `Fuel_CurrentLapConsumption` to see which one carries it). The rotation test shows neither the wide nor the square wheel stretched in the real client, so the original "stretching" may come from somewhere else (the web client scales the dash to its window: `fillDiv`), or from the live value; a screenshot with the wheel turned would settle it.

## T. Sectors 2 and 3 never counted at Zandvoort (user report, 2026-11-02)
- **Cause**: the sector timer assumed `GameData.CurrentSectorIndex` starts at 0 and waited for 0 at every lap line. SimHub's AC index counts from 1: the probe showed index 2 while `Sector1Time` and `LastSectorTime` both held S1 (44.353) and `Sector2Time` was missing. The wait never ended, so only S1 (the game's own `Sector1Time`) ever showed.
- **Fix**: `tms_sec` no longer needs the base. A sector is finished when the index goes up by one; which sector is running is counted from the lap line; a decrease (the index wrapping, or lagging a few frames behind the lap line) is ignored; S3 is the lap time minus S1 and S2; the best of each sector is also kept here when the game has none (S3 had none). A dash opened mid-lap shows the game's S1 and waits for the next lap line before timing S2/S3; opened at the start of a lap it times from the first sector. Tests cover 0-based and 1-based indices, a lagging index, a mid-lap start and the best sectors.
- **Lap history gap bars** (my reading of "the bar chart for the laps"): the first version of the lap panel promised "gap bars" and the replacement table had none. Each of the five rows now has a bar: seconds slower than the session best, scaled to the slowest of the five (at least 2 s), a small purple stub for the best lap. Checked in the real client with the Zandvoort laps SimHub has stored (L4 best, L3 +0.017, L2 +1.881, L1 +13.804).
- **Unverified**: sector counting while driving (the real-client check ran with the game closed). Also unverified: that `LastSectorTime` updates at each sector line (when it does not, the time comes from `CurrentLapTime`, which is accurate to a frame).

## U. Tweak round 1 (user's second annotated screenshot, 2026-11-02): image saved as `build/inspect/annot/user_annotated_2.png`
Checked in SimHub's real web client with the game closed: 670 items drawn, no exceptions; everything below is **unverified while driving**.
- **Tyre load moved into the top-down view**: each wheel has its load in N and a bar (share of 8000 N, a GT3 outside tyre reaches about 7000) on the outer side, the split (`FRONT 46%  REAR 54%  LEFT 67%  RIGHT 33%`) is under the car; the white dot (load centre) stays. The old widget in the dynamics panel is gone (it printed `NaN%` when the game is idle; the split now says "no tyre load" when all loads are 0).
- **Removed**: the pedal overlap / steer reversals / throttle smoothness row under the inputs (the braking analysis keeps overlap), the slip view's lower pedal graph (the scribble over it; its legend entries went too, so the beta and steer plot is taller with +-5 and +-10 degree marks), and the track map (the event log now uses the whole panel, 7 rows, each with lap, lap time, event and speed; the panel is called EVENTS).
- **Dynamics panel** moved up 54 px into the freed space and is taller. The graph is **square (192 x 192)**: lateral and longitudinal g above, yaw rate below, last 6 s. Where the load widget was: a **G-FORCE** block with the live lateral and longitudinal g (numbers, direction words, centred bars, 2 g full scale) and the peaks of this lap (lateral, braking, acceleration, yaw rate; spikes above 8 g ignored).
- **Under the grip cards**: PEAK SLIP ANGLE and TIME SLIDING (beta in the amber or red band) for this lap, LAST CORNER (understeer / oversteer peak, or neutral) and CORNERS US / OS / N for this lap.
- **Lap timing**: the brake graph is half as wide and shows **10 s** (100 points at 10 Hz). Where its right half was: SECTORS vs BEST (latest finished time, best, delta, purple when equal to the best), THEORETICAL BEST (sum of the best sectors, and how much faster it is than your best lap), and AVG / SPREAD of the last five laps within 107% of the fastest of them.
- **Notes**: the HTML mock in `mock/v3` still shows the old layout (the builder now changes the geometry itself: `relayout()` in `build_dash.js`). The count of live bindings fell from 551 to 358 with the map gone. Whether SimHub's AC lateral g really is "+ left" is still the inference from the first probe (the direction words and the G-force bars depend on it).

## V. Corner log beside the event log (user, 2026-11-02: "populate the empty space beside the event log with something like Last Corner")
Checked in SimHub's real web client while the user was driving (a fresh client, so its slip angle was still uncalibrated): 681 items drawn, no exceptions, the log filled with real corners.
- **CORNER LOG** (x 1623..1903, where the track map was): one row per corner, newest first, six rows, `LAP C#  KMH LATG STEER SLIP BALANCE`, Consolas columns. A corner is what the balance meter already calls cornering (30 km/h and 0.3 g) that lasted at least 1 s; it is filed when it ends. KMH = slowest speed, LATG = peak lateral g, STEER = peak steering angle (degrees of `TMS_CFG.steerLockDeg`), SLIP = peak body slip angle (`--` when unknown or above 60 degrees), BALANCE = the same understeer / oversteer / neutral verdict as the LAST CORNER card (`tms_verdict`, shared), row colour = verdict (orange US, red OS, green neutral). The footer **TREND** is the average signed balance of the last 8 corners.
- LATG and SLIP are the **third highest sample** of the corner (`tms_top3`), so a one- or two-sample spike (kerb, glitch) cannot set them.
- C# is counted from the lap line, so it is the n-th corner the detector found, not the circuit's turn number (a chicane may count twice, a flat-out kink once).
- **Event log lap numbers fixed**: they used the completed-lap count, one lower than the header while driving (L8 in lap 9); they now use `CurrentLap` (fallback completed + 1).
- **Known limits, not fixed (the user's call)**: (1) in **AC** there is no slip angle, so the balance numbers come from `WheelSlip`, which is unitless (section P), multiplied by 180/pi and printed with a degree sign: the order (front or rear slides more) is right, the size is not in degrees, and the 0.8 "neutral" band is then only about 0.014 in slip units, so almost every corner reads US or OS. The LAST CORNER card has always had this. (2) Corners as light as 0.36 g (a kink at 180 km/h) count and get a verdict.
- The slip angle needs a few straights to calibrate in AC (`frameCalib`); until then SLIP shows `--` or odd values, in a client that has just been (re)loaded.

## W. Pitch and roll drawn at 1x (user, 2026-11-02: it "looks goofy going over a little rock", the car looks about to take off)
`TMS_GEO.pitchX` and `rollX` went from 10 and 6 to 1: the side and rear cars now turn by the true pitch and roll. The `maxDraw` clamp (25 degrees) stays and is never reached at 1x outside a crash. The labels say `(1x)`. Rendered in SimHub's real client with the game closed (681 items, 0 exceptions); how the cars look while driving is for the user to judge.

## X. Performance of 1.1 (read off the self-check line while driving)

- [x] The line says `SHARED n` (the script variables are shared between formulas in SimHub 9.12.9). Read in SimHub's own web client with no game running: `SHARED 113` and `SHARED 118`. If it ever says `PRIVATE`, 1.1 only gains from the refresh intervals.
- [x] `slow` is about 1.0/s (a minimum update interval really skips the evaluation). Read with no game running: `slow 0.9/s` against `pass 10/s`.
- [x] `hidden` is 0.0/s (formulas of hidden items are not evaluated), which makes paging worthwhile. Read with no game running: `hidden 0.0/s`.
- [ ] `pass` (how often SimHub runs a never-throttled formula) while driving. With no game it was 10/s (the idle tick); the in-game value is not known yet.
- [ ] 1.1 feels smoother than 1.0.0 on the same car and track. If not, the cause is probably not the formulas: see the checks at the end of `docs/notes/PERFORMANCE.md`.

## Y. Three pages in 1.2 (check while driving)

- [x] The screen-switch action works and the formulas of a screen that is not shown do not run (SimHub 9.12.9, test dash, no game running; the owner also flipped the test dash with a wheel button).
- [x] All three pages of `TelemetryMasterSuite_v1_2` render in SimHub's own web client (758 items, no exceptions), the pump runs on pages 2 and 3 (`pass 10/s` on every page, no game running), and `hidden` stays 0.0/s.
- [ ] A wheel button mapped to "Show next dash screen" and "Show previous dash screen" flips the three pages of the real dash on the second monitor, in the order Drive, Tyres and car, Braking and logs, and wraps around.
- [ ] Counters keep counting on a page you are not looking at: drive a lap on page 1 with page 3 never shown, then look at page 3 (lock-ups, ABS hits, peak brake, disc peaks, event and corner log) and at the sector times on page 1 after a lap spent on page 2.
- [ ] The traces (brake trace, tyre core temperature, suspension travel) continue from where they stopped when a page comes back, with no blank chart (read from SimHub's chart code, not yet seen).
- [ ] `pass` while driving on each page, and whether 1.2 feels smoother than 1.1 (record the `PERF` line of each page).
- [x] Panels enlarged to fill each page (1.18 to 1.64 times); all three pages render in SimHub's client with no exceptions.
- [ ] Is the enlarged layout right (which panel is biggest on each page, the gap at the bottom of page 1 under the slip view and the empty right column of page 3)?
- [ ] Read the dash in the real conditions (sun, speed, 500 ms): what can you take in? `docs/notes/DRIVER_REVIEW.md` predicts almost nothing below about 40 px font; the glance page it proposes is a decision, not built.

## Z. The glance page in 1.3 (check while driving)

- [x] All four pages of `TelemetryMasterSuite_v1_3` render in SimHub's own client with no exceptions (789 / 809 items); the library keys behind the glance page are unit tested (`test/glance.test.js`).
- [ ] Read page 1 in the real conditions (sun, speed, half a second). What do you get, in what order? Is anything misplaced or too small?
- [ ] Shift bar: the 70% start, the taller stage from 90% and the flash from 94.5% of max rpm suit the car (AC and ACC report `MaxRpm`; per gear thresholds are not built).
- [ ] Delta bar scale (half a second) and the colour/side convention (yellow, right = slower).
- [ ] Alerts: 125 C oil, 108 C water, 750 C brakes, fuel two laps: do they fire when they should and not otherwise? Temperature units (`TemperatureUnit`) and the disc temperature properties are inferred.
- [ ] TC and ABS blocks: 0.4 s before they show is right for how you drive.
- [ ] Lock-up alert wheel names and the 1.5 s hint; brake-bias flash (`BrakeBias` changes by 0.05 or more).
- [ ] Pit lane / below 60 km/h: the fuel to add shows. A pit-limiter or pit-lane flag property would allow a proper pit overlay (not checked in SimHub's property list).
- [ ] ACC gaps (arrow up / down) and the AC fallback (lap, last lap).

## AA. The three-page side panel in 1.4 (check while driving)

Checked offline or in SimHub's client:
- [x] All three pages of `TelemetryMasterSuite_v1_4` render in SimHub's own client with no exceptions (785 items, 582 formulas), and the tests pass (`npm test`; `test/glance.test.js` covers the pop-up, balance, load, suspension and event logic with a mock clock).
- [x] Run against the last frame of a real Assetto Corsa session (GT-M Adonis V8 Evo, left held by SimHub after the game closed): the numbers, bars, plates, the beta number with its arrow, the `SLIDE` word, the disc cards and the tyre cards all fill in; the glyphs ▲ ▼ ● ◄ draw. This found five defects, all fixed (CHANGELOG 1.4.0).
- [x] With the game closed `DataCorePlugin.GameRunning` is false (or 0): the pop-ups disappear, as the library expects.

Not checked while driving (everything below is a default or an inference):
- [ ] **Colour (added after "too monotone"):** do the cluster colours help the eye find things, and is anything too loud? In real sun, which pairs look alike (pink and red, amber and yellow, mint and green, cyan and blue)? The palette is `TMS_SC` in the library and `C` in `build/build_dash.js` (a test keeps them equal), so one edit changes it.
- [ ] **Flashing:** about 3 Hz for what needs you now (balance 2 degrees out, slide, slip 8 degrees, tyre over 105 C, pressure 1.2 psi high, disc over 750 C, bottoming, a lock-up, the newest event), 4 Hz for TC and ABS, 2 Hz for a new alert. Too much, too little, which ones would you drop? `critMs` (170 ms phase) is in `TMS_GL`.
- [ ] The g-meter on page 1 (rings 1 g and 1.5 g, left g puts the dot left, accelerating puts it up; the sign of `AccG` is inferred) and the last lock-up and last slide panel: are they what you wanted in that half, or would you rather have something else there (brake bias, the lap's peak g, the newest event list)?
- [ ] **Load:** this dash has about 582 formulas (2,500 to 3,500 runs a second on a page in the model, about the cost of the 1.1 dash). If SimHub lags, the `PERF` line and the page with the most flashing (Tyres and car) are where to look; the flash kinds run at 50 ms.
- [ ] With the game closed (seen in SimHub's client with the held frame of a spin): the pop-ups are gone, plates are steady, the balance says `--` (20 degrees of body slip or more).
- [ ] The glyphs ◐ (TRANSITION), ▦ (chequered) and » (blue) draw in SimHub's client (the others were seen).
- [ ] **Signs:** the beta arrow (positive beta, nose left of travel, tail swings right, arrow right); steering right is up in the trace; the g-g dot (left lateral g puts the dot left, acceleration puts it up); `SuspensionTravel` rising with compression; `AccG` axis order (lateral first, longitudinal third).
- [ ] **Balance:** front minus rear absolute slip, always live from 20 km/h (no corner needed, so on a straight it should read neutral); neutral within 0.7 degrees (clears at 0.5); SPIN from 20 degrees of body slip; in AC the slip angles are estimated (`EST`). Does the verdict agree with how the car feels, does it flicker on straights (the slip angles there are tiny), and is 20 km/h the right start?
- [ ] **Heading and trajectory arrows** (inside the g-meter on page 1): white is the heading (nose), yellow the trajectory (direction of travel), turned by beta times 3 (`headK`). Check the direction: a positive beta (nose left of travel) turns the yellow arrow clockwise, so in a right-hand slide with the tail out to the left it should lean right of the white one. Is x3 the right amount?
- [ ] **Slide pop-up:** 6 degrees for 200 ms fires when the car really steps out, not on kerbs or in a fast drifty corner.
- [ ] **Flags:** every flag the game raises reaches `DataCorePlugin.GameData.Flag_Name` under the name the library tests for (yellow, blue, white, red, black, chequered; chequered is tested before red because its name contains it). The timings (yellow flashes twice, 4 s block, chip, re-pop every 10 s; blue 4 s; green 1.5 s after yellow or red; black 6 s flashing then steady with the edge strip; chequered 6 s; white 3 s) are the designer's, not measured. Red hides the alert and takes the top 200 px.
- [ ] **Alerts:** oil 130 / 125, water 105 / 100, brakes 750 / 650, tyre core 105 / 100, hot pressure 0.7 / 0.5 psi above the target, fuel two laps, each with its own hold time; the rotation every 2 s when there are several; the flashing for 3 s on a new one.
- [ ] **Suspension:** ACC's `StaticInfo.SuspensionMaxTravel01..04` is read when it exists (not seen in this SimHub's property list); without it, as in AC, the bars show the travel inside the range seen so far (at least 20 mm wide) and no bottoming is counted. Is the AC bar useful, or would you rather have a fixed stroke per car?
- [ ] **Load bars** are scaled to each tyre's own peak (it rises quickly and fades slowly); the tick is a slow average (about half a minute at 60 Hz). Does the bar show weight transfer clearly, and is the F / R and L / R split the right pair of numbers?
- [ ] **Size and sun:** live numbers 40 px and up, labels 32 px, lines 6 px, white and yellow only, plates and glyphs for state. Is everything on page 1 readable at a glance at the real distance and in real sun? `node tools/viewing_geometry.js` holds the arithmetic; the sun model is assumed.
- [ ] **Page flow:** three pages, any page at most one press away; no way to jump to page 1 or to change page by itself (SimHub cannot).
- [ ] The `PERF` line at the bottom right says `SHARED n` (the counters keep running on the pages you are not looking at); `PRIVATE` would mean SimHub is not sharing the script variables.
