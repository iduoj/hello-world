/* Cath Lab Atlas — core utilities, router, shared state */
(function () {
  'use strict';
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};
  CL.modules = CL.modules || {};

  /* ---------- DOM helpers ---------- */
  // conditional children (cond ? el : null) are common in this app: skip null/false in Element.append
  const nativeAppend = Element.prototype.append;
  Element.prototype.append = function (...nodes) { return nativeAppend.apply(this, nodes.filter((n) => n != null && n !== false)); };
  CL.h = function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    appendKids(el, children);
    return el;
  };
  function appendKids(el, kids) {
    for (const c of kids) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) appendKids(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
  }
  CL.svg = function svg(tag, attrs, ...children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    appendKids(el, children);
    return el;
  };
  CL.$ = (sel, root) => (root || document).querySelector(sel);
  CL.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  CL.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- math ---------- */
  CL.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  CL.lerp = (a, b, t) => a + (b - a) * t;
  CL.smooth = (e0, e1, x) => { const t = CL.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  CL.gauss = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) * ((x - mu) / sd));
  CL.fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
  CL.DEG = Math.PI / 180;
  // deterministic PRNG so simulated images are stable between renders
  CL.rng = function (seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- tiny event bus ---------- */
  const listeners = {};
  CL.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  CL.emit = (evt, payload) => { (listeners[evt] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); };

  /* ---------- safe storage ---------- */
  CL.store = {
    get(k, d) { try { const v = localStorage.getItem('cla:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cla:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  /* ---------- UI builders ---------- */
  CL.ui = {
    segmented(options, value, onChange, opts = {}) {
      const wrap = CL.h('div', { class: 'seg', role: 'group', 'aria-label': opts.label || '' });
      const btns = options.map((o) => {
        const b = CL.h('button', { type: 'button', 'aria-pressed': String(o.value === value), title: o.title || null }, o.label);
        b.addEventListener('click', () => { set(o.value); onChange(o.value); });
        wrap.appendChild(b);
        return { b, v: o.value };
      });
      function set(v) { btns.forEach((x) => x.b.setAttribute('aria-pressed', String(x.v === v))); }
      wrap.set = set;
      return wrap;
    },
    chips(options, value, onChange, opts = {}) {
      const wrap = CL.h('div', { class: 'chips', role: 'group', 'aria-label': opts.label || '' });
      const btns = options.map((o) => {
        const b = CL.h('button', { type: 'button', class: 'chip', 'aria-pressed': String(o.value === value), style: o.color ? { '--c': o.color } : null },
          o.color ? CL.h('span', { class: 'sw' }) : null, o.label);
        b.addEventListener('click', () => { set(o.value); onChange(o.value); });
        wrap.appendChild(b);
        return { b, v: o.value };
      });
      function set(v) { btns.forEach((x) => x.b.setAttribute('aria-pressed', String(x.v === v))); }
      wrap.set = set;
      return wrap;
    },
    slider({ id, label, min, max, step = 1, value, format, onInput }) {
      const out = CL.h('output', { for: id });
      const input = CL.h('input', { type: 'range', id, min, max, step, value });
      const f = format || ((v) => v);
      const update = () => { out.textContent = f(Number(input.value)); };
      input.addEventListener('input', () => { update(); onInput && onInput(Number(input.value)); });
      update();
      const wrap = CL.h('div', { class: 'field' }, CL.h('label', { for: id }, CL.h('span', null, label), out), input);
      wrap.input = input;
      wrap.setValue = (v) => { input.value = v; update(); };
      return wrap;
    },
    check({ id, label, checked, onChange }) {
      const input = CL.h('input', { type: 'checkbox', id, checked: !!checked });
      input.addEventListener('change', () => onChange(input.checked));
      const l = CL.h('label', { class: 'check', for: id }, input, label);
      l.input = input;
      return l;
    },
    refs(list) {
      if (!list || !list.length) return null;
      return CL.h('details', { class: 'more' },
        CL.h('summary', null, 'Sources'),
        CL.h('div', { class: 'body' },
          CL.h('ul', { class: 'refs' }, list.map((r) => CL.h('li', null, r.url ? CL.h('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.t) : r.t)))));
    },
    head(eyebrow, title, lede, extra) {
      return CL.h('div', { class: 'view-head' },
        CL.h('div', null,
          CL.h('div', { class: 'eyebrow' }, eyebrow),
          CL.h('h1', null, title),
          lede ? CL.h('p', { class: 'lede' }, lede) : null),
        extra || null);
    },
    tag(text, color) {
      return CL.h('span', { class: color ? 'tag c' : 'tag', style: color ? { '--c': color } : null }, text);
    },
  };

  /* vessel / territory colors pulled from CSS tokens so they follow the theme */
  CL.color = function (name) {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
    return v || '#888';
  };
  CL.territoryVar = { LAD: 'var(--lad)', LCx: 'var(--lcx)', RCA: 'var(--rca)', LM: 'var(--lm)', Ramus: 'var(--ramus)' };

  /* ---------- router ---------- */
  CL.router = {
    current: null,
    start(defaultView) {
      const go = () => {
        const name = (location.hash || '').replace('#', '') || defaultView;
        this.show(CL.modules[name] ? name : defaultView);
      };
      window.addEventListener('hashchange', go);
      go();
    },
    show(name) {
      if (this.current === name) return;
      const prev = this.current;
      if (prev && CL.modules[prev] && CL.modules[prev].hide) CL.modules[prev].hide();
      CL.$$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
      CL.$$('.tabs a').forEach((a) => {
        if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      const active = CL.$('.tabs a[aria-current="page"]');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const mod = CL.modules[name];
      const root = document.getElementById('view-' + name);
      if (mod && !mod._inited) { mod._inited = true; try { mod.init(root); } catch (e) { console.error(e); root.appendChild(CL.h('div', { class: 'callout warn' }, 'This section failed to load: ' + e.message)); } }
      if (mod && mod.show) mod.show();
      this.current = name;
      window.scrollTo({ top: 0 });
    },
    go(name, hashExtra) { location.hash = name; if (hashExtra) CL.emit(name + ':focus', hashExtra); },
  };
})();
