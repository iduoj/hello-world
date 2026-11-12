/* Echo: AHA 17-segment bull's-eye and animated schematic 2D views (PLAX, PSAX mid, A4C, A2C, A3C).
   Wall motion score per segment: 1 normal, 2 hypokinetic, 3 akinetic, 4 dyskinetic. */
(function () {
  'use strict';
  const CL = window.CL;
  const S = CL.svg;
  const MOTION = { 1: 1, 2: 0.35, 3: 0, 4: -0.38 };

  /* ---------------- bull's-eye ---------------- */
  const BE = {
    ring: { basal: [74, 100], mid: [48, 74], apical: [22, 48] },
    segs: [
      [1, 'basal', -120, -60], [2, 'basal', -180, -120], [3, 'basal', 120, 180], [4, 'basal', 60, 120], [5, 'basal', 0, 60], [6, 'basal', -60, 0],
      [7, 'mid', -120, -60], [8, 'mid', -180, -120], [9, 'mid', 120, 180], [10, 'mid', 60, 120], [11, 'mid', 0, 60], [12, 'mid', -60, 0],
      [13, 'apical', -135, -45], [14, 'apical', 135, 225], [15, 'apical', 45, 135], [16, 'apical', -45, 45],
    ],
  };
  function arcPath(cx, cy, r0, r1, a0, a1) {
    const R = Math.PI / 180, p = (r, a) => [cx + r * Math.cos(a * R), cy + r * Math.sin(a * R)];
    const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
  }
  function scoreFill(score, terr, showTerr) {
    if (score === 2) return ['var(--warn)', 0.8];
    if (score === 3) return ['var(--bad)', 0.88];
    if (score === 4) return ['var(--ramus)', 0.92];
    if (!showTerr) return ['var(--surface-3)', 1];
    return ['var(--' + ({ LAD: 'lad', RCA: 'rca', LCx: 'lcx' }[terr]) + ')', 0.28];
  }
  CL.Echo = {};
  CL.Echo.bullseye = function (scores, opts = {}) {
    const svg = S('svg', { viewBox: '0 0 220 236', role: 'img', 'aria-label': '17-segment bull’s-eye' });
    const cx = 110, cy = 110;
    const T = CL.data.segTerritory;
    const tip = S('text', { x: 110, y: 230, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--ink-2)', 'font-family': 'var(--font-body)', text: 'Tap a segment' });
    const addSeg = (n, d, lx, ly) => {
      const sc = scores[n] || 1;
      const [col, op] = scoreFill(sc, T[n], opts.territories !== false);
      const path = S('path', { d, fill: col, 'fill-opacity': op, stroke: 'var(--surface)', 'stroke-width': 1.5, style: 'cursor:pointer' });
      const label = () => { tip.textContent = n + ' · ' + CL.data.segNames[n] + ' · ' + T[n] + (sc > 1 ? ' · ' + ['', 'normal', 'hypokinetic', 'akinetic', 'dyskinetic'][sc] : ''); };
      path.addEventListener('click', label);
      path.addEventListener('mouseenter', label);
      svg.appendChild(path);
      svg.appendChild(S('text', { x: lx, y: ly + 3.5, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600, fill: sc >= 3 ? '#fff' : 'var(--ink)', 'font-family': 'var(--font-mono)', 'pointer-events': 'none', text: String(n) }));
    };
    BE.segs.forEach(([n, ring, a0, a1]) => {
      const [r0, r1] = BE.ring[ring];
      const am = (a0 + a1) / 2 * Math.PI / 180, rm = (r0 + r1) / 2;
      addSeg(n, arcPath(cx, cy, r0, r1, a0, a1), cx + rm * Math.cos(am), cy + rm * Math.sin(am));
    });
    addSeg(17, `M${cx - 22} ${cy} A22 22 0 1 1 ${cx + 22} ${cy} A22 22 0 1 1 ${cx - 22} ${cy} Z`, cx, cy);
    const lbl = (t, x, y, a) => svg.appendChild(S('text', { x, y, 'text-anchor': a || 'middle', 'font-size': 9, fill: 'var(--muted)', 'font-family': 'var(--font-display)', 'letter-spacing': '0.08em', text: t }));
    lbl('ANTERIOR', 110, 7); lbl('INFERIOR', 110, 220); lbl('SEPTAL', 4, 114, 'start'); lbl('LATERAL', 216, 114, 'end');
    svg.appendChild(tip);
    return svg;
  };

  /* ---------------- animated views ----------------
     Each frame: (1) the anatomy is drawn as an echogenicity map (how strongly each tissue scatters sound),
     (2) a scan-conversion pass turns it into an ultrasound image: polar speckle that coarsens with depth,
     bright specular borders where the beam hits an interface head-on (and dropout where it runs parallel),
     depth attenuation, lateral gain fall-off and near-field clutter. */
  const EW = 384, EH = 288, HALF = 43 * Math.PI / 180, NT = 168, NR = 300;
  const LVL = { out: 20, blood: 5, myo: 104, peri: 225, valve: 180, scar: 190, wall: 88, band: 66, root: 135 };
  const gray = (v) => 'rgb(' + v + ',' + v + ',' + v + ')';

  let FIELDS = null;
  function fields() {
    if (FIELDS) return FIELDS;
    const mk = (seed) => {
      const r = CL.rng(seed), n = NT * NR, f = new Float32Array(n), g = new Float32Array(n);
      for (let i = 0; i < n; i++) { const u = Math.max(1e-6, r()), v = r(); f[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); }
      for (let t = 0; t < NT; t++) for (let k = 0; k < NR; k++) {      // neighbouring scan lines are correlated
        const a = f[Math.max(0, t - 1) * NR + k], b = f[t * NR + k], c = f[Math.min(NT - 1, t + 1) * NR + k];
        g[t * NR + k] = (0.25 * a + 0.5 * b + 0.25 * c) * 1.633;
      }
      return g;
    };
    const r = CL.rng(99), bn = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) bn[i] = r();
    const gam = new Uint8Array(1025);
    for (let i = 0; i <= 1024; i++) gam[i] = Math.round(255 * Math.pow(i / 1024, 0.8));
    FIELDS = { g: [mk(11), mk(23), mk(37), mk(51)], bn, gam };
    return FIELDS;
  }
  const LUTS = {};
  function lut(depth) {
    if (LUTS[depth]) return LUTS[depth];
    const sc = (EH - 12) / depth, ox = EW / 2, oy = 6;
    const pix = [], polar = [], back = [], att = [], near = [];
    for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) {
      const dx = (x - ox) / sc, dy = (y - oy) / sc, r = Math.hypot(dx, dy);
      if (r < 0.2 || r > depth) continue;
      const ang = Math.atan2(dx, dy);
      if (Math.abs(ang) > HALF) continue;
      const ti = Math.min(NT - 1, Math.floor((ang + HALF) / (2 * HALF) * NT)), ri = Math.min(NR - 1, Math.floor(r / depth * NR));
      const bx = CL.clamp(Math.round(x - dx / r * 2.3), 0, EW - 1), by = CL.clamp(Math.round(y - dy / r * 2.3), 0, EH - 1);
      pix.push(y * EW + x); polar.push(ti * NR + ri); back.push(by * EW + bx);
      att.push((1 - 0.24 * r / depth) * (1 - 0.3 * Math.pow(Math.abs(ang) / HALF, 2.2)));
      near.push(Math.exp(-r / 0.55));
    }
    LUTS[depth] = { sc, ox, oy, n: pix.length, pix: Int32Array.from(pix), polar: Int32Array.from(polar), back: Int32Array.from(back), att: Float32Array.from(att), near: Float32Array.from(near) };
    return LUTS[depth];
  }

  // LV half-ellipse contour for apical views; returns endocardial points with segment ids
  function apicalLV(cx, a, b, yb, leftSegs, rightSegs, N) {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const th = Math.PI - Math.PI * i / N;
      const sn = Math.sin(th), cs = Math.cos(th);
      const x = cx + a * cs * (0.92 + 0.08 * sn), y = yb - b * Math.pow(sn, 0.9);
      const lvl = sn < 1 / 3 ? 0 : sn < 2 / 3 ? 1 : sn < 0.93 ? 2 : 3;
      const seg = lvl === 3 ? 17 : (cs < 0 ? leftSegs : rightSegs)[lvl];
      pts.push({ x, y, seg, tx: cx, ty: Math.max(y, yb - b + 2.6), basal: 1 - sn });
    }
    return pts;
  }
  function ringLV() {
    const pts = [], N = 72, cx = 0.4, cy = 8.3, r = 2.35;
    const segFor = (deg) => {
      const d = ((deg % 360) + 360) % 360;
      if (d >= 300) return 12; if (d < 60) return 11; if (d < 120) return 10; if (d < 180) return 9; if (d < 240) return 8; return 7;
    };
    for (let i = 0; i < N; i++) {
      const deg = i * 360 / N, a = deg * Math.PI / 180;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), seg: segFor(deg), tx: cx, ty: cy, basal: 0 });
    }
    pts.closed = true;
    return pts;
  }
  function plaxLV() {
    const pts = [];
    const top = (x) => 5.3 + 0.55 * Math.pow(CL.clamp((-x - 3.0) / 6.5, 0, 1), 1.5);
    const bot = (x) => 9.7 - 0.75 * Math.pow(CL.clamp((-x - 3.0) / 6.5, 0, 1), 1.5);
    const segX = (x, upper) => (x > -2.4 ? (upper ? 2 : 5) : (upper ? 8 : 11));
    for (let x = 0.9; x >= -9.6; x -= 0.2) pts.push({ x, y: top(x), seg: segX(x, true), tx: x, ty: 7.5, basal: 0 });
    for (let x = -9.6; x <= 1.7; x += 0.2) pts.push({ x, y: bot(x), seg: segX(x, false), tx: x, ty: 7.5, basal: 0 });
    return pts;
  }

  const VIEWS = {
    a4c: { name: 'Apical 4-chamber', depth: 17, shows: 'Inferoseptum (3, 9, 14) and anterolateral wall (6, 12, 16), plus the apex. RV and both atria alongside.',
      lv: () => apicalLV(1.9, 2.15, 8.8, 11.9, [3, 9, 14], [6, 12, 16], 60), labels: [['LV', 1.9, 7.6], ['RV', -2.9, 8.8], ['LA', 1.9, 14.4], ['RA', -3.0, 14.2]] },
    a2c: { name: 'Apical 2-chamber', depth: 17, shows: 'Inferior wall (4, 10, 15) and anterior wall (1, 7, 13).',
      lv: () => apicalLV(0.3, 2.2, 8.9, 11.9, [4, 10, 15], [1, 7, 13], 60), labels: [['LV', 0.3, 7.6], ['LA', 0.3, 14.4]] },
    a3c: { name: 'Apical 3-chamber (long axis)', depth: 17, shows: 'Inferolateral wall (5, 11) and anteroseptum (2, 8) with the LVOT and aortic valve. Apical segments in this view are assigned inconsistently between references.',
      lv: () => apicalLV(0.1, 2.2, 8.9, 11.9, [5, 11, 16], [2, 8, 13], 60), labels: [['LV', 0.1, 7.6], ['LA', -1.3, 14.6], ['Ao', 2.9, 14.6]] },
    psax: { name: 'Parasternal short axis (mid)', depth: 14, ring: true, shows: 'All six mid segments (7–12) in one ring: the best single view for territories. RV on the left, papillary muscles at 4 and 8 o’clock.',
      labels: [['LV', 0.2, 8.4], ['RV', -3.6, 6.6]] },
    plax: { name: 'Parasternal long axis', depth: 14, plax: true, shows: 'Anteroseptum (2, 8) on top and inferolateral wall (5, 11) below, with the mitral and aortic valves, aortic root and left atrium. The apex is usually cut off.',
      labels: [['RV', -2.2, 3.5], ['LV', -2.6, 7.6], ['Ao', 4.3, 6.4], ['LA', 4.4, 9.7]] },
  };

  CL.Echo.View = function (canvas) {
    this.canvas = canvas;
    this.view = 'a4c';
    this.scores = {};
    this.rv = false;
    this.chronic = false;
    this.labels = true;
    this.speed = 1;
    this.e = document.createElement('canvas'); this.e.width = EW; this.e.height = EH;
    this.ex = this.e.getContext('2d', { willReadFrequently: true });
    this.o = document.createElement('canvas'); this.o.width = EW; this.o.height = EH;
    this.ox = this.o.getContext('2d');
    this.img = this.ox.createImageData(EW, EH);
    for (let i = 3; i < this.img.data.length; i += 4) this.img.data[i] = 255;
    this.frame = 0;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  };
  const P = CL.Echo.View.prototype;
  P.set = function (o) {
    Object.assign(this, o); this._geom = null;
    const d = this.img.data; for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 0; }
  };
  P._geometry = function () {
    if (this._geom && this._geom.view === this.view) return this._geom;
    const v = VIEWS[this.view];
    const lv = v.ring ? ringLV() : v.plax ? plaxLV() : v.lv();
    this._geom = { view: this.view, lv, v };
    return this._geom;
  };
  P._motionAt = function (pts) {
    const raw = pts.map((p) => (this.chronic && (this.scores[p.seg] || 1) >= 3 ? Math.min(0, MOTION[this.scores[p.seg]]) : MOTION[this.scores[p.seg] || 1]));
    const n = raw.length, out = new Float32Array(n), w = 3;
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -w; k <= w; k++) { let j = i + k; if (pts.closed) j = (j + n) % n; if (j < 0 || j >= n) continue; s += raw[j]; c++; }
      out[i] = s / c;
    }
    return out;
  };
  P._loop = function (now) {
    if (!this.canvas.isConnected && this._wasConnected) return; // canvas discarded: stop the loop
    requestAnimationFrame(this._loop);
    if (this.canvas.isConnected) this._wasConnected = true;
    if (!this.canvas.isConnected || this.canvas.offsetParent === null) return;
    if (now - (this._lastT || 0) < 30) return;               // ~30 fps is plenty
    this._lastT = now;
    this.draw(now / 1000);
  };

  /* ---- anatomy -> echogenicity map (drawn in centimetres; the probe is at the origin, depth runs down) ---- */
  P._anatomy = function (g, geo, s, mo, ao) {
    const plax = !!geo.v.plax, ring = !!geo.v.ring, view = this.view;
    const fill = (pts, level) => { g.fillStyle = gray(level); g.beginPath(); for (let i = 0; i < pts.length; i++) g[i ? 'lineTo' : 'moveTo'](pts[i].x, pts[i].y); g.closePath(); g.fill(); };
    const stroke = (pts, level, w) => { g.strokeStyle = gray(level); g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < pts.length; i++) g[i ? 'lineTo' : 'moveTo'](pts[i].x, pts[i].y); g.stroke(); };
    const ell = (cx, cy, rx, ry, a0, a1, N) => { const out = []; for (let i = 0; i <= N; i++) { const t = a0 + (a1 - a0) * i / N; out.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }); } return out; };
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const add = (a, dx, dy) => ({ x: a.x + dx, y: a.y + dy });
    const bez = (a, c1, c2, b, N) => { const out = []; for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t; out.push({ x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y }); } return out; };
    const leaflet = (hinge, tip, belly, w) => { const mid = lerp(hinge, tip, 0.5); const c = add(mid, belly.x, belly.y); const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push({ x: u * u * hinge.x + 2 * u * t * c.x + t * t * tip.x, y: u * u * hinge.y + 2 * u * t * c.y + t * t * tip.y }); } stroke(pts, LVL.valve, (w || 0.15) * 0.62); g.fillStyle = gray(LVL.valve); g.beginPath(); g.arc(tip.x, tip.y, 0.07, 0, 6.2832); g.fill(); };
    const dot = (p, r, level) => { g.fillStyle = gray(level); g.beginPath(); g.arc(p.x, p.y, r, 0, 6.2832); g.fill(); };

    // --- LV wall mechanics (shared by all views) ---
    const lv = geo.lv, n = lv.length, closed = !!lv.closed;
    const m = this._motionAt(lv);
    const dShape = ring && this.rv;
    const endo = lv.map((p, i) => {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const k = (ring ? 0.33 : plax ? 0.36 : 0.3) * m[i] * s;
      let x = p.x + dx * k, y = p.y + dy * k;
      if (!ring && !plax) y -= 1.0 * s * Math.max(0.2, m[i]) * p.basal * 0.9;   // the base descends toward the apex
      if (dShape && p.x < p.tx) x = p.tx + (x - p.tx) * 0.8;                     // RV pressure overload flattens the septum
      return { x, y, seg: p.seg };
    });
    const thick = (i) => { const scr = this.scores[lv[i].seg] || 1; return (this.chronic && scr >= 3 ? 0.55 : 1.0) * (1 + 0.42 * Math.max(-0.4, m[i]) * s); };
    const nrm = endo.map((p, i) => {
      const a = endo[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = endo[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const q = lv[i]; if (nx * (q.x - q.tx) + ny * (q.y - q.ty) < 0) { nx = -nx; ny = -ny; }
      return [nx, ny];
    });
    const epi = endo.map((p, i) => ({ x: p.x + nrm[i][0] * thick(i), y: p.y + nrm[i][1] * thick(i) }));
    const off = (i, d) => ({ x: endo[i].x + nrm[i][0] * (thick(i) + d), y: endo[i].y + nrm[i][1] * (thick(i) + d) });
    const drawLV = () => {
      fill(closed ? epi : endo.concat(epi.slice().reverse()), LVL.myo);
      if (this.chronic) for (let i = 0; i < n - (closed ? 0 : 1); i++) {
        const j = (i + 1) % n;
        if ((this.scores[lv[i].seg] || 1) >= 3) fill([endo[i], endo[j], epi[j], epi[i]], LVL.scar);
      }
      fill(endo, LVL.blood);
    };
    const rvMove = this.rv ? 0.22 : 1, dil = this.rv ? 0.85 : 0;

    g.fillStyle = gray(LVL.out); g.fillRect(-12, -1, 24, 20);

    if (ring) {
      const cx = lv[0].tx, cy = lv[0].ty;
      // pericardium behind the inferolateral wall, RV crescent in front and to the left
      stroke(ell(cx, cy, 3.56, 3.56, -0.3, 2.2, 40), LVL.peri, 0.13);
      const rw = ell(cx - 2.5 - dil * 0.6, cy - 1.0, 3.5 + dil * 0.5 - 0.25 * s * rvMove, 3.6 - 0.2 * s * rvMove, Math.PI * 0.55, Math.PI * 1.62, 40);
      stroke(rw, LVL.myo, 0.8);
      fill(rw, LVL.blood);
      drawLV();
      [[32, 1.72], [148, 1.72]].forEach(([deg, r0]) => {         // papillary muscles
        const a = deg * Math.PI / 180, rr = r0 * (1 - 0.24 * s);
        g.fillStyle = gray(LVL.myo); g.beginPath(); g.ellipse(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 0.42, 0.34, a, 0, 6.2832); g.fill();
      });
      return { endo };
    }

    if (plax) {
      // near field: chest wall and RV free wall
      g.fillStyle = gray(70); g.fillRect(-9, 0, 18, 1.5);
      stroke([{ x: -9, y: 1.55 }, { x: 9, y: 1.55 }], 150, 0.12);
      fill([{ x: -9, y: 1.6 }, { x: 9, y: 1.6 }, { x: 9, y: 2.5 }, { x: -9, y: 2.5 }], LVL.myo);
      // RV / RVOT cavity
      fill([{ x: -9, y: 2.5 - 0.1 * s }, { x: 3.4, y: 2.5 }, { x: 3.0, y: 3.9 }, { x: 1.0, y: 4.25 + 0.1 * s }, { x: -9, y: 4.3 + 0.25 * s }], LVL.blood);
      // posterior pericardium and descending aorta
      stroke([{ x: -9, y: 11.3 + 0.2 * s }, { x: -2, y: 11.0 + 0.2 * s }, { x: 2, y: 11.0 }, { x: 8, y: 11.35 }], LVL.peri, 0.15);
      dot({ x: 4.7, y: 12.55 }, 1.15, 110); dot({ x: 4.7, y: 12.55 }, 0.98 + 0.05 * s, LVL.blood);
      // aortic root (anterior wall continues from the septum, posterior wall continues into the anterior mitral leaflet)
      const aw = [{ x: 0.7, y: 4.75 }, { x: 1.6, y: 4.7 }, { x: 2.5, y: 4.35 }, { x: 3.5, y: 4.5 }, { x: 4.6, y: 4.85 }, { x: 8, y: 4.9 }];
      const pw = [{ x: 1.5, y: 7.85 }, { x: 2.5, y: 8.2 }, { x: 3.5, y: 8.05 }, { x: 4.6, y: 7.75 }, { x: 8, y: 7.7 }];
      fill(aw.concat(pw.slice().reverse()), LVL.blood);
      // left atrium
      const la = ell(4.5, 9.55 + 0.1 * s, 2.75 + 0.15 * s, 1.5 + 0.2 * s, 0, 6.2832, 40);
      stroke(la, LVL.wall, 0.36); fill(la, LVL.blood);
      drawLV();
      stroke(aw, LVL.root, 0.24); stroke(pw, LVL.root, 0.22);
      // papillary muscle and chordae
      g.fillStyle = gray(LVL.myo); g.beginPath(); g.ellipse(-2.6, 9.25 - 0.25 * s, 1.0, 0.45, -0.15, 0, 6.2832); g.fill();
      // mitral valve
      const aH = { x: 1.45, y: 7.8 }, pH = { x: 1.75, y: 9.75 - 0.15 * s }, co = { x: 0.1, y: 8.95 };
      const aTip = lerp(co, { x: -0.75, y: 6.55 }, mo), pTip = lerp(co, { x: 0.45, y: 9.45 }, mo);
      stroke([aTip, { x: -1.9, y: 9.0 - 0.25 * s }], 62, 0.05); stroke([pTip, { x: -1.9, y: 9.1 - 0.25 * s }], 62, 0.05);
      leaflet(aH, aTip, { x: 0.1 * (1 - mo), y: 0.28 * (1 - mo) }, 0.17);
      leaflet(pH, pTip, { x: 0, y: 0.1 }, 0.15);
      dot(pH, 0.15, 195);
      // aortic valve: closed in diastole (cusps meet in the middle), open and parallel in systole
      const c1 = { x: 1.75, y: 4.9 }, c2 = { x: 1.75, y: 7.7 };
      leaflet(c1, lerp({ x: 2.55, y: 6.3 }, { x: 2.95, y: 5.05 }, ao), { x: 0, y: 0 }, 0.12);
      leaflet(c2, lerp({ x: 2.55, y: 6.3 }, { x: 2.95, y: 7.55 }, ao), { x: 0, y: 0 }, 0.12);
      return { endo };
    }

    // ---------- apical views ----------
    const Lh = endo[0], Rh = endo[n - 1];
    const annY = (Lh.y + Rh.y) / 2;
    // pericardium around the free walls and apex
    const peri = []; for (let i = Math.round(n * 0.58); i < n; i++) peri.push(off(i, 0.1));
    stroke(peri, 185, 0.09);

    if (view === 'a4c') {
      const iA = Math.round(n * 0.36), Ts = epi[4], rvApex = epi[iA];
      const TL = { x: -4.75 - dil, y: 11.3 - 1.25 * s * rvMove };
      const fw = bez(TL, { x: -5.05 - dil * 1.2, y: 8.7 - 0.6 * s * rvMove }, { x: -3.4 - dil * 0.8, y: 5.3 }, rvApex, 30).map((p, i) => ({ x: p.x + (-1.2 - p.x) * 0.2 * s * rvMove * Math.sin(Math.PI * i / 30), y: p.y }));
      // atria (drawn first so the ventricles overlap them at the annulus)
      const ra = ell((Ts.x + TL.x) / 2 - 0.15, (Ts.y + TL.y) / 2 + 2.3 + 0.2 * s, 2.52 + dil * 0.4, 2.45 + 0.25 * s, 0, 6.2832, 44);
      const la = ell((Lh.x + Rh.x) / 2 + 0.05, annY + 2.3 + 0.2 * s, 2.52, 2.4 + 0.25 * s, 0, 6.2832, 44);
      stroke(ra, LVL.wall, 0.36); fill(ra, LVL.blood);
      stroke(la, LVL.wall, 0.36); fill(la, LVL.blood);
      g.fillStyle = gray(LVL.blood); g.beginPath(); g.ellipse(3.9, annY + 4.2, 0.7, 0.36, 0.5, 0, 6.2832); g.fill();   // pulmonary vein
      // right ventricle
      stroke(fw, LVL.myo, 0.72);
      fill([Ts].concat(epi.slice(5, iA + 1), fw.slice().reverse()), LVL.blood);
      stroke([epi[Math.round(n * 0.27)], fw[Math.round(30 * 0.72)]], 52, 0.18);      // moderator band
      drawLV();
      // interatrial septum with a thin fossa ovalis (classic dropout)
      const cr = { x: (Lh.x + Ts.x) / 2 - 0.05, y: Math.max(Lh.y, Ts.y) + 0.1 };
      stroke([cr, add(cr, -0.1, 1.2)], 120, 0.26); stroke([add(cr, -0.1, 1.2), add(cr, -0.22, 2.7)], 60, 0.08); stroke([add(cr, -0.22, 2.7), add(cr, -0.3, 4.3)], 120, 0.24);
      dot(cr, 0.22, 170);
      // valves
      const cm = add(lerp(Lh, Rh, 0.55), 0, -0.55), ct = add(lerp(Ts, TL, 0.45), 0, -0.5);
      leaflet(Lh, lerp(cm, add(Lh, 0.82, -2.05), mo), { x: -0.12, y: 0.12 * (1 - mo) }, 0.17);
      leaflet(Rh, lerp(cm, add(Rh, -0.6, -1.15), mo), { x: 0.1, y: 0 }, 0.15);
      leaflet(Ts, lerp(ct, add(Ts, -0.45, -1.35), mo), { x: 0.1, y: 0 }, 0.13);
      leaflet(TL, lerp(ct, add(TL, 0.85, -1.6), mo), { x: -0.1, y: 0 }, 0.13);
      dot(Rh, 0.14, 190); dot(TL, 0.12, 160);
    } else if (view === 'a2c') {
      const la = ell((Lh.x + Rh.x) / 2, annY + 2.35 + 0.2 * s, 2.3, 2.45 + 0.25 * s, 0, 6.2832, 44);
      stroke(la, LVL.wall, 0.36); fill(la, LVL.blood);
      g.fillStyle = gray(LVL.blood);
      g.beginPath(); g.ellipse(Rh.x + 1.0, Rh.y + 1.0, 0.5, 1.0, -0.5, 0, 6.2832); g.fill();          // left atrial appendage
      dot(add(Lh, -0.55, 0.5), 0.34, LVL.blood);                                                        // coronary sinus
      drawLV();
      const cm = add(lerp(Lh, Rh, 0.5), 0, -0.55);
      leaflet(Lh, lerp(cm, add(Lh, 0.7, -1.5), mo), { x: -0.1, y: 0 }, 0.15);
      leaflet(Rh, lerp(cm, add(Rh, -0.75, -1.9), mo), { x: 0.1, y: 0.1 * (1 - mo) }, 0.17);
      dot(Lh, 0.14, 190); dot(Rh, 0.14, 190);
    } else { // a3c
      const AM = add(lerp(Lh, Rh, 0.6), 0, 0.3);                    // aorto-mitral curtain
      const d = { x: 0.42, y: 0.907 };                               // direction of the aortic root
      const antWall = [Rh, add(Rh, 0.75, 1.0), add(Rh, 1.35, 2.2), add(Rh, 1.75, 4.2)];
      const postWall = [AM, add(AM, 0.15, 1.15), add(AM, 0.85, 2.3), add(AM, 1.6, 4.1)];
      const la = ell((Lh.x + AM.x) / 2 - 0.35, annY + 2.45 + 0.2 * s, 2.05, 2.2 + 0.25 * s, 0, 6.2832, 44);
      stroke(la, LVL.wall, 0.36); fill(la, LVL.blood);
      fill([Rh].concat(antWall.slice(1), postWall.slice().reverse()), LVL.blood);
      drawLV();
      fill([Lh, AM, Rh, endo[n - 2], endo[1]], LVL.blood);           // open the LVOT below the cavity
      stroke(antWall, LVL.root, 0.22); stroke(postWall, LVL.root, 0.2);
      const cm = add(lerp(Lh, AM, 0.5), 0.1, -0.6);
      leaflet(AM, lerp(cm, add(AM, -0.35, -2.2), mo), { x: 0.12, y: 0.1 * (1 - mo) }, 0.17);
      leaflet(Lh, lerp(cm, add(Lh, 0.75, -1.2), mo), { x: -0.1, y: 0 }, 0.15);
      const v1 = add(Rh, 0.55, 0.75), v2 = add(AM, 0.1, 0.9), vc = add(lerp(v1, v2, 0.5), -0.1, -0.15);
      leaflet(v1, lerp(vc, add(v1, d.x * 1.0 + 0.05, d.y * 1.0), ao), { x: 0, y: 0 }, 0.12);
      leaflet(v2, lerp(vc, add(v2, d.x * 1.0 + 0.1, d.y * 1.0), ao), { x: 0, y: 0 }, 0.12);
      dot(Lh, 0.14, 190);
    }
    return { endo };
  };

  P.draw = function (time) {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = c.clientWidth || 400, ch = c.clientHeight || 400;
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    const geo = this._geometry();
    const L = lut(geo.v.depth), F = fields();

    // cardiac cycle
    const hr = 66 / 60, ph = ((time * this.speed) * hr) % 1, sm = CL.smooth;
    const s = CL.clamp(ph < 0.36 ? Math.sin(ph / 0.36 * Math.PI / 2) : Math.max(0, 1 - (ph - 0.36) / 0.14), 0, 1);
    const mo = ph < 0.41 ? 0 : ph < 0.5 ? sm(0.41, 0.5, ph) : ph < 0.74 ? 1 - 0.6 * sm(0.5, 0.74, ph) : ph < 0.9 ? 0.4 + 0.45 * sm(0.76, 0.88, ph) : 0.85 * (1 - sm(0.9, 0.99, ph));
    const ao = sm(0.05, 0.1, ph) * (1 - sm(0.33, 0.39, ph));
    this.phase = s;

    // 1. anatomy -> echogenicity map
    const ex = this.ex;
    ex.setTransform(1, 0, 0, 1, 0, 0);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, EW, EH);
    ex.setTransform(L.sc, 0, 0, L.sc, L.ox, L.oy);
    const res = this._anatomy(ex, geo, s, mo, ao);

    // 2. ultrasound image formation
    const E = ex.getImageData(0, 0, EW, EH).data, out = this.img.data;
    const [g1, g2, g3, g4] = F.g, bn = F.bn, gam = F.gam;
    const phi = time * 1.25, ca = Math.cos(phi), sa = Math.sin(phi);
    const fr = (this.frame = (this.frame + 1) & 1023) * 131;
    const pix = L.pix, polar = L.polar, back = L.back, att = L.att, near = L.near;
    for (let i = 0, n = L.n; i < n; i++) {
      const k = pix[i] << 2, pi = polar[i];
      const e = E[k] * 0.003922, eb = E[back[i] << 2] * 0.003922;
      const re = ca * g1[pi] + sa * g2[pi], im = ca * g3[pi] + sa * g4[pi];
      const m = Math.sqrt(re * re + im * im) * 0.8;                 // Rayleigh speckle, mean ~1
      let I = e < 0.06 ? e * (0.25 + 1.7 * bn[(i * 7 + fr) & 4095]) : e * (0.22 + 0.78 * m);
      const de = e - eb;
      I += (de > 0 ? de : -0.5 * de) * 0.62 * (0.4 + 0.6 * m);    // specular reflection at interfaces facing the beam
      I = I * att[i] + near[i] * 0.42 * m + 0.03 * bn[(i * 13 + fr) & 4095];   // + electronic noise floor
      const v = gam[I >= 1 ? 1024 : I <= 0 ? 0 : (I * 1024) | 0];
      out[k] = v * 0.95; out[k + 1] = v * 0.975; out[k + 2] = v;
    }
    this.ox.putImageData(this.img, 0, 0);

    // 3. display
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const k = Math.min(W / EW, H / EH), offX = (W - EW * k) / 2, offY = (H - EH * k) / 2;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(this.o, offX, offY, EW * k, EH * k);
    const X = (x) => offX + (L.ox + x * L.sc) * k, Y = (y) => offY + (L.oy + y * L.sc) * k;

    // segment overlay (clipped to the sector)
    const endo = res.endo, lvp = geo.lv;
    g.save();
    g.beginPath(); g.moveTo(X(0), Y(0)); g.arc(X(0), Y(0), geo.v.depth * L.sc * k, Math.PI / 2 - HALF, Math.PI / 2 + HALF); g.closePath(); g.clip();
    if (this.labels) {
      const T = CL.data.segTerritory;
      const groups = {};
      endo.forEach((p, i) => { (groups[p.seg] = groups[p.seg] || []).push(i); });
      Object.keys(groups).forEach((key) => {
        const segN = +key, idx = groups[key];
        const scr = this.scores[segN] || 1;
        const col = scr === 1 ? CL.color({ LAD: 'lad', RCA: 'rca', LCx: 'lcx' }[T[segN]]) : scr === 2 ? CL.color('warn') : scr === 3 ? CL.color('bad') : CL.color('ramus');
        g.strokeStyle = col; g.lineWidth = (scr === 1 ? 1.6 : 3.5) * dpr; g.globalAlpha = scr === 1 ? 0.7 : 0.95;
        g.beginPath();
        idx.forEach((i, j) => g[j ? 'lineTo' : 'moveTo'](X(endo[i].x), Y(endo[i].y)));
        g.stroke(); g.globalAlpha = 1;
        const mi = idx[Math.floor(idx.length / 2)], mid = endo[mi], q = lvp[mi];
        g.font = `600 ${11 * dpr}px "IBM Plex Mono", monospace`;
        g.fillStyle = col; g.textAlign = 'center';
        g.fillText(String(segN), X(mid.x + (q.tx - q.x) * 0.26), Y(mid.y + (q.ty - q.y) * 0.26) + 4 * dpr);
      });
    }
    // chamber labels, depth scale, ECG
    g.textAlign = 'center';
    g.fillStyle = 'rgba(160,200,215,0.85)'; g.font = `${10 * dpr}px "IBM Plex Mono", monospace`;
    if (this.labels) (geo.v.labels || []).forEach(([t, x, y]) => g.fillText(t, X(x), Y(y)));
    g.restore();
    g.textAlign = 'left';
    const depth = geo.v.depth, edge = (d) => X(d * Math.sin(HALF)) + 6 * dpr;
    g.fillStyle = 'rgba(200,215,225,0.8)';
    for (let d = 1; d <= depth; d++) {
      const yy = Y(d * Math.cos(HALF)), xx = edge(d);
      g.fillRect(xx, yy, (d % 5 === 0 ? 7 : 3) * dpr, 1 * dpr);
      if (d % 5 === 0) g.fillText(String(d), xx + 9 * dpr, yy + 3.5 * dpr);
    }
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(X(0) + 16 * dpr, Y(0) + 5 * dpr, 3 * dpr, 0, 6.2832); g.fill();   // probe index marker
    g.fillStyle = 'rgba(190,215,225,0.9)';
    g.fillText(VIEWS[this.view].name.toUpperCase(), 8 * dpr, 15 * dpr);
    g.fillStyle = 'rgba(150,175,185,0.8)';
    g.fillText('SIMULATED · ' + depth + ' cm · ' + (s > 0.15 ? 'systole' : 'diastole'), 8 * dpr, 29 * dpr);
    const ew = Math.min(150 * dpr, W * 0.34), ex0 = 8 * dpr, ey = H - 14 * dpr;
    g.strokeStyle = '#4fe28a'; g.lineWidth = 1.2 * dpr; g.beginPath();
    for (let i = 0; i <= 140; i++) {
      const t = i / 140, v = CL.gauss(t, 0.05, 0.008) - 0.2 * CL.gauss(t, 0.07, 0.008) + 0.25 * CL.gauss(t, 0.33, 0.04) + 0.1 * CL.gauss(t, 0.9, 0.025);
      g[i ? 'lineTo' : 'moveTo'](ex0 + t * ew, ey - v * 15 * dpr);
    }
    g.stroke();
    g.fillStyle = '#fff'; g.fillRect(ex0 + ((ph + 0.05) % 1) * ew, ey - 17 * dpr, 1.5 * dpr, 22 * dpr);
  };
  CL.Echo.VIEWS = VIEWS;
})();
