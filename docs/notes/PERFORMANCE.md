# Performance: why 1.0.0 lagged and what 1.1 does about it

> **Working note.** Written while 1.1 was built, from three rounds of independent analysis (subagents with different briefs) plus measurements. Every claim is labelled **measured**, **read from code**, **inferred** or **guess**. Paths are relative to the repository root. For the user-facing summary read [README.md](../../README.md#performance).

## The problem
The owner drove with 1.0.0 for a long time and reported that it is very laggy. Nothing in the logs or settings showed an overload, so the cause was not known when this work started.

## What was established
- **Formulas run inside SimHub, not in the browser** (read from code: the web client has no formula code; its scripts only apply values that arrive over a WebSocket). SimHub's server evaluates every JavaScript formula with the Jint interpreter (version 4.2.2 in 9.12.9), a tree-walking interpreter far slower than a browser's engine. The overlay on a second monitor is the same web client in a WebView2 window, so the overlay and a browser tab share the evaluation.
- **Each formula costs about 25 microseconds before it does any work** (measured in Jint: a call through SimHub's wrapper). With 394 formulas that is about 10 ms of every pass on its own.
- **One pass over the 1.0.0 formulas takes 57 ms (ACC) to 90 ms (AC)** in SimHub's own Jint engine with simulated telemetry (measured; `$prop` is emulated with a JavaScript closure, so the real figure is probably higher). A frame at 60 Hz is 16.7 ms.
- **Where the time goes** (measured, ACC): about a third is the 40 formulas of the event, braking-zone and corner logs, because every row re-ran its own copy of the detector it reads; about 14% is the chart auto-range ring buffers; the rest is the per-formula floor and the tyre, brake and lap formulas. The cost of the detectors rises by roughly 1.5 to 3 times in the first half minute of driving and then stays flat (measured, the size of the rise differs between runs).
- **`root` is private to each binding** (measured in Jint, and visible in SimHub's own error text), so state cannot be shared through it. Variables defined by the extension scripts may be shared between formulas (the dash runs in SimHub's shared-engine mode), but SimHub's documentation does not promise it.
- **SimHub's own lever is "Min. update interval"** (`MinimumRefreshIntervalMS`, which also sets `RenderingSkip` to a tenth of it). When this work started it was **not known** whether it stops SimHub evaluating the formula or only thins what is sent, and whether formulas of hidden items are evaluated; both are now answered by the self-check line (see "Settled on the real SimHub").
- **Nobody has shown that formula evaluation is what the owner feels as lag.** No log line reports a frame overrun; how many passes per second SimHub makes is not known; the display path (an integrated GPU driving a high-refresh panel, several overlays at once, other plugins sharing SimHub's update thread) is a candidate too. This is why 1.1 ships as a separate dash and carries a self-check line.

## The five example dashboards
Five third-party example dashboards were studied statically (nothing of theirs was executed). Compared with 1.0.0 they:
- throttle 40 to 65% of their bindings (text at 200 to 1000 ms, only gauges and charts at frame rate) while 1.0.0 set an interval on about a fifth;
- show one page at a time (layers switched by a `Visible` binding, widget screens) so about half of their items are hidden at any moment, while 1.0.0 draws all 681 items at once;
- show about 3 charts per page fed by a plain property (1.0.0: 28 charts, all fed by a JavaScript formula);
- keep very little state in formulas (1 to 8% reach code that does) and share work between formulas through module-level variables in their scripts: a frame object keyed by a token built from three property reads, and a palette cached for 200 ms;
- are not lighter in absolute terms: the busiest page has more bindings (about 950) than 1.0.0 (394), and they use more costly-looking style fields (rounded corners, gradients, opacity).
What this does **not** show: whether any of them is smooth on the owner's machine (one of them logs script errors there), or that throttling, hiding or sharing actually lowers their cost. They prove that those features exist and load, not that they help.

## Three positions, compared
Three agents argued for different fixes after reading the same facts; each had to answer the other two.

| | **Keep everything, share work** | **Cut the work structurally** | **Skeptic: prove it first** |
|---|---|---|---|
| Idea | Detectors run once per frame in shared state, row text rebuilt only when it changes, slow values refreshed slowly. Formulas stay as they are. | 394 formulas become about 89 JavaScript ones plus about 103 plain property bindings; rows merged into text blocks; some panels dropped or simplified. | The cause is unproven and so are the premises of both plans. Ship separately, add fallbacks, find out on the owner's machine. |
| Pass cost (measured, real Jint, ACC) | 54.5 to 24.0 ms | 62.8 to 13.4 ms | re-measured the 1.0.0 cost: about 58 to 60 ms |
| Output | identical to 1.0.0 (checked formula by formula, 2.8 million comparisons per run) | different: features dropped | n/a |
| Needs something SimHub does not promise | shared script variables (falls back to 1.0.0 behaviour if they are not shared); interval skipping only for the throttling part | no (static text, plain bindings, a per-formula time gate) but needs SimHub's expression syntax checked (`if()`, `Round`) and the detectors retuned for lower sample rates | - |
| Cost to the owner | none | lost: highlighted tab look, purple best sector, chart autoscale, grip card extras, pressure traces, ACC in the same package | none |
| Weak point | in a worst case with every formula in its own engine it measured 2 to 18% slower than 1.0.0 (cold start, not explained) | large rebuild; changes what the dash shows; cadence of the detectors changes | a plan to measure, not a fix |
| Verdict of the other two | structure first, cache second; they combine | agrees to ship separately and measure first | the 77% "unchanged output" figure is an upper bound (93% when weighted by cost, 73% in formulas that change in under 5% of frames); growth over a session is 1.4 to 1.7 times, not 3 |

**Where all three agree:** the per-pass cost is real; ship as a separate dash with a different name so 1.0.0 stays untouched; set only `MinimumRefreshIntervalMS` (SimHub derives `RenderingSkip`); the cache and the slimming are not exclusive; the owner's quick A/B decides whether formula evaluation is the cause at all.

**What was chosen for 1.1:** the first position, because it changes nothing the owner sees (so it needs no decision about features) and is covered by the identity test, plus the skeptic's safety measures (separate dash, kill switch, self-check line). The second position stays available as a next step; it costs features, so it is the owner's call after seeing what the self-check line and the A/B show.

## Measured on the finished 1.1
Same engine and method as above (real Jint 4.2.2 in 32-bit mode, simulated lap, every formula evaluated on every frame, 600 frames after 1800 warm-up frames):

| | 1.0.0 | 1.1 |
|---|---|---|
| one pass, ACC | 57.0 ms (p95 63.3) | 24.0 ms (p95 30.4) |
| one pass, AC | 90.3 ms (p95 98.0) | 24.6 ms (p95 30.3) |
| property reads per pass, ACC / AC | 1878 / 2591 | 725 / 779 |
| CPU per second if SimHub honours the refresh intervals, at 60 Hz, ACC / AC (model) | 2045 / 3105 ms | 191 / 199 ms |
| formulas evaluated per second under the same assumption | 19 500 | 2 850 |

The last two rows assume SimHub skips evaluation between refreshes, which the self-check line showed it does (below). A full pass of 24 ms is still more than a 60 Hz frame, so how smooth it feels depends on how many formulas fall due in the same frame; getting well below needs fewer formulas (the second position) or pages (hidden items are free).

## What 1.1 changed
- `dash/js/tms_dash.js`: `TMS_GR` (shared detector state) and `TMS_FR` (a frame clock) replace the per-formula state for the helpers that run detectors; each steps at most once per data frame; `tms_pump` (carried by the one formula that is never throttled) keeps them stepping at frame rate; row text is cached until the thing it shows changes; the chart auto-range ring buffers are shared between the low and high bound; a leaked global variable is gone. `TMS_SHARE = false` restores the 1.0.0 layout.
- Fallback: if every formula turns out to have its own copy of the library, the library detects it (only one formula ever uses it) and each formula runs the detectors it needs by itself, as in 1.0.0.
- `build/build_dash.js`: a table of refresh intervals by kind of value (frame rate for the pump, 33 ms for pedal bars and steering, 100 ms for speed, rpm, gear and the balance meter, 200 ms for the logs and tyre cards, 500 ms for lap timing, fuel and the header, 2 s for labels); charts keep their own.
- A dim self-check line at the bottom edge, `PERF v1.1 SHARED n pass x/s slow y/s hidden z/s` (see the README).
- `test/identity.test.js` with the frozen 1.0.0 library in `test/fixtures/`.

## 1.2: three pages, measured on a quiet machine
Same engine and method (real Jint 4.2.2, 32-bit, simulated ACC lap, 600 frames after 1800 warm-up frames), all four versions run back to back on an otherwise idle machine. The "model" column is microseconds per formula times runs per second at 60 Hz with the refresh intervals honoured (a **model**, formula time only).

| | formulas | one pass (mean, p95) | model, ms per second |
|---|---|---|---|
| 1.0.0 | 394 | 32.8 ms (41.0) | 1108 |
| 1.1 | 396 | 13.2 ms (17.0) | 101 |
| 1.2, every page at once (never happens) | 445 | 9.6 ms (12.0) | 107 |
| 1.2 page 1, Drive | 185 | 4.7 ms (5.8) | 61 |
| 1.2 page 2, Tyres and car | 152 | 3.2 ms (4.7) | 60 |
| 1.2 page 3, Braking and logs | 108 | 2.6 ms (3.9) | 31 |

- **Correction.** The absolute figures quoted earlier for 1.0.0 and 1.1 (57 and 24 ms for a pass, 2045 and 191 ms a second) were taken while other work was loading the machine. Run on an idle machine they are 32.8 and 13.2 ms and 1108 and 101 ms a second. The ratio is the same (about 2.5 times per pass), so the conclusions stand; the absolute numbers do not. The per-panel table in `PLAN_SLIM_PAGED.md` has the same inflation (its shares hold, its milliseconds are about 45% too high).
- A page costs about 40% less per second than all of 1.1 (61 against 101 at worst) and its worst frame about 65% less (4.7 against 13.2 ms). Each page includes the pump: the per-frame step that runs the detectors, the sector timer and the lap totals, so the three pages add up to more than the "every page at once" row.
- Not measured: anything in SimHub itself (reading properties, building and sending the messages), the client's drawing cost, and the pass rate in a real session.

## Settled on the real SimHub
Read off the self-check line of the finished 1.1, rendered by SimHub 9.12.9's own web client (headless Edge, `node tools/cdp_dash.js`), **with no game running**, so SimHub ran its idle data tick. Two readings: `SHARED 113`, `pass 10/s`, `slow 0.9/s`, `hidden 0.0/s` and `SHARED 118`, `pass 10/s`, `slow 0.9/s`, `hidden 0.0/s`.
1. **Script variables are shared between formulas** (measured: 113 to 118 formulas used one copy of the library). The first position's central assumption holds, in this setup.
2. **A minimum update interval skips the evaluation** (measured: the formula set to 1 s ran 0.9 times a second while the unthrottled one ran 10 times a second, so SimHub does not evaluate on every pass and merely thin what it sends).
3. **Formulas of hidden items are not evaluated** (measured: 0.0 runs a second for the hidden twin). Paging is therefore a free way to remove work: a panel that is hidden costs nothing.
Limits: no game was running, so the pass rate (10 per second) is the idle rate and not what SimHub does in a race (the line shows it while driving); the checks say nothing about what the lag feels like.

## What is still unknown, and how to find out
1. **Is formula evaluation the cause of the lag?** Two-minute checks on the owner's machine: close the dash and see whether the game's frame rate changes; open the same dash in a browser on SimHub's web server (`http://<pc>:8888`) and see whether it is smooth there; switch the dash between SimHub's HTML and WPF renderers; look at SimHub's data-rate counter at the bottom of its window with the dash on and off; close other overlays and unused plugins.
