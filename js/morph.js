/* EP Simulator — beat morphology.
 *
 * Turns activation specs into ECG waveforms:
 *   ventricular spec → QRS dipole (from the voxel model) + ST-T from the ventricular-gradient rule
 *   atrial spec      → P wave dipole (from the atrial surface model)
 * Waveforms are vectorcardiograms sampled at 1 kHz: { n, pre, vcg:Float32Array(3n), adds }
 * where `pre` is the number of ms between sample 0 and the fiducial (first activation).
 */
(function (EP) {
  'use strict';
  const G = EP.G, M = EP.Model;
  const Mo = (EP.Morph = {});
  const A = (EP.Anatomy = EP.Anatomy || {});
  let ready = false;

  const T_NORMAL = [48.6, -33.9, 23.6];   // desired T-wave area vector of a normal beat (mV·ms)
  const KAPPA = 0.62;                     // how strongly the T opposes the QRS area (ventricular gradient rule)
  let GV = [0, 0, 0];                     // ventricular gradient (set during init)
  let NORMAL_AREA = 1;
  Mo.NORMAL_QRS = 92;

  Mo.init = function () {
    if (ready) return Mo;
    M.build();
    A.muscle = G.mesh(G.sdMuscle, G.BOUNDS.muscle, 0.28);
    const n = A.muscle.pos.length / 3, P = A.muscle.pos;
    A.region = new Uint8Array(n);
    for (let i = 0; i < n; i++) A.region[i] = G.region(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    M.buildAtria(A.muscle, A.region);
    A.voxOfVert = M.mapMesh(A.muscle.pos, A.muscle.nrm, (i) => !G.isAtrial(A.region[i]), 0.3);
    const nb = Mo.vent(Mo.spec('normal'));
    NORMAL_AREA = Math.hypot(nb.area[0], nb.area[1], nb.area[2]);
    GV = [T_NORMAL[0] + KAPPA * nb.area[0], T_NORMAL[1] + KAPPA * nb.area[1], T_NORMAL[2] + KAPPA * nb.area[2]];
    Mo.NORMAL_QRS = nb.off - nb.on;
    ready = true;
    return Mo;
  };

  // ---- named sites (world points + which kind of voxel to snap to) ---------------------------
  const L = G.L;
  Mo.SITES = {
    rvApex: { p: L(3.3, 0.5, 6.6), kind: 'endoRV', name: 'RV apex' },
    rvMidSeptum: { p: L(2.95, 0.0, 3.4), kind: 'endoRV', name: 'RV mid-septum' },
    rvHighSeptum: { p: L(3.1, -1.2, 1.6), kind: 'endoRV', name: 'RV high septum' },
    rvotSeptal: { p: L(2.3, -3.4, 1.1), kind: 'any', name: 'RVOT (septal)' },
    rvotFree: { p: L(4.0, -3.5, 1.3), kind: 'any', name: 'RVOT (free wall)' },
    rvFreeWall: { p: L(6.0, 0.2, 3.0), kind: 'any', name: 'RV free wall' },
    rvInflow: { p: L(5.2, 2.0, 1.2), kind: 'any', name: 'RV inflow / tricuspid annulus' },
    moderator: { p: L(4.6, -0.4, 4.6), kind: 'endoRV', name: 'Moderator band', purkRV: 1 },
    lbbArea: { p: L(2.15, -0.2, 2.2), kind: 'purkLV', name: 'Left bundle branch area', purkLV: 1 },
    hisBundle: { p: G.LM.his, kind: 'any', name: 'His bundle' },
    lvotSeptal: { p: L(2.0, -1.3, 0.4), kind: 'any', name: 'LVOT / aortic cusp region' },
    lvSummit: { p: L(0.4, -3.0, 0.4), kind: 'epi', name: 'LV summit' },
    mitralAnt: { p: L(-0.8, -2.9, 0.3), kind: 'any', name: 'Anterior mitral annulus' },
    mitralLat: { p: L(-3.0, 0.0, 0.3), kind: 'any', name: 'Lateral mitral annulus' },
    mitralPost: { p: L(0.3, 2.95, 0.3), kind: 'any', name: 'Posterior mitral annulus' },
    papAL: { p: L(-1.6, -1.0, 4.4), kind: 'endoLV', name: 'Anterolateral papillary muscle' },
    papPM: { p: L(-0.6, 1.9, 4.4), kind: 'endoLV', name: 'Posteromedial papillary muscle' },
    fascPost: { p: L(1.5, 1.2, 4.6), kind: 'purkLV', name: 'Left posterior fascicle', purkLV: 1, purkLVant: 0.5, lobes: 'fascPost' },
    fascAnt: { p: L(0.9, -1.6, 3.6), kind: 'purkLV', name: 'Left anterior fascicle', purkLV: 1, purkLVpost: 0.5, lobes: 'fascAnt' },
    lvApex: { p: L(0.0, 0.2, 7.6), kind: 'any', name: 'LV apex' },
    lvLatEpi: { p: L(-3.05, 0.6, 2.6), kind: 'epi', name: 'LV lateral wall (epicardial / coronary vein)' },
    lvPostLat: { p: L(-2.3, 2.0, 2.0), kind: 'epi', name: 'LV posterolateral wall' },
    lvInfBase: { p: L(0.4, 3.0, 1.2), kind: 'any', name: 'LV inferobasal wall' },
    lvAntWall: { p: L(-0.6, -2.95, 3.4), kind: 'epi', name: 'LV anterior wall' },
    lvInfApical: { p: L(0.5, 2.2, 6.0), kind: 'any', name: 'LV inferoapical wall' },
    lvInfLatEndo: { p: L(-1.2, 2.0, 4.5), kind: 'endo', name: 'LV inferolateral endocardium' },   // RBBB pattern, superior axis: a lead inside the LV cavity
    midCardiacVein: { p: L(1.6, 2.7, 3.2), kind: 'epi', name: 'Middle cardiac vein (posterior septum, epicardial)' },
  };

  /* His-Purkinje exits. o: { lbb, rbb, laf, lpf (false = blocked), t (ms offset), rbbDelay, lbbDelay } */
  Mo.hps = function (o) {
    o = o || {};
    const E = G.LM.exits, t = o.t || 0, s = [];
    if (o.lbb !== false) {
      const d = t + (o.lbbDelay || 0);
      if (o.laf !== false || o.lpf !== false) s.push({ p: E.lvSeptal, kind: 'purkLV', t: d + (o.laf === false ? 6 : 0) });
      if (o.laf !== false) s.push({ p: E.laf, kind: 'purkLV', t: d + 3 });
      if (o.lpf !== false) s.push({ p: E.lpf, kind: 'purkLV', t: d + 3 });
    }
    if (o.rbb !== false) {
      const d = t + (o.rbbDelay || 0);
      s.push({ p: E.rvSeptal, kind: 'purkRV', t: d + 8 }, { p: E.rvFree, kind: 'purkRV', t: d + 12 });
    }
    return s;
  };

  Mo.ECT = 0.34;      // Purkinje-layer factor when the network is only engaged retrogradely
  /* Hemiblock correction lobes. The uniform Purkinje sheet under-states how far a fascicular block swings
   * the frontal axis, so these two templates get a small additive dipole: [time ms, sigma ms, [x,y,z] mV]. */
  const LOBES = {
    lafb: { id: 'lafb', list: [[20, 9, [0.03, 0.38, 0.0]], [56, 13, [0.26, 0.5, -0.08]]] },
    lpfb: { id: 'lpfb', list: [[18, 8, [0.08, -0.3, 0.0]], [54, 13, [-0.34, -0.52, 0.03]]] },
    fascPost: { id: 'fp', list: [[26, 10, [0.0, 0.34, 0.0]], [70, 16, [0.14, 0.52, 0.07]], [104, 14, [-0.32, 0.07, 0.36]]] },
    fascAnt: { id: 'fa', list: [[24, 10, [0.07, -0.2, 0.0]], [66, 15, [-0.34, -0.42, 0.07]], [100, 14, [-0.25, 0.0, 0.36]]] },
  };
  Mo.siteSpec = function (st) {
    const sp = { seeds: [{ p: st.p, kind: st.kind, t: 0 }], purkLV: st.purkLV || Mo.ECT, purkRV: st.purkRV || Mo.ECT };
    if (st.purkLVant != null) sp.purkLVant = st.purkLVant;
    if (st.purkLVpost != null) sp.purkLVpost = st.purkLVpost;
    if (st.lobes) sp.lobes = LOBES[st.lobes];
    return sp;
  };
  /* Build a named ventricular activation spec.
   *  'normal' | 'rbbb' | 'lbbb' | 'lafb' | 'lpfb' | 'rbbb+lafb' | 'rbbb+lpfb' | 'ilbbb' | 'irbbb'
   *  { site: 'rvApex' | [x,y,z], kind } → focal beat from that site
   * opts.slow ≥ 1 scales all conduction (Na-channel block, hyperkalaemia). */
  Mo.spec = function (what, opts) {
    opts = opts || {};
    let sp;
    if (typeof what === 'string') {
      switch (what) {
        case 'normal': sp = { seeds: Mo.hps({}), purkLV: 1, purkRV: 1 }; break;
        case 'rbbb': sp = { seeds: Mo.hps({ rbb: false }), purkLV: 1, purkRV: 0.2 }; break;
        case 'irbbb': sp = { seeds: Mo.hps({ rbbDelay: 22 }), purkLV: 1, purkRV: 0.7 }; break;
        case 'lbbb': sp = { seeds: Mo.hps({ lbb: false }), purkLV: 0.2, purkRV: 1 }; opts = Object.assign({ slow: 1.1 }, opts); break;
        case 'ilbbb': sp = { seeds: Mo.hps({ lbbDelay: 24 }), purkLV: 0.7, purkRV: 1 }; break;
        case 'lafb': sp = { seeds: Mo.hps({ laf: false }), purkLV: 1, purkLVant: 0.5, purkRV: 1, lobes: LOBES.lafb }; break;
        case 'lpfb': sp = { seeds: Mo.hps({ lpf: false }), purkLV: 1, purkLVpost: 0.5, purkRV: 1, lobes: LOBES.lpfb }; break;
        case 'rbbb+lafb': sp = { seeds: Mo.hps({ rbb: false, laf: false }), purkLV: 1, purkLVant: 0.5, purkRV: 0.2, lobes: LOBES.lafb }; break;
        case 'rbbb+lpfb': sp = { seeds: Mo.hps({ rbb: false, lpf: false }), purkLV: 1, purkLVpost: 0.5, purkRV: 0.2, lobes: LOBES.lpfb }; break;
        default:
          if (Mo.SITES[what]) { const st = Mo.SITES[what]; sp = Mo.siteSpec(st); }
          else throw new Error('unknown morphology ' + what);
      }
    } else if (what.site) {
      const st = typeof what.site === 'string' ? Mo.SITES[what.site] : { p: what.site, kind: what.kind || 'any' };
      sp = Mo.siteSpec(st);
    } else sp = Object.assign({}, what);
    if (opts.purkLV != null) sp.purkLV = opts.purkLV;
    if (opts.purkRV != null) sp.purkRV = opts.purkRV;
    if (opts.slow && opts.slow !== 1) { sp.vm = M.VM / opts.slow; sp.vp = M.VP / opts.slow; }
    if (opts.aniso) sp.aniso = opts.aniso;
    return sp;
  };
  /* Combine specs into one activation (fusion): parts = [{spec, t}] */
  Mo.fuse = function (parts) {
    const seeds = []; let pl = 1, pr = 1, vm, vp;
    for (const q of parts) {
      for (const s of q.spec.seeds) seeds.push({ p: s.p, kind: s.kind, v: s.v, t: (s.t || 0) + (q.t || 0) });
      if (q.spec.vm) { vm = q.spec.vm; vp = q.spec.vp; }
    }
    // The Purkinje network is as good as the best-conducting contributor that actually uses it.
    pl = Math.max.apply(null, parts.map((q) => (q.spec.purkLV == null ? 1 : q.spec.purkLV)));
    pr = Math.max.apply(null, parts.map((q) => (q.spec.purkRV == null ? 1 : q.spec.purkRV)));
    const sp = { seeds, purkLV: pl, purkRV: pr };
    const reg = (k) => { let b = null; for (const q of parts) { const f = q.spec[k] != null ? q.spec[k] : (q.spec.purkLV == null ? 1 : q.spec.purkLV); b = b == null ? f : Math.max(b, f); } return b; };
    if (parts.some((q) => q.spec.purkLVant != null || q.spec.purkLVpost != null)) { sp.purkLVant = reg('purkLVant'); sp.purkLVpost = reg('purkLVpost'); }
    if (vm) { sp.vm = vm; sp.vp = vp; }
    const sc = parts.find((q) => q.spec.scar); if (sc) sp.scar = sc.spec.scar;
    return sp;
  };

  // ---- ventricular activation (cached) --------------------------------------------------------
  const vcache = new Map();
  function specKey(sp) {
    let k = (sp.purkLV == null ? 1 : sp.purkLV) + '|' + (sp.purkRV == null ? 1 : sp.purkRV) + '|' + (sp.purkLVant == null ? '' : sp.purkLVant) + '|' + (sp.purkLVpost == null ? '' : sp.purkLVpost) + '|' + (sp.vm || 0).toFixed(4) + '|' + (sp.aniso || 0) + '|' + (sp.lobes ? sp.lobes.id : '') + '|' + (sp.scar ? sp.scar.id + ':' + sp.scar.k.toFixed(2) : '');
    for (const s of sp.seeds) k += '|' + (s.v != null ? 'v' + s.v : s.p[0].toFixed(2) + ',' + s.p[1].toFixed(2) + ',' + s.p[2].toFixed(2) + (s.kind || '')) + '@' + Math.round((s.t || 0) * 2) / 2;
    return k;
  }
  Mo.vent = function (sp) {
    const key = specKey(sp);
    let r = vcache.get(key);
    if (r) { vcache.delete(key); vcache.set(key, r); return r; }
    const seeds = sp.seeds.map((s) => ({ v: s.v != null ? s.v : M.nearest(s.p, s.kind || 'any'), t: s.t || 0 }));
    const T = M.activate(seeds, sp);
    const d = M.dipole(T, sp.vm ? 3.2 * Math.min(3.2, M.VM / sp.vm) : 3.2, sp.scar ? sp.scar.w : null, sp.scar ? sp.scar.k : 0);   // slowed conduction: smooth proportionally
    if (sp.lobes) {
      const sc = sp.vm ? M.VM / sp.vm : 1;
      for (const lb of sp.lobes.list) {
        const c = lb[0] * sc - d.t0, sg = lb[1] * sc;
        for (let i = Math.max(0, Math.floor(c - 3 * sg)); i < Math.min(d.n, Math.ceil(c + 3 * sg)); i++) {
          const g = Math.exp(-0.5 * ((i - c) / sg) ** 2);
          d.vcg[i * 3] += lb[2][0] * g; d.vcg[i * 3 + 1] += lb[2][1] * g; d.vcg[i * 3 + 2] += lb[2][2] * g;
          d.area[0] += lb[2][0] * g; d.area[1] += lb[2][1] * g; d.area[2] += lb[2][2] * g;
        }
      }
    }
    // visible QRS onset / offset from the dipole magnitude
    let pk = 0;
    const mag = new Float32Array(d.n);
    for (let i = 0; i < d.n; i++) { mag[i] = Math.hypot(d.vcg[i * 3], d.vcg[i * 3 + 1], d.vcg[i * 3 + 2]); if (mag[i] > pk) pk = mag[i]; }
    let i0 = 0, i1 = d.n - 1;
    while (i0 < d.n && mag[i0] < pk * 0.035) i0++;
    while (i1 > 0 && mag[i1] < pk * 0.035) i1--;
    r = { T, vcg: d.vcg, n: d.n, t0: d.t0, tmin: d.tmin, tmax: d.tmax, area: d.area, on: d.t0 + i0, off: d.t0 + i1, peak: pk, key, seeds };
    vcache.set(key, r);
    if (vcache.size > 260) vcache.delete(vcache.keys().next().value);
    return r;
  };

  // ---- ST-T shapes ----------------------------------------------------------------------------
  function tShape(tau, p, sl, sr) {
    const d = tau - p;
    const g = Math.exp(-0.5 * (d / (d < 0 ? sl : sr)) ** 2);
    return g * EP.smoothstep(0, 0.1, tau) * (1 - EP.smoothstep(0.94, 1.0, tau));
  }
  function stPlateau(tau) { return EP.smoothstep(0, 0.045, tau) * (1 - EP.smoothstep(0.22, 0.68, tau)); }
  function stScoop(tau) { return EP.smoothstep(0, 0.06, tau) * Math.sin(Math.PI * Math.min(1, tau / 0.78)) * (1 - EP.smoothstep(0.6, 0.8, tau)); }

  /* Full ventricular complex. o: { rr (ms), mods } → waveform
   * mods: qtc, tAmp, tAdd[3] (mV·ms), tShape{p,sl,sr}, kappa, stFrac, st[3] (mV), stShape, u, jWave,
   *       leadAdd [{lead, fn(msFromJ, jt)}] */
  Mo.vbeat = function (sp, o) {
    o = o || {};
    const a = Mo.vent(sp), m = o.mods || {};
    const rr = EP.clamp(o.rr || 1000, 280, 1700);
    const qrs = a.off - a.on;
    const qtc = m.qtc || 412;
    const jt = EP.clamp((qtc - Mo.NORMAL_QRS) * Math.sqrt(rr / 1000) * (m.jtScale || 1), 110, 640);
    const pre = -a.t0;
    const jIdx = Math.round(a.off - a.t0);
    const tail = (m.u ? 300 : 40);
    const n = jIdx + Math.ceil(jt) + tail;
    const w = new Float32Array(3 * n);
    w.set(a.vcg.subarray(0, Math.min(a.vcg.length, 3 * n)));
    // --- T wave from the ventricular gradient ---
    const k = m.kappa == null ? KAPPA : m.kappa, ta = m.tAmp == null ? 1 : m.tAmp;
    const TA = [(GV[0] - k * a.area[0]) * ta, (GV[1] - k * a.area[1]) * ta, (GV[2] - k * a.area[2]) * ta];
    if (m.tAdd) { TA[0] += m.tAdd[0]; TA[1] += m.tAdd[1]; TA[2] += m.tAdd[2]; }
    const ts = m.tShape || {}, p = ts.p || 0.72, sl = ts.sl || 0.2, sr = ts.sr || 0.105;
    let integ = 0;
    const J = Math.ceil(jt);
    for (let i = 0; i < J; i++) integ += tShape(i / jt, p, sl, sr);
    const refInteg = 0.2 * 300 * 1.9;              // keeps T amplitude sane when JT gets very short
    const norm = 1 / Math.max(integ, refInteg * 0.45);
    const wide = EP.smoothstep(105, 150, qrs);
    const stPri = m.stFrac == null ? 0.03 : m.stFrac, stSec = m.stFrac == null ? 0.2 * wide : 0;
    const SA = [-k * a.area[0] * ta, -k * a.area[1] * ta, -k * a.area[2] * ta];
    const st = m.st || [0, 0, 0];
    const stFn = typeof m.stShape === 'function' ? m.stShape : m.stShape === 'scoop' ? stScoop : stPlateau;
    for (let i = 0; i < J; i++) {
      const tau = i / jt, q = (jIdx + i) * 3;
      // T wave; a small primary ST component; and, for wide beats, a secondary ST shift that is purely
      // opposite to the QRS area — so ST/S stays proportionate lead by lead ("appropriate discordance").
      const tv = tShape(tau, p, sl, sr) * norm, pl = stPlateau(tau) * norm, s2 = stFn(tau), sv = pl * stPri, ss = pl * stSec;
      w[q] += TA[0] * (tv + sv) + SA[0] * ss + st[0] * s2; w[q + 1] += TA[1] * (tv + sv) + SA[1] * ss + st[1] * s2; w[q + 2] += TA[2] * (tv + sv) + SA[2] * ss + st[2] * s2;
    }
    // --- U wave ---
    if (m.u) {
      const c = jIdx + jt + 95, sg = 46, amp = 0.11 * m.u, d = [0.72, -0.5, 0.42];
      for (let i = Math.max(0, Math.floor(c - 150)); i < n; i++) {
        const g = amp * Math.exp(-0.5 * ((i - c) / sg) ** 2), q = i * 3;
        w[q] += d[0] * g; w[q + 1] += d[1] * g; w[q + 2] += d[2] * g;
      }
    }
    // --- J (Osborn) wave ---
    if (m.jWave) {
      const c = jIdx + 14, sg = 13, d = [0.55, -0.62, 0.4];
      for (let i = Math.max(0, jIdx - 30); i < Math.min(n, jIdx + 70); i++) {
        const g = m.jWave * Math.exp(-0.5 * ((i - c) / sg) ** 2), q = i * 3;
        w[q] += d[0] * g; w[q + 1] += d[1] * g; w[q + 2] += d[2] * g;
      }
    }
    let adds = null;
    if (m.leadAdd) {
      adds = m.leadAdd.map((la) => {
        const data = new Float32Array(n);
        for (let i = Math.max(0, jIdx - 40); i < n; i++) data[i] = la.fn(i - jIdx, jt);
        return { lead: la.lead, data };
      });
    }
    return { n, pre, vcg: w, adds, qrsOn: a.on, qrsOff: a.off, qrs, jt, qt: (a.off - a.on) + jt, act: a };
  };

  // ---- atrial activation (cached) --------------------------------------------------------------
  const acache = new Map();
  Mo.ASITES = {
    sinus: { p: G.LM.saNode, name: 'Sinus node' },
    lowRA: { p: [-3.6, -2.4, -0.6], name: 'Low right atrium' },
    avn: { p: G.LM.avNode, name: 'AV node (retrograde)' },
    csOs: { p: G.LM.csOs, name: 'Coronary sinus ostium' },
    crista: { p: [-5.3, 0.2, -0.6], name: 'Crista terminalis' },
    raa: { p: G.LM.raa, name: 'Right atrial appendage' },
    lspv: { p: G.LM.pv.LSPV[0], name: 'Left superior pulmonary vein' },
    rspv: { p: G.LM.pv.RSPV[0], name: 'Right superior pulmonary vein' },
    lipv: { p: G.LM.pv.LIPV[0], name: 'Left inferior pulmonary vein' },
    laa: { p: G.LM.laa, name: 'Left atrial appendage' },
    laLateral: { p: [3.9, 0.6, -3.4], name: 'Lateral left atrium / mitral annulus' },
    laPostSeptal: { p: [0.6, -1.0, -4.2], name: 'Posteroseptal left atrium' },
  };
  Mo.atrial = function (sp) {
    // sp: { seeds: [{p|site, t}], speed }
    let key = 'a' + (sp.speed || 0);
    const pt = (s) => (typeof s.site === 'string' ? Mo.ASITES[s.site].p : (s.site || s.p));
    for (const s of sp.seeds) { const p = pt(s); key += '|' + p[0].toFixed(2) + ',' + p[1].toFixed(2) + ',' + p[2].toFixed(2) + '@' + (s.t || 0); }
    let r = acache.get(key);
    if (r) return r;
    const seeds = sp.seeds.map((s) => ({ v: M.nearestAtrial(pt(s)), t: s.t || 0 }));
    const T = M.atrialActivate(seeds, sp);
    const d = M.atrialDipole(T);
    r = { T, vcg: d.vcg, n: d.n, t0: d.t0, tmin: d.tmin, tmax: d.tmax, dur: d.dur, key };
    acache.set(key, r);
    if (acache.size > 80) acache.delete(acache.keys().next().value);
    return r;
  };
  /* P wave waveform. o: { amp } */
  Mo.pwave = function (sp, o) {
    o = o || {};
    const a = Mo.atrial(sp), amp = o.amp == null ? 1 : o.amp;
    const ext = o.prDep ? 110 : 0, n = a.n + ext;
    const w = new Float32Array(n * 3);
    for (let i = 0; i < a.vcg.length; i++) w[i] = a.vcg[i] * amp;
    if (o.prDep) {
      // atrial injury (pericarditis): PR-segment depression along the P axis
      const d = [0.5, -0.62, 0.32], i0 = Math.round(a.tmax - a.t0) - 10;
      for (let i = Math.max(0, i0); i < n; i++) { const g = -o.prDep * EP.smoothstep(i0, i0 + 25, i) * (1 - EP.smoothstep(n - 22, n - 2, i)); w[i * 3] += d[0] * g; w[i * 3 + 1] += d[1] * g; w[i * 3 + 2] += d[2] * g; }
    }
    return { n, pre: -a.t0, vcg: w, adds: null, dur: a.dur, act: a };
  };
  Mo.aspec = function (site, speed) { return { seeds: [{ site, t: 0 }], speed }; };

  // ---- measurements -----------------------------------------------------------------------------
  /* Frontal-plane axis (degrees) of the QRS from its area vector. */
  Mo.axis = function (act) {
    const Lv = EP.Leads.vec, a = act.area;
    const I = Lv[0][0] * a[0] + Lv[0][1] * a[1] + Lv[0][2] * a[2];
    const F = Lv[5][0] * a[0] + Lv[5][1] * a[1] + Lv[5][2] * a[2];
    return Math.atan2(F * 2 / Math.sqrt(3), I) * 180 / Math.PI;
  };
})(globalThis.EP = globalThis.EP || {});
