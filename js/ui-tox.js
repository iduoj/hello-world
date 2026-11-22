/* EP Simulator — Toxicology & electrolytes: ECG patterns of overdose and metabolic disturbance,
 * each with a severity control, the mechanism, and the antidote. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, Mo = EP.Morph, R = EP.Rhythms;
  const lerp = (a, b, t) => a + (b - a) * EP.clamp(t, 0, 1);
  const TN = [48.6, -33.9, 23.6];
  const brugada = (amp) => [{ lead: 6, fn: (ms, jt) => cove(ms, jt, 0.34 * amp) }, { lead: 7, fn: (ms, jt) => cove(ms, jt, 0.46 * amp) }, { lead: 8, fn: (ms, jt) => cove(ms, jt, 0.14 * amp) }];
  function cove(ms, jt, a) { if (ms < -12) return 0; if (ms < 0) return a * (1 + ms / 12); const x = ms / jt; if (x < 0.5) return a * (1 - x / 0.5) - 0.3 * a * EP.smoothstep(0.25, 0.5, x); if (x < 1) return -0.3 * a * (1 - EP.smoothstep(0.5, 0.95, x)); return 0; }

  const T = (EP.Tox = {});
  T.list = [
    { id: 'hyperk', group: 'Electrolytes', name: 'Hyperkalaemia', unit: (s) => 'K⁺ ' + (5.2 + 4.3 * s).toFixed(1) + ' mmol/L', def: 0.45,
      cfg: (s) => ({ sinus: { cl: lerp(850, 1350, (s - 0.3) / 0.7) }, atria: { pAmp: 1 - EP.smoothstep(0.3, 0.68, s) }, avn: { fast: { min: lerp(66, 190, (s - 0.2) / 0.6) } },
        vent: { slow: lerp(1, 3.0, Math.pow(Math.max(0, s - 0.35) / 0.65, 1.3)), mods: { tAmp: lerp(1, 1.2, s / 0.4), tAdd: TN.map((x) => x * (lerp(0, 0.85, s / 0.45) - lerp(0, 0.35, (s - 0.6) / 0.4))), kappa: lerp(0.62, 0.25, s),
          tShape: { p: lerp(0.72, 0.6, s / 0.5), sl: s < 0.6 ? lerp(0.2, 0.085, s / 0.45) : lerp(0.085, 0.24, (s - 0.6) / 0.35), sr: s < 0.6 ? lerp(0.105, 0.075, s / 0.45) : lerp(0.075, 0.16, (s - 0.6) / 0.35) },
          qtc: lerp(412, 390, s), jtScale: lerp(1, 0.4, (s - 0.55) / 0.45), stFrac: lerp(0.03, 0.5, (s - 0.6) / 0.4) } } }),
      teach: { mech: 'Raising extracellular potassium depolarises the resting membrane. At first repolarisation speeds up (tall, narrow T waves). Then sodium channels inactivate: conduction slows everywhere — atria (P waves flatten and vanish, although the sinus node may still drive the ventricles), AV node (long PR) and ventricles (wide QRS) — until QRS and T merge into a sine wave that degenerates to VF or asystole.',
        ecg: ['≈ 5.5–6.5: tall, narrow-based, symmetrical ("tented") T waves, best in V2–V4; short QT.', '≈ 6.5–7.5: PR lengthens, P waves flatten and disappear.', '≈ 7.5–8.5: QRS widens with a bizarre intraventricular conduction delay; bradycardia, junctional or "slow wide" rhythms; pseudo-STEMI and Brugada-like patterns.', '> 8.5: sine wave → VF / asystole. The ECG correlates loosely with the level: some patients arrest with minimal changes.'],
        pearls: ['Any QRS widening or bradycardia: IV calcium NOW — calcium gluconate 30 mL of 10% (or calcium chloride 10 mL of 10% centrally) over 5–10 min; repeat if the ECG has not improved. It stabilises the membrane within minutes and lasts 30–60 min; it does not lower potassium.', 'Shift potassium into cells: insulin 10 units with 25 g dextrose, nebulised salbutamol 10–20 mg; sodium bicarbonate only if acidotic.', 'Remove it: dialysis; loop diuretics if making urine; potassium binders for the slower phase.', 'A wide-complex bradycardia in a dialysis patient is hyperkalaemia until proven otherwise. It also raises pacing thresholds — pacemakers fail to capture.'] } },
    { id: 'hypok', group: 'Electrolytes', name: 'Hypokalaemia', unit: (s) => 'K⁺ ' + (3.6 - 1.7 * s).toFixed(1) + ' mmol/L', def: 0.6,
      cfg: (s) => ({ sinus: { cl: 880 }, vent: { mods: { tAmp: lerp(1, 0.22, s), u: lerp(0, 2.6, s), st: [-0.06 * s, 0.04 * s, -0.03 * s], qtc: lerp(412, 450, s) } },
        foci: s > 0.6 ? [{ id: 'pvc', node: 'V', kind: 'coupled', after: 'hps', coupling: 520, every: 4, site: 'lvInfApical', label: 'PVC' }] : [] }),
      teach: { mech: 'Low extracellular potassium reduces the repolarising potassium currents (IKr falls with low K⁺), prolonging the action potential — especially its tail — and promoting early and delayed after-depolarisations.',
        ecg: ['T waves flatten, then invert; ST segments sag.', 'Prominent U waves (after the T, largest in V2–V3), eventually taller than the T: the "QT" you measure is really a QU interval.', 'Ectopy: PACs, PVCs, then torsades de pointes, especially with digoxin or QT-prolonging drugs.'],
        pearls: ['Replace potassium AND magnesium — hypomagnesaemia makes hypokalaemia refractory (renal potassium wasting).', 'Target K⁺ ≥ 4.0 (4.5–5.0 after torsades or in acute MI), Mg²⁺ ≥ 2.0 mg/dL.', 'Hypokalaemia potentiates digoxin toxicity and every QT-prolonging drug.'] } },
    { id: 'ca', group: 'Electrolytes', name: 'Calcium', unit: (s) => (s < 0.5 ? 'Hypocalcaemia' : 'Hypercalcaemia') + ' · ionised Ca²⁺ ' + (0.7 + 1.3 * s).toFixed(2) + ' mmol/L', def: 0.1,
      cfg: (s) => ({ sinus: { cl: 870 }, vent: { mods: s < 0.5 ? { qtc: lerp(540, 412, s / 0.5), tShape: { p: lerp(0.83, 0.72, s / 0.5), sl: lerp(0.09, 0.2, s / 0.5), sr: lerp(0.07, 0.105, s / 0.5) } } : { qtc: lerp(412, 325, (s - 0.5) / 0.5), tShape: { p: lerp(0.72, 0.5, (s - 0.5) / 0.5), sl: 0.2, sr: 0.13 }, jWave: 0.08 * (s - 0.5) * 2 } } }),
      teach: { mech: 'Calcium sets the length of the action-potential plateau (phase 2), which is the ST segment. Low calcium prolongs the plateau; high calcium shortens it. The T wave itself is little changed.',
        ecg: ['Hypocalcaemia: long QT made of a long, flat ST segment with a normal-width T wave at the end.', 'Hypercalcaemia: short QT — the T wave starts almost at the end of the QRS, with virtually no ST segment; Osborn-like J waves when severe.', 'Compare with hypokalaemia (long QU with flat T) and drug-induced long QT (broad, notched T).'],
        pearls: ['Hypocalcaemia: after thyroid/parathyroid surgery, massive transfusion (citrate), pancreatitis, renal failure. Torsades is uncommon. IV calcium gluconate if symptomatic; correct magnesium.', 'Hypercalcaemia: malignancy, hyperparathyroidism. Fluids, calcitonin, bisphosphonate. Potentiates digoxin.'] } },
    { id: 'cold', group: 'Electrolytes', name: 'Hypothermia', unit: (s) => 'Core ' + (36 - 9 * s).toFixed(0) + ' °C', def: 0.6,
      cfg: (s) => ({ sinus: { cl: lerp(850, 1750, s) }, avn: { fast: { min: lerp(66, 150, s) } }, vent: { slow: lerp(1, 1.45, s), mods: { jWave: lerp(0, 0.62, s), qtc: lerp(412, 540, s) } } }),
      teach: { mech: 'Cold slows every ion channel: pacemaker firing, conduction and repolarisation. A transmural difference in the early repolarisation current (Ito) produces the J (Osborn) wave.',
        ecg: ['Sinus bradycardia, then slow AF.', 'Osborn wave: a positive hump at the J point, largest in the inferior and lateral precordial leads; its size tracks the temperature.', 'Long PR, QRS and QT; shivering artefact on the baseline.', 'Below ≈ 28 °C: VF, which is resistant to defibrillation until rewarmed.'],
        pearls: ['Handle gently — the cold ventricle fibrillates with movement or central lines.', 'Bradycardia and AF usually resolve with rewarming; do not pace or cardiovert them.', 'In arrest < 30 °C: defibrillate up to three times, withhold drugs until > 30 °C, and continue CPR while rewarming (ECMO if available). Not dead until warm and dead.'] } },
    { id: 'tca', group: 'Sodium-channel blockers', name: 'Tricyclic antidepressant overdose', unit: (s) => 'QRS ≈ ' + Math.round(lerp(92, 190, s)) + ' ms', def: 0.6,
      cfg: (s) => ({ sinus: { cl: lerp(640, 480, s), resp: 0 }, avn: { fast: { min: lerp(60, 90, s), erp: 240 } }, hps: { pattern: s < 0.3 ? 'normal' : s < 0.62 ? 'irbbb' : 'rbbb', erp: 250 }, vent: { slow: lerp(1.05, 1.75, s), mods: { qtc: lerp(420, 470, s) } } }),
      teach: { mech: 'Tricyclics block the fast sodium channel (slowing phase 0, so conduction slows — more at faster rates), block muscarinic receptors (tachycardia), alpha-1 receptors (hypotension) and potassium channels (QT). The right bundle is the most sensitive part of the conduction system, so the last part of the QRS points to the right.',
        ecg: ['Sinus tachycardia.', 'QRS > 100 ms predicts seizures; > 160 ms predicts ventricular arrhythmias.', 'Terminal R wave in aVR ≥ 3 mm and R/S in aVR > 0.7; deep slurred S in I and aVL — a rightward terminal 40 ms axis.', 'Progression to a wide-complex tachycardia that may be sinus with aberrancy or VT.'],
        pearls: ['Sodium bicarbonate 1–2 mmol/kg IV boluses, repeated until the QRS narrows; aim for pH 7.50–7.55. Both the sodium load and the alkalinisation help.', 'Hyperventilate if intubated; hypertonic saline if bicarbonate is limited by alkalaemia.', 'Avoid class Ia, Ic and III antiarrhythmics, beta-blockers, phenytoin and physostigmine. Lidocaine for refractory VT; lipid emulsion and ECMO as rescue.', 'The same pattern and the same treatment apply to other sodium-channel blockers: flecainide, cocaine, diphenhydramine, carbamazepine, lamotrigine, quinine/chloroquine, propranolol, bupivacaine.'] } },
    { id: 'flec', group: 'Sodium-channel blockers', name: 'Flecainide: 1:1 atrial flutter', unit: () => 'flutter slowed to 200/min', def: 1, fixed: true,
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'flutter', flutterCL: 300 }, avn: { fast: { erp: 215, conceal: 0.1, min: 70 } }, hps: { pattern: 'rbbb', erp: 220 }, vent: { slow: 1.5 } }),
      teach: { mech: 'Class Ic drugs slow conduction in the flutter circuit from ≈ 300/min to ≈ 200/min. At that slower atrial rate the AV node can conduct every impulse. The same use-dependent sodium-channel block widens the QRS at fast rates — producing a regular wide-complex tachycardia at 200/min that looks like VT.',
        ecg: ['Regular wide-complex tachycardia ≈ 180–220/min in a patient taking flecainide or propafenone for AF.', 'Flutter waves at the same rate as the QRS (1:1) — hard to see.', 'QRS narrows and the rate halves if the AV node is slowed.'],
        pearls: ['Prevention: always co-prescribe a beta-blocker or rate-limiting calcium-channel blocker with a class Ic drug.', 'Unstable → synchronised cardioversion. Stable → AV-nodal blockade; sodium bicarbonate for the QRS widening in overdose.', 'Class Ic drugs are contraindicated in structural or ischaemic heart disease (CAST).'] } },
    { id: 'brugada', group: 'Sodium-channel blockers', name: 'Brugada pattern unmasked', unit: () => 'type 1 (coved) pattern', def: 1, fixed: true,
      cfg: () => ({ sinus: { cl: 900 }, hps: { pattern: 'irbbb' }, vent: { mods: { leadAdd: brugada(1), qtc: 410 } } }),
      teach: { mech: 'A reduced sodium current (SCN5A variants, or drugs) leaves the transient outward current unopposed in the right ventricular outflow tract epicardium. The resulting transmural voltage gradient produces ST elevation in V1–V2 and can trigger phase-2 re-entry → polymorphic VT / VF.',
        ecg: ['Type 1: coved ST elevation ≥ 2 mm in V1 and/or V2 descending into an inverted T wave. This is the only diagnostic pattern.', 'Type 2: "saddle-back" ST elevation — suggestive only.', 'Moving V1–V2 up to the 2nd or 3rd intercostal space increases sensitivity.', 'Unmasked by fever, sodium-channel blockers (flecainide, ajmaline, TCAs, cocaine, lithium), alcohol, large meals, vagal tone.'],
        pearls: ['Treat fever aggressively; avoid the drugs listed at brugadadrugs.org.', 'Electrical storm: isoprenaline infusion and quinidine. Amiodarone and sodium-channel blockers make it worse.', 'ICD for survivors of arrest or arrhythmic syncope with a spontaneous type 1 pattern.'] } },
    { id: 'dig', group: 'Digoxin', name: 'Digoxin effect and toxicity', unit: () => '', def: 0, variants: [['effect', 'Therapeutic effect'], ['big', 'Ventricular bigeminy'], ['atb', 'Atrial tachycardia with block'], ['regaf', 'Regularised AF'], ['bidir', 'Bidirectional VT']],
      cfg: (s, v) => {
        const scoop = { st: [-0.17, 0.125, 0.03], stShape: 'scoop', tAmp: 0.35, qtc: 365 };
        if (v === 'big') return { sinus: { cl: 950, resp: 0 }, avn: { fast: { min: 120, retro: { block: true } } }, vent: { mods: scoop }, foci: [{ id: 'p', node: 'V', kind: 'coupled', after: 'hps', coupling: 480, every: 1, site: 'fascPost', label: 'PVC' }] };
        if (v === 'atb') return { sinus: { on: false }, avn: { fast: { erp: 560, conceal: 0.2, min: 150 } }, vent: { mods: scoop }, foci: [{ id: 'at', node: 'A', cl: 345, site: 'crista', label: 'AT', startAt: 100 }] };
        if (v === 'regaf') return { sinus: { on: false }, atria: { mode: 'fib', fibAmp: 0.8 }, avn: { fast: { block: true, retro: { block: true } } }, vent: { mods: scoop }, foci: [{ id: 'j', node: 'H', cl: 1040, label: 'junctional', startAt: 300 }] };
        if (v === 'bidir') return { sinus: { cl: 900 }, avn: { fast: { retro: { block: true } } }, hps: { retro: { delay: 30, erp: 200 } }, foci: [{ id: 'vt', node: 'V', cl: 400, specs: [Mo.spec('fascPost'), Mo.spec('fascAnt')], label: 'VT', startAt: 60 }] };
        return { sinus: { cl: 980 }, avn: { fast: { min: 118 } }, vent: { mods: scoop } };
      },
      teach: { mech: 'Digoxin inhibits the Na⁺/K⁺-ATPase: intracellular calcium rises (inotropy — and delayed after-depolarisations, hence triggered automaticity) and vagal tone increases (slower sinus rate and AV conduction). Toxicity is therefore the combination of INCREASED automaticity with DEPRESSED conduction.',
        ecg: ['Effect (not toxicity): down-sloping "scooped" ST depression with a short QT and flattened T — the reverse-tick or Salvador Dalí moustache — and a longish PR.', 'Toxicity — excitation: frequent PVCs and bigeminy (commonest), atrial tachycardia, accelerated junctional rhythm, fascicular VT, bidirectional VT (the QRS axis alternates beat to beat).', 'Toxicity — depression: sinus bradycardia, AV block of any degree.', 'The combinations are nearly pathognomonic: atrial tachycardia WITH block; AF that has become slow and perfectly regular (complete AV block with a junctional escape).'],
        pearls: ['Digoxin-specific antibody fragments for life-threatening arrhythmia, K⁺ > 5.0–5.5 in acute overdose, or end-organ dysfunction.', 'In acute overdose hyperkalaemia marks severity (the pump is poisoned); in chronic toxicity hypokalaemia and hypomagnesaemia are usually the precipitants — correct them.', 'Atropine for bradycardia. Lidocaine (or phenytoin) for ventricular arrhythmias. Avoid cardioversion if possible — it can precipitate refractory VF; if unavoidable use the lowest energy.', 'Precipitants: renal impairment, dehydration, amiodarone, verapamil, macrolides, hypokalaemia.'] } },
    { id: 'bbccb', group: 'Rate-slowing drugs', name: 'Beta-blocker / calcium-channel blocker overdose', unit: (s) => (s < 0.75 ? 'sinus ' + Math.round(60000 / lerp(900, 1750, s / 0.75)) + '/min' : 'junctional escape'), def: 0.5,
      cfg: (s) => (s < 0.75 ? { sinus: { cl: lerp(900, 1750, s / 0.75), resp: 0.01 }, avn: { fast: { min: lerp(70, 260, s / 0.75) } } } : { sinus: { cl: 2600, startAt: 20000 }, avn: { fast: { min: 300, retro: { delay: 150, erp: 300 } } }, foci: [{ id: 'j', node: 'H', cl: lerp(1500, 1900, (s - 0.75) / 0.25), label: 'junctional', startAt: 400 }] }),
      teach: { mech: 'Both classes depress the L-type calcium current that drives the sinus and AV nodes (beta-blockers by removing cAMP, verapamil and diltiazem directly), and reduce contractility. Dihydropyridines mainly vasodilate. In large overdose all selectivity is lost.',
        ecg: ['Sinus bradycardia → PR prolongation → higher-grade AV block → junctional or ventricular escape → asystole.', 'Verapamil / diltiazem: bradycardia with AV block and profound hypotension; hyperglycaemia (insulin release is calcium-dependent) helps tell it from beta-blocker poisoning (hypoglycaemia, bronchospasm).', 'Propranolol adds sodium-channel block (wide QRS, seizures); sotalol adds a long QT and torsades.'],
        pearls: ['Atropine is worth a try but usually fails.', 'IV calcium (10–20 mL of 10% calcium chloride, or 30–60 mL gluconate; repeat/infuse).', 'High-dose insulin euglycaemia therapy is the main treatment for shock: 1 unit/kg bolus then 1–10 units/kg/h with dextrose and potassium monitoring. Onset 15–40 min.', 'Glucagon 5–10 mg IV for beta-blockers (bypasses the receptor; expect vomiting). Vasopressors: norepinephrine ± epinephrine.', 'Pacing often captures electrically without improving pressure — the problem is contractility and vasodilation. Lipid emulsion for lipophilic agents; VA-ECMO for refractory shock.'] } },
    { id: 'qt', group: 'QT-prolonging drugs', name: 'Acquired long QT', unit: (s) => 'QTc ≈ ' + Math.round(lerp(440, 640, s)) + ' ms' + (s > 0.8 ? ' → torsades' : ''), def: 0.6,
      cfg: (s) => {
        const mods = { qtc: lerp(440, 640, s), tShape: { p: lerp(0.72, 0.76, s), sl: lerp(0.2, 0.27, s), sr: 0.12 }, u: lerp(0, 1.1, s), tAmp: lerp(1, 0.85, s) };
        const c = { sinus: { cl: lerp(900, 1180, s), resp: 0, sd: 0 }, vent: { mods } };
        if (s > 0.8) c.script = R.onBeats([{ beat: 2, coupling: 560, site: 'lvInfApical' }, { beat: 'next', coupling: 610, site: 'lvAntWall', then: (sm, t) => { sm.schedule(t + 150, (tt) => sm.setVentMode('tdp', tt)); sm.schedule(t + 4200, (tt) => sm.setVentMode('normal', tt)); } }]);
        return c;
      },
      teach: { mech: 'Almost every culprit blocks the hERG potassium channel (IKr), delaying repolarisation. The longer and more uneven the repolarisation, the more likely an early after-depolarisation is to reach threshold and trigger torsades de pointes.',
        ecg: ['QTc > 500 ms, or an increase > 60 ms from baseline, is the action threshold.', 'Broad, notched or bifid T waves, prominent U waves, T-U alternans; the QT lengthens further after a pause.', 'Measure in II or V5–V6, use the longest, and correct with Fridericia at fast or slow rates.', 'Slide to the right to see the short-long-short sequence start torsades.'],
        pearls: ['Common drugs: sotalol, dofetilide, ibutilide, quinidine, procainamide; haloperidol, droperidol, ziprasidone; methadone; macrolides and fluoroquinolones; azoles; ondansetron; citalopram/escitalopram; chloroquine. See crediblemeds.org.', 'Risk multiplies with female sex, bradycardia, hypokalaemia, hypomagnesaemia, renal or hepatic impairment, heart failure, and drug combinations.', 'Stop the drug. Magnesium 2 g IV (even with a normal level), potassium to 4.5–5.0, and raise the heart rate (overdrive pacing 90–110 or isoprenaline) for recurrent torsades.', 'Amiodarone prolongs the QT a lot but rarely causes torsades.'] } },
  ];
  T.byId = {}; for (const t of T.list) T.byId[t.id] = t;

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'tox', title: 'Tox & electrolytes',
    mount(root) {
      let cur = null, sev = 0.5, variant = null, timer = 0;
      const player = new EP.Player({ layout: '12', ladder: false });
      const rail = h('nav.card.rail', { 'aria-label': 'Conditions' }), listEl = h('div', { style: { paddingBottom: '8px' } }); rail.append(listEl);
      const groups = [...new Set(T.list.map((t) => t.group))];
      const sel = UI.select(null, groups.map((g) => ({ group: g, items: T.list.filter((t) => t.group === g).map((t) => [t.id, t.name]) })), 'hyperk', (v) => show(v));
      sel.classList.add('rail-sel'); sel.setAttribute('aria-label', 'Condition');
      const ctl = h('div.card-b'), meas = h('div'), head = h('div.card-h'), teach = h('div.card-b');
      function fill() { listEl.innerHTML = ''; for (const g of groups) { listEl.append(h('div.rail-g', g)); for (const t of T.list.filter((x) => x.group === g)) listEl.append(h('button.rail-i', { type: 'button', 'aria-current': String(cur === t), onclick: () => show(t.id) }, t.name)); } }
      function render(keepT) {
        const sim = EP.simulate(cur.cfg(sev, variant), 10000), rec = EP.Synth.build(sim, 0, 10000); rec.sim = sim; rec.entry = cur;
        player.load(rec, { title: cur.name + (cur.unit(sev) ? ' — ' + cur.unit(sev) : ''), t: keepT ? player.t : null });
        const m = R.measure(rec);
        meas.innerHTML = ''; meas.append(UI.kv([['Rate', m.vRate, '/min'], ['PR', m.pr, 'ms'], ['QRS', m.qrs, 'ms'], ['QT / QTc', m.qt == null ? null : m.qt + ' / ' + m.qtc, 'ms'], ['Axis', m.axis == null ? null : m.axis + '°']]));
      }
      function show(id) {
        cur = T.byId[id] || T.list[0]; sev = cur.def; variant = cur.variants ? cur.variants[0][0] : null;
        if (sel.sel) sel.sel.value = cur.id; else sel.value = cur.id;
        ctl.innerHTML = '';
        const out = h('b.mono', cur.unit(sev));
        if (cur.variants) ctl.append(h('div.variants', cur.variants.map(([k, t], i) => { const b = h('button.btn.sm', { type: 'button', 'aria-pressed': String(i === 0), onclick: () => { variant = k; for (const x of b.parentNode.children) x.setAttribute('aria-pressed', String(x === b)); render(); } }, t); return b; })));
        else if (!cur.fixed) {
          const rng = h('input', { type: 'range', min: 0, max: 1, step: 0.02, value: sev, 'aria-label': 'Severity', style: { flex: '1', minWidth: '160px' }, oninput: () => { sev = +rng.value; out.textContent = cur.unit(sev); clearTimeout(timer); timer = setTimeout(() => render(true), 90); } });
          ctl.append(h('div.row', h('span.muted', 'Normal'), rng, h('span.muted', 'Severe'), out), h('p.muted', { style: { fontSize: '12px', marginTop: '6px' } }, 'Drag to move through the stages; the 12-lead is regenerated from the changed conduction and repolarisation.'));
        } else ctl.append(h('div', out));
        head.innerHTML = ''; head.append(h('div', h('div.eyebrow', cur.group), h('h2', { style: { fontSize: '17px' } }, cur.name)));
        teach.innerHTML = ''; teach.append(UI.teach(cur.teach));
        fill(); render();
      }
      root.append(h('div.lab', rail, h('div.stack', sel, h('section.card', ctl), player.ecgCard, meas, h('section.card', head, teach)),
        h('div.side', player.heartCard || h('div'), h('div.note', 'For any poisoned patient: a 12-lead early and repeated, continuous monitoring, potassium/magnesium/glucose, and a call to the poisons service. Doses here are typical adult figures for teaching — check local guidance.'))));
      show('hyperk');
      return { unmount() { player.destroy(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
