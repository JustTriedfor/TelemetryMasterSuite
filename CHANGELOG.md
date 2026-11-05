# Changelog

## Unreleased (after V1.2)

- **README pictures and examples** for version 1.4: the three pages, the alert and flag lanes, the balance indicator in three states, the g-meter with the heading and trajectory arrows, and the flashing plates for critical states (`docs/images/v14-*.png`). They are drawn from a simulated lap by `tools/readme_pictures.py`; `build/preview.js` has new scenarios for them (`flag:<Name>[:<seconds>]`, `hot`) and takes each picture on a frame where every flash phase is on.
- **Fix: "LOCK-UPS THIS LAP" never counted** (since 1.0.0). The per-wheel counter compared each event's lap with the completed laps, one lower than the lap the events are stamped with (the number the header shows), so it stayed at 0 although the pop-up, the last-lock plate and the event list worked. `test/glance.test.js` drives the simulated lap through its lock-up and fails on the old code. Found while making the pictures.
- **Fix: `OS` and `US` labels** moved above the end cells of the balance indicator; the pointer under an end cell covered them.
- The 1.4 package (`dash/out/TelemetryMasterSuite_v1_4.simhubdash`) is rebuilt with both fixes; the V1.2 release has the earlier one.

## V1.2 (2026-11-05): the release that ships the dashes 1.1 to 1.4

Release V1.2 packs four dash versions that were built one after another, each a separate package beside the unchanged 1.0.0 dash (`dash/out/`). The current one is `TelemetryMasterSuite_v1_4`; the sections below say what each version changed.

- **1.1** a smoother dash: shared detector state and refresh intervals (about 24 ms a pass instead of 57 to 90).
- **1.2** three pages, switched with a wheel button.
- **1.3** a glance page (shift bar, gear, speed, delta, alerts).
- **1.4** a three-page side panel for detailed telemetry (Balance, Tyres and car, Brakes) with alert and flag pop-ups, colour and flashing plates, a g-meter carrying the heading and trajectory arrows, an always-live balance, last lock-up and last slide.
- **Not verified on a car:** 1.4 and its thresholds, colours, flash rates and signs (`TO_VERIFY.md` section AA). It was rendered in SimHub's own web client (0 exceptions) against the held last frame of a real Assetto Corsa session, and the tests pass.
- **Repository:** the tests for the new work (`test/glance.test.js`, `test/identity.test.js`, `test/paging.test.js`), the design and performance notes in `docs/notes/`, tools to render a dash in SimHub's client and measure the viewing geometry, and `package.json` is now 1.2.0.

## 1.4.0 (in V1.2): a balance-first side panel, three pages

A new dash, `TelemetryMasterSuite_v1_4`, beside the unchanged 1.3, 1.2, 1.1 and 1.0.0 packages. It was rewritten in place twice after the owner drove it. First pass: the owner said it is a side panel next to a main dash (Lovely Dashboard XL) and that the slip and balance page is the one that matters. Second pass (this entry): the owner listed five problems (no flag pop-ups; thin, small suspension graphs; unreadable logs; page 4 useless because an in-game dash and an external DDU already show it; load bars and inputs too small), so a simulated driver (with those two dashes in front of them), a race engineer and a graphic designer were consulted and the dash was redrawn from their specification. The reasoning, the sizes and what was dropped are in `docs/notes/DESIGN_1_4.md`.

