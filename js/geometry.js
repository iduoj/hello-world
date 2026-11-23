/* EP Simulator — procedural cardiac anatomy.
 *
 * World coordinates are centimetres: +x = patient's left, +y = superior, +z = anterior.
 * The ventricles are designed in a heart-local frame:
 *   A = LV long axis (base → apex), S = LV → RV (septal normal), N = A × S (toward inferior wall).
 * Shapes are signed-distance fields (negative inside); meshes come from surface nets.
 */
(function (EP) {
  'use strict';
  const V = EP.V;
  const G = (EP.G = {});

  // ---- heart frame -------------------------------------------------------------------
  const O = [2.4, -0.4, -2.4];          // mitral annulus centre
  const APEX = [7.2, -5.0, 2.8];
  const A = V.norm(V.sub(APEX, O));
  let S = [-0.62, -0.25, 0.74];
  S = V.norm(V.sub(S, V.scale(A, V.dot(S, A))));
  const N = V.cross(A, S);
  G.O = O; G.A = A; G.S = S; G.N = N;
  G.L = (s, n, a) => [O[0] + s * S[0] + n * N[0] + a * A[0], O[1] + s * S[1] + n * N[1] + a * A[1], O[2] + s * S[2] + n * N[2] + a * A[2]];
  G.toLocal = (p) => { const d = [p[0] - O[0], p[1] - O[1], p[2] - O[2]]; return [V.dot(d, S), V.dot(d, N), V.dot(d, A)]; };

  // ---- ventricular shape parameters (local frame) -----------------------------------------
  const LV = { c: [0, 0, 0.9], rs: 3.15, rn: 3.05, ra: 7.6, rb: 2.2 };
  const LVC = { c: [0, 0, 0.9], rs: 2.05, rn: 2.0, ra: 6.3, rb: 1.25 };
  const RV = { c: [3.3, 0.2, 2.0], rs: 3.0, rn: 3.3, ra: 5.2, rb: 2.4 };
  const RV_WALL = 0.55;
  G.LV = LV; G.LVC = LVC; G.RV = RV; G.RV_WALL = RV_WALL;

  // ---- landmarks (world) --------------------------------------------------------------
  const LM = (G.LM = {});
  LM.mitral = G.L(0, 0, 0);
  LM.tricuspid = G.L(4.5, 0.5, 0.5);
  LM.aorticValve = G.L(1.9, -1.9, -0.3);
  LM.pulmValve = G.L(1.45, -4.85, 0.85);
  LM.rvotBase = G.L(3.2, -2.4, 1.6);
  LM.lvApex = G.L(0, 0, 8.5);
  LM.rvApex = G.L(2.9, 0.3, 7.0);
  LM.raCenter = [-3.2, -0.2, -0.9];
  LM.laCenter = [0.9, 1.0, -4.1];
  LM.svcJunction = [-3.5, 2.5, -1.4];
  LM.ivcJunction = [-3.2, -2.9, -1.7];
  LM.saNode = [-4.55, 2.15, -0.35];
  LM.avNode = G.L(2.95, 0.35, -0.35);
  LM.his = G.L(2.62, -0.55, 0.55);
  LM.csOs = G.L(3.75, 1.75, -0.75);
  LM.fossaOvalis = [-1.55, 0.35, -2.75];
  LM.raa = [-2.2, 2.0, 1.25];
  LM.laa = [4.9, 2.0, -1.3];
  // pulmonary vein ostia (on LA) and distal ends
  LM.pv = {
    RSPV: [[-1.7, 2.3, -5.0], [-4.6, 3.2, -5.8]],
    RIPV: [[-1.8, 0.5, -5.2], [-4.7, -0.1, -6.2]],
    LSPV: [[3.5, 2.5, -4.8], [6.2, 3.4, -5.4]],
    LIPV: [[3.5, 0.7, -5.2], [6.2, 0.3, -6.2]],
  };
  // Purkinje exits used for normal conduction (snapped to endocardial voxels by the model)
  LM.exits = {
    lvSeptal: G.L(2.0, 0.2, 3.2),
    laf: G.L(-0.8, -1.85, 3.8),
    lpf: G.L(0.7, 1.8, 4.2),
    rvSeptal: G.L(2.85, 0.1, 5.0),
    rvFree: G.L(5.3, -0.6, 4.4),
  };

  // vessel centre-lines: [point, radius]
  const PATHS = (G.PATHS = {
    aorta: [[LM.aorticValve, 1.45], [[0.55, 2.9, 0.0], 1.5], [[-0.55, 5.0, 0.0], 1.45], [[-0.5, 7.0, -0.8], 1.4],
      [[0.9, 8.5, -2.5], 1.35], [[2.7, 7.9, -4.7], 1.3], [[3.3, 5.4, -6.3], 1.25], [[3.1, 0.0, -7.0], 1.2], [[2.5, -8.0, -7.2], 1.15]],
    brachio: [[[-0.2, 8.2, -1.4], 0.7], [[-1.4, 11.0, -1.2], 0.6]],
    lcarotid: [[[1.0, 8.8, -2.6], 0.5], [[1.4, 11.2, -2.4], 0.45]],
    lsubclav: [[[2.2, 8.5, -3.9], 0.55], [[3.6, 11.0, -3.8], 0.5]],
    pa: [[LM.pulmValve, 1.4], [[3.2, 4.4, 0.2], 1.4], [[3.0, 5.4, -2.0], 1.3]],
    lpa: [[[3.0, 5.4, -2.0], 1.1], [[5.4, 5.8, -3.8], 1.0], [[7.2, 5.6, -4.8], 0.9]],
    rpa: [[[3.0, 5.4, -2.0], 1.1], [[0.4, 5.2, -2.9], 1.05], [[-2.6, 4.8, -3.5], 1.0], [[-5.4, 4.5, -3.9], 0.9]],
    svc: [[LM.svcJunction, 1.05], [[-3.5, 6.0, -1.6], 1.0], [[-3.4, 9.5, -1.8], 0.95]],
    ivc: [[LM.ivcJunction, 1.3], [[-3.1, -5.0, -2.3], 1.3], [[-2.9, -8.5, -2.9], 1.25]],
    rspv: [[LM.pv.RSPV[0], 0.8], [LM.pv.RSPV[1], 0.7]],
    ripv: [[LM.pv.RIPV[0], 0.8], [LM.pv.RIPV[1], 0.7]],
    lspv: [[LM.pv.LSPV[0], 0.8], [LM.pv.LSPV[1], 0.7]],
    lipv: [[LM.pv.LIPV[0], 0.8], [LM.pv.LIPV[1], 0.7]],
  });

  // ---- SDF primitives -------------------------------------------------------------------
  function ell(dx, dy, dz, rx, ry, rz) {
    const k0 = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2 + (dz / rz) ** 2);
    const k1 = Math.sqrt((dx / (rx * rx)) ** 2 + (dy / (ry * ry)) ** 2 + (dz / (rz * rz)) ** 2);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  }
  function ellL(s, n, a, e) {
    const da = a - e.c[2];
    return ell(s - e.c[0], n - e.c[1], da, e.rs, e.rn, da > 0 ? e.ra : e.rb);
  }
  function cone(x, y, z, p0, p1, r0, r1) {
    const bx = p1[0] - p0[0], by = p1[1] - p0[1], bz = p1[2] - p0[2];
    const px = x - p0[0], py = y - p0[1], pz = z - p0[2];
    let h = (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz);
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - bx * h, dy = py - by * h, dz = pz - bz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r0 + (r1 - r0) * h);
  }
  function tube(x, y, z, path) {
    let d = 1e9;
    for (let i = 0; i < path.length - 1; i++) {
      const c = cone(x, y, z, path[i][0], path[i + 1][0], path[i][1], path[i + 1][1]);
      if (c < d) d = c;
    }
    return d;
  }
  function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  G.sd = { ell, cone, tube, smin };

  function loc(x, y, z, out) {
    const dx = x - O[0], dy = y - O[1], dz = z - O[2];
    out[0] = dx * S[0] + dy * S[1] + dz * S[2];
    out[1] = dx * N[0] + dy * N[1] + dz * N[2];
    out[2] = dx * A[0] + dy * A[1] + dz * A[2];
  }
  const _l = [0, 0, 0];
  const _d = new Float64Array(8);

  // Individual chamber distances. Index: 0 LV, 1 RV body, 2 RVOT, 3 RA, 4 RAA, 5 LA, 6 LAA
  const RVOT_END = V.addS(LM.pulmValve, V.norm(V.sub(LM.pulmValve, LM.rvotBase)), -0.2);
  function parts(x, y, z, d) {
    loc(x, y, z, _l);
    d[0] = ellL(_l[0], _l[1], _l[2], LV);
    d[1] = ellL(_l[0], _l[1], _l[2], RV);
    d[2] = cone(x, y, z, LM.rvotBase, RVOT_END, 1.8, 1.45);
    d[3] = ell(x + 3.2, y + 0.2, z + 0.9, 2.5, 3.0, 2.4);
    d[4] = ell(x + 2.2, y - 2.0, z - 1.25, 1.55, 1.2, 1.3);
    d[5] = ell(x - 0.9, y - 1.0, z + 4.1, 3.2, 2.4, 2.2);
    d[6] = cone(x, y, z, [3.5, 2.4, -3.5], LM.laa, 1.0, 0.72);
  }
  G.REG = { LV: 0, RV: 1, RVOT: 2, RA: 3, RAA: 4, LA: 5, LAA: 6 };
  G.REG_NAMES = ['Left ventricle', 'Right ventricle', 'RV outflow tract', 'Right atrium', 'Right atrial appendage', 'Left atrium', 'Left atrial appendage'];

  G.sdVentEpi = function (x, y, z) {
    parts(x, y, z, _d);
    return smin(smin(_d[0], _d[1], 0.5), _d[2], 0.7);
  };
  G.sdMuscle = function (x, y, z) {
    parts(x, y, z, _d);
    const vent = smin(smin(_d[0], _d[1], 0.5), _d[2], 0.7);
    const atria = smin(smin(_d[3], _d[4], 0.6), smin(_d[5], _d[6], 0.5), 0.4);
    return smin(vent, atria, 0.3);
  };
  /* Region of the nearest chamber primitive (used to label mesh vertices). */
  G.region = function (x, y, z) {
    parts(x, y, z, _d);
    let b = 0;
    for (let i = 1; i < 7; i++) if (_d[i] < _d[b]) b = i;
    return b;
  };
  G.isAtrial = (r) => r >= 3;

  G.sdLVCav = function (x, y, z) { loc(x, y, z, _l); return ellL(_l[0], _l[1], _l[2], LVC); };
  G.sdRVCav = function (x, y, z) {
    parts(x, y, z, _d);
    const outer = smin(_d[1], _d[2], 0.7) + RV_WALL;
    return Math.max(outer, -(_d[0] - 0.02));
  };
  /* Ventricular myocardium test + classification for the voxel model. */
  G.ventInfo = function (x, y, z, info) {
    parts(x, y, z, _d);
    const a = _l[2];
    const dLV = _d[0], dRV = _d[1], dOT = _d[2];
    const inLV = dLV < 0 && a > -0.35;
    const inRV = dRV < 0 && a > -0.35;
    const inOT = dOT < 0;
    if (!(inLV || inRV || inOT)) return false;
    const lvc = ellL(_l[0], _l[1], _l[2], LVC);
    if (lvc < 0) return false;
    const rvc = Math.max(smin(dRV, dOT, 0.7) + RV_WALL, -(dLV - 0.02));
    if (rvc < 0) return false;
    info.s = _l[0]; info.n = _l[1]; info.a = a;
    info.dLVcav = lvc; info.dRVcav = rvc;
    info.inLV = inLV; info.dLV = dLV; info.dRV = dRV; info.dOT = dOT;
    return true;
  };

  G.sdVessels = {
    aorta: (x, y, z) => Math.min(tube(x, y, z, PATHS.aorta), tube(x, y, z, PATHS.brachio), tube(x, y, z, PATHS.lcarotid), tube(x, y, z, PATHS.lsubclav)),
    pa: (x, y, z) => smin(tube(x, y, z, PATHS.pa), Math.min(tube(x, y, z, PATHS.lpa), tube(x, y, z, PATHS.rpa)), 0.5),
    veins: (x, y, z) => Math.min(tube(x, y, z, PATHS.svc), tube(x, y, z, PATHS.ivc)),
    pvs: (x, y, z) => Math.min(tube(x, y, z, PATHS.rspv), tube(x, y, z, PATHS.ripv), tube(x, y, z, PATHS.lspv), tube(x, y, z, PATHS.lipv)),
  };

  // ---- surface nets mesher ------------------------------------------------------------
  /* Returns { pos: Float32Array, nrm: Float32Array, idx: Uint32Array } */
  G.mesh = function (sdf, b, h) {
    const nx = Math.ceil((b[3] - b[0]) / h) + 1, ny = Math.ceil((b[4] - b[1]) / h) + 1, nz = Math.ceil((b[5] - b[2]) / h) + 1;
    const vals = new Float32Array(nx * ny * nz);
    let p = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) vals[p++] = sdf(b[0] + i * h, b[1] + j * h, b[2] + k * h);
    const cx = nx - 1, cy = ny - 1, cz = nz - 1;
    const cellV = new Int32Array(cx * cy * cz).fill(-1);
    const pos = [];
    const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cv = new Float32Array(8);
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) {
        const v = vals[(i + corner[c][0]) + nx * ((j + corner[c][1]) + ny * (k + corner[c][2]))];
        cv[c] = v; if (v < 0) neg++;
      }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, cnt = 0;
      for (let e = 0; e < 12; e++) {
        const a = edges[e][0], c2 = edges[e][1];
        const va = cv[a], vb = cv[c2];
        if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        sx += corner[a][0] + (corner[c2][0] - corner[a][0]) * t;
        sy += corner[a][1] + (corner[c2][1] - corner[a][1]) * t;
        sz += corner[a][2] + (corner[c2][2] - corner[a][2]) * t;
        cnt++;
      }
      cellV[i + cx * (j + cy * k)] = pos.length / 3;
      pos.push(b[0] + (i + sx / cnt) * h, b[1] + (j + sy / cnt) * h, b[2] + (k + sz / cnt) * h);
    }
    const idx = [];
    const cell = (i, j, k) => cellV[i + cx * (j + cy * k)];
    function quad(a, b2, c, d, flip) {
      if (a < 0 || b2 < 0 || c < 0 || d < 0) return;
      if (flip) idx.push(a, c, b2, a, d, c); else idx.push(a, b2, c, a, c, d);
    }
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const v0 = vals[i + nx * (j + ny * k)];
      const in0 = v0 < 0;
      if (i < nx - 1) { // x edge
        const in1 = vals[i + 1 + nx * (j + ny * k)] < 0;
        if (in0 !== in1) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !in0);
      }
      if (j < ny - 1) { // y edge
        const in1 = vals[i + nx * (j + 1 + ny * k)] < 0;
        if (in0 !== in1) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !in0);
      }
      if (k < nz - 1) { // z edge
        const in1 = vals[i + nx * (j + ny * (k + 1))] < 0;
        if (in0 !== in1) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !in0);
      }
    }
    const P = new Float32Array(pos), Nn = new Float32Array(pos.length);
    const e = 0.05;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      Nn[i] = gx / l; Nn[i + 1] = gy / l; Nn[i + 2] = gz / l;
    }
    return { pos: P, nrm: Nn, idx: new Uint32Array(idx) };
  };

  /* Vertex adjacency (unique neighbours) from a triangle index. */
  G.adjacency = function (nVerts, idx) {
    const sets = new Array(nVerts);
    for (let i = 0; i < nVerts; i++) sets[i] = [];
    const add = (a, b) => { if (sets[a].indexOf(b) < 0) sets[a].push(b); };
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      add(a, b); add(b, a); add(b, c); add(c, b); add(a, c); add(c, a);
    }
    return sets;
  };

  // Valve annuli (centre, normal, radius) for drawing rings and for flutter / pathway geometry.
  G.ANNULI = {
    mitral: { c: LM.mitral, n: A, r: 1.75 },
    tricuspid: { c: LM.tricuspid, n: V.norm(V.addS(A, S, -0.25)), r: 1.95 },
    aortic: { c: LM.aorticValve, n: V.norm(V.sub(PATHS.aorta[1][0], LM.aorticValve)), r: 1.2 },
    pulmonary: { c: LM.pulmValve, n: V.norm(V.sub(LM.pulmValve, LM.rvotBase)), r: 1.2 },
  };
  /* Point on a ring at angle th (radians). th = 0 is toward the septum (+S for mitral, −S for tricuspid). */
  G.ringPoint = function (ring, th, rScale) {
    const n = ring.n;
    let u = V.sub(S, V.scale(n, V.dot(S, n))); u = V.norm(u);
    const w = V.cross(n, u);
    const r = ring.r * (rScale || 1);
    return [ring.c[0] + r * (Math.cos(th) * u[0] + Math.sin(th) * w[0]), ring.c[1] + r * (Math.cos(th) * u[1] + Math.sin(th) * w[1]), ring.c[2] + r * (Math.cos(th) * u[2] + Math.sin(th) * w[2])];
  };

  G.BOUNDS = {
    muscle: [-7.2, -8.2, -7.6, 9.4, 4.6, 6.8],
    lvcav: [-1.5, -7, -5, 8, 2, 4],
    rvcav: [-3.5, -7.5, -3, 7.5, 4.5, 6.5],
    aorta: [-3, -9, -9.2, 5.6, 12, 2.2],
    pa: [-6.6, 1.2, -6.2, 8.4, 7.6, 3.4],
    veins: [-5.2, -9.6, -4.6, -1.4, 10.4, 0.2],
    pvs: [-5.8, -1.2, -7.2, 7.2, 4.6, -3.6],
  };
})(globalThis.EP = globalThis.EP || {});
