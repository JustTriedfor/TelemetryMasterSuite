# Glance layout v2 (replaces the grid mock as the Stage 4 target)

Open: http://localhost:8765/mock/v2/index.html (server: `python -m http.server 8765` in the project folder).
Options: `?t=25.5&pause=1`, `&mode=acc|ac|iracing`, `&cal=1`. Press **G** (or the GLANCE button) for the glance test: the screen shows for 700 ms, then blanks. Esc closes the blank.
The first grid mock is kept at `mock/index.html` for comparison.

## Design rules (from the 600 ms identification budget)
You get about 1 s of eyes-off-road, minus ~400 ms of lag, so about 600 ms to identify. I cannot measure your 600 ms; the glance test lets you check it yourself. The rules I applied:
1. **Three size tiers.** Glance (>=118 px: beta 150, delta 118, gear 190), quick (>=52 px: tyre temp 60, brake peak and trail 64, disc temps 52, fuel laps 76, speed 76), parked reference (22 px, dimmed). Nothing is below 12 px.
2. **Fixed slots, nothing moves.** A value is always in the same place, so you learn where to look, not what to read.
3. **State is colour AND a symbol or word**, never colour alone: tyre/disc temps use cold blue down-triangle, green dot, amber up-triangle, red double up-triangle; delta shows SLOWER/FASTER; balance is a word with an arrow; slide is "SLIDE" with a triangle.
4. **No chart needs interpretation.** Removed: g-g diagram, damper histograms, friction circle, load-share bars, tyre trend lines, pedal/steering overlay, 3-second trace, sparklines.
5. **Related items touch.** Telemetry sits around the car; braking sits directly under lap/sector timing; fuel, race and events share the right column.

## Layout (1920x1080, three columns, fixed heights)
| Zone | Contents |
|---|---|
| Top bar (74 px) | Corner phase: STRAIGHT / BRAKING / TRAIL BRAKE / COAST / ROTATION / POWER, full width, active segment filled (orange trail, red rotation, green power) |
| Centre (800 px) | Giant beta + band word (GRIP / TRANSITION / SLIDE). Top-down car with a **slip wedge** between nose and travel direction (colour = band; visible even at a few degrees), white nose arrow, yellow travel arrow, wheels coloured by grip use, load-centre dot. Four tyre cards at the car's corners: core temp with state symbol and trend arrow, pressure with delta to target, I/M/O temps, wear, bottom-out count, LOCK flag. Balance word + 7-segment meter under the car; lat g, long g, load centre numbers |
| Left (540 px) | LAP: delta (118 px), predicted, best, three sector chips (purple/green/amber), last 5 laps. **BRAKING directly beneath:** peak brake and trail-brake time with arrow vs best, four disc temps laid out like the car (FL FR / RL RR), fade word, ABS state, bias |
| Right (540 px) | Gear (190 px) and speed, rpm, TC/ABS state; FUEL: laps left (coloured), fuel, per lap, to add, pit-by lap; RACE: position, gaps, flag, time left; EVENTS: last 3 in words; driver input vs best (overlap, reversals, smoothness) |
| Bottom strip (96 px) | Parked reference, deliberately quiet: pitch, roll, yaw rate, steer, throttle, brake, oil, water, track, air, damper limit counts, data quality |

## What happened to each earlier item
| Earlier panel | Now |
|---|---|
| Slip view + 3 s trace | Car with slip wedge, giant beta; trace dropped |
| Four corner panels | Four tyre cards around the car (fewer rows, bigger numbers) |
| Dynamics (g-g, load transfer) | Numbers only: lat g, long g, load-centre dot on the car |
| Balance and grip | Balance word + segment meter; grip use shown as wheel colour and a % on each card (ACC) |
| Braking analysis | Beneath lap timing: peak, trail, discs, fade word, ABS, bias (lock-up flags on the discs and tyre cards) |
| Tyre stint trends | Trend arrow on temp, pressure delta to target, wear % on each card |
| Suspension and ride | Bottom-out count on each tyre card, totals in the reference strip; histograms dropped; pitch/roll in the strip |
| Driver input quality | Three numbers with arrows vs best; pedal overlay dropped |
| Data table | Reference strip |
| Systems | Oil/water in the strip, TC/ABS chips beside the gear |

## Open choices for you
- **Oil and water temps** are in the quiet strip. If you want them to jump out when something is wrong, I can add a red banner over the top bar for oil/water/brake-fade alarms (appears only on fault).
- **Sector chips and last-5 laps** are read only on straights; they are mid-size. Say if you want them smaller.
- The **balance meter** is 7 steps (3 either side). With a real car the step size (1.5 degrees per step for ACC, 0.33 for the iRacing estimate) will need tuning.
- Left/right placement of the columns is a guess. If the screen sits to one side of the wheel, tell me which and I can mirror it so the most-used zone is nearest your eyes.
