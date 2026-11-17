// Runs every check, one after another, and prints one line for each.
//
//   node checks/run-all.js                 start a local copy of the app and check it
//   node checks/run-all.js <site address>  check a site that is already up (for example the live site)
//   node checks/run-all.js --only office   run only the checks whose name has "office" in it
//
// Exits with 0 when every check passed, 1 when any check failed.
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..'), OUT = path.join(__dirname, 'out');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const site = args.find((a) => /^https?:/.test(a));

// name, file, extra arguments
const CHECKS = [
  ['Every screen opens at four widths', 'every-screen.js'],
  ['Full sale, cash', 'full-sale.js', ['Cash purchase']],
  ['Full sale, rent-to-own', 'full-sale.js', ['Rent-to-own']],
  ['Sales desk', 'sales-desk.js'],
  ['Answers and the bell', 'answers-and-bell.js'],
  ['Users and pricing', 'users-and-pricing.js'],
  ['Lot limits', 'lot-limits.js'],
  ['Office', 'office.js'],
  ['Office and Logistics paths', 'office-and-logistics-paths.js'],
  ['Production', 'production.js'],
  ['Production loads', 'production-loads.js'],
  ['Plant', 'plant.js'],
  ['Logistics', 'logistics.js'],
  ['Drive time', 'drive-time.js'],
  ['Firefly', 'firefly.js'],
  ['Phone', 'phone.js'],
  ...fs.readdirSync(path.join(__dirname, 'fixes')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort()
    .map((f) => ['Fix ' + f.replace(/\.js$/, '').replace(/-/g, ' '), 'fixes/' + f]),
].filter(([name]) => !only || name.toLowerCase().includes(only.toLowerCase()));

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((done) => {
    const server = http.createServer((req, res) => {
      const name = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      const file = path.join(ROOT, name === '/' ? 'index.html' : name);
      if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, body) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      });
    });
    server.listen(0, '127.0.0.1', () => done(server));
  });
}

// One check: run it, read what it printed, and count.
function run(file, url, extra = []) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [path.join(__dirname, file), url, ...extra], { cwd: OUT, env: { ...process.env, URL: url } });
    let text = '';
    child.stdout.on('data', (d) => (text += d));
    child.stderr.on('data', (d) => (text += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 20 * 60 * 1000);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const lines = text.split('\n');
      const said = text.match(/(\d+) passed, (\d+) failed/g);
      let passed, failed;
      if (said) [, passed, failed] = said[said.length - 1].match(/(\d+) passed, (\d+) failed/).map(Number);
      else {
        passed = lines.filter((l) => /^\s*(ok|PASS|✓)\b/.test(l)).length;
        failed = lines.filter((l) => /^\s*(FAIL|✗)\b/.test(l)).length;
      }
      /* Some older checks walk through the app and only report page errors and layout trouble. */
      const trouble = lines.filter((l) => /\b(OVERFLOW|STEP ERROR|PROBLEM)\b/.test(l));
      failed += trouble.length;
      if (!said && !passed && !failed && !code && !signal) passed = 1; /* it walked through cleanly */
      const errs = [...text.matchAll(/errors?:? (\d+)/gi)].map((m) => +m[1]).reduce((a, b) => a + b, 0) + (/errors \[\s*\S/.test(text) ? 1 : 0);
      const problems = [...text.matchAll(/(\d+) problems/g)].map((m) => +m[1]).reduce((a, b) => a + b, 0);
      const crashed = signal ? 'stopped after 20 minutes' : code && !failed ? 'stopped with an error' : '';
      const bad = [...lines.filter((l) => /^\s*(FAIL|✗)\b/.test(l)), ...trouble].slice(0, 5);
      if (crashed) bad.push(...lines.filter((l) => l.trim()).slice(-4));
      done({ passed, failed: failed + (crashed ? 1 : 0), errs: errs + problems, crashed, bad });
    });
  });
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  for (const d of ['tmp15', 'look', 'pics']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const server = site ? null : await serve();
  const url = site || `http://127.0.0.1:${server.address().port}/`;
  console.log(`Checking ${url}\n`);
  let P = 0, F = 0, E = 0;
  const failedNames = [], started = Date.now();
  for (const [name, file, extra] of CHECKS) {
    const t = Date.now(), r = await run(file, url, extra);
    P += r.passed; F += r.failed; E += r.errs;
    const good = !r.failed && !r.errs;
    if (!good) failedNames.push(name);
    console.log(`${good ? 'ok  ' : 'FAIL'}  ${name.padEnd(46)} ${String(r.passed).padStart(4)} passed  ${String(r.failed).padStart(3)} failed${r.errs ? `  ${r.errs} page errors` : ''}  ${Math.round((Date.now() - t) / 1000)}s${r.crashed ? '  (' + r.crashed + ')' : ''}`);
    for (const l of r.bad) console.log('        ' + l.trim().slice(0, 220));
  }
  if (server) server.close();
  console.log(`\n${CHECKS.length} checks run in ${Math.round((Date.now() - started) / 60000)} minutes: ${P} passed, ${F} failed, ${E} page errors.`);
  if (failedNames.length) console.log('Not clean: ' + failedNames.join('; '));
  process.exit(F || E ? 1 : 0);
})();
