// Loads a dash in SimHub's real web client (headless Edge, DevTools protocol) and reports console output, uncaught exceptions with stacks,
// how many dash items were rendered, and saves a screenshot.   node tools/cdp_dash.js <DashName> [seconds] [out.png] [--page N]
// --page N switches to screen N first, with the same NextScreen action a wheel button triggers (a dash with several pages).
// Needs SimHub running (web server on :8888). Read-only: it only opens a page.
var cp = require('child_process'), http = require('http'), fs = require('fs'), path = require('path');
var name = process.argv[2] || require('../build/dash_name.js'), secs = +(process.argv[3] || 12), out = process.argv[4] || path.join(__dirname, '..', 'mock', 'shots', 'cdp_' + name.replace(/\W+/g, '_') + '.png');
var EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', PORT = 9340 + Math.floor(Math.random() * 50);
var prof = path.join(process.env.TEMP || '.', 'cdp_prof_' + PORT);
var proc = cp.spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
function get(u, cb) { http.get(u, function (r) { var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { cb(null, b); }); }).on('error', function (e) { cb(e); }); }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
(async function () {
  var targets = null, i;
  for (i = 0; i < 40 && !targets; i++) { await wait(300); targets = await new Promise(function (res) { get('http://127.0.0.1:' + PORT + '/json', function (e, b) { try { res(e ? null : JSON.parse(b).filter(function (t) { return t.type === 'page'; })); } catch (x) { res(null); } }); }); if (targets && !targets.length) { targets = null; } }
  if (!targets) { console.log('no DevTools target'); proc.kill(); return; }
  var ws = new WebSocket(targets[0].webSocketDebuggerUrl), id = 0, pending = {}, logs = [], exc = [], caught = [], reqs = {};
  function send(method, params) { return new Promise(function (res) { var n = ++id; pending[n] = res; ws.send(JSON.stringify({ id: n, method: method, params: params || {} })); }); }
  ws.onmessage = function (m) {
    var d = JSON.parse(m.data);
    if (d.id && pending[d.id]) { pending[d.id](d.result || d.error); delete pending[d.id]; return; }
    if (d.method === 'Runtime.consoleAPICalled') { logs.push(d.params.type + ': ' + d.params.args.map(function (a) { return a.value !== undefined ? a.value : (a.description || a.type); }).join(' ').slice(0, 300)); }
    if (d.method === 'Network.requestWillBeSent' && /Definition|djson/i.test(d.params.request.url)) { reqs[d.params.requestId] = d.params.request.url; }
    if (d.method === 'Debugger.paused') {      // exceptions that the page itself catches and swallows
      var pp = d.params; caught.push((pp.data && (pp.data.description || pp.data.value) || pp.reason) + '\n   at ' + pp.callFrames.slice(0, 5).map(function (f) { return f.functionName + ' ' + f.url.split('/').pop() + ':' + f.location.lineNumber; }).join('\n   at '));
      send('Debugger.resume');
    }
    if (d.method === 'Runtime.exceptionThrown') { var e = d.params.exceptionDetails; exc.push((e.exception && e.exception.description || e.text) + '\n   at ' + (e.stackTrace ? e.stackTrace.callFrames.slice(0, 6).map(function (f) { return f.functionName + ' ' + f.url.split('/').pop() + ':' + f.lineNumber + ':' + f.columnNumber; }).join('\n   at ') : e.url + ':' + e.lineNumber)); }
  };
  await new Promise(function (r) { ws.onopen = r; });
  await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  if (process.argv.indexOf('--caught') > 0) { await send('Debugger.enable'); await send('Debugger.setPauseOnExceptions', { state: 'all' }); }
  await send('Page.navigate', { url: 'http://localhost:8888/Dash#' + encodeURIComponent(name) });
  await wait(secs * 1000);
  var pg = process.argv.indexOf('--page') > 0 ? +process.argv[process.argv.indexOf('--page') + 1] : 1, pk;
  for (pk = 1; pk < pg; pk++) { await send('Runtime.evaluate', { expression: 'window.simhub.client.actionTriggered(7, "NextScreen")' }); await wait(Math.min(secs, 6) * 1000); }
  var stats = await send('Runtime.evaluate', { expression: 'JSON.stringify({items: document.querySelectorAll(".dash-item").length, byType: ["TextItem","RectangleItem","ImageItem","ChartItem","EllipseItem"].map(function(t){return t+":"+document.querySelectorAll(".dash-item."+t).length;}), wrap: Object.keys(window.SimHubWrapItems||{}).length, overlay: (function(){var o=document.getElementById("progressOverlay");return o?getComputedStyle(o).display:null;})(), label: (document.getElementById("loadingLabel")||{}).innerText, progress: Array.from(document.querySelectorAll(".progresslist li")).map(function(l){return l.innerText;})})', returnByValue: true });
  var shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) { fs.writeFileSync(out, Buffer.from(shot.data, 'base64')); }
  for (var rid in reqs) { var body = await send('Network.getResponseBody', { requestId: rid }); var f = path.join(__dirname, '..', 'build', 'inspect', 'served_' + name.replace(/W+/g, '_') + '.json'); if (body && body.body) { fs.writeFileSync(f, body.body); console.log('served definition', reqs[rid], body.body.length, 'bytes ->', f); } else { console.log('no body for', reqs[rid], JSON.stringify(body)); } }
  console.log('stats', stats && stats.result && stats.result.value);
  console.log('console (' + logs.length + '):'); var seen = {}; logs.forEach(function (l) { var k = l.replace(/\d+/g, 'N'); seen[k] = (seen[k] || 0) + 1; if (seen[k] <= 2) { console.log('  ' + l); } });
  console.log('exceptions (' + exc.length + '):'); exc.slice(0, 4).forEach(function (e) { console.log('  ' + e); });
  if (caught.length) { console.log('caught-and-swallowed exceptions (' + caught.length + '):'); var cs = {}; caught.forEach(function (c) { var k = c.split('\n')[0]; cs[k] = (cs[k] || 0) + 1; if (cs[k] === 1) { console.log('  ' + c); } }); }
  console.log('screenshot', out);
  ws.close(); proc.kill(); try { cp.execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'msedge.exe\'\\" | Where-Object { $_.CommandLine -match \'cdp_prof_' + PORT + '\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { stdio: 'ignore' }); } catch (e) { }
})();
