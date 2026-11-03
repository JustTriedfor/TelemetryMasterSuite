# Property map (Stage 1)

> **Working reference.** The SimHub property names the dash reads, and how sure we are of each (see the legend below). Written while the dash was built, so "the friend's dashboard" is a third-party reference dashboard that was read, never copied, to learn the file format and which property names exist. For what is confirmed live, see [TO_VERIFY.md](TO_VERIFY.md) and *Known limits* in [README.md](README.md).

Legend for the **Status** column:
- **V** = verified: the exact name appears in the friend's dashboard and is read there for that game. This shows the name exists on at least one working install; it is not a guarantee for your version.
- **D** = documented in the game's own SDK or shared-memory spec, but the SimHub-side name and array handling are **not verified** (see TO_VERIFY.md).
- **?** = a guess at a standard SimHub name. Not seen anywhere I could check.

All per-corner arrays are FL, FR, RL, RR. Output units are in `lib/adapters.js`.

## Common (all three sims)
| Schema field | SimHub property | Status |
|---|---|---|
| sim | `DataCorePlugin.CurrentGame` = `IRacing` / `AssettoCorsaCompetizione` / `AssettoCorsa` | V |
| speed | `SpeedKmh` (/3.6) | V |
| throttle, brake, clutch | `Throttle`, `Brake`, `Clutch` | V (value range 0-100 vs 0-1 unverified) |
| gear, rpm, maxRpm | `Gear`, `Rpms`, `MaxRpm` | V |
| fuel, maxFuel | `Fuel`, `MaxFuel` | V |
| oil / water temp | `OilTemperature`, `WaterTemperature` | ? |
| air / track temp | `AirTemperature`, `RoadTemperature` | V |
| brake bias | `BrakeBias` | V |
| ABS / TC | `ABSActive`, `ABSLevel`, `TCActive`, `TCLevel` | V |
| laps | `CurrentLap`, `DataCorePlugin.GameData.CompletedLaps`, `TotalLaps`, `DataCorePlugin.GameData.LapInvalidated` | V |
| lap times | `CurrentLapTime`, `BestLapTime`, `LastLapTime` (type unverified; adapter accepts seconds, TimeSpan-like, or text) | V name / ? type |
| session | `SessionTimeLeft`, `Position`, `OpponentsCount`, `IsInPitLane` | V |
| tyre pressure | `DataCorePlugin.GameData.TyrePressure{FrontLeft...}` (unit from `TyrePressureUnit`) | V |
| tyre wear | `DataCorePlugin.GameData.TyreWear{...}` | V |
| brake disc temp | `DataCorePlugin.GameData.BrakeTemperature{...}` | V |
| tyre avg temp | `DataCorePlugin.GameData.TyreTemperature{...}` | V |
| temperature unit | `TemperatureUnit` (Kelvin / Fahrenheit / else Celsius) | V |

## ACC (confirmed present in your SimHub 9.12.9 catalog, status **C**)
Raw values are flattened into scalar properties named `<Base>01..04` (FL, FR, RL, RR) or `01..03` (x, y, z). Prefix: `DataCorePlugin.GameRawData.Physics.`
| Schema field | Property | Status |
|---|---|---|
| car-local velocity (used for beta) | `LocalVelocity01..03` | C (axis order and sign still to verify while driving) |
| world velocity, heading | `Velocity01..03`, `Heading` | C (cross-check only) |
| pitch, roll | `Pitch`, `Roll` | C |
| yaw rate | `LocalAngularVelocity01..03` (index 02 = yaw, assumed) | C / ? |
| g forces | `AccG01..03` | C (order assumed lateral, vertical, longitudinal) |
| steering | `SteerAngle` | C |
| tyre load | `WheelLoad01..04` | C |
| **slip angle** | `SlipAngle01..04` | C (real slip angle, so the balance meter and grip bars are fully supported on ACC) |
| **slip ratio** | `SlipRatio01..04` | C |
| combined slip | `WheelSlip01..04` (not used) | C |
| suspension travel | `SuspensionTravel01..04`; limits `StaticInfo.SuspensionMaxTravel01..04` (no need to learn limits) | C |
| wheel speed, tyre radius | `WheelAngularSpeed01..04`, `StaticInfo.TyreRadius01..04` (lock-ups need no learning) | C |
| camber | `CamberRad01..04` | C |
| tyre core temp | `TyreCoreTemperature01..04` | C |
| tread inner/mid/outer | `DataCorePlugin.GameData.TyreTemperature{Pos}{Inner,Middle,Outer}` | C (shared across sims) |
| brake disc / pad | `BrakeTemp01..04`, `brakePressure01..04`, `padLife01..04` | C |
| ERS / turbo | `ErsPowerLevel`, `KersCharge`, `Turbo` | C (not mapped yet) |
| gaps, delta | `Graphics.gapAhead`, `gapBehind`, `GameData.DeltaToSessionBest` | C |
| oil / water temp | `DataCorePlugin.GameData.OilTemperature`, `WaterTemperature` | C |
| stint/fuel helpers | `DataCorePlugin.Computed.Fuel_LitersPerLap`, `Fuel_RemainingLaps` | C (SimHub already computes these) |

