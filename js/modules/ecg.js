/* Synthetic 12-lead ECG generator (25 mm/s, 10 mm/mV). Teaching waveforms built from Gaussian P-QRS-T components
   with per-lead ST/T changes driven by a culprit scenario. */
(function () {
  'use strict';
  const CL = window.CL;
  const S = CL.svg;
  const G = CL.gauss;

  // baseline morphology per lead (mV): P, Q, R, S, T
  const BASE = {
    I: [0.10, -0.05, 0.70, -0.10, 0.22], II: [0.15, -0.05, 1.10, -0.15, 0.30], III: [0.05, 0, 0.45, -0.25, 0.10],
    aVR: [-0.12, 0, 0.10, -0.85, -0.25], aVL: [0.03, -0.04, 0.35, -0.20, 0.08], aVF: [0.10, 0, 0.80, -0.20, 0.20],
    V1: [0.05, 0, 0.20, -0.90, 0.08], V2: [0.06, 0, 0.35, -1.30, 0.35], V3: [0.06, 0, 0.70, -0.90, 0.40],
    V4: [0.06, 0, 1.20, -0.50, 0.40], V5: [0.06, -0.08, 1.20, -0.25, 0.32], V6: [0.06, -0.08, 0.95, -0.15, 0.25],
    V4R: [0.04, 0, 0.15, -0.50, 0.05], V7: [0.04, -0.04, 0.40, -0.25, 0.08], V8: [0.03, -0.03, 0.30, -0.30, 0.06], V9: [0.03, 0, 0.25, -0.30, 0.05],
  };
  const LAYOUT = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
  const EXTRA = ['V4R', 'V7', 'V8', 'V9'];

  function beats(rhythm) {
    const list = [];
    if (rhythm === 'wenck') {
      const pp = 0.72, prs = [0.2, 0.28, 0.34, null];
      let p = 0.2, k = 0;
      while (p < 10.4) {
        const pr = prs[k % 4];
        list.push({ p, qrs: pr == null ? null : p - 0.05 + pr });
        p += pp; k++;
      }
    } else {
      const rr = rhythm === 'brady' ? 60 / 48 : 60 / 76;
      for (let q = 0.32; q < 10.5; q += rr) list.push({ p: q - 0.11, qrs: q });
    }
    return list;
  }

  // per-lead modification from scenario + stage
  function leadParams(lead, sc, stage) {
    const b = BASE[lead].slice();
    const p = { P: b[0], Q: b[1], R: b[2], Sw: b[3], T: b[4], e: 0, tShape: 'normal', qWide: 0, upslope: false };
    const st = (sc.ecg.st[lead] || 0) / 10; // mV
    const special = sc.special;
    if (special === 'wellensA') {
      if (lead === 'V2' || lead === 'V3') { p.tShape = 'biphasic'; p.e = 0.03; }
      if (lead === 'V4') { p.tShape = 'biphasic'; p.T = 0.2; }
      return p;
    }
    if (special === 'wellensB') {
      const inv = { V1: -0.2, V2: -0.55, V3: -0.6, V4: -0.4, V5: -0.15 };
      if (lead in inv) { p.T = inv[lead]; p.tShape = 'symmetric'; p.e = lead === 'V2' || lead === 'V3' ? 0.03 : 0; }
      return p;
    }
    if (special === 'dewinter') {
      const j = { V1: -0.05, V2: -0.2, V3: -0.25, V4: -0.25, V5: -0.15, V6: -0.1 };
      const t = { V1: 0.3, V2: 1.1, V3: 1.25, V4: 1.0, V5: 0.7, V6: 0.45 };
      if (lead in j) { p.e = j[lead]; p.upslope = true; p.T = t[lead]; p.tShape = 'symmetric'; }
      if (lead === 'aVR') p.e = st;
      return p;
    }
    if (sc.ischemia) {
      p.e = st;
      if (st < 0) p.T *= 0.3;
      return p;
    }
    if (sc.posterior && (lead === 'V1' || lead === 'V2' || lead === 'V3')) {
      const tall = stage === 'evolved' ? 1 : stage === 'acute' ? 0.5 : 0.2;
      if (lead === 'V1') { p.R = 0.2 + 0.6 * tall; p.Sw = -0.9 + 0.6 * tall; }
      if (lead === 'V2') { p.R = 0.35 + 0.8 * tall; p.Sw = -1.3 + 0.9 * tall; }
      p.T = Math.max(p.T, 0.35);
      p.e = st * (stage === 'evolved' ? 0.4 : stage === 'hyperacute' ? 0.5 : 1);
      return p;
    }
    if (st > 0) {
      if (stage === 'hyperacute') { p.e = st * 0.35; p.T = Math.max(p.T, 0.25) * 2.4 + st; p.tShape = 'broad'; }
      else if (stage === 'acute') { p.e = st; p.T = Math.max(p.T, 0.2) * 1.3 + st * 0.6; }
      else { // evolved
        p.e = st * 0.3; p.Q = -Math.min(0.45, 0.15 + st * 0.6); p.qWide = 1; p.R *= 0.35; p.T = -Math.min(0.45, 0.15 + st * 0.5); p.tShape = 'symmetric';
      }
    } else if (st < 0) {
      if (stage === 'hyperacute') { p.e = st * 0.35; }
      else if (stage === 'acute') { p.e = st; p.T = st < -0.15 ? -0.08 : p.T * 0.4; }
      else { p.e = st * 0.15; }
    }
    return p;
  }

  function sample(lead, t, sc, stage, beatList, pars) {
    const p = pars;
    let v = 0;
    for (const b of beatList) {
      if (b.p != null && Math.abs(t - b.p) < 0.15) v += p.P * G(t, b.p, 0.025);
      if (b.qrs == null) continue;
      const dt = t - b.qrs;
      if (dt < -0.1 || dt > 0.65) continue;
      v += p.Q * G(dt, 0.014, p.qWide ? 0.012 : 0.007);
      v += p.R * G(dt, 0.04, 0.010);
      v += p.Sw * G(dt, 0.066, 0.010);
      // ST segment
      if (p.e) {
        if (p.upslope) v += p.e * CL.smooth(0.07, 0.085, dt) * (1 - CL.smooth(0.09, 0.24, dt));
        else v += p.e * CL.smooth(0.07, 0.09, dt) * (1 - CL.smooth(0.30, 0.42, dt));
      }
      // T wave
      const tp = 0.30;
      if (p.tShape === 'biphasic') {
        v += 0.18 * G(dt, 0.24, 0.035) - 0.32 * G(dt, 0.36, 0.04);
      } else if (p.tShape === 'symmetric') {
        v += p.T * G(dt, tp, 0.05);
      } else if (p.tShape === 'broad') {
        v += p.T * G(dt, tp - 0.01, dt < tp ? 0.075 : 0.055);
      } else {
        v += p.T * G(dt, tp, dt < tp ? 0.06 : 0.042);
      }
    }
    return v;
  }

  CL.ECG = {
    LAYOUT, EXTRA,
    render(sc, opts) {
      const o = Object.assign({ stage: 'acute', highlight: true, extra: false }, opts);
      const mm = 4;                         // px per mm
      const colW = 62.5 * mm;               // 2.5 s
      const rowH = 32 * mm;
      const rows = LAYOUT.length + 1 + (o.extra ? 1 : 0);
      const W = colW * 4 + 24, H = rowH * rows + 12;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '12-lead ECG: ' + sc.name, class: 'ecg-svg' });
      const defs = S('defs');
      const pid = 'ecgGrid' + Math.random().toString(36).slice(2, 7);
      const pat = S('pattern', { id: pid, width: 5 * mm, height: 5 * mm, patternUnits: 'userSpaceOnUse' });
      for (let i = 1; i < 5; i++) {
        pat.appendChild(S('line', { x1: i * mm, y1: 0, x2: i * mm, y2: 5 * mm, stroke: 'var(--paper-grid)', 'stroke-width': 0.5 }));
        pat.appendChild(S('line', { x1: 0, y1: i * mm, x2: 5 * mm, y2: i * mm, stroke: 'var(--paper-grid)', 'stroke-width': 0.5 }));
      }
      pat.appendChild(S('rect', { x: 0, y: 0, width: 5 * mm, height: 5 * mm, fill: 'none', stroke: 'var(--paper-grid-major)', 'stroke-width': 0.9 }));
      defs.appendChild(pat);
      svg.appendChild(defs);
      svg.appendChild(S('rect', { x: 0, y: 0, width: W, height: H, fill: 'var(--paper)' }));
      svg.appendChild(S('rect', { x: 12, y: 0, width: colW * 4, height: H, fill: `url(#${pid})` }));

      const bl = beats(sc.rhythm || 'sinus');
      const stage = sc.special || sc.ischemia ? 'acute' : o.stage;
      const parsCache = {};
      const pars = (lead) => parsCache[lead] || (parsCache[lead] = leadParams(lead, sc, stage));
      const trace = (lead, x0, y0, t0, t1) => {
        const pp = pars(lead);
        let d = '';
        const step = 0.004;
        for (let t = t0; t <= t1 + 1e-9; t += step) {
          const x = x0 + (t - t0) * 25 * mm;
          const y = y0 - sample(lead, t, sc, stage, bl, pp) * 10 * mm;
          d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        }
        return S('path', { d, fill: 'none', stroke: 'var(--ecg-trace)', 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
      };
      const calib = (x, y) => S('path', { d: `M${x} ${y} l${1 * mm} 0 l0 ${-10 * mm} l${5 * mm} 0 l0 ${10 * mm} l${1 * mm} 0`, fill: 'none', stroke: 'var(--ecg-trace)', 'stroke-width': 1.2 });
      const label = (lead, x, y) => {
        const st = sc.ecg.st[lead] || 0;
        const thrUp = lead === 'V4R' || /V[789]/.test(lead) ? 0.5 : 1;
        let cls = null;
        if (o.highlight && !sc.special) { if (st >= thrUp) cls = 'up'; else if (st <= -0.5) cls = 'down'; }
        if (o.highlight && sc.special === 'wellensA' && (lead === 'V2' || lead === 'V3')) cls = 'twave';
        if (o.highlight && sc.special === 'wellensB' && ['V2', 'V3', 'V4'].indexOf(lead) >= 0) cls = 'twave';
        if (o.highlight && sc.special === 'dewinter' && /^V/.test(lead)) cls = 'down';
        if (o.highlight && sc.special === 'dewinter' && lead === 'aVR') cls = 'up';
        const g = S('g');
        if (cls) {
          const col = cls === 'up' ? 'var(--bad)' : cls === 'down' ? 'var(--lcx)' : 'var(--accent)';
          g.appendChild(S('rect', { x: x - 2, y: y - 14, width: colW - 6, height: rowH - 8, fill: col, opacity: 0.045, rx: 3 }));
          g.appendChild(S('rect', { x: x - 2, y: y - 14, width: 42, height: 18, fill: col, rx: 3 }));
          g.appendChild(S('text', { x: x + 4, y: y, 'font-size': 13, 'font-weight': 600, fill: '#fff', 'font-family': 'var(--font-mono)', text: lead }));
        } else {
          g.appendChild(S('text', { x: x + 2, y: y, 'font-size': 13, 'font-weight': 600, fill: '#222', 'font-family': 'var(--font-mono)', text: lead }));
        }
        return g;
      };
      LAYOUT.forEach((row, r) => {
        const y0 = rowH * r + rowH * 0.62;
        svg.appendChild(calib(12, y0));
        row.forEach((lead, c) => {
          const x0 = 12 + c * colW;
          svg.appendChild(label(lead, x0 + 30, rowH * r + 18));
          svg.appendChild(trace(lead, x0 + (c === 0 ? 7 * mm : 0), y0, c * 2.5 + (c === 0 ? 0.28 : 0), (c + 1) * 2.5));
          if (c > 0) svg.appendChild(S('line', { x1: x0, x2: x0, y1: y0 - 6 * mm, y2: y0 + 2 * mm, stroke: 'var(--ecg-trace)', 'stroke-width': 1.2 }));
        });
      });
      let rIdx = LAYOUT.length;
      if (o.extra) {
        const y0 = rowH * rIdx + rowH * 0.62;
        svg.appendChild(calib(12, y0));
        EXTRA.forEach((lead, c) => {
          const x0 = 12 + c * colW;
          svg.appendChild(label(lead, x0 + 30, rowH * rIdx + 18));
          svg.appendChild(trace(lead, x0 + (c === 0 ? 7 * mm : 0), y0, c * 2.5 + (c === 0 ? 0.28 : 0), (c + 1) * 2.5));
        });
        rIdx++;
      }
      const yR = rowH * rIdx + rowH * 0.62;
      svg.appendChild(calib(12, yR));
      svg.appendChild(label('II', 42, rowH * rIdx + 18));
      svg.appendChild(trace('II', 12 + 7 * mm, yR, 0.28, 10));
      svg.appendChild(S('text', { x: W - 12, y: H - 6, 'text-anchor': 'end', 'font-size': 11, fill: '#555', 'font-family': 'var(--font-mono)', text: '25 mm/s · 10 mm/mV · simulated' }));
      return svg;
    },
  };
})();
