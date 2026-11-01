# Dense layout v3 (current Stage 4 target; supersedes v2 and the first grid mock)

Open http://localhost:8765/mock/v3/index.html (`python -m http.server 8765` in the project folder).
Options: `?t=25.5&pause=1`, `&mode=acc|ac|iracing`, `&cal=1`. Earlier versions: `mock/index.html` (first grid), `mock/v2/` (big-number glance version).

## Principles
1. **Dense, small, tidy.** One panel template: 12 px uppercase title with a yellow tick, grey sub-line, 11 px labels, numbers in fixed positions. Strict three-column grid (596 / 700 / 596 px), fixed panel heights, 6 px gutters. Nothing below 11 px and no panel overflow (both checked automatically in the browser).
2. **Continuity by colour.** One colour per signal everywhere: beta yellow, brake red, throttle green, steer pale blue, lateral g teal, longitudinal g violet, yaw purple, one colour per corner (FL cyan, FR mint, RL pink, RR sand). Status colours (green ok, orange warn, red bad, blue cold, purple best) only mean something.
3. **Continuity by time axis.** Live traces: the same last 6 s. Driver inputs and brake: a rolling last 20 s. Histories: the same last 90 s. Lap graphs (delta): by lap position, not seconds.
4. **Related things touch.** Lap timing with braking directly beneath; the car with tyres directly beneath; the right column groups inputs, dynamics, suspension, fuel, systems.
5. **Graph left, widget right (right column).** Every right-column graph is about 316 px wide; the other 256 px hold one purpose-built widget for that panel.
6. **Nothing is tied to a short track.** Driver inputs and the brake trace roll over the last 20 s and overlay the best lap *at the same track position*, so they work on the Nordschleife as well as on a 1:30 lap. The delta graph uses lap position (0-100 %), not seconds.
7. **No abstract graphs**: no g-g diagram, friction circle or damper-velocity histogram; no loose numbers strip.

## Right column (changed in this round)
| Panel | Graph (left) | Widget (right) |
|---|---|---|
| Driver inputs | Throttle/brake and steer, rolling 20 s, best lap dashed | Steering wheel that turns with your input, plus live throttle/brake/clutch bars |
| Dynamics | Lateral g, longitudinal g, yaw rate (6 s) | Car with a load bar on each corner and front/rear, left/right shares (iRacing: estimated load centre) |
| Suspension and ride | Four damper-travel traces with bottoming/topping bands and counters | Side-view car that pitches and rear-view car that rolls, drawn x10 with numbers |
| Fuel and strategy | Numbers: fuel laps left, per-lap average, race laps left, fuel to add | Race timeline (laps done, current lap, finish) over a fuel-range bar; shows "empty at lap N, short by X" and a PIT WINDOW |
| Systems, events and track | Oil/water/boost with 90 s sparklines, last 3 events | Track map: your position, braking zones from your last lap (dim) and this lap (red), incidents as triangles, S/F and sector marks |

The old fuel bar chart was removed as requested.

## Left and centre columns (unchanged except the axes)
Lap timing: delta number, delta through the lap by position, predicted/best, three sector tiles, last 5 laps with gap bars, pace bars. Braking: rolling brake trace vs best with braking/trail shading and ABS/lock markers, peak/trail/overlap/bias with bars, four disc cards with 90 s history and temperature bands, lock-ups per wheel. Slip view: car with slip wedge, beta, 6 s trace, balance meter, four grip-use bars. Tyres: four corner cards with temperature and pressure history, tread bars, wear, slip, load, travel.

## Trade-offs / open questions
- **The track map** in the mock is an invented outline. The real dash needs SimHub's own map (the reference dash uses a `GeneratedStaticMapItem`); whether it can draw braking zones and incident pins on top of it is unverified (TO_VERIFY).
- **Rolling graphs with the best lap overlaid at the same position** need the best lap stored by track position. A dashboard cannot hold that by itself; this is the job of the C# plugin (Option C).
- **Nordschleife in practice:** the plugin must store ~20 km of samples per lap (at 10 Hz about 4,500 points for a 7.5 min lap, trivial), and the 20 s window shows roughly 1-1.5 km at speed. The lap-position delta graph is low-resolution over 20 km; if that is not useful on very long tracks I can switch it to rolling too (say so).
- **The race length (34 laps) and lap count in the strategy bar** are mock values. In SimHub they come from `TotalLaps`/`RemainingLaps` (present in your catalog) or from session time in timed races; timed races need a different bar (time left / lap time).
- Item count in Dash Studio will be in the hundreds; performance still to be measured.

## Round 3: left column rework
- **Lap pace bar chart deleted** (lap times are consistent, the bars carried no decision). Its space now holds the **brake trace** (rolling 20 s, best lap dashed at the same track position, braking/trail shading, ABS and lock-up markers), directly under the sector tiles and lap list.
- **Braking analysis** top-left now holds the two cards that used to sit in the stat row: **Pedal overlap** (value, vs best, 20 s strip of when both pedals were pressed) and **ABS** (state, hits this lap / last lap, 20 s activity strip).
- **New in the circled area: braking-zone log** (roadbook). Rows: zone number, lap position, entry speed, peak pedal, peak decel, trail time, ABS/lock flags. It shows your finished zones this lap, the live one (dot), and the **next zones from last lap, dimmed (triangle)**, so on a long track you see what is coming and how you braked there. A purple tick on the peak marks the best lap's value for the same zone number; the number turns orange if you braked lighter than best.
- The stat row is now Peak brake, Trail brake, **Peak decel (g)** and Brake bias (overlap and ABS moved up).
- Disc graphs now fill their cards.

