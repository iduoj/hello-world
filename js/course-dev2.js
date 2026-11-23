/* EP Simulator — course track: temporary pacing, ICDs and hardware on the chest film (units d1–d5).
 * Benches defined here (interface: docs/COURSE_AUTHORING.md):
 *   tvp / tcp  TempBench — a patient, an external pacing box (EP.Pacemaker, kind 'temp' / 'tcp') and a live monitor.
 *              spec { patient, thr, rAmp, tAmp, pm:{ lrl, vOut, vSens, async, vSite }, show:[rate|out|sens], tog:[async],
 *                     event:{ at, set, text } }   (event = something that happens to the wire at a set time)
 *   icd        IcdBench — scripted rhythms played to an ICD (Icd, a subclass of EP.ICD with separate discriminators).
 *              spec { phases:[{ sc, want:'none'|'treat', name }], icd:{ programming }, show, tog, pat, blind }
 *   film       FilmBench — a simulated PA / lateral film (EP.XRay) of a system from EP.Devices, with an optional paced
 *              12-lead. Without three.js or WebGL it shows a written report of the same film instead.
 *              spec { film, view, ref, ecg, pat }
 * The unknown ICD episodes of unit d4 are built from the scenarios of the ICD lab (EP.IcdCases, exported by ui-icd.js).
 */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, Mo = EP.Morph, C = EP.Course, S = C.S;
  const { para, list } = C.T, { pick, shuffle } = C.util;
  const look = S.look, mcq = S.mcq, num = S.num, act = S.act, multi = S.multi;
  /* Units that draw random unknowns honour a re-test of one of them: keys are '<prefix><case id>'. */
  const wanted = (want, pre, pool, n) => { const w = (want || []).filter((k) => k.indexOf(pre) === 0).map((k) => k.slice(pre.length)).filter((k) => pool.indexOf(k) >= 0); return w.length ? w : shuffle(pool).slice(0, n); };
  const CHB = () => ({ fast: { block: true, retro: { block: true } } });
  const r1 = (v) => Math.round(v * 10) / 10;
  const rateOf = (a) => (a.length > 1 ? Math.round(60000 / ((a[a.length - 1].t - a[0].t) / (a.length - 1))) : 0);
  /* One labelled slider in a .ctl grid. o = [min, max, step, format]; returns a setter for the displayed value. */
  function slider(host, label, o, cur, on, lazy) {
    const val = h('span.val', o[3](cur));
    const inp = h('input', { type: 'range', min: o[0], max: o[1], step: o[2], value: cur, 'aria-label': label,
      oninput: () => { val.textContent = o[3](+inp.value); if (!lazy) on(+inp.value); }, onchange: () => { if (lazy) on(+inp.value); } });
    host.append(h('label', label), val, inp);
    return (v) => { inp.value = v; val.textContent = o[3](v); };
  }
  const flash = (el) => { el.classList.add('good'); setTimeout(() => el.classList.remove('good'), 160); };
  const hidden = (el, text) => { el.innerHTML = ''; el.append(h('div.muted', { style: { fontSize: '12px' } }, text)); };
  const finding = (lv, title, text) => h('div.finding', h('span.pill' + (lv ? '.' + lv : ''), lv === 'good' ? 'ok' : lv === 'bad' ? 'fault' : lv === 'warn' ? 'note' : 'info'), h('div', h('b', title), h('div.muted', text)));

  // ---- bench: temporary pacing (transvenous box or transcutaneous pads) -----------------------------
  const TPAT = {
    chb: { name: 'Complete heart block, ventricular escape rhythm 30/min', cfg: () => ({ sinus: { cl: 760 }, avn: CHB(), foci: [{ id: 'esc', node: 'V', cl: 2000, site: 'fascPost', label: 'escape', startAt: 600, sd: 0.02 }] }) },
    none: { name: 'Complete heart block with no escape rhythm: pacing-dependent', cfg: () => ({ sinus: { cl: 760 }, avn: CHB() }) },
    sb: { name: 'Sinus bradycardia 46/min, AV conduction intact', cfg: () => ({ sinus: { cl: 1300, resp: 0.02 } }) },
    sr: { name: 'Sinus rhythm 78/min: AV conduction has recovered', cfg: () => ({ sinus: { cl: 770, resp: 0.02 }, avn: { fast: { retro: { block: true } } } }) },
  };
  const TCTL = {
    tv: { rate: ['Rate', 30, 180, 5, (v) => v + ' ppm'], out: ['Output', 0.1, 20, 0.1, (v) => v.toFixed(1) + ' mA'], sens: ['Sensitivity (a higher number is less sensitive)', 0.5, 20, 0.5, (v) => v.toFixed(1) + ' mV'] },
    tc: { rate: ['Rate', 30, 180, 5, (v) => v + ' ppm'], out: ['Current', 0, 160, 5, (v) => v + ' mA'] },
  };
  const TTOG = { async: 'Asynchronous (sensing off)' };
  const bpOf = (hr) => (hr === 0 ? null : hr < 36 ? [72, 38] : hr < 50 ? [84, 46] : hr <= 110 ? [108, 62] : hr <= 150 ? [96, 60] : [78, 50]);

  class TempBench {
    constructor(tc) {
      this.tc = tc;
      this.canvas = h('canvas', { 'aria-label': tc ? 'Monitor: lead II and the arterial pressure trace' : 'Monitor: leads II and V1 and the arterial pressure trace' });
      this.paceL = h('span.pill', 'PACE'); this.senseL = h('span.pill', 'SENSE');
      this.freeze = h('button.btn.sm', { type: 'button', onclick: () => { if (this.live.running) { this.live.stop(); this.freeze.textContent = 'Resume'; } else { this.live.start(); this.freeze.textContent = 'Freeze'; } } }, 'Freeze');
      this.pat = h('div', { style: { fontSize: '13px', marginBottom: '8px' } }); this.vit = h('div.vitals');
      this.lcd = h('div.box-lcd'); this.ctl = h('div.ctl'); this.tog = h('div.row'); this.find = h('div.findings', { style: { marginTop: '10px' } });
      this.el = h('section.card', h('div.card-h', h('h3', tc ? 'Bench — transcutaneous pacing' : 'Bench — temporary transvenous pacing'), h('span.grow'), this.paceL, tc ? null : this.senseL, this.freeze),
        h('div.live', this.canvas),
        h('div.card-b', this.pat, this.vit, h('div.box', { style: { marginTop: '10px' } }, this.lcd, this.ctl, this.tog), this.find));
      this.strip = new EP.LiveStrip(this.canvas, { channels: tc ? [{ lead: 1 }, { key: 'pulse', label: 'Arterial pressure' }] : [{ lead: 1 }, { lead: 6 }, { key: 'pulse', label: 'Arterial pressure' }], windowMs: 8000, markers: !tc, rowMm: tc ? 32 : 23, gain: tc ? 9 : 7 });
      this.showFind = false; this.setters = {};
    }
    load(spec) {
      this.spec = spec;
      const pm = spec.pm || {}, tc = this.tc;
      this.s = { rate: pm.lrl || 70, out: pm.vOut != null ? pm.vOut : tc ? 0 : 5, sens: pm.vSens || 2, async: !!pm.async };
      this.fix = { vThr: spec.thr, rAmp: spec.rAmp || 8, tAmp: spec.tAmp || 1.2, vrp: 250, kind: tc ? 'tcp' : 'temp', tcpArtifact: tc, vSite: pm.vSite || (tc ? 'rvFreeWall' : 'rvApex'),
        vSpec: tc ? Mo.fuse([{ spec: Mo.spec('rvFreeWall'), t: 0 }, { spec: Mo.spec('lvAntWall'), t: 6 }]) : null };
      const sim = (this.sim = new EP.HeartSim(TPAT[spec.patient].cfg()));
      this.dev = new EP.Pacemaker(sim, this.cfg());
      this.moved = 0; this.note = '';
      const ev = spec.event;
      if (ev) sim.schedule(ev.at, (t) => { Object.assign(this.fix, ev.set); this.dev.set(ev.set); this.moved = t; this.changed = t; this.note = ev.text || ''; this.describe(); });
      if (this.live) this.live.setSim(sim); else this.live = new EP.Live({ sim, strips: [this.strip], pulse: true, onTick: (t) => this._tick(t) });
      this.live.start(); this.freeze.textContent = 'Freeze';
      this.changed = sim.t; this.seen = 0; this._lastV = -1e9;
      this.controls(spec);
    }
    cfg() { const s = this.s; return Object.assign({ mode: this.tc && s.out <= 0 ? 'OFF' : s.async ? 'VOO' : 'VVI', lrl: s.rate, vOut: s.out, vSens: s.sens }, this.fix); }
    /* Rebuild the visible controls without restarting the patient. */
    controls(spec) {
      this.spec = Object.assign({}, this.spec, { show: spec.show, tog: spec.tog });
      this.ctl.innerHTML = ''; this.tog.innerHTML = ''; this.setters = {};
      const T = TCTL[this.tc ? 'tc' : 'tv'];
      for (const k of spec.show || []) this.setters[k] = slider(this.ctl, T[k][0], T[k].slice(1), this.s[k], (v) => this.set(k, v));
      for (const k of spec.tog || []) { const chk = UI.check(TTOG[k], !!this.s[k], (v) => this.set(k, v)); this.setters[k] = (v) => { chk.input.checked = !!v; }; this.tog.append(chk); }
      this.describe();
    }
    set(k, v) {
      this.s[k] = v; this.dev.set(this.cfg());
      if (this.setters[k]) this.setters[k](v);
      this.changed = this.live.t; this.describe();
      if (this.onChange) this.onChange();
    }
    describe() {
      const s = this.s, tc = this.tc, off = tc && s.out <= 0;
      this.pat.innerHTML = ''; this.pat.append(h('b', 'Patient: '), TPAT[this.spec.patient].name + '.');
      if (this.note) this.pat.append(h('b', ' ' + this.note));
      this.lcd.innerHTML = '';
      this.lcd.append(h('div', 'RATE', h('b', off ? '--' : String(s.rate)), 'ppm'), h('div', tc ? 'CURRENT' : 'OUTPUT', h('b', tc ? String(s.out) : s.out.toFixed(1)), 'mA'),
        tc ? h('div', 'MODE', h('b', off ? 'STANDBY' : 'DEMAND'), '') : h('div', 'SENSITIVITY', h('b', s.async ? 'ASYNC' : s.sens.toFixed(1)), s.async ? '' : 'mV'));
    }
    findings(on) { this.showFind = on; this._lastV = -1e9; if (!on) hidden(this.find, 'The automatic read-out is hidden until you have answered.'); }
    _tick(t) {
      const sim = this.sim;
      for (const e of sim.out) { if (e.t <= this.seen || e.t > t) continue; if (e.type === 'spike') flash(this.paceL); else if (e.type === 'mark' && e.text === 'VS') flash(this.senseL); }
      this.seen = t;
      if (this.onTick) this.onTick(t);
      if (Math.abs(t - this._lastV) < 600) return;
      this._lastV = t;
      const q = sim.out.filter((e) => e.type === 'QRS' && e.t > t - 6000 && e.t < t - 100), sp = sim.out.filter((e) => e.type === 'spike' && e.t > t - 6000 && e.t <= t);
      const beating = q.length && t - q[q.length - 1].t < 2600, hr = !beating ? 0 : q.length > 1 ? rateOf(q) : 20, bp = bpOf(hr), low = !bp || bp[0] < 90;
      // what a rate meter that cannot tell a stimulus from a QRS would count
      const seenByMeter = sp.concat(q.filter((x) => !sp.some((s) => x.t - s.t > -60 && x.t - s.t < 320))).sort((a, b) => a.t - b.t);
      const cell = (k, v, bad) => h('div', h('div.k', k), h('div.v' + (bad ? '.bad' : ''), v));
      this.vit.innerHTML = '';
      if (this.tc) this.vit.append(cell('ECG rate (monitor)', String(seenByMeter.length > 1 ? rateOf(seenByMeter) : hr)), cell('Pulse (arterial line)', String(hr), hr < 45), cell('Arterial BP', bp ? bp[0] + '/' + bp[1] : '—', low));
      else this.vit.append(cell('Pulse', String(hr), hr < 45), cell('Arterial BP', bp ? bp[0] + '/' + bp[1] : '—', low), cell('Perfusion', !bp ? 'pulseless' : low ? 'cool, confused' : 'adequate', low));
      if (!this.showFind) return;
      const x = this.ctx(), c = x.c; this.find.innerHTML = '';
      if (this.tc) {
        if (c.mode === 'OFF') this.find.append(finding('', 'Pacer on standby', 'No current is being delivered. The patient is in their own rhythm.'));
        else if (x.sp && x.cap >= x.sp - 1) this.find.append(finding('good', 'Electrical and mechanical capture', `Each stimulus is followed by a QRS with a T wave and by an arterial upstroke. Threshold ${c.vThr} mA; current ${c.vOut} mA.`));
        else if (x.sp) this.find.append(finding('bad', 'No capture', `The deflection after each stimulus is artefact: no T wave follows it and the arterial trace is unchanged. Threshold ${c.vThr} mA; current ${c.vOut} mA.`));
      } else {
        if (x.sp && x.cap === x.sp) this.find.append(finding('good', 'Capture', `Every stimulus is followed by a QRS. Threshold ${c.vThr} mA, output ${c.vOut} mA (${(c.vOut / c.vThr).toFixed(1)} × threshold).`));
        else if (x.nc) this.find.append(finding('bad', 'Failure to capture', `Stimuli fall in excitable tissue and nothing follows. Threshold ${c.vThr} mA, output ${c.vOut} mA.`));
        if (x.fnc) this.find.append(finding(x.async ? 'warn' : 'bad', x.async ? 'Asynchronous pacing' : 'Under-sensing', `Stimuli are landing on or just after the patient's own beats${x.onT ? ', and some capture on the T wave' : ''}. R wave ${c.rAmp} mV; sensitivity ${x.async ? 'off' : c.vSens + ' mV'}.`));
        else if (x.vs && !x.ghost) this.find.append(finding('good', 'Sensing', `Each intrinsic beat is sensed and inhibits the box. R wave ${c.rAmp} mV; sensitivity ${c.vSens} mV.`));
        if (x.ghost) this.find.append(finding('bad', 'Over-sensing', `The T wave (${c.tAmp} mV) is being counted as a beat at a sensitivity of ${c.vSens} mV.`));
      }
    }
    /* What the monitor has shown since the last change (first cycle ignored, 9 s at most). */
    ctx() {
      const sim = this.sim, t = this.live.t, from = Math.max(this.changed + 1200, t - 9000), s = this.s;
      const all = sim.out.filter((e) => e.type === 'QRS'), ev = sim.out.filter((e) => e.t > from && e.t <= t - 160);
      const q = ev.filter((e) => e.type === 'QRS'), sp = ev.filter((e) => e.type === 'spike'), vs = ev.filter((e) => e.type === 'mark' && e.text === 'VS');
      const isP = (x) => x.label === 'paced' || (x.parts && x.parts.some((p) => p.cap && p.c.type === 'pace'));
      const after = (x, a, b, own) => all.some((y) => (!own || !isP(y)) && x.t - y.t > a && x.t - y.t < b);
      let run = 0; for (let i = sp.length - 1; i >= 0 && sp[i].captured; i--) run++;
      const intr = q.filter((x) => !isP(x)).length, last = all.filter((e) => e.t > t - 6000 && e.t < t - 100);
      return { t, since: t - this.changed, c: this.dev.c, async: s.async, moved: this.moved, sp: sp.length, cap: sp.filter((x) => x.captured).length, run,
        nc: sp.filter((x) => !x.captured && !after(x, -20, 340)).length, fnc: sp.filter((x) => !x.captured && after(x, -20, 340)).length,
        onT: sp.filter((x) => x.captured && after(x, 150, 450, true)).length, vs: vs.length, intr, paced: q.length - intr,
        ghost: vs.filter((m) => !all.some((y) => m.t - y.t > -40 && m.t - y.t < 200)).length, pulse: last.length > 1 ? rateOf(last) : 0 };
    }
    destroy() { if (this.live) this.live.destroy(); if (this.strip.ro) this.strip.ro.disconnect(); }
  }
  C.benches.tvp = () => new TempBench(false);
  C.benches.tcp = () => new TempBench(true);

  // ---- ICD with separate discriminators -------------------------------------------------------------
  /* EP.ICD bins intervals into rate zones and has one all-or-none discriminator that reads the simulator's truth.
   * This subclass, for teaching: (a) applies sudden onset, stability and morphology as separate criteria computed from
   * what the ventricular channel sensed, and V > A when there is an atrial lead; (b) reconfirms a charge on rate, as a
   * device does, not on the true rhythm; (c) keeps every sensed interval (hist) and every detection and therapy with
   * whether a ventricular arrhythmia was really present (dets, ther). VT: nidVT consecutive intervals in the VT or VF
   * zone. VF: nidVF of the last 4/3 × nidVF intervals in the VF zone, with no discriminators. */
  const sig = (sp) => (sp ? [sp.purkLV, sp.purkRV, sp.lobes ? 1 : 0, sp.vm ? 1 : 0].join('/') : '');
  const mean = (a) => a.reduce((x, y) => x + y.iv, 0) / a.length;
  class Icd extends EP.ICD {
    constructor(sim, cfg) {
      super(sim, Object.assign({ onset: false, stab: false, morph: false, dual: false }, cfg, { svtDisc: false }));
      this.hist = []; this.aT = []; this.ther = []; this.dets = []; this._g = null;
      this.tpl = sig(Mo.spec(sim.cfg.hps.pattern || 'normal'));
      sim.on('A', (e) => { this.aT.push(e.t); if (this.aT.length > 160) this.aT.shift(); if (this.c.dual && this.c.on) sim.emit({ t: e.t, type: 'mark', ch: 'A', text: e.drive ? '' : 'AS' }); });
    }
    /* What the device sensed or paced goes on the lower marker row, what it decided on the upper row
     * (which in a dual-chamber device is the atrial channel, so there everything stays below). */
    mark(t, text) { this.sim.emit({ t, type: 'mark', ch: this.c.dual || /^(VS|TS|FS|TP)$/.test(text) ? 'V' : 'A', text }); }
    /* Is a ventricular tachyarrhythmia really running? */
    real(t) { const s = this.sim; return s.V.mode !== 'normal' || s.foci.some((f) => f.node === 'V' && f.reentrant && f.enabled && f.fired > 0 && f.fired < f.count && t >= f.startAt); }
    _sense(t, e) {
      const c = this.c, iv = t - this.last;
      this.last = t;
      if (!c.on || iv < 120) return;
      const zone = iv <= 60000 / c.vfRate ? 'F' : iv <= 60000 / c.vtRate ? 'T' : 'S';
      const rec = { t, iv, zone, m: !!(e && e.c && e.c.type === 'hps' && sig(e.c.spec) === this.tpl) };
      this.hist.push(rec); if (this.hist.length > 90) this.hist.shift();
      if (zone === 'S') this._g = null;
      if (this.state === 'atp') return;
      this.mark(t, zone === 'F' ? 'FS' : zone === 'T' ? 'TS' : 'VS');
      if (this.state !== 'monitor') return;
      this.iv.push(rec); if (this.iv.length > 64) this.iv.shift();
      const run = this.iv.slice(-c.nidVT);
      if (this.iv.slice(-Math.ceil(c.nidVF * 4 / 3)).filter((x) => x.zone === 'F').length >= c.nidVF) return this._detect(t, 'VF');
      if (run.length >= c.nidVT && run.every((x) => x.zone !== 'S')) {
        const why = this._svt(run, t);
        if (!why) return this._detect(t, 'VT');
        if (!this._withheld || t - this._withheld > 4000) { this.mark(t, 'SVT'); this.log.push({ t, what: 'Therapy withheld: ' + why }); this._withheld = t; }
        return;
      }
      if (zone === 'S' && this.iv.slice(-4).every((x) => x.zone === 'S')) { if (this.atpGiven) this.log.push({ t, what: 'Episode terminated' }); this.atpGiven = 0; }
    }
    /* The reason for withholding therapy in the VT zone, or null if the criteria that are switched on call it VT. */
    _svt(run, t) {
      const c = this.c, why = [];
      if (c.dual) {
        const t0 = run[0].t - run[0].iv, nA = this.aT.filter((x) => x > t0 && x <= t).length;
        if (run.length > nA + 1) return null;                                // V > A: ventricular, whatever else is true
        if (nA > run.length + 1) return 'more atrial than ventricular events';
      }
      if (c.onset && this._gradual()) why.push('gradual onset');
      if (c.stab) { const v = run.map((x) => x.iv); if (Math.max.apply(null, v) - Math.min.apply(null, v) > 40) why.push('irregular intervals'); }
      if (c.morph && run.slice(-8).filter((x) => x.m).length >= 5) why.push('electrogram matches the template');
      return why.join(', ') || null;
    }
    /* Onset: the first four intervals of the run against the four before it. Less than a 16 % step is gradual. */
    _gradual() {
      if (this._g != null) return this._g;
      const hh = this.hist; let k = hh.length - 1;
      while (k >= 0 && hh[k].zone !== 'S') k--;
      if (k < 3 || hh.length - 1 - k < 4) return false;
      return (this._g = mean(hh.slice(k + 1, k + 5)) > 0.84 * mean(hh.slice(k - 3, k + 1)));
    }
    _detect(t, kind) {
      const c = this.c, s = this.sim, real = this.real(t);
      this.dets.push({ t, kind, real });
      if (kind === 'VT' && this.atpGiven < c.atp) { this.ther.push({ t, type: 'atp', real }); return super._detect(t, kind); }
      this.iv.length = 0; this.mark(t, kind === 'VF' ? 'FD' : 'TD');
      if (!c.shock) { this.log.push({ t, what: kind + ' detected: shock therapy is programmed off' }); return; }
      this.state = 'charging'; this.mark(t + 260, 'CHG'); this.log.push({ t, what: kind + ' detected → charging' });
      s.schedule(t + (kind === 'VF' ? 2600 : 2200), (tt) => {
        this.state = 'monitor';
        const seen = this.hist.filter((x) => x.t > t).slice(-5);
        if (!this.c.on || seen.filter((x) => x.zone !== 'S').length < 3) { this.mark(tt, 'ABT'); this.log.push({ t: tt, what: 'Charge aborted: the rate criterion is no longer met' }); return; }
        this.ther.push({ t: tt, type: 'shock', real });
        s.shock(tt, { j: 35, atrial: !!s.sinus }); this.mark(tt, 'CD'); this.log.push({ t: tt, what: 'Shock delivered' }); this.atpGiven = 0;
      });
    }
  }

  // ---- bench: an ICD and a scripted rhythm ------------------------------------------------------------
  const NOVA = { fast: { retro: { block: true } } }, LAB = EP.IcdCases || {};
  const VTF = (cl, o) => Object.assign({ id: 'vt', node: 'V', cl, site: 'lvInfBase', label: 'VT', reentrant: true, startAt: 3200, atpSuccess: 1 }, o || {});
  /* VT with VA block. The long His-Purkinje refractory period keeps sinus beats from capturing during the tachycardia,
   * so the run of intervals the device counts is not broken by capture beats. */
  const VTP = (cl, o, sinus) => () => ({ sinus: { cl: sinus || 820 }, avn: NOVA, hps: { erp: 480, retro: { delay: 60, erp: 200 } }, foci: [VTF(cl, o)] });
  /* Exercise: the sinus cycle shortens by about 9 ms a beat from 128/min to the target rate. */
  const STP = (rate, o) => () => {
    const to = 60000 / rate, script = [];
    for (let t = 500; t <= 5500; t += 250) script.push({ t, do: (s) => { s.sinus.cl = 470 + (to - 470) * (t - 500) / 5000; } });
    return Object.assign({ sinus: { cl: 470, resp: 0, sd: 0.004 }, avn: { fast: { erp: 200, min: 50, alpha: 60 } }, script }, o || {});
  };
  const lab = (id, o) => Object.assign({ name: (LAB[id] || {}).name, cfg: (LAB[id] || {}).cfg, icd: (LAB[id] || {}).icd, storm: (LAB[id] || {}).storm }, o || {});
  const SC = {
    vt185: { name: 'Monomorphic VT at 185/min', cfg: VTP(325) },
    vt200: { name: 'Monomorphic VT at 200/min', cfg: VTP(300) },
    vt160: { name: 'Monomorphic VT at 160/min', cfg: VTP(375, null, 900) },
    nsvt: { name: 'A run of VT at 200/min that stops by itself', cfg: VTP(300, { count: 19 }), obs: 12000 },
    st167: { name: 'Exercise: sinus tachycardia rising to 167/min', cfg: STP(167), obs: 13000 },
    st172: { name: 'Exercise: sinus tachycardia rising to 172/min', cfg: STP(172), obs: 13000 },
    afFast: { name: 'Atrial fibrillation conducting at about 190/min', cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 110 }, avn: { fast: { erp: 205, conceal: 0.2, min: 55 } } }) },
    fracture: { name: 'Sinus rhythm, with noise from a fractured lead', cfg: () => ({ sinus: { cl: 850 } }), icd: { noise: 0.9 } },
    af: lab('af'), st: lab('st'), tover: lab('tover', LAB.tover && { cfg: () => Object.assign(LAB.tover.cfg(), { vent: { mods: { tAmp: 1.9 } } }) }), noise: lab('noise'), storm: lab('storm'), slow: lab('slow'), vf: lab('vf'), fvt: lab('fvt'),
  };
  const ICTL = {
    vtRate: ['VT zone starts at', 130, 220, 5, (v) => v + ' /min (' + Math.round(60000 / v) + ' ms)'],
    vfRate: ['VF zone starts at', 190, 260, 5, (v) => v + ' /min (' + Math.round(60000 / v) + ' ms)'],
    nidVT: ['Intervals needed to detect VT', 8, 30, 1, (v) => v + ' in a row'],
    atp: ['ATP bursts before a shock', 0, 3, 1, (v) => String(v)],
  };
  const ITOG = { onset: 'Sudden onset', stab: 'Stability', morph: 'Morphology', magnet: 'Magnet over the generator' };
  const LEGEND = 'Lower row, what the device sensed or paced: VS below the zones · TS in the VT zone · FS in the VF zone · TP anti-tachycardia pace. Upper row, what it decided: TD / FD detection met · CHG charging · CD shock delivered · ABT charge aborted · SVT therapy withheld.';
  const LEGEND2 = 'Upper row, the atrial channel: AS atrial sense (a bare tick in atrial fibrillation). Lower row, the ventricular channel: VS below the zones · TS in the VT zone · FS in the VF zone · TP anti-tachycardia pace, and what the device decided: TD / FD detection met · CHG charging · CD shock delivered · ABT charge aborted · SVT therapy withheld.';

  /* spec { phases:[{ sc, want:'none'|'treat', name }], icd:{ programming }, show:[slider keys], tog:[toggle keys], pat, blind }
   * Each phase is one rhythm played from its start; when it has a verdict the next one starts. A change of programming
   * replays from the first phase; the magnet acts at once. ctx().v = { <sc>: 'pass' | 'fail' | null }. */
  class IcdBench {
    constructor() {
      this.canvas = h('canvas', { 'aria-label': 'Live rhythm strip, lead II and arterial pressure, with the ICD marker channel' });
      this.state = h('span.pill', 'monitoring');
      this.freeze = h('button.btn.sm', { type: 'button', onclick: () => { if (this.live.running) { this.live.stop(); this.freeze.textContent = 'Resume'; } else { this.live.start(); this.freeze.textContent = 'Freeze'; } } }, 'Freeze');
      this.pat = h('div', { style: { fontSize: '13px', marginBottom: '8px' } }); this.ph = h('div.row', { style: { marginBottom: '8px' } });
      this.ctl = h('div.ctl'); this.tog = h('div.row', { style: { marginTop: '4px' } }); this.ivs = h('div.mono.muted', { style: { fontSize: '12px', marginTop: '8px' } });
      this.logEl = h('div.findings', { style: { marginTop: '8px' } }); this.find = h('div.findings', { style: { marginTop: '10px' } });
      this.el = h('section.card', h('div.card-h', h('h3', 'Bench — ICD: lead II, arterial pressure, markers'), h('span.grow'), this.state, h('button.btn.sm', { type: 'button', onclick: () => this.go(this.pi) }, 'Replay'), this.freeze),
        h('div.live', this.canvas),
        h('div.card-b', (this.legend = h('p.muted', { style: { fontSize: '11.5px', marginBottom: '8px' } }, LEGEND)), this.pat, this.ph, this.ctl, this.tog, this.ivs, this.logEl, this.find));
      this.strip = new EP.LiveStrip(this.canvas, { channels: [{ lead: 1 }, { key: 'pulse', label: 'Arterial pressure' }], windowMs: 9000, markers: true, rowMm: 25, gain: 7 });
      this.showFind = false; this.setters = {};
    }
    load(spec) {
      this.spec = spec; this.changes = 0;
      this.s = Object.assign({ vtRate: 170, vfRate: 220, nidVT: 12, nidVF: 9, atp: 2, shock: true, onset: false, stab: false, morph: false, dual: false, magnet: false }, spec.icd || {});
      this.base = Object.assign({}, this.s);
      this.controls(spec); this.reprogram();
    }
    controls(spec) {
      this.spec = Object.assign({}, this.spec, { show: spec.show, tog: spec.tog });
      this.ctl.innerHTML = ''; this.tog.innerHTML = ''; this.setters = {};
      for (const k of spec.show || []) this.setters[k] = slider(this.ctl, ICTL[k][0], ICTL[k].slice(1), this.s[k], (v) => this.set(k, v), true);
      for (const k of spec.tog || []) { const chk = UI.check(ITOG[k], !!this.s[k], (v) => this.set(k, v)); this.setters[k] = (v) => { chk.input.checked = !!v; }; this.tog.append(chk); }
      if (this.icd) this.describe();
    }
    set(k, v) {
      this.s[k] = v; this.changes++;
      if (this.setters[k]) this.setters[k](v);
      if (k === 'magnet') { this.icd.c.on = !v; this.magAt = this.live.t; this.describe(); } else this.reprogram();
      if (this.onChange) this.onChange();
    }
    reprogram() { this.v = this.spec.phases.map(() => null); this.res = this.spec.phases.map(() => ({ shocks: 0, atp: 0, inapp: 0, appr: 0 })); this.go(0); }
    /* Play phase i from its beginning with the current programming. */
    go(i) {
      const ph = this.spec.phases[i], sc = SC[ph.sc];
      this.pi = i; this.v[i] = null; this.res[i] = { shocks: 0, atp: 0, inapp: 0, appr: 0 };
      const sim = (this.sim = new EP.HeartSim(sc.cfg()));
      this.icd = new Icd(sim, Object.assign({}, this.s, sc.icd || {}, { on: !this.s.magnet }));
      if (sc.storm) {   // recurrent VT: a new episode starts about five seconds after each one ends (three times)
        let n = 0, wait = false;
        const chk = (t) => { const f = sim.foci.filter((x) => x.reentrant); if (f.length && f.every((x) => !x.enabled) && n < 3 && !wait) { wait = true; n++; sim.schedule(t + 5200, (tt) => { wait = false; sim.addFocus(VTF(300, { startAt: tt, atpSuccess: 0.4, id: 'vt' + n })); }); } sim.schedule(t + 500, chk); };
        sim.schedule(1000, chk);
      }
      if (this.live) this.live.setSim(sim); else this.live = new EP.Live({ sim, strips: [this.strip], pulse: true, noPulse: (b) => b.rr < 290, onTick: (t) => this._tick(t) });
      this.live.start(); this.freeze.textContent = 'Freeze';
      this.nTher = 0; this.nLog = -1; this.vtAt = 0; this.nextAt = 0; this.magAt = 0; this._lastD = -1e9;
      this.describe();
    }
    describe() {
      const s = this.s, sp = this.spec, on = [s.onset && 'onset', s.stab && 'stability', s.morph && 'morphology'].filter(Boolean);
      this.pat.innerHTML = ''; this.legend.textContent = s.dual ? LEGEND2 : LEGEND;
      if (sp.pat) this.pat.append(h('b', 'Patient: '), sp.pat + ' ');
      this.pat.append(h('span.muted', `Programmed: VT zone from ${s.vtRate}/min (${Math.round(60000 / s.vtRate)} ms), ${s.nidVT} intervals in a row · VF zone from ${s.vfRate}/min (${Math.round(60000 / s.vfRate)} ms), ${s.nidVF} of the last ${Math.ceil(s.nidVF * 4 / 3)} · ` +
        `${s.dual ? 'dual-chamber (V > A is called VT)' : 'single-chamber'} · discriminators in the VT zone: ${on.length ? on.join(', ') : 'none'} · ${s.atp ? s.atp + ' ATP burst' + (s.atp > 1 ? 's' : '') + ', then shock' : 'shock only'}${s.shock ? '' : ' (shocks off)'}.`));
      this.ph.innerHTML = '';
      if (sp.blind) return;
      sp.phases.forEach((p, i) => {
        const v = this.v[i];
        this.ph.append(h('button.btn.sm', { type: 'button', 'aria-pressed': String(i === this.pi), onclick: () => this.go(i) }, (sp.phases.length > 1 ? (i + 1) + ' · ' : '') + (p.name || SC[p.sc].name)),
          h('span.pill' + (v === 'pass' ? '.good' : v === 'fail' ? '.bad' : ''), v === 'pass' ? (p.want === 'none' ? 'not treated' : 'treated') : v === 'fail' ? (p.want === 'none' ? 'treated' : 'not treated') : i === this.pi ? 'running' : 'waiting'));
      });
    }
    findings(on) { this.showFind = on; this._lastD = -1e9; if (!on) hidden(this.find, 'The interpretation is hidden until you have answered.'); }
    _tick(t) {
      const icd = this.icd, i = this.pi, ph = this.spec.phases[i], sc = SC[ph.sc], r = this.res[i];
      for (; this.nTher < icd.ther.length; this.nTher++) { const x = icd.ther[this.nTher]; r[x.type === 'shock' ? 'shocks' : 'atp']++; r[x.real ? 'appr' : 'inapp']++; }
      const real = icd.real(t);
      if (real && !this.vtAt) this.vtAt = t;
      if (!this.v[i] && ph.want) {
        let v = null;
        if (ph.want === 'none') v = icd.dets.length ? 'fail' : t >= (sc.obs || 12000) ? 'pass' : null;
        else v = r.inapp ? 'fail' : r.appr && !real ? 'pass' : this.vtAt && t - this.vtAt > 14000 && !icd.dets.some((d) => d.real) ? 'fail' : null;
        if (v) { this.v[i] = v; if (v === 'pass' && this.v.some((x) => !x)) this.nextAt = t + 2500; this.describe(); }
      }
      if (this.nextAt && t >= this.nextAt) { this.go(this.v.findIndex((x) => !x)); if (this.onTick) this.onTick(0); return; }
      if (this.onTick) this.onTick(t);
      if (Math.abs(t - this._lastD) < 300) return;
      this._lastD = t;
      const st = !icd.c.on ? 'detection suspended (magnet)' : icd.state === 'charging' ? 'charging' : icd.state === 'atp' ? 'ATP' : 'monitoring';
      if (this.state.textContent !== st) { this.state.textContent = st; this.state.className = 'pill' + (st === 'monitoring' ? '' : icd.c.on ? ' bad' : ' warn'); }
      this.ivs.textContent = 'Last intervals measured by the device (ms): ' + (icd.c.on ? icd.hist.filter((x) => x.t <= t).slice(-10).map((x) => Math.round(x.iv)).join(' · ') || '—' : 'none while the magnet is on');
      const lg = icd.log.filter((e) => e.t <= t);
      if (lg.length !== this.nLog) {
        this.nLog = lg.length; this.logEl.innerHTML = '';
        if (!lg.length) this.logEl.append(h('div.muted', { style: { fontSize: '12px' } }, 'Therapy log: empty.'));
        for (const e of lg.filter((x, j) => !j || x.what !== lg[j - 1].what || !/programmed off/.test(x.what)).slice(-6)) this.logEl.append(h('div.finding', h('span.pill.mono', (e.t / 1000).toFixed(1) + ' s'), h('div', e.what)));
      }
      if (!this.showFind) return;
      this.find.innerHTML = '';
      this.find.append(finding(real ? 'bad' : '', 'The rhythm', (sc.name || '') + (real ? ': a ventricular tachyarrhythmia is running now.' : ': no ventricular tachyarrhythmia at this moment.')));
      const sum = this.sum();
      if (sum.inapp) this.find.append(finding('bad', 'Inappropriate therapy', sum.inapp + ' therapy deliver' + (sum.inapp > 1 ? 'ies' : 'y') + ' (ATP or shock) while there was no VT or VF.'));
      if (sum.appr) this.find.append(finding('good', 'Appropriate therapy', sum.appr + ' therapy deliver' + (sum.appr > 1 ? 'ies' : 'y') + ' for a true ventricular tachyarrhythmia, ' + sum.shocks + ' shock' + (sum.shocks === 1 ? '' : 's') + ' in all.'));
    }
    sum() { const o = { shocks: 0, atp: 0, inapp: 0, appr: 0 }; for (const r of this.res) for (const k in o) o[k] += r[k]; return o; }
    ctx() {
      const t = this.live.t, v = {}, sum = this.sum();
      this.spec.phases.forEach((p, i) => { v[p.sc] = this.v[i]; });
      return Object.assign(sum, { t, c: this.icd.c, s: this.s, base: this.base, v, all: this.v.every((x) => x === 'pass'), failed: this.v.some((x) => x === 'fail'), phase: this.pi, changes: this.changes,
        magnet: this.s.magnet, magFor: this.s.magnet ? t - this.magAt : 0, real: this.icd.real(t), dets: this.icd.dets.length, log: this.icd.log });
    }
    destroy() { if (this.live) this.live.destroy(); if (this.strip.ro) this.strip.ro.disconnect(); }
  }
  C.benches.icd = () => new IcdBench();

  // ---- bench: the chest film --------------------------------------------------------------------------
  /* A film is a system from the EP.Devices catalogue (dev + variant v) or one described here (sys). n = leads that enter
   * the heart. rep = a neutral report (generator, leads, PA, lateral): it replaces the picture when three.js or WebGL
   * is not available, so every question can still be answered, and is shown with the picture once a step is answered. */
  const FILMS = {
    ddd: { dev: 'ddd', v: 'ok', n: 2, name: 'Dual-chamber pacemaker, leads in the right atrial appendage and at the right ventricular apex',
      rep: ['A pacemaker-sized generator below the left clavicle.', 'Two leads run from it through the left subclavian vein and down the superior vena cava.',
        'One lead turns up and medially inside the right atrium, in a J. The other crosses the midline and ends at the lower left of the cardiac shadow, pointing down and to the patient\'s left.',
        'The J-shaped lead ends high and anterior. The other sweeps forward and down: its tip is the most anterior and inferior part of the hardware, close behind the sternum.'] },
    vvi: { dev: 'vvi', v: 'ok', n: 1, name: 'Single-chamber pacemaker, lead at the right ventricular apex',
      rep: ['A pacemaker-sized generator below the left clavicle.', 'One thin lead runs from it through the left subclavian vein and down the superior vena cava.',
        'It crosses the midline and ends at the lower left of the cardiac shadow, pointing down and to the patient\'s left.', 'It sweeps forward and down, to end close behind the sternum.'] },
    icd: { dev: 'icd', v: 'ok', n: 1, name: 'Single-chamber ICD with a dual-coil lead',
      rep: ['A large generator below the left clavicle.', 'One lead, thicker than a pacing lead, with two dense segments (coils): one in the superior vena cava and one along its last few centimetres.',
        'It crosses the midline and ends at the lower left of the cardiac shadow.', 'The distal coil runs forward and down, to end close behind the sternum.'] },
    crt: { dev: 'crt', v: 'ok', n: 3, name: 'CRT-D: right atrial lead, right ventricular defibrillation lead, left ventricular lead in a coronary vein',
      rep: ['A large generator below the left clavicle.', 'Three leads run from it down the superior vena cava.',
        'One makes a J in the right atrium. One, with a dense coil along its last few centimetres, ends at the lower left of the cardiac shadow. The third, thin, loops low across the heart and ends on the left heart border, above the tip of the coil.',
        'The J-shaped lead ends high and anterior, and the coil runs forward and down toward the sternum. The third lead runs the other way: backward, behind both of them, toward the spine.'] },
    lv: { n: 1, name: 'Single-chamber pacemaker whose lead has passed through the coronary sinus into a lateral cardiac vein',
      sys: { parts: () => ({ gen: 'pm', leads: [{ route: 'cs', name: 'Ventricular lead' }] }), patient: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibAmp: 0.8 }, avn: CHB(), foci: [{ id: 'esc', node: 'V', cl: 1900, site: 'fascPost', label: 'escape', startAt: 500, sd: 0.02 }] }), pm: { mode: 'VVI', lrl: 70, vSite: 'lvLatEpi' } },
      rep: ['A pacemaker-sized generator below the left clavicle.', 'One thin lead runs from it through the left subclavian vein and down the superior vena cava.',
        'It loops low across the heart and ends on the left heart border.', 'From the right atrium it runs backward, toward the spine, and stays at the back of the heart. No part of it comes forward toward the sternum.'] },
    aveir: { dev: 'aveir', v: 'ok', n: 0, name: 'AVEIR DR: an atrial and a ventricular leadless capsule',
      rep: ['No generator.', 'No leads. Two small dense capsules lie within the cardiac shadow.',
        'A shorter one overlies the right atrium, right of the midline, pointing up and medially. A longer one overlies the lower heart, just left of the midline.', 'Both are anterior: the shorter one higher, the longer one lower.'] },
    micra: { dev: 'micra', v: 'ok', n: 0, name: 'Micra: one leadless capsule in the right ventricle',
      rep: ['No generator.', 'No leads. One small dense capsule lies within the cardiac shadow.', 'It overlies the lower heart, just left of the midline.', 'It lies low and anterior.'] },
    sicd: { dev: 'sicd', v: 'ok', n: 0, name: 'Subcutaneous ICD',
      rep: ['A large generator on the left lateral chest wall, level with the lower heart. Nothing below the clavicle.', 'One lead runs from the generator across to the lower end of the sternum and then straight up as a long dense coil. Nothing enters the heart.',
        'The coil is vertical, just left of the midline, from the xiphoid to the upper sternum.', 'The coil lies in front of the sternum, under the skin.'] },
    evicd: { dev: 'evicd', v: 'ok', n: 0, name: 'Extravascular ICD, with a substernal lead',
      rep: ['A large generator on the left lateral chest wall, level with the lower heart. Nothing below the clavicle.', 'One lead runs from the generator across to the lower end of the sternum and then upward with a wavy course. Nothing enters the heart.',
        'The wavy segment overlies the lower half of the cardiac shadow, in the midline.', 'The lead lies immediately behind the sternum, between it and the heart.'] },
    tvp: { dev: 'tvp', v: 'ok', n: 1, name: 'Temporary wire from the right internal jugular vein to the right ventricular apex',
      rep: ['No generator in the chest.', 'One wire enters from the right side of the neck and descends the superior vena cava.', 'It crosses the midline and ends at the lower left of the cardiac shadow.', 'It sweeps forward and down, to end close behind the sternum.'] },
    twid: { dev: 'ddd', v: 'twiddler', n: 0, name: 'Twiddler\'s syndrome',
      rep: ['A pacemaker-sized generator below the left clavicle, with several turns of lead wound tightly round it.', 'Two leads leave the coil together.',
        'One ends in the superior vena cava and the other in the right atrium. Nothing reaches the lower part of the cardiac shadow.', 'No lead tip lies in the anterior, inferior part of the heart.'] },
    dis: { dev: 'ddd', v: 'dislodge', n: 2, name: 'Dual-chamber pacemaker with the ventricular lead dislodged into the right atrium',
      rep: ['A pacemaker-sized generator below the left clavicle.', 'Two leads run from it down the superior vena cava.',
        'One makes a J in the right atrium. The other ends beside it, low over the right side of the heart. Nothing reaches the lower left of the cardiac shadow.', 'Both tips lie in the middle of the cardiac shadow. Neither is anterior and inferior, behind the sternum.'] },
    rad: { dev: 'ddd', v: 'raDis', n: 2, name: 'Dual-chamber pacemaker with the atrial lead dislodged',
      rep: ['A pacemaker-sized generator below the left clavicle.', 'Two leads run from it down the superior vena cava.',
        'One crosses the midline and ends at the lower left of the cardiac shadow. The other has no J: it hangs straight down the right heart border and ends low on the right.', 'One lead sweeps forward and down to the sternum. The other ends low in the middle of the cardiac shadow without turning up or forward.'] },
    asd: { dev: 'ddd', v: 'asd', n: 2, name: 'Dual-chamber pacemaker whose ventricular lead crosses the atrial septum into the left ventricle',
      rep: ['A pacemaker-sized generator below the left clavicle.', 'Two leads run from it down the superior vena cava.',
        'One makes a J in the right atrium. The other crosses the midline higher than usual, runs horizontally to the left, and then turns steeply down to end at the lower left of the cardiac shadow.',
        'The J-shaped lead ends high and anterior. The other first runs backward from the right atrium, toward the spine, and only then turns down and forward to its tip.'] },
    ptx: { dev: 'ddd', v: 'ptx', n: 2, name: 'Dual-chamber pacemaker in a normal position, with a left pneumothorax',
      rep: ['A pacemaker-sized generator below the left clavicle.', 'Two leads run from it down the superior vena cava.',
        'Both leads are where they were after implant: a J in the right atrium and a tip at the lower left of the cardiac shadow. In the left upper zone a thin curved line runs down from the apex, where there was none before, and the lung outside it is darker.',
        'The leads are in their usual positions. The line is not seen on this view.'] },
    coil: { dev: 'tvp', v: 'coiled', n: 0, name: 'Temporary wire coiled in the right atrium',
      rep: ['No generator in the chest.', 'One wire enters from the right side of the neck and descends the superior vena cava.', 'It ends in a closed loop over the right heart border and never crosses to the left of the spine.', 'The loop lies in the middle of the cardiac shadow, not anteriorly.'] },
    emb: { dev: 'micra', v: 'embol', n: 0, name: 'Leadless capsule embolised to the pulmonary artery',
      rep: ['No generator.', 'No leads. One small dense capsule.', 'It lies above and to the left of the heart, over the left hilum, not over the ventricles.', 'It lies at the level of the hilum, above and behind the place where a ventricular capsule sits.'] },
  };
  /* spec { film, view:'pa'|'lat', ref (film id for the 'after implant' comparison), ecg (show the paced 12-lead), pat } */
  class FilmBench {
    constructor() {
      this.xrEl = h('div.xr', { style: { maxWidth: '470px', margin: '0 auto', borderRadius: '0' } });
      this.viewSeg = UI.seg([['pa', 'PA'], ['lat', 'Lateral']], 'pa', (v) => this.setView(v, true), 'Projection');
      this.refSeg = UI.seg([['cur', 'Today'], ['ref', 'After implant']], 'cur', (v) => { this.ref = v === 'ref'; this.changes++; this.show(); if (this.onChange) this.onChange(); }, 'Which film');
      this.pat = h('div', { style: { fontSize: '13px', marginBottom: '8px' } }); this.txt = h('div', { style: { fontSize: '13.5px' } });
      this.canvas = h('canvas', { 'aria-label': 'Paced 12-lead ECG' });
      this.ecgBox = h('div', { style: { marginTop: '10px' } }, h('div.eyebrow', 'Paced 12-lead ECG'), h('div.ecg-scroll', this.canvas));
      this.find = h('div.findings', { style: { marginTop: '10px' } });
      this.el = h('section.card', h('div.card-h', h('h3', 'Bench — chest film'), h('span.grow'), this.refSeg, this.viewSeg),
        h('div', { style: { background: '#000' } }, this.xrEl), h('div.card-b', this.pat, this.txt, this.ecgBox, this.find));
      this.ecg = new EP.ECGView(this.canvas, { layout: '12', strips: [1] });
      this.text = !(globalThis.THREE && EP.XRay && EP.Hardware); this.xr = null;
      if (!this.text) try { this.xr = new EP.XRay(this.xrEl); } catch (e) { this.noPicture(); }
      else this.noPicture();
      this.showFind = false; this.made = {};
    }
    noPicture() { this.text = true; if (this.xr) { try { this.xr.dispose(); } catch (e) { /* already gone */ } this.xr = null; } this.xrEl.parentElement.style.display = 'none'; }
    sys(id) { const f = FILMS[id], dev = f.sys || EP.Devices.byId[f.dev]; return [dev, f.sys ? { parts: {}, pm: {} } : dev.variants.find((x) => x.id === f.v)]; }
    load(spec) {
      this.spec = spec; this.changes = 0; this.ref = false; this.v = spec.view || 'pa';
      this.viewSeg.set(this.v); this.refSeg.set('cur'); this.refSeg.style.display = spec.ref ? '' : 'none';
      this.pat.innerHTML = ''; if (spec.pat) this.pat.append(h('b', 'Patient: '), spec.pat);
      this.ecgBox.style.display = spec.ecg ? '' : 'none';
      if (spec.ecg) { try { const [dev, va] = this.sys(spec.film); this.ecg.setRecording(EP.Devices.make(dev, va).rec); } catch (e) { console.warn(e); this.ecgBox.style.display = 'none'; } }
      this.show();
    }
    setView(v, user) { this.v = v; this.viewSeg.set(v); this.changes++; this.show(); if (user && this.onChange) this.onChange(); }
    show() {
      const id = this.ref ? this.spec.ref : this.spec.film, f = FILMS[id], r = f.rep, lat = this.v === 'lat';
      if (this.xr) {
        try { const [dev, va] = this.sys(id); this.xr.setHardware(this.made[id] || (this.made[id] = EP.Hardware.build(Object.assign({}, dev.parts(), va.parts || {})))); this.xr.setView(this.v); }
        catch (e) { console.warn(e); this.noPicture(); }
      }
      this.txt.innerHTML = '';
      const line = (k, t) => h('p', { style: { marginTop: '4px' } }, h('b', k + ': '), t);
      if (this.text) this.txt.append(h('p.note', 'The film cannot be drawn on this device, so here is what it shows. Use the PA / Lateral switch as you would on the picture.'),
        line('Generator', r[0]), line('Leads', r[1]), line(lat ? 'Lateral view' : 'PA view', r[lat ? 3 : 2]));
      else if (this.showFind) this.txt.append(line('Generator', r[0]), line('Leads', r[1]), line('PA view', r[2]), line('Lateral view', r[3]));
      else this.txt.append(h('div.muted', { style: { fontSize: '12px' } }, 'A simulated film, drawn from the same geometry as the 3D heart. PA: the patient\'s left is on your right. Lateral: the sternum is on your left, the spine on your right.'));
      this.find.innerHTML = '';
      if (this.showFind) this.find.append(finding(/dislodg|coiled|embol|Twiddler|crosses the atrial|coronary sinus|pneumothorax/.test(f.name) ? 'bad' : 'good', this.ref ? 'After implant' : 'What this is', f.name + '.'));
      else this.find.append(h('div.muted', { style: { fontSize: '12px' } }, 'The interpretation is hidden until you have answered.'));
    }
    findings(on) { this.showFind = on; if (this.spec) this.show(); }
    ctx() { return { view: this.v, ref: this.ref, changes: this.changes, film: this.spec.film, text: this.text }; }
    destroy() { if (this.xr) { try { this.xr.dispose(); } catch (e) { /* already gone */ } } if (this.ecg.ro) this.ecg.ro.disconnect(); }
  }
  C.benches.film = () => new FilmBench();

  /* Unknown ICD episodes, built from the scenarios of the ICD lab (EP.IcdCases). what → cause → action. */
  const IFN = {
    appr: 'Appropriate therapy: a true VT or VF was detected and treated',
    svt: 'Inappropriate therapy: a supraventricular rhythm reached the detection rate',
    over: 'Inappropriate therapy: the device counted signals that are not QRS complexes',
    miss: 'No therapy: a ventricular tachycardia is running below the detection rate',
  };
  const ICASE = {
    af: { title: 'AF shocked through the VF zone', icd: { stab: true, morph: true }, pat: 'single-chamber ICD, stability and morphology on. Palpitations, then a shock.', what: 'svt',
      seen: 'Every ventricular marker has a QRS and a pulse, so the rate is real, and the complexes are those of the conducted rhythm.',
      why: ['Atrial fibrillation conducting fast enough to reach the VF zone', 'Sinus tachycardia that rose gradually into the VT zone', 'T-wave over-sensing, with every beat counted twice', 'Monomorphic VT with a cycle length that varies a little from beat to beat'],
      whyNote: 'Irregular intervals with a conducted QRS for each one: AF. While the intervals stayed in the VT zone the discriminators withheld therapy (the SVT markers). The shock came when nine of twelve intervals were shorter than the VF boundary, where no discriminator applies.',
      fix: ['Slow the ventricular rate and treat the AF; consider a higher VF boundary', 'Replace the right ventricular lead, and keep a magnet on until that is done', 'Reduce ventricular sensitivity, so that fewer of the beats are counted', 'Program more bursts of ATP before the first shock in the VT zone'],
      fixNote: 'The device counted correctly; the rhythm was too fast. Rate control, and rhythm control where possible, remove the cause. Sensitivity must not be blunted in an ICD, and ATP does nothing for AF.' },
    st: { title: 'sinus tachycardia treated as VT', icd: {}, pat: 'single-chamber ICD, no discriminators programmed. Shocked on a treadmill.', what: 'svt',
      seen: 'Every ventricular marker has a narrow QRS and a pulse: the rate is real and the rhythm is conducted from above.',
      why: ['Sinus tachycardia above the VT detection rate', 'Atrial fibrillation with a fast ventricular response', 'A fractured lead producing non-physiological noise', 'Monomorphic VT at 178/min, appropriately detected'],
      whyNote: 'A regular narrow-complex tachycardia at 178/min, with intervals of 337 ms inside a VT zone that begins at 170/min. The bursts of pacing did not change it, and after the shock it resumed at the same rate: nothing was terminated, because there was no circuit to terminate.',
      fix: ['Raise the VT zone above his sinus rates, and switch on discriminators', 'Leave a magnet over the generator until the ventricular lead has been replaced', 'Lower the VT zone to 150/min so that the rhythm is detected and treated sooner', 'Increase the energy of the first shock so that one is enough to stop it'],
      fixNote: 'The fix is in the programming: a detection rate above the rates he reaches, and onset or morphology for the overlap. A beta-blocker lowers the sinus rate as well.' },
    tover: { title: 'T-wave over-sensing', icd: { vtRate: 160 }, pat: 'single-chamber ICD. Renal failure, potassium 6.3 mmol/L. Two shocks at rest.', what: 'over',
      seen: 'There are two ventricular markers for every QRS and every pulse: half of what the device counted was not ventricular depolarisation.',
      why: ['T-wave over-sensing, with every beat counted twice', 'A fractured lead producing bursts of irregular noise', 'Sinus tachycardia at about 200/min with a narrow QRS', 'Atrial fibrillation with a fast ventricular response'],
      whyNote: 'Sinus rhythm at 100/min on the ECG. The markers alternate between two intervals, about 250 and 350 ms, which add up to the true cycle of 600 ms: R wave, then T wave, every beat. Tall T waves (here hyperkalaemia), a long QT or a small R wave bring it out.',
      fix: ['Correct the potassium, and reprogram ventricular sensing if it persists', 'Start intravenous amiodarone to suppress the tachycardia', 'Lengthen detection to 30 intervals, so that the episode stops by itself first', 'Replace the generator, because its sensing circuit has failed'],
      fixNote: 'Remove what made the T wave large or the R wave small, then adjust how the channel senses (sensitivity, filtering or sensing vector, depending on the device). A magnet stops the shocks in the meantime. There is no tachycardia to suppress, and double counting does not stop by itself.' },
    noise: { title: 'lead fracture noise', icd: {}, pat: 'single-chamber ICD implanted seven years ago. Several shocks while reaching up to a shelf.', what: 'over',
      seen: 'The ECG shows sinus rhythm with a normal pulse while the device marks many more events than there are QRS complexes.',
      why: ['A fractured lead: make-and-break noise counted as VF', 'T-wave over-sensing, with every beat counted twice', 'Ventricular fibrillation that each shock terminates', 'Atrial fibrillation with a fast ventricular response'],
      whyNote: 'Intervals of 130–250 ms, irregular and unrelated to the QRS complexes. No ventricle can be activated every 140 ms: these are non-physiological signals, the signature of a conductor whose broken ends touch and separate. The impedance will be abnormal.',
      fix: ['Magnet over the generator now, external pads on, then replace the lead', 'Reduce the ventricular sensitivity until the noise is no longer counted', 'Intravenous amiodarone and a beta-blocker to suppress the arrhythmia', 'Raise the VF boundary to 250/min and lengthen the detection time'],
      fixNote: 'The magnet stops the shocks at once and the pads replace the protection it removes. No programming makes a fractured defibrillation lead safe: it can fail to sense real VF and fail to deliver a shock.' },
    storm: { title: 'electrical storm', icd: {}, pat: 'single-chamber ICD, old anterior infarct. Repeated therapies over the last hour.', what: 'appr',
      seen: 'Each therapy follows the abrupt start of a wide-complex tachycardia with one marker per QRS and a collapsing arterial trace, and each one ends it.',
      why: ['Recurrent monomorphic VT: an electrical storm', 'Lead fracture noise, since the therapies keep recurring', 'Sinus tachycardia from pain after the first shock', 'T-wave over-sensing after each of the paced bursts'],
      whyNote: 'The device is doing exactly what it should, again and again: the VT is real, is detected, and is terminated, and then it comes back. Three or more separate episodes in 24 hours is an electrical storm, whether they end with pacing or with shocks. Pain, fear and every shock raise sympathetic drive, which favours the next episode.',
      fix: ['Treat the patient: sedation, beta-blocker, amiodarone, potassium and magnesium, ischaemia', 'Tape a magnet over the generator, and observe him on the ward overnight', 'Raise the detection rate until this VT is no longer treated', 'Replace the lead and the generator as an emergency'],
      fixNote: 'Nothing is wrong with the hardware. Break the cycle in the patient, keep ATP as the first therapy, and plan ablation if it continues. A magnet would leave a real, haemodynamically significant VT untreated.' },
    slow: { title: 'slow VT below the detection rate', icd: {}, pat: 'single-chamber ICD. Amiodarone was started a month ago. Faint and breathless for an hour, no therapy.', what: 'miss',
      seen: 'A wide-complex tachycardia begins in one beat and the arterial pressure falls, yet the beats are marked VS: sensed, and below the zones.',
      why: ['VT slowed by amiodarone to below the VT zone', 'Sinus tachycardia, which the device rightly ignores', 'Under-sensing of fibrillation by the ventricular lead', 'A magnet that has been left over the generator'],
      whyNote: 'The tachycardia runs at 150/min, intervals of 400 ms, and the VT zone begins at 170/min (353 ms). The device sees every beat and is not allowed to act. Antiarrhythmic drugs slow VT, so starting one calls for a review of the detection rate.',
      fix: ['Lower the VT zone to below the tachycardia rate, with ATP first', 'Raise the VT zone, because the device is right to ignore this rhythm', 'Hold a magnet over the generator in order to trigger a shock', 'Switch on the onset and stability discriminators in the VT zone'],
      fixNote: 'The zone must start below the slowest VT the patient has, usually by 10–20/min, and slow VT is the kind that ATP terminates best. Today the tachycardia itself still needs treating, by the device once reprogrammed or externally.' },
  };
  const icase = (id) => {
    const k = ICASE[id];
    return multi('case-' + id, 'Unknown: what did the device do?', 'An episode from a patient with an ICD. Read the ECG, the arterial trace, the markers, the measured intervals and the therapy log. Replay it as often as you like; the magnet is available.', [
      ['What has happened?', IFN[k.what], Object.keys(IFN).filter((x) => x !== k.what).map((x) => IFN[x]), k.seen],
      ['What is the cause?', k.why[0], k.why.slice(1), k.whyNote],
      ['What do you do?', k.fix[0], k.fix.slice(1), k.fixNote],
    ], { bench: { phases: [{ sc: id }], icd: k.icd, show: [], tog: ['magnet'], pat: k.pat, blind: true }, tDone: 'Unknown: ' + k.title, why: k.whyNote });
  };

  /* Unknown films: what the film shows → what follows from it → what to do. q2 = the second question when it is not the default. */
  const XCASE = {
    twid: { title: 'Twiddler\'s syndrome', ref: 'ddd', pat: 'aged 84, with dementia, three months after a dual-chamber pacemaker for complete heart block. Dizzy spells, and the left arm twitches rhythmically.',
      see: ['The leads are wound round the generator, and both tips have been pulled back', 'The atrial lead has lost its J, and the ventricular lead is where it was left', 'The ventricular lead has gone through the wall and ends outside the heart', 'Both leads are where they were left, and the generator has moved downward'],
      seeNote: 'Turns of lead round the generator, and tips pulled back to the superior vena cava and the right atrium: the generator has been rotated in its pocket, by the patient or because the pocket is loose, and has reeled the leads in. The film after implant shows where they started.',
      then: ['No capture or sensing in either chamber, and stimulation of nerve or muscle near the tips', 'Normal ventricular pacing, with the loss of atrial capture and atrial sensing only', 'Normal capture and sensing, with a very high impedance measured on both leads', 'A paced QRS of right bundle branch block pattern, with a normal threshold'],
      thenNote: 'Neither electrode is still in its chamber. A tip that has retracted to the great veins lies beside the phrenic nerve or the brachial plexus, which is why the arm twitches. In a pacing-dependent patient this is an emergency.',
      act: ['Reposition the leads and revise the pocket; temporary pacing if needed', 'Raise both outputs to their maximum, and repeat the chest film in six weeks', 'Reprogram the device to VVI, and leave both leads where they are now', 'Start anticoagulation, and plan extraction of the ventricular lead'],
      actNote: 'No programming reaches a ventricle that the lead is no longer in. The leads are repositioned or replaced and the generator is fixed in a snug pocket so that it cannot turn again.' },
    dis: { title: 'ventricular lead dislodgement', ref: 'ddd', pat: 'day 2 after a dual-chamber pacemaker for complete heart block. Bradycardia again on the monitor this morning.',
      see: ['The ventricular lead is back in the right atrium: no tip is in the ventricle', 'The atrial lead has lost its J, and the ventricular lead is at the apex', 'Both leads are wound round the generator, with their tips in the great veins', 'Both leads are in position, and the ventricular tip points toward the sternum'],
      seeNote: 'One lead still makes its J; the other ends beside it over the right side of the heart, and on the lateral nothing runs forward to the sternum. On the film after implant that lead reached the apex.',
      then: ['Ventricular stimuli with no QRS, an escape rhythm, and a tiny R wave', 'Atrial stimuli with no P waves, and normal ventricular pacing at the lower rate', 'Pauses with no stimuli, and a ventricular lead impedance above 2000 Ω', 'A paced QRS of right bundle branch block pattern, with a normal threshold'],
      thenNote: 'Capture and sensing fail together, early, with an impedance that is nearly unchanged: the loop is intact and the tip is somewhere else. A fracture gives a high impedance; a threshold rise from the tissue spares sensing.',
      act: ['Reposition the lead, with temporary pacing if the escape rhythm is poor', 'Increase the ventricular output and let the threshold settle over six weeks', 'Reprogram the device to AAI, because the atrial lead is still in place', 'Replace the generator, because its ventricular channel has failed'],
      actNote: 'The lead goes back, promptly, because early dislodgement does not correct itself. Atrial pacing alone is no use in complete heart block.' },
    rad: { title: 'atrial lead dislodgement', ref: 'ddd', pat: 'six weeks after a dual-chamber pacemaker for complete heart block. Tired, with a pounding in the neck.',
      see: ['The atrial lead has lost its J and hangs low in the atrium; the other is at the apex', 'The ventricular lead has pulled back into the atrium; the atrial lead is in the appendage', 'Both leads are wound round the generator, with their tips in the great veins', 'Both leads are where they were left, and there is a pneumothorax on the left'],
      seeNote: 'A ventricular lead in its place, and a second lead that hangs straight down the right heart border where, after implant, it curved up into the appendage.',
      then: ['Atrial stimuli with no P waves, P waves that are not tracked, and ventricular pacing at the lower rate', 'Ventricular stimuli with no QRS complexes, and an escape rhythm of about 30/min', 'Normal AV sequential pacing, with a very high impedance on the atrial lead', 'Tracking of every P wave, with a paced QRS of right bundle branch block pattern'],
      thenNote: 'Without atrial sensing the device cannot follow the sinus node, so it paces the ventricle at the lower rate, dissociated from the atria. The fatigue and the cannon waves are the loss of AV synchrony.',
      act: ['Reposition the atrial lead; until then, use a mode without it', 'Shorten the PVARP so that more of the P waves can be tracked', 'Increase the ventricular output to twice its present value', 'Anticoagulate, because the atrial lead is now in the left atrium'],
      actNote: 'Atrial output that captures nothing is wasted, and an atrial lead lying near the tricuspid valve can be made to sense or pace the ventricle. A non-atrial mode is the holding measure; the cure is to put the lead back.' },
    asd: { title: 'a lead in the left ventricle', ref: 'ddd', pat: 'routine film the day after a dual-chamber pacemaker. Thresholds and sensing are excellent. Use both views.',
      see: ['The ventricular lead runs backward and crosses high: a course through the left heart', 'The ventricular lead runs straight forward to the sternum: the usual course to the right ventricle', 'The ventricular lead has fallen back and ends beside the atrial lead in the right atrium', 'The atrial lead has lost its J and lies low, and the ventricular lead is in its usual position'],
      seeNote: 'On the lateral the lead leaves the right atrium backward, where a right ventricular lead goes forward; on the PA view it crosses the midline high. That is the path across the atrial septum, through the left atrium and the mitral valve.',
      q2: 'The measurements are perfect. Why does the position matter?',
      then: ['A lead in the systemic circulation is a source of emboli: the risk is stroke', 'A lead in the left ventricle cannot sense, so the pacing will be asynchronous', 'The lead will perforate the left ventricular wall within a few days', 'Left ventricular pacing drains the battery several times faster'],
      thenNote: 'The lead crossed a patent foramen ovale or a septal defect (the other route is an arterial puncture and the aortic valve). It paces and senses well, which is why it is missed. The paced QRS usually shows a right bundle branch block pattern, because the left ventricle is activated first.',
      act: ['Anticoagulate, and reposition the lead now, while it is easily withdrawn', 'Leave it, since the measurements are excellent and a second procedure adds risk', 'Reduce the output, to lower the risk of thrombus forming on the lead', 'Give aspirin alone, and repeat the chest film in three months'],
      actNote: 'Found within days, the lead is withdrawn and placed in the right ventricle. Found late, the choice is between lifelong anticoagulation and extraction, which carries an embolic risk of its own.' },
    ptx: { title: 'pneumothorax after implant', ref: 'ddd', pat: 'two hours after a dual-chamber pacemaker implanted by left subclavian puncture. Pleuritic pain on the left, oxygen saturation 91 %. Pacing is normal.',
      see: ['The leads are in place; a thin line and a darker apex on the left: pneumothorax', 'The ventricular lead has fallen back into the right atrium; the lungs are clear', 'The atrial lead has lost its J and hangs low in the atrium; the lungs are clear', 'The leads are wound round the generator, with both tips outside the heart'],
      seeNote: 'Reading the hardware is half the film. On the side of the puncture a pleural line has appeared in the upper zone, with darker lung outside it; the film after implant has neither. Both leads are exactly where they were.',
      then: ['Normal capture and sensing on both leads: the hardware is not the problem', 'Loss of ventricular capture, with a small R wave on that lead', 'Loss of atrial capture and of atrial sensing, with normal ventricular pacing', 'A very high impedance on both of the leads'],
      thenNote: 'The needle that found the subclavian vein also found the pleura. Nothing electrical changes, which is why the lung apex has to be looked at on purpose after every subclavian implant.',
      act: ['Oxygen, and aspirate or drain it: he is symptomatic and hypoxic', 'Reposition both leads under fluoroscopy on the same day', 'Reprogram both outputs to maximum, and repeat the chest film in a week', 'Anticoagulate, and arrange a CT pulmonary angiogram'],
      actNote: 'A small pneumothorax without symptoms is observed with oxygen and a repeat film. One that causes pain, breathlessness or hypoxia, or that is large, is aspirated or drained.' },
    coil: { title: 'a temporary wire coiled in the right atrium', ref: 'tvp', pat: 'complete heart block. A temporary wire was floated in from the right internal jugular vein without fluoroscopy. The pace light flashes at 70/min and the heart rate is still 30/min.',
      see: ['The wire is looped in the right atrium and has not reached the ventricle', 'The wire is at the right ventricular apex, and points forward on the lateral', 'The wire has passed through the heart and ends in the left pleural space', 'The wire is in the coronary sinus, and runs backward on the lateral'],
      seeNote: 'A closed loop over the right heart border that never passes to the left of the spine: the wire has turned on itself in the atrium. A wire in the ventricle reaches the lower left of the cardiac shadow, as on the comparison film.',
      then: ['Stimuli with no QRS, or at most with a P wave after each one', 'Stimuli followed by a wide QRS of left bundle branch block pattern', 'Stimuli followed by a wide QRS of right bundle branch block pattern', 'No stimuli at all, although the pace light on the box is flashing'],
      thenNote: 'The box is firing into the atrium. If it captures there, each stimulus is followed by a P wave and nothing else, because the block is below it.',
      act: ['Advance it across the tricuspid valve under imaging; keep the pads on until it captures', 'Turn the output up to 20 mA and the sensitivity dial to asynchronous', 'Withdraw it by 10 cm and inflate the balloon in the superior vena cava', 'Leave it where it is, and start an isoprenaline infusion in its place'],
      actNote: 'No output captures a ventricle the wire is not in. It has to be advanced, with fluoroscopy, echo or the electrogram from its tip as a guide, and the patient needs another means of pacing until it is.' },
    emb: { title: 'an embolised leadless pacemaker', ref: 'micra', pat: 'one week after a leadless pacemaker for atrial fibrillation with a slow ventricular rate. Syncope today; the monitor shows 32/min with no pacing.',
      see: ['The capsule lies over the left hilum: it has moved to the pulmonary artery', 'The capsule lies over the lower heart, in the right ventricle where it was implanted', 'The capsule lies over the right atrium: it is the atrial half of a two-capsule system', 'There are two capsules, and the ventricular one has turned round on its axis'],
      seeNote: 'On the film after implant the capsule overlies the lower heart. Now it is higher and further left, over the hilum, and on the lateral it is behind and above the ventricle: it has come loose and been carried through the pulmonary valve.',
      then: ['No capture and no sensing: only the underlying rhythm is left', 'Capture of the atria only, with a long PR interval before each QRS', 'Normal pacing, because a leadless device can pace through the blood', 'A paced QRS of right bundle branch block pattern from the left ventricle'],
      thenNote: 'The electrodes are no longer on myocardium. A leadless pacemaker has no second lead and no back-up: when it leaves the ventricle, pacing stops.',
      act: ['Temporary pacing if needed, retrieval of the capsule, and a new device', 'Reprogram the capsule to its maximum output by telemetry, and observe', 'Anticoagulate for three months, and leave the capsule where it now lies', 'Hold a magnet over the capsule to force it to pace asynchronously'],
      actNote: 'Embolisation is rare, and in a patient who depends on pacing it is an emergency. The capsule is snared and removed, and pacing is re-established.' },
  };
  const xcase = (id) => {
    const k = XCASE[id];
    return multi('film-' + id, 'Unknown film', 'Read the film in order: generator, leads, tips on both views, then the lungs. The film taken after implant is there for comparison.', [
      ['What does the film show?', k.see[0], k.see.slice(1), k.seeNote],
      [k.q2 || 'What will the ECG and the device check show?', k.then[0], k.then.slice(1), k.thenNote],
      ['What do you do?', k.act[0], k.act.slice(1), k.actNote],
    ], { bench: { film: id, ref: k.ref, pat: k.pat }, tDone: 'Unknown film: ' + k.title, why: k.seeNote });
  };
  const COUNT = {
    vvi: 'One. A single thin lead from the generator to the right ventricular apex: a single-chamber pacemaker.',
    ddd: 'Two: one that makes a J in the right atrium and one that ends at the right ventricular apex. A dual-chamber pacemaker.',
    icd: 'One. The two dense segments are the shock coils of a single defibrillation lead, one in the superior vena cava and one in the right ventricle; they are not separate leads.',
    crt: 'Three: a J in the right atrium, a lead with a shock coil to the right ventricle, and a thin lead that runs behind the heart to the left ventricle. The third lead is the easiest to miss on the PA view and the most obvious on the lateral.',
  };
  const SYS = {
    icd: 'A single-chamber ICD: one lead, which carries the shock coils', crt: 'A CRT-D: atrial, defibrillation and left ventricular leads',
    ddd: 'A dual-chamber pacemaker: one atrial and one ventricular lead', dicd: 'A dual-chamber ICD: an atrial lead and a defibrillation lead',
  };
  const NOHEART = {
    sicd: 'A subcutaneous ICD, lead in front of the sternum: it shocks, with no ATP or bradycardia pacing', evicd: 'An extravascular ICD, lead behind the sternum: it shocks, and can give ATP and pause pacing too',
    tv: 'A transvenous ICD whose lead has been pulled right back out of the heart and now lies under the skin', ilr: 'An implantable loop recorder with a long sensing electrode: it can record, and cannot treat',
  };

  // ---- units ----------------------------------------------------------------------------------------
  const UNITS = [
    { id: 'd1', dom: 'temp', bench: 'tvp', title: 'Temporary transvenous pacing', short: 'Transvenous wire', goal: 'Measure both thresholds on a temporary wire, set the box with the right margins, and act when capture is lost.',
      teach: () => [
        para('A temporary wire is a bipolar lead lying free in the right ventricle, usually at the apex, connected to an external box with three dials: **rate**, **output** and **sensitivity**. Nothing fixes the tip to the heart, so every number you measure today can be different tomorrow.'),
        list(['**Output is a current, in mA.** The **capture threshold** is the lowest current at which every stimulus is followed by a QRS. Measure it by pacing faster than the patient and turning the output down until capture is lost, then back up. A well-placed wire captures below about 1 mA.',
          '**Leave the output at two to three times the threshold.** The margin covers the rise that comes with oedema at the tip, drugs, potassium, ischaemia and small movements of the wire.',
          '**Sensitivity is a voltage, in mV: the smallest signal the box will call an R wave.** As in a permanent device, a higher number is a taller fence and the box sees less. Turned all the way to **asynchronous**, it sees nothing and paces at the set rate whatever the patient does.',
          '**The sensing threshold** can only be measured if the patient has a rhythm. Set the rate below the patient\'s own and the output to minimum, then find the highest mV number at which every beat is still sensed: that is the sensing threshold, the height of the R wave at the tip. **Set the dial to about half of it**, which is more sensitive than the threshold and gives a 2:1 margin. A usual setting is about 2 mV.',
          '**Pacing without sensing is competition.** If the patient has a rhythm of their own, an asynchronous or under-sensing box drops stimuli anywhere in the cycle. One that captures on the T wave, in the vulnerable period, can start ventricular fibrillation, most readily in an ischaemic or electrolyte-depleted heart. The opposite error, a dial set too sensitive, counts T waves or muscle noise as beats and withholds pacing.',
          '**Check both thresholds at least once a day** (many units do it every shift), with the connections and the battery. A rising capture threshold is the early warning of a wire that is moving or perforating, and it removes your margin without any change on the monitor.',
          '**Read the paced QRS.** From the right ventricular apex it has a left bundle branch block pattern (negative in V1) and a superior axis (negative in II, III and aVF). A change of shape means the tip has moved. An inferior axis suggests it has pulled back toward the outflow tract. A dominant R wave in V1 means the left ventricle is activated first: think of septal perforation or a wire in the coronary sinus.',
          '**Capture lost in a dependent patient:** turn the output to maximum at once. If there are no stimuli at all, check the connections and the battery and switch to asynchronous, in case noise is inhibiting the box. If capture does not return, start transcutaneous pacing or a chronotrope, then reposition the wire under imaging. A high output is a bridge, not a repair.'])],
      steps: () => {
        const thr = pick([0.6, 0.7, 0.8, 0.9, 1.1, 1.3]), rA = pick([4, 5, 6, 7, 8]), thr2 = pick([5.5, 6.5, 7.5, 8.5]);
        const y = pick([[0.6, 2.0, 1.2], [0.8, 2.0, 1.4], [0.5, 1.5, 1.1], [0.7, 2.0, 1.6], [0.9, 2.5, 1.7]]);   // threshold yesterday, output left, threshold today
        const A = { patient: 'chb', thr, pm: { lrl: 70, vOut: 5, vSens: 2 }, show: ['out'] };
        const B = { patient: 'sb', thr: 0.8, rAmp: rA, pm: { lrl: 30, vOut: 0.1, vSens: 20 }, show: ['sens'] };
        const D = { patient: 'sr', thr: 0.8, rAmp: 8, pm: { lrl: 70, vOut: 3, vSens: 2, async: true }, show: ['rate', 'sens'], tog: ['async'] };
        const R = { patient: 'none', thr: 0.8, pm: { lrl: 70, vOut: 2, vSens: 2 }, show: ['rate', 'out', 'sens'], tog: ['async'],
          event: { at: 5000, set: { vThr: thr2, rAmp: 3, vSite: 'rvotSeptal' }, text: 'She has just been turned onto her side.' } };
        return [
          look('Read the monitor', 'Complete heart block. The box is set to 70 ppm, 5.0 mA and 2.0 mV. Each stimulus is followed at once by a wide QRS that is negative in II and in V1, the pattern of the right ventricular apex, and each QRS by an arterial pulse. The row under the traces stands for the indicator lights on the box: VP when it paces, VS when it senses.', A),
          num('thr', 'Measure the capture threshold', 'Turn the output down until a stimulus is no longer followed by a QRS, then back up. What is the capture threshold?', (b) => b.dev.c.vThr, 0.05, 'mA',
            (b) => `${b.dev.c.vThr} mA: the lowest output that captured every stimulus, not the first setting that failed. Below it the monitor showed stimuli at 70/min with nothing after them, the escape rhythm at 30/min, and an arterial pulse only with the escape beats.`, { bench: A }),
          act('margin', 'Set the output', 'Now leave the output where it should be for the next day. (Measure the threshold first if you have not.)', { bench: A, keep: true,
            check: (x) => x.c.vOut >= 2 * x.c.vThr - 1e-9 && x.c.vOut <= 3 * x.c.vThr + 1e-9 && x.nc === 0 && x.run >= 3 && x.since >= 4000, solve: (b) => b.set('out', r1(2.5 * b.dev.c.vThr)),
            live: (x) => (x.c.vOut < x.c.vThr ? 'No capture at this output.' : x.c.vOut < 2 * x.c.vThr - 1e-9 ? 'It captures, but with less than twice the threshold a small rise will lose it.' : x.c.vOut > 3 * x.c.vThr + 1e-9 ? 'It captures, with more than three times the threshold: more than the margin asked for.' : null),
            hint: 'Two to three times the threshold you measured.',
            why: 'Two to three times the threshold. Less leaves no room for the rise that an unfixed wire can show within hours. The battery is not the concern here, as it is in an implanted device, but a much higher output adds little and can stimulate the diaphragm. Some units also set a floor of a few milliamps whatever the threshold.' }),
          num('daily', 'The margin next morning', `Yesterday the threshold was ${y[0]} mA and the output was left at ${y[1].toFixed(1)} mA. This morning the threshold measures ${y[2]} mA. What is the lowest output that restores a 2:1 margin?`, 2 * y[2], 0.05, 'mA',
            `2 × ${y[2]} = ${r1(2 * y[2])} mA. The output of ${y[1].toFixed(1)} mA is now only ${(y[1] / y[2]).toFixed(1)} times threshold, and nothing on the monitor would have told you. A threshold that doubles overnight is also a finding in itself: ask whether the wire has moved or is perforating, and what has changed in the drugs and the potassium.`),
          num('sthr', 'Measure the sensing threshold', 'A different patient: sinus bradycardia at 46/min. The rate is set to 30 ppm, below the patient\'s own, and the output to minimum so that a stray stimulus cannot capture. The sensitivity dial is at 20 mV and the box is blind: it paces through the sinus beats. Lower the number until VS appears on every beat. What is the sensing threshold?', (b) => b.dev.c.rAmp, 0.5, 'mV',
            (b) => `${b.dev.c.rAmp} mV: the highest setting at which every R wave is sensed, which is the height of the R wave at the tip of the wire. Above it the box sees nothing and behaves as if it were asynchronous.`, { bench: B }),
          act('sens-set', 'Set the sensitivity', 'Now leave the sensitivity dial where it should stay.', { bench: B, keep: true,
            check: (x) => x.c.vSens <= x.c.rAmp / 2 + 1e-9 && x.c.vSens >= x.c.rAmp / 4 - 1e-9 && x.ghost === 0 && x.vs >= 3 && x.sp === 0 && x.since >= 5000, solve: (b) => b.set('sens', b.dev.c.rAmp / 2),
            live: (x) => (x.c.vSens > x.c.rAmp ? 'The box is not sensing: it is pacing through the patient\'s beats.' : x.c.vSens > x.c.rAmp / 2 + 1e-9 ? 'It senses, but the setting is more than half the R wave: a small fall in the signal and it is blind again.' : x.ghost ? 'There are VS markers with no QRS above them: at this setting the box counts the T wave as well.' : x.c.vSens < x.c.rAmp / 4 - 1e-9 ? 'It senses, but this is far more sensitive than the R wave requires.' : null),
            hint: 'About half the sensing threshold: a lower number than the threshold, not a higher one.',
            why: 'About half the sensing threshold. The margin has to cover R waves that shrink (a new bundle branch block, ectopics, movement of the tip) without going so low that T waves and muscle potentials clear the fence. If the patient has no rhythm to measure, the dial is left at about 2 mV.' }),
          mcq('async', 'Predict: no sensing, and a rhythm underneath', 'Two days later AV conduction has recovered and the patient is in sinus rhythm at 78/min. The box has been left in asynchronous mode at 70 ppm. What will the monitor show, and what is the risk?',
            ['Stimuli at 70/min, unrelated to the QRS complexes; one on a T wave can start ventricular fibrillation', 'No stimuli, because the faster sinus rhythm inhibits the box; there is no risk unless the sinus rate falls', 'A paced QRS after every P wave at 78/min, because the box follows the sinus rate; the risk is hypotension', 'Stimuli at 70/min that can never capture, because the ventricle is always refractory; there is no risk'],
            'Asynchronous means the sensing circuit is off, so nothing can inhibit the box. Its stimuli drift through the cardiac cycle: most fall in refractory tissue and do nothing, some capture in diastole, and sooner or later one lands on the T wave.'),
          act('demand', 'Stop the competition', 'This is that patient. Make the box safe: it should stay silent while the patient is at 78/min and pace only as a back-up at 50 ppm.', { bench: D,
            check: (x) => !x.async && x.c.lrl >= 40 && x.c.lrl <= 60 && x.sp === 0 && x.vs >= 4 && x.since >= 5000, solve: (b) => { b.set('async', false); b.set('rate', 50); },
            live: (x) => (x.async ? (x.onT ? 'Asynchronous: stimuli are capturing on the T wave.' : 'Asynchronous: the stimuli take no notice of the patient.') : x.c.lrl > 60 ? 'Sensing is back, but the rate is still set above a back-up rate.' : x.c.vSens > x.c.rAmp ? 'Demand mode, but at this sensitivity the box cannot see the R wave.' : null),
            hint: 'Two changes: the box must sense again, and its rate must sit below the patient\'s own.',
            why: 'Demand mode with a sensitivity that sees the R wave, and a rate below the patient\'s own: the box now does nothing unless the rhythm fails. Asynchronous pacing is a deliberate, supervised choice (noise that inhibits the box, diathermy in a dependent patient), never a setting to leave behind.' }),
          act('rescue', 'Capture is lost', 'A pacing-dependent patient: complete heart block with no escape rhythm. This morning the threshold was 0.8 mA and the output was left at 2.0 mA. Watch the monitor while she is turned for a chest film, and act.', { bench: R,
            check: (x) => x.moved > 0 && x.run >= 3 && x.since >= 2500, solve: (b) => b.set('out', 20),
            live: (x) => (!x.moved ? 'Pacing with capture. Keep watching.' : x.run ? 'Capture is back.' : 'Stimuli with no QRS and no pulse. Act now.'),
            hint: 'There are stimuli, so the box is firing. What is missing is enough current.',
            why: (b) => `Output to maximum first: it takes a second and needs no diagnosis. Capture returned because the threshold is now ${b.dev.c.vThr} mA where it was 0.8 mA this morning, which means the tip has moved. Stimuli were present throughout, so rate and sensitivity were not the problem; had there been none, the first moves would have been the connections, the battery and asynchronous mode. If maximum output had failed: transcutaneous pacing and a chronotrope.` }),
          mcq('morph', 'The QRS has changed', 'Capture is back at high output. This morning the paced QRS was negative in II and in V1. Now it is tall and positive in II and still negative in V1. What does the change tell you?',
            ['The tip has pulled back toward the outflow tract: it is displaced and must be repositioned', 'The wire has crossed the septum and is now pacing the left ventricle from its apex', 'Nothing: the paced axis normally changes with posture when a patient is turned onto her side', 'The higher output is capturing a larger volume of myocardium around the same tip position'],
            'Activation that starts high in the right ventricle travels down toward the feet, so the inferior leads turn positive, while V1 stays negative because the right ventricle is still activated first. A wire pacing the left ventricle, or one in the coronary sinus, typically gives a dominant R wave in V1. The high output buys time; the wire has to go back to the apex under imaging.',
            { bench: { patient: 'none', thr: thr2, rAmp: 3, pm: { lrl: 70, vOut: 20, vSens: 2, vSite: 'rvotSeptal' }, show: ['out'] }, keep: true }),
        ];
      } },

    { id: 'd2', dom: 'temp', bench: 'tcp', title: 'Transcutaneous pacing', short: 'Pads', goal: 'Tell true capture from artefact, set the current, and know what the method cannot do.',
      teach: () => [
        para('Transcutaneous pacing drives current across the whole chest, between two large pads, to reach the ventricle. It needs no venous access and no skill with a wire, which is why it is the first pacing a collapsing patient gets. It is also painful and unreliable, which is why it is only a bridge.'),
        list(['**Pads:** anterior–posterior if you can (front: just left of the lower sternum; back: between the left scapula and the spine), otherwise anterior–lateral as for defibrillation. Dry skin, firm contact, and not on top of an implanted generator. Only the current that crosses the ventricle counts, so the heart must lie between the pads.',
          '**Settings:** demand mode, 60–80 per minute, then raise the current until every stimulus captures. Typical thresholds are 40–80 mA. Leave the current a little above threshold (about 10 %, or 5–10 mA): enough to hold capture, and no more pain than necessary.',
          '**Why thresholds vary:** the current spreads through everything between the pads. Whatever puts distance, air or fluid between pad and heart raises the threshold (obesity, emphysema, an effusion, positive-pressure ventilation, a poor pad position or contact), and so does a sick myocardium (ischaemia, acidosis, hyperkalaemia, a long arrest).',
          '**The monitor lies.** The stimulus is enormous compared with a QRS and is followed by a slowly decaying after-potential. The rate meter can count it, and to the eye it looks like a wide complex after every spike. **Electrical capture** is a QRS with an ST segment and a broad T wave after every stimulus. It appears at a threshold; artefact is there at any current.',
          '**Mechanical capture is the kind that matters:** a pulse with every stimulus. Use the arterial line, the pulse-oximeter waveform or bedside echo. If you must use a finger, feel the femoral artery, because the neck and chest muscles jerk with every stimulus and feel like a carotid pulse. A captured QRS with no pulse is pulseless electrical activity and is treated as that.',
          '**Sedation and analgesia:** skeletal muscle is stimulated too. A conscious patient needs a titrated opioid and a sedative as soon as the blood pressure allows. The answer to pain is never a current below threshold.',
          '**No capture:** check that the pads are stuck down and move them to anterior–posterior, go up to the maximum current, correct what raises the threshold, and start a chronotrope (adrenaline or isoprenaline) in parallel.',
          '**It is a bridge.** It buys the minutes to hours needed to reverse the cause or to place a transvenous wire. Plan that step as soon as capture is achieved.'])],
      steps: () => {
        const thr = pick([55, 60, 65, 70, 75, 80, 85]);
        const T = { patient: 'chb', thr, pm: { lrl: 70, vOut: 30 }, show: ['out'] };
        return [
          look('Before pacing', 'Complete heart block with a ventricular escape rhythm at 30/min and a blood pressure of 72/38. Each escape beat has a QRS, a T wave and, a moment later, an arterial upstroke. The pads are on, anterior–posterior, and the pacer is on standby.', { patient: 'chb', thr, pm: { lrl: 70, vOut: 0 }, show: [] }),
          mcq('pads', 'Where the pads go', 'You are placing pads to pace a conscious patient with complete heart block. Which position is usually preferred, and why?',
            ['Anterior–posterior, left of the sternum and below the left scapula: the heart lies between the pads', 'Both pads on the front of the chest, one either side of the sternum: the shortest path between the two pads', 'Right shoulder and left hip: the widest possible spread of current through the whole of the chest', 'Either side of the upper abdomen: clear of the ribs and the lungs, which both resist the flow of current'],
            'Only the fraction of the current that crosses the ventricle does anything useful. Anterior–posterior pads put the heart on the straight line between them and often capture at a lower current. Anterior–lateral is an accepted alternative, and the one to use when the patient cannot be rolled.'),
          mcq('false', 'Is this capture?', 'Pacing has been started at 70 ppm and 30 mA. The ECG rate on the monitor now reads 70/min or more, and every stimulus is followed by a deflection. Look at both traces. Is the heart being paced?',
            ['No: the arterial trace still shows 30 beats a minute, and no T wave follows the deflections', 'Yes: there is a complex after every stimulus, and the monitor is counting a rate of 70/min or more', 'Yes, electrically, but each paced beat is too weak to open the aortic valve and produce a pulse', 'It cannot be judged from the monitor until the current has been raised to the maximum setting'],
            'What follows each stimulus is the after-potential of a very large pulse: it is the same after every spike, it has no ST segment or T wave, and nothing follows it on the arterial line. The escape beats at 30/min, with their own T waves and pulses, are still running underneath. The rate meter is counting artefact.', { bench: T }),
          act('capture', 'Get true capture', 'Raise the current until the heart is truly captured: a pulse with every stimulus.', { bench: T, keep: true,
            check: (x) => x.run >= 4 && x.pulse >= 60 && x.since >= 3500, solve: (b) => b.set('out', b.dev.c.vThr + 25),
            live: (x) => (x.c.vOut < x.c.vThr ? (x.sp >= 2 ? 'A deflection after every stimulus, but the arterial trace has not changed.' : null) : 'A QRS with a T wave after each stimulus, and an arterial upstroke with each one.'),
            hint: 'Go up in steps of 5–10 mA and watch the arterial trace, not the ECG.',
            why: (b) => `Capture appeared at ${b.dev.c.vThr} mA, all at once. Below it nothing changed on the arterial trace, however large the deflection on the ECG; at it, the complex after each stimulus acquired a broad T wave and each one produced a pulse.` }),
          num('tthr', 'The threshold', 'Now find the threshold: the lowest current at which every stimulus still produces a pulse.', (b) => b.dev.c.vThr, 2.5, 'mA',
            (b) => `${b.dev.c.vThr} mA. Typical values are 40–80 mA, and more in a large or hyperinflated chest. Record it: a rising threshold is the usual way transcutaneous pacing fails.`, { bench: T, keep: true }),
          act('tmargin', 'Leave it where it should be', 'Set the current you would leave this patient on.', { bench: T, keep: true,
            check: (x) => x.c.vOut > x.c.vThr && x.c.vOut <= x.c.vThr + 15 && x.run >= 4 && x.since >= 3500, solve: (b) => b.set('out', b.dev.c.vThr + 5),
            live: (x) => (x.c.vOut < x.c.vThr ? 'No capture at this current.' : x.c.vOut === x.c.vThr ? 'This is the threshold itself: the first small rise will lose capture.' : x.c.vOut > x.c.vThr + 15 ? 'It captures, but well above what is needed: more pain and more muscle contraction for nothing.' : null),
            hint: 'A small margin above the threshold: about 10 %.',
            why: 'A little above threshold: about 10 %, or 5–10 mA (some protocols accept less). On a transvenous wire two to three times threshold costs nothing. Here every extra milliamp is paid for in pain and skeletal muscle contraction, so the margin is kept small and the threshold is rechecked often.' }),
          mcq('pea', 'A QRS but no pulse', 'In another patient every stimulus is followed by a wide QRS with a clear T wave, at 70/min. The arterial trace is flat and there is no femoral pulse. What is this, and what do you do?',
            ['Electrical capture with no output: pulseless electrical activity, so CPR and a search for the cause', 'Failure to capture: raise the current to its maximum, and move the pads to an anterior–posterior position', 'Normal pacing with a damped arterial line: flush the line and continue at this current', 'Over-sensing of the T wave: switch the pacer from demand mode to fixed-rate mode'],
            'A QRS with a T wave after every stimulus is electrical capture; more current cannot add anything. The ventricle is depolarising and not ejecting, and that is managed as pulseless electrical activity whatever is driving the rhythm.'),
          mcq('sedate', 'The patient is awake', 'Capture at 75 mA has restored the blood pressure to 108/64. The patient is now alert and in pain, and the chest wall jerks with every stimulus. What do you do?',
            ['Give a titrated intravenous opioid and a sedative, and keep the current above threshold', 'Lower the current until the muscle contraction stops, accepting that capture will be intermittent', 'Switch the pacer off for a few minutes in every ten so that the patient can rest', 'Move both pads onto the back of the chest, where there is less muscle underneath them'],
            'Pain is expected at capturing currents and is treated with drugs, now that the blood pressure allows them. Intermittent capture in a patient who depends on pacing is the one outcome that must be avoided.'),
          mcq('fail', 'No capture at high current', 'An obese man with emphysema and complete heart block: pads anterior–lateral, 130 mA, and still only artefact with a pulse of 28/min. He is conscious. What is the best next move?',
            ['Check the contact and move the pads to anterior–posterior, and start an adrenaline or isoprenaline infusion', 'Continue at 130 mA: capture usually appears within a few minutes as the impedance of the skin falls', 'Sedate him deeply first, because voluntary muscle contraction is what is preventing capture', 'Stop pacing, remove the pads, and wait for the team that will place a transvenous wire'],
            'Air and tissue between the pads and the heart raise the threshold. The quickest things to change are the path (pad position and contact) and the heart\'s own rate (a chronotrope); going on up to the maximum current is reasonable as well. A transvenous wire is the destination, not the treatment for the next few minutes.'),
          mcq('bridge', 'What next', 'Transcutaneous pacing is capturing reliably at 80 mA in a patient with complete heart block after an inferior infarct. Blood pressure 110/60. What is the plan for the next hour?',
            ['Arrange a transvenous wire, or reverse the cause, while the pads hold: they are reliable only briefly', 'Continue transcutaneous pacing on the ward until conduction recovers, with the threshold checked once a day', 'Turn the pacer off to see whether the escape rhythm is adequate, and take the pads off if it is', 'Lower the rate to 40 ppm so that the patient will need less sedation over the following days'],
            'Thresholds rise, pads lift, sedation accumulates and the skin burns: transcutaneous pacing is measured in minutes to hours. For AV block after inferior infarction that usually means reperfusion and time, with a transvenous wire if the block persists and the patient depends on pacing.'),
        ];
      } },

    { id: 'd3', dom: 'icd', bench: 'icd', title: 'ICD detection: rate, duration and discriminators', short: 'ICD detection', goal: 'Say what an ICD counts, why rate alone misleads it, and program zones, duration and discriminators so that only VT is treated.',
      teach: () => [
        para('A transvenous ICD senses through the same right ventricular lead it paces with. From that one channel it gets a list of intervals between ventricular events, and at first that is all it has: **how fast, and for how long**.'),
        list(['**Zones.** Every interval is put in a bin: slower than the lowest detection rate (ignored), the **VT zone**, or the **VF zone**. A zone boundary is an interval, 60 000 ÷ rate: 188/min is 320 ms.',
          '**Duration.** Detection is met when enough intervals fall in a zone. In many devices VT needs a set number in a row and VF a proportion, such as 30 of the last 40, because fibrillation electrograms are small and some are missed. On the bench VT needs 12 in a row and VF 9 of the last 12, unless you change it.',
          '**Rate is not a diagnosis.** Sinus tachycardia at 170/min and VT at 170/min give a single-chamber device the same list of intervals. Therapy for supraventricular rhythms, above all AF with a fast ventricular response and sinus tachycardia, is the classic ICD complication.',
          '**Discriminators** are extra tests applied in the VT zone to withhold therapy from a supraventricular rhythm. **Sudden onset:** VT starts in one beat, sinus tachycardia warms up. **Stability:** VT is regular, AF is not. **Morphology:** the electrogram of a conducted beat matches a stored template, and a ventricular beat does not. With an atrial lead: **more ventricular than atrial events is VT.**',
          '**Each one can be fooled.** Onset: AF and re-entrant SVT also start abruptly, and VT that begins during sinus tachycardia may not look sudden. Stability: sinus tachycardia, atrial tachycardia and flutter with fixed conduction are regular, very fast AF is nearly regular, and VT can be irregular. Morphology: rate-related bundle branch block changes the conducted electrogram. Atrial lead: a 1:1 tachycardia stays ambiguous, and atrial under-sensing or far-field R waves corrupt the count.',
          '**No discriminators at the fastest rates.** Withholding therapy from real VF is fatal; treating a fast SVT is not. Above a rate limit, which in most devices is the VF boundary, no discriminator is applied: the device accepts false positives, and a supraventricular rhythm that is fast enough is shocked whatever is switched on.',
          '**Programming is the main treatment for unnecessary shocks.** High detection rates (for primary prevention, no therapy below about 185–200/min) and long detection times let supraventricular and self-terminating rhythms pass. Against older settings this reduced inappropriate therapy and, in MADIT-RIT, mortality; ADVANCE III showed fewer therapies with detection of 30 of 40 intervals.',
          '**The price of a high rate cut-off** is that a VT slower than the lowest zone is watched and not treated. A patient with a known slow VT has the zone set below it, with discriminators doing the work that rate no longer can.'])],
      steps: () => {
        const rr = pick([150, 160, 167, 171, 182, 188, 200]);
        return [
          look('Read the marker channel', 'A single-chamber ICD in a patient in sinus rhythm at 73/min: each sensed beat is marked VS. At three seconds a monomorphic VT at 185/min starts in one beat. The markers change to TS, because intervals of 325 ms are inside the VT zone (shorter than 353 ms). After 12 in a row detection is met (TD) and the device paces eight times (TP). The line under the legend shows the intervals as the device measures them. Press Replay to see it again.',
            { phases: [{ sc: 'vt185', want: 'treat' }], show: [], tog: [], pat: 'ischaemic cardiomyopathy, single-chamber ICD.' }),
          num('zone-int', 'A zone is an interval', `The VT zone is programmed to start at ${rr}/min. What is the longest interval, in ms, that the device will count as VT?`, 60000 / rr, 3, 'ms',
            `60 000 ÷ ${rr} = ${Math.round(60000 / rr)} ms. The device never works out a rate: it compares each interval with this number, and anything shorter is in the zone.`),
          mcq('rate-only', 'Predict: exercise', 'Single-chamber ICD for primary prevention, VT zone from 150/min, no discriminators switched on. The patient runs for a bus and his sinus rate climbs to 167/min. What will the device do?',
            ['Count the sinus beats as VT and treat them: pacing bursts first, and then shocks', 'Nothing: the electrogram of a sinus beat is narrow, so it is not counted towards VT', 'Nothing: therapy is delivered only when the rate rises suddenly, within a single beat', 'Record the episode for the clinic, but withhold therapy for as long as he is conscious'],
            'With no discriminators the device has two facts, rate and duration, and both are satisfied: 359 ms is shorter than 400 ms for as long as he keeps running. Width, onset and symptoms play no part in rate detection.'),
          act('zone', 'Separate them by rate', 'This is that patient. On his exercise test the sinus rate peaks at 167/min, and the only arrhythmia he has ever had induced is VT at 200/min. Reprogram one number so that exercise is left alone and the VT is still treated. The bench plays the exercise first and then the VT.', {
            bench: { phases: [{ sc: 'st167', want: 'none' }, { sc: 'vt200', want: 'treat' }], icd: { vtRate: 150 }, show: ['vtRate'], pat: 'primary prevention, single-chamber ICD.' },
            check: (x) => x.all, solve: (b) => b.set('vtRate', 185),
            live: (x) => (x.v.st167 === 'fail' ? 'The sinus tachycardia is being treated as VT.' : x.v.vt200 === 'fail' ? 'The VT is running below the detection rate: the device is watching it and doing nothing.' : x.v.st167 === 'pass' ? 'Exercise went by without therapy. Now the VT…' : x.changes ? 'Exercise test in progress…' : null),
            hint: 'The zone must start above his fastest sinus rate and below his VT.',
            why: 'A VT zone that starts above the fastest sinus rate and below the slowest VT separates the two with no discriminator at all, and it is the most reliable separation there is. Leave room on both sides: sinus rates on a bad day exceed the exercise test, and VT slows on antiarrhythmic drugs.' }),
          act('disc', 'When the rates overlap', 'A different patient. On amiodarone his VT now runs at 160/min, and on exercise his sinus rate reaches 172/min. The VT zone has to start at 150/min to catch the VT, so rate cannot separate them. Switch on what the device needs. Again the exercise is played first, then the VT.', {
            bench: { phases: [{ sc: 'st172', want: 'none' }, { sc: 'vt160', want: 'treat' }], icd: { vtRate: 150 }, show: [], tog: ['onset', 'stab', 'morph'], pat: 'secondary prevention, on amiodarone, single-chamber ICD.' },
            check: (x) => x.all, solve: (b) => b.set('onset', true),
            live: (x) => (x.v.st172 === 'fail' ? (x.s.stab && !x.s.onset && !x.s.morph ? 'Stability is on, but sinus tachycardia is as regular as VT: it was treated.' : 'The sinus tachycardia is being treated as VT.') : x.v.st172 === 'pass' ? 'Therapy was withheld during exercise. Now the VT…' : x.changes ? 'Exercise test in progress…' : null),
            hint: 'Ask what differs between these two rhythms: both are fast, and both are regular.',
            why: 'Sudden onset (the sinus rate climbs over many beats, the VT starts in one) or morphology (the conducted electrogram matches the template) withholds therapy during exercise, and this VT satisfies neither test for SVT. Stability does nothing here, because both rhythms are regular.' }),
          multi('fooled', 'What fools each discriminator', 'Each criterion asks one question of the rhythm, and for each there are rhythms that give the wrong answer.', [
            ['Sudden onset is switched on alone. Which supraventricular rhythm will it still call VT?', 'Atrial fibrillation that begins with a fast ventricular rate', ['Sinus tachycardia that builds up over a minute of hard exercise', 'Sinus tachycardia with bundle branch block', 'Sinus tachycardia in a patient with a fever'],
              'AF, flutter and re-entrant SVT begin in one beat, exactly as VT does. Onset recognises only a rhythm that warms up, which means sinus tachycardia. It also fails the other way: VT that begins during sinus tachycardia may show too small a step to count as sudden.'],
            ['Stability is switched on alone. Which supraventricular rhythm will it still call VT?', 'Atrial flutter with 2:1 conduction at 150/min', ['Atrial fibrillation conducting at 160/min', 'Atrial fibrillation with a bundle branch block', 'Atrial flutter with variable conduction'],
              'Stability separates irregular from regular, and nothing else. Any regular SVT passes as VT: flutter with fixed conduction, atrial tachycardia, sinus tachycardia. AF at very high rates becomes almost regular, and VT that is irregular is wrongly withheld.'],
            ['Morphology is switched on alone. Which supraventricular rhythm will it still call VT?', 'Sinus tachycardia with rate-related bundle branch block', ['Sinus tachycardia with its usual narrow QRS', 'Atrial fibrillation with its usual narrow QRS', 'Atrial flutter with 2:1 conduction and its usual narrow QRS'],
              'Morphology compares each electrogram with a template recorded in the patient\'s baseline rhythm. Aberrant conduction changes the electrogram, so a supraventricular beat no longer matches. An out-of-date template does the same.']]),
          act('nsvt', 'Give it time to stop', 'A third patient has frequent runs of VT at 200/min that stop by themselves after five or six seconds, and every one of them is being treated. He also has sustained VT at the same rate. Change the detection so that the device waits out the short runs and still treats the sustained VT. The short run is played first.', {
            bench: { phases: [{ sc: 'nsvt', want: 'none', name: 'A run of 19 beats of VT at 200/min' }, { sc: 'vt200', want: 'treat', name: 'Sustained VT at 200/min' }], icd: { vtRate: 170, nidVT: 12 }, show: ['nidVT'], pat: 'dilated cardiomyopathy, single-chamber ICD.' },
            check: (x) => x.all, solve: (b) => b.set('nidVT', 24),
            live: (x) => (x.v.nsvt === 'fail' ? 'Detection was met before the run had time to stop.' : x.v.nsvt === 'pass' ? 'The short run ended by itself, untreated. Now the sustained VT…' : null),
            hint: 'The rate is the same in both. What differs is how long they last: 19 beats against indefinitely.',
            why: 'Detection needs duration as well as rate. Twelve intervals at 300 ms is under four seconds, and many runs of VT, and most SVT that strays into the zone, are over before a longer count is complete. The cost is a few more seconds of sustained VT before therapy; in ADVANCE III, detection of 30 of 40 intervals reduced therapies without more syncope or deaths.' }),
          mcq('vfzone', 'Shocked with the discriminators on', 'On the bench: atrial fibrillation with a fast ventricular response, with onset, stability and morphology all switched on. Therapy is withheld twice (the SVT markers), and then the device charges and shocks. Why?',
            ['Nine of twelve intervals fell in the VF zone, where discriminators are not applied', 'Stability failed, because atrial fibrillation as fast as this is as regular as a VT', 'Morphology failed, because fibrillation changes the conducted electrogram', 'The fibrillation had moved to the ventricles, and the shock was appropriate'],
            'The marker before the charge is FD, not TD. Intervals shorter than the VF boundary (273 ms here) count towards VF whatever the rhythm, and above that boundary this device, like most, does not ask about onset, stability or morphology. The treatment is to slow the ventricular rate and, where it is safe for the patient, to raise the boundary.',
            { bench: { phases: [{ sc: 'afFast' }], icd: { onset: true, stab: true, morph: true }, show: [], tog: [], pat: 'single-chamber ICD; permanent atrial fibrillation.' } }),
          mcq('dual', 'An atrial lead', 'On the bench: a dual-chamber ICD with therapy switched off, so that you can watch. The upper row of markers is the atrial channel. During the tachycardia there are far fewer atrial markers (AS) than ventricular ones. What does that establish?',
            ['Ventricular tachycardia: the ventricles are faster than the atria, which no SVT can produce', 'Nothing yet: onset and stability are still needed to exclude an atrial tachycardia', 'Atrial fibrillation in which the atrial lead is missing most of the fibrillation waves', 'Sinus tachycardia with 2:1 AV block, which the device should leave untreated'],
            'V > A settles it at once. The converse does not hold: A > V is AF or flutter, and 1:1 could be sinus tachycardia, atrial tachycardia or VT with retrograde conduction, so those still need the other criteria. The count is only as good as the atrial lead: under-sensed AF can masquerade as V > A.',
            { bench: { phases: [{ sc: 'vt185' }], icd: { dual: true, atp: 0, shock: false }, show: [], tog: [], pat: 'dual-chamber ICD; therapies off for this demonstration.' } }),
          mcq('program', 'Programming for fewer shocks', 'A 52-year-old with ischaemic cardiomyopathy receives a primary-prevention ICD. He has never had a sustained arrhythmia. Which programming is best supported by the trials?',
            ['No therapy below about 185–200/min, and detection several seconds longer than older settings', 'A VT zone from 150/min with immediate therapy, so that no ventricular tachycardia is ever left untreated', 'Shocks only, in every zone, because a pacing burst can accelerate a tachycardia into fibrillation', 'A VT zone from 150/min with every discriminator on, and the VF boundary lowered to 180/min'],
            'High detection rates and long detection times let sinus tachycardia, AF and self-terminating VT pass untreated. In MADIT-RIT this cut inappropriate therapy and lowered mortality against conventional programming. A slow VT can be missed, which matters more in a patient who has already had one: there the zone is set below the known VT rate.'),
        ];
      } },

    { id: 'd4', dom: 'icd', bench: 'icd', title: 'ICD therapy and inappropriate shocks', short: 'ICD therapy', goal: 'Explain how pacing stops VT, recognise why a device shocked, and know what to do at the bedside.',
      teach: () => [
        para('An ICD has two ways to stop a ventricular tachyarrhythmia: it can pace faster than the tachycardia, or it can shock. Pacing is painless and often enough. A shock works on the rhythm and always costs the patient something. Most of what goes wrong is therapy delivered for something that was not VT or VF.'),
        list(['**Antitachycardia pacing (ATP).** A **burst** is a short train, typically eight stimuli, at a fixed cycle length a little shorter than the tachycardia: about 85–90 % of it. In a **ramp** each interval within the train is shorter than the one before. Later attempts are usually made faster.',
          '**Why it works.** Monomorphic VT is usually re-entry round a scar, with an excitable gap between the head of the wave and its tail. A paced wavefront that enters the gap collides with the oncoming wave in one direction and, in the other, meets tissue that is still refractory: the circuit is extinguished. This needs one organised circuit, so pacing does nothing for VF or polymorphic VT, and it succeeds less often the faster the VT.',
          '**It can make things worse.** A train can accelerate VT or break it up into VF. ATP is therefore always backed by shocks, and the device goes on counting after every attempt.',
          '**Shock.** The capacitor takes several seconds to charge, and most devices then confirm that the rhythm is still fast before they deliver. A shock ends VT and VF. It is also painful and frightening, and patients who receive shocks do worse, so programming aims to let ATP and patience deal with whatever they can.',
          '**Inappropriate therapy when the rate is real but supraventricular:** AF with a fast ventricular response above all, then sinus tachycardia and other SVTs. There is a QRS and a pulse for every ventricular marker.',
          '**Inappropriate therapy when the rate is not real (over-sensing).** **T-wave over-sensing** counts each beat twice: the markers alternate between two intervals that add up to the true cycle. **A fractured lead or failed insulation** gives bursts of very short, irregular, non-physiological intervals, often with arm movement, and an abnormal impedance. **Electromagnetic interference** gives continuous high-frequency noise on every channel while the patient is near the source. In all three the surface ECG shows an ordinary rhythm with far fewer QRS complexes than markers.',
          '**The magnet.** A magnet over an ICD suspends detection and therapy for as long as it stays there. In almost all models pacing is unchanged and does not become asynchronous. It is first aid for repeated inappropriate shocks, and it leaves the patient unprotected, so external pads go on first.',
          '**After a shock.** One shock, and the patient then feels well: interrogate the device within a day or two. Two or more shocks, or a shock with syncope, chest pain or breathlessness: emergency assessment on a monitor. The question is always what the rhythm was. **Electrical storm** (three or more separate episodes of VT or VF in 24 hours) is treated in the patient, not in the device: sedation, beta-blockade, amiodarone, potassium and magnesium, ischaemia, then reprogramming and ablation.'])],
      steps: (want) => {
        const cl = pick([300, 320, 340, 360, 380, 400]), pct = pick([85, 88]), bcl = Math.round(cl * pct / 100);
        return [
          look('Watch a burst', 'VT at 185/min, cycle length 325 ms. After detection the device paces eight times at 276 ms, which is 85 % of the tachycardia cycle length (the log gives the figure). The paced beats take over the ventricle, and when pacing stops the tachycardia has gone: sinus rhythm, no shock, and the patient may have felt nothing. Press Replay to watch it again.',
            { phases: [{ sc: 'vt185', want: 'treat' }], show: [], tog: [], pat: 'ischaemic cardiomyopathy, single-chamber ICD.' }),
          num('atp-cl', 'How fast is a burst', `A VT has a cycle length of ${cl} ms. The first burst is programmed at ${pct} % of the tachycardia cycle length. At what cycle length does the device pace?`, cl * pct / 100, 3, 'ms',
            `${cl} × 0.${pct} = ${bcl} ms, which is ${Math.round(60000 / bcl)}/min for two to three seconds. The train must be faster than the tachycardia to get ahead of it and enter the circuit, and only a little faster, because the shorter the paced cycle the greater the risk of acceleration.`),
          mcq('why-atp', 'Why pacing can stop a tachycardia', 'Why does a burst of pacing terminate monomorphic VT but not VF?',
            ['VT is one circuit with an excitable gap that a paced wavefront can enter and block; VF has no such circuit', 'Pacing depolarises the whole ventricle at once, which VT cannot survive, whereas fibrillation needs more energy', 'A burst suppresses the automatic focus that drives VT, whereas VF is driven by many foci that recover at once', 'VT is slow enough for every stimulus to capture, whereas in VF the ventricle is refractory all of the time'],
            'Termination needs a wavefront that gets into the circuit, collides with the returning wave and leaves refractory tissue behind it. That requires one organised circuit with a gap of excitable tissue. Pacing captures only the tissue near the electrode; depolarising everything at once is what a shock does.'),
          act('atp-on', 'Spare the shock', 'This patient has monomorphic VT at 185/min, and the device is programmed to shock it straight away. Watch one episode, then reprogram so that the same VT is terminated without a shock.', {
            bench: { phases: [{ sc: 'vt185', want: 'treat' }], icd: { atp: 0 }, show: ['atp'], pat: 'secondary prevention, single-chamber ICD.' },
            check: (x) => x.all && x.shocks === 0, solve: (b) => b.set('atp', 2),
            live: (x) => (x.shocks ? 'The VT was ended by a shock.' : x.c.atp && !x.all ? 'ATP is programmed. Waiting for the VT…' : null),
            hint: 'One control: how many pacing attempts come before the shock.',
            why: 'Eight paced beats ended an arrhythmia that would otherwise have cost a shock. In PainFREE Rx II, ATP terminated about three quarters of fast VT episodes, with no more acceleration or syncope than shocks. ATP is therefore the first therapy for monomorphic VT wherever a few seconds of delay will be tolerated, with shocks behind it.' }),
          mcq('accel', 'After a burst the rate is faster', 'VT at 180/min is treated with a burst. When pacing stops, the markers show intervals of 240 ms where they were 333 ms, and the arterial trace has fallen away. What has happened, and what does the device do?',
            ['The burst accelerated the VT; the device redetects it in the faster zone and goes on to shock', 'The burst captured and the VT has stopped; the short intervals are the paced beats being counted', 'The burst failed to capture; the device repeats the same burst until one of them does capture', 'The device mistook sinus tachycardia for VT, and the pacing has provoked atrial fibrillation'],
            'ATP can drive a circuit faster or disorganise it into VF. That is why a pacing-only prescription is not used: every ATP sequence ends in shocks, and the device re-evaluates the rhythm after every attempt.'),
          act('magnet', 'Stop the shocks', 'A patient arrives after four shocks in ten minutes. She is awake, the monitor shows sinus rhythm, and as you watch the device shocks again. There is no programmer. External pads are on. Stop the shocks.', {
            bench: { phases: [{ sc: 'fracture' }], show: [], tog: ['magnet'], pat: 'single-chamber ICD implanted six years ago.', blind: true },
            check: (x) => x.magnet && x.magFor >= 5000, solve: (b) => b.set('magnet', true),
            live: (x) => (x.magnet ? 'Detection suspended: no markers, no charging.' : x.shocks ? x.shocks + (x.shocks > 1 ? ' shocks' : ' shock') + ' so far, each one in sinus rhythm.' : null),
            hint: 'It is in the cardiac arrest trolley, and it needs no programmer.',
            why: 'A magnet suspends tachyarrhythmia detection for as long as it is over the generator, in almost all models. It does not change pacing, and when it is lifted detection resumes. It has cured nothing. The markers showed bursts of intervals far too short to be ventricular activity, which is noise from a damaged lead, and she is now unprotected: that is why the pads went on first.' }),
          mcq('one-shock', 'One shock at home', 'A man with a secondary-prevention ICD telephones. He had one shock an hour ago while gardening, with a moment of light-headedness before it, and he now feels entirely well. What do you advise?',
            ['No emergency: a device interrogation within a day or two, sooner if anything else happens', 'An ambulance now: every shock needs immediate assessment in hospital, on a cardiac monitor', 'A magnet taped over the device until the clinic is able to see him the following week', 'Nothing unless it happens again: one isolated shock only shows that the device is working'],
            'A single shock followed by full recovery is most often the device doing its job. It still needs an interrogation soon, to see what the rhythm was and whether programming or drugs should change. Two or more shocks in a short time, or a shock with continuing symptoms, is an emergency.'),
          mcq('emi', 'Noise without a broken lead', 'A patient is shocked while using an arc welder. The stored episode shows continuous high-frequency signals on every channel, starting and stopping abruptly, with normal beats visible through them. Lead impedances and thresholds are normal, and moving the arm or pressing on the pocket reproduces nothing. What is the cause?',
            ['Electromagnetic interference from the welder: avoid the source; the hardware is sound', 'A fractured lead: this is make-and-break noise, and the lead will have to be replaced soon', 'T-wave over-sensing: the sensitivity of the ventricular channel must be reduced', 'Atrial fibrillation with a fast ventricular response: start rate control'],
            'External interference is picked up by every sensing circuit at once, lasts as long as the exposure, and leaves the lead measurements normal. Fracture noise is intermittent and irregular, confined to the damaged conductor, often provoked by movement, and comes with a change in impedance.'),
        ].concat(wanted(want, 'case-', Object.keys(ICASE).filter((k) => SC[k].cfg), 2).map(icase));
      } },

    { id: 'd5', dom: 'hardware', bench: 'film', title: 'Devices and leads on the chest film', short: 'The film', goal: 'Read a device film in order, name the system, and recognise a lead or a capsule that is in the wrong place.',
      teach: () => [
        para('A chest film is the cheapest device check there is, and the only one that shows where the hardware is. Read it in the same order every time, on both views, and compare it with the film taken after the implant.'),
        list(['**Generator first.** Below the clavicle and small: a pacemaker. Below the clavicle and large: an ICD or a CRT-D. On the left lateral chest wall: a subcutaneous or extravascular ICD. None at all: a leadless capsule, or a temporary wire coming from the neck or the groin.',
          '**Count the leads and follow each from the generator to its tip.** A thin lead is a pacing lead. A lead with a thick, dense segment carries a shock coil and belongs to an ICD; the coil is part of that lead, not another lead. On the way, look for turns of lead round the generator, sharp kinks, and a break where the lead passes between the clavicle and the first rib.',
          '**The PA view shows left and right; the lateral shows front and back.** The right ventricle is the front of the heart, so a right ventricular apical lead ends low and left of the spine on the PA view and **points forward, toward the sternum, on the lateral**. An atrial lead makes a J and ends high and anterior, in the appendage. The coronary sinus runs in the groove at the back of the heart, so **a coronary sinus or left ventricular lead runs backward, toward the spine**.',
          '**The systems.** Single-chamber: one ventricular lead. Dual-chamber: add the atrial J. CRT: add a third lead through the coronary sinus to the lateral left ventricle, well apart from the right ventricular tip. A left bundle branch area lead ends on the septum, higher than the apex, and gives a narrow paced QRS.',
          '**Leadless pacemakers.** A Micra is one capsule in the right ventricle: VVI, or in the AV model tracking of the atrium from the mechanical signal of atrial contraction, with no atrial pacing. An AVEIR capsule screws in and can be paired: a ventricular and an atrial capsule that signal to each other on every beat make a true dual-chamber pacemaker, which senses and paces the atrium.',
          '**Defibrillators with nothing in the heart.** Subcutaneous ICD: generator on the left chest wall, coil under the skin in front of the sternum; it shocks, and cannot pace for bradycardia or deliver ATP. Extravascular ICD: the lead lies behind the sternum, close to the heart, and can also deliver ATP and brief pause-prevention pacing. The lateral view tells them apart.',
          '**Malposition.** A lead in the **coronary sinus or a cardiac vein** can look acceptable on the PA view and is given away by its posterior course on the lateral. A lead in the **left ventricle** (through a patent foramen ovale or a septal defect, or by an arterial puncture and the aortic valve) also runs posteriorly, works perfectly, and causes strokes. **Dislodgement:** the tip is no longer where the implant film shows it. **Perforation:** the tip lies at or beyond the edge of the heart. **Twiddler\'s syndrome:** leads wound round a rotated generator, tips pulled back out of their chambers. After a subclavian puncture, look at the lung apex for a **pneumothorax**.',
          '**The paced QRS is the cross-check.** A lead in the right ventricle activates the right ventricle first, so the paced QRS has a left bundle branch block pattern, negative in V1. A dominant R wave in V1 from a supposedly right ventricular lead means the left ventricle is being activated first, and the lead has to be found. The expected exceptions are a left ventricular lead and left bundle branch area pacing.'])],
      steps: (want) => {
        const cnt = pick(['vvi', 'ddd', 'crt', 'icd']), sys = cnt === 'icd' ? 'crt' : cnt === 'crt' ? 'icd' : pick(['icd', 'crt']), ex = pick(['sicd', 'evicd']);
        const LV = 'single-chamber pacemaker implanted yesterday for atrial fibrillation with a slow ventricular rate. The threshold is higher than it was at implant.';
        return [
          look('A normal film, in order', 'A dual-chamber pacemaker. Generator: below the left clavicle, small. Leads: two, both through the left subclavian vein and the superior vena cava. On the PA view one makes a J in the right atrium and the other ends low, to the left of the spine. Now switch to the lateral: the atrial tip is high and anterior, and the ventricular lead sweeps forward to end just behind the sternum. The paced 12-lead underneath agrees with a right ventricular apical lead: negative in V1, and negative in II, III and aVF.', { film: 'ddd', ecg: true }),
          num('count', 'Count the leads', 'How many leads enter the heart on this film? Follow each one from the generator to its tip, on both views.', FILMS[cnt].n, 0.1, 'leads', COUNT[cnt], { bench: { film: cnt } }),
          mcq('system', 'Name the system', 'What is this system?', [SYS[sys], SYS[sys === 'icd' ? 'crt' : 'icd'], SYS.ddd, SYS.dicd],
            sys === 'icd' ? 'A large generator and one lead with two dense segments: the shock coils, in the superior vena cava and the right ventricle. One lead, so single-chamber; coils, so an ICD.'
              : 'A large generator and three leads: an atrial J, a right ventricular lead with a shock coil, and a third lead that runs behind the heart to the left ventricle. Three leads with a left ventricular one is resynchronisation; the coil makes it a CRT-D.', { bench: { film: sys } }),
          act('lateral', 'Ask for the right view', 'The tip of this lead overlies the ventricles on the PA view. Bring up the view that will show whether it is in the right ventricle.', { bench: { film: 'lv', pat: LV },
            check: (x) => x.view === 'lat', solve: (b) => b.setView('lat'), hint: 'Left and right are not in question. Front and back are.',
            why: 'The lateral. On a PA film the right ventricle, the coronary veins and the left ventricle lie on top of one another; only the lateral separates the front of the heart from the back.' }),
          mcq('post', 'Where is the lead?', 'On the lateral this lead turns backward from the right atrium and stays at the back of the heart. No part of it comes forward toward the sternum. Where is it?',
            ['In the coronary sinus and a cardiac vein, outside the left ventricle', 'At the apex of the right ventricle, which is the position that was intended', 'In the right ventricular outflow tract, immediately below the pulmonary valve', 'In the right atrial appendage, which is the most anterior part of the atrium'],
            'The right ventricle is in front, so a lead inside it must come forward. The structure that leaves the right atrium backward is the coronary sinus, in the groove between atrium and ventricle at the back of the heart, and its tributaries run over the left ventricle. This is where a CRT lead is placed on purpose, and where a pacing lead sometimes goes by mistake.',
            { bench: { film: 'lv', view: 'lat', pat: LV }, keep: true }),
          mcq('ecg-cross', 'The ECG said so first', 'The paced 12-lead of the same patient is now under the film. Which feature of it should have raised the question before any film was taken?',
            ['A dominant R wave in V1: a right bundle branch block pattern from a "right ventricular" lead', 'A QRS wider than 120 ms after every stimulus, with a T wave of the opposite polarity', 'Stimuli that are not preceded by P waves, on a baseline of atrial fibrillation', 'A regular paced rhythm at 70/min with no intrinsic beats between the stimuli'],
            'A lead in the right ventricle activates the right ventricle first: the wavefront moves away from V1, which is negative, as in left bundle branch block. A dominant R wave in V1 means the left ventricle went first. Before blaming the lead, repeat V1 and V2 one interspace lower, since electrodes placed too high can produce a small R wave. The other three findings are expected with any VVI pacemaker in atrial fibrillation.',
            { bench: { film: 'lv', view: 'lat', ecg: true, pat: LV } }),
          mcq('leadless', 'Two capsules', 'No generator and no leads: two capsules, one over the right atrium and one over the right ventricle. What can this system do that a single ventricular capsule cannot?',
            ['Sense and pace the atrium electrically: a true dual-chamber pacemaker', 'Follow the atrium by detecting the mechanical signal of each atrial contraction', 'Deliver a shock for ventricular fibrillation between the two capsules', 'Resynchronise the ventricles by pacing the septum from both of its sides'],
            'A single Micra AV already follows the atrium, using its accelerometer to detect atrial contraction, but it cannot pace the atrium and it loses tracking at higher sinus rates. Two AVEIR capsules that communicate on every beat sense and pace both chambers: DDD without leads.', { bench: { film: 'aveir' } }),
          mcq('sicd-ev', 'Nothing in the heart', 'A generator on the left chest wall, one lead beside the sternum, and nothing inside the heart. On the lateral view find the sternum (the grey vertical band at the front of the chest) and see which side of it the lead lies on. Which device is this, and what follows from that?',
            [NOHEART[ex], NOHEART[ex === 'sicd' ? 'evicd' : 'sicd'], NOHEART.tv, NOHEART.ilr],
            ex === 'sicd' ? 'On the lateral the coil lies in front of the sternum, under the skin: a subcutaneous ICD. It defibrillates across the chest and, apart from brief pacing after a shock, can do nothing else, so it suits patients who need neither bradycardia pacing nor ATP.'
              : 'On the lateral the lead lies behind the sternum, between it and the heart: an extravascular ICD. Being that close to the ventricle it can pace as well as shock, which gives it ATP and pause-prevention pacing; it is still not a pacemaker for a patient who needs regular pacing.', { bench: { film: ex } }),
        ].concat(wanted(want, 'film-', Object.keys(XCASE), 2).map(xcase));
      } },
  ];

  C.TempBench = TempBench; C.IcdBench = IcdBench; C.FilmBench = FilmBench; C._d2 = { Icd, SC, FILMS };
  C.addTrack({ id: 'dev2', title: 'Temporary pacing, ICDs and hardware', short: 'Devices II', dom: 'hardware',
    blurb: 'The external pacing box and the pads, how an ICD decides and why it shocks when it should not, and reading devices and leads on the chest film.', units: UNITS });
})(globalThis.EP = globalThis.EP || {});
