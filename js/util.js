/* EP Simulator — shared helpers. Plain script; everything hangs off globalThis.EP. */
(function (EP) {
  'use strict';

  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    addS: (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]),
    dist: (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2),
    norm: (a) => { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  EP.V = V;

  EP.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  EP.lerp = (a, b, t) => a + (b - a) * t;
  EP.smoothstep = (a, b, x) => { const t = EP.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* Deterministic RNG (mulberry32) so a given rhythm always looks the same. */
  EP.rng = function (seed) {
    let s = seed >>> 0;
    const f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.gauss = function () {
      let u = 0, v = 0;
      while (u === 0) u = f();
      v = f();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    f.range = (a, b) => a + (b - a) * f();
    return f;
  };

  /* Binary min-heap keyed by a Float32Array/Float64Array of priorities. */
  EP.Heap = function (capacity) {
    this.ids = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
    this.n = 0;
  };
  EP.Heap.prototype.push = function (id, key) {
    if (this.n >= this.ids.length) {
      const ni = new Int32Array(this.ids.length * 2); ni.set(this.ids); this.ids = ni;
      const nk = new Float64Array(this.keys.length * 2); nk.set(this.keys); this.keys = nk;
    }
    let i = this.n++;
    const ids = this.ids, keys = this.keys;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p]; keys[i] = keys[p]; i = p;
    }
    ids[i] = id; keys[i] = key;
  };
  EP.Heap.prototype.pop = function () {
    const ids = this.ids, keys = this.keys;
    const top = ids[0];
    this.topKey = keys[0];
    const n = --this.n;
    if (n > 0) {
      const id = ids[n], key = keys[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        ids[i] = ids[c]; keys[i] = keys[c]; i = c;
      }
      ids[i] = id; keys[i] = key;
    }
    return top;
  };

  /* In-place Gaussian smoothing of an interleaved n×ch Float32Array. */
  EP.smooth = function (arr, n, ch, sigma) {
    const r = Math.max(1, Math.ceil(sigma * 3));
    const k = new Float32Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-0.5 * (i / sigma) ** 2); sum += k[i + r]; }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    const out = new Float32Array(arr.length);
    for (let c = 0; c < ch; c++) {
      for (let i = 0; i < n; i++) {
        let a = 0;
        for (let j = -r; j <= r; j++) {
          const q = i + j;
          if (q >= 0 && q < n) a += arr[q * ch + c] * k[j + r];
        }
        out[i * ch + c] = a;
      }
    }
    arr.set(out);
    return arr;
  };

  EP.fmt = {
    ms: (x) => Math.round(x) + ' ms',
    bpm: (ms) => (ms > 0 ? Math.round(60000 / ms) : 0),
  };
})(globalThis.EP = globalThis.EP || {});
