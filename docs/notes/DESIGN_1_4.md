# Design of the 1.4 side panel

How `TelemetryMasterSuite_v1_4` came to be three pages, and the rules it is drawn by. The owner drove the first 1.4 and listed five problems: no flag pop-ups; the suspension graphs small and thin; the logs too small to read; page 4 (a glance page) useless because they already have an in-game dash and an external DDU; the load bars and the input telemetry too small. Three subagents were consulted in turn (a racecar driver, a race engineer, a graphic designer) and the dash was rewritten in place from the result. Nothing here was measured on a car: the viewing numbers are a model, the thresholds are defaults (`TO_VERIFY.md`, section AA).

## The situation the panel is drawn for

- An 11 inch 1920x1080 screen 75 cm away, centred 20 degrees right of the eye line, bright sun, a glance of about 500 ms.
- 1 px is 0.58 arcmin, 1 degree is 103 px, the fovea covers about 206 px and the parafovea about 516 px (`node tools/viewing_geometry.js`). A cap height is about 0.7 of the font size.
- In the sun model (screen 300 cd/m2, reflected veil as bright), contrast against the dark panel falls from 17:1 to about 1.9:1 for white and signal yellow, and those two have the same brightness. Everything else (mint green, cyan, orange, brake red, greys) falls to 1.15 to 1.55 and is lost. So a state is carried by a **plate** (an inverted block with dark ink), a **glyph** (▲ ▼ ● ◐ ► ◄), **position**, **size**, an **outline** against a solid, or **flashing**, never by colour alone. The first 1.4 drew everything in white and yellow on that basis; the owner found it too minimalistic and monotone, so colour came back as a second cue (see "Colour and flashing" below).
- Sizes the reviewers set as floors: a live number 40 px, a label 32 px, a line 6 px, a bar at least 32 px thick. Grey captions do not count as information (1.15:1 in the sun model).
- The owner already has the in-game dash and a DDU in front of them, so the panel shows none of what those show (speed, gear, rpm, shift lights, delta, lap times, fuel, tyre pressures, TC / ABS / BB / MAP, relatives, standings) and spends the screen on what they do not: body slip angle and balance, load on each tyre, tyre temperature detail, suspension, discs, g forces, inputs, pop-ups and a log.

## What the reviewers said, in short

