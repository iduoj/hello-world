/* Module: virtual C-arm — angiographic projections, dye injection, TIMI flow, lesions */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h, s = CL.svg;

  function carmDiagrams() {
    const ax = s('svg', { viewBox: '0 0 160 132', role: 'img', 'aria-label': 'C-arm seen from the patient’s feet' });
    ax.appendChild(s('line', { x1: 14, y1: 112, x2: 146, y2: 112, stroke: 'var(--line-strong)', 'stroke-width': 3 }));
    ax.appendChild(s('ellipse', { cx: 80, cy: 76, rx: 50, ry: 33, fill: 'var(--surface-3)', stroke: 'var(--line-strong)' }));
    ax.appendChild(s('circle', { cx: 80, cy: 99, r: 7, fill: 'var(--muted)' }));
    ax.appendChild(s('path', { d: 'M86 62 q16 -10 22 4 q4 12 -10 16 q-14 2 -12 -20z', fill: 'var(--lad)', opacity: 0.8 }));
    ax.appendChild(s('text', { x: 12, y: 80, 'font-size': 10, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'R' }));
    ax.appendChild(s('text', { x: 142, y: 80, 'font-size': 10, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'L' }));
    ax.appendChild(s('text', { x: 70, y: 38, 'font-size': 8, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'ANT' }));
    const beamA = s('line', { stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '3 3' });
    const detA = s('rect', { width: 34, height: 7, rx: 2, fill: 'var(--accent)' });
    const tubeA = s('circle', { r: 5, fill: 'var(--ink-2)' });
    ax.append(beamA, detA, tubeA);

    const sg = s('svg', { viewBox: '0 0 160 132', role: 'img', 'aria-label': 'C-arm seen from the patient’s left side' });
    sg.appendChild(s('line', { x1: 10, y1: 112, x2: 150, y2: 112, stroke: 'var(--line-strong)', 'stroke-width': 3 }));
    sg.appendChild(s('rect', { x: 44, y: 82, width: 100, height: 26, rx: 12, fill: 'var(--surface-3)', stroke: 'var(--line-strong)' }));
    sg.appendChild(s('circle', { cx: 32, cy: 94, r: 12, fill: 'var(--surface-3)', stroke: 'var(--line-strong)' }));
    sg.appendChild(s('ellipse', { cx: 82, cy: 90, rx: 10, ry: 7, fill: 'var(--lad)', opacity: 0.8 }));
    sg.appendChild(s('text', { x: 14, y: 126, 'font-size': 8, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'HEAD' }));
    sg.appendChild(s('text', { x: 124, y: 126, 'font-size': 8, fill: 'var(--muted)', 'font-family': 'var(--font-mono)', text: 'FEET' }));
    const beamS = s('line', { stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '3 3' });
    const detS = s('rect', { width: 34, height: 7, rx: 2, fill: 'var(--accent)' });
    const tubeS = s('circle', { r: 5, fill: 'var(--ink-2)' });
    sg.append(beamS, detS, tubeS);

    const wrap = h('div', { class: 'carm-diag' },
      h('figure', null, ax, h('figcaption', null, 'From the feet: LAO / RAO')),
      h('figure', null, sg, h('figcaption', null, 'From the left side: CRA / CAU')));
    wrap.update = (theta, phi) => {
      const t = theta * Math.PI / 180, p = phi * Math.PI / 180;
      const cx = 80, cy = 76, R = 56;
      const dx = cx + R * Math.sin(t), dy = cy - R * Math.cos(t) * 0.92;
      const tx = cx - R * Math.sin(t) * 0.85, ty = cy + R * Math.cos(t) * 0.6;
      detA.setAttribute('x', dx - 17); detA.setAttribute('y', dy - 3.5);
      detA.setAttribute('transform', `rotate(${theta} ${dx} ${dy})`);
      tubeA.setAttribute('cx', tx); tubeA.setAttribute('cy', ty);
      beamA.setAttribute('x1', tx); beamA.setAttribute('y1', ty); beamA.setAttribute('x2', dx); beamA.setAttribute('y2', dy);
      const scx = 82, scy = 90, R2 = 62;
      const sdx = scx - R2 * Math.sin(p), sdy = scy - R2 * Math.cos(p) * 0.95;
      const stx = scx + R2 * Math.sin(p) * 0.5, sty = scy + 18;
      detS.setAttribute('x', sdx - 17); detS.setAttribute('y', sdy - 3.5);
      detS.setAttribute('transform', `rotate(${-phi} ${sdx} ${sdy})`);
      tubeS.setAttribute('cx', stx); tubeS.setAttribute('cy', Math.min(sty, 118));
      beamS.setAttribute('x1', stx); beamS.setAttribute('y1', Math.min(sty, 118)); beamS.setAttribute('x2', sdx); beamS.setAttribute('y2', sdy);
    };
    return wrap;
  }

  const mod = {
    init(root) {
      this.root = root;
      root.appendChild(CL.ui.head('Left heart cath', 'Angiographic views: virtual C-arm',
        'Move the C-arm and watch the same coronary tree project differently. Inject contrast, set TIMI flow, and drop a lesion into any segment to see which view lays it out without overlap or foreshortening.'));

      this.stage = h('div', { class: 'monitor stage', id: 'views-stage' });
      this.carm = carmDiagrams();

      this.theta = CL.ui.slider({ id: 'carm-theta', label: 'LAO (+) / RAO (−)', min: -90, max: 90, value: -25, format: (v) => (v === 0 ? 'AP' : v > 0 ? 'LAO ' + v + '°' : 'RAO ' + -v + '°'), onInput: (v) => this.eng && this.eng.setAngles(v, Number(this.phi.input.value), false) });
      this.phi = CL.ui.slider({ id: 'carm-phi', label: 'Cranial (+) / Caudal (−)', min: -45, max: 45, value: -25, format: (v) => (v === 0 ? '0°' : v > 0 ? 'CRA ' + v + '°' : 'CAU ' + -v + '°'), onInput: (v) => this.eng && this.eng.setAngles(Number(this.theta.input.value), v, false) });

      const views = CL.data.views;
      const mkPreset = (v) => h('button', { type: 'button', class: 'chip', 'data-view': v.id, onclick: () => this.applyView(v) }, v.name.replace(' (RCA)', ''));
      this.presetsL = h('div', { class: 'chips' }, views.filter((v) => v.tree === 'LCA').map(mkPreset));
      this.presetsR = h('div', { class: 'chips' }, views.filter((v) => v.tree === 'RCA').map(mkPreset));

      this.viewInfo = h('div', { class: 'stack', 'aria-live': 'polite' });

      // injection
      this.btnL = h('button', { type: 'button', class: 'btn primary', onclick: () => this.inject('LCA') }, 'Inject left (LCA)');
      this.btnR = h('button', { type: 'button', class: 'btn primary', onclick: () => this.inject('RCA') }, 'Inject right (RCA)');
      this.btnRoad = h('button', { type: 'button', class: 'btn', onclick: () => { this.eng.setOption('roadmap', true); this.updateHud(); } }, 'Steady roadmap');
      const access = CL.ui.segmented([{ label: 'Femoral', value: 'femoral' }, { label: 'Right radial', value: 'radial' }], 'femoral', (v) => this.eng && this.eng.setOption('access', v), { label: 'Access' });
      const toggles = h('div', { class: 'row' },
        CL.ui.check({ id: 'views-labels', label: 'Labels', checked: false, onChange: (v) => this.eng && this.eng.setOption('labels', v) }),
        CL.ui.check({ id: 'views-both', label: 'Show both arteries', checked: false, onChange: (v) => this.eng && this.eng.setOption('showBoth', v) }),
        CL.ui.check({ id: 'views-beat', label: 'Heart motion', checked: true, onChange: (v) => this.eng && this.eng.setOption('beat', v) }),
        CL.ui.check({ id: 'views-spine', label: 'Spine', checked: true, onChange: (v) => this.eng && this.eng.setOption('spine', v) }),
        CL.ui.check({ id: 'views-cl', label: 'Circle & loop', checked: false, onChange: (v) => this.eng && this.eng.setOption('circleLoop', v) }));

      // lesion builder
      this.lesSeg = h('select', { id: 'les-seg', 'aria-label': 'Lesion segment' });
      this.lesSev = CL.ui.slider({ id: 'les-sev', label: 'Diameter stenosis', min: 0, max: 100, step: 5, value: 80, format: (v) => (v >= 100 ? '100% (occluded)' : v + '%'), onInput: () => this.applyLesion() });
      this.lesPos = CL.ui.slider({ id: 'les-pos', label: 'Position in segment', min: 0, max: 100, step: 5, value: 50, format: (v) => (v <= 5 ? 'ostial' : v + '%'), onInput: () => this.applyLesion() });
      this.lesTimi = CL.ui.segmented([{ label: 'TIMI 3', value: 3 }, { label: 'TIMI 2', value: 2 }, { label: 'TIMI 1', value: 1 }, { label: 'TIMI 0', value: 0 }], 3, (v) => { this.timi = v; this.applyLesion(); }, { label: 'TIMI flow' });
      this.timi = 3;
      this.lesSeg.addEventListener('change', () => this.applyLesion());
      this.timiText = h('p', { class: 'sub' });

      // quiz
      this.quizBox = h('div', { class: 'stack' });

      const console1 = h('div', { class: 'panel' },
        h('h3', null, 'Left coronary views'), this.presetsL,
        h('h3', null, 'Right coronary views'), this.presetsR,
        this.theta, this.phi, this.carm,
        h('hr', { class: 'divider' }),
        this.viewInfo);
      const console2 = h('div', { class: 'panel' },
        h('h3', null, 'Contrast injection'),
        h('div', { class: 'row' }, this.btnL, this.btnR, this.btnRoad),
        h('div', { class: 'row' }, h('span', { class: 'sub' }, 'Access'), access),
        toggles,
        h('hr', { class: 'divider' }),
        h('h3', null, 'Add a lesion'),
        h('div', { class: 'field' }, h('label', { for: 'les-seg' }, 'Segment'), this.lesSeg),
        this.lesSev, this.lesPos,
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Flow beyond the lesion'), this.lesTimi),
        this.timiText,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => this.clearLesion() }, 'Clear lesion')));

      root.appendChild(h('div', { class: 'bench' },
        h('div', { class: 'stack' }, this.stage,
          h('div', { class: 'panel' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', null, 'Name that view'),
            h('button', { type: 'button', class: 'btn primary', onclick: () => this.quiz() }, 'Give me a projection')), this.quizBox)),
        h('div', { class: 'stack' }, console1, console2)));

      // how to read a view
      root.appendChild(h('div', { class: 'panel' },
        h('h2', null, 'How to tell which view you are looking at'),
        h('div', { class: 'cards' }, CL.data.viewRules.map((r) => h('div', { class: 'card' }, h('h3', null, r.k), h('p', null, r.v))))));

      // table
      const rows = views.map((v) => h('tr', { style: { cursor: 'pointer' }, onclick: () => { this.applyView(v); this.stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
        h('td', null, h('strong', null, v.name)), h('td', { class: 'mono' }, v.range), h('td', null, v.best), h('td', null, v.look)));
      root.appendChild(h('div', { class: 'panel' }, h('h2', null, 'Standard projections'),
        h('p', { class: 'sub' }, 'Angles are the usual starting points. Every patient needs fine-tuning: rotate until the segment you care about is free of overlap and not foreshortened. Tap a row to load it.'),
        h('div', { class: 'table-wrap' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'View'), h('th', null, 'Angles'), h('th', null, 'Best shows'), h('th', null, 'How it looks'))),
          h('tbody', null, rows)))));

      root.appendChild(h('div', { class: 'panel' }, h('h2', null, 'Contrast, flow and pressure basics'),
        h('div', { class: 'cards' },
          h('div', { class: 'card' }, h('h3', null, 'TIMI flow grade'), h('ul', null,
            h('li', null, h('b', null, '0: '), 'no antegrade flow beyond the occlusion.'),
            h('li', null, h('b', null, '1: '), 'contrast penetrates the lesion but does not opacify the whole distal bed ("penetration without perfusion").'),
            h('li', null, h('b', null, '2: '), 'the whole distal vessel fills, but filling and/or clearance is slower than in a normal vessel.'),
            h('li', null, h('b', null, '3: '), 'normal, brisk filling and clearance.'))),
          h('div', { class: 'card' }, h('h3', null, 'TIMI frame count'), h('p', null, 'Cine frames from first opacification (contrast touches both borders, ≥70% of the lumen) to the distal landmark: LAD "mustache"/pitchfork (divide by 1.7 to correct for length), LCx distal bifurcation of the longest branch, RCA first posterolateral branch. Normal corrected count is about 21 ± 3 frames at 30 fps. At 15 fps, double the count.')),
          h('div', { class: 'card' }, h('h3', null, 'Myocardial blush grade'), h('p', null, '0 none or persistent staining · 1 minimal · 2 moderate, less than a non-infarct artery · 3 normal. Poor blush after reperfusion (no-reflow) predicts higher mortality.')),
          h('div', { class: 'card' }, h('h3', null, 'Damping and ventricularization'), h('p', null, 'Damping: the whole pressure trace flattens because the catheter wedges or sits against the wall. Ventricularization: diastolic pressure drops steeply and the dicrotic notch is lost because the tip obstructs an ostial lesion. Either one means: do not inject forcefully, disengage, and think "ostial disease or spasm". Options are IC nitroglycerin, a non-selective cusp shot, or a side-hole or smaller catheter.')),
          h('div', { class: 'card' }, h('h3', null, 'Hand injection volumes'), h('p', null, 'Typical: LCA about 7–10 mL, RCA about 4–6 mL per injection, enough to fill the vessel and reflux slightly into the sinus. Volume rises with catheter size and is less for small vessels. Track the total contrast load, especially in CKD.')),
          h('div', { class: 'card' }, h('h3', null, 'Diagnostic LHC sequence'), h('ol', null,
            h('li', null, 'Time-out, then access (radial preferred, femoral alternative); radial: heparin plus vasodilator.'),
            h('li', null, 'Catheter over a J-wire to the ascending aorta; flush, zero the transducer, record aortic pressure.'),
            h('li', null, 'Engage the LCA and acquire its views, then engage the RCA and acquire its views.'),
            h('li', null, 'Optional: pigtail into the LV for LVEDP (end-diastole, end-expiration) and an RAO 30° LV gram.'),
            h('li', null, 'Pull back across the aortic valve to look for a gradient; remove the sheath and achieve hemostasis.'))))));
      root.appendChild(CL.ui.refs(CL.data.viewRefs.concat([
        { t: 'TIMI Study Group. NEJM 1985;312:932 (TIMI flow grades)' },
        { t: 'Gibson CM et al. TIMI frame count. Circulation 1996;93:879', url: 'https://pubmed.ncbi.nlm.nih.gov/8598078/' },
        { t: 'van ’t Hof AW et al. Myocardial blush grade. Circulation 1998;97:2302', url: 'https://pubmed.ncbi.nlm.nih.gov/9639373/' },
        { t: 'Damped and ventricularized coronary pressure waveforms — J Invasive Cardiol', url: 'https://www.hmpgloballearningnetwork.com/site/jic/articles/damped-and-ventricularized-coronary-pressure-waveforms' },
      ])));
    },

    applyView(v, opts = {}) {
      if (!this.eng) return;
      this.current = v;
      if (this.eng.inj && this.eng.inj.root !== v.tree) this.eng.stopInjection();
      this.eng.setOption('catheter', v.tree);
      this.eng.setAngles(v.theta + (opts.jt || 0), v.phi + (opts.jp || 0), true);
      CL.$$('[data-view]', this.root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v.id)));
      if (!opts.quiz) this.renderViewInfo(v);
      this.updateHud();
    },
    renderViewInfo(v) {
      CL.clear(this.viewInfo);
      if (!v) {
        this.viewInfo.appendChild(h('p', { class: 'muted' }, 'Pick a preset or drag on the image to swing the C-arm. The readout shows the projection the detector is in.'));
        return;
      }
      this.viewInfo.append(
        h('div', { class: 'info-title' }, h('h2', null, v.name), h('span', { class: 'segnum' }, v.range)),
        h('dl', { class: 'kv' }, h('dt', null, 'Best shows'), h('dd', null, v.best), h('dt', null, 'Recognize it'), h('dd', null, v.look)),
        h('div', { class: 'chips' }, v.segs.filter((id) => !this.eng || this.eng.hasSeg(id)).map((id) => {
          const m = CL.data.segments[id];
          return h('button', { type: 'button', class: 'chip', style: { '--c': 'var(--' + CL.data.vesselColor[m.vessel] + ')' }, onclick: () => this.eng.select(id, true) }, h('span', { class: 'sw' }), m.label);
        })));
    },
    inject(root) {
      this.eng.inject(root);
      this.updateHud();
    },
    fillLesionSegs() {
      const cur = this.lesSeg.value;
      CL.clear(this.lesSeg);
      this.lesSeg.appendChild(h('option', { value: '' }, 'None'));
      ['lm', 'lad-p', 'lad-m', 'lad-d', 'd1', 'd2', 'lcx-p', 'lcx-d', 'om1', 'om2', 'ramus', 'lpda', 'rca-p', 'rca-m', 'rca-d', 'pda', 'rpl'].forEach((id) => {
        if (!this.eng.hasSeg(id)) return;
        this.lesSeg.appendChild(h('option', { value: id }, CL.data.segments[id].name));
      });
      this.lesSeg.value = cur && this.eng.hasSeg(cur) ? cur : '';
    },
    applyLesion() {
      const seg = this.lesSeg.value;
      const sev = Number(this.lesSev.input.value) / 100;
      let timi = this.timi;
      if (sev >= 1 && timi > 0) { timi = 0; this.lesTimi.set(0); this.timi = 0; }
      if (!seg) { this.eng.setLesion(null); this.timiText.textContent = ''; return; }
      this.eng.setLesion({ seg, sev, pos: Number(this.lesPos.input.value) / 100, timi, len: 0.8 });
      const tree = CL.data.segments[seg].tree === 'R' ? 'RCA' : 'LCA';
      if (this.eng.opts.catheter !== tree) this.eng.setOption('catheter', tree);
      this.eng.select(seg);
      const txt = { 3: 'TIMI 3: the lesion narrows the lumen but flow is brisk. Inject to see it.', 2: 'TIMI 2: the distal bed fills and clears slowly. Inject and watch the lag.', 1: 'TIMI 1: contrast seeps just past the lesion and never fills the distal vessel.', 0: 'TIMI 0: nothing fills beyond the occlusion (a stump). Look for collaterals and the ECG territory.' };
      this.timiText.textContent = txt[timi] + ' Press Inject for a cine run; the steady roadmap ignores flow.';
      this.updateHud();
    },
    clearLesion() { this.lesSeg.value = ''; this.eng.setLesion(null); this.timiText.textContent = ''; this.updateHud(); },
    updateHud() {
      const e = this.eng;
      if (!e) return;
      const a = e.target;
      const quiz = this.quizState && !this.quizState.answered;
      CL.clear(e.hud.tl);
      e.hud.tl.append(h('div', { class: 'big' }, quiz ? '??? ?° · ??? ?°' : CL.Heart3D.angleText(a.theta, a.phi)));
      const tree = e.opts.catheter;
      e.hud.tr.innerHTML = '';
      e.hud.tr.append(h('div', null, (tree === 'LCA' ? 'LEFT CORONARY' : 'RIGHT CORONARY')), h('div', null, e.inj ? 'CINE 15 fps' : 'ROADMAP'));
      e.hud.bl.textContent = 'Drag to swing the C-arm · tap a vessel';
      e.hud.br.textContent = quiz ? '' : (this.current && Math.abs(this.current.theta - a.theta) < 1 && Math.abs(this.current.phi - a.phi) < 1 ? this.current.name : '');
      this.carm.update(a.theta, a.phi);
      if (!quiz) { this.theta.setValue(Math.round(CL.clamp(a.theta, -90, 90))); this.phi.setValue(Math.round(CL.clamp(a.phi, -45, 45))); }
    },
    quiz() {
      const all = CL.data.views;
      const v = all[Math.floor(Math.random() * all.length)];
      const jt = Math.round((Math.random() - 0.5) * 8), jp = Math.round((Math.random() - 0.5) * 8);
      this.quizState = { v, answered: false };
      this.eng.setOption('labels', false); CL.$('#views-labels').checked = false;
      this.eng.select(null);
      this.applyView(v, { jt, jp, quiz: true });
      CL.$$('[data-view]', this.root).forEach((b) => b.setAttribute('aria-pressed', 'false'));
      // choices: correct + 3 distractors from the same artery when possible
      const pool = all.filter((x) => x.id !== v.id).sort(() => Math.random() - 0.5);
      const same = pool.filter((x) => x.tree === v.tree);
      const opts = [v].concat(same.slice(0, 3));
      while (opts.length < 4) opts.push(pool[opts.length]);
      opts.sort(() => Math.random() - 0.5);
      CL.clear(this.quizBox);
      this.quizBox.append(h('p', null, 'The C-arm moved to a standard projection (± a few degrees). Use the spine, the diaphragm and the shape of the vessels. Which view is this?'));
      const box = h('div', { class: 'q-opts' });
      opts.forEach((o, i) => {
        const b = h('button', { type: 'button', class: 'q-opt' }, h('span', { class: 'k' }, 'ABCD'[i]), o.name);
        b.addEventListener('click', () => {
          if (this.quizState.answered) return;
          this.quizState.answered = true;
          CL.$$('.q-opt', box).forEach((x) => { x.disabled = true; });
          b.classList.add(o.id === v.id ? 'right' : 'wrong');
          if (o.id !== v.id) box.children[opts.indexOf(v)].classList.add('right');
          this.quizBox.append(h('div', { class: o.id === v.id ? 'callout ok' : 'callout warn' },
            h('strong', null, (o.id === v.id ? 'Correct. ' : 'Not quite. ') + v.name + ' (' + CL.Heart3D.angleText(this.eng.target.theta, this.eng.target.phi) + '). '), v.look + ' Best for: ' + v.best));
          this.renderViewInfo(v);
          this.updateHud();
        });
        box.appendChild(b);
      });
      this.quizBox.append(box);
      this.updateHud();
    },
    show() {
      try { this.eng = CL.Heart3D.get(); } catch (e) { this.stage.appendChild(h('div', { class: 'callout warn', style: { margin: '16px' } }, e.message)); return; }
      const e = this.eng;
      e.attach(this.stage);
      e.setMode('fluoro');
      e.setOption('labels', CL.$('#views-labels').checked);
      e.setOption('circleLoop', CL.$('#views-cl').checked);
      e.setOption('heartOpacity', e.opts.heartOpacity);
      if (!this._bound) {
        this._bound = true;
        e.on('angles', () => { if (CL.router.current === 'views') this.updateHud(); });
        e.on('inject', () => { if (CL.router.current === 'views') this.updateHud(); });
        e.on('select', (p) => {
          if (CL.router.current !== 'views' || !p.fromUser) return;
          if (!p.id) return;
          CL.clear(this.viewInfo);
          this.viewInfo.appendChild(CL.segInfo(p.id));
        });
      }
      this.fillLesionSegs();
      if (!e.lesion) { this.lesSeg.value = ''; this.timiText.textContent = ''; }
      const focus = CL.pendingViewFocus; CL.pendingViewFocus = null;
      if (focus) {
        const meta = CL.data.segments[focus.seg];
        const tree = meta && meta.tree === 'R' ? 'RCA' : 'LCA';
        const v = (focus.view && CL.data.views.find((x) => x.id === focus.view)) || CL.data.views.find((x) => x.tree === tree && x.segs.indexOf(focus.seg) >= 0) || CL.data.views.find((x) => x.tree === tree);
        if (focus.lesion) {
          this.lesSeg.value = focus.seg;
          this.lesSev.setValue(Math.round(focus.lesion.sev * 100));
          this.lesPos.setValue(Math.round((focus.lesion.pos != null ? focus.lesion.pos : 0.4) * 100));
          this.timi = focus.lesion.timi; this.lesTimi.set(this.timi);
          this.applyLesion();
        }
        this.applyView(v);
        e.select(focus.seg);
        CL.clear(this.viewInfo); this.viewInfo.appendChild(CL.segInfo(focus.seg));
        if (focus.lesion) setTimeout(() => this.inject(tree), 700);
      } else if (!this._shownOnce) {
        this.applyView(CL.data.views[0]);
      } else {
        this.applyView(this.current || CL.data.views[0]);
      }
      this._shownOnce = true;
      this.updateHud();
    },
    hide() { if (this.eng) this.eng.detach(); },
  };
  CL.modules.views = mod;
})();
