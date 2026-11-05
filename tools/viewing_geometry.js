// Viewing geometry and a sunlight contrast model for glance-reading the dash (see docs/notes/DRIVER_REVIEW.md). node tools/viewing_geometry.js
// Every number is computed here; the screen size, distance, sun and panel brightness are ASSUMPTIONS (edit the first lines).
var DIAG_IN = 11, DIST_MM = 750, ECC_DEG = 20, PXW = 1920, PXH = 1080;
var diag = DIAG_IN * 25.4, k = diag / Math.sqrt(PXW * PXW + PXH * PXH), W = PXW * k, H = PXH * k, pitch = k;
function deg(r) { return r * 180 / Math.PI; }
var arcminMm = DIST_MM * Math.PI / 10800, arcminPx = arcminMm / pitch;
console.log('screen ' + W.toFixed(1) + ' x ' + H.toFixed(1) + ' mm, pixel pitch ' + pitch.toFixed(4) + ' mm');
console.log('1 px = ' + (deg(pitch / DIST_MM) * 60).toFixed(2) + ' arcmin; 1 degree = ' + (1 / deg(pitch / DIST_MM)).toFixed(0) + ' px; 1 arcmin = ' + arcminPx.toFixed(2) + ' px');
console.log('screen subtends ' + (2 * deg(Math.atan(W / 2 / DIST_MM))).toFixed(1) + ' x ' + (2 * deg(Math.atan(H / 2 / DIST_MM))).toFixed(1) + ' deg; centre ' + ECC_DEG + ' deg right of the eye line => spans ' + (ECC_DEG - deg(Math.atan(W / 2 / DIST_MM))).toFixed(1) + ' to ' + (ECC_DEG + deg(Math.atan(W / 2 / DIST_MM))).toFixed(1) + ' deg right');
console.log('foveal circle (2 deg) = ' + (2 / deg(pitch / DIST_MM)).toFixed(0) + ' px across; parafoveal (5 deg radius) = ' + (5 / deg(pitch / DIST_MM)).toFixed(0) + ' px radius; cos(20) foreshortening = ' + Math.cos(20 * Math.PI / 180).toFixed(3));
var CAP = 0.7;      // cap height / font size, a typical figure for Bahnschrift SemiCondensed (assumption)
[[11, 'small label'], [13, 'row text'], [15, 'stat number'], [26, 'rpm'], [30, 'brake stat'], [38, 'gear / speed'], [40, 'fuel laps'], [52, 'delta / beta']].forEach(function (a) { var cap = a[0] * CAP; console.log(('font ' + a[0] + ' px (' + a[1] + ')').padEnd(30) + ' cap height ' + cap.toFixed(1) + ' px = ' + (cap / arcminPx).toFixed(1) + ' arcmin'); });
[16, 20, 25, 30, 40].forEach(function (am) { var cap = am * arcminPx; console.log('cap height ' + am + ' arcmin = ' + cap.toFixed(1) + ' px  => font about ' + Math.round(cap / CAP) + ' px'); });
// contrast under sun: displayed luminance = Y * Lpeak + Lveil (veil = reflected sun on a matte screen). ASSUMPTION: Lpeak 300 cd/m2, veil 300 cd/m2 (about 25 000 lux on the screen face, 3.8% reflectance)
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function Y(hex) { var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
var Lp = 300, Lv = 300, bg = Y('#121215');
console.log('\ncontrast against the panel (#121215), model Lpeak ' + Lp + ' + sun veil ' + Lv + ' cd/m2 (indoors: Lveil 0):');
[['white text', '#F6F6F1'], ['signal yellow', '#F3FF3D'], ['mint / ok green', '#38E08C'], ['cyan FL', '#4CC9F0'], ['text grey', '#D6D6DC'], ['orange warn', '#FF8A1F'], ['brake red', '#FF3D5A'], ['cold blue', '#5DB3FF'], ['label grey', '#80808B'], ['dim grey', '#6C6C78'], ['off grey', '#565660']].forEach(function (c) {
  var y = Y(c[1]), inside = (y + 0.05) / (bg + 0.05), sun = (y * Lp + Lv) / (bg * Lp + Lv);
  console.log(c[0].padEnd(18) + c[1] + '  Y ' + y.toFixed(3) + '  indoors contrast ' + inside.toFixed(1) + ':1   in sun ' + sun.toFixed(2) + ':1');
});
