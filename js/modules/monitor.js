/* Bedside monitor: sweeping ECG, arterial line, pleth and optional PA/wedge traces drawn from a patient state.
   state: { hr, sbp, dbp, spo2, rr, temp, rhythm, escape, st, support, paradox, swan:{pas,pad,pcwp,vwave}, wedge } */
(function () {
  'use strict';
  const CL = window.CL;
  const G = CL.gauss;

  function Monitor(canvas) {
    this.canvas = canvas;
    this.state = { hr: 80, sbp: 120, dbp: 70, spo2: 97, rr: 16, temp: 37, rhythm: 'sinus' };
    this.beats = [];      // QRS times
    this.pwaves = [];     // P times (for dissociation)
    this.nextBeat = 0.3; this.nextP = 0.2;
    this.t = 0; this.sweep = 0;
    this.buf = null;
    this.rnd = CL.rng(42);
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  const P = Monitor.prototype;
  P.set = function (st) { this.state = Object.assign({}, this.state, st); };
  P.replace = function (st) { this.state = Object.assign({}, st); };

  P._rr = function () {
    const s = this.state;
    const hr = Math.max(20, s.hr || 60);
    let rr = 60 / hr;
    if (s.rhythm === 'af') rr *= 0.65 + this.rnd() * 0.7;
    return rr;
  };
  P._schedule = function (t) {
    const s = this.state;
    const none = s.rhythm === 'vf' || s.rhythm === 'asystole';
    while (this.nextBeat <= t + 0.05) {
      if (!none) this.beats.push(this.nextBeat);
      this.nextBeat += this._rr();
    }
    while (this.nextP <= t + 0.05) {
      if (s.rhythm === 'chb') this.pwaves.push(this.nextP);
      this.nextP += 60 / (s.atrialRate || 78);
    }
    this.beats = this.beats.filter((b) => b > t - 2.5);
    this.pwaves = this.pwaves.filter((b) => b > t - 2.5);
  };
  P._lastBeat = function (t) { let b = null; for (const x of this.beats) if (x <= t) b = x; return b; };
  P._prevBeat = function (t) { let b = null, c = null; for (const x of this.beats) if (x <= t) { c = b; b = x; } return c; };

  P.ecg = function (t) {
    const s = this.state;
    if (s.rhythm === 'vf') return 0.45 * Math.sin(t * 2 * Math.PI * 5.2 + Math.sin(t * 1.7) * 2) * (0.6 + 0.4 * Math.sin(t * 0.9)) + 0.15 * Math.sin(t * 17);
    if (s.rhythm === 'asystole') return 0.02 * Math.sin(t * 3);
    let v = 0;
    const wide = s.rhythm === 'vt' || s.rhythm === 'paced' || (s.rhythm === 'chb' && s.escape === 'wide');
    for (const b of this.beats) {
      const d = t - b;
      if (d < -0.25 || d > 0.7) continue;
      if (s.rhythm === 'sinus' || s.rhythm === 'pea') v += 0.12 * G(d, -0.15, 0.022);
      if (s.rhythm === 'paced') v += 1.6 * G(d, -0.02, 0.0025);
      if (wide) {
        const sc = s.rhythm === 'vt' ? 1.1 : 1;
        v += sc * (0.9 * G(d, 0.05, 0.03) - 0.55 * G(d, 0.13, 0.035) - 0.32 * G(d, 0.32, 0.06));
      } else {
        v += -0.08 * G(d, 0.0, 0.007) + 1.0 * G(d, 0.022, 0.009) - 0.22 * G(d, 0.045, 0.009);
        if (s.st) v += (s.st / 10) * CL.smooth(0.05, 0.07, d) * (1 - CL.smooth(0.24, 0.34, d));
        v += (s.twave != null ? s.twave : 0.28) * G(d, 0.28, 0.05);
      }
    }
    if (s.rhythm === 'chb') for (const p of this.pwaves) { const d = t - p; if (d > -0.1 && d < 0.1) v += 0.13 * G(d, 0, 0.022); }
    if (s.rhythm === 'af') v += 0.05 * Math.sin(t * 2 * Math.PI * 6.3 + Math.sin(t * 2.1) * 1.5) + 0.03 * Math.sin(t * 2 * Math.PI * 8.7);
    return v;
  };
  // normalized pulse contour, u = seconds since ejection start, rr = beat length
  function contour(u, rr) {
    if (u < 0) return 0;
    if (u < 0.09) return Math.sin(u / 0.09 * Math.PI / 2);
    if (u < 0.3) return 1 - 0.36 * Math.pow((u - 0.09) / 0.21, 1.2);
    if (u < 0.33) return 0.64 - 0.1 * ((u - 0.3) / 0.03);
    if (u < 0.4) return 0.54 + 0.06 * Math.sin((u - 0.33) / 0.07 * Math.PI);
    const k = Math.min(1, (u - 0.4) / Math.max(0.05, rr - 0.4));
    return 0.54 * Math.pow(1 - k, 1.25);
  }
  P.art = function (t) {
    const s = this.state;
    if (s.rhythm === 'vf' || s.rhythm === 'asystole' || s.rhythm === 'pea') return 16 + 2 * Math.sin(t * 1.3);
    const b = this._lastBeat(t - 0.11);
    const rr = 60 / Math.max(20, s.hr);
    let sys = s.sbp, dia = s.dbp;
    if (s.paradox) { const insp = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI / (60 / (s.rr || 18))); sys -= 18 * insp; }
    if (s.support === 'ecmo') return (dia + (sys - dia) * 0.5) + 2.5 * Math.sin(t * 2 * Math.PI / rr);
    if (s.support === 'impella') {
      const map = (sys + 2 * dia) / 3;
      const u = b == null ? 0 : t - 0.11 - b;
      return map - 5 + 10 * contour(u, rr);
    }
    if (b == null) return dia;
    const u = t - 0.11 - b;
    let p = dia + (sys - dia) * contour(u, rr);
    if (s.support === 'iabp') {
      const pp = sys - dia;
      if (u > 0.33 && u < rr - 0.03) {
        const k = (u - 0.33) / (rr - 0.36);
        p = dia + pp * (0.7 + 0.55 * Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - 0.55 * k)) - (k > 0.85 ? (k - 0.85) / 0.15 * (pp * 0.9) : 0);
      }
      if (u >= rr - 0.03 || u < 0.02) p = dia - 8;
    }
    return p;
  };
  P.pleth = function (t) {
    const s = this.state;
    if (s.rhythm === 'vf' || s.rhythm === 'asystole' || s.rhythm === 'pea') return 0.02;
    const b = this._lastBeat(t - 0.24);
    const rr = 60 / Math.max(20, s.hr);
    const amp = CL.clamp((s.sbp - s.dbp) / 45, 0.12, 1) * (s.support === 'impella' ? 0.35 : s.support === 'ecmo' ? 0.15 : 1);
    if (b == null) return 0;
    return amp * contour(t - 0.24 - b, rr);
  };
  P.pa = function (t) {
    const s = this.state, w = s.swan;
    if (!w) return 0;
    const b = this._lastBeat(t - 0.08);
    const rr = 60 / Math.max(20, s.hr);
    if (b == null) return w.pad;
    const u = t - 0.08 - b;
    if (s.wedge) {
      // wedge: a wave, c, x descent, v wave (giant in acute MR), y descent
      const base = w.pcwp - 3;
      return base + 4 * G(u, -0.05, 0.04) + (w.vwave || 6) * G(u, 0.38, 0.07) + 1.5 * Math.sin(t * 2 * Math.PI / (60 / (s.rr || 18)));
    }
    return w.pad + (w.pas - w.pad) * contour(u, rr);
  };

  P._loop = function (now) {
    const c = this.canvas;
    if (!c.isConnected && this._wasConnected) return; // canvas discarded: stop the loop
    requestAnimationFrame(this._loop);
    if (c.isConnected) this._wasConnected = true;
    if (!c.isConnected || c.offsetParent === null) { this._last = null; return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round((c.clientWidth || 600) * dpr), H = Math.round((c.clientHeight || 300) * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; this.buf = null; }
    const dt = this._last == null ? 0.016 : Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    this.t += dt;
    this._schedule(this.t);
    const g = c.getContext('2d');
    const numW = Math.min(230 * dpr, W * 0.36);
    const plotW = Math.max(50, W - numW - 10 * dpr);
    const traces = this.state.swan ? 4 : 3;
    if (!this.buf || this.buf.w !== Math.floor(plotW)) {
      this.buf = { w: Math.floor(plotW), data: Array.from({ length: 4 }, () => new Float32Array(Math.floor(plotW)).fill(NaN)), x: 0 };
    }
    const secs = 5;                        // seconds per sweep
    const pxPerSec = this.buf.w / secs;
    const steps = Math.max(1, Math.round(dt * pxPerSec));
    for (let k = 0; k < steps; k++) {
      const tt = this.t - dt + (k + 1) / steps * dt;
      const x = this.buf.x;
      this.buf.data[0][x] = this.ecg(tt);
      this.buf.data[1][x] = this.art(tt);
      this.buf.data[2][x] = this.pleth(tt);
      this.buf.data[3][x] = this.pa(tt);
      this.buf.x = (x + 1) % this.buf.w;
      for (let e = 1; e <= Math.round(10 * dpr); e++) { const z = (this.buf.x + e) % this.buf.w; for (let q = 0; q < 4; q++) this.buf.data[q][z] = NaN; }
    }
    // draw
    const s = this.state;
    const alarm = (s.rhythm === 'vf' || s.rhythm === 'pea' || s.rhythm === 'asystole' || s.rhythm === 'vt') || ((s.sbp + 2 * s.dbp) / 3 < 60) || s.spo2 < 88;
    g.fillStyle = '#04080a'; g.fillRect(0, 0, W, H);
    const rowH = (H - 8 * dpr) / traces;
    const colors = ['#4fe28a', '#ff5f5f', '#5fd7ff', '#ffd166'];
    const labels = ['II', 'ART', 'SpO₂', s.wedge ? 'PCWP' : 'PA'];
    for (let q = 0; q < traces; q++) {
      const top = 4 * dpr + q * rowH, bot = top + rowH;
      let lo, hi;
      if (q === 0) { lo = -0.8; hi = 1.4; }
      else if (q === 1) { lo = 0; hi = Math.max(140, (s.sbp || 100) + 30); if (s.support === 'iabp') hi += 30; }
      else if (q === 2) { lo = -0.05; hi = 1.1; }
      else { lo = 0; hi = s.wedge ? Math.max(50, (s.swan.pcwp || 20) + (s.swan.vwave || 10) + 10) : Math.max(60, (s.swan.pas || 40) + 15); }
      const Y = (v) => bot - 6 * dpr - (v - lo) / (hi - lo) * (rowH - 12 * dpr);
      g.strokeStyle = colors[q]; g.lineWidth = 1.6 * dpr; g.beginPath();
      let pen = false;
      const d = this.buf.data[q];
      for (let x = 0; x < this.buf.w; x++) {
        const v = d[x];
        if (Number.isNaN(v)) { pen = false; continue; }
        const yy = Y(v);
        if (!pen) { g.moveTo(x + 6 * dpr, yy); pen = true; } else g.lineTo(x + 6 * dpr, yy);
      }
      g.stroke();
      g.fillStyle = colors[q]; g.font = `${10 * dpr}px "IBM Plex Mono", monospace`;
      g.fillText(labels[q], 8 * dpr, top + 12 * dpr);
      if (q === 1) { g.fillStyle = '#7a5050'; g.fillText(Math.round(hi) + '', plotW - 22 * dpr, top + 12 * dpr); g.fillText('0', plotW - 12 * dpr, bot - 4 * dpr); }
    }
    // numerics
    const nx = W - numW + 6 * dpr;
    g.fillStyle = '#0b1417'; g.fillRect(W - numW, 0, numW, H);
    const map = Math.round((s.sbp + 2 * s.dbp) / 3);
    const dead = s.rhythm === 'vf' || s.rhythm === 'pea' || s.rhythm === 'asystole';
    const big = (txt, y, col, size) => { g.fillStyle = col; g.font = `600 ${size * dpr}px "IBM Plex Mono", monospace`; g.fillText(txt, nx, y); };
    const small = (txt, y, col) => { g.fillStyle = col; g.font = `${10 * dpr}px "IBM Plex Mono", monospace`; g.fillText(txt, nx, y); };
    const scale = Math.min(1, H / dpr / 300);
    let y = 18 * dpr;
    small('HR  ' + (s.rhythm || '').toUpperCase(), y, '#4fe28a'); y += 30 * dpr * scale;
    big(dead ? (s.rhythm === 'vf' ? 'VF' : '---') : String(Math.round(s.hr)), y, '#4fe28a', 28 * scale); y += 22 * dpr * scale;
    small('ABP  mmHg', y, '#ff7a7a'); y += 26 * dpr * scale;
    big(dead ? '--/--' : Math.round(s.sbp) + '/' + Math.round(s.dbp), y, '#ff7a7a', 22 * scale); y += 18 * dpr * scale;
    small(dead ? '(--)' : '(' + map + ')', y, '#ff7a7a'); y += 22 * dpr * scale;
    small('SpO₂ %   RR', y, '#5fd7ff'); y += 24 * dpr * scale;
    big((dead ? '--' : Math.round(s.spo2)) + '   ' + Math.round(s.rr || 0), y, '#5fd7ff', 20 * scale); y += 22 * dpr * scale;
    if (s.swan) { small(s.wedge ? 'PCWP (mean)' : 'PA mmHg', y, '#ffd166'); y += 20 * dpr * scale; big(s.wedge ? String(s.swan.pcwp) : s.swan.pas + '/' + s.swan.pad, y, '#ffd166', 16 * scale); y += 18 * dpr * scale; }
    const sup = s.support === 'iabp' ? 'IABP 1:1' : s.support === 'impella' ? 'IMPELLA ' + (s.supportLevel || 'P8') : s.support === 'ecmo' ? 'VA-ECMO ' + (s.supportLevel || '4.0 L/min') : s.support === 'pacer' ? 'TEMP PACER' : s.support === 'tcp' ? 'TRANSCUTANEOUS PACING' : '';
    if (sup) { g.fillStyle = '#ffb347'; g.font = `600 ${10 * dpr}px "IBM Plex Mono", monospace`; g.fillText(sup, nx, H - 10 * dpr); }
    if (alarm) {
      const on = Math.floor(now / 500) % 2 === 0;
      if (on) { g.strokeStyle = '#ff3b3b'; g.lineWidth = 3 * dpr; g.strokeRect(1.5 * dpr, 1.5 * dpr, W - 3 * dpr, H - 3 * dpr); }
    }
  };
  CL.Monitor = Monitor;
})();
