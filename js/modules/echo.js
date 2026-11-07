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

  /* ---------------- animated views ---------------- */
  function noiseCanvas(mean, spread, seed, stretch) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d'); const img = g.createImageData(128, 128); const r = CL.rng(seed);
    const row = new Float32Array(128);
    for (let y = 0; y < 128; y++) {
      let prev = 0;
      for (let x = 0; x < 128; x++) { const n = r(); prev = prev * stretch + n * (1 - stretch); row[x] = prev; }
      for (let x = 0; x < 128; x++) {
        const v = CL.clamp(mean + (row[x] - 0.5) * spread * 2.4 + (r() - 0.5) * spread * 0.6, 0, 255);
        const i = (y * 128 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // LV half-ellipse contour for apical views; returns endo points with segment ids
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

  const VIEWS = {
    a4c: {
      name: 'Apical 4-chamber', shows: 'Inferoseptum (3, 9, 14) and anterolateral wall (6, 12, 16), plus the apex.',
      lv: () => apicalLV(1.9, 2.15, 8.8, 11.9, [3, 9, 14], [6, 12, 16], 60),
      ctx: { rv: { cx: -2.75, a: 1.45, b: 6.6, yb: 11.9 }, atria: [{ cx: 1.95, cy: 13.5, a: 2.05, b: 2.2, name: 'LA' }, { cx: -2.75, cy: 13.5, a: 1.8, b: 2.1, name: 'RA' }], labels: [['LV', 1.9, 7.5], ['RV', -2.8, 9.2], ['LA', 1.9, 14.2], ['RA', -2.8, 14.2]] },
    },
    a2c: {
      name: 'Apical 2-chamber', shows: 'Inferior wall (4, 10, 15) and anterior wall (1, 7, 13).',
      lv: () => apicalLV(0.3, 2.2, 8.9, 11.9, [4, 10, 15], [1, 7, 13], 60),
      ctx: { atria: [{ cx: 0.3, cy: 13.5, a: 2.1, b: 2.2, name: 'LA' }], labels: [['LV', 0.3, 7.5], ['LA', 0.3, 14.2]] },
    },
    a3c: {
      name: 'Apical 3-chamber (long axis)', shows: 'Inferolateral wall (5, 11) and anteroseptum (2, 8) with the LVOT and aortic valve. Apical segments in this view are assigned inconsistently between references.',
      lv: () => apicalLV(0.1, 2.2, 8.9, 11.9, [5, 11, 16], [2, 8, 13], 60),
      ctx: { atria: [{ cx: -0.7, cy: 13.6, a: 1.8, b: 2.1, name: 'LA' }], aorta: true, labels: [['LV', 0.1, 7.5], ['LA', -0.8, 14.3], ['Ao', 2.6, 14.4]] },
    },
    psax: {
      name: 'Parasternal short axis (mid)', shows: 'All six mid segments (7–12) in one ring: the best single view for territories. RV on the left.',
      ring: true,
    },
    plax: {
      name: 'Parasternal long axis', shows: 'Anteroseptum (2, 8) on top and inferolateral wall (5, 11) below. The apex is usually cut off.',
      plax: true,
    },
  };

  function ringLV() {
    const pts = [], N = 72, cx = 0, cy = 8.6, r = 2.35;
    const segFor = (deg) => {
      const d = ((deg % 360) + 360) % 360;
      if (d >= 300) return 12; if (d < 60) return 11; if (d < 120) return 10; if (d < 180) return 9; if (d < 240) return 8; return 7;
    };
    for (let i = 0; i < N; i++) {
      const deg = i * 360 / N;
      const a = deg * Math.PI / 180;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), seg: segFor(deg), tx: cx, ty: cy, basal: 0 });
    }
    pts.closed = true;
    return pts;
  }
  function plaxLV() {
    const pts = [];
    const top = (x) => 5.3 + 1.5 * Math.pow(CL.clamp((-x - 3.2) / 3.4, 0, 1), 2);
    const bot = (x) => 9.7 - 1.5 * Math.pow(CL.clamp((-x - 3.2) / 3.4, 0, 1), 2);
    const segX = (x, upper) => (x > -2.2 ? (upper ? 2 : 5) : x > -5 ? (upper ? 8 : 11) : 17);
    for (let x = 0.9; x >= -6.6; x -= 0.2) pts.push({ x, y: top(x), seg: segX(x, true), tx: Math.max(x, -5.2), ty: 7.5, basal: 0 });
    for (let x = -6.6; x <= 1.7; x += 0.2) pts.push({ x, y: bot(x), seg: segX(x, false), tx: Math.max(x, -5.2), ty: 7.5, basal: 0 });
    return pts;
  }

  CL.Echo.View = function (canvas) {
    this.canvas = canvas;
    this.view = 'a4c';
    this.scores = {};
    this.rv = false;
    this.chronic = false;
    this.labels = true;
    this.speed = 1;
    this.tissue = noiseCanvas(150, 55, 7, 0.55);
    this.scar = noiseCanvas(215, 30, 9, 0.5);
    this.blood = noiseCanvas(14, 9, 11, 0.3);
    this.peri = noiseCanvas(200, 45, 13, 0.6);
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  };
  const P = CL.Echo.View.prototype;
  P.set = function (o) { Object.assign(this, o); this._geom = null; };
  P._geometry = function () {
    if (this._geom && this._geom.view === this.view) return this._geom;
    const v = VIEWS[this.view];
    let lv;
    if (v.ring) lv = ringLV(); else if (v.plax) lv = plaxLV(); else lv = v.lv();
    this._geom = { view: this.view, lv, v };
    return this._geom;
  };
  P._motionAt = function (pts) {
    const raw = pts.map((p) => (this.chronic && (this.scores[p.seg] || 1) >= 3 ? Math.min(0, MOTION[this.scores[p.seg]]) : MOTION[this.scores[p.seg] || 1]));
    // smooth across segment borders
    const n = raw.length, out = new Float32Array(n), w = 3;
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -w; k <= w; k++) { let j = i + k; if (pts.closed) j = (j + n) % n; if (j < 0 || j >= n) continue; s += raw[j]; c++; }
      out[i] = s / c;
    }
    return out;
  };
  P._loop = function (now) {
    requestAnimationFrame(this._loop);
    if (!this.canvas.isConnected || this.canvas.offsetParent === null) return;
    this.draw(now / 1000);
  };
  P.draw = function (time) {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = c.clientWidth || 400, ch = c.clientHeight || 400;
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const geo = this._geometry();
    const plax = !!geo.v.plax, ring = !!geo.v.ring;
    const depth = plax ? 14 : ring ? 13.5 : 17;
    const sc = (H * 0.96) / depth;
    const ox = W / 2, oy = H * 0.02;
    const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
    // sector clip
    g.save();
    g.beginPath();
    const half = (plax ? 46 : ring ? 42 : 40) * Math.PI / 180;
    g.moveTo(ox, oy);
    g.arc(ox, oy, depth * sc, Math.PI / 2 - half, Math.PI / 2 + half);
    g.closePath();
    g.clip();
    g.fillStyle = g.createPattern(this.blood, 'repeat'); g.fillRect(0, 0, W, H);

    const hr = 66 / 60, ph = ((time * this.speed) * hr) % 1;
    const sys = ph < 0.36 ? Math.sin(ph / 0.36 * Math.PI / 2) * (ph < 0.3 ? 1 : 1 - (ph - 0.3) / 0.06 * 0.0) : Math.max(0, 1 - (ph - 0.36) / 0.14);
    const s = CL.clamp(sys, 0, 1);
    this.phase = s;

    const tissueP = g.createPattern(this.tissue, 'repeat');
    const scarP = g.createPattern(this.scar, 'repeat');
    const periP = g.createPattern(this.peri, 'repeat');
    const band = (pts, thick, pattern, closed) => {
      // quads between a polyline and its outward offset
      const n = pts.length;
      const normals = pts.map((p, i) => {
        const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        let nx = b.y - a.y, ny = -(b.x - a.x); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        return [nx, ny];
      });
      g.fillStyle = pattern;
      g.beginPath();
      for (let i = 0; i < n; i++) g[i ? 'lineTo' : 'moveTo'](X(pts[i].x), Y(pts[i].y));
      for (let i = n - 1; i >= 0; i--) { const t = typeof thick === 'function' ? thick(i) : thick; g.lineTo(X(pts[i].x + normals[i][0] * t), Y(pts[i].y + normals[i][1] * t)); }
      g.closePath(); g.fill();
      return normals;
    };
    const ellipsePts = (cx, cy, a, b, a0, a1, N) => { const out = []; for (let i = 0; i <= N; i++) { const t = a0 + (a1 - a0) * i / N; out.push({ x: cx + a * Math.cos(t), y: cy + b * Math.sin(t) }); } return out; };

    // ---- context structures ----
    const rvMove = this.rv ? 0.05 : 1;
    if (geo.v.ctx && geo.v.ctx.rv) {
      const r = geo.v.ctx.rv, dil = this.rv ? 1.25 : 1;
      const a = r.a * dil * (1 - 0.18 * s * rvMove);
      const pts = ellipsePts(r.cx - (dil - 1) * 1.2, r.yb, a, r.b * (1 - 0.06 * s * rvMove), Math.PI, Math.PI * 1.5, 30);
      band(pts.slice().reverse(), 0.45, tissueP, false);
    }
    if (geo.v.ctx && geo.v.ctx.atria) geo.v.ctx.atria.forEach((at) => {
      const pts = ellipsePts(at.cx, at.cy, at.a * (1 + 0.05 * s), at.b * (1 + 0.05 * s), -0.62, Math.PI + 0.62, 34);
      band(pts, 0.3, tissueP, false);
    });
    if (geo.v.ctx && geo.v.ctx.aorta) {
      g.strokeStyle = periP; g.lineWidth = 0.35 * sc;
      g.beginPath(); g.moveTo(X(2.3), Y(11.6)); g.quadraticCurveTo(X(3.2), Y(13.2), X(4.6), Y(15.5)); g.stroke();
      g.beginPath(); g.moveTo(X(0.9), Y(12.4)); g.quadraticCurveTo(X(1.7), Y(14.2), X(2.6), Y(16.4)); g.stroke();
    }
    if (ring) {
      // RV crescent on the left
      const pts = ellipsePts(-1.2, 8.4, 4.4 * (this.rv ? 1.15 : 1) * (1 - 0.05 * s * rvMove), 3.4, Math.PI * 0.62, Math.PI * 1.38, 30);
      band(pts, 0.4, tissueP, false);
    }
    if (plax) {
      g.fillStyle = tissueP;
      // RV free wall, pericardium
      g.fillRect(X(-9), Y(2.3), 18 * sc, 0.5 * sc);
      g.fillStyle = periP; g.fillRect(X(-9), Y(11.0 + 0.15 * s), 18 * sc, 0.55 * sc);
      // aortic root and LA
      g.fillStyle = tissueP;
      g.fillRect(X(0.9), Y(4.9), 6 * sc, 0.4 * sc);
      g.fillRect(X(1.6), Y(7.9), 5.5 * sc, 0.4 * sc);
      const la = ellipsePts(4.4, 9.4, 2.4, 1.5, 0.05, Math.PI - 0.05, 24);
      band(la, 0.3, tissueP, false);
      // aortic valve cusps (open in systole)
      g.strokeStyle = '#bbb'; g.lineWidth = 1.5 * dpr;
      const ao = s;
      g.beginPath(); g.moveTo(X(2.4), Y(5.3)); g.lineTo(X(2.4 + 1.1 * (0.3 + ao * 0.7)), Y(5.3 + 1.2 * (1 - ao) + 0.05)); g.stroke();
      g.beginPath(); g.moveTo(X(2.4), Y(7.9)); g.lineTo(X(2.4 + 1.1 * (0.3 + ao * 0.7)), Y(7.9 - 1.2 * (1 - ao) - 0.05)); g.stroke();
    }
    // ---- LV ----
    const lv = geo.lv;
    const m = this._motionAt(lv);
    const endo = lv.map((p, i) => {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const k = (ring ? 0.33 : plax ? 0.36 : 0.3) * m[i] * s;
      let x = p.x + dx * k, y = p.y + dy * k;
      if (!ring && !plax) y -= 1.0 * s * Math.max(0.2, m[i]) * p.basal * 0.9; // base descends toward the apex
      return { x, y, seg: p.seg };
    });
    const thick = (i) => {
      const scr = this.scores[lv[i].seg] || 1;
      const base = this.chronic && scr >= 3 ? 0.55 : 1.0;
      return base * (1 + 0.42 * Math.max(-0.4, m[i]) * s);
    };
    // myocardium (outward = left of travel for apical chains; computed normals point outward by construction)
    const closed = !!lv.closed;
    const orient = ring ? -1 : plax ? -1 : -1;
    const n = endo.length;
    const normals = endo.map((p, i) => {
      const a = endo[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = endo[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let nx = (b.y - a.y) * orient, ny = -(b.x - a.x) * orient; const l = Math.hypot(nx, ny) || 1; return [nx / l, ny / l];
    });
    // keep normals pointing away from the cavity target
    normals.forEach((nv, i) => { const p = lv[i]; if (nv[0] * (p.x - p.tx) + nv[1] * (p.y - p.ty) < 0) { nv[0] = -nv[0]; nv[1] = -nv[1]; } });
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const j = (i + 1) % n;
      const a = endo[i], b = endo[j];
      const ta = thick(i), tb = thick(j);
      const scarSeg = this.chronic && (this.scores[lv[i].seg] || 1) >= 3;
      g.fillStyle = scarSeg ? scarP : tissueP;
      g.beginPath();
      g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(b.x), Y(b.y));
      g.lineTo(X(b.x + normals[j][0] * tb), Y(b.y + normals[j][1] * tb));
      g.lineTo(X(a.x + normals[i][0] * ta), Y(a.y + normals[i][1] * ta));
      g.closePath(); g.fill();
    }
    // papillary muscles (PSAX)
    if (ring) {
      g.fillStyle = tissueP;
      [[25, 1.7], [130, 1.7]].forEach(([deg, r]) => { const a = deg * Math.PI / 180, rr = r * (1 - 0.25 * s); g.beginPath(); g.ellipse(X(rr * Math.cos(a)), Y(8.6 + rr * Math.sin(a)), 0.38 * sc, 0.3 * sc, a, 0, Math.PI * 2); g.fill(); });
    }
    // mitral valve (apical views)
    if (!ring && !plax) {
      const L0 = endo[0], R0 = endo[endo.length - 1];
      const open = 1 - s;
      const len = 1.6;
      g.strokeStyle = '#d0d0d0'; g.lineWidth = 2 * dpr;
      const leaf = (p, dir) => {
        const closedA = dir > 0 ? 0.12 : Math.PI - 0.12, openA = dir > 0 ? -Math.PI / 2 + 0.3 : -Math.PI / 2 - 0.3;
        const ang = closedA + (openA - closedA) * open;
        g.beginPath(); g.moveTo(X(p.x), Y(p.y)); g.lineTo(X(p.x + Math.cos(ang) * len), Y(p.y + Math.sin(ang) * len)); g.stroke();
      };
      leaf(L0, 1); leaf(R0, -1);
    }
    if (plax) {
      const hinge1 = { x: 1.6, y: 8.1 }, hinge2 = { x: 1.8, y: 9.7 };
      const open = 1 - s;
      g.strokeStyle = '#d0d0d0'; g.lineWidth = 2 * dpr;
      g.beginPath(); g.moveTo(X(hinge1.x), Y(hinge1.y)); g.lineTo(X(hinge1.x - 1.9 * (0.3 + 0.7 * open)), Y(hinge1.y + 0.9 * (1 - open) - 0.1)); g.stroke();
      g.beginPath(); g.moveTo(X(hinge2.x), Y(hinge2.y)); g.lineTo(X(hinge2.x - 1.2 * (0.3 + 0.7 * open)), Y(hinge2.y - 0.7 * (1 - open))); g.stroke();
    }
    g.restore();

    // overlays: segment borders and numbers
    if (this.labels) {
      const T = CL.data.segTerritory;
      const groups = {};
      endo.forEach((p, i) => { (groups[p.seg] = groups[p.seg] || []).push(i); });
      Object.keys(groups).forEach((k) => {
        const segN = +k, idx = groups[k];
        const scr = this.scores[segN] || 1;
        const col = scr === 1 ? CL.color({ LAD: 'lad', RCA: 'rca', LCx: 'lcx' }[T[segN]]) : scr === 2 ? CL.color('warn') : scr === 3 ? CL.color('bad') : CL.color('ramus');
        g.strokeStyle = col; g.lineWidth = (scr === 1 ? 2 : 4) * dpr; g.globalAlpha = scr === 1 ? 0.75 : 0.95;
        g.beginPath();
        idx.forEach((i, j) => g[j ? 'lineTo' : 'moveTo'](X(endo[i].x), Y(endo[i].y)));
        g.stroke(); g.globalAlpha = 1;
        const mid = endo[idx[Math.floor(idx.length / 2)]], lvp = lv[idx[Math.floor(idx.length / 2)]];
        const lx = mid.x + (lvp.tx - lvp.x) * 0.28, ly = mid.y + (lvp.ty - lvp.y) * 0.28;
        g.font = `600 ${11 * dpr}px "IBM Plex Mono", monospace`;
        g.fillStyle = col; g.textAlign = 'center';
        g.fillText(String(segN), X(lx), Y(ly) + 4 * dpr);
      });
    }
    // labels and HUD
    g.textAlign = 'left';
    g.fillStyle = '#8fb6c4'; g.font = `${11 * dpr}px "IBM Plex Mono", monospace`;
    (geo.v.ctx && geo.v.ctx.labels || []).forEach(([t, x, y]) => g.fillText(t, X(x) - 8 * dpr, Y(y)));
    if (plax) { g.fillText('RV', X(-2.5), Y(3.9)); g.fillText('LV', X(-2.5), Y(7.7)); g.fillText('Ao', X(3.8), Y(6.8)); g.fillText('LA', X(4.0), Y(9.9)); }
    if (ring) { g.fillText('LV', X(-0.3), Y(8.8)); g.fillText('RV', X(-4.2), Y(8.6)); }
    g.fillText(VIEWS[this.view].name.toUpperCase(), 10 * dpr, 18 * dpr);
    g.fillText(s > 0.15 ? 'SYSTOLE' : 'DIASTOLE', 10 * dpr, 34 * dpr);
    // mini ECG with marker
    const ex = W - 150 * dpr, ey = 26 * dpr;
    g.strokeStyle = '#4fe28a'; g.lineWidth = 1.2 * dpr; g.beginPath();
    for (let i = 0; i <= 140; i++) {
      const t = i / 140, v = CL.gauss(t, 0.05, 0.008) * 1 - 0.2 * CL.gauss(t, 0.07, 0.008) + 0.25 * CL.gauss(t, 0.33, 0.04) + 0.1 * CL.gauss(t, 0.9, 0.025);
      g[i ? 'lineTo' : 'moveTo'](ex + i * dpr, ey - v * 16 * dpr);
    }
    g.stroke();
    g.fillStyle = '#fff'; g.fillRect(ex + ph * 140 * dpr, ey - 18 * dpr, 1.5 * dpr, 24 * dpr);
  };
  CL.Echo.VIEWS = VIEWS;
})();
