/* EP Simulator — course track: drugs and electrolytes on the ECG. Unit ids t1, t2, t3, t4.
 * Benches use the static 'ecg' bench (EP.Course.EcgBench) driven by EP.Tox configurations.
 * See docs/COURSE_AUTHORING.md. Edit only this file. */
(function (EP) {
  'use strict';
  const C = EP.Course, S = C.S, { para, list, ol, table } = C.T, { pick, shuffle } = C.util;
  const R = EP.Rhythms, Tox = EP.Tox;

  // ---- helpers --------------------------------------------------------------------------------------
  /* Build a recording from a tox condition at severity s (0..1) and optional variant. */
  function toxRec(id, s, v) {
    const t = Tox.byId[id];
    const sim = EP.simulate(t.cfg(s == null ? t.def : s, v), 10000);
    const rec = EP.Synth.build(sim, 0, 10000);
    rec.sim = sim; rec.entry = t;
    return rec;
  }
  const READ = (rec, p, m) => [['Rate', m.vRate, '/min'], ['PR', m.pr, 'ms'], ['QRS', m.qrs, 'ms'],
    ['QT / QTc', m.qt == null ? null : m.qt + ' / ' + m.qtc, 'ms'], ['Axis', m.axis == null ? null : m.axis, '°']];

  // parameter → severity maps (inverse of the engine's unit() scaling)
  const sHyperK = (k) => (k - 5.2) / 4.3;     // K = 5.2 + 4.3 s
  const sHypoK = (k) => (3.6 - k) / 1.7;      // K = 3.6 − 1.7 s
  const sCa = (ca) => (ca - 0.7) / 1.3;       // Ca = 0.7 + 1.3 s
  const sQt = (qtc) => (qtc - 440) / 200;     // QTc = 440 + 200 s
  const sCold = (temp) => (36 - temp) / 9;    // Core = 36 − 9 s

  // make() functions for each condition
  const mk = {
    hyperk: (p) => toxRec('hyperk', sHyperK(p.k)),
    hypok: (p) => toxRec('hypok', sHypoK(p.k)),
    tca: (p) => toxRec('tca', p.sev / 100),
    ca: (p) => toxRec('ca', sCa(p.ca)),
    qt: (p) => toxRec('qt', sQt(p.qtc)),
    bbccb: (p) => toxRec('bbccb', p.sev / 100),
    dig: (p) => toxRec('dig', 0, p.variant),
    cold: (p) => toxRec('cold', sCold(p.temp)),
    flec: () => toxRec('flec', 1),
    unknown: (p) => toxRec(p.cond, p.s, p.v),
  };
  // controls
  const CTL = {
    k_hyper: { k: 'k', label: 'Serum potassium', min: 5.0, max: 9.5, step: 0.1, unit: 'mmol/L' },
    k_hypo: { k: 'k', label: 'Serum potassium', min: 1.9, max: 3.6, step: 0.1, unit: 'mmol/L' },
    sev: { k: 'sev', label: 'Severity of overdose', min: 0, max: 100, step: 5, unit: '%' },
    ca: { k: 'ca', label: 'Ionised calcium', min: 0.70, max: 2.00, step: 0.05, unit: 'mmol/L' },
    qtc: { k: 'qtc', label: 'Repolarisation delay (QTc)', min: 440, max: 640, step: 10, unit: 'ms' },
    temp: { k: 'temp', label: 'Core temperature', min: 27, max: 36, step: 0.5, unit: '°C' },
    digv: { k: 'variant', label: 'Digoxin pattern', opts: [['effect', 'Therapeutic effect'], ['big', 'Ventricular bigeminy'],
      ['atb', 'Atrial tachycardia with block'], ['regaf', 'Regularised AF'], ['bidir', 'Bidirectional VT']] },
  };
  /* bench spec: condition make, parameter defaults, optional controls */
  const bench = (cond, p, ctl) => ({ kind: 'ecg', layout: '12', make: mk[cond], p: p || {}, ctl: ctl || [], read: READ });

  // ===================================================================================================
  const UNITS = [

    // ---- t1 Potassium -------------------------------------------------------------------------------
    { id: 't1', title: 'Potassium', short: 'Potassium', goal: 'Read the hyperkalaemia sequence, act on the QRS not the number, and recognise the hypokalaemia picture.',
      teach: () => [
        para('Potassium sets the **resting membrane potential**. Everything on the ECG follows from what a changed potential does to the ion channels.'),
        list([
          '**Raise it and the resting potential becomes less negative.** Sodium channels sit partly inactivated at a depolarised resting potential, so fewer are available for phase 0: conduction slows through atria, node and ventricle. Repolarisation also speeds up, because the potassium conductance rises — the earliest change is a tall, narrow, symmetrical ("tented") T wave with a short QT.',
          'The **sequence**, roughly: peaked T waves (≈ 5.5–6.5) → PR prolongation and loss of the P wave as the atria stop conducting (≈ 6.5–7.5) → QRS widening (≈ 7.5–8.5) → the wide QRS and T merge into a sine wave, then VF or asystole.',
          'The **ECG and the level correlate loosely.** Some patients arrest with almost normal tracings; a wide-complex bradycardia in a dialysis patient is hyperkalaemia until proven otherwise. Read the ECG for risk, not to estimate the number.',
          '**Treatment ladder.** Any ECG change of hyperkalaemia is an indication for intravenous calcium, and a widening QRS or an arrhythmia makes it immediate. Calcium restores the gap between resting and threshold potential and stabilises the membrane within minutes, but it does **not** lower potassium and lasts only 30–60 min. Then **shift** it into cells (insulin with dextrose, nebulised salbutamol; bicarbonate if acidotic), then **remove** it (dialysis, diuretics if making urine, binders for the slow phase).',
          '**Hypokalaemia is the mirror.** The repolarising current falls, so the action-potential tail lengthens: the T flattens, a U wave rises after it, and the "QT" you measure is really a QU. It drives ectopy and torsades, and is refractory until **magnesium** is replaced — low magnesium causes renal potassium wasting.'])],
      steps: () => {
        const kPR = pick([6.7, 6.9, 7.1]), kQRS = pick([7.6, 7.8, 8.0]);
        return [
          S.look('Read the hyperkalaemia strip', 'Potassium 6.5 mmol/L. The T waves are tall, narrow-based and symmetrical — best in V2–V4 — and the QT is short. The PR has just begun to lengthen. Nothing is wide yet: this is an early picture, and the risk is that it moves.',
            bench('hyperk', { k: 6.5 })),
          S.mcq('why-k', 'Why potassium changes the ECG', 'Why does a rise in serum potassium change the ECG at all?',
            ['It depolarises the resting membrane, inactivating sodium channels so conduction slows',
              'It raises the threshold potential, so each and every cell needs a larger stimulus before it will fire',
              'It lengthens repolarisation by blocking the hERG potassium channel in phase 3',
              'It prolongs the plateau by increasing the inward calcium current in phase 2'],
            'A higher extracellular K⁺ makes the resting potential less negative. Sodium channels are partly inactivated at a depolarised resting potential, so fewer open for phase 0: conduction slows everywhere. Early on, the raised potassium conductance also speeds repolarisation, giving the tall peaked T.'),
          S.num('pr', 'Measure the PR', `Potassium ${kPR} mmol/L. The P waves still conduct. Measure the PR interval on the tracing.`,
            (b) => b.m.pr, 20, 'ms', (b) => `About ${b.m.pr} ms — first-degree block. As potassium climbs the P waves flatten and the PR lengthens until the atria stop conducting and the P wave disappears, although the sinus node may still drive the ventricles.`,
            { bench: bench('hyperk', { k: kPR }) }),
          S.act('widen', 'Find the stage that cannot wait', 'Raise the potassium on the slider to the first stage where the QRS widens past about 120 ms — the point at which intravenous calcium can no longer wait.',
            { bench: bench('hyperk', { k: 5.5 }, [CTL.k_hyper]),
              check: (x) => x.changes >= 1 && x.m.qrs >= 118 && x.m.qrs <= 180, solve: (b) => b.set('k', 7.9),
              live: (x) => (x.m.qrs < 118 ? 'The QRS is still narrow. Keep raising the potassium — watch the complexes broaden.' : null),
              hint: 'The QRS begins to widen above roughly 7.5 mmol/L.',
              why: 'A widening QRS means sodium-channel availability has fallen far enough to threaten conduction; the next step is a sine wave. Calcium is the immediate move, before — and while — you shift and remove the potassium.' }),
          S.num('qrs', 'Measure the wide QRS', `Potassium ${kQRS} mmol/L, no P waves visible. Measure the QRS duration.`,
            (b) => b.m.qrs, 20, 'ms', (b) => `About ${b.m.qrs} ms. The bizarre intraventricular conduction delay of hyperkalaemia does not respect the usual bundle-branch patterns; it widens smoothly toward the sine wave.`,
            { bench: bench('hyperk', { k: kQRS }) }),
          S.mcq('ladder', 'First drug for a wide-complex hyperkalaemia', 'A dialysis patient has a wide-complex bradycardia and potassium 7.8 mmol/L. Which is the first drug?',
            ['Intravenous calcium, to stabilise the membrane while the potassium is lowered',
              'Insulin with dextrose, to drive the potassium into the cells over the following fifteen minutes',
              'Nebulised salbutamol, to drive potassium into the cells as a needle-free adjunct',
              'Sodium bicarbonate, to drive potassium into the cells when the patient is acidotic'],
            'Calcium (gluconate 30 mL of 10%, or chloride 10 mL of 10% centrally) raises the threshold back toward the depolarised resting potential and restores excitability within minutes. It does not lower the potassium, so shifting (insulin-dextrose, salbutamol) and removal (dialysis) must follow; repeat the calcium if the ECG has not improved.'),
          S.look('Now the hypokalaemia strip', 'Potassium 2.6 mmol/L. The T waves are flat, the ST segments sag, and a U wave rises after each T — largest in V2–V3. The interval that looks like a long QT is really a QU. This is the substrate for torsades.',
            bench('hypok', { k: 2.6 })),
          S.mcq('hypok', 'The hypokalaemia picture', 'Potassium 2.6 mmol/L. Which set of changes fits, and the key co-treatment?',
            ['Flat T waves, U waves and an apparent long QT; replace potassium with magnesium',
              'Tall peaked T waves with a short QT; replace the potassium alone and recheck in one hour',
              'A long flat ST segment with a normal-width T wave; give intravenous calcium gluconate',
              'Down-sloping scooped ST depression with a short QT; give digoxin-binding antibody'],
            'Low potassium flattens the T, raises a U wave, and sags the ST — the measured "QT" is a QU. Hypokalaemia potentiates every QT-prolonging drug and digoxin. It is refractory until magnesium is replaced, because hypomagnesaemia drives renal potassium wasting; aim K⁺ ≥ 4.0 (4.5–5.0 after torsades), Mg²⁺ ≥ 2.0 mg/dL.'),
        ];
      } },

    // ---- t2 Sodium-channel blockade -----------------------------------------------------------------
    { id: 't2', title: 'Sodium-channel blockade', short: 'Na-channel block', goal: 'Recognise sodium-channel toxicity from the QRS and the terminal rightward force, and treat it with bicarbonate.',
      teach: () => [
        para('Tricyclics are the model, but the same ECG and the same treatment apply to every sodium-channel blocker: flecainide and propafenone, cocaine, diphenhydramine, carbamazepine, lamotrigine, quinine and chloroquine, propranolol, bupivacaine.'),
        list([
          '**Fast-sodium-channel block slows phase 0**, so the QRS widens. The block is **use-dependent**: the drug binds the open or inactivated channel and lets go during diastole, so at fast rates — short diastole — fewer channels recover and conduction is slower. Tachycardic patients therefore look sicker.',
          'The **right bundle and the terminal right ventricle are the most sensitive** part of the conduction system, so the **last 40 ms of the QRS points up and to the right**: an R wave in aVR (a value of ≥ 3 mm is often quoted) and a deep slurred S in I and aVL.',
          '**Typical thresholds**, presented as values rather than a protocol: a QRS over 100 ms is quoted as the point that predicts seizures; over 160 ms, ventricular arrhythmia. Tricyclics also block muscarinic receptors (sinus tachycardia), alpha-1 receptors (hypotension) and potassium channels (long QT).',
          '**Sodium bicarbonate** works two ways: the sodium load increases the gradient driving current through the open channels, and alkalinisation (target pH ≈ 7.50–7.55) lowers the drug\'s affinity for the channel. Give 1–2 mmol/kg boluses, repeat until the QRS narrows, and hyperventilate if intubated.',
          '**What not to give:** class Ia and Ic antiarrhythmics (they add to the block); be cautious with physostigmine (seizures, asystole) and flumazenil (seizures) in mixed overdose. Lidocaine is the one antiarrhythmic used for refractory VT; lipid emulsion and ECMO are rescue.',
          '**Flecainide** has its own trap: in a patient taking it for AF, it slows a flutter circuit from ≈ 300 to ≈ 200/min, a rate the AV node conducts 1:1, while use-dependence widens the QRS — a regular wide tachycardia that mimics VT. Always co-prescribe an AV-nodal blocker with a class Ic drug.'])],
      steps: () => {
        const sevQRS = pick([45, 55, 60]);
        return [
          S.look('Read the overdose strip', 'Tricyclic overdose. Sinus tachycardia, a wide QRS, and a terminal force that swings up and to the right — a terminal R wave in aVR and a deep slurred S in I and aVL. The simulator shows the rightward frontal shift clearly; the aVR terminal R is modest here but points the right way.',
            bench('tca', { sev: 55 })),
          S.mcq('use-dep', 'Why faster is worse', 'Why does the QRS of tricyclic toxicity widen more when the heart rate is faster?',
            ['Blocked channels recover in diastole, and fast rates give too little diastole for recovery',
              'Faster rates raise intracellular calcium, which then directly slows phase 0 of the action potential',
              'Tachycardia shortens the QT, and a shorter QT mechanically broadens the QRS complex',
              'The anticholinergic tachycardia blocks the right bundle branch in a rate-dependent way'],
            'This is use-dependence. The drug binds the open or inactivated sodium channel and dissociates during diastole. At fast rates diastole is short, fewer channels recover between beats, so conduction slows and the QRS widens — which is why a tachycardic overdose patient is in more danger.'),
          S.act('qrs100', 'Find the seizure threshold', 'Raise the severity to the first stage where the QRS crosses about 100 ms — the width usually quoted as predicting seizures.',
            { bench: bench('tca', { sev: 15 }, [CTL.sev]),
              check: (x) => x.changes >= 1 && x.m.qrs >= 100 && x.m.qrs <= 170, solve: (b) => b.set('sev', 40),
              live: (x) => (x.m.qrs < 100 ? 'Still narrow. Push the overdose further — the complexes should broaden and the axis swing right.' : null),
              hint: 'The QRS steps past 100 ms as the terminal right-bundle delay appears.',
              why: 'QRS > 100 ms is the quoted threshold for seizures and QRS > 160 ms for ventricular arrhythmia — typical values, not a protocol. They are the trigger to start sodium bicarbonate.' }),
          S.num('qrs', 'Measure the QRS', `This overdose. Measure the QRS duration — the number that drives the bicarbonate.`,
            (b) => b.m.qrs, 20, 'ms', (b) => `About ${b.m.qrs} ms. Titrate bicarbonate boluses to this width: repeat until the QRS narrows and the terminal rightward force recedes.`,
            { bench: bench('tca', { sev: sevQRS }) }),
          S.mcq('axis', 'The terminal rightward force', 'Besides the wide QRS, which finding points to sodium-channel blockade rather than an ordinary bundle branch block?',
            ['A terminal rightward shift: an R wave in aVR with a deep slurred S in I and aVL',
              'A leftward frontal axis with small narrow q waves across the inferior and lateral limb leads',
              'A dominant R wave in V1 with discordant T-wave inversion in V1 to V3',
              'Anterior ST elevation with reciprocal ST depression in the inferior leads'],
            'The right bundle and terminal right ventricle are the most sensitive, so the last 40 ms of the QRS points up and to the right: R in aVR (≥ 3 mm is a typical cut-off) and S in I and aVL. The simulator renders the rightward frontal swing well; the aVR terminal R is deliberately shown smaller than the quoted value.'),
          S.mcq('bicarb', 'Why bicarbonate', 'Why does intravenous sodium bicarbonate narrow the QRS in tricyclic toxicity?',
            ['The sodium load and the alkalosis lift the drug off the blocked channels',
              'It chelates the drug within the plasma and speeds its elimination by the kidney',
              'It blocks the muscarinic receptors that are driving the sinus tachycardia',
              'It shifts potassium into the cells and thereby shortens the ventricular action-potential duration'],
            'Extra sodium increases the gradient driving current through the open channels, and alkalinisation (target pH ≈ 7.50–7.55) reduces the drug\'s affinity for the channel. Give 1–2 mmol/kg boluses and repeat to the QRS; hyperventilate if intubated, and use hypertonic saline if alkalaemia limits more bicarbonate.'),
          S.mcq('avoid', 'What not to give', 'The QRS is wide from a tricyclic overdose. Which drug is contraindicated?',
            ['A class Ia or Ic antiarrhythmic, which adds to the block',
              'Sodium bicarbonate boluses, carefully titrated against the measured width of the QRS',
              'Intravenous lipid emulsion as a rescue for refractory collapse',
              'Magnesium for a co-existing drug-induced long QT interval'],
            'Procainamide and flecainide block the same channel and worsen conduction. Physostigmine (seizures, asystole) and flumazenil (seizures) are also avoided in mixed overdose. Lidocaine is the antiarrhythmic kept for refractory VT; lipid and ECMO are rescue.'),
          S.mcq('flec', 'A wide regular tachycardia on flecainide', 'A patient taking flecainide for AF has a regular wide-complex tachycardia at 200/min. What is happening, and what is the danger?',
            ['1:1 conduction of slowed flutter, widened by use-dependence, so it mimics VT',
              'Pre-excited atrial fibrillation, whose irregular fast rhythm risks degenerating to ventricular fibrillation',
              'Scar-related monomorphic ventricular tachycardia, best treated here with an amiodarone load',
              'Antidromic re-entry over an accessory pathway, best treated here with intravenous adenosine'],
            'Class Ic drugs slow the flutter circuit from ≈ 300 to ≈ 200/min, a rate the AV node conducts 1:1, while use-dependence widens the QRS — a regular wide tachycardia that looks like VT. Prevent it by always pairing a class Ic drug with an AV-nodal blocker; treat with bicarbonate and, if unstable, synchronised cardioversion.',
            { bench: bench('flec', {}) }),
        ];
      } },

    // ---- t3 The QT interval -------------------------------------------------------------------------
    { id: 't3', title: 'The QT interval: calcium, drugs and torsades', short: 'QT & torsades', goal: 'Measure and correct the QT, separate the calcium picture from drug long-QT, and treat torsades.',
      teach: () => [
        para('The QT is **depolarisation plus repolarisation**. To read it you have to know which part of it a given insult lengthens, and how to correct it for rate.'),
        list([
          '**Measure** in lead II or V5–V6, take the longest, and end the T with the tangent method (ignore the U wave). **Correct for rate** — Bazett divides by √RR, which **over-corrects at fast rates** (and under-corrects when slow), so a tachycardic Bazett QTc can overstate the true value; Fridericia (cube-root) is steadier. A QTc over 500 ms, or a rise over 60 ms from baseline, is the usual action threshold.',
          '**Calcium changes the plateau, not the T wave.** Calcium sets the length of phase 2, which is the ST segment. Low calcium lengthens the ST (a long QT made of a long flat ST with a normal-width T at the end); high calcium shortens it (the T starts almost off the QRS). Compare with hypokalaemia (long QU, flat T, U wave) and drug long-QT (broad or notched T).',
          '**Acquired long QT** is almost always **hERG (IKr) potassium-channel block**, delaying repolarisation: sotalol, dofetilide, ibutilide, quinidine, procainamide; haloperidol, droperidol; methadone; macrolides and fluoroquinolones; azoles; ondansetron; citalopram; chloroquine. Risk multiplies with **female sex, bradycardia, hypokalaemia, hypomagnesaemia**, renal or hepatic impairment, heart failure and interacting drugs.',
          '**Torsades** begins when an early after-depolarisation on the long, uneven repolarisation reaches threshold — classically after a pause (**short–long–short**): a PVC, a compensatory pause, a sinus beat with a giant T-U, then a PVC on that T-U.',
          '**Treatment:** magnesium 2 g IV even with a normal level; keep K⁺ 4.5–5.0; **raise the heart rate** to shorten the QT and abolish pauses (overdrive pacing 90–110/min or isoprenaline in acquired LQT); and stop the drug. **Amiodarone, and class Ia / III drugs, are the wrong answer** — they prolong the QT further (amiodarone rarely causes torsades, but it is not the treatment).'])],
      steps: () => {
        const qtcMeas = pick([500, 540, 560]);
        const rate = pick([75, 80, 88, 100]), qt = pick([420, 460, 480, 500]);
        const qtc = Math.round(qt * Math.sqrt(rate / 60));
        return [
          S.look('The calcium picture', 'Hypocalcaemia. The QT is long, but look at how: a long, flat, isoelectric ST segment, with a normal-width T wave sitting at the end of it. The T itself is unremarkable. Now contrast this with the drug long-QT and torsades tracings that follow.',
            bench('ca', { ca: 0.80 })),
          S.mcq('ca-segment', 'What calcium lengthens', 'In hypocalcaemia the QT is long. What is actually lengthened?',
            ['The ST segment, while the T wave keeps its normal width and shape',
              'The T wave, which becomes broad and notched toward its end',
              'The QRS, from calcium-dependent slowing of ventricular conduction',
              'The PR segment, from calcium-dependent delay in the AV node'],
            'Calcium governs the plateau (phase 2), which is the ST segment: low calcium prolongs it, high calcium shortens it, and the T wave is barely changed. Hypercalcaemia gives a short QT with the T almost on the QRS; hypocalcaemia a long flat ST with a normal T.'),
          S.act('ca-slide', 'Make the ST stretch', 'Lower the ionised calcium until the QT first exceeds about 480 ms — and watch that it is the ST segment, not the T wave, that stretches.',
            { bench: bench('ca', { ca: 1.20 }, [CTL.ca]),
              check: (x) => x.changes >= 1 && x.m.qt >= 480, solve: (b) => b.set('ca', 0.80),
              live: (x) => (x.m.qt < 480 ? 'Keep lowering the calcium — the ST segment should lengthen while the T stays the same width.' : null),
              hint: 'The QT passes 480 ms as the calcium falls below about 0.85 mmol/L.',
              why: 'The lengthening is all in the isoelectric ST segment. Torsades is uncommon in hypocalcaemia precisely because the T wave itself is normal; the danger of a drug long-QT is in the broad, uneven T.' }),
          S.num('qt-measure', 'Measure the QT', 'A patient on a QT-prolonging drug. Measure the QT interval on this tracing (lead II or V5), ending the T with the tangent method.',
            (b) => b.m.qt, 35, 'ms', (b) => `About ${b.m.qt} ms. End the T where the steepest downslope meets the baseline; a prominent U wave can trick you into measuring a QU.`,
            { bench: bench('qt', { qtc: qtcMeas }) }),
          S.num('qtc', 'Correct it with Bazett', `On a tracing the heart rate is ${rate}/min and the measured QT is ${qt} ms. Compute the Bazett QTc (QTc = QT ÷ √RR, with RR in seconds).`,
            qtc, 25, 'ms', `RR = 60 000 ÷ ${rate} = ${Math.round(60000 / rate)} ms = ${(60000 / rate / 1000).toFixed(2)} s; QTc = ${qt} ÷ √${(60000 / rate / 1000).toFixed(2)} ≈ ${qtc} ms. At ${rate}/min Bazett ${rate > 85 ? 'over-corrects — it may overstate the QTc' : 'is reasonably steady'}; a cube-root (Fridericia) correction is less rate-sensitive.`),
          S.mcq('bazett-fast', 'Bazett at speed', 'A patient\'s heart rate is 110/min and the Bazett QTc comes out at 480 ms. Why read this cautiously?',
            ['Bazett over-corrects at fast rates, so it can overstate the true QTc',
              'Bazett under-corrects at fast rates, so it can understate the true QTc',
              'Bazett is only valid while the QRS complex is narrow',
              'Bazett cannot be applied when the rhythm is perfectly regular'],
            'Bazett divides by √RR, which overcorrects when the rate is high and undercorrects when it is slow. At tachycardic rates a formula such as Fridericia is steadier; where it matters, repeat the ECG once the rate has settled before acting on a borderline value.'),
          S.mcq('lqt-risk', 'Who tips into torsades', 'Which combination most raises the risk of torsades in a patient on a QT-prolonging drug?',
            ['Female sex, bradycardia, hypokalaemia and hypomagnesaemia',
              'Male sex, tachycardia, hyperkalaemia and hypermagnesaemia',
              'A short baseline QT interval with frequent atrial ectopy',
              'A wide QRS complex with a rightward frontal-plane axis'],
            'Risk multiplies with female sex, slow rates and pauses, low potassium and magnesium, renal or hepatic impairment, heart failure, and interacting drugs. The action threshold is a QTc over 500 ms or a rise over 60 ms from baseline.'),
          S.act('tdp', 'Trigger torsades', 'Increase the repolarisation delay (QTc) until torsades de pointes is triggered. Watch the short–long–short sequence that starts it.',
            { bench: bench('qt', { qtc: 480 }, [CTL.qtc]),
              check: (x) => x.changes >= 1 && x.rec && x.rec.segs.some((sg) => sg.type === 'tdp'), solve: (b) => b.set('qtc', 640),
              live: (x) => (x.rec && x.rec.segs.some((sg) => sg.type === 'tdp') ? null : 'The QT is long but stable. Push it further until an ectopic lands on the giant T-U wave.'),
              hint: 'Torsades needs the QTc up near 600 ms before a pause-triggered beat can set it off.',
              why: 'A PVC, a compensatory pause, a sinus beat with a giant T-U, then a PVC on that T-U: short–long–short. The longer and more uneven the repolarisation, the easier an early after-depolarisation reaches threshold.' }),
          S.mcq('tdp-rx', 'Treating torsades', 'Recurrent torsades in a patient with a drug-induced long QT. Which is the best immediate treatment?',
            ['Intravenous magnesium, then raise the rate by pacing or isoprenaline',
              'Intravenous amiodarone, to suppress the frequent ventricular ectopy that is driving it',
              'Intravenous procainamide, to stabilise the polymorphic rhythm',
              'Intravenous adenosine, to interrupt the re-entrant circuit'],
            'Magnesium 2 g IV even with a normal level; keep K⁺ 4.5–5.0; stop the culprit; and shorten the QT by pacing at 90–110/min or isoprenaline (acquired LQT only). Amiodarone, procainamide and other class Ia / III drugs prolong the QT further and are wrong here. Sustained or pulseless torsades is defibrillated.'),
        ];
      } },

    // ---- t4 AV-nodal poisons, digoxin and the rest --------------------------------------------------
    { id: 't4', title: 'AV-nodal poisons, digoxin and the cold heart', short: 'Nodal poisons & digoxin', goal: 'Work out the poison behind a bradycardia or an odd automatic rhythm, its mechanism, and the first treatment.',
      teach: () => [
        para('The last group slows the node, poisons the pump, or cools the whole heart. Each has a distinctive ECG and a specific antidote the usual ACLS drugs do not replace.'),
        list([
          '**Beta-blocker and calcium-channel-blocker overdose** both depress the L-type calcium current that drives the sinus and AV nodes: sinus bradycardia → PR prolongation → higher-grade AV block → junctional or ventricular escape, with hypotension. **Verapamil and diltiazem** give hyperglycaemia (calcium-dependent insulin release is blocked) and profound hypotension; **beta-blockers** give hypoglycaemia and bronchospasm; propranolol adds sodium-channel block and sotalol a long QT.',
          '**Their treatment ladder:** atropine (usually fails), intravenous **calcium**, **glucagon** 5–10 mg for beta-blockers (it bypasses the receptor), **high-dose insulin euglycaemia therapy** as the mainstay for the shock (1 unit/kg bolus then 1–10 units/kg/h with glucose and potassium), then **vasopressors**; **pacing often captures electrically without improving the pressure**, because the problem is contractility and vasodilation. Lipid emulsion and VA-ECMO are rescue.',
          '**Digoxin inhibits the Na⁺/K⁺-ATPase:** intracellular calcium rises (inotropy, and triggered automaticity from delayed after-depolarisations) and vagal tone increases (slow node). **Toxicity is increased automaticity with depressed conduction.** The effect — not toxicity — is a scooped ("reverse-tick") ST with a short QT.',
          '**The toxic patterns are nearly pathognomonic:** atrial tachycardia with block, a regularised (slow, perfectly regular) AF, accelerated junctional rhythm, bidirectional VT, and bigeminy. **Digoxin-specific antibody fragments** are the antidote. In **acute** overdose a **high** potassium marks severity (the pump is poisoned); in **chronic** toxicity, **low** potassium and magnesium are usually the precipitants.',
          '**Hypothermia** slows every ion channel: sinus bradycardia then slow AF, long PR/QRS/QT, and the **Osborn (J) wave** — a positive hump at the J point whose size tracks the temperature. Handle gently (the cold ventricle fibrillates with movement), rewarm, and do not pace or cardiovert the brady-arrhythmias; below ≈ 30 °C withhold drugs and limit shocks. "Not dead until warm and dead."'])],
      steps: () => {
        const sevPR = pick([25, 30, 35]);
        const multi = buildUnknowns();
        return [
          S.look('A poisoned-node strip', 'Beta-blocker (or calcium-channel-blocker) overdose. Sinus bradycardia with a long PR — the first rungs of nodal depression. Push it further and this becomes higher-grade block and then a junctional escape, with falling blood pressure throughout.',
            bench('bbccb', { sev: 50 })),
          S.mcq('bbccb-mech', 'Telling the two apart', 'Overdose of a beta-blocker and of verapamil both cause bradycardia with AV block. Which extra clue points to verapamil?',
            ['Hyperglycaemia, because calcium-dependent insulin release is blocked',
              'Hypoglycaemia, because hepatic glycogenolysis and the release of glucose are both blocked',
              'Bronchospasm, because beta-2 tone in the airways has been removed',
              'A widened QRS complex, because a sodium-channel block has been added'],
            'Calcium-channel blockers reduce calcium-dependent insulin secretion, so glucose runs high; beta-blockers tend to cause hypoglycaemia and bronchospasm. Propranolol adds sodium-channel block (wide QRS, seizures) and sotalol adds a long QT and torsades.'),
          S.num('pr-bbccb', 'Measure the PR', 'This beta-blocker overdose, still conducting. Measure the PR interval — the first measurable sign of nodal depression.',
            (b) => b.m.pr, 20, 'ms', (b) => `About ${b.m.pr} ms. As the overdose deepens the PR lengthens into higher-grade block, then the sinus node fails and a junctional escape takes over.`,
            { bench: bench('bbccb', { sev: sevPR }) }),
          S.act('junctional', 'Drive it to escape', 'Increase the overdose until the sinus node fails and a junctional escape rhythm takes over.',
            { bench: bench('bbccb', { sev: 50 }, [CTL.sev]),
              check: (x) => x.changes >= 1 && x.ev.filter((e) => e.type === 'QRS' && e.junctional).length >= 3, solve: (b) => b.set('sev', 90),
              live: (x) => (x.ev.filter((e) => e.type === 'QRS' && e.junctional).length >= 3 ? null : 'Still a slow sinus rhythm. Deepen the overdose until the P waves drop out and a narrow escape appears.'),
              hint: 'The sinus node gives out as the overdose approaches the top of the slider.',
              why: 'A narrow escape with no preceding P waves is the junction rescuing a poisoned sinus and AV node. Atropine usually fails; calcium and high-dose insulin are the mainstays, and pacing may capture without fixing the pressure.' }),
          S.mcq('bbccb-rx', 'Raising the pressure', 'Refractory shock from a calcium-channel-blocker overdose despite calcium and fluids. Which raises the blood pressure best?',
            ['High-dose insulin euglycaemia therapy, to restore contractility',
              'Transvenous pacing, which raises the slow ventricular rate back toward a normal rate',
              'Atropine, which blocks the vagal drive slowing the AV node',
              'Amiodarone, which stabilises the escape rhythm electrically'],
            'High-dose insulin (1 unit/kg bolus, then 1–10 units/kg/h with glucose and potassium, onset 15–40 min) is the mainstay for the shock. Give calcium and, for beta-blockers, glucagon; add vasopressors; keep lipid emulsion and VA-ECMO as rescue. Pacing often captures without improving the pressure, because the problem is contractility and vasodilation.'),
          S.mcq('dig-effect', 'Effect, not toxicity', 'Stepping through the digoxin patterns, which single feature is the therapeutic EFFECT rather than toxicity?',
            ['Down-sloping scooped ST depression with a short QT',
              'An atrial tachycardia running with a varying degree of AV block',
              'Ventricular bigeminy with a fixed coupling interval and a compensatory pause',
              'A regularised, slow and perfectly even ventricular response in AF'],
            'The scooped "reverse-tick" ST with a short QT and a long-ish PR is the therapeutic footprint and does not mean toxicity. Toxicity is increased automaticity combined with depressed conduction — the other three patterns.',
            { bench: bench('dig', { variant: 'effect' }, [CTL.digv]) }),
          S.mcq('dig-tox', 'A near-pathognomonic combination', 'A patient on digoxin has an atrial tachycardia at about 170/min with 2:1 AV block. What is the diagnosis and the antidote?',
            ['Digoxin toxicity; give digoxin-specific antibody fragments',
              'Atrial flutter; give a rate-limiting calcium-channel blocker',
              'Sinus tachycardia with block; treat the underlying cause',
              'AVNRT with aberrancy; give a rapid bolus of adenosine'],
            'Enhanced atrial automaticity with AV block is the classic toxic combination; so are regularised AF, accelerated junctional rhythm and bidirectional VT. Fab fragments treat life-threatening arrhythmia, K⁺ > 5.0–5.5 in acute overdose, or end-organ dysfunction. Avoid cardioversion if possible — it can provoke refractory VF.',
            { bench: bench('dig', { variant: 'atb' }, [CTL.digv]) }),
          S.mcq('cold', 'The cold heart', 'Core temperature 30 °C, with an Osborn (J) wave, bradycardia and slow AF. Which is the safest management?',
            ['Gentle handling and active rewarming, letting the arrhythmias resolve',
              'Transvenous pacing, to lift the slow bradycardia back toward a normal heart rate',
              'Synchronised cardioversion, to convert the atrial fibrillation',
              'An amiodarone infusion, to control the ventricular rate'],
            'The cold ventricle fibrillates with movement or central lines, and the bradycardia and AF usually resolve with rewarming, so do not pace or cardiovert them. In arrest below 30 °C European guidance limits shocks to three and withholds drugs until > 30 °C, while American guidance allows standard resuscitation alongside rewarming; both continue CPR while rewarming (ECMO if available).',
            { bench: bench('cold', { temp: 30 }) }),
          multi[0],
          multi[1],
        ];
      } },
  ];

  // ---- the end-of-track unknowns --------------------------------------------------------------------
  /* Each pool entry: the condition to render, a severity picker, and the three linked answers. */
  const POOL = [
    { key: 'hyperk', cond: 'hyperk', s: () => 0.70 + 0.1 * Math.random(),
      name: 'Hyperkalaemia (high potassium)', mech: 'A raised resting potential inactivates sodium channels', rx: 'Intravenous calcium salts', no: ['bbccb'],
      see: 'Tall peaked T waves, flat or absent P waves and a broad QRS: the hyperkalaemia sequence.', rxWhy: 'Calcium restores the gap between resting and threshold potential within minutes. Then shift the potassium (insulin with dextrose, salbutamol) and remove it.' },
    { key: 'tca', cond: 'tca', s: () => 0.5 + 0.12 * Math.random(),
      name: 'Sodium-channel-blocker toxicity', mech: 'Use-dependent sodium-channel block widens the QRS', rx: 'Intravenous sodium bicarbonate',
      see: 'Sinus tachycardia, a wide QRS and a terminal force that points to the right (S in I and aVL, R in aVR): sodium-channel block.', rxWhy: 'The sodium load and the alkalinisation displace the drug from the channel. Repeat the boluses until the QRS narrows.' },
    { key: 'bbccb', cond: 'bbccb', s: () => 0.85 + 0.1 * Math.random(),
      name: 'Beta-blocker or CCB overdose', mech: 'Depressed nodal calcium current slows the AV node', rx: 'High-dose insulin therapy', no: ['hyperk'],
      see: 'A slow, narrow rhythm with no P wave in front of the QRS: the sinus and AV nodes are suppressed and the junction has taken over.', rxWhy: 'Calcium is given first, but high-dose insulin is what restores contractility. Atropine usually fails, pacing may capture without raising the pressure, and glucagon is added for beta-blockers.' },
    { key: 'dig', cond: 'dig', v: () => pick(['atb', 'regaf', 'bidir']),
      name: 'Digoxin toxicity', mech: 'Na⁺/K⁺-ATPase block raises triggered automaticity', rx: 'Digoxin antibody (Fab) fragments',
      see: 'Increased automaticity together with AV block (atrial tachycardia with block, a slow and perfectly regular response in AF, or bidirectional VT) is the signature of digoxin toxicity.', rxWhy: 'Fab fragments bind digoxin and reverse the arrhythmia. Avoid cardioversion if possible: it can provoke refractory VF.' },
    { key: 'qt', cond: 'qt', s: () => 0.4 + 0.15 * Math.random(),
      name: 'Drug-induced QT prolongation', mech: 'hERG potassium-channel block delays repolarisation', rx: 'Stop the drug; give magnesium',
      see: 'A long QT with a broad T wave and a QRS of normal width: repolarisation is delayed, conduction is not.', rxWhy: 'Remove the cause, give magnesium, keep the potassium high-normal and prevent pauses. QT-prolonging antiarrhythmics make it worse.' },
    { key: 'cold', cond: 'cold', s: () => 0.5 + 0.18 * Math.random(),
      name: 'Hypothermia (cold exposure)', mech: 'Cold slows every cardiac ion channel', rx: 'Active internal rewarming',
      see: 'An extra positive hump at the J point (the Osborn wave) with bradycardia and long intervals.', rxWhy: 'The rhythm disturbances resolve with rewarming. Handle the patient gently and do not pace or cardiovert the bradyarrhythmia.' },
  ];
  const others = (arr, cur, n, f) => shuffle(arr.filter((x) => x !== cur)).slice(0, n).map(f);

  function unknownStep(key, cur) {
    const s = cur.s ? cur.s() : (cur.cond === 'dig' ? 0 : undefined);
    const v = cur.v ? cur.v() : null;
    const spec = bench('unknown', { cond: cur.cond, s: s, v: v });
    return S.multi('dx-' + key, 'Unknown poison', 'A poisoned or metabolically deranged patient. Read the 12-lead, then say what it is, why, and the first move.', [
      ['What is the cause?', cur.name, others(POOL, cur, 3, (x) => x.name), cur.see],
      ['What is the mechanism?', cur.mech, others(POOL, cur, 3, (x) => x.mech), 'The channel or pump that is hit explains the pattern: ' + cur.see.charAt(0).toLowerCase() + cur.see.slice(1)],
      ['Which treatment is specific to it?', cur.rx, others(POOL.filter((x) => (cur.no || []).indexOf(x.key) < 0), cur, 3, (x) => x.rx), cur.rxWhy],
    ], { bench: spec, tDone: 'Unknown poison: ' + cur.name, why: cur.mech + '.' });
  }
  function buildUnknowns() {
    const two = shuffle(POOL).slice(0, 2);
    return [unknownStep('a', two[0]), unknownStep('b', two[1])];
  }

  C.addTrack({ id: 'tox', title: 'Drugs and electrolytes', short: 'Tox', dom: 'tox',
    blurb: 'From why potassium bends the ECG to reading an unknown poison: the electrolytes, the sodium-channel blockers, the QT, the nodal poisons and digoxin.',
    bench: 'ecg', units: UNITS });
})(globalThis.EP = globalThis.EP || {});
