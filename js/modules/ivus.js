/* Module: IVUS simulator. Each case is a geometric tissue model; images are produced by marching A-lines out from the
   catheter with echogenicity, attenuation (shadowing) and speckle, then scan-converted to a cross-section. */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h;
  const TAU = Math.PI * 2;
  const D = Math.PI / 180;

  // ---------- geometry helpers ----------
  const circle = (r) => () => r;
  function offsetCircle(R, dx, dy) {
    return (phi) => {
      const ux = Math.cos(phi), uy = Math.sin(phi);
      const b = ux * dx + uy * dy;
      const c = dx * dx + dy * dy - R * R;
      return b + Math.sqrt(Math.max(0, b * b - c));
    };
  }
  function ellipseR(rx, ry, rot) {
    return (phi) => { const a = phi - (rot || 0); return 1 / Math.sqrt(Math.pow(Math.cos(a) / rx, 2) + Math.pow(Math.sin(a) / ry, 2)); };
  }
  function angIn(phi, a0, a1) { // degrees, handles wrap
    let p = ((phi / D) % 360 + 360) % 360, s0 = ((a0 % 360) + 360) % 360, s1 = ((a1 % 360) + 360) % 360;
    return s0 <= s1 ? p >= s0 && p <= s1 : p >= s0 || p <= s1;
  }
  function bumpAng(phi, a0, a1, edge) { // smooth 0..1 window in degrees
    const p = ((phi / D) % 360 + 360) % 360;
    const c = (a0 + a1) / 2, half = (a1 - a0) / 2;
    let d = Math.abs(((p - c + 540) % 360) - 180);
    return 1 - CL.smooth(half - (edge || 10), half + (edge || 10), d);
  }
  const struts = (n, rFn, jitter, seed) => { const r = CL.rng(seed || 3); const out = []; for (let i = 0; i < n; i++) { const phi = (i + (r() - 0.5) * (jitter || 0.25)) / n * TAU; out.push([phi, rFn(phi)]); } return out; };

  const FIB = { e: 0.55, a: 0.22 };
  // ---------- cases ----------
  const CASES = {
    normal: { fov: 3.6, cath: [0.25, -0.15], lumen: circle(1.55), eem: circle(1.85), plaque: () => ({ e: 0.5, a: 0.2 }) },
    fibrous: { fov: 3.8, cath: [0.45, -0.25], lumen: offsetCircle(1.12, 0.55, -0.35), eem: circle(2.0), plaque: () => FIB, ref: 7.1 },
    soft: { fov: 3.8, cath: [0.4, 0.3], lumen: offsetCircle(1.15, 0.5, 0.35), eem: circle(2.05), plaque: (phi, rho, lr) => (rho < lr + 0.09 ? { e: 0.55, a: 0.2 } : { e: 0.17, a: 0.07 }), ref: 7.3 },
    calcium: { fov: 3.8, cath: [-0.2, 0.25], lumen: offsetCircle(1.2, -0.3, 0.3), eem: circle(2.0),
      plaque: (phi, rho, lr) => {
        if (angIn(phi, -85, 95) && rho < lr + 0.22) return { e: 1.7, a: 9 };
        return FIB;
      },
      extra: (x, y, rho, phi, lr, er) => {
        if (angIn(phi, -80, 90)) {
          const d = rho - (lr + 0.05);
          if (d > 0.3) { const k = d / 0.42; const near = Math.abs(k - Math.round(k)); if (Math.round(k) >= 1 && Math.round(k) <= 3 && near < 0.07) return { add: 0.22 / Math.round(k) }; }
        }
        return null;
      }, ref: 7.0 },
    attenuated: { fov: 3.8, cath: [0.45, 0.15], lumen: offsetCircle(1.1, 0.5, 0.2), eem: circle(2.1),
      plaque: (phi, rho, lr) => (angIn(phi, 110, 260) ? { e: 0.42 - Math.min(0.3, (rho - lr) * 0.5), a: 3.2 } : FIB), ref: 7.6 },
    stenosis: { fov: 3.8, cath: [0.6, 0.3], lumen: offsetCircle(0.86, 0.62, 0.3), eem: circle(2.05),
      plaque: (phi, rho, lr) => (rho < lr + 0.25 ? { e: 0.5, a: 0.2 } : angIn(phi, 120, 240) ? { e: 0.22, a: 0.1 } : FIB), ref: 7.5 },
    stent: { fov: 3.8, cath: [0.15, -0.1], lumen: circle(1.52), eem: circle(2.1), plaque: () => FIB, stent: { r: () => 1.5, n: 11 }, ref: 7.2 },
    malapposition: { fov: 3.8, cath: [-0.1, -0.15], lumen: (phi) => 1.53 + 0.44 * bumpAng(phi, 20, 120, 18), eem: (phi) => 2.05 + 0.42 * bumpAng(phi, 20, 120, 18),
      plaque: () => FIB, stent: { r: () => 1.48, n: 11 }, ref: 7.2, measLumen: () => 1.48, malap: true },
    underexpansion: { fov: 3.8, cath: [0.05, 0.05], lumen: ellipseR(1.16, 0.94, 0.3), eem: circle(2.15),
      plaque: (phi, rho, lr) => (angIn(phi, 140, 350) && rho < lr + 0.24 ? { e: 1.7, a: 9 } : FIB), stent: { r: ellipseR(1.13, 0.91, 0.3), n: 12 }, ref: 7.0 },
    dissection: { fov: 3.8, cath: [0.1, 0.2], lumen: circle(1.45), eem: circle(1.98), plaque: () => FIB,
      extra: (x, y, rho, phi, lr, er) => {
        const w = bumpAng(phi, 25, 125, 8);
        const fl = lr - 0.12 * w;                                                              // flap bulges into the lumen
        if (w > 0.3 && rho > fl && rho < fl + 0.09) return { e: 1.0, a: 0.25 };                // flap
        if (w > 0.3 && rho >= fl + 0.09 && rho < fl + 0.09 + 0.62 * w) return { blood: true }; // false channel behind the flap
        if (angIn(phi, 17, 26) && rho > lr - 0.5 && rho < lr + 0.05) return { e: 1.0, a: 0.25 }; // torn free edge
        return null;
      }, ref: 6.6 },
    hematoma: { fov: 4.0, cath: [-0.5, 0.2], lumen: offsetCircle(0.98, -0.5, 0.2), eem: (phi) => 2.1 + 0.3 * bumpAng(phi, -20, 160, 40),
      plaque: (phi, rho, lr, er) => (bumpAng(phi, -30, 170, 30) > 0.3 && rho > lr + 0.12 ? { e: 0.62, a: 0.12, homog: true } : { e: 0.5, a: 0.2 }), ref: 7.0, measLumenArea: true },
    perforation: { fov: 4.2, cath: [0.0, -0.2], lumen: circle(1.6), eem: circle(1.92), plaque: () => ({ e: 0.5, a: 0.2 }),
      extra: (x, y, rho, phi, lr, er) => {
        if (angIn(phi, 70, 96) && rho >= lr && rho < er + 0.6) return { blood: true };
        const cx = 2.75 * Math.cos(84 * D), cy = 2.75 * Math.sin(84 * D);
        const d = Math.hypot((x - cx) / 1.15, (y - cy) / 0.75);
        const rag = 1 + 0.12 * Math.sin(Math.atan2(y - cy, x - cx) * 5);
        if (d < rag && rho > er) return { blood: true, smoke: true };
        return null;
      } },
    aneurysm: { fov: 4.8, cath: [-1.6, 0.6], lumen: circle(2.95), eem: circle(3.2), plaque: () => ({ e: 0.45, a: 0.2 }), ref: 6.2 },
    thrombus: { fov: 3.8, cath: [0.35, -0.3], lumen: circle(1.62), eem: circle(1.95), plaque: () => FIB,
      extra: (x, y, rho, phi, lr) => {
        const cx = -0.85, cy = 0.62;
        const d = Math.hypot(x - cx, y - cy);
        const lob = 0.78 + 0.13 * Math.sin(Math.atan2(y - cy, x - cx) * 4 + 1) + 0.06 * Math.sin(Math.atan2(y - cy, x - cx) * 9);
        if (rho < lr && d < lob) return { e: 0.3, a: 0.15, scint: true };
        return null;
      }, ref: 8.2, measLumenArea: true },
    isr: { fov: 3.8, cath: [0.4, 0.2], lumen: circle(1.55), eem: circle(2.1), plaque: () => FIB, stent: { r: () => 1.53, n: 11 },
      extra: (x, y, rho, phi) => {
        const nl = offsetCircle(0.93, 0.42, 0.18)(phi);
        if (rho < 1.5 && rho > nl) return { e: 0.2, a: 0.12 };
        return null;
      }, ref: 7.0, measLumenFn: offsetCircle(0.93, 0.42, 0.18) },
  };

  // ---------- renderer ----------
  function Renderer(canvas) {
    this.canvas = canvas;
    this.NT = 256; this.NR = 230;
    this.px = 340;
    canvas.width = this.px; canvas.height = this.px;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.px, this.px);
    this.live = true;
    this.overlay = true;
  }
  Renderer.prototype.load = function (key) {
    const C = CASES[key];
    this.key = key; this.C = C;
    const NT = this.NT, NR = this.NR, R0 = 0.42, RMAX = C.fov * 1.42 + 0.6;
    const dr = (RMAX - R0) / NR;
    this.R0 = R0; this.dr = dr;
    const tissue = new Float32Array(NT * NR), bloodT = new Float32Array(NT * NR), flags = new Uint8Array(NT * NR);
    const rnd = CL.rng(17 + key.length * 13);
    const speck = new Float32Array(NT * NR);
    for (let i = 0; i < speck.length; i++) { const u = Math.max(1e-6, rnd()); speck[i] = Math.sqrt(-2 * Math.log(u)) / 1.25; }
    // lateral smoothing of speckle (tangentially elongated)
    const sp2 = new Float32Array(NT * NR);
    for (let i = 0; i < NT; i++) for (let j = 0; j < NR; j++) {
      const a = speck[((i + NT - 1) % NT) * NR + j], b = speck[i * NR + j], c = speck[((i + 1) % NT) * NR + j];
      sp2[i * NR + j] = 0.25 * a + 0.5 * b + 0.25 * c;
    }
    const [cx, cy] = C.cath;
    const wireAng = 2.3;
    const wx = cx + 0.62 * Math.cos(wireAng), wy = cy + 0.62 * Math.sin(wireAng);
    const strutPts = C.stent ? struts(C.stent.n, C.stent.r, 0.3, 5) : [];
    for (let i = 0; i < NT; i++) {
      const th = i / NT * TAU, ux = Math.cos(th), uy = Math.sin(th);
      let T = 1;
      for (let j = 0; j < NR; j++) {
        const r = R0 + j * dr;
        const x = cx + ux * r, y = cy + uy * r;
        const rho = Math.hypot(x, y), phi = Math.atan2(y, x);
        const lr = C.lumen(phi), er = C.eem(phi);
        let t = null;
        if (Math.hypot(x - wx, y - wy) < 0.055) t = { e: 2.2, a: 9 };
        if (!t && strutPts.length) for (const [sp, srad] of strutPts) {
          const sx = srad * Math.cos(sp), sy = srad * Math.sin(sp);
          const dd = Math.hypot(x - sx, y - sy);
          if (dd < 0.07) { t = { e: 2.4, a: 3.6 }; break; }
        }
        if (!t && C.extra) t = C.extra(x, y, rho, phi, lr, er);
        let add = 0;
        if (t && t.add) { add = t.add; t = null; }
        if (!t) {
          if (rho < lr) t = { blood: true };
          else if (rho < er - 0.17) t = C.plaque(phi, rho, lr, er) || FIB;
          else if (rho < er) t = { e: 0.07, a: 0.1 };
          else if (rho < er + 0.42) t = { e: 0.9, a: 0.35 };
          else { const n = 0.5 + 0.5 * Math.sin(x * 3.1 + Math.sin(y * 2.3) * 2) * Math.cos(y * 2.7 - x); t = { e: 0.22 + 0.3 * n, a: 0.25 }; }
        }
        const k = i * NR + j;
        const tgc = 1 + 0.08 * r;
        if (t.blood) {
          bloodT[k] = T * tgc * (t.smoke ? 1.8 : 1); flags[k] = t.smoke ? 2 : 1;
          T *= Math.exp(-0.02 * dr);
        } else {
          const s = t.homog ? 0.75 + 0.25 * sp2[k] : sp2[k];
          tissue[k] = t.e * T * tgc * s + add;
          if (t.scint) flags[k] = 3;
          T *= Math.exp(-(t.a || 0.2) * dr);
        }
        if (add && !t.e) tissue[k] = add;
      }
    }
    this.tissue = tissue; this.bloodT = bloodT; this.flags = flags; this.speck = sp2;
    // scan-conversion lookup
    const P = this.px, fov = C.fov, lut = new Int32Array(P * P), w = new Float32Array(P * P);
    for (let py = 0; py < P; py++) for (let px = 0; px < P; px++) {
      const X = (px / P * 2 - 1) * fov, Y = (py / P * 2 - 1) * fov;
      const dx = X - cx, dy = Y - cy;
      const r = Math.hypot(dx, dy);
      const k = py * P + px;
      if (r < R0) { lut[k] = -1; continue; }
      let th = Math.atan2(dy, dx); if (th < 0) th += TAU;
      const fi = th / TAU * NT;
      const i = Math.floor(fi) % NT;
      const fj = (r - R0) / dr;
      const j = Math.floor(fj);
      if (j >= NR - 1) { lut[k] = -2; continue; }
      lut[k] = i * NR + j; w[k] = fj - j;
    }
    this.lut = lut; this.w = w;
    this.strutPts = strutPts;
    this.measure();
  };
  Renderer.prototype.measure = function () {
    const C = this.C, N = 360;
    let la = 0, ea = 0, sa = 0, minD = 9, maxD = 0;
    const lumR = (phi) => (C.measLumenFn ? C.measLumenFn(phi) : C.measLumen ? C.measLumen(phi) : C.lumen(phi));
    for (let i = 0; i < N; i++) {
      const p = i / N * TAU;
      const lr = lumR(p), er = C.eem(p);
      la += 0.5 * lr * lr * TAU / N; ea += 0.5 * er * er * TAU / N;
      if (C.stent) { const sr = C.stent.r(p); sa += 0.5 * sr * sr * TAU / N; }
    }
    for (let i = 0; i < 180; i++) { const p = i / 360 * TAU; const d = lumR(p) + lumR(p + Math.PI); minD = Math.min(minD, d); maxD = Math.max(maxD, d); }
    if (C.measLumenArea) {
      // count blood pixels in the lumen region (excludes thrombus / hematoma compression)
      let n = 0; const P = 160;
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const X = (x / P * 2 - 1) * 3, Y = (y / P * 2 - 1) * 3; const rho = Math.hypot(X, Y), phi = Math.atan2(Y, X);
        if (rho < C.lumen(phi)) { const t = C.extra ? C.extra(X, Y, rho, phi, C.lumen(phi), C.eem(phi)) : null; if (!t || t.blood) n++; }
      }
      la = n * Math.pow(6 / P, 2);
    }
    let malap = 0;
    if (C.malap) for (let i = 0; i < N; i++) { const p = i / N * TAU; malap = Math.max(malap, C.lumen(p) - C.stent.r(p)); }
    this.m = { la, ea, pb: (ea - la) / ea, sa, minD, maxD, malap, ref: C.ref };
  };
  Renderer.prototype.frame = function (time) {
    const P = this.px, img = this.img.data, lut = this.lut, w = this.w, NR = this.NR;
    const tis = this.tissue, bT = this.bloodT, fl = this.flags;
    // blood speckle changes every frame; thrombus scintillates
    const tick = Math.floor(time * 24);
    const rnd = CL.rng(tick * 7919 + 13);
    const n = tis.length;
    if (!this.cur || this.cur.length !== n) this.cur = new Float32Array(n);
    const cur = this.cur;
    for (let k = 0; k < n; k++) {
      const f = fl[k];
      if (f === 1 || f === 2) cur[k] = bT[k] * (f === 2 ? 0.1 : 0.055) * (this.live ? rnd() * 2.2 : this.speck[k] * 1.1);
      else if (f === 3) cur[k] = tis[k] * (this.live ? 0.55 + rnd() * 1.1 : 1);
      else cur[k] = tis[k];
    }
    const gain = 3.2, L = Math.log(1 + gain * 1.2);
    for (let k = 0, q = 0; k < P * P; k++, q += 4) {
      const idx = lut[k];
      let v;
      if (idx === -1) v = 0;
      else if (idx === -2) v = 0;
      else {
        const a = cur[idx], b = cur[idx + 1];
        const I = a + (b - a) * w[k];
        v = Math.log(1 + gain * I) / L;
        const j = idx % NR;
        if (j < 14) v = Math.max(v, (1 - j / 14) * 0.85); // ring-down
      }
      const g = Math.max(0, Math.min(255, v * 255));
      img[q] = g; img[q + 1] = g; img[q + 2] = g * 0.98; img[q + 3] = 255;
    }
    const ctx = this.ctx;
    ctx.putImageData(this.img, 0, 0);
    // circular field mask and depth ticks
    const fov = this.C.fov, s = P / (2 * fov);
    const toPx = (x, y) => [(x + fov) * s, (y + fov) * s];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath(); ctx.arc(P / 2, P / 2, P / 2 - 1, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let mm = -Math.floor(fov); mm <= Math.floor(fov); mm++) {
      const [x] = toPx(mm, 0); ctx.fillRect(x - 0.5, P / 2 - 3, 1, 6);
      const [, y] = toPx(0, mm); ctx.fillRect(P / 2 - 3, y - 0.5, 6, 1);
    }
    if (this.overlay) this.drawOverlay(ctx, toPx, s);
  };
  Renderer.prototype.drawOverlay = function (ctx, toPx) {
    const C = this.C;
    const path = (fn, color, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const p = i / 120 * TAU; const r = fn(p); const [x, y] = toPx(r * Math.cos(p), r * Math.sin(p)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    path(C.eem, '#ffd166', [5, 4]);
    if (C.measLumenFn) path(C.measLumenFn, '#5ff0ff');
    else if (!C.measLumenArea) path(C.measLumen || C.lumen, '#5ff0ff');
    if (C.stent) path(C.stent.r, '#ff7ad9', [2, 3]);
  };

  const ORDER = ['normal', 'fibrous', 'soft', 'calcium', 'attenuated', 'stenosis', 'stent', 'malapposition', 'underexpansion', 'dissection', 'hematoma', 'perforation', 'aneurysm', 'thrombus', 'isr'];

  const mod = {
    init(root) {
      this.root = root;
      root.appendChild(CL.ui.head('PCI imaging', 'IVUS: read the cross-section',
        'Simulated intravascular ultrasound frames built from tissue physics: echogenicity, attenuation and speckle. Calcium and metal cast shadows, blood sparkles, and the dark media marks the EEM. Turn on tracings to see what you would measure.'));
      this.canvas = h('canvas', { 'aria-label': 'IVUS cross-section', style: { width: '100%', height: '100%', imageRendering: 'auto' } });
      const mon = h('div', { class: 'monitor', style: { aspectRatio: '1', maxWidth: '640px', width: '100%', margin: '0 auto', borderRadius: '50%', background: '#000' } }, this.canvas);
      this.r = new Renderer(this.canvas);
      this.caseInfo = h('div', { class: 'stack', 'aria-live': 'polite' });
      this.meas = h('div', { class: 'readout' });

      const groups = {};
      ORDER.forEach((k) => { const g = CL.data.ivusText[k].group; (groups[g] = groups[g] || []).push(k); });
      this.btns = {};
      const picker = h('div', { class: 'stack' }, Object.keys(groups).map((g) => h('div', { class: 'stack', style: { gap: '6px' } },
        h('h3', null, g),
        h('div', { class: 'chips' }, groups[g].map((k) => { const b = h('button', { type: 'button', class: 'chip', onclick: () => this.load(k) }, CL.data.ivusText[k].title); this.btns[k] = b; return b; })))));
      const tools = h('div', { class: 'row' },
        CL.ui.check({ id: 'ivus-ov', label: 'Show tracings (lumen, EEM, stent)', checked: true, onChange: (v) => { this.r.overlay = v; } }),
        CL.ui.check({ id: 'ivus-live', label: 'Live (blood speckle)', checked: true, onChange: (v) => { this.r.live = v; } }));
      const legend = h('div', { class: 'legend' },
        h('span', { style: { '--c': '#5ff0ff' } }, h('i'), 'Lumen'),
        h('span', { style: { '--c': '#ffd166' } }, h('i'), 'EEM (vessel)'),
        h('span', { style: { '--c': '#ff7ad9' } }, h('i'), 'Stent'));

      root.appendChild(h('div', { class: 'bench even' },
        h('div', { class: 'stack' }, mon, tools, legend),
        h('div', { class: 'stack' }, h('div', { class: 'panel' }, picker), h('div', { class: 'panel' }, this.caseInfo, this.meas))));

      root.appendChild(h('div', { class: 'grid-2' },
        h('div', { class: 'panel' }, h('h2', null, 'When to use IVUS'), h('dl', { class: 'kv' }, CL.data.ivusIndications.map((x) => [h('dt', null, x.k), h('dd', null, x.v)]))),
        h('div', { class: 'panel' }, h('h2', null, 'Numbers that matter'), h('dl', { class: 'kv' }, CL.data.ivusCriteria.map((x) => [h('dt', null, x.k), h('dd', null, x.v)])),
          h('div', { class: 'callout' }, h('strong', null, 'Malapposed or underexpanded? '), 'Malapposition means blood behind the struts: the stent is smaller than the vessel, so use a bigger balloon. Underexpansion means the struts touch the wall but the area is small: the lesion is resisting, so use high pressure with a non-compliant balloon and prepare the calcium.'))));
      root.appendChild(h('div', { class: 'grid-2' },
        h('div', { class: 'panel' }, h('h2', null, 'IVUS vs OCT'), h('ul', { class: 'prose', style: { fontSize: 'var(--step--1)' } },
          h('li', null, 'IVUS: 20–60 MHz, axial resolution ≈100–150 µm (HD-IVUS <40 µm), penetration 4–8 mm. Sees the EEM through plaque, so it is better for vessel sizing, plaque burden, LM and aorto-ostial lesions (no blood clearance needed).'),
          h('li', null, 'OCT: ≈10–20 µm resolution, 1–2 mm penetration; needs contrast flush. Better for thin caps, thrombus, malapposition, edge dissection and calcium thickness.'),
          h('li', null, 'MLD MAX workflow (Shlofmitz). Before the stent: Morphology, Length, Diameter. After the stent: Medial dissection, Apposition, eXpansion.'))),
        h('div', { class: 'panel' }, h('h2', null, 'Artifacts'), h('dl', { class: 'kv' }, CL.data.ivusArtifacts.map((x) => [h('dt', null, x.k), h('dd', null, x.v)])))));
      root.appendChild(CL.ui.refs(CL.data.ivusRefs));

      this.load('normal');
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    },
    load(k) {
      this.key = k;
      this.r.load(k);
      Object.keys(this.btns).forEach((x) => this.btns[x].setAttribute('aria-pressed', String(x === k)));
      const t = CL.data.ivusText[k];
      CL.clear(this.caseInfo);
      this.caseInfo.append(h('div', { class: 'eyebrow' }, t.group), h('h2', null, t.title),
        h('p', null, h('b', null, 'What you see: '), t.see),
        h('p', null, h('b', null, 'Why it matters: '), t.why));
      const m = this.r.m;
      CL.clear(this.meas);
      const cell = (kk, v, cls) => h('div', { class: 'r ' + (cls || '') }, h('span', { class: 'k' }, kk), h('span', { class: 'v' }, v));
      const C = CASES[k];
      if (C.stent) {
        const exp = m.ref ? m.sa / m.ref : null;
        this.meas.append(cell('MSA (stent area)', m.sa.toFixed(1) + ' mm²', m.sa > 5.5 ? 'ok' : 'bad'),
          cell('Reference lumen', m.ref ? m.ref.toFixed(1) + ' mm²' : '—'),
          cell('Expansion', exp ? Math.round(exp * 100) + '%' : '—', exp && exp >= 0.8 ? 'ok' : 'bad'),
          k === 'isr' ? cell('Lumen (MLA)', m.la.toFixed(1) + ' mm²', 'bad') : null,
          k === 'malapposition' ? cell('Max strut–wall gap', m.malap.toFixed(2) + ' mm', m.malap > 0.4 ? 'bad' : 'ok') : null);
      } else {
        this.meas.append(cell('Lumen area', m.la.toFixed(1) + ' mm²'),
          cell('EEM area', m.ea.toFixed(1) + ' mm²'),
          cell('Plaque burden', Math.round(m.pb * 100) + '%', m.pb >= 0.5 ? 'bad' : 'ok'),
          cell('Min / max lumen Ø', m.minD.toFixed(1) + ' / ' + m.maxD.toFixed(1) + ' mm'),
          m.ref ? cell('Area stenosis vs ref', Math.max(0, Math.round((1 - m.la / m.ref) * 100)) + '%') : null);
      }
    },
    _loop(now) {
      requestAnimationFrame(this._loop);
      if (CL.router.current !== 'ivus') return;
      if (now - (this._last || 0) < 40) return; // ~25 fps
      this._last = now;
      this.r.frame(now / 1000);
    },
  };
  CL.modules.ivus = mod;
  CL.IVUS = { CASES, Renderer };
})();
