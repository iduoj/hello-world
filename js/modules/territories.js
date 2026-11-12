/* Module: territories — culprit artery ⇄ 12-lead ECG ⇄ echo wall motion */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h;

  const mod = {
    init(root) {
      this.root = root;
      this.sc = CL.data.culprits.find((c) => c.id === 'plad');
      this.stage = 'acute';
      this.opts = { highlight: true, extra: false };
      root.appendChild(CL.ui.head('Clinical integration', 'ECG and echo by territory',
        'Pick a culprit lesion and see the 12-lead it produces, the wall-motion pattern on echo, and the complications to expect. Then jump to the same occlusion on angiography.'));

      const vcol = (v) => (v ? 'var(--' + CL.data.vesselColor[v] + ')' : 'var(--muted)');
      this.chips = CL.ui.chips(CL.data.culprits.map((c) => ({ label: c.name, value: c.id, color: c.vessel ? vcol(c.vessel) : null })), this.sc.id, (id) => this.pick(id), { label: 'Culprit' });
      this.stageSeg = CL.ui.segmented([{ label: 'Hyperacute', value: 'hyperacute' }, { label: 'Acute STEMI', value: 'acute' }, { label: 'Evolved (Q waves, T inversion)', value: 'evolved' }], 'acute', (v) => { this.stage = v; this.renderECG(); }, { label: 'Stage' });
      this.ecgBox = h('div', { class: 'ecg-paper' });
      const ecgTools = h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('div', { class: 'row' }, h('span', { class: 'sub' }, 'Stage'), this.stageSeg),
        h('div', { class: 'row' },
          CL.ui.check({ id: 'ecg-hl', label: 'Highlight ST changes', checked: true, onChange: (v) => { this.opts.highlight = v; this.renderECG(); } }),
          CL.ui.check({ id: 'ecg-extra', label: 'Add V4R and V7–V9', checked: false, onChange: (v) => { this.opts.extra = v; this.renderECG(); } })));
      this.legend = h('div', { class: 'legend' },
        h('span', { style: { '--c': 'var(--bad)' } }, h('i'), 'ST elevation'),
        h('span', { style: { '--c': 'var(--lcx)' } }, h('i'), 'ST depression (reciprocal or ischemic)'),
        h('span', { style: { '--c': 'var(--accent)' } }, h('i'), 'T-wave pattern'));

      root.appendChild(h('div', { class: 'panel' }, h('h2', null, 'Culprit'), this.chips));
      root.appendChild(h('div', { class: 'panel' }, h('h2', null, '12-lead ECG'), ecgTools, this.ecgBox, this.legend));

      // echo + bullseye + info
      this.echoCanvas = h('canvas', { 'aria-label': 'Animated echocardiogram' });
      const echoMon = h('div', { class: 'monitor', style: { aspectRatio: '1 / 0.92', width: '100%' } }, this.echoCanvas);
      this.echoCanvas.style.width = '100%'; this.echoCanvas.style.height = '100%';
      this.echo = new CL.Echo.View(this.echoCanvas);
      this.viewChips = CL.ui.segmented([{ label: 'PLAX', value: 'plax' }, { label: 'PSAX mid', value: 'psax' }, { label: 'A4C', value: 'a4c' }, { label: 'A2C', value: 'a2c' }, { label: 'A3C', value: 'a3c' }], 'psax', (v) => { this.echo.set({ view: v }); this.viewNote.textContent = CL.Echo.VIEWS[v].shows; }, { label: 'Echo view' });
      this.echo.set({ view: 'psax' });
      this.viewNote = h('p', { class: 'sub' }, CL.Echo.VIEWS.psax.shows);
      const echoTools = h('div', { class: 'row' },
        CL.ui.check({ id: 'echo-lbl', label: 'Segment overlay', checked: true, onChange: (v) => this.echo.set({ labels: v }) }),
        CL.ui.check({ id: 'echo-chronic', label: 'Chronic scar (thin, bright)', checked: false, onChange: (v) => this.echo.set({ chronic: v }) }),
        CL.ui.check({ id: 'echo-slow', label: 'Slow motion', checked: false, onChange: (v) => this.echo.set({ speed: v ? 0.4 : 1 }) }));
      this.bullBox = h('div', { style: { maxWidth: '300px', margin: '0 auto', width: '100%' } });
      this.terrToggle = true;
      const bullTools = CL.ui.check({ id: 'bull-terr', label: 'Tint by coronary territory', checked: true, onChange: (v) => { this.terrToggle = v; this.renderBull(); } });
      const bullLegend = h('div', { class: 'legend' },
        h('span', { style: { '--c': 'var(--warn)' } }, h('i'), 'Hypokinetic'),
        h('span', { style: { '--c': 'var(--bad)' } }, h('i'), 'Akinetic'),
        h('span', { style: { '--c': 'var(--ramus)' } }, h('i'), 'Dyskinetic'));
      this.info = h('div', { class: 'panel', 'aria-live': 'polite' });

      root.appendChild(h('div', { class: 'bench' },
        h('div', { class: 'panel' }, h('h2', null, 'Echo'), this.viewChips, echoMon, this.viewNote, echoTools),
        h('div', { class: 'stack' },
          h('div', { class: 'panel' }, h('h2', null, '17-segment map'), this.bullBox, bullLegend, bullTools),
          this.info)));

      root.appendChild(this.teaching());
      this.pick(this.sc.id);
    },
    pick(id) {
      this.sc = CL.data.culprits.find((c) => c.id === id);
      if (this.chips && this.chips.set) this.chips.set(id);
      const special = !!(this.sc.special || this.sc.ischemia);
      CL.$$('button', this.stageSeg).forEach((b) => { b.disabled = special; });
      this.renderECG();
      this.echo.set({ scores: this.sc.echo, rv: !!this.sc.rv });
      this.renderBull();
      this.renderInfo();
    },
    renderECG() {
      CL.clear(this.ecgBox);
      this.ecgBox.appendChild(CL.ECG.render(this.sc, { stage: this.stage, highlight: this.opts.highlight, extra: this.opts.extra || this.sc.id === 'post' || this.sc.id === 'prca' }));
    },
    renderBull() {
      CL.clear(this.bullBox);
      this.bullBox.appendChild(CL.Echo.bullseye(this.sc.echo, { territories: this.terrToggle }));
    },
    renderInfo() {
      const sc = this.sc;
      CL.clear(this.info);
      const segMeta = sc.seg ? CL.data.segments[sc.seg] : null;
      const affected = Object.keys(sc.echo).map(Number).sort((a, b) => a - b);
      this.info.append(
        h('div', { class: 'info-title' }, h('h2', null, sc.name), segMeta ? CL.ui.tag(segMeta.name, 'var(--' + CL.data.vesselColor[segMeta.vessel] + ')') : null),
        h('ul', { class: 'prose', style: { fontSize: 'var(--step--1)' } }, sc.teach.map((t) => h('li', null, t))),
        affected.length ? h('p', { class: 'sub' }, h('b', null, 'Abnormal segments: '), affected.map((n) => n + ' ' + CL.data.segNames[n].toLowerCase()).join(', ') + (sc.rv ? '; plus the RV free wall' : '') + '.') : null,
        sc.cx && sc.cx.length ? h('div', { class: 'callout warn' }, h('strong', null, 'Watch for  '), h('ul', null, sc.cx.map((c) => h('li', null, c)))) : null,
        sc.seg ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => this.toAngio() }, 'Show this lesion on angiography →'),
          h('button', { type: 'button', class: 'btn', onclick: () => { CL.pendingAnatomy = sc.seg; location.hash = 'anatomy'; setTimeout(() => { try { CL.Heart3D.get().select(sc.seg, true); } catch (e) { /* no webgl */ } }, 60); } }, 'Find it in 3D')) : null);
    },
    toAngio() {
      const sc = this.sc;
      const occl = !sc.special && !sc.ischemia;
      CL.pendingViewFocus = { seg: sc.seg, view: sc.view, lesion: { sev: occl ? 1 : (sc.sev || 0.8), pos: sc.lesionPos != null ? sc.lesionPos : 0.4, timi: occl ? 0 : (sc.timi != null ? sc.timi : 3) } };
      try {
        const e = CL.Heart3D.get();
        const meta = CL.data.segments[sc.seg];
        if (sc.dom) e.setDominance(sc.dom); else if (meta && (meta.vessel === 'RCA') && e.dom === 'left') e.setDominance('right');
      } catch (err) { /* ignore */ }
      location.hash = 'views';
    },
    teaching() {
      const loc = [
        ['Septal', 'V1–V2', '—', 'LAD septal perforators'],
        ['Anterior', 'V3–V4', '—', 'LAD'],
        ['Anteroseptal', 'V1–V4', 'Inferior if proximal', 'LAD'],
        ['Extensive anterior', 'V1–V6, I, aVL', 'II, III, aVF', 'Proximal LAD'],
        ['Lateral', 'I, aVL, V5–V6', 'III, aVF', 'LCx / OM (or diagonal)'],
        ['High lateral', 'I, aVL (± V2)', 'III (most), aVF', 'D1 > OM / ramus'],
        ['Inferior', 'II, III, aVF', 'aVL (± I)', 'RCA (~80%) or LCx'],
        ['Right ventricular', 'V1, V4R (V3R–V6R)', '—', 'Proximal RCA'],
        ['Posterior', 'V7–V9', 'V1–V3 (tall R, upright T)', 'LCx or RCA posterolateral'],
        ['Diffuse subendocardial', 'aVR (± V1)', '≥6 leads', 'LM / multivessel / demand'],
      ];
      return h('div', { class: 'stack' },
        h('div', { class: 'grid-2' },
          h('div', { class: 'panel' }, h('h2', null, 'Localization at a glance'),
            h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '0' } },
              h('thead', null, h('tr', null, h('th', null, 'Territory'), h('th', null, 'STE'), h('th', null, 'Reciprocal STD'), h('th', null, 'Usual artery'))),
              h('tbody', null, loc.map((r) => h('tr', null, r.map((c, i) => h('td', { class: i === 1 || i === 2 ? 'mono' : null }, c)))))))),
          h('div', { class: 'stack' },
            h('div', { class: 'panel' }, h('h2', null, 'Inferior STEMI: RCA or LCx?'),
              h('div', { class: 'grid-2' },
                h('div', { class: 'card', style: { boxShadow: 'inset 3px 0 0 var(--rca)' } }, h('h3', null, 'RCA'), h('ul', null, h('li', null, 'STE III > II'), h('li', null, 'STD in I and aVL (aVL > I)'), h('li', null, 'V1 STE or V4R STE: proximal, RV infarct'))),
                h('div', { class: 'card', style: { boxShadow: 'inset 3px 0 0 var(--lcx)' } }, h('h3', null, 'LCx'), h('ul', null, h('li', null, 'STE II ≥ III'), h('li', null, 'I and aVL isoelectric or elevated'), h('li', null, 'STE V5–V6; STD V1–V3 (posterior)')))),
              h('p', { class: 'sub' }, 'These rules lose accuracy when tested in new cohorts. Use them to predict, then confirm on the angiogram.')),
            h('div', { class: 'panel' }, h('h2', null, 'STEMI thresholds (4th UDMI)'),
              h('dl', { class: 'kv' }, CL.data.stemiCriteria.map((c) => [h('dt', null, c.leads), h('dd', null, c.thr)])),
              h('p', { class: 'sub' }, 'A Fifth Universal Definition (2026) has been published; check its updated thresholds. STEMI equivalents: posterior MI, de Winter, Sgarbossa/Smith-modified criteria in LBBB or pacing, and hyperacute T waves.')))),
        h('div', { class: 'grid-2' },
          h('div', { class: 'panel' }, h('h2', null, 'Conduction and territory'),
            h('div', { class: 'grid-2' },
              h('div', { class: 'card' }, h('h3', null, 'Inferior MI (RCA)'), h('ul', null, h('li', null, 'AV nodal artery (RCA ~80–90%) and vagal (Bezold–Jarisch) reflex'), h('li', null, 'Sinus brady, Mobitz I, CHB with a narrow escape'), h('li', null, 'Usually transient; recovers in 24–72 h'))),
              h('div', { class: 'card' }, h('h3', null, 'Anterior MI (LAD)'), h('ul', null, h('li', null, 'Septal perforators supply the RBB and left anterior fascicle'), h('li', null, 'Mobitz II, CHB with a wide escape, new RBBB ± LAFB'), h('li', null, 'Means a large proximal infarct and high mortality')))) ,
            h('h3', null, 'Wall motion scoring (ASE 2015)'),
            h('dl', { class: 'kv' }, h('dt', null, '1'), h('dd', null, 'Normal or hyperkinetic'), h('dt', null, '2'), h('dd', null, 'Hypokinetic: reduced thickening'), h('dt', null, '3'), h('dd', null, 'Akinetic: absent or negligible thickening'), h('dt', null, '4'), h('dd', null, 'Dyskinetic: systolic thinning or outward bulging')),
            h('p', { class: 'sub' }, 'WMSI = sum of scores ÷ segments scored (1.0 = normal). Ischemia: new loss of thickening with normal wall thickness. Chronic transmural scar: thin (≤6 mm end-diastolic), bright, akinetic or dyskinetic. Stress echo: a biphasic response to dobutamine (better at low dose, worse at peak) means viable but ischemic muscle.')),
          h('div', { class: 'panel' }, h('h2', null, 'Mechanical complications by territory'),
            h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '0' } },
              h('thead', null, h('tr', null, h('th', null, 'Complication'), h('th', null, 'Territory'), h('th', null, 'Echo and timing'))),
              h('tbody', null, CL.data.mechanicalCx.map((r) => h('tr', null, h('td', null, h('b', null, r.cx)), h('td', null, r.terr), h('td', null, r.echo)))))))),
        h('div', { class: 'callout' }, h('strong', null, 'Territory map: '), 'LAD 1, 2, 7, 8, 13, 14, 17 · RCA 3, 4, 9, 10, 15 · LCx 5, 6, 11, 12, 16. Supply varies a lot: the apex can belong to any artery, the inferolateral wall depends on dominance, and the inferior apex goes to a wraparound LAD.'),
        CL.ui.refs(CL.data.territoryRefs));
    },
    show() {
      if (this.echo) this.echo.set({});
    },
  };
  CL.modules.territories = mod;
})();
