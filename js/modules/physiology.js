/* Module: coronary physiology — FFR / iFR / resting indices simulator.
   Lumped model: stenosis pressure loss dP = f*Q + s*Q^2 (Gould), microvascular resistance Rm,
   phasic coronary flow (mostly diastolic). Calibrated to typical QCA–FFR relationships; teaching model, not a calculator. */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h;

  const PV = 5;
  const CS = 0.03, CF = 0.03;
  function coeffs(ds, len) {
    const d = CL.clamp(ds, 0, 0.95);
    return { s: CS * Math.pow(1 / Math.pow(1 - d, 2) - 1, 2), f: CF * (len / 10) / Math.pow(1 - d, 4) };
  }
  function solveQ(Pa, s, f, Rm) {
    const P = Pa - PV;
    if (s < 1e-9) return P / (f + Rm);
    const b = f + Rm;
    return (-b + Math.sqrt(b * b + 4 * s * P)) / (2 * s);
  }
  // waveforms over one beat, t in [0,1)
  function aortic(t, sys, dia) {
    const pp = sys - dia;
    if (t < 0.06) return dia - 2 * Math.sin(t / 0.06 * Math.PI);
    if (t < 0.16) return dia + pp * Math.sin((t - 0.06) / 0.10 * Math.PI / 2);
    if (t < 0.36) return sys - (pp * 0.38) * Math.pow((t - 0.16) / 0.20, 1.4);
    if (t < 0.38) return sys - pp * 0.38 - pp * 0.12 * ((t - 0.36) / 0.02);           // incisura
    if (t < 0.44) return sys - pp * 0.5 + pp * 0.1 * Math.sin((t - 0.38) / 0.06 * Math.PI); // dicrotic wave
    const k = (t - 0.44) / 0.56;
    return dia + (sys - pp * 0.5 - dia) * Math.exp(-2.6 * k) - 0.0 * k;
  }
  function flowShape(t) {
    // normalized phasic LCA flow, mean ~1: low in systole, peak early diastole
    let q;
    if (t < 0.38) q = 0.35 + 0.15 * Math.sin(t / 0.38 * Math.PI);
    else { const k = (t - 0.38) / 0.62; q = 0.35 + 1.55 * Math.sin(Math.min(1, k / 0.25) * Math.PI / 2) * (1 - 0.45 * k); }
    return q;
  }
  const FLOW_MEAN = (() => { let a = 0; for (let i = 0; i < 400; i++) a += flowShape(i / 400); return a / 400; })();
  function ecgShape(t) {
    let v = 0;
    v += 0.12 * CL.gauss(t, 0.9, 0.03);
    v += -0.1 * CL.gauss(t, 0.985, 0.006) + 1.0 * CL.gauss(t, 0.0, 0.008) + 1.0 * CL.gauss(t, 1.0, 0.008) - 0.25 * CL.gauss(t, 0.02, 0.008);
    v += 0.25 * CL.gauss(t, 0.28, 0.045);
    return v;
  }

  const mod = {
    init(root) {
      this.root = root;
      this.p = { ds: 70, len: 15, micro: 'normal', damp: false, drift: false, hr: 70, sys: 125, dia: 70 };
      this.hyper = 0; this.hyperTarget = 0;
      root.appendChild(CL.ui.head('Coronary physiology', 'FFR and iFR, live',
        'Set a stenosis and watch aortic (Pa, red) and distal (Pd, yellow) pressure separate. Most coronary flow happens in diastole, so that is where the gradient opens. Give adenosine for FFR, or read iFR at rest in the wave-free window.'));

      this.canvas = h('canvas', { width: 900, height: 420, 'aria-label': 'Pressure tracings' });
      const mon = h('div', { class: 'monitor', style: { height: '420px', position: 'relative' } }, this.canvas);
      this.mon = mon;
      this.readout = h('div', { class: 'readout' });
      this.verdict = h('div', { class: 'stack', 'aria-live': 'polite' });

      const sl = (id, label, min, max, step, val, fmt, key) => CL.ui.slider({ id, label, min, max, step, value: val, format: fmt, onInput: (v) => { this.p[key] = v; this.recalc(); } });
      this.btnAdeno = h('button', { type: 'button', class: 'btn primary', onclick: () => this.toggleHyper() }, 'Start IV adenosine');
      const controls = h('div', { class: 'panel' },
        h('h3', null, 'Lesion'),
        sl('ph-ds', 'Diameter stenosis (QCA)', 0, 90, 5, this.p.ds, (v) => v + '%', 'ds'),
        sl('ph-len', 'Lesion length', 5, 40, 5, this.p.len, (v) => v + ' mm', 'len'),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Microvasculature'),
          CL.ui.segmented([{ label: 'Normal', value: 'normal' }, { label: 'Dysfunction (diabetes, LVH, acute MI)', value: 'micro' }], 'normal', (v) => { this.p.micro = v; this.recalc(); })),
        h('h3', null, 'Hyperemia'),
        h('div', { class: 'row' }, this.btnAdeno),
        h('h3', null, 'Pitfalls'),
        h('div', { class: 'stack', style: { gap: '6px' } },
          CL.ui.check({ id: 'ph-damp', label: 'Guide deep-seated (damped Pa, hyperemia blunted)', checked: false, onChange: (v) => { this.p.damp = v; this.recalc(); } }),
          CL.ui.check({ id: 'ph-drift', label: 'Sensor drift (+4 mmHg on Pd)', checked: false, onChange: (v) => { this.p.drift = v; this.recalc(); } })),
        this.readout, this.verdict);

      root.appendChild(h('div', { class: 'bench' }, h('div', { class: 'stack' }, mon), controls));

      root.appendChild(this.pullbackPanel());
      root.appendChild(this.notes());

      this.recalc();
      this._loop = this._loop.bind(this);
      this.t0 = performance.now();
      requestAnimationFrame(this._loop);
      new ResizeObserver(() => this.resize()).observe(mon);
      this.resize();
    },
    resize() {
      const r = this.mon.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(300, r.width * dpr); this.canvas.height = Math.max(200, r.height * dpr);
      this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
      this.dpr = dpr;
    },
    toggleHyper() {
      this.hyperTarget = this.hyperTarget ? 0 : 1;
      this.btnAdeno.textContent = this.hyperTarget ? 'Stop adenosine (back to rest)' : 'Start IV adenosine';
      this.ffrMin = null;
    },
    state(hyp) {
      const p = this.p;
      const c = coeffs(p.ds / 100, p.len);
      const Rrest = 85;
      const hypFactor = p.micro === 'micro' ? 1.8 : 4.0;
      let blunt = p.damp ? 0.55 : 1; // wedged guide limits achievable hyperemic flow
      const Rm = Rrest / (1 + (hypFactor - 1) * hyp * blunt);
      const Pa = (p.sys + 2 * p.dia) / 3;
      const Q = solveQ(Pa, c.s, c.f, Rm);
      return { c, Q, Rm, Pa };
    },
    beat(hyp) {
      // one beat of Pa and Pd samples (N points), using phasic flow
      const p = this.p;
      const st = this.state(hyp);
      const N = 240, Pa = new Float32Array(N), Pd = new Float32Array(N), q = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = i / N;
        let pa = aortic(t, p.sys, p.dia);
        const qi = st.Q * flowShape(t) / FLOW_MEAN;
        const dpm = st.c.f * st.Q + st.c.s * st.Q * st.Q;
        let pd = pa - dpm * (0.55 + 0.45 * qi / st.Q);
        q[i] = qi;
        Pa[i] = pa; Pd[i] = pd;
      }
      if (p.damp) {
        // damping: the guide-tip pressure loses its dicrotic notch and systolic peak
        const out = new Float32Array(N);
        let acc = Pa[0];
        for (let k = 0; k < 3; k++) for (let i = 0; i < N; i++) { acc += (Pa[i] - acc) * 0.06; out[i] = acc; }
        for (let i = 0; i < N; i++) { const pd = Pd[i] - Pa[i]; Pa[i] = out[i] - 6; Pd[i] = Pa[i] + pd; }
      }
      if (p.drift) for (let i = 0; i < N; i++) Pd[i] += 4;
      return { Pa, Pd, q, st };
    },
    indices(b) {
      const N = b.Pa.length;
      let sa = 0, sd = 0;
      for (let i = 0; i < N; i++) { sa += b.Pa[i]; sd += b.Pd[i]; }
      // wave-free period: from 25% into diastole to 5 ms before end of diastole (diastole starts ~0.38 of cycle)
      const T = 60 / this.p.hr;
      const d0 = 0.38, wf0 = d0 + 0.25 * (1 - d0), wf1 = 1 - 0.005 / T;
      let wa = 0, wd = 0, n = 0, minR = 9;
      for (let i = 0; i < N; i++) {
        const t = i / N;
        if (t >= wf0 && t <= wf1) { wa += b.Pa[i]; wd += b.Pd[i]; n++; }
        if (t > d0) minR = Math.min(minR, b.Pd[i] / b.Pa[i]);
      }
      return { pa: sa / N, pd: sd / N, ratio: sd / sa, wfRatio: wd / wa, wf0, wf1, rfr: minR };
    },
    recalc() {
      this.restBeat = this.beat(0);
      this.restIdx = this.indices(this.restBeat);
      this.hypBeat = this.beat(1);
      this.hypIdx = this.indices(this.hypBeat);
      this.ffrMin = null;
      this.updateReadout();
    },
    updateReadout() {
      const cur = this.curIdx || this.restIdx;
      const ri = { ratio: +this.restIdx.ratio.toFixed(2), wfRatio: +this.restIdx.wfRatio.toFixed(2) };
      const ffr = this.hyper > 0.95 ? +this.hypIdx.ratio.toFixed(2) : null;
      const pill = (k, v, ok, note) => h('div', { class: 'r ' + (v == null || ok == null ? '' : ok ? 'ok' : 'bad') }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v == null ? '—' : v), note ? h('span', { class: 'k', style: { textTransform: 'none', letterSpacing: 0 } }, note) : null);
      CL.clear(this.readout);
      this.readout.append(
        pill('Pa mean', cur.pa.toFixed(0) + ' mmHg', null),
        pill('Pd mean', cur.pd.toFixed(0) + ' mmHg', null),
        pill('Pd/Pa now', cur.ratio.toFixed(2), null),
        pill('iFR (rest)', ri.wfRatio.toFixed(2), +ri.wfRatio.toFixed(2) > 0.89, '≤0.89 = significant'),
        pill('Resting Pd/Pa', ri.ratio.toFixed(2), +ri.ratio.toFixed(2) > 0.91, '≤0.91 = significant'),
        pill('FFR (hyperemia)', ffr == null ? null : ffr.toFixed(2), ffr != null && +ffr.toFixed(2) > 0.8, ffr == null ? 'start adenosine' : '≤0.80 = significant'));
      CL.clear(this.verdict);
      const msgs = [];
      if (ffr != null) {
        if (ffr <= 0.8 && ri.wfRatio <= 0.89) msgs.push(['warn', 'Both FFR and iFR are positive: the lesion is hemodynamically significant. In stable angina, PCI reduces urgent revascularization (FAME 2).']);
        else if (ffr > 0.8 && ri.wfRatio > 0.89) msgs.push(['ok', 'Both negative: defer PCI and treat medically. DEFER and FAME showed deferral is safe.']);
        else msgs.push(['', 'Discordant FFR and iFR (about 20% of lesions). This is common near the cut-offs, in diffuse disease, and with microvascular dysfunction or a high-flow state. Integrate it with symptoms and imaging.']);
      } else if (ri.wfRatio <= 0.89) msgs.push(['warn', 'iFR is positive at rest. No adenosine is needed to call this lesion significant (DEFINE-FLAIR, iFR-SWEDEHEART).']);
      if (ri.wfRatio > 0.89 && ri.wfRatio <= 0.93) msgs.push(['', 'iFR in the grey zone (0.86–0.93): some labs confirm with adenosine FFR.']);
      if (ffr != null && ffr > 0.75 && ffr <= 0.82) msgs.push(['', 'FFR in the grey zone (0.75–0.82). Repeat it, check for drift, and use clinical judgement.']);
      if (this.p.micro === 'micro') msgs.push(['warn', 'Microvascular dysfunction: hyperemic flow can’t rise much, so the gradient stays small and FFR is falsely reassuring (too high). The same happens in the culprit vessel of an acute STEMI and in severe LVH or AS.']);
      if (this.p.damp) msgs.push(['warn', 'Damped Pa (no dicrotic notch) and a deep-seated guide blunt hyperemia, so FFR is overestimated. Pull the guide back from the ostium (use IV adenosine for ostial and LM lesions) and avoid side-hole guides.']);
      if (this.p.drift) msgs.push(['warn', 'Drift: Pd reads 4 mmHg high, falsely raising every ratio. Pull back to the guide tip at the end: Pd/Pa should be 0.98–1.02. If not, re-equalize and repeat.']);
      msgs.forEach(([k, t]) => this.verdict.appendChild(h('div', { class: 'callout ' + k }, t)));
    },
    _loop(now) {
      requestAnimationFrame(this._loop);
      if (CL.router.current !== 'physiology') return;
      const dt = Math.min(0.05, (now - (this._last || now)) / 1000); this._last = now;
      // adenosine onset/offset ~ 1.5 s (compressed)
      const prev = this.hyper;
      this.hyper += (this.hyperTarget - this.hyper) * Math.min(1, dt * 1.2);
      if (Math.abs(this.hyper - this.hyperTarget) < 0.01) this.hyper = this.hyperTarget;
      if (Math.abs(prev - this.hyper) > 1e-4 || !this.curBeat) {
        this.curBeat = this.beat(this.hyper);
        this.curIdx = this.indices(this.curBeat);
        this.updateReadout();
      }
      this.draw(now / 1000);
    },
    draw(t) {
      const c = this.canvas, g = c.getContext('2d');
      const W = c.width, H = c.height, dpr = this.dpr || 1;
      g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
      const top = 64 * dpr, bot = H - 30 * dpr, left = 46 * dpr, right = W - 12 * dpr;
      const y = (p) => bot - (p - 0) / 160 * (bot - top);
      // grid
      g.strokeStyle = '#13212a'; g.lineWidth = 1;
      g.font = `${11 * dpr}px "IBM Plex Mono", monospace`; g.fillStyle = '#5d7480';
      for (let p = 0; p <= 160; p += 20) { g.beginPath(); g.moveTo(left, y(p)); g.lineTo(right, y(p)); g.stroke(); if (p % 40 === 0) g.fillText(String(p), 8 * dpr, y(p) + 4 * dpr); }
      const T = 60 / this.p.hr, span = 3.2; // seconds on screen
      const pxs = (right - left) / span;
      const sweep = (t % span);
      const b = this.curBeat;
      // wave-free window shading (rest only)
      if (this.hyper < 0.5) {
        g.fillStyle = 'rgba(120,200,255,0.10)';
        for (let k = -1; k < span / T + 1; k++) {
          const x0 = left + (k * T + this.restIdx.wf0 * T) * pxs, x1 = left + (k * T + this.restIdx.wf1 * T) * pxs;
          const a = Math.max(left, x0), z = Math.min(right, x1);
          if (z > a) g.fillRect(a, top, z - a, bot - top);
        }
        g.fillStyle = 'rgba(150,210,255,0.8)'; g.fillText('wave-free period (iFR window)', left + 6 * dpr, top + 14 * dpr);
      }
      // ECG strip
      g.strokeStyle = '#4fe28a'; g.lineWidth = 1.6 * dpr; g.beginPath();
      for (let x = left; x <= right; x += 2) {
        const tt = (x - left) / pxs, ph = (tt / T) % 1;
        const v = ecgShape(ph);
        const yy = 36 * dpr - v * 20 * dpr;
        x === left ? g.moveTo(x, yy) : g.lineTo(x, yy);
      }
      g.stroke();
      const drawTrace = (arr, color) => {
        g.strokeStyle = color; g.lineWidth = 2 * dpr; g.beginPath();
        const N = arr.length;
        for (let x = left; x <= right; x += 2) {
          const tt = (x - left) / pxs, ph = (tt / T) % 1;
          const v = arr[Math.floor(ph * N) % N];
          x === left ? g.moveTo(x, y(v)) : g.lineTo(x, y(v));
        }
        g.stroke();
      };
      drawTrace(b.Pa, '#ff5f5f');
      drawTrace(b.Pd, '#ffd166');
      // sweep eraser
      const sx = left + sweep * pxs;
      g.fillStyle = '#05080a'; g.fillRect(sx, 0, 14 * dpr, H);
      // labels
      const idx = this.curIdx;
      const narrow = W / dpr < 600;
      g.font = `600 ${(narrow ? 11 : 13) * dpr}px "IBM Plex Mono", monospace`;
      if (narrow) {
        const yy = top - 22 * dpr;
        g.fillStyle = '#ff5f5f'; g.fillText(`Pa ${idx.pa.toFixed(0)}`, left, yy);
        g.fillStyle = '#ffd166'; g.fillText(`Pd ${idx.pd.toFixed(0)}`, left + 64 * dpr, yy);
        g.fillStyle = '#e6f0f3'; g.fillText(`Pd/Pa ${idx.ratio.toFixed(2)}`, left + 128 * dpr, yy);
        g.fillStyle = this.hyper > 0.5 ? '#ffb347' : '#8fb3c0'; g.fillText(this.hyper > 0.95 ? 'HYPEREMIA' : this.hyper > 0.05 ? 'ADENOSINE' : 'REST', left + 228 * dpr, yy);
        return;
      }
      g.fillStyle = '#ff5f5f'; g.fillText(`Pa ${b.Pa.reduce((a, v) => Math.max(a, v), 0).toFixed(0)}/${b.Pa.reduce((a, v) => Math.min(a, v), 999).toFixed(0)} (${idx.pa.toFixed(0)})`, right - 330 * dpr, 20 * dpr);
      g.fillStyle = '#ffd166'; g.fillText(`Pd ${b.Pd.reduce((a, v) => Math.max(a, v), 0).toFixed(0)}/${b.Pd.reduce((a, v) => Math.min(a, v), 999).toFixed(0)} (${idx.pd.toFixed(0)})`, right - 330 * dpr, 40 * dpr);
      g.fillStyle = '#e6f0f3'; g.fillText(`Pd/Pa ${idx.ratio.toFixed(2)}`, right - 120 * dpr, 20 * dpr);
      g.fillStyle = this.hyper > 0.5 ? '#ffb347' : '#8fb3c0';
      g.fillText(this.hyper > 0.95 ? 'HYPEREMIA' : this.hyper > 0.05 ? 'ADENOSINE ↑' : 'REST', right - 120 * dpr, 40 * dpr);
      g.font = `${11 * dpr}px "IBM Plex Mono", monospace`; g.fillStyle = '#5d7480';
      g.fillText('mmHg', 8 * dpr, top - 8 * dpr);
    },

    pullbackPanel() {
      const st = { a: 70, pa: 44, b: 55, pb: 16, diffuse: false };
      const svgW = 640, svgH = 230;
      const svg = CL.svg('svg', { viewBox: `0 0 ${svgW} ${svgH}`, role: 'img', 'aria-label': 'Pressure-wire pullback curve', style: 'width:100%;max-width:760px;display:block' });
      const out = h('div', { class: 'stack', 'aria-live': 'polite' });
      const self = this;
      function lesionLoss(Q, ds, len) { const c = coeffs(ds / 100, len); return c.f * Q + c.s * Q * Q; }
      function solveAll(list, diffuse) {
        // flow through serial resistances (hyperemia), returns Q
        const Pa = 90, Rm = 85 / 4;
        let lo = 0, hi = 5;
        for (let i = 0; i < 60; i++) {
          const Q = (lo + hi) / 2;
          let dp = list.reduce((acc, l) => acc + lesionLoss(Q, l.ds, l.len), 0) + (diffuse ? 0.25 * Q * 6 : 0);
          const needed = dp + Rm * Q + PV;
          if (needed > Pa) hi = Q; else lo = Q;
        }
        return (lo + hi) / 2;
      }
      function draw() {
        const S = CL.svg;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const list = [{ x: st.pa, ds: st.a, len: 10, n: 'A' }, { x: st.pb, ds: st.b, len: 10, n: 'B' }].filter((l) => l.ds > 0);
        const Q = solveAll(list, st.diffuse);
        // pressure profile from distal (x=0) to guide (x=60)
        const L = 60, pad = 40, x2px = (x) => pad + (L - x) / L * (svgW - pad * 2), y2px = (r) => 20 + (1 - r) / 0.6 * (svgH - 60);
        const pts = [];
        for (let x = 0; x <= L; x += 0.25) {
          let dp = 0;
          list.forEach((l) => { dp += lesionLoss(Q, l.ds, l.len) * (1 - CL.smooth(l.x - 2.5, l.x + 2.5, x)); });
          if (st.diffuse) dp += 0.25 * Q * 6 * ((L - x) / L);
          pts.push([x, (90 - dp) / 90]);
        }
        // grid
        [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4].forEach((r) => {
          svg.appendChild(S('line', { x1: pad, x2: svgW - pad, y1: y2px(r), y2: y2px(r), stroke: r === 0.8 ? 'var(--bad)' : 'var(--line)', 'stroke-dasharray': r === 0.8 ? '5 4' : null }));
          svg.appendChild(S('text', { x: 6, y: y2px(r) + 4, 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: r.toFixed(1) }));
        });
        svg.appendChild(S('text', { x: svgW - pad, y: svgH - 8, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'guide (ostium) →' }));
        svg.appendChild(S('text', { x: pad, y: svgH - 8, 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: '← distal sensor' }));
        // vessel cartoon
        const vy = svgH - 26;
        svg.appendChild(S('line', { x1: pad, x2: svgW - pad, y1: vy, y2: vy, stroke: 'var(--lad)', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.5 }));
        list.forEach((l) => {
          svg.appendChild(S('rect', { x: x2px(l.x) - 9, y: vy - 4 * (1 - l.ds / 100) - 1, width: 18, height: 8 * (1 - l.ds / 100) + 2, fill: 'var(--surface)' }));
          svg.appendChild(S('text', { x: x2px(l.x), y: vy - 10, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink)', 'font-family': 'var(--font-mono)', text: l.n }));
        });
        const d = pts.map((p, i) => (i ? 'L' : 'M') + x2px(p[0]).toFixed(1) + ' ' + y2px(p[1]).toFixed(1)).join(' ');
        svg.appendChild(S('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3 }));
        const ffr = pts[0][1];
        // what if each lesion is fixed alone
        const onlyB = list.filter((l) => l.n !== 'A'), onlyA = list.filter((l) => l.n !== 'B');
        const ffrIf = (lst) => { const q = solveAll(lst, st.diffuse); return (90 - lst.reduce((a, l) => a + lesionLoss(q, l.ds, l.len), 0) - (st.diffuse ? 0.25 * q * 6 : 0)) / 90; };
        const stepA = list.find((l) => l.n === 'A') ? lesionLoss(Q, st.a, 10) / 90 : 0;
        const stepB = list.find((l) => l.n === 'B') ? lesionLoss(Q, st.b, 10) / 90 : 0;
        CL.clear(out);
        out.append(h('div', { class: 'readout' },
          h('div', { class: 'r ' + (ffr > 0.8 ? 'ok' : 'bad') }, h('span', { class: 'k' }, 'Distal FFR'), h('span', { class: 'v' }, ffr.toFixed(2))),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'Step at A'), h('span', { class: 'v' }, stepA.toFixed(2))),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'Step at B'), h('span', { class: 'v' }, stepB.toFixed(2))),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'FFR if only A fixed'), h('span', { class: 'v' }, onlyB.length || st.diffuse ? ffrIf(onlyB).toFixed(2) : '1.00')),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'FFR if only B fixed'), h('span', { class: 'v' }, onlyA.length || st.diffuse ? ffrIf(onlyA).toFixed(2) : '1.00'))),
          h('p', { class: 'sub' }, 'Serial lesions share one flow. Each one hides part of the other’s gradient, so fixing the bigger step makes the remaining lesion look worse than its pullback step suggested. Treat the largest step first, then re-measure. A smooth, gradual slope with no step means diffuse disease, which responds poorly to focal stenting.'));
      }
      const mk = (id, label, key, min, max, step, fmt) => CL.ui.slider({ id, label, min, max, step, value: st[key], format: fmt, onInput: (v) => { st[key] = v; draw(); } });
      const panel = h('div', { class: 'panel' },
        h('h2', null, 'Pressure-wire pullback: serial and diffuse disease'),
        h('div', { class: 'grid-2' },
          h('div', { class: 'stack' }, mk('pb-a', 'Lesion A severity (proximal)', 'a', 0, 85, 5, (v) => v + '%'), mk('pb-pa', 'Lesion A position', 'pa', 30, 55, 1, (v) => v + ' mm from sensor')),
          h('div', { class: 'stack' }, mk('pb-b', 'Lesion B severity (distal)', 'b', 0, 85, 5, (v) => v + '%'), mk('pb-pb', 'Lesion B position', 'pb', 5, 28, 1, (v) => v + ' mm from sensor'))),
        CL.ui.check({ id: 'pb-diffuse', label: 'Add diffuse disease along the vessel', checked: false, onChange: (v) => { st.diffuse = v; draw(); } }),
        h('div', { style: { overflowX: 'auto' } }, svg), out);
      draw();
      return panel;
    },

    notes() {
      return h('div', { class: 'stack' },
        h('div', { class: 'panel' }, h('h2', null, 'Definitions and cut-offs'),
          h('div', { class: 'table-wrap' }, h('table', null,
            h('thead', null, h('tr', null, h('th', null, 'Index'), h('th', null, 'What it measures'), h('th', null, 'Hyperemia'), h('th', null, 'Ischemic if'))),
            h('tbody', null,
              h('tr', null, h('td', null, h('b', null, 'FFR')), h('td', null, 'Pd/Pa (more exactly (Pd − Pv)/(Pa − Pv)) at maximal hyperemia: the fraction of normal maximal flow the vessel can still deliver.'), h('td', null, 'Yes (adenosine)'), h('td', { class: 'mono' }, '≤0.80 (grey zone 0.75–0.80)')),
              h('tr', null, h('td', null, h('b', null, 'iFR')), h('td', null, 'Pd/Pa in the diastolic wave-free period (25% into diastole to 5 ms before systole), when microvascular resistance is naturally low and stable.'), h('td', null, 'No'), h('td', { class: 'mono' }, '≤0.89')),
              h('tr', null, h('td', null, h('b', null, 'RFR')), h('td', null, 'Lowest Pd/Pa anywhere in the cardiac cycle.'), h('td', null, 'No'), h('td', { class: 'mono' }, '≤0.89')),
              h('tr', null, h('td', null, h('b', null, 'dPR')), h('td', null, 'Mean Pd/Pa over the whole of diastole.'), h('td', null, 'No'), h('td', { class: 'mono' }, '≤0.89')),
              h('tr', null, h('td', null, h('b', null, 'Resting Pd/Pa')), h('td', null, 'Whole-cycle Pd/Pa at rest.'), h('td', null, 'No'), h('td', { class: 'mono' }, '≤0.91')),
              h('tr', null, h('td', null, h('b', null, 'QFR / angio-FFR')), h('td', null, 'FFR computed from 3D angiography plus a flow model; no wire.'), h('td', null, 'No'), h('td', { class: 'mono' }, '≤0.80')))))),
        h('div', { class: 'grid-2' },
          h('div', { class: 'panel' }, h('h2', null, 'Technique checklist'), h('ol', { class: 'prose', style: { fontSize: 'var(--step--1)' } },
            h('li', null, 'Anticoagulate; give IC nitroglycerin.'),
            h('li', null, 'Equalize with the sensor just outside the guide tip, after removing the introducer and flushing out contrast with saline.'),
            h('li', null, 'Advance the wire so the sensor (≈3 cm from the wire tip) sits well past the lesion.'),
            h('li', null, 'Check the guide is coaxial but not deep and the Pa waveform keeps its dicrotic notch; avoid side-hole guides.'),
            h('li', null, 'Measure iFR, or give hyperemia and record FFR at stable minimum Pd/Pa.'),
            h('li', null, 'Pullback for tandem or diffuse disease (IV adenosine or resting pullback).'),
            h('li', null, 'Drift check at the guide tip: Pd/Pa 0.98–1.02, otherwise re-equalize and repeat.'))),
          h('div', { class: 'panel' }, h('h2', null, 'Trials to know'), h('ul', { class: 'prose', style: { fontSize: 'var(--step--1)' } },
            h('li', null, h('b', null, 'DEFER: '), 'deferring PCI for FFR ≥0.75 was safe; at 15 years, MI 2.2% deferred vs 10% stented.'),
            h('li', null, h('b', null, 'FAME: '), 'FFR-guided multivessel PCI reduced 1-year MACE compared with angiography guidance and used fewer stents.'),
            h('li', null, h('b', null, 'FAME 2: '), 'PCI of FFR ≤0.80 lesions plus medical therapy vs medical therapy alone: 4.3% vs 12.7%, driven by urgent revascularization.'),
            h('li', null, h('b', null, 'DEFINE-FLAIR / iFR-SWEDEHEART: '), 'iFR non-inferior to FFR at 1 year (6.8% vs 7.0%; 6.7% vs 6.1%) with fewer symptoms. Longer-term pooled mortality signals are debated.'),
            h('li', null, h('b', null, 'FAME 3: '), 'FFR-guided PCI not non-inferior to CABG for 3-vessel disease at 1 year. At 5 years death/stroke/MI was similar, but MI and repeat revascularization were higher with PCI.'),
            h('li', null, h('b', null, 'FLOWER-MI: '), 'in STEMI non-culprit vessels, FFR guidance was not better than angiography guidance.'),
            h('li', null, h('b', null, 'FAVOR III: '), 'QFR beat angiography (China) but was inferior to FFR (Europe).'))),
          ),
        h('div', { class: 'callout' }, h('strong', null, 'Guideline: '), '2021 ACC/AHA/SCAI: FFR or iFR is Class 1 (LOE A) for intermediate stenoses in patients with angina and no documented ischemia. PCI is Class 3 (no benefit) when FFR >0.80 or iFR >0.89 in stable patients.'),
        CL.ui.refs([
          { t: '2021 ACC/AHA/SCAI Guideline for Coronary Revascularization — Ten points to remember', url: 'https://www.acc.org/latest-in-cardiology/ten-points-to-remember/2021/12/08/21/19/2021-guideline-for-revascularization-gl-revasc' },
          { t: 'iFR physiological framework and validation — EuroIntervention', url: 'https://eurointervention.pcronline.com/article/instantaneous-wave-free-ratio-to-guide-coronary-revascularisation-physiological-framework-validation-and-differences-from-fractional-flow-reserve' },
          { t: 'RFR (VALIDATE-RFR) — EuroIntervention', url: 'https://eurointervention.pcronline.com/doi/10.4244/EIJ-D-18-00342' },
          { t: 'DEFER 15-year results — ACC', url: 'https://acc.org/Latest-in-Cardiology/Clinical-Trials/2010/02/23/19/01/DEFER' },
          { t: 'FAME 2 — ACC summary', url: 'https://acc.org/Latest-in-Cardiology/Articles/2012/07/24/11/55/ESC-FAME-2' },
          { t: 'FAME 3 five-year results — PCRonline', url: 'https://www.pcronline.com/News/Congress-coverages/ACC/2025/FFR-guided-PCI-vs-CABG-5-year-results-of-the-FAME-3-trial' },
          { t: 'FLOWER-MI — ACC', url: 'https://www.acc.org/latest-in-cardiology/articles/2021/05/12/19/08/sun-1045am-flower-mi-acc-2021' },
          { t: 'FAVOR III Europe — TCTMD', url: 'https://www.tctmd.com/news/qfr-no-match-ffr-guiding-revascularizations-favor-iii-europe' },
        ]));
    },
  };
  CL.modules.physiology = mod;
})();
