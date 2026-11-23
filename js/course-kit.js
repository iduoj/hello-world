/* EP Simulator — course engine ("Courses" tab).
 *
 * A course is a set of TRACKS (one per subject); a track is a list of UNITS; a unit is a short
 * teaching text plus scored STEPS worked on a BENCH. Content lives in js/course-<track>.js files that
 * call EP.Course.addTrack(...). How to write one: docs/COURSE_AUTHORING.md.
 *
 * Step types (constructors in EP.Course.S):
 *   look   unscored: what to notice
 *   mcq    choice, changeable until "Check answer"
 *   num    free numeric answer (numbers should be regenerated on every run)
 *   do     performed on the bench and verified from its state: check(bench.ctx(), st)
 *   multi  linked questions that must all be right (unknown fault: what → why → fix)
 * Only the first attempt is scored. Results go to EP.Assess.Store (ids c-<unit>-<key>, domain from
 * the unit or track) and to a spaced review schedule (localStorage 'ep.course', db doc course/progress).
 *
 * Bench interface: { el, load(spec), controls?(spec), ctx(), findings(on), destroy(), onTick, onChange }.
 * Kinds are registered in EP.Course.benches; 'ecg' (below) is a static, parameter-driven ECG.
 */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI;
  const DAY = 864e5, GAP = [2, 7, 21, 60], PASS = 0.8;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const para = (s) => h('p', { html: fmt(s) });
  const list = (a) => h('ul', a.map((s) => h('li', { html: fmt(s) })));
  const ol = (a) => h('ol', { style: { margin: '0.4em 0 0', paddingLeft: '1.2em' } }, a.map((s) => h('li', { html: fmt(s) })));
  const table = (head, rows) => h('div.scroll-x', { style: { marginTop: '8px' } }, h('table.tbl', h('thead', h('tr', head.map((x) => h('th', x)))), h('tbody', rows.map((r) => h('tr', r.map((x, i) => h('td', i ? x : h('b', x))))))));

  // ---- step constructors ----------------------------------------------------------------------------
  const S = {
    look: (t, q, bench) => ({ type: 'look', t, q, bench }),
    mcq: (k, t, q, a, why, o) => Object.assign({ type: 'mcq', k, t, q, a, why }, o),
    num: (k, t, q, ans, tol, unit, why, o) => Object.assign({ type: 'num', k, t, q, ans, tol, unit, why }, o),
    act: (k, t, q, o) => Object.assign({ type: 'do', k, t, q }, o),
    /* parts: [[question, right, [wrong, ...], explanation], ...] */
    multi: (k, t, intro, parts, o) => Object.assign({ type: 'multi', k, t, intro, parts }, o),
  };

  // ---- static ECG bench -----------------------------------------------------------------------------
  /* spec: { kind:'ecg', make(p, bench) → recording, p: {defaults}, ctl: [control], layout:'12'|'strip',
   *         strips:[lead index], ladder, markers, rowMm, title, cap, measure(rec, p) → m,
   *         read(rec, p, m) → [[label, value, unit]] (shown only after the step is answered) }
   * control: { k, label, min, max, step, unit } slider · { k, label, opts:[[value, text]] } select ·
   *          { k, label, toggle:true } checkbox · { k, label, button:true } counter button
   * ctx() → { p, base, rec, m, ev, changes } */
  class EcgBench {
    constructor() {
      this.canvas = h('canvas', { 'aria-label': 'ECG for this step' });
      this.title = h('h3', 'ECG'); this.cap = h('div', { style: { fontSize: '13px' } });
      this.ctl = h('div.ctl', { style: { marginTop: '8px' } }); this.tog = h('div.row', { style: { marginTop: '4px' } }); this.read = h('div', { style: { marginTop: '10px' } });
      this.el = h('section.card', h('div.card-h', this.title, h('span.grow'), h('span.muted', { style: { fontSize: '12px' } }, 'drag on the trace to measure')),
        h('div.ecg-scroll', this.canvas), h('div.card-b', this.cap, this.ctl, this.tog, this.read));
      this.view = new EP.ECGView(this.canvas, { layout: '12', strips: [1] });
      this.showFind = false; this.setters = {}; this.p = {};
    }
    load(spec) { this.p = {}; this.changes = 0; this.controls(spec); this.base = Object.assign({}, this.p); }
    /* Change the question and the controls but keep the current parameter values. */
    controls(spec) {
      this.spec = spec; this.p = Object.assign({}, spec.p || {}, this.p);
      const strip = spec.layout === 'strip';
      this.view.set({ layout: strip ? 'strip' : '12', strips: spec.strips || [1], ladder: !!spec.ladder, markers: !!spec.markers, rowMm: spec.rowMm || (strip ? 34 : 27) });
      this.title.textContent = spec.title || (strip ? 'Rhythm strip' : '12-lead ECG'); this.cap.textContent = spec.cap || '';
      this.ctl.innerHTML = ''; this.tog.innerHTML = ''; this.setters = {};
      for (const c of spec.ctl || []) {
        const cur = this.p[c.k];
        if (c.opts) { const sel = UI.select(c.label, c.opts, String(cur), (v) => this.set(c.k, isNaN(+v) || v === '' ? v : +v)); this.setters[c.k] = (v) => { (sel.sel || sel).value = String(v); }; this.tog.append(sel); }
        else if (c.toggle) { const chk = UI.check(c.label, !!cur, (v) => this.set(c.k, v)); this.setters[c.k] = (v) => { chk.input.checked = !!v; }; this.tog.append(chk); }
        else if (c.button) this.tog.append(h('button.btn.sm', { type: 'button', onclick: () => this.set(c.k, (this.p[c.k] || 0) + 1) }, c.label));
        else {
          const show = (v) => v + (c.unit ? ' ' + c.unit : ''), val = h('span.val', show(cur));
          const inp = h('input', { type: 'range', min: c.min, max: c.max, step: c.step || 1, value: cur, 'aria-label': c.label, oninput: () => { val.textContent = show(+inp.value); }, onchange: () => this.set(c.k, +inp.value) });
          this.setters[c.k] = (v) => { inp.value = v; val.textContent = show(v); };
          this.ctl.append(h('label', c.label), val, inp);
        }
      }
      this.render();
    }
    set(k, v) { this.p[k] = v; if (this.setters[k]) this.setters[k](v); this.changes++; this.render(); if (this.onChange) this.onChange(); }
    render() {
      const sp = this.spec;
      try { this.rec = sp.make(this.p, this); this.m = sp.measure ? sp.measure(this.rec, this.p) : EP.Rhythms.measure(this.rec); } catch (e) { console.error(e); this.m = this.m || {}; }
      if (this.rec) this.view.setRecording(this.rec);
      this._read();
    }
    _read() {
      this.read.innerHTML = '';
      if (!this.spec || !this.spec.read) return;
      if (!this.showFind) { this.read.append(h('div.muted', { style: { fontSize: '12px' } }, 'The measurements are hidden until you have answered.')); return; }
      try { this.read.append(UI.kv(this.spec.read(this.rec, this.p, this.m))); } catch (e) { console.error(e); }
    }
    ctx() { return { p: this.p, base: this.base, rec: this.rec, m: this.m, ev: this.rec ? this.rec.events : [], changes: this.changes }; }
    findings(on) { this.showFind = on; this._read(); }
    destroy() { if (this.view.ro) this.view.ro.disconnect(); }
  }

  // ---- tracks ---------------------------------------------------------------------------------------
  const tracks = [], benches = { ecg: () => new EcgBench() };
  function addTrack(t) {
    const i = tracks.findIndex((x) => x.id === t.id);
    if (i >= 0) tracks[i] = t; else tracks.push(t);
    (t.units || []).forEach((u, n) => { u.track = t; u.n = n + 1; });
    return t;
  }
  const allUnits = () => tracks.reduce((a, t) => a.concat(t.units || []), []);
  const unitById = (id) => allUnits().find((u) => String(u.id) === String(id));
  const domOf = (u) => (u && (u.dom || (u.track && u.track.dom))) || 'device';
  const label = (id) => { const u = unitById(id); return u ? u.track.short + ' ' + u.n + ' · ' + u.short : 'Course ' + id; };
  const stepsOf = (u, keys) => { const a = u.steps(keys) || []; a.forEach((s) => { if (s.u == null) s.u = u.id; }); return a; };
  const QID = /^c-([a-z]*\d+)-(.+)$/, SID = /^([a-z]*\d+)-(.+)$/;

  // ---- progress and review schedule -----------------------------------------------------------------
  const Prog = {
    data: UI.store.get('course', { units: {}, steps: {} }), db: null,
    mark(u, k, ok, t) { const id = u + '-' + k, e = this.data.steps[id] || { s: 0, n: 0 }; e.n++; e.s = ok ? e.s + 1 : 0; e.t = t; this.data.steps[id] = e; },
    unit(id, score, t) { const e = this.data.units[id] || { best: 0, runs: 0 }; e.runs++; e.last = score; e.best = Math.max(e.best, score); e.t = t; this.data.units[id] = e; },
    /* Step ids due again: missed last time, or right n times and older than 2 / 7 / 21 / 60 days. */
    due(now) { return Object.keys(this.data.steps).filter((id) => { const e = this.data.steps[id], m = SID.exec(id); return m && unitById(m[1]) && (e.s === 0 || now - e.t > GAP[Math.min(e.s, GAP.length) - 1] * DAY); }); },
    nextDue(now) { let best = Infinity; for (const id in this.data.steps) { const e = this.data.steps[id]; if (e.s > 0) best = Math.min(best, e.t + GAP[Math.min(e.s, GAP.length) - 1] * DAY - now); } return best; },
    save() { this.data.t = Date.now(); UI.store.set('course', this.data); if (this.db) this.db.doc('course/progress').set(this.data).catch(() => {}); },
    init(cb) {
      if (!this._p) this._p = (async () => {
        try {
          const c = globalThis.claude; if (!c || !c.use) return;
          const db = await c.use('db'); if (!db) return;
          this.db = db;
          const snap = await Promise.race([db.doc('course/progress').get(), new Promise((r) => setTimeout(() => r(null), 10000))]);
          const x = snap && snap.exists && snap.data(); if (!x) return;
          for (const part of ['units', 'steps']) for (const k in x[part] || {}) { const mine = this.data[part][k]; if (!mine || (x[part][k].t || 0) > (mine.t || 0)) this.data[part][k] = x[part][k]; }
          UI.store.set('course', this.data);
        } catch (e) { /* database unavailable: the browser copy is used */ }
      })();
      return this._p.then(() => { if (cb) cb(); });
    },
  };

  /* What a stored course answer refers to (used by the Assessment study plan). */
  function describe(q) {
    const m = QID.exec(q), u = m && unitById(m[1]); if (!u) return null;
    const s = stepsOf(u, [m[2]]).find((x) => x.k === m[2]); if (!s) return null;
    return { text: u.track.title + ' ' + u.n + ' · ' + (s.tDone || s.t), key: typeof s.why === 'string' ? s.why : u.goal, tab: 'course', focus: { unit: u.id, step: m[2] },
      todo: 'Re-read "' + u.title + '" in the ' + u.track.title + ' course, then redo this step. The numbers and the tracing are generated afresh.',
      make: () => (s.type === 'mcq' ? { id: q, domain: domOf(u), topic: label(u.id), stem: s.q, right: s.a[0], wrong: s.a.slice(1), explain: s.why } : null) };
  }

  // ---- runner ---------------------------------------------------------------------------------------
  /* unit: { id, title, goal, teach(), steps(keys) }; opt.keys limits the run to those step keys. */
  function runUnit(root, unit, opt, exit) {
    opt = opt || {};
    const review = unit.id === 'review';
    const inst = stepsOf(unit, opt.keys).filter((s) => !opt.keys || opt.keys.indexOf(s.k) >= 0);
    const hasBench = inst.some((s) => s.bench), made = {};
    let bench = null, cur = -1, st = {}, poll = null, lastPoll = -1e9, saved = false;
    const res = [], stepsEl = h('div.steps'), progEl = h('span.muted.mono');
    const ph = h('section.card', h('div.card-b.muted', 'The bench opens at the first hands-on step. These first questions are answered from the values given.'));
    const benchCol = h('div.sim-main', ph), layout = h('div.sim.course', benchCol);
    const stem = (t) => h('p', { style: { fontWeight: '500', marginBottom: '8px' } }, t);

    function useBench(s, i) {
      const spec = s.bench, kind = spec.kind || unit.bench || (unit.track && unit.track.bench) || 'ecg';
      let b = made[kind]; const fresh = !b;
      if (!b) {
        b = made[kind] = benches[kind](); benchCol.append(b.el);
        b.onTick = (t) => { if (Math.abs(t - lastPoll) < 400) return; lastPoll = t; if (poll) poll(); };
        b.onChange = () => { if (poll) poll(); };
      }
      for (const k in made) made[k].el.style.display = made[k] === b ? '' : 'none';
      ph.remove();
      layout.classList.toggle('stack', spec.wide != null ? !!spec.wide : kind === 'ecg' && spec.layout !== 'strip');
      if (s.keep && !fresh && bench === b && i > 0 && !opt.keys && !review && b.controls) b.controls(spec); else b.load(spec);
      bench = b;
    }
    function settle(s, i, ok, fb, why) {
      if (s.type !== 'look') res.push({ i, k: s.k, u: s.u, ok, t: s.tDone || s.t, why });
      if (why) fb.append(h('div.note' + (s.type === 'look' ? '' : ok ? '.good' : '.bad'), s.type === 'look' ? null : h('b', ok ? 'Right. ' : 'Not this time. '), why));
      fb.append(h('div', { style: { marginTop: '8px' } }, h('button.btn.primary', { type: 'button', onclick: () => activate(i + 1) }, i + 1 < inst.length ? 'Continue' : 'Finish')));
      if (bench) bench.findings(true);
    }
    function choice(q, right, wrong, onDone, many) {
      const optEl = h('div.opts' + (many ? '.chips' : '')); let chosen = null;
      const btn = h('button.btn.primary', { type: 'button', disabled: true, onclick: () => {
        for (const b of optEl.children) { b.disabled = true; if (b.textContent === right) b.classList.add('right'); else if (b.textContent === chosen) b.classList.add('wrong'); }
        btn.remove(); onDone(chosen === right);
      } }, 'Check answer');
      for (const o of shuffle([right].concat(wrong))) optEl.append(h('button.opt', { type: 'button', 'aria-pressed': 'false', onclick: (ev) => { chosen = o; btn.disabled = false; for (const b of optEl.children) b.setAttribute('aria-pressed', String(b === ev.currentTarget)); } }, o));
      return h('div', stem(q), optEl, h('div', { style: { marginTop: '8px' } }, btn));
    }
    function body(s, i) {
      const fb = h('div', { style: { marginTop: '8px' } });
      const val = (f) => (typeof f === 'function' ? f(bench) : f);
      if (s.type === 'look') { const el = h('div', h('p', s.q), fb); settle(s, i, true, fb, null); return el; }
      if (s.type === 'mcq') return h('div', choice(s.q, s.a[0], s.a.slice(1), (ok) => settle(s, i, ok, fb, val(s.why)), s.many), fb);
      if (s.type === 'num') {
        const inp = h('input', { type: 'number', step: 'any', inputmode: 'decimal', 'aria-label': 'Your answer', onkeydown: (ev) => { if (ev.key === 'Enter') check(); } });
        const msg = h('div.muted', { style: { fontSize: '13px', marginTop: '6px' } });
        let first = null, over = false;
        const end = (ok) => { over = true; inp.disabled = true; row.remove(); msg.remove(); settle(s, i, ok, fb, val(s.why)); };
        const show = h('button.btn.sm', { type: 'button', style: { display: 'none' }, onclick: () => end(false) }, 'Show the working');
        function check() {
          if (over || inp.value === '') return;
          const ok = Math.abs(+inp.value - val(s.ans)) <= val(s.tol) + 1e-9;
          if (first == null) first = ok;
          if (ok) return end(first);
          msg.textContent = 'Not that. You can try again; only the first answer is scored.'; show.style.display = '';
        }
        const row = h('div.row', { style: { marginTop: '8px' } }, h('button.btn.primary', { type: 'button', onclick: check }, 'Check answer'), show);
        return h('div', stem(s.q), h('div.row', inp, h('span.mono', s.unit)), row, msg, fb);
      }
      if (s.type === 'do') {
        const status = h('div.note', { style: { margin: '6px 0' } }, 'Watching the bench…'), hintEl = h('div', { style: { marginTop: '6px' } });
        let helped = false;
        const row = h('div.row', s.hint ? h('button.btn.sm', { type: 'button', onclick: () => { hintEl.innerHTML = ''; hintEl.append(h('div.muted', { style: { fontSize: '13px' } }, s.hint)); } }, 'Hint') : null,
          h('button.btn.sm', { type: 'button', onclick: () => { helped = true; status.textContent = 'Settings applied for you. Look at what changed.'; s.solve(bench); if (poll) poll(); } }, 'Show me'));
        poll = () => {
          const x = bench.ctx(), m = s.live && !helped ? s.live(x, st) : null;
          if (m) status.textContent = m;
          if (!s.check(x, st)) return;
          poll = null; row.remove(); hintEl.remove(); status.remove(); settle(s, i, !helped, fb, val(s.why));
        };
        return h('div', stem(s.q), status, row, hintEl, fb);
      }
      // multi: linked questions, all must be right
      const box = h('div'), n = s.parts.length; let all = true;
      const part = (j) => {
        const p = s.parts[j], note = h('div');
        box.append(h('div', { style: { marginTop: j ? '12px' : '0' } }, choice((n > 1 ? (j + 1) + ' of ' + n + ' · ' : '') + p[0], p[1], p[2], (ok) => {
          all = all && ok; note.append(h('div.note' + (ok ? '.good' : '.bad'), { style: { marginTop: '6px' } }, h('b', ok ? 'Yes. ' : 'No: ' + p[1] + '. '), p[3] || ''));
          if (j < n - 1) part(j + 1); else settle(s, i, all, fb, null);
        }, p[4]), note));
      };
      part(0);
      return h('div', s.intro ? h('p', { style: { marginBottom: '8px' } }, s.intro) : null, box, fb);
    }
    function render() {
      stepsEl.innerHTML = ''; poll = null;
      inst.forEach((s, i) => {
        if (i < cur) {
          const r = res.find((x) => x.i === i);
          stepsEl.append(h('div.step' + (r ? (r.ok ? '.ok' : '.miss') : ''), h('span.n', r ? (r.ok ? '✓' : '✗') : '·'), h('details', h('summary', { style: { cursor: 'pointer' } }, s.tDone || s.t),
            h('div.muted', { style: { fontSize: '13px', marginTop: '4px' } }, (r && r.why) || (typeof s.why === 'string' ? s.why : s.q || s.intro || '')))));
        } else if (i === cur) stepsEl.append(h('div.step.now', h('span.n', String(i + 1)), body(s, i)));
      });
      if (cur >= inst.length) stepsEl.append(summary());
      else if (inst.length - cur - 1 > 0) stepsEl.append(h('div.muted', { style: { fontSize: '12px' } }, (inst.length - cur - 1) + ' more to come.'));
      progEl.textContent = cur >= inst.length ? 'done' : 'step ' + (cur + 1) + ' of ' + inst.length;
    }
    function activate(i) {
      const s = inst[i]; cur = i; st = {};
      if (s && s.bench) useBench(s, i);
      if (s && bench) bench.findings(s.type === 'look');
      if (!s) finish();
      render();
      if (poll) poll();
    }
    function finish() {
      if (saved || !res.length) return; saved = true;
      const now = Date.now(), right = res.filter((r) => r.ok).length;
      for (const r of res) Prog.mark(r.u, r.k, r.ok, now);
      if (!opt.keys && !review) Prog.unit(unit.id, right / res.length, now);
      Prog.save();
      if (EP.Assess) EP.Assess.Store.save({ t: now, n: res.length, right, src: 'course', items: res.map((r) => ({ d: domOf(unitById(r.u)), s: label(r.u), q: 'c-' + r.u + '-' + r.k, ok: r.ok, c: 1 })) });
    }
    function summary() {
      const right = res.filter((r) => r.ok).length, n = res.length, miss = res.filter((r) => !r.ok), full = !opt.keys && !review, pass = n && right / n >= PASS;
      const sib = full && unit.track ? unit.track.units : [], next = sib[sib.indexOf(unit) + 1];
      return h('div.step.now', h('span.n', '∑'), h('div',
        h('p', { style: { fontWeight: '600' } }, n ? right + ' of ' + n + ' right at the first attempt' + (full ? pass ? ' — unit passed.' : ' — below the 80 % pass mark.' : '.') : 'Nothing was scored.'),
        miss.length ? h('p.muted', { style: { fontSize: '13px', margin: '6px 0' } }, 'Missed: ' + miss.map((r) => r.t).join(' · ') + '. These are now in the review schedule and in the Assessment study plan, and stay due until you get them right.') : n ? h('p.muted', { style: { fontSize: '13px', margin: '6px 0' } }, 'These items come back for review in two days, then at longer gaps.') : null,
        h('div.row', { style: { marginTop: '8px' } },
          miss.length && !review ? h('button.btn.primary', { type: 'button', onclick: () => exit({ unit, keys: miss.map((r) => r.k) }) }, 'Repeat the ' + miss.length + ' I missed') : null,
          next && pass ? h('button.btn' + (miss.length ? '' : '.primary'), { type: 'button', onclick: () => exit({ unit: next }) }, 'Next: ' + next.title) : null,
          full && !pass ? h('button.btn', { type: 'button', onclick: () => exit({ unit }) }, 'Run the whole unit again') : null,
          h('button.btn', { type: 'button', onclick: () => exit() }, 'Back to the courses'))));
    }
    const seen = !review && Prog.data.units[unit.id];
    const teach = unit.teach ? h('details.card', { open: !opt.keys && !seen }, h('summary', { style: { padding: '9px 12px', cursor: 'pointer', fontWeight: '600' } }, 'Read first: the ideas this unit tests'), h('div.card-b.prose', { style: { maxWidth: '82ch' } }, unit.teach())) : null;
    const stepsCard = h('section.card', h('div.card-h', h('h3', opt.keys ? 'Re-test' : 'Steps'), h('span.grow'), progEl), h('div.card-b', stepsEl));
    if (hasBench) layout.append(h('div.sim-main', stepsCard));
    root.append(h('div.row', { style: { marginBottom: '12px' } }, h('button.btn.sm', { type: 'button', onclick: () => exit() }, '← Courses'),
      h('h2', { style: { fontSize: '17px' } }, (review ? '' : unit.track.title + ' ' + unit.n + ' · ') + unit.title), h('span.muted', { style: { fontSize: '13px' } }, unit.goal || '')),
      teach ? h('div', { style: { marginBottom: '14px' } }, teach) : null,
      hasBench ? layout : h('div', { style: { maxWidth: '760px' } }, stepsCard));
    activate(0);
    return { destroy() { for (const k in made) made[k].destroy(); }, get bench() { return bench; }, inst, state: () => ({ cur, res, st }), poll: () => poll && poll(), next: () => activate(cur + 1) };
  }

  /* A mixed set from what is due, across tracks: at most three bench tasks. */
  function reviewUnit(ids) {
    return { id: 'review', title: 'Review', goal: 'Items that are due again, drawn from the units you have done.', steps: () => {
      const out = []; let doN = 0;
      for (const id of shuffle(ids)) {
        const m = SID.exec(id), u = m && unitById(m[1]), s = u && stepsOf(u, [m[2]]).find((x) => x.k === m[2]);
        if (!s) continue;
        if (s.type === 'do' && ++doN > 3) continue;
        s.keep = false; if (s.bench && !s.bench.kind) s.bench = Object.assign({ kind: u.bench || u.track.bench || 'ecg' }, s.bench);
        out.push(s); if (out.length >= 8) break;
      }
      return out;
    } };
  }

  const Course = (EP.Course = { tracks, addTrack, benches, S, T: { para, list, ol, table, fmt }, util: { pick, shuffle }, EcgBench, Prog, describe, unitById, label,
    trackFor: (dom) => tracks.find((t) => (t.units || []).length && (t.dom === dom || t.units.some((u) => u.dom === dom))),
    note(q, ok) { const m = QID.exec(q); if (m) { Prog.mark(m[1], m[2], ok, Date.now()); Prog.save(); } } });

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'course', title: 'Courses',
    mount(root) {
      const main = h('div'); let run = null, focusTrack = EP.pending && EP.pending.track;
      function open(o) {
        if (run) { run.destroy(); run = null; }
        main.innerHTML = ''; window.scrollTo(0, 0);
        if (!o || !o.unit) return home();
        run = runUnit(main, o.unit, o.keys ? { keys: o.keys } : null, open); Course._run = run;
      }
      function home() {
        const now = Date.now(), pd = Prog.data, due = Prog.due(now), nd = Prog.nextDue(now), live = tracks.filter((t) => (t.units || []).length), units = allUnits();
        const passed = (u) => pd.units[u.id] && pd.units[u.id].best >= PASS;
        const done = units.filter(passed).length;
        // suggestion: the weakest assessed domain that has a course with something left to do
        let hint = null;
        if (EP.Assess) {
          const st = EP.Assess.Store.stats(), doms = Object.keys(st).filter((d) => st[d].n >= 2).sort((a, b) => st[a].right / st[a].n - st[b].right / st[b].n);
          for (const d of doms) { const t = Course.trackFor(d), u = t && t.units.find((x) => domOf(x) === d && !passed(x)) || (t && t.units.find((x) => !passed(x))); if (u && st[d].right / st[d].n < PASS) { hint = { d, u }; break; } }
        }
        const started = units.filter((u) => pd.units[u.id]), lastU = started.sort((a, b) => pd.units[b.id].t - pd.units[a.id].t)[0];
        const cont = lastU ? lastU.track.units.find((u) => !passed(u)) : null, nextU = (hint && hint.u) || cont || units.find((u) => !passed(u));
        const cards = live.map((t) => {
          const n = t.units.filter(passed).length, openIt = focusTrack ? focusTrack === t.id : (nextU && nextU.track === t) || t.units.some((u) => pd.units[u.id]);
          const rows = t.units.map((u) => {
            const e = pd.units[u.id], pass = passed(u);
            return h('div.finding', { style: { alignItems: 'center' } }, h('span.pill' + (pass ? '.good' : e ? '.warn' : ''), pass ? 'passed' : e ? Math.round(e.best * 100) + ' %' : 'unit ' + u.n),
              h('div.row', { style: { justifyContent: 'space-between' } }, h('div', { style: { flex: '1 1 260px' } }, h('b', u.n + ' · ' + u.title), h('div.muted', u.goal)),
                h('button.btn.sm' + (u === nextU ? '.primary' : ''), { type: 'button', onclick: () => open({ unit: u }) }, e ? 'Repeat' : 'Start')));
          });
          return h('details.card', { open: !!openIt, id: 'track-' + t.id, style: { marginTop: '14px' } },
            h('summary', { style: { padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' } }, h('b', { style: { fontSize: '15px' } }, t.title), h('span.muted', { style: { fontSize: '13px', flex: '1 1 240px' } }, t.blurb || ''), h('span.pill' + (n === t.units.length ? '.good' : ''), n + ' / ' + t.units.length + ' passed')),
            h('div.card-b', h('div.findings', { style: { gap: '12px' } }, rows)));
        });
        main.append(h('div.two',
          h('section.card', h('div.card-h', h('h2', 'Courses: taught from first principles')), h('div.card-b.prose',
            h('p', 'Each course builds one subject from the ground up in short units. A unit starts with the ideas, then makes you use them on a tracing or a live strip: predict what a change will do, measure or calculate, make the thing happen, and put it right.'),
            h('p', 'Nothing is recognised from memory: numbers and tracings are regenerated on every run, and bench tasks are checked against what the simulation actually does. Only your first attempt at each step is scored.'),
            hint ? h('p.note', { style: { marginTop: '10px' } }, 'From your assessment: ' + EP.Assess.DOM[hint.d][0].toLowerCase() + ' is your weakest area with a course. Suggested next: ' + hint.u.track.title + ' ' + hint.u.n + '.') : null,
            h('div.row', { style: { marginTop: '12px' } }, nextU ? h('button.btn.primary', { type: 'button', onclick: () => open({ unit: nextU }) }, (pd.units[nextU.id] ? 'Continue: ' : 'Start: ') + nextU.track.short + ' ' + nextU.n + ' · ' + nextU.title) : h('span.pill.good', 'every unit passed'),
              h('span.muted.mono', done + ' / ' + units.length + ' units passed')))),
          h('section.card', h('div.card-h', h('h3', 'Review'), h('span.grow'), h('span.muted.mono', due.length + ' due')), h('div.card-b.prose',
            due.length ? h('p', due.length + ' item' + (due.length > 1 ? 's are' : ' is') + ' due: anything missed last time, and anything answered correctly long enough ago that it is worth checking it is still there (after 2, 7, 21 and 60 days).')
              : h('p', Object.keys(pd.steps).length ? 'Nothing is due. ' + (isFinite(nd) ? 'The next items come back in ' + Math.max(1, Math.ceil(nd / DAY)) + ' day' + (Math.ceil(nd / DAY) > 1 ? 's' : '') + '.' : '') : 'Review starts after your first unit. Missed steps stay due until you get them right; correct ones return after 2, 7, 21 and 60 days.'),
            due.length ? h('div.row', { style: { marginTop: '10px' } }, h('button.btn.primary', { type: 'button', onclick: () => open({ unit: reviewUnit(due) }) }, 'Review ' + Math.min(8, due.length) + ' now')) : null,
            h('p.muted', { style: { fontSize: '12px', marginTop: '10px' } }, 'Course answers also count in the Assessment gap map. ' + (Prog.db ? 'Progress is saved with this page.' : 'Progress is saved in this browser.'))))),
          ...cards,
          h('section.card', { style: { marginTop: '14px' } }, h('div.card-h', h('h3', 'How the testing gets harder')), h('div.card-b.prose', { style: { maxWidth: '82ch' } }, list([
            '**Predict** before you touch a control, then see whether the tracing agrees with you.',
            '**Measure and calculate** from the tracing or the programmed values, with numbers that change every run.',
            '**Do**: make the simulation show the behaviour, or correct it. There are no options to choose from, and the step passes only when it actually happens.',
            '**Diagnose** an unknown: what it is, why, and what to do. Every part must be right.',
            '**Come back**: every item returns after a gap. Getting it right after you have had time to forget is the test that matters.']))));
        if (focusTrack) { const el = document.getElementById('track-' + focusTrack); focusTrack = null; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }
      }
      root.append(main);
      const pd = EP.pending, u0 = pd && pd.unit && unitById(pd.unit);
      if (u0) open({ unit: u0, keys: pd.step ? [pd.step] : null }); else home();
      Prog.init(() => { if (!run) { main.innerHTML = ''; home(); } });
      if (EP.Assess && EP.Assess.Store.init) EP.Assess.Store.init();
      return { unmount() { if (run) run.destroy(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
