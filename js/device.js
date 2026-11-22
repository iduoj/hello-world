/* EP Simulator — implantable / temporary device logic and the real-time run loop.
 *
 * EP.Pacemaker(sim, cfg)  timing-cycle engine attached to a HeartSim: senses through the simulated
 *                         leads, paces through sim.pace(), writes markers ('AS','AP','AR','VS','VP',…)
 *                         and timer bars to the event log.
 * EP.ICD(sim, cfg)        rate-zone detection, ATP and shock.
 * EP.Live                 advances a sim in real time and feeds LiveStrip(s).
 */
(function (EP) {
  'use strict';
  const Mo = EP.Morph, M = EP.Model;

  const PM_DEF = {
    mode: 'DDD', lrl: 60, url: 130, avdP: 180, avdS: 150, pvarp: 250, vrp: 240, arp: 300, pvab: 110, vBlank: 30,
    aOut: 2.5, vOut: 2.5, aThr: 0.8, vThr: 0.8,           // volts (or mA for temporary pacing)
    aSens: 0.5, vSens: 2.5, pAmp: 2.6, rAmp: 10, tAmp: 1.2, ffr: 0.3,   // mV
    aSite: 'raa', vSite: 'rvApex', vSpec: null, kind: 'bipolar',
    hyst: 0, modeSwitch: true, msRate: 175, magnet: false, magnetRate: 85, safetyPace: true, crosstalk: false,
    pvcExt: false, noiseV: 0, noiseA: 0, noOutput: false, tcpArtifact: false,
  };
  const HAS = {
    AOO: { pa: 1 }, AAI: { pa: 1, sa: 1 }, VOO: { pv: 1 }, VVI: { pv: 1, sv: 1 }, VDD: { pv: 1, sa: 1, sv: 1, track: 1 },
    DOO: { pa: 1, pv: 1 }, DDI: { pa: 1, pv: 1, sa: 1, sv: 1 }, DDD: { pa: 1, pv: 1, sa: 1, sv: 1, track: 1 }, OFF: {}, ODO: { sa: 1, sv: 1 },
  };

  class Pacemaker {
    constructor(sim, cfg) {
      this.sim = sim; this.c = Object.assign({}, PM_DEF, cfg || {});
      this.tok = { a: 0, v: 0, async: 0 };
      this.lastV = -1e7; this.lastA = -1e7; this.vrpEnd = -1; this.pvarpEnd = -1; this.aBlank = -1; this.vBlankEnd = -1;
      this.inAVD = false; this.aaInt = []; this.switched = false; this.stats = { ap: 0, vp: 0, as: 0, vs: 0 };
      this.vVox = M.nearest((Mo.SITES[this.c.vSite] || { p: this.c.vSite }).p, 'any');
      sim.on('A', (e) => this._onA(e)); sim.on('V0', (e) => this._onV(e));
      this._ownA = -1; this._ownV = -1;
      this.restart(sim.t + 5);
      this._noise();
    }
    get mode() {
      const c = this.c;
      if (c.magnet) return { DDD: 'DOO', DDI: 'DOO', VDD: 'VOO', VVI: 'VOO', AAI: 'AOO' }[c.mode] || c.mode;
      if (this.switched && (c.mode === 'DDD' || c.mode === 'VDD')) return c.mode === 'DDD' ? 'DDI' : 'VVI';
      return c.mode;
    }
    get lri() { return 60000 / (this.c.magnet ? this.c.magnetRate : this.c.lrl); }
    get uri() { return 60000 / this.c.url; }
    set(o) { const m0 = this.c.mode, mg = this.c.magnet; Object.assign(this.c, o); if (o.vSite) this.vVox = M.nearest((Mo.SITES[this.c.vSite] || { p: this.c.vSite }).p, 'any'); if (this.c.mode !== m0 || this.c.magnet !== mg) { this.switched = false; this.restart(this.sim.t + 5); } }
    mark(t, ch, text) { this.sim.emit({ t, type: 'mark', ch, text }); }
    timer(name, t0, t1) { this.sim.emit({ t: t0, type: 'timer', name, t0, t1 }); }
    restart(t) {
      this.tok.a++; this.tok.v++; this.tok.async++; this.inAVD = false;
      const m = this.mode, cap = HAS[m] || {};
      if (m === 'AOO' || m === 'VOO' || m === 'DOO') {
        const tk = this.tok.async;
        const beat = (tt) => {
          if (tk !== this.tok.async) return;
          if (m === 'AOO') this._paceA(tt, true);
          else if (m === 'VOO') this._paceV(tt, true);
          else { this._paceA(tt, true); this.sim.schedule(tt + this.c.avdP, (t2) => { if (tk === this.tok.async) this._paceV(t2, true); }); }
          this.sim.schedule(tt + this.lri, beat);
        };
        this.sim.schedule(t + 200, beat);
      } else if (m === 'AAI') this._armA(t + this.lri);
      else if (cap.pv) this._cycle(t, 'init');
    }
    _armA(t) { const tk = ++this.tok.a; this.sim.schedule(t, (tt) => { if (tk === this.tok.a) this._paceA(tt); }); }
    _armV(t) { const tk = ++this.tok.v; this.vDue = t; this.sim.schedule(t, (tt) => { if (tk === this.tok.v) this._paceV(tt); }); }

    // ---- sensing inputs from the heart ----
    _onA(e) {
      if (e.t === this._ownA) return;
      const cap = HAS[this.mode] || {};
      if (!cap.sa) return;
      const amp = this.c.pAmp * (e.drive === 'fib' ? 0.25 + 0.5 * this.sim.rng() : e.drive === 'flutter' ? 0.7 : 1);
      const ts = e.t + (e.lat ? e.lat(this.c.aSite) : 20);
      this.sim.schedule(ts, (t) => this._senseA(t, amp));
    }
    _onV(e) {
      const own = e.t === this._ownV;
      const cap = HAS[this.mode] || {};
      // T-wave on the ventricular channel (oversensed only if larger than the programmed sensitivity)
      if (cap.sv && this.c.tAmp >= this.c.vSens) { const tt = e.t + 250 + 0.12 * Math.min(1200, e.rr || 800); this.sim.schedule(tt, (t) => this._senseV(t, this.c.tAmp, 'T')); }
      // far-field R wave on the atrial channel
      if (cap.sa && this.c.ffr >= this.c.aSens) this.sim.schedule(e.t + 40, (t) => this._senseA(t, this.c.ffr, 'FFR'));
      if (own || !cap.sv) return;
      const lat = e.act && e.act.T[this.vVox] < Infinity ? Math.max(0, e.act.T[this.vVox]) : 30;
      const pvc = e.c && (e.c.type === 'focus');
      this.sim.schedule(e.t + lat, (t) => this._senseV(t, this.c.rAmp * (pvc ? 1.2 : 1), pvc ? 'PVC' : 'R'));
    }
    _noise() {
      const tick = (t) => {
        const c = this.c, cap = HAS[this.mode] || {};
        if (c.noiseV > 0 && cap.sv && this.sim.rng() < 0.5) this._senseV(t, c.noiseV * (0.6 + 0.8 * this.sim.rng()), 'noise');
        if (c.noiseA > 0 && cap.sa && this.sim.rng() < 0.5) this._senseA(t, c.noiseA * (0.6 + 0.8 * this.sim.rng()), 'noise');
        this.sim.schedule(t + 60 + 140 * this.sim.rng(), tick);
      };
      this.sim.schedule(this.sim.t + 100, tick);
    }
    _senseA(t, amp, src) {
      const c = this.c, m = this.mode, cap = HAS[m] || {};
      if (!cap.sa || amp < c.aSens) return;
      if (t < this.aBlank) return;
      // atrial-rate monitor (uses refractory senses too)
      this.aaInt.push(t - this.lastA); if (this.aaInt.length > 8) this.aaInt.shift(); this.lastA = t;
      this._modeSwitch(t);
      if (m === 'AAI') { if (t - this._aRef < c.arp) { this.mark(t, 'A', 'AR'); return; } this._aRef = t; this.mark(t, 'A', 'AS'); this.stats.as++; this._armA(t + (c.hyst ? 60000 / c.hyst : this.lri)); return; }
      if (t < this.pvarpEnd) { this.mark(t, 'A', 'AR'); return; }
      this.mark(t, 'A', 'AS'); this.stats.as++;
      this.tok.a++;                                   // inhibit the pending atrial pace
      if (cap.track && !this.inAVD) {
        this.inAVD = true;
        const due = Math.max(t + c.avdS, this.lastV + this.uri);
        this.timer('AVD', t, due);
        this._armV(due);
      }
    }
    _senseV(t, amp, src) {
      const c = this.c, m = this.mode, cap = HAS[m] || {};
      if (!cap.sv || amp < c.vSens) return;
      if (t < this.vBlankEnd) return;
      if (t < this.vrpEnd) return;
      // crosstalk window: a ventricular sense right after an atrial pace triggers a committed safety pace
      if (c.safetyPace && this._apAt != null && t - this._apAt < 110 && t - this._apAt >= 0 && (m === 'DDD' || m === 'DDI')) {
        this.mark(t, 'V', 'VS');
        const tk = ++this.tok.v; this.sim.schedule(this._apAt + 110, (tt) => { if (tk === this.tok.v) this._paceV(tt, false, 'VSP'); });
        return;
      }
      this.mark(t, 'V', 'VS'); this.stats.vs++;
      this.tok.v++; this.tok.a++;
      this._cycle(t, src === 'PVC' && !this.inAVD ? 'PVC' : 'VS');
    }
    _modeSwitch(t) {
      const c = this.c;
      if (!c.modeSwitch || !(c.mode === 'DDD' || c.mode === 'VDD') || this.aaInt.length < 6) return;
      const lim = 60000 / c.msRate, fast = this.aaInt.filter((x) => x < lim).length;
      if (!this.switched && fast >= 5) { this.switched = true; this.mark(t, 'V', 'MS'); this.inAVD = false; this.tok.v++; this._cycle(Math.max(this.lastV, t - this.lri * 0.5), 'ms'); }
      else if (this.switched && fast === 0 && this.aaInt.length >= 8) { this.switched = false; this.mark(t, 'V', 'MS'); }
    }

    // ---- outputs ----
    _paceA(t, async) {
      const c = this.c, m = this.mode;
      this._apAt = t; this.stats.ap++;
      if (!c.noOutput) { this._ownA = t; this.sim.pace(t, 'A', { site: c.aSite, captured: c.aOut >= c.aThr, kind: c.kind }); }
      this.mark(t, 'A', 'AP');
      this.lastA = t; this.aaInt.push(999); if (this.aaInt.length > 8) this.aaInt.shift();
      this.vBlankEnd = t + c.vBlank;
      if (c.crosstalk) this.sim.schedule(t + c.vBlank + 12, (tt) => this._senseV(tt, 99, 'xtalk'));
      if (async) return;
      if (m === 'AAI') { this._aRef = t; this._armA(t + this.lri); return; }
      if (m === 'DDD' || m === 'DDI') {
        if (m === 'DDD') { this.inAVD = true; this.timer('AVD', t, t + c.avdP); this._armV(t + c.avdP); }
        // DDI: the ventricular pace was already armed at the lower rate interval
      }
    }
    _paceV(t, async, label) {
      const c = this.c;
      this.stats.vp++;
      let res = false;
      if (!c.noOutput) {
        this._ownV = t;
        res = this.sim.pace(t, 'V', { site: c.vSite, spec: c.vSpec || undefined, captured: c.vOut >= c.vThr, kind: c.kind });
        if (res === false) this._ownV = -1;
        if (c.tcpArtifact) this.sim.emit({ t, type: 'art', wave: tcpArtifact() });
      }
      this.mark(t, 'V', label || 'VP');
      this.lastCapture = res;
      if (!async) this._cycle(t, 'VP');
      else { this.lastV = t; }
    }
    /* Start the timing cycle that follows a ventricular event (sensed or paced). */
    _cycle(t, kind) {
      const c = this.c, m = this.mode;
      this.lastV = t; this.inAVD = false; this._apAt = null;
      this.vrpEnd = t + c.vrp; this.timer('VRP', t, t + c.vrp);
      if (m === 'VVI') { this._armV(t + (kind === 'VS' && c.hyst ? 60000 / c.hyst : this.lri)); return; }
      const pv = c.pvarp + (kind === 'PVC' && c.pvcExt ? 150 : 0);
      this.pvarpEnd = t + pv; this.aBlank = t + c.pvab; this.timer('PVARP', t, t + pv);
      if (m === 'VDD') { this._armV(t + this.lri); return; }
      if (m === 'DDD') { const va = this.lri - c.avdP; this.timer('VA', t, t + va); this._armA(t + va); this.tok.v++; return; }
      if (m === 'DDI') { const va = this.lri - c.avdP; this._armA(t + va); this._armV(t + this.lri); return; }
    }
  }
  /* Transcutaneous pacing artefact: a wide, decaying deflection after every stimulus (it can masquerade as a QRS). */
  let _tcp = null;
  function tcpArtifact() {
    if (_tcp) return _tcp;
    const n = 190, w = new Float32Array(3 * n), d = [0.25, -0.75, 0.6];
    for (let i = 0; i < n; i++) {
      const x = i - 4; if (x < 0) continue;
      const v = (x < 22 ? -1.6 * (1 - x / 44) : 0.75 * Math.exp(-(x - 22) / 34) - 0.12 * Math.exp(-(x - 22) / 80));
      w[i * 3] = d[0] * v; w[i * 3 + 1] = d[1] * v; w[i * 3 + 2] = d[2] * v;
    }
    return (_tcp = { n, pre: 0, vcg: w, adds: null });
  }
  EP.Pacemaker = Pacemaker;
  EP.Pacemaker.DEF = PM_DEF;
  EP.Pacemaker.MODES = HAS;

  // ---------------------------------------------------------------------------------------------
  /* ICD: rate-zone detection on the ventricular channel, ATP, shock.
   * cfg: { vtRate, vfRate, nid (intervals to detect), atp (bursts before shock), atpPct, shock (bool), on } */
  class ICD {
    constructor(sim, cfg) {
      this.sim = sim; this.c = Object.assign({ vtRate: 170, vfRate: 220, nidVT: 12, nidVF: 9, atp: 2, atpPct: 0.85, atpN: 8, shock: true, on: true, vSite: 'rvApex', sens: 0.4, tOver: false, noise: 0, svtDisc: true }, cfg || {});
      this.iv = []; this.last = -1e7; this.state = 'monitor'; this.atpGiven = 0; this.log = []; this.vVox = M.nearest(Mo.SITES[this.c.vSite].p, 'any');
      sim.on('V0', (e) => {
        const lat = e.act && e.act.T[this.vVox] < Infinity ? Math.max(0, e.act.T[this.vVox]) : 30;
        sim.schedule(e.t + lat, (t) => this._sense(t, e));
        if (this.c.tOver) sim.schedule(e.t + 270, (t) => this._sense(t, null, 'T'));
      });
      sim.on('Vmode', (e) => { if (e.mode !== 'normal') this._fibTick(e.t); });
      if (this.c.noise) { const nz = (t) => { if (sim.rng() < this.c.noise) this._sense(t, null, 'noise'); sim.schedule(t + 90 + 120 * sim.rng(), nz); }; sim.schedule(sim.t + 500, nz); }
    }
    _fibTick(t) {
      // during VF / polymorphic VT the device sees rapid, irregular electrograms
      const s = this.sim;
      if (s.V.mode === 'normal') return;
      this._sense(t, null, 'VF');
      s.schedule(t + 170 + 60 * s.rng(), (tt) => this._fibTick(tt));
    }
    mark(t, text) { this.sim.emit({ t, type: 'mark', ch: 'V', text }); }
    _sense(t, e, src) {
      const c = this.c;
      if (!c.on || this.state === 'charging' || this.state === 'atp') { this.last = t; return; }
      const iv = t - this.last; this.last = t;
      if (iv < 120) return;
      const vtI = 60000 / c.vtRate, vfI = 60000 / c.vfRate;
      const zone = iv <= vfI ? 'F' : iv <= vtI ? 'T' : 'S';
      this.mark(t, zone === 'F' ? 'FS' : zone === 'T' ? 'TS' : 'VS');
      this.iv.push({ iv, zone, e, src }); if (this.iv.length > 18) this.iv.shift();
      const recent = this.iv.slice(-c.nidVF * 4 / 3 | 0), nF = recent.filter((x) => x.zone === 'F').length;
      const lastN = this.iv.slice(-c.nidVT), nT = lastN.filter((x) => x.zone !== 'S').length;
      if (nF >= c.nidVF) return this._detect(t, 'VF');
      if (lastN.length >= c.nidVT && nT >= c.nidVT) {
        // SVT discriminators: sudden onset, stability, morphology (here: was the rhythm conducted from above?)
        const supra = lastN.filter((x) => x.e && x.e.c && (x.e.c.type === 'hps' || x.e.c.type === 'ap')).length;
        if (c.svtDisc && supra > lastN.length * 0.7) { if (!this._withheld || t - this._withheld > 4000) { this.mark(t, 'SVT'); this.log.push({ t, what: 'Therapy withheld — discriminators classify the rhythm as supraventricular' }); this._withheld = t; } return; }
        return this._detect(t, 'VT');
      }
      if (zone === 'S' && this.iv.slice(-4).every((x) => x.zone === 'S')) { if (this.atpGiven) this.log.push({ t, what: 'Episode terminated' }); this.atpGiven = 0; }
    }
    _detect(t, kind) {
      const c = this.c, s = this.sim;
      this.iv.length = 0;
      this.mark(t, kind === 'VF' ? 'FD' : 'TD');
      if (kind === 'VT' && this.atpGiven < c.atp) {
        this.atpGiven++; this.state = 'atp';
        const cl = Math.max(200, (60000 / this._rate(s)) * c.atpPct - 10 * (this.atpGiven - 1));
        this.log.push({ t, what: `VT detected → ATP burst ${this.atpGiven} (${c.atpN} pulses at ${Math.round(cl)} ms)` });
        let captured = 0;
        for (let i = 0; i < c.atpN; i++) s.schedule(t + 60 + i * cl, (tt) => { const r = s.pace(tt, 'V', { site: c.vSite, kind: 'bipolar' }); this.mark(tt, 'TP'); if (r) captured++; if (i === c.atpN - 1) { this.state = 'monitor'; this._afterATP(tt, captured); } });
        return;
      }
      if (!c.shock) { this.log.push({ t, what: kind + ' detected — shock therapy is programmed off' }); return; }
      this.state = 'charging'; this.mark(t, 'CHG');
      this.log.push({ t, what: kind + ' detected → charging' });
      s.schedule(t + (kind === 'VF' ? 2600 : 2200), (tt) => {
        this.state = 'monitor';
        // reconfirm: abort if the arrhythmia stopped during charging
        const still = s.V.mode !== 'normal' || s.foci.some((f) => f.node === 'V' && f.reentrant && f.enabled && f.fired > 0 && tt - s.V.last < 600 && tt >= f.startAt) || this.c.tOver || this.c.noise;
        if (!still) { this.mark(tt, 'ABT'); this.log.push({ t: tt, what: 'Charge aborted — rhythm no longer meets criteria' }); return; }
        s.shock(tt, { j: 35 }); this.mark(tt, 'CD'); this.log.push({ t: tt, what: 'Shock delivered' }); this.atpGiven = 0;
      });
    }
    _rate(s) { const f = s.foci.find((x) => x.node === 'V' && x.reentrant && x.enabled); return f ? 60000 / f.cl : 180; }
    _afterATP(t, captured) {
      // Overdrive pacing that captures enters the circuit and collides with the tachycardia wave.
      const s = this.sim, f = s.foci.find((x) => x.node === 'V' && x.reentrant && x.enabled);
      if (!f) return;
      const p = f.atpSuccess == null ? 0.75 : f.atpSuccess;
      if (captured >= 3 && s.rng() < p) { f.enabled = false; this.log.push({ t, what: 'ATP terminated the tachycardia — no shock needed' }); }
      else if (f.accelerate && s.rng() < f.accelerate) { f.cl = Math.max(220, f.cl * 0.8); this.log.push({ t, what: 'ATP accelerated the tachycardia' }); }
    }
  }
  EP.ICD = ICD;

  // ---------------------------------------------------------------------------------------------
  /* Real-time runner. o: { sim, strips:[LiveStrip], speed, pulse (bool), onTick(t), noPulse(beat) } */
  class Live {
    constructor(o) {
      this.o = Object.assign({ speed: 1, fs: 250, lead: 140 }, o);
      this.sim = o.sim; this.t = this.sim.t; this.running = false; this._last = 0;
      const loop = (now) => { this._raf = requestAnimationFrame(loop); this._frame(now); };
      this._raf = requestAnimationFrame(loop);
    }
    start() { this.running = true; this._last = 0; return this; }
    stop() { this.running = false; return this; }
    destroy() { cancelAnimationFrame(this._raf); }
    setSim(sim) { this.sim = sim; this.t = sim.t; for (const s of this.o.strips) s.reset(); }
    _frame(now) {
      if (!this.running) { this._last = now; return; }
      const dt = Math.min(80, now - (this._last || now)); this._last = now;
      if (dt <= 0) return;
      this.advance(dt * this.o.speed);
    }
    /* Advance by ms of simulated time (also used directly by tests). */
    advance(ms) {
      const o = this.o, sim = this.sim, t0 = this.t, t1 = t0 + ms;
      sim.runUntil(t1 + o.lead);
      const rec = EP.Synth.build(sim, t0, t1, { fs: o.fs, noise: 0.008 });
      const extra = o.pulse ? { pulse: EP.Synth.pulse(sim, t0, t1, o.fs, { noPulse: o.noPulse }) } : null;
      for (const s of o.strips) { s.push(rec, extra); s.draw(); }
      this.t = t1;
      // drop old events so the log stays small
      if (sim.out.length > 600) { const cut = t1 - 9000; let k = 0; while (k < sim.out.length && sim.out[k].t < cut) k++; if (k) sim.out.splice(0, k); }
      if (o.onTick) o.onTick(t1, rec);
    }
  }
  EP.Live = Live;
})(globalThis.EP = globalThis.EP || {});
