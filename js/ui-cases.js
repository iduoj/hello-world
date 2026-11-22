/* EP Simulator — Clinical scenarios: pharmacological vs electrical management.
 * A live monitor, a set of interventions, and a simulated physiological response to each. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, Mo = EP.Morph, R = EP.Rhythms;
  const lqt = { qtc: 600, tShape: { p: 0.74, sl: 0.25, sr: 0.12 }, u: 0.9 };

  const ACT = {
    vagal: ['Modified Valsalva', 'Manoeuvre'], adenosine: ['Adenosine 6 → 12 mg IV', 'Drug'], bb: ['Metoprolol 5 mg IV', 'Drug'], ccb: ['Diltiazem 20 mg IV', 'Drug'],
    amio: ['Amiodarone 150 mg IV', 'Drug'], procain: ['Procainamide 15 mg/kg IV', 'Drug'], lido: ['Lidocaine 1 mg/kg IV', 'Drug'], mag: ['Magnesium 2 g IV', 'Drug'],
    atropine: ['Atropine 1 mg IV', 'Drug'], epi: ['Epinephrine / dopamine infusion', 'Drug'], bicarb: ['Sodium bicarbonate 100 mmol IV', 'Drug'], calcium: ['Calcium gluconate 30 mL 10% IV', 'Drug'],
    insulin: ['Insulin 10 U + dextrose 25 g', 'Drug'], digoxin: ['Digoxin 500 µg IV', 'Drug'], potassium: ['Replace potassium', 'Drug'],
    cardiovert: ['Synchronised cardioversion', 'Electricity'], defib: ['Defibrillation (unsynchronised)', 'Electricity'], tcp: ['Transcutaneous pacing', 'Electricity'], overdrive: ['Overdrive pacing 100/min', 'Electricity'],
    stopdrug: ['Stop QT-prolonging drugs', 'Other'], observe: ['Observe and treat the cause', 'Other'],
  };
  // ---- reusable effects (compressed in time for teaching) ----
  const fx = {
    avBlock: (ms) => (s, t) => s.blockAVN(t + 500, ms),
    shock: (sync) => (s, t) => s.shock(t + 700, { sync }),
    slowAVN: (s, t) => { let k = 0; const step = (tt) => { s.cfg.avn.fast.erp += 55; s.cfg.avn.fast.conceal = 0.2; if (++k < 5) s.schedule(tt + 700, step); }; s.schedule(t + 800, step); },
    stopVT: (delay, slowFirst) => (s, t) => { const f = s.foci.find((x) => x.reentrant && x.enabled); if (!f) return; if (slowFirst) s.schedule(t + 900, () => { f.cl += slowFirst; }); s.schedule(t + delay, () => { f.enabled = false; }); },
    vf: (delay) => (s, t) => s.schedule(t + delay, (tt) => s.setVentMode('vf', tt)),
    pace: (rate, cap) => (s, t) => { s.schedule(t + 600, () => { s._pm = new EP.Pacemaker(s, { mode: 'VVI', lrl: rate, kind: 'tcp', tcpArtifact: true, vOut: 80, vThr: cap ? 60 : 200, vSite: 'rvFreeWall' }); }); },
    sinusFaster: (s) => { if (s.sinus) s.sinus.cl *= 0.72; },
  };
  const bpTable = (rows, dflt) => (hr, sim) => { if (sim.V.mode === 'vf') return [0, 0]; if (sim.V.mode !== 'normal') return [52, 30]; if (sim._collapse) return [58, 34]; for (const [lo, hi, bp] of rows) if (hr >= lo && hr < hi) return bp; return dflt; };
  const sinusBack = (sim, t) => sim.V.mode === 'normal' && sim.A.mode === 'normal' && sim.out.filter((e) => e.type === 'QRS' && e.t > t - 3600 && e.t < t - 150).every((e) => e.label === 'conducted' && e.rr > 520 && e.wave.qrs < 125) && sim.out.filter((e) => e.type === 'QRS' && e.t > t - 3600).length >= 3;

  const CASES = [
    { id: 'avnrt', title: 'Palpitations in a 28-year-old', stem: 'Sudden-onset regular palpitations for 40 minutes. Alert, talking, mildly anxious. SpO₂ 99%.', stable: true,
      cfg: () => ({ sinus: { cl: 800, resp: 0 }, avn: { fast: { erp: 365 }, slow: { min: 205, alpha: 150, tau: 80, erp: 235, conceal: 0, retro: { delay: 200, erp: 330, block: false } } }, foci: [{ id: 'pac', node: 'A', kind: 'coupled', after: 'sinus', coupling: 305, every: 2, site: 'crista', count: 1, label: 'PAC' }] }),
      bp: bpTable([[150, 400, [112, 70]]], [122, 76]), done: sinusBack,
      acts: { vagal: ['good', 'First line for a stable regular narrow-complex tachycardia. The modified Valsalva (strain 15 s semi-recumbent, then lie flat with legs raised) converts about 40%.', (s, t) => { if (s.rng() < 0.45) s.blockAVN(t + 600, 900); }],
        adenosine: ['good', 'Blocks the AV node for a few seconds. The node is part of the circuit, so the tachycardia stops — watch for the brief pause, then sinus rhythm. Warn the patient about chest tightness and flushing; give it fast through a large proximal vein with a flush.', fx.avBlock(2600)],
        ccb: ['ok', 'Works (it also blocks the node) and lasts longer — a reasonable second line if adenosine fails or the tachycardia recurs. Avoid in heart failure or hypotension.', fx.avBlock(3200)],
        bb: ['ok', 'Slows and can terminate AV-nodal re-entry; second line.', fx.avBlock(3000)],
        cardiovert: ['ok', 'It will work, but a stable patient does not need sedation and a shock before trying vagal manoeuvres and adenosine.', fx.shock(true)],
        amio: ['bad', 'Not indicated: a slow-acting drug with real toxicity for a rhythm that a 10-second AV-nodal block will cure.', null] },
      debrief: ['Regular, narrow, abrupt onset, no visible P waves (or a pseudo-r′ in V1): AVNRT or AVRT. Both depend on the AV node.', 'Stable → vagal manoeuvre → adenosine → rate-limiting calcium-channel blocker or beta-blocker. Unstable → synchronised cardioversion.', 'Record a 12-lead during termination: how it stops is diagnostic.'] },
    { id: 'afun', title: 'Breathless with a fast irregular pulse', stem: '74-year-old, 2 hours of dyspnoea. Sitting upright, sweaty, crackles to mid-zones, cold peripheries. SpO₂ 86% on 15 L.', stable: false,
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 125 }, avn: { fast: { erp: 215, conceal: 0.25, min: 58 } } }),
      bp: bpTable([[140, 400, [74, 46]], [110, 140, [92, 58]]], [116, 70]), done: sinusBack,
      acts: { cardiovert: ['good', 'Hypotension and pulmonary oedema caused by the tachyarrhythmia = unstable. Synchronised cardioversion (120–200 J biphasic for AF) is the treatment; sedate if you can do so quickly. Unknown duration does not delay a life-saving shock — anticoagulate afterwards.', fx.shock(true)],
        ccb: ['bad', 'Diltiazem is a negative inotrope and vasodilator: in a hypotensive patient in pulmonary oedema it deepens the shock.', (s) => { s._collapse = true; }],
        bb: ['bad', 'A negative inotrope in acute pulmonary oedema with hypotension. The rate may fall but so does the output.', (s) => { s._collapse = true; }],
        amio: ['ok', 'Acceptable if cardioversion is unavailable or fails, but it takes hours and the patient is deteriorating now.', fx.slowAVN],
        digoxin: ['bad', 'Too slow (hours) for an unstable patient.', null], adenosine: ['bad', 'Only transient AV block; AF continues. No benefit.', fx.avBlock(1800)] },
      debrief: ['Unstable = hypotension, pulmonary oedema, ischaemic chest pain or reduced consciousness that is caused by the rhythm. The treatment is electricity regardless of the specific tachycardia.', 'Synchronise on the R wave: an unsynchronised shock on the T wave can cause VF.', 'After cardioversion of AF: anticoagulate for at least 4 weeks whatever the CHA₂DS₂-VASc score.'] },
    { id: 'afst', title: 'Irregular tachycardia found at pre-op clinic', stem: '68-year-old with hypertension, feels "a bit fluttery" for perhaps a week. Comfortable. SpO₂ 97%.', stable: true,
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 135 }, avn: { fast: { erp: 250, conceal: 0.3, min: 60 } } }),
      bp: bpTable([[0, 400, [134, 82]]], [134, 82]), done: (sim, t) => { const q = sim.out.filter((e) => e.type === 'QRS' && e.t > t - 5000); return sim._rated && q.length > 2 && 60000 / ((q[q.length - 1].t - q[0].t) / (q.length - 1)) < 108; },
      acts: { bb: ['good', 'Stable AF of uncertain duration: control the rate (beta-blocker or diltiazem) and start anticoagulation by CHA₂DS₂-VASc. Rhythm control can be planned safely later.', (s, t) => { s._rated = true; fx.slowAVN(s, t); }],
        ccb: ['good', 'Rate control with a rate-limiting calcium-channel blocker — appropriate when LV function is preserved.', (s, t) => { s._rated = true; fx.slowAVN(s, t); }],
        cardiovert: ['bad', 'He is stable and the AF has lasted more than 48 hours without anticoagulation: left atrial appendage thrombus is possible. Cardioversion now risks stroke — anticoagulate for 3 weeks or exclude thrombus by TEE first.', fx.shock(true)],
        amio: ['bad', 'Pharmacological cardioversion carries the same embolic risk as electrical cardioversion.', null],
        adenosine: ['bad', 'Transiently slows the ventricles and shows the fibrillatory baseline; it does not treat AF.', fx.avBlock(1800)],
        digoxin: ['ok', 'Controls resting rate slowly; useful in heart failure or the sedentary, weak on exertion.', (s, t) => { s._rated = true; fx.slowAVN(s, t); }] },
      debrief: ['Three separate questions in AF: is the patient unstable (shock)? what is the stroke risk (anticoagulate)? rate or rhythm strategy?', 'The 48-hour rule: beyond it, no elective cardioversion — electrical or chemical — without 3 weeks of anticoagulation or a TEE.', 'Lenient rate control (resting < 110/min) is adequate for most.'] },
    { id: 'wpwaf', title: 'Very fast, broad and irregular', stem: '22-year-old collapsed at a party; now awake, light-headed. Previously told he had "an extra wire". SpO₂ 98%.', stable: true,
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 120 }, avn: { fast: { erp: 330, conceal: 0.4 } }, ap: R.apCfg('leftLateral', { erp: 215 }) }),
      bp: bpTable([[190, 400, [92, 56]], [120, 190, [104, 64]]], [120, 72]), done: sinusBack,
      acts: { procain: ['good', 'Procainamide slows conduction and prolongs refractoriness in the accessory pathway: the pre-excited rate falls and AF often terminates. (Ibutilide is the alternative.)', (s, t) => { s.schedule(t + 1500, () => { s.cfg.ap.erp = 420; }); s.schedule(t + 3800, () => { s.cfg.ap.block = true; s.cfg.ap.retro.block = true; }); s.schedule(t + 6500, (tt) => s.setAtrialMode('normal', tt)); }],
        cardiovert: ['good', 'Always correct for pre-excited AF, and mandatory if there is any instability.', fx.shock(true)],
        adenosine: ['bad', 'Blocking the AV node removes its competing (and concealed retrograde) input to the pathway, and adenosine shortens atrial refractoriness. Every fibrillatory impulse now goes down the pathway → ventricular fibrillation.', (s, t) => { s.cfg.avn.fast.block = true; s.cfg.ap.erp = 175; fx.vf(3200)(s, t); }],
        ccb: ['bad', 'Verapamil and diltiazem block the node and vasodilate (reflex sympathetic drive shortens the pathway\'s refractory period): faster pre-excited conduction → VF.', (s, t) => { s.cfg.avn.fast.block = true; s.cfg.ap.erp = 175; fx.vf(3400)(s, t); }],
        bb: ['bad', 'An AV-nodal blocker: it does nothing to the pathway and removes the node\'s protective competition.', (s, t) => { s.cfg.avn.fast.block = true; s.cfg.ap.erp = 190; fx.vf(5200)(s, t); }],
        digoxin: ['bad', 'Blocks the node AND shortens the accessory pathway refractory period. Contraindicated.', (s, t) => { s.cfg.avn.fast.block = true; s.cfg.ap.erp = 170; fx.vf(3600)(s, t); }],
        amio: ['bad', 'IV amiodarone acts first as an AV-nodal blocker and vasodilator; cases of VF are reported. Avoid in pre-excited AF.', (s, t) => { s.cfg.avn.fast.block = true; s.cfg.ap.erp = 185; fx.vf(5600)(s, t); }],
        defib: ['ok', 'Unsynchronised shock is the treatment once he is in VF. For AF with a pulse, synchronise.', fx.shock(false)] },
      debrief: ['FBI — Fast, Broad, Irregular — is pre-excited AF until proven otherwise. The QRS width varies beat to beat and the shortest R-R can be under 250 ms.', 'Never give AV-nodal blockers. Procainamide or ibutilide if stable; synchronised cardioversion if not.', 'A pathway that can conduct this fast needs ablation.'] },
    { id: 'vtst', title: 'Regular wide-complex tachycardia, talking', stem: '66-year-old, anterior MI 4 years ago, EF 30%. Palpitations and mild dizziness for 30 minutes. Alert. SpO₂ 96%.', stable: true,
      cfg: () => ({ sinus: { cl: 780, resp: 0 }, avn: { fast: { retro: { block: true } } }, hps: { retro: { delay: 60, erp: 200 } }, foci: [{ id: 'vt', node: 'V', cl: 345, site: 'lvInfBase', label: 'VT', startAt: 60, reentrant: true }] }),
      bp: bpTable([[150, 400, [106, 66]]], [124, 76]), done: sinusBack,
      acts: { procain: ['good', 'Best evidence for stable monomorphic VT (PROCAMIO): slows and terminates the circuit. Watch blood pressure and QRS/QT; avoid in severe heart failure or long QT.', fx.stopVT(4200, 70)],
        amio: ['good', 'Reasonable, especially with poor LV function, though it terminates VT less often and more slowly than procainamide.', fx.stopVT(6500, 45)],
        cardiovert: ['good', 'Sedation and synchronised cardioversion is definitive and appropriate at any point — and the default if drugs fail or he deteriorates.', fx.shock(true)],
        lido: ['ok', 'Second line; most useful in ischaemic VT. Low efficacy for scar-related VT.', (s, t) => { if (s.rng() < 0.3) fx.stopVT(4000)(s, t); }],
        adenosine: ['ok', 'Safe in a REGULAR monomorphic wide-complex tachycardia and can be diagnostic: no change here, which supports VT. It does not treat it.', fx.avBlock(2200)],
        ccb: ['bad', 'Calcium-channel blockers given for "SVT with aberrancy" to a patient in VT cause vasodilatation and negative inotropy → cardiovascular collapse.', (s, t) => { s._collapse = true; fx.vf(6000)(s, t); }],
        bb: ['ok', 'Not a terminating drug here, but beta-blockade is central to preventing recurrence and to treating electrical storm.', null],
        defib: ['bad', 'He has a pulse and an organised rhythm: synchronise. An unsynchronised shock risks VF.', fx.vf(900)] },
      debrief: ['A wide-complex tachycardia in someone with structural heart disease is VT. Being awake with a blood pressure does not make it SVT.', 'Stable monomorphic VT: procainamide, amiodarone, or elective synchronised cardioversion. Never verapamil or diltiazem.', 'Look for AV dissociation, capture and fusion beats to confirm; then think about the trigger (ischaemia, electrolytes) and an ICD.'] },
    { id: 'vtun', title: 'Wide-complex tachycardia with chest pain', stem: '59-year-old, crushing chest pain, grey and clammy, responds to voice only. SpO₂ unrecordable.', stable: false,
      cfg: () => ({ sinus: { cl: 700, resp: 0 }, avn: { fast: { retro: { block: true } } }, hps: { retro: { delay: 60, erp: 180 } }, foci: [{ id: 'vt', node: 'V', cl: 280, site: 'lvAntWall', label: 'VT', startAt: 60, reentrant: true }] }),
      bp: bpTable([[170, 400, [66, 38]]], [108, 64]), done: sinusBack,
      acts: { cardiovert: ['good', 'Unstable VT with a pulse: immediate synchronised cardioversion, 100–200 J biphasic, escalating. Do not wait for IV access or drugs.', fx.shock(true)],
        defib: ['ok', 'If synchronisation fails or delays you in a peri-arrest patient, an unsynchronised shock is acceptable — and it is the treatment the moment the pulse is lost.', fx.shock(false)],
        amio: ['bad', 'A 10-minute infusion in a patient who is about to arrest. Drugs come after the shock, to prevent recurrence.', null],
        procain: ['bad', 'Vasodilating and slow to give — contraindicated in hypotension.', (s) => { s._collapse = true; }],
        adenosine: ['bad', 'Wastes time; no effect on VT.', null], lido: ['bad', 'Too slow and too weak for an unstable patient.', null] },
      debrief: ['Unstable tachycardia with a pulse → synchronised cardioversion. No pulse → defibrillate and start CPR.', 'After return of an organised rhythm: amiodarone, correct potassium and magnesium, and treat the cause — here probably acute coronary occlusion.'] },
    { id: 'tdp', title: 'Recurrent syncope on the ward', stem: '61-year-old woman on methadone, started ondansetron and clarithromycin 2 days ago. Vomiting. K⁺ 3.0, Mg²⁺ 1.4 mg/dL. Brief blackouts.', stable: true,
      cfg: () => ({ sinus: { cl: 1150, resp: 0, sd: 0 }, vent: { mods: lqt }, script: [{ t: 0, do: (s) => { let n = 0; s.on('V', (ev) => { if (ev.label !== 'conducted' || s._safe || s.V.mode !== 'normal') return; if (++n % 4 === 3 && ev.rr > 900) s.schedule(ev.t + 590, (t) => { s.contribV(t, { type: 'focus', spec: Mo.spec('lvAntWall'), label: 'PVC' }); s.schedule(t + 150, (tt) => { if (!s._safe) { s.setVentMode('tdp', tt); s.schedule(tt + 2600, (t3) => { if (s.V.mode === 'tdp') s.setVentMode('normal', t3); }); } }); }); }); } }] }),
      bp: bpTable([[0, 400, [118, 70]]], [118, 70]), done: (sim, t) => sim._safe && sim.V.mode === 'normal' && t - sim._safeAt > 6000,
      acts: { mag: ['good', 'Magnesium 2 g IV over a few minutes is first line for torsades even when the level is normal: it suppresses the early after-depolarisations that trigger each run. Repeat and follow with an infusion.', (s, t) => { s.schedule(t + 1500, (tt) => { s._safe = true; s._safeAt = tt; }); }],
        overdrive: ['good', 'A faster heart rate shortens the QT and abolishes the pauses that set up each run. Temporary pacing at 90–110/min (or isoprenaline in acquired long QT) is the treatment for recurrent torsades despite magnesium.', (s, t) => { s.schedule(t + 800, (tt) => { s._safe = true; s._safeAt = tt; s.cfg.vent.mods = Object.assign({}, lqt, { qtc: 520 }); s._pm = new EP.Pacemaker(s, { mode: 'AAI', lrl: 100, kind: 'temp' }); }); }],
        potassium: ['ok', 'Essential — aim for 4.5–5.0 mmol/L — but it works over hours. Give it with, not instead of, magnesium.', null],
        stopdrug: ['ok', 'Essential: three hERG-blocking drugs on board (methadone, ondansetron, clarithromycin — which also raises methadone levels). But stopping them does not treat the next few hours.', null],
        amio: ['bad', 'Amiodarone prolongs the QT further. The reflex "wide-complex tachycardia → amiodarone" is wrong when the baseline QT is long.', (s) => { s.cfg.vent.mods = Object.assign({}, lqt, { qtc: 660 }); }],
        procain: ['bad', 'Class Ia: blocks IKr, prolongs the QT, makes torsades worse.', (s) => { s.cfg.vent.mods = Object.assign({}, lqt, { qtc: 670 }); }],
        defib: ['ok', 'Correct for a sustained or pulseless run (unsynchronised — there is no R wave to synchronise to). These runs are self-terminating; shocking them does not stop the next one.', fx.shock(false)],
        bb: ['bad', 'Slowing the heart lengthens the QT and the pauses in ACQUIRED long QT. (Beta-blockers are for congenital long QT.)', (s) => { if (s.sinus) s.sinus.cl = 1350; }] },
      debrief: ['Polymorphic VT with a long baseline QT = torsades: magnesium, potassium, pace or isoprenaline, stop the drugs.', 'Polymorphic VT with a normal QT = ischaemia until proven otherwise: beta-blocker, amiodarone, revascularisation.', 'The distinction is made on the sinus beats before the run, not during it.'] },
    { id: 'chb', title: 'Collapse with a pulse of 30', stem: '81-year-old, two syncopal episodes today. Drowsy, cool, cap refill 5 s. SpO₂ 93%.', stable: false,
      cfg: () => ({ sinus: { cl: 760 }, hps: { block: true }, foci: [{ id: 'esc', node: 'V', cl: 2000, site: 'fascPost', label: 'escape', startAt: 500, sd: 0.02 }] }),
      bp: bpTable([[0, 38, [70, 38]], [38, 55, [88, 50]]], [112, 64]), done: (sim, t) => { const q = sim.out.filter((e) => e.type === 'QRS' && e.t > t - 5000); return q.length > 4; },
      acts: { tcp: ['good', 'Symptomatic infranodal complete heart block: pace. Transcutaneous pacing now (with analgesia), confirm mechanical capture on the arterial trace, and arrange a transvenous wire and a permanent system.', fx.pace(70, true)],
        atropine: ['ok', 'Reasonable to try while pads go on, but the block is below the AV node: atropine speeds the sinus node (more P waves) without changing the ventricular rate — and can worsen infranodal block.', fx.sinusFaster],
        epi: ['ok', 'A chronotrope infusion (epinephrine 2–10 µg/min, dopamine 5–20 µg/kg/min or isoprenaline) can speed a ventricular escape as a bridge when pacing is not immediately available.', (s) => { const f = s.focus('esc'); if (f) f.cl = 1250; }],
        adenosine: ['bad', 'An AV-nodal blocker in complete heart block.', null], bb: ['bad', 'Suppresses the only pacemaker keeping this patient alive.', (s) => { const f = s.focus('esc'); if (f) f.cl = 3000; }],
        amio: ['bad', 'Never suppress an escape rhythm: a slow wide rhythm with independent P waves is the patient\'s rescue pacemaker, not VT.', (s) => { const f = s.focus('esc'); if (f) f.enabled = false; }],
        cardiovert: ['bad', 'There is nothing to cardiovert.', null] },
      debrief: ['Wide escape at 30/min with a faster independent atrial rate = infranodal complete heart block. The treatment is pacing; drugs are bridges.', 'Atropine helps nodal-level block (narrow escape, inferior MI, vagal). Expect nothing below the node.', 'Look for reversible causes: hyperkalaemia, drugs, ischaemia, Lyme disease.'] },
    { id: 'hyperk', title: 'Missed dialysis, slow wide rhythm', stem: '57-year-old on haemodialysis, missed two sessions. Weak, nauseated. Point-of-care K⁺ 8.2 mmol/L.', stable: false,
      cfg: () => ({ sinus: { cl: 1350 }, atria: { pAmp: 0 }, avn: { fast: { min: 190 } }, vent: { slow: 2.6, mods: { tAdd: [41, -29, 20], kappa: 0.25, tShape: { p: 0.6, sl: 0.2, sr: 0.14 }, jtScale: 0.5, stFrac: 0.4 } } }),
      bp: bpTable([[0, 400, [86, 48]]], [86, 48]), done: (sim, t) => sim._ca && t - sim._caAt > 5000,
      acts: { calcium: ['good', 'Calcium antagonises the membrane effect of potassium within 1–3 minutes: watch the QRS narrow. It buys 30–60 minutes and does not lower the potassium — repeat if the ECG relapses.', (s, t) => { let k = 0; s._ca = true; s._caAt = t; const step = (tt) => { k++; s.cfg.vent.slow = Math.max(1.15, 2.6 - 0.36 * k); s.cfg.atria.pAmp = Math.min(0.8, 0.2 * k); s.cfg.avn.fast.min = Math.max(110, 190 - 20 * k); s.cfg.vent.mods = { tAdd: [36, -26, 18], kappa: 0.35, tShape: { p: 0.62, sl: 0.1, sr: 0.08 } }; if (s.sinus) s.sinus.cl = Math.max(950, 1350 - 100 * k); if (k < 4) s.schedule(tt + 1100, step); }; s.schedule(t + 1200, step); }],
        insulin: ['ok', 'Shifts potassium into cells: starts in 15 minutes, lowers K⁺ by ≈ 0.6–1.0 mmol/L for a few hours. Necessary — but calcium comes first when the QRS is wide.', null],
        bicarb: ['ok', 'Helps only if there is a significant metabolic acidosis; not a substitute for calcium and insulin.', null],
        tcp: ['bad', 'Hyperkalaemia raises the capture threshold: pacing frequently fails to capture until potassium is treated.', fx.pace(70, false)],
        amio: ['bad', 'A further sodium/potassium-channel blocker in a heart that is already failing to conduct → asystole. A slow, wide, bizarre rhythm in a renal patient is not VT.', (s, t) => fx.vf(3000)(s, t)],
        procain: ['bad', 'Sodium-channel blockade on top of potassium-induced sodium-channel inactivation.', (s, t) => fx.vf(3000)(s, t)],
        atropine: ['bad', 'No effect on a sinoventricular rhythm caused by hyperkalaemia.', null] },
      debrief: ['Wide + slow + renal failure = hyperkalaemia. Treat on the ECG before the laboratory result.', 'Order: calcium (protect the heart) → insulin-dextrose and salbutamol (shift) → dialysis (remove).', 'Antiarrhythmics and pacing fail until potassium falls.'] },
    { id: 'tca', title: 'Overdose with seizures', stem: '34-year-old found with empty amitriptyline packets. GCS 9, dilated pupils, dry flushed skin, one seizure. pH 7.21.', stable: false,
      cfg: () => ({ sinus: { cl: 470, resp: 0 }, avn: { fast: { min: 85, erp: 230 } }, hps: { pattern: 'rbbb', erp: 240 }, vent: { slow: 1.75, mods: { qtc: 470 } } }),
      bp: bpTable([[0, 400, [84, 46]]], [84, 46]), done: (sim, t) => sim._bic && t - sim._bicAt > 5000,
      acts: { bicarb: ['good', 'Sodium bicarbonate 1–2 mmol/kg boluses until the QRS narrows (target pH 7.50–7.55). Sodium loading overcomes the channel block and alkalinisation reduces drug binding.', (s, t) => { let k = 0; s._bic = true; s._bicAt = t; const step = (tt) => { k++; s.cfg.vent.slow = Math.max(1.08, 1.75 - 0.22 * k); if (k >= 2) s.cfg.hps.pattern = 'irbbb'; if (k >= 3) s.cfg.hps.pattern = 'normal'; if (k < 3) s.schedule(tt + 1300, step); }; s.schedule(t + 1200, step); }],
        procain: ['bad', 'Class Ia = more sodium-channel blockade. Contraindicated with class Ic as well.', (s, t) => { s.cfg.vent.slow = 2.4; fx.vf(4500)(s, t); }],
        amio: ['bad', 'Adds sodium- and potassium-channel block and hypotension. Avoid; lidocaine is the antiarrhythmic if bicarbonate fails.', (s) => { s.cfg.vent.slow = 2.1; }],
        bb: ['bad', 'Worsens hypotension and conduction block.', (s) => { s._collapse = true; }],
        cardiovert: ['bad', 'This is sinus tachycardia with a poisoned His-Purkinje system. A shock does not remove the drug.', fx.shock(true)],
        lido: ['ok', 'Second line for ventricular arrhythmias after bicarbonate: a class Ib agent that competes with the tricyclic for the channel with faster kinetics.', null],
        adenosine: ['bad', 'No role.', null] },
      debrief: ['Sodium-channel blocker toxidrome: wide QRS, tall terminal R in aVR, tachycardia, hypotension, seizures.', 'Bicarbonate is both the antidote and the antiarrhythmic. Benzodiazepines for seizures; noradrenaline for hypotension; lipid emulsion and ECMO for refractory cases.', 'QRS > 100 ms: seizures likely. > 160 ms: ventricular arrhythmias likely.'] },
  ];

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'cases', title: 'Cases',
    mount(root) {
      let cs = CASES[0], sim, live, used = {}, solved = false;
      const canvas = h('canvas', { 'aria-label': 'Bedside monitor' }), liveBox = h('div.live', canvas);
      const strip = new EP.LiveStrip(canvas, { channels: [{ lead: 1 }, { lead: 6 }, { key: 'pulse', label: 'Arterial pressure' }], windowMs: 9000, rowMm: 21 });
      const vit = h('div.vitals'), stem = h('div.card-b'), acts = h('div.card-b'), log = h('div.findings'), deb = h('div');
      const rail = h('nav.card.rail', { 'aria-label': 'Cases' }), listEl = h('div', { style: { padding: '6px 0 8px' } }); rail.append(listEl);
      const sel = UI.select(null, CASES.map((c) => [c.id, c.title]), cs.id, (v) => start(v)); sel.classList.add('rail-sel'); sel.setAttribute('aria-label', 'Case');
      function fill() { listEl.innerHTML = ''; listEl.append(h('div.rail-g', 'Scenarios')); for (const c of CASES) listEl.append(h('button.rail-i', { type: 'button', 'aria-current': String(c === cs), onclick: () => start(c.id) }, c.title, h('small', c.stable ? 'haemodynamically stable' : 'unstable'))); }
      function tick(t) {
        if (Math.floor(t / 500) === Math.floor((t - 20) / 500)) return;
        const q = sim.out.filter((e) => e.type === 'QRS' && e.t > t - 5000 && e.t < t - 120);
        let hr = q.length > 1 ? Math.round(60000 / ((q[q.length - 1].t - q[0].t) / (q.length - 1))) : q.length ? 12 : 0;
        if (sim.V.mode !== 'normal') hr = 0;
        const bp = cs.bp(hr, sim);
        vit.innerHTML = '';
        vit.append(h('div', h('div.k', 'Heart rate'), h('div.v' + (hr > 150 || hr < 40 ? '.bad' : ''), sim.V.mode !== 'normal' ? '—' : String(hr))), h('div', h('div.k', 'Blood pressure'), h('div.v' + (bp[0] < 90 ? '.bad' : ''), bp[0] ? bp[0] + '/' + bp[1] : 'no pulse')),
          h('div', h('div.k', 'Status'), h('div.v' + (bp[0] < 90 ? '.bad' : ''), { style: { fontSize: '13px' } }, bp[0] === 0 ? 'cardiac arrest — CPR' : bp[0] < 90 ? 'unstable' : 'stable')));
        if (!solved && cs.done(sim, t)) { solved = true; debrief(true); }
      }
      function debrief(ok) {
        deb.innerHTML = '';
        deb.append(h('section.card', h('div.card-h', h('h3', ok ? 'Stabilised — debrief' : 'Debrief')), h('div.card-b.prose', UI.list(cs.debrief))));
      }
      function start(id) {
        cs = CASES.find((c) => c.id === id) || CASES[0]; used = {}; solved = false;
        if (sel.sel) sel.sel.value = cs.id; else sel.value = cs.id;
        sim = new EP.HeartSim(cs.cfg());
        if (live) live.setSim(sim); else live = new EP.Live({ sim, strips: [strip], pulse: true, noPulse: (b) => b.rr < 250 || sim._collapse, onTick: tick }).start();
        stem.innerHTML = ''; stem.append(h('div.row', h('span.pill' + (cs.stable ? '.good' : '.bad'), cs.stable ? 'stable' : 'unstable'), h('h2', { style: { fontSize: '16px' } }, cs.title)), h('p', { style: { marginTop: '6px' } }, cs.stem), h('p.muted', { style: { marginTop: '6px', fontSize: '13px' } }, 'Choose what to do. The monitor responds; every choice is explained.'));
        acts.innerHTML = '';
        const groups = {};
        for (const k in cs.acts) (groups[ACT[k][1]] = groups[ACT[k][1]] || []).push(k);
        for (const g of ['Electricity', 'Drug', 'Manoeuvre', 'Other']) {
          if (!groups[g]) continue;
          acts.append(h('div.eyebrow', { style: { margin: '2px 0 6px' } }, g === 'Drug' ? 'Drugs' : g), h('div.variants', { style: { marginBottom: '10px' } }, groups[g].map((k) => h('button.btn.sm', { type: 'button', onclick: (ev) => act(k, ev.currentTarget) }, ACT[k][0]))));
        }
        log.innerHTML = ''; log.append(h('div.muted', 'Nothing given yet.')); deb.innerHTML = '';
        deb.append(h('button.btn.sm', { type: 'button', onclick: () => debrief(false) }, 'Show the teaching points'));
        fill();
      }
      function act(k, btn) {
        const a = cs.acts[k];
        if (!Object.keys(used).length) log.innerHTML = '';
        used[k] = true; btn.setAttribute('aria-pressed', 'true');
        if (a[2]) a[2](sim, live.t + 150);
        log.prepend(h('div.finding', h('span.pill' + (a[0] === 'good' ? '.good' : a[0] === 'bad' ? '.bad' : '.warn'), a[0] === 'good' ? 'right call' : a[0] === 'bad' ? 'harmful' : 'second line'), h('div', h('b', ACT[k][0]), h('div.muted', a[1]))));
      }
      root.append(h('div.lab.lab2', rail, h('div.stack', sel,
        h('div.sim', h('div.sim-main',
          h('section.card', stem),
          h('section.card', h('div.card-h', h('h3', 'Monitor — II, V1, arterial line'), h('span.grow'), h('button.btn.sm', { type: 'button', onclick: () => start(cs.id) }, 'Restart case')), liveBox, h('div.card-b', vit)),
          h('section.card', h('div.card-h', h('h3', 'Interventions')), acts)),
          h('div.sim-main', h('section.card', h('div.card-h', h('h3', 'What happened')), h('div.card-b', log)), deb,
            h('div.note', h('b', 'The one rule. '), 'If the patient is unstable because of the rhythm — shock a tachycardia, pace a bradycardia. Drugs are for stable patients and for keeping the rhythm afterwards.'))))));
      start(cs.id);
      return { unmount() { live.destroy(); if (strip.ro) strip.ro.disconnect(); } };
    },
  });

  // ---------------------------------------------------------------------------------------------
  // Quiz: name the rhythm
  EP.Modules.push({
    id: 'quiz', title: 'Quiz',
    mount(root) {
      const canvas = h('canvas', { 'aria-label': 'Unknown ECG' }), box = h('div.ecg-scroll', canvas);
      const view = new EP.ECGView(canvas, { layout: '12', strips: [1], ladder: false });
      const opts = h('div.opts'), fb = h('div'), scoreEl = h('span.mono', '0 / 0');
      let score = UI.store.get('quiz', { right: 0, total: 0 }), cur = null, answered = false;
      const pool = R.list.filter((r) => !['sinus-arr'].includes(r.id));
      const show = () => { scoreEl.textContent = score.right + ' / ' + score.total; };
      function next() {
        answered = false; cur = pool[Math.floor(Math.random() * pool.length)];
        const same = pool.filter((r) => r.group === cur.group && r !== cur).sort(() => Math.random() - 0.5).slice(0, 2);
        const other = pool.filter((r) => r.group !== cur.group).sort(() => Math.random() - 0.5).slice(0, 2);
        const choices = same.concat(other, [cur]).sort(() => Math.random() - 0.5);
        const rec = R.record(cur, { params: {} });
        view.set({ ladder: false }); view.setRecording(rec);
        opts.innerHTML = ''; fb.innerHTML = '';
        for (const c of choices) opts.append(h('button.opt', { type: 'button', onclick: (ev) => {
          if (answered) return; answered = true; score.total++;
          for (const b of opts.children) { b.disabled = true; if (b.textContent === cur.name) b.classList.add('right'); }
          if (c === cur) score.right++; else ev.currentTarget.classList.add('wrong');
          UI.store.set('quiz', score); show();
          view.set({ ladder: true });
          fb.append(h('div.note' + (c === cur ? '.good' : '.bad'), h('b', c === cur ? 'Correct. ' : 'This is ' + cur.name + '. '), cur.teach.ecg[0]),
            h('div.prose', { style: { marginTop: '10px', fontSize: '13px' } }, h('h4', 'What to look for'), UI.list(cur.teach.ecg)),
            h('div.row', { style: { marginTop: '10px' } }, h('button.btn.primary', { type: 'button', onclick: next }, 'Next ECG'), h('button.btn', { type: 'button', onclick: () => { UI.store.set('rhythm', cur.id); EP.go('rhythms', true); } }, 'Open in Rhythm Lab')));
        } }, c.name));
      }
      root.append(h('div.sim', h('div.sim-main', h('section.card', h('div.card-h', h('h2', 'Name the rhythm'), h('span.grow'), h('span.muted', 'Score'), scoreEl, h('button.btn.sm', { type: 'button', onclick: () => { score = { right: 0, total: 0 }; UI.store.set('quiz', score); show(); } }, 'Reset')), box,
        h('div.card-b', h('p.muted', { style: { fontSize: '13px' } }, 'Use the calipers: drag across the trace. The ladder diagram appears after you answer.')))),
        h('div.sim-main', h('section.card', h('div.card-h', h('h3', 'Your answer')), h('div.card-b', opts, h('div', { style: { marginTop: '10px' } }, fb))))));
      show(); next();
      return { unmount() { if (view.ro) view.ro.disconnect(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
