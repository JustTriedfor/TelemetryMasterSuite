# Telemetry Master Suite

A SimHub 9.12.9 dashboard for a 1920x1080 second monitor, built around live **body slip angle** with tyre, brake, lap and fuel analysis. Assetto Corsa Competizione and Assetto Corsa are supported; iRacing is an unfinished side project.

The dash is generated (not hand-drawn in Dash Studio): a pixel mock is approved first, `build/build_dash.js` turns its geometry into a `.djson`, and `build/package.py` zips it into a `.simhubdash` that SimHub imports. All bindings are strict ES5 JavaScript formulas that call the library in `dash/js/tms_dash.js`.

**Status:** it imports and runs in SimHub (tested in Assetto Corsa). Many signs, units and behaviours are still unverified because they were built from property catalogs, not a live rig: see `TO_VERIFY.md` (section P holds the first real measurements from the probe dash).

## Layout

| Path | What it is |
|---|---|
| `lib/` | physics (`physics.js`) and game adapters (`adapters.js`), ES5, no SimHub dependency |
| `dash/js/tms_dash.js` | the binding library shipped inside the dash (`tms`, `tms2`, `tmsr`) |
| `dash/assets/` | images embedded in the dash |
| `build/` | generator (`build_dash.js`), probe generator (`build_probe.js`), packager (`package.py`), preview renderer (`preview.js`), mock geometry |
| `mock/` | the HTML mock the layout was designed in, and a telemetry simulator |
| `test/` | unit tests and a validator that runs every generated formula against simulated ACC and AC telemetry |
| `template_extracted/` | an empty 1920x1080 dash exported from SimHub, used as the packaging template |
| `dash/out/*.simhubdash` | the two finished packages: `TelemetryMasterSuite` (the dash) and `TMSProbe` (prints raw property values, types and min/max to settle the unverified items) |
| `TO_VERIFY.md`, `property-map.md`, `DENSE_LAYOUT.md`, ... | findings, the property map and design notes |

## Build and test

```
npm install
node build/build_dash.js
node build/build_probe.js
python build/package.py
npm test
```

Python needs Pillow. Previews: `node build/preview.js acc 25.5` or `node build/preview.js ac 18 practice`, then open `dash/out/preview_*.html`.

## Not in this repository

Kept local on purpose: third-party reference dashboards used only to learn the file format (`friend_extracted/`, `ref_extracted/`; the three schema and type tests skip without them), the raw source images for the car and wheel cut-outs, and the one-off patch scripts from the iterative build.
