/*
 * ValvEcho — schematic "echo screen".
 * Draws a stylised 2D sector (with colour Doppler where relevant) and a spectral
 * Doppler strip from the entered measurements. These are illustrations of what the
 * entered numbers would look like, not real images.
 */
(function (root) {
  'use strict';

  const W2 = 420, H2 = 320, WD = 560, HD = 320, SCALE = 2;
  const AX = 210, AY = 6, R = 306, HALF = 48 * Math.PI / 180;
  const MONO = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const YELLOW = '#e9d66b', TEXT = '#c9d3da', DIM = '#7d8a93', GREEN = '#39d353';

  const num = (x) => { const n = typeof x === 'string' ? parseFloat(x) : x; return Number.isFinite(n) ? n : null; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function prep(canvas, w, h) {
    canvas.width = w * SCALE; canvas.height = h * SCALE;
    const c = canvas.getContext('2d');
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    return c;
  }
  function text(c, s, x, y, color, align) {
    c.save(); c.shadowBlur = 0; c.font = MONO; c.fillStyle = color || TEXT; c.textAlign = align || 'left'; c.fillText(s, x, y); c.restore();
  }

  // ---------------------------------------------------------------------------
  // 2D sector primitives
  // ---------------------------------------------------------------------------
  function sectorPath(c) {
    c.beginPath(); c.moveTo(AX, AY);
    c.arc(AX, AY, R, Math.PI / 2 - HALF, Math.PI / 2 + HALF); c.closePath();
  }
  function begin2D(c) {
    c.save(); sectorPath(c); c.clip();
    const g = c.createRadialGradient(AX, AY, 10, AX, AY, R);
    g.addColorStop(0, '#1c1c1c'); g.addColorStop(1, '#060606');
    c.fillStyle = g; c.fillRect(0, 0, W2, H2);
  }
  function tissue(c, width, bright) {
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = width;
    c.strokeStyle = 'rgba(206,206,198,' + (bright || 0.8) + ')';
    c.shadowColor = 'rgba(255,255,255,.45)'; c.shadowBlur = 5;
  }
  function stroke(c, fn) { c.beginPath(); fn(c); c.stroke(); }
  function blob(c, x, y, r) {
    c.save(); c.fillStyle = 'rgba(255,255,250,.95)'; c.shadowColor = '#fff'; c.shadowBlur = 9;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore();
  }
  function speckle(c, seed) {
    const r = rng(seed); c.shadowBlur = 0;
    for (let i = 0; i < 3200; i++) {
      const x = r() * W2, y = r() * H2;
      c.fillStyle = r() < 0.62 ? 'rgba(0,0,0,' + (0.12 + r() * 0.3) + ')' : 'rgba(255,255,255,' + (r() * 0.07) + ')';
      c.fillRect(x, y, 1.7, 1.2);
    }
  }
  function end2D(c, view, phase) {
    c.restore();
    c.save(); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; sectorPath(c); c.stroke();
    c.fillStyle = DIM;
    for (let i = 1; i * 17 < R; i++) c.fillRect(4, AY + i * 17, i % 5 === 0 ? 7 : 3, 1);
    c.restore();
    text(c, view, 14, 16, TEXT);
    text(c, phase, 14, H2 - 10, DIM);
    text(c, 'SCHEMATIC', W2 - 10, 16, DIM, 'right');
  }
  function chamber(c, s, x, y) { text(c, s, x, y, 'rgba(160,172,180,.55)', 'center'); }

  const AWAY = { core: '#ffe45c', mid: '#39c5ff', edge: '#1b3fd6', mosaic: ['#ffe45c', '#38e07b', '#ff5a3c', '#7ad7ff', '#1b3fd6'] };
  const TOWARD = { core: '#8fe0ff', mid: '#ffb02e', edge: '#d6301b', mosaic: ['#ffe45c', '#38e07b', '#39c5ff', '#ff5a3c'] };

  /** Flame-shaped turbulent colour jet. `ang` in canvas radians, `w0` width at the orifice. */
  function jet(c, ox, oy, ang, len, w0, spread, pal, seed) {
    if (!(len > 0)) return;
    const w1 = w0 / 2 + len * spread;
    c.save(); c.translate(ox, oy); c.rotate(ang);
    c.beginPath(); c.moveTo(0, -w0 / 2);
    c.bezierCurveTo(len * 0.3, -w0 / 2 - len * spread * 0.5, len * 0.72, -w1, len * 0.86, -w1 * 0.8);
    c.quadraticCurveTo(len * 1.08, 0, len * 0.86, w1 * 0.8);
    c.bezierCurveTo(len * 0.72, w1, len * 0.3, w0 / 2 + len * spread * 0.5, 0, w0 / 2);
    c.closePath();
    const g = c.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, pal.core); g.addColorStop(0.35, pal.mid); g.addColorStop(1, pal.edge);
    c.globalAlpha = 0.9; c.fillStyle = g; c.shadowColor = pal.mid; c.shadowBlur = 6; c.fill();
    c.clip(); c.shadowBlur = 0;
    const r = rng(seed), n = Math.round(len * w1 * 0.3);
    for (let i = 0; i < n; i++) {
      const x = len * Math.pow(r(), 1.6), y = (r() * 2 - 1) * w1;
      c.fillStyle = pal.mosaic[Math.floor(r() * pal.mosaic.length)];
      c.globalAlpha = 0.45 + r() * 0.45; c.fillRect(x, y, 2.4, 2.4);
    }
    c.restore();
  }
  /** Proximal flow convergence on the upstream side of the orifice. `dir` = canvas angle of the dome. */
  function pisa(c, x, y, r, dir) {
    if (!(r > 1)) return;
    c.save(); c.translate(x, y); c.rotate(dir - Math.PI * 1.5);
    c.globalAlpha = 0.55; c.fillStyle = '#2a5be0';
    c.beginPath(); c.arc(0, 0, r * 1.4, Math.PI, Math.PI * 2); c.closePath(); c.fill();
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.55, '#ffb02e'); g.addColorStop(1, '#e2351f');
    c.globalAlpha = 0.95; c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, Math.PI, Math.PI * 2); c.closePath(); c.fill();
    c.restore();
  }
  function colorBox(c, a0deg, a1deg, r0, r1) {
    const a0 = a0deg * Math.PI / 180, a1 = a1deg * Math.PI / 180;
    c.save(); c.shadowBlur = 0; c.strokeStyle = 'rgba(150,220,150,.7)'; c.lineWidth = 1; c.setLineDash([4, 3]);
    c.beginPath(); c.arc(AX, AY, r0, a0, a1); c.arc(AX, AY, r1, a1, a0, true); c.closePath(); c.stroke();
    c.restore();
  }
  function colorBar(c, nyq) {
    const x = 16, y = 30, h = 56;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ffe45c'); g.addColorStop(0.25, '#e2351f'); g.addColorStop(0.5, '#000');
    g.addColorStop(0.75, '#1b3fd6'); g.addColorStop(1, '#7ad7ff');
    c.save(); c.shadowBlur = 0; c.fillStyle = g; c.fillRect(x, y, 7, h);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.strokeRect(x, y, 7, h); c.restore();
    text(c, '+' + nyq, x + 11, y + 8, DIM); text(c, '-' + nyq, x + 11, y + h, DIM); text(c, 'cm/s', x + 11, y + h / 2 + 3, DIM);
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------
  /**
   * Parasternal long axis. o: { phase: 'sys'|'dia', av: {gap (0–1), thick, calc, flail},
   * ms: {gap px} | null, la (extra px), lvDil, wall, thrombus }
   */
  function plax(c, o) {
    const d = o.lvDil ? 10 : 0, la = o.la || 0, wt = o.wall || 14, mid = 133.5;
    c.save(); c.translate(0, 24);
    tissue(c, 6); stroke(c, (p) => { p.moveTo(105, 66); p.quadraticCurveTo(200, 44, 305, 54); });
    tissue(c, wt); stroke(c, (p) => { p.moveTo(72, 130 - d); p.quadraticCurveTo(150, 112 - d, 234, 108); });
    tissue(c, 4.5); stroke(c, (p) => { p.moveTo(236, 106); p.quadraticCurveTo(262, 92, 288, 100); p.lineTo(372, 92); });
    tissue(c, wt); stroke(c, (p) => { p.moveTo(64, 236 + d); p.quadraticCurveTo(150, 250 + d, 226, 242); });
    tissue(c, 3, 0.95); stroke(c, (p) => { p.moveTo(60, 244 + d + wt / 2); p.quadraticCurveTo(150, 259 + d + wt / 2, 228, 250 + wt / 2); });
    tissue(c, 4.5); stroke(c, (p) => { p.moveTo(240, 162); p.quadraticCurveTo(264, 174, 290, 160); p.lineTo(374, 150); });
    tissue(c, 4); stroke(c, (p) => { p.moveTo(228, 244); p.quadraticCurveTo(300, 268 + la * 1.4, 380, 222 + la); });

    // Aortic valve
    const av = o.av || {};
    if (o.phase === 'sys') {
      const gap = clamp(av.gap === undefined ? 0.85 : av.gap, 0.05, 0.9) * 46;
      tissue(c, av.thick || 2.2, 0.95);
      stroke(c, (p) => { p.moveTo(240, 107); p.quadraticCurveTo(258, 110, 268, mid - gap / 2); });
      stroke(c, (p) => { p.moveTo(240, 160); p.quadraticCurveTo(258, 157, 268, mid + gap / 2); });
      if (av.calc) { blob(c, 266, mid - gap / 2 - 1, av.thick * 0.75); blob(c, 266, mid + gap / 2 + 1, av.thick * 0.75); blob(c, 252, 111, av.thick * 0.5); }
    } else {
      tissue(c, av.thick || 2.2, 0.95);
      stroke(c, (p) => { p.moveTo(240, 107); p.quadraticCurveTo(251, 121, 247, mid); });
      if (av.flail) stroke(c, (p) => { p.moveTo(240, 160); p.quadraticCurveTo(246, 150, 225, 146); });
      else stroke(c, (p) => { p.moveTo(240, 160); p.quadraticCurveTo(251, 146, 247, mid); });
    }

    // Mitral valve
    if (o.phase === 'sys') {
      tissue(c, 2.6);
      stroke(c, (p) => { p.moveTo(240, 162); p.quadraticCurveTo(232, 190, 214, 204); });
      stroke(c, (p) => { p.moveTo(228, 242); p.quadraticCurveTo(226, 220, 214, 204); });
    } else if (o.ms) {
      const g = o.ms.gap;
      tissue(c, 3.6, 0.95);
      stroke(c, (p) => { p.moveTo(240, 162); p.quadraticCurveTo(198, 166, 209, 204 - g / 2); });
      stroke(c, (p) => { p.moveTo(228, 242); p.quadraticCurveTo(216, 232, 211, 204 + g / 2); });
      blob(c, 209, 204 - g / 2, 3.4); blob(c, 211, 204 + g / 2, 3.2);
    } else {
      tissue(c, 2.6);
      stroke(c, (p) => { p.moveTo(240, 162); p.quadraticCurveTo(222, 150, 198, 157); });
      stroke(c, (p) => { p.moveTo(228, 242); p.quadraticCurveTo(216, 228, 204, 214); });
    }
    if (o.thrombus) {
      c.save(); c.fillStyle = 'rgba(170,170,160,.75)'; c.shadowColor = '#fff'; c.shadowBlur = 4;
      c.beginPath(); c.ellipse(318, 226 + la * 0.9, 20, 10, -0.25, 0, Math.PI * 2); c.fill(); c.restore();
    }
    c.restore();
  }
  function plaxLabels(c, la) {
    chamber(c, 'RV', 200, 112); chamber(c, 'LV', 130, 214); chamber(c, 'Ao', 300, 160); chamber(c, 'LA', 290, 232 + (la || 0) * 0.5);
  }

  /**
   * Apical four-chamber, systolic frame. o: { la, ra, rv (extra px), mv: {flail, tent}, tv: {gap} }
   * Returns the coaptation points for placing jets.
   */
  function a4c(c, o) {
    const la = o.la || 0, ra = o.ra || 0, rv = o.rv || 0, mv = o.mv || {}, tv = o.tv || {};
    const tent = mv.tent || 0, tgap = tv.gap || 0;
    c.save(); c.translate(0, 14);
    tissue(c, 12); stroke(c, (p) => { p.moveTo(224, 40); p.quadraticCurveTo(300, 48, 312, 120); p.lineTo(310, 170); });
    tissue(c, 12); stroke(c, (p) => { p.moveTo(214, 46); p.lineTo(212, 168); });
    tissue(c, 10); stroke(c, (p) => { p.moveTo(204, 42); p.quadraticCurveTo(214, 30, 226, 40); });
    tissue(c, 6); stroke(c, (p) => { p.moveTo(204, 44); p.quadraticCurveTo(128 - rv, 56, 114 - rv, 120); p.lineTo(114 - rv, 174); });
    tissue(c, 2.5); stroke(c, (p) => { p.moveTo(212, 176); p.lineTo(213, 262); });
    tissue(c, 3.5); stroke(c, (p) => { p.moveTo(310, 174); p.quadraticCurveTo(338 + la, 218, 312 + la * 0.6, 266 + la * 0.4); p.quadraticCurveTo(262, 288 + la * 0.5, 214, 264); });
    tissue(c, 3.5); stroke(c, (p) => { p.moveTo(114 - rv, 178); p.quadraticCurveTo(84 - ra - rv, 222, 110 - ra * 0.6 - rv * 0.5, 268 + ra * 0.4); p.quadraticCurveTo(162, 290 + ra * 0.5, 212, 264); });

    const mC = { x: 262, y: 164 - tent }, tC = { x: 160 - rv / 2, y: 160 };
    tissue(c, 2.6);
    stroke(c, (p) => { p.moveTo(218, 172); p.quadraticCurveTo(240, 166 - tent, mC.x - 1, mC.y); });
    if (mv.flail) stroke(c, (p) => { p.moveTo(306, 172); p.quadraticCurveTo(288, 174, 273, 187); });
    else stroke(c, (p) => { p.moveTo(306, 172); p.quadraticCurveTo(284, 166 - tent, mC.x + 1, mC.y); });
    stroke(c, (p) => { p.moveTo(206, 166); p.quadraticCurveTo(186, 160, tC.x + tgap / 2, tC.y); });
    stroke(c, (p) => { p.moveTo(116 - rv, 176); p.quadraticCurveTo(136 - rv, 162, tC.x - tgap / 2, tC.y); });
    c.restore();
    return { m: { x: mC.x, y: mC.y + 14 + (mv.flail ? 3 : 0) }, t: { x: tC.x, y: tC.y + 14 } };
  }
  function a4cLabels(c, o) {
    chamber(c, 'LV', 264, 120); chamber(c, 'RV', 162 - (o.rv || 0) / 2, 120);
    chamber(c, 'LA', 268 + (o.la || 0) * 0.3, 268); chamber(c, 'RA', 152 - (o.ra || 0) * 0.3, 268);
  }

  // ---------------------------------------------------------------------------
  // Spectral Doppler
  // ---------------------------------------------------------------------------
  function timing(T) {
    const sys0 = 0.05, sysDur = clamp(0.36 * Math.sqrt(T), 0.2, 0.36);
    return { sys0: sys0, sysDur: sysDur, sysEnd: sys0 + sysDur, dia0: sys0 + sysDur + 0.07 };
  }
  function shape(x, peakPos, k) {
    if (x <= 0 || x >= 1) return 0;
    if (x < peakPos) return Math.pow(Math.sin(Math.PI / 2 * x / peakPos), 0.8);
    return Math.pow(Math.cos(Math.PI / 2 * (x - peakPos) / (1 - peakPos)), k || 1);
  }
  const gauss = (x, w) => Math.exp(-(x / w) * (x / w));
  function ecg(tb, T) {
    const q = tb > T / 2 ? tb - T : tb;
    return 13 * gauss(q, 0.009) - 3 * gauss(q + 0.022, 0.008) - 4 * gauss(q - 0.024, 0.009) +
      4.5 * gauss(tb - 0.3, 0.055) + 2.5 * gauss(tb - (T - 0.15), 0.03);
  }
  const fmt = (v, tick) => (tick < 1 ? v.toFixed(1) : String(Math.round(v)));

  /**
   * o: { x, y, w, h, up, down, tick, hr, title, traces: [{ fn(tb, T, tm) → signed m/s (+ = toward, above baseline),
   *      density, mode: 'cw' | 'pw' }] }. Returns coordinate helpers for annotations.
   */
  function spectral(c, o, seed) {
    const beats = 3, T = 60 / o.hr, total = beats * T, lead = 0.25 * T, tm = timing(T);
    const ecgH = 30, head = 18, plotH = o.h - ecgH - head, k = plotH / (o.up + o.down), base = o.y + head + o.up * k;
    const yOf = (v) => base - v * k;
    const r = rng(seed);
    c.save(); c.beginPath(); c.rect(o.x, o.y + head, o.w, o.h - head); c.clip();
    for (let px = 0; px < o.w; px += 0.5) {
      const t = px / o.w * total, tb = ((t - lead) % T + T) % T, x = o.x + px;
      o.traces.forEach(function (tr) {
        const v = tr.fn(tb, T, tm);
        if (Math.abs(v) < 0.03) return;
        const y1 = yOf(v), y0 = tr.mode === 'pw' ? yOf(v * 0.68) : base;
        c.fillStyle = 'rgba(226,226,214,' + (tr.density * (0.5 + 0.5 * r())).toFixed(3) + ')';
        c.fillRect(x, Math.min(y0, y1), 0.5, Math.abs(y1 - y0));
        c.fillStyle = 'rgba(245,245,235,' + Math.min(1, tr.density + 0.25).toFixed(3) + ')';
        c.fillRect(x, y1 - 0.6, 0.5, 1.4);
      });
    }
    c.fillStyle = '#000'; c.fillRect(o.x, base - 2, o.w, 4);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(o.x, base - 0.5, o.w, 1);
    // ECG
    c.strokeStyle = GREEN; c.lineWidth = 1.1; c.beginPath();
    const ey = o.y + head + plotH + ecgH * 0.62;
    for (let px = 0; px <= o.w; px += 1) {
      const tb = ((px / o.w * total - lead) % T + T) % T, y = ey - ecg(tb, T);
      if (px === 0) c.moveTo(o.x + px, y); else c.lineTo(o.x + px, y);
    }
    c.stroke();
    c.restore();
    // Velocity scale
    c.save(); c.fillStyle = DIM;
    for (let v = -Math.floor(o.down / o.tick) * o.tick; v <= o.up + 1e-6; v += o.tick) {
      const y = yOf(v);
      c.fillRect(o.x + o.w - 5, y - 0.5, 5, 1);
      if (Math.abs(v) > 1e-6) text(c, fmt(Math.abs(v), o.tick), o.x + o.w - 8, y + 3, DIM, 'right');
    }
    c.restore();
    text(c, 'm/s', o.x + o.w - 8, o.y + 10, DIM, 'right');
    text(c, o.title, o.x + 6, o.y + 12, TEXT);
    return { yOf: yOf, tm: tm, T: T, xAt: (beat, tb) => o.x + ((lead + beat * T + tb) / total) * o.w, x: o.x, y: o.y };
  }
  function caliper(c, x, y) {
    c.save(); c.strokeStyle = YELLOW; c.lineWidth = 1.2; c.shadowBlur = 0;
    c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.moveTo(x, y - 4); c.lineTo(x, y + 4); c.stroke(); c.restore();
  }
  function slopeLine(c, x0, y0, x1, y1) {
    c.save(); c.strokeStyle = YELLOW; c.lineWidth = 1.2; c.setLineDash([4, 3]);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore();
    caliper(c, x0, y0); caliper(c, x1, y1);
  }
  function readout(c, lines, x, y) {
    lines = lines.filter(Boolean);
    if (!lines.length) return;
    c.save(); c.font = MONO;
    const w = Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; }));
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(x - 4, y - 11, w + 8, lines.length * 13 + 4); c.restore();
    lines.forEach(function (l, i) { text(c, l, x, y + i * 13, YELLOW); });
  }

  // Waveform builders (return fn(tb, T, tm))
  function systolic(peak, peakPos, k, pre, post) {
    return function (tb, T, tm) {
      const t0 = tm.sys0 - (pre || 0), dur = tm.sysDur + (pre || 0) + (post || 0);
      return peak * shape((tb - t0) / dur, peakPos, k);
    };
  }
  function triangular(peak, pre, post) {
    return function (tb, T, tm) {
      const x = (tb - (tm.sys0 - pre)) / (tm.sysDur + pre + post);
      if (x <= 0 || x >= 1) return 0;
      return peak * (x < 0.2 ? Math.sin(Math.PI / 2 * x / 0.2) : 1 - (x - 0.2) / 0.8);
    };
  }
  function inflow(E, A, decT) {
    return function (tb, T, tm) {
      const td = tb - tm.dia0;
      const e = td <= 0 ? 0 : (td < 0.06 ? Math.sin(Math.PI / 2 * td / 0.06) : Math.max(0, 1 - (td - 0.06) / decT));
      return E * e + A * gauss(tb - (T - 0.09), 0.035);
    };
  }
  /** Linear pressure-half-time decay starting at td = 0: v falls to v0/√2 at PHT. */
  function phtDecay(v0, phtS, td, rise) {
    if (td <= 0) return 0;
    if (td < rise) return v0 * Math.sin(Math.PI / 2 * td / rise);
    return Math.max(0, v0 * (1 - 0.293 * (td - rise) / phtS));
  }
  function venous(S, D, aRev) {
    return function (tb, T, tm) {
      return S * shape((tb - tm.sys0 - 0.02) / tm.sysDur, 0.5, 1) + D * shape((tb - tm.dia0) / 0.3, 0.35, 1) +
        aRev * gauss(tb - (T - 0.07), 0.03);
    };
  }

  function dopplerLayout(hasSecond) {
    return hasSecond
      ? { main: { x: 8, y: 8, w: WD - 16, h: 190 }, second: { x: 8, y: 206, w: WD - 16, h: 106 } }
      : { main: { x: 8, y: 8, w: WD - 16, h: HD - 16 } };
  }
  const DENS = [0, 0.28, 0.52, 0.85, 0.9, 0.92];

  // ---------------------------------------------------------------------------
  // Lesion renderers
  // ---------------------------------------------------------------------------
  function drawAS(c2, cd, inp, res) {
    const g = res.grade, d = res.derived || {};
    const ava = d.ava, vEntered = num(inp.vmax), mg = num(inp.mg);
    let vmax = vEntered;
    if (vmax === null && mg !== null) vmax = Math.sqrt(mg / 0.6 / 4);
    if (vmax === null) vmax = ava !== null && ava !== undefined ? clamp(4.6 - ava * 1.4, 1.3, 5) : 1.3;
    const gVis = g !== null && g !== undefined ? g : (vmax >= 4 ? 3 : vmax >= 3 ? 2 : vmax >= 2.6 ? 1 : 0);
    const gapFrac = ava !== null && ava !== undefined ? clamp(ava / 3.5, 0.06, 0.9) : [0.85, 0.6, 0.4, 0.2, 0.12][gVis];
    const thick = [2.2, 3.4, 4.6, 6, 6.6][gVis];

    begin2D(c2);
    plax(c2, { phase: 'sys', av: { gap: gapFrac, thick: thick, calc: gVis >= 2 }, wall: gVis >= 3 ? 19 : 14 });
    speckle(c2, 11);
    if (vmax >= 2.6) {
      jet(c2, 268, 133.5 + 24, -0.06, clamp(26 + (vmax - 2.6) * 26, 26, 78), gapFrac * 46, 0.2, AWAY, 5);
      colorBox(c2, 43, 86, 112, 228);
    }
    plaxLabels(c2, 0);
    end2D(c2, 'PLAX', vmax >= 2.6 ? 'Systole · colour Doppler' : 'Systole');
    if (vmax >= 2.6) colorBar(c2, 60);

    const lvotV = num(inp.lvotV) || (d.dvi ? vmax * d.dvi : 1.0);
    const peakPos = clamp(0.2 + (vmax - 2) * 0.12, 0.2, 0.5);
    const down = Math.max(3, Math.ceil(vmax) + 1);
    const L = dopplerLayout(false).main;
    const s = spectral(cd, Object.assign({}, L, { up: 1, down: down, tick: 1, hr: 70, title: 'CW  aortic valve (apical)',
      traces: [
        { fn: (tb, T, tm) => -systolic(vmax, peakPos, 1)(tb, T, tm), density: 0.6, mode: 'cw' },
        { fn: (tb, T, tm) => -systolic(Math.min(lvotV, vmax * 0.9), 0.3, 1)(tb, T, tm), density: 0.95, mode: 'cw' },
      ] }), 21);
    caliper(cd, s.xAt(1, s.tm.sys0 + peakPos * s.tm.sysDur), s.yOf(-vmax));
    readout(cd, [
      'AV Vmax   ' + vmax.toFixed(1) + ' m/s' + (vEntered === null ? ' *' : ''),
      'Peak PG   ' + Math.round(4 * vmax * vmax) + ' mmHg' + (vEntered === null ? ' *' : ''),
      mg !== null && 'Mean PG   ' + mg + ' mmHg',
      ava !== null && ava !== undefined && 'AVA       ' + ava + ' cm²',
      d.dvi && 'DVI       ' + d.dvi,
    ], L.x + 6, L.y + 44);
    text(cd, vmax >= 4 ? 'Rounded, mid-peaking envelope' : vmax >= 3 ? 'Later-peaking envelope' : 'Early-peaking envelope', L.x + 6, L.y + L.h - 38, DIM);
    return vEntered === null;
  }

  function drawMS(c2, cd, inp, res) {
    const g = res.grade, mva = res.derived ? res.derived.mva : null;
    const stenotic = mva !== null && mva !== undefined && mva <= 2.5;
    const la = g >= 3 ? 22 : g === 2 ? 12 : 0;
    begin2D(c2);
    plax(c2, { phase: 'dia', av: { thick: 2.2 }, ms: stenotic ? { gap: clamp(mva * 9, 4, 30) } : null, la: la, thrombus: !!inp.laThrombus });
    speckle(c2, 12);
    if (stenotic) {
      jet(c2, 208, 204 + 24, Math.PI + 0.12, 58 + (g || 1) * 10, clamp(mva * 9, 4, 30), 0.17, TOWARD, 6);
      colorBox(c2, 76, 116, 150, 282);
    }
    plaxLabels(c2, la);
    end2D(c2, 'PLAX', stenotic ? 'Diastole · colour Doppler' : 'Diastole');
    if (stenotic) colorBar(c2, 60);

    const mg = num(inp.mg), hr = clamp(num(inp.hr) || 70, 40, 130);
    const phtIn = num(inp.pht);
    const pht = phtIn !== null ? phtIn : (stenotic ? 220 / mva : 60);
    const vp = mg !== null ? clamp(Math.sqrt(mg * 1.8 / 4), 0.8, 3.2) : (stenotic ? clamp(2.4 - mva * 0.5, 1, 2.4) : 0.9);
    const up = Math.max(2, Math.ceil((vp + 0.4) * 2) / 2);
    const L = dopplerLayout(false).main;
    const fn = function (tb, T, tm) {
      if (tb > T - 0.005) return 0;
      return phtDecay(vp, pht / 1000, tb - tm.dia0, 0.05) + (stenotic ? 0.35 : 0.7) * vp * gauss(tb - (T - 0.09), 0.035);
    };
    const s = spectral(cd, Object.assign({}, L, { up: up, down: 0.5, tick: 0.5, hr: hr, title: 'CW  mitral inflow (apical)',
      traces: [{ fn: fn, density: 0.75, mode: 'cw' }] }), 22);
    const tPeak = s.tm.dia0 + 0.05, tHalf = Math.min(pht / 1000, s.T - tPeak - 0.02);
    slopeLine(cd, s.xAt(1, tPeak), s.yOf(vp), s.xAt(1, tPeak + tHalf), s.yOf(vp * (1 - 0.293 * tHalf / (pht / 1000))));
    readout(cd, [
      mg !== null && 'MV mean PG  ' + mg + ' mmHg',
      'PHT         ' + Math.round(pht) + ' ms' + (phtIn === null ? ' *' : ''),
      mva !== null && mva !== undefined && 'MVA         ' + mva + ' cm²',
      'HR          ' + hr + ' bpm' + (num(inp.hr) === null ? ' *' : ''),
    ], L.x + 6, L.y + 34);
    return phtIn === null || mg === null;
  }

  function drawAR(c2, cd, inp, res) {
    const g = res.grade || 0;
    const ratio = num(inp.jetRatio), vc = num(inp.vc);
    const w0 = ratio !== null ? clamp(ratio / 100 * 54, 3, 52) : vc !== null ? clamp(vc * 27, 3, 40) : [0, 6, 18, 36][g];
    const len = [0, 45, 92, 150][g];
    const lvDil = inp.lv === 'dilated' || (g >= 3 && inp.lv !== 'normal');
    begin2D(c2);
    plax(c2, { phase: 'dia', av: { thick: 2.4, flail: inp.morph === 'flail' }, lvDil: lvDil });
    speckle(c2, 13);
    if (g > 0) {
      jet(c2, 246, 133.5 + 24, Math.PI - 0.12, len, w0, clamp(0.15 - w0 / 380, 0.03, 0.13), TOWARD, 7);
      colorBox(c2, 50, 118, 104, 238);
    }
    plaxLabels(c2, 0);
    end2D(c2, 'PLAX', g > 0 ? 'Diastole · colour Doppler' : 'Diastole');
    if (g > 0) colorBar(c2, 60);

    const second = inp.desc || inp.abd === 'holo';
    const L = dopplerLayout(!!second);
    const phtIn = num(inp.pht), pht = phtIn !== null ? phtIn : [600, 560, 350, 170][g];
    const dens = inp.cw === 'faint' ? 0.28 : inp.cw === 'dense' ? 0.55 : inp.cw === 'dense-steep' ? 0.85 : DENS[g];
    const v0 = 4.5;
    const arFn = function (tb, T, tm) {
      if (g === 0) return 0;
      let td = tb - (tm.sysEnd + 0.03);
      if (tb < 0.045) td = tb + T - (tm.sysEnd + 0.03);
      return phtDecay(v0, pht / 1000, td, 0.03);
    };
    const s = spectral(cd, Object.assign({}, L.main, { up: 6, down: 3, tick: 1, hr: 70, title: 'CW  aortic valve (apical 5-chamber)',
      traces: [
        { fn: arFn, density: dens, mode: 'cw' },
        { fn: (tb, T, tm) => -systolic(1.3 + 0.35 * g, 0.3, 1)(tb, T, tm), density: 0.8, mode: 'cw' },
      ] }), 23);
    if (g > 0) {
      const t0 = s.tm.sysEnd + 0.06, dt = Math.min(pht / 1000, s.T - t0 - 0.02);
      slopeLine(cd, s.xAt(1, t0), s.yOf(v0), s.xAt(1, t0 + dt), s.yOf(v0 * (1 - 0.293 * dt / (pht / 1000))));
    }
    readout(cd, [
      g > 0 && 'AR PHT     ' + Math.round(pht) + ' ms' + (phtIn === null ? ' *' : ''),
      vc !== null && 'VC         ' + vc + ' cm',
      ratio !== null && 'Jet/LVOT   ' + ratio + ' %',
      num(inp.eroa) !== null && 'EROA       ' + inp.eroa + ' cm²',
      num(inp.rvol) !== null && 'RVol       ' + inp.rvol + ' mL',
      g === 0 && 'No AR signal',
    ], L.main.x + 6, L.main.y + 34);
    if (second) {
      const kind = inp.abd === 'holo' && !inp.desc ? 'holo' : inp.desc;
      const rev = function (tb, T, tm) {
        const td = tb - tm.sysEnd - 0.02;
        if (td <= 0) return 0;
        if (kind === 'brief') return 0.3 * shape(td / 0.14, 0.4, 1);
        if (kind === 'intermediate') return 0.38 * shape(td / (T - tm.sysEnd - 0.02) / 0.6, 0.2, 1);
        return td < 0.05 ? 0.45 * td / 0.05 : Math.max(0.24, 0.45 - 0.35 * (td - 0.05));
      };
      spectral(cd, Object.assign({}, L.second, { up: 0.8, down: 1.6, tick: 0.4, hr: 70,
        title: 'PW  ' + (inp.abd === 'holo' && !inp.desc ? 'abdominal' : 'descending') + ' aorta — ' +
          (kind === 'holo' ? 'holodiastolic reversal' : kind === 'intermediate' ? 'intermediate reversal' : 'brief early reversal'),
        traces: [
          { fn: (tb, T, tm) => -systolic(1.2, 0.3, 1)(tb, T, tm), density: 0.8, mode: 'pw' },
          { fn: rev, density: 0.75, mode: 'pw' },
        ] }), 33);
    }
    return g > 0 && phtIn === null;
  }

  function atrioventricularRegurg(side, c2, cd, inp, res, extra) {
    const isM = side === 'M', g = res.grade || 0, p = extra && extra.pisa ? extra.pisa : {};
    const vc = num(inp.vc), eroa = num(inp.eroa);
    const sevDil = inp.chambers === 'dilated' || (g >= 3 && inp.chambers !== 'normal');
    const dil = sevDil ? 16 : inp.chambers === 'normal-dilated' ? 7 : 0;
    const gi = Math.min(g, 5);
    let len = [0, 34, 62, 96, 104, 108][gi], spread = [0, 0.16, 0.22, 0.3, 0.34, 0.36][gi];
    if (inp.jet === 'small' && g > 0) { len = Math.min(len, 34); spread = 0.14; }
    if (inp.jet === 'large') { len = Math.max(len, 98); spread = Math.max(spread, 0.3); }
    const w0 = g === 0 ? 0 : vc !== null ? clamp(vc * 17 * 1.2, 3, 34) : [0, 4, 8, 13, 22, 30][gi];
    const alias = num(p.alias) || (isM ? 40 : 28);
    let pr = num(p.r) !== null ? p.r * 17 * 1.2 : null;
    if (pr === null && isM && eroa !== null) pr = Math.sqrt(eroa * 500 / (2 * Math.PI * alias)) * 17 * 1.2;
    if (pr === null && !isM && num(inp.pisaR) !== null) pr = inp.pisaR * 17 * 1.2;
    if (pr === null && !isM && eroa !== null) pr = Math.sqrt(eroa * 280 / (2 * Math.PI * alias)) * 17 * 1.2;
    if (pr === null) pr = inp.flow === 'large' ? 14 : inp.flow === 'intermediate' ? 8 : [0, 0, 6, 12, 15, 18][gi];
    if (g === 0 || inp.flow === 'none') pr = 0;

    const geo = isM
      ? { la: dil, mv: { flail: inp.morph === 'flail', tent: inp.etiology === 'secondary' ? 10 : 0 } }
      : { ra: dil, rv: sevDil ? 12 : 0, tv: { gap: g >= 4 ? w0 * 0.8 : inp.morph === 'severe' ? 6 : 0 } };
    begin2D(c2);
    const pts = a4c(c2, geo);
    speckle(c2, isM ? 14 : 15);
    const o = isM ? pts.m : pts.t;
    if (g > 0) {
      pisa(c2, o.x, o.y - 1, clamp(pr, 0, 24), Math.PI * 1.5);
      jet(c2, o.x, o.y + 1, Math.PI / 2 + (isM ? 0.1 : -0.08), len, w0, spread, AWAY, isM ? 8 : 9);
      if (isM) colorBox(c2, 56, 93, 128, 300); else colorBox(c2, 87, 126, 128, 300);
    }
    a4cLabels(c2, geo);
    end2D(c2, isM ? 'A4C' : 'A4C (RV-focused)', g > 0 ? 'Systole · colour Doppler' : 'Systole');
    if (g > 0) colorBar(c2, alias);

    // Spectral
    const veinKey = isM ? inp.pv : inp.hv;
    const L = dopplerLayout(!!veinKey);
    const vEntered = num(p.vmax) !== null ? p.vmax / 100 : null;
    let peak = vEntered;
    if (peak === null && !isM && num(inp.pasp) !== null) peak = Math.sqrt(Math.max(inp.pasp - 8, 4) / 4);
    if (peak === null) peak = isM ? 5.2 : 2.7;
    if (!isM && g >= 4 && vEntered === null) peak = Math.min(peak, 2.2);
    const tri = inp.cw === 'triangular' || (inp.cw === undefined && (isM ? false : g >= 4));
    const dens = inp.cw === 'faint' ? 0.28 : inp.cw === 'dense' ? 0.6 : inp.cw === 'triangular' ? 0.88 : DENS[gi];
    const wave = tri ? triangular(peak, 0.03, 0.05) : systolic(peak, 0.45, 0.7, 0.03, 0.05);
    const E = inp.inflow === 'edom' ? (isM ? 1.5 : 1.1) : inp.inflow === 'adom' ? 0.6 : (isM ? 0.75 : 0.5) + 0.2 * Math.min(g, 3) * (isM ? 1 : 0.7);
    const A = inp.inflow === 'adom' ? E * 1.4 : inp.inflow === 'edom' ? E * 0.45 : E * 0.75;
    const down = Math.max(isM ? 6 : 3, Math.ceil(peak) + 1), up = isM ? 2 : 1.5;
    const s = spectral(cd, Object.assign({}, L.main, { up: up, down: down, tick: 1, hr: 70,
      title: 'CW  ' + (isM ? 'mitral' : 'tricuspid') + ' valve (apical)',
      traces: [
        { fn: (tb, T, tm) => (g === 0 ? 0 : -wave(tb, T, tm)), density: dens, mode: 'cw' },
        { fn: inflow(E, A, 0.2), density: 0.7, mode: 'cw' },
      ] }), isM ? 24 : 25);
    if (g > 0) caliper(cd, s.xAt(1, s.tm.sys0 - 0.03 + (tri ? 0.2 : 0.45) * (s.tm.sysDur + 0.08)), s.yOf(-peak));
    const tag = isM ? 'MR' : 'TR';
    readout(cd, [
      g > 0 && tag + ' Vmax   ' + peak.toFixed(1) + ' m/s' + (vEntered === null ? ' *' : ''),
      vc !== null && 'VC        ' + vc + ' cm',
      eroa !== null && 'EROA      ' + eroa + ' cm²',
      num(inp.rvol) !== null && 'RVol      ' + inp.rvol + ' mL',
      num(inp.rf) !== null && 'RF        ' + inp.rf + ' %',
      g === 0 && 'No ' + tag + ' signal',
    ], L.main.x + 6, L.main.y + 34);
    if (g > 0) text(cd, tri ? 'Dense, triangular, early-peaking jet' : dens >= 0.8 ? 'Dense holosystolic jet' : dens >= 0.5 ? 'Dense parabolic jet' : 'Faint, incomplete jet', L.main.x + 6, L.main.y + L.main.h - 38, DIM);

    if (veinKey) {
      // Pulmonary vein (apical): antegrade flow is toward the probe (above baseline).
      // Hepatic vein (subcostal): antegrade flow is away from the probe (below baseline).
      const sign = isM ? 1 : -1;
      const S = veinKey === 'sdom' ? 0.6 : veinKey === 'blunted' ? 0.2 : -0.35;
      const D = veinKey === 'sdom' ? 0.4 : veinKey === 'blunted' ? 0.6 : 0.7;
      const label = veinKey === 'sdom' ? 'systolic dominance' : veinKey === 'blunted' ? 'systolic blunting' : 'systolic flow reversal';
      spectral(cd, Object.assign({}, L.second, { up: isM ? 1 : 0.6, down: isM ? 0.6 : 1, tick: 0.4, hr: 70,
        title: 'PW  ' + (isM ? 'pulmonary vein' : 'hepatic vein') + ' — ' + label,
        traces: [{ fn: (tb, T, tm) => sign * venous(S, D, -0.18)(tb, T, tm), density: 0.8, mode: 'pw' }] }), isM ? 34 : 35);
    }
    return g > 0 && vEntered === null;
  }

  /**
   * Draw the echo screen for one lesion.
   * @returns {boolean} true when the drawing uses typical values for measurements not entered (marked *).
   */
  function draw(lesion, canvas2d, canvasDoppler, inputs, result, extra) {
    if (!canvas2d || !canvasDoppler || !canvas2d.getContext) return false;
    const c2 = prep(canvas2d, W2, H2), cd = prep(canvasDoppler, WD, HD);
    inputs = inputs || {}; result = result || {};
    if (lesion === 'AS') return drawAS(c2, cd, inputs, result);
    if (lesion === 'MS') return drawMS(c2, cd, inputs, result);
    if (lesion === 'AR') return drawAR(c2, cd, inputs, result);
    if (lesion === 'MR') return atrioventricularRegurg('M', c2, cd, inputs, result, extra);
    if (lesion === 'TR') return atrioventricularRegurg('T', c2, cd, inputs, result, extra);
    return false;
  }

  root.EchoScreen = { draw: draw, size: { w2: W2, h2: H2, wd: WD, hd: HD } };
})(typeof window !== 'undefined' ? window : globalThis);
