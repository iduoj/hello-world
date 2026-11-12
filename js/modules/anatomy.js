/* Module: 3D coronary anatomy explorer */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h;

  // shared: segment info card (also used by Angio Views)
  CL.segInfo = function (id, opts = {}) {
    const S = CL.data.segments[id];
    if (!S) {
      return h('div', { class: 'stack' },
        h('h3', null, 'Pick a vessel'),
        h('p', { class: 'muted' }, 'Tap any artery on the model or a name in the list. Each card gives the SYNTAX segment definition (where proximal ends and mid begins), the myocardium it supplies, the ECG pattern of an occlusion, and the views that lay it out best.'));
    }
    const key = CL.data.vesselColor[S.vessel] || 'lad';
    const col = 'var(--' + key + ')';
    return h('div', { class: 'stack' },
      h('div', { class: 'info-title' },
        h('h2', null, S.name),
        S.syntax && S.syntax !== '—' ? h('span', { class: 'segnum', title: 'SYNTAX segment number' }, 'SYNTAX ' + S.syntax) : null,
        CL.ui.tag(S.vessel === 'Ramus' ? 'Left (ramus)' : S.vessel, col)),
      h('dl', { class: 'kv' },
        h('dt', null, 'Defined as'), h('dd', null, S.def),
        h('dt', null, 'Supplies'), h('dd', null, S.supplies),
        h('dt', null, 'ECG if occluded'), h('dd', null, S.ecg),
        h('dt', null, 'Best views'), h('dd', null, h('ul', null, S.views.map((v) => h('li', null, v))))),
      S.pearls && S.pearls.length ? h('div', { class: 'callout' }, h('strong', null, 'Pearls  '), h('ul', null, S.pearls.map((p) => h('li', null, p)))) : null,
      opts.actions || null);
  };

  const GROUPS = [
    { label: 'Left main', ids: ['lm'] },
    { label: 'LAD', ids: ['lad-p', 'lad-m', 'lad-d', 'd1', 'd2', 'sept'] },
    { label: 'Circumflex', ids: ['lcx-p', 'om1', 'om2', 'lcx-d', 'lpl', 'lpda', 'ramus'] },
    { label: 'RCA', ids: ['rca-p', 'rca-m', 'rca-d', 'pda', 'rpl', 'conus', 'sanode', 'rvb', 'avn'] },
  ];

  const mod = {
    init(root) {
      this.root = root;
      root.appendChild(CL.ui.head('Coronary anatomy', '3D anatomy explorer',
        'Rotate the heart, tap a vessel, and read its exact segment definition. The model uses SYNTAX (modified AHA) segment numbering. Proximal, mid and distal segments are shaded light to dark so you can see where each one ends.'));

      if (!CL.Heart3D.supported()) {
        root.appendChild(h('div', { class: 'callout warn' }, 'This browser has WebGL turned off, so the 3D model cannot run. The segment definitions below still work.'));
      }

      const stage = h('div', { class: 'monitor stage', id: 'anat-stage' });
      this.stage = stage;
      const info = h('div', { class: 'panel', id: 'anat-info', 'aria-live': 'polite' });
      this.info = info;

      // controls
      const domSeg = CL.ui.segmented([
        { label: 'Right dominant', value: 'right' },
        { label: 'Left dominant', value: 'left' },
        { label: 'Codominant', value: 'co' },
      ], 'right', (v) => { this.eng && this.eng.setDominance(v); this.domText.textContent = CL.data.dominance[v].prevalence + ': ' + CL.data.dominance[v].text; this.refreshList(); }, { label: 'Dominance' });
      this.domSeg = domSeg;
      this.domText = h('p', { class: 'sub' }, CL.data.dominance.right.prevalence + ': ' + CL.data.dominance.right.text);

      const quick = h('div', { class: 'chips' },
        [['Front (AP)', 0, 0], ['From the left', 90, 0], ['From the right', -90, 0], ['From below', 0, -80], ['From the apex', 48, -32], ['From behind', 180, 10]].map(([l, t, p]) =>
          h('button', { type: 'button', class: 'chip', onclick: () => this.eng && this.eng.setAngles(t, p, true) }, l)));

      const opac = CL.ui.slider({ id: 'anat-opacity', label: 'Heart muscle', min: 0, max: 100, value: 92, format: (v) => v + '%', onInput: (v) => this.eng && this.eng.setOption('heartOpacity', v / 100) });

      const toggles = h('div', { class: 'row' },
        CL.ui.check({ id: 'anat-labels', label: 'Labels', checked: true, onChange: (v) => this.eng && this.eng.setOption('labels', v) }),
        CL.ui.check({ id: 'anat-segcol', label: 'Shade segments', checked: true, onChange: (v) => this.eng && this.eng.setOption('segColors', v) }),
        CL.ui.check({ id: 'anat-ramus', label: 'Ramus intermedius', checked: false, onChange: (v) => { this.eng && this.eng.setRamus(v); this.refreshList(); } }),
        CL.ui.check({ id: 'anat-cl', label: 'Circle & loop', checked: false, onChange: (v) => { this.eng && this.eng.setOption('circleLoop', v); this.clNote.hidden = !v; } }));
      this.clNote = h('p', { class: 'sub', hidden: true }, 'Gold ring = AV groove (the "circle" of the RCA and LCx). Blue = interventricular grooves (the "loop" of the LAD and PDA). Rotate to see why LAO opens the circle and RAO opens the loop.');

      this.list = h('div', { class: 'picklist', role: 'listbox', 'aria-label': 'Coronary segments' });

      const controls = h('div', { class: 'panel' },
        h('h3', null, 'Dominance'), domSeg, this.domText,
        h('hr', { class: 'divider' }),
        h('h3', null, 'Look from'), quick, opac, toggles, this.clNote,
        h('hr', { class: 'divider' }),
        h('h3', null, 'Segments'), this.list);

      root.appendChild(h('div', { class: 'bench' },
        h('div', { class: 'stack' }, stage, info),
        controls));

      // glossary
      root.appendChild(h('div', { class: 'panel' },
        h('h2', null, 'Definitions you will be tested on'),
        h('div', { class: 'cards' }, CL.data.glossary.map((g) => h('div', { class: 'card' }, h('h3', null, g.term), h('p', null, g.def))))));

      root.appendChild(h('div', { class: 'panel' },
        h('h2', null, 'Segment map (SYNTAX numbering)'),
        h('p', { class: 'sub' }, 'SYNTAX has no segment 17; the ramus is 12. The SCCT CT model numbers the ramus 17 instead. Know which system your report uses.'),
        this.segTable()));

      root.appendChild(CL.ui.refs([
        { t: 'Sianos G et al. The SYNTAX score. EuroIntervention 2005;1:219–227', url: 'https://eurointervention.pcronline.com/article/the-syntax-score-an-angiographic-tool-grading-the-complexity-of-coronary-artery-disease' },
        { t: 'SYNTAX score tutorial: segment definitions', url: 'https://syntaxscore.org/index.php/tutorial/definitions/14-appendix-i-segment-definitions' },
        { t: 'StatPearls: Anatomy, Thorax, Heart Coronary Arteries', url: 'https://www.ncbi.nlm.nih.gov/books/NBK537207' },
        { t: 'Radiopaedia: Coronary arteries; Segmental anatomy of the coronary arteries (SCCT)', url: 'https://radiopaedia.org/articles/segmental-anatomy-of-the-coronary-arteries' },
        { t: 'EuroIntervention: PCI of ostial lesions', url: 'https://eurointervention.pcronline.com/article/percutaneous-coronary-intervention-of-ostial-lesions' },
      ]));

      this.renderInfo(null);
      this.refreshList();
    },
    segTable() {
      const rows = [];
      const order = ['rca-p', 'rca-m', 'rca-d', 'pda', 'rpl', 'lm', 'lad-p', 'lad-m', 'lad-d', 'd1', 'd2', 'lcx-p', 'ramus', 'om1', 'om2', 'lcx-d', 'lpl', 'lpda'];
      order.forEach((id) => {
        const s = CL.data.segments[id];
        const key = CL.data.vesselColor[s.vessel];
        const tr = h('tr', { style: { cursor: 'pointer' }, onclick: () => { this.eng && this.eng.select(id, true); this.stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
          h('td', { class: 'mono' }, s.syntax),
          h('td', null, h('span', { class: 'tag c', style: { '--c': 'var(--' + key + ')' } }, s.label)),
          h('td', null, s.name),
          h('td', null, s.def));
        rows.push(tr);
      });
      return h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Label'), h('th', null, 'Segment'), h('th', null, 'Definition'))),
        h('tbody', null, rows)));
    },
    refreshList() {
      CL.clear(this.list);
      const eng = this.eng;
      GROUPS.forEach((g) => {
        g.ids.forEach((id) => {
          if (eng && !eng.hasSeg(id)) return;
          const s = CL.data.segments[id];
          const key = CL.data.vesselColor[s.vessel];
          const b = h('button', { type: 'button', 'aria-pressed': String(eng && eng.sel === id), style: { '--c': 'var(--' + key + ')' }, onclick: () => eng && eng.select(id, true) },
            h('span', { class: 'sw' }), s.name, s.syntax !== '—' ? h('span', { class: 'n' }, s.syntax) : null);
          b.dataset.id = id;
          this.list.appendChild(b);
        });
      });
    },
    renderInfo(id) {
      CL.clear(this.info);
      const actions = id ? h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => { CL.pendingViewFocus = { seg: id }; location.hash = 'views'; } }, 'See it on angiography →')) : null;
      this.info.appendChild(CL.segInfo(id, { actions }));
    },
    show() {
      try { this.eng = CL.Heart3D.get(); } catch (e) { this.stage.appendChild(h('div', { class: 'callout warn', style: { margin: '16px' } }, e.message)); return; }
      const eng = this.eng;
      eng.attach(this.stage);
      eng.setMode('anatomy');
      if (!this._bound) {
        this._bound = true;
        eng.on('select', (p) => {
          if (CL.router.current !== 'anatomy') return;
          this.renderInfo(p.id);
          CL.$$('button', this.list).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === p.id)));
        });
        eng.on('angles', (a) => { if (CL.router.current === 'anatomy') this.hudAngles(a); });
        this.hint = true;
      }
      // sync controls with the shared engine state
      this.domSeg.set(eng.dom);
      eng.setOption('heartOpacity', Number(CL.$('#anat-opacity').value) / 100);
      eng.setOption('labels', CL.$('#anat-labels').checked);
      eng.setOption('circleLoop', CL.$('#anat-cl').checked);
      CL.$('#anat-ramus').checked = eng.ramus;
      if (eng.lesion) eng.setLesion(null);
      if (!this._shownOnce) { eng.setAngles(-12, 12, false); this._shownOnce = true; }
      this.refreshList();
      this.renderInfo(eng.sel);
      eng.hud.tl.innerHTML = '';
      eng.hud.bl.textContent = 'Drag to rotate · scroll or pinch to zoom · tap a vessel';
      eng.hud.br.textContent = '';
      eng.hud.tr.textContent = '';
      this.hudAngles({ theta: eng.target.theta, phi: eng.target.phi });
    },
    hudAngles(a) {
      const eng = this.eng;
      eng.hud.tl.innerHTML = '';
      eng.hud.tl.appendChild(h('div', null, 'Viewing from'));
      eng.hud.tl.appendChild(h('div', { class: 'big' }, CL.Heart3D.angleText(a.theta, a.phi)));
    },
    hide() { if (this.eng) this.eng.detach(); },
  };
  CL.modules.anatomy = mod;
})();
