/* Module: stent sizing — IVUS-guided landing zones and diameter, post-stent optimization check, Finet's law. */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h, S = CL.svg;

  const DIAMS = [2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 4.0, 4.5, 5.0];
  const LENGTHS = [8, 12, 15, 18, 20, 23, 24, 26, 28, 30, 33, 38];
  const LEN = 40;

  // vessel model along x (mm, 0 = proximal, 40 = distal)
  function eemD(x, v) { return v.ep - (v.ep - v.ed) * (x / LEN) + 0.35 * CL.gauss(x, v.lc, v.lw * 0.6); }
  function pb(x, v) {
    const base = 0.3 + 0.12 * CL.gauss(x, v.lc - v.lw * 0.9, 3.5) + 0.06 * CL.gauss(x, 33, 2.5);
    return Math.min(0.88, base + (v.lpb - 0.3) * Math.exp(-Math.pow((x - v.lc) / v.lw, 4)));
  }
  function lumD(x, v) { return eemD(x, v) * Math.sqrt(1 - pb(x, v)); }
  const area = (d) => Math.PI * d * d / 4;

  const mod = {
    init(root) {
      this.v = { ep: 3.9, ed: 3.3, lc: 19, lw: 6.5, lpb: 0.8 };
      this.m = { p: 7, d: 31 };
      this.method = 'eem';
      root.appendChild(CL.ui.head('PCI', 'Stent sizing',
        'Size the stent to the vessel, not to the stenosis. Drag the proximal and distal landing zones to normal-looking segments (plaque burden <50%), choose a sizing rule, and read the recommended stent and post-dilation balloon.'));

      this.svg = S('svg', { viewBox: '0 0 760 250', role: 'img', 'aria-label': 'Longitudinal IVUS-style vessel profile with draggable landing zones', style: 'width:100%;display:block;touch-action:none' });
      this.out = h('div', { class: 'stack', 'aria-live': 'polite' });
      const methodSeg = CL.ui.segmented([
        { label: 'EEM-based (IVUS)', value: 'eem' },
        { label: 'Lumen-based (IVUS)', value: 'lumen' },
        { label: 'Angiographic (QCA)', value: 'angio' },
      ], 'eem', (v) => { this.method = v; this.update(); }, { label: 'Sizing method' });
      const sl = (id, label, key, min, max, step, fmt) => CL.ui.slider({ id, label, min, max, step, value: this.v[key], format: fmt, onInput: (x) => { this.v[key] = x; this.update(); } });
      root.appendChild(h('div', { class: 'bench' },
        h('div', { class: 'panel' },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', null, 'Pullback (longitudinal view)'), methodSeg),
          h('div', { style: { overflowX: 'auto' } }, this.svg),
          h('div', { class: 'legend' },
            h('span', { style: { '--c': 'var(--lad)' } }, h('i'), 'Lumen'),
            h('span', { style: { '--c': '#d9b26a' } }, h('i'), 'Plaque (between lumen and EEM)'),
            h('span', { style: { '--c': 'var(--bad)' } }, h('i'), 'Plaque burden ≥50%')),
          h('p', { class: 'sub' }, 'Drag the P and D markers. Proximal is on the left, distal on the right, as in a typical pullback display.')),
        h('div', { class: 'stack' },
          h('div', { class: 'panel' }, h('h3', null, 'Vessel'), sl('st-ep', 'Proximal EEM diameter', 'ep', 3.0, 5.0, 0.1, (x) => x.toFixed(1) + ' mm'), sl('st-ed', 'Distal EEM diameter', 'ed', 2.4, 4.5, 0.1, (x) => x.toFixed(1) + ' mm'),
            sl('st-lw', 'Lesion half-length', 'lw', 3, 12, 0.5, (x) => x + ' mm'), sl('st-lpb', 'Lesion plaque burden', 'lpb', 0.5, 0.88, 0.02, (x) => Math.round(x * 100) + '%')),
          h('div', { class: 'panel' }, this.out))));

      root.appendChild(this.optimizer());
      root.appendChild(h('div', { class: 'grid-2' }, this.finet(), this.angioTips()));
      root.appendChild(CL.ui.refs([
        { t: 'SCAI: Practical aspects of IVUS-guided PCI (EEM/lumen sizing, landing zones)', url: 'https://scai.org/practical-aspects-ivus-guided-percutaneous-coronary-intervention' },
        { t: 'EEM- vs lumen-based sizing (ILUMIEN III substudy) — Eur Heart J Cardiovasc Imaging', url: 'https://dbpia.nl.go.kr/ehjcimaging/article/22/7/753/5964163' },
        { t: 'Räber L et al. EAPCI imaging consensus Part 1, EuroIntervention 2018', url: 'https://eurointervention.pcronline.com/article/clinical-use-of-intracoronary-imaging-part-1-guidance-and-optimization-of-coronary-interventions-an-expert-consensus-document-of-the-european-association-of-percutaneous-cardiovascular-interventions' },
        { t: 'ULTIMATE optimal-stent criteria — MDedge summary', url: 'https://mdedge.com/content/ultimate-ivus-guided-stent-placement-bests-angiography' },
        { t: 'Shlofmitz E et al. MLD MAX algorithm. CCI 2022;100 Suppl 1:S7–S13', url: 'https://experts.mcmaster.ca/display/publication2777135' },
        { t: 'Finet G et al. Fractal geometry of coronary bifurcations. EuroIntervention', url: 'https://eurointervention.pcronline.com/article/fractal-geometry-of-arterial-coronary-bifurcations-a-quantitative-coronary-angiography-and-intravascular-ultrasound-analysis' },
      ]));
      this.bindDrag();
      this.update();
    },
    x2px(x) { return 40 + x / LEN * 680; },
    px2x(px) { return CL.clamp((px - 40) / 680 * LEN, 0, LEN); },
    bindDrag() {
      let drag = null;
      const pt = (e) => { const r = this.svg.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 760; };
      this.svg.addEventListener('pointerdown', (e) => {
        const x = pt(e);
        const dp = Math.abs(x - this.x2px(this.m.p)), dd = Math.abs(x - this.x2px(this.m.d));
        drag = dp < dd ? 'p' : 'd';
        if (Math.min(dp, dd) > 60) { drag = null; return; }
        this.svg.setPointerCapture(e.pointerId);
        this.m[drag] = Math.round(this.px2x(x) * 2) / 2; this.update();
      });
      this.svg.addEventListener('pointermove', (e) => { if (!drag) return; this.m[drag] = Math.round(this.px2x(pt(e)) * 2) / 2; this.update(); });
      const end = () => { drag = null; };
      this.svg.addEventListener('pointerup', end); this.svg.addEventListener('pointercancel', end);
    },
    draw() {
      const svg = this.svg, v = this.v;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const cy = 112, k = 22;
      const top = [], bot = [], ltop = [], lbot = [];
      for (let x = 0; x <= LEN; x += 0.25) {
        const X = this.x2px(x);
        top.push([X, cy - eemD(x, v) / 2 * k]); bot.push([X, cy + eemD(x, v) / 2 * k]);
        ltop.push([X, cy - lumD(x, v) / 2 * k]); lbot.push([X, cy + lumD(x, v) / 2 * k]);
      }
      const poly = (a, b) => 'M' + a.map((p) => p.join(' ')).join('L') + 'L' + b.slice().reverse().map((p) => p.join(' ')).join('L') + 'Z';
      svg.appendChild(S('path', { d: poly(top, bot), fill: '#d9b26a', opacity: 0.55 }));
      // PB >= 50% band
      for (let x = 0; x < LEN; x += 0.5) if (pb(x + 0.25, v) >= 0.5) svg.appendChild(S('rect', { x: this.x2px(x), y: cy + eemD(x, v) / 2 * k + 6, width: 680 / LEN * 0.5 + 0.5, height: 5, fill: 'var(--bad)' }));
      svg.appendChild(S('path', { d: poly(ltop, lbot), fill: 'var(--lad)', opacity: 0.85 }));
      svg.appendChild(S('path', { d: 'M' + top.map((p) => p.join(' ')).join('L'), fill: 'none', stroke: '#c9971e', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }));
      svg.appendChild(S('path', { d: 'M' + bot.map((p) => p.join(' ')).join('L'), fill: 'none', stroke: '#c9971e', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }));
      // stent between markers
      const p = Math.min(this.m.p, this.m.d), d = Math.max(this.m.p, this.m.d);
      const res = this.res;
      if (res) {
        const sd = res.diam * k / 2;
        const g = S('g', { opacity: 0.9 });
        for (let x = p; x < d - 0.4; x += 1.2) {
          const X0 = this.x2px(x), X1 = this.x2px(Math.min(d, x + 1.2));
          g.appendChild(S('path', { d: `M${X0} ${cy - sd} L${(X0 + X1) / 2} ${cy - sd + 5} L${X1} ${cy - sd} M${X0} ${cy + sd} L${(X0 + X1) / 2} ${cy + sd - 5} L${X1} ${cy + sd}`, stroke: 'var(--ink)', fill: 'none', 'stroke-width': 1.4 }));
        }
        svg.appendChild(g);
      }
      // markers
      [['P', this.m.p], ['D', this.m.d]].forEach(([lab, x]) => {
        const X = this.x2px(x);
        svg.appendChild(S('line', { x1: X, x2: X, y1: 18, y2: 212, stroke: 'var(--accent)', 'stroke-width': 2 }));
        svg.appendChild(S('rect', { x: X - 13, y: 2, width: 26, height: 20, rx: 4, fill: 'var(--accent)', style: 'cursor:ew-resize' }));
        svg.appendChild(S('text', { x: X, y: 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'var(--accent-ink)', 'font-family': 'var(--font-mono)', text: lab }));
      });
      for (let x = 0; x <= LEN; x += 5) {
        svg.appendChild(S('line', { x1: this.x2px(x), x2: this.x2px(x), y1: 222, y2: 228, stroke: 'var(--muted)' }));
        svg.appendChild(S('text', { x: this.x2px(x), y: 242, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: x + ' mm' }));
      }
      svg.appendChild(S('text', { x: 40, y: 34, 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-display)', 'letter-spacing': '0.1em', text: 'PROXIMAL' }));
      svg.appendChild(S('text', { x: 720, y: 34, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)', 'font-family': 'var(--font-display)', 'letter-spacing': '0.1em', text: 'DISTAL' }));
    },
    update() {
      const v = this.v;
      const p = Math.min(this.m.p, this.m.d), d = Math.max(this.m.p, this.m.d);
      const at = (x) => ({ x, eem: eemD(x, v), lum: lumD(x, v), pb: pb(x, v) });
      const P = at(p), Dd = at(d);
      // minimum lumen site
      let mla = { lum: 99 };
      for (let x = 0; x <= LEN; x += 0.25) { const q = at(x); if (q.lum < mla.lum) mla = q; }
      let diam, rule;
      if (this.method === 'eem') {
        diam = DIAMS.filter((x) => x <= Dd.eem + 1e-9).pop() || DIAMS[0];
        rule = 'Distal reference mean EEM ' + Dd.eem.toFixed(2) + ' mm, rounded down to the nearest stent size';
      } else if (this.method === 'lumen') {
        diam = DIAMS.find((x) => x >= Dd.lum - 1e-9) || DIAMS[DIAMS.length - 1];
        rule = 'Distal reference lumen ' + Dd.lum.toFixed(2) + ' mm, rounded up to the next stent size';
      } else {
        const ref = (P.lum + Dd.lum) / 2 * 1.04; // after IC NTG; QCA ≈ lumen
        diam = DIAMS.find((x) => x >= ref * 1.0 - 0.05) || DIAMS[DIAMS.length - 1];
        rule = 'QCA reference ≈' + ref.toFixed(2) + ' mm (mean of the references after IC NTG), stent:artery 1.0–1.1 : 1';
      }
      const lenNeed = d - p;
      const stentLen = LENGTHS.find((L) => L >= lenNeed) || LENGTHS[LENGTHS.length - 1];
      const potRaw = this.method === 'eem' ? Math.floor((P.eem - 0.0) * 4) / 4 : Math.ceil(P.lum * 4) / 4 + (this.method === 'lumen' ? 0 : 0);
      const pot = Math.max(diam, Math.min(potRaw, diam + 1.25));
      const target = Math.min(area(Dd.lum) * 0.9, 9);
      this.res = { diam, stentLen };
      this.draw();
      const cell = (k, val, cls) => h('div', { class: 'r ' + (cls || '') }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, val));
      const zone = (Z, name) => h('div', { class: 'card' },
        h('h3', null, name + ' reference (' + Z.x + ' mm)'),
        h('dl', { class: 'kv' },
          h('dt', null, 'EEM Ø'), h('dd', { class: 'mono' }, Z.eem.toFixed(2) + ' mm'),
          h('dt', null, 'Lumen Ø'), h('dd', { class: 'mono' }, Z.lum.toFixed(2) + ' mm (' + area(Z.lum).toFixed(1) + ' mm²)'),
          h('dt', null, 'Plaque burden'), h('dd', null, h('span', { class: 'tag ' + (Z.pb < 0.5 ? 'pill-ok' : 'pill-bad') }, Math.round(Z.pb * 100) + '%'))));
      const warn = [];
      if (P.pb >= 0.5) warn.push('The proximal landing zone sits in plaque burden ≥50%. Move it proximally to normal-looking vessel to avoid edge restenosis and geographic miss.');
      if (Dd.pb >= 0.5) warn.push('The distal landing zone sits in plaque burden ≥50%. Extend distally, or accept a longer stent.');
      if (lenNeed < 2 * v.lw) warn.push('The stent is shorter than the diseased segment: part of the lesion is uncovered.');
      if (diam > Dd.eem + 0.01) warn.push('The stent diameter exceeds the distal EEM. Oversizing risks edge dissection or perforation.');
      if (this.method === 'lumen') warn.push('Lumen-based sizing is conservative. If ≥180° of the EEM is visible, EEM-based sizing usually allows a larger stent and better expansion.');
      CL.clear(this.out);
      this.out.append(
        h('h2', null, 'Recommendation'),
        h('div', { class: 'readout' }, cell('Stent', diam.toFixed(2) + ' × ' + stentLen + ' mm', 'ok'), cell('MLA site', mla.x + ' mm: ' + area(mla.lum).toFixed(1) + ' mm²', area(mla.lum) < 4 ? 'bad' : ''), cell('Proximal NC (POT)', pot.toFixed(2) + ' mm'), cell('MSA goal', '≥' + Math.max(5.5, target).toFixed(1) + ' mm²')),
        h('p', { class: 'sub' }, h('b', null, 'Rule: '), rule + '. Length covers ' + lenNeed.toFixed(1) + ' mm normal to normal, rounded up to an available length.'),
        h('div', { class: 'grid-2' }, zone(P, 'Proximal'), zone(Dd, 'Distal')),
        h('p', { class: 'sub' }, 'Deploy at nominal pressure, then post-dilate with a non-compliant balloon. Use the stent-sized NC in the distal half, and a larger NC (sized to the proximal reference) in the proximal half, staying within the stent’s maximum expansion. Re-image and check the targets below.'),
        warn.length ? h('div', { class: 'callout warn' }, h('ul', null, warn.map((w) => h('li', null, w)))) : h('div', { class: 'callout ok' }, 'Both edges land in plaque burden <50% and the stent is sized to the vessel.'));
    },

    optimizer() {
      const st = { msa: 5.9, dref: 6.4, pref: 8.6, edgePB: 40, diss: 'none', mal: 0.2, malLen: 0.5, lm: false };
      const out = h('div', { class: 'stack', 'aria-live': 'polite' });
      const num = (id, label, key, step, unit) => {
        const inp = h('input', { type: 'number', id, step, value: st[key] });
        inp.addEventListener('input', () => { st[key] = Number(inp.value); render(); });
        return h('div', { class: 'field' }, h('label', { for: id }, label, h('span', { class: 'val' }, unit)), inp);
      };
      const render = () => {
        const checks = [];
        const exp = st.msa / st.dref;
        checks.push(['MSA >5.5 mm² (EAPCI, non-LM IVUS)', st.msa > 5.5]);
        checks.push(['MSA ≥90% of distal reference lumen area (ULTIMATE): ' + Math.round(exp * 100) + '%', st.msa >= 0.9 * st.dref]);
        checks.push(['MSA ≥80% of the mean reference (EAPCI): ' + Math.round(st.msa / ((st.dref + st.pref) / 2) * 100) + '%', st.msa >= 0.8 * (st.dref + st.pref) / 2]);
        checks.push(['MSA > distal reference lumen area (IVUS-XPL)', st.msa > st.dref]);
        checks.push(['Edge plaque burden <50% within 5 mm', st.edgePB < 50]);
        checks.push(['No edge dissection involving the media ≥60° or ≥3 mm', st.diss !== 'major']);
        checks.push(['Malapposition ≤0.4 mm or ≤1 mm long', !(st.mal > 0.4 && st.malLen > 1)]);
        const ultimate = (st.msa > 5.0 || st.msa >= 0.9 * st.dref) && st.edgePB < 50 && st.diss !== 'major';
        const fixes = [];
        if (st.msa < 0.9 * st.dref || st.msa <= 5.5) fixes.push('Underexpansion: high-pressure NC balloon sized 1:1 to the reference (within the stent’s expansion limit). If calcium resists, consider intravascular lithotripsy.');
        if (st.mal > 0.4 && st.malLen > 1) fixes.push('Malapposition: post-dilate with a larger-diameter balloon at moderate pressure.');
        if (st.edgePB >= 50) fixes.push('Edge in significant plaque: consider extending with another stent to cover it.');
        if (st.diss === 'major') fixes.push('Major edge dissection: cover it with an additional stent.');
        CL.clear(out);
        out.append(
          h('div', { class: 'callout ' + (ultimate ? 'ok' : 'warn') }, h('strong', null, ultimate ? 'Meets ULTIMATE "optimal" criteria. ' : 'Not optimal yet. '), 'ULTIMATE needed all three: MSA >5.0 mm² or ≥90% of the distal reference lumen, plaque burden <50% at the edges, and no edge dissection involving the media >3 mm. Patients who met them had TVF 1.6% vs 4.4%.'),
          h('ul', { class: 'prose', style: { listStyle: 'none', paddingLeft: 0, fontSize: 'var(--step--1)' } }, checks.map(([t, ok]) => h('li', null, h('span', { class: 'tag ' + (ok ? 'pill-ok' : 'pill-bad'), style: { marginRight: '8px' } }, ok ? 'PASS' : 'FAIL'), t))),
          fixes.length ? h('div', { class: 'callout' }, h('strong', null, 'What to do  '), h('ul', null, fixes.map((f) => h('li', null, f)))) : null,
          st.lm ? h('div', { class: 'callout' }, h('strong', null, 'Left main targets ("5-6-7-8", Kang): '), 'LCx ostium >5, LAD ostium >6, polygon of confluence >7, proximal LM >8 mm². Western data suggest larger values; EXCEL proposed ~9.8 mm² in the LM.') : null);
      };
      const dissSeg = CL.ui.segmented([{ label: 'None', value: 'none' }, { label: 'Intimal / minor', value: 'minor' }, { label: 'Medial ≥60° or ≥3 mm', value: 'major' }], 'none', (x) => { st.diss = x; render(); });
      const panel = h('div', { class: 'panel' },
        h('h2', null, 'After the stent: is it optimized?'),
        h('div', { class: 'grid-3' },
          num('op-msa', 'Minimal stent area', 'msa', 0.1, 'mm²'),
          num('op-dref', 'Distal ref lumen area', 'dref', 0.1, 'mm²'),
          num('op-pref', 'Proximal ref lumen area', 'pref', 0.1, 'mm²'),
          num('op-pb', 'Edge plaque burden', 'edgePB', 1, '%'),
          num('op-mal', 'Max malapposition', 'mal', 0.05, 'mm'),
          num('op-mall', 'Malapposition length', 'malLen', 0.5, 'mm')),
        h('div', { class: 'row' }, h('span', { class: 'sub' }, 'Edge dissection'), dissSeg, CL.ui.check({ id: 'op-lm', label: 'Left main case', checked: false, onChange: (x) => { st.lm = x; render(); } })),
        out);
      render();
      return panel;
    },

    finet() {
      const st = { d1: 3.0, d2: 2.5 };
      const out = h('div', { class: 'readout' });
      const render = () => {
        const fin = 0.678 * (st.d1 + st.d2);
        const mur = Math.cbrt(Math.pow(st.d1, 3) + Math.pow(st.d2, 3));
        const hk = Math.pow(Math.pow(st.d1, 7 / 3) + Math.pow(st.d2, 7 / 3), 3 / 7);
        CL.clear(out);
        out.append(
          h('div', { class: 'r ok' }, h('span', { class: 'k' }, 'Finet: proximal MV'), h('span', { class: 'v' }, fin.toFixed(2) + ' mm')),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'Huo–Kassab (7/3)'), h('span', { class: 'v' }, hk.toFixed(2) + ' mm')),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'Murray (cube)'), h('span', { class: 'v' }, mur.toFixed(2) + ' mm')),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'POT balloon (NC)'), h('span', { class: 'v' }, (Math.round(fin * 4) / 4).toFixed(2) + ' mm')));
      };
      const sl = (id, label, key) => CL.ui.slider({ id, label, min: 1.5, max: 5, step: 0.25, value: st[key], format: (x) => x.toFixed(2) + ' mm', onInput: (x) => { st[key] = x; render(); } });
      render();
      return h('div', { class: 'panel' },
        h('h2', null, 'Bifurcation diameters: Finet’s law'),
        h('p', { class: 'sub' }, 'The proximal main vessel is bigger than either daughter. Finet: D(prox) = 0.678 × (D(distal MV) + D(SB)). Size the MV stent to the distal MV, then do the proximal optimization technique (POT) with an NC balloon sized to the proximal MV, ending just proximal to the carina.'),
        sl('fin-d1', 'Distal main vessel', 'd1'), sl('fin-d2', 'Side branch', 'd2'), out,
        h('p', { class: 'sub' }, 'Example: LAD 3.0 + LCx 2.75 gives an LM of ≈3.9 mm.'));
    },
    angioTips() {
      return h('div', { class: 'panel' }, h('h2', null, 'Angiographic sizing (no imaging)'),
        h('ul', { class: 'prose', style: { fontSize: 'var(--step--1)' } },
          h('li', null, 'Give IC nitroglycerin 100–200 µg first, so you size the relaxed vessel and not spasm.'),
          h('li', null, 'Choose an orthogonal view without foreshortening or overlap at the lesion and both reference segments.'),
          h('li', null, 'Use the guide catheter as a ruler: outer diameter ≈ French ÷ 3, so 6 Fr ≈ 2.0 mm, 7 Fr ≈ 2.3 mm, 8 Fr ≈ 2.7 mm. Better still, use QCA.'),
          h('li', null, 'Aim for stent:artery ≈1.0–1.1 : 1 to the distal reference lumen. Angiography sees the lumen only, so it tends to undersize vessels with diffuse disease and positive remodeling.'),
          h('li', null, 'Length: measure normal to normal on a non-foreshortened view, or use a marker wire. When unsure, go a little longer rather than leave disease at an edge.'),
          h('li', null, 'Every DES platform has a maximum expansion diameter. Check it before aggressive proximal post-dilation, especially in tapering vessels and the LM.')),
        h('div', { class: 'callout' }, h('strong', null, 'MLD MAX: '), 'Before the stent: Morphology (calcium? lipid?), Length (landing zones), Diameter (EEM or lumen). After the stent: Medial dissection, Apposition, eXpansion.'));
    },
  };
  CL.modules.stents = mod;
})();
