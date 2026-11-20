// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/valve-logic.js');

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('calculators', () => {
  close(V.bsaMosteller(175, 75), 1.909, 0.001);
  close(V.circleArea(2.0), Math.PI, 1e-9);
  close(V.strokeVolume(2.0, 20), 62.83, 0.01);
  close(V.continuityAVA(2.0, 20, 100), 0.628, 0.001);
  close(V.dimensionlessIndex(20, 100), 0.2);
  assert.equal(V.bernoulli(4), 64);
  // PISA: r 1.0 cm, alias 40 cm/s, MR Vmax 500 cm/s → 2π·1·40/500 = 0.503 cm²
  close(V.pisaEROA(1.0, 40, 500), 0.503, 0.001);
  close(V.regurgVolumeFromEROA(0.5, 150), 75);
  close(V.regurgFraction(40, 100), 40);
  close(V.mvaFromPHT(220), 1.0);
  assert.equal(V.pasp(3, 8), 44);
  assert.equal(V.wilkinsScore({ mobility: 2, thickening: 2, calcification: 1, subvalvular: 2 }), 7);
  assert.equal(V.wilkinsScore({ mobility: 2 }), null);
  assert.equal(V.bsaMosteller('', 70), null);
});

test('numeric grading boundaries (MR)', () => {
  const eroa = V.REGURG_DEFS.MR.params.find((p) => p.key === 'eroa');
  assert.equal(V.gradeNumeric(eroa, 0.19), 1);
  assert.equal(V.gradeNumeric(eroa, 0.2), 2);
  assert.equal(V.gradeNumeric(eroa, 0.39), 2);
  assert.equal(V.gradeNumeric(eroa, 0.4), 3);
});

test('AR vena contracta uses strict >0.6 for severe, PHT is inverse', () => {
  const vc = V.REGURG_DEFS.AR.params.find((p) => p.key === 'vc');
  assert.equal(V.gradeNumeric(vc, 0.6), 2);
  assert.equal(V.gradeNumeric(vc, 0.61), 3);
  const pht = V.REGURG_DEFS.AR.params.find((p) => p.key === 'pht');
  assert.equal(V.gradeNumeric(pht, 600), 1);
  assert.equal(V.gradeNumeric(pht, 500), 2);
  assert.equal(V.gradeNumeric(pht, 200), 2);
  assert.equal(V.gradeNumeric(pht, 150), 3);
});

test('TR extended grades', () => {
  const vc = V.REGURG_DEFS.TR.params.find((p) => p.key === 'vc');
  assert.equal(V.gradeNumeric(vc, 1.0), 3);
  assert.equal(V.gradeNumeric(vc, 1.5), 4);
  assert.equal(V.gradeNumeric(vc, 2.2), 5);
  const r = V.assessRegurg('TR', { vc: 1.6, eroa: 0.7, rvol: 65, hv: 'reversal' });
  assert.equal(r.gradeName, 'Massive');
});

test('concordant severe primary MR', () => {
  const r = V.assessRegurg('MR', { vc: 0.8, eroa: 0.45, rvol: 70, rf: 55, pv: 'reversal', morph: 'flail' });
  assert.equal(r.grade, 3);
  assert.equal(r.confidence, 'High');
  assert.equal(r.discordant, false);
  assert.match(V.reportText(r), /^Severe mitral regurgitation\./);
});

test('moderate MR subgrade', () => {
  const r = V.assessRegurg('MR', { eroa: 0.33, rvol: 50, rf: 42 });
  assert.equal(r.grade, 2);
  assert.equal(r.subgrade, 'moderate-to-severe');
  const r2 = V.assessRegurg('MR', { eroa: 0.22, rvol: 35, rf: 32 });
  assert.equal(r2.subgrade, 'mild-to-moderate');
});

test('discordant MR flagged', () => {
  const r = V.assessRegurg('MR', { vc: 0.2, eroa: 0.45, rvol: 65 });
  assert.equal(r.grade, 3);
  assert.equal(r.discordant, true);
  assert.equal(r.confidence, 'Low');
});

