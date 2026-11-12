/* Module: Cardiac ICU — time-based branching cases with graded decisions and a live bedside monitor */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h;

  const GRADE = {
    best: { label: 'Best next step', cls: 'ok', tag: 'pill-ok', pts: 2 },
    ok: { label: 'Reasonable, not best', cls: '', tag: 'pill-warn', pts: 1 },
    poor: { label: 'Not recommended', cls: 'warn', tag: 'pill-bad', pts: 0 },
    harm: { label: 'Harmful', cls: 'warn', tag: 'pill-bad', pts: -1 },
  };
  const fmtT = (t) => (typeof t === 'string' ? t : t < 60 ? 'T+' + t + ' min' : 'T+' + Math.floor(t / 60) + 'h' + (t % 60 ? ' ' + (t % 60) + 'm' : ''));
  const map = (s) => Math.round((s.sbp + 2 * s.dbp) / 3);

  const mod = {
    init(root) {
      this.root = root;
      this.lib = h('div', { class: 'stack' });
      this.run = h('div', { class: 'stack', hidden: true });
      root.appendChild(CL.ui.head('Cardiac ICU', 'CICU cases: you make the call',
        'Time-stamped scenarios from the cardiac ICU. At each decision point, choose what you would do next. You get immediate feedback on whether it is evidence-based, the reasoning and trials behind it, and you watch the patient respond on the monitor.'));
      root.appendChild(this.lib);
      root.appendChild(this.run);
      this.renderLibrary();
      this.monitor = null;
    },

    /* ---------------- library ---------------- */
    renderLibrary() {
      CL.clear(this.lib);
      const best = CL.store.get('cicuBest', {});
      const groups = {};
      CL.data.cicuCases.forEach((c) => { (groups[c.group] = groups[c.group] || []).push(c); });
      Object.keys(groups).forEach((g) => {
        this.lib.appendChild(h('div', { class: 'panel' },
          h('h2', null, g),
          h('div', { class: 'cards' }, groups[g].map((c) => {
            const b = best[c.id];
            return h('article', { class: 'card' },
              h('div', { class: 'meta' }, c.tags.map((t) => CL.ui.tag(t)), b != null ? h('span', { class: 'tag pill-ok' }, 'Best ' + b + '%') : null),
              h('h3', null, c.title),
              h('p', null, c.teaser),
              h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => this.start(c.id) }, 'Start case →'),
                h('span', { class: 'sub' }, c.length || '')));
          }))));
      });
      this.lib.appendChild(this.reference());
    },

    /* ---------------- runner ---------------- */
    start(id) {
      const c = CL.data.cicuCases.find((x) => x.id === id);
      this.c = c;
      this.state = Object.assign({ rr: 18, temp: 37.0, spo2: 96, rhythm: 'sinus' }, c.init);
      this.history = [];
      this.trend = [];
      this.labs = [];
      this.lib.hidden = true; this.run.hidden = false;
      CL.clear(this.run);
      const canvas = h('canvas', { 'aria-label': 'Bedside monitor', style: { width: '100%', height: '100%', display: 'block' } });
      this.monWrap = h('div', { class: 'monitor', style: { height: 'clamp(240px, 38vh, 340px)' } }, canvas);
      this.monitor = new CL.Monitor(canvas);
      this.header = h('div', { class: 'panel' });
      this.dataPanel = h('div', { class: 'panel' });
      this.nodePanel = h('div', { class: 'panel', 'aria-live': 'polite' });
      this.timeline = h('div', { class: 'cicu-timeline' });
      this.run.append(this.header,
        h('div', { class: 'bench' }, h('div', { class: 'stack' }, this.monWrap, this.timeline), this.dataPanel),
        this.nodePanel);
      this.go(c.start || 'start');
      window.scrollTo({ top: 0 });
    },
    go(nodeId) {
      const n = this.c.nodes[nodeId];
      if (!n) { console.error('missing node', nodeId); return; }
      this.node = n; this.nodeId = nodeId; this.answered = null;
      if (n.vitals) Object.assign(this.state, n.vitals);
      if ('swan' in n) this.state.swan = n.swan;
      if ('wedge' in n) this.state.wedge = n.wedge;
      if (n.labs) this.labs = n.labs;
      this.trend.push({ t: n.t, map: map(this.state), lac: this.labVal('Lactate') });
      this.snap = JSON.parse(JSON.stringify(this.state));
      this.monitor.replace(this.state);
      this.renderHeader(); this.renderData(); this.renderNode(); this.renderTimeline();
      if (this.history.length) this.header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    labVal(k) { const l = this.labs.find((x) => x.k === k); return l ? parseFloat(l.v) : null; },
    apply(effect) {
      if (!effect) return;
      const s = this.state;
      if (effect.d) Object.keys(effect.d).forEach((k) => { s[k] = Math.round(((s[k] || 0) + effect.d[k]) * 10) / 10; });
      if (effect.set) Object.assign(s, effect.set);
      s.spo2 = CL.clamp(s.spo2, 50, 100);
      this.monitor.replace(s);
      this.renderData();
    },
    renderHeader() {
      const c = this.c, n = this.node;
      const pts = this.history.reduce((a, x) => a + GRADE[x.grade].pts, 0);
      const max = this.history.length * 2;
      CL.clear(this.header);
      this.header.append(
        h('div', { class: 'row', style: { justifyContent: 'space-between' } },
          h('div', { class: 'stack', style: { gap: '4px' } },
            h('div', { class: 'eyebrow' }, c.group),
            h('h2', null, c.title),
            h('p', { class: 'sub' }, c.patient)),
          h('div', { class: 'row' },
            h('span', { class: 'tag', style: { fontSize: '0.95rem' } }, fmtT(n.t)),
            n.stage ? h('span', { class: 'tag c', style: { '--c': n.stage >= 'D' ? 'var(--bad)' : n.stage === 'C' ? 'var(--warn)' : 'var(--ok)' }, title: 'SCAI SHOCK stage' }, 'SCAI ' + n.stage) : null,
            h('span', { class: 'scoreboard' }, max ? 'Score ' + pts + ' / ' + max : ''),
            h('button', { type: 'button', class: 'btn', onclick: () => this.exit() }, 'All cases'))));
    },
    renderData() {
      const s = this.state;
      const bsa = this.c.bsa || 2.0;
      CL.clear(this.dataPanel);
      const r = (k, v, cls, note) => h('div', { class: 'r ' + (cls || '') }, h('span', { class: 'k' }, k), h('span', { class: 'v', style: { fontSize: '1.05rem' } }, v), note ? h('span', { class: 'k', style: { textTransform: 'none', letterSpacing: 0 } }, note) : null);
      const m = map(s);
      const dead = ['vf', 'pea', 'asystole'].indexOf(s.rhythm) >= 0;
      this.dataPanel.append(h('h3', null, 'Vitals'),
        h('div', { class: 'readout' },
          r('MAP', dead ? '—' : m + ' mmHg', dead || m < 65 ? 'bad' : 'ok'),
          r('Shock index', dead ? '—' : (s.hr / s.sbp).toFixed(2), !dead && s.hr / s.sbp >= 1 ? 'bad' : ''),
          r('SpO₂', s.spo2 + '%', s.spo2 < 90 ? 'bad' : ''),
          s.uo != null ? r('Urine', s.uo + ' mL/h', s.uo < 30 ? 'bad' : '') : null,
          s.o2 ? r('O₂ support', s.o2) : null));
      if (s.swan) {
        const w = s.swan;
        const ci = w.co / bsa;
        const cpo = m * w.co / 451;
        const papi = w.ra > 0 ? (w.pas - w.pad) / w.ra : null;
        this.dataPanel.append(h('h3', null, 'Pulmonary artery catheter'),
          h('div', { class: 'readout' },
            r('RA', w.ra + ' mmHg', w.ra > 14 ? 'bad' : ''),
            r('PA', w.pas + '/' + w.pad, w.pas > 40 ? 'bad' : ''),
            r('PCWP', w.pcwp + (w.vwave ? ' (v ' + (w.pcwp + w.vwave) + ')' : '') + ' mmHg', w.pcwp > 18 ? 'bad' : 'ok'),
            r('CO / CI', w.co.toFixed(1) + ' / ' + ci.toFixed(1), ci < 2.2 ? 'bad' : 'ok', 'L/min · L/min/m²'),
            r('CPO', cpo.toFixed(2) + ' W', cpo < 0.6 ? 'bad' : 'ok', 'MAP × CO ÷ 451'),
            papi != null ? r('PAPi', papi.toFixed(2), papi < 0.9 ? 'bad' : 'ok', '(PAs − PAd) ÷ RA') : null,
            w.svo2 != null ? r('SvO₂ (PA)', w.svo2 + '%', w.svo2 < 60 ? 'bad' : '') : null,
            w.ravo2 != null ? r('RA / SVC sat', w.ravo2 + '%', '') : null));
      }
      if (this.labs && this.labs.length) {
        this.dataPanel.append(h('h3', null, 'Labs and data'),
          h('dl', { class: 'kv' }, this.labs.map((l) => [h('dt', null, l.k), h('dd', { class: 'mono', style: { color: l.flag ? 'var(--bad)' : 'var(--ink)' } }, l.v)])));
      }
      if (this.trend.length > 1) this.dataPanel.append(this.sparkline());
    },
    sparkline() {
      const S = CL.svg, W = 300, H = 70;
      const pts = this.trend;
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'MAP trend', style: 'width:100%;max-width:360px;display:block' });
      const x = (i) => 10 + i / Math.max(1, pts.length - 1) * (W - 20);
      const y = (v) => H - 12 - (CL.clamp(v, 30, 110) - 30) / 80 * (H - 24);
      svg.appendChild(S('line', { x1: 10, x2: W - 10, y1: y(65), y2: y(65), stroke: 'var(--bad)', 'stroke-dasharray': '4 3' }));
      svg.appendChild(S('text', { x: W - 10, y: y(65) - 3, 'text-anchor': 'end', 'font-size': 9, fill: 'var(--bad)', 'font-family': 'var(--font-mono)', text: 'MAP 65' }));
      svg.appendChild(S('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.map)).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }));
      pts.forEach((p, i) => svg.appendChild(S('circle', { cx: x(i), cy: y(p.map), r: 3, fill: 'var(--accent)' })));
      return h('div', { class: 'stack', style: { gap: '4px' } }, h('h3', null, 'MAP trend'), svg);
    },
    renderTimeline() {
      CL.clear(this.timeline);
      const nodes = this.history.map((x) => ({ t: x.t, grade: x.grade, title: x.title }));
      if (this.answered == null) nodes.push({ t: this.node.t, grade: null, title: this.node.title, now: true });
      nodes.forEach((x) => {
        const col = x.grade ? (x.grade === 'best' ? 'var(--ok)' : x.grade === 'ok' ? 'var(--warn)' : 'var(--bad)') : 'var(--accent)';
        this.timeline.appendChild(h('div', { class: 'cicu-tl-item' + (x.now ? ' now' : ''), title: x.title }, h('span', { class: 'dot', style: { background: col } }), h('span', { class: 'mono' }, fmtT(x.t)), h('span', { class: 'tl-title' }, x.title)));
      });
    },
    renderNode() {
      const n = this.node;
      CL.clear(this.nodePanel);
      this.nodePanel.append(
        h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } }, h('h2', null, n.title), h('span', { class: 'mono muted' }, fmtT(n.t))),
        h('p', { class: 'prose' }, n.text));
      if (n.findings) this.nodePanel.append(h('dl', { class: 'kv' }, n.findings.map((f) => [h('dt', null, f[0]), h('dd', null, f[1])])));
      if (n.ecg || n.echo) {
        const box = h('div', { class: 'stack' });
        const det = h('details', { class: 'more', open: !!n.showOpen }, h('summary', null, n.ecg && n.echo ? 'Show the 12-lead and the echo' : n.ecg ? 'Show the 12-lead' : 'Show the echo'), h('div', { class: 'body' }, box));
        if (n.ecg) { const sc = CL.data.culprits.find((x) => x.id === n.ecg.culprit); if (sc) box.appendChild(h('div', { class: 'ecg-paper' }, CL.ECG.render(Object.assign({}, sc, n.ecg.rhythm ? { rhythm: n.ecg.rhythm } : {}), { stage: n.ecg.stage || 'acute', highlight: false, extra: !!n.ecg.extra }))); }
        if (n.echo) {
          const cv = h('canvas', { style: { width: '100%', height: '100%' } });
          box.appendChild(h('div', { class: 'monitor', style: { aspectRatio: '1 / 0.85', maxWidth: '520px' } }, cv));
          const ev = new CL.Echo.View(cv); ev.set({ view: n.echo.view || 'a4c', scores: n.echo.scores || {}, rv: !!n.echo.rv, labels: false });
          if (n.echo.note) box.appendChild(h('p', { class: 'sub' }, n.echo.note));
        }
        this.nodePanel.append(det);
      }
      if (n.end) { this.renderEnd(); return; }
      const list = h('div', { class: 'q-opts' });
      this.feedback = h('div', { class: 'stack' });
      this.nodePanel.append(h('h3', null, n.q || 'What do you do next?'), list, this.feedback);
      const order = n.fixedOrder ? n.choices.map((_, i) => i) : this.shuffle(n.choices.map((_, i) => i));
      order.forEach((ci, k) => {
        const ch = n.choices[ci];
        const b = h('button', { type: 'button', class: 'q-opt' }, h('span', { class: 'k' }, 'ABCDE'[k]), ch.text);
        b.addEventListener('click', () => this.choose(ci, b, list, order));
        list.appendChild(b);
      });
    },
    shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; },
    choose(ci, btn, list, order) {
      if (this.answered != null) return;
      this.answered = ci;
      const n = this.node, ch = n.choices[ci];
      const G = GRADE[ch.grade];
      CL.$$('.q-opt', list).forEach((x) => { x.disabled = true; });
      btn.classList.add(ch.grade === 'best' ? 'right' : 'wrong');
      const bestIdx = n.choices.findIndex((x) => x.grade === 'best');
      if (ch.grade !== 'best' && bestIdx >= 0) list.children[order.indexOf(bestIdx)].classList.add('right');
      this.history.push({ t: n.t, title: n.title, grade: ch.grade, choice: ch.text, nodeId: this.nodeId });
      this.apply(ch.effect);
      const nextId = ch.next || n.next;
      const nextNode = this.c.nodes[nextId];
      const all = h('details', { class: 'more' }, h('summary', null, 'Why each option is right or wrong'),
        h('div', { class: 'body' }, n.choices.map((x) => h('div', { class: 'stack', style: { gap: '4px' } },
          h('div', null, h('span', { class: 'tag ' + GRADE[x.grade].tag, style: { marginRight: '8px' } }, GRADE[x.grade].label), h('b', null, x.text)),
          h('p', null, x.fb)))));
      this.feedback.append(
        h('div', { class: 'callout ' + G.cls }, h('strong', null, G.label + '. '), ch.fb, ch.after ? h('p', { style: { marginTop: '6px' } }, h('b', null, 'What happens: '), ch.after) : null),
        all,
        h('div', { class: 'row' },
          nextNode ? h('button', { type: 'button', class: 'btn primary', onclick: () => this.go(nextId) }, 'Continue → ' + fmtT(nextNode.t)) : null,
          h('button', { type: 'button', class: 'btn', onclick: () => this.retry() }, 'Try a different choice')));
      this.renderHeader(); this.renderTimeline();
    },
    retry() {
      // undo the last decision: restore the patient as they were when this decision point opened
      if (!this.history.length) return;
      this.history.pop();
      this.state = JSON.parse(JSON.stringify(this.snap));
      this.answered = null;
      this.monitor.replace(this.state);
      this.renderHeader(); this.renderData(); this.renderNode(); this.renderTimeline();
    },
    renderEnd() {
      const n = this.node, c = this.c;
      const pts = this.history.reduce((a, x) => a + GRADE[x.grade].pts, 0);
      const max = this.history.length * 2;
      const pct = max ? Math.max(0, Math.round(pts / max * 100)) : 0;
      const best = CL.store.get('cicuBest', {});
      if (best[c.id] == null || pct > best[c.id]) { best[c.id] = pct; CL.store.set('cicuBest', best); }
      const bestCount = this.history.filter((x) => x.grade === 'best').length;
      this.nodePanel.append(
        h('div', { class: 'readout' },
          h('div', { class: 'r ' + (pct >= 75 ? 'ok' : pct >= 50 ? '' : 'bad') }, h('span', { class: 'k' }, 'Case score'), h('span', { class: 'v' }, pct + '%')),
          h('div', { class: 'r' }, h('span', { class: 'k' }, 'Best choices'), h('span', { class: 'v' }, bestCount + ' / ' + this.history.length))),
        h('h3', null, 'Your decisions'),
        h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '0' } },
          h('thead', null, h('tr', null, h('th', null, 'Time'), h('th', null, 'Decision point'), h('th', null, 'Your choice'), h('th', null, 'Grade'))),
          h('tbody', null, this.history.map((x) => h('tr', null, h('td', { class: 'mono' }, fmtT(x.t)), h('td', null, x.title), h('td', null, x.choice), h('td', null, h('span', { class: 'tag ' + GRADE[x.grade].tag }, GRADE[x.grade].label))))))),
        h('h3', null, 'Debrief'),
        h('ul', { class: 'prose', style: { fontSize: 'var(--step--1)' } }, c.debrief.map((d) => h('li', null, d))),
        CL.ui.refs(c.refs),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => this.start(c.id) }, 'Replay this case'),
          h('button', { type: 'button', class: 'btn', onclick: () => this.exit() }, 'Back to all cases')));
    },
    exit() {
      this.run.hidden = true; this.lib.hidden = false;
      CL.clear(this.run);
      this.renderLibrary();
      window.scrollTo({ top: 0 });
    },

    /* ---------------- reference ---------------- */
    reference() {
      const R = CL.data.cicuRef;
      const table = (head, rows) => h('div', { class: 'table-wrap' }, h('table', { style: { minWidth: '0' } },
        h('thead', null, h('tr', null, head.map((x) => h('th', null, x)))),
        h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => h('td', { class: i > 0 && i < 4 && head.length === 6 ? 'mono' : null }, c)))))));
      // calculators
      const calc = { map: 65, co: 4.0, ra: 10, pas: 40, pad: 20, hr: 100, sbp: 90 };
      const out = h('div', { class: 'readout' });
      const render = () => {
        const cpo = calc.map * calc.co / 451, papi = (calc.pas - calc.pad) / calc.ra, si = calc.hr / calc.sbp;
        CL.clear(out);
        out.append(
          h('div', { class: 'r ' + (cpo < 0.6 ? 'bad' : 'ok') }, h('span', { class: 'k' }, 'CPO'), h('span', { class: 'v' }, cpo.toFixed(2) + ' W')),
          h('div', { class: 'r ' + (papi < 0.9 ? 'bad' : 'ok') }, h('span', { class: 'k' }, 'PAPi'), h('span', { class: 'v' }, papi.toFixed(2))),
          h('div', { class: 'r ' + (si >= 1 ? 'bad' : 'ok') }, h('span', { class: 'k' }, 'Shock index'), h('span', { class: 'v' }, si.toFixed(2))));
      };
      const num = (key, label) => { const inp = h('input', { type: 'number', id: 'calc-' + key, value: calc[key], step: key === 'co' ? 0.1 : 1 }); inp.addEventListener('input', () => { calc[key] = Number(inp.value) || 0; render(); }); return h('div', { class: 'field' }, h('label', { for: 'calc-' + key }, label), inp); };
      render();
      return h('div', { class: 'stack' },
        h('div', { class: 'panel' }, h('h2', null, 'Shock hemodynamics at a glance'), table(['Profile', 'RA', 'PCWP', 'CI', 'SVR', 'Clue'], R.profiles)),
        h('div', { class: 'grid-2' },
          h('div', { class: 'panel' }, h('h2', null, 'SCAI SHOCK stages'), h('dl', { class: 'kv' }, R.scai.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))),
          h('div', { class: 'panel' }, h('h2', null, 'Bedside calculators'),
            h('div', { class: 'grid-3' }, num('map', 'MAP (mmHg)'), num('co', 'CO (L/min)'), num('ra', 'RA (mmHg)'), num('pas', 'PA systolic'), num('pad', 'PA diastolic'), num('hr', 'HR'), num('sbp', 'SBP')),
            out,
            h('p', { class: 'sub' }, 'CPO was the strongest hemodynamic correlate of in-hospital death in the SHOCK registry: ≤0.53 W carried ~58% mortality, and many use <0.6 W. PAPi ≤0.9 after a proximal RCA infarct predicted RV failure (small study); <1.85 predicts RV failure after LVAD. Shock index ≥1 flags occult shock.'))),
        h('div', { class: 'panel' }, h('h2', null, 'Vasoactive drugs'), table(['Drug', 'Receptors', 'Dose range', 'Use', 'Watch for'], R.vasoactives)),
        h('div', { class: 'panel' }, h('h2', null, 'Mechanical circulatory support'), table(['Device', 'Support', 'How it works', 'Evidence', 'Cautions'], R.mcs)),
        CL.ui.refs(R.refs));
    },
    show() {},
    hide() {},
  };
  CL.modules.cicu = mod;
})();
