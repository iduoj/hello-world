// Dev: plot full beats (P-QRS-T) for several morphologies as an SVG grid → PNG via Playwright.
// usage: NODE_PATH=/opt/node-tools/node_modules node tools/dev_plot.js out.png [set]
for (const f of ['util', 'geometry', 'model', 'morph']) require('../js/' + f + '.js');
const EP = globalThis.EP, G = EP.G, M = EP.Model, L = EP.Leads, Mo = EP.Morph;
const t0 = Date.now(); Mo.init(); console.log('init ms', Date.now() - t0);
const set = process.argv[3] || 'conduction';
const sets = {
  conduction: [['Normal', 'normal'], ['RBBB', 'rbbb'], ['LBBB', 'lbbb'], ['LAFB', 'lafb'], ['LPFB', 'lpfb'], ['RBBB+LAFB', 'rbbb+lafb'], ['Post fasc VT', 'fascPost'], ['Ant fasc VT', 'fascAnt'], ['LBB area', 'lbbArea']],
  pacing: [['RV apex', 'rvApex'], ['RV mid-septum', 'rvMidSeptum'], ['RVOT septal', 'rvotSeptal'], ['LBB area', 'lbbArea'], ['LV lat epi', 'lvLatEpi'], ['BiV', null], ['LV apex', 'lvApex']],
  pvc: [['RVOT free', 'rvotFree'], ['LVOT', 'lvotSeptal'], ['LV summit', 'lvSummit'], ['Mitral lat', 'mitralLat'], ['Pap PM', 'papPM'], ['Post fasc', 'fascPost'], ['Ant fasc', 'fascAnt'], ['Moderator', 'moderator'], ['RV inflow', 'rvInflow']],
};
const cases = sets[set];
const W = 118, Hh = 128, X0 = 96, Y0 = 30;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${X0 + 12 * W + 10}" height="${Y0 + cases.length * Hh + 10}" style="background:#fff;font:11px sans-serif">`;
for (let l = 0; l < 12; l++) svg += `<text x="${X0 + l * W + W / 2}" y="18" text-anchor="middle">${L.names[l]}</text>`;
const pw = Mo.pwave(Mo.aspec('sinus'));
cases.forEach((c, r) => {
  let sp;
  if (c[1] === null) sp = Mo.fuse([{ spec: Mo.spec('rvApex'), t: 0 }, { spec: Mo.spec('lvLatEpi'), t: 0 }]);
  else sp = Mo.spec(c[1]);
  const b = Mo.vbeat(sp, { rr: 900 });
  const y0 = Y0 + r * Hh + Hh / 2;
  svg += `<text x="4" y="${y0 - 8}">${c[0]}</text><text x="4" y="${y0 + 6}" fill="#666">QRS ${b.qrs.toFixed(0)} QT ${b.qt.toFixed(0)}</text><text x="4" y="${y0 + 20}" fill="#666">axis ${Mo.axis(b.act).toFixed(0)}°</text>`;
  const sc = 26, tx = 0.19; // px per mV, px per ms
  const native = set === 'conduction';
  const prOff = native ? 160 : 0;
  for (let l = 0; l < 12; l++) {
    const x0 = X0 + l * W;
    svg += `<line x1="${x0}" x2="${x0 + W - 6}" y1="${y0}" y2="${y0}" stroke="#ddd"/><line x1="${x0 + 2}" x2="${x0 + 2}" y1="${y0 - sc}" y2="${y0}" stroke="#e99"/>`;
    let pth = '';
    const total = prOff + b.n + 20;
    for (let t = 0; t < total; t += 2) {
      let v = 0;
      if (native) { const i = t - 10; if (i >= 0 && i < pw.n) v += L.project(pw.vcg[i * 3], pw.vcg[i * 3 + 1], pw.vcg[i * 3 + 2], l); }
      const j = t - prOff - 10 + (pw.pre - b.pre) * 0 ; // QRS fiducial at t = prOff + 10 + b.pre
      const jb = t - prOff - 10; if (jb >= 0 && jb < b.n) v += L.project(b.vcg[jb * 3], b.vcg[jb * 3 + 1], b.vcg[jb * 3 + 2], l);
      pth += (t ? 'L' : 'M') + (x0 + 4 + t * tx).toFixed(1) + ' ' + (y0 - v * sc).toFixed(1);
    }
    svg += `<path d="${pth}" fill="none" stroke="#000" stroke-width="1.1"/>`;
  }
});
svg += '</svg>';
const out = process.argv[2] || 'plot.png';
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: X0 + 12 * W + 10, height: Y0 + cases.length * Hh + 10 } });
  await pg.setContent(svg); await pg.screenshot({ path: out }); await b.close();
  console.log('wrote', out);
})();
