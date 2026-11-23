// Headless walker for the Courses tab.
//   node tools/course_walk.mjs [--track <id>]... [--unit <id>]... [--quiet]
// For every selected unit it (1) answers each step correctly and requires the unit to pass,
// (2) proves each `do` step does NOT pass before the action and DOES pass after its solve(),
// (3) walks the unit again giving wrong answers / "Show me" to exercise those paths,
// (4) lints the questions (duplicate options, too few options, correct option always the longest).
// Exits 1 if anything is marked "!!".
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
const quiet = args.includes('--quiet');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data); });
});
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.route('**/cdnjs.cloudflare.com/**three**', (r) => r.fulfill({ path: THREE, contentType: 'text/javascript' }));
await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.goto(`http://localhost:${srv.address().port}/index.html#course`, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const report = await page.evaluate(async (sel) => {
  const out = [], sleep = (ms) => new Promise((r) => setTimeout(r, ms)), C = EP.Course;
  const btn = (el, txt) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent.trim().indexOf(txt) === 0 && !b.disabled);
  const now = () => document.querySelector('.step.now');
  try { localStorage.removeItem('ep.course'); localStorage.removeItem('ep.assess'); } catch (e) { /* none */ }
  C.Prog.data = { units: {}, steps: {} }; if (EP.Assess) EP.Assess.Store.sessions = [];
  const units = C.tracks.reduce((a, t) => a.concat(t.units || []), []).filter((u) => (!sel.track.length && !sel.unit.length) || sel.track.indexOf(u.track.id) >= 0 || sel.unit.indexOf(String(u.id)) >= 0);
  const lint = { mcq: 0, longest: 0 }, keys = [];
  const choose = (root, text, k) => {
    const o = Array.from(root.querySelectorAll('.opt')).filter((b) => !b.disabled).find((b) => b.textContent === text);
    if (!o) throw new Error('option not found in ' + k + ': ' + String(text).slice(0, 60));
    o.click(); btn(o.closest('div').parentElement, 'Check answer').click();
  };
  const lintOpts = (k, right, wrong) => {
    const all = [right].concat(wrong), msgs = [];
    if (new Set(all).size !== all.length) msgs.push('!!duplicate options');
    if (all.length < 3) msgs.push('!!fewer than 3 options');
    if (all.some((x) => typeof x !== 'string' || !x)) msgs.push('!!non-string option');
    lint.mcq++; if (wrong.every((w) => String(w).length < String(right).length)) lint.longest++;
    return msgs.join(' ');
  };
  const advance = (run, ms) => { const b = run.bench; if (b && b.live && b.live.advance) b.live.advance(ms); };
  for (const u of units) {
    for (const mode of ['right', 'wrong']) {
      EP.open('course', { unit: u.id }); await sleep(40);
      const run = C._run, log = [];
      if (!run) { out.push(u.id + ' !!did not open'); continue; }
      if (mode === 'right' && !document.querySelector('details.card .prose')) log.push('!!no teaching text');
      for (let guard = 0; guard < 60; guard++) {
        const s = run.inst[run.state().cur]; if (!s) break;
        const el = now(); let note = s.type + ':' + (s.k || '-');
        try {
          if (s.type !== 'look' && !s.k) note += ' !!no key';
          if (s.type !== 'look' && mode === 'right') keys.push([u.id, s.k]);
          if (s.type === 'mcq') { note += ' ' + lintOpts(s.k, s.a[0], s.a.slice(1)); choose(el, mode === 'right' ? s.a[0] : s.a[1], s.k); }
          else if (s.type === 'num') {
            const v = typeof s.ans === 'function' ? s.ans(run.bench) : s.ans, tol = typeof s.tol === 'function' ? s.tol(run.bench) : s.tol;
            if (!isFinite(v)) note += ' !!answer is not a number';
            const inp = el.querySelector('input[type=number]'); inp.value = String(mode === 'right' ? Math.round(v * 1000) / 1000 : v + 10 * tol + 7);
            btn(el, 'Check answer').click();
            if (mode === 'wrong') btn(el, 'Show the working').click();
          } else if (s.type === 'do') {
            const n0 = run.state().res.length, live = !!(run.bench && run.bench.live);
            if (mode === 'wrong') { btn(el, 'Show me').click(); for (let k = 0; k < 160 && run.state().res.length === n0; k++) { advance(run, 500); run.poll(); } if (run.state().res.length === n0) note += ' !!Show-me never passed'; }
            else {
              for (let k = 0; k < (live ? 28 : 2) && run.state().res.length === n0; k++) { advance(run, 500); run.poll(); }
              if (run.state().res.length > n0) note += ' !!passed before any action';
              else {
                s.solve(run.bench); let k = 0;
                for (; k < 160 && run.state().res.length === n0; k++) { run.poll(); if (run.state().res.length > n0) break; advance(run, 500); }
                note += run.state().res.length > n0 ? (live ? ' ok@' + k * 0.5 + 's' : ' ok') : ' !!never passed after solve()';
              }
            }
          } else if (s.type === 'multi') {
            advance(run, 6000);
            for (const p of s.parts) { note += ' ' + lintOpts(s.k, p[1], p[2]); choose(now(), mode === 'right' ? p[1] : p[2][0], s.k); }
          }
        } catch (e) { note += ' !!' + e.message; log.push(note); break; }
        log.push(note.trim());
        const c = btn(now(), 'Continue') || btn(now(), 'Finish');
        if (!c) { log.push('!!no Continue button after ' + (s.k || 'look')); break; }
        c.click(); await sleep(8);
      }
      const sum = now() && now().querySelector('p') ? now().querySelector('p').textContent : '?';
      if (mode === 'right' && sum.indexOf('unit passed') < 0) log.push('!!unit not passed');
      if (mode === 'wrong' && !/^0 of/.test(sum)) log.push('!!wrong-answer run scored: ' + sum);
      out.push(u.track.id + ' ' + u.id + ' (' + mode + ') ' + (log.some((x) => x.indexOf('!!') >= 0) ? 'FAIL' : 'ok') + ' — ' + sum + (mode === 'right' || log.some((x) => x.indexOf('!!') >= 0) ? '\n    ' + log.join(' | ') : ''));
    }
  }
  const seen = {}, bad = [];
  for (const [u, k] of keys) { const id = u + '-' + k; if (seen[id]) bad.push('!!duplicate key ' + id); seen[id] = 1; if (EP.Assess && !(EP.Assess.describe({ q: 'c-' + id }) || {}).text) bad.push('!!describe failed for c-' + id); }
  out.push('units ' + units.length + ' · scored steps ' + keys.length + ' · choice questions ' + lint.mcq + ', correct option is the longest in ' + lint.longest + (lint.mcq && lint.longest / lint.mcq > 0.45 ? '  (!!cueing: the correct option is the longest too often — even out the option lengths)' : ''));
  if (bad.length) out.push(bad.join('\n'));
  return out.join('\n');
}, sel);
const failed = /!!/.test(report) || errors.length > 0;
console.log(quiet ? report.split('\n').filter((l) => /FAIL|!!|^units /.test(l)).join('\n') : report);
if (errors.length) console.log(errors.slice(0, 12).join('\n'));
console.log(failed ? 'WALK FAILED' : 'WALK OK');
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
