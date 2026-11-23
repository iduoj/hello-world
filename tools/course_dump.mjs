// Print a track's content as plain text for review: teaching text, then every step with its answer.
//   node tools/course_dump.mjs --track <id> [--unit <id>]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const THREE = process.env.THREE_LOCAL || '/tmp/claude-0/-home-user-hello-world/ba9a89e1-a4a7-519c-979e-a0c3c727060e/scratchpad/vendor/package/build/three.min.js';
const args = process.argv.slice(2), sel = { track: [], unit: [] };
for (let i = 0; i < args.length; i++) if (args[i] === '--track' || args[i] === '--unit') sel[args[i].slice(2)].push(args[++i]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => { const p = path.join(root, decodeURIComponent(req.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
await page.route('**/cdnjs.cloudflare.com/**three**', (r) => r.fulfill({ path: THREE, contentType: 'text/javascript' }));
await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.goto(`http://localhost:${srv.address().port}/index.html#course`, { waitUntil: 'load' });
await page.waitForTimeout(2200);
console.log(await page.evaluate((sel) => {
  const out = [], C = EP.Course, str = (f) => (typeof f === 'function' ? '(computed from the bench)' : f);
  for (const t of C.tracks) for (const u of t.units || []) {
    if ((sel.track.length || sel.unit.length) && sel.track.indexOf(t.id) < 0 && sel.unit.indexOf(String(u.id)) < 0) continue;
    out.push('\n======== ' + t.id + ' ' + u.id + ' · ' + u.title + ' [' + (u.dom || t.dom) + ']\nGOAL: ' + u.goal);
    const d = document.createElement('div'); for (const n of [].concat(u.teach())) d.appendChild(n);
    out.push('TEACH:\n' + Array.from(d.querySelectorAll('p, li, tr')).map((x) => '  - ' + x.textContent.replace(/\s+/g, ' ')).join('\n'));
    for (const s of u.steps()) {
      if (s.type === 'look') out.push('\n[look] ' + s.t + '\n  ' + s.q);
      else if (s.type === 'mcq') out.push('\n[mcq ' + s.k + '] ' + s.t + '\n  Q: ' + s.q + '\n  ✓ ' + s.a[0] + '\n' + s.a.slice(1).map((x) => '  ✗ ' + x).join('\n') + '\n  WHY: ' + str(s.why));
      else if (s.type === 'num') out.push('\n[num ' + s.k + '] ' + s.t + '\n  Q: ' + s.q + '\n  ✓ ' + (typeof s.ans === 'function' ? '(from the bench)' : Math.round(s.ans * 100) / 100) + ' ± ' + str(s.tol) + ' ' + s.unit + '\n  WHY: ' + str(s.why));
      else if (s.type === 'do') out.push('\n[do ' + s.k + '] ' + s.t + '\n  TASK: ' + s.q + (s.hint ? '\n  HINT: ' + s.hint : '') + '\n  WHY: ' + str(s.why));
      else if (s.type === 'multi') out.push('\n[multi ' + s.k + '] ' + (s.tDone || s.t) + '\n  ' + (s.intro || '') + '\n' + s.parts.map((p, i) => '  (' + (i + 1) + ') ' + p[0] + '\n    ✓ ' + p[1] + '\n' + p[2].map((x) => '    ✗ ' + x).join('\n') + '\n    WHY: ' + (p[3] || '')).join('\n'));
    }
  }
  return out.join('\n');
}, sel));
await browser.close(); srv.close();