Library: `physics.js` gained `zoneUpdate / zoneLapEnd / zoneSeedBest / zoneList / zoneLive / zoneBest / zonePrev` (ES5, 3 new tests; 36 physics tests now). A zone starts when the pedal passes the brake threshold above 15 m/s and ends after 0.4 s under the release threshold; blips under 0.5 s and pit-lane crawling are ignored; trail time excludes the release gap.

Caveats: zones are matched to the best lap **by zone number**, so if you brake in a different place on a lap (an extra zone for a traffic dodge) the numbers shift for the rest of that lap; matching by lap position would fix that and needs the plugin. Decel in g uses the sim's longitudinal g (`AccG03` on ACC), whose sign and scale are in TO_VERIFY.

## Round 4: disc cards and a chart bug
- **Disc cards redesigned** (all four): header = corner name with its state right beside it (`FL DISC  ● OK`, `▼ COLD`, `▲ HOT`, `▲▲ FADE RISK`); the temperature number is smaller (30 px); beside the number: **PEAK LAP** (hottest this lap), **RATE** (°C/s rising or falling) and **PAD / DISC** life; the 90 s graph with cold/ok/hot/fade bands sits **below**, full card width. Lock-up flags the card (red outline and "LOCK-UP").
- **Pad/disc life** comes from `Physics.padLife01..04` / `discLife01..04` (present in your ACC catalog). AC and iRacing show n/a. Units are not verified (could be percent or millimetres), so the dash shows the raw number without a unit until you check (TO_VERIFY section I).
- **Tyre cards keep their side-by-side layout** (number left, graphs right). Say so if you want them to follow the disc cards (graphs under the number).
- **Bug fixed in the shared chart helper:** a chart that drew two stacked sub-plots on one canvas (the 6 s slip trace, the pedal/steer chart, the dynamics chart) never cleared its second region, so translucent fills accumulated frame after frame until the brake area turned solid red and the axis labels smeared. Every chart now clears exactly its own region each draw. Checked on a live page: the count of opaque pixels in that area stays constant over 3 s of animation (1907 to 1909, line strokes only).

## Round 5: the car drawings
The drawn rectangles are replaced by the supplied line drawings (Porsche 911 GT3 RS sheet, kept at `mock/assets/car_sheet.webp`). `tools/cut_cars.py` cuts the four views out, drops the "FIG." labels and the partial drawing at the top of the sheet, and turns the black-on-white lines into light-on-transparent PNGs: `car_top.png` (344x765), `car_side.png` (773x233, nose left), `car_rear.png` (462x305), `car_front.png` (459x307).
- **Slip view:** top view with the slip wedge, nose arrow and travel arrow over it; the four grip indicators (grey while learning, then green/orange/red; red on lock-up) sit just outside the body at the axle positions of the drawing (axles at 23.5 % and 76.5 % of the car length); the load-centre dot sits on the car.
- **Dynamics load widget:** the same top view, with a load bar at each axle.
- **Suspension attitude widget:** the side view tilts with pitch (nose-up positive, drawn x10) and the rear view with roll (drawn x6, so it stays inside the box).
- **Front view (`car_front.png`)** is cut and ready but not placed anywhere yet.
- The mock's simulated pitch is now nose-up when accelerating and nose-down when braking, as on a real car. What ACC and iRacing actually report is unverified (TO_VERIFY section J).

## Round 6: graphs scroll like the pedals, MOZA wheel
- **All tyre and brake graphs now scroll at the driver-input rate**: a rolling last 20 s at 10 Hz (4 disc temperature graphs, 4 tyre core-temperature graphs, and the 4 tyre pressure graphs so every card moves together). Same -20 s ... now axis as the driver inputs and the brake trace. Verified on a live page: each graph redrew in all twelve 100 ms sampling windows over 1.2 s, the same as the pedal graph.
- Tyre core and pressure graphs are **auto-ranged** over the window (minimum span 8 °C and 0.6 psi), so slow thermal changes stay visible; the green window, cold and hot bands are clipped to the visible range and the 27.5 psi target line only shows when it is in range. Disc graphs keep the fixed 150-900 °C scale with cold/hot/fade bands.
- Trade-off: the old 90 s view showed stint-long heat build-up. The corner cards still carry the trend arrow; if you want the stint trend back as well, I can add a stint panel or a toggle.
- **Steering widget** now uses the MOZA wheel image (`mock/assets/wheel_moza.png`, cut from `wheel_src.webp` by `tools/cut_wheel.py`, with a thin light rim so the black wheel stays visible on the dark dash). It turns with the steering input; a yellow marker shows 12 o'clock. The wheel's own screen (5731 RPM, 289 SPD, gear 3) is part of the picture and static.
