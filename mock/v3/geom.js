// Geometry extractor: with ?geom=1 the page writes every element's box, text and style into <pre id="geom"> as JSON,
// so `msedge --headless --dump-dom` can hand it to the dash generator. Not part of the dash itself.
(function () {
  if (!/[?&]geom=1/.test(location.search)) { return; }
  setTimeout(function () {
    var app = document.getElementById('app'), s = parseFloat((app.style.transform.match(/scale\(([\d.]+)\)/) || [0, 1])[1]) || 1, out = [];
    var all = app.querySelectorAll('*');
    Array.prototype.forEach.call(all, function (e, i) {
      var r = e.getBoundingClientRect(), cs = getComputedStyle(e), own = '';
      Array.prototype.forEach.call(e.childNodes, function (n) { if (n.nodeType === 3) { own += n.textContent; } });
      own = own.replace(/\s+/g, ' ').trim();
      var bg = cs.backgroundColor, bga = /rgba\(/.test(bg) ? parseFloat(bg.split(',')[3]) : 1;
      out.push({ i: i, tag: e.tagName.toLowerCase(), id: e.id || '', cls: (typeof e.className === 'string' ? e.className : ''), p: e.parentElement === app ? 'app' : (e.parentElement.id || e.parentElement.className || e.parentElement.tagName.toLowerCase()),
        x: Math.round(r.left / s * 10) / 10, y: Math.round(r.top / s * 10) / 10, w: Math.round(r.width / s * 10) / 10, h: Math.round(r.height / s * 10) / 10,
        text: own, color: cs.color, bg: (bga > 0.02 ? bg : ''), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, ta: cs.textAlign, disp: cs.display, w2: e.tagName === 'CANVAS' ? [e.width, e.height] : null });
    });
    var pre = document.createElement('pre'); pre.id = 'geom'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  }, 1500);
})();
