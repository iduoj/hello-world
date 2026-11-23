// Dev: print the ST vector of every territory projected on the leads (mm), to check patterns.
for (const f of ['util', 'geometry', 'model', 'morph', 'heartsim', 'synth', 'rhythms', 'ischemia']) require('../js/' + f + '.js');
const EP = globalThis.EP, I = EP.Isch, L = EP.Leads;
EP.Morph.init();
console.log(''.padEnd(10) + L.names.map((n) => n.padStart(5)).join(''));
const row = (name, v) => console.log(name.padEnd(10) + L.vec.map((lv) => ((lv[0] * v[0] + lv[1] * v[1] + lv[2] * v[2]) * 10).toFixed(1).padStart(5)).join('') + '   |v|=' + Math.hypot(v[0], v[1], v[2]).toFixed(2));
for (const k in I.TERR) if (k !== 'global') row(k, I.terr(k).vec);
row('subendo', I.subVec());
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
row('aslanger', add(I.terr('infSmall').vec, I.subVec(), 0.55));
