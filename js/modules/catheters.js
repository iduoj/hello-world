/* Module: catheter selection, shapes, root-fit and JR engagement simulators */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h, s = CL.svg;

  function shapeSvg(path, size) {
    return s('svg', { viewBox: '0 0 130 170', width: size || 96, height: (size || 96) * 170 / 130, role: 'img', 'aria-hidden': 'true', class: 'cath-shape' },
      s('path', { d: path, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      s('path', { d: path, fill: 'none', stroke: 'var(--surface)', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.6 }));
  }

  /* --- JL fit in the aortic root (schematic, LAO view) --- */
  function rootFit() {
    const W = { small: 100, normal: 120, dilated: 144 };
    const OST_Y = 205, K = 23.2;
    const svg = s('svg', { viewBox: '0 0 320 300', role: 'img', 'aria-label': 'Judkins left catheter in the aortic root' });
    const g = s('g'); svg.appendChild(g);
    const state = { root: 'normal', size: 4 };
    const verdict = h('div', { class: 'callout' });
    function draw() {
      CL.clear(g);
      const w = W[state.root], cx = 160, xL = cx - w / 2, xR = cx + w / 2;
      // aorta walls and sinuses
      g.appendChild(s('path', { d: `M${xL} 0 L${xL} 190 C${xL - 18} 210 ${xL - 14} 252 ${cx - 6} 262 M${xR} 0 L${xR} 190 C${xR + 18} 210 ${xR + 14} 252 ${cx + 6} 262`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 3 }));
      g.appendChild(s('path', { d: `M${cx - 40} 262 Q${cx} 248 ${cx + 40} 262`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
      g.appendChild(s('text', { x: cx, y: 286, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'aortic valve' }));
      // ostia
      g.appendChild(s('path', { d: `M${xR + 2} ${OST_Y} l34 -6`, stroke: 'var(--lm)', 'stroke-width': 7, 'stroke-linecap': 'round' }));
      g.appendChild(s('text', { x: xR + 22, y: OST_Y - 14, 'font-size': 11, fill: 'var(--ink-2)', 'font-family': 'var(--font-mono)', text: 'LM' }));
      g.appendChild(s('path', { d: `M${xL - 2} ${OST_Y + 6} l-30 -4`, stroke: 'var(--rca)', 'stroke-width': 6, 'stroke-linecap': 'round' }));
      g.appendChild(s('text', { x: xL - 34, y: OST_Y - 6, 'font-size': 11, fill: 'var(--ink-2)', 'font-family': 'var(--font-mono)', text: 'RCA' }));
      // catheter
      const x0 = xL + 10, s0x = x0 + 14, s0y = 240;
      const len = state.size * K;
      const reach = xR - 12 - s0x;
      let ex, ey, fit;
      if (len < reach) { ex = s0x + len; ey = s0y - 4; fit = 'short'; }
      else { const hh = Math.sqrt(len * len - reach * reach); ex = s0x + reach; ey = s0y - hh; fit = Math.abs(ey - OST_Y) <= 14 ? 'good' : ey < OST_Y ? 'long' : 'good'; }
      const tip = fit === 'short' ? `Q${ex + 8} ${ey + 2} ${ex + 10} ${ey + 12}` : `Q${ex + 10} ${ey - 2} ${ex + 13} ${ey + 7}`;
      const d = `M${x0} 0 L${x0} 222 Q${x0} 246 ${s0x} ${s0y} L${ex} ${ey} ${tip}`;
      g.appendChild(s('path', { d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      g.appendChild(s('line', { x1: s0x, y1: s0y + 12, x2: ex, y2: ey + 12, stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      g.appendChild(s('text', { x: (s0x + ex) / 2, y: (s0y + ey) / 2 + 26, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--accent)', 'font-family': 'var(--font-mono)', text: state.size + ' cm' }));
      verdict.className = 'callout ' + (fit === 'good' ? 'ok' : 'warn');
      CL.clear(verdict);
      if (fit === 'good') verdict.append(h('strong', null, 'Good fit. '), 'The secondary curve rests on the opposite wall and the tip lines up with the LM ostium. Advance gently and it drops in.');
      else if (fit === 'long') verdict.append(h('strong', null, 'Curve too big for this root. '), 'The segment between the curves can’t lie across the root, so it angles up and the tip points above the LM ("stands up"). It may flip. Go down a size.');
      else verdict.append(h('strong', null, 'Curve too small for this root. '), 'It can’t span the root, so the tip sits low in the sinus below the LM and may prolapse toward the valve. Go up a size.');
    }
    const rootSeg = CL.ui.segmented([{ label: 'Small root', value: 'small' }, { label: 'Normal', value: 'normal' }, { label: 'Dilated', value: 'dilated' }], 'normal', (v) => { state.root = v; draw(); }, { label: 'Aortic root' });
    const sizeSeg = CL.ui.segmented([{ label: 'JL3.5', value: 3.5 }, { label: 'JL4', value: 4 }, { label: 'JL5', value: 5 }, { label: 'JL6', value: 6 }], 4, (v) => { state.size = v; draw(); }, { label: 'Catheter' });
    draw();
    return h('div', { class: 'panel' },
      h('h2', null, 'Will this JL fit?'),
      h('p', { class: 'sub' }, 'Schematic LAO view of the aortic root. The number on a Judkins left is the length (cm) of the segment between its primary and secondary curves, which has to span the root.'),
      h('div', { class: 'row' }, rootSeg, sizeSeg),
      h('div', { style: { maxWidth: '420px' } }, svg),
      verdict);
  }

  /* --- JR clockwise engagement --- */
  function jrSim() {
    const svg = s('svg', { viewBox: '0 0 320 260', role: 'img', 'aria-label': 'Judkins right rotation into the RCA' });
    const g = s('g'); svg.appendChild(g);
    const msg = h('p', { class: 'sub', 'aria-live': 'polite' });
    function draw(r) {
      CL.clear(g);
      const cx = 160, xL = 100, xR = 220;
      g.appendChild(s('path', { d: `M${xL} 0 L${xL} 180 C${xL - 18} 200 ${xL - 14} 236 ${cx - 6} 246 M${xR} 0 L${xR} 180 C${xR + 18} 200 ${xR + 14} 236 ${cx + 6} 246`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 3 }));
      g.appendChild(s('path', { d: `M${xL - 2} 186 l-34 -4`, stroke: 'var(--rca)', 'stroke-width': 7, 'stroke-linecap': 'round' }));
      g.appendChild(s('text', { x: xL - 40, y: 172, 'font-size': 11, fill: 'var(--ink-2)', 'font-family': 'var(--font-mono)', text: 'RCA' }));
      g.appendChild(s('path', { d: `M${xR + 2} 178 l34 -6`, stroke: 'var(--lm)', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.6 }));
      const t = r / 180;
      const tipY = 216 - t * 30;
      const ang = r * Math.PI / 180;
      const len = 58;
      const dx = Math.cos(ang) * len;           // + = toward the LM side (patient left)
      const toward = Math.sin(ang);             // + = anterior, toward the viewer in LAO
      const sx = cx + 6 - t * 10;
      const ex = sx + dx, ey = tipY + 10 - toward * 6;
      g.appendChild(s('path', { d: `M${sx} 0 L${sx} ${tipY - 22}`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 5, 'stroke-linecap': 'round' }));
      g.appendChild(s('path', { d: `M${sx} ${tipY - 22} Q${sx} ${tipY} ${sx + dx * 0.35} ${tipY + 4} L${ex} ${ey}`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 4 + toward * 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      g.appendChild(s('circle', { cx: ex, cy: ey, r: 4, fill: 'var(--accent)' }));
      const engaged = r >= 150 && ey < 200;
      g.appendChild(s('text', { x: 12, y: 18, 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'Clockwise ' + r + '°   withdrawn ' + (t * 2).toFixed(1) + ' cm' }));
      msg.textContent = r < 40 ? 'Start: tip just above the valve, pointing toward the patient’s left (the LCA side).'
        : r < 110 ? 'Rotating clockwise while withdrawing slowly: the tip swings anteriorly, toward you in LAO, and looks foreshortened.'
        : !engaged ? 'Keep going: the tip is turning toward the right sinus.'
        : 'Engaged: the tip has dropped into the RCA ostium. Stop rotating and let the torque settle, then check the pressure before you inject.';
    }
    const sl = CL.ui.slider({ id: 'jr-rot', label: 'Clockwise rotation (and slow pull-back)', min: 0, max: 180, step: 5, value: 0, format: (v) => v + '°', onInput: draw });
    draw(0);
    return h('div', { class: 'panel' },
      h('h2', null, 'JR4 engagement: clockwise and back'),
      h('p', { class: 'sub' }, 'Schematic LAO view. The same "clockwise while withdrawing" move engages the RCA with a Tiger or Jacky.'),
      sl, h('div', { style: { maxWidth: '420px' } }, svg), msg);
  }

  function selector() {
    const st = { access: 'rradial', root: 'normal', target: 'both', takeoff: 'normal', need: 'dx' };
    const out = h('div', { class: 'stack', 'aria-live': 'polite' });
    function render() {
      const r = CL.data.catheterSelector(st);
      CL.clear(out);
      out.append(
        h('div', { class: 'grid-2' },
          h('div', { class: 'card' }, h('h3', null, 'Diagnostic'), h('ul', null, r.diag.map((x) => h('li', null, x)))),
          h('div', { class: 'card' }, h('h3', null, 'If you go on to PCI'), h('ul', null, r.guide.map((x) => h('li', null, x))))),
        r.notes.length ? h('div', { class: 'callout' }, h('ul', null, r.notes.map((x) => h('li', null, x)))) : null);
    }
    const f = (label, seg) => h('div', { class: 'field' }, h('span', { class: 'lbl' }, label), seg);
    const panel = h('div', { class: 'panel' },
      h('h2', null, 'Pick a catheter for this patient'),
      f('Access', CL.ui.segmented([{ label: 'Right radial', value: 'rradial' }, { label: 'Left radial', value: 'lradial' }, { label: 'Femoral', value: 'femoral' }], st.access, (v) => { st.access = v; render(); })),
      f('Aortic root', CL.ui.segmented([{ label: 'Small', value: 'small' }, { label: 'Normal', value: 'normal' }, { label: 'Dilated (HTN, AS/AR, elderly)', value: 'dilated' }], st.root, (v) => { st.root = v; render(); })),
      f('Target', CL.ui.segmented([{ label: 'Both coronaries', value: 'both' }, { label: 'Left only', value: 'lca' }, { label: 'RCA only', value: 'rca' }, { label: 'Bypass grafts', value: 'grafts' }], st.target, (v) => { st.target = v; render(); })),
      f('RCA origin', CL.ui.segmented([{ label: 'Normal', value: 'normal' }, { label: 'Superior / anterior', value: 'superior' }, { label: 'Inferior', value: 'inferior' }, { label: 'Shepherd’s crook', value: 'shepherd' }], st.takeoff, (v) => { st.takeoff = v; render(); })),
      f('Plan', CL.ui.segmented([{ label: 'Diagnostic', value: 'dx' }, { label: 'PCI needing support', value: 'support' }], st.need, (v) => { st.need = v; render(); })),
      out);
    render();
    return panel;
  }

  const mod = {
    init(root) {
      root.appendChild(CL.ui.head('Left heart cath', 'Catheter selection',
        'Why a JL4 and not a JL3.5, when to reach for an Amplatz, and how the Tiger and Jacky get both coronaries through one radial catheter. The shapes are schematic drawings, not manufacturer curves.'));
      root.appendChild(h('div', { class: 'bench even' }, selector(), h('div', { class: 'stack' }, rootFit(), jrSim())));

      // gallery
      const filter = { kind: 'All' };
      const grid = h('div', { class: 'cards' });
      const render = () => {
        CL.clear(grid);
        CL.data.catheters.filter((c) => filter.kind === 'All' || c.kind.indexOf(filter.kind) >= 0).forEach((c) => {
          grid.appendChild(h('article', { class: 'card' },
            h('div', { class: 'row', style: { alignItems: 'flex-start', flexWrap: 'nowrap', gap: '14px' } },
              h('div', { style: { flex: 'none', background: 'var(--surface-2)', borderRadius: '4px', padding: '6px' } }, shapeSvg(c.shape, 70)),
              h('div', { class: 'stack', style: { gap: '6px' } }, h('h3', null, c.name), h('div', { class: 'meta' }, CL.ui.tag(c.kind), CL.ui.tag(c.target)))),
            h('p', null, h('b', null, 'Use: '), c.use),
            h('p', null, h('b', null, 'Technique: '), c.tech),
            c.pitfalls.length ? h('ul', null, c.pitfalls.map((p) => h('li', null, p))) : null));
        });
      };
      const chips = CL.ui.chips(['All', 'Diagnostic', 'Radial universal', 'Guide'].map((k) => ({ label: k, value: k })), 'All', (v) => { filter.kind = v; render(); });
      render();
      root.appendChild(h('div', { class: 'panel' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', null, 'Catheter shapes'), chips), grid));

      // French + support
      root.appendChild(h('div', { class: 'grid-2' },
        h('div', { class: 'panel' }, h('h2', null, 'French size: what fits'),
          h('p', { class: 'sub' }, 'French ÷ 3 ≈ outer diameter in mm. A 6 Fr guide (≈2 mm) is also a handy ruler for visual vessel sizing on angiography.'),
          h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '0' } },
            h('thead', null, h('tr', null, h('th', null, 'Size'), h('th', null, 'OD'), h('th', null, 'Practical fit'))),
            h('tbody', null, CL.data.frenchTable.map((r) => h('tr', null, h('td', { class: 'mono' }, r.fr), h('td', { class: 'mono' }, r.od), h('td', null, r.fits))))))),
        h('div', { class: 'panel' }, h('h2', null, 'Guide support ladder'),
          h('ol', { class: 'prose', style: { fontSize: 'var(--step--1)' } },
            h('li', null, h('b', null, 'Passive support: '), 'pick a shape that leans on the opposite aortic wall: EBU, XB or Voda for the left; AL for the right. A bigger French size is stiffer.'),
            h('li', null, h('b', null, 'Active support: '), 'deep-seat gently, but only with a pressure check and never for long.'),
            h('li', null, h('b', null, 'Buddy wire: '), 'a second wire straightens the vessel and anchors the guide.'),
            h('li', null, h('b', null, 'Anchor balloon: '), 'inflate a small balloon in a side branch to lock the guide.'),
            h('li', null, h('b', null, 'Guide extension: '), 'GuideLiner or Telescope gives deep, coaxial support without deep-seating the guide itself. Costs about 1 Fr of lumen; avoid vessels under 2.5 mm.')),
          h('div', { class: 'callout warn' }, h('strong', null, 'Pressure first. '), 'Before every injection, check the pressure waveform. Damping or ventricularization means stop, disengage, and think about ostial disease, spasm or a wedged tip.'))));
      root.appendChild(CL.ui.refs(CL.data.catheterRefs));
    },
  };
  CL.modules.catheters = mod;
})();
