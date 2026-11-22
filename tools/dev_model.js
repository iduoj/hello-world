// Dev check: build the model under Node and print QRS summaries for a few activation patterns.
require('../js/util.js'); require('../js/geometry.js'); require('../js/model.js');
const EP = globalThis.EP, G = EP.G, M = EP.Model, L = EP.Leads;
let t0 = Date.now();
M.build();
console.log('voxels', M.nv, 'build ms', Date.now() - t0);
let cnt = { purkLV: 0, purkRV: 0, endoLV: 0, endoRV: 0, w: [0, 0, 0, 0] };
for (let i = 0; i < M.nv; i++) { if (M.purk[i] === 1) cnt.purkLV++; if (M.purk[i] === 2) cnt.purkRV++; if (M.endo[i] === 1) cnt.endoLV++; if (M.endo[i] === 2) cnt.endoRV++; cnt.w[M.wall[i]]++; }
console.log(cnt);
function summarize(name, seeds, opts) {
  const t = Date.now();
  const T = M.activate(seeds, opts);
  let unreached = 0; for (let i = 0; i < M.nv; i++) if (!(T[i] < Infinity)) unreached++;
  const d = M.dipole(T);
  const ms = Date.now() - t;
  let out = name.padEnd(14) + ' dur ' + d.dur.toFixed(0).padStart(4) + 'ms unreached ' + unreached + ' (' + ms + 'ms)  ';
  const rows = [];
  for (let l = 0; l < 12; l++) {
    let mx = 0, mn = 0, net = 0;
    for (let i = 0; i < d.n; i++) { const v = L.project(d.vcg[i * 3], d.vcg[i * 3 + 1], d.vcg[i * 3 + 2], l); if (v > mx) mx = v; if (v < mn) mn = v; net += v; }
    rows.push(L.names[l] + ':' + mx.toFixed(1) + '/' + mn.toFixed(1));
  }
  console.log(out + '\n    ' + rows.join('  '));
  // frontal axis from net area
  const ax = Math.atan2(-(d.area[1]) , d.area[0]) * 180 / Math.PI; // approx using world x and -y
  console.log('    area', d.area.map(v => v.toFixed(1)).join(','), ' approx frontal axis', ax.toFixed(0));
  return d;
}
const E = G.LM.exits;
const s = (p, kind, t) => ({ v: M.nearest(p, kind), t });
const normal = [s(E.lvSeptal, 'purkLV', 0), s(E.laf, 'purkLV', 3), s(E.lpf, 'purkLV', 3), s(E.rvSeptal, 'purkRV', 8), s(E.rvFree, 'purkRV', 12)];
summarize('normal', normal);
summarize('RBBB', normal.slice(0, 3), { purkRV: 0.45 });
summarize('LBBB', normal.slice(3), { purkLV: 0.45 });
summarize('RV apex pace', [s(G.L(4.2, 0.6, 6.3), 'endoRV', 0)], { purkLV: 0.55, purkRV: 0.55 });
summarize('RVOT PVC', [s(G.L(2.6, -3.6, 0.9), 'any', 0)], { purkLV: 0.55, purkRV: 0.55 });
summarize('LV lateral', [s(G.L(-3.0, 0.3, 3.0), 'epi', 0)], { purkLV: 0.55, purkRV: 0.55 });
summarize('LBB area', [s(G.L(2.1, -0.2, 2.2), 'purkLV', 0)], { purkRV: 0.55 });
// mesh
t0 = Date.now();
const mesh = G.mesh(G.sdMuscle, G.BOUNDS.muscle, 0.28);
console.log('muscle mesh verts', mesh.pos.length / 3, 'tris', mesh.idx.length / 3, 'ms', Date.now() - t0);
const reg = new Uint8Array(mesh.pos.length / 3);
for (let i = 0; i < reg.length; i++) reg[i] = G.region(mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]);
M.buildAtria(mesh, reg);
const Ta = M.atrialActivate([{ v: M.nearestAtrial(G.LM.saNode), t: 0 }]);
const dp = M.atrialDipole(Ta);
let pr = [];
for (let l = 0; l < 12; l++) { let mx = 0, mn = 0; for (let i = 0; i < dp.n; i++) { const v = L.project(dp.vcg[i * 3], dp.vcg[i * 3 + 1], dp.vcg[i * 3 + 2], l); if (v > mx) mx = v; if (v < mn) mn = v; } pr.push(L.names[l] + ':' + mx.toFixed(2) + '/' + mn.toFixed(2)); }
console.log('sinus P dur', dp.dur.toFixed(0), pr.join('  '));
