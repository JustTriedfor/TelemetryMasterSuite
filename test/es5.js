// Fails if any shipped .js file under lib/ (and dash/js/ when it exists) uses non-ES5 syntax.
var fs = require('fs'), path = require('path'), acorn = require('acorn');
var roots = ['lib', 'dash/js'], bad = 0, n = 0;
function walk(d) {
  if (!fs.existsSync(d)) { return; }
  fs.readdirSync(d).forEach(function (f) {
    var p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { return walk(p); }
    if (!/\.js$/.test(f)) { return; }
    n++;
    try { acorn.parse(fs.readFileSync(p, 'utf8'), { ecmaVersion: 5, sourceType: 'script' }); console.log('es5 ok  ' + p); }
    catch (e) { bad++; console.log('NOT ES5 ' + p + ': ' + e.message); }
  });
}
roots.forEach(walk);
if (!n) { console.log('no files checked'); process.exit(1); }
process.exit(bad ? 1 : 0);
