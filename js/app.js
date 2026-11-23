/* EP Simulator — app shell: tabs, hash routing, boot. */
(function (EP) {
  'use strict';
  const h = EP.h;
  EP.boot = function () {
    const tabs = document.getElementById('tabs'), page = document.getElementById('page');
    let current = null, handle = null;
    const mods = EP.Modules;
    const order = ['rhythms', 'localise', 'stemi', 'devices', 'course', 'pacemaker', 'temp', 'icd', 'tox', 'cases', 'assess', 'quiz'];
    mods.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    for (const m of mods) tabs.appendChild(h('button.tab', { type: 'button', role: 'tab', id: 'tab-' + m.id, 'aria-selected': 'false', onclick: () => go(m.id, true) }, m.title));
    function go(id, push) {
      const m = mods.find((x) => x.id === id) || mods[0];
      if (current === m.id && !EP.pending) return;
      if (handle && handle.unmount) handle.unmount();
      current = m.id;
      for (const b of tabs.children) b.setAttribute('aria-selected', String(b.id === 'tab-' + m.id));
      page.innerHTML = '';
      try { handle = m.mount(page) || null; } catch (e) { console.error(e); page.appendChild(h('div.note.bad', 'This module failed to load: ' + e.message)); handle = null; }
      if (push) { try { location.hash = m.id; } catch (e) { /* hash unavailable */ } }
      const tb = document.getElementById('tab-' + m.id); if (tb && tb.scrollIntoView) tb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      window.scrollTo(0, 0);
    }
    EP.go = go;
    /* Open a tab focused on one item: modules read EP.pending while mounting. */
    EP.open = (tab, focus) => { EP.pending = Object.assign({ tab }, focus || {}); go(tab, true); EP.pending = null; };
    window.addEventListener('hashchange', () => go(location.hash.replace('#', ''), false));
    // build the model after first paint so the page shows immediately
    setTimeout(() => {
      try { EP.Morph.init(); go(location.hash.replace('#', '') || 'rhythms', false); }
      catch (e) { console.error(e); page.innerHTML = ''; page.appendChild(h('div.note.bad', 'Could not start the simulator: ' + e.message)); }
    }, 30);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', EP.boot); else EP.boot();
})(globalThis.EP = globalThis.EP || {});
