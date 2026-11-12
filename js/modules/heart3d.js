/* Heart3D — shared Three.js engine: stylized heart, coronary tree, virtual C-arm.

   World frame (right-handed, centimetres): +X = patient's left, +Y = head (cranial), +Z = anterior.
   C-arm angles: theta > 0 = LAO (detector toward the patient's left), theta < 0 = RAO;
                 phi > 0 = cranial (detector tilted toward the head), phi < 0 = caudal.
   The image is displayed as the detector sees it, so in AP the patient's left is on screen right.

   Heart frame: L = long axis base->apex (points left, anterior, inferior),
                N = septal normal (RV -> LV, left-posterior), A = L x N (toward the anterior IV groove).
   Surface points are addressed as (u, psi): u = 0 at the AV groove, 1 at the apex; psi = angle around L,
   0 = anterior IV groove, +90 = obtuse margin (LV lateral), 180 = posterior IV groove / crux, -90 = RV free wall. */
(function () {
  'use strict';
  const CL = window.CL;
  const T = window.THREE;
  const DEG = Math.PI / 180;
  const V = (x, y, z) => new T.Vector3(x, y, z);

  /* ---------- heart frame ---------- */
  const L = V(0.64, -0.44, 0.62).normalize();
  // P = "anterior" perpendicular to the long axis; LAT = lateral (toward the obtuse margin)
  const P = V(0, 0, 1).sub(L.clone().multiplyScalar(L.z)).normalize();
  const LAT = new T.Vector3().crossVectors(P, L).normalize();
  // The septum is not a diameter: the anterior IV groove faces anterior-superior, the posterior groove faces the diaphragm.
  // psi (model angle) -> gamma (physical angle from P toward LAT): LV free wall spans 240 deg, RV side 120 deg.
  const GA = 20;
  function gammaOf(psiDeg) {
    let p = ((psiDeg + 180) % 360 + 360) % 360 - 180;
    return (GA + (p >= 0 ? p * (240 / 180) : p * (120 / 180))) * DEG;
  }
  function dirDeg(psiDeg) { const g = gammaOf(psiDeg); return P.clone().multiplyScalar(Math.cos(g)).add(LAT.clone().multiplyScalar(Math.sin(g))); }
  const A = dirDeg(0);    // anterior IV groove
  const N = dirDeg(90);   // obtuse margin (LV lateral)
  const PG = dirDeg(180); // posterior IV groove / crux
  const LH = 9.4;     // base-to-apex length (cm)
  const R0 = 3.05;    // LV radius at base
  const RVX = 1.55;   // RV bulge
  const CENTER = V(2.6, -0.5, 0.5);
  const B = CENTER.clone().sub(L.clone().multiplyScalar(LH * 0.45));

  function prof(u) {
    if (u <= 0) return 1;
    if (u >= 1) return 0;
    return Math.pow(1 - Math.pow(u, 2.2), 0.5) * (0.9 + 0.1 * Math.sin(Math.min(u / 0.3, 1) * Math.PI / 2));
  }
  function rvProf(u) {
    const x = u / 0.84;
    if (x >= 1) return 0;
    return (1 - x * x) * (0.82 + 0.18 * Math.min(Math.max(u, 0) / 0.2, 1));
  }
  function surfR(u, psi) {
    const uc = Math.min(Math.max(u, 0), 1);
    let r = R0 * prof(uc);
    const s = -Math.sin(psi);
    if (s > 0) r += RVX * Math.pow(s, 0.85) * rvProf(uc);
    const g = Math.exp(-Math.pow(Math.sin(psi) / 0.16, 2));
    r -= 0.14 * g * (1 - uc * 0.6);
    return Math.max(r, 0);
  }
  function dirAt(psi) { return dirDeg(psi / DEG); }
  // point on/above epicardium; u may be slightly < 0 (AV groove, toward atria)
  function S(u, psiDeg, h) {
    const hh = h == null ? 0.17 : h;
    const r = surfR(u, psiDeg * DEG) + hh;
    return B.clone().add(L.clone().multiplyScalar(u * LH)).add(dirDeg(psiDeg).multiplyScalar(r));
  }
  // point inside the septum: d cm in from the anterior (side +1) or posterior (side -1) groove, along the septal chord
  function Q(u, d, side) {
    const c = B.clone().add(L.clone().multiplyScalar(u * LH));
    const ga = c.clone().add(A.clone().multiplyScalar(surfR(u, 0)));
    const gp = c.clone().add(PG.clone().multiplyScalar(surfR(u, Math.PI)));
    const from = (side || 1) > 0 ? ga : gp, to = (side || 1) > 0 ? gp : ga;
    return from.add(to.sub(from).normalize().multiplyScalar(d));
  }
  const APEX = B.clone().add(L.clone().multiplyScalar(LH + 0.2));

  /* deterministic value noise (surface texture, fat distribution) */
  function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let xf = x - xi, yf = y - yi, zf = z - zi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf), yf),
      l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  }
  function fbm(x, y, z) { return 0.55 * vnoise(x, y, z) + 0.3 * vnoise(x * 2.1 + 3.1, y * 2.1, z * 2.1) + 0.15 * vnoise(x * 4.3, y * 4.3 + 1.7, z * 4.3); }

  // radial "outward" direction from the long axis, and projection of a world point back onto the epicardium
  function outward(p) {
    const rel = p.clone().sub(B);
    const rad = rel.sub(L.clone().multiplyScalar(rel.dot(L)));
    return rad.lengthSq() < 1e-6 ? L.clone() : rad.normalize();
  }
  function toSurface(p, h) {
    const rel = p.clone().sub(B);
    const u = rel.dot(L) / LH;
    const rad = rel.sub(L.clone().multiplyScalar(u * LH));
    let g = Math.atan2(rad.dot(LAT), rad.dot(P)) / DEG - GA;
    g = ((g + 120) % 360 + 360) % 360 - 120;          // (-120, 240]
    const psi = g >= 0 ? g * 180 / 240 : g * 180 / 120;
    return S(Math.min(0.985, Math.max(-0.03, u)), psi, h);
  }

  /* ---------- great vessels (world points) ---------- */
  const AO0 = B.clone().add(L.clone().multiplyScalar(-0.6)).add(P.clone().multiplyScalar(0.9)).add(LAT.clone().multiplyScalar(0.35));
  const aoPts = [
    AO0.clone(),
    AO0.clone().add(V(-0.55, 2.0, 0.45)),
    AO0.clone().add(V(-0.95, 4.6, 0.35)),
    AO0.clone().add(V(-0.6, 6.6, -0.6)),
    AO0.clone().add(V(0.6, 7.6, -2.4)),
    AO0.clone().add(V(1.7, 7.0, -4.4)),
    AO0.clone().add(V(2.2, 4.6, -5.2)),
    AO0.clone().add(V(2.2, 0.0, -5.3)),
    AO0.clone().add(V(2.0, -9.0, -5.0)),
    AO0.clone().add(V(1.8, -20.0, -4.8)),
  ];
  const aoCurve = new T.CatmullRomCurve3(aoPts, false, 'centripetal');
  const AO_AXIS = aoPts[1].clone().sub(aoPts[0]).normalize();
  function aoPerp(v) { return v.clone().sub(AO_AXIS.clone().multiplyScalar(v.dot(AO_AXIS))).normalize(); }
  const AO_ANT = aoPerp(V(0, 0, 1));
  const AO_LEFT = aoPerp(V(1, 0, 0));
  const ROOT_R = 1.5;
  const OST_LEVEL = AO0.clone().add(AO_AXIS.clone().multiplyScalar(0.75));
  const RCA_DIR = AO_ANT.clone().multiplyScalar(0.92).add(AO_LEFT.clone().multiplyScalar(-0.38)).normalize();
  const LCA_DIR = AO_LEFT.clone().multiplyScalar(0.8).add(AO_ANT.clone().multiplyScalar(-0.6)).normalize();
  const RCA_OST = OST_LEVEL.clone().add(RCA_DIR.clone().multiplyScalar(ROOT_R * 0.97));
  const LCA_OST = OST_LEVEL.clone().add(LCA_DIR.clone().multiplyScalar(ROOT_R * 0.97));

  const PV = S(-0.32, -12, 0.9);  // pulmonary valve, top of RVOT
  const paPts = [S(0.05, -35, -0.6), S(-0.12, -22, 0.2), PV, PV.clone().add(V(0.45, 1.7, -1.0)), PV.clone().add(V(0.55, 3.0, -2.6)), PV.clone().add(V(2.2, 3.4, -3.6))];
  const RA_C = B.clone().add(L.clone().multiplyScalar(-1.1)).add(V(-2.5, -0.1, 0.4));
  const LA_C = B.clone().add(L.clone().multiplyScalar(-1.6)).add(V(0.4, 0.5, -1.4));
  const SA_NODE = RA_C.clone().add(V(-0.1, 2.2, -0.6));

  /* ---------- coronary tree definitions ---------- */
  // each vessel: id, parent (null = from ostium), pts (control points; for branches the first point is snapped to the parent),
  // r0/r1 radius (cm), segs (computed), tree 'L'|'R', name
  function treeDef(dom, ramus) {
    const v = [];
    const add = (o) => { v.push(o); return o; };
    // ---------- LEFT ----------
    const lmOut = LCA_OST.clone().add(LCA_DIR.clone().multiplyScalar(0.45));
    const BIF = S(-0.02, 50, 0.06);
    add({ id: 'LM', tree: 'L', parent: null, pts: [LCA_OST, lmOut, BIF], r0: 0.23, r1: 0.215, segs: [['lm', 0, 1]] });
    add({ id: 'LAD', tree: 'L', parent: 'LM', at: 1, pts: [BIF, S(0.0, 33, 0.14), S(0.04, 15), S(0.1, 4), S(0.18, 1), S(0.3, 0), S(0.46, 0), S(0.62, 0), S(0.77, 0), S(0.9, 0), S(0.97, 6), APEX, S(0.95, 176), S(0.87, 180)],
      r0: 0.19, r1: 0.05, segs: 'LAD', apexIndex: 11 });
    add({ id: 'S1', tree: 'L', parent: 'LAD', pts: [S(0.13, 0), Q(0.19, 0.9), Q(0.27, 1.8), Q(0.35, 2.6), Q(0.41, 3.2)], r0: 0.075, r1: 0.025, segs: [['sept', 0, 1]] });
    add({ id: 'S2', tree: 'L', parent: 'LAD', pts: [S(0.33, 0), Q(0.4, 0.9), Q(0.49, 1.7), Q(0.56, 2.2)], r0: 0.06, r1: 0.022, segs: [['sept', 0, 1]] });
    add({ id: 'S3', tree: 'L', parent: 'LAD', pts: [S(0.52, 0), Q(0.59, 0.8), Q(0.67, 1.4)], r0: 0.045, r1: 0.02, segs: [['sept', 0, 1]] });
    add({ id: 'D1', tree: 'L', parent: 'LAD', pts: [S(0.155, 0), S(0.22, 13), S(0.36, 33), S(0.52, 47), S(0.68, 55), S(0.8, 58)], r0: 0.125, r1: 0.045, segs: [['d1', 0, 1]] });
    add({ id: 'D2', tree: 'L', parent: 'LAD', pts: [S(0.44, 0), S(0.52, 15), S(0.65, 30), S(0.79, 40), S(0.88, 44)], r0: 0.1, r1: 0.04, segs: [['d2', 0, 1]] });
    const lcxPts = [BIF, S(0.0, 64, 0.1), S(0.012, 78, 0.1), S(0.02, 90, 0.1), S(0.03, 102, 0.1), S(0.035, 122, 0.1), S(0.035, 138, 0.1)];
    if (dom === 'left') lcxPts.push(S(0.03, 156, 0.1), S(0.015, 172, 0.1), S(0.0, 180, 0.1));
    if (dom === 'co') lcxPts.push(S(0.03, 152, 0.1), S(0.025, 164, 0.1));
    add({ id: 'LCx', tree: 'L', parent: 'LM', at: 1, pts: lcxPts, r0: 0.17, r1: dom === 'left' ? 0.13 : dom === 'co' ? 0.095 : 0.085, segs: 'LCx' });
    add({ id: 'OM1', tree: 'L', parent: 'LCx', pts: [S(0.01, 74, 0.1), S(0.1, 76), S(0.27, 78), S(0.46, 79), S(0.64, 80), S(0.76, 80)], r0: 0.13, r1: 0.045, segs: [['om1', 0, 1]] });
    add({ id: 'OM2', tree: 'L', parent: 'LCx', pts: [S(0.03, 104, 0.1), S(0.13, 106), S(0.32, 108), S(0.52, 110), S(0.67, 111)], r0: 0.115, r1: 0.045, segs: [['om2', 0, 1]] });
    if (dom !== 'left') add({ id: 'OM3', tree: 'L', parent: 'LCx', pts: [S(0.035, 126, 0.1), S(0.16, 128), S(0.32, 130), S(0.46, 131)], r0: 0.08, r1: 0.035, segs: [['lpl', 0, 1]] });
    if (ramus) add({ id: 'Ramus', tree: 'L', parent: 'LM', at: 1, pts: [BIF, S(0.06, 50), S(0.2, 54), S(0.38, 57), S(0.56, 59), S(0.68, 60)], r0: 0.13, r1: 0.045, segs: [['ramus', 0, 1]] });
    if (dom === 'left') {
      add({ id: 'LPDA', tree: 'L', parent: 'LCx', at: 1, pts: [S(0.0, 180, 0.1), S(0.1, 180), S(0.28, 180), S(0.47, 180), S(0.63, 180), S(0.73, 180)], r0: 0.1, r1: 0.04, segs: [['lpda', 0, 1]] });
      add({ id: 'LPL1', tree: 'L', parent: 'LCx', pts: [S(0.033, 150, 0.1), S(0.16, 150), S(0.33, 149), S(0.5, 147)], r0: 0.09, r1: 0.035, segs: [['lpl', 0, 1]] });
      add({ id: 'LPL2', tree: 'L', parent: 'LCx', pts: [S(0.02, 166, 0.1), S(0.15, 165), S(0.3, 163)], r0: 0.07, r1: 0.03, segs: [['lpl', 0, 1]] });
      add({ id: 'LS1', tree: 'L', parent: 'LPDA', pts: [S(0.2, 180), Q(0.26, 0.8, -1), Q(0.33, 1.5, -1)], r0: 0.04, r1: 0.02, segs: [['lpda', 0, 1]] });
      add({ id: 'AVNL', tree: 'L', parent: 'LCx', at: 1, pts: [S(0.0, 180, 0.1), S(-0.04, 182, 0.05), S(-0.08, 184, 0.0)], r0: 0.035, r1: 0.02, segs: [['avn', 0, 1]] });
    }
    if (dom === 'co') add({ id: 'LPL1', tree: 'L', parent: 'LCx', pts: [S(0.03, 150, 0.1), S(0.17, 150), S(0.34, 149), S(0.5, 147)], r0: 0.085, r1: 0.035, segs: [['lpl', 0, 1]] });

    // ---------- RIGHT ----------
    const rcaOut = RCA_OST.clone().add(RCA_DIR.clone().multiplyScalar(0.55));
    const rcaPts = [RCA_OST, rcaOut, S(-0.02, -52, 0.15), S(0.0, -72, 0.15), S(0.02, -93, 0.15), S(0.03, -113, 0.15), S(0.03, -132, 0.15)];
    const amIndex = 6;
    if (dom === 'right' || dom === 'co') rcaPts.push(S(0.025, -150, 0.15), S(0.012, -166, 0.15), S(0.0, -180, 0.13));
    else rcaPts.push(S(0.05, -140, 0.15), S(0.1, -146, 0.15));
    add({ id: 'RCA', tree: 'R', parent: null, pts: rcaPts, r0: 0.2, r1: dom === 'left' ? 0.075 : dom === 'co' ? 0.15 : 0.165, segs: dom === 'left' ? 'RCAsmall' : 'RCA', amIndex });
    add({ id: 'Conus', tree: 'R', parent: 'RCA', pts: [rcaOut.clone().add(RCA_DIR.clone().multiplyScalar(0.12)), S(-0.12, -36, 0.5), S(-0.15, -20, 0.6), S(-0.13, -6, 0.55)], r0: 0.06, r1: 0.025, segs: [['conus', 0, 1]] });
    add({ id: 'SAN', tree: 'R', parent: 'RCA', pts: [S(-0.02, -54, 0.15), S(-0.1, -64, 0.7), SA_NODE.clone().add(V(0.5, -0.4, 0.4)), SA_NODE], r0: 0.05, r1: 0.022, segs: [['sanode', 0, 1]] });
    add({ id: 'RV1', tree: 'R', parent: 'RCA', pts: [S(0.02, -92, 0.15), S(0.17, -86), S(0.36, -78), S(0.52, -70)], r0: 0.07, r1: 0.03, segs: [['rvb', 0, 1]] });
    add({ id: 'AM', tree: 'R', parent: 'RCA', pts: [S(0.03, -131, 0.15), S(0.18, -127), S(0.4, -120), S(0.6, -112), S(0.72, -108)], r0: 0.08, r1: 0.032, segs: [['rvb', 0, 1]] });
    if (dom === 'right' || dom === 'co') {
      add({ id: 'PDA', tree: 'R', parent: 'RCA', at: 1, pts: [S(0.0, -180, 0.13), S(0.08, -180), S(0.25, -180), S(0.44, -180), S(0.6, -180), S(0.7, -180)], r0: dom === 'co' ? 0.085 : 0.1, r1: 0.04, segs: [['pda', 0, 1]] });
      add({ id: 'IS1', tree: 'R', parent: 'PDA', pts: [S(0.17, -180), Q(0.23, 0.8, -1), Q(0.31, 1.5, -1)], r0: 0.04, r1: 0.02, segs: [['pda', 0, 1]] });
      add({ id: 'IS2', tree: 'R', parent: 'PDA', pts: [S(0.37, -180), Q(0.43, 0.7, -1), Q(0.5, 1.3, -1)], r0: 0.035, r1: 0.018, segs: [['pda', 0, 1]] });
      add({ id: 'AVN', tree: 'R', parent: 'RCA', at: 1, pts: [S(0.0, -180, 0.13), S(-0.04, -182, 0.05), S(-0.085, -184, 0.0)], r0: 0.035, r1: 0.02, segs: [['avn', 0, 1]] });
    }
    if (dom === 'right') {
      add({ id: 'RPL', tree: 'R', parent: 'RCA', at: 1, pts: [S(0.0, -180, 0.13), S(0.005, -192, 0.12), S(0.012, -204, 0.12), S(0.02, -214, 0.12), S(0.03, -222, 0.12)], r0: 0.12, r1: 0.06, segs: [['rpl', 0, 1]] });
      add({ id: 'PL1', tree: 'R', parent: 'RPL', pts: [S(0.01, -200, 0.12), S(0.13, -201), S(0.3, -203), S(0.46, -205)], r0: 0.08, r1: 0.032, segs: [['rpl', 0, 1]] });
      add({ id: 'PL2', tree: 'R', parent: 'RPL', pts: [S(0.025, -216, 0.12), S(0.15, -217), S(0.31, -219), S(0.44, -220)], r0: 0.07, r1: 0.03, segs: [['rpl', 0, 1]] });
    }
    return v;
  }

  /* ---------- build: curves, arc lengths, segments ---------- */
  function nearestT(curve, p, n) {
    let best = 0, bd = Infinity;
    const m = n || 200;
    for (let i = 0; i <= m; i++) {
      const t = i / m;
      const d = curve.getPointAt(t).distanceToSquared(p);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // mild tortuosity: real epicardial arteries are never ruler-straight
  function wiggleCurve(d) {
    const big = d.r0 > 0.15;
    const amp = d.wig != null ? d.wig : /^(LM|AVN|AVNL)$/.test(d.id) ? 0 : /^(S\d|IS\d|LS\d)$/.test(d.id) ? 0.035 : big ? 0.06 : 0.12;
    if (!amp || d.len < 1.2) return;
    let seed = 7; for (let i = 0; i < d.id.length; i++) seed = (seed * 31 + d.id.charCodeAt(i)) >>> 0;
    const rnd = CL.rng(seed);
    const ph1 = rnd() * 6.283, ph2 = rnd() * 6.283, lam1 = 1.7 + rnd() * 1.3, lam2 = 0.75 + rnd() * 0.5;
    const n = Math.max(10, Math.round(d.len * 3.2));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = d.curve.getPointAt(t), tan = d.curve.getTangentAt(t);
      const side = new T.Vector3().crossVectors(tan, outward(p)).normalize();
      const sLen = t * d.len;
      const env = CL.smooth(0, 0.9, sLen) * CL.smooth(0, 0.5, d.len - sLen);
      const a = amp * (0.45 + 0.9 * t) * env * (Math.sin(6.283 * sLen / lam1 + ph1) + 0.5 * Math.sin(6.283 * sLen / lam2 + ph2));
      pts.push(p.add(side.multiplyScalar(a)));
    }
    d.curve = new T.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    d.len = d.curve.getLength();
  }
  // small unnamed side branches (side 0 = automatically toward the apex): [fraction along parent, side, length cm]
  const TWIGS = {
    LAD: [[0.3, -1, 2.0], [0.5, -1, 1.7], [0.6, 1, 1.9], [0.72, -1, 1.4], [0.79, 1, 1.5]],
    D1: [[0.34, 1, 2.1], [0.55, -1, 1.9], [0.75, 1, 1.5], [0.93, -1, 1.1]], D2: [[0.4, -1, 1.7], [0.68, 1, 1.4], [0.93, -1, 1.0]],
    LCx: [[0.5, 0, 1.5]],
    OM1: [[0.3, 1, 2.1], [0.5, -1, 2.1], [0.72, 1, 1.6], [0.93, -1, 1.1]], OM2: [[0.35, -1, 1.9], [0.6, 1, 1.7], [0.92, -1, 1.0]], OM3: [[0.5, 1, 1.3], [0.9, -1, 0.9]],
    Ramus: [[0.35, 1, 1.9], [0.6, -1, 1.7], [0.92, 1, 1.0]],
    RCA: [[0.3, 0, 1.8], [0.47, 0, 1.6], [0.84, 0, 1.4]],
    RV1: [[0.5, 1, 1.4], [0.9, -1, 0.9]], AM: [[0.35, 1, 1.7], [0.6, -1, 1.5], [0.92, 1, 1.0]],
    PDA: [[0.3, 1, 1.5], [0.55, -1, 1.4], [0.76, 1, 1.1], [0.94, -1, 0.8]],
    RPL: [[0.75, 0, 1.5]], PL1: [[0.4, 1, 1.4], [0.7, -1, 1.2], [0.93, 1, 0.8]], PL2: [[0.45, -1, 1.2], [0.9, 1, 0.8]],
    LPDA: [[0.3, 1, 1.5], [0.55, -1, 1.4], [0.8, 1, 1.0]], LPL1: [[0.45, 1, 1.3], [0.9, -1, 0.8]], LPL2: [[0.6, -1, 1.0]],
  };
  function makeTwigs(defs, byId) {
    const out = [];
    Object.keys(TWIGS).forEach((pid) => {
      const par = byId[pid];
      if (!par) return;
      TWIGS[pid].forEach((spec, k) => {
        const t = spec[0], len = spec[2];
        let seed = 11 + k * 97; for (let i = 0; i < pid.length; i++) seed = (seed * 33 + pid.charCodeAt(i)) >>> 0;
        const rnd = CL.rng(seed);
        const p0 = par.curve.getPointAt(t), tan = par.curve.getTangentAt(t);
        const side = new T.Vector3().crossVectors(tan, outward(p0)).normalize();
        const sign = spec[1] !== 0 ? spec[1] : (side.dot(L) >= 0 ? 1 : -1);
        let dir = tan.clone().multiplyScalar(spec[1] === 0 ? 0.25 : 0.62).add(side.clone().multiplyScalar(0.78 * sign)).normalize();
        const pts = [p0.clone()];
        let p = p0.clone();
        const step = 0.32, n = Math.max(3, Math.round(len / step));
        for (let i = 1; i <= n; i++) {
          const sd = new T.Vector3().crossVectors(dir, outward(p)).normalize();
          dir.add(L.clone().multiplyScalar(0.09)).add(sd.multiplyScalar((rnd() - 0.5) * 0.42)).normalize();
          p = toSurface(p.clone().add(dir.clone().multiplyScalar(step)), 0.13);
          pts.push(p);
        }
        const rPar = par.r0 + (par.r1 - par.r0) * Math.pow(t, 0.9);
        const segId = (par.segs.find((x) => t <= x[2] + 1e-6) || par.segs[par.segs.length - 1])[0];
        const d = { id: pid + '~' + k, tree: par.tree, parent: pid, at: t, pts, r0: Math.min(0.05, Math.max(0.022, rPar * 0.5)), r1: 0.012, segs: [[segId, 0, 1]], twig: true, root: par.root, wig: 0 };
        d.arcStart = par.arcStart + par.len * t;
        d.curve = new T.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
        d.len = d.curve.getLength();
        out.push(d);
      });
    });
    return out;
  }

  function buildTree(dom, ramus) {
    const defs = treeDef(dom, ramus);
    const byId = {};
    defs.forEach((d) => { byId[d.id] = d; });
    defs.forEach((d) => {
      if (d.parent) {
        const p = byId[d.parent];
        const t = d.at != null ? d.at : nearestT(p.curve, d.pts[0]);
        d.at = t;
        d.pts = d.pts.slice();
        d.pts[0] = p.curve.getPointAt(t);
        d.arcStart = p.arcStart + p.len * t;
        d.root = p.root;
      } else {
        d.arcStart = 0;
        d.root = d.id === 'LM' ? 'LCA' : 'RCA';
      }
      d.curve = new T.CatmullRomCurve3(d.pts, false, 'centripetal', 0.5);
      d.len = d.curve.getLength();
      wiggleCurve(d);
    });
    // segment boundaries that depend on branch positions
    defs.forEach((d) => {
      if (d.segs === 'LAD') {
        const s1 = byId.S1.at;
        const tApex = nearestT(d.curve, APEX);
        const midEnd = s1 + 0.5 * (tApex - s1);
        d.segs = [['lad-p', 0, s1 + 0.004], ['lad-m', s1 + 0.004, midEnd], ['lad-d', midEnd, 1]];
      } else if (d.segs === 'LCx') {
        const om1 = byId.OM1.at;
        d.segs = [['lcx-p', 0, om1 + 0.01], ['lcx-d', om1 + 0.01, 1]];
      } else if (d.segs === 'RCA') {
        const tAM = nearestT(d.curve, d.pts[d.amIndex]);
        d.segs = [['rca-p', 0, tAM / 2], ['rca-m', tAM / 2, tAM], ['rca-d', tAM, 1]];
      } else if (d.segs === 'RCAsmall') {
        const tAM = nearestT(d.curve, d.pts[d.amIndex]);
        d.segs = [['rca-p', 0, tAM / 2], ['rca-m', tAM / 2, tAM], ['rca-d', tAM, 1]];
      }
    });
    makeTwigs(defs, byId).forEach((d) => { defs.push(d); byId[d.id] = d; });
    // descendant map for lesion propagation
    defs.forEach((d) => { d.children = defs.filter((c) => c.parent === d.id); });
    return { list: defs, byId };
  }

  /* ---------- geometry ---------- */
  function tubeGeometry(curve, opts) {
    const n = opts.n || Math.max(24, Math.round(curve.getLength() * 9));
    const ring = opts.ring || 14;
    const frames = curve.computeFrenetFrames(n, false);
    const pos = [], nor = [], aRad = [], aArc = [], aSeg = [], aT = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const c = curve.getPointAt(t);
      const r = opts.radius(t);
      const segIndex = opts.seg ? opts.seg(t) : 0;
      const Nn = frames.normals[i], Bn = frames.binormals[i];
      for (let j = 0; j <= ring; j++) {
        const a = (j / ring) * Math.PI * 2;
        const cx = Math.cos(a), sx = Math.sin(a);
        const nx = cx * Nn.x + sx * Bn.x, ny = cx * Nn.y + sx * Bn.y, nz = cx * Nn.z + sx * Bn.z;
        pos.push(c.x + r * nx, c.y + r * ny, c.z + r * nz);
        nor.push(nx, ny, nz);
        aRad.push(r);
        aArc.push((opts.arcStart || 0) + t * curve.getLength());
        aSeg.push(segIndex);
        aT.push(t);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < ring; j++) {
        const a = i * (ring + 1) + j, b = (i + 1) * (ring + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('aRad', new T.Float32BufferAttribute(aRad, 1));
    g.setAttribute('aArc', new T.Float32BufferAttribute(aArc, 1));
    g.setAttribute('aSeg', new T.Float32BufferAttribute(aSeg, 1));
    g.setAttribute('aT', new T.Float32BufferAttribute(aT, 1));
    g.setAttribute('aArr', new T.Float32BufferAttribute(new Float32Array(aT.length).fill(1e6), 1));
    g.setAttribute('aClr', new T.Float32BufferAttribute(new Float32Array(aT.length).fill(1e6), 1));
    g.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(aT.length * 3).fill(1), 3));
    g.setIndex(idx);
    return g;
  }

  function heartGeometry() {
    const nu = 110, np = 160;
    const pos = [], idx = [], up = [];
    const u0 = -0.11;
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (1.0 - u0) * (i / nu);
      for (let j = 0; j <= np; j++) {
        const psi = (j / np) * Math.PI * 2;
        let r;
        if (u < 0) r = surfR(0, psi) * Math.sqrt(Math.max(0, 1 - Math.pow(u / u0, 2)));
        else r = surfR(u, psi);
        const dir = dirAt(psi);
        const p = B.clone().add(L.clone().multiplyScalar(u * LH)).add(dir.clone().multiplyScalar(r));
        // organic surface: low-amplitude relief so highlights break up like real tissue
        const nz = fbm(p.x * 0.85, p.y * 0.85, p.z * 0.85) - 0.5;
        p.add(dir.multiplyScalar(nz * 0.1 * (u < 0 ? 0.3 : 1)));
        pos.push(p.x, p.y, p.z);
        up.push(u, psi);
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < np; j++) {
      const a = i * (np + 1) + j, b = (i + 1) * (np + 1) + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(pos.length).fill(0.5), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // weld the normals along the psi = 0 / 2π seam
    const nrm = g.getAttribute('normal');
    for (let i = 0; i <= nu; i++) {
      const a = i * (np + 1), b = a + np;
      const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l);
    }
    g.userData.up = up;
    return g;
  }

  function blob(center, rx, ry, rz, orient) {
    const g = new T.SphereGeometry(1, 32, 22);
    g.scale(rx, ry, rz);
    if (orient) g.applyMatrix4(orient);
    g.translate(center.x, center.y, center.z);
    return g;
  }

  /* ---------- shaders ---------- */
  // cardiac + respiratory motion shared by every fluoro material:
  // the AV plane descends toward the apex, the walls move in, the heart twists slightly, and the whole heart rides the diaphragm
  const MOVE_GLSL = `
    uniform float uBeat; uniform float uMove; uniform float uResp; uniform float uRespW;
    uniform vec3 uHAxis; uniform vec3 uHBase; uniform float uHLen;
    vec3 heartMove(vec3 p) {
      vec3 rel = p - uHBase;
      float ul = dot(rel, uHAxis);
      float u = ul / uHLen;
      vec3 radial = rel - uHAxis * ul;
      float uc = clamp(u, 0.0, 1.0);
      float s = uBeat * uMove * smoothstep(-0.12, 0.04, u);
      float a = s * 0.11 * (uc - 0.3);
      vec3 rot = radial * cos(a) + cross(uHAxis, radial) * sin(a);
      vec3 q = uHBase + uHAxis * (ul + s * 1.1 * (1.0 - uc)) + rot * (1.0 - s * (0.07 + 0.07 * sin(uc * 3.1416)));
      q.y += uResp * uRespW;
      return q;
    }`;
  const fluoroVS = `
    attribute float aRad; attribute float aArr; attribute float aClr;
    ${MOVE_GLSL}
    varying float vRad; varying vec3 vN; varying vec3 vV; varying float vArr; varying float vClr;
    void main() {
      vec3 p = heartMove(position);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      vRad = aRad; vArr = aArr; vClr = aClr;
      gl_Position = projectionMatrix * mv;
    }`;
  const fluoroFS = `
    uniform float uTime; uniform float uK; uniform float uAlways; uniform float uBase;
    varying float vRad; varying vec3 vN; varying vec3 vV; varying float vArr; varying float vClr;
    void main() {
      float ndv = abs(dot(normalize(vN), normalize(vV)));
      float fill = smoothstep(vArr, vArr + 0.18, uTime);
      float clr = 1.0 - smoothstep(vClr, vClr + 0.6, uTime);
      float c = max(uAlways, fill * clr);
      float tau = uK * 2.0 * vRad * ndv * (uBase + (1.0 - uBase) * c);
      gl_FragColor = vec4(vec3(exp(-tau)), 1.0);
    }`;
  const hiVS = `
    attribute float aSeg;
    ${MOVE_GLSL}
    varying float vSeg; varying vec3 vN; varying vec3 vV;
    void main() {
      vec3 p = heartMove(position);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      vSeg = aSeg;
      gl_Position = projectionMatrix * mv;
    }`;
  const hiFS = `
    uniform float uSel; uniform vec3 uColor; uniform float uPulse;
    varying float vSeg; varying vec3 vN; varying vec3 vV;
    void main() {
      if (abs(vSeg - uSel) > 0.5) discard;
      float ndv = abs(dot(normalize(vN), normalize(vV)));
      gl_FragColor = vec4(uColor, (0.35 + 0.3 * ndv) * uPulse);
    }`;
  const softVS = `
    ${MOVE_GLSL}
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec3 p = heartMove(position);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const softFS = `
    uniform float uK; uniform float uThick; uniform float uIntensity;
    varying vec3 vN; varying vec3 vV;
    void main() {
      float ndv = abs(dot(normalize(vN), normalize(vV)));
      float tau = uK * uThick * pow(ndv, 0.8) * uIntensity;
      gl_FragColor = vec4(vec3(exp(-tau)), 1.0);
    }`;
  // bone: a dense cortical shell around lucent marrow, so edges are darker than the middle ("tram-track" ribs)
  const boneFS = `
    uniform float uShell; uniform float uMarrow; uniform float uThick;
    varying vec3 vN; varying vec3 vV;
    void main() {
      float ndv = abs(dot(normalize(vN), normalize(vV)));
      float tau = uShell * min(1.0 / max(ndv, 0.3), 3.2) + uMarrow * uThick * ndv;
      gl_FragColor = vec4(vec3(exp(-tau)), 1.0);
    }`;
  const bgVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  // lung field: bright, with faint low-frequency mottling that shifts as the C-arm moves
  const bgFS = `varying vec2 vUv; uniform vec2 uShift;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){
      vec2 p = vUv * vec2(3.2, 2.4) + uShift;
      float n = 0.55 * vn(p) + 0.3 * vn(p * 2.3 + 4.0) + 0.15 * vn(p * 5.1);
      float g = 0.80 + 0.09 * (n - 0.5);
      gl_FragColor = vec4(vec3(g), 1.0);
    }`;
  // detector model: blur (MTF), edge enhancement, quantum mottle, tone curve, vignette
  const postFS = `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; uniform float uPx;
    float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec3 tx(vec2 o){ return texture2D(tDiffuse, vUv + o).rgb; }
    void main(){
      vec2 px = vec2(uPx) / uRes;
      vec3 c = tx(vec2(0.0)) * 0.25;
      c += (tx(vec2(px.x, 0.0)) + tx(vec2(-px.x, 0.0)) + tx(vec2(0.0, px.y)) + tx(vec2(0.0, -px.y))) * 0.125;
      c += (tx(px) + tx(-px) + tx(vec2(px.x, -px.y)) + tx(vec2(-px.x, px.y))) * 0.0625;
      vec2 w = px * 4.5;
      vec3 wide = (tx(vec2(w.x, 0.0)) + tx(vec2(-w.x, 0.0)) + tx(vec2(0.0, w.y)) + tx(vec2(0.0, -w.y)) + tx(w * 0.7) + tx(-w * 0.7) + tx(vec2(w.x, -w.y) * 0.7) + tx(vec2(-w.x, w.y) * 0.7)) * 0.125;
      c += 0.3 * (c - wide);
      float t = floor(uTime * 15.0);
      vec2 np = gl_FragCoord.xy / uPx;
      float n = h(floor(np) + t * 17.13) + h(floor(np * 0.5) + t * 29.7) + h(floor(np * 0.25) + t * 7.9) - 1.5;
      float lum = dot(c, vec3(0.3333));
      c += n * (0.022 + 0.03 * sqrt(max(lum, 0.0)));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.45);
      vec2 d = vUv - 0.5;
      c *= 1.0 - 0.62 * dot(d, d);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;

  function multiplyBlend(mat) {
    mat.blending = T.CustomBlending;
    mat.blendEquation = T.AddEquation;
    mat.blendSrc = T.ZeroFactor;
    mat.blendDst = T.SrcColorFactor;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.transparent = true;
    return mat;
  }

  /* ---------- engine ---------- */
  function Engine() {
    this.mode = 'anatomy';
    this.theta = 30; this.phi = 18;            // current angles (deg)
    this.target = { theta: 30, phi: 18 };
    this.dist = 44;
    this.zoom = 1;
    this.dom = 'right';
    this.ramus = false;
    this.sel = null;
    this.opts = { labels: true, heartOpacity: 0.92, circleLoop: false, segColors: true, beat: true, roadmap: true, access: 'femoral', catheter: 'LCA', spine: true };
    this.lesion = null; // { seg, pos (0..1 in segment), sev (0..1), timi }
    this.inj = null;    // { root, t0 }
    this.listeners = { angles: [], select: [], inject: [] };
    this.visible = false;
    this._init();
  }

  Engine.prototype._init = function () {
    const r = (this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding;
    this.canvas = r.domElement;
    this.canvas.setAttribute('aria-label', '3D heart model');
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(22, 1, 1, 400);
    this.clock = new T.Clock();
    this.time = 0;

    // overlay container for labels and HUD (attached with canvas)
    this.wrap = CL.h('div', { class: 'stage-inner', style: { position: 'absolute', inset: '0' } });
    this.wrap.appendChild(this.canvas);
    this.overlay = CL.h('div', { class: 'stage-overlay' });
    this.wrap.appendChild(this.overlay);
    this.hud = {
      tl: CL.h('div', { class: 'hud tl' }),
      tr: CL.h('div', { class: 'hud tr' }),
      bl: CL.h('div', { class: 'hud bl' }),
      br: CL.h('div', { class: 'hud br' }),
    };
    Object.values(this.hud).forEach((x) => this.wrap.appendChild(x));

    // lights (anatomy mode)
    this.lights = new T.Group();
    const hemi = new T.HemisphereLight(0xfff1e6, 0x2a2024, 0.62);
    this.key = new T.DirectionalLight(0xfff6ee, 0.95);
    this.fill = new T.DirectionalLight(0xffe2d2, 0.28);
    const rim = new T.DirectionalLight(0x9fb8ff, 0.4);
    rim.position.set(-20, 10, -30);
    this.lights.add(hemi, this.key, this.fill, rim);
    this.scene.add(this.lights);

    // shared uniforms
    this.U = {
      uBeat: { value: 0 }, uResp: { value: 0 }, uTime: { value: 0 },
      uHAxis: { value: L.clone() }, uHBase: { value: B.clone() }, uHLen: { value: LH },
    };

    // background quad for fluoro
    const bg = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: { uShift: { value: new T.Vector2() } }, vertexShader: bgVS, fragmentShader: bgFS, depthTest: false, depthWrite: false }));
    bg.frustumCulled = false;
    bg.renderOrder = -100;
    this.bg = bg;
    this.scene.add(bg);

    // fluoro post-processing (detector model) and the anatomy-mode backdrop
    this.rt = new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat });
    this.rt.texture.encoding = T.sRGBEncoding;
    this.post = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, uRes: { value: new T.Vector2(4, 4) }, uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: bgVS, fragmentShader: postFS, depthTest: false, depthWrite: false,
    }));
    this.post.frustumCulled = false;
    this.postScene = new T.Scene();
    this.postScene.add(this.post);
    this.postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bc = document.createElement('canvas'); bc.width = bc.height = 256;
    const bx = bc.getContext('2d');
    const grd = bx.createRadialGradient(128, 118, 10, 128, 128, 190);
    grd.addColorStop(0, '#26333b'); grd.addColorStop(0.55, '#121a1f'); grd.addColorStop(1, '#05080a');
    bx.fillStyle = grd; bx.fillRect(0, 0, 256, 256);
    this.backdrop = new T.CanvasTexture(bc);

    this._buildStatic();
    this._buildTree();
    this._buildCatheter();
    this._bindInput();
    this.raycaster = new T.Raycaster();
    this.setMode('anatomy');

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(this.wrap);
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  };

  // per-material motion uniforms: move = follows the heartbeat, respW = how much it rides with breathing
  Engine.prototype._mv = function (move, respW) {
    const U = this.U;
    return { uBeat: U.uBeat, uMove: { value: move }, uResp: U.uResp, uRespW: { value: respW }, uHAxis: U.uHAxis, uHBase: U.uHBase, uHLen: U.uHLen };
  };
  Engine.prototype._softMat = function (k, thick, move, respW) {
    const m = new T.ShaderMaterial({
      uniforms: Object.assign({ uK: { value: k }, uThick: { value: thick }, uIntensity: { value: 1 } }, this._mv(move ? 1 : 0, respW == null ? (move ? 1 : 0) : respW)),
      vertexShader: softVS, fragmentShader: softFS, side: T.FrontSide,
    });
    return multiplyBlend(m);
  };
  Engine.prototype._boneMat = function (shell, marrow, thick, respW) {
    return multiplyBlend(new T.ShaderMaterial({
      uniforms: Object.assign({ uShell: { value: shell }, uMarrow: { value: marrow }, uThick: { value: thick } }, this._mv(0, respW || 0)),
      vertexShader: softVS, fragmentShader: boneFS, side: T.FrontSide,
    }));
  };

  Engine.prototype._buildStatic = function () {
    const sc = this.scene;
    this.anat = new T.Group();   // anatomy-only meshes
    this.fluoroOnly = new T.Group();
    sc.add(this.anat, this.fluoroOnly);
    const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
    const tissue = (hex, rough) => new T.MeshPhysicalMaterial({ color: lin(hex), roughness: rough || 0.6, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, transparent: true, opacity: 0.96 });
    const tube = (pts, r, mat, seg) => {
      const grp = new T.Group();
      grp.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'centripetal'), seg || 40, r, 20, false), mat));
      [pts[0], pts[pts.length - 1]].forEach((e) => { const cap = new T.SphereGeometry(r * 0.985, 20, 14); cap.translate(e.x, e.y, e.z); grp.add(new T.Mesh(cap, mat)); });
      return grp;
    };

    // ventricles: muscle and epicardial fat are painted per vertex in _colorHeart()
    const hg = heartGeometry();
    this.heartMat = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.38, transparent: true, opacity: this.opts.heartOpacity, side: T.FrontSide });
    this.heart = new T.Mesh(hg, this.heartMat);
    this.heart.renderOrder = 1;
    this.anat.add(this.heart);
    this.heartF = new T.Mesh(hg, this._softMat(0.014, 7.5, true));
    this.fluoroOnly.add(this.heartF);

    // atria, appendages, great vessels (anatomy)
    const atriaMat = tissue(0xa9655c, 0.7);
    const veinMat = tissue(0x6d7fae, 0.55);
    const cavaMat = tissue(0x5d70a6, 0.55);
    const aoMat = tissue(0xcf8a80, 0.5);
    const pvMat = tissue(0xc98078, 0.55);
    const orient = new T.Matrix4().lookAt(V(0, 0, 0), L, A);
    const lumpy = (g, amp) => { const pa = g.getAttribute('position'); for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const k = 1 + (fbm(x * 0.9, y * 0.9, z * 0.9) - 0.5) * amp; const c = g.userData.c; pa.setXYZ(i, c.x + (x - c.x) * k, c.y + (y - c.y) * k, c.z + (z - c.z) * k); } g.computeVertexNormals(); return g; };
    const organ = (c, rx, ry, rz, amp) => { const g = blob(c, rx, ry, rz, orient); g.userData.c = c; return lumpy(g, amp); };
    this.atria = [
      new T.Mesh(organ(RA_C, 2.1, 2.2, 2.3, 0.16), atriaMat),
      new T.Mesh(organ(LA_C, 2.3, 1.9, 2.2, 0.14), atriaMat),
      new T.Mesh(organ(S(-0.17, 52, 0.55), 1.0, 0.6, 1.6, 0.4), atriaMat), // LAA
      new T.Mesh(organ(S(-0.14, -60, 0.55), 1.0, 0.65, 1.5, 0.4), atriaMat), // RAA
    ];
    this.atria.forEach((m) => this.anat.add(m));
    this.anat.add(tube(aoPts.slice(0, 7), 1.25, aoMat, 110));
    this.anat.add(new T.Mesh(blob(AO0.clone().add(AO_AXIS.clone().multiplyScalar(0.55)), ROOT_R, ROOT_R, 1.05, new T.Matrix4().lookAt(V(0, 0, 0), AO_AXIS, AO_ANT)), aoMat));
    // arch branches
    const a3 = aoPts[3], a4 = aoPts[4], a34 = a3.clone().lerp(a4, 0.5).add(V(0, 0.5, 0));
    this.anat.add(tube([a3.clone().add(V(0, 0.6, 0)), a3.clone().add(V(-0.9, 3.0, 0.3)), a3.clone().add(V(-2.0, 5.6, 0.2))], 0.6, aoMat));
    this.anat.add(tube([a34, a34.clone().add(V(0.1, 2.8, 0.4)), a34.clone().add(V(0.3, 5.4, 0.5))], 0.4, aoMat));
    this.anat.add(tube([a4.clone().add(V(0, 0.4, 0)), a4.clone().add(V(0.9, 2.6, -0.3)), a4.clone().add(V(2.4, 4.6, -0.5))], 0.46, aoMat));
    // pulmonary trunk with both branches
    this.anat.add(tube(paPts, 1.15, veinMat, 60));
    this.anat.add(tube([paPts[4], paPts[4].clone().add(V(-1.8, 0.2, -0.9)), paPts[4].clone().add(V(-4.2, -0.2, -1.2))], 0.85, veinMat));
    // venae cavae
    this.anat.add(tube([RA_C.clone().add(V(0.1, 1.2, -0.4)), RA_C.clone().add(V(0.2, 4.0, -0.9)), RA_C.clone().add(V(0.2, 8.0, -1.2))], 0.85, cavaMat, 30));
    this.anat.add(tube([RA_C.clone().add(V(0.0, -1.4, -0.8)), RA_C.clone().add(V(0.3, -4.5, -1.8)), RA_C.clone().add(V(0.6, -9, -2.2))], 1.0, cavaMat, 30));
    // pulmonary veins
    [[1, 0.9], [1, -0.7], [-1, 0.8], [-1, -0.6]].forEach(([sx, sy]) => {
      this.anat.add(tube([LA_C.clone().add(V(sx * 1.3, sy, -0.9)), LA_C.clone().add(V(sx * 2.9, sy * 1.3, -1.3)), LA_C.clone().add(V(sx * 4.6, sy * 1.8, -1.2))], 0.45, pvMat, 20));
    });

    // fluoro: aorta faint, diaphragm/liver
    this.aoF = new T.Mesh(new T.TubeGeometry(aoCurve, 140, 1.25, 28, false), this._softMat(0.012, 2.5, false, 1));
    this.fluoroOnly.add(this.aoF);
    const diaG = new T.SphereGeometry(1, 64, 40);
    diaG.scale(17, 12.5, 13);
    diaG.translate(-0.5, -18.4, -4.0);
    this.dia = new T.Mesh(diaG, this._softMat(0.011, 26, false, 1.25));
    this.fluoroOnly.add(this.dia);

    // bones: vertebrae with pedicles and processes, ribs, sternum
    this.spine = new T.Group();
    const vbMat = this._boneMat(0.03, 0.02, 3.3), smallMat = this._boneMat(0.022, 0.03, 1.0), ribMat = this._boneMat(0.017, 0.016, 0.9, 0.3);
    const ribCurve = (side, y) => {
      const pts = [];
      for (let k = 0; k <= 14; k++) {
        const a = 0.12 + (k / 14) * 2.0;                  // 0 = posterior midline, π/2 = lateral; bony rib ends anterolaterally
        pts.push(V(side * 12.2 * Math.sin(a) * (0.86 + 0.14 * Math.sin(a)), y + 0.9 - 5.2 * Math.pow(a / Math.PI, 1.15), -0.8 - 9.6 * Math.cos(a)));
      }
      return new T.CatmullRomCurve3(pts);
    };
    for (let i = -6; i <= 6; i++) {
      const y = i * 2.95;
      // vertebral body with a waist (lathe profile), flattened front to back
      const prof = [[0.01, -1.12], [1.62, -1.12], [1.78, -0.98], [1.6, -0.55], [1.5, 0], [1.6, 0.55], [1.78, 0.98], [1.62, 1.12], [0.01, 1.12]].map((q) => new T.Vector2(q[0], q[1]));
      const vg = new T.LatheGeometry(prof, 28);
      vg.scale(1, 1, 0.82);
      vg.translate(0, y, -8.3);
      this.spine.add(new T.Mesh(vg, vbMat));
      const pg = new T.SphereGeometry(0.5, 14, 10);
      pg.scale(0.85, 1.25, 1.4);
      const tg = new T.CylinderGeometry(0.2, 0.26, 1.7, 10);
      tg.rotateZ(Math.PI / 2);
      [-1, 1].forEach((sd) => {
        const g2 = pg.clone(); g2.translate(sd * 1.25, y + 0.3, -10.1);
        this.spine.add(new T.Mesh(g2, smallMat));
        const g3 = tg.clone(); g3.translate(sd * 2.6, y + 0.35, -10.4);
        this.spine.add(new T.Mesh(g3, smallMat));
        if (Math.abs(i) <= 5) this.spine.add(new T.Mesh(tubeGeometry(ribCurve(sd, y), { n: 46, ring: 10, radius: (t) => 0.2 + 0.26 * CL.smooth(0, 0.08, t) * (1 - 0.75 * CL.smooth(0.8, 1, t)) }), ribMat));
      });
      const sp = new T.SphereGeometry(0.5, 12, 10);
      sp.scale(0.55, 1.9, 1.7);
      sp.translate(0, y - 0.6, -11.5);
      this.spine.add(new T.Mesh(sp, smallMat));
    }
    // ECG electrodes and lead wires on the chest wall: in nearly every real cine run
    const wireMat = multiplyBlend(new T.ShaderMaterial({ uniforms: Object.assign({ uTime: this.U.uTime, uK: { value: 7.5 }, uAlways: { value: 1 }, uBase: { value: 0 } }, this._mv(0, 0.3)), vertexShader: fluoroVS, fragmentShader: fluoroFS }));
    const padMat = this._softMat(1.5, 0.14, false, 0.3), snapMat = this._softMat(2.2, 0.4, false, 0.3);
    [[V(-6.8, 7.6, 6.0), [V(-7.6, 10, 6.3), V(-10, 14, 5.8), V(-15, 19, 4.5)]],
      [V(9.6, -4.6, 3.4), [V(11.4, -3.2, 2.8), V(14, -2.6, 1.4), V(19, -4.2, -0.5)]],
      [V(-3.2, -6.8, 7.4), [V(-6, -8.2, 7.2), V(-11, -9.2, 5.8), V(-17, -12.5, 3.6)]]].forEach(([c, path]) => {
      const tor = new T.TorusGeometry(0.42, 0.055, 8, 28); tor.translate(c.x, c.y, c.z);
      this.spine.add(new T.Mesh(tor, padMat));
      const sn = new T.SphereGeometry(0.19, 12, 10); sn.translate(c.x, c.y, c.z + 0.1);
      this.spine.add(new T.Mesh(sn, snapMat));
      this.spine.add(new T.Mesh(tubeGeometry(new T.CatmullRomCurve3([c.clone().add(V(0, 0, 0.15))].concat(path)), { radius: () => 0.04, ring: 6, n: 70 }), wireMat));
    });
    this.fluoroOnly.add(this.spine);
    // contrast reflux cloud in the sinus during injection
    this.reflux = new T.Mesh(blob(AO0.clone().add(AO_AXIS.clone().multiplyScalar(0.6)), 1.35, 1.35, 1.0, null), this._softMat(0.6, 2.0, false, 1));
    this.reflux.material.uniforms.uIntensity.value = 0;
    this.fluoroOnly.add(this.reflux);

    // circle & loop guides
    const ringPts = []; for (let k = 0; k <= 72; k++) ringPts.push(S(0.0, k * 5, 0.45));
    const loopPts = [];
    for (let k = 0; k <= 20; k++) loopPts.push(S(k / 20 * 0.97, 0, 0.45));
    loopPts.push(APEX.clone().add(L.clone().multiplyScalar(0.25)));
    for (let k = 20; k >= 0; k--) loopPts.push(S(k / 20 * 0.97, 180, 0.45));
    this.guides = new T.Group();
    const gm1 = new T.MeshBasicMaterial({ color: 0xffd36e, transparent: true, opacity: 0.85, depthTest: false });
    const gm2 = new T.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.85, depthTest: false });
    const ring = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(ringPts, true), 140, 0.07, 8, true), gm1);
    const loop = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(loopPts, false), 140, 0.07, 8, false), gm2);
    ring.renderOrder = loop.renderOrder = 50;
    this.guides.add(ring, loop);
    this.guides.visible = false;
    sc.add(this.guides);
  };

  /* paint the ventricles: myocardium with fat in the grooves and along the arteries */
  Engine.prototype._colorHeart = function () {
    const g = this.heart.geometry, pos = g.getAttribute('position'), col = g.getAttribute('color'), up = g.userData.up;
    const pts = [];
    this.tree.list.forEach((d) => {
      if (/^(S\d|IS\d|LS\d)$/.test(d.id)) return;      // septal branches run inside the septum
      const n = Math.max(2, Math.round(d.len / 0.3));
      for (let i = 0; i <= n; i++) {
        const t = i / n, r = d.r0 + (d.r1 - d.r0) * t;
        if (r < 0.03) continue;
        const p = d.curve.getPointAt(t);
        pts.push(p.x, p.y, p.z, 0.34 + r * 3.0);
      }
    });
    const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
    const mA = lin(0x74393a), mB = lin(0x925046), fA = lin(0xecdba8), fB = lin(0xd9bb80);
    const c = new T.Color(), f = new T.Color();
    const np = pts.length;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), u = up[2 * i], psi = up[2 * i + 1];
      let w = 0;
      for (let k = 0; k < np; k += 4) {
        const dx = x - pts[k], dy = y - pts[k + 1], dz = z - pts[k + 2], reach = pts[k + 3];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < reach * reach) { const q = 1 - Math.sqrt(d2) / reach; if (q > w) w = q; }
      }
      const av = 1 - CL.smooth(0.015, 0.1, u);
      const sn = Math.sin(psi);
      const gv = Math.exp(-(sn / 0.15) * (sn / 0.15)) * (1 - 0.45 * Math.max(0, u));
      const n1 = fbm(x * 1.6, y * 1.6, z * 1.6), n2 = fbm(x * 4.7, y * 4.7, z * 4.7);
      let fat = Math.max(w * 1.25, av * 0.95, gv * 0.9) + (n1 - 0.5) * 0.4;
      fat = CL.smooth(0.26, 0.6, fat);
      c.copy(mA).lerp(mB, n2);
      f.copy(fA).lerp(fB, n1);
      c.lerp(f, fat * 0.92);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  };

  Engine.prototype._buildTree = function () {
    if (this.treeGroup) {
      this.scene.remove(this.treeGroup);
      this.treeGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.tree = buildTree(this.dom, this.ramus);
    this.treeGroup = new T.Group();
    this.segIndex = {}; this.segList = [];
    const segIdx = (id) => {
      if (!(id in this.segIndex)) { this.segIndex[id] = this.segList.length; this.segList.push(id); }
      return this.segIndex[id];
    };
    this.anatVesselMat = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.25 });
    this.anatVesselMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float aRad;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * (aRad * 0.55 + 0.02);');
    };
    this.fluoroVesselMats = {
      LCA: multiplyBlend(new T.ShaderMaterial({ uniforms: Object.assign({ uTime: this.U.uTime, uK: { value: 5.2 }, uAlways: { value: 1 }, uBase: { value: 0.0 } }, this._mv(1, 1)), vertexShader: fluoroVS, fragmentShader: fluoroFS })),
      RCA: multiplyBlend(new T.ShaderMaterial({ uniforms: Object.assign({ uTime: this.U.uTime, uK: { value: 5.2 }, uAlways: { value: 1 }, uBase: { value: 0.0 } }, this._mv(1, 1)), vertexShader: fluoroVS, fragmentShader: fluoroFS })),
    };
    this.hiMat = new T.ShaderMaterial({ uniforms: Object.assign({ uSel: { value: -10 }, uColor: { value: new T.Color(1.0, 0.62, 0.15) }, uPulse: { value: 1 } }, this._mv(1, 1)), vertexShader: hiVS, fragmentShader: hiFS, blending: T.NormalBlending, depthTest: false, depthWrite: false, transparent: true });
    this.vesselMeshes = [];
    this.tree.list.forEach((d) => {
      const segs = d.segs.map((s) => [segIdx(s[0]), s[1], s[2], s[0]]);
      d.segRanges = segs;
      const lesion = this.lesion && d.segs.some((s) => s[0] === this.lesion.seg) ? this.lesion : null;
      let lesT = null, lesW = 0;
      if (lesion) {
        const s = d.segs.find((x) => x[0] === lesion.seg);
        lesT = s[1] + (s[2] - s[1]) * lesion.pos;
        lesW = Math.min(0.45, (lesion.len || 0.7) / d.len) / 2;
        d.lesionT = lesT;
      } else d.lesionT = null;
      const geo = tubeGeometry(d.curve, {
        arcStart: d.arcStart,
        n: d.twig ? Math.max(8, Math.round(d.len * 6)) : undefined,
        ring: d.twig ? 6 : undefined,
        radius: (t) => {
          let r = d.r0 + (d.r1 - d.r0) * Math.pow(t, 0.9);
          if (lesT != null) {
            const x = (t - lesT) / Math.max(lesW, 1e-3);
            const bump = Math.exp(-x * x * 2.2);
            r *= 1 - Math.min(lesion.sev, 0.97) * bump;
          }
          return Math.max(r, 0.004);
        },
        seg: (t) => { for (const s of segs) if (t <= s[2] + 1e-6) return s[0]; return segs[segs.length - 1][0]; },
      });
      const mesh = new T.Mesh(geo, this.anatVesselMat);
      mesh.userData.vessel = d;
      mesh.renderOrder = 5;
      const hi = new T.Mesh(geo, this.hiMat);
      hi.renderOrder = 60;
      hi.visible = false;
      mesh.userData.hi = hi;
      this.treeGroup.add(mesh, hi);
      this.vesselMeshes.push(mesh);
    });
    this.scene.add(this.treeGroup);
    // framing targets for selective injections
    const cen = { LCA: new T.Vector3(), RCA: new T.Vector3() }, cnt = { LCA: 0, RCA: 0 };
    this.tree.list.forEach((d) => { for (let i = 0; i <= 20; i++) { cen[d.root].add(d.curve.getPointAt(i / 20)); cnt[d.root]++; } });
    this.treeCenter = { LCA: cen.LCA.multiplyScalar(1 / Math.max(1, cnt.LCA)), RCA: cen.RCA.multiplyScalar(1 / Math.max(1, cnt.RCA)) };
    this._recolor();
    this._colorHeart();
    this._computeFlow();
    this._applyModeToTree();
    this._buildLabels();
  };

  Engine.prototype._buildCatheter = function () {
    if (this.cath) { this.scene.remove(this.cath); this.cath.geometry.dispose(); }
    const root = this.opts.catheter;
    const ost = root === 'LCA' ? LCA_OST : RCA_OST;
    const dirOut = root === 'LCA' ? LCA_DIR : RCA_DIR;
    const tip = ost.clone().add(dirOut.clone().multiplyScalar(0.25));
    let pts;
    const desc = [aoPts[9], aoPts[8], aoPts[7], aoPts[6], aoPts[5]].map((p) => p.clone().add(V(-0.5, 0, 0.35)));
    const arch = [aoPts[4].clone().add(V(0, 0.75, 0.2)), aoPts[3].clone().add(V(-0.3, 0.5, 0.4))];
    if (this.opts.access === 'radial') {
      const sub = [V(-14, 9.2, -0.5), V(-8, 9.6, -0.8), V(-3.4, 9.8, -1.1), aoPts[3].clone().add(V(-0.6, 0.7, 0.6))];
      pts = sub;
    } else {
      pts = desc.concat(arch);
    }
    if (root === 'LCA') {
      // JL-type: rides down the right (contralateral) wall of the ascending aorta, primary curve into the left sinus
      pts = pts.concat([
        aoPts[2].clone().add(AO_LEFT.clone().multiplyScalar(-1.0)),
        aoPts[1].clone().add(AO_LEFT.clone().multiplyScalar(-1.05)).add(AO_AXIS.clone().multiplyScalar(-0.6)),
        OST_LEVEL.clone().add(AO_LEFT.clone().multiplyScalar(-0.3)).add(AO_AXIS.clone().multiplyScalar(-0.15)),
        ost.clone().add(dirOut.clone().multiplyScalar(-0.45)),
        tip,
      ]);
    } else {
      pts = pts.concat([
        aoPts[2].clone().add(AO_ANT.clone().multiplyScalar(-0.3)),
        aoPts[1].clone().add(AO_ANT.clone().multiplyScalar(-0.35)),
        OST_LEVEL.clone().add(AO_AXIS.clone().multiplyScalar(0.25)).add(RCA_DIR.clone().multiplyScalar(0.2)),
        ost.clone().add(dirOut.clone().multiplyScalar(-0.4)),
        tip,
      ]);
    }
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    this.cathCurve = curve;
    const geo = tubeGeometry(curve, { radius: () => 0.1, ring: 8, n: 180 });
    const mat = multiplyBlend(new T.ShaderMaterial({ uniforms: Object.assign({ uTime: this.U.uTime, uK: { value: 3.2 }, uAlways: { value: 1 }, uBase: { value: 0 } }, this._mv(0, 1)), vertexShader: fluoroVS, fragmentShader: fluoroFS }));
    this.cathAnatMat = new T.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.1 });
    this.cathFluoroMat = mat;
    this.cath = new T.Mesh(geo, this.mode === 'fluoro' ? mat : this.cathAnatMat);
    this.cath.renderOrder = 6;
    this.cath.visible = this.mode === 'fluoro' || this.opts.showCathAnat;
    this.scene.add(this.cath);
  };

  /* colors for anatomy mode */
  Engine.prototype._segColor = function (segId) {
    const meta = CL.data.segments[segId];
    const v = meta ? meta.vessel : 'LAD';
    const key = CL.data.vesselColor[v] || 'lad';
    const base = new T.Color(CL.color(key)).convertSRGBToLinear();
    if (!this.opts.segColors) return base;
    // shade proximal / mid / distal so segment boundaries are visible
    const shade = { 'lad-p': 1.0, 'lad-m': 0.78, 'lad-d': 0.6, 'rca-p': 1.0, 'rca-m': 0.78, 'rca-d': 0.6, 'lcx-p': 1.0, 'lcx-d': 0.72 };
    const f = shade[segId] != null ? shade[segId] : 0.9;
    const hsl = {}; base.getHSL(hsl);
    return new T.Color().setHSL(hsl.h, hsl.s, Math.min(0.85, hsl.l * (0.6 + 0.6 * f)));
  };
  Engine.prototype._recolor = function () {
    const selIdx = this.sel != null && this.sel in this.segIndex ? this.segIndex[this.sel] : -10;
    const cache = {};
    this.vesselMeshes.forEach((m) => {
      const g = m.geometry;
      const seg = g.getAttribute('aSeg');
      const col = g.getAttribute('color');
      for (let i = 0; i < seg.count; i++) {
        const si = seg.getX(i);
        let c = cache[si];
        if (!c) {
          c = this._segColor(this.segList[si]);
          if (si === selIdx) c = c.clone().lerp(new T.Color(1, 1, 1), 0.55);
          cache[si] = c;
        }
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    });
    this.hiMat.uniforms.uSel.value = selIdx;
  };

  /* contrast arrival / clearance times per vertex */
  Engine.prototype._computeFlow = function () {
    const v = 15.0;                // contrast front speed, cm/s (TIMI 3)
    const injDur = 2.6;            // seconds of injection
    const les = this.lesion;
    const timi = les ? les.timi : 3;
    let lesVessel = null;
    if (les) lesVessel = this.tree.list.find((d) => d.segs.some((s) => s[0] === les.seg));
    // which vessels are downstream of the lesion (descendants that branch beyond the lesion)
    const downstream = new Map(); // vessel id -> arc position of lesion in that path
    if (lesVessel) {
      const lesArc = lesVessel.arcStart + lesVessel.len * lesVessel.lesionT;
      downstream.set(lesVessel.id, lesArc);
      const mark = (d) => d.children.forEach((c) => { downstream.set(c.id, lesArc); mark(c); });
      lesVessel.children.forEach((c) => { if (c.at > lesVessel.lesionT) { downstream.set(c.id, lesArc); mark(c); } });
    }
    const slow = timi === 2 ? 0.22 : timi === 1 ? 0.06 : timi === 0 ? 0 : 1;
    this.vesselMeshes.forEach((m) => {
      const d = m.userData.vessel;
      const g = m.geometry;
      const arc = g.getAttribute('aArc'), arr = g.getAttribute('aArr'), clr = g.getAttribute('aClr');
      const lesArc = downstream.has(d.id) ? downstream.get(d.id) : null;
      for (let i = 0; i < arc.count; i++) {
        const a = arc.getX(i);
        let tA, tC;
        if (lesArc == null || a <= lesArc) {
          tA = a / v; tC = injDur + a / (v * 0.75) + 0.6;
        } else {
          const beyond = a - lesArc;
          if (slow === 0) { tA = 1e6; tC = 1e6; }
          else if (timi === 1) {
            tA = beyond < 1.6 ? lesArc / v + beyond / (v * slow) : 1e6;
            tC = 1e6;
          } else {
            tA = lesArc / v + beyond / (v * slow);
            tC = Math.max(tA + 1.2, injDur + lesArc / v + beyond / (v * slow * 0.9)) + 1.4;
          }
        }
        arr.setX(i, tA); clr.setX(i, tC);
      }
      arr.needsUpdate = true; clr.needsUpdate = true;
    });
  };

  Engine.prototype._applyModeToTree = function () {
    const fl = this.mode === 'fluoro';
    this.vesselMeshes.forEach((m) => {
      const d = m.userData.vessel;
      m.material = fl ? this.fluoroVesselMats[d.root] : this.anatVesselMat;
      m.renderOrder = fl ? 5 : 2;
      m.userData.hi.visible = fl && this.sel != null && !this.inj;
      m.visible = true;
    });
  };

  /* ---------- labels ---------- */
  const LABEL_SEGS = ['lm', 'lad-p', 'lad-m', 'lad-d', 'd1', 'd2', 'sept', 'lcx-p', 'lcx-d', 'om1', 'om2', 'ramus', 'rca-p', 'rca-m', 'rca-d', 'pda', 'rpl', 'conus', 'sanode', 'rvb', 'lpda', 'lpl', 'avn'];
  const MINOR = ['conus', 'sanode', 'rvb', 'avn', 'sept', 'lpl'];
  Engine.prototype._buildLabels = function () {
    CL.clear(this.overlay);
    this.labels = [];
    const seen = {};
    this.tree.list.forEach((d) => {
      d.segRanges.forEach((s) => {
        const id = s[3];
        if (seen[id] || LABEL_SEGS.indexOf(id) < 0) return;
        seen[id] = true;
        const meta = CL.data.segments[id];
        if (!meta) return;
        const tMid = id === 'sept' ? 0.5 : (s[1] + s[2]) / 2;
        const p = d.curve.getPointAt(Math.min(0.98, tMid));
        const out = p.clone().sub(CENTER).normalize().multiplyScalar(0.55);
        const anchor = p.clone().add(out);
        const key = CL.data.vesselColor[meta.vessel] || 'lad';
        const el = CL.h('button', { type: 'button', class: 'vlabel', style: { '--c': CL.color(key) }, title: meta.name }, meta.label);
        el.addEventListener('click', (e) => { e.stopPropagation(); this.select(id, true); });
        this.overlay.appendChild(el);
        this.labels.push({ id, el, anchor, normal: p.clone().sub(CENTER).normalize() });
      });
    });
  };
  Engine.prototype._updateLabels = function () {
    if (!this.labels) return;
    const w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    const show = this.opts.labels;
    const camDir = this.camera.position.clone().sub(CENTER).normalize();
    this.labels.forEach((l) => {
      if (!show || (MINOR.indexOf(l.id) >= 0 && l.id !== this.sel)) { l.el.hidden = true; return; }
      l.el.hidden = false;
      const p = l.anchor.clone().project(this.camera);
      l.el.style.left = ((p.x + 1) / 2 * w).toFixed(1) + 'px';
      l.el.style.top = ((1 - p.y) / 2 * h).toFixed(1) + 'px';
      l.el.classList.toggle('behind', this.mode === 'anatomy' && l.normal.dot(camDir) < -0.15);
      l.el.classList.toggle('sel', l.id === this.sel);
    });
  };

  /* ---------- camera ---------- */
  Engine.prototype.viewDir = function (theta, phi) {
    const t = theta * DEG, p = phi * DEG;
    return V(Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p));
  };
  Engine.prototype._placeCamera = function () {
    const d = this.viewDir(this.theta, this.phi);
    let look = CENTER.clone().add(V(-0.6, 0.9, 0));
    if (this.mode === 'fluoro' && this.treeCenter && !this.opts.showBoth) look = look.lerp(this.treeCenter[this.opts.catheter], 0.6);
    if (this._look) look = this._look.lerp(look, 0.12);
    this._look = look.clone();
    const dist = (this.mode === 'fluoro' ? 40 : 50) / this.zoom;
    this.camera.position.copy(look.clone().add(d.multiplyScalar(dist)));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(look);
    this.key.position.copy(this.camera.position.clone().add(V(8, 14, 6)));
    this.fill.position.copy(this.camera.position.clone().add(V(-16, -6, 4)));
  };
  Engine.prototype.setAngles = function (theta, phi, animate) {
    const lim = this.mode === 'fluoro' ? { t: 120, p: 50 } : { t: 180, p: 85 };
    theta = CL.clamp(theta, -lim.t, lim.t);
    phi = CL.clamp(phi, -lim.p, lim.p);
    this.target = { theta, phi };
    if (!animate) { this.theta = theta; this.phi = phi; }
    this._anim = !!animate;
    this._emit('angles', { theta: this.target.theta, phi: this.target.phi });
  };
  Engine.angleText = function (theta, phi) {
    const t = Math.round(theta), p = Math.round(phi);
    let a = t === 0 ? 'AP' : (t > 0 ? 'LAO ' + t + '°' : 'RAO ' + (-t) + '°');
    if (Math.abs(t) > 90) a = (t > 0 ? 'LAO ' : 'RAO ') + Math.abs(t) + '° (past lateral)';
    const b = p === 0 ? '' : (p > 0 ? ' · CRA ' + p + '°' : ' · CAU ' + (-p) + '°');
    return a + b;
  };

  /* ---------- input ---------- */
  Engine.prototype._bindInput = function () {
    const c = this.wrap;
    let drag = null;
    const pointers = new Map();
    c.addEventListener('pointerdown', (e) => {
      if (e.target.classList && e.target.classList.contains('vlabel')) return;
      c.setPointerCapture && c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { x: e.clientX, y: e.clientY, moved: 0, theta: this.target.theta, phi: this.target.phi };
      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        drag.pinch = Math.hypot(a.x - b.x, a.y - b.y); drag.zoom = this.zoom;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId) || !drag) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && drag.pinch) {
        const [a, b] = Array.from(pointers.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoom = CL.clamp(drag.zoom * d / drag.pinch, 0.6, 3);
        drag.moved += 10;
        return;
      }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      const k = 0.35;
      this.setAngles(drag.theta - dx * k, drag.phi + dy * k, false);
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (drag && drag.moved < 5 && pointers.size === 0 && e.type === 'pointerup') this._pick(e);
      if (pointers.size === 0) drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = CL.clamp(this.zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.6, 3);
    }, { passive: false });
  };
  Engine.prototype._pick = function (e) {
    const rect = this.canvas.getBoundingClientRect();
    const m = new T.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(m, this.camera);
    // fatter hit target for thin vessels: test several nearby rays
    const offs = [[0, 0], [0.012, 0], [-0.012, 0], [0, 0.012], [0, -0.012]];
    for (const o of offs) {
      this.raycaster.setFromCamera(new T.Vector2(m.x + o[0], m.y + o[1]), this.camera);
      const hits = this.raycaster.intersectObjects(this.vesselMeshes, false);
      if (hits.length) {
        const h = hits[0];
        const segAttr = h.object.geometry.getAttribute('aSeg');
        const id = this.segList[segAttr.getX(h.face.a)];
        this.select(id, true);
        return;
      }
    }
    this.select(null, true);
  };

  /* ---------- public API ---------- */
  Engine.prototype.on = function (evt, fn) { this.listeners[evt].push(fn); };
  Engine.prototype._emit = function (evt, p) { (this.listeners[evt] || []).forEach((fn) => fn(p)); };
  Engine.prototype.attach = function (container) {
    if (this.wrap.parentNode !== container) container.appendChild(this.wrap);
    this.visible = true;
    this._resize();
  };
  Engine.prototype.detach = function () { this.visible = false; };
  Engine.prototype.setMode = function (mode) {
    this.mode = mode;
    const fl = mode === 'fluoro';
    this.anat.visible = !fl;
    this.fluoroOnly.visible = fl;
    this.spine.visible = fl && this.opts.spine;
    this.bg.visible = fl;
    this.lights.visible = !fl;
    this.scene.background = fl ? null : this.backdrop;
    this.wrap.classList.toggle('fluoro', fl);
    this.renderer.setClearColor(fl ? 0xd6d6d0 : 0x05080a, 1);
    this._applyModeToTree();
    if (this.cath) {
      this.cath.material = fl ? this.cathFluoroMat : this.cathAnatMat;
      this.cath.visible = fl || !!this.opts.showCathAnat;
    }
    this.setAngles(this.target.theta, this.target.phi, false);
  };
  Engine.prototype.setDominance = function (dom) { if (dom === this.dom) return; this.dom = dom; if (this.lesion && !this._segExists(this.lesion.seg)) this.lesion = null; this._buildTree(); };
  Engine.prototype.setRamus = function (on) { if (on === this.ramus) return; this.ramus = on; this._buildTree(); };
  Engine.prototype._segExists = function (id) { return this.tree.list.some((d) => d.segs.some((s) => s[0] === id)); };
  Engine.prototype.hasSeg = function (id) { return this._segExists(id); };
  Engine.prototype.select = function (id, fromUser) {
    if (id && !this._segExists(id)) id = null;
    this.sel = id;
    this._recolor();
    this.vesselMeshes.forEach((m) => { m.userData.hi.visible = this.mode === 'fluoro' && id != null && !this.inj; });
    this._emit('select', { id, fromUser: !!fromUser });
  };
  Engine.prototype.setOption = function (k, v) {
    this.opts[k] = v;
    if (k === 'heartOpacity') { this.heartMat.opacity = v; this.heartMat.depthWrite = v > 0.97; this.heart.visible = v > 0.02; this.atria.forEach((a) => { a.material.opacity = Math.min(0.95, v + 0.05); a.visible = v > 0.02; }); }
    if (k === 'circleLoop') this.guides.visible = v;
    if (k === 'segColors') this._recolor();
    if (k === 'spine') this.spine.visible = this.mode === 'fluoro' && v;
    if (k === 'access' || k === 'catheter') this._buildCatheter();
    if (k === 'roadmap') {
      this.fluoroVesselMats.LCA.uniforms.uAlways.value = v ? 1 : 0;
      this.fluoroVesselMats.RCA.uniforms.uAlways.value = v ? 1 : 0;
      if (v) this.inj = null;
    }
  };
  Engine.prototype.setLesion = function (lesion) {
    this.lesion = lesion && lesion.seg ? Object.assign({ pos: 0.5, sev: 0.7, timi: 3, len: 0.7 }, lesion) : null;
    this._buildTree();
    this.select(this.sel);
  };
  Engine.prototype.inject = function (root) {
    this.setOption('roadmap', false);
    this.opts.catheter = root; this._buildCatheter();
    // hide the other tree entirely during a selective injection
    this.inj = { root, t0: this.time };
    this.fluoroVesselMats.LCA.uniforms.uAlways.value = 0;
    this.fluoroVesselMats.RCA.uniforms.uAlways.value = 0;
    this._emit('inject', { root });
  };
  Engine.prototype.stopInjection = function () {
    if (!this.inj) return;
    this.inj = null;
    this.setOption('roadmap', true);
    this.select(this.sel);
    this._emit('inject', { root: null });
  };
  Engine.prototype.segmentCenter = function (id) {
    for (const d of this.tree.list) for (const s of d.segRanges) if (s[3] === id) return d.curve.getPointAt((s[1] + s[2]) / 2);
    return CENTER.clone();
  };

  /* ---------- frame loop ---------- */
  Engine.prototype._resize = function () {
    const w = this.wrap.clientWidth || 600, h = this.wrap.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    this.rt.setSize(Math.max(2, Math.round(w * pr)), Math.max(2, Math.round(h * pr)));
    this.post.material.uniforms.uRes.value.set(w * pr, h * pr);
    this.post.material.uniforms.uPx.value = Math.max(1, pr) * (w < 520 ? 0.8 : 1.15);
    this.camera.aspect = w / h;
    // keep the heart framed on narrow screens
    this.camera.fov = w / h < 0.9 ? 30 : 22;
    this.camera.updateProjectionMatrix();
  };
  Engine.prototype._loop = function () {
    requestAnimationFrame(this._loop);
    if (!this.visible || !this.wrap.isConnected || this.wrap.offsetParent === null) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    // ease angles
    if (this._anim) {
      const k = 1 - Math.pow(0.002, dt);
      this.theta += (this.target.theta - this.theta) * k;
      this.phi += (this.target.phi - this.phi) * k;
      if (Math.abs(this.target.theta - this.theta) < 0.05 && Math.abs(this.target.phi - this.phi) < 0.05) { this.theta = this.target.theta; this.phi = this.target.phi; this._anim = false; }
    } else { this.theta = this.target.theta; this.phi = this.target.phi; }
    this._placeCamera();

    const fl = this.mode === 'fluoro';
    // heartbeat: 70 bpm, systolic contraction
    const hr = 70 / 60, ph = (this.time * hr) % 1, sm = CL.smooth;
    const sys = sm(0.02, 0.3, ph) * (1 - 0.85 * sm(0.36, 0.52, ph)) * (1 - sm(0.55, 0.95, ph));
    this.U.uBeat.value = this.opts.beat && fl ? sys : 0;
    this.U.uResp.value = this.opts.beat && fl ? 0.42 * Math.sin(this.time * 6.283 / 4.6) : 0;
    // injection timeline
    if (fl && this.inj) {
      const t = this.time - this.inj.t0;
      this.U.uTime.value = t;
      const other = this.inj.root === 'LCA' ? 'RCA' : 'LCA';
      this.fluoroVesselMats[other].uniforms.uK.value = 0.0;
      this.fluoroVesselMats[this.inj.root].uniforms.uK.value = 5.2;
      const refl = t < 0.15 ? t / 0.15 : t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.6);
      this.reflux.material.uniforms.uIntensity.value = 0.22 * refl;
      this.vesselMeshes.forEach((m) => { m.userData.hi.visible = false; });
      if (t > 14) { this.inj = null; this.setOption('roadmap', true); this.select(this.sel); this._emit('inject', { root: null }); }
    } else {
      this.U.uTime.value = 1e5;
      const ct = this.opts.catheter, both = !!this.opts.showBoth;
      this.fluoroVesselMats.LCA.uniforms.uK.value = (ct === 'LCA' || both) ? 5.2 : 0;
      this.fluoroVesselMats.RCA.uniforms.uK.value = (ct === 'RCA' || both) ? 5.2 : 0;
      this.reflux.material.uniforms.uIntensity.value = 0;
    }
    this.hiMat.uniforms.uPulse.value = 0.75 + 0.25 * Math.sin(this.time * 4);
    if (fl) {
      this.bg.material.uniforms.uShift.value.set(this.theta * 0.02, this.phi * 0.02);
      this.post.material.uniforms.uTime.value = this.time;
      this.renderer.setRenderTarget(this.rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCam);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this._updateLabels();
    if (this.onFrame) this.onFrame();
  };

  /* singleton */
  let instance = null;
  CL.Heart3D = {
    get() {
      if (!instance) {
        if (!window.THREE) throw new Error('3D library did not load. Check your connection and reload.');
        instance = new Engine();
      }
      return instance;
    },
    angleText: Engine.angleText,
    viewDir: (t, p) => Engine.prototype.viewDir(t, p),
    supported() {
      try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
    },
  };
})();
