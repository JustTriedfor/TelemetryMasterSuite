# Changelog

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
