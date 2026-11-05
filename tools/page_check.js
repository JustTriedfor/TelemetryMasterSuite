// Opens TMSPageProbe in SimHub's real web client (headless Edge), switches screens with the client's own NextScreen / PreviousScreen action and prints what is on screen.
// Read-only apart from the screen-switch action (the same action a wheel button triggers). Needs SimHub running and tools/page_probe.js run once.
//   node tools/page_check.js [secondsPerStep]
var cp = require('child_process'), http = require('http'), path = require('path');
var NAME = 'TMSPageProbe', secs = +(process.argv[2] || 9);
var EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', PORT = 9400 + Math.floor(Math.random() * 50), prof = path.join(process.env.TEMP || '.', 'cdp_prof_' + PORT);
var proc = cp.spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
function get(u, cb) { http.get(u, function (r) { var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { cb(null, b); }); }).on('error', function (e) { cb(e); }); }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var DUMP = 'JSON.stringify({screens: Array.from(document.querySelectorAll(".screen")).map(function(s){return (s.id||"?").slice(0,8)+":"+getComputedStyle(s).display+(s.classList.contains("active")?"*":"");}),' +
  ' text: Array.from(document.querySelectorAll(".dash-item.TextItem")).filter(function(e){return e.getClientRects().length>0 && e.innerText;}).map(function(e){return e.innerText.replace(/\\n/g," | ");})})';
(async function () {
  var targets = null, i;
  for (i = 0; i < 40 && !targets; i++) { await wait(300); targets = await new Promise(function (res) { get('http://127.0.0.1:' + PORT + '/json', function (e, b) { try { res(e ? null : JSON.parse(b).filter(function (t) { return t.type === 'page'; })); } catch (x) { res(null); } }); }); if (targets && !targets.length) { targets = null; } }
  if (!targets) { console.log('no DevTools target'); proc.kill(); return; }
  var ws = new WebSocket(targets[0].webSocketDebuggerUrl), id = 0, pending = {}, errs = [];
  function send(method, params) { return new Promise(function (res) { var n = ++id; pending[n] = res; ws.send(JSON.stringify({ id: n, method: method, params: params || {} })); }); }
  ws.onmessage = function (m) { var d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d.result || d.error); delete pending[d.id]; } if (d.method === 'Runtime.exceptionThrown') { errs.push((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text); } };
  await new Promise(function (r) { ws.onopen = r; });
  await send('Runtime.enable'); await send('Page.enable');
  async function dump(label) { var r = await send('Runtime.evaluate', { expression: DUMP, returnByValue: true }); var v = r && r.result && r.result.value; console.log('--- ' + label); if (!v) { console.log(JSON.stringify(r)); return; } v = JSON.parse(v); console.log('screens: ' + v.screens.join(' ')); v.text.forEach(function (t) { console.log('  ' + t); }); }
  async function act(expr) { var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r && r.result && r.result.value; }
  await send('Page.navigate', { url: 'http://localhost:8888/Dash#' + encodeURIComponent(NAME) });
  await wait(secs * 1000 + 3000); await dump('start (screen A expected)');
  await act('window.simhub.client.actionTriggered(7, "NextScreen")'); await wait(secs * 1000); await dump('after NextScreen (screen B expected)');
  await act('window.simhub.client.actionTriggered(7, "NextScreen")'); await wait(secs * 1000); await dump('after a second NextScreen (back to A? or the disabled one?)');
  await act('window.simhub.client.actionTriggered(6, "PreviousScreen")'); await wait(secs * 1000); await dump('after PreviousScreen');
  if (errs.length) { console.log('exceptions:', errs.slice(0, 3)); }
  ws.close(); proc.kill();
  try { cp.execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'msedge.exe\'\\" | Where-Object { $_.CommandLine -match \'cdp_prof_' + PORT + '\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { stdio: 'ignore' }); } catch (e) { }
})();
