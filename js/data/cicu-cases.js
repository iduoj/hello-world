/* CICU branching cases. Each node: t (minutes or label), title, text, vitals/swan/labs, choices [{text, grade, fb, effect, next}].
   Grades: best | ok | poor | harm. Teaching simulations: details simplified; doses and thresholds are typical values. */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};
  const ch = (text, grade, fb, o) => Object.assign({ text, grade, fb }, o || {});
  const L = (k, v, flag) => ({ k, v, flag: !!flag });

  const cases = [];

  /* ======================= 1. Anterior STEMI → cardiogenic shock ======================= */
  cases.push({
    id: 'cs-stemi', group: 'Cardiogenic shock', title: 'Anterior STEMI in cardiogenic shock', tags: ['STEMI', 'Shock', 'MCS'],
    teaser: 'Cold and wet with an occluded LAD. Choose the vasopressor, the revascularization strategy and when to escalate mechanical support.',
    patient: '62-year-old man · 3 h of chest pain · no prior history', bsa: 2.0, length: '7 decisions',
    init: { hr: 112, sbp: 84, dbp: 56, spo2: 91, rr: 26, rhythm: 'sinus', st: -1, uo: 20, o2: '4 L nasal cannula' },
    nodes: {
      start: {
        t: 0, title: 'ED: anterior STEMI, cold and wet', stage: 'C',
        text: 'Crushing chest pain for 3 hours. Cool, mottled knees, crackles to the mid-lung fields, JVP 10 cm. ECG: STE in V1–V5, I and aVL. Bedside echo: anterior and apical akinesis, EF ~25%, no significant MR, no VSD, no effusion.',
        labs: [L('Lactate', '4.1 mmol/L', 1), L('hs-troponin I', '8,200 ng/L', 1), L('Creatinine', '1.4 mg/dL', 1), L('Hemoglobin', '14.1 g/dL')],
        ecg: { culprit: 'plad' },
        q: 'Your priority in the next 10 minutes?',
        choices: [
          ch('Activate the cath lab for emergency angiography and PCI; give aspirin and unfractionated heparin; start norepinephrine; place an arterial line on the way', 'best',
            'Emergency revascularization of the culprit artery is the therapy proven to save lives in AMI shock (SHOCK trial: the 30-day primary endpoint narrowly missed, 46.7% vs 56.0%, but mortality was lower at 6 months, 50.3% vs 63.1%, and the benefit persisted long-term). Don’t delay transfer to "stabilize" first. Many operators hold the oral P2Y12 load until the anatomy is known, because the patient may need CABG and oral absorption is unreliable in shock.'),
          ch('Admit to the CICU, stabilize overnight on pressors, and do angiography in the morning', 'harm',
            'Delaying revascularization throws away the main survival benefit. In SHOCK, early revascularization lowered 6-month mortality by ~13 percentage points compared with initial medical stabilization.', { effect: { d: { sbp: -6, dbp: -4, hr: 6 } }, after: 'Lactate keeps rising while you wait. The cath lab is called an hour later.' }),
          ch('Give a 30 mL/kg crystalloid bolus for the hypotension', 'poor',
            'He is cold AND wet: crackles and a high JVP. A big bolus worsens pulmonary edema without raising output. A small bolus (250–500 mL) is reasonable only without congestion or with RV involvement.', { effect: { d: { spo2: -4, rr: 4 } } }),
          ch('Give full-dose fibrinolytic in the ED now', 'poor',
            'In shock, primary PCI is preferred, and fibrinolysis works poorly at low perfusion pressure. Lytics are for when PCI truly can’t happen within 120 minutes, followed by transfer for angiography.'),
        ],
        next: 'pressor',
      },
      pressor: {
        t: 10, title: 'Choosing a vasoactive drug', stage: 'C',
        vitals: { sbp: 80, dbp: 52, hr: 116 },
        text: 'While the lab gets ready, MAP has drifted to 61 mmHg. Extremities are cold and urine output is 15 mL/h. The arterial line is in.',
        q: 'Which drug do you start first?',
        choices: [
          ch('Norepinephrine', 'best', 'First-line vasopressor in cardiogenic shock. In SOAP II, dopamine caused twice the arrhythmias (24% vs 12%). The cardiogenic shock subgroup also had higher mortality with dopamine, though that subgroup finding is exploratory (no significant interaction).', { effect: { d: { sbp: 14, dbp: 8, hr: 2 } } }),
          ch('Dopamine', 'poor', 'SOAP II: twice the arrhythmias of norepinephrine (24.1% vs 12.4%), mostly atrial fibrillation, plus a signal of higher mortality in the cardiogenic shock subgroup (exploratory).', { effect: { d: { sbp: 8, hr: 22 }, set: { rhythm: 'af' } }, after: 'He goes into rapid atrial fibrillation.' }),
          ch('Phenylephrine', 'poor', 'A pure α-agonist raises afterload with no inotropy, so stroke volume can fall in a failing LV. Keep it for hypotension with fixed outflow obstruction (AS, LVOT obstruction).', { effect: { d: { sbp: 6, hr: -6 } } }),
          ch('Dobutamine alone', 'poor', 'Inotropy helps output, but β2 vasodilation can drop MAP further when you are already at 61. Add dobutamine once MAP is supported, usually alongside norepinephrine.', { effect: { d: { sbp: -4, dbp: -6, hr: 10 } } }),
          ch('Epinephrine', 'ok', 'It works, but in AMI shock (the OptimaMI trial) epinephrine caused more refractory shock than norepinephrine, with more tachycardia and lactate. Reserve it for refractory shock or after arrest.', { effect: { d: { sbp: 14, dbp: 6, hr: 14 } } }),
        ],
        next: 'cath',
      },
      cath: {
        t: 40, title: 'Cath lab: three-vessel disease',
        vitals: { sbp: 92, dbp: 60, hr: 110 },
        text: 'Angiography shows a thrombotic 100% proximal LAD occlusion (the culprit), 80% mid RCA and 75% proximal LCx. LVEDP is 32 mmHg.',
        q: 'Revascularization strategy?',
        choices: [
          ch('PCI of the culprit LAD only now; deal with the non-culprit lesions later (staged PCI or CABG once recovered)', 'best', 'CULPRIT-SHOCK: culprit-only PCI (with staged revascularization if needed) lowered 30-day death or renal replacement therapy compared with immediate multivessel PCI (45.9% vs 55.4%). The 2025 ACC/AHA ACS guideline rates routine non-culprit PCI at the index procedure in shock 3: Harm. At 1 year the mortality difference was no longer significant, and repeat revascularization was more frequent with culprit-only PCI, as expected from staging.'),
          ch('Immediate multivessel PCI of all three lesions', 'harm', 'More contrast, a longer procedure, and more ischemia and no-reflow. In CULPRIT-SHOCK this strategy had worse 30-day outcomes, and routine non-culprit PCI at the index procedure in shock is a Class 3 (harm) recommendation.', { effect: { d: { sbp: -8, dbp: -4 } } }),
          ch('Emergency CABG', 'poor', 'Reserve it for anatomy not suited to PCI, failed PCI, or mechanical complications. Here the culprit is readily treatable percutaneously and time matters.'),
          ch('Skip revascularization for now; put in mechanical support and come back tomorrow', 'harm', 'Mechanical support doesn’t replace reperfusion of an occluded artery.'),
        ],
        next: 'post',
      },
      post: {
        t: 70, title: 'After PCI: still in shock', stage: 'D',
        vitals: { sbp: 82, dbp: 54, hr: 108, rhythm: 'sinus' },
        swan: { ra: 11, pas: 44, pad: 27, pcwp: 27, co: 3.0, svo2: 48 },
        labs: [L('Lactate', '5.6 mmol/L', 1), L('Norepinephrine', '0.2 µg/kg/min'), L('Creatinine', '1.7 mg/dL', 1)],
        text: 'TIMI 3 flow restored in the LAD. He is still on norepinephrine 0.2 µg/kg/min, lactate is rising and extremities are cool. He is awake and has not had a cardiac arrest. Echo shows preserved RV function. A PA catheter has been placed.',
        q: 'How do you escalate?',
        choices: [
          ch('Place a microaxial flow pump (Impella CP) and wean pressors as output improves', 'best', 'DanGer Shock: in STEMI cardiogenic shock, a microaxial flow pump cut 180-day death (45.8% vs 58.5%). The cost was more bleeding, limb ischemia and kidney replacement therapy. The trial excluded comatose arrest survivors and predominant RV failure. The safety composite was 24.0% vs 6.2%. He fits the trial population: awake, LV-dominant failure, lactate ≥2.5, CPO ≈0.36 W, PAPi 1.5. The 2025 ACC/AHA ACS guideline rates the microaxial pump 2a in selected STEMI shock.', { effect: { set: { support: 'impella', supportLevel: 'P8' }, d: { sbp: 10, dbp: 16, hr: -8 } } }),
          ch('Place an IABP', 'poor', 'IABP-SHOCK II (600 patients): no reduction in 30-day mortality (39.7% vs 41.3%). The 2025 ACC/AHA ACS guideline rates routine IABP 3: No Benefit. It still has a role bridging mechanical complications such as acute MR or VSR.', { effect: { set: { support: 'iabp' } }, next: 'escalate' }),
          ch('Start peripheral VA-ECMO now', 'poor', 'ECLS-SHOCK: VA-ECMO did not lower 30-day mortality (47.8% vs 49.0%) and roughly doubled bleeding (23% vs 10%) and vascular complications. Routine VA-ECMO is rated 3: No Benefit in the 2025 ACC/AHA ACS guideline. Reserve it for refractory biventricular failure, arrest or severe hypoxemia, and plan LV venting, because ECMO raises LV afterload.', { effect: { set: { support: 'ecmo', supportLevel: '3.5 L/min' }, d: { sbp: 4, dbp: 14 } }, next: 'escalate' }),
          ch('Add dobutamine and reassess in an hour', 'ok', 'Reasonable when mechanical support isn’t available or appropriate; milrinone performed similarly in DOREMI. But in SCAI stage D with a very low CPO and a DanGer-type profile, waiting may lose the window.', { effect: { d: { sbp: 2, hr: 10 } }, next: 'escalate' }),
        ],
        next: 'limb',
      },
      escalate: {
        t: 160, title: 'Ninety minutes later: worse', stage: 'D',
        vitals: { sbp: 78, dbp: 52, hr: 118 },
        swan: { ra: 13, pas: 46, pad: 29, pcwp: 29, co: 2.8, svo2: 44 },
        labs: [L('Lactate', '7.1 mmol/L', 1), L('Norepinephrine', '0.3 µg/kg/min'), L('Urine', '<10 mL/h', 1)],
        text: 'Despite your escalation, mottling has spread to the thighs. CPO is ≈0.33 W. If on VA-ECMO: the echo shows a distended LV with no aortic valve opening and worsening pulmonary edema.',
        q: 'What now?',
        choices: [
          ch('Escalate to a microaxial flow pump: as primary support, or to vent the LV if on ECMO ("ECPELLA")', 'best', 'Persistent SCAI D shock calls for more LV support. On VA-ECMO, LV distension with a closed aortic valve needs unloading (Impella venting) or another venting strategy.', { effect: { set: { support: 'impella', supportLevel: 'P8' }, d: { sbp: 18, dbp: 20, hr: -10 } } }),
          ch('Increase norepinephrine and add vasopressin', 'poor', 'Escalating vasoconstrictors raises afterload on a failing LV and doesn’t treat a cardiac output problem. Multiple high-dose pressors signal you need mechanical support or a change of plan.'),
          ch('Continue the current plan and reassess in the morning', 'harm', 'SCAI D shock with a rising lactate is deteriorating. Time matters for end-organ injury.', { effect: { d: { sbp: -6, dbp: -4 } } }),
        ],
        next: 'limb',
      },
      limb: {
        t: 240, title: 'Three hours later: a cold right foot', stage: 'C',
        vitals: { sbp: 100, dbp: 78, hr: 94, spo2: 95, support: 'impella', supportLevel: 'P8', rhythm: 'sinus' },
        swan: { ra: 9, pas: 36, pad: 20, pcwp: 18, co: 4.4, svo2: 62 },
        labs: [L('Lactate', '3.0 mmol/L', 1), L('Norepinephrine', '0.05 µg/kg/min'), L('Hemoglobin', '11.2 g/dL'), L('LDH', '410 U/L')],
        text: 'Perfusion is improving and norepinephrine is down to 0.05. But the right foot, on the side of the Impella access, is cool and pale, with no Doppler signal at the dorsalis pedis.',
        q: 'What do you do?',
        choices: [
          ch('Urgent limb assessment (Doppler or angiography) and a distal perfusion catheter or vascular surgery consult, keeping support running', 'best', 'Acute limb ischemia is a known complication of large-bore femoral access, and it was more frequent with the microaxial pump in DanGer Shock. Restore distal flow promptly rather than removing life-sustaining support.'),
          ch('It’s pressor vasoconstriction; observe', 'harm', 'An absent Doppler signal distal to a large-bore sheath is limb ischemia until proven otherwise. Hours matter for limb salvage.'),
          ch('Remove the Impella now', 'poor', 'He still needs support, and removal can cause collapse. Restore limb flow (distal perfusion cannula) or move the support to axillary access if needed.'),
          ch('Increase the heparin to treat thrombosis', 'poor', 'An occlusive large-bore sheath is a mechanical problem. Anticoagulation alone won’t restore distal flow.'),
        ],
        next: 'wean',
      },
      wean: {
        t: 'Day 2', title: 'Weaning support',
        vitals: { sbp: 108, dbp: 72, hr: 88, support: 'impella', supportLevel: 'P4' },
        swan: { ra: 7, pas: 30, pad: 16, pcwp: 14, co: 4.8, svo2: 66 },
        labs: [L('Lactate', '1.4 mmol/L'), L('Norepinephrine', 'off for 12 h'), L('Creatinine', '1.5 mg/dL')],
        text: 'Off norepinephrine for 12 hours. Echo: EF 30%, no LV thrombus, the aortic valve opens on reduced support.',
        q: 'Next step?',
        choices: [
          ch('Wean the Impella stepwise (P-level reductions) with hemodynamic and echo checks, then remove it; continue heart failure care', 'best', 'Wean once perfusion is restored off vasopressors and CPO and PCWP stay stable on minimal support. Shorter device time limits hemolysis, bleeding and limb complications.'),
          ch('Start IV metoprolol now to prevent arrhythmias', 'harm', 'COMMIT/CCS-2: early IV metoprolol increased cardiogenic shock, especially in patients with heart failure or borderline hemodynamics. Start a low-dose oral beta-blocker only once he is stable off support.', { effect: { d: { sbp: -16, dbp: -8, hr: -14 } } }),
          ch('Keep the device in for another week to be safe', 'poor', 'Prolonged support adds hemolysis, bleeding, limb and infection risk, with no benefit once he has recovered.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 6', title: 'Outcome', end: true,
        vitals: { sbp: 112, dbp: 70, hr: 80, support: null, spo2: 97 }, swan: null,
        labs: [L('Lactate', '1.0 mmol/L'), L('EF', '30%')],
        text: 'Impella removed on day 3, never intubated. Creatinine is back to baseline. Transferred to the floor on day 6 for HFrEF optimization; the "Anterior STEMI with reduced EF" case picks up from here.',
      },
    },
    debrief: [
      'Stage the shock (SCAI A–E) and re-stage often: lactate, urine output, mentation, CPO and PAPi tell you whether the plan is working.',
      'Emergency culprit revascularization is the core therapy (SHOCK). Treat the culprit only at the index procedure (CULPRIT-SHOCK).',
      'Norepinephrine is the first vasopressor (SOAP II). Add an inotrope once MAP is supported.',
      'Mechanical support: a microaxial pump lowered mortality in selected STEMI shock (DanGer Shock) at a cost of complications. Routine IABP (IABP-SHOCK II) and routine VA-ECMO (ECLS-SHOCK) did not help.',
      'Large-bore access needs active limb surveillance. Wean support as soon as perfusion is restored.',
      'No IV beta-blockers in low-output states (COMMIT).',
    ],
    refs: [
      { t: 'Hochman JS et al. SHOCK trial. NEJM 1999', url: 'https://www.nejm.org/doi/full/10.1056/NEJM199908263410901' },
      { t: 'Thiele H et al. CULPRIT-SHOCK. NEJM 2017', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1710261' },
      { t: 'De Backer D et al. SOAP II. NEJM 2010', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa0907118' },
      { t: 'Møller JE et al. DanGer Shock. NEJM 2024', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2312572' },
      { t: 'Thiele H et al. IABP-SHOCK II. NEJM 2012', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1208410' },
      { t: 'Thiele H et al. ECLS-SHOCK. NEJM 2023', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2307227' },
      { t: 'Mathew R et al. DOREMI. NEJM 2021', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2026845' },
      { t: 'COMMIT/CCS-2 (early metoprolol). Lancet 2005', url: 'https://pubmed.ncbi.nlm.nih.gov/16271642/' },
      { t: '2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline. Circulation 2025;151:e771', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001309' },
    ],
  });

  /* ======================= 2. Inferior STEMI, RV infarct, CHB ======================= */
  cases.push({
    id: 'rv-chb', group: 'Cardiogenic shock', title: 'Inferior STEMI with RV infarct and complete heart block', tags: ['STEMI', 'RV failure', 'Pacing'],
    teaser: 'Hypotension right after sublingual nitroglycerin, a junctional escape at 38 and clear lungs. Treat the RV, the rate and the artery.',
    patient: '58-year-old woman · inferior STEMI · given nitroglycerin by EMS', bsa: 1.8, length: '5 decisions',
    init: { hr: 38, sbp: 76, dbp: 48, spo2: 96, rr: 20, rhythm: 'chb', escape: 'narrow', atrialRate: 84, st: 3, uo: 20, o2: 'Room air' },
    nodes: {
      start: {
        t: 0, title: 'Hypotension after nitroglycerin', stage: 'C',
        text: 'EMS gave 0.4 mg sublingual nitroglycerin and her BP fell from 104/66 to 76/48. ECG: inferior STE (III > II), STE in V1, and complete heart block with a narrow junctional escape at 38. JVP 12 cm, lungs clear. V4R shows 1.5 mm STE.',
        labs: [L('Lactate', '2.6 mmol/L', 1), L('Potassium', '4.3 mmol/L')],
        ecg: { culprit: 'prca', extra: true },
        q: 'Immediate management?',
        choices: [
          ch('Stop nitrates, give a 500 mL crystalloid bolus and atropine 1 mg, put pacing pads on, and activate the cath lab', 'best', 'RV infarction is preload dependent: nitrates and diuretics can cause profound hypotension, and a modest fluid challenge is right when the lungs are clear. Atropine often works for AV-nodal block in inferior MI. Reperfusion is the definitive therapy.', { effect: { d: { sbp: 10, dbp: 6, hr: 4 } } }),
          ch('IV furosemide 40 mg for the elevated JVP', 'harm', 'The high JVP reflects RV failure, not LV volume overload. Diuresis drops RV preload and the BP further.', { effect: { d: { sbp: -12, dbp: -8 } } }),
          ch('Give 4 L of crystalloid as fast as possible', 'poor', 'Volume helps only up to a point. Beyond that the RV dilates, the septum shifts left and LV filling falls. Give modest boluses and reassess perfusion, echo and RA pressure; multiple liters are rarely appropriate.'),
          ch('Start dopamine and wait to see if it works', 'poor', 'This delays reperfusion and pacing, and dopamine adds arrhythmia risk.'),
        ],
        next: 'pace',
      },
      pace: {
        t: 8, title: 'Still in heart block', stage: 'C',
        vitals: { hr: 42, sbp: 84, dbp: 52 },
        text: 'After atropine she is still in complete heart block at 42 with a narrow escape. BP 84/52. She is mentating but nauseated.',
        q: 'Rate support?',
        choices: [
          ch('Transcutaneous pacing now as a bridge, then a temporary transvenous pacer in the lab (AV-sequential if feasible)', 'best', 'Symptomatic high-grade block with hypotension needs pacing. A failing RV depends on atrial kick, so AV-synchronous temporary pacing can raise output substantially. Most AV block in inferior MI resolves after reperfusion.', { effect: { set: { rhythm: 'paced', support: 'tcp', hr: 70 }, d: { sbp: 10, dbp: 6 } } }),
          ch('Repeat atropine every 3 minutes up to 6 mg', 'poor', 'The atropine maximum is about 3 mg. Higher doses add nothing, and infranodal block won’t respond. Move on to pacing.'),
          ch('Isoproterenol infusion', 'poor', 'It raises myocardial oxygen demand and arrhythmia risk during active ischemia. Pace instead.'),
          ch('Implant a permanent pacemaker today', 'harm', 'AV block in inferior MI is usually AV-nodal and transient, resolving within days of reperfusion. Wait before considering permanent pacing.'),
        ],
        next: 'cath',
      },
      cath: {
        t: 35, title: 'Cath lab: proximal RCA',
        vitals: { hr: 80, sbp: 90, dbp: 56, rhythm: 'paced', support: 'pacer' },
        text: 'A temporary transvenous pacer is placed. Angiography: thrombotic occlusion of the proximal RCA, before the RV marginal branches.',
        q: 'Plan?',
        choices: [
          ch('Primary PCI of the proximal RCA', 'best', 'Restoring flow to the RCA and its RV branches improves RV recovery and survival, and the AV block usually resolves.', { effect: { d: { sbp: 6 } } }),
          ch('Fibrinolysis in the lab', 'poor', 'You’re already in the lab with an occluded artery. Mechanical reperfusion is more effective and safer.'),
          ch('Medical therapy, since the RV usually recovers', 'harm', 'The RV recovers better with reperfusion. RV infarction with shock has high mortality without it.'),
        ],
        next: 'rvfail',
      },
      rvfail: {
        t: 150, title: 'CICU: the RV is failing', stage: 'C',
        vitals: { hr: 80, sbp: 82, dbp: 54, rhythm: 'paced', support: 'pacer' },
        swan: { ra: 19, pas: 26, pad: 14, pcwp: 9, co: 3.2, svo2: 52 },
        labs: [L('Lactate', '3.4 mmol/L', 1), L('Norepinephrine', '0.1 µg/kg/min'), L('Fluids so far', '1.5 L')],
        text: 'Back in the CICU on AV-sequential pacing. MAP 63 on norepinephrine 0.1 after 1.5 L of fluid. Echo: a dilated, hypokinetic RV and an underfilled LV with a D-shaped septum.',
        q: 'Next?',
        choices: [
          ch('Stop fluids; add an inotrope (dobutamine) to the norepinephrine and keep AV-synchronous pacing; consider percutaneous RV support if she doesn’t improve', 'best', 'RA 19 with PCWP 9 (RA:PCWP >0.8) and PAPi 0.63 mean RV failure. More volume will only distend the RV. Inotropy plus AV synchrony is next, with percutaneous RV support (e.g. Impella RP) for refractory cases.', { effect: { d: { sbp: 12, dbp: 6 } } }),
          ch('Another 2 L fluid bolus', 'harm', 'RA is already 19, so the RV is overfilled. Septal shift will reduce LV filling further.', { effect: { d: { sbp: -8, dbp: -4 } } }),
          ch('Inhaled nitric oxide', 'poor', 'Pulmonary vasodilators help RV failure driven by high PVR. In RV infarction the PA pressures are low (26/14); the problem is contractility.'),
          ch('Place an Impella RP right away', 'ok', 'Reasonable if inotropes and AV synchrony fail, and observational data support it in RV infarct shock. Try those first.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 3', title: 'Outcome', end: true,
        vitals: { hr: 76, sbp: 110, dbp: 68, rhythm: 'sinus', support: null }, swan: null,
        text: 'Conduction recovered on day 2 and the pacing wire was removed. Off inotropes by day 3, and RV function is improving on echo.',
      },
    },
    debrief: [
      'Inferior STEMI with STE in V1 or V4R: suspect RV infarction. Avoid nitrates and diuretics, and give modest volume only when the lungs are clear.',
      'RV shock hemodynamics: high RA, low or normal PCWP, RA:PCWP >0.8 and low PAPi. Once RA is ~15+, stop giving fluid.',
      'AV block in inferior MI is usually nodal, narrow-complex, atropine-responsive and transient. Pace if symptomatic, keep AV synchrony, and don’t rush a permanent device.',
      'Treatment: reperfusion, an inotrope plus norepinephrine, AV-synchronous pacing, and percutaneous RV support for refractory cases.',
    ],
    refs: [
      { t: 'van Diepen S et al. Contemporary management of cardiogenic shock. Circulation 2017', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000525' },
      { t: 'Konstam MA et al. Evaluation and management of right-sided heart failure (AHA). Circulation 2018', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000560' },
      { t: 'StatPearls: Right ventricular infarction / Inferior MI', url: 'https://www.ncbi.nlm.nih.gov/books/NBK470572/' },
    ],
  });

  /* ======================= 3. Papillary muscle rupture ======================= */
  cases.push({
    id: 'pmr', group: 'Mechanical complications of MI', title: 'Flash pulmonary edema: papillary muscle rupture', tags: ['Acute MR', 'Mechanical complication', 'IABP'],
    teaser: 'Day 3 after a late-presenting inferolateral MI: sudden respiratory failure and only a soft murmur.',
    patient: '71-year-old man · day 3 after late inferolateral STEMI', bsa: 2.0, length: '3 decisions',
    init: { hr: 118, sbp: 94, dbp: 58, spo2: 84, rr: 32, rhythm: 'sinus', uo: 25, o2: '15 L non-rebreather' },
    nodes: {
      start: {
        t: 'Day 3, 02:10', title: 'Sudden dyspnea after an inferior MI', stage: 'B',
        text: 'Day 3 after an inferolateral STEMI that presented 20 h after symptom onset (LCx stented). Abrupt dyspnea and pink frothy sputum. A new, soft apical systolic murmur. CXR: pulmonary edema, worst in the right upper lobe.',
        labs: [L('Lactate', '2.8 mmol/L', 1), L('BNP', '1,850 pg/mL', 1)],
        q: 'Next step?',
        choices: [
          ch('Bedside TTE now (TEE if the jet is unclear) and call for help', 'best', 'Sudden pulmonary edema plus a new murmur after MI is a mechanical complication until proven otherwise. The murmur of acute severe MR can be soft or absent because LA pressure rises fast and the pressures equalize. Right upper lobe edema comes from an eccentric jet aimed at the right pulmonary veins.'),
          ch('CT pulmonary angiogram', 'poor', 'This delays the diagnosis. Bedside echo answers the question in minutes.'),
          ch('Treat as recurrent ACS with more antiplatelet therapy and repeat troponins', 'harm', 'It misses a surgical emergency, and extra antithrombotics raise bleeding risk before surgery.'),
          ch('High-dose IV furosemide and reassess in the morning', 'poor', 'Diuresis helps symptoms but doesn’t address the cause, and the patient can deteriorate overnight.'),
        ],
        next: 'echo',
      },
      echo: {
        t: 'Day 3, 02:30', title: 'Flail leaflet', stage: 'C',
        vitals: { spo2: 88, rr: 28, o2: 'BiPAP FiO₂ 0.6', sbp: 92, dbp: 56 },
        swan: { ra: 14, pas: 58, pad: 30, pcwp: 30, co: 3.8, svo2: 55, vwave: 30 }, wedge: true,
        findings: [['TTE', 'Flail posterior mitral leaflet with a mobile echodensity (ruptured head of the posteromedial papillary muscle), severe eccentric MR, hyperdynamic LV (EF 65%), inferolateral hypokinesis.'], ['PA catheter', 'Large V waves on the wedge tracing (yellow trace on the monitor).']],
        echo: { view: 'a4c', scores: { 5: 3, 11: 3, 4: 2, 10: 2 }, note: 'Schematic wall motion: inferolateral akinesis. The flail leaflet itself is not drawn.' },
        text: 'Bedside echo confirms it. She is on BiPAP and the surgeons are on their way in.',
        q: 'How do you stabilize her until surgery?',
        choices: [
          ch('Afterload reduction: IABP (or a microaxial pump) plus nitroprusside if MAP allows, diuresis and ventilatory support; emergency cardiac surgery consult', 'best', 'Lowering afterload sends more blood forward and shrinks the regurgitant volume. IABP is the classic bridge here, and this is not "routine" use. Emergency surgery is the definitive treatment; without it, mortality is very high.', { effect: { set: { support: 'iabp' }, d: { dbp: 8, spo2: 4, hr: -6 } } }),
          ch('High-dose norepinephrine to push MAP above 85', 'harm', 'Raising afterload increases the regurgitant fraction and worsens pulmonary edema. If she is hypotensive, support forward flow with mechanical support or an inotrope rather than more vasoconstrictor.', { effect: { d: { spo2: -5, sbp: 10 } } }),
          ch('IV metoprolol for the tachycardia', 'harm', 'Tachycardia is compensating for a small forward stroke volume. Beta-blockade can cause collapse.', { effect: { d: { sbp: -14, dbp: -8, hr: -18 } } }),
          ch('Stabilize medically and operate in 4–6 weeks once the tissue heals', 'poor', 'That delayed strategy is sometimes used for selected VSR patients who stabilize. Papillary rupture with flash pulmonary edema needs emergency surgery.'),
        ],
        next: 'definitive',
      },
      definitive: {
        t: 'Day 3, 03:30', title: 'Definitive therapy', stage: 'C',
        vitals: { spo2: 94, sbp: 98, dbp: 66, hr: 104, support: 'iabp' },
        swan: { ra: 11, pas: 46, pad: 24, pcwp: 22, co: 4.6, svo2: 63, vwave: 16 }, wedge: true,
        text: 'On IABP and nitroprusside 0.5 µg/kg/min: PCWP 22, smaller V waves, better CI. The surgeon and anesthesia are ready. Predicted surgical risk is high, but he is operable.',
        q: 'Definitive treatment?',
        choices: [
          ch('Emergency mitral valve surgery (usually replacement) ± CABG', 'best', 'The AHA 2021 statement on mechanical complications calls emergency mitral valve replacement the treatment of choice. Repair is an option for partial rupture in a stable patient with an experienced surgeon. Operative mortality is about 20–25%, but mortality without surgery is far higher.'),
          ch('Transcatheter edge-to-edge repair (TEER) instead', 'ok', 'TEER is an option for high or prohibitive surgical risk, decided by the Heart Team (case series and registries). In an operable patient, surgery remains first-line.'),
          ch('Continue IABP and medical therapy', 'harm', 'Medical therapy alone is a temporary bridge with very high mortality.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 10', title: 'Outcome', end: true,
        vitals: { sbp: 112, dbp: 68, hr: 84, spo2: 97, support: null, rr: 16 }, swan: null, wedge: false,
        text: 'Mitral valve replacement plus a vein graft to the OM on day 3. Extubated on day 2 after surgery, home on day 10.',
      },
    },
    debrief: [
      'The posteromedial papillary muscle has a single (PDA) blood supply, so it ruptures with inferior or inferolateral MI, typically days 2–7 and often after a small infarct.',
      'Acute severe MR can have a soft or absent murmur. Flash or asymmetric (right upper lobe) pulmonary edema plus a hyperdynamic LV should prompt an urgent echo, with TEE if the eccentric jet is missed.',
      'Large wedge V waves support the diagnosis but are neither sensitive nor specific.',
      'Bridge with afterload reduction (nitroprusside, IABP or microaxial pump) while arranging emergency surgery. Avoid pure vasoconstrictors and beta-blockers.',
    ],
    refs: [
      { t: 'Damluji AA et al. Mechanical complications of acute MI (AHA scientific statement). Circulation 2021', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000985' },
      { t: 'StatPearls: Papillary muscle rupture', url: 'https://www.ncbi.nlm.nih.gov/books/NBK499976/' },
    ],
  });

  /* ======================= 4. Ventricular septal rupture ======================= */
  cases.push({
    id: 'vsr', group: 'Mechanical complications of MI', title: 'New harsh murmur and shock: ventricular septal rupture', tags: ['VSR', 'Mechanical complication', 'Shunt'],
    teaser: 'Day 4 after an unreperfused anterior MI. Read the saturation step-up, pick a bridge, and time the repair.',
    patient: '68-year-old woman · day 4 after late anterior STEMI', bsa: 1.7, length: '4 decisions',
    init: { hr: 112, sbp: 86, dbp: 58, spo2: 92, rr: 28, rhythm: 'sinus', uo: 15, o2: '6 L nasal cannula' },
    nodes: {
      start: {
        t: 'Day 4, 10:00', title: 'A new thrill', stage: 'C',
        text: 'Anterior STEMI 4 days ago, presenting 30 h after onset. The LAD occlusion was managed medically elsewhere. She is now hypotensive and dyspneic, with a new loud holosystolic murmur at the left lower sternal border, a palpable thrill and a raised JVP.',
        labs: [L('Lactate', '3.6 mmol/L', 1), L('Creatinine', '1.9 mg/dL', 1)],
        q: 'Fastest confirmation?',
        choices: [
          ch('Bedside TTE with color Doppler of the septum', 'best', 'Echo shows the defect, its size, the shunt direction and RV function within minutes. A PA catheter oxygen run confirms and quantifies the shunt.'),
          ch('Cardiac MRI', 'poor', 'Excellent anatomy, but not for an unstable patient in the first hour.'),
          ch('Chest CT', 'poor', 'It delays the diagnosis, and contrast is a renal hit in a shocked patient.'),
          ch('Start heparin for presumed reinfarction and observe', 'harm', 'A new harsh murmur with a thrill after MI is a mechanical complication until proven otherwise.'),
        ],
        next: 'shunt',
      },
      shunt: {
        t: 'Day 4, 10:25', title: 'The oxygen run', stage: 'C',
        swan: { ra: 16, pas: 48, pad: 24, pcwp: 24, co: 6.4, svo2: 82, ravo2: 55 },
        findings: [['TTE', 'A 1.4 cm apical septal defect with left-to-right flow; dilated, hypokinetic RV; akinetic LV apex.'], ['Saturations', 'SVC/RA 55% · PA 82% · arterial 93%']],
        echo: { view: 'a4c', scores: { 14: 3, 17: 4, 13: 3, 16: 2, 8: 2 }, rv: true, note: 'Schematic: apical septal and apical akinesis with RV dysfunction. The defect itself is not drawn.' },
        text: 'PA catheter placed. Note the "CO" by thermodilution measured in the PA.',
        q: 'What do these numbers tell you?',
        choices: [
          ch('A large left-to-right shunt: Qp:Qs ≈ (93 − 55) ÷ (98 − 82) ≈ 2.4', 'best', 'An O₂ step-up of ≥7–8% from RA to PA means a shunt at ventricular level. Qp:Qs = (SaO₂ − mixed venous O₂) ÷ (pulmonary venous O₂ − PA O₂), taking pulmonary venous ≈98% when the lungs oxygenate. PA thermodilution measures pulmonary flow, not systemic flow, so the 6.4 L/min "CO" overestimates the systemic output.'),
          ch('Acute severe MR', 'poor', 'MR raises PCWP and can cause V waves, but it doesn’t raise PA oxygen saturation above RA. A step-up means blood is crossing left to right.'),
          ch('Normal: the cardiac output is 6.4', 'harm', 'This is the classic trap. With a VSR, PA thermodilution reflects pulmonary flow. Systemic output is much lower.'),
          ch('A right-to-left shunt', 'poor', 'That would lower the arterial saturation without a PA step-up.'),
        ],
        next: 'support',
      },
      support: {
        t: 'Day 4, 11:00', title: 'Bridging', stage: 'D',
        vitals: { sbp: 82, dbp: 54, hr: 116 },
        labs: [L('Lactate', '4.2 mmol/L', 1), L('Urine', '10 mL/h', 1), L('Norepinephrine', '0.15 µg/kg/min')],
        text: 'Perfusion is getting worse on norepinephrine.',
        q: 'How do you bridge her to repair?',
        choices: [
          ch('IABP plus an inotrope, with cautious afterload reduction and as little vasopressor as possible', 'best', 'Lowering systemic afterload reduces the left-to-right shunt and improves forward flow. IABP is the classic bridge to repair.', { effect: { set: { support: 'iabp' }, d: { sbp: 4, dbp: 14, hr: -6 } } }),
          ch('A microaxial flow pump (Impella)', 'ok', 'It unloads the LV and reduces the shunt. Over-unloading can reverse the shunt (right-to-left) and cause systemic hypoxemia, so titrate the flow and watch for suction events. Used as a bridge in experienced centers.', { effect: { set: { support: 'impella', supportLevel: 'P6' }, d: { sbp: 6, dbp: 10 } } }),
          ch('VA-ECMO with an LV-unloading strategy as a bridge to delayed repair', 'ok', 'Commonly used in Europe for profound shock. But ECMO raises LV afterload, which can distend the LV and worsen pulmonary edema and the left-to-right shunt, so it needs LV unloading (often an Impella). Too much unloading can reverse the shunt (right-to-left) and cause hypoxemia.', { effect: { set: { support: 'ecmo' } } }),
          ch('Increase norepinephrine to a MAP of 80', 'harm', 'Raising systemic afterload pushes more blood across the defect, increasing the shunt.', { effect: { d: { sbp: 10, spo2: -3 } } }),
        ],
        next: 'repair',
      },
      repair: {
        t: 'Day 4, 14:00', title: 'Timing of repair', stage: 'C',
        text: 'Support improves perfusion only modestly. Lactate is 3.8. The heart team meets.',
        q: 'When and how should the defect be closed?',
        choices: [
          ch('Urgent surgical repair now via the heart team: she is in shock and not stabilizing', 'best', 'Repair is definitive. In refractory shock that isn’t responding to support, waiting risks death before surgery. In the STS database, operative mortality was 54% for repair within 7 days vs 18% after 7 days, but patients who died while waiting aren’t counted (survivor bias).'),
          ch('Stabilize on support for 1–2 weeks, then repair', 'ok', 'A defensible, increasingly common strategy if she stabilizes on support. In a European survey, 87% of centres preferred delayed repair, mostly bridged on ECMO with LV unloading. The tissue firms up and operative mortality falls, but some patients deteriorate while waiting.'),
          ch('Percutaneous device closure', 'ok', 'An option for high surgical risk, residual shunts after surgery, or as a bridge. Acute necrotic margins make it hard to seat a device.'),
          ch('Medical therapy alone', 'harm', 'Unrepaired VSR with shock has mortality approaching 90% or more.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 14', title: 'Outcome', end: true,
        vitals: { sbp: 104, dbp: 64, hr: 88, support: null, spo2: 96 }, swan: null,
        text: 'Emergency infarct exclusion with patch repair plus a LIMA to LAD. A small residual shunt was closed percutaneously on day 12. Even with surgery, post-MI VSR carries roughly 40% in-hospital mortality.',
      },
    },
    debrief: [
      'VSR: a new harsh holosystolic murmur with a thrill, days 3–5 after MI. It is apical with anterior MI and basal inferoseptal (more complex) with inferior MI.',
      'Confirm with echo color Doppler and a PA catheter step-up. PA thermodilution "cardiac output" reflects pulmonary flow and overestimates systemic output.',
      'Bridge by reducing systemic afterload (IABP, cautious vasodilation). Avoid high-dose vasoconstrictors. VA-ECMO needs LV venting.',
      'Repair is the definitive treatment. Timing (immediate vs delayed after stabilization) is individualized by the heart team. Percutaneous closure is for selected cases.',
    ],
    refs: [
      { t: 'Damluji AA et al. Mechanical complications of acute MI (AHA scientific statement). Circulation 2021', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000985' },
      { t: 'StatPearls: Ventricular septal rupture', url: 'https://www.ncbi.nlm.nih.gov/books/NBK534873/' },
      { t: 'Arnaoutakis GJ et al. Surgical repair of post-MI VSD (STS database). Ann Thorac Surg 2012', url: 'https://pubmed.ncbi.nlm.nih.gov/22626761/' },
    ],
  });

  /* ======================= 5. Free wall rupture ======================= */
  cases.push({
    id: 'fwr', group: 'Mechanical complications of MI', title: 'Sudden bradycardia and PEA: free wall rupture', tags: ['Tamponade', 'Mechanical complication', 'Arrest'],
    teaser: 'An elderly woman with a first, unreperfused MI becomes agitated, bradycardic, then pulseless.',
    patient: '77-year-old woman · day 2 after late lateral STEMI', bsa: 1.6, length: '3 decisions',
    init: { hr: 54, sbp: 82, dbp: 60, spo2: 93, rr: 24, rhythm: 'sinus', uo: 10, paradox: true, o2: '2 L nasal cannula' },
    nodes: {
      start: {
        t: 'Day 2, 22:40', title: 'Agitation and bradycardia', stage: 'C',
        text: 'First MI: a lateral STEMI that presented 26 h after onset, LCx occluded and not reperfused. Now sudden chest pain, agitation and nausea. HR 54, BP 82/60 with a 16 mmHg pulsus paradoxus, JVP to the jaw.',
        q: 'Next?',
        choices: [
          ch('Bedside echo immediately; call cardiac surgery', 'best', 'Sudden hypotension, bradycardia, pulsus paradoxus and a high JVP in an elderly woman with a first, unreperfused transmural MI suggest rupture with tamponade.'),
          ch('Give tenecteplase for presumed reinfarction', 'harm', 'Fibrinolysis in rupture is catastrophic. Late fibrinolysis is itself a risk factor for rupture.'),
          ch('Atropine and transcutaneous pacing for the bradycardia', 'poor', 'Bradycardia here is often a vagal response to hemopericardium. Find the cause first.'),
          ch('CT angiogram of the chest', 'poor', 'Moving a patient in tamponade to the scanner is dangerous, and echo answers the question at the bedside.'),
        ],
        next: 'tamponade',
      },
      tamponade: {
        t: 'Day 2, 22:46', title: 'Pulseless', stage: 'E',
        vitals: { rhythm: 'pea', hr: 50, paradox: false },
        findings: [['Echo', 'Moderate pericardial effusion with echogenic material (clot) and RV diastolic collapse.']],
        text: 'While you scan, she loses her pulse. The monitor shows an organized rhythm at 50: PEA.',
        q: 'Immediate action?',
        choices: [
          ch('CPR plus emergency subxiphoid pericardiocentesis as a bridge; activate emergency surgery', 'best', 'Free-wall rupture with tamponade: drain enough to restore output (small volumes often help) and get to the operating room. Definitive repair is surgical.', { effect: { set: { rhythm: 'sinus', hr: 96, sbp: 84, dbp: 56, paradox: true } } }),
          ch('Standard ACLS with epinephrine every 3–5 minutes, without addressing the effusion', 'poor', 'PEA from tamponade won’t respond to epinephrine. Treat the cause.'),
          ch('Rapid fluid boluses only', 'poor', 'Volume can temporize tamponade physiology but doesn’t relieve it.'),
          ch('Stop resuscitation: rupture is always fatal', 'harm', 'Prompt drainage and surgery save a meaningful fraction, particularly subacute (oozing) ruptures.'),
        ],
        next: 'or',
      },
      or: {
        t: 'Day 2, 23:10', title: 'Return of circulation', stage: 'D',
        vitals: { rhythm: 'sinus', hr: 104, sbp: 92, dbp: 58, paradox: false },
        text: 'ROSC after removing 120 mL of blood. The drain is left in place and blood slowly re-accumulates. The surgeon is in the room.',
        q: 'Definitive plan?',
        choices: [
          ch('Emergency surgical repair (patch or sutureless glue technique)', 'best', 'Surgery is the definitive treatment. Blood on pericardiocentesis after MI means go to the OR. Up to a third of ruptures are subacute (oozing), which leaves time for repair; operative mortality in one cohort was about 36%.'),
          ch('Leave the drain and observe in the CICU', 'poor', 'Conservative management has been described for selected small, contained oozing ruptures, but ongoing bleeding with recent arrest needs surgery.'),
          ch('Restart DAPT and heparin to treat the MI', 'harm', 'Antithrombotics worsen bleeding into the pericardium.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 12', title: 'Outcome', end: true,
        vitals: { rhythm: 'sinus', hr: 82, sbp: 116, dbp: 70, paradox: false, spo2: 96 },
        text: 'Sutureless patch repair of an oozing lateral-wall rupture. Extubated on day 2 and discharged to rehab.',
      },
    },
    debrief: [
      'Free-wall rupture risk factors: first MI, older age, female sex, transmural infarct without reperfusion or with late fibrinolysis, and a lateral wall. Most occur within the first week.',
      'Warning signs: recurrent chest pain, agitation, sudden bradycardia or hypotension, pulsus paradoxus, and PEA arrest.',
      'Echo shows effusion (often with clot) and tamponade. Pericardiocentesis is a bridge; surgery is definitive. A contained rupture forms a pseudoaneurysm, which also needs surgery.',
    ],
    refs: [
      { t: 'Damluji AA et al. Mechanical complications of acute MI (AHA scientific statement). Circulation 2021', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000985' },
    ],
  });

  /* ======================= 6. Decompensated severe AS ======================= */
  cases.push({
    id: 'as', group: 'Valvular emergencies', title: 'Decompensated severe aortic stenosis', tags: ['Aortic stenosis', 'Low-flow low-gradient', 'Shock'],
    teaser: 'Pulmonary edema and hypotension behind a fixed outflow obstruction, with a "moderate" gradient that isn’t.',
    patient: '84-year-old man · known "moderate" AS · near-syncope', bsa: 1.9, length: '5 decisions',
    init: { hr: 106, sbp: 88, dbp: 62, spo2: 88, rr: 28, rhythm: 'sinus', uo: 20, o2: '6 L nasal cannula' },
    nodes: {
      start: {
        t: 0, title: 'ED: dyspnea and near-syncope', stage: 'B',
        text: 'Two weeks of worsening dyspnea, now near-syncope. Harsh late-peaking systolic murmur, a single soft S2, a delayed carotid upstroke. Crackles to the mid-lung fields. BP 88/62.',
        labs: [L('Lactate', '2.9 mmol/L', 1), L('BNP', '2,400 pg/mL', 1), L('Creatinine', '1.6 mg/dL', 1)],
        q: 'How do you start treating pulmonary edema with a BP of 88/62?',
        choices: [
          ch('Oxygen or NIV, small IV diuretic doses, an arterial line; avoid both hypotension and tachycardia', 'best', 'Fixed outflow obstruction leaves little room to cut preload. Diurese gently and support ventilation, watching the BP closely.'),
          ch('Sublingual nitroglycerin every 5 minutes, as for typical acute HF', 'harm', 'Venodilation behind a fixed obstruction drops preload and stroke volume abruptly, causing hypotension or syncope.', { effect: { d: { sbp: -18, dbp: -10, hr: 8 } } }),
          ch('A 1 L fluid bolus for the hypotension', 'poor', 'The lungs are already wet; this worsens pulmonary edema.', { effect: { d: { spo2: -4 } } }),
          ch('IV metoprolol to slow the heart rate', 'harm', 'This lowers output in a patient dependent on a stiff, failing LV, and can precipitate shock.', { effect: { d: { sbp: -14, dbp: -8, hr: -16 } } }),
        ],
        next: 'echo',
      },
      echo: {
        t: 40, title: 'Echo: the gradient that lies', stage: 'B',
        findings: [['TTE', 'Heavily calcified aortic valve; AVA 0.6 cm² (AVAi 0.33 cm²/m²); mean gradient 32 mmHg; Vmax 3.5 m/s; EF 25%; stroke volume index 26 mL/m² (low flow).']],
        echo: { view: 'plax', scores: { 2: 2, 5: 2, 8: 2, 11: 2 }, note: 'Schematic: global hypokinesis (EF 25%). The calcified valve itself is not drawn.' },
        text: 'Cardiology is asked whether the valve is the problem.',
        q: 'How do you interpret this?',
        choices: [
          ch('Classical low-flow, low-gradient AS with reduced EF: likely severe, but confirm with low-dose dobutamine stress echo or a CT calcium score, because the gradient depends on flow', 'best', 'Low stroke volume understates the gradient. True severe AS: with augmented flow, AVA stays ≤1.0 cm² and Vmax reaches ≥4 m/s or mean gradient ≥40. Pseudo-severe AS: AVA rises above 1.0. No contractile reserve: CT calcium scoring helps.'),
          ch('Moderate AS: the gradient is under 40 mmHg, so the valve isn’t the problem', 'harm', 'This is the classic pitfall. With a failing LV, a severely stenotic valve can generate a modest gradient.'),
          ch('Severe AS confirmed, so no further testing is needed', 'poor', 'Likely, but pseudo-severe AS (a weak LV that can’t open a moderately stenotic valve) must be excluded before committing to valve replacement.'),
          ch('A primary cardiomyopathy; the AS is incidental', 'poor', 'That is possible only after excluding true severe AS, which here is the more likely and treatable culprit.'),
        ],
        next: 'pressor',
      },
      pressor: {
        t: 60, title: 'Falling pressure', stage: 'C',
        vitals: { sbp: 82, dbp: 56, hr: 108 },
        text: 'MAP has fallen to 60, extremities are cooler, and urine output is 15 mL/h.',
        q: 'Vasoactive plan?',
        choices: [
          ch('Norepinephrine (or phenylephrine) to restore coronary perfusion pressure without tachycardia; add low-dose dobutamine if output stays low', 'best', 'In AS, keeping diastolic pressure up protects the hypertrophied subendocardium. Tachycardia shortens diastole and ejection time. Pure vasodilators are unsafe while hypotensive.', { effect: { d: { sbp: 14, dbp: 8 } } }),
          ch('Start nitroprusside now', 'harm', 'At a MAP of 60, vasodilation can cause collapse. Nitroprusside comes later, with invasive monitoring and an adequate MAP (Khot et al. 2003).', { effect: { d: { sbp: -14, dbp: -10, hr: 10 } } }),
          ch('High-dose dobutamine (15 µg/kg/min) alone', 'poor', 'Tachycardia and β2 vasodilation behind a fixed obstruction often lower the BP.', { effect: { d: { sbp: -4, hr: 18 } } }),
          ch('IABP', 'ok', 'Some centers use it as a bridge: it reduces afterload and augments diastolic coronary flow. It is contraindicated only if significant aortic regurgitation coexists.', { effect: { set: { support: 'iabp' }, d: { dbp: 10 } } }),
        ],
        next: 'nitro',
      },
      nitro: {
        t: 360, title: 'Invasive numbers', stage: 'C',
        vitals: { sbp: 100, dbp: 62, hr: 96 },
        swan: { ra: 12, pas: 56, pad: 30, pcwp: 28, co: 3.0, svo2: 52 },
        labs: [L('Norepinephrine', 'weaned off'), L('SVR', '≈1,700 dyn·s·cm⁻⁵'), L('Lactate', '2.4 mmol/L', 1)],
        text: 'After gentle diuresis and NIV, norepinephrine has been weaned off and MAP is 75. But he is still cool, with a wedge of 28 and a CI of 1.6 on the PA catheter.',
        q: 'Next?',
        choices: [
          ch('Carefully titrated nitroprusside (start low, about 0.3 µg/kg/min) to a MAP of 60–70, with arterial and PA monitoring', 'best', 'Khot et al. (NEJM 2003; 25 patients with severe AS and LV dysfunction): nitroprusside titrated to a MAP of 60–70 raised CI from 1.60 to 2.22 L/min/m² at 6 h and 2.52 at 24 h. Every patient was invasively monitored. Patients with MAP <60 or on pressors or inotropes were excluded, which is why the norepinephrine had to come off first. It is a bridge to valve intervention.', { effect: { d: { sbp: -6, dbp: -4 } } }),
          ch('Restart norepinephrine to push the MAP to 90', 'poor', 'More afterload on a failing LV behind a fixed obstruction lowers stroke volume.'),
          ch('Add milrinone', 'ok', 'Possible, but systemic vasodilation plus inotropy can drop the MAP. Nitroprusside has the best-described data in this setting.'),
        ],
        next: 'definitive',
      },
      definitive: {
        t: 'Day 3', title: 'Heart team', stage: 'B',
        vitals: { sbp: 108, dbp: 64, hr: 88, spo2: 95, support: null },
        swan: { ra: 8, pas: 44, pad: 22, pcwp: 18, co: 4.6, svo2: 64 },
        findings: [['Dobutamine stress echo', 'Stroke volume rose 25% (contractile reserve); Vmax 4.3 m/s; AVA 0.7 cm²: true severe AS.']],
        text: 'Stable on low-dose nitroprusside, off norepinephrine. The heart team meets.',
        q: 'Definitive treatment?',
        choices: [
          ch('Urgent TAVR this admission', 'best', 'True severe symptomatic AS with reduced EF needs aortic valve replacement. At 84, the heart team usually chooses TAVR, and LV function often improves once the obstruction is relieved.'),
          ch('Balloon aortic valvuloplasty first, TAVR later', 'ok', 'BAV is a bridge (Class 2b) for patients too unstable for TAVR or SAVR. Restenosis within months is the rule.'),
          ch('Elective SAVR in 3 months', 'poor', 'Delay carries high mortality in decompensated severe AS, and at 84 TAVR is generally preferred.'),
          ch('Medical therapy and discharge', 'harm', 'Symptomatic severe AS has a dismal prognosis without valve replacement.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 7', title: 'Outcome', end: true,
        vitals: { sbp: 124, dbp: 66, hr: 78, spo2: 97 }, swan: null,
        text: 'Transfemoral TAVR on day 4, mean gradient 8 mmHg afterward. Home on day 7 on GDMT. Follow-up echo at 3 months: EF 40%.',
      },
    },
    debrief: [
      'Severe AS: Vmax ≥4 m/s, mean gradient ≥40 mmHg, AVA ≤1.0 cm² (indexed ≤0.6). With low EF and low flow, the gradient underestimates severity, so confirm with dobutamine stress echo or CT calcium scoring.',
      'Decompensated AS: gentle diuresis, avoid nitrates while hypotensive, avoid tachycardia and beta-blockers, and support perfusion pressure (norepinephrine or phenylephrine).',
      'Once MAP is adequate and the patient is invasively monitored, nitroprusside can improve CI (Khot 2003) as a bridge.',
      'Definitive treatment is AVR (TAVR or SAVR by heart team). BAV is a temporary bridge.',
    ],
    refs: [
      { t: 'Otto CM et al. 2020 ACC/AHA valvular heart disease guideline', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000923' },
      { t: 'Khot UN et al. Nitroprusside in critically ill patients with LV dysfunction and aortic stenosis. NEJM 2003', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa022021' },
    ],
  });

  /* ======================= 7. STEMI with reduced EF: the next 72 hours ======================= */
  cases.push({
    id: 'refef', group: 'After the MI', title: 'Anterior STEMI with EF 30%: the next 72 hours', tags: ['HFrEF', 'GDMT', 'LV thrombus', 'ICD'],
    teaser: 'Beta-blocker timing, neurohormonal therapy, an apical thrombus with a fresh stent, and when (not) to implant an ICD.',
    patient: '57-year-old man · diabetes · primary PCI to proximal LAD', bsa: 2.1, length: '4 decisions',
    init: { hr: 92, sbp: 112, dbp: 72, spo2: 95, rr: 20, rhythm: 'sinus', st: 1, uo: 70, o2: 'Room air' },
    nodes: {
      start: {
        t: 'Day 1', title: 'Beta-blocker timing', stage: 'A',
        text: 'Primary PCI to the proximal LAD 8 h after symptom onset. Echo: EF 30% with anteroapical akinesis. He needed one dose of 40 mg IV furosemide overnight; now warm and well perfused, BP 112/72, HR 92, lactate normal.',
        labs: [L('Creatinine', '1.0 mg/dL'), L('Potassium', '4.4 mmol/L'), L('HbA1c', '8.1%', 1), L('Lactate', '1.1 mmol/L')],
        q: 'Beta-blocker plan?',
        choices: [
          ch('Start a low-dose oral beta-blocker (e.g. metoprolol succinate 12.5–25 mg or carvedilol 3.125 mg twice daily) now that he is euvolemic and perfusing well, then up-titrate', 'best', 'Beta-blockers reduce mortality after MI with LV dysfunction (CAPRICORN, carvedilol). Start low once he is stable, with no signs of low output, shock or decompensated HF.'),
          ch('IV metoprolol 5 mg three times now for rate control', 'harm', 'COMMIT/CCS-2: early IV-then-oral metoprolol reduced reinfarction and VF but increased cardiogenic shock, especially in patients with HF, HR >110, SBP <120 or age >70. The net effect was neutral, so avoid IV beta-blockers with HF signs.', { effect: { d: { sbp: -16, dbp: -8, hr: -14 } } }),
          ch('Avoid beta-blockers because the EF is 30%', 'poor', 'Stable HFrEF after MI is exactly where beta-blockers save lives. Just start low and go slow.'),
        ],
        next: 'raas',
      },
      raas: {
        t: 'Day 2', title: 'Neurohormonal therapy', stage: 'A',
        vitals: { hr: 82, sbp: 110, dbp: 70, st: 0.5 },
        q: 'What do you add before discharge?',
        text: 'Tolerating metoprolol succinate 25 mg. Potassium 4.5, creatinine 1.0.',
        choices: [
          ch('An ACE inhibitor (or ARB) now, plus eplerenone (EF ≤40% with HF or diabetes), checking potassium and creatinine', 'best', 'ACE inhibitors are standard after MI with LV dysfunction. EPHESUS: eplerenone, started 3–14 days after MI with EF ≤40% plus HF or diabetes, reduced mortality.'),
          ch('Add an SGLT2 inhibitor as well', 'ok', 'EMPACT-MI and DAPA-MI did not reduce their primary endpoints after MI, although empagliflozin reduced HF hospitalization. With diabetes and an EF of 30%, it is reasonable for its established indications.'),
          ch('Sacubitril/valsartan instead of an ACE inhibitor', 'ok', 'PARADISE-MI: not superior to ramipril for the primary outcome after MI. Reasonable later if HFrEF persists.'),
          ch('Hold all neurohormonal therapy until the 6-week visit', 'harm', 'Early RAAS inhibition after MI with LV dysfunction reduces mortality and remodeling.'),
        ],
        next: 'thrombus',
      },
      thrombus: {
        t: 'Day 3', title: 'Apical thrombus', stage: 'A',
        findings: [['Contrast echo', 'A 1.3 × 0.9 cm mobile apical thrombus in an akinetic, dyskinetic apex.']],
        echo: { view: 'a2c', scores: { 13: 3, 14: 3, 17: 4, 7: 2, 8: 2 }, note: 'Schematic: anteroapical akinesis with a dyskinetic apex, the substrate for LV thrombus. The thrombus itself is not drawn.' },
        text: 'He is on aspirin and ticagrelor after the stent.',
        q: 'Antithrombotic plan?',
        choices: [
          ch('Oral anticoagulation (warfarin or a DOAC) for about 3 months with clopidogrel; aspirin only briefly around PCI (triple therapy ≤1 week to 30 days); then reimage', 'best', '2022 AHA scientific statement on LV thrombus: anticoagulate for about 3 months, then reimage; a DOAC is a reasonable alternative to warfarin. Keep triple therapy short to limit bleeding, and use clopidogrel rather than ticagrelor or prasugrel with an anticoagulant.'),
          ch('Continue DAPT alone', 'poor', 'A mobile LV thrombus carries real embolic risk, and DAPT doesn’t treat it.'),
          ch('Long-term triple therapy (aspirin + ticagrelor + warfarin) for 12 months', 'harm', 'Very high bleeding risk. Ticagrelor and prasugrel aren’t recommended as part of triple therapy.'),
        ],
        next: 'scd',
      },
      scd: {
        t: 'Day 4', title: 'Sudden death prevention', stage: 'A',
        text: 'EF is 30% on day 4. He asks about "a defibrillator".',
        q: 'What do you recommend?',
        choices: [
          ch('Optimize GDMT and refer to cardiac rehab; reassess the EF ≥40 days after the MI (≥90 days after revascularization); implant an ICD then if EF ≤35% with NYHA II–III (or ≤30% with NYHA I)', 'best', 'DINAMIT and IRIS: an ICD early after MI did not reduce mortality, because fewer arrhythmic deaths were offset by more non-arrhythmic ones. Many EFs improve after reperfusion and GDMT.'),
          ch('A wearable cardioverter-defibrillator until reassessment', 'ok', 'VEST: the primary endpoint, arrhythmic death, was not significantly reduced (1.6% vs 2.4%). Total mortality was lower, but only as a secondary endpoint. Adherence fell to about 45% wear by day 90. It may be considered (Class 2b) in selected high-risk patients.'),
          ch('Implant an ICD before discharge', 'poor', 'Too early. Guideline primary prevention criteria require waiting for LV recovery on GDMT.'),
        ],
        next: 'end',
      },
      end: {
        t: '3 months', title: 'Follow-up', end: true,
        vitals: { hr: 64, sbp: 118, dbp: 70, st: 0 },
        text: 'On GDMT and anticoagulation, the 3-month echo shows EF 40% with the thrombus resolved. He doesn’t need an ICD. Anticoagulation stops and he continues single antiplatelet therapy per his PCI plan.',
      },
    },
    debrief: [
      'Start an oral beta-blocker at low dose once stable. Avoid IV beta-blockers with HF or borderline hemodynamics (COMMIT).',
      'After MI with EF ≤40%: ACE inhibitor or ARB, beta-blocker, and an MRA if there is HF or diabetes (EPHESUS). SGLT2 inhibitors for their established HF and diabetes indications; post-MI trials were neutral on their primary endpoints.',
      'LV thrombus: anticoagulate for about 3 months (DOAC acceptable), keep triple therapy short, use clopidogrel as the P2Y12 inhibitor, and reimage.',
      'ICD: wait ≥40 days after MI (≥90 days after revascularization), then decide by EF and NYHA class. A wearable defibrillator is a selective 2b option (VEST).',
    ],
    refs: [
      { t: 'COMMIT/CCS-2. Lancet 2005', url: 'https://pubmed.ncbi.nlm.nih.gov/16271642/' },
      { t: 'Pitt B et al. EPHESUS. NEJM 2003', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa030207' },
      { t: 'Butler J et al. EMPACT-MI. NEJM 2024', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2314051' },
      { t: 'Levine GN et al. Management of LV thrombus (AHA scientific statement). Circulation 2022', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001092' },
      { t: 'Olgin JE et al. VEST trial. NEJM 2018', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1800781' },
    ],
  });

  /* ======================= 8. VT storm ======================= */
  cases.push({
    id: 'vtstorm', group: 'Arrhythmia', title: 'Electrical storm after an old anterior MI', tags: ['VT storm', 'ICD', 'Ablation'],
    teaser: 'Repeated ICD shocks, monomorphic VT that keeps coming back, and a low potassium.',
    patient: '66-year-old man · ischemic cardiomyopathy, EF 25% · ICD', bsa: 2.0, length: '3 decisions',
    init: { hr: 178, sbp: 94, dbp: 62, spo2: 93, rr: 24, rhythm: 'vt', uo: 40, o2: '2 L nasal cannula' },
    nodes: {
      start: {
        t: 0, title: 'Third ICD shock in an hour', stage: 'B',
        text: 'Three shocks in the last hour. He is now in sustained monomorphic VT at 178 after anti-tachycardia pacing failed. BP 94/62; awake and talking.',
        labs: [L('Potassium', 'pending'), L('Magnesium', 'pending')],
        q: 'Immediate management?',
        choices: [
          ch('IV amiodarone 150 mg over 10 minutes (or procainamide), pads on, sedation ready for synchronized cardioversion if he deteriorates; send K and Mg', 'best', 'Hemodynamically tolerated monomorphic VT: start an IV antiarrhythmic, ready to cardiovert. In PROCAMIO, a small open-label trial of tolerated wide-QRS tachycardia (not storm), procainamide caused fewer major adverse cardiac events than amiodarone (9% vs 41%) and terminated more episodes.', { effect: { set: { rhythm: 'sinus' }, d: { hr: -94, sbp: 18, dbp: 8 } }, after: 'VT terminates after the bolus.' }),
          ch('Unsynchronized 200 J shock while he is awake', 'poor', 'For tolerated monomorphic VT, use drugs or synchronized cardioversion under sedation. Unsynchronized shocks are for pulseless VT or VF.'),
          ch('IV verapamil', 'harm', 'Can cause hemodynamic collapse in VT with structural heart disease.', { effect: { d: { sbp: -24, dbp: -14 } } }),
          ch('Adenosine to see whether it is SVT', 'poor', 'It delays treatment. A wide-complex tachycardia in a post-MI patient with EF 25% is VT until proven otherwise.'),
        ],
        next: 'recur',
      },
      recur: {
        t: 90, title: 'It keeps coming back', stage: 'B',
        vitals: { rhythm: 'vt', hr: 172, sbp: 90, dbp: 60 },
        labs: [L('Potassium', '3.2 mmol/L', 1), L('Magnesium', '1.5 mg/dL', 1), L('QTc', '470 ms'), L('hs-troponin', 'mildly elevated (demand)')],
        text: 'Four more episodes despite the amiodarone load and infusion. He is anxious and sweaty.',
        q: 'Next?',
        choices: [
          ch('Replete K (>4) and Mg (>2), add lidocaine, give a nonselective beta-blocker (propranolol) with sedation to cut sympathetic drive, and reprogram the ICD', 'best', 'Sympathetic activation sustains VT storm. One RCT found propranolol plus amiodarone more effective than metoprolol. Deep sedation or intubation helps refractory storm, and lidocaine adds sodium-channel block, particularly in ischemic VT.', { effect: { set: { rhythm: 'sinus' }, d: { hr: -96, sbp: 16, dbp: 6 } } }),
          ch('Isoproterenol infusion', 'harm', 'Catecholamines fuel scar-mediated VT. (Isoproterenol is for torsades with bradycardia or for Brugada storm, not this.)'),
          ch('Keep shocking as needed', 'poor', 'Repeated shocks cause pain, anxiety and more sympathetic drive, and they damage myocardium. Break the cycle.'),
          ch('Add IV sotalol now', 'poor', 'Stacking class III drugs with a QTc of 470 and low K/Mg risks torsades.'),
        ],
        next: 'ablate',
      },
      ablate: {
        t: 'Day 2', title: 'Definitive therapy', stage: 'B',
        vitals: { rhythm: 'sinus', hr: 76, sbp: 104, dbp: 66 },
        text: 'Two more VT episodes overnight despite all of the above. No new ischemia on echo or ECG.',
        q: 'Definitive approach?',
        choices: [
          ch('Urgent catheter ablation of the scar-related VT (with hemodynamic support if needed)', 'best', 'VANISH: in ischemic cardiomyopathy with VT despite antiarrhythmics, ablation reduced death, VT storm or appropriate shocks compared with escalating drugs (59.1% vs 68.5%). The 2017 AHA/ACC/HRS (Class 1) and 2022 ESC guidelines recommend ablation for drug-refractory storm after MI.'),
          ch('Stellate ganglion block as a bridge', 'ok', 'A useful temporizing measure for refractory storm while arranging ablation.'),
          ch('Escalate to high-dose amiodarone plus mexiletine and discharge', 'poor', 'In VANISH, escalating antiarrhythmics did worse than ablation, and storm carries high early mortality.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 5', title: 'Outcome', end: true,
        vitals: { rhythm: 'sinus', hr: 68, sbp: 112, dbp: 68 },
        text: 'Substrate ablation of an inferoapical scar. No VT recurrence before discharge on amiodarone and a beta-blocker, with the ICD reprogrammed.',
      },
    },
    debrief: [
      'Electrical storm is ≥3 sustained VT/VF episodes or appropriate ICD therapies in 24 h.',
      'Unstable: cardiovert or defibrillate. Stable: IV amiodarone or procainamide.',
      'Then: correct K and Mg, add a beta-blocker (propranolol), sedate, add lidocaine, reprogram the ICD, and look for ischemia, drugs or decompensation.',
      'Refractory storm: catheter ablation (VANISH), with neuraxial modulation or mechanical support as bridges.',
      'Avoid verapamil in wide-complex tachycardia, and avoid catecholamines in scar VT.',
    ],
    refs: [
      { t: 'Al-Khatib SM et al. 2017 AHA/ACC/HRS ventricular arrhythmia guideline', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000549' },
      { t: 'Sapp JL et al. VANISH. NEJM 2016', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1513614' },
      { t: 'Ortiz M et al. PROCAMIO. Eur Heart J 2017', url: 'https://pubmed.ncbi.nlm.nih.gov/27149962/' },
    ],
  });

  /* ======================= 9. Type A dissection masquerading as STEMI ======================= */
  cases.push({
    id: 'dissection', group: 'Don’t miss it', title: 'Inferior STEMI that isn’t: type A dissection', tags: ['Aortic dissection', 'STEMI mimic', 'Tamponade'],
    teaser: 'The STEMI team wants to load ticagrelor and heparin. The arm pressures don’t match.',
    patient: '54-year-old man · uncontrolled hypertension · tearing chest-to-back pain', bsa: 2.1, length: '3 decisions',
    init: { hr: 104, sbp: 178, dbp: 96, spo2: 96, rr: 22, rhythm: 'sinus', st: 2.5, uo: 50, o2: 'Room air' },
    nodes: {
      start: {
        t: 0, title: 'STEMI alert', stage: 'A',
        text: 'Abrupt, tearing chest pain radiating to the back. ECG: 2.5 mm inferior STE. BP 178/96 in the right arm and 142/80 in the left; a soft early diastolic murmur. The STEMI team wants to give ticagrelor 180 mg and heparin.',
        ecg: { culprit: 'drca' },
        q: 'Your move?',
        choices: [
          ch('Hold the antithrombotics; get an immediate CT angiogram of the aorta (or a bedside echo/TEE); treat the pain', 'best', 'Inter-arm BP difference, back pain and an AR murmur put him at high risk for aortic dissection. Type A dissection can occlude the RCA ostium and cause inferior STE. Anticoagulants, antiplatelets and lytics can be catastrophic.'),
          ch('Load ticagrelor and heparin and go to the cath lab', 'harm', 'If this is dissection, antithrombotics raise the risk of fatal bleeding and tamponade and complicate surgery.'),
          ch('Give tenecteplase now', 'harm', 'Fibrinolysis in aortic dissection is frequently fatal.'),
          ch('Cath lab first; do an aortogram if the coronaries look normal', 'poor', 'This delays the diagnosis and adds instrumentation of a dissected aorta. CTA is faster and safer.'),
        ],
        next: 'cta',
      },
      cta: {
        t: 25, title: 'CT: type A', stage: 'A',
        findings: [['CTA', 'Stanford type A dissection from the aortic root to the arch; the flap involves the RCA ostium; moderate AR; small pericardial effusion.']],
        text: 'Cardiac surgery is on the way.',
        q: 'Medical management while the OR is prepared?',
        choices: [
          ch('IV esmolol (or labetalol) first to HR 60–80, then add a vasodilator (nicardipine or nitroprusside) to SBP <120; opioid analgesia; emergency surgery', 'best', '2022 ACC/AHA aortic guideline: an IV beta-blocker before any vasodilator to lower aortic wall stress (dP/dt), targeting SBP <120 (or the lowest BP that keeps the organs perfused) and HR 60–80. Older teaching said HR <60. Immediate surgery is Class 1.', { effect: { d: { hr: -38, sbp: -56, dbp: -26 } } }),
          ch('Nitroprusside alone', 'poor', 'A vasodilator first causes reflex tachycardia and a higher dP/dt, which can propagate the tear.', { effect: { d: { hr: 14, sbp: -30, dbp: -16 } } }),
          ch('Heparin infusion because of the RCA involvement', 'harm', 'Anticoagulation in acute type A dissection raises bleeding and tamponade risk. The RCA problem is solved surgically.'),
          ch('Medical therapy now and elective repair', 'poor', 'Type A dissection is a surgical emergency, with early mortality rising by roughly 1–2% per hour without surgery.'),
        ],
        next: 'tamp',
      },
      tamp: {
        t: 50, title: 'Sudden hypotension', stage: 'D',
        vitals: { sbp: 82, dbp: 58, hr: 118, paradox: true },
        findings: [['Echo', 'An enlarging pericardial effusion with RA collapse in late diastole and early systole, RV collapse in early diastole, and a plethoric IVC.']],
        text: 'Pulsus paradoxus of 20 mmHg.',
        q: 'What now?',
        choices: [
          ch('Straight to the OR for emergency surgery; if he arrests first, drain only small, controlled volumes from the pericardium', 'best', 'Hemopericardium from type A dissection is treated surgically. Full pericardiocentesis can raise aortic pressure and worsen the bleeding or extend the dissection. Controlled drainage of small volumes is acceptable to maintain perfusion if surgery can’t be immediate.'),
          ch('Large-volume pericardiocentesis in the CICU', 'poor', 'This risks rebleeding and catastrophic hemodynamic swings.'),
          ch('Phenylephrine to a MAP of 90', 'poor', 'Pressure without relieving tamponade adds wall stress and buys little time.'),
          ch('IV metoprolol for the tachycardia', 'harm', 'In tamponade the tachycardia is compensatory, and slowing it can precipitate arrest.', { effect: { d: { sbp: -18, hr: -20 } } }),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 8', title: 'Outcome', end: true,
        vitals: { sbp: 118, dbp: 66, hr: 72, paradox: false, st: 0 },
        text: 'Emergency root replacement with RCA reimplantation. Extubated on day 1 after surgery, home on day 8 on beta-blockers with strict BP control and aortic imaging surveillance.',
      },
    },
    debrief: [
      'High-risk features for dissection: abrupt tearing pain, pulse or BP differential, a new AR murmur, mediastinal widening, a focal neurologic deficit. Up to ~5–8% of type A dissections present with STE, usually inferior (RCA).',
      'If you suspect dissection, hold antithrombotics and get CTA (or TEE).',
      'Impulse control: an IV beta-blocker first (HR 60–80 per the 2022 guideline), then a vasodilator to SBP <120. Give analgesia.',
      'Type A dissection means emergency surgery. Hemopericardium is treated in the OR, with only controlled drainage before that.',
    ],
    refs: [
      { t: 'Isselbacher EM et al. 2022 ACC/AHA guideline for aortic disease', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106' },
    ],
  });

  /* ======================= 10. Massive PE ======================= */
  cases.push({
    id: 'pe', group: 'Don’t miss it', title: 'High-risk pulmonary embolism', tags: ['PE', 'RV failure', 'Thrombolysis'],
    teaser: 'Syncope after a long flight, a dilated RV and hypotension. Fluids, pressors, intubation and reperfusion: what helps and what kills.',
    patient: '49-year-old woman · 14-hour flight 3 days ago · syncope', bsa: 1.8, length: '3 decisions',
    init: { hr: 128, sbp: 78, dbp: 50, spo2: 86, rr: 32, rhythm: 'sinus', uo: 15, o2: '15 L non-rebreather' },
    nodes: {
      start: {
        t: 0, title: 'Obstructive shock', stage: 'C',
        text: 'Syncope, then dyspnea. BP 78/50 sustained for 20 min, HR 128, SpO₂ 86% on 15 L. Bedside echo: dilated RV with free-wall hypokinesis, D-shaped septum, underfilled LV. No recent surgery, bleeding or stroke.',
        labs: [L('Lactate', '4.0 mmol/L', 1), L('hs-troponin', 'elevated', 1), L('BNP', '890 pg/mL', 1)],
        echo: { view: 'psax', rv: true, scores: {}, note: 'Schematic PSAX: an enlarged RV crescent. Septal flattening is not drawn.' },
        q: 'First 10 minutes?',
        choices: [
          ch('Unfractionated heparin bolus and infusion, norepinephrine, high-flow oxygen, cautious fluid (≤500 mL); avoid intubation if possible', 'best', 'High-risk PE: anticoagulate now with UFH, which keeps thrombolysis and procedures possible. Support RV perfusion pressure with norepinephrine and avoid large fluid loads that dilate the RV. Induction and positive-pressure ventilation can precipitate arrest.', { effect: { d: { sbp: 12, dbp: 8 } } }),
          ch('A 3 L crystalloid bolus', 'harm', 'Overdistends the RV, shifts the septum and reduces LV filling.', { effect: { d: { sbp: -8, dbp: -6, hr: 6 } } }),
          ch('Rapid sequence intubation with propofol now', 'poor', 'Vasodilating induction and positive pressure cut RV preload and raise RV afterload, a classic trigger for arrest. If intubation is unavoidable, use hemodynamically neutral agents with pressors running.', { effect: { d: { sbp: -16, dbp: -10 } } }),
          ch('Low-molecular-weight heparin and observe', 'poor', 'Not for an unstable patient. UFH is preferred when reperfusion is likely.'),
        ],
        next: 'reperf',
      },
      reperf: {
        t: 20, title: 'Reperfusion decision', stage: 'C',
        findings: [['CT', 'Bilateral main pulmonary artery thrombus; RV:LV ratio 1.6.']],
        text: 'Still hypotensive on norepinephrine 0.1.',
        q: 'Reperfusion?',
        choices: [
          ch('Systemic thrombolysis: alteplase 100 mg over 2 hours, pausing the UFH during the infusion', 'best', 'ESC 2019: systemic thrombolysis is Class I for high-risk PE. Surgical embolectomy or catheter-directed therapy if lysis is contraindicated or fails. The 2026 AHA/ACC PE guideline replaces "massive" with clinical categories. This patient is category E1 (hypotension with cardiogenic shock), where advanced reperfusion therapies are endorsed and PERT involvement is recommended. An accelerated 0.6 mg/kg (max 50 mg) over 15-minute regimen also exists.', { effect: { d: { sbp: 22, dbp: 14, hr: -20, spo2: 6 } } }),
          ch('Catheter-directed thrombectomy or thrombolysis', 'ok', 'Reasonable when an experienced team is immediately available or lysis is contraindicated. For high-risk PE without contraindications, systemic lysis remains the guideline standard, and evidence for device-first strategies is still evolving.', { effect: { d: { sbp: 18, dbp: 10, hr: -14, spo2: 4 } } }),
          ch('Anticoagulation alone', 'harm', 'High-risk PE has high early mortality, and reperfusion is indicated.', { effect: { d: { sbp: -6 } } }),
          ch('IVC filter', 'poor', 'A filter doesn’t treat the clot already in the lungs. Its role is when anticoagulation is contraindicated.'),
        ],
        next: 'after',
      },
      after: {
        t: 150, title: 'After the lytic', stage: 'B',
        vitals: { hr: 98, sbp: 108, dbp: 70, spo2: 94, o2: '4 L nasal cannula' },
        labs: [L('Lactate', '1.8 mmol/L'), L('Norepinephrine', 'off')],
        text: 'Two hours after alteplase she is off pressors and the RV looks smaller.',
        q: 'Next?',
        choices: [
          ch('Restart UFH without a bolus once the aPTT is <2× the upper limit; watch for bleeding; switch to oral anticoagulation when stable', 'best', 'Standard after thrombolysis. UFH is titratable and reversible while bleeding risk and the chance of a rescue procedure remain.'),
          ch('A second full dose of alteplase as routine', 'harm', 'No benefit when she is responding, and a big bleeding risk. Rescue therapy is for failure.'),
          ch('Start a DOAC immediately, no heparin', 'poor', 'Fine later. In the first hours after lysis, UFH is preferred.'),
        ],
        next: 'end',
      },
      end: {
        t: 'Day 4', title: 'Outcome', end: true,
        vitals: { hr: 84, sbp: 116, dbp: 72, spo2: 97, o2: 'Room air' },
        text: 'Transitioned to apixaban. Discharged on day 4 with follow-up to look for chronic thromboembolic disease and a plan for anticoagulation duration.',
      },
    },
    debrief: [
      'High-risk PE (ESC), or category E in the 2026 AHA/ACC guideline: obstructive shock (SBP <90 or vasopressors with hypoperfusion), persistent hypotension, or arrest. Measure lactate and activate the PERT.',
      'Support the RV: norepinephrine, ≤500 mL fluid, oxygen, and avoid intubation and induction collapse where possible.',
      'Reperfusion: systemic alteplase 100 mg over 2 h if no contraindication. Surgical or catheter therapy if contraindicated or lysis fails; VA-ECMO for collapse.',
      'Anticoagulate with UFH around reperfusion, then transition to oral therapy.',
    ],
    refs: [
      { t: 'Konstantinides SV et al. 2019 ESC guidelines for acute pulmonary embolism', url: 'https://academic.oup.com/eurheartj/article/41/4/543/5556136' },
      { t: '2026 AHA/ACC guideline for acute pulmonary embolism (clinical categories A–E) — ACC press release', url: 'https://www.acc.org/about-acc/press-releases/2026/02/19/19/27/first-ahaacc-acute-pulmonary-embolism-guideline-prompt-diagnosis-and-treatment-are-key' },
    ],
  });

  cases.forEach((c) => { c.length = c.length || Object.values(c.nodes).filter((n) => n.choices).length + ' decisions'; });
  CL.data.cicuCases = cases;
})();
