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
  // pairs the surface ECG cannot reliably separate: never offer one as a distractor for the other
  const CONFUSE = [['rvApex', 'midCardiacVein'], ['rvMidSeptum', 'midCardiacVein'], ['mitralAnt', 'lvSummit'], ['papPM', 'fascPost'], ['papAL', 'fascAnt'], ['lvInfBase', 'mitralPost'], ['rvApex', 'moderator']];
  const clash = (a, b) => CONFUSE.some((c) => c.includes(a) && c.includes(b));
  const othersNC = (all, self, n) => shuffle(all.filter((x) => x !== self && !clash(x[0], self[0]))).slice(0, n);
  const GEN = {
    rhythm(id) {
      const pool = R.list.filter((r) => r.id !== 'sinus-arr'), cur = (id && pool.find((r) => r.id === id)) || pick(pool);
      const opts = shuffle(pool.filter((r) => r.group === cur.group && r !== cur)).slice(0, 2).concat(shuffle(pool.filter((r) => r.group !== cur.group)).slice(0, 2));
      return { id: 'g-rh-' + cur.id, domain: 'rhythm', topic: (R.groups.find((g) => g.id === cur.group) || {}).name, stem: 'What is the rhythm?', ecg: { rec: () => R.record(cur, { params: {} }) }, right: cur.name, wrong: opts.map((o) => o.name), explain: cur.teach.ecg.slice(0, 2).join(' ') };
    },
    localPvc(id) {
      const P = EP.LocData.PRESETS, cur = (id && P.find((x) => x[0] === id)) || pick(P);
      return { id: 'g-pvc-' + cur[0], domain: 'local', topic: 'PVC / VT origin', stem: 'Sinus beats alternate with ectopic beats. Where do the wide beats arise?',
        ecg: { rec: () => { const sim = EP.simulate({ sinus: { cl: 900, resp: 0 }, avn: { fast: { retro: { block: true } } }, foci: [{ id: 'x', node: 'V', kind: 'coupled', after: 'hps', coupling: 470, every: 1, spec: Mo.spec(cur[0]), label: 'PVC' }] }, 10000); const r = EP.Synth.build(sim, 0, 10000); r.sim = sim; return r; } },
        right: cur[1], wrong: othersNC(P, cur, 4).map((x) => x[1]), explain: 'Read V1 (LBBB pattern = right ventricle/septum, RBBB pattern = left ventricle), then the inferior leads (positive = high origin, negative = low), then the precordial transition and lead I. Open the Localise tab to see the map for this site.' };
    },
    localAp(id) {
      const keys = Object.keys(R.AP), k = id && R.AP[id] ? id : pick(keys);
      return { id: 'g-ap-' + k, domain: 'local', topic: 'Accessory pathway', stem: 'Sinus rhythm with maximal pre-excitation. Where is the accessory pathway?',
        ecg: { rec: () => { const sim = EP.simulate({ sinus: { cl: 880, resp: 0 }, avn: { fast: { min: 150 } }, ap: R.apCfg(k) }, 10000); const r = EP.Synth.build(sim, 0, 10000); r.sim = sim; return r; } },
        right: R.AP[k].name, wrong: others(keys, k, 3).map((x) => R.AP[x].name), explain: 'The delta wave is negative in leads facing the insertion: negative in I/aVL with a positive V1 → left lateral; negative in III/aVF → posterior/posteroseptal; negative V1 with a left axis → right free wall; positive inferior leads with a negative V1 → anteroseptal.' };
    },
    localPace(id) {
      const P = EP.LocData.PACE, cur = (id && P.find((x) => x[0] === id)) || pick(P.filter((x) => x[0] !== 'midCardiacVein'));   // the middle cardiac vein looks like RV apical pacing: not a fair unknown
      return { id: 'g-pace-' + cur[0], domain: 'local', topic: 'Pacing site', stem: 'Complete heart block with P-synchronous ventricular pacing. Where is the ventricle being paced from?',
        ecg: { rec: () => { const sim = new EP.HeartSim({ sinus: { cl: 820, resp: 0 }, avn: { fast: { block: true, retro: { block: true } } } }); new EP.Pacemaker(sim, { mode: 'DDD', lrl: 60, vSpec: cur[2](), vSite: 'rvApex' }); sim.runUntil(12500); const r = EP.Synth.build(sim, 2000, 12000); r.sim = sim; return r; } },
        right: cur[1], wrong: othersNC(P, cur, 3).map((x) => x[1]), explain: 'LBBB pattern = right ventricular site (superior axis → apex; inferior axis → outflow tract). Terminal R in V1 with a narrow QRS → left bundle area. Dominant R in V1 with negative lead I → left ventricular site (inferior leads positive → lateral vein; negative → inferior or apical wall). An isoelectric gap then a native QRS → His bundle.' };
    },
    isch(id) {
      const S = EP.Stemi.list, cur = (id && S.find((x) => x.id === id)) || pick(S);
      const label = (x) => x.name + (x.sub ? ' — ' + x.sub : '');
      return { id: 'g-is-' + cur.id, domain: 'isch', topic: (EP.Stemi.groups.find((g) => g.id === cur.group) || {}).name, stem: 'Which is the best interpretation of this ECG?', ecg: { rec: () => EP.Stemi.record(cur, 0.36) },
        right: label(cur), wrong: shuffle(S.filter((x) => x.group === cur.group && x !== cur)).slice(0, 2).concat(shuffle(S.filter((x) => x.group !== cur.group)).slice(0, 2)).map(label), explain: cur.teach.ecg.slice(0, 2).join(' ') };
    },
    fault(id) {
      const D = EP.PacerData, q = (id && D.QUIZ.find((x) => x.fault === id)) || pick(D.QUIZ), f = D.FAULTS[q.fault], pat = D.PATIENTS[q.patientOverride || q.patient];
      const keys = Object.keys(D.FAULTS).filter((k) => k !== 'none');
      const c = Object.assign({}, EP.Pacemaker.DEF, q.pm, q.force || {}, f.set); if (f.set.forceMode) c.mode = f.set.forceMode;
      // the strip alone cannot separate every cause, so the question includes what an interrogation would show
      const inter = 'Interrogation — atrial: threshold ' + c.aThr + ' V (output ' + c.aOut + ' V), P wave ' + c.pAmp + ' mV (sensitivity ' + c.aSens + ' mV), impedance ' + f.imp[0] + ' Ω. Ventricular: threshold ' + c.vThr + ' V (output ' + c.vOut + ' V), R wave ' + c.rAmp + ' mV (sensitivity ' + c.vSens + ' mV), impedance ' + f.imp[1] + ' Ω. Battery ' + f.batt + '.';
      return { id: 'g-pm-' + q.fault, domain: 'device', topic: 'Reading a paced strip', stem: 'Patient: ' + pat.name + '. Programmed ' + q.pm.mode + ' ' + (q.pm.lrl || 60) + '/min. Lead II with the marker channel. ' + inter + ' What is the problem?',
        ecg: { layout: 'strip', markers: true, rec: () => { const sim = new EP.HeartSim(pat.cfg()); const pm = new EP.Pacemaker(sim, c); if (f.set.intermittent) { const flip = (t) => { pm.c.noOutput = sim.rng() < f.set.intermittent; sim.schedule(t + 900 + 1500 * sim.rng(), flip); }; sim.schedule(600, flip); } sim.runUntil(13500); const r = EP.Synth.build(sim, 3000, 13000); r.sim = sim; return r; } },
        right: f.name, wrong: others(keys, q.fault, 3).map((k) => D.FAULTS[k].name), explain: f.dx + '. ' + f.why + ' Fix: ' + f.fix };
    },
    tox(id) {
      const T = EP.Tox.list, fc = id ? T.filter((t) => id.indexOf(t.id) === 0).sort((a, b) => b.id.length - a.id.length)[0] : null, cur = fc || pick(T), v = cur.variants ? ((fc && cur.variants.find((x) => cur.id + x[0] === id)) || pick(cur.variants)) : null, s = cur.fixed || cur.variants ? cur.def : (cur.id === 'ca' ? pick([0.08, 0.95]) : 0.55 + 0.35 * Math.random());
      const label = (t, vv) => t.name + (vv ? ' — ' + vv[1].toLowerCase() : t.id === 'ca' ? '' : '');
      return { id: 'g-tx-' + cur.id + (v ? v[0] : ''), domain: 'tox', topic: cur.group, stem: 'Which best explains this ECG?', ecg: { rec: () => { const sim = EP.simulate(cur.cfg(s, v ? v[0] : null), 10000); const r = EP.Synth.build(sim, 0, 10000); r.sim = sim; return r; } },
        right: label(cur, v) + (cur.id === 'ca' ? (s < 0.5 ? ' — hypocalcaemia' : ' — hypercalcaemia') : ''), wrong: others(T, cur, 4).map((t) => t.name + (t.id === 'ca' ? (s < 0.5 ? ' — hypercalcaemia' : ' — hypocalcaemia') : '')), explain: cur.teach.ecg.slice(0, 2).join(' ') };
    },
  };
  const GEN_BY = { rhythm: ['rhythm'], local: ['localPvc', 'localAp', 'localPace'], isch: ['isch'], device: ['fault'], tox: ['tox'] };

  // ---- where to practise each topic: [tab, focus, what to do there] ---------------------------------
  const PM = (patient, mode, fault, extra) => ({ patient, fault: fault || 'none', pm: Object.assign({ mode }, extra || {}) });
  const PR = {
    'mech|AVNRT': ['rhythms', { id: 'avnrt' }, 'Play at 1/10 speed with the wall translucent: follow the pulse down the slow (orange) pathway and back up the fast (blue) one.'],
    'mech|AVRT': ['rhythms', { id: 'avrt' }, 'Use the ladder diagram to trace the circuit, then ask yourself what an extra trans-septal detour (ipsilateral bundle branch block) does to its length.'],
    'mech|AF': ['rhythms', { id: 'afib-rvr' }, 'Switch to rhythm strips with the ladder diagram on and count the atrial impulses that die in the AV node (red bars) before each one that conducts.'],
    'mech|Aberrancy': ['rhythms', { id: 'pac' }, 'Measure the cycle before each PAC with the calipers: the aberrant one follows the long-short sequence.'],
    'mech|AV block': ['rhythms', { id: 'wenck' }, 'Measure each PR and each R-R with the calipers: the PR grows by less each beat.'],
    'mech|Flutter': ['rhythms', { id: 'flutter-21' }, 'Watch the wave circle the tricuspid annulus on the 3D heart.'],
    'mech|SVT diagnosis': ['rhythms', { id: 'at' }, 'Compare with AVNRT and AVRT: which of them needs the AV node to continue?'],
    'mech|Wide-complex tachycardia': ['rhythms', { id: 'vt' }, 'Find the dissociated P waves in the ladder diagram, then find the fusion beats on the strip.'],
    'mech|Torsades': ['rhythms', { id: 'tdp' }, 'Measure the short-long-short sequence before the run.'],
    'mech|Pre-excitation': ['localise', { tool: 'ap', ap: 'leftLateral' }, 'Toggle "Maximise pre-excitation" on and off for a left lateral pathway, then for a right free wall pathway.'],
    'device|Upper rate': ['pacemaker', PM('chbFast', 'DDD'), 'Change PVARP and the upper tracking rate and watch Wenckebach become 2:1. Work out the 2:1 rate from AV delay + PVARP first.'],
    'device|PMT': ['pacemaker', PM('retro', 'DDD', null, { pvarp: 200, url: 120 }), 'Wait for a PVC to start the tachycardia, then lengthen PVARP or apply the magnet.'],
    'device|Magnet': ['pacemaker', PM('nsr', 'VVI'), 'Tick the magnet and watch sensing disappear; then compare with the magnet in the ICD tab.'],
    'device|Sensing': ['pacemaker', PM('nsr', 'VVI', 'vUnder'), 'Fix it yourself with the ventricular sensitivity slider. Which direction restores sensing?'],
    'device|Lead failure': ['pacemaker', PM('chb', 'VVI', 'fracture', { lrl: 70 }), 'Interrogate and read the impedance, then switch to the insulation breach and compare.'],
    'device|Insulation': ['pacemaker', PM('chb', 'DDD', 'insulation'), 'Interrogate and read the impedance, then switch to the conductor fracture and compare.'],
    'device|Crosstalk': ['pacemaker', PM('chb', 'DDD', 'xtalk'), 'Watch atrial spikes without ventricular output; read why safety pacing exists.'],
    'device|Oversensing': ['pacemaker', PM('chb', 'VVI', 'tOver', { lrl: 70 }), 'Find the extra VS marker after each paced beat and measure how much slower than 70/min it paces. Then fix it with the sensitivity slider.'],
    'device|Threshold': ['pacemaker', PM('chb', 'VVI', 'exit', { lrl: 70 }), 'Raise the ventricular output until capture returns: that is the new threshold.'],
    'hardware|Lead position': ['devices', { id: 'ddd', variant: 'cs' }, 'Switch the film to Lateral and compare "Correct position" with "Lead in a cardiac vein" and "Lead in the left ventricle"; look at V1 on each paced 12-lead.'],
    'hardware|LBB area pacing': ['devices', { id: 'lbbap' }, 'Compare the correct position with "Not deep enough" — watch V1 and the QRS width.'],
    'hardware|Leadless': ['devices', { id: 'micra' }, 'Read Micra and then AVEIR: what does each sense, and what can each pace?'],
    'hardware|S-ICD': ['devices', { id: 'sicd' }, 'Read what it cannot do, then compare with the extravascular ICD.'],
    'hardware|CRT': ['devices', { id: 'crt', variant: 'lvloss' }, 'Compare lead I and V1 between the correct position and "LV lead dislodged".'],
    'temp|Transvenous': ['temp', { kind: 'tv' }, 'Run the full threshold drill, including the sensing threshold on the sinus bradycardia patient.'],
    'temp|Transcutaneous': ['temp', { kind: 'tc' }, 'Increase the current and decide when capture is real using the arterial trace.'],
    'icd|Programming': ['icd', { cs: 'st' }, 'Run sinus tachycardia and AF with discriminators on and off, then raise the VT zone.'],
    'icd|ATP': ['icd', { cs: 'vt' }, 'Watch the burst terminate VT; then try fast VT.'],
    'icd|Inappropriate therapy': ['icd', { cs: 'noise' }, 'Let it shock, then apply the magnet.'],
    'icd|Storm': ['icd', { cs: 'storm' }, 'Read the note on what actually treats a storm.'],
    'mgmt|Pre-excited AF': ['cases', { id: 'wpwaf' }, 'Try the wrong drugs deliberately and read why each one is dangerous.'],
    'mgmt|VT': ['cases', { id: 'vtst' }, 'Work through every option, including the harmful ones.'],
    'mgmt|Torsades': ['cases', { id: 'tdp' }, 'Give magnesium, then try overdrive pacing; note which antiarrhythmics make it worse.'],
    'mgmt|Unstable tachycardia': ['cases', { id: 'afun' }, 'Compare with the stable AF case that follows it.'],
    'mgmt|Bradycardia': ['cases', { id: 'chb' }, 'Try atropine first and see what changes.'],
    'mgmt|AF': ['cases', { id: 'afst' }, 'Find the option that is right in the unstable case and harmful here.'],
    'mgmt|Digoxin': ['tox', { id: 'dig' }, 'Step through all five digoxin patterns.'],
    'isch|Posterior MI': ['stemi', { id: 'post' }, 'Toggle the posterior leads on and off.'],
    'isch|RV infarction': ['stemi', { id: 'rcaProx' }, 'Compare proximal with distal RCA: V1, V4R and the II/III ratio.'],
    'isch|Sgarbossa': ['stemi', { id: 'lbbbLad' }, 'Read the calculator for LBBB with and without occlusion, lead by lead.'],
    'isch|Swirl': ['stemi', { id: 'swirl' }, 'Lower the wall slider to see the septal territory, then compare with left main ischaemia.'],
    'isch|Wellens': ['stemi', { id: 'wellensA' }, 'Compare pattern A with pattern B.'],
    'isch|de Winter': ['stemi', { id: 'dewinter' }, 'Compare with hyperacute T waves and with hyperkalaemia in the Tox tab: what does the ST segment do at the J point in each?'],
    'isch|Conduction': ['stemi', { id: 'rbbbLad' }, 'Read why this block is infranodal.'],
    'isch|Reciprocal change': ['stemi', { id: 'rcaDist' }, 'Drag the timeline from onset and watch aVL.'],
    'tox|Sodium-channel block': ['tox', { id: 'tca' }, 'Drag the severity slider and watch aVR and the QRS width.'],
    'tox|Hyperkalaemia': ['tox', { id: 'hyperk' }, 'Drag through every stage.'],
    'tox|Calcium-channel blocker': ['tox', { id: 'bbccb' }, 'Drag the slider to junctional escape and read the treatment ladder.'],
    'tox|Calcium': ['tox', { id: 'ca' }, 'Slide from hypo- to hypercalcaemia and watch only the ST segment change.'],
    'tox|Digoxin': ['tox', { id: 'dig' }, 'Step through all five digoxin patterns.'],
    'tox|QT drugs': ['tox', { id: 'qt' }, 'Slide to the right until torsades starts; read which antiarrhythmics are contraindicated and why.'],
  };
  /* What a stored answer refers to, where to practise it, and a fresh copy of the question. */
  function describe(it) {
    const q = it.q || '';
    if (q.indexOf('c-') === 0) return EP.Course ? EP.Course.describe(q) : null;
    const m = q.match(/^g-(rh|pvc|ap|pace|is|pm|tx)-(.+)$/);
    if (!m) { const w = W[+q.slice(1)]; if (!w) return null; const pr = PR[w[0] + '|' + w[1]] || [DOM[w[0]][1], {}, 'Open the tab and work through the related material.']; return { text: w[2], key: w[3][0] + ' — ' + w[4], tab: pr[0], focus: pr[1], todo: pr[2], make: () => ({ id: q, domain: w[0], topic: w[1], stem: w[2], right: w[3][0], wrong: w[3].slice(1), explain: w[4] }) }; }
    const k = m[1], id = m[2], L = EP.LocData, D = EP.PacerData;
    if (k === 'rh') { const r = R.byId[id]; return r && { text: 'Rhythm strip: ' + r.name, key: r.teach.ecg[0], tab: 'rhythms', focus: { id }, todo: 'Study the 12-lead with the ladder diagram on, then measure the intervals yourself with the calipers.', make: () => GEN.rhythm(id) }; }
    if (k === 'pvc') { const x = L.PRESETS.find((y) => y[0] === id); return x && { text: 'PVC origin: ' + x[1], key: 'V1 for chamber, inferior leads for height, transition and lead I for the rest.', tab: 'localise', focus: { tool: 'pvc', site: id }, todo: 'Read the step-by-step panel for this site, then click the neighbouring regions and watch which leads change.', make: () => GEN.localPvc(id) }; }
    if (k === 'ap') { const a = R.AP[id]; return a && { text: 'Accessory pathway: ' + a.name, key: 'The delta wave is negative in the leads that face the insertion.', tab: 'localise', focus: { tool: 'ap', ap: id }, todo: 'Slide the pathway round the ring and watch the delta polarity table.', make: () => GEN.localAp(id) }; }
    if (k === 'pace') { const x = L.PACE.find((y) => y[0] === id); return x && { text: 'Pacing site: ' + x[1], key: 'V1 tells you which ventricle leads; the inferior leads tell you apex versus base; lead I tells you left versus right.', tab: 'localise', focus: { tool: 'pace', site: id }, todo: 'Step through all nine sites against the signature chart; cover the names and predict V1, lead I and the axis for each before looking.', make: () => GEN.localPace(id) }; }
    if (k === 'is') { const x = EP.Stemi.byId[id]; return x && { text: 'Ischaemia ECG: ' + x.name, key: x.teach.ecg[0], tab: 'stemi', focus: { id }, todo: 'Use the ST read-out under the ECG, then compare with its nearest look-alike in the list.', make: () => GEN.isch(id) }; }
    if (k === 'pm') { const f = D.FAULTS[id], qz = D.QUIZ.find((y) => y.fault === id); return f && { text: 'Paced strip: ' + f.name, key: f.dx + '.', tab: 'pacemaker', focus: PM(qz ? qz.patientOverride || qz.patient : 'chb', qz ? qz.pm.mode : 'DDD', id, qz && qz.pm.lrl ? { lrl: qz.pm.lrl } : null), todo: 'Read the automatic strip interpretation, press "Interrogate the device", then try to fix it with the programming sliders.', make: () => GEN.fault(id) }; }
    const t = EP.Tox.list.filter((y) => id.indexOf(y.id) === 0).sort((a, b) => b.id.length - a.id.length)[0];
    return t && { text: 'Tox ECG: ' + t.name, key: t.teach.ecg[0], tab: 'tox', focus: { id: t.id }, todo: 'Drag the severity slider through every stage and name what changes first.', make: () => GEN.tox(id) };
  }

  function written(domain, used) {
    const pool = W.map((w, i) => ({ w, i })).filter((x) => x.w[0] === domain && !used.has('w' + x.i));
    if (!pool.length) return null;
    const x = pick(pool), w = x.w;
    return { id: 'w' + x.i, domain, topic: w[1], stem: w[2], right: w[3][0], wrong: w[3].slice(1), explain: w[4] };
  }
  /* Build a question set. spec: { n, domain (optional focus) } */
  function build(spec) {
    if (spec.items) return spec.items.map((it) => { const d = describe(it); try { return d ? d.make() : null; } catch (e) { return null; } }).filter(Boolean);
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
    init(onChange) {
      if (!this._p) this._p = this._load();
      return this._p.then(() => { if (onChange) onChange(); });
    },
    async _load() {
      try {
        const c = globalThis.claude;
        if (!c || !c.use) return;
        const db = await c.use('db');
        if (!db) return;
        this.db = db;
        const snap = await Promise.race([db.collection('assessment').orderBy('t', 'desc').limit(40).get(), new Promise((r) => setTimeout(() => r(null), 10000))]);
        if (!snap) return;
        let oldest = Infinity;
        for (const d of snap.docs) {
          const x = d.data(); if (!x || !x.t) continue;
          x._id = d.id; oldest = Math.min(oldest, x.t);
          const i = this.sessions.findIndex((s) => s.t === x.t);
          if (i < 0) this.sessions.push(x); else if ((x.rev || 0) >= (this.sessions[i].rev || 0)) this.sessions[i] = x;   // the saved copy wins unless this browser has a newer edit
          else this.sessions[i]._id = d.id;
        }
        this.sessions.sort((a, b) => a.t - b.t);
        UI.store.set('assess', this.sessions.slice(-40));
        // sets answered before the database was reachable are uploaded now
        for (const s of this.sessions) if (!s._id && (snap.size < 40 || s.t > oldest)) this._put(s);
      } catch (e) { /* database unavailable: the browser copy is still used */ }
    },
    _put(s) { const copy = Object.assign({}, s); delete copy._id; return this.db.collection('assessment').add(copy).then((ref) => { s._id = ref && ref.id; }).catch(() => {}); },
    save(s) {
      this.sessions.push(s); UI.store.set('assess', this.sessions.slice(-40));
      if (this.db) this._put(s);
    },
    /* Strike an answer from the record (a mis-tap, or an item the learner does not want in the plan). */
    amend(q) {
      for (let i = this.sessions.length - 1; i >= 0; i--) {
        const s = this.sessions[i], it = (s.items || []).filter((x) => x.q === q && !x.void).pop();
        if (!it) continue;
        it.void = true; s.rev = (s.rev || 0) + 1;
        const live = s.items.filter((x) => !x.void); s.n = live.length; s.right = live.filter((x) => x.ok).length;
        UI.store.set('assess', this.sessions.slice(-40));
        if (this.db && s._id) { const copy = Object.assign({}, s); delete copy._id; this.db.doc('assessment/' + s._id).set(copy).catch(() => {}); }
        return true;
      }
      return false;
    },
    clear() { this.sessions = []; UI.store.set('assess', []); },
    /* One row per distinct question: its latest state.
     * status: 'misc' confident but wrong · 'gap' wrong · 'fragile' right by guessing · 'confirm' right once after a miss · 'known' */
    ledger() {
      const by = {};
      for (const s of this.sessions) for (const it of s.items || []) if (!it.void) (by[it.q] = by[it.q] || []).push(Object.assign({ t: s.t }, it));
      const rows = [];
      for (const q in by) {
        const h0 = by[q], last = h0[h0.length - 1], prev = h0[h0.length - 2];
        let status = 'known';
        if (!last.ok) status = last.c === 2 ? 'misc' : 'gap';
        else if (last.c === 0) status = 'fragile';
        else if (prev && !prev.ok) status = 'confirm';
        rows.push({ q, d: last.d, s: last.s, status, tries: h0.length, last });
      }
      const rank = { misc: 0, gap: 1, fragile: 2, confirm: 3, known: 4 };
      return rows.sort((a, b) => rank[a.status] - rank[b.status] || b.last.t - a.last.t);
    },
    due() { return this.ledger().filter((r) => r.status !== 'known'); },
    /* → { domain: { n, right, sureWrong, guessRight, topics: {topic: [n, right]} } } */
    stats() {
      const st = {};
      for (const s of this.sessions) for (const it of s.items || []) {
        if (it.void) continue;
        const d = (st[it.d] = st[it.d] || { n: 0, right: 0, sureWrong: 0, guessRight: 0, topics: {} });
        d.n++; if (it.ok) d.right++; if (!it.ok && it.c === 2) d.sureWrong++; if (it.ok && it.c === 0) d.guessRight++;
        const tp = (d.topics[it.s] = d.topics[it.s] || [0, 0]); tp[0]++; if (it.ok) tp[1]++;
      }
      return st;
    },
  };
  EP.Assess = { W, DOM, build, Store, describe, PR };

  function gapMap(st, compact) {
    const rows = Object.keys(DOM).map((d) => ({ d, x: st[d] })).filter((r) => r.x && r.x.n);
    if (!rows.length) return h('p.muted', 'No answers recorded yet. Take the baseline set to see where to focus.');
    rows.sort((a, b) => a.x.right / a.x.n - b.x.right / b.x.n);
    const el = h('div', { style: { display: 'grid', gap: '8px' } });
    for (const r of rows) {
      const pct = Math.round((100 * r.x.right) / r.x.n), col = pct >= 80 ? 'var(--good)' : pct >= 55 ? 'var(--gold)' : 'var(--bad)';
      const weak = Object.keys(r.x.topics).filter((t) => r.x.topics[t][1] < r.x.topics[t][0]).sort((a, b) => r.x.topics[a][1] / r.x.topics[a][0] - r.x.topics[b][1] / r.x.topics[b][0]).slice(0, 3);
      el.append(h('div', h('div.row', { style: { justifyContent: 'space-between' } }, h('span.row', h('button.btn.sm', { type: 'button', onclick: () => EP.go(DOM[r.d][1], true), title: 'Open the related lab' }, DOM[r.d][0]), (() => { const t = EP.Course && EP.Course.trackFor(r.d); return t && !compact ? h('button.btn.sm', { type: 'button', onclick: () => EP.open('course', { track: t.id }), title: 'Open the course that teaches this' }, 'Course →') : null; })()), h('span.mono', r.x.right + ' / ' + r.x.n + ' · ' + pct + '%')),
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
        const due = Store.due(), LBL = { misc: ['confident but wrong', 'bad'], gap: ['gap', 'bad'], fragile: ['guessed right', 'warn'], confirm: ['confirm once more', 'warn'] };
        const plan = h('div.findings');
        for (const r of due.slice(0, 14)) {
          const d = describe(r); if (!d) continue;
          plan.append(h('div.finding', h('span.pill.' + LBL[r.status][1], LBL[r.status][0]), h('div', h('b', d.text), h('div.muted', { style: { fontSize: '13px' } }, d.key), h('div', { style: { fontSize: '13px', marginTop: '3px' } }, h('b', 'Do this: '), d.todo),
            h('div.row', { style: { marginTop: '6px' } }, h('button.btn.sm', { type: 'button', onclick: () => EP.open(d.tab, d.focus) }, 'Practise in ' + (EP.Modules.find((m) => m.id === d.tab) || {}).title), h('button.btn.sm', { type: 'button', onclick: () => start({ items: [r] }) }, 'Re-test this'), h('button.btn.sm', { type: 'button', title: 'A mis-tap, or something you already know', onclick: () => { Store.amend(r.q); home(); } }, 'Not a real miss — remove')))));
        }
        const planCard = due.length ? h('section.card', { style: { marginTop: '14px' } }, h('div.card-h', h('h3', 'Study plan — ' + due.length + ' item' + (due.length > 1 ? 's' : '') + ' to close'), h('span.grow'), h('button.btn.primary', { type: 'button', onclick: () => start({ items: shuffle(due).slice(0, 12) }) }, 'Re-test what I missed')),
          h('div.card-b', h('p.muted', { style: { fontSize: '13px', marginBottom: '10px' } }, 'Each miss becomes one exercise. Do the exercise in its tab, then re-test. An item leaves this list after you get it right twice on separate sets without guessing. Misconceptions are listed first: being sure and wrong is more dangerous than not knowing.'), plan,
            due.length > 14 ? h('p.muted', { style: { fontSize: '12px', marginTop: '8px' } }, (due.length - 14) + ' more — they appear as you clear these.') : null)) : null;
        const hist = Store.sessions.slice(-6).reverse();
        const histCard = hist.length ? h('section.card', { style: { marginTop: '14px' } }, h('div.card-h', h('h3', 'Sets so far')), h('div.card-b.scroll-x', h('table.tbl', h('tbody', hist.map((x) => h('tr', h('td.mono', new Date(x.t).toLocaleDateString()), h('td.mono', x.right + ' / ' + x.n), h('td.mono', Math.round((100 * x.right) / Math.max(1, x.n)) + '%'), h('td.muted', x.src === 'course' ? 'device course' : x.n >= 25 ? 'baseline' : x.n <= 3 ? 're-test' : 'practice set'))))))) : null;
        const domBtns = h('div.variants', Object.keys(DOM).map((d) => h('button.btn.sm', { type: 'button', onclick: () => start({ n: 8, domain: d }) }, DOM[d][0])));
        main.append(h('div.two',
          h('section.card', h('div.card-h', h('h2', 'Find your gaps')), h('div.card-b.prose',
            h('p', 'Fellow-level questions across ten domains. Most are built on ECGs generated fresh by the simulator, so you cannot memorise them; the rest are short written items on mechanisms, device behaviour and management.'),
            h('p', 'After each answer you say how sure you were. That separates what you know, what you guessed, and — most useful — what you were confident about and got wrong.'),
            h('div.row', { style: { marginTop: '12px' } }, h('button.btn.primary', { type: 'button', onclick: () => start({ n: 30 }) }, 'Baseline assessment · 30 questions'), h('button.btn', { type: 'button', onclick: () => start({ n: 10 }) }, 'Quick set · 10'),
              weakest ? h('button.btn', { type: 'button', onclick: () => start({ n: 8, domain: weakest }) }, 'Drill my weakest: ' + DOM[weakest][0]) : null),
            h('h4', { style: { marginTop: '14px' } }, 'Or drill one domain (8 questions)'), domBtns)),
          h('section.card', h('div.card-h', h('h3', 'Gap map'), h('span.grow'), h('span.muted.mono', tot + ' answered'), tot ? h('button.btn.sm', { type: 'button', onclick: () => { Store.clear(); home(); } }, 'Clear') : null), h('div.card-b', gapMap(st),
            h('p.muted', { style: { fontSize: '12px', marginTop: '10px' } }, 'Sorted weakest first. Each domain name opens its lab; “Course” opens the course that teaches it from first principles. ' + (Store.db ? 'History is saved with this page.' : 'History is saved in this browser.'))))), planCard, histCard,
          h('section.card', { style: { marginTop: '14px' } }, h('div.card-h', h('h3', 'How to use this')), h('div.card-b.prose', h('ol', { style: { margin: 0, paddingLeft: '1.2em' } },
            h('li', h('b', 'Baseline once. '), '30 questions gives 2–4 per domain: enough to point, not enough to grade. Treat a domain as weak only when it stays low over two sets.'),
            h('li', h('b', 'Work the study plan, not the score. '), 'For each item do the exercise in its tab — it asks you to predict or measure something before the answer is shown — then re-test.'),
            h('li', h('b', 'Take the course for a weak domain. '), 'If a domain stays low because the ideas are not there yet, questions will not fix it: the Courses tab teaches each domain from first principles and tests it step by step.'),
            h('li', h('b', 'Drill the weakest domain. '), '8 fresh questions on one domain. The ECG items are regenerated, so you are practising the reading, not recalling the picture.'),
            h('li', h('b', 'Come back in a few days. '), 'Re-test what you missed again. Getting it right after a gap is what makes it stick; right twice on separate sets clears the item.'),
            h('li', h('b', 'Re-baseline every week or two. '), 'Compare the gap map with the last one.')))));
      }
      function start(spec) {
        qs = build(spec); qi = 0; items = []; review = [];
        if (!qs.length) { const d = spec.items && spec.items[0] && describe(spec.items[0]); if (d) EP.open(d.tab, d.focus); return; }   // hands-on items are re-tested in their own tab
        ask();
      }
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
              h('span.pill', DOM[q.domain][0]), h('span.muted', { style: { fontSize: '12px' } }, q.topic || ''), h('span.grow'),
              h('button.btn.sm', { type: 'button', onclick: (ev) => { const it = items[items.length - 1]; if (it && it.q === q.id) it.void = true; review = review.filter((r) => r.q !== q); ev.currentTarget.replaceWith(h('span.muted', { style: { fontSize: '12px' } }, 'Not counted.')); } }, 'Mis-tap — don\'t count this')));
        };
        let locked = false;
        for (const o of opts) optEl.append(h('button.opt', { type: 'button', 'aria-pressed': 'false', onclick: (ev) => {
          if (locked) return; chosen = o;
          for (const b of optEl.children) b.setAttribute('aria-pressed', String(b === ev.currentTarget));
          fb.innerHTML = '';
          fb.append(h('div.eyebrow', { style: { marginBottom: '6px' } }, 'You can still change your choice. Lock it in by saying how sure you are:'),
            h('div.row', [['Guessing', 0], ['Fairly sure', 1], ['Certain', 2]].map(([t, c]) => h('button.btn', { type: 'button', onclick: () => { locked = true; reveal(c); } }, t))));
        } }, o));
        const qCard = h('section.card', h('div.card-h', h('h3', 'Question ' + (qi + 1) + ' of ' + qs.length), h('span.grow'), h('button.btn.sm', { type: 'button', onclick: () => (items.length ? finish() : home()) }, 'End')),
          h('div.card-b', h('p', { style: { fontWeight: '500', marginBottom: '10px' } }, q.stem), optEl, fb));
        main.append(ecgCard ? h('div.sim', h('div.sim-main', ecgCard), h('div.sim-main', qCard)) : h('div', { style: { maxWidth: '760px' } }, qCard));
      }
      function finish() {
        destroyView(); main.innerHTML = '';
        const liveItems = items.filter((i) => !i.void), right = liveItems.filter((i) => i.ok).length, sess = { t: Date.now(), n: liveItems.length, right, items };
        if (liveItems.length) Store.save(sess);
        if (EP.Course) for (const it of liveItems) if (it.q.indexOf('c-') === 0) EP.Course.note(it.q, it.ok);
        const st = {}; for (const it of liveItems) { const d = (st[it.d] = st[it.d] || { n: 0, right: 0, sureWrong: 0, guessRight: 0, topics: {} }); d.n++; if (it.ok) d.right++; if (!it.ok && it.c === 2) d.sureWrong++; if (it.ok && it.c === 0) d.guessRight++; const tp = (d.topics[it.s] = d.topics[it.s] || [0, 0]); tp[0]++; if (it.ok) tp[1]++; }
        const sure = review.filter((r) => !r.ok && r.conf === 2), wrong = review.filter((r) => !r.ok && r.conf !== 2), lucky = review.filter((r) => r.ok);
        const block = (title, note, arr) => (arr.length ? [h('h4', title), h('p.muted', { style: { fontSize: '12px' } }, note), h('div.findings', { style: { marginTop: '6px' } }, arr.map((r) => h('div.finding', h('span.pill', DOM[r.q.domain][0].split(' ')[0]), h('div', h('b', r.q.stem), r.ok ? null : h('div', { style: { color: 'var(--bad)' } }, 'You chose: ' + r.chosen), h('div', 'Answer: ' + r.q.right), h('div.muted', r.q.explain), (() => { const d = describe({ q: r.q.id }); return d ? h('div.row', { style: { marginTop: '6px' } }, h('button.btn.sm', { type: 'button', onclick: () => EP.open(d.tab, d.focus) }, 'Practise this'), h('span.muted', { style: { fontSize: '12px' } }, d.todo)) : null; })()))))] : null);
        main.append(h('div.two',
          h('section.card', h('div.card-h', h('h2', 'This set: ' + right + ' / ' + liveItems.length)), h('div.card-b', gapMap(st), h('div.row', { style: { marginTop: '12px' } }, h('button.btn.primary', { type: 'button', onclick: home }, 'Back to overview'), h('button.btn', { type: 'button', onclick: () => start({ n: 10 }) }, 'Another 10')))),
          h('section.card', h('div.card-h', h('h3', 'All sessions')), h('div.card-b', gapMap(Store.stats(), true)))),
          h('section.card', { style: { marginTop: '14px' } }, h('div.card-h', h('h3', 'Review')), h('div.card-b.prose', { style: { maxWidth: 'none' } },
            block('Confident but wrong', 'These are misconceptions rather than gaps — the highest-value items to revisit.', sure),
            block('Wrong', 'Knowledge gaps you were already unsure about.', wrong),
            block('Right by guessing', 'Correct, but not yet reliable.', lucky),
            !review.length ? h('p', 'Nothing to review: every answer was correct and none was a guess.') : null)));
      }
      root.append(main);
      home();
      let alive = true;
      Store.init(() => { if (alive && !qs.length) home(); });
      return { unmount() { alive = false; destroyView(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
