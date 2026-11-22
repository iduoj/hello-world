for (const f of ['util', 'geometry', 'model', 'morph']) require('../js/' + f + '.js');
const EP = globalThis.EP, Mo = EP.Morph, L = EP.Leads; Mo.init();
if (process.env.ECT) Mo.ECT = +process.env.ECT;
const list = ['normal', 'rbbb', 'lbbb', 'lafb', 'lpfb', 'rvApex', 'rvMidSeptum', 'rvotSeptal', 'rvotFree', 'lbbArea', 'lvLatEpi', 'lvotSeptal', 'lvSummit', 'mitralLat', 'papPM', 'fascPost', 'fascAnt', 'moderator', 'lvApex'];
for (const nme of list) {
  const b = Mo.vbeat(Mo.spec(nme), { rr: 900 }); const a = b.act;
  const pk = (l) => { let mx = 0, mn = 0; for (let i = 0; i < a.n; i++) { const v = L.project(a.vcg[i * 3], a.vcg[i * 3 + 1], a.vcg[i * 3 + 2], l); if (v > mx) mx = v; if (v < mn) mn = v; } return mx.toFixed(1) + '/' + (-mn).toFixed(1); };
  console.log(nme.padEnd(12), 'QRS', String(Math.round(b.qrs)).padStart(3), 'LAT', String(Math.round(a.tmax - a.tmin)).padStart(3), 'axis', String(Math.round(Mo.axis(a))).padStart(4), ' I', pk(0), ' II', pk(1), ' III', pk(2), ' aVL', pk(4), ' V1', pk(6), ' V2', pk(7), ' V6', pk(11));
}