test('MR without quantitative data uses specific signs', () => {
  const r = V.assessRegurg('MR', { vc: 0.5, pv: 'reversal', morph: 'flail' });
  assert.equal(r.grade, 3);
  assert.ok(r.notes.some((n) => /quantitative/.test(n)));
});

test('MR management triggers', () => {
  const r = V.assessRegurg('MR', { eroa: 0.5, rvol: 70, lvef: 55, lvesd: 42, etiology: 'primary' });
  assert.ok(r.management.some((m) => /C2/.test(m)));
});

test('severe AR with holodiastolic reversal', () => {
  const r = V.assessRegurg('AR', { vc: 0.7, pht: 180, desc: 'holo', rvol: 65, rf: 52, lvesd: 52 });
  assert.equal(r.grade, 3);
  assert.ok(r.management.some((m) => /LVESD >50/.test(m)));
});

test('empty input → insufficient data', () => {
  const r = V.assessRegurg('AR', {});
  assert.equal(r.grade, null);
  assert.equal(V.assessAS({}).grade, null);
  assert.equal(V.assessMS({}).grade, null);
});

test('AS high gradient severe', () => {
  const r = V.assessAS({ vmax: 4.5, mg: 48, lvotD: 2.0, lvotVti: 20, avVti: 100, height: 170, weight: 70, lvef: 60 });
  assert.equal(r.gradeName, 'Severe AS');
  assert.equal(r.stage, 'C1');
  close(r.derived.ava, 0.63);
  assert.equal(r.pattern, 'High-gradient');
});

test('AS very severe and symptomatic', () => {
  const r = V.assessAS({ vmax: 5.2, mg: 70, symptomatic: true });
  assert.equal(r.gradeName, 'Very severe AS');
  assert.equal(r.stage, 'D1');
});

test('AS moderate concordant', () => {
  const r = V.assessAS({ vmax: 3.4, mg: 28, ava: 1.2 });
  assert.equal(r.grade, 2);
  assert.equal(r.stage, 'B');
});

test('classical LFLG AS with DSE', () => {
  const base = { vmax: 3.2, mg: 25, ava: 0.8, lvef: 30, symptomatic: true };
  assert.equal(V.assessAS(base).grade, null);
  assert.match(V.assessAS(base).gradeName, /Indeterminate/);
  const t = V.assessAS({ ...base, dse: 'true' });
  assert.equal(t.grade, 3);
  assert.equal(t.stage, 'D2');
  const p = V.assessAS({ ...base, dse: 'pseudo' });
  assert.equal(p.grade, 2);
});

test('paradoxical LFLG AS adjudicated by calcium score', () => {
  // SV = π·(1.9/2)²·15 ≈ 42.5 mL, BSA ~1.9 → SVi ≈ 22
  const inp = { vmax: 3.5, mg: 30, lvotD: 1.9, lvotVti: 15, avVti: 60, height: 175, weight: 75, lvef: 65, sex: 'F', symptomatic: true };
  const r = V.assessAS(inp);
  assert.match(r.pattern, /Paradoxical/);
  assert.equal(r.grade, null);
  const c = V.assessAS({ ...inp, calcium: 1700 });
  assert.equal(c.grade, 3);
  assert.equal(c.stage, 'D3');
});

test('high-gradient AS with large AVA notes high-flow', () => {
  const r = V.assessAS({ vmax: 4.2, mg: 42, ava: 1.3 });
  assert.ok(r.notes.some((n) => /high-flow/.test(n)));
});

test('mitral stenosis grading and PMBC', () => {
  const r = V.assessMS({ planimetry: 1.1, mg: 9, hr: 70, pasp: 55, symptomatic: true,
    mr: 'mild', wilkins: { mobility: 2, thickening: 2, calcification: 2, subvalvular: 1 } });
  assert.equal(r.gradeName, 'Severe MS');
  assert.equal(r.stage, 'D');
  assert.ok(r.management.some((m) => /PMBC recommended/.test(m)));
  const v = V.assessMS({ pht: 240 });
  assert.equal(v.gradeName, 'Very severe MS');
  assert.ok(v.notes.some((n) => /PHT-derived/.test(n)));
  const p = V.assessMS({ planimetry: 1.8 });
  assert.equal(p.stage, 'B');
});
