/* EP Simulator — Assessment: mixed-domain, fellow-level questions (generated ECG items + written items),
 * a confidence rating on every answer, and a gap map by domain. History is kept in the browser and, when
 * the page runs as a Claude artifact, in its database (collection "assessment"). */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, R = EP.Rhythms, Mo = EP.Morph;
  const DOM = {
    rhythm: ['Rhythm recognition', 'rhythms'], mech: ['Mechanisms & EP concepts', 'rhythms'], local: ['Localisation from the 12-lead', 'localise'], isch: ['Ischaemia / STEMI', 'stemi'],
    device: ['Pacemaker function & troubleshooting', 'pacemaker'], hardware: ['Devices, leads & imaging', 'devices'], temp: ['Temporary pacing', 'temp'], icd: ['ICD', 'icd'],
    tox: ['Tox & electrolytes', 'tox'], mgmt: ['Acute management', 'cases'],
  };
  const QUOTA = { rhythm: 4, mech: 3, local: 3, isch: 4, device: 4, hardware: 2, temp: 2, icd: 2, tox: 3, mgmt: 3 };

  // ---- written items: [domain, topic, stem, options (first is correct), explanation] ----------------
  const W = [
    ['mech', 'AVNRT', 'In typical (slow-fast) AVNRT, which limb conducts retrogradely to the atria?', ['The fast pathway', 'The slow pathway', 'An accessory pathway', 'The His bundle'], 'Antegrade conduction is down the slow pathway (long AH), retrograde up the fast pathway — so atria and ventricles activate almost together and the P is buried in or just after the QRS (VA < 70 ms).'],
    ['mech', 'AVRT', 'During orthodromic AVRT using a left lateral pathway the patient develops left bundle branch block aberrancy. What happens to the tachycardia?', ['Cycle length lengthens by ≥ 35 ms', 'Nothing — the QRS widens but the rate is unchanged', 'It terminates', 'It accelerates'], 'Coumel\'s sign: bundle branch block ipsilateral to the pathway forces the impulse across the septum before it can reach the pathway, lengthening the circuit (and the VA interval). It proves the pathway is on that side and participates in the circuit.'],
    ['mech', 'AF', 'The ventricular response in atrial fibrillation is irregular mainly because of:', ['Concealed conduction in the AV node', 'Variable atrial fibrillatory amplitude', 'Phase 4 block in the His bundle', 'Supernormal conduction'], 'Impulses that penetrate the node without reaching the ventricles reset its refractoriness unpredictably. The same concept explains 2:1 and 4:1 flutter ratios.'],
    ['mech', 'Aberrancy', 'Ashman aberrancy describes:', ['An aberrant (usually RBBB) beat ending a short cycle that follows a long cycle', 'Rate-related LBBB at slow heart rates', 'A fusion beat during VT', 'Aberrancy of the beat ending a long cycle'], 'Bundle refractoriness is proportional to the preceding cycle length. A long cycle lengthens it; the next early beat finds the right bundle (longer refractory period) still refractory.'],
    ['mech', 'AV block', 'In typical Wenckebach, why do the R-R intervals shorten before the dropped beat?', ['The increment in PR gets smaller each beat', 'The sinus rate accelerates', 'The PR interval shortens', 'The His-Purkinje delay shortens'], 'The largest PR increment is on the second beat; later increments are smaller, so each R-R = P-P + (a decreasing increment).'],
    ['mech', 'Flutter', 'The critical isthmus of typical atrial flutter lies between:', ['The tricuspid annulus and the inferior vena cava', 'The mitral annulus and the left inferior pulmonary vein', 'The crista terminalis and the SVC', 'The coronary sinus os and the fossa ovalis'], 'The cavotricuspid isthmus: a line of block across it cures typical flutter in either direction of rotation.'],
    ['mech', 'SVT diagnosis', 'Adenosine during a regular narrow-complex tachycardia at 170/min produces AV block for 4 seconds while P waves continue at 170/min. The diagnosis is:', ['Atrial tachycardia (or flutter) — not AV-node dependent', 'AVNRT', 'Orthodromic AVRT', 'Junctional tachycardia'], 'If the tachycardia continues in the atria despite AV block, the AV node is a bystander. AVNRT and AVRT would terminate.'],
    ['mech', 'Wide-complex tachycardia', 'Which finding is most specific for ventricular tachycardia?', ['AV dissociation with capture or fusion beats', 'QRS duration > 140 ms', 'Left axis deviation', 'Heart rate above 180/min'], 'Independent atrial activity (and the capture/fusion beats it produces) proves a ventricular origin. Width and axis are only supportive.'],
    ['mech', 'Torsades', 'Torsades de pointes is typically initiated by:', ['A short-long-short sequence with an early after-depolarisation on a prolonged T-U wave', 'A late-coupled PVC in a patient with a normal QT', 'Atrial fibrillation conducted over an accessory pathway', 'Phase 4 automaticity in the Purkinje network'], 'A pause prolongs the next QT and enlarges the T-U wave; an EAD-triggered beat then lands on it. This is why pacing faster prevents recurrence.'],
    ['mech', 'Pre-excitation', 'Why is pre-excitation often subtle in sinus rhythm with a left lateral accessory pathway?', ['The pathway is far from the sinus node, so the AV node/His wavefront arrives almost as early', 'Left-sided pathways conduct decrementally', 'The delta wave is isoelectric in all leads', 'Left-sided pathways only conduct retrogradely'], 'The degree of pre-excitation depends on the race between the two routes: atrial conduction time to the pathway versus AV-nodal delay. Atrial pacing near the pathway or slowing the node exaggerates the delta wave.'],

    ['device', 'Upper rate', 'DDD pacemaker: sensed AV delay 150 ms, PVARP 250 ms, upper tracking rate 120/min. At what atrial rate does 2:1 block begin?', ['150/min', '120/min', '130/min', '171/min'], 'TARP = AVD + PVARP = 400 ms → 60 000 / 400 = 150/min. Between 120 and 150/min the device shows Wenckebach behaviour; above 150/min every other P falls in PVARP.'],
    ['device', 'Upper rate', 'The same patient (2:1 point 150/min, upper tracking rate 120/min) exercises to a sinus rate of 135/min. The strip shows:', ['Progressive AS–VP prolongation with intermittent untracked P waves', 'Abrupt halving of the paced rate', 'Mode switch to DDI', 'Atrial pacing at the lower rate'], 'Pacemaker Wenckebach: the device delays ventricular output to respect the upper rate until a P wave lands in PVARP.'],
    ['device', 'PMT', 'Pacemaker-mediated tachycardia requires:', ['Retrograde VA conduction with a VA time longer than PVARP', 'Atrial fibrillation', 'Loss of ventricular capture', 'A unipolar ventricular lead'], 'A retrograde P sensed after PVARP triggers ventricular pacing, which conducts retrogradely again. A magnet, longer PVARP or post-PVC PVARP extension breaks the loop.'],
    ['device', 'Magnet', 'Applying a magnet to a pacemaker and to an ICD respectively causes:', ['Asynchronous pacing; suspension of tachycardia therapy without changing pacing', 'Inhibition of pacing; asynchronous pacing', 'Asynchronous pacing in both', 'No effect; delivery of a test shock'], 'Pacemaker: sensing off, fixed-rate pacing at the magnet rate. ICD: detection/therapy suspended while the magnet stays on; bradycardia pacing unchanged.'],
    ['device', 'Sensing', 'VVI 60: pacing spikes fall on the ST-T of conducted beats and those beats do not reset the timer. The correct reprogramming is:', ['Lower the sensitivity value (mV) to make the channel more sensitive', 'Raise the sensitivity value (mV)', 'Increase the output', 'Lengthen the refractory period'], 'Under-sensing: the R wave is smaller than the sensitivity setting. A lower mV number lowers the fence so smaller signals are seen.'],
    ['device', 'Lead failure', 'Pauses without pacing spikes, non-physiological noise on the ventricular channel and a lead impedance of 2800 Ω indicate:', ['Conductor fracture', 'Insulation breach', 'Lead dislodgement', 'Battery depletion'], 'High impedance = open circuit (fracture, loose set screw). Insulation failure gives LOW impedance (< 200–250 Ω) with current leak.'],
    ['device', 'Crosstalk', 'In a DDD device a ventricular sensed event 60 ms after atrial pacing triggers a ventricular pace at 110 ms. This is:', ['Ventricular safety pacing', 'Pacemaker-mediated tachycardia', 'Upper rate behaviour', 'Fusion'], 'A sense in the crosstalk window might be the atrial stimulus rather than a true R wave. Rather than risk asystole by inhibiting, the device commits to an early ventricular pace (a characteristically short AV delay on the strip).'],
    ['device', 'Oversensing', 'T-wave over-sensing in a VVI pacemaker produces a paced rate that is:', ['Slower than the programmed lower rate', 'Faster than the programmed lower rate', 'Irregular with pauses of twice the lower rate interval', 'Unchanged'], 'The escape interval restarts from the over-sensed T wave, so each cycle is lengthened by the QRS-to-T time.'],
    ['device', 'Threshold', 'A dialysis patient with a pacemaker has spikes without capture. Lead position and impedance are unchanged. Most likely cause:', ['Hyperkalaemia raising the capture threshold', 'Battery depletion', 'Pacemaker-mediated tachycardia', 'Far-field R-wave sensing'], 'Hyperkalaemia, acidosis, class I antiarrhythmics and infarction at the lead tip raise thresholds. Treat the potassium; pacing returns.'],
    ['device', 'Insulation', 'Lead impedance 180 Ω, intermittent under-sensing and premature battery depletion suggest:', ['Insulation breach', 'Conductor fracture', 'Exit block', 'Twiddler\'s syndrome'], 'Current leaks through the insulation defect: low impedance, high current drain, attenuated electrogram.'],

    ['hardware', 'Lead position', 'A "right ventricular" lead paces with an RBBB morphology and on the lateral film runs posteriorly toward the spine. The lead is most likely in:', ['A cardiac vein via the coronary sinus, or the left ventricle', 'The RV apex', 'The RV outflow tract', 'The right atrial appendage'], 'RV apical/septal leads go ANTERIORLY on the lateral view and pace with an LBBB pattern. A posterior course means coronary sinus/cardiac vein or passage across a PFO/ASD into the LV (stroke risk).'],
    ['hardware', 'LBB area pacing', 'Which supports true left bundle capture during left bundle branch area pacing?', ['Terminal R in V1 with a short, constant stimulus-to-peak R time in V5–V6', 'QS in V1 with QRS 160 ms', 'An isoelectric interval equal to the HV interval with a QRS identical to the native beat', 'Negative QRS in leads I and aVL'], 'LV is activated first, so V1 shows Qr/rSR′; LV activation time < 75–80 ms and unchanged at high vs low output indicates conduction-system capture. An isoelectric interval with a native QRS is selective HIS capture.'],
    ['hardware', 'Leadless', 'How does a Micra AV maintain AV synchrony?', ['Its accelerometer detects atrial contraction mechanically (VDD)', 'It senses the far-field P wave electrically', 'It communicates with an atrial capsule', 'It paces the atrium through the septum'], 'The A4 signal (atrial kick) on the accelerometer times ventricular pacing. It cannot pace the atrium, and tracking is limited at faster sinus rates.'],
    ['hardware', 'Leadless', 'What makes AVEIR DR a dual-chamber system?', ['Beat-to-beat implant-to-implant (i2i) conducted communication between an atrial and a ventricular capsule', 'A thin lead joining the two capsules', 'Mechanical sensing of atrial contraction', 'Far-field sensing from the ventricle'], 'Each capsule senses and paces its own chamber and tells the other on every beat, giving true DDD(R) including atrial pacing.'],
    ['hardware', 'S-ICD', 'Which patient is a poor candidate for a subcutaneous ICD?', ['Recurrent monomorphic VT that responds to anti-tachycardia pacing, with complete heart block', 'A 24-year-old with long QT syndrome', 'Previous transvenous device infection', 'Occluded subclavian veins'], 'The S-ICD cannot deliver ATP or bradycardia pacing (only brief post-shock pacing) and cannot resynchronise.'],
    ['hardware', 'CRT', 'A CRT patient\'s paced ECG changes from Q waves in lead I with an R in V1 to a positive lead I with QS in V1 and a wider QRS. This means:', ['Loss of left ventricular capture', 'Loss of right ventricular capture', 'Atrial lead dislodgement', 'Normal battery depletion'], 'Only the RV lead is capturing (LBBB pattern, activation right-to-left → positive lead I). Causes: LV lead dislodgement or threshold rise.'],

    ['temp', 'Transvenous', 'A temporary transvenous wire has a capture threshold of 0.8 mA. The output should be set to about:', ['2 mA', '0.8 mA', '1 mA', '20 mA'], 'Two to three times threshold gives a safety margin for threshold rise without unnecessary current (which promotes diaphragmatic pacing and, rarely, arrhythmia).'],
    ['temp', 'Transvenous', 'Turning the sensitivity dial of a temporary pacing box from 2 mV to 10 mV:', ['Makes it less sensitive — risking pacing spikes on T waves', 'Makes it more sensitive — risking inhibition by T waves', 'Increases the output', 'Converts it to asynchronous mode only at 20 mV'], 'The number is the minimum signal size that counts as an R wave. A higher number ignores more: under-sensing and competitive pacing.'],
    ['temp', 'Transcutaneous', 'The most reliable confirmation of capture during transcutaneous pacing is:', ['An arterial or pulse-oximeter waveform with every stimulus', 'A wide deflection after every stimulus on the monitor', 'Palpable carotid pulsation', 'Visible chest wall twitching'], 'The stimulus artefact can mimic a QRS and muscle contraction mimics a carotid pulse. Look for a T wave after the complex and confirm mechanical capture.'],
    ['temp', 'Transvenous', 'A temporary wire that was pacing with an LBBB pattern now paces with an RBBB pattern and the patient has hiccups. Suspect:', ['Perforation into the pericardium / left ventricle', 'Normal variation', 'Atrial capture', 'Battery depletion'], 'A change in paced morphology means the tip has moved; RBBB pattern suggests LV capture, and diaphragmatic stimulation suggests perforation. Echo, and do not simply pull it back blindly.'],

    ['icd', 'Programming', 'Which programming change reduces inappropriate shocks AND mortality in primary-prevention ICD patients?', ['High-rate cut-off (≥ 200/min) and/or prolonged detection', 'Lower VT zone to 140/min', 'Shock-only therapy without ATP', 'Shorter detection (12 intervals)'], 'MADIT-RIT and ADVANCE III: many VTs self-terminate and many fast rhythms are supraventricular. Waiting and treating only fast rhythms is safer.'],
    ['icd', 'ATP', 'Anti-tachycardia pacing is most likely to terminate:', ['Monomorphic VT below 200/min', 'Ventricular fibrillation', 'Polymorphic VT', 'Sinus tachycardia'], 'ATP needs a stable re-entrant circuit with an excitable gap. Success ≈ 70–90% for slower monomorphic VT.'],
    ['icd', 'Inappropriate therapy', 'An awake patient in sinus rhythm on the monitor receives four ICD shocks in ten minutes. The first step is:', ['Place a magnet over the generator', 'Give amiodarone 300 mg IV', 'External defibrillation', 'Start transcutaneous pacing'], 'Shocks in sinus rhythm are inappropriate (lead fracture noise, T-wave over-sensing, EMI). The magnet suspends detection; then pads on and interrogate.'],
    ['icd', 'Storm', 'Electrical storm with recurrent appropriate shocks for monomorphic VT. Best initial pharmacological strategy:', ['Beta-blockade (e.g. propranolol), amiodarone and sedation', 'Flecainide', 'Verapamil', 'Isoprenaline'], 'Sympathetic drive sustains the storm. Non-selective beta-blockade with amiodarone, sedation/anxiolysis, electrolyte correction, then ablation or sympathetic blockade if refractory.'],

    ['mgmt', 'Pre-excited AF', 'Stable patient, irregular wide-complex tachycardia at 220/min with varying QRS width. Drug of choice:', ['Procainamide', 'Adenosine', 'Diltiazem', 'Digoxin'], 'Pre-excited AF: AV-nodal blockers favour conduction over the pathway and can precipitate VF. Procainamide or ibutilide; cardiovert if unstable.'],
    ['mgmt', 'VT', 'Stable monomorphic VT at 170/min in a patient with prior MI. Which drug should NOT be given?', ['Verapamil', 'Procainamide', 'Amiodarone', 'Lidocaine'], 'Calcium-channel blockers cause haemodynamic collapse in VT. Procainamide has the best termination data; amiodarone is acceptable; cardioversion is always an option.'],
    ['mgmt', 'Torsades', 'Recurrent torsades continues after 4 g of magnesium and potassium replacement. Next step:', ['Overdrive pacing at 90–110/min (or isoprenaline)', 'Amiodarone infusion', 'Procainamide', 'Metoprolol'], 'Increasing the heart rate shortens the QT and abolishes pauses. Amiodarone and procainamide prolong the QT; beta-blockers slow the rate in acquired long QT.'],
    ['mgmt', 'Unstable tachycardia', 'AF at 170/min with hypotension and pulmonary oedema, onset unknown. Management:', ['Immediate synchronised cardioversion', 'Diltiazem bolus', 'TEE before any cardioversion', 'Digoxin loading'], 'Instability attributable to the rhythm overrides the 48-hour rule. Anticoagulate afterwards.'],
    ['mgmt', 'Bradycardia', 'Complete heart block with a wide escape at 28/min and BP 70/40. Atropine has no effect. Next:', ['Transcutaneous pacing (with a chronotrope infusion as a bridge)', 'More atropine to 6 mg', 'Adenosine', 'Amiodarone'], 'Infranodal block does not respond to atropine. Pace; epinephrine/dopamine/isoprenaline while arranging a transvenous wire.'],
    ['mgmt', 'AF', 'Stable AF of 5 days\' duration, not anticoagulated. Which is contraindicated today?', ['Elective cardioversion without TEE', 'Beta-blocker', 'Starting a DOAC', 'Diltiazem'], 'Electrical or chemical cardioversion beyond 48 h risks embolism: 3 weeks of anticoagulation or TEE first, and 4 weeks after.'],
    ['mgmt', 'Digoxin', 'Bidirectional VT in a patient on digoxin with K⁺ 5.9. Treatment:', ['Digoxin-specific antibody fragments', 'Synchronised cardioversion at 200 J', 'IV calcium', 'Amiodarone'], 'Fab fragments reverse the arrhythmia and the hyperkalaemia. Cardioversion can provoke refractory VF in digoxin toxicity.'],

    ['isch', 'Posterior MI', 'Chest pain with horizontal ST depression maximal in V1–V4 and upright T waves. Next step:', ['Record posterior leads V7–V9 and treat as posterior occlusion', 'Treat as NSTEMI and repeat troponin in 3 hours', 'Exercise stress test', 'Attribute to diffuse subendocardial ischaemia'], 'ST depression maximal in V1–V4 is the mirror image of posterior ST elevation. Diffuse subendocardial ischaemia is maximal in V4–V6/II with ST elevation in aVR.'],
    ['isch', 'RV infarction', 'Inferior STEMI with ST elevation III > II and ST elevation in V1. Which is correct?', ['Record V4R; avoid nitrates and support preload', 'The culprit is the circumflex', 'Give IV nitroglycerin for the hypotension', 'It indicates posterior extension'], 'III > II with STE in V1 points to a proximal RCA occlusion with RV infarction: preload-dependent, nitrate-sensitive.'],
    ['isch', 'Sgarbossa', 'In LBBB, the Smith-modified Sgarbossa criteria replace "discordant ST elevation ≥ 5 mm" with:', ['ST elevation ÷ S-wave depth ≥ 0.25 (ST/S ≤ −0.25)', 'ST elevation ÷ R-wave height ≥ 0.5', 'Discordant ST elevation ≥ 3 mm', 'T/QRS ratio ≥ 0.36'], 'Proportion rather than absolute size: improves sensitivity from ≈ 20–36% to ≈ 80–90% with similar specificity. The T/QRS ≥ 0.36 rule distinguishes acute anterior MI from LV aneurysm.'],
    ['isch', 'Swirl', 'ST elevation in V1 and aVR with ST depression in V5–V6 in a patient with chest pain and a narrow QRS most suggests:', ['LAD occlusion proximal to the first septal perforator', 'Circumflex occlusion', 'Isolated posterior MI', 'Pericarditis'], 'The "precordial swirl": a septal injury vector pointing rightward/anteriorly. Distinguish from LVH and LBBB, where the QRS is abnormal.'],
    ['isch', 'Wellens', 'A pain-free patient has biphasic T waves in V2–V3 after an episode of angina. What should be avoided?', ['Exercise stress testing', 'Aspirin', 'Admission', 'Coronary angiography'], 'Wellens syndrome: a critical proximal LAD lesion that has reperfused. Stress testing can precipitate occlusion.'],
    ['isch', 'de Winter', 'Upsloping ST depression at the J point in V1–V6 continuing into tall symmetrical T waves, with slight ST elevation in aVR, indicates:', ['Acute LAD occlusion (STEMI equivalent)', 'Hyperkalaemia', 'Benign early repolarisation', 'Posterior MI'], 'The de Winter pattern does not evolve to ST elevation; it needs immediate angiography.'],
    ['isch', 'Conduction', 'New RBBB with left anterior fascicular block during an anterior STEMI implies:', ['A very proximal LAD occlusion with risk of sudden infranodal complete heart block', 'A benign rate-related change', 'Right coronary occlusion', 'Successful reperfusion'], 'Both fascicles are supplied by the first septal perforator. Block here is infranodal: abrupt, with an unreliable escape.'],
    ['isch', 'Reciprocal change', 'Which is the most sensitive reciprocal sign of early inferior MI?', ['ST depression (± T inversion) in aVL', 'ST depression in V5–V6', 'ST elevation in aVR', 'Tall R wave in V1'], 'aVL faces almost directly away from lead III. New down-sloping ST depression in aVL may precede inferior ST elevation.'],

    ['tox', 'Sodium-channel block', 'Tricyclic overdose: QRS 150 ms, terminal R in aVR, BP 85/50. First treatment:', ['Sodium bicarbonate boluses', 'Amiodarone', 'Procainamide', 'Physostigmine'], 'Sodium load plus alkalinisation reverses channel block; class Ia/Ic/III drugs worsen it.'],
    ['tox', 'Hyperkalaemia', 'K⁺ 7.9 with a wide QRS and absent P waves. First drug:', ['IV calcium', 'Insulin-dextrose', 'Sodium polystyrene', 'Furosemide'], 'Calcium stabilises the membrane within minutes; it does not lower potassium, so shifting and removal follow.'],
    ['tox', 'Calcium-channel blocker', 'Verapamil overdose with refractory shock despite calcium and vasopressors. Next:', ['High-dose insulin euglycaemia therapy', 'Glucagon alone', 'Transvenous pacing', 'Digoxin Fab'], 'Insulin at 1 unit/kg bolus then 1–10 units/kg/h improves contractility. Pacing may capture without improving pressure.'],
    ['tox', 'Calcium', 'A long QT made up of a long flat ST segment with a normal-width T wave suggests:', ['Hypocalcaemia', 'Hypokalaemia', 'Hypercalcaemia', 'Tricyclic toxicity'], 'Calcium determines plateau (ST segment) length. Hypokalaemia flattens the T and adds a U wave.'],
    ['tox', 'Digoxin', 'A patient with chronic AF on digoxin now has a perfectly regular ventricular rhythm at 50/min with a narrow QRS. This is:', ['Complete AV block with a junctional escape — digoxin toxicity', 'Conversion to sinus rhythm', 'Good rate control', 'Atrial flutter with 4:1 block'], '"Regularised AF": fibrillatory baseline persists but none of it conducts; the regular rhythm is an escape.'],
    ['tox', 'QT drugs', 'Torsades in a patient on methadone and a macrolide. Which drug is contraindicated?', ['Amiodarone', 'Magnesium', 'Potassium', 'Isoprenaline'], 'Class III (and Ia) drugs prolong repolarisation further.'],
  ];

  // ---- generated ECG items -----------------------------------------------------------------------------
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);
  const others = (all, self, n) => shuffle(all.filter((x) => x !== self)).slice(0, n);
  const GEN = {
    rhythm() {
      const pool = R.list.filter((r) => r.id !== 'sinus-arr'), cur = pick(pool);
      const opts = shuffle(pool.filter((r) => r.group === cur.group && r !== cur)).slice(0, 2).concat(shuffle(pool.filter((r) => r.group !== cur.group)).slice(0, 2));
      return { id: 'g-rh-' + cur.id, domain: 'rhythm', topic: (R.groups.find((g) => g.id === cur.group) || {}).name, stem: 'What is the rhythm?', ecg: { rec: () => R.record(cur, { params: {} }) }, right: cur.name, wrong: opts.map((o) => o.name), explain: cur.teach.ecg.slice(0, 2).join(' ') };
    },
    localPvc() {
      const P = EP.LocData.PRESETS, cur = pick(P);
      return { id: 'g-pvc-' + cur[0], domain: 'local', topic: 'PVC / VT origin', stem: 'Sinus beats alternate with ectopic beats. Where do the wide beats arise?',
        ecg: { rec: () => { const sim = EP.simulate({ sinus: { cl: 900, resp: 0 }, avn: { fast: { retro: { block: true } } }, foci: [{ id: 'x', node: 'V', kind: 'coupled', after: 'hps', coupling: 470, every: 1, spec: Mo.spec(cur[0]), label: 'PVC' }] }, 10000); const r = EP.Synth.build(sim, 0, 10000); r.sim = sim; return r; } },
        right: cur[1], wrong: others(P, cur, 4).map((x) => x[1]), explain: 'Read V1 (LBBB pattern = right ventricle/septum, RBBB pattern = left ventricle), then the inferior leads (positive = high origin, negative = low), then the precordial transition and lead I. Open the Localise tab to see the map for this site.' };
    },
    localAp() {
      const keys = Object.keys(R.AP), k = pick(keys);
      return { id: 'g-ap-' + k, domain: 'local', topic: 'Accessory pathway', stem: 'Sinus rhythm with maximal pre-excitation. Where is the accessory pathway?',
        ecg: { rec: () => { const sim = EP.simulate({ sinus: { cl: 880, resp: 0 }, avn: { fast: { min: 150 } }, ap: R.apCfg(k) }, 10000); const r = EP.Synth.build(sim, 0, 10000); r.sim = sim; return r; } },
        right: R.AP[k].name, wrong: others(keys, k, 3).map((x) => R.AP[x].name), explain: 'The delta wave is negative in leads facing the insertion: negative in I/aVL with a positive V1 → left lateral; negative in III/aVF → posterior/posteroseptal; negative V1 with a left axis → right free wall; positive inferior leads with a negative V1 → anteroseptal.' };
    },
    localPace() {
      const P = EP.LocData.PACE, cur = pick(P);
      return { id: 'g-pace-' + cur[0], domain: 'local', topic: 'Pacing site', stem: 'Complete heart block with P-synchronous ventricular pacing. Where is the ventricle being paced from?',
        ecg: { rec: () => { const sim = new EP.HeartSim({ sinus: { cl: 820, resp: 0 }, avn: { fast: { block: true, retro: { block: true } } } }); new EP.Pacemaker(sim, { mode: 'DDD', lrl: 60, vSpec: cur[2](), vSite: 'rvApex' }); sim.runUntil(12500); const r = EP.Synth.build(sim, 2000, 12000); r.sim = sim; return r; } },
        right: cur[1], wrong: others(P, cur, 3).map((x) => x[1]), explain: 'LBBB pattern = right ventricular site (superior axis → apex; inferior axis → outflow tract). Terminal R in V1 with a narrow QRS → left bundle area. Dominant R in V1 with negative lead I → left ventricular site. An isoelectric gap then a native QRS → His bundle.' };
    },
    isch() {
      const S = EP.Stemi.list, cur = pick(S);
      const label = (x) => x.name + (x.sub ? ' — ' + x.sub : '');
      return { id: 'g-is-' + cur.id, domain: 'isch', topic: (EP.Stemi.groups.find((g) => g.id === cur.group) || {}).name, stem: 'Which is the best interpretation of this ECG?', ecg: { rec: () => EP.Stemi.record(cur, 0.36) },
        right: label(cur), wrong: shuffle(S.filter((x) => x.group === cur.group && x !== cur)).slice(0, 2).concat(shuffle(S.filter((x) => x.group !== cur.group)).slice(0, 2)).map(label), explain: cur.teach.ecg.slice(0, 2).join(' ') };
    },
    fault() {
      const D = EP.PacerData, q = pick(D.QUIZ), f = D.FAULTS[q.fault], pat = D.PATIENTS[q.patientOverride || q.patient];
      const keys = Object.keys(D.FAULTS).filter((k) => k !== 'none');
      return { id: 'g-pm-' + q.fault, domain: 'device', topic: 'Reading a paced strip', stem: 'Patient: ' + pat.name + '. Programmed ' + q.pm.mode + ' ' + (q.pm.lrl || 60) + '/min. Lead II with the marker channel. What is wrong?',
        ecg: { layout: 'strip', markers: true, rec: () => { const sim = new EP.HeartSim(pat.cfg()); const c = Object.assign({}, EP.Pacemaker.DEF, q.pm, q.force || {}, f.set); if (f.set.forceMode) c.mode = f.set.forceMode; const pm = new EP.Pacemaker(sim, c); if (f.set.intermittent) { const flip = (t) => { pm.c.noOutput = sim.rng() < f.set.intermittent; sim.schedule(t + 900 + 1500 * sim.rng(), flip); }; sim.schedule(600, flip); } sim.runUntil(13500); const r = EP.Synth.build(sim, 3000, 13000); r.sim = sim; return r; } },
        right: f.name, wrong: others(keys, q.fault, 3).map((k) => D.FAULTS[k].name), explain: f.dx + '. ' + f.why };
    },
    tox() {
      const T = EP.Tox.list, cur = pick(T), v = cur.variants ? pick(cur.variants) : null, s = cur.fixed || cur.variants ? cur.def : (cur.id === 'ca' ? pick([0.08, 0.95]) : 0.55 + 0.35 * Math.random());
      const label = (t, vv) => t.name + (vv ? ' — ' + vv[1].toLowerCase() : t.id === 'ca' ? '' : '');
      return { id: 'g-tx-' + cur.id + (v ? v[0] : ''), domain: 'tox', topic: cur.group, stem: 'Which best explains this ECG?', ecg: { rec: () => { const sim = EP.simulate(cur.cfg(s, v ? v[0] : null), 10000); const r = EP.Synth.build(sim, 0, 10000); r.sim = sim; return r; } },
        right: label(cur, v) + (cur.id === 'ca' ? (s < 0.5 ? ' — hypocalcaemia' : ' — hypercalcaemia') : ''), wrong: others(T, cur, 4).map((t) => t.name + (t.id === 'ca' ? (s < 0.5 ? ' — hypercalcaemia' : ' — hypocalcaemia') : '')), explain: cur.teach.ecg.slice(0, 2).join(' ') };
    },
  };
  const GEN_BY = { rhythm: ['rhythm'], local: ['localPvc', 'localAp', 'localPace'], isch: ['isch'], device: ['fault'], tox: ['tox'] };

  function written(domain, used) {
    const pool = W.map((w, i) => ({ w, i })).filter((x) => x.w[0] === domain && !used.has('w' + x.i));
    if (!pool.length) return null;
    const x = pick(pool), w = x.w;
    return { id: 'w' + x.i, domain, topic: w[1], stem: w[2], right: w[3][0], wrong: w[3].slice(1), explain: w[4] };
  }
  /* Build a question set. spec: { n, domain (optional focus) } */
  function build(spec) {
    const out = [], used = new Set();
    const add = (d) => {
      const gens = GEN_BY[d];
      const tryGen = () => { for (let k = 0; k < 6; k++) { const c = GEN[pick(gens)](); if (!used.has(c.id)) return c; } return null; };
      const preferGen = !!gens && (d === 'rhythm' || d === 'local' || Math.random() < 0.5);
      let q = preferGen ? tryGen() : written(d, used);
      if (!q) q = gens && !preferGen ? tryGen() : written(d, used);
      if (q) { used.add(q.id); out.push(q); }
    };
    if (spec.domain) for (let i = 0; i < spec.n; i++) add(spec.domain);
    else {
      const doms = Object.keys(QUOTA), total = doms.reduce((a, d) => a + QUOTA[d], 0);
      for (const d of doms) { const k = Math.max(1, Math.round((QUOTA[d] / total) * spec.n)); for (let i = 0; i < k && out.length < spec.n + 2; i++) add(d); }
    }
    return shuffle(out).slice(0, spec.n);
  }

  // ---- history ---------------------------------------------------------------------------------------
  const Store = {
    sessions: UI.store.get('assess', []),
    db: null,
    async init(onChange) {
      try {
        const c = globalThis.claude;
        if (!c || !c.use) return;
        const db = await c.use('db');
        if (!db) return;
        this.db = db;
        const snap = await Promise.race([db.collection('assessment').orderBy('t', 'desc').limit(40).get(), new Promise((r) => setTimeout(() => r(null), 10000))]);
        if (!snap) return;
        const seen = new Set(this.sessions.map((s) => s.t));
        for (const d of snap.docs) { const x = d.data(); if (x && x.t && !seen.has(x.t)) this.sessions.push(x); }
        this.sessions.sort((a, b) => a.t - b.t);
        UI.store.set('assess', this.sessions.slice(-40));
        if (onChange) onChange();
      } catch (e) { /* database unavailable: the browser copy is still used */ }
    },
    save(s) {
      this.sessions.push(s); UI.store.set('assess', this.sessions.slice(-40));
      if (this.db) this.db.collection('assessment').add(s).catch(() => {});
    },
    clear() { this.sessions = []; UI.store.set('assess', []); },
    /* → { domain: { n, right, sureWrong, guessRight, topics: {topic: [n, right]} } } */
    stats() {
      const st = {};
      for (const s of this.sessions) for (const it of s.items || []) {
        const d = (st[it.d] = st[it.d] || { n: 0, right: 0, sureWrong: 0, guessRight: 0, topics: {} });
        d.n++; if (it.ok) d.right++; if (!it.ok && it.c === 2) d.sureWrong++; if (it.ok && it.c === 0) d.guessRight++;
        const tp = (d.topics[it.s] = d.topics[it.s] || [0, 0]); tp[0]++; if (it.ok) tp[1]++;
      }
      return st;
    },
  };
  EP.Assess = { W, DOM, build, Store };

  function gapMap(st, compact) {
    const rows = Object.keys(DOM).map((d) => ({ d, x: st[d] })).filter((r) => r.x && r.x.n);
    if (!rows.length) return h('p.muted', 'No answers recorded yet. Take the baseline set to see where to focus.');
    rows.sort((a, b) => a.x.right / a.x.n - b.x.right / b.x.n);
    const el = h('div', { style: { display: 'grid', gap: '8px' } });
    for (const r of rows) {
      const pct = Math.round((100 * r.x.right) / r.x.n), col = pct >= 80 ? 'var(--good)' : pct >= 55 ? 'var(--gold)' : 'var(--bad)';
      const weak = Object.keys(r.x.topics).filter((t) => r.x.topics[t][1] < r.x.topics[t][0]).sort((a, b) => r.x.topics[a][1] / r.x.topics[a][0] - r.x.topics[b][1] / r.x.topics[b][0]).slice(0, 3);
      el.append(h('div', h('div.row', { style: { justifyContent: 'space-between' } }, h('button.btn.sm', { type: 'button', onclick: () => EP.go(DOM[r.d][1], true), title: 'Open the related tab' }, DOM[r.d][0]), h('span.mono', r.x.right + ' / ' + r.x.n + ' · ' + pct + '%')),
        h('div', { style: { height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' } }, h('div', { style: { width: pct + '%', height: '100%', background: col } })),
        compact || (!weak.length && !r.x.sureWrong) ? null : h('div.muted', { style: { fontSize: '12px', marginTop: '3px' } }, (weak.length ? 'Missed: ' + weak.join(', ') + '. ' : '') + (r.x.sureWrong ? r.x.sureWrong + ' confident but wrong. ' : '') + (r.x.guessRight ? r.x.guessRight + ' right by guessing.' : ''))));
    }
    return el;
  }

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'assess', title: 'Assessment',
    mount(root) {
      let view = null, qs = [], qi = 0, items = [], chosen = null, review = [];
      const main = h('div');
      const destroyView = () => { if (view && view.ro) view.ro.disconnect(); view = null; };
      function home() {
        destroyView(); main.innerHTML = '';
        const st = Store.stats(), tot = Object.values(st).reduce((a, x) => a + x.n, 0);
        const weakest = Object.keys(st).filter((d) => st[d].n >= 2).sort((a, b) => st[a].right / st[a].n - st[b].right / st[b].n)[0];
        const domBtns = h('div.variants', Object.keys(DOM).map((d) => h('button.btn.sm', { type: 'button', onclick: () => start({ n: 8, domain: d }) }, DOM[d][0])));
        main.append(h('div.two',
          h('section.card', h('div.card-h', h('h2', 'Find your gaps')), h('div.card-b.prose',
            h('p', 'Fellow-level questions across ten domains. Most are built on ECGs generated fresh by the simulator, so you cannot memorise them; the rest are short written items on mechanisms, device behaviour and management.'),
            h('p', 'After each answer you say how sure you were. That separates what you know, what you guessed, and — most useful — what you were confident about and got wrong.'),
            h('div.row', { style: { marginTop: '12px' } }, h('button.btn.primary', { type: 'button', onclick: () => start({ n: 30 }) }, 'Baseline assessment · 30 questions'), h('button.btn', { type: 'button', onclick: () => start({ n: 10 }) }, 'Quick set · 10'),
              weakest ? h('button.btn', { type: 'button', onclick: () => start({ n: 8, domain: weakest }) }, 'Drill my weakest: ' + DOM[weakest][0]) : null),
            h('h4', { style: { marginTop: '14px' } }, 'Or drill one domain (8 questions)'), domBtns)),
          h('section.card', h('div.card-h', h('h3', 'Gap map'), h('span.grow'), h('span.muted.mono', tot + ' answered'), tot ? h('button.btn.sm', { type: 'button', onclick: () => { Store.clear(); home(); } }, 'Clear') : null), h('div.card-b', gapMap(st),
            h('p.muted', { style: { fontSize: '12px', marginTop: '10px' } }, 'Sorted weakest first. Each domain name opens its tab. ' + (Store.db ? 'History is saved with this page.' : 'History is saved in this browser.'))))));
      }
      function start(spec) { qs = build(spec); qi = 0; items = []; review = []; ask(); }
      function ask() {
        destroyView(); main.innerHTML = ''; chosen = null;
        const q = qs[qi], opts = shuffle([q.right].concat(q.wrong));
        const optEl = h('div.opts'), fb = h('div', { style: { marginTop: '10px' } });
        let ecgCard = null;
        if (q.ecg) {
          const canvas = h('canvas', { 'aria-label': 'ECG for this question' }), box = h('div.ecg-scroll', canvas);
          ecgCard = h('section.card', h('div.card-h', h('h3', 'ECG'), h('span.grow'), h('span.muted', { style: { fontSize: '12px' } }, 'drag on the trace to measure')), box);
          view = new EP.ECGView(canvas, q.ecg.layout === 'strip' ? { layout: 'strip', strips: [1], markers: !!q.ecg.markers, rowMm: 34 } : { layout: '12', strips: [1] });
          try { view.setRecording(q.ecg.rec()); } catch (e) { console.error(e); }
        }
        const reveal = (conf) => {
          const ok = chosen === q.right;
          items.push({ d: q.domain, s: q.topic, q: q.id, ok, c: conf });
          if (!ok || conf === 0) review.push({ q, chosen, ok, conf });
          for (const b of optEl.children) { b.disabled = true; if (b.textContent === q.right) b.classList.add('right'); else if (b.textContent === chosen) b.classList.add('wrong'); }
          fb.innerHTML = '';
          fb.append(h('div.note' + (ok ? '.good' : '.bad'), h('b', ok ? 'Correct. ' : 'Answer: ' + q.right + '. '), q.explain),
            h('div.row', { style: { marginTop: '10px' } }, h('button.btn.primary', { type: 'button', onclick: () => { qi++; if (qi < qs.length) ask(); else finish(); } }, qi + 1 < qs.length ? 'Next question' : 'See results'),
              h('span.pill', DOM[q.domain][0]), h('span.muted', { style: { fontSize: '12px' } }, q.topic || '')));
        };
        for (const o of opts) optEl.append(h('button.opt', { type: 'button', onclick: (ev) => {
          if (chosen) return; chosen = o;
          for (const b of optEl.children) b.disabled = true;
          ev.currentTarget.style.borderColor = 'var(--accent)';
          fb.innerHTML = '';
          fb.append(h('div.eyebrow', { style: { marginBottom: '6px' } }, 'How sure were you?'), h('div.row', [['Guessing', 0], ['Fairly sure', 1], ['Certain', 2]].map(([t, c]) => h('button.btn', { type: 'button', onclick: () => reveal(c) }, t))));
        } }, o));
        const qCard = h('section.card', h('div.card-h', h('h3', 'Question ' + (qi + 1) + ' of ' + qs.length), h('span.grow'), h('button.btn.sm', { type: 'button', onclick: () => (items.length ? finish() : home()) }, 'End')),
          h('div.card-b', h('p', { style: { fontWeight: '500', marginBottom: '10px' } }, q.stem), optEl, fb));
        main.append(ecgCard ? h('div.sim', h('div.sim-main', ecgCard), h('div.sim-main', qCard)) : h('div', { style: { maxWidth: '760px' } }, qCard));
      }
      function finish() {
        destroyView(); main.innerHTML = '';
        const right = items.filter((i) => i.ok).length, sess = { t: Date.now(), n: items.length, right, items };
        if (items.length) Store.save(sess);
        const st = {}; for (const it of items) { const d = (st[it.d] = st[it.d] || { n: 0, right: 0, sureWrong: 0, guessRight: 0, topics: {} }); d.n++; if (it.ok) d.right++; if (!it.ok && it.c === 2) d.sureWrong++; if (it.ok && it.c === 0) d.guessRight++; const tp = (d.topics[it.s] = d.topics[it.s] || [0, 0]); tp[0]++; if (it.ok) tp[1]++; }
        const sure = review.filter((r) => !r.ok && r.conf === 2), wrong = review.filter((r) => !r.ok && r.conf !== 2), lucky = review.filter((r) => r.ok);
        const block = (title, note, arr) => (arr.length ? [h('h4', title), h('p.muted', { style: { fontSize: '12px' } }, note), h('div.findings', { style: { marginTop: '6px' } }, arr.map((r) => h('div.finding', h('span.pill', DOM[r.q.domain][0].split(' ')[0]), h('div', h('b', r.q.stem), r.ok ? null : h('div', { style: { color: 'var(--bad)' } }, 'You chose: ' + r.chosen), h('div', 'Answer: ' + r.q.right), h('div.muted', r.q.explain)))))] : null);
        main.append(h('div.two',
          h('section.card', h('div.card-h', h('h2', 'This set: ' + right + ' / ' + items.length)), h('div.card-b', gapMap(st), h('div.row', { style: { marginTop: '12px' } }, h('button.btn.primary', { type: 'button', onclick: home }, 'Back to overview'), h('button.btn', { type: 'button', onclick: () => start({ n: 10 }) }, 'Another 10')))),
          h('section.card', h('div.card-h', h('h3', 'All sessions')), h('div.card-b', gapMap(Store.stats(), true)))),
          h('section.card', { style: { marginTop: '14px' } }, h('div.card-h', h('h3', 'Review')), h('div.card-b.prose', { style: { maxWidth: 'none' } },
            block('Confident but wrong', 'These are misconceptions rather than gaps — the highest-value items to revisit.', sure),
            block('Wrong', 'Knowledge gaps you were already unsure about.', wrong),
            block('Right by guessing', 'Correct, but not yet reliable.', lucky),
            !review.length ? h('p', 'Nothing to review: every answer was correct and none was a guess.') : null)));
      }
      root.append(main);
      home();
      Store.init(() => { if (!qs.length) home(); });
      return { unmount() { destroyView(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
