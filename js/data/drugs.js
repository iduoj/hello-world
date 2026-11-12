/* Cath lab pharmacology. Doses are typical adult values summarized from consensus documents and trials (see refs);
   institutional protocols vary. */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};

  CL.data.drugGroups = [
    {
      id: 'radial', title: 'Radial access cocktail',
      intro: 'Given through the radial sheath after access. Vasodilators prevent spasm of a small, muscular, alpha-adrenergic artery. Heparin prevents radial artery occlusion, and it is the one part almost everyone gives. Many operators give vasodilators only for spasm, especially with hydrophilic sheaths, so "not every time" is real practice variation.',
      drugs: [
        { name: 'Verapamil', route: 'Intra-arterial via sheath', dose: '2.5 mg (common) to 5 mg; dilute with blood or saline and give slowly (it burns)',
          moa: 'Calcium-channel blocker that relaxes arterial smooth muscle within minutes.',
          caution: 'Hold for SBP <90, 2nd/3rd-degree AV block or sick sinus without a pacemaker, decompensated HF or severe LV dysfunction, and AF with WPW.',
          pearl: 'Pooled data: spasm 12% with placebo, 12% with 2.5 mg, 4% with 5 mg. 5 mg alone or verapamil + NTG works best.' },
        { name: 'Nitroglycerin', route: 'Intra-arterial via sheath', dose: '100–200 µg (pooled studies used 100–500 µg)',
          moa: 'Nitric oxide donor that works almost immediately.',
          caution: 'Hold for hypotension, preload-dependent states (RV infarct, severe AS), and PDE5 inhibitor use (sildenafil or vardenafil within 24 h, tadalafil within 48 h).',
          pearl: 'Combined with verapamil in the classic cocktail. A 2023 RCT found NTG alone non-inferior to the combination.' },
        { name: 'Diltiazem (alternative)', route: 'Intra-arterial', dose: '5 mg',
          moa: 'Calcium-channel blocker.',
          caution: 'Same as verapamil.',
          pearl: 'Inferior in SPASM3: spasm 26.6% with diltiazem vs 16.2% with verapamil 2.5 mg.' },
        { name: 'Nicardipine (alternative)', route: 'Intra-arterial', dose: '≈400 µg was used in an RCT against verapamil 5 mg; no single standard dose',
          moa: 'Dihydropyridine calcium-channel blocker with minimal AV-nodal effect.',
          caution: 'Hypotension.',
          pearl: 'Similar spasm rates to verapamil with less burning. Useful when bradycardia or conduction disease rules out verapamil.' },
        { name: 'Heparin (UFH)', route: 'IV or intra-arterial', dose: '5000 U or 50 U/kg for diagnostic radial cath (SCAI); higher doses are increasingly used',
          moa: 'Prevents radial artery occlusion (RAO). Give it as soon as access is obtained.',
          caution: 'Use bivalirudin if there is HIT. Patent hemostasis afterward matters as much as the dose.',
          pearl: 'SPIRIT OF ARTEMIS: 100 vs 50 IU/kg gave RAO 3.0% vs 8.1% with no extra bleeding.' },
      ],
    },
    {
      id: 'ic', title: 'Intracoronary vasodilators',
      intro: 'Given through the guide or diagnostic catheter, straight into the artery.',
      drugs: [
        { name: 'IC nitroglycerin', route: 'Intracoronary bolus', dose: '100–200 µg per artery; repeat as needed (some give 200–300 µg before physiology)',
          moa: 'Relaxes epicardial vessels, reversing catheter-induced or vasospastic narrowing.',
          caution: 'Hypotension, preload dependence, PDE5 inhibitors. Use a smaller dose if BP is borderline.',
          pearl: 'Give it before QCA/IVUS stent sizing and before FFR/iFR so you measure the vessel at full size. A "lesion" that disappears after NTG was spasm.' },
        { name: 'IC verapamil / nicardipine', route: 'Intracoronary', dose: 'Verapamil 100–250 µg; nicardipine 50–200 µg',
          moa: 'Relax the arterioles (microvasculature) more than nitrates do.',
          caution: 'Verapamil causes bradycardia and AV block (worse in the RCA). Nicardipine spares the AV node.',
          pearl: 'First-line for slow-flow or no-reflow. Also used for refractory epicardial spasm.' },
      ],
    },
    {
      id: 'noreflow', title: 'No-reflow and slow flow',
      intro: 'No-reflow is TIMI ≤2 flow after PCI without a mechanical obstruction. First rule out dissection, thrombus, spasm and air. Deliver drugs distally through a microcatheter, over-the-wire balloon or aspiration catheter, not just into the guide. These agents improve TIMI flow; none has been shown to reduce mortality.',
      drugs: [
        { name: 'Adenosine', route: 'IC, distal', dose: '50–200 µg boluses (IV 70 µg/kg/min also used)',
          moa: 'Arteriolar vasodilator with anti-neutrophil and anti-platelet effects.',
          caution: 'Transient AV block and bradycardia. Very high doses (1–2 mg, REFLO-STEMI) suggested harm.', pearl: 'Short-acting, so repeat boluses.' },
        { name: 'Verapamil', route: 'IC, distal', dose: '100–250 µg per bolus; totals up to about 1000 µg reported',
          moa: 'Calcium-channel blocker that relaxes arterioles.', caution: 'Bradycardia and AV block. Have atropine or pacing ready, especially in the RCA.', pearl: 'One of the agents with the most consistent TIMI-flow gains.' },
        { name: 'Nicardipine', route: 'IC, distal', dose: '50–200 µg',
          moa: 'Potent arteriolar vasodilator.', caution: 'Hypotension.', pearl: 'Little effect on heart rate or the AV node; a good choice if the patient is bradycardic.' },
        { name: 'Nitroprusside', route: 'IC, distal', dose: '50–200 µg boluses (series used repeated 100 µg, total 100–700 µg)',
          moa: 'Direct NO donor that works on the microcirculation without needing metabolism.', caution: 'Hypotension.', pearl: 'Nitroglycerin works poorly on arterioles; nitroprusside does not have that limitation.' },
        { name: 'Epinephrine', route: 'IC, distal', dose: '50–200 µg (case series 100–400 µg)',
          moa: 'β2 arteriolar dilation plus inotropic and pressor effects.', caution: 'Tachycardia and arrhythmias.', pearl: 'Preferred when no-reflow comes with hypotension, where the vasodilators would drop the pressure further. Restored TIMI 3 in 9 of 12 refractory cases in one series.' },
      ],
    },
    {
      id: 'hyperemia', title: 'Hyperemia for FFR',
      intro: 'FFR needs maximal hyperemia (lowest microvascular resistance). iFR, RFR and resting Pd/Pa do not.',
      drugs: [
        { name: 'IV adenosine', route: 'IV infusion (central or antecubital)', dose: '140 µg/kg/min; some escalate to 170–180',
          moa: 'A2A-receptor arteriolar vasodilation.', caution: 'Dyspnea, chest burning, AV block. Avoid in bronchospasm and hold caffeine.',
          pearl: 'Steady-state hyperemia lets you do a pullback, and it is required for ostial and LM lesions, where you disengage the guide. A peripheral line peaks later (≈68 vs 49 s).' },
        { name: 'IC adenosine', route: 'IC bolus', dose: 'RCA 100 µg; LCA 200 µg (older protocols used 12–40 µg)',
          moa: 'Short-lived maximal hyperemia.', caution: 'Transient AV block in ≈40% of RCA and ≈15% of LCA doses.', pearl: 'Peak lasts only 10–15 s, so it is no good for pullbacks.' },
        { name: 'IC papaverine', route: 'IC bolus', dose: 'LCA ≈12 mg (up to 20); RCA ≈8 mg',
          moa: 'Phosphodiesterase inhibitor; prolonged hyperemia.', caution: 'QT prolongation, torsades and VF (≈2–4%).', pearl: 'Option when adenosine is contraindicated or ineffective.' },
        { name: 'Regadenoson', route: 'IV bolus', dose: '400 µg',
          moa: 'Selective A2A agonist.', caution: 'Hyperemia duration varies widely (10–600 s).', pearl: 'Gives the same FFR as adenosine, but pullbacks are unreliable.' },
      ],
    },
    {
      id: 'anticoag', title: 'Anticoagulation and reversal during PCI',
      intro: 'Check the ACT 5–10 minutes after the bolus and about every 30 minutes for long cases.',
      drugs: [
        { name: 'Unfractionated heparin', route: 'IV bolus', dose: 'No GP IIb/IIIa: 70–100 U/kg → ACT 250–300 s (HemoTec) or 300–350 s (Hemochron). With GP IIb/IIIa: 50–70 U/kg → ACT 200–250 s. Top up with 2000–5000 U.',
          moa: 'Antithrombin-mediated factor IIa and Xa inhibition.', caution: 'HIT; bleeding.', pearl: 'The ACT target depends on the machine, so know which one your lab uses.' },
        { name: 'Bivalirudin', route: 'IV', dose: '0.75 mg/kg bolus, then 1.75 mg/kg/h during PCI (CrCl <30: 1 mg/kg/h; bolus unchanged)',
          moa: 'Direct thrombin inhibitor.', caution: 'Not reversible with protamine.', pearl: 'Alternative in HIT. In STEMI the infusion may run up to 4 h after PCI to lower acute stent thrombosis.' },
        { name: 'Protamine', route: 'IV, slow', dose: '1 mg per 100 U of heparin given in the last 2–3 h; max 50 mg per dose; ≤5 mg/min',
          moa: 'Binds and neutralizes heparin.', caution: 'Rapid injection causes hypotension or collapse. Reactions in fish allergy or prior NPH insulin. Fresh-stent or equipment thrombosis is a concern.',
          pearl: 'For a significant perforation: tamponade with a balloon first, stop GP IIb/IIIa, and give protamine once the equipment is out of the artery (SCAI).' },
      ],
    },
    {
      id: 'rescue', title: 'Rescue drugs',
      intro: '',
      drugs: [
        { name: 'Atropine', route: 'IV', dose: '0.6–1.0 mg; repeat to 3 mg total',
          moa: 'Vagolytic.', caution: '—', pearl: 'Vasovagal reaction (bradycardia + hypotension): legs up, rapid IV fluids, atropine. Ask the patient to cough for transient bradycardia after an RCA injection.' },
        { name: 'Epinephrine (contrast reaction)', route: 'IM or IV', dose: 'IM 0.3 mg (0.3 mL of 1 mg/mL), repeat every 5–15 min to 1 mg. IV 100 µg (1 mL of 0.1 mg/mL) slowly if hypotensive.',
          moa: 'α and β agonist.', caution: 'Arrhythmias.', pearl: 'Anaphylactoid reaction with hypotension or bronchospasm: epinephrine first, then fluids. Antihistamines and steroids are adjuncts.' },
        { name: 'Contrast allergy premedication', route: 'PO / IV', dose: 'Elective: prednisone 50 mg at 13, 7 and 1 h before, plus diphenhydramine 50 mg 1 h before. Urgent: methylprednisolone 40 mg or hydrocortisone 200 mg IV every 4 h, plus diphenhydramine.',
          moa: 'Lowers the risk of repeat reactions.', caution: 'Premedication shorter than 4–5 h has not been shown to work.', pearl: 'Premedication reduces but does not eliminate breakthrough reactions; be ready to treat.' },
      ],
    },
  ];

  CL.data.drugScenarios = [
    { id: 'radial-spasm', name: 'Radial artery spasm', signs: 'Forearm pain, catheter "grabbed", resistance to torque or advance, pressure damping.',
      steps: ['Stop pushing; never force against spasm.', 'More vasodilator through the sheath: verapamil 2.5 mg and/or NTG 100–200 µg; repeat.', 'Analgesia and anxiolysis: spasm is catecholamine driven.', 'Downsize to a smaller or hydrophilic catheter, or advance over a wire (a "wired" catheter has a smoother profile).', 'Entrapped sheath: wait, repeat NTG (200–600 µg) and verapamil, warm compress or arm block. Never yank it.'] },
    { id: 'cath-spasm', name: 'Catheter-induced coronary spasm', signs: 'Focal narrowing right at the catheter tip (classically the RCA ostium), with or without damping. It resolves when you disengage.',
      steps: ['Disengage and re-image.', 'IC nitroglycerin 100–200 µg, then repeat the angiogram.', 'Re-engage more coaxially, or with a smaller or different shape.', 'A lesion that persists after NTG is real: consider IVUS or physiology.'] },
    { id: 'noreflow', name: 'No-reflow after PCI', signs: 'TIMI ≤2 after balloon or stent (often in SVGs, thrombus-laden STEMI or atherectomy), chest pain, ST elevation.',
      steps: ['Exclude mechanical causes: dissection, thrombus, spasm, air. Image at the site.', 'Give drugs distally through a microcatheter or aspiration catheter: adenosine 50–200 µg, verapamil 100–250 µg, nicardipine 50–200 µg or nitroprusside 50–200 µg.', 'If hypotensive: epinephrine 50–200 µg IC; consider mechanical support.', 'Avoid more balloon or stent trauma downstream. In SVGs use embolic protection next time.'] },
    { id: 'vagal', name: 'Bradycardia + hypotension', signs: 'Sudden HR and BP drop with yawning, nausea and diaphoresis (vasovagal), or after RCA injection or inferior ischemia (Bezold–Jarisch).',
      steps: ['Stop injecting; ask the patient to cough (RCA injection bradycardia).', 'Legs up, rapid IV fluids.', 'Atropine 0.6–1 mg IV, repeat to 3 mg.', 'Persistent shock: think contrast reaction, bleeding (retroperitoneal), tamponade or LM ischemia.'] },
    { id: 'contrast', name: 'Contrast reaction', signs: 'Urticaria, bronchospasm, laryngeal edema, hypotension with tachycardia.',
      steps: ['Mild urticaria: observe; diphenhydramine.', 'Bronchospasm or hypotension: epinephrine 0.3 mg IM, or 100 µg IV slowly if hypotensive.', 'Fluids, oxygen, β-agonist for bronchospasm.', 'Document it and premedicate next time.'] },
    { id: 'perforation', name: 'Coronary perforation', signs: 'Contrast outside the vessel. Ellis I: crater, no extravasation; II: myocardial or pericardial blush; III: jet through a ≥1 mm hole, or cavity spilling.',
      steps: ['Inflate a balloon at or just proximal to the site right away to seal it; call for help.', 'Stop GP IIb/IIIa; echo for effusion; pericardiocentesis if tamponade.', 'Protamine once the equipment is out of the artery (1 mg per 100 U heparin, max 50 mg, slowly).', 'Large vessel: covered stent. Distal wire perforation: coils, fat or thrombin through a microcatheter.', 'Surgical standby for refractory cases.'] },
    { id: 'hyperemia', name: 'Need hyperemia for FFR', signs: 'Intermediate lesion (≈40–90%) with no prior ischemia testing.',
      steps: ['Equalize the wire at the guide tip after a saline flush; give IC NTG.', 'Pick the agent: IV adenosine 140 µg/kg/min (steady state; pullbacks; ostial/LM with guide disengaged) or IC adenosine 100 µg RCA / 200 µg LCA.', 'Record FFR at stable hyperemia; FFR ≤0.80 is significant.', 'Pull back to the guide tip and check drift (Pd/Pa 0.98–1.02).'] },
  ];

  CL.data.drugRefs = [
    { t: 'SCAI QI tip: Reducing radial artery spasm', url: 'https://www.scai.org/quality-improvement-tools/qi-tips/reducing-radial-spasm' },
    { t: 'SCAI QI tip: Entrapped radial sheath stepwise algorithm', url: 'https://www.scai.org/quality-improvement-tools/qi-tips/entrapped-radial-sheath-stepwise-approach-algorithm' },
    { t: 'SCAI 2020 update: best practices for transradial access (Shroff et al., CCI 2020;95:245)', url: 'https://www.dicardiology.com/content/scai-updates-expert-consensus-statement-best-practices-transradial-access' },
    { t: 'SPIRIT OF ARTEMIS (heparin 100 vs 50 IU/kg)', url: 'https://www.acc.org/latest-in-cardiology/clinical-trials/2018/12/01/18/26/spirit-of-artemis' },
    { t: 'Pooled analysis of vasodilators for radial spasm (Kwok et al.)', url: 'https://eprints.keele.ac.uk/804/' },
    { t: 'SCAI: How to prevent and treat no-reflow', url: 'https://scai.org/how-prevent-and-treat-no-reflow-using-evidence-based-measures' },
    { t: 'Rezkalla/Kloner: No-reflow review, JACC Cardiovasc Interv 2017;10:215', url: 'https://www.jacc.org/doi/10.1016/j.jcin.2016.11.059' },
    { t: 'Asia-Pacific consensus on coronary physiology (IC adenosine dosing), JACC Asia 2023', url: 'https://www.jacc.org/doi/10.1016/j.jacasi.2023.07.003' },
    { t: 'Bivalirudin prescribing information (DailyMed)', url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5d9a45c6-e234-4d56-9132-5e24e65852e6' },
    { t: 'EuroIntervention: Clinical management of coronary perforation', url: 'https://eurointervention.pcronline.com/article/tools-amp-techniques-clinical-management-of-coronary-perforation/pdf' },
    { t: 'SCAI: Management of distal coronary artery perforation', url: 'https://scai.org/management-distal-coronary-artery-perforation' },
    { t: 'ACR Manual on Contrast Media: adult contrast reaction card', url: 'https://ACR.org/-/media/ACR/Files/Clinical-Resources/Contrast-Reaction-Card-Adult.pdf' },
  ];
})();
