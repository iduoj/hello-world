/*
 * ValvEcho — schematic, animated "echo screen" with measuring tools.
 *
 * Draws a stylised 2D sector (with colour Doppler where relevant) that beats through the
 * cardiac cycle, plus a spectral Doppler strip, all derived from the entered measurements.
 * Calipers, velocity points, slopes and traces can be placed on the screen; the drawing is
 * built so that a careful measurement recovers the entered value.
 * These are illustrations of what the numbers would look like, not real images.
 */
(function (root) {
  'use strict';

  const W2 = 420, H2 = 320, WD = 560, HD = 320, SCALE = 2, BEATS = 2;
  const AX = 210, AY = 6, R = 306, HALF = 48 * Math.PI / 180;
  const MONO = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const YELLOW = '#e9d66b', TEXT = '#c9d3da', DIM = '#7d8a93', GREEN = '#39d353', CYAN = '#7fe3ff';

  const num = (x) => { const n = typeof x === 'string' ? parseFloat(x) : x; return Number.isFinite(n) ? n : null; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (x, w) => clamp(x / w, 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const gauss = (x, w) => Math.exp(-(x / w) * (x / w));
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
  function boxedText(c, s, x, y, color) {
    c.save(); c.font = MONO; const w = c.measureText(s).width;
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(x - 3, y - 10, w + 6, 14); c.restore();
    text(c, s, x, y, color);
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
  let speckleLayer = null;
  function speckle(c) {
    if (!speckleLayer) {
      speckleLayer = document.createElement('canvas');
      speckleLayer.width = W2 * SCALE; speckleLayer.height = H2 * SCALE;
      const s = speckleLayer.getContext('2d'); s.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      const r = rng(11);
      for (let i = 0; i < 3200; i++) {
        const x = r() * W2, y = r() * H2;
        s.fillStyle = r() < 0.62 ? 'rgba(0,0,0,' + (0.12 + r() * 0.3) + ')' : 'rgba(255,255,255,' + (r() * 0.07) + ')';
        s.fillRect(x, y, 1.7, 1.2);
      }
    }
    c.save(); c.shadowBlur = 0; c.drawImage(speckleLayer, 0, 0, W2, H2); c.restore();
  }
  function end2D(c, view, phase, pxPerCm) {
    c.restore();
    c.save(); c.shadowBlur = 0; c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1; sectorPath(c); c.stroke();
    c.fillStyle = DIM;
    for (let i = 1; i * pxPerCm < R; i++) c.fillRect(4, AY + i * pxPerCm, i % 5 === 0 ? 7 : 3, 1);
    c.restore();
    text(c, view, 14, 16, TEXT);
    text(c, phase, 14, H2 - 10, DIM);
    text(c, 'SCHEMATIC', W2 - 10, 16, DIM, 'right');
    text(c, 'ticks: 1 cm', W2 - 10, H2 - 10, DIM, 'right');
  }
  function chamber(c, s, x, y) { text(c, s, x, y, 'rgba(160,172,180,.55)', 'center'); }

  const AWAY = { core: '#ffe45c', mid: '#39c5ff', edge: '#1b3fd6', mosaic: ['#ffe45c', '#38e07b', '#ff5a3c', '#7ad7ff', '#1b3fd6'] };
  const TOWARD = { core: '#8fe0ff', mid: '#ffb02e', edge: '#d6301b', mosaic: ['#ffe45c', '#38e07b', '#39c5ff', '#ff5a3c'] };

  /** Flame-shaped turbulent colour jet. `ang` in canvas radians, `w0` width at the orifice. */
  function jet(c, ox, oy, ang, len, w0, spread, pal, seed, alpha) {
    if (!(len > 1)) return;
    const w1 = w0 / 2 + len * spread, a = alpha === undefined ? 1 : alpha;
    c.save(); c.translate(ox, oy); c.rotate(ang);
    c.beginPath(); c.moveTo(0, -w0 / 2);
    c.bezierCurveTo(len * 0.3, -w0 / 2 - len * spread * 0.5, len * 0.72, -w1, len * 0.86, -w1 * 0.8);
    c.quadraticCurveTo(len * 1.08, 0, len * 0.86, w1 * 0.8);
    c.bezierCurveTo(len * 0.72, w1, len * 0.3, w0 / 2 + len * spread * 0.5, 0, w0 / 2);
    c.closePath();
    const g = c.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, pal.core); g.addColorStop(0.35, pal.mid); g.addColorStop(1, pal.edge);
    c.globalAlpha = 0.9 * a; c.fillStyle = g; c.shadowColor = pal.mid; c.shadowBlur = 6; c.fill();
    c.clip(); c.shadowBlur = 0;
    const r = rng(seed), n = Math.round(len * w1 * 0.3);
    for (let i = 0; i < n; i++) {
      const x = len * Math.pow(r(), 1.6), y = (r() * 2 - 1) * w1;
      c.fillStyle = pal.mosaic[Math.floor(r() * pal.mosaic.length)];
      c.globalAlpha = (0.45 + r() * 0.45) * a; c.fillRect(x, y, 2.4, 2.4);
    }
    c.restore();
  }
  /** Proximal flow convergence on the upstream side of the orifice; `r` is the aliasing radius. */
  function pisa(c, x, y, r) {
    if (!(r > 1)) return;
    c.save(); c.translate(x, y);
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
  // Cardiac cycle
  // ---------------------------------------------------------------------------
  function timing(T, sysDur) {
    const sys0 = 0.05, d = sysDur || clamp(0.36 * Math.sqrt(T), 0.2, 0.36);
    return { sys0: sys0, sysDur: d, sysEnd: sys0 + d, dia0: sys0 + d + 0.07 };
  }
  function avOpenAt(tb, tm) {
    return smooth(ramp(tb - tm.sys0, 0.04)) * (1 - smooth(ramp(tb - (tm.sysEnd - 0.03), 0.04)));
  }
  function mvOpenAt(tb, T, tm) {
    if (tb < tm.dia0) return 0;
    const td = tb - tm.dia0;
    let o = smooth(ramp(td, 0.06));
    o *= 1 - 0.45 * smooth(ramp(td - 0.12, 0.15));
    o += 0.4 * gauss(tb - (T - 0.09), 0.04);
    o *= 1 - smooth(ramp(tb - (T - 0.03), 0.03));
    return clamp(o, 0, 1);
  }
  function contractAt(tb, T, tm) {
    if (tb < tm.sys0) return 0;
    if (tb < tm.sysEnd) return smooth((tb - tm.sys0) / tm.sysDur);
    return 1 - smooth(ramp(tb - tm.sysEnd, 0.22));
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------
  /**
   * Parasternal long axis. o: { k (contraction 0–1), avOpen, mvOpen (0–1),
   * av: {gap (0–1 of full opening), thick, calc, flail}, ms: {gap px} | null, la, lvDil, wall, thrombus }
   */
  function plax(c, o) {
    const d = o.lvDil ? 10 : 0, la = o.la || 0, k = o.k || 0, wt = (o.wall || 14) + 2.5 * k, mid = 133.5;
    const a = o.avOpen || 0, m = o.mvOpen || 0, av = o.av || {};
    c.save(); c.translate(0, 24);
    tissue(c, 6); stroke(c, (p) => { p.moveTo(105, 66 + k); p.quadraticCurveTo(200, 44 + k, 305, 54); });
    tissue(c, wt); stroke(c, (p) => { p.moveTo(72, 130 - d + 4 * k); p.quadraticCurveTo(150, 112 - d + 5 * k, 234, 108); });
    tissue(c, 4.5); stroke(c, (p) => { p.moveTo(236, 106); p.quadraticCurveTo(262, 92, 288, 100); p.lineTo(372, 92); });
    tissue(c, wt); stroke(c, (p) => { p.moveTo(64, 236 + d - 6 * k); p.quadraticCurveTo(150, 250 + d - 7 * k, 226, 242); });
    tissue(c, 3, 0.95); stroke(c, (p) => { p.moveTo(60, 251 + d); p.quadraticCurveTo(150, 266 + d, 228, 257); });
    tissue(c, 4.5); stroke(c, (p) => { p.moveTo(240, 162); p.quadraticCurveTo(264, 174, 290, 160); p.lineTo(374, 150); });
    tissue(c, 4); stroke(c, (p) => { p.moveTo(228, 244); p.quadraticCurveTo(300, 268 + la * 1.4 + 3 * k, 380, 222 + la); });

    // Aortic valve: cusps swing from the closure line into the root
    const gap = clamp(av.gap === undefined ? 0.85 : av.gap, 0.05, 0.9) * 46;
    const tipX = lerp(247, 268, a);
    tissue(c, av.thick || 2.2, 0.95);
    stroke(c, (p) => { p.moveTo(240, 107); p.quadraticCurveTo(lerp(251, 258, a), lerp(121, 110, a), tipX, lerp(mid, mid - gap / 2, a)); });
    if (av.flail && a < 0.5) stroke(c, (p) => { p.moveTo(240, 160); p.quadraticCurveTo(246, 150, lerp(225, 247, a * 2), lerp(146, mid, a * 2)); });
    else stroke(c, (p) => { p.moveTo(240, 160); p.quadraticCurveTo(lerp(251, 258, a), lerp(146, 157, a), tipX, lerp(mid, mid + gap / 2, a)); });
    if (av.calc) {
      blob(c, tipX - 2, lerp(mid - 2, mid - gap / 2 - 1, a), av.thick * 0.75);
      blob(c, tipX - 2, lerp(mid + 2, mid + gap / 2 + 1, a), av.thick * 0.75);
      blob(c, 251, 113, av.thick * 0.5);
    }

    // Mitral valve
    if (o.ms) {
      const g = o.ms.gap;
      const at = [lerp(214, 209, m), lerp(204, 204 - g / 2, m)], pt = [lerp(214, 211, m), lerp(204, 204 + g / 2, m)];
      tissue(c, 3.6, 0.95);
      stroke(c, (p) => { p.moveTo(240, 162); p.quadraticCurveTo(lerp(232, 198, m), lerp(190, 166, m), at[0], at[1]); });
      stroke(c, (p) => { p.moveTo(228, 242); p.quadraticCurveTo(lerp(226, 216, m), lerp(220, 232, m), pt[0], pt[1]); });
      blob(c, at[0], at[1], 3.4); blob(c, pt[0], pt[1], 3.2);
    } else {
      tissue(c, 2.6);
      stroke(c, (p) => { p.moveTo(240, 162); p.quadraticCurveTo(lerp(232, 222, m), lerp(190, 150, m), lerp(214, 198, m), lerp(204, 157, m)); });
      stroke(c, (p) => { p.moveTo(228, 242); p.quadraticCurveTo(lerp(226, 216, m), lerp(220, 228, m), lerp(214, 204, m), lerp(204, 214, m)); });
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
   * Apical four-chamber. o: { k, open (AV-valve opening 0–1), la, ra, rv, mv: {flail, tent}, tv: {gap} }
   * Returns the coaptation points for placing jets.
   */
  function a4c(c, o) {
    const la = (o.la || 0) + 3 * (o.k || 0), ra = (o.ra || 0) + 3 * (o.k || 0), rv = o.rv || 0, mv = o.mv || {}, tv = o.tv || {};
    const k = o.k || 0, m = o.open || 0, tent = mv.tent || 0, tgap = tv.gap || 0, ay = -5 * k;
    c.save(); c.translate(0, 14);
    tissue(c, 12 + 2 * k); stroke(c, (p) => { p.moveTo(224, 40); p.quadraticCurveTo(300 - 5 * k, 48, 312 - 8 * k, 120); p.lineTo(310 - 6 * k, 170 + ay); });
    tissue(c, 12 + 2 * k); stroke(c, (p) => { p.moveTo(214, 46); p.lineTo(212, 168 + ay); });
    tissue(c, 10); stroke(c, (p) => { p.moveTo(204, 42); p.quadraticCurveTo(214, 30, 226, 40); });
    tissue(c, 6); stroke(c, (p) => { p.moveTo(204, 44); p.quadraticCurveTo(128 - rv + 4 * k, 56, 114 - rv + 6 * k, 120); p.lineTo(114 - rv + 4 * k, 174 + ay); });
    tissue(c, 2.5); stroke(c, (p) => { p.moveTo(212, 176 + ay); p.lineTo(213, 262); });
    tissue(c, 3.5); stroke(c, (p) => { p.moveTo(310 - 6 * k, 174 + ay); p.quadraticCurveTo(338 + la, 218, 312 + la * 0.6, 266 + la * 0.4); p.quadraticCurveTo(262, 288 + la * 0.5, 214, 264); });
    tissue(c, 3.5); stroke(c, (p) => { p.moveTo(114 - rv + 4 * k, 178 + ay); p.quadraticCurveTo(84 - ra - rv, 222, 110 - ra * 0.6 - rv * 0.5, 268 + ra * 0.4); p.quadraticCurveTo(162, 290 + ra * 0.5, 212, 264); });

    const mC = { x: 262 - 3 * k, y: 164 - tent + ay }, tC = { x: 160 - rv / 2 + 2 * k, y: 160 + ay };
    const mL = 306 - 6 * k, tL = 116 - rv + 4 * k;
    tissue(c, 2.6);
    stroke(c, (p) => { p.moveTo(218, 172 + ay); p.quadraticCurveTo(lerp(240, 228, m), lerp(166 - tent, 160, m) + ay, lerp(mC.x - 1, 240, m), lerp(mC.y, 140 + ay, m)); });
    if (mv.flail) stroke(c, (p) => { p.moveTo(mL, 172 + ay); p.quadraticCurveTo(lerp(288, 298, m), lerp(174, 158, m) + ay, lerp(273, 286, m), lerp(187, 142, m) + ay); });
    else stroke(c, (p) => { p.moveTo(mL, 172 + ay); p.quadraticCurveTo(lerp(284, 298, m), lerp(166 - tent, 158, m) + ay, lerp(mC.x + 1, 286, m), lerp(mC.y, 142 + ay, m)); });
    stroke(c, (p) => { p.moveTo(206, 166 + ay); p.quadraticCurveTo(lerp(186, 198, m), lerp(160, 154, m) + ay, lerp(tC.x + tgap / 2, 186, m), lerp(tC.y, 138 + ay, m)); });
    stroke(c, (p) => { p.moveTo(tL, 176 + ay); p.quadraticCurveTo(lerp(136 - rv, 124 - rv, m), lerp(162, 160, m) + ay, lerp(tC.x - tgap / 2, 134 - rv, m), lerp(tC.y, 140 + ay, m)); });
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
  function shape(x, peakPos, k) {
    if (x <= 0 || x >= 1) return 0;
    if (x < peakPos) return Math.pow(Math.sin(Math.PI / 2 * x / peakPos), 0.8);
    return Math.pow(Math.cos(Math.PI / 2 * (x - peakPos) / (1 - peakPos)), k || 1);
  }
  const triX = (x) => (x <= 0 || x >= 1 ? 0 : (x < 0.2 ? Math.sin(Math.PI / 2 * x / 0.2) : 1 - (x - 0.2) / 0.8));
  function meanOf(f, n) {
    n = n || 240; let s = 0;
    for (let i = 0; i < n; i++) s += f((i + 0.5) / n);
    return s / n;
  }
  /** Find exponent p so that mean(f^(p·moment)) over [0,1] equals target (fatter envelope for smaller p). */
  function fitPow(f, target, moment) {
    let lo = 0.15, hi = 4;
    for (let i = 0; i < 28; i++) {
      const p = (lo + hi) / 2, mval = meanOf((x) => Math.pow(f(x), p * moment));
      if (mval > target) lo = p; else hi = p;
    }
    return (lo + hi) / 2;
  }
  function ecg(tb, T) {
    const q = tb > T / 2 ? tb - T : tb;
    return 13 * gauss(q, 0.009) - 3 * gauss(q + 0.022, 0.008) - 4 * gauss(q - 0.024, 0.009) +
      4.5 * gauss(tb - 0.3, 0.055) + 2.5 * gauss(tb - (T - 0.15), 0.03);
  }
  const fmt = (v, tick) => (tick < 1 ? v.toFixed(1) : String(Math.round(v)));

  /**
   * o: { x, y, w, h, up, down, tick, hr, tm, title, traces: [{ fn(tb, T, tm) → signed m/s (+ above baseline),
   *      density, mode: 'cw' | 'pw' }] }. Returns the coordinate map used for annotations and measuring.
   */
  function spectral(c, o, seed) {
    const beats = BEATS, T = 60 / o.hr, total = beats * T, lead = 0.1 * T, tm = o.tm || timing(T);
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
    c.strokeStyle = GREEN; c.lineWidth = 1.1; c.beginPath();
    const ey = o.y + head + plotH + ecgH * 0.62;
    for (let px = 0; px <= o.w; px += 1) {
      const tb = ((px / o.w * total - lead) % T + T) % T, y = ey - ecg(tb, T);
      if (px === 0) c.moveTo(o.x + px, y); else c.lineTo(o.x + px, y);
    }
    c.stroke();
    c.restore();
    c.save(); c.fillStyle = DIM;
    for (let v = -Math.floor(o.down / o.tick) * o.tick; v <= o.up + 1e-6; v += o.tick) {
      const y = yOf(v);
      c.fillRect(o.x + o.w - 5, y - 0.5, 5, 1);
      if (Math.abs(v) > 1e-6) text(c, fmt(Math.abs(v), o.tick), o.x + o.w - 8, y + 3, DIM, 'right');
    }
    c.restore();
    text(c, 'm/s', o.x + o.w - 8, o.y + 10, DIM, 'right');
    text(c, o.title, o.x + 6, o.y + 12, TEXT);
    return { yOf: yOf, tm: tm, T: T, total: total, lead: lead, base: base, k: k, x: o.x, y: o.y, w: o.w, h: o.h,
      top: o.y + head, bottom: o.y + head + plotH,
      xAt: (beat, tb) => o.x + ((lead + beat * T + tb) / total) * o.w };
  }
  function caliper(c, x, y, color) {
    c.save(); c.strokeStyle = color || YELLOW; c.lineWidth = 1.2; c.shadowBlur = 0;
    c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.moveTo(x, y - 4); c.lineTo(x, y + 4); c.stroke(); c.restore();
  }
  function readout(c, lines, x, y) {
    lines = lines.filter(Boolean);
    if (!lines.length) return;
    c.save(); c.font = MONO;
    const w = Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; }));
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(x - 4, y - 11, w + 8, lines.length * 13 + 4); c.restore();
    lines.forEach(function (l, i) { text(c, l, x, y + i * 13, YELLOW); });
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
  // Scenes: one per lesion. Each returns
  // { hr, tm, view, pxPerCm, nyq, assumed, tissue(c, tb), color(c, tb, frame), labels(c), doppler(c) → map }
  // ---------------------------------------------------------------------------
  function sceneAS(inp, res) {
    const g = res.grade, d = res.derived || {}, hr = 70, T = 60 / hr;
    const ava = d.ava, vEntered = num(inp.vmax), mg = num(inp.mg);
    let vmax = vEntered;
    if (vmax === null && mg !== null) vmax = Math.sqrt(mg / 0.6 / 4);
    if (vmax === null) vmax = ava !== null && ava !== undefined ? clamp(4.6 - ava * 1.4, 1.3, 5) : 1.3;
    const gVis = g !== null && g !== undefined ? g : (vmax >= 4 ? 3 : vmax >= 3 ? 2 : vmax >= 2.6 ? 1 : 0);
    const gapFrac = ava !== null && ava !== undefined ? clamp(ava / 3.5, 0.06, 0.9) : [0.85, 0.6, 0.4, 0.2, 0.12][gVis];
    const thick = [2.2, 3.4, 4.6, 6, 6.6][gVis];
    const lvotD = num(inp.lvotD), pxPerCm = 53 / clamp(lvotD || 2.0, 1.2, 3.5);

    // Envelope fitted so a trace recovers the entered mean gradient and VTI
    const peakPos = clamp(0.2 + (vmax - 2) * 0.12, 0.2, 0.5);
    const f0 = (x) => shape(x, peakPos, 1);
    const p = mg !== null && vEntered !== null ? fitPow(f0, clamp(mg / (4 * vmax * vmax), 0.3, 0.9), 2) : 1;
    const f = (x) => Math.pow(f0(x), p);
    const vtiIn = num(inp.avVti);
    const et = vtiIn !== null ? clamp(vtiIn / (100 * vmax * meanOf(f)), 0.16, Math.min(0.45, T - 0.32)) : null;
    const tm = timing(T, et);
    const fl = (x) => shape(x, 0.3, 1), lvotVti = num(inp.lvotVti);
    let lv = lvotVti !== null ? lvotVti / (100 * tm.sysDur * meanOf(fl)) : (num(inp.lvotV) || (d.dvi ? vmax * d.dvi : 1.0));
    lv = Math.min(lv, vmax * 0.9);
    const hasJet = vmax >= 2.6;

    return {
      hr: hr, tm: tm, view: 'PLAX', pxPerCm: pxPerCm, nyq: hasJet ? 60 : null, assumed: vEntered === null,
      tissue: function (c, tb) {
        plax(c, { k: contractAt(tb, T, tm), avOpen: avOpenAt(tb, tm), mvOpen: mvOpenAt(tb, T, tm),
          av: { gap: gapFrac, thick: thick, calc: gVis >= 2 }, wall: gVis >= 3 ? 19 : 14 });
      },
      color: function (c, tb, frame) {
        if (!hasJet) return;
        const a = avOpenAt(tb, tm);
        if (a > 0.25) jet(c, lerp(247, 268, a), 157.5, -0.06, clamp(26 + (vmax - 2.6) * 26, 26, 78) * a, gapFrac * 46 * a, 0.2, AWAY, 500 + frame, a);
        colorBox(c, 43, 86, 112, 228);
      },
      labels: function (c) { plaxLabels(c, 0); },
      doppler: function (c) {
        const L = dopplerLayout(false).main, x0 = (tb) => (tb - tm.sys0) / tm.sysDur;
        const s = spectral(c, Object.assign({}, L, { up: 1, down: Math.max(3, Math.ceil(vmax) + 1), tick: 1, hr: hr, tm: tm,
          title: 'CW  aortic valve (apical)',
          traces: [
            { fn: (tb) => -vmax * f(x0(tb)), density: 0.6, mode: 'cw' },
            { fn: (tb) => -lv * fl(x0(tb)), density: 0.95, mode: 'cw' },
          ] }), 21);
        readout(c, [
          'AV Vmax   ' + vmax.toFixed(1) + ' m/s' + (vEntered === null ? ' *' : ''),
          'Peak PG   ' + Math.round(4 * vmax * vmax) + ' mmHg' + (vEntered === null ? ' *' : ''),
          mg !== null && 'Mean PG   ' + mg + ' mmHg',
          ava !== null && ava !== undefined && 'AVA       ' + ava + ' cm²',
          d.dvi && 'DVI       ' + d.dvi,
        ], L.x + 190, L.y + 60);
        text(c, vmax >= 4 ? 'Rounded, mid-peaking envelope' : vmax >= 3 ? 'Later-peaking envelope' : 'Early-peaking envelope', L.x + 6, L.y + L.h - 38, DIM);
        return s;
      },
    };
  }

  function sceneMS(inp, res) {
    const g = res.grade, mva = res.derived ? res.derived.mva : null;
    const stenotic = mva !== null && mva !== undefined && mva <= 2.5;
    const la = g >= 3 ? 22 : g === 2 ? 12 : 0;
    const mg = num(inp.mg), hr = clamp(num(inp.hr) || 70, 40, 130), T = 60 / hr, tm = timing(T);
    const phtIn = num(inp.pht), pht = phtIn !== null ? phtIn : (stenotic ? 220 / mva : 60);
    const unit = function (tb) {
      if (tb > T - 0.005) return 0;
      return phtDecay(1, pht / 1000, tb - tm.dia0, 0.05) + (stenotic ? 0.35 : 0.7) * gauss(tb - (T - 0.09), 0.035);
    };
    // Scale the peak so that a trace of the filling period recovers the entered mean gradient
    let vp;
    if (mg !== null) {
      let sum = 0, n = 0;
      for (let i = 0; i < 400; i++) { const v = unit(i / 400 * T); if (v > 0.03) { sum += 4 * v * v; n++; } }
      vp = clamp(Math.sqrt(mg / (sum / Math.max(n, 1))), 0.6, 3.5);
    } else vp = stenotic ? clamp(2.4 - mva * 0.5, 1, 2.4) : 0.9;
    const gapPx = stenotic ? clamp(mva * 9, 4, 30) : 0;

    return {
      hr: hr, tm: tm, view: 'PLAX', pxPerCm: 27, nyq: stenotic ? 60 : null, assumed: phtIn === null || mg === null,
      tissue: function (c, tb) {
        plax(c, { k: contractAt(tb, T, tm), avOpen: avOpenAt(tb, tm), mvOpen: mvOpenAt(tb, T, tm), av: { thick: 2.2 },
          ms: stenotic ? { gap: gapPx } : null, la: la, thrombus: !!inp.laThrombus });
      },
      color: function (c, tb, frame) {
        if (!stenotic) return;
        const m = mvOpenAt(tb, T, tm), v = unit(tb);
        if (m > 0.2 && v > 0.1) jet(c, 208, 228, Math.PI + 0.12, (58 + (g || 1) * 10) * clamp(v, 0.4, 1), gapPx * m, 0.17, TOWARD, 600 + frame, clamp(v * 1.4, 0, 1));
        colorBox(c, 76, 116, 150, 282);
      },
      labels: function (c) { plaxLabels(c, la); },
      doppler: function (c) {
        const L = dopplerLayout(false).main;
        const s = spectral(c, Object.assign({}, L, { up: Math.max(2, Math.ceil((vp + 0.4) * 2) / 2), down: 0.5, tick: 0.5, hr: hr, tm: tm,
          title: 'CW  mitral inflow (apical)', traces: [{ fn: (tb) => vp * unit(tb), density: 0.75, mode: 'cw' }] }), 22);
        readout(c, [
          mg !== null && 'MV mean PG  ' + mg + ' mmHg',
          'PHT         ' + Math.round(pht) + ' ms' + (phtIn === null ? ' *' : ''),
          mva !== null && mva !== undefined && 'MVA         ' + mva + ' cm²',
          'HR          ' + hr + ' bpm' + (num(inp.hr) === null ? ' *' : ''),
        ], L.x + 6, L.y + 34);
        return s;
      },
    };
  }

  function sceneAR(inp, res) {
    const g = Math.min(res.grade || 0, 3), hr = 70, T = 60 / hr, tm = timing(T), pxPerCm = 27;
    const ratio = num(inp.jetRatio), vc = num(inp.vc);
    const w0 = vc !== null ? clamp(vc * pxPerCm, 2, 46) : ratio !== null ? clamp(ratio / 100 * 53, 3, 52) : [0, 6, 13, 22][g];
    const len = [0, 45, 92, 150][g];
    const lvDil = inp.lv === 'dilated' || (g >= 3 && inp.lv !== 'normal');
    const phtIn = num(inp.pht), pht = phtIn !== null ? phtIn : [600, 560, 350, 170][g];
    const dens = inp.cw === 'faint' ? 0.28 : inp.cw === 'dense' ? 0.55 : inp.cw === 'dense-steep' ? 0.85 : DENS[g];
    const v0 = 4.5;
    const diaT = function (tb) { return tb < 0.045 ? tb + T - (tm.sysEnd + 0.03) : tb - (tm.sysEnd + 0.03); };
    const arFn = (tb) => (g === 0 ? 0 : phtDecay(v0, pht / 1000, diaT(tb), 0.03));
    const second = inp.desc || inp.abd === 'holo';

    return {
      hr: hr, tm: tm, view: 'PLAX', pxPerCm: pxPerCm, nyq: g > 0 ? 60 : null, assumed: g > 0 && phtIn === null,
      tissue: function (c, tb) {
        plax(c, { k: contractAt(tb, T, tm), avOpen: avOpenAt(tb, tm), mvOpen: mvOpenAt(tb, T, tm) * (g >= 3 ? 0.7 : 1),
          av: { thick: 2.4, flail: inp.morph === 'flail' }, lvDil: lvDil });
      },
      color: function (c, tb, frame) {
        if (g === 0) return;
        const amt = clamp(arFn(tb) / v0, 0, 1);
        if (amt > 0.08) jet(c, 246, 157.5, Math.PI - 0.12, len * (0.6 + 0.4 * amt), w0, clamp(0.15 - w0 / 380, 0.03, 0.13), TOWARD, 700 + frame, clamp(amt * 1.5, 0, 1));
        colorBox(c, 50, 118, 104, 238);
      },
      labels: function (c) { plaxLabels(c, 0); },
      doppler: function (c) {
        const L = dopplerLayout(!!second);
        const s = spectral(c, Object.assign({}, L.main, { up: 6, down: 3, tick: 1, hr: hr, tm: tm, title: 'CW  aortic valve (apical 5-chamber)',
          traces: [
            { fn: arFn, density: dens, mode: 'cw' },
            { fn: (tb) => -(1.3 + 0.35 * g) * shape((tb - tm.sys0) / tm.sysDur, 0.3, 1), density: 0.8, mode: 'cw' },
          ] }), 23);
        readout(c, [
          g > 0 && 'AR PHT     ' + Math.round(pht) + ' ms' + (phtIn === null ? ' *' : ''),
          vc !== null && 'VC         ' + vc + ' cm',
          ratio !== null && 'Jet/LVOT   ' + ratio + ' %',
          num(inp.eroa) !== null && 'EROA       ' + inp.eroa + ' cm²',
          num(inp.rvol) !== null && 'RVol       ' + inp.rvol + ' mL',
          g === 0 && 'No AR signal',
        ], L.main.x + 6, L.main.y + 34);
        if (second) {
          const kind = inp.abd === 'holo' && !inp.desc ? 'holo' : inp.desc;
          const rev = function (tb) {
            const td = tb - tm.sysEnd - 0.02;
            if (td <= 0) return 0;
            if (kind === 'brief') return 0.3 * shape(td / 0.14, 0.4, 1);
            if (kind === 'intermediate') return 0.38 * shape(td / (T - tm.sysEnd - 0.02) / 0.6, 0.2, 1);
            return td < 0.05 ? 0.45 * td / 0.05 : Math.max(0.24, 0.45 - 0.35 * (td - 0.05));
          };
          spectral(c, Object.assign({}, L.second, { up: 0.8, down: 1.6, tick: 0.4, hr: hr, tm: tm,
            title: 'PW  ' + (inp.abd === 'holo' && !inp.desc ? 'abdominal' : 'descending') + ' aorta — ' +
              (kind === 'holo' ? 'holodiastolic reversal' : kind === 'intermediate' ? 'intermediate reversal' : 'brief early reversal'),
            traces: [
              { fn: (tb) => -1.2 * shape((tb - tm.sys0) / tm.sysDur, 0.3, 1), density: 0.8, mode: 'pw' },
              { fn: rev, density: 0.75, mode: 'pw' },
            ] }), 33);
        }
        return s;
      },
    };
  }

  function sceneAV(side, inp, res, extra) {
    const isM = side === 'M', g = res.grade || 0, pz = extra && extra.pisa ? extra.pisa : {};
    const hr = 70, T = 60 / hr, tm = timing(T), pxPerCm = 20;
    const vc = num(inp.vc), eroa = num(inp.eroa);
    const sevDil = inp.chambers === 'dilated' || (g >= 3 && inp.chambers !== 'normal');
    const dil = sevDil ? 16 : inp.chambers === 'normal-dilated' ? 7 : 0;
    const gi = Math.min(g, 5);
    let len = [0, 34, 62, 96, 104, 108][gi], spread = [0, 0.16, 0.22, 0.3, 0.34, 0.36][gi];
    if (inp.jet === 'small' && g > 0) { len = Math.min(len, 34); spread = 0.14; }
    if (inp.jet === 'large') { len = Math.max(len, 98); spread = Math.max(spread, 0.3); }
    const w0 = g === 0 ? 0 : vc !== null ? clamp(vc * pxPerCm, 2, 46) : [0, 4, 9, 15, 26, 34][gi];
    const alias = num(pz.alias) || (isM ? 40 : 28);
    let pr = num(pz.r) !== null ? pz.r * pxPerCm : null;
    if (pr === null && !isM && num(inp.pisaR) !== null) pr = inp.pisaR * pxPerCm;
    if (pr === null && eroa !== null) pr = Math.sqrt(eroa * (isM ? 500 : 280) / (2 * Math.PI * alias)) * pxPerCm;
    if (pr === null) pr = inp.flow === 'large' ? 16 : inp.flow === 'intermediate' ? 9 : [0, 0, 7, 14, 17, 20][gi];
    if (g === 0 || inp.flow === 'none') pr = 0;
    pr = clamp(pr, 0, 34);

    const geo = isM
      ? { la: dil, mv: { flail: inp.morph === 'flail', tent: inp.etiology === 'secondary' ? 10 : 0 } }
      : { ra: dil, rv: sevDil ? 12 : 0, tv: { gap: g >= 4 ? w0 * 0.8 : inp.morph === 'severe' ? 6 : 0 } };

    // Spectral jet: optional exponent so that a trace recovers the entered VTI
    const vEntered = num(pz.vmax) !== null ? pz.vmax / 100 : null;
    let peak = vEntered;
    if (peak === null && !isM && num(inp.pasp) !== null) peak = Math.sqrt(Math.max(inp.pasp - 8, 4) / 4);
    if (peak === null) peak = isM ? 5.2 : 2.7;
    if (!isM && g >= 4 && vEntered === null) peak = Math.min(peak, 2.2);
    const tri = inp.cw === 'triangular' || (inp.cw === undefined && !isM && g >= 4);
    const dens = inp.cw === 'faint' ? 0.28 : inp.cw === 'dense' ? 0.6 : inp.cw === 'triangular' ? 0.88 : DENS[gi];
    const pre = 0.03, dur = tm.sysDur + 0.08;
    const w0f = tri ? triX : (x) => shape(x, 0.45, 0.7);
    const vtiIn = num(pz.vti);
    const pw = vtiIn !== null && vEntered !== null ? fitPow(w0f, clamp(vtiIn / (100 * peak * dur), 0.3, 0.95), 1) : 1;
    const wave = (tb) => (g === 0 ? 0 : peak * Math.pow(w0f((tb - (tm.sys0 - pre)) / dur), pw));
    const E = inp.inflow === 'edom' ? (isM ? 1.5 : 1.1) : inp.inflow === 'adom' ? 0.6 : (isM ? 0.75 : 0.5) + 0.2 * Math.min(g, 3) * (isM ? 1 : 0.7);
    const A = inp.inflow === 'adom' ? E * 1.4 : inp.inflow === 'edom' ? E * 0.45 : E * 0.75;
    const veinKey = isM ? inp.pv : inp.hv;
    let origin = null;

    return {
      hr: hr, tm: tm, view: isM ? 'A4C' : 'A4C (RV-focused)', pxPerCm: pxPerCm, nyq: g > 0 ? alias : null,
      assumed: g > 0 && vEntered === null,
      tissue: function (c, tb) {
        const pts = a4c(c, Object.assign({ k: contractAt(tb, T, tm), open: mvOpenAt(tb, T, tm) }, geo));
        origin = isM ? pts.m : pts.t;
      },
      color: function (c, tb, frame) {
        if (g === 0 || !origin) return;
        const amt = clamp(wave(tb) / peak * 1.15, 0, 1);
        if (amt > 0.08) {
          pisa(c, origin.x, origin.y - 1, pr * Math.sqrt(amt));
          jet(c, origin.x, origin.y + 1, Math.PI / 2 + (isM ? 0.1 : -0.08), len * (0.55 + 0.45 * amt), w0, spread, AWAY, (isM ? 800 : 900) + frame, clamp(amt * 1.6, 0, 1));
        }
        if (isM) colorBox(c, 56, 93, 128, 300); else colorBox(c, 87, 126, 128, 300);
      },
      labels: function (c) { a4cLabels(c, geo); },
      doppler: function (c) {
        const L = dopplerLayout(!!veinKey), tag = isM ? 'MR' : 'TR';
        const s = spectral(c, Object.assign({}, L.main, { up: isM ? 2 : 1.5, down: Math.max(isM ? 6 : 3, Math.ceil(peak) + 1), tick: 1, hr: hr, tm: tm,
          title: 'CW  ' + (isM ? 'mitral' : 'tricuspid') + ' valve (apical)',
          traces: [
            { fn: (tb) => -wave(tb), density: dens, mode: 'cw' },
            { fn: inflow(E, A, 0.2), density: 0.7, mode: 'cw' },
          ] }), isM ? 24 : 25);
        readout(c, [
          g > 0 && tag + ' Vmax   ' + peak.toFixed(1) + ' m/s' + (vEntered === null ? ' *' : ''),
          vc !== null && 'VC        ' + vc + ' cm',
          eroa !== null && 'EROA      ' + eroa + ' cm²',
          num(inp.rvol) !== null && 'RVol      ' + inp.rvol + ' mL',
          num(inp.rf) !== null && 'RF        ' + inp.rf + ' %',
          g === 0 && 'No ' + tag + ' signal',
        ], L.main.x + 172, L.main.y + 96);
        if (g > 0) text(c, tri ? 'Dense, triangular, early-peaking jet' : dens >= 0.8 ? 'Dense holosystolic jet' : dens >= 0.5 ? 'Dense parabolic jet' : 'Faint, incomplete jet', L.main.x + 6, L.main.y + L.main.h - 38, DIM);
        if (veinKey) {
          // Pulmonary vein (apical): antegrade flow is toward the probe (above baseline).
          // Hepatic vein (subcostal): antegrade flow is away from the probe (below baseline).
          const sign = isM ? 1 : -1;
          const S = veinKey === 'sdom' ? 0.6 : veinKey === 'blunted' ? 0.2 : -0.35;
          const D = veinKey === 'sdom' ? 0.4 : veinKey === 'blunted' ? 0.6 : 0.7;
          const label = veinKey === 'sdom' ? 'systolic dominance' : veinKey === 'blunted' ? 'systolic blunting' : 'systolic flow reversal';
          spectral(c, Object.assign({}, L.second, { up: isM ? 1 : 0.6, down: isM ? 0.6 : 1, tick: 0.4, hr: hr, tm: tm,
            title: 'PW  ' + (isM ? 'pulmonary vein' : 'hepatic vein') + ' — ' + label,
            traces: [{ fn: (tb, TT, t2) => sign * venous(S, D, -0.18)(tb, TT, t2), density: 0.8, mode: 'pw' }] }), isM ? 34 : 35);
        }
        return s;
      },
    };
  }

  function buildScene(lesion, inp, res, extra) {
    if (lesion === 'AS') return sceneAS(inp, res);
    if (lesion === 'MS') return sceneMS(inp, res);
    if (lesion === 'AR') return sceneAR(inp, res);
    return sceneAV(lesion === 'MR' ? 'M' : 'T', inp, res, extra);
  }

  // ---------------------------------------------------------------------------
  // Measuring tools
  // ---------------------------------------------------------------------------
  // pane: '2d' | 'dop'; type: 'dist' (cm), 'point' (m/s), 'slope' (PHT ms), 'trace' (VTI, mean gradient);
  // freeze: phase the 2D image is frozen at while measuring.
  const TOOLS = {
    AS: [
      { id: 'lvotD', label: 'LVOT diameter', pane: '2d', type: 'dist', freeze: 'sys', hint: 'Drag across the LVOT between the cusp insertion points, inner edge to inner edge.' },
      { id: 'vmax', label: 'AV Vmax', pane: 'dop', type: 'point', hint: 'Click the peak of the dense outer envelope.' },
      { id: 'avTrace', label: 'AV trace', pane: 'dop', type: 'trace', hint: 'Drag along the outer envelope of one beat, from baseline to baseline.' },
      { id: 'lvotTrace', label: 'LVOT trace', pane: 'dop', type: 'trace', hint: 'Drag along the bright inner (LVOT) envelope of one beat.' },
    ],
    MS: [
      { id: 'pht', label: 'Pressure half-time', pane: 'dop', type: 'slope', hint: 'Drag from the E-wave peak down the deceleration slope.' },
      { id: 'mvTrace', label: 'MV trace', pane: 'dop', type: 'trace', hint: 'Drag along the inflow envelope of one diastole, from baseline to baseline.' },
    ],
    AR: [
      { id: 'vc', label: 'Vena contracta', pane: '2d', type: 'dist', freeze: 'dia', hint: 'Drag across the narrowest neck of the jet at the valve.' },
      { id: 'pht', label: 'Pressure half-time', pane: 'dop', type: 'slope', hint: 'Drag from the early-diastolic peak down the deceleration slope.' },
    ],
    MR: [
      { id: 'vc', label: 'Vena contracta', pane: '2d', type: 'dist', freeze: 'sys', hint: 'Drag across the narrowest neck of the jet at the leaflet tips.' },
      { id: 'pisaR', label: 'PISA radius', pane: '2d', type: 'dist', freeze: 'sys', hint: 'Drag from the orifice to the first aliasing boundary (red to blue).' },
      { id: 'vmax', label: 'MR Vmax', pane: 'dop', type: 'point', hint: 'Click the peak of the regurgitant jet below the baseline.' },
      { id: 'trace', label: 'MR trace', pane: 'dop', type: 'trace', hint: 'Drag along the regurgitant envelope of one beat.' },
    ],
    TR: [
      { id: 'vc', label: 'Vena contracta', pane: '2d', type: 'dist', freeze: 'sys', hint: 'Drag across the narrowest neck of the jet at the leaflet tips.' },
      { id: 'pisaR', label: 'PISA radius', pane: '2d', type: 'dist', freeze: 'sys', hint: 'Drag from the orifice to the first aliasing boundary (red to blue).' },
      { id: 'vmax', label: 'TR Vmax', pane: 'dop', type: 'point', hint: 'Click the peak of the regurgitant jet below the baseline.' },
    ],
  };

  function compute(tool, pts, sc, map) {
    if (tool.type === 'dist') {
      const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      return d < 1.5 ? null : { value: d / sc.pxPerCm, label: (d / sc.pxPerCm).toFixed(2) + ' cm' };
    }
    const vOf = (p) => Math.abs((map.base - p.y) / map.k), tOf = (p) => (p.x - map.x) / map.w * map.total;
    if (tool.type === 'point') {
      const v = vOf(pts[0]);
      return { value: v, label: v.toFixed(2) + ' m/s' };
    }
    if (tool.type === 'slope') {
      const a = pts[0].x <= pts[1].x ? pts[0] : pts[1], b = a === pts[0] ? pts[1] : pts[0];
      const dt = tOf(b) - tOf(a), dv = vOf(a) - vOf(b);
      if (dt < 0.01 || dv <= 0.01) return null;
      const pht = 0.293 * vOf(a) / (dv / dt) * 1000;
      return { value: pht, label: 'PHT ' + Math.round(pht) + ' ms' };
    }
    // trace
    const mono = [];
    pts.forEach(function (p) { if (!mono.length || p.x > mono[mono.length - 1].x) mono.push(p); });
    if (mono.length < 3) return null;
    let vti = 0, pg = 0, peak = 0;
    for (let i = 1; i < mono.length; i++) {
      const dt = tOf(mono[i]) - tOf(mono[i - 1]), v0 = vOf(mono[i - 1]), v1 = vOf(mono[i]);
      vti += (v0 + v1) / 2 * dt; pg += 4 * (v0 * v0 + v1 * v1) / 2 * dt; peak = Math.max(peak, v0, v1);
    }
    const dur = tOf(mono[mono.length - 1]) - tOf(mono[0]);
    if (dur < 0.03) return null;
    return { vti: vti * 100, meanPG: pg / dur, peak: peak, label: 'VTI ' + (vti * 100).toFixed(1) + ' cm · mean ' + Math.round(pg / dur) + ' mmHg' };
  }

  function drawMeasure(c, m, live) {
    const pts = m.pts, col = live ? CYAN : YELLOW;
    if (!pts.length) return;
    c.save(); c.strokeStyle = col; c.lineWidth = 1.3; c.shadowBlur = 0;
    if (m.type === 'trace') {
      c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.stroke();
    } else if (pts.length > 1) {
      if (m.type === 'slope') c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(pts[0].x, pts[0].y); c.lineTo(pts[1].x, pts[1].y); c.stroke();
    }
    c.restore();
    if (m.type !== 'trace') pts.forEach(function (p) { caliper(c, p.x, p.y, col); });
    if (m.result) {
      const p = pts[pts.length - 1];
      boxedText(c, m.name + '  ' + m.result.label, clamp(p.x + 8, 4, (m.pane === '2d' ? W2 : WD) - 190), clamp(p.y - 8, 14, (m.pane === '2d' ? H2 : HD) - 6), col);
    }
  }

  // ---------------------------------------------------------------------------
  // Controller: animation loop + pointer handling for one lesion's screen
  // ---------------------------------------------------------------------------
  const controllers = [];
  let rafId = null, lastTick = 0;
  function tick(now) {
    rafId = root.requestAnimationFrame(tick);
    if (now - lastTick < 33) return;
    const dt = Math.min(0.1, (now - lastTick) / 1000); lastTick = now;
    controllers.forEach(function (ct) { ct.frame(dt); });
  }

  function create(lesion, c2, cd, opts) {
    opts = opts || {};
    const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const st = { scene: null, map: null, layer: document.createElement('canvas'), time: 0, playing: !reduce, dirty: true,
      tool: null, live: null, pending: false, meas: {}, frame: 0 };
    const ctx2 = prep(c2, W2, H2), ctxd = prep(cd, WD, HD);
    const tools = TOOLS[lesion] || [];

    function freezeAt(phase) {
      const sc = st.scene; if (!sc) return;
      const T = 60 / sc.hr, tb = phase === 'dia' ? sc.tm.dia0 + 0.09 : sc.tm.sys0 + 0.5 * sc.tm.sysDur;
      st.time = 0.1 * T + tb; st.playing = false; st.dirty = true;
    }
    function render() {
      const sc = st.scene; if (!sc) return;
      const T = 60 / sc.hr, total = BEATS * T, lead = 0.1 * T;
      const tb = ((st.time - lead) % T + T) % T;
      // 2D
      ctx2.setTransform(SCALE, 0, 0, SCALE, 0, 0); ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, W2, H2);
      begin2D(ctx2); sc.tissue(ctx2, tb); speckle(ctx2); sc.color(ctx2, tb, st.playing ? st.frame % 9 : 0); sc.labels(ctx2);
      const inSys = tb >= sc.tm.sys0 && tb < sc.tm.sysEnd;
      end2D(ctx2, sc.view, (inSys ? 'Systole' : 'Diastole') + (sc.nyq ? ' · colour Doppler' : '') + (st.playing ? '' : ' · frozen'), sc.pxPerCm);
      if (sc.nyq) colorBar(ctx2, sc.nyq);
      if (!st.playing) Object.keys(st.meas).forEach(function (id) { if (st.meas[id].pane === '2d') drawMeasure(ctx2, st.meas[id]); });
      if (st.live && st.live.pane === '2d') drawMeasure(ctx2, st.live, true);
      // Doppler: static layer + sweep cursor + measurements
      ctxd.setTransform(1, 0, 0, 1, 0, 0); ctxd.drawImage(st.layer, 0, 0); ctxd.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      const m = st.map;
      if (m) {
        const x = m.x + ((st.time % total) / total) * m.w;
        ctxd.fillStyle = 'rgba(127,227,255,.75)'; ctxd.fillRect(x, 8, 1, HD - 16);
      }
      Object.keys(st.meas).forEach(function (id) { if (st.meas[id].pane === 'dop') drawMeasure(ctxd, st.meas[id]); });
      if (st.live && st.live.pane === 'dop') drawMeasure(ctxd, st.live, true);
    }

    function logical(canvas, e, w) {
      const r = canvas.getBoundingClientRect(), s = w / r.width;
      return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s };
    }
    function finish() {
      const live = st.live, tool = st.tool;
      if (!live || !tool) return;
      const result = compute(tool, live.pts, st.scene, st.map);
      st.live = null; st.pending = false;
      if (!result) { st.dirty = true; return; }
      st.meas[tool.id] = { pane: tool.pane, type: tool.type, name: tool.label, pts: live.pts, result: result };
      st.tool = null; cursors(); st.dirty = true;
      if (opts.onMeasure) opts.onMeasure(lesion, tool.id, result);
    }
    function attach(canvas, pane, w) {
      canvas.addEventListener('pointerdown', function (e) {
        const tool = st.tool;
        if (!tool || tool.pane !== pane || !st.scene) return;
        e.preventDefault();
        const p = logical(canvas, e, w);
        if (pane === 'dop' && st.map) p.y = clamp(p.y, st.map.top, st.map.bottom);
        if (st.pending && st.live) { st.live.pts[1] = p; finish(); return; }
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
        st.live = { pane: pane, type: tool.type, name: tool.label, pts: tool.type === 'point' || tool.type === 'trace' ? [p] : [p, p], down: p, dragging: true };
        st.dirty = true;
      });
      canvas.addEventListener('pointermove', function (e) {
        const live = st.live;
        if (!live || live.pane !== pane || (!live.dragging && !st.pending)) return;
        const p = logical(canvas, e, w);
        if (pane === 'dop' && st.map) p.y = clamp(p.y, st.map.top, st.map.bottom);
        if (live.type === 'trace') { if (live.dragging) live.pts.push(p); } else if (live.type === 'point') live.pts[0] = p; else live.pts[1] = p;
        st.dirty = true;
      });
      const up = function (e) {
        const live = st.live;
        if (!live || live.pane !== pane || !live.dragging) return;
        live.dragging = false;
        const p = logical(canvas, e, w);
        const moved = Math.hypot(p.x - live.down.x, p.y - live.down.y) > 4;
        if (live.type === 'point' || live.type === 'trace' || moved) finish();
        else st.pending = true; // click–click: wait for the second point
      };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', function () { st.live = null; st.pending = false; st.dirty = true; });
    }
    function cursors() {
      [[c2, '2d'], [cd, 'dop']].forEach(function (pair) {
        const on = st.tool && st.tool.pane === pair[1];
        pair[0].style.cursor = on ? 'crosshair' : ''; pair[0].style.touchAction = on ? 'none' : '';
      });
    }
    attach(c2, '2d', W2); attach(cd, 'dop', WD);

    const ct = {
      lesion: lesion, tools: tools,
      update: function (inputs, res, extra) {
        st.scene = buildScene(lesion, inputs || {}, res || {}, extra);
        const lc = prep(st.layer, WD, HD);
        st.map = st.scene.doppler(lc);
        st.dirty = true;
        return st.scene.assumed;
      },
      frame: function (dt) {
        if (!st.scene || c2.offsetParent === null) return;
        if (st.playing) { st.time += dt; st.frame++; } else if (!st.dirty) return;
        st.dirty = false; render();
      },
      setTool: function (id) {
        const tool = tools.find(function (t) { return t.id === id; }) || null;
        st.tool = st.tool && tool && st.tool.id === tool.id ? null : tool;
        st.live = null; st.pending = false;
        if (st.tool && st.tool.pane === '2d') freezeAt(st.tool.freeze);
        cursors(); st.dirty = true;
        return st.tool;
      },
      tool: function () { return st.tool; },
      playing: function () { return st.playing; },
      setPlaying: function (on) { st.playing = !!on; if (on && st.tool && st.tool.pane === '2d') { st.tool = null; cursors(); } st.dirty = true; },
      measurements: function () { return st.meas; },
      clear: function () { st.meas = {}; st.live = null; st.pending = false; st.tool = null; cursors(); st.dirty = true; },
      destroy: function () { const i = controllers.indexOf(ct); if (i >= 0) controllers.splice(i, 1); },
    };
    controllers.push(ct);
    if (rafId === null && root.requestAnimationFrame) rafId = root.requestAnimationFrame(tick);
    return ct;
  }

  root.EchoScreen = { create: create, TOOLS: TOOLS };
})(typeof window !== 'undefined' ? window : globalThis);
