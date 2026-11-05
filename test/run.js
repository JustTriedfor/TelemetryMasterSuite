var cp = require('child_process'), r = 0;
['test/adapters.test.js', 'test/physics.test.js', 'test/dash.test.js', 'test/dash_build.test.js', 'test/identity.test.js', 'test/paging.test.js', 'test/glance.test.js', 'test/probe.test.js', 'test/es5.js'].forEach(function (f) {
  r |= cp.spawnSync('node', [f], { stdio: 'inherit' }).status;
});
process.exit(r);
