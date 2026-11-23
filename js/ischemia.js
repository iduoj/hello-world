/* EP Simulator — myocardial ischaemia and infarction.
 *
 * A coronary territory is a set of myocardial voxels. From it the model derives:
 *   injury current  → ST vector = sum of transmural (endo → epi) directions over the territory
 *                     (for the septum that points from the LV side to the RV side — the "precordial swirl")
 *   infarction      → those voxels stop contributing to the QRS dipole (Q waves, lost R waves)
 *   repolarisation  → T-wave vector along (hyperacute) or against (evolved / reperfused) the injury vector
 * so ST elevation, reciprocal change, Q waves and T-wave evolution all follow from where the artery is blocked.
 */
(function (EP) {
  'use strict';
  const G = EP.G, M = EP.Model, Mo = EP.Morph, V = EP.V, Lds = EP.Leads;
  const I = (EP.Isch = {});
  const S = {   // wall segments as spheres in heart-local coordinates [s, n, a, radius]
    septBase: [2.5, -0.8, 1.6, 2.2], septMid: [2.4, -0.7, 3.6, 2.2], septApical: [1.8, -0.5, 5.6, 2.0],
    antBase: [0.9, -2.5, 1.5, 2.2], antMid: [0.8, -2.4, 3.6, 2.2], antApical: [0.5, -1.8, 5.6, 2.0],
    alBase: [-1.3, -2.3, 1.6, 2.1], alMid: [-1.5, -2.1, 3.5, 2.0], apex: [0.2, 0.0, 7.6, 2.2],
    latBase: [-2.6, 0.0, 1.5, 2.2], latMid: [-2.6, 0.2, 3.6, 2.2], latApical: [-1.9, 0.2, 5.6, 1.9],
    ilBase: [-1.6, 2.1, 1.3, 2.1], ilMid: [-1.7, 2.0, 3.3, 2.0], postBase: [-0.4, 2.7, 1.4, 1.9],
    infBase: [0.0, 2.65, 1.5, 2.2], infMid: [0.0, 2.55, 3.6, 2.2], infApical: [0.3, 1.9, 5.6, 1.9],
    infSeptBase: [2.2, 1.5, 2.0, 1.5], infSeptMid: [2.1, 1.4, 4.0, 1.5],
    rv1: [5.6, 0.6, 2.2, 2.6, 'rv'], rv2: [5.0, 2.4, 3.0, 2.4, 'rv'], rv3: [5.4, -1.2, 3.6, 2.4, 'rv'],
  };
  const T = (keys) => keys.split(' ').map((k) => S[k]);
  I.SEG = S;   // the wall segments, so that other modules can compose a territory (I.TERR[name] = { segs: [I.SEG.x, …] })
  I.TERR = {
    ladProx: { segs: T('septBase septMid septApical antBase antMid antApical alBase alMid apex') },
    ladMid: { segs: T('septApical antMid antApical alMid apex') },
    ladWrap: { segs: T('septApical antMid antApical apex infApical') },
    septal: { segs: T('septBase septMid antBase') },
    d1: { segs: T('alBase alMid') },
    lcx: { segs: T('latBase latMid latApical ilBase') },
    post: { segs: T('ilBase ilMid postBase') },
    rcaProx: { segs: T('infBase infMid infApical infSeptBase infSeptMid postBase rv1 rv2 rv3') },
    rcaDist: { segs: T('infBase infMid infApical infSeptBase infSeptMid') },
    lcxInf: { segs: T('infBase infMid ilBase ilMid latMid postBase') },
    infSmall: { segs: T('infMid infSeptMid') },
    global: { segs: [], sub: 1 },
  };
  const cache = {};
  I.KST = 0.018;   // mV per unit of injury vector
  /* → { w (voxel weights), vec (ST vector, mV, transmural injury), n } */
  I.terr = function (name) {
    if (cache[name]) return cache[name];
    Mo.init();
    const def = I.TERR[name], w = M.territory(def.segs), v = M.injury(def.segs.length ? w : new Float32Array(M.nv));
    const t = { name, w, id: name, vec: [v[0] * I.KST, v[1] * I.KST, v[2] * I.KST] };
    return (cache[name] = t);
  };
  let _sub = null;
  /* Diffuse subendocardial ischaemia: the vector points from the epicardium toward the cavity (ST depression
   * in most leads, elevation in aVR). */
  I.subVec = function () { if (!_sub) { Mo.init(); const v = M.injury(null); const l = Math.hypot(v[0], v[1], v[2]) || 1; _sub = [-v[0] / l * 0.36, -v[1] / l * 0.36, -v[2] / l * 0.36]; } return _sub; };

  const pw = (pts, x) => { for (let i = 0; i < pts.length - 1; i++) if (x <= pts[i + 1][0]) { const a = pts[i], b = pts[i + 1]; return a[1] + (b[1] - a[1]) * EP.clamp((x - a[0]) / (b[0] - a[0]), 0, 1); } return pts[pts.length - 1][1]; };
  const ST_T = [[0, 0.06], [0.1, 0.28], [0.28, 1], [0.45, 1], [0.7, 0.3], [1, 0.04]];
  const T_T = [[0, 0.9], [0.1, 1.5], [0.3, 0.75], [0.48, 0], [0.7, -0.85], [1, -0.3]];
  const Q_T = [[0, 0], [0.28, 0], [0.62, 0.9], [1, 0.92]];
  I.stageName = (t) => (t < 0.14 ? 'minutes — hyperacute T waves' : t < 0.5 ? 'hours — acute injury (ST elevation)' : t < 0.78 ? 'day 1–2 — Q waves, T inversion' : 'weeks — established infarct');
  /* Build the `vent` settings (mods + scar) for a territory at an evolution stage (0..1).
   * o: { terr, stage, amp (ST scale), sub (0..1 extra subendocardial ischaemia), st, t, q (overrides) } */
  I.vent = function (o) {
    const tr = o.terr ? I.terr(o.terr) : null, stage = o.stage == null ? 0.36 : o.stage, amp = o.amp == null ? 1 : o.amp;
    const kS = o.st != null ? o.st : pw(ST_T, stage), kT = o.t != null ? o.t : pw(T_T, stage), kQ = o.q != null ? o.q : pw(Q_T, stage);
    const vec = tr ? tr.vec.slice() : [0, 0, 0];
    const st = [vec[0] * kS * amp, vec[1] * kS * amp, vec[2] * kS * amp];
    if (o.sub) { const sv = I.subVec(); st[0] += sv[0] * o.sub; st[1] += sv[1] * o.sub; st[2] += sv[2] * o.sub; }
    const mods = { st, tAdd: [vec[0] * kT * amp * 135, vec[1] * kT * amp * 135, vec[2] * kT * amp * 135] };
    if (stage < 0.2 && o.t == null) mods.tShape = { p: 0.68, sl: 0.24, sr: 0.15 };
    const out = { mods };
    if (tr && kQ > 0.02) out.scar = { w: tr.w, k: kQ, id: tr.id };
    return out;
  };

  // ---- coronary tree (drawn on the epicardial surface) -------------------------------------------------
  function proj(p) {
    // push a point onto the epicardial surface (a little outside it)
    let q = p.slice();
    for (let it = 0; it < 5; it++) {
      const e = 0.06, d = G.sdMuscle(q[0], q[1], q[2]);
      let g = [G.sdMuscle(q[0] + e, q[1], q[2]) - G.sdMuscle(q[0] - e, q[1], q[2]), G.sdMuscle(q[0], q[1] + e, q[2]) - G.sdMuscle(q[0], q[1] - e, q[2]), G.sdMuscle(q[0], q[1], q[2] + e) - G.sdMuscle(q[0], q[1], q[2] - e)];
      g = V.norm(g); q = V.addS(q, g, -(d - 0.14));
    }
    return q;
  }
  const qf = (a) => (a < 0.9 ? Math.sqrt(Math.max(0.05, 1 - ((0.9 - a) / 2.2) ** 2)) : Math.sqrt(Math.max(0.03, 1 - ((a - 0.9) / 7.6) ** 2)));
  const lvPt = (deg, a, r) => { const q = qf(a) * (r || 3.2), th = (deg * Math.PI) / 180; return G.L(q * Math.cos(th), q * Math.sin(th), a); };
  const mr = (deg) => V.addS(G.ringPoint(G.ANNULI.mitral, (deg * Math.PI) / 180, 1.9), G.A, -0.3);
  const tr = (deg) => V.addS(G.ringPoint(G.ANNULI.tricuspid, (deg * Math.PI) / 180, 1.45), G.A, -0.2);
  let _cor = null;
  /* → { id: { name, pts (world), r, septal } } */
  I.coronaries = function () {
    if (_cor) return _cor;
    const P = (arr) => arr.map(proj), c = {};
    const lad = []; for (let a = 0.5; a <= 8.2; a += 0.55) lad.push(lvPt(-60, a)); lad.push(lvPt(20, 8.0), lvPt(60, 7.0));
    c.lm = { name: 'Left main', r: 0.2, pts: P([G.L(1.5, -2.1, -0.7), G.L(1.4, -2.6, -0.2), lvPt(-60, 0.5)]) };
    c.lad = { name: 'LAD', r: 0.17, pts: P(lad) };
    c.s1 = { name: 'First septal', r: 0.1, septal: true, pts: [proj(lvPt(-60, 1.5)), G.L(2.3, -1.6, 1.9), G.L(2.6, -0.6, 2.5)] };
    c.s2 = { name: 'Septal', r: 0.09, septal: true, pts: [proj(lvPt(-60, 3.2)), G.L(2.2, -1.5, 3.6), G.L(2.4, -0.6, 4.2)] };
    c.d1 = { name: 'First diagonal', r: 0.12, pts: P([lvPt(-60, 1.9), lvPt(-88, 2.7), lvPt(-112, 3.7), lvPt(-126, 4.9)]) };
    c.d2 = { name: 'Diagonal', r: 0.1, pts: P([lvPt(-60, 3.8), lvPt(-84, 4.6), lvPt(-102, 5.6)]) };
    c.lcx = { name: 'Circumflex', r: 0.16, pts: P([lvPt(-60, 0.5), mr(275), mr(240), mr(205), mr(170), mr(135), mr(105)]) };
    c.om = { name: 'Obtuse marginal', r: 0.12, pts: P([mr(200), lvPt(182, 1.6), lvPt(178, 3.2), lvPt(174, 4.8)]) };
    c.rca = { name: 'RCA', r: 0.17, pts: P([G.L(3.0, -2.3, -0.5), tr(300), tr(335), tr(10), tr(45), tr(80), tr(115), tr(150)]) };
    c.rvm = { name: 'RV marginal', r: 0.1, pts: P([tr(20), G.L(6.4, 0.9, 1.8), G.L(6.2, 1.1, 3.4), G.L(5.5, 1.3, 5.0)]) };
    c.pda = { name: 'PDA', r: 0.12, pts: P([tr(150), lvPt(60, 0.9), lvPt(60, 2.6), lvPt(60, 4.4), lvPt(60, 6.0)]) };
    c.pl = { name: 'Posterolateral', r: 0.11, pts: P([tr(150), mr(70), lvPt(112, 1.4), lvPt(118, 3.0)]) };
    return (_cor = c);
  };
  /* Which vessels lose flow for an occlusion at [artery, fraction]. */
  const DOWN = { lm: ['lad', 's1', 's2', 'd1', 'd2', 'lcx', 'om'], lad: ['s1', 's2', 'd1', 'd2'], lcx: ['om'], rca: ['rvm', 'pda', 'pl'] };
  const BRANCH_AT = { s1: 0.1, d1: 0.14, s2: 0.33, d2: 0.38, om: 0.45, rvm: 0.42, pda: 1, pl: 1 };
  /* Draw the coronary tree on a Heart3D. occl: [artery id, fraction 0..1] or null. Returns { remove() }. */
  I.addCoronaries = function (heart, occl) {
    const grp = heart.group('coronaries');
    while (grp.children.length) grp.remove(grp.children[0]);
    const cor = I.coronaries(), red = 0xd23c3c, dead = 0x4a4f63;
    const labels = [];
    for (const id in cor) {
      const a = cor[id], curve = new THREE.CatmullRomCurve3(a.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
      let cut = null;
      if (occl) { if (occl[0] === id) cut = occl[1]; else if ((DOWN[occl[0]] || []).includes(id) && (occl[0] === 'lm' || (BRANCH_AT[id] == null ? 0 : BRANCH_AT[id]) >= occl[1])) cut = 0; }
      const seg = (u0, u1, color) => { if (u1 - u0 < 0.01) return; const pts = []; for (let i = 0; i <= 30; i++) pts.push(curve.getPointAt(u0 + (u1 - u0) * (i / 30))); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, a.r, 7, false), new THREE.MeshStandardMaterial({ color, roughness: 0.45 })); grp.add(m); };
      if (cut == null) seg(0, 1, red); else { seg(0, cut, red); seg(cut, 1, dead); }
      if (occl && occl[0] === id) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(a.r * 2.3, 14, 10), new THREE.MeshBasicMaterial({ color: 0x111418 })); m.position.copy(curve.getPointAt(EP.clamp(occl[1], 0.01, 0.99))); grp.add(m);
        const p = m.position; labels.push(heart.addLabel('Occlusion', [p.x, p.y + 0.8, p.z], 'note'));
      }
    }
    for (const [id, u] of [['lad', 0.55], ['lcx', 0.6], ['rca', 0.45]]) { const a = cor[id]; const p = a.pts[Math.floor(a.pts.length * u)]; labels.push(heart.addLabel(a.name, p, 'ves')); }
    heart.invalidate();
    return { remove() { while (grp.children.length) grp.remove(grp.children[0]); for (const l of labels) l.remove(); heart.invalidate(); } };
  };

  /* ST level, R and S amplitude for every lead of one beat. → [{ st, r, s, pos (dominant positive) }] in mV */
  I.measure = function (rec, ev) {
    const out = [], w = ev.wave, a = w.act;
    const tJ = ev.t + a.off + 22, t0 = ev.t + a.on - 2, t1 = ev.t + a.off + 2;
    const idx = (t) => EP.clamp(Math.round((t - rec.t0) / rec.dt), 0, rec.n - 1);
    for (let l = 0; l < rec.leads.length; l++) {
      const d = rec.leads[l];
      let mx = 0, mn = 0;
      for (let i = idx(t0); i <= idx(t1); i++) { if (d[i] > mx) mx = d[i]; if (d[i] < mn) mn = d[i]; }
      let st = 0, c = 0; for (let i = idx(tJ) - 2; i <= idx(tJ) + 2; i++) { st += d[i]; c++; }
      out.push({ st: st / c, r: mx, s: -mn, pos: mx >= -mn });
    }
    return out;
  };
  /* Original and Smith-modified Sgarbossa criteria for LBBB / ventricular paced rhythm. m from measure(). */
  I.sgarbossa = function (m) {
    const res = { concSTE: [], concSTD: [], disc5: [], ratio: [], rows: [] };
    for (let l = 0; l < 12; l++) {
      const x = m[l], mm = x.st * 10, name = Lds.names[l];
      const dom = x.pos ? x.r : x.s, ratio = dom > 0.05 ? x.st / (x.pos ? x.r : -x.s) : 0;   // negative when discordant
      const conc = (x.pos && mm >= 1) || (!x.pos && mm <= -1);
      if (x.pos && mm >= 1) res.concSTE.push(name);
      if (!x.pos && mm <= -1 && l >= 6 && l <= 8) res.concSTD.push(name);
      if (!x.pos && mm >= 5) res.disc5.push(name);
      const r2 = !x.pos ? x.st / x.s : -x.st / x.r;     // discordant ST relative to the preceding S (or R)
      if (!x.pos && mm >= 1 && r2 >= 0.25) res.ratio.push(name);
      res.rows.push({ name, pos: x.pos, st: mm, dom: dom * 10, ratio: dom > 0.05 ? x.st / (x.pos ? x.r : -x.s) : 0, conc });
      void ratio;
    }
    res.original = (res.concSTE.length ? 5 : 0) + (res.concSTD.length ? 3 : 0) + (res.disc5.length ? 2 : 0);
    res.modified = res.concSTE.length > 0 || res.concSTD.length > 0 || res.ratio.length > 0;
    return res;
  };
})(globalThis.EP = globalThis.EP || {});
