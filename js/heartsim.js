/* EP Simulator — discrete-event conduction simulator.
 *
 * Nodes: A (atria), H (His / lower common pathway), V (ventricles).
 * Paths: fast + slow AV-nodal pathways (A↔H), His-Purkinje (H↔V), optional accessory pathway (A↔V).
 * Each path has a direction-specific delay and refractory period; impulses travelling in opposite
 * directions collide. Re-entry (AVNRT, AVRT), Wenckebach, concealed conduction, capture and fusion
 * beats, pacemaker-mediated tachycardia etc. are not scripted — they fall out of these rules.
 *
 * Output: sim.out — time-sorted events:
 *   { t, type:'P',   wave, site, kind, act }
 *   { t, type:'QRS', wave, spec, act, label, parts, rr }
 *   { t, type:'spike', ch:'A'|'V', captured, kind }
 *   { t, type:'mark', ch, text }            device marker channel
 *   { t, type:'cond', path, dir, t0, t1, ok, why }   ladder-diagram segments
 *   { t, type:'shock', j }
 * and sim.segs — continuous states: { type:'fib'|'flutter'|'vf'|'tdp'|'pmvt', t0, t1, ... }
 */
(function (EP) {
  'use strict';
  const Mo = EP.Morph, G = EP.G, M = EP.Model;
  const FW = 100;   // fusion window (ms): later contributions within this window join the same beat

  class PQ {
    constructor() { this.h = []; this.seq = 0; }
    get size() { return this.h.length; }
    peekT() { return this.h.length ? this.h[0].t : Infinity; }
    push(t, fn) {
      const h = this.h, e = { t, s: this.seq++, fn };
      let i = h.length; h.push(e);
      while (i > 0) { const p = (i - 1) >> 1; if (h[p].t < e.t || (h[p].t === e.t && h[p].s < e.s)) break; h[i] = h[p]; i = p; }
      h[i] = e; return e;
    }
    pop() {
      const h = this.h, top = h[0], e = h.pop();
      if (h.length) {
        let i = 0; const n = h.length;
        for (;;) {
          let c = 2 * i + 1; if (c >= n) break;
          if (c + 1 < n && (h[c + 1].t < h[c].t || (h[c + 1].t === h[c].t && h[c + 1].s < h[c].s))) c++;
          if (h[c].t > e.t || (h[c].t === e.t && h[c].s > e.s)) break;
          h[i] = h[c]; i = c;
        }
        h[i] = e;
      }
      return top;
    }
  }

  const DEF = {
    seed: 11,
    sinus: { on: true, cl: 850, sd: 0.012, resp: 0.025, site: 'sinus' },
    atria: { mode: 'normal', erp: 200, flutterCL: 205, flutterDir: 'ccw', fibMean: 150, fibSd: 45, fibAmp: 1, pAmp: 1 },
    avn: {
      fast: { min: 66, alpha: 220, tau: 95, erp: 300, erpExit: 0, conceal: 0.35, block: false, retro: { delay: 70, erp: 290, block: false } },
      slow: null,
    },
    hps: { hv: 45, pattern: 'normal', erp: 290, rbExtra: 0, ashman: 0, blockN: 0, blockProb: 0, block: false, retro: { delay: 60, erp: 280, block: false } },
    ap: null,     // { aSite, vSite, delay, erp, retro:{delay,erp,block}, block (no antegrade = concealed) }
    vent: { erp: 235, mods: null, slow: 1, mode: 'normal' },
    foci: [],
    script: [],
  };
  function merge(a, b) {
    if (b == null) return a;
    if (Array.isArray(b) || typeof b !== 'object' || typeof b === 'function') return b;
    const o = (a && typeof a === 'object' && !Array.isArray(a)) ? Object.assign({}, a) : {};
    for (const k in b) o[k] = merge(o[k], b[k]);
    return o;
  }

  // ---------------------------------------------------------------------------------------------
  class Path {
    constructor(sim, name, fwd, rev) {
      this.sim = sim; this.name = name; this.fwd = fwd; this.rev = rev;
      this.last = -1e7; this.lastExit = -1e7; this.transit = []; this.count = 0;
    }
    /* Try to launch an impulse. dir 'f' (toward ventricle) or 'r'. Returns impulse or null. */
    enter(dir, t, onArrive) {
      const p = dir === 'f' ? this.fwd : this.rev, sim = this.sim;
      const log = (ok, why, t1) => sim.emit({ t, type: 'cond', path: this.name, dir, t0: t, t1: t1 == null ? t : t1, ok, why });
      if (!p) return null;
      const blocked = typeof p.block === 'function' ? p.block(t, this) : p.block;
      if (blocked) { log(false, 'block'); return null; }
      for (const imp of this.transit) {
        if (imp.dead || imp.tout <= t) continue;
        if (imp.dir !== dir) { imp.dead = true; this.last = t; log(false, 'collision'); sim.emit({ t, type: 'cond', path: this.name, dir: imp.dir, t0: imp.tin, t1: t, ok: false, why: 'collision' }); return null; }
        log(false, 'refractory'); return null;
      }
      const rec = t - this.last, recX = t - this.lastExit;
      const erp = typeof p.erp === 'function' ? p.erp(t, this) : p.erp;
      const erpX = typeof p.erpExit === 'function' ? p.erpExit() : (p.erpExit || 0);
      if (rec < erp || (erpX && recX < erpX)) {
        const cc = typeof p.conceal === 'function' ? p.conceal() : (p.conceal || 0);
        if (cc) this.last += cc * Math.max(0, rec);                    // concealed penetration resets recovery
        log(false, 'refractory'); return null;
      }
      if (p.gate && !p.gate(t, this, rec)) { this.last = t; log(false, 'block'); return null; }
      const d = typeof p.delay === 'function' ? p.delay(Math.max(0, recX), rec, this) : p.delay;
      const imp = { dir, tin: t, tout: t + d, dead: false, rec };
      this.transit.push(imp); if (this.transit.length > 6) this.transit.shift();
      this.last = t; this.count++;
      sim.schedule(t + d, (tt) => {
        if (imp.dead) return;
        this.lastExit = tt;
        log2(sim, this.name, dir, imp.tin, tt);
        onArrive(tt, imp);
      });
      return imp;
    }
    kill(t) { for (const imp of this.transit) imp.dead = true; this.last = t; this.lastExit = t; }
  }
  function log2(sim, name, dir, t0, t1) { sim.emit({ t: t0, type: 'cond', path: name, dir, t0, t1, ok: true }); }

  // ---------------------------------------------------------------------------------------------
  class Sim {
    constructor(cfg) {
      Mo.init();
      this.cfg = merge(merge({}, DEF), cfg || {});
      const c = this.cfg;
      this.t = 0; this.q = new PQ(); this.rng = EP.rng(c.seed);
      this.out = []; this.segs = []; this.listeners = {};
      this.A = { last: -1e7, mode: 'normal' };
      this.H = { last: -1e7, erp: 150 };
      this.V = { last: -1e7, prev: -2e7, mode: 'normal', pending: null, erp: c.vent.erp };
      this.vcount = 0; this.acount = 0;
      this._buildPaths();
      this.foci = [];
      if (c.sinus && c.sinus.on) this.sinus = this.addFocus({ id: 'sinus', node: 'A', kind: 'auto', cl: c.sinus.cl, sd: c.sinus.sd, resp: c.sinus.resp, site: c.sinus.site, startAt: c.sinus.startAt == null ? 120 : c.sinus.startAt, label: 'sinus' });
      for (const f of c.foci) this.addFocus(f);
      if (c.atria.mode !== 'normal') this.setAtrialMode(c.atria.mode, 0);
      if (c.vent.mode && c.vent.mode !== 'normal') this.setVentMode(c.vent.mode, 0);
      for (const s of c.script) this.schedule(s.t, (t) => s.do(this, t));
    }

    // ---- infrastructure ----
    schedule(t, fn) { return this.q.push(Math.max(t, this.t), fn); }
    runUntil(T) {
      while (this.q.size && this.q.peekT() <= T) { const e = this.q.pop(); this.t = e.t; e.fn(e.t); }
      this.t = T; return this;
    }
    emit(ev) {
      const o = this.out; let i = o.length;
      o.push(ev);
      while (i > 0 && o[i - 1].t > ev.t) { o[i] = o[i - 1]; i--; }
      o[i] = ev; return ev;
    }
    on(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    fire(type, data) { const l = this.listeners[type]; if (l) for (const fn of l) fn(data); }

    _buildPaths() {
      const c = this.cfg, P = (this.paths = {});
      const mk = (name) => {
        const q = () => this.cfg.avn[name];
        return new Path(this, name,
          { delay: (recX) => { const o = q(); return o.min + (o.alpha || 0) * Math.exp(-recX / (o.tau || 100)); },
            erp: () => q().erp, erpExit: () => q().erpExit || 0, conceal: () => (q().conceal == null ? 0.35 : q().conceal),
            block: () => !q() || q().block || this.avBlockUntil > this.t },
          { delay: () => q().retro.delay, erp: () => q().retro.erp, block: () => !q() || !q().retro || q().retro.block || this.avBlockUntil > this.t });
      };
      this.avBlockUntil = -1;
      if (c.avn.fast) P.fast = mk('fast');
      if (c.avn.slow) P.slow = mk('slow');
      const h = c.hps;
      P.hps = new Path(this, 'hps',
        { delay: () => this.cfg.hps.hv,
          // His-Purkinje refractoriness shortens at short cycle lengths
          erp: () => { const cyc = EP.clamp(this.V.last - this.V.prev, 250, 850); return Math.max(175, this.cfg.hps.erp - 0.19 * (850 - cyc)); },
          block: () => this.cfg.hps.block === true || this.cfg.hps.block === 'ante',
          gate: (t, path) => {
            const q = this.cfg.hps;
            path.n2 = (path.n2 || 0) + 1;
            if (q.blockN && path.n2 % q.blockN === 0) return false;
            if (q.blockProb && this.rng() < q.blockProb) return false;
            return true;
          } },
        h.retro ? { delay: () => this.cfg.hps.retro.delay, erp: () => this.cfg.hps.retro.erp, block: () => this.cfg.hps.block === true || this.cfg.hps.retro.block } : null);
      if (c.ap) {
        const a = c.ap;
        P.ap = new Path(this, 'ap',
          { delay: () => this.cfg.ap.delay || 25, erp: () => this.cfg.ap.erp || 270, block: () => !!this.cfg.ap.block },
          { delay: () => (this.cfg.ap.retro && this.cfg.ap.retro.delay) || this.cfg.ap.delay || 25, erp: () => (this.cfg.ap.retro && this.cfg.ap.retro.erp) || this.cfg.ap.erp || 270, block: () => !!(this.cfg.ap.retro && this.cfg.ap.retro.block) });
        this.apVox = M.nearest((Mo.SITES[a.vSite] || { p: a.vSite }).p, 'any');
        this.apSpec = Mo.siteSpec({ p: M.pos(this.apVox), kind: 'any' });
      }
      const E = G.LM.exits;
      this.exitVox = [M.nearest(E.rvSeptal, 'purkRV'), M.nearest(E.lvSeptal, 'purkLV')];
    }

    // ---- atrial geometry helpers ----
    _latA(act, site) {
      this._av = this._av || {};
      let v = this._av[site];
      if (v == null) v = this._av[site] = M.nearestAtrial((Mo.ASITES[site] || { p: site }).p);
      const t = act.T[v];
      return t < Infinity ? Math.max(0, t - act.tmin) : 60;
    }

    // ---- atria ----
    /* o: { site, kind, via, focus } */
    activateA(t, o) {
      const A = this.A, c = this.cfg;
      if (A.mode !== 'normal') return false;
      if (t - A.last < c.atria.erp) { this.emit({ t, type: 'cond', path: 'atrium', dir: o.kind === 'retro' ? 'r' : 'f', t0: t, t1: t, ok: false, why: 'refractory' }); return false; }
      A.last = t; this.acount++;
      const asp = Mo.aspec(o.site, c.atria.speed);
      const wave = Mo.pwave(asp, { amp: c.atria.pAmp, prDep: c.atria.prDep });
      const act = wave.act;
      this.emit({ t, type: 'P', wave, site: o.site, kind: o.kind || 'sinus', act });
      this._atrialOut(t, (s) => this._latA(act, s), o.via);
      for (const f of this.foci) if (f.node === 'A' && f !== o.focus) f.onDep(t + this._latA(act, f.site), o);
      this.fire('A', { t, site: o.site, kind: o.kind || 'sinus', act, lat: (s) => this._latA(act, s) });
      return true;
    }
    _atrialOut(t, lat, via) {
      const P = this.paths;
      if (P.fast && via !== P.fast) { const te = t + lat('avn'); this.schedule(te, () => P.fast.enter('f', te, (tt) => this.activateH(tt, P.fast))); }
      if (P.slow && via !== P.slow) { const te = t + lat('csOs'); this.schedule(te, () => P.slow.enter('f', te, (tt) => this.activateH(tt, P.slow))); }
      if (P.ap && via !== P.ap) {
        const te = t + lat(this.cfg.ap.aSite);
        this.schedule(te, () => P.ap.enter('f', te, (tt) => this.contribV(tt, { type: 'ap', spec: this.apSpec, via: P.ap, label: 'pre-excited' })));
      }
    }
    /* Flutter / fibrillation: the atria are driven by a circuit or wavelets rather than discrete beats. */
    setAtrialMode(mode, t) {
      t = t == null ? this.t : t;
      const A = this.A, a = this.cfg.atria;
      if (this.aseg) { this.aseg.t1 = t; this.aseg = null; }
      A.mode = mode; A.gen = (A.gen || 0) + 1;
      const gen = A.gen;
      if (mode === 'normal') { A.last = t; if (this.sinus) this.sinus.arm(t + (a.recovery || 1150)); return; }
      const seg = (this.aseg = { type: mode === 'flutter' ? 'flutter' : 'fib', t0: t, t1: Infinity, cl: a.flutterCL, dir: a.flutterDir, amp: a.fibAmp, seed: Math.floor(this.rng() * 1e6) });
      this.segs.push(seg);
      const tick = (tt) => {
        if (A.gen !== gen) return;
        A.last = tt; this.acount++;
        this.emit({ t: tt, type: 'adrive', mode });
        const lat = mode === 'flutter' ? ((s) => (s === 'avn' || s === 'csOs' ? 20 : 70)) : (() => 0);
        this._atrialOut(tt, lat, null);
        this.fire('A', { t: tt, drive: mode, lat });
        const next = mode === 'flutter' ? this.cfg.atria.flutterCL : Math.max(85, this.cfg.atria.fibMean + this.cfg.atria.fibSd * this.rng.gauss());
        this.schedule(tt + next, tick);
      };
      this.schedule(t + 10, tick);
    }

    // ---- His ----
    activateH(t, via, o) {
      const H = this.H, P = this.paths;
      if (t - H.last < H.erp) return false;
      H.last = t;
      if (via !== P.hps) P.hps.enter('f', t, (tt, imp) => this.contribV(tt, { type: 'hps', spec: this._conductedSpec(imp), via: P.hps, label: (o && o.label) || 'conducted', junctional: !!(o && o.junctional) }));
      if (P.fast && via !== P.fast) P.fast.enter('r', t, (tt) => this.activateA(tt, { site: 'avn', via: P.fast, kind: 'retro' }));
      if (P.slow && via !== P.slow) P.slow.enter('r', t, (tt) => this.activateA(tt, { site: 'csOs', via: P.slow, kind: 'retro' }));
      for (const f of this.foci) if (f.node === 'H' && !(o && o.focus === f)) f.onDep(t, o || {});
      this.fire('H', { t });
      return true;
    }
    _conductedSpec(imp) {
      const h = this.cfg.hps;
      let pat = h.pattern || 'normal';
      if (pat === 'normal' && (h.rbExtra || h.ashman)) {
        const prev = this.V.last - this.V.prev;
        const win = (h.rbExtra || 0) + (h.ashman || 0) * EP.clamp(prev - 650, 0, 700);
        if (imp.rec < h.erp + win) pat = 'rbbb';
      }
      return Mo.spec(pat);
    }

    // ---- ventricles ----
    /* c: { type:'hps'|'ap'|'focus'|'pace', spec, via, label, focus } → true | 'fusion' | false */
    contribV(t, c) {
      const V = this.V, cfg = this.cfg;
      if (V.mode !== 'normal') return false;
      let spec = c.spec;
      if (cfg.vent.slow && cfg.vent.slow !== 1 && !spec.vm) spec = Object.assign({}, spec, { vm: M.VM / cfg.vent.slow, vp: M.VP / cfg.vent.slow });
      if (cfg.vent.scar && !spec.scar) spec = Object.assign({}, spec, { scar: cfg.vent.scar });
      const pend = V.pending;
      if (pend && t <= pend.t0 + FW) {
        const rel = t - pend.t0, a = Mo.vent(spec);
        let cap = false;
        for (const s of a.seeds) if (pend.act0.T[s.v] > rel + s.t + 1.5) { cap = true; break; }
        pend.parts.push({ spec, t: rel, c, cap });
        return cap ? 'fusion' : false;
      }
      if (t - V.last < V.erp) return false;
      const rr = t - V.last;
      V.prev = V.last; V.last = t; this.vcount++;
      V.erp = EP.clamp(cfg.vent.erp + 0.11 * (Math.min(rr, 1400) - 800), 185, 330);
      const act0 = Mo.vent(spec);
      const p = (V.pending = { t0: t, rr, parts: [{ spec, t: 0, c, cap: true }], act0 });
      this._ventOut(t, act0, c.via);
      this.schedule(t + FW, () => this._finalizeV(p));
      for (const f of this.foci) if (f.node === 'V' && f !== c.focus) f.onDep(t, c);
      this.fire('V0', { t, act: act0, c, rr });
      return true;
    }
    _ventOut(t, act, via) {
      const P = this.paths;
      if (via !== P.hps && P.hps.rev) {
        const te = t + Math.max(0, Math.min(act.T[this.exitVox[0]], act.T[this.exitVox[1]]));
        this.schedule(te, () => P.hps.enter('r', te, (tt) => this.activateH(tt, P.hps, { retro: true })));
      }
      if (P.ap && via !== P.ap) {
        const te = t + Math.max(0, act.T[this.apVox]);
        this.schedule(te, () => P.ap.enter('r', te, (tt) => this.activateA(tt, { site: this.cfg.ap.aSite, via: P.ap, kind: 'ap' })));
      }
    }
    _finalizeV(p) {
      const V = this.V;
      const parts = p.parts.filter((q) => q.cap);
      const spec = parts.length > 1 ? Mo.fuse(parts.map((q) => ({ spec: q.spec, t: Math.round(q.t / 2) * 2 }))) : parts[0].spec;
      const wave = Mo.vbeat(spec, { rr: p.rr, mods: this.cfg.vent.mods });
      const types = parts.map((q) => q.c.type);
      let label = parts[0].c.label || parts[0].c.type;
      if (parts.length > 1) label = types.includes('ap') && types.includes('hps') && parts.length === 2 ? 'pre-excited' : 'fusion';
      const ev = this.emit({ t: p.t0, type: 'QRS', wave, spec, act: wave.act, label, parts: p.parts, rr: p.rr, junctional: parts[0].c.junctional });
      if (V.pending === p) V.pending = null;
      this.fire('V', ev);
    }
    setVentMode(mode, t, o) {
      t = t == null ? this.t : t;
      const V = this.V;
      if (this.vseg) { this.vseg.t1 = t; this.vseg = null; }
      V.mode = mode; V.pending = null;
      if (mode === 'normal') { V.last = t; return; }
      this.vseg = Object.assign({ type: mode, t0: t, t1: Infinity, seed: Math.floor(this.rng() * 1e6) }, o || {});
      this.segs.push(this.vseg);
      this.fire('Vmode', { t, mode });
    }

    // ---- foci ----
    addFocus(o) { const f = new Focus(this, o); this.foci.push(f); return f; }
    focus(id) { return this.foci.find((f) => f.id === id); }

    // ---- interventions ----
    /* Pacing stimulus. ch 'A' | 'V'; o: { site, captured (output ≥ threshold), spec, kind } */
    pace(t, ch, o) {
      o = o || {};
      let res = false;
      if (o.captured !== false) {
        if (ch === 'A') res = this.activateA(t, { site: o.site || 'raa', kind: 'paced' });
        else res = this.contribV(t, { type: 'pace', spec: o.spec || Mo.spec(o.site || 'rvApex'), label: 'paced' });
      }
      this.emit({ t, type: 'spike', ch, captured: !!res, fusion: res === 'fusion', kind: o.kind || 'bipolar', site: o.site });
      return res;
    }
    /* DC shock: every excitable cell is depolarised at once — all re-entry stops. */
    shock(t, o) {
      t = t == null ? this.t : t; o = o || {};
      this.emit({ t, type: 'shock', j: o.j || 200, sync: !!o.sync });
      for (const k in this.paths) this.paths[k].kill(t);
      if (this.A.mode !== 'normal' && o.atrial !== false) this.setAtrialMode('normal', t);
      else { this.A.last = t; if (this.sinus) this.sinus.arm(t + 1100); }
      if (this.V.mode !== 'normal') this.setVentMode('normal', t);
      this.V.last = t; this.V.pending = null; this.H.last = t;
      for (const f of this.foci) { if (f.reentrant) f.enabled = false; else if (f !== this.sinus) f.onDep(t + 300, { shock: true }); }
      this.fire('shock', { t });
    }
    /* Transient AV-nodal block (adenosine / strong vagal effect). */
    blockAVN(t, dur) { this.avBlockUntil = t + dur; }
  }

  // ---------------------------------------------------------------------------------------------
  /* Automatic or coupled focus.
   * { id, node:'A'|'H'|'V', kind:'auto'|'coupled', cl, sd, site, coupling, every, repeat, startAt, stopAt,
   *   count (max beats), reset (default true), protect (parasystole), reentrant, label, after } */
  class Focus {
    constructor(sim, o) {
      Object.assign(this, { kind: 'auto', sd: 0, every: 1, repeat: 1, startAt: 0, stopAt: Infinity, count: Infinity, reset: true, enabled: true }, o);
      this.sim = sim; this.gen = 0; this.fired = 0; this.seen = 0;
      if (this.kind === 'auto') this.arm(this.startAt);
    }
    interval() {
      let cl = this.cl;
      const s = this.sim;
      if (this.resp) cl *= 1 + this.resp * Math.sin((2 * Math.PI * s.t) / 4200);
      if (this.sd) cl *= 1 + this.sd * s.rng.gauss();
      if (this.warm && this.fired < 4) cl *= 1 + this.warm * (4 - this.fired) / 4;
      return cl;
    }
    arm(t) {
      const gen = ++this.gen;
      this.next = t;
      this.sim.schedule(t, (tt) => { if (gen === this.gen) this.fire(tt); });
    }
    fire(t, isRepeat) {
      const s = this.sim;
      if (!this.enabled || t > this.stopAt || this.fired >= this.count) return;
      let ok;
      const site = this.sites ? this.sites[Math.floor(s.rng() * this.sites.length)] : this.site;
      if (this.node === 'A') ok = s.activateA(t, { site: site || 'sinus', kind: this.label === 'sinus' ? 'sinus' : (this.label || 'ectopic'), focus: this });
      else if (this.node === 'H') ok = s.activateH(t, null, { focus: this, label: this.label || 'junctional', junctional: true });
      else ok = s.contribV(t, { type: 'focus', spec: this.specs ? this.specs[this.fired % this.specs.length] : (this.spec || Mo.spec(this.site || 'rvApex')), label: this.label || 'PVC', focus: this });
      if (ok) this.fired++;
      if (this.kind === 'auto') this.arm(t + this.interval());
      else if (this.repeatLeft > 0) { this.repeatLeft--; this.arm(t + (this.cl || 400)); }
    }
    /* The focus's own tissue was depolarised by another impulse at time t. */
    onDep(t, src) {
      if (!this.enabled) return;
      if (this.kind === 'auto') {
        if (this.protect || this.reset === false) return;
        if (t < this.startAt) return;
        this.arm(t + this.interval() + (this.resetDelay || 0));
      } else if (this.kind === 'coupled') {
        if (src && src.shock) return;
        if (this.after && src && (src.type || src.kind) !== this.after) return;
        if (t < this.startAt || t > this.stopAt) return;
        if (++this.seen % this.every !== 0) return;
        this.repeatLeft = this.repeat - 1;
        const cp = Array.isArray(this.coupling) ? this.coupling[(this.nc = (this.nc || 0) + 1, this.nc - 1) % this.coupling.length] : this.coupling;
        this.arm(t + cp);
      }
    }
  }

  EP.HeartSim = Sim;
  EP.HeartSim.FW = FW;
  /* Run a configuration for `dur` ms and return its event log. */
  EP.simulate = function (cfg, dur) {
    const sim = new Sim(cfg);
    sim.runUntil(dur + 400);
    return sim;
  };
})(globalThis.EP = globalThis.EP || {});
