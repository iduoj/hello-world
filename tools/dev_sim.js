// Dev: run simulator configs and print A / V timing.
for (const f of ['util', 'geometry', 'model', 'morph', 'heartsim']) require('../js/' + f + '.js');
const EP = globalThis.EP;
function run(name, cfg, dur) {
  const t0 = Date.now();
  const sim = EP.simulate(cfg, dur || 8000);
  const ev = sim.out;
  const P = ev.filter(e => e.type === 'P'), Q = ev.filter(e => e.type === 'QRS');
  console.log('\n== ' + name + ' (' + (Date.now() - t0) + ' ms)  P:' + P.length + ' QRS:' + Q.length + ' segs:' + sim.segs.map(s => s.type).join(','));
  let line = '';
  for (const e of ev) {
    if (e.type === 'P') line += ' P' + Math.round(e.t) + (e.kind !== 'sinus' ? '(' + e.kind + ')' : '');
    if (e.type === 'QRS') line += ' Q' + Math.round(e.t) + '[' + e.label + ' ' + Math.round(e.wave.qrs) + ']';
  }
  console.log(line.slice(0, 1500));
  const rr = []; for (let i = 1; i < Q.length; i++) rr.push(Math.round(Q[i].t - Q[i - 1].t));
  console.log('RR:', rr.join(' '));
  return sim;
}
const which = process.argv[2] || 'all';
const T = {
  sinus: () => run('sinus', {}),
  first: () => run('1st degree', { avn: { fast: { min: 190 } } }),
  wenck: () => run('wenckebach', { sinus: { cl: 800, sd: 0, resp: 0 }, avn: { fast: { min: 130, alpha: 1500, tau: 250, erp: 250, erpExit: 330 } } }, 12000),
  mobitz2: () => run('mobitz II', { hps: { blockN: 3, pattern: 'rbbb' } }),
  chb: () => run('CHB', { avn: { fast: { block: true, retro: { block: true } } }, foci: [{ id: 'esc', node: 'V', cl: 1650, site: 'fascPost', label: 'escape' }] }, 9000),
  avnrt: () => run('AVNRT', { avn: { fast: { erp: 360 }, slow: { min: 235, alpha: 260, tau: 110, erp: 240, retro: { delay: 200, erp: 320, block: false } } }, foci: [{ id: 'pac', node: 'A', kind: 'coupled', coupling: 300, every: 4, site: 'crista', count: 1, label: 'PAC' }] }),
  avrt: () => run('AVRT', { ap: { aSite: 'laLateral', vSite: 'mitralLat', delay: 30, erp: 300, retro: { delay: 30, erp: 240 } }, foci: [{ id: 'pac', node: 'A', kind: 'coupled', coupling: 290, every: 4, site: 'crista', count: 1, label: 'PAC' }] }),
  wpw: () => run('WPW sinus', { ap: { aSite: 'laLateral', vSite: 'mitralLat', delay: 30, erp: 300 } }, 4000),
  af: () => run('AF', { atria: { mode: 'fib' }, sinus: { on: false } }, 9000),
  flutter: () => run('flutter', { atria: { mode: 'flutter' }, sinus: { on: false } }, 6000),
  pvc: () => run('bigeminy', { foci: [{ id: 'pvc', node: 'V', kind: 'coupled', coupling: 440, every: 1, after: 'hps', site: 'rvotSeptal', label: 'PVC' }] }),
  vt: () => run('VT', { foci: [{ id: 'vt', node: 'V', cl: 360, site: 'lvInfApical', label: 'VT', startAt: 2500, reentrant: true }], hps: { retro: { block: true } } }),
};
if (which === 'all') for (const k in T) T[k](); else T[which]();
