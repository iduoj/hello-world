// Dev: pacemaker timing checks — prints the marker channel for a few patient/device combinations.
for (const f of ['util', 'geometry', 'model', 'morph', 'heartsim', 'synth', 'rhythms', 'device']) require('../js/' + f + '.js');
const EP = globalThis.EP;
function run(name, cfg, pm, dur, hook) {
  const sim = new EP.HeartSim(cfg), dev = new EP.Pacemaker(sim, pm);
  if (hook) hook(sim, dev);
  sim.runUntil(dur || 6000);
  let s = '';
  for (const e of sim.out) {
    if (e.type === 'mark') s += ' ' + e.text + Math.round(e.t);
    if (e.type === 'QRS') s += ' [' + e.label + ']';
    if (e.type === 'spike' && !e.captured) s += '(nc)';
  }
  console.log('\n== ' + name + '\n' + s.slice(0, 900));
  console.log('stats', JSON.stringify(dev.stats));
}
const CHB = { avn: { fast: { block: true, retro: { block: true } } }, foci: [{ id: 'esc', node: 'V', cl: 1800, site: 'fascPost', label: 'escape', startAt: 900 }] };
run('CHB + DDD (track)', Object.assign({ sinus: { cl: 800 } }, CHB), { mode: 'DDD' });
run('sinus brady 40 + DDD', { sinus: { cl: 1500 } }, { mode: 'DDD', lrl: 60 });
run('CHB + VVI 60', Object.assign({ sinus: { cl: 800 } }, CHB), { mode: 'VVI' });
run('sinus 110 CHB DDD url 100 (Wenckebach URB)', Object.assign({ sinus: { cl: 545, resp: 0, sd: 0 } }, CHB), { mode: 'DDD', url: 100, pvarp: 200, avdS: 120 }, 7000);
run('sinus 150 CHB DDD (2:1)', Object.assign({ sinus: { cl: 400, resp: 0, sd: 0 } }, CHB), { mode: 'DDD', url: 130, pvarp: 300, avdS: 150 }, 5000);
run('VVI failure to capture', Object.assign({ sinus: { cl: 800 } }, CHB), { mode: 'VVI', vOut: 0.5, vThr: 1.2 });
run('VVI undersensing, sinus 70', { sinus: { cl: 850 } }, { mode: 'VVI', lrl: 60, vSens: 12 });
run('AF + DDD (mode switch)', Object.assign({ sinus: { on: false }, atria: { mode: 'fib' } }, { avn: { fast: { erp: 500, conceal: 0.2 } } }), { mode: 'DDD' }, 8000);
run('PMT', { sinus: { cl: 1000, resp: 0 }, avn: { fast: { retro: { delay: 190, erp: 250 } } }, foci: [{ id: 'pvc', node: 'V', kind: 'coupled', coupling: 600, every: 3, count: 1, site: 'rvotSeptal', label: 'PVC', after: 'pace' }] }, { mode: 'DDD', lrl: 60, url: 120, pvarp: 200, avdS: 140, avdP: 160 }, 9000);
