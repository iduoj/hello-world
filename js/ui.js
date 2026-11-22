/* EP Simulator — shared UI helpers and the ECG + 3D "player". */
(function (EP) {
  'use strict';
  /* h('div.cls#id', {attrs}, ...children) */
  function h(sel, attrs, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?(.*)$/i), el = document.createElement(m[1] || 'div');
    for (const part of (m[2] || '').match(/[.#][^.#]+/g) || []) { if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1); }
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); };
    kids.forEach(add);
    return el;
  }
  EP.h = h;
  const UI = (EP.UI = {});
  let uid = 0;
  UI.id = (p) => (p || 'ep') + '-' + ++uid;
  /* Segmented control. opts: [[value, label]] */
  UI.seg = function (opts, value, on, label) {
    const el = h('div.seg', { role: 'group', 'aria-label': label || '' });
    const set = (v, fire) => { el.value = v; for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); if (fire && on) on(v); };
    for (const [v, t] of opts) el.appendChild(h('button', { type: 'button', 'data-v': v, onclick: () => set(v, true) }, t));
    set(value); el.set = set;
    return el;
  };
  UI.check = function (label, value, on) {
    const id = UI.id('chk'), inp = h('input', { type: 'checkbox', id, checked: !!value, onchange: () => on(inp.checked) });
    const el = h('label.chk', { for: id }, inp, label); el.input = inp; return el;
  };
  UI.range = function (label, o, on) {
    const id = UI.id('rng'), out = h('span.mono', o.fmt ? o.fmt(o.value) : o.value);
    const inp = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step || 1, value: o.value, oninput: () => { const v = +inp.value; out.textContent = o.fmt ? o.fmt(v) : v; on(v); } });
    const el = h('label.fld', { for: id, style: { flex: o.grow ? '1' : '' } }, label, inp, o.readout === false ? null : out);
    el.input = inp; el.set = (v) => { inp.value = v; out.textContent = o.fmt ? o.fmt(v) : v; };
    return el;
  };
  UI.select = function (label, opts, value, on) {
    const id = UI.id('sel');
    const sel = h('select', { id, onchange: () => on(sel.value) }, opts.map((o) => (o.group ? h('optgroup', { label: o.group }, o.items.map(([v, t]) => h('option', { value: v }, t))) : h('option', { value: o[0] }, o[1]))));
    sel.value = value;
    const el = label ? h('label.fld', { for: id }, label, sel) : sel; el.sel = sel; return el;
  };
  UI.kv = function (pairs) { return h('div.kv', pairs.filter(Boolean).map(([k, v, unit]) => h('div', h('div.k', k), h('div.v', v == null ? '—' : String(v), unit ? h('small', ' ' + unit) : null)))); };
  UI.list = (items) => h('ul', items.map((t) => h('li', t)));
  UI.store = { get(k, d) { try { const v = localStorage.getItem('ep.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('ep.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } } };

  const VIEW_BTNS = [['front', 'Front'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['lao', 'LAO'], ['rao', 'RAO'], ['inferior', 'Inferior']];

  /* ECG sheet + synchronised 3D heart with a shared transport. */
  class Player {
    constructor(o) {
      this.o = Object.assign({ heart: true, layout: '12', ladder: true, speed: 0.25, strips: [1], stripLeads: [1, 6] }, o || {});
      this.t = 0; this.playing = false; this.rec = null;
      this._buildEcg(); if (this.o.heart && EP.Heart3D) this._buildHeart();
      this._last = 0;
      const loop = (now) => { this._raf = requestAnimationFrame(loop); this._frame(now); };
      this._raf = requestAnimationFrame(loop);
    }
    destroy() { cancelAnimationFrame(this._raf); if (this.heart) this.heart.dispose(); if (this.ecg.ro) this.ecg.ro.disconnect(); }
    _buildEcg() {
      const o = this.o;
      this.canvas = h('canvas', { 'aria-label': 'Electrocardiogram' });
      this.title = h('h2', 'ECG');
      this.layoutSeg = UI.seg([['12', '12-lead'], ['strip', 'Rhythm strips']], o.layout, (v) => { o.layout = v; this._applyLayout(); }, 'ECG layout');
      this.ladderChk = UI.check('Ladder diagram', o.ladder, (v) => { o.ladder = v; this._applyLayout(); });
      this.playBtn = h('button.btn.primary', { type: 'button', onclick: () => this.toggle(), style: { minWidth: '74px' } }, 'Play');
      this.speedSel = UI.select('Speed', [['1', '1×'], ['0.5', '½×'], ['0.25', '¼×'], ['0.1', '1/10×'], ['0.04', '1/25×']], String(o.speed), (v) => { o.speed = +v; });
      this.scrub = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Time', oninput: () => { if (this.rec) this.seek(this.rec.t0 + (this.scrub.value / 1000) * (this.rec.t1 - this.rec.t0), true); } });
      this.clock = h('span.mono.muted', '0.00 s');
      this.ecgCard = h('section.card',
        h('div.card-h', this.title, h('span.grow'), this.layoutSeg, this.ladderChk),
        h('div.transport', this.playBtn, this.speedSel, this.scrub, this.clock),
        h('div.ecg-scroll', this.canvas));
      this.ecg = new EP.ECGView(this.canvas, { layout: o.layout, ladder: o.ladder, markers: !!o.markers, strips: o.layout === '12' ? o.strips : o.stripLeads, onSeek: (t) => this.seek(t, true) });
    }
    _applyLayout() {
      const o = this.o;
      this.ecg.set({ layout: o.layout, ladder: o.ladder, markers: !!o.markers, strips: o.layout === '12' ? o.strips : o.stripLeads, rowMm: o.layout === '12' ? 27 : 30 });
    }
    _buildHeart() {
      const o = this.o;
      this.h3d = h('div.h3d', h('div.h3d-hint', 'Drag to rotate · scroll or pinch to zoom · shift-drag to pan'));
      this.modeSeg = UI.seg([['prop', 'Activation'], ['iso', 'Isochrones'], ['anat', 'Anatomy']], 'prop', (v) => { this.heart.setMode(v); this._legend(v); }, 'Colour mode');
      this.opRange = UI.range('Wall', { min: 0.12, max: 1, step: 0.02, value: 1, readout: false, grow: true }, (v) => this.heart.setOpts({ opacity: v }));
      this.viewRow = h('div.row', VIEW_BTNS.map(([v, t]) => h('button.btn.sm', { type: 'button', onclick: () => this.heart.setView(v) }, t)));
      this.legend = h('div.legend');
      this.heartCard = h('section.card',
        this.h3d,
        h('div.h3d-tools',
          h('div.row', this.modeSeg, h('span.grow'), UI.check('Labels', true, (v) => this.heart.setOpts({ labels: v }))),
          h('div.row', this.opRange, UI.check('Vessels', true, (v) => this.heart.setOpts({ vessels: v })), UI.check('Conduction', true, (v) => this.heart.setOpts({ conduction: v }))),
          this.viewRow, this.legend));
      this.heart = new EP.Heart3D(this.h3d, {});
      this.heart.setOpts({ opacity: 1 });
      this._legend('prop');
    }
    _legend(mode) {
      const L = this.legend; L.innerHTML = '';
      if (mode === 'prop') L.append(h('span', 'wavefront'), h('i.lg-prop'), h('span', 'recovered'));
      else if (mode === 'iso') L.append(h('span', 'earliest'), h('i.lg-iso'), h('span', 'latest'));
      else L.append(h('span', 'Anatomy only — activation colours off'));
    }
    setOpacity(v) { if (this.heart) { this.heart.setOpts({ opacity: v }); this.opRange.set(v); } }
    /* opts: { title, view, keepTime, t, opacity } */
    load(rec, opts) {
      opts = opts || {};
      this.rec = rec;
      if (opts.title) this.title.textContent = opts.title;
      this.ecg.setRecording(rec);
      if (this.heart) { this.heart.setRecording(rec); if (opts.view) this.heart.setView(opts.view); if (opts.opacity != null) this.setOpacity(opts.opacity); }
      this.seek(opts.t != null ? opts.t : rec.t0 + Math.min(260, (rec.t1 - rec.t0) * 0.05), false);
    }
    seek(t, user) {
      if (!this.rec) return;
      this.t = EP.clamp(t, this.rec.t0, this.rec.t1);
      this.ecg.setCursor(this.t);
      if (this.heart) this.heart.setTime(this.t);
      if (!user || document.activeElement !== this.scrub) this.scrub.value = Math.round(((this.t - this.rec.t0) / (this.rec.t1 - this.rec.t0)) * 1000);
      this.clock.textContent = ((this.t - this.rec.t0) / 1000).toFixed(2) + ' s';
      if (this.o.onTime) this.o.onTime(this.t);
    }
    play() { this.playing = true; this.playBtn.textContent = 'Pause'; this._last = 0; }
    pause() { this.playing = false; this.playBtn.textContent = 'Play'; }
    toggle() { if (this.playing) this.pause(); else this.play(); }
    _frame(now) {
      if (!this.playing || !this.rec) { this._last = now; return; }
      const dt = Math.min(60, now - (this._last || now)); this._last = now;
      let t = this.t + dt * this.o.speed;
      if (t >= this.rec.t1) t = this.rec.t0;
      this.seek(t, false);
    }
  }
  EP.Player = Player;

  /* Render a teach block { mech, ecg[], pearls[] } */
  UI.teach = function (t) {
    return h('div.prose',
      t.mech ? [h('h4', 'Mechanism'), h('p', t.mech)] : null,
      t.ecg ? [h('h4', 'On the ECG'), UI.list(t.ecg)] : null,
      t.pearls ? [h('h4', 'Pearls & management'), UI.list(t.pearls)] : null);
  };
})(globalThis.EP = globalThis.EP || {});
