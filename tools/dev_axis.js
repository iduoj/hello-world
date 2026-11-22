// Dev: explore normal-conduction parameters. Prints frontal axis, duration and R/S amplitudes.
require('../js/util.js'); require('../js/geometry.js'); require('../js/model.js');
const EP = globalThis.EP, G = EP.G, M = EP.Model, L = EP.Leads;
M.build(); M.KV = 0.055;
const E = G.LM.exits;
const s = (p, kind, t) => ({ v: M.nearest(p, kind), t });
function run(label, tt, opts, mset) {
  const save = {}; for (const k in (mset || {})) { save[k] = M[k]; M[k] = mset[k]; }
  M.setPurkinje();
  const seeds = [];
  if (tt.sept != null) seeds.push(s(E.lvSeptal, 'purkLV', tt.sept));
  if (tt.laf != null) seeds.push(s(E.laf, 'purkLV', tt.laf));
  if (tt.lpf != null) seeds.push(s(E.lpf, 'purkLV', tt.lpf));
  if (tt.rvs != null) seeds.push(s(E.rvSeptal, 'purkRV', tt.rvs));
  if (tt.rvf != null) seeds.push(s(E.rvFree, 'purkRV', tt.rvf));
  const d = M.dipole(M.activate(seeds, opts || {}));
  const amp = [];
  let aI = 0, aF = 0;
  for (let l = 0; l < 12; l++) { let mx = 0, mn = 0, ar = 0; for (let i = 0; i < d.n; i++) { const v = L.project(d.vcg[i * 3], d.vcg[i * 3 + 1], d.vcg[i * 3 + 2], l); if (v > mx) mx = v; if (v < mn) mn = v; ar += v; } amp.push(L.names[l] + ' ' + mx.toFixed(1) + '/' + (-mn).toFixed(1)); if (l === 0) aI = ar; if (l === 5) aF = ar; }
  console.log(label.padEnd(26), 'dur', d.dur.toFixed(0).padStart(3), 'axis', (Math.atan2(aF, aI) * 180 / Math.PI).toFixed(0).padStart(4), '|', amp.join(' | '));
  for (const k in save) M[k] = save[k];
}
const base = { sept: 0, laf: 3, lpf: 3, rvs: 8, rvf: 12 };
for (const bf of [0.4, 0.7, 1.0]) for (const an of [0.4, 0.5]) for (const rw of [0.35, 0.5])
  run('bf' + bf + ' an' + an + ' rw' + rw, base, {}, { BASE_FADE: bf, ANISO: an, RVW: rw });
