// Dev: run every library rhythm and print a one-line summary (catches exceptions and odd rates).
for (const f of ['util', 'geometry', 'model', 'morph', 'heartsim', 'synth', 'rhythms']) require('../js/' + f + '.js');
const EP = globalThis.EP, R = EP.Rhythms;
const only = process.argv[2];
for (const r of R.list) {
  if (only && r.id !== only) continue;
  try {
    const t = Date.now();
    const rec = R.record(r), m = R.measure(rec);
    const q = rec.events.filter(e => e.type === 'QRS'), p = rec.events.filter(e => e.type === 'P');
    const labels = {}; for (const e of q) labels[e.label] = (labels[e.label] || 0) + 1;
    let extra = '';
    if (only) { extra = '\n  ' + rec.events.filter(e => e.type === 'P' || e.type === 'QRS').map(e => (e.type === 'P' ? 'P' + Math.round(e.t) + (e.kind !== 'sinus' ? '(' + e.kind + ')' : '') : 'Q' + Math.round(e.t) + '[' + e.label + ' ' + Math.round(e.wave.qrs) + ']')).join(' '); }
    console.log(r.id.padEnd(12), 'V', String(m.vRate).padStart(4), 'A', String(m.aRate).padStart(8), 'PR', String(m.pr).padStart(4), 'QRS', String(m.qrs).padStart(4), 'QTc', String(m.qtc).padStart(4), 'P#', String(p.length).padStart(2), JSON.stringify(labels), 'segs', rec.segs.map(s => s.type).join(','), (Date.now() - t) + 'ms' + extra);
  } catch (e) { console.log(r.id.padEnd(12), 'ERROR', e.stack.split('\n').slice(0, 3).join(' | ')); }
}