The catalog was taken with ACC not running, so it proves the names exist but all values are 0. Meanings, units and signs still need a catalog taken while driving (TO_VERIFY section F).

## Assetto Corsa (AC) (confirmed present in the AC catalog, status **C**)
Same `Physics.<Base>01..04` flattening as ACC, but a smaller set:
| Schema field | Property | Status |
|---|---|---|
| world velocity, heading | `Velocity01..03`, `Heading` (no car-local velocity in AC) | C; the heading/velocity relation is **learned from straight running** (`frameCalib`) |
| pitch, roll, g | `Pitch`, `Roll`, `AccG01..03` | C |
| yaw rate | `DataCorePlugin.GameData.OrientationYawVelocity` (no LocalAngularVelocity in AC) | C (units/sign unverified) |
| tyre load, travel, wheel speed, camber | `WheelLoad`, `SuspensionTravel`, `WheelAngularSpeed`, `CamberRad` (01..04) | C |
| slip | only `WheelSlip01..04` (one combined magnitude per tyre). **No SlipAngle, no SlipRatio** | C |
| tread inner/mid/outer, core | `TyreTempI/M/O01..04`, `TyreCoreTemperature01..04` | C |
| tyre radius, suspension limits, gaps | not provided; radius and limits are learned, gaps are n/a | C (absent) |
| TC/ABS activation | `GameRawData.Extensions.UDPIsTcInAction` / `UDPIsAbsInAction` (need AC UDP enabled) | C (not wired yet) |

## iRacing (`GameRawData.Telemetry.*`)
| Schema field | iRacing variable | Status |
|---|---|---|
| world/car velocity | `VelocityX/Y/Z` (m/s). Frame not stated in the sources I could read | D |
| heading, pitch, roll | `Yaw`, `Pitch`, `Roll` (rad); `YawNorth` is used in the friend's dash | D (YawNorth V) |
| yaw rate | `YawRate` (rad/s) | D |
| lat / long accel | `LatAccel`, `LongAccel` (m/s^2, gravity included) | D |
| steering | `SteeringWheelAngle` (rad) | D |
| suspension travel / velocity | `LFshockDefl`, `LFshockVel` (and RF, LR, RR) | D |
| tyre temps | `LFtempCL`, `LFtempCM`, `LFtempCR` (and RF, LR, RR) | CM is V, CL and CR are D |
| tread wear | `LFwearL/M/R` (not mapped yet) | D |
| brake line pressure | `LFbrakeLinePress` etc. (not mapped yet) | D |

## Degraded panels per sim
| Panel | ACC | AC | iRacing |
|---|---|---|---|
| Slip view (beta, momentum arrow) | Full (world velocity + heading) | Full | **Probably full, but the velocity frame must be checked** |
| Load-centre dot, load transfer | Full | Full | **Estimated** (shock deflection, else accelerations; labelled "estimated") |
| Grip utilization, friction circle | Depends on what `wheelSlip` really is | Same | **n/a** |
| Balance meter (front vs rear slip) | Full (real slip angle) | **Estimated** (front vs rear combined slip, or the yaw-rate estimate) | **Estimated** from yaw rate vs steering; shows "calibrating" until each speed bucket has data |
| Tread temp inner/mid/outer | Full (GameData inner/middle/outer + core) | Full | Carcass L/M/R (probably as good as it gets) |
| Pressure, wear, brake temp | Full (normalised) | Full | Full (normalised, quality unverified) |
| Damper velocity histogram | Derived from travel, limits known | Derived | Direct from `shockVel` |
| Lock-up detection | Slip ratio, or wheel speed with known radius | Wheel speed with a learned radius | **n/a** (no wheel speed); ABS flag only |
| TC / ABS events | Yes | Yes | Yes |
| Fuel, laps, timing, race context | Full | Full | Full |
| ERS / hybrid | Only if the car has it; unmapped | Unmapped | Unmapped |

> **Correction (2026-11-01):** the ACC catalog spells the slip properties `Physics.slipAngle01..04` and `Physics.slipRatio01..04` (lower-case first letter). The table above says `SlipAngle01`; `tms_ph` and the adapter now try both. AC runtime facts measured with the probe are in TO_VERIFY section P.
