# dash/

What goes into the dash package.

| Path | What it is |
|---|---|
| `out/TelemetryMasterSuite.simhubdash` | the finished dash: import this in SimHub's Dash Studio |
| `out/TMSProbe.simhubdash` | a separate diagnostic dash that prints raw property values, their types and min/max |
| `js/tms_dash.js` | the library every formula in the dash calls; shipped inside the package |
| `assets/` | the images embedded in the two dashes |

The packager also copies `lib/physics.js` and `lib/adapters.js` into the package as JavaScript extensions.

`out/` holds more while you work (the unzipped build folders and HTML previews). That is build output and is not committed; only the two `.simhubdash` files are.

How to install the dash, what each panel shows, how to rebuild it and the known limits are in the [main README](../README.md).
