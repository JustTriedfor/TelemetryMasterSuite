# dash/

What goes into the dash package.

| Path | What it is |
|---|---|
| `out/TelemetryMasterSuite_v1_4.simhubdash` | the current dash (1.4, a balance-first side panel on three pages: Balance, Tyres and car, Brakes, with alert and flag pop-ups): import this in SimHub's Dash Studio |
| `out/TelemetryMasterSuite_v1_3.simhubdash` | the 1.3 dash (a glance page first), kept unchanged |
| `out/TelemetryMasterSuite_v1_2.simhubdash` | the 1.2 dash (three panel pages), kept unchanged |
| `out/TelemetryMasterSuite_v1_1.simhubdash` | the 1.1 dash (one page), kept unchanged |
| `out/TelemetryMasterSuite.simhubdash` | the 1.0.0 dash, kept unchanged so the two can be compared |
| `out/TMSProbe.simhubdash` | a separate diagnostic dash that prints raw property values, their types and min/max |
| `js/tms_dash.js` | the library every formula in the dash calls; shipped inside the package |
| `assets/` | the images embedded in the dashes |

The packager also copies `lib/physics.js` and `lib/adapters.js` into the package as JavaScript extensions.

`out/` holds more while you work (the unzipped build folders and HTML previews). That is build output and is not committed; only the `.simhubdash` packages are.

How to install the dash, what each panel shows, how to rebuild it and the known limits are in the [main README](../README.md).
