/* Cath Lab Atlas — boot */
(function () {
  'use strict';
  const CL = window.CL;
  function boot() {
    // theme toggle (per-viewer convenience)
    const saved = CL.store.get('theme', null);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const inner = document.querySelector('.topbar-inner');
    if (inner) {
      const btn = CL.h('button', { type: 'button', class: 'btn theme-btn', title: 'Switch light / dark', 'aria-label': 'Switch light or dark theme' },
        CL.svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' }, CL.svg('circle', { cx: 8, cy: 8, r: 6.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }), CL.svg('path', { d: 'M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z', fill: 'currentColor' })));
      btn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        CL.store.set('theme', next);
        CL.emit('theme', next);
      });
      inner.appendChild(btn);
    }
    CL.router.start('anatomy');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
