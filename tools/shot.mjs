// Screenshot / smoke-test harness.
//   node tools/shot.mjs <path-with-query-or-hash> <out.png> [width] [height] [waitMs] [--full] [--dark] [--eval "js"]
// Serves the repo over HTTP and maps the three.js CDN URL to a local copy (the CDN is blocked in the dev sandbox).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const THREE = process.env.THREE_LOCAL || '/tmp/claude-0/-home-user-hello-world/ba9a89e1-a4a7-519c-979e-a0c3c727060e/scratchpad/vendor/package/build/three.min.js';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--') && a !== '--eval'));
let evalJs = null; const ei = args.indexOf('--eval'); if (ei >= 0) { evalJs = args[ei + 1]; args.splice(ei, 2); }
const pos = args.filter((a) => !a.startsWith('--'));
const [url = 'index.html', out = 'shot.png', w = '1400', h = '900', wait = '1500'] = pos;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  });
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: flags.has('--dark') ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || flags.has('--log')) errors.push('[' + m.type() + '] ' + m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.route('**/cdnjs.cloudflare.com/**three**', (r) => r.fulfill({ path: THREE, contentType: 'text/javascript' }));
await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.goto(`http://localhost:${port}/${url}`, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
if (evalJs) { const r = await page.evaluate(evalJs); if (r !== undefined) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r)); await page.waitForTimeout(600); }
await page.screenshot({ path: out, fullPage: flags.has('--full') });
if (errors.length) console.log(errors.slice(0, 12).join('\n')); else console.log('no console errors');
await browser.close(); srv.close();
