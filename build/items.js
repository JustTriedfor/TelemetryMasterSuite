// Item factories for the SimHub dash (.djson). Field names follow the schema seen in the reference dash and the empty template.
var T = 'SimHub.Plugins.OutputPlugins.GraphicalDash.Models.';
var FONT = 'Bahnschrift SemiCondensed';
var seq = 0;

function argb(c, alpha) {            // '#rrggbb' | 'rgb(r, g, b)' | 'rgba(r, g, b, a)' | '#aarrggbb' -> '#AARRGGBB'
  var m, a = 255;
  if (!c) { return '#00FFFFFF'; }
  if (/^#[0-9a-fA-F]{8}$/.test(c)) { return c.toUpperCase(); }
  if (/^#[0-9a-fA-F]{6}$/.test(c)) { return ('#' + (alpha === undefined ? 'FF' : hex2(Math.round(alpha * 255))) + c.slice(1)).toUpperCase(); }
  m = /rgba?\(\s*(\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?/.exec(c);
  if (!m) { throw new Error('bad colour ' + c); }
  if (m[4] !== undefined) { a = Math.round(parseFloat(m[4]) * 255); }
  if (alpha !== undefined) { a = Math.round(alpha * 255); }
  return ('#' + hex2(a) + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3])).toUpperCase();
}
function hex2(n) { n = Math.max(0, Math.min(255, n)); return (n < 16 ? '0' : '') + n.toString(16); }
function R(n) { return Math.round(n); }     // whole pixels: SimHub's own dashboards never store decimals for geometry

function base(type, name, x, y, w, h, extra) {
  var o = { '$type': T + type + ', SimHub.Plugins' }, k;
  for (k in extra) { o[k] = extra[k]; }
  if (o.BackgroundColor === undefined) { o.BackgroundColor = '#00FFFFFF'; }
  o.Height = R(h); o.Left = R(x); o.Top = R(y); o.Visible = true; o.BlinkPhasisInverted = false; o.Width = R(w);
  o.IsFreezed = true; o.Name = (name || type) + '_' + (++seq); o.RenderingSkip = 0; o.MinimumRefreshIntervalMS = 0; o.Bindings = {};
  return o;
}
// bindings: JavaScript formula (Interpreter 1) that may call the extension functions (JSExt 1)
function js(expr, isText) { var b = { Formula: { JSExt: 1, Interpreter: 1, Expression: expr }, Mode: 2 }; if (isText) { b.FormatString = ''; } return b; }
function bind(item, prop, expr) { item.Bindings[prop] = js(expr, prop === 'Text'); return item; }

function rect(x, y, w, h, color, name) { return base('RectangleItem', name || 'Rect', x, y, w, h, { IsRectangleItem: true, BackgroundColor: argb(color) }); }
function text(x, y, w, h, str, o, name) {
  o = o || {};
  return base('TextItem', name || 'Text', x, y, w, h, { IsTextItem: true, Font: o.font || FONT, FontWeight: o.fw || 'Normal', FontSize: o.fs || 12, Text: str, TextColor: argb(o.color || '#D6D6DC'),
    HorizontalAlignment: o.ha === undefined ? 0 : o.ha, VerticalAlignment: o.va === undefined ? 1 : o.va });
}
function image(img, x, y, w, h, name) { return base('ImageItem', name || img, x, y, w, h, { Image: img, AutoSize: false }); }
function chart(x, y, w, h, o, name) {
  if (o.min % 1 !== 0 || o.max % 1 !== 0 || o.points % 1 !== 0) { throw new Error('chart ' + (name || '') + ': min/max/points must be whole numbers (' + o.min + ', ' + o.max + ', ' + o.points + ')'); }
  return base('ChartItem', name || 'Chart', x, y, w, h, { ChartSuspended: false, ChartEnabled: true, CurrentValue: 0, Minimum: o.min, UseMinimum: true, UseMaximum: true, Maximum: o.max,
    LineColor: argb(o.color), LineTickness: Math.max(1, Math.round(o.thick || 2)), PointsCount: o.points });
}
function weight(fw) { fw = +fw; return fw >= 700 ? 'Bold' : (fw >= 600 ? 'SemiBold' : (fw >= 500 ? 'Medium' : 'Normal')); }

module.exports = { argb: argb, base: base, js: js, bind: bind, rect: rect, text: text, image: image, chart: chart, weight: weight, R: R, FONT: FONT };
