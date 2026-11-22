/* EP Simulator — Rhythm Lab module. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, R = EP.Rhythms;
  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'rhythms', title: 'Rhythms',
    mount(root) {
      let cur = null, params = {};
      const player = new EP.Player({ layout: '12', ladder: true });
      const rail = h('nav.card.rail', { 'aria-label': 'Rhythm library' });
      const search = h('input', { type: 'search', placeholder: 'Filter rhythms', 'aria-label': 'Filter rhythms', oninput: () => fill() });
      const listEl = h('div');
      rail.append(h('div', { style: { padding: '8px' } }, search), listEl);
      const sel = UI.select(null, R.groups.map((g) => ({ group: g.name, items: R.list.filter((r) => r.group === g.id).map((r) => [r.id, r.name]) })), 'nsr', (v) => show(v));
      sel.classList.add('rail-sel'); sel.setAttribute('aria-label', 'Rhythm');
      const meas = h('div'), ctrl = h('div.row'), teach = h('div.card-b'), head = h('div.card-h');
      const teachCard = h('section.card', head, teach);
      function fill() {
        const q = search.value.trim().toLowerCase(); listEl.innerHTML = '';
        for (const g of R.groups) {
          const items = R.list.filter((r) => r.group === g.id && (!q || (r.name + ' ' + r.sub).toLowerCase().includes(q)));
          if (!items.length) continue;
          listEl.append(h('div.rail-g', g.name));
          for (const r of items) listEl.append(h('button.rail-i', { type: 'button', 'aria-current': String(cur && cur.id === r.id), onclick: () => show(r.id) }, r.name, r.sub ? h('small', r.sub) : null));
        }
      }
      function render(keep) {
        const rec = R.record(cur, { params });
        const m = R.measure(rec);
        player.load(rec, { title: cur.name, view: keep ? null : cur.view, opacity: keep ? null : (cur.focus === 'AV' ? 0.32 : 1) });
        meas.innerHTML = '';
        meas.append(UI.kv([
          ['Ventricular', m.vRate, '/min'], ['Atrial', m.aRate, '/min'], ['PR', m.pr, 'ms'], ['QRS', m.qrs, 'ms'], ['QT / QTc', m.qt == null ? null : m.qt + ' / ' + m.qtc, 'ms'], ['Axis', m.axis == null ? null : m.axis + '°'], ['Rhythm', m.regular == null ? null : m.regular ? 'regular' : 'irregular'],
        ]));
      }
      function show(id) {
        cur = R.byId[id] || R.list[0]; params = {};
        UI.store.set('rhythm', cur.id); sel.sel ? (sel.sel.value = cur.id) : (sel.value = cur.id);
        head.innerHTML = ''; head.append(h('div', h('div.eyebrow', (R.groups.find((g) => g.id === cur.group) || {}).name || ''), h('h2', { style: { fontSize: '17px' } }, cur.name)));
        ctrl.innerHTML = '';
        for (const c of (cur.teach.controls || [])) {
          params[c.key] = c.def;
          ctrl.append(UI.select(c.label, c.options, c.def, (v) => { params[c.key] = v; render(true); }));
        }
        teach.innerHTML = ''; teach.append(UI.teach(cur.teach));
        fill(); render(false);
      }
      const tips = h('div.note', 'Drag across the ECG to measure an interval. Click the trace to move the cursor; the heart shows that instant. Slow the playback to watch the wavefront.');
      root.append(h('div.lab', rail, h('div.stack', sel, player.ecgCard, meas, ctrl, teachCard), h('div.side', player.heartCard, tips)));
      show(UI.store.get('rhythm', 'nsr'));
      return { unmount() { player.destroy(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
