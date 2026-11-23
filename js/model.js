/* EP Simulator — activation model.
 *
 * Ventricles: voxel grid of myocardium with a fast endocardial (Purkinje) layer. Multi-source
 * Dijkstra gives a local activation time (LAT, ms) for any set of sources. The heart dipole is
 * the sum of LAT gradients (uniform double layer), so the QRS follows from where activation
 * starts — the same LAT field colours the 3D map.
 *
 * Atria: geodesic activation over the atrial part of the surface mesh → P-wave dipole.
 */
(function (EP) {
  'use strict';
  const G = EP.G, V = EP.V;
  const M = (EP.Model = {});
  const H = 0.3;                       // voxel size (cm)
  M.H = H;
  M.VM = 0.057;                        // myocardial conduction velocity along the wall, cm/ms
  M.ANISO = 0.45;                      // transmural / in-wall velocity ratio
  M.RVW = 0.45;                        // RV free-wall dipole weight (wall is drawn thicker than life)
  M.OTW = 0.3;                         // RV outflow tract dipole weight
  M.BASE_FADE = 0.7;                   // dipole weight tapers to zero over this many cm at the cut base
  M.VP = 0.215;                        // Purkinje-layer velocity, cm/ms (2.4 m/s)
  M.VA = 0.135;                        // atrial velocity, cm/ms
  M.KV = 0.066;                        // dipole → mV calibration, ventricles
  M.KA = 0.011;                        // dipole → mV calibration, atria

  // ---------------------------------------------------------------------------------------------
  // Ventricular voxel model
  // ---------------------------------------------------------------------------------------------
  let nx, ny, nz, gidx, B;
  const vx = [], vy = [], vz = [];     // world position
  const vs = [], vn = [], va = [];     // local coords
  const tx = [], ty = [], tz = [];     // transmural unit vector
  let purk, endo, wall, nv = 0;        // Uint8Arrays
  const OFF = [];                      // 26 neighbour offsets: [di,dj,dk,dist]
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    if (i || j || k) OFF.push([i, j, k, H * Math.sqrt(i * i + j * j + k * k)]);
  }
  let nbr, nbrD, nbrT2;                // flattened neighbour table (nv × 26), -1 where absent

  M.WALL = { LVFREE: 0, SEPTUM: 1, RV: 2, RVOT: 3 };

  M.build = function () {
    if (nv) return M;
    B = [-5.0, -8.6, -5.2, 9.2, 4.8, 6.9];
    nx = Math.ceil((B[3] - B[0]) / H) + 1; ny = Math.ceil((B[4] - B[1]) / H) + 1; nz = Math.ceil((B[5] - B[2]) / H) + 1;
    gidx = new Int32Array(nx * ny * nz).fill(-1);
    const info = {};
    const pk = [], en = [], wl = [];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = B[0] + i * H, y = B[1] + j * H, z = B[2] + k * H;
      if (!G.ventInfo(x, y, z, info)) continue;
      gidx[i + nx * (j + ny * k)] = nv++;
      vx.push(x); vy.push(y); vz.push(z); vs.push(info.s); vn.push(info.n); va.push(info.a);
      {
        // transmural direction = gradient of the distance-to-cavity field
        const f = info.inLV ? G.sdLVCav : G.sdRVCav, e = 0.08;
        let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
        const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        tx.push(gx / gl); ty.push(gy / gl); tz.push(gz / gl);
      }
      const eLV = info.dLVcav < H * 1.05, eRV = info.dRVcav < H * 1.05;
      en.push(eLV ? 1 : eRV ? 2 : 0);
      // wall segment
      let w;
      if (info.inLV) w = info.dRVcav < 1.3 ? 1 : 0;
      else w = (info.dOT < info.dRV && info.dOT < 0.1 && info.n < -1.9) ? 3 : 2;
      wl.push(w);
      pk.push(0);
    }
    // drop voxels that are not connected to the main mass (a few stragglers at thin edges)
    {
      const comp = new Int32Array(nv).fill(-1);
      const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? -1 : gidx[i + nx * (j + ny * k)];
      const ijk = new Int32Array(nv * 3);
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = gidx[i + nx * (j + ny * k)]; if (v >= 0) { ijk[v * 3] = i; ijk[v * 3 + 1] = j; ijk[v * 3 + 2] = k; } }
      let bestC = -1, bestN = 0, nc = 0;
      for (let s0 = 0; s0 < nv; s0++) {
        if (comp[s0] >= 0) continue;
        const stack = [s0]; comp[s0] = nc; let cn = 0;
        while (stack.length) {
          const v = stack.pop(); cn++;
          for (let o = 0; o < 26; o++) { const w2 = at(ijk[v * 3] + OFF[o][0], ijk[v * 3 + 1] + OFF[o][1], ijk[v * 3 + 2] + OFF[o][2]); if (w2 >= 0 && comp[w2] < 0) { comp[w2] = nc; stack.push(w2); } }
        }
        if (cn > bestN) { bestN = cn; bestC = nc; }
        nc++;
      }
      const remap = new Int32Array(nv).fill(-1); let m = 0;
      for (let v = 0; v < nv; v++) if (comp[v] === bestC) remap[v] = m++;
      const cp = (arr) => { const out = []; for (let v = 0; v < nv; v++) if (remap[v] >= 0) out.push(arr[v]); arr.length = 0; for (const q of out) arr.push(q); };
      cp(vx); cp(vy); cp(vz); cp(vs); cp(vn); cp(va); cp(pk); cp(en); cp(wl); cp(tx); cp(ty); cp(tz);
      for (let q = 0; q < gidx.length; q++) if (gidx[q] >= 0) gidx[q] = remap[gidx[q]];
      nv = m;
    }
    purk = Uint8Array.from(pk); endo = Uint8Array.from(en); wall = Uint8Array.from(wl);
    nbr = new Int32Array(nv * 26).fill(-1); nbrD = new Float32Array(26);
    for (let o = 0; o < 26; o++) nbrD[o] = OFF[o][3];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = gidx[i + nx * (j + ny * k)];
      if (v < 0) continue;
      for (let o = 0; o < 26; o++) {
        const ii = i + OFF[o][0], jj = j + OFF[o][1], kk = k + OFF[o][2];
        if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue;
        nbr[v * 26 + o] = gidx[ii + nx * (jj + ny * kk)];
      }
    }
    // squared transmural component of every edge (for anisotropic conduction)
    nbrT2 = new Float32Array(nv * 26);
    for (let v = 0; v < nv; v++) for (let o = 0; o < 26; o++) {
      const c = (OFF[o][0] * tx[v] + OFF[o][1] * ty[v] + OFF[o][2] * tz[v]) * H;
      nbrT2[v * 26 + o] = c * c;
    }
    M.nv = nv; M.purk = purk; M.endo = endo; M.wall = wall;
    M.setPurkinje();
    M.pos = (i) => [vx[i], vy[i], vz[i]];
    M.local = (i) => [vs[i], vn[i], va[i]];
    return M;
  };

  /* Purkinje layer: endocardium of each ventricle apical to a basal limit, not the outflow tract. */
  M.PURK_LV_A = 0.3; M.PURK_RV_A = 0.5;
  M.FASC_N = 0.25;                     // local n dividing anterior- from posterior-fascicle territory
  M.setPurkinje = function () {
    for (let i = 0; i < nv; i++) {
      let p = 0;
      if (endo[i] === 1 && va[i] > M.PURK_LV_A) p = 1;
      else if (endo[i] === 2 && va[i] > M.PURK_RV_A && wall[i] !== 3) p = 2;
      purk[i] = p;
    }
  };

  /* Nearest voxel to a world point. kind: 'any' | 'purkLV' | 'purkRV' | 'endoLV' | 'endoRV' | 'epi' */
  M.nearest = function (p, kind) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < nv; i++) {
      if (kind === 'purkLV' && purk[i] !== 1) continue;
      if (kind === 'purkRV' && purk[i] !== 2) continue;
      if (kind === 'endoLV' && endo[i] !== 1) continue;
      if (kind === 'endoRV' && endo[i] !== 2) continue;
      if (kind === 'epi' && endo[i] !== 0) continue;
      const d = (vx[i] - p[0]) ** 2 + (vy[i] - p[1]) ** 2 + (vz[i] - p[2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  /* k nearest voxels to a point → [[index, distance], …] (grid-accelerated). */
  M.nearestK = function (p, k) {
    const ci = Math.round((p[0] - B[0]) / H), cj = Math.round((p[1] - B[1]) / H), ck = Math.round((p[2] - B[2]) / H);
    const found = [];
    for (let r = 1; r <= 4 && found.length < k; r++) {
      found.length = 0;
      for (let kk = ck - r; kk <= ck + r; kk++) for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || kk < 0 || i >= nx || j >= ny || kk >= nz) continue;
        const v = gidx[i + nx * (j + ny * kk)];
        if (v < 0) continue;
        found.push([v, Math.sqrt((vx[v] - p[0]) ** 2 + (vy[v] - p[1]) ** 2 + (vz[v] - p[2]) ** 2)]);
      }
    }
    found.sort((a, b) => a[1] - b[1]);
    return found.slice(0, k);
  };

  /* Multi-source activation. seeds: [{v, t}] (voxel index, start ms).
   * opts: { vm, vp, purkLV, purkRV } — purk* scale the Purkinje-layer velocity per ventricle
   * (1 = intact His-Purkinje delivery, <1 = network only engaged retrogradely / diseased). */
  M.activate = function (seeds, opts) {
    opts = opts || {};
    const vm = opts.vm || M.VM, vp = opts.vp || M.VP;
    const fL = opts.purkLV == null ? 1 : opts.purkLV, fR = opts.purkRV == null ? 1 : opts.purkRV;
    const fLa = opts.purkLVant == null ? fL : opts.purkLVant, fLp = opts.purkLVpost == null ? fL : opts.purkLVpost;
    const spLa = Math.max(vm, vp * fLa), spLp = Math.max(vm, vp * fLp), spR = Math.max(vm, vp * fR);
    const vt = vm * (opts.aniso || M.ANISO), ivt2 = 1 / (vt * vt), ivl2 = 1 / (vm * vm);
    const T = new Float32Array(nv).fill(Infinity);
    const heap = new EP.Heap(4096);
    for (const s of seeds) { const st = Math.fround(s.t); if (s.v >= 0 && st < T[s.v]) { T[s.v] = st; heap.push(s.v, st); } }
    while (heap.n > 0) {
      const i = heap.pop(); const key = heap.topKey;
      if (key > T[i]) continue;
      const pi = purk[i], base = i * 26;
      for (let o = 0; o < 26; o++) {
        const j = nbr[base + o];
        if (j < 0) continue;
        let dt;
        if (pi && purk[j] === pi) dt = nbrD[o] / (pi === 1 ? (vn[i] < M.FASC_N ? spLa : spLp) : spR);
        else { const c2 = nbrT2[base + o], d = nbrD[o]; dt = Math.sqrt(c2 * ivt2 + (d * d - c2) * ivl2); }
        const t2 = Math.fround(key + dt);
        if (t2 < T[j]) { T[j] = t2; heap.push(j, t2); }
      }
    }
    return T;
  };

  /* Heart dipole time series from a LAT field. Returns { vcg: Float32Array(3n) in mV, n (ms samples),
   * t0 (ms of first sample relative to LAT zero), dur, area:[x,y,z] (mV·ms) }. */
  M.dipole = function (T, sigma, scarW, scarK) {
    let tmax = 0, tmin = Infinity;
    for (let i = 0; i < nv; i++) { const t = T[i]; if (t < Infinity) { if (t > tmax) tmax = t; if (t < tmin) tmin = t; } }
    const pad = 12;
    const t0 = Math.floor(tmin) - pad;
    const n = Math.ceil(tmax - t0) + pad + 1;
    const D = new Float32Array(3 * n);
    const gmax = 1 / (M.VM * M.ANISO * 0.8);
    const o = [13 + 1, 13 - 1, 13 + 3, 13 - 3, 13 + 9, 13 - 9]; // ±x, ±y, ±z positions in OFF order
    // OFF order: k outer, j, i inner with centre skipped → index = (i+1)+(j+1)*3+(k+1)*9, minus 1 past centre
    const oi = (q) => (q > 13 ? q - 1 : q);
    const ox1 = oi(o[0]), ox0 = oi(o[1]), oy1 = oi(o[2]), oy0 = oi(o[3]), oz1 = oi(o[4]), oz0 = oi(o[5]);
    const grad = (i, a, b) => {
      const ja = nbr[i * 26 + a], jb = nbr[i * 26 + b];
      const ta = ja >= 0 ? T[ja] : Infinity, tb = jb >= 0 ? T[jb] : Infinity, tc = T[i];
      if (ta < Infinity && tb < Infinity) return (ta - tb) / (2 * H);
      if (ta < Infinity) return (ta - tc) / H;
      if (tb < Infinity) return (tc - tb) / H;
      return 0;
    };
    const dV = H * H * H;
    for (let i = 0; i < nv; i++) {
      const t = T[i];
      if (!(t < Infinity)) continue;
      let gx = grad(i, ox1, ox0), gy = grad(i, oy1, oy0), gz = grad(i, oz1, oz0);
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
      if (gl > gmax) { const k = gmax / gl; gx *= k; gy *= k; gz *= k; }
      const f = t - t0, b = Math.floor(f), w = f - b;
      const wt = (wall[i] === 3 ? M.OTW : wall[i] === 2 ? M.RVW : 1) * (M.BASE_FADE ? EP.smoothstep(-0.35, M.BASE_FADE, va[i]) : 1) * M.KV * dV * (scarW ? 1 - scarK * scarW[i] : 1);
      const k0 = wt * (1 - w), k1 = wt * w;
      D[b * 3] += gx * k0; D[b * 3 + 1] += gy * k0; D[b * 3 + 2] += gz * k0;
      if (b + 1 < n) { D[b * 3 + 3] += gx * k1; D[b * 3 + 4] += gy * k1; D[b * 3 + 5] += gz * k1; }
    }
    EP.smooth(D, n, 3, sigma || 3.2);
    const area = [0, 0, 0];
    for (let i = 0; i < n; i++) { area[0] += D[i * 3]; area[1] += D[i * 3 + 1]; area[2] += D[i * 3 + 2]; }
    return { vcg: D, n, t0, dur: tmax - tmin, tmin, tmax, area };
  };

  /* Voxel weights (0..1) for a myocardial territory described by spheres in heart-local coordinates.
   * spheres: [[s, n, a, radius, 'rv' | undefined]] — 'rv' spheres select right-ventricular wall only. */
  M.territory = function (spheres) {
    const w = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      let m = 0;
      for (const sp of spheres) {
        const rv = wall[i] >= 2;
        if ((sp[4] === 'rv') !== rv) continue;
        const d = Math.sqrt((vs[i] - sp[0]) ** 2 + (vn[i] - sp[1]) ** 2 + (va[i] - sp[2]) ** 2);
        const k = 1 - EP.smoothstep(sp[3] * 0.72, sp[3], d);
        if (k > m) m = k;
      }
      w[i] = m;
    }
    return w;
  };
  /* Injury-current vector of a territory: sum of transmural (endo → epi) directions. For the septum this
   * points from the LV side to the RV side. Pass w = null for the whole left ventricle. */
  M.injury = function (w) {
    const o = [0, 0, 0], dV = H * H * H;
    for (let i = 0; i < nv; i++) {
      const k = (w ? w[i] : (wall[i] < 2 ? 1 : 0)) * (wall[i] >= 2 ? 0.45 : 1);   // thin RV wall counts less
      if (!k) continue;
      o[0] += tx[i] * k * dV; o[1] += ty[i] * k * dV; o[2] += tz[i] * k * dV;
    }
    return o;
  };

  /* Map each vertex of a mesh to its nearest myocardial voxel (-1 if the vertex is not ventricular). */
  M.mapMesh = function (pos, nrm, isVent, inset) {
    const n = pos.length / 3, out = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (isVent && !isVent(i)) continue;
      const x = pos[i * 3] - nrm[i * 3] * inset, y = pos[i * 3 + 1] - nrm[i * 3 + 1] * inset, z = pos[i * 3 + 2] - nrm[i * 3 + 2] * inset;
      const ci = Math.round((x - B[0]) / H), cj = Math.round((y - B[1]) / H), ck = Math.round((z - B[2]) / H);
      let best = -1, bd = 1e9;
      for (let r = 0; r <= 3 && best < 0; r++) {
        for (let k = ck - r; k <= ck + r; k++) for (let j = cj - r; j <= cj + r; j++) for (let ii = ci - r; ii <= ci + r; ii++) {
          if (ii < 0 || j < 0 || k < 0 || ii >= nx || j >= ny || k >= nz) continue;
          const v = gidx[ii + nx * (j + ny * k)];
          if (v < 0) continue;
          const d = (vx[v] - x) ** 2 + (vy[v] - y) ** 2 + (vz[v] - z) ** 2;
          if (d < bd) { bd = d; best = v; }
        }
      }
      out[i] = best;
    }
    return out;
  };

  // ---------------------------------------------------------------------------------------------
  // Atrial surface model (built on the muscle mesh)
  // ---------------------------------------------------------------------------------------------
  const At = (M.atria = {});
  M.buildAtria = function (mesh, regions) {
    const n = mesh.pos.length / 3;
    At.mesh = mesh; At.reg = regions; At.n = n;
    At.adj = G.adjacency(n, mesh.idx);
    At.is = new Uint8Array(n);
    for (let i = 0; i < n; i++) At.is[i] = G.isAtrial(regions[i]) ? 1 : 0;
    // atrial triangles
    const tris = [];
    for (let t = 0; t < mesh.idx.length; t += 3) {
      const a = mesh.idx[t], b = mesh.idx[t + 1], c = mesh.idx[t + 2];
      if (At.is[a] && At.is[b] && At.is[c]) tris.push(a, b, c);
    }
    At.tris = Uint32Array.from(tris);
    return At;
  };
  M.nearestAtrial = function (p) {
    const P = At.mesh.pos; let best = -1, bd = 1e9;
    for (let i = 0; i < At.n; i++) {
      if (!At.is[i]) continue;
      const d = (P[i * 3] - p[0]) ** 2 + (P[i * 3 + 1] - p[1]) ** 2 + (P[i * 3 + 2] - p[2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  /* seeds: [{v (mesh vertex), t}] ; opts.speed (cm/ms); opts.block(i,j) → true to forbid an edge */
  M.atrialActivate = function (seeds, opts) {
    opts = opts || {};
    const sp = opts.speed || M.VA, P = At.mesh.pos;
    const T = new Float32Array(At.n).fill(Infinity);
    const heap = new EP.Heap(2048);
    for (const s of seeds) { const st = Math.fround(s.t); if (s.v >= 0 && st < T[s.v]) { T[s.v] = st; heap.push(s.v, st); } }
    while (heap.n > 0) {
      const i = heap.pop(); const key = heap.topKey;
      if (key > T[i]) continue;
      const nb = At.adj[i];
      for (let q = 0; q < nb.length; q++) {
        const j = nb[q];
        if (!At.is[j]) continue;
        if (opts.block && opts.block(i, j)) continue;
        const d = Math.sqrt((P[i * 3] - P[j * 3]) ** 2 + (P[i * 3 + 1] - P[j * 3 + 1]) ** 2 + (P[i * 3 + 2] - P[j * 3 + 2]) ** 2);
        const t2 = Math.fround(key + d / sp);
        if (t2 < T[j]) { T[j] = t2; heap.push(j, t2); }
      }
    }
    return T;
  };
  M.atrialDipole = function (T) {
    const P = At.mesh.pos, tr = At.tris;
    let tmax = 0, tmin = Infinity;
    for (let i = 0; i < At.n; i++) { const t = T[i]; if (t < Infinity) { if (t > tmax) tmax = t; if (t < tmin) tmin = t; } }
    const pad = 14, t0 = Math.floor(tmin) - pad, n = Math.ceil(tmax - t0) + pad + 1;
    const D = new Float32Array(3 * n);
    const gmax = 1 / (M.VA * 0.5);
    for (let q = 0; q < tr.length; q += 3) {
      const a = tr[q], b = tr[q + 1], c = tr[q + 2];
      const ta = T[a], tb = T[b], tc = T[c];
      if (!(ta < Infinity && tb < Infinity && tc < Infinity)) continue;
      const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
      const e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
      const nn = V.cross(e1, e2); const n2 = V.dot(nn, nn);
      if (n2 < 1e-10) continue;
      const g1 = V.cross(e2, nn), g2 = V.cross(nn, e1);
      let gx = ((tb - ta) * g1[0] + (tc - ta) * g2[0]) / n2, gy = ((tb - ta) * g1[1] + (tc - ta) * g2[1]) / n2, gz = ((tb - ta) * g1[2] + (tc - ta) * g2[2]) / n2;
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
      if (gl > gmax) { const k = gmax / gl; gx *= k; gy *= k; gz *= k; }
      const area = Math.sqrt(n2) / 2;
      const f = (ta + tb + tc) / 3 - t0, bi = Math.floor(f), w = f - bi;
      const k0 = M.KA * area * (1 - w), k1 = M.KA * area * w;
      D[bi * 3] += gx * k0; D[bi * 3 + 1] += gy * k0; D[bi * 3 + 2] += gz * k0;
      if (bi + 1 < n) { D[bi * 3 + 3] += gx * k1; D[bi * 3 + 4] += gy * k1; D[bi * 3 + 5] += gz * k1; }
    }
    EP.smooth(D, n, 3, 5);
    return { vcg: D, n, t0, dur: tmax - tmin, tmin, tmax };
  };

  // ---------------------------------------------------------------------------------------------
  // 12-lead projection (Dower matrix, re-expressed in world axes: x left, y up, z anterior)
  // ---------------------------------------------------------------------------------------------
  const L = (EP.Leads = {});
  L.names = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
  const dI = [0.632, 0.235, -0.059], dII = [0.235, -1.066, 0.132];
  L.vec = [
    dI, dII,
    [dII[0] - dI[0], dII[1] - dI[1], dII[2] - dI[2]],
    [-(dI[0] + dII[0]) / 2, -(dI[1] + dII[1]) / 2, -(dI[2] + dII[2]) / 2],
    [dI[0] - dII[0] / 2, dI[1] - dII[1] / 2, dI[2] - dII[2] / 2],
    [dII[0] - dI[0] / 2, dII[1] - dI[1] / 2, dII[2] - dI[2] / 2],
    [-0.515, -0.157, 0.917], [0.044, -0.164, 1.387], [0.882, -0.098, 1.277],
    [1.213, -0.127, 0.601], [1.125, -0.127, 0.086], [0.831, -0.076, -0.230],
  ];
  // additional leads: right-sided and posterior (indices 12–15)
  L.names.push('V4R', 'V7', 'V8', 'V9');
  L.vec.push([-0.62, -0.1, 0.56], [0.6, -0.05, -0.5], [0.34, -0.05, -0.72], [0.08, -0.05, -0.8]);
  L.project = function (x, y, z, lead) { const v = L.vec[lead]; return v[0] * x + v[1] * y + v[2] * z; };
})(globalThis.EP = globalThis.EP || {});
