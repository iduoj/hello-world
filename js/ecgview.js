/* EP Simulator — ECG paper rendering on canvas.
 *   EP.ECGView   static recording: standard 12-lead sheet or stacked rhythm strips, with optional
 *                ladder diagram, device marker channel, time cursor and drag-to-measure calipers.
 *   EP.LiveStrip scrolling strip chart for the interactive simulators.
 */
(function (EP) {
  'use strict';
  const LN = () => EP.Leads.names;
  const GRID12 = [[0, 3, 6, 9], [1, 4, 7, 10], [2, 5, 8, 11]];   // rows × columns of lead indices

  function cssColors(el) {
    const cs = getComputedStyle(el), g = (n, d) => (cs.getPropertyValue(n).trim() || d);
    return {
      paper: g('--ecg-paper', '#fffaf7'), minor: g('--ecg-minor', '#f3cfcf'), major: g('--ecg-major', '#e39c9c'),
      trace: g('--ecg-trace', '#16181d'), label: g('--ecg-label', '#5b6070'), cursor: g('--ecg-cursor', '#0b76c5'),
      cal: g('--ecg-caliper', '#0b76c5'), fast: g('--lad-fast', '#2f6fb7'), slow: g('--lad-slow', '#d9822b'),
      ap: g('--lad-ap', '#b0308a'), block: g('--lad-block', '#c0392b'), tier: g('--lad-tier', '#9aa0ad'),
      mark: g('--ecg-mark', '#2c7a52'), pulse: g('--ecg-pulse', '#c0392b'), font: cs.fontFamily || 'sans-serif',
    };
  }
  function drawGrid(ctx, x, y, w, h, mm, col) {
    ctx.fillStyle = col.paper; ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 1;
    if (mm >= 2.2) {
      ctx.strokeStyle = col.minor; ctx.beginPath();
      for (let i = 0; i * mm <= w + 0.5; i++) { if (i % 5 === 0) continue; const px = Math.round(x + i * mm) + 0.5; ctx.moveTo(px, y); ctx.lineTo(px, y + h); }
      for (let i = 0; i * mm <= h + 0.5; i++) { if (i % 5 === 0) continue; const py = Math.round(y + i * mm) + 0.5; ctx.moveTo(x, py); ctx.lineTo(x + w, py); }
      ctx.stroke();
    }
    ctx.strokeStyle = col.major; ctx.beginPath();
    for (let i = 0; i * mm <= w + 0.5; i += 5) { const px = Math.round(x + i * mm) + 0.5; ctx.moveTo(px, y); ctx.lineTo(px, y + h); }
    for (let i = 0; i * mm <= h + 0.5; i += 5) { const py = Math.round(y + i * mm) + 0.5; ctx.moveTo(x, py); ctx.lineTo(x + w, py); }
    ctx.stroke();
  }

  class ECGView {
    constructor(canvas, o) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ layout: '12', speed: 25, gain: 10, strips: [1], ladder: false, markers: false, minPx: 2.5, maxPx: 5.4, rowMm: 27, calipers: true }, o || {});
      this.rec = null; this.cursor = null; this.cal = null; this.cells = [];
      this._bind();
      if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement); }
      this.resize();
    }
    set(o) { Object.assign(this.o, o); this.resize(); }
    setRecording(rec) { this.rec = rec; this.cal = null; this.resize(); }
    setCursor(t) { this.cursor = t; this.draw(true); }
    durMs() { return this.rec ? this.rec.t1 - this.rec.t0 : 10000; }
    resize() {
      const o = this.o, par = this.c.parentElement;
      const avail = Math.max(200, (par && par.clientWidth) || 800);
      const dur = this.durMs() / 1000;
      const left = 7, right = 2;
      const wmm = left + dur * o.speed + right;
      let mm = EP.clamp(avail / wmm, o.minPx, o.maxPx);
      if (o.fit === false) mm = o.px || 4;
      const nrows = o.layout === '12' ? 3 + o.strips.length : o.strips.length;
      const top = 3.5, bottom = 5;
      let hmm = top + nrows * o.rowMm + bottom;
      const lad = o.ladder ? 24 : 0, mk = o.markers ? 9 : 0;
      hmm += lad + mk;
      this.g = { mm, left: left * mm, top: top * mm, wmm, hmm, row: o.rowMm * mm, lad: lad * mm, mk: mk * mm, pxPerMs: (o.speed * mm) / 1000, W: Math.round(wmm * mm), H: Math.round(hmm * mm) };
      const dpr = Math.min(2.5, globalThis.devicePixelRatio || 1);
      this.c.width = Math.round(this.g.W * dpr); this.c.height = Math.round(this.g.H * dpr);
      this.c.style.width = this.g.W + 'px'; this.c.style.height = this.g.H + 'px';
      this.dpr = dpr;
      this.draw();
    }
    _cells() {
      const g = this.g, o = this.o, rec = this.rec, cells = [];
      if (!rec) return cells;
      const dur = this.durMs();
      let r = 0;
      if (o.layout === '12') {
        const seg = dur / 4;
        for (let row = 0; row < 3; row++) for (let c = 0; c < 4; c++) {
          cells.push({ lead: GRID12[row][c], x: g.left + c * seg * g.pxPerMs, y: g.top + (row + 0.5) * g.row, w: seg * g.pxPerMs, t0: rec.t0 + c * seg, t1: rec.t0 + (c + 1) * seg, row });
        }
        r = 3;
      }
      for (const ld of o.strips) { cells.push({ lead: ld, x: g.left, y: g.top + (r + 0.5) * g.row, w: dur * g.pxPerMs, t0: rec.t0, t1: rec.t1, row: r, strip: true }); r++; }
      this.stripBottom = g.top + r * g.row;
      return cells;
    }
    draw(overlayOnly) {
      const g = this.g;
      if (!g) return;
      if (!this.base) this.base = document.createElement('canvas');
      const b = this.base;
      if (!overlayOnly || b.width !== this.c.width || b.height !== this.c.height || !this._baseOk) {
        b.width = this.c.width; b.height = this.c.height;
        this._drawBase(b.getContext('2d'));
        this._baseOk = true;
      }
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(b, 0, 0);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.rec) this._overlay(this.col);
    }
    _drawBase(ctx) {
      const g = this.g, o = this.o, rec = this.rec;
      const col = (this.col = cssColors(this.c));
      this.bctx = ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawGrid(ctx, 0, 0, g.W, g.H, g.mm, col);
      if (!rec) return;
      const cells = (this.cells = this._cells());
      const mv = o.gain * g.mm;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // calibration pulse
      ctx.strokeStyle = col.trace; ctx.lineWidth = Math.max(1, g.mm * 0.28);
      const rowsY = [...new Set(cells.map((c) => c.y))];
      for (const y of rowsY) {
        ctx.beginPath(); ctx.moveTo(g.mm * 0.8, y); ctx.lineTo(g.mm * 1.6, y); ctx.lineTo(g.mm * 1.6, y - mv); ctx.lineTo(g.mm * 5.6, y - mv); ctx.lineTo(g.mm * 5.6, y); ctx.lineTo(g.mm * 6.4, y); ctx.stroke();
      }
      ctx.font = `600 ${Math.max(10, g.mm * 3)}px ${col.font}`; ctx.textBaseline = 'top';
      for (const cell of cells) {
        ctx.save();
        ctx.beginPath(); ctx.rect(cell.x, cell.y - g.row * 0.95, cell.w, g.row * 1.9); ctx.clip();
        const a = rec.leads[cell.lead];
        const i0 = Math.max(0, Math.floor((cell.t0 - rec.t0) / rec.dt)), i1 = Math.min(rec.n - 1, Math.ceil((cell.t1 - rec.t0) / rec.dt));
        ctx.strokeStyle = col.trace; ctx.lineWidth = Math.max(1, g.mm * 0.3);
        ctx.beginPath();
        for (let i = i0; i <= i1; i++) {
          const x = cell.x + (rec.t0 + i * rec.dt - cell.t0) * g.pxPerMs, y = cell.y - a[i] * mv;
          if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // pacing spikes
        for (const sp of rec.spikes) {
          if (sp.t < cell.t0 || sp.t >= cell.t1) continue;
          const i = Math.min(rec.n - 1, Math.max(0, Math.round((sp.t - rec.t0) / rec.dt)));
          const amp = EP.Leads.project(sp.v[0], sp.v[1], sp.v[2], cell.lead);
          const x = cell.x + (sp.t - cell.t0) * g.pxPerMs;
          ctx.beginPath(); ctx.moveTo(x, cell.y - a[i] * mv); ctx.lineTo(x, cell.y - (a[i] + amp) * mv); ctx.stroke();
        }
        ctx.restore();
        // column break tick + label
        if (!cell.strip) { ctx.strokeStyle = col.label; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cell.x + 0.5, cell.y - g.mm * 4); ctx.lineTo(cell.x + 0.5, cell.y + g.mm * 4); ctx.stroke(); }
        ctx.fillStyle = col.label;
        ctx.fillText(LN()[cell.lead], cell.x + g.mm * 1.2, cell.y - g.row * 0.46);
      }
      let y = this.stripBottom;
      if (o.markers) { this._markers(y, col); y += g.mk; }
      if (o.ladder) { this._ladder(y, col); y += g.lad; }
      ctx.fillStyle = col.label; ctx.font = `${Math.max(9, g.mm * 2.4)}px ${col.font}`; ctx.textBaseline = 'bottom';
      ctx.fillText(`${o.speed} mm/s   ${o.gain} mm/mV`, g.left, g.H - g.mm * 0.8);
      if (o.note) { ctx.textAlign = 'right'; ctx.fillText(o.note, g.W - g.mm * 2, g.H - g.mm * 0.8); ctx.textAlign = 'left'; }
    }
    _stripX(t) { return this.g.left + (t - this.rec.t0) * this.g.pxPerMs; }
    _markers(y, col) {
      const ctx = this.bctx, g = this.g, rec = this.rec;
      ctx.fillStyle = col.mark; ctx.strokeStyle = col.mark; ctx.lineWidth = 1;
      ctx.font = `600 ${Math.max(9, g.mm * 2.5)}px ${col.font}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      for (const ev of rec.events) {
        if (ev.type !== 'mark') continue;
        const x = this._stripX(ev.t), up = ev.ch === 'A';
        ctx.beginPath(); ctx.moveTo(x + 0.5, y + (up ? 0 : g.mk * 0.55)); ctx.lineTo(x + 0.5, y + (up ? g.mk * 0.2 : g.mk * 0.75)); ctx.stroke();
        ctx.fillText(ev.text, x, y + (up ? g.mk * 0.36 : g.mk * 0.9) - (up ? 0 : g.mk * 0.02));
      }
      ctx.textAlign = 'left';
    }
    _ladder(y, col) {
      const ctx = this.bctx, g = this.g, rec = this.rec, H = g.lad;
      const yA0 = y + H * 0.08, yA1 = y + H * 0.26, yN = y + H * 0.62, yV0 = y + H * 0.74, yV1 = y + H * 0.92;
      ctx.fillStyle = col.paper; ctx.globalAlpha = 0.82; ctx.fillRect(0, y, g.W, H); ctx.globalAlpha = 1;
      ctx.strokeStyle = col.tier; ctx.lineWidth = 1;
      ctx.beginPath(); for (const yy of [yA0, yA1, yV0, yV1]) { ctx.moveTo(g.left, yy + 0.5); ctx.lineTo(g.W, yy + 0.5); } ctx.stroke();
      ctx.fillStyle = col.label; ctx.font = `600 ${Math.max(9, g.mm * 2.4)}px ${col.font}`; ctx.textBaseline = 'middle';
      ctx.fillText('A', g.mm * 1.5, (yA0 + yA1) / 2); ctx.fillText('AV', g.mm * 1.5, (yA1 + yV0) / 2); ctx.fillText('V', g.mm * 1.5, (yV0 + yV1) / 2);
      ctx.save(); ctx.beginPath(); ctx.rect(g.left, y, g.W - g.left, H); ctx.clip();
      ctx.lineWidth = Math.max(1.2, g.mm * 0.35);
      for (const ev of rec.events) {
        const x = this._stripX(ev.t);
        if (ev.type === 'P' || ev.type === 'adrive') {
          ctx.strokeStyle = ev.kind === 'retro' || ev.kind === 'ap' ? col.slow : col.trace;
          ctx.globalAlpha = ev.type === 'adrive' ? 0.5 : 1;
          ctx.beginPath(); if (ev.kind === 'retro' || ev.kind === 'ap') { ctx.moveTo(x - 2, yA0 + 1); ctx.lineTo(x, yA1); } else { ctx.moveTo(x, yA0 + 1); ctx.lineTo(x, yA1); } ctx.stroke(); ctx.globalAlpha = 1;
        } else if (ev.type === 'QRS') {
          const wide = ev.wave.qrs > 115;
          ctx.strokeStyle = col.trace; ctx.lineWidth = Math.max(1.2, g.mm * (wide ? 0.7 : 0.35));
          ctx.beginPath(); ctx.moveTo(x, yV0); ctx.lineTo(x + (ev.label === 'conducted' ? 2 : 0), yV1 - 1); ctx.stroke();
          ctx.lineWidth = Math.max(1.2, g.mm * 0.35);
        } else if (ev.type === 'cond') {
          const x0 = this._stripX(ev.t0), x1 = this._stripX(ev.t1);
          const isAV = ev.path === 'fast' || ev.path === 'slow', isAP = ev.path === 'ap', isH = ev.path === 'hps';
          if (!(isAV || isAP || isH)) continue;
          const fwd = ev.dir === 'f';
          let ya, yb;
          if (isAP) { ya = yA1; yb = yV0; } else if (isAV) { ya = yA1; yb = yN; } else { ya = yN; yb = yV0; }
          ctx.strokeStyle = isAP ? col.ap : ev.path === 'slow' ? col.slow : col.fast;
          ctx.setLineDash(isAP ? [4, 3] : []);
          ctx.beginPath();
          if (ev.ok) {
            if (fwd) { ctx.moveTo(x0, ya); ctx.lineTo(x1, yb); } else { ctx.moveTo(x0, yb); ctx.lineTo(x1, ya); }
            ctx.stroke();
          } else if (ev.why !== 'refractory' || isAV || isAP) {
            // blocked: short stub ending in a bar
            const f = ev.why === 'collision' ? Math.min(0.75, Math.max(0.3, 0.5)) : 0.32;
            const xs = ev.why === 'collision' ? x1 : x0 + 3;
            const ys = fwd ? ya + (yb - ya) * f : yb - (yb - ya) * f;
            ctx.globalAlpha = ev.why === 'refractory' && this.dense ? 0.35 : 0.9;
            ctx.moveTo(x0, fwd ? ya : yb); ctx.lineTo(xs, ys); ctx.stroke();
            ctx.setLineDash([]); ctx.strokeStyle = col.block; ctx.beginPath(); ctx.moveTo(xs - 3, ys); ctx.lineTo(xs + 3, ys); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
    }
    _overlay(col) {
      const ctx = this.ctx, g = this.g, rec = this.rec;
      if (this.cursor != null && rec) {
        ctx.strokeStyle = col.cursor; ctx.lineWidth = 1.5;
        for (const cell of this.cells) {
          if (this.cursor < cell.t0 || this.cursor > cell.t1) continue;
          const x = cell.x + (this.cursor - cell.t0) * g.pxPerMs;
          const yb = cell.strip && (this.o.ladder || this.o.markers) && cell === this.cells[this.cells.length - 1] ? g.H - g.mm * 4 : cell.y + g.row * 0.5;
          ctx.beginPath(); ctx.moveTo(x, cell.y - g.row * 0.5); ctx.lineTo(x, yb); ctx.stroke();
        }
      }
      const cal = this.cal;
      if (cal && Math.abs(cal.x1 - cal.x0) > 2) {
        const ms = Math.abs(cal.x1 - cal.x0) / g.pxPerMs;
        ctx.strokeStyle = col.cal; ctx.fillStyle = col.cal; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cal.x0, cal.y - g.row * 0.5); ctx.lineTo(cal.x0, cal.y + g.row * 0.5); ctx.moveTo(cal.x1, cal.y - g.row * 0.5); ctx.lineTo(cal.x1, cal.y + g.row * 0.5);
        ctx.moveTo(cal.x0, cal.y - g.row * 0.42); ctx.lineTo(cal.x1, cal.y - g.row * 0.42); ctx.stroke();
        const txt = `${Math.round(ms)} ms · ${Math.round(60000 / ms)}/min`;
        ctx.font = `600 ${Math.max(11, g.mm * 3)}px ${col.font}`; ctx.textBaseline = 'bottom';
        const tw = ctx.measureText(txt).width, tx = EP.clamp((cal.x0 + cal.x1) / 2 - tw / 2, 4, g.W - tw - 4), ty = cal.y - g.row * 0.44;
        ctx.fillStyle = col.paper; ctx.globalAlpha = 0.9; ctx.fillRect(tx - 3, ty - Math.max(11, g.mm * 3) - 3, tw + 6, Math.max(11, g.mm * 3) + 5); ctx.globalAlpha = 1;
        ctx.fillStyle = col.cal; ctx.fillText(txt, tx, ty);
        if (this.o.onMeasure) this.o.onMeasure(ms);
      }
    }
    /* pointer → { t, cell } */
    hit(px, py) {
      for (const cell of this.cells) {
        if (px >= cell.x && px <= cell.x + cell.w && Math.abs(py - cell.y) <= this.g.row * 0.5) return { cell, t: cell.t0 + (px - cell.x) / this.g.pxPerMs };
      }
      return null;
    }
    _bind() {
      const c = this.c;
      const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      let drag = null;
      c.addEventListener('pointerdown', (e) => {
        if (!this.o.calipers) return;
        const [x, y] = pos(e), h = this.hit(x, y);
        if (!h) { this.cal = null; this.draw(true); return; }
        drag = { cell: h.cell }; this.cal = { x0: x, x1: x, y: h.cell.y };
        c.setPointerCapture(e.pointerId); e.preventDefault();
      });
      c.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const [x] = pos(e);
        this.cal.x1 = EP.clamp(x, drag.cell.x, drag.cell.x + drag.cell.w); this.draw(true);
      });
      const end = (e) => {
        if (!drag) return;
        const wasClick = Math.abs(this.cal.x1 - this.cal.x0) <= 2;
        if (wasClick) { const [x, y] = pos(e), h = this.hit(x, y); this.cal = null; if (h && this.o.onSeek) this.o.onSeek(h.t); this.draw(true); }
        drag = null;
      };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    }
  }
  EP.ECGView = ECGView;

  // ---------------------------------------------------------------------------------------------
  /* Scrolling strip chart. channels: [{ lead } | { key:'pulse', label, color }] ; windowMs */
  class LiveStrip {
    constructor(canvas, o) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ channels: [{ lead: 1 }], windowMs: 8000, gain: 10, rowMm: 24, markers: false, ladder: false, fs: 250 }, o || {});
      this.reset();
      if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement); }
      this.resize();
    }
    reset() {
      const n = Math.ceil((this.o.windowMs / 1000) * this.o.fs) + 8;
      this.n = n; this.buf = this.o.channels.map(() => new Float32Array(n)); this.head = 0; this.tHead = 0; this.items = [];
    }
    resize() {
      const o = this.o, par = this.c.parentElement, W = Math.max(240, (par && par.clientWidth) || 600);
      const mm = W / ((o.windowMs / 1000) * 25);
      const H = Math.round((o.channels.length * o.rowMm + (o.markers ? 9 : 0) + (o.timers ? 13 : 0) + 4) * Math.max(mm, 2.2));
      const dpr = Math.min(2.5, globalThis.devicePixelRatio || 1);
      this.g = { W, H, mm, row: o.rowMm * Math.max(mm, 2.2), pxPerMs: W / o.windowMs };
      this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr); this.c.style.width = W + 'px'; this.c.style.height = H + 'px'; this.dpr = dpr;
      this.draw();
    }
    /* Append samples. chunk: { n, dt, t0, leads, extra:{key:Float32Array}, events, spikes } */
    push(rec, extra) {
      const o = this.o, step = Math.max(1, Math.round(rec.fs / o.fs));
      for (let i = 0; i < rec.n; i += step) {
        for (let c = 0; c < o.channels.length; c++) {
          const ch = o.channels[c];
          this.buf[c][this.head] = ch.key ? (extra && extra[ch.key] ? extra[ch.key][i] : 0) : rec.leads[ch.lead][i];
        }
        this.head = (this.head + 1) % this.n;
      }
      this.tHead = rec.t1;
      for (const ev of rec.events) if ((ev.type === 'mark' || ev.type === 'spike' || ev.type === 'timer' || ev.type === 'shock') && ev.t >= rec.t0 && ev.t < rec.t1) this.items.push(ev);
      const cut = this.tHead - o.windowMs - 500;
      while (this.items.length && this.items[0].t < cut) this.items.shift();
    }
    draw() {
      const ctx = this.ctx, g = this.g, o = this.o;
      if (!g) return;
      const col = cssColors(this.c);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawGrid(ctx, 0, 0, g.W, g.H, g.mm, col);
      const mv = o.gain * Math.max(g.mm, 2.2), dtp = (1000 / o.fs) * g.pxPerMs;
      ctx.lineJoin = 'round'; ctx.font = `600 ${Math.max(10, g.mm * 2.6)}px ${col.font}`; ctx.textBaseline = 'top';
      for (let c = 0; c < o.channels.length; c++) {
        const ch = o.channels[c], y0 = (c + 0.5) * g.row + 2, b = this.buf[c];
        ctx.strokeStyle = ch.key ? (ch.color || col.pulse) : col.trace; ctx.lineWidth = Math.max(1.2, g.mm * 0.3);
        ctx.beginPath();
        for (let k = 0; k < this.n; k++) {
          const v = b[(this.head + k) % this.n], x = g.W - (this.n - 1 - k) * dtp, y = y0 - v * (ch.key ? g.row * 0.36 : mv) + (ch.key ? g.row * 0.3 : 0);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (!ch.key) for (const ev of this.items) {
          if (ev.type !== 'spike') continue;
          const x = g.W - (this.tHead - ev.t) * g.pxPerMs; if (x < 0) continue;
          const k = this.n - 1 - Math.round((this.tHead - ev.t) / (1000 / o.fs)); if (k < 0) continue;
          const v = b[(this.head + k) % this.n];
          const sv = { A: [0.12, -0.5, 0.28], V: [0.36, -0.5, 0.46] }[ev.ch] || [0.3, -0.5, 0.4];
          const amp = EP.Leads.project(sv[0], sv[1], sv[2], ch.lead) * ({ bipolar: 0.9, unipolar: 2.8, temp: 1.6, tcp: 6 }[ev.kind] || 0.9);
          ctx.beginPath(); ctx.moveTo(x, y0 - v * mv); ctx.lineTo(x, y0 - (v + amp) * mv); ctx.stroke();
        }
        ctx.fillStyle = ch.key ? (ch.color || col.pulse) : col.label;
        ctx.fillText(ch.label || LN()[ch.lead], 6, c * g.row + 5);
      }
      if (o.markers) {
        const y = o.channels.length * g.row + 2;
        ctx.fillStyle = col.mark; ctx.strokeStyle = col.mark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
        for (const ev of this.items) {
          if (ev.type !== 'mark') continue;
          const x = g.W - (this.tHead - ev.t) * g.pxPerMs, up = ev.ch === 'A';
          ctx.beginPath(); ctx.moveTo(x + 0.5, y + (up ? 0 : g.mm * 4.6)); ctx.lineTo(x + 0.5, y + (up ? g.mm * 1.4 : g.mm * 6)); ctx.stroke();
          ctx.fillText(ev.text, x, y + (up ? g.mm * 2.9 : g.mm * 7.6));
        }
        ctx.textAlign = 'left';
      }
      if (o.timers) {
        const mmx = Math.max(g.mm, 2.2), y = (o.channels.length * o.rowMm + (o.markers ? 9 : 0)) * mmx + 4;
        const lanes = { AVD: 0, PVARP: 1, VRP: 2 }, cols = { AVD: col.cursor, PVARP: col.slow, VRP: col.tier };
        ctx.font = `600 ${Math.max(9, g.mm * 2.2)}px ${col.font}`; ctx.textBaseline = 'middle';
        for (const k in lanes) { ctx.fillStyle = col.label; ctx.fillText(k, 6, y + (lanes[k] + 0.5) * mmx * 3.6); }
        for (const ev of this.items) {
          if (ev.type !== 'timer' || lanes[ev.name] == null) continue;
          const x0 = g.W - (this.tHead - ev.t0) * g.pxPerMs, x1 = g.W - (this.tHead - Math.min(ev.t1, this.tHead)) * g.pxPerMs;
          if (x1 < 46) continue;
          ctx.fillStyle = cols[ev.name]; ctx.globalAlpha = 0.75;
          ctx.fillRect(Math.max(46, x0), y + lanes[ev.name] * mmx * 3.6 + mmx * 0.6, Math.max(1, x1 - Math.max(46, x0)), mmx * 2.4);
          ctx.globalAlpha = 1;
        }
      }
    }
    /* Freeze-frame helpers for the UI */
    visibleEvents() { return this.items; }
  }
  EP.LiveStrip = LiveStrip;
  EP.cssColors = cssColors; EP.drawGrid = drawGrid;
})(globalThis.EP = globalThis.EP || {});
