/* EP Simulator — turns a simulator event log into sampled 12-lead signals. */
(function (EP) {
  'use strict';
  const S = (EP.Synth = {});
  S.FS = 500;
  const TAU = 2 * Math.PI;

  // ---- continuous generators: fn(tms, out[3]) adds a dipole (mV) ------------------------------
  function sawF(ph) {
    // typical flutter wave as seen in lead II: slow downslope, sharp negative, sharp return
    const pts = [[0, 0.3], [0.5, -0.25], [0.72, -1.0], [0.9, 0.35], [1, 0.3]];
    for (let i = 0; i < pts.length - 1; i++) if (ph <= pts[i + 1][0]) { const a = pts[i], b = pts[i + 1]; return a[1] + (b[1] - a[1]) * (ph - a[0]) / (b[0] - a[0]); }
    return 0.3;
  }
  function flutterGen(seg) {
    const cw = seg.dir === 'cw', amp = seg.amp || 1;
    return function (t, o) {
      let ph = ((t - seg.t0) / seg.cl) % 1; if (ph < 0) ph += 1;
      const f = (sawF((ph + 0.985) % 1) + sawF(ph) + sawF((ph + 0.015) % 1)) / 3;
      const b = Math.exp(-(((ph - 0.86) / 0.075) ** 2));
      if (!cw) { o[0] += -0.07 * b * amp; o[1] += -0.23 * f * amp; o[2] += 0.13 * b * amp; }
      else {
        const g = -0.8 * f + 0.14 * Math.sin(2 * TAU * ph), w = Math.exp(-(((ph - 0.78) / 0.14) ** 2));
        o[0] += 0.06 * w * amp; o[1] += -0.2 * g * amp; o[2] += -0.13 * w * amp;
      }
    };
  }
  function noiseGen(seg, n, f0, f1, amp, bias, amRange) {
    const r = EP.rng(seg.seed || 1), comps = [];
    for (let i = 0; i < n; i++) {
      const ax = [bias[0] + r.gauss() * 0.5, bias[1] + r.gauss() * 0.5, bias[2] + r.gauss() * 0.5];
      const l = Math.hypot(ax[0], ax[1], ax[2]) || 1;
      comps.push({ f: r.range(f0, f1) / 1000, ph: r() * TAU, ax: [ax[0] / l, ax[1] / l, ax[2] / l], fa: r.range(amRange[0], amRange[1]) / 1000, pa: r() * TAU, a: amp * r.range(0.6, 1.2) });
    }
    return comps;
  }
  function fibGen(seg) {
    const comps = noiseGen(seg, 7, 4.6, 8.6, 0.05 * (seg.amp || 1), [-0.25, -0.45, 0.75], [0.25, 1.1]);
    return function (t, o) {
      for (const c of comps) {
        const v = c.a * (0.55 + 0.45 * Math.sin(TAU * c.fa * t + c.pa)) * Math.sin(TAU * c.f * t + c.ph);
        o[0] += v * c.ax[0]; o[1] += v * c.ax[1]; o[2] += v * c.ax[2];
      }
    };
  }
  function vfGen(seg) {
    const comps = noiseGen(seg, 6, 3.4, 6.8, 0.42, [0.2, -0.2, 0.2], [0.15, 0.7]);
    return function (t, o) {
      const age = (t - seg.t0) / 1000, decay = (seg.fine ? 0.35 : 1) * (0.35 + 0.65 * Math.exp(-age / 25));
      for (const c of comps) {
        const v = decay * c.a * (0.4 + 0.6 * Math.sin(TAU * c.fa * t + c.pa) ** 2) * Math.sin(TAU * c.f * t + c.ph + 1.2 * Math.sin(TAU * c.fa * 0.7 * t));
        o[0] += v * c.ax[0]; o[1] += v * c.ax[1]; o[2] += v * c.ax[2];
      }
    };
  }
  function tdpGen(seg) {
    const cl = seg.cl || 245, tw = seg.twist || 2700, A = seg.amp || 1.25;
    const r = EP.rng(seg.seed || 3), p0 = r() * TAU;
    return function (t, o) {
      const tt = t - seg.t0;
      const fm = tt / cl + 0.35 * Math.sin(TAU * tt / 1900 + p0);
      const base = (ph) => Math.sin(TAU * fm + ph) + 0.22 * Math.sin(2 * TAU * fm + ph * 2 + 0.6);
      const e = TAU * tt / tw;
      o[0] += A * 0.75 * Math.sin(e + p0) * base(0);
      o[1] += A * 0.85 * Math.sin(e + p0 + 1.9) * base(0.5);
      o[2] += A * 0.9 * Math.sin(e + p0 + 0.9) * base(1.1);
    };
  }
  function pmvtGen(seg) {
    const r = EP.rng(seg.seed || 5), A = seg.amp || 1.0;
    const f = [r.range(4.0, 4.6) / 1000, r.range(4.9, 5.6) / 1000, r.range(3.3, 3.9) / 1000], p = [r() * TAU, r() * TAU, r() * TAU, r() * TAU, r() * TAU, r() * TAU];
    return function (t, o) {
      const s0 = Math.sin(TAU * f[0] * t + p[0]), s1 = Math.sin(TAU * f[1] * t + p[1]), s2 = Math.sin(TAU * f[2] * t + p[2]);
      o[0] += A * (0.6 * s0 + 0.5 * s1 * Math.sin(TAU * 0.0006 * t + p[3]));
      o[1] += A * (0.6 * s1 + 0.45 * s2 * Math.sin(TAU * 0.0005 * t + p[4]));
      o[2] += A * (0.6 * s2 + 0.5 * s0 * Math.sin(TAU * 0.0007 * t + p[5]));
    };
  }
  const GEN = { flutter: flutterGen, fib: fibGen, vf: vfGen, tdp: tdpGen, pmvt: pmvtGen };
  S.gen = function (seg) { return seg._gen || (seg._gen = GEN[seg.type](seg)); };

  const SPIKE_VEC = { A: [0.12, -0.5, 0.28], V: [0.36, -0.5, 0.46] };
  const SPIKE_AMP = { bipolar: 0.55, unipolar: 2.6, temp: 1.6, tcp: 7 };

  /* Build a recording for [t0, t1) ms. opts: { fs, noise } */
  S.build = function (sim, t0, t1, opts) {
    opts = opts || {};
    const fs = opts.fs || S.FS, dt = 1000 / fs, n = Math.max(1, Math.round((t1 - t0) / dt));
    const xyz = new Float32Array(3 * n);
    const add = new Array(12).fill(null);
    const events = [], spikes = [];
    for (const ev of sim.out) {
      if (ev.t > t1 + 50) break;
      const w = ev.wave;
      if (w) {
        const ts = ev.t - w.pre;
        if (ts + w.n < t0 || ts > t1) continue;
        events.push(ev);
        const i0 = Math.max(0, Math.ceil((ts - t0) / dt)), i1 = Math.min(n - 1, Math.floor((ts + w.n - 1.001 - t0) / dt));
        for (let i = i0; i <= i1; i++) {
          const tau = t0 + i * dt - ts, k = Math.floor(tau), fr = tau - k, a = k * 3, b = a + 3;
          xyz[i * 3] += w.vcg[a] + (w.vcg[b] - w.vcg[a]) * fr;
          xyz[i * 3 + 1] += w.vcg[a + 1] + (w.vcg[b + 1] - w.vcg[a + 1]) * fr;
          xyz[i * 3 + 2] += w.vcg[a + 2] + (w.vcg[b + 2] - w.vcg[a + 2]) * fr;
        }
        if (w.adds) for (const ad of w.adds) {
          const arr = add[ad.lead] || (add[ad.lead] = new Float32Array(n));
          for (let i = i0; i <= i1; i++) { const k = Math.floor(t0 + i * dt - ts); arr[i] += ad.data[k] || 0; }
        }
      } else if (ev.t >= t0 - 50 && ev.t <= t1) {
        events.push(ev);
        if (ev.type === 'spike') {
          const v = SPIKE_VEC[ev.ch] || SPIKE_VEC.V, a = (SPIKE_AMP[ev.kind] || 0.55) * (ev.amp || 1);
          spikes.push({ t: ev.t, ch: ev.ch, v: [v[0] * a, v[1] * a, v[2] * a], kind: ev.kind, captured: ev.captured });
        }
      }
    }
    const o = [0, 0, 0];
    for (const seg of sim.segs) {
      if (seg.t1 < t0 || seg.t0 > t1) continue;
      const g = S.gen(seg);
      const i0 = Math.max(0, Math.ceil((seg.t0 - t0) / dt)), i1 = Math.min(n - 1, Math.floor((Math.min(seg.t1, t1) - t0) / dt));
      for (let i = i0; i <= i1; i++) {
        const t = t0 + i * dt;
        o[0] = o[1] = o[2] = 0; g(t, o);
        const ramp = Math.min(1, (t - seg.t0) / 140) * (seg.t1 < Infinity ? Math.min(1, Math.max(0, (seg.t1 - t) / 60)) : 1);
        xyz[i * 3] += o[0] * ramp; xyz[i * 3 + 1] += o[1] * ramp; xyz[i * 3 + 2] += o[2] * ramp;
      }
    }
    // shock artefact: saturation then a decaying baseline shift
    for (const ev of events) if (ev.type === 'shock') {
      for (let i = Math.max(0, Math.floor((ev.t - t0) / dt)); i < n; i++) {
        const age = t0 + i * dt - ev.t; if (age > 900) break;
        const v = age < 30 ? 6 : 2.2 * Math.exp(-(age - 30) / 160);
        xyz[i * 3] += 0.3 * v; xyz[i * 3 + 1] += -0.6 * v; xyz[i * 3 + 2] += 0.5 * v;
      }
    }
    const leads = [], Lv = EP.Leads.vec;
    const nz = opts.noise == null ? 0.006 : opts.noise, r = EP.rng(977);
    for (let l = 0; l < 12; l++) {
      const a = new Float32Array(n), v = Lv[l], ad = add[l];
      for (let i = 0; i < n; i++) a[i] = v[0] * xyz[i * 3] + v[1] * xyz[i * 3 + 1] + v[2] * xyz[i * 3 + 2] + (ad ? ad[i] : 0) + (nz ? nz * (r() - 0.5) * 2 : 0);
      leads.push(a);
    }
    return { fs, dt, n, t0, t1, leads, xyz, events, spikes, segs: sim.segs };
  };

  /* Arterial-pressure style pulse trace from the QRS events (mechanical capture teaching). */
  S.pulse = function (sim, t0, t1, fs, opts) {
    opts = opts || {};
    const dt = 1000 / fs, n = Math.round((t1 - t0) / dt), a = new Float32Array(n);
    const beats = sim.out.filter((e) => e.type === 'QRS' && e.t > t0 - 1500 && e.t < t1);
    for (const b of beats) {
      if (opts.noPulse && opts.noPulse(b)) continue;
      // stroke volume falls with short filling time and with loss of AV synchrony / wide ectopy
      const fill = EP.clamp((b.rr - 250) / 450, 0.15, 1);
      const amp = fill * (b.label === 'conducted' || b.label === 'pre-excited' ? 1 : 0.8);
      const on = b.t + 110;
      for (let i = Math.max(0, Math.floor((on - t0) / dt)); i < n; i++) {
        const x = (t0 + i * dt - on); if (x > 700) break;
        const up = 1 - Math.exp(-x / 38), down = Math.exp(-x / 190), notch = 0.12 * Math.exp(-(((x - 270) / 28) ** 2));
        const v = amp * (up * down * 1.55 + notch * down * 3);
        if (v > a[i]) a[i] = v;
      }
    }
    return a;
  };
})(globalThis.EP = globalThis.EP || {});
