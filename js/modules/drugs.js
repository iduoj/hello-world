/* Module: cath lab pharmacology */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h;

  function drugCard(d) {
    return h('article', { class: 'card' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } }, h('h3', null, d.name), CL.ui.tag(d.route)),
      h('div', { class: 'dose' }, h('b', null, 'Dose  '), d.dose),
      h('p', null, h('b', null, 'How it works: '), d.moa),
      d.caution && d.caution !== '—' ? h('p', null, h('b', null, 'Caution: '), d.caution) : null,
      d.pearl ? h('p', { style: { color: 'var(--ink)' } }, h('b', null, 'Pearl: '), d.pearl) : null);
  }

  const mod = {
    init(root) {
      root.appendChild(CL.ui.head('Left heart cath · PCI', 'Cath lab drugs',
        'What goes down the sheath and the catheter, how much, and when to hold it. Start with the situation in front of you, or browse by drug group.'));

      // scenarios
      const box = h('div', { class: 'stack', 'aria-live': 'polite' });
      const show = (id) => {
        const sc = CL.data.drugScenarios.find((x) => x.id === id);
        CL.clear(box);
        box.append(
          h('p', { class: 'muted' }, h('b', null, 'You see: '), sc.signs),
          h('ol', { class: 'prose' }, sc.steps.map((x) => h('li', null, x))));
      };
      const chips = CL.ui.chips(CL.data.drugScenarios.map((x) => ({ label: x.name, value: x.id })), 'radial-spasm', show, { label: 'Scenario' });
      show('radial-spasm');
      root.appendChild(h('div', { class: 'panel' }, h('h2', null, 'What is happening?'), chips, box));

      // groups
      const nav = h('div', { class: 'chips' }, CL.data.drugGroups.map((g) =>
        h('button', { type: 'button', class: 'chip', onclick: () => { const el = document.getElementById('drug-' + g.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, g.title)));
      root.appendChild(nav);
      CL.data.drugGroups.forEach((g) => {
        root.appendChild(h('section', { class: 'panel', id: 'drug-' + g.id, style: { scrollMarginTop: '80px' } },
          h('h2', null, g.title),
          g.intro ? h('p', { class: 'prose', style: { color: 'var(--ink-2)', fontSize: 'var(--step--1)' } }, g.intro) : null,
          h('div', { class: 'cards' }, g.drugs.map(drugCard))));
      });
      root.appendChild(h('div', { class: 'callout warn' }, h('strong', null, 'Check before you push. '), 'Doses here are typical adult values from consensus statements and trials, for studying. Your lab’s protocol, the patient’s hemodynamics and the attending’s plan come first.'));
      root.appendChild(CL.ui.refs(CL.data.drugRefs));
    },
  };
  CL.modules.drugs = mod;
})();
