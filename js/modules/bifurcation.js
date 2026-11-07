/* Module: bifurcation & ostial PCI — Medina classifier and step-through technique drawings */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h, S = CL.svg;

  // geometry (SVG units)
  const C = [330, 200];             // carina / bifurcation point
  const P0 = [30, 200], DE = [660, 200];
  const SBE = [575, 66];
  const RP = 17, RD = 14, RS = 12;   // proximal MV, distal MV, SB radii
  const MM = 6;                       // px per mm (for protrusion)
  const SBU = (() => { const dx = SBE[0] - C[0], dy = SBE[1] - C[1]; const l = Math.hypot(dx, dy); return [dx / l, dy / l]; })();
  const sbPt = (t) => [C[0] + (SBE[0] - C[0]) * t, C[1] + (SBE[1] - C[1]) * t];

  function mvPath(x0, x1, dy) { const pts = []; for (let x = x0; x <= x1; x += 3) pts.push([x, C[1] + (dy || 0), x < C[0] ? RP - 2 : RD - 2]); return pts; }
  function sbPath(t0, t1, protrudePx) {
    const pts = [];
    const L = Math.hypot(SBE[0] - C[0], SBE[1] - C[1]);
    const start = -protrudePx / L;
    for (let t = Math.min(t0, start); t <= t1; t += 3 / L) pts.push([C[0] + (SBE[0] - C[0]) * t, C[1] + (SBE[1] - C[1]) * t, RS - 2]);
    return pts;
  }
  function joinPaths(a, b) { return a.concat(b); }

  function rails(pts) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      L.push([pts[i][0] + nx * pts[i][2], pts[i][1] + ny * pts[i][2], nx, ny]);
      R.push([pts[i][0] - nx * pts[i][2], pts[i][1] - ny * pts[i][2], -nx, -ny]);
    }
    return [L, R];
  }
  function zig(rail, amp) {
    let d = '';
    rail.forEach((p, i) => { const s = (i % 2 ? 1 : -1) * amp; d += (i ? 'L' : 'M') + (p[0] + p[2] * s).toFixed(1) + ' ' + (p[1] + p[3] * s).toFixed(1); });
    return d;
  }
  function stentEl(pts, color, label) {
    const g = S('g');
    const [L, R] = rails(pts);
    [L, R].forEach((r) => g.appendChild(S('path', { d: zig(r, 2.6), fill: 'none', stroke: color, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })));
    // cross links
    for (let i = 0; i < L.length; i += 4) g.appendChild(S('line', { x1: L[i][0], y1: L[i][1], x2: R[i][0], y2: R[i][1], stroke: color, 'stroke-width': 0.6, opacity: 0.35 }));
    if (label) { const m = pts[Math.floor(pts.length * 0.75)]; g.appendChild(S('text', { x: m[0], y: m[1] + 4, 'text-anchor': 'middle', 'font-size': 10, fill: color, 'font-family': 'var(--font-mono)', 'font-weight': 600, text: label })); }
    return g;
  }
  function balloonEl(pts, color, label, dashed) {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const w = pts[Math.floor(pts.length / 2)][2] * 2 + 2;
    const g = S('g');
    g.appendChild(S('path', { d, fill: 'none', stroke: color, 'stroke-width': dashed ? 8 : w, 'stroke-linecap': 'round', opacity: dashed ? 0.35 : 0.42, 'stroke-dasharray': dashed ? '6 5' : null }));
    if (label) { const m = pts[Math.floor(pts.length / 2)]; g.appendChild(S('text', { x: m[0], y: m[1] - w / 2 - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink)', 'font-family': 'var(--font-mono)', 'font-weight': 600, text: label })); }
    return g;
  }

  function drawScene(svg, step, medina) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // vessel walls
    const vline = (a, b, r) => [S('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'var(--line-strong)', 'stroke-width': r * 2 + 8, 'stroke-linecap': 'round' }), S('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'var(--surface)', 'stroke-width': r * 2, 'stroke-linecap': 'round' })];
    const walls = [vline(P0, C, RP), vline([C[0] - 4, C[1]], DE, RD), vline(C, SBE, RS)];
    walls.forEach((w) => svg.appendChild(w[0]));
    walls.forEach((w) => svg.appendChild(w[1]));
    svg.appendChild(S('rect', { x: C[0] - 12, y: C[1] - RP, width: 24, height: RP * 2, fill: 'var(--surface)' }));
    // plaque per Medina
    const plaque = 'var(--warn)';
    const md = medina || [1, 1, 1];
    if (md[0]) { svg.appendChild(S('path', { d: `M250 ${C[1] - RP} Q285 ${C[1] - RP + 9} 318 ${C[1] - RP + 2} L318 ${C[1] - RP} Z M240 ${C[1] + RP} Q280 ${C[1] + RP - 11} 322 ${C[1] + RP - 2} L322 ${C[1] + RP} Z`, fill: plaque, opacity: 0.55 })); }
    if (md[1]) { svg.appendChild(S('path', { d: `M346 ${C[1] + RD} Q385 ${C[1] + RD - 9} 420 ${C[1] + RD} Z M352 ${C[1] - RD} Q380 ${C[1] - RD + 6} 405 ${C[1] - RD} Z`, fill: plaque, opacity: 0.55 })); }
    if (md[2]) {
      const ang = Math.atan2(SBU[1], SBU[0]) * 180 / Math.PI;
      const nx = -SBU[1], ny = SBU[0];
      [[0.2, 1], [0.26, -1]].forEach(([t, side]) => {
        const p = sbPt(t);
        svg.appendChild(S('ellipse', { cx: p[0] + nx * (RS - 3) * side, cy: p[1] + ny * (RS - 3) * side, rx: 26, ry: 5, transform: `rotate(${ang} ${p[0] + nx * (RS - 3) * side} ${p[1] + ny * (RS - 3) * side})`, fill: plaque, opacity: 0.55 }));
      });
    }
    svg.appendChild(S('text', { x: 40, y: 245, 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-display)', 'letter-spacing': '0.1em', text: 'PROXIMAL MAIN VESSEL' }));
    svg.appendChild(S('text', { x: 650, y: 245, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-display)', 'letter-spacing': '0.1em', text: 'DISTAL MAIN VESSEL' }));
    svg.appendChild(S('text', { x: 520, y: 52, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-display)', 'letter-spacing': '0.1em', text: 'SIDE BRANCH' }));
    if (!step) return;
    const col = { 1: 'var(--ink-2)', 2: 'var(--accent)' };
    // stents
    (step.stents || []).forEach((st) => {
      const pp = (st.protrude || 0) * MM;
      if (st.k === 'mv') svg.appendChild(stentEl(mvPath(200, 470), col[st.id]));
      if (st.k === 'sb') {
        if (st.crushed) {
          const cr = []; for (let x = C[0] - pp - 8; x <= C[0] + 4; x += 2.4) cr.push([x, C[1] - RP + 4, 1.4]);
          const d = cr.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + (p[1] + (i % 2 ? 2.4 : -2.4)).toFixed(1)).join(' ');
          svg.appendChild(S('path', { d, fill: 'none', stroke: col[st.id], 'stroke-width': 1.8 }));
          svg.appendChild(stentEl(sbPath(0.0, 0.52, 0), col[st.id]));
        } else svg.appendChild(stentEl(sbPath(0, 0.52, pp), col[st.id]));
      }
      if (st.k === 'culotteSB') {
        const a = mvPath(210, C[0]).reverse().map((p) => [p[0], p[1], RP - 3]);
        svg.appendChild(stentEl(joinPaths(sbPath(0.02, 0.52, 0).reverse(), a).reverse(), col[st.id]));
      }
      if (st.k === 'culotteMV') svg.appendChild(stentEl(mvPath(214, 470).map((p) => [p[0], p[1], p[2] - 1.5]), col[st.id]));
      if (st.k === 'sksMV') svg.appendChild(stentEl(mvPath(250, C[0], 7).map((p) => [p[0], p[1], 8]).concat(mvPath(C[0], 470)), col[st.id]));
      if (st.k === 'sksSB') svg.appendChild(stentEl(mvPath(250, C[0] - 8, -7).map((p) => [p[0], p[1], 8]).concat(sbPath(0.02, 0.5, 0)), col[st.id]));
    });
    // balloons
    const B = {
      pre: () => balloonEl(mvPath(250, 420), 'var(--lcx)', 'pre-dilate'),
      pot: () => balloonEl(mvPath(214, 318).map((p) => [p[0], p[1], RP - 1]), 'var(--lcx)', 'POT'),
      mvKiss: () => balloonEl(mvPath(250, C[0], 5).map((p) => [p[0], p[1], 8]).concat(mvPath(C[0], 450)), 'var(--lcx)', null),
      sbKiss: () => balloonEl(mvPath(250, C[0] - 6, -6).map((p) => [p[0], p[1], 8]).concat(sbPath(0.02, 0.42, 0)), 'var(--rca)', 'kiss'),
      sbOpen: () => balloonEl(sbPath(0, 0.38, 8), 'var(--rca)', 'open struts'),
      mvWait: () => balloonEl(mvPath(200, 470), 'var(--lcx)', null, true),
      mvOpen: () => balloonEl(mvPath(C[0] - 10, 440), 'var(--lcx)', 'open struts'),
      mvCrush: () => balloonEl(mvPath(230, 430), 'var(--lcx)', 'balloon crush'),
      mvSKS: () => balloonEl(mvPath(250, C[0], 7).map((p) => [p[0], p[1], 8]).concat(mvPath(C[0], 470)), 'var(--lcx)', null),
      sbSKS: () => balloonEl(mvPath(250, C[0] - 8, -7).map((p) => [p[0], p[1], 8]).concat(sbPath(0.02, 0.5, 0)), 'var(--rca)', 'simultaneous'),
    };
    (step.balloons || []).forEach((b) => B[b] && svg.appendChild(B[b]()));
    // wires
    const wire = (pts, dash, label) => {
      svg.appendChild(S('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.3, 'stroke-dasharray': dash || null }));
      if (label) { const p = pts[pts.length - 1]; svg.appendChild(S('text', { x: p[0] - 4, y: p[1] - 8, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--ink)', 'font-family': 'var(--font-mono)', text: label })); }
    };
    (step.wires || []).forEach((w) => {
      if (w === 'mv' || w === 'mvX') wire([[10, C[1] + 2], [650, C[1] + 2]], null, w === 'mvX' ? 'rewired' : null);
      if (w === 'sb' || w === 'sbX') wire([[10, C[1] - 3], [C[0] - 30, C[1] - 4], sbPt(0.15), sbPt(0.97)], null, w === 'sbX' ? 'rewired' : null);
      if (w === 'sbJ') { wire([[10, C[1] - RP + 3], [C[0] - 8, C[1] - RP + 3], sbPt(0.12)], '4 3'); wire([sbPt(0.12), sbPt(0.97)], null, 'jailed wire'); }
    });
  }

  const mod = {
    init(root) {
      root.appendChild(CL.ui.head('PCI', 'Bifurcation and ostial techniques',
        'Classify the lesion with Medina, then step through each technique. The colors track the stents: main-vessel stent in slate, side-branch stent in amber, balloons as translucent bands.'));

      // JL crush note
      root.appendChild(h('div', { class: 'callout' }, h('strong', null, 'Heard "JL crush"? '), 'No named technique goes by that name. "JL" usually means the Judkins Left guide. The crush you are probably thinking of is DK crush (double kissing crush), shown below with classic crush and mini-crush.'));

      // Medina
      const md = [1, 1, 1];
      const mSvg = S('svg', { viewBox: '0 0 680 260', role: 'img', 'aria-label': 'Medina classification diagram', style: 'width:100%;display:block' });
      const mOut = h('div', { class: 'stack', 'aria-live': 'polite' });
      const toggles = h('div', { class: 'row' });
      const names = ['Proximal main vessel', 'Distal main vessel', 'Side branch'];
      const renderM = () => {
        drawScene(mSvg, null, md);
        const code = md.join(',');
        const trueBif = md[2] === 1 && (md[0] === 1 || md[1] === 1);
        CL.clear(mOut);
        mOut.append(
          h('div', { class: 'readout' }, h('div', { class: 'r ' + (trueBif ? 'bad' : '') }, h('span', { class: 'k' }, 'Medina'), h('span', { class: 'v' }, code)),
            h('div', { class: 'r' }, h('span', { class: 'k' }, 'Type'), h('span', { class: 'v', style: { fontSize: '0.95rem' } }, trueBif ? 'True bifurcation' : md.every((x) => !x) ? 'No disease' : 'Non-true'))),
          h('p', { class: 'sub' }, 'Each digit is 1 if that segment has ≥50% stenosis, in the order proximal MV, distal MV, side branch. True bifurcations involve the SB plus the MV: 1,1,1 · 1,0,1 · 0,1,1.'),
          h('p', null, trueBif
            ? (md[0] === 0 ? 'A 0,1,1 lesion with a healthy proximal MV is the classic setup for V-stenting or SKS when both branches are large. Otherwise use provisional or DK crush per the DEFINITION criteria.' : 'Start with provisional unless the SB is large (≥2.5–2.75 mm) with long (≥10 mm), severe ostial disease (DEFINITION complex). In that case plan DK crush or culotte.')
            : md[2] === 1 ? 'Isolated SB ostial disease (0,0,1): treat the SB alone (precise ostial placement or TAP), and protect the MV with a wire.' : 'Main-vessel disease only: provisional stenting with a wire in the SB to protect it.'));
      };
      names.forEach((n, i) => {
        const b = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'true' }, n + ': 1');
        b.addEventListener('click', () => { md[i] = md[i] ? 0 : 1; b.setAttribute('aria-pressed', String(!!md[i])); b.textContent = n + ': ' + md[i]; renderM(); });
        toggles.appendChild(b);
      });
      renderM();
      root.appendChild(h('div', { class: 'bench even' },
        h('div', { class: 'panel' }, h('h2', null, 'Medina classifier'), toggles, h('div', { style: { overflowX: 'auto' } }, mSvg)),
        h('div', { class: 'panel' }, mOut,
          h('h3', null, 'DEFINITION criteria (complex bifurcation)'),
          h('p', { style: { fontSize: 'var(--step--1)' } }, h('b', null, 'Major: '), CL.data.definition.major),
          h('p', { style: { fontSize: 'var(--step--1)' } }, h('b', null, 'Minor: '), CL.data.definition.minor.join(' · ')),
          h('p', { class: 'sub' }, CL.data.definition.rule))));

      // technique stepper
      const tSvg = S('svg', { viewBox: '0 0 680 260', role: 'img', 'aria-label': 'Technique step diagram', style: 'width:100%;max-width:880px;display:block;margin:0 auto' });
      const cap = h('div', { class: 'callout', 'aria-live': 'polite' });
      const when = h('p', { class: 'sub' });
      const dots = h('div', { class: 'steps' });
      const st = { tech: CL.data.bifTechniques[0], i: 0 };
      const render = () => {
        const s = st.tech.steps[st.i];
        drawScene(tSvg, s, [1, 1, 1]);
        CL.clear(cap); cap.append(h('strong', null, 'Step ' + (st.i + 1) + ' of ' + st.tech.steps.length + '. '), s.t);
        when.textContent = st.tech.when;
        CL.clear(dots);
        st.tech.steps.forEach((_, k) => { const b = h('button', { type: 'button', 'aria-current': k === st.i ? 'step' : null, 'aria-label': 'Step ' + (k + 1) }, String(k + 1)); b.addEventListener('click', () => { st.i = k; render(); }); dots.appendChild(b); });
        prev.disabled = st.i === 0; next.disabled = st.i === st.tech.steps.length - 1;
      };
      const prev = h('button', { type: 'button', class: 'btn', onclick: () => { st.i = Math.max(0, st.i - 1); render(); } }, '← Back');
      const next = h('button', { type: 'button', class: 'btn primary', onclick: () => { st.i = Math.min(st.tech.steps.length - 1, st.i + 1); render(); } }, 'Next step →');
      const chips = CL.ui.chips(CL.data.bifTechniques.map((t) => ({ label: t.name, value: t.id })), st.tech.id, (id) => { st.tech = CL.data.bifTechniques.find((t) => t.id === id); st.i = 0; render(); }, { label: 'Technique' });
      root.appendChild(h('div', { class: 'panel' },
        h('h2', null, 'Step through a technique'), chips, when,
        h('div', { style: { overflowX: 'auto', background: 'var(--surface-2)', borderRadius: '6px' } }, tSvg),
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, dots, h('div', { class: 'row' }, prev, next)),
        cap,
        h('div', { class: 'legend' },
          h('span', { style: { '--c': 'var(--ink-2)' } }, h('i'), 'Main-vessel stent'),
          h('span', { style: { '--c': 'var(--accent)' } }, h('i'), 'Side-branch stent'),
          h('span', { style: { '--c': 'var(--lcx)' } }, h('i'), 'MV balloon'),
          h('span', { style: { '--c': 'var(--rca)' } }, h('i'), 'SB balloon'),
          h('span', { style: { '--c': 'var(--warn)' } }, h('i'), 'Plaque'))));
      render();

      root.appendChild(h('div', { class: 'grid-2' },
        h('div', { class: 'panel' }, h('h2', null, 'Ostial lesions'), h('dl', { class: 'kv' }, CL.data.ostial.map((x) => [h('dt', null, x.k), h('dd', null, x.v)]))),
        h('div', { class: 'panel' }, h('h2', null, 'Trials to know'), h('dl', { class: 'kv' }, CL.data.bifTrials.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
          h('div', { class: 'callout' }, h('strong', null, 'Key moves: '), 'Size the MV stent to the distal MV and POT to the proximal MV (Finet’s law, on the Stent Sizing tab). In provisional stenting, rewire the SB through a distal cell so the struts scaffold the SB ostium. Finish two-stent techniques with a kiss and a final POT, and image to confirm both ostia.'))));
      root.appendChild(CL.ui.refs(CL.data.bifRefs));
    },
  };
  CL.modules.bifurcation = mod;
})();