- **Driver:** the right third of the old page 1 (lap timing, fuel, gear, speed) and the top strip repeated the other dashes; the balance, the reason to look, sat low; inactive segments and their labels vanished in the sun; the tyre loads were 26 px with 14 px bars scaled to a fixed 8000 N (dead on a straight); the logs were 19 px grey. Wants the balance verdict and beta at the middle of the screen, a trace stack with 6 px lines, big brake and throttle bars, two pop-up lanes (alert and flag, with a shape for each flag), no page 4.
- **Engineer:** latch, do not stream (hold the last corner's balance and the lock-up for a few seconds in a fixed place); gate the verdicts (balance only in a corner at speed, the same quantity everywhere on the screen so it never contradicts itself); fixed scales only; colour means state, not identity; balance as front minus rear absolute slip angle, plus is understeer; the last corner's balance by phase; a slide at 6 degrees for 0.2 s (9 is late for a GT car); weight transfer shown as a bar per tyre against its own peak with an average tick, not newtons; a g-g diagram instead of g bars; a tread spread verdict after two laps; log lock-ups, slides, bottoming and a TC held over a second, not "ABS active".
- **Designer:** three pages in a ring; page 1 for balance; fixed lanes for pop-ups; a short NEW list of things that need new computation, ranked so the builder can drop the last ones.

## Decisions

1. **Three pages** (Balance, Tyres and car, Brakes). The glance page and all lap, fuel, gear, speed, position and gap content are gone.
2. **No auto-return and no home button.** SimHub evaluates a screen's enable expression only when you switch, and has no jump-to-page-1 action (measured, `tools/page_probe.js`). With three pages any page is at most one press away.
3. **Two pop-up lanes on every page, drawn last:** the alert lane (top middle, solid white block, 72 px word) and the flag lane under it (an outlined block with a shape, 70 px word, then a small chip). Red takes the whole top. Black also lights a bar down the left edge.
4. **State lives in one place.** The pop-up timers, lock-up, slide, TC, bottoming, load peaks and the balance gate are one block in the library (`tms_glance`) stepped once per frame by the shared pump, so every page shows the same state and the counters keep running on the pages that are not shown.
5. **Honest where the data is not there:** AC gives no full suspension stroke, so its bars show the travel inside the range seen so far and nothing is counted as bottoming (ACC gives the stroke and counts it); AC's slip angles are estimated and the balance says `EST`; unknown values read `--`.

## What is on each page and how it is built

- **How a bar is drawn:** a full white bar with a dark cover whose width or height is the one live value (one formula per bar). A hollow frame is four 6 px strips. There are no line or polygon items in SimHub, so glyph text (▲ ▼ ● ◐ ► ◄ ▦ ») and ellipse rings stand in for shapes.
- **Page 1:** car and four load bars (x 24 to 424), beta, grip word and balance verdict in the middle, nine cells with a pointer, the corner chips, four trace lanes (80 points at 100 ms is 8 s; the chart draws inside a 10 px margin of its item), four slip tiles with a 0 to 8 degree bar and ticks at 3 and 6, brake and throttle bars (100x300), the TC and ABS squares.
- **Page 2:** four 600x410 tyre cards, four 80x220 suspension bars with a peak tick, a g-g circle (1.5 g outer, 1 g inner) with a dot at two bound coordinates, the lap's peak g as text.
- **Page 3:** braking zone rows and corner rows (several times the old size), four disc cards, the last lock-up, the event list (5 rows), the lock-ups this lap.
- **Pop-up timing:** see README, [Pages](../../README.md#pages). The numbers are in `TMS_GL`.

## What was dropped and why

Shift bar, gear, speed, position, gaps, delta bar, lap flash, fuel margin, laps and sectors, session and temperatures, the glance page, the top strip, the steering-wheel picture and the car side and rear silhouettes, auto-ranged sparklines, the debrief stat boxes, grey caption text, the 20 s traces: they either repeat the other dashes or cannot be read at the distance. Not built: the engineer's pit and stint review page, a wheelspin pop-up, pad and disc life, wear.

## Defects the real client found (fixed)

Run against the last frame of a real AC session: all four wheels read "bottoming" at the first sample in AC (the learned full stroke started at the first value); the `psi` label was yellow on a white plate; the alert block covered the first letter of the page name; the beta number said `--` while the grip word said SLIDE in a spin; and a `SLIDE` pop-up stayed up after the game closed (SimHub keeps the last values), so pop-ups now wait for `GameRunning`. Details in `CHANGELOG.md`.

## Colour and flashing (added after the owner called it too minimalistic and monotone)

The sun model is still true, so colour was added on top of the plates, glyphs and flashes, not instead of them. The palette uses bright colours (dark ones lose the most in sun) and is the same colours the owner approved for 1.0.0 (one colour per signal, one per tyre).

- **Per signal:** beta yellow, steering pale blue, brake red, throttle green, TC amber, ABS blue. Traces, bars, labels and arrows of one signal share its colour on every page.
- **Per tyre:** FL cyan, FR mint, RL pink, RR sand on its load bar, slip tile, tyre card, suspension frame, disc card and lock-up tile, so the eye finds a corner by colour.
- **Per cluster:** a panel with a hint of its colour and a full-colour bar down its left edge (load blue, last corner and corner list pink, brake zones and lock-ups red, events yellow, g forces cyan, suspension violet). The tint is invisible in sun; the bar and the heading colour are not.
- **State:** blue cold or understeer, green in the window or neutral, amber warm, red hot or oversteer, on tyre core, pressure, tread zones, discs, suspension travel, slip, balance and the corner chips. The nine balance cells run red, orange, green, blue, violet. The alert block takes the colour of its kind and the flag lane the colour of its flag.
- **Flashing:** three levels per element: nothing, a steady plate, a flashing plate (about 3 Hz). Critical states flash: balance 2 degrees or more out, a slide (the grip plate and a frame round the hero), slip 8 degrees or more, a tyre over 105 C, a pressure over 1.2 psi high, a disc over 750 C, a bottoming, a fresh lock-up, the newest event. A held frame (game not running) never flashes.
- **Heading and trajectory:** two images from the 1.0.0 slip view, inside the g-meter ring and starting at its centre: the white nose arrow fixed pointing up and the yellow travel arrow turned about its tail by beta times 3 (a few degrees would not show). They are the only images in the dash and are embedded in the package.
- **How it is built:** one function in the library, `tms_st(kind, root, i)`, decides level and colour for every plated or coloured element, so the thresholds are in one place and the same for every page. The builder binds a plate's visibility and colour and its text's ink to `st_<kind>_vis`, `_col` and `_ink`.
- **Cost:** more formulas (555, was 428) and more of them at 50 ms; modelled at 2,500 to 3,500 runs a second on a page, not measured in SimHub.