- **Three pages:** 1 Balance, 2 Tyres and car, 3 Brakes. The glance page and everything the other dashes show (speed, gear, rpm, delta, laps, fuel, position, gaps, session, temperatures) are gone. Page name and three squares top right. Every live number is at least 40 px, every label 32 px, every line 6 px; white and yellow only (they are the same brightness in sun), state carried by plates, glyphs, position, size and flashing.
- **Colour and flashing** (third round of feedback: "too minimalistic and monotone"): one colour per signal (beta yellow, steering pale blue, brake red, throttle green, TC amber, ABS blue), one per tyre (FL cyan, FR mint, RL pink, RR sand), one per cluster (a tinted panel with a bar down its left edge: load blue, corners pink, brake zones and lock-ups red, events yellow, g forces cyan, suspension violet), state colours on every temperature, pressure, slip and balance reading, a coloured alert block (red, amber or blue by kind) and a coloured flag lane. Colour is a second cue only: in sun every colour but white and yellow loses most of its contrast, so each state is still a plate, a glyph or a flash. New flashing plates (about 3 Hz): balance 2 degrees or more out (plate and active cell), a slide (grip plate and a red frame round the hero), slip 8 degrees or more, a tyre over 105 C, a pressure over 1.2 psi high, a disc over 750 C, a bottoming, a fresh lock-up (tile and last-lock plate), the newest event. TC amber and ABS blue squares keep flashing at 4 Hz.
- **Heading and trajectory arrows, balance always on** (fifth round: "add the heading and trajectory arrows, and show the current performance and heading against trajectory instead of only when it is happening"): the g-meter on page 1 now carries the two arrows of the 1.0.0 slip view as images, both starting at its centre (first built as a separate panel in the top left, which was not what was asked: they belong in the g-meter) (`arrow_nose`, white, the heading, and `arrow_travel`, yellow, the trajectory, turned by beta times 3, at most 75 degrees); the beta number is always shown; the balance verdict, delta and cells are live from 20 km/h with no corner needed, on a new live reading in the glance state (front minus rear mean slip, smoothed; `SHP.balance` still only measures in a corner and still feeds the corner log); a spin (20 degrees of body slip or more) shows SPIN on a flashing red plate. New key `headRot`, `TMS_GL.headK`, `TMS_GL.gateKmh` is 20 (was 60 with 0.6 g). The two arrow pictures are embedded in the package again (792 items, 583 live bindings).
- **Balance page, more on it** (fourth round: "cut the telemetry in half, add last lock-up, squeeze a G-meter into the load area"): the four traces are half as wide (still 8 s), the freed right half is a red cluster with the last lock-up (flashing plate for 3 s), the lock-ups this lap per wheel and the last slide (corner and peak angle, flashing for 3 s), and a g-meter sits between the load bars (1 g and 1.5 g rings, a dot, the total g under it; the grey car body is gone). New keys `ggSx`, `ggSy`, `ggMag`, `lastSlideText`, colour kind `lsl`.
- **Page 1:** the car with a load bar per tyre (against that tyre's own learned peak, a tick at its average, front-rear and left-right split), beta at 100 px with a tail-direction arrow, the grip word with a glyph, the balance verdict with its size and phase, nine outlined cells with the active one solid, the last corner's verdict per phase, four 8 s traces (beta, steering, brake, throttle), slip tiles, brake and throttle bars, flashing TC and ABS squares.
- **Page 2:** four tyre cards, four suspension bars (80x220, peak tick, mm, in ACC a 90% line and a bottoming count), a g-g diagram.
- **Page 3:** braking zones, corners and the event list as readable rows, four disc thermometers with COLD / OK / HOT and lap minimum, last lock-up, lock-ups per wheel.
- **Pop-ups, two lanes on every page:** the alert lane (lock-up, slide, brake bias; oil, water, fuel, brakes, hot tyre, high pressure, rotating) and a new **flag lane** with a shape per flag and its own timing (yellow, blue, black, chequered, white, green after a yellow or red; red takes the whole top and hides the alert). Details and times: README, [Pages](README.md#pages).
- **Balance** is front minus rear absolute slip angle in degrees (see the fifth-round bullet below: it is now always live from 20 km/h). A slide is 6 degrees for 200 ms (it was 9 for 150 ms).
- **Colour layer in the library:** `tms_st(kind, root, i)` gives every plated or coloured element a level (none, steady plate, flashing plate) and a colour; the dash reaches it with `st_<kind>_vis`, `st_<kind>_col` and `st_<kind>_ink` (dark on the plate, the state colour off it). It replaced the white-plate keys (`slipPlateVis`, `corePlateVis`, `evInk` and the like). `TMS_GL.critMs` (flash phase 170 ms), `TMS_GL.spinDeg` (balance goes to `--` from 20 degrees of body slip). With the game not running a held frame stays steady (`tms_blink` returns on). The refresh intervals: flash-capable kinds at 50 ms, the rest at 100 ms.
- **Library** (`dash/js/tms_dash.js`): new glance block (`tms_glance` with the flag timers, lock-up, slide, TC, bottoming, load-peak and balance state, `tms_flagLane`, `tms_alert`, `tms_alertVis`, `tms_side` with about 95 keys); the corner log now records the verdict per phase. Removed: the shift bar, delta bar, lap flash, fuel margin, gaps, latches.
- **Found in SimHub's own client with the last frame of a real AC session** and fixed: the suspension fallback (AC gives no full stroke) called the first sample a bottoming on all four wheels, so in AC the bars now show the travel inside the range seen so far and nothing is counted as bottoming (ACC still counts it against the game's stroke); the `psi` label was yellow on a white plate; the alert block hid the first letter of `TYRES AND CAR`; the beta number said `--` while the grip word said SLIDE in a spin (it now shows once it is a slide); and SimHub keeps the last values after the game closes, which left a `SLIDE` pop-up on the screen, so pop-ups stay away while `DataCorePlugin.GameRunning` is false.
- **Build and tests:** `build/build_dash.js` rewritten (now 785 items, 582 live bindings, 4 charts, refresh intervals from 33 ms for bars and flashing to 1 s; modelled at 2,500 to 3,500 formula runs a second on a page, about the cost of the 1.1 dash, not measured in Jint); `test/glance.test.js` rewritten (22 tests: flags, alerts, slide, balance, beta, tiles, corner chips, loads, tyres, suspension, g-g, discs, TC, game not running); `test/identity.test.js` now compares every formula with the library hosted the plain way (shuffled, four engines, kill switch) and the formulas shared with 1.0.0 against the frozen library (only a few are shared); `test/paging.test.js` has a coordinates test; `build/preview.js` has `flag:<Name>` scenarios.
- **Not built:** a button that jumps to page 1 and automatic page changes (SimHub cannot: a screen's enable expression is only evaluated when you switch), the engineer's pit and stint review page, a wheelspin pop-up, pad life, wear.

## 1.3.0 (in V1.2): a glance page

A new dash, `TelemetryMasterSuite_v1_3`, beside the unchanged 1.2, 1.1 and 1.0.0 packages. Built from the simulated-driver review in `docs/notes/DRIVER_REVIEW.md`, then reviewed again and refined.

- **Page 1 is a glance page** of big white and yellow shapes: a shift bar closing in from both edges (taller from 90% of max rpm, flashing on and off from 94.5%), gear at 230 px, speed 90 px, position and the two gaps (an arrow up for the car ahead, down for the one behind; in AC the lap and the last lap), the delta to best at 110 px with a signed bar (half a second full scale), fuel margin and lap n/m (or time left), and the lap just finished with its delta for 3 s after the line. A flag band, an alert band, small TC and ABS blocks, and the fuel to add below 60 km/h.
- **Alerts** (one word with its value): hot oil, hot water, fuel for two laps or less when it cannot finish, hot brakes, lock-up, brake-bias change; debounced with hysteresis, flashing 3 s then steady.
- **Pages 2 to 4** keep the panels of 1.2 (slip view and laps are now page 4, with the phase tabs) and get a compact glance strip on top and a pager. The page label is gone.
- Library: `tms_shift`, `tms_glance` (lap line, lock-ups, TC and ABS latches, brake bias, alert state, all stepped by the pump), `tms_alert`, new keys `shiftFrac/Stage/Vis/Color`, `deltaFrac/BarColor/Ink`, `alertWord/Vis`, `flagVis/Ink`, `lapFlashVis/Text`, `fuelMarginNum/Ink`, `lapNm`, `gapUp/Down`, `tcVis`, `absVis`, `slowVis/Add`. A checkered flag was shown red (the name contains RED); it is white now.
- `build/build_dash.js` draws the glance page and strip (`glanceItems`, `stripItems`); `test/glance.test.js` tests the new keys (shift stages, delta bar, alert priority and timing, latches, flag, lap flash, fuel margin, gaps); `build/preview.js` honours `Visible` and has an `alert` scenario.
- **Not built** (SimHub cannot, or it needs a decision): automatic page changes by speed (a screen's enable expression is only evaluated when you switch), a button that jumps to page 1, a pit-lane overlay (needs a pit property), pit limiter and oil pressure, a three-page cut and simpler tyre and disc pages.

## 1.2.0 (in V1.2): three pages

A new dash, `TelemetryMasterSuite_v1_2`, beside the unchanged 1.1 and 1.0.0 packages. 1.1 on three pages: **Drive** (slip view, lap timing, inputs, fuel), **Tyres and car** (tyres, suspension, dynamics) and **Braking and logs** (braking analysis, event log, corner log), switched with SimHub's "Show next / previous dash screen" (map them to a wheel button or dial in Controls and events).

- SimHub does not evaluate the formulas of a screen that is not shown (measured on SimHub 9.12.9 with a throw-away test dash, `tools/page_probe.js` and `tools/page_check.js`), so a panel on another page costs nothing. Panels keep their size and sit at the top of their page.
- Everything that must keep counting while its page is away moved into the shared per-frame step that every page carries (page 1 on the slip arrow, pages 2 and 3 on a tiny invisible item `pump`): the sector timer, fuel per lap, the braking totals (pedal overlap, ABS hits, peak brake, trail braking, peak deceleration) and the disc peaks, next to the detectors that were already there. They are also more exact now (every frame instead of every refresh of their row).
- Measured offline (real Jint, idle machine, simulated ACC lap): one pass over the formulas of a page takes 2.6 to 4.7 ms (all of 1.1: 13.2 ms, 1.0.0: 32.8 ms); modelled formula time per second at 60 Hz is 31 to 61 ms on a page against 101 for 1.1. The earlier 57 / 24 ms figures for 1.0.0 / 1.1 were taken on a busy machine (same ratio).
- The panels are enlarged to fill each page (`PAGES` in `build/build_dash.js` gives every panel a position and a scale; text, line thickness, images and the formulas that return a size or a coordinate scale with it; `test/paging.test.js` checks them).
- `docs/notes/DRIVER_REVIEW.md`: a subagent playing a racecar driver reviewed the pages for an 11 inch screen 75 cm away, 20 degrees off axis, in bright sun, 500 ms per glance. Its verdict: the dash is a workbench at that size; it recommends a glance page (shift strip, gear at about 220 px, delta bar, speed, gap), alerts as flashing blocks, white and yellow only, and a button that returns to page 1. Not built; the owner decides. `tools/viewing_geometry.js` holds the arithmetic (angles, character heights, contrast in sun, with assumed sun and panel brightness).
- Every page has the top bar, a page label and the self-check line (`PERF  v1.2 ...`).
- Tests: the identity test and the build test run over all three pages (448 formulas, 758 items); the new `test/paging.test.js` hides the formulas of a page for a few seconds and checks that every panel then shows what it would have shown (only low-pass filtered chart values and two short rates settle a moment later, listed in the test), and that formulas that return a coordinate stay next to their item.
- Tools: `node tools/cdp_dash.js <dash> 12 --page 2` renders a page in SimHub's own client; `build/preview.js` takes a page number; `build/build_probe.js` keeps the probe at one screen.
- `docs/notes/PLAN_SLIM_PAGED.md` holds the plan this follows (the slimming cuts in it are not part of 1.2).

## 1.1.0 (in V1.2): a smoother dash

A new dash, `TelemetryMasterSuite_v1_1`, beside the unchanged 1.0.0 package. Same panels, same values (checked formula by formula against the 1.0.0 library), much less work for SimHub's formula engine.

- Detector state is shared between the formulas and each detector steps once per data frame instead of once per row; row text is rebuilt only when it changed; the chart auto-range buffers are shared. One pass over all formulas in SimHub's own Jint engine: 57 to 24 ms (ACC), 90 to 25 ms (AC) (measured offline with simulated telemetry).
- Refresh intervals by kind of value (33 ms for pedals and steering up to 2 s for labels); charts keep theirs.
- Falls back to the 1.0.0 behaviour when SimHub does not share the script variables (`TMS_SHARE = false` forces it).
- A dim self-check line at the bottom edge shows what SimHub really does on your machine. Read in SimHub 9.12.9 with no game running: the script variables are shared between formulas, a minimum update interval skips the evaluation, and formulas of hidden items are not evaluated.
- A leaked global variable (`t`) in the library is gone. The library now steps once per data frame, so tests that call it must let time pass between calls.
- New `test/identity.test.js` (with the frozen 1.0.0 library in `test/fixtures/`), `build/dash_name.js` (the dash name in one place), and `docs/notes/PERFORMANCE.md` with the investigation.

## Unreleased (repository tidy-up, committed after 1.0.0)

- The dash and the probe now carry an Author and a Description in their metadata (SimHub shows them in its dash list).
- `npm test` on a fresh clone says to build first instead of crashing with a file-not-found error.
- Repository tidy-up before publishing: `.gitattributes` (LF line endings, so a rebuilt package matches the committed one), the out-of-date `dash/README.md` replaced, and the early design notes moved to `docs/notes/` with a status header.

## 1.0.0 (2026-11-02): first release

The first complete dash. It imports into SimHub 9.12.9 and has been driven in Assetto Corsa (Nordschleife, Zandvoort); Assetto Corsa Competizione is built from SimHub's property catalog and checked offline only.

**The dash** (`dash/out/TelemetryMasterSuite.simhubdash`, 681 items, 372 live bindings, 28 charts)
- Slip view built around live body slip angle: big beta number with grip / transition / slide bands, beta and steering chart, tyre load on the top-down car, balance meter, grip use per tyre, slip statistics and the last-corner card.
- Lap timing: delta, three sectors timed by the dash, last five laps with gap bars, 10-second brake trace, sector deltas, theoretical best, average and spread.
- Driver inputs, a G-force block with per-lap peaks, braking analysis with a braking-zone roadbook, disc temperatures, per-tyre cards, suspension travel, fuel strategy.
- Event log and a **corner log** with a balance verdict and trend for every corner.
- Pitch and roll are drawn at their true angle (1x).

**Also in the repository**
- `dash/out/TMSProbe.simhubdash`: a diagnostic dash that prints raw property values, types and min/max.
- A generator, packager, preview renderer, unit tests and a validator that runs every formula on simulated ACC and AC telemetry, and `tools/cdp_dash.js`, which renders the dash in SimHub's own web client.

**Known limits** are listed in `README.md` and `TO_VERIFY.md`: in AC the balance numbers come from the unitless `WheelSlip`, opponent gaps need a C# plugin, ACC and iRacing are not verified live.
