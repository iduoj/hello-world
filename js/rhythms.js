/* EP Simulator — rhythm library: simulator configurations + teaching notes.
 *
 * Each entry: { id, group, name, sub, cfg(opts) → HeartSim config, warm (ms simulated before the
 * recorded window), view (3D camera preset), focus ('A' | 'V' | 'AV'), teach:{ mech, ecg[], pearls[] } }
 */
(function (EP) {
  'use strict';
  const G = EP.G, Mo = EP.Morph, V = EP.V;
  const R = (EP.Rhythms = {});

  // ---- accessory-pathway locations around the AV rings --------------------------------------------
  const ring = (which, deg, da) => V.addS(G.ringPoint(G.ANNULI[which], (deg * Math.PI) / 180, 1.45), G.A, da);
  R.AP = {
    leftLateral: { name: 'Left lateral', ring: 'mitral', deg: 180 },
    leftPosterior: { name: 'Left posterior', ring: 'mitral', deg: 120 },
    posteroseptal: { name: 'Posteroseptal', ring: 'mitral', deg: 45 },
    rightFreeWall: { name: 'Right free wall', ring: 'tricuspid', deg: 0 },
    rightPosterior: { name: 'Right posterior', ring: 'tricuspid', deg: 80 },
    anteroseptal: { name: 'Anteroseptal', ring: 'tricuspid', deg: 215 },
    leftAnterolateral: { name: 'Left anterolateral', ring: 'mitral', deg: 235 },
  };
  for (const k in R.AP) { const a = R.AP[k]; a.id = k; a.vSite = ring(a.ring, a.deg, 0.75); a.aSite = ring(a.ring, a.deg, -0.9); }
  R.apCfg = (loc, o) => Object.assign({ aSite: R.AP[loc].aSite, vSite: R.AP[loc].vSite, delay: 28, erp: 290, retro: { delay: 28, erp: 240 } }, o || {});

  const PAC = (o) => Object.assign({ id: 'pac', node: 'A', kind: 'coupled', after: 'sinus', coupling: 420, every: 3, site: 'lspv', label: 'PAC' }, o);
  const PVC = (o) => Object.assign({ id: 'pvc', node: 'V', kind: 'coupled', after: 'hps', coupling: 430, every: 3, site: 'rvotSeptal', label: 'PVC' }, o);
  const NOVA = { fast: { retro: { block: true } } };          // no retrograde (VA) conduction through the node
  const LQT = { qtc: 590, tShape: { p: 0.74, sl: 0.24, sr: 0.12 }, u: 0.9 };
  /* Scripted extrasystoles timed off conducted beats: steps = [{ beat (nth conducted beat, or 'next'), coupling, site, then(sim, t) }] */
  const onBeats = (steps) => [{ t: 0, do: (s) => {
    let n = 0, i = 0, armed = true;
    s.on('V', (ev) => {
      if (ev.label !== 'conducted' || i >= steps.length || !armed) return;
      n++;
      const st = steps[i];
      if (st.beat !== 'next' && n < st.beat) return;
      i++;
      s.schedule(ev.t + st.coupling, (t) => { s.contribV(t, { type: 'focus', spec: Mo.spec(st.site), label: 'PVC' }); if (st.then) st.then(s, t); });
    });
  } }];
  R.onBeats = onBeats;

  R.groups = [
    { id: 'sinus', name: 'Sinus & atrial' },
    { id: 'svt', name: 'AV junction & re-entrant SVT' },
    { id: 'block', name: 'AV block' },
    { id: 'ivcd', name: 'Bundle & fascicular block' },
    { id: 'vent', name: 'Ventricular arrhythmias' },
  ];

  R.list = [
    // ------------------------------------------------------------------ sinus & atrial
    { id: 'nsr', group: 'sinus', name: 'Normal sinus rhythm', sub: '70/min', focus: 'A', view: 'front',
      cfg: () => ({ sinus: { cl: 857 } }),
      teach: {
        mech: 'The sinus node, high in the lateral right atrium at the SVC junction, fires first. The wave spreads inferiorly and leftward across both atria (P wave), is delayed in the AV node (PR segment), then races down the His-Purkinje system so the ventricular endocardium is activated almost at once and the wave travels endocardium → epicardium (narrow QRS).',
        ecg: ['P upright in I, II, aVF; inverted in aVR — the atrial vector points from the sinus node toward the AV node.', 'Biphasic P in V1: right atrium (anterior) first, left atrium (posterior) second.', 'PR 120–200 ms, QRS < 110 ms, every P followed by a QRS.', 'Small septal q in I, aVL, V5–V6 and r in V1: the septum depolarises left-to-right first.'],
        pearls: ['Watch the 3D map at 0.1× speed: the QRS is narrow because the Purkinje network delivers the impulse everywhere at once, not because the ventricles are small.', 'Every abnormal rhythm in this library is a change to one element of this sequence.'] } },
    { id: 'sinus-brady', group: 'sinus', name: 'Sinus bradycardia', sub: '44/min', focus: 'A', view: 'front',
      cfg: () => ({ sinus: { cl: 1360, resp: 0.04 } }),
      teach: { mech: 'Normal activation sequence, slower sinus discharge: high vagal tone, sleep, athletic conditioning, beta-blockers, calcium-channel blockers, hypothyroidism, raised intracranial pressure, inferior MI, sinus node disease.',
        ecg: ['Normal P-QRS-T relationships at < 60/min (often < 50 to be clinically relevant).', 'QT lengthens as the rate falls; U waves become easier to see.'],
        pearls: ['Treat the patient, not the number: hypotension, altered mentation, chest pain, heart failure or syncope define "unstable".', 'Atropine 1 mg IV (repeat to 3 mg) acts on the sinus and AV nodes. If it fails: transcutaneous pacing or a chronotrope infusion (dopamine 5–20 µg/kg/min, epinephrine 2–10 µg/min).'] } },
    { id: 'sinus-tachy', group: 'sinus', name: 'Sinus tachycardia', sub: '128/min', focus: 'A', view: 'front',
      cfg: () => ({ sinus: { cl: 468, resp: 0.01 }, avn: { fast: { min: 56 } } }),
      teach: { mech: 'A physiological response, not a primary arrhythmia: fever, pain, hypovolaemia, sepsis, PE, anaemia, thyrotoxicosis, withdrawal, sympathomimetics. Rate changes gradually rather than switching on and off.',
        ecg: ['Sinus P waves (upright II, negative aVR) before every QRS; the P may merge into the preceding T.', 'PR shortens slightly with sympathetic tone; QT shortens with rate.', 'Gradual onset and offset — the key distinction from re-entrant SVT.'],
        pearls: ['Maximum sinus rate ≈ 220 − age. A fixed rate of exactly 150 should make you look for 2:1 flutter.', 'Treat the cause. Rate-slowing drugs or cardioversion are wrong answers for a compensatory tachycardia.'] } },
    { id: 'sinus-arr', group: 'sinus', name: 'Sinus arrhythmia', sub: 'respiratory', focus: 'A', view: 'front',
      cfg: () => ({ sinus: { cl: 900, resp: 0.16, sd: 0.01 } }),
      teach: { mech: 'Vagal tone falls on inspiration (rate rises) and returns on expiration. Normal, most marked in the young and fit.',
        ecg: ['Identical sinus P waves with a P-P interval that waxes and wanes over a few seconds.', 'P-P variation > 120 ms (or > 10%).'],
        pearls: ['Irregular with identical P waves and constant PR = sinus arrhythmia. Irregular with changing P shape = wandering pacemaker or MAT. Irregular with no P waves = AF.'] } },
    { id: 'pac', group: 'sinus', name: 'Premature atrial complexes', sub: 'conducted, aberrant & blocked', focus: 'A', view: 'front',
      cfg: () => ({ sinus: { cl: 880, resp: 0 }, hps: { rbExtra: 95 }, foci: [PAC({ coupling: [470, 350, 268], every: 2, site: 'lspv' })] }),
      teach: { mech: 'An atrial focus (here near the left superior pulmonary vein) fires early. What the ventricles do depends on how early: late PACs conduct normally; earlier ones reach a right bundle that has not recovered (aberrancy); the earliest find the AV node refractory and are not conducted at all.',
        ecg: ['Early P wave with a different shape/axis from sinus — often hidden in the preceding T wave ("the T looks different").', 'Three fates: normal QRS, RBBB-pattern aberrant QRS, or no QRS (blocked PAC).', 'The pause is usually less than compensatory because the PAC resets the sinus node.'],
        pearls: ['The commonest cause of a sudden pause is a non-conducted PAC — look at the T wave before the pause.', 'Aberrancy follows a long-short sequence (Ashman): the right bundle\'s refractory period is set by the preceding cycle length.', 'Pulmonary-vein PACs are the usual trigger for atrial fibrillation.'] } },
    { id: 'at', group: 'sinus', name: 'Focal atrial tachycardia', sub: '165/min, crista terminalis', focus: 'A', view: 'right',
      cfg: () => ({ sinus: { cl: 900 }, foci: [{ id: 'at', node: 'A', cl: 364, site: 'crista', label: 'AT', startAt: 2300, warm: 0.25 }] }),
      teach: { mech: 'A single atrial focus (automatic, triggered or micro-re-entrant) outpaces the sinus node. Activation spreads centrifugally from the focus — the 3D map shows a point source, unlike the circuit of flutter.',
        ecg: ['Regular P waves of one abnormal morphology, usually 130–250/min, with an isoelectric baseline between them.', 'Long-RP tachycardia: the P sits closer to the next QRS than the previous one.', '"Warm-up" at onset and "cool-down" at offset when automatic.', 'AV block does not stop it — the AV node is a bystander.'],
        pearls: ['P-wave shape localises the focus: positive in V1 → left atrium; negative in V1 → right atrium; negative in inferior leads → low atrium / coronary sinus.', 'Adenosine: transient AV block reveals continuing P waves (diagnostic); it terminates a minority (triggered foci).', 'AT with block in a patient on digoxin = toxicity until proven otherwise.'] } },
    { id: 'mat', group: 'sinus', name: 'Multifocal atrial tachycardia', sub: '≥ 3 P-wave shapes', focus: 'A', view: 'front',
      cfg: () => ({ sinus: { on: false }, foci: [{ id: 'mat', node: 'A', cl: 470, sd: 0.22, sites: ['crista', 'lspv', 'csOs', 'raa', 'laLateral'], label: 'MAT' }] }),
      teach: { mech: 'Several atrial foci fire competitively, driven by triggered activity in a stressed atrium: decompensated lung disease, hypoxia, theophylline, hypokalaemia/hypomagnesaemia.',
        ecg: ['Rate > 100/min with at least three distinct P-wave morphologies in one lead.', 'Varying P-P, PR and R-R intervals; isoelectric baseline between P waves.'],
        pearls: ['Irregularly irregular like AF — but every QRS has its own P wave. Calipers on the P waves make the diagnosis.', 'Treat the lung, oxygenation, potassium and magnesium. Cardioversion does not work; rate control (verapamil, or cautious beta-blockade) is secondary.'] } },
    { id: 'afib-rvr', group: 'sinus', name: 'Atrial fibrillation, rapid response', sub: '≈ 150/min', focus: 'A', view: 'back',
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 135 }, avn: { fast: { erp: 255, conceal: 0.3, min: 60 } } }),
      teach: { mech: 'Pulmonary-vein triggers launch multiple wandering wavelets / rotors; the atria never contract as a unit. 350–600 impulses a minute bombard the AV node. Most die inside it, and each one that partly penetrates leaves it refractory for the next (concealed conduction) — which is why the ventricular response is random.',
        ecg: ['No P waves; fibrillatory baseline best seen in V1 and II.', 'Irregularly irregular R-R intervals.', 'Narrow QRS unless bundle branch block, aberrancy (Ashman beats after a long-short sequence) or pre-excitation.'],
        pearls: ['Unstable (hypotension, ischaemia, pulmonary oedema) → synchronised cardioversion 120–200 J biphasic.', 'Stable → rate control: beta-blocker or diltiazem; in decompensated HFrEF prefer amiodarone or digoxin.', 'Onset > 48 h or unknown and not anticoagulated: rhythm control carries stroke risk — anticoagulate / TEE first unless unstable.', 'Irregular AND wide AND very fast (> 200) → think pre-excited AF: no AV-nodal blockers.'] } },
    { id: 'afib-cvr', group: 'sinus', name: 'Atrial fibrillation, controlled', sub: '≈ 75/min', focus: 'A', view: 'back',
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 150, fibAmp: 0.8 }, avn: { fast: { erp: 470, conceal: 0.2, min: 80 } } }),
      teach: { mech: 'Same atrial chaos; the AV node filters more of it (drug effect, intrinsic conduction disease or high vagal tone).',
        ecg: ['Irregularly irregular rhythm, no P waves, ventricular rate 60–100.', 'A slow, perfectly regular ventricular rate in AF means complete AV block with a junctional or ventricular escape — think digoxin toxicity.'],
        pearls: ['Target resting rate < 110 (lenient) unless symptoms demand tighter control.', 'Stroke prevention is driven by CHA₂DS₂-VASc, not by whether the rhythm is controlled.'] } },
    { id: 'flutter-21', group: 'sinus', name: 'Typical atrial flutter, 2:1', sub: 'atria 290, ventricles 145', focus: 'A', view: 'flutter',
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'flutter', flutterCL: 207 }, avn: { fast: { erp: 290, conceal: 0.3 } } }),
      teach: { mech: 'A single macro-re-entrant wave circles the tricuspid annulus counter-clockwise (viewed from the ventricle): up the septum, over the roof, down the lateral wall, then through the cavotricuspid isthmus — the narrow corridor between the IVC and the tricuspid valve. The crista terminalis and the annulus are the barriers that hold the circuit together. The left atrium is a passive bystander.',
        ecg: ['Sawtooth flutter waves at ≈ 300/min, negative in II, III, aVF with no isoelectric baseline; positive in V1.', '2:1 conduction gives a regular narrow tachycardia at ≈ 150/min — every other flutter wave hides in the QRS/T.', 'Turn the ECG upside down or look at V1 if you cannot see them.'],
        pearls: ['A regular narrow-complex tachycardia at exactly 150/min is flutter until proven otherwise.', 'Adenosine or vagal manoeuvres do not terminate it but unmask the flutter waves.', 'Very responsive to low-energy synchronised cardioversion (50–100 J). Rate control is harder than in AF.', 'The cavotricuspid isthmus is the ablation target — a single line of block cures it.', 'Class Ic drugs slow the circuit and can allow 1:1 conduction — always give an AV-nodal blocker with them.'] } },
    { id: 'flutter-41', group: 'sinus', name: 'Atrial flutter, 4:1', sub: 'ventricles ≈ 72', focus: 'A', view: 'flutter',
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'flutter', flutterCL: 207 }, avn: { fast: { erp: 520, conceal: 0.25 } } }),
      teach: { mech: 'The same right-atrial circuit with more AV-nodal filtering. Even ratios (2:1, 4:1) are the rule because block occurs at two levels in the node.',
        ecg: ['Flutter waves are obvious between the widely spaced QRS complexes.', 'Regular ventricular rhythm at ≈ 75/min; flutter-to-R relationship is constant.'],
        pearls: ['Carries the same stroke risk as AF — anticoagulate by CHA₂DS₂-VASc.', 'Variable block gives an irregular rhythm that can pass for AF: look for the repeating sawtooth.'] } },
    { id: 'flutter-cw', group: 'sinus', name: 'Reverse typical flutter', sub: 'clockwise, 2:1', focus: 'A', view: 'flutter',
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'flutter', flutterCL: 215, flutterDir: 'cw' }, avn: { fast: { erp: 300, conceal: 0.3 } } }),
      teach: { mech: 'The same cavotricuspid-isthmus-dependent circuit travelling the opposite way round the tricuspid annulus (down the septum, up the lateral wall).',
        ecg: ['Broad positive, often notched flutter waves in the inferior leads; negative in V1.', 'Same rate and same response to drugs as counter-clockwise flutter.'],
        pearls: ['Same ablation target (the isthmus). Flutter that does not fit either pattern ("atypical") usually circles a scar or the mitral annulus — common after AF ablation or cardiac surgery.'] } },

    // ------------------------------------------------------------------ SVT
    { id: 'avnrt', group: 'svt', name: 'AVNRT (typical, slow-fast)', sub: '≈ 180/min, initiation by a PAC', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 850, resp: 0 }, avn: { fast: { erp: 365 }, slow: { min: 205, alpha: 150, tau: 80, erp: 235, conceal: 0, retro: { delay: 200, erp: 330, block: false } } },
        foci: [PAC({ coupling: 305, every: 4, site: 'crista', count: 1 })] }),
      teach: { mech: 'Two inputs to the AV node: a FAST pathway (anterior, conducts quickly, long refractory period) and a SLOW pathway (posterior, near the coronary sinus os; conducts slowly, recovers quickly). A critically timed PAC finds the fast pathway refractory and goes down the slow one — the PR suddenly jumps. By the time it reaches the bottom the fast pathway has recovered, so the impulse returns up it to the atria while also descending to the ventricles. Atria and ventricles are activated almost simultaneously, every cycle.',
        ecg: ['Regular narrow-complex tachycardia, usually 150–220/min, abrupt onset after a PAC with a long PR.', 'No visible P wave, or a retrograde P fused to the end of the QRS: pseudo-r′ in V1, pseudo-S in II, III, aVF. Compare with the sinus QRS.', 'RP < 70 ms.'],
        pearls: ['Vagal manoeuvres (modified Valsalva with leg raise) then adenosine 6 mg → 12 mg by rapid flush. Both block the AV node, which is part of the circuit, so they terminate it.', 'Unstable → synchronised cardioversion 50–100 J.', 'Slow-pathway ablation is curative (> 95%) with ≈ 0.5–1% risk of AV block.', 'Neck pounding ("frog sign") — atria contracting against closed AV valves.'] } },
    { id: 'avnrt-atyp', group: 'svt', name: 'AVNRT (atypical, fast-slow)', sub: 'long RP, initiation by a PVC', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 880, resp: 0 }, avn: { fast: { retro: { block: true } }, slow: { min: 420, alpha: 0, erp: 250, conceal: 0, retro: { delay: 285, erp: 200, block: false } } },
        foci: [PVC({ coupling: 300, every: 3, count: 1, site: 'rvApex' })] }),
      teach: { mech: 'The circuit runs the other way: down the fast pathway, back up the slow pathway. Because the retrograde limb is slow, the atria are activated late — the P wave lands well after the QRS, just before the next one.',
        ecg: ['Regular narrow tachycardia with inverted P waves in II, III, aVF before each QRS: RP > PR (long-RP tachycardia).', 'Often started by a PVC rather than a PAC.'],
        pearls: ['Differential of long-RP tachycardia: atrial tachycardia, atypical AVNRT, and AVRT using a slowly conducting pathway (PJRT).', 'Adenosine terminating the tachycardia with a P wave (block in the node after atrial activation) argues against atrial tachycardia.'] } },
    { id: 'avrt', group: 'svt', name: 'Orthodromic AVRT', sub: 'left lateral pathway, ≈ 195/min', focus: 'AV', view: 'base',
      cfg: (o) => ({ sinus: { cl: 850, resp: 0 }, avn: { fast: { erp: 250, min: 62, alpha: 300, tau: 110 } }, ap: R.apCfg((o && o.ap) || 'leftLateral', { erp: 335, retro: { delay: 28, erp: 220 } }),
        foci: [PAC({ coupling: 298, every: 4, site: 'crista', count: 1 })] }),
      teach: { mech: 'A macro-re-entrant circuit using normal tissue and an accessory pathway (AP): atrium → AV node → His-Purkinje → ventricle → back up the AP → atrium. The PAC blocks in the AP (longer refractory period) and conducts over the node alone, so the delta wave disappears; by the time the ventricles are activated the AP has recovered and carries the impulse back.',
        ecg: ['In sinus rhythm: short PR and delta wave (subtle with a left lateral pathway, which is far from the sinus node).', 'Tachycardia: regular, NARROW (no delta — the ventricles are activated over the normal system).', 'Retrograde P in the ST segment, RP > 70 ms but < PR. With a left lateral AP the P is negative in I and aVL.', 'QRS alternans and rate-related ST depression are common.'],
        pearls: ['Because the AV node is in the circuit: vagal manoeuvres, adenosine, verapamil/diltiazem or beta-blocker terminate it.', 'Bundle branch block on the same side as the pathway lengthens the circuit and SLOWS the tachycardia (Coumel\'s sign) — try the control.', 'After adenosine, 1–15% develop AF; with a manifest pathway have a defibrillator ready.'],
        controls: [{ key: 'ap', label: 'Pathway', type: 'select', options: Object.keys(R.AP).map((k) => [k, R.AP[k].name]), def: 'leftLateral' }] } },
    { id: 'avrt-anti', group: 'svt', name: 'Antidromic AVRT', sub: 'wide, regular, ≈ 190/min', focus: 'AV', view: 'base',
      cfg: () => ({ sinus: { cl: 850, resp: 0 }, avn: { fast: { erp: 345, min: 62, retro: { delay: 62, erp: 200 } } }, hps: { retro: { delay: 55, erp: 200 } }, ap: R.apCfg('rightFreeWall', { erp: 230, retro: { delay: 28, erp: 600, block: true } }),
        foci: [PAC({ coupling: 300, every: 4, site: 'crista', count: 1 })] }),
      teach: { mech: 'The same circuit in reverse: down the accessory pathway, back up the His-Purkinje system and AV node. The ventricles are activated entirely from the pathway insertion, cell-to-cell, so the QRS is maximally pre-excited and wide.',
        ecg: ['Regular wide-complex tachycardia; QRS looks like an exaggerated version of the delta wave in sinus rhythm.', 'Indistinguishable from VT on a single ECG in many cases; 1:1 VA relationship.'],
        pearls: ['Uncommon (≈ 5% of AVRT). When in doubt, treat a regular wide-complex tachycardia as VT.', 'Stable: procainamide; adenosine may terminate it but only use it if you are certain the rhythm is regular.'] } },
    { id: 'wpw', group: 'svt', name: 'Pre-excitation (WPW pattern)', sub: 'sinus rhythm with delta wave', focus: 'AV', view: 'base',
      cfg: (o) => ({ sinus: { cl: 850 }, ap: R.apCfg((o && o.ap) || 'rightFreeWall') }),
      teach: { mech: 'An accessory pathway — a strand of working myocardium bridging the AV ring — conducts without the AV-nodal delay. Part of the ventricle is activated early, cell-to-cell, from the pathway insertion (delta wave); the rest is activated normally when the His-Purkinje impulse arrives. Every beat is a fusion beat.',
        ecg: ['PR < 120 ms, slurred QRS upstroke (delta wave), QRS > 110 ms, secondary ST-T changes.', 'Delta-wave polarity points AWAY from the pathway: left lateral → negative in I, aVL, positive V1; posteroseptal → negative in III, aVF; right free wall → negative V1, left axis.', 'Pre-excitation is greater the closer the pathway is to the sinus node and the slower the AV node.'],
        pearls: ['Can mimic MI (negative delta = pseudo-Q), LVH and bundle branch block.', 'Pattern + symptoms = WPW syndrome. Sudden loss of the delta wave on exercise suggests a long refractory period (lower risk).', 'Switch the pathway location to see the 12-lead change, then test yourself in the Localisation lab.'],
        controls: [{ key: 'ap', label: 'Pathway', type: 'select', options: Object.keys(R.AP).map((k) => [k, R.AP[k].name]), def: 'rightFreeWall' }] } },
    { id: 'wpw-af', group: 'svt', name: 'Pre-excited atrial fibrillation', sub: 'fast, broad, irregular', focus: 'AV', view: 'base',
      cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 120 }, avn: { fast: { erp: 330, conceal: 0.4 } }, ap: R.apCfg('leftLateral', { erp: 215 }) }),
      teach: { mech: 'AF in someone with an accessory pathway. The AV node protects the ventricles by decremental conduction; the pathway does not. Impulses reach the ventricles over both routes in varying proportion, so the QRS width changes beat to beat, and the shortest R-R interval reflects the pathway\'s refractory period.',
        ecg: ['Irregularly irregular, very fast (often > 200/min, shortest R-R < 250 ms).', 'QRS complexes of varying width and shape — more pre-excited when shorter cycles favour the pathway.', 'The axis and bundle-branch pattern stay constant (unlike polymorphic VT).'],
        pearls: ['AV-nodal blockers (adenosine, verapamil, diltiazem, digoxin, IV beta-blocker, and IV amiodarone) remove the node\'s competition and concealed retrograde penetration of the pathway → faster pre-excited rates → VF.', 'Unstable → immediate synchronised cardioversion. Stable → procainamide or ibutilide, or cardiovert.', 'Shortest pre-excited R-R ≤ 250 ms marks a high-risk pathway → ablation.'] } },
    { id: 'junctional', group: 'svt', name: 'Junctional rhythm', sub: '48/min with retrograde P', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 1900, startAt: 5000 }, avn: { fast: { retro: { delay: 105, erp: 280 } } }, foci: [{ id: 'j', node: 'H', cl: 1250, label: 'junctional', startAt: 300 }] }),
      teach: { mech: 'The sinus node has slowed or failed and a subsidiary pacemaker in the AV junction (His bundle region) takes over at its intrinsic 40–60/min. The impulse travels down the normal His-Purkinje system (narrow QRS) and backwards into the atria (retrograde P).',
        ecg: ['Regular narrow QRS at 40–60/min.', 'P waves inverted in II, III, aVF and may fall before (short PR), within or after the QRS depending on relative antegrade and retrograde conduction times.'],
        pearls: ['An escape rhythm is a safety net — never suppress it. Find out why the sinus node is not firing (drugs, ischaemia, sick sinus).', '60–100/min = accelerated junctional rhythm (digoxin toxicity, post-surgery, myocarditis, inferior MI).'] } },

    // ------------------------------------------------------------------ AV block
    { id: 'avb1', group: 'block', name: 'First-degree AV block', sub: 'PR 300 ms', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 900 }, avn: { fast: { min: 188 } } }),
      teach: { mech: 'Every impulse conducts, but slowly — usually within the AV node. "Block" is a misnomer; it is delay.',
        ecg: ['PR > 200 ms and constant; every P followed by a QRS.', 'With a narrow QRS the delay is nodal; with bundle branch block it may be infranodal.'],
        pearls: ['Benign in isolation. PR > 300 ms can cause symptoms from atrial contraction against closed valves.', 'Combined with bifascicular block it signals advanced conduction disease.'] } },
    { id: 'wenck', group: 'block', name: 'Second-degree, Mobitz I (Wenckebach)', sub: '4:3 conduction', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 800, sd: 0, resp: 0 }, avn: { fast: { min: 70, alpha: 3219, tau: 197, erp: 250, erpExit: 615 } } }),
      teach: { mech: 'The AV node is decremental: the less time it has had to recover, the slower it conducts. Each beat arrives a little earlier in the node\'s recovery, so conducts a little slower, until one arrives too early and is blocked. The pause lets the node recover and the cycle restarts. The ladder diagram shows the AV lines leaning further each beat.',
        ecg: ['PR lengthens progressively, then a P wave is not conducted.', 'The biggest PR increment is the second beat of the cycle, so the R-R intervals SHORTEN before the pause.', 'Grouped beating; the pause is less than two P-P intervals; PR after the pause is the shortest.'],
        pearls: ['Level is almost always the AV node: narrow QRS, improves with exercise or atropine, worsens with carotid massage.', 'Usually benign (sleep, athletes, inferior MI, AV-nodal drugs). Pace only for symptoms.'] } },
    { id: 'mobitz2', group: 'block', name: 'Second-degree, Mobitz II', sub: '3:2, infranodal', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 830, sd: 0.005, resp: 0 }, hps: { blockN: 3, pattern: 'rbbb+lafb' } }),
      teach: { mech: 'All-or-none failure in the His-Purkinje system, which does not conduct decrementally. One bundle is already blocked; the other fails intermittently. There is no warning — the PR is the same before and after the dropped beat.',
        ecg: ['Constant PR on conducted beats, then a sudden non-conducted P.', 'QRS is usually wide (pre-existing bundle branch / bifascicular block).', 'The pause equals exactly two P-P intervals.'],
        pearls: ['Unstable and unpredictable: can progress to complete block with a slow or absent escape. Pacemaker indicated even if asymptomatic.', 'Atropine may WORSEN it — a faster sinus rate presents more impulses to diseased His-Purkinje tissue. Exercise also worsens it; carotid massage may improve it.', 'Have transcutaneous pads on; isoprenaline/epinephrine infusion or transvenous pacing as a bridge.'] } },
    { id: 'avb21', group: 'block', name: '2:1 AV block', sub: 'cannot be typed from one strip', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 760, sd: 0.004, resp: 0 }, avn: { fast: { erp: 800, conceal: 0.25, min: 96 } } }),
      teach: { mech: 'Every other P wave is blocked. With only one conducted PR between drops you cannot tell progressive prolongation (Mobitz I) from fixed (Mobitz II).',
        ecg: ['Two P waves per QRS, regular. The non-conducted P often sits on the T wave — easily missed and misread as sinus bradycardia.', 'Clues to level: narrow QRS and long PR → nodal; wide QRS and normal PR → infranodal.'],
        pearls: ['Get a long strip: any 3:2 sequence reveals the type. Atropine/exercise improving conduction → nodal; worsening → infranodal.', 'Halving of a previously normal sinus rate should prompt a search for hidden P waves.'] } },
    { id: 'chb-j', group: 'block', name: 'Complete heart block, junctional escape', sub: 'atria 80, ventricles 44, narrow', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 750, resp: 0.01 }, avn: { fast: { block: true, retro: { block: true } } }, foci: [{ id: 'j', node: 'H', cl: 1360, label: 'junctional', startAt: 500 }] }),
      teach: { mech: 'No atrial impulse reaches the ventricles; block is within the AV node, so a junctional pacemaker just below it rescues the ventricles with a narrow QRS at 40–60/min.',
        ecg: ['P waves and QRS complexes are each regular but unrelated (AV dissociation): the PR changes continuously and P waves march through the QRS and T.', 'Atrial rate > ventricular rate.'],
        pearls: ['Nodal-level block: escape is reasonably reliable and may respond to atropine. Causes: inferior MI, Lyme disease, drugs, post-TAVR/surgery, congenital.', 'Still usually needs pacing if not reversible.'] } },
    { id: 'chb-v', group: 'block', name: 'Complete heart block, ventricular escape', sub: 'ventricles 33, wide', focus: 'AV', view: 'koch',
      cfg: () => ({ sinus: { cl: 720, resp: 0.01 }, hps: { block: true }, foci: [{ id: 'v', node: 'V', cl: 1820, site: 'fascPost', label: 'escape', startAt: 400, sd: 0.02 }] }),
      teach: { mech: 'Block below the His bundle. The only rescue is a ventricular pacemaker in the distal Purkinje system or myocardium: slow (20–40/min), wide and unreliable.',
        ecg: ['AV dissociation with atrial rate much faster than a slow, wide-complex ventricular rhythm.', 'Escape morphology shows where it comes from (RBBB pattern → left ventricle).', 'Long pauses may trigger pause-dependent torsades.'],
        pearls: ['Atropine is unlikely to help — the problem is below the node. Go straight to pacing: transcutaneous now, transvenous as a bridge, permanent system as definitive.', 'Epinephrine or isoprenaline can speed the escape while you set up.', 'This is the patient who arrests with Stokes-Adams attacks.'] } },

    // ------------------------------------------------------------------ bundle branch
    { id: 'rbbb', group: 'ivcd', name: 'Right bundle branch block', sub: '', focus: 'V', view: 'front',
      cfg: () => ({ hps: { pattern: 'rbbb' } }),
      teach: { mech: 'Septum and left ventricle activate normally over the left bundle. The right ventricle is then reached late, cell-to-cell across the septum — an unopposed terminal vector pointing right and anterior.',
        ecg: ['QRS ≥ 120 ms. rSR′ ("M") in V1–V2; wide slurred S in I and V6.', 'The first 60–80 ms are normal, so axis and Q waves can still be interpreted.', 'Secondary T inversion in V1–V3 is expected; ST elevation there is not.'],
        pearls: ['Common in healthy people; new RBBB with dyspnoea → consider PE; with chest pain → proximal LAD occlusion.', 'Watch the 3D map: the RV free wall is the last to turn.'] } },
    { id: 'lbbb', group: 'ivcd', name: 'Left bundle branch block', sub: '', focus: 'V', view: 'front',
      cfg: () => ({ hps: { pattern: 'lbbb' } }),
      teach: { mech: 'Activation starts in the right ventricle and must cross the septum right-to-left through working muscle, then spread slowly round the left ventricle; the lateral wall is last. The whole sequence — including the first 40 ms — is abnormal.',
        ecg: ['QRS ≥ 120 ms (often ≥ 140). Broad notched R in I, aVL, V5–V6 with no septal q; deep QS or rS in V1–V3.', 'Discordant ST-T: ST elevation and upright T in V1–V3, ST depression and T inversion laterally — the T opposes the QRS.', 'Concordant ST elevation ≥ 1 mm, concordant ST depression V1–V3, or ST/S ratio ≤ −0.25 (modified Sgarbossa) → acute MI.'],
        pearls: ['Always pathological: cardiomyopathy, hypertension, aortic valve disease, conduction disease.', 'Dyssynchrony: the lateral wall contracts against an already relaxing septum. This is what CRT and left bundle area pacing correct.', 'A catheter bumping the right bundle in someone with LBBB causes complete heart block.'] } },
    { id: 'lafb', group: 'ivcd', name: 'Left anterior fascicular block', sub: 'left axis deviation', focus: 'V', view: 'front',
      cfg: () => ({ hps: { pattern: 'lafb' } }),
      teach: { mech: 'The left bundle fans into an anterior-superior fascicle and a posterior-inferior one. With the anterior fascicle blocked, activation begins inferiorly and sweeps upward and leftward to reach the anterolateral wall last.',
        ecg: ['Left axis deviation (−45° to −90°): qR in I and aVL, rS in II, III, aVF.', 'QRS < 120 ms; delayed R-peak time in aVL; often poor R-wave progression.'],
        pearls: ['The commonest fascicular block (thin fascicle, single blood supply). Exclude inferior MI as the cause of left axis.'] } },
    { id: 'lpfb', group: 'ivcd', name: 'Left posterior fascicular block', sub: 'right axis deviation', focus: 'V', view: 'front',
      cfg: () => ({ hps: { pattern: 'lpfb' } }),
      teach: { mech: 'The mirror image: activation starts antero-superiorly and sweeps down and rightward to the inferoposterior wall.',
        ecg: ['Right axis deviation (+90° to +180°): rS in I and aVL, qR in III and aVF.', 'QRS < 120 ms.'],
        pearls: ['Rare in isolation — a diagnosis of exclusion after RVH, lateral MI, PE and a vertical heart.'] } },
    { id: 'bifasc', group: 'ivcd', name: 'Bifascicular block', sub: 'RBBB + LAFB', focus: 'V', view: 'front',
      cfg: () => ({ hps: { pattern: 'rbbb+lafb' } }),
      teach: { mech: 'Two of the three fascicles are blocked; AV conduction depends on the remaining left posterior fascicle.',
        ecg: ['RBBB morphology in V1 with left axis deviation in the limb leads.', 'Add a long PR and it is loosely called "trifascicular block" — the PR delay may be in the last fascicle or the node.'],
        pearls: ['Syncope + bifascicular block = intermittent complete heart block until proven otherwise.', 'This is the substrate from which Mobitz II and infranodal complete block arise.'] } },

    // ------------------------------------------------------------------ ventricular
    { id: 'pvc', group: 'vent', name: 'PVCs (RVOT)', sub: 'with compensatory pause', focus: 'V', view: 'front',
      cfg: () => ({ sinus: { cl: 860, resp: 0 }, avn: NOVA, foci: [PVC({ coupling: 440, every: 3, site: 'rvotSeptal' })] }),
      teach: { mech: 'A ventricular focus fires early. Activation spreads cell-to-cell from that point instead of through the Purkinje network: slow, so the QRS is wide; and the vector points away from the origin, which is how the 12-lead localises it. The sinus node is not reset, so the next sinus P arrives on time but finds the ventricle refractory.',
        ecg: ['Early, wide (> 120 ms) QRS not preceded by a P wave, with a T wave opposite to the QRS.', 'Fully compensatory pause: the interval spanning the PVC equals two sinus cycles.', 'RVOT origin: LBBB pattern in V1 (starts in the right ventricle) with tall R waves in II, III, aVF (starts at the top).'],
        pearls: ['Outflow-tract PVCs in a structurally normal heart are benign; > 10–15% burden can cause a reversible cardiomyopathy.', 'Open the Localisation lab to move the focus round the heart.'] } },
    { id: 'bigeminy', group: 'vent', name: 'Ventricular bigeminy', sub: 'every other beat', focus: 'V', view: 'front',
      cfg: () => ({ sinus: { cl: 900, resp: 0 }, avn: NOVA, foci: [PVC({ coupling: 430, every: 1, site: 'lvotSeptal' })] }),
      teach: { mech: 'Each sinus beat is followed by a PVC at a fixed coupling interval (re-entry or triggered activity linked to the preceding beat). The long pause after each PVC favours the next one — "the rule of bigeminy".',
        ecg: ['Alternating narrow and wide complexes with fixed coupling.', 'The PVC may not generate a pulse: the palpated or oximeter rate can be half the ECG rate.'],
        pearls: ['"Bradycardia" on the pulse oximeter with a normal monitor rate = non-perfusing bigeminy.', 'Check potassium, magnesium, QT, ischaemia and digoxin.'] } },
    { id: 'nsvt', group: 'vent', name: 'Couplets & non-sustained VT', sub: 'multifocal', focus: 'V', view: 'front',
      cfg: () => ({ sinus: { cl: 820, resp: 0 }, avn: NOVA, foci: [PVC({ id: 'a', coupling: 420, every: 5, site: 'lvInfBase', repeat: 5, cl: 330 }), PVC({ id: 'b', coupling: 470, every: 3, site: 'rvFreeWall', repeat: 2, cl: 400 })] }),
      teach: { mech: 'Repetitive firing from ventricular foci. Different QRS shapes mean different exit sites.',
        ecg: ['Couplet = 2, triplet = 3; ≥ 3 consecutive at > 100/min lasting < 30 s = non-sustained VT.', 'More than one PVC morphology = multifocal.'],
        pearls: ['Prognosis depends on the heart it happens in: with reduced EF or scar it predicts sudden death; with a normal heart it usually does not.', 'Correct K⁺ (> 4.0) and Mg²⁺ (> 2.0); look for ischaemia and QT-prolonging drugs.'] } },
    { id: 'vt', group: 'vent', name: 'Monomorphic VT (scar-related)', sub: '180/min, AV dissociation', focus: 'V', view: 'left',
      cfg: () => ({ sinus: { cl: 760, resp: 0 }, avn: { fast: { retro: { block: true } } }, hps: { retro: { delay: 60, erp: 200 } },
        foci: [{ id: 'vt', node: 'V', cl: 333, site: 'lvInfBase', label: 'VT', startAt: 60, reentrant: true }] }),
      teach: { mech: 'Re-entry around or through a myocardial scar: surviving muscle strands inside the scar form a slow-conducting isthmus. The wave exits the scar at the same site every cycle and spreads cell-to-cell, so every QRS is identical and wide. The atria carry on independently under sinus control.',
        ecg: ['Regular wide-complex tachycardia, QRS usually > 140 ms.', 'AV dissociation: P waves at their own slower rate, unrelated to the QRS (look in II and V1).', 'Capture beats (a sinus impulse finds the ventricle recovered → one narrow QRS) and fusion beats (half sinus, half VT) are diagnostic.', 'Other clues: extreme "northwest" axis, precordial concordance, RS interval > 100 ms, initial R in aVR.'],
        pearls: ['Wide-complex tachycardia + structural heart disease = VT. Haemodynamic stability does NOT make it SVT.', 'Unstable with a pulse → synchronised cardioversion 100–200 J. Pulseless → defibrillate.', 'Stable → procainamide (best evidence), amiodarone 150 mg over 10 min, or sedation and cardioversion. Avoid verapamil.', 'Exit site reads off the 12-lead: RBBB pattern → LV exit; superior axis → inferior wall. Compare in the Localisation lab.'] } },
    { id: 'vt-rvot', group: 'vent', name: 'RVOT ventricular tachycardia', sub: 'idiopathic, repetitive', focus: 'V', view: 'front',
      cfg: () => ({ sinus: { cl: 800, resp: 0 }, avn: NOVA, foci: [PVC({ id: 'r', coupling: 400, every: 3, site: 'rvotSeptal', repeat: 9, cl: 345, label: 'VT' })] }),
      teach: { mech: 'Triggered activity (cAMP-mediated delayed after-depolarisations) from a focus in the right ventricular outflow tract of a structurally normal heart. Provoked by exercise and catecholamines; comes in salvos.',
        ecg: ['LBBB morphology with an inferior axis: QS in V1, tall R in II, III, aVF, QS in aVR and aVL.', 'Precordial transition at V3–V4 or later (earlier transition suggests the LVOT / aortic cusps).', 'Repetitive bursts separated by sinus beats.'],
        pearls: ['Adenosine-sensitive; also responds to beta-blockers and verapamil. Ablation is highly effective.', 'Same ECG pattern in ARVC — look for T inversion V1–V3, epsilon waves, and multiple VT morphologies.'] } },
    { id: 'vt-fasc', group: 'vent', name: 'Fascicular VT', sub: 'verapamil-sensitive, 150/min', focus: 'V', view: 'left',
      cfg: () => ({ sinus: { cl: 800, resp: 0 }, avn: { fast: { retro: { block: true } } }, hps: { retro: { delay: 30, erp: 200 } },
        foci: [{ id: 'vt', node: 'V', cl: 400, site: 'fascPost', label: 'VT', startAt: 60, reentrant: true }] }),
      teach: { mech: 'Re-entry within the left posterior fascicle\'s Purkinje network in a structurally normal heart. Because it exits straight into the conduction system, activation is fast and the QRS is only modestly wide.',
        ecg: ['RBBB morphology with LEFT axis deviation (posterior fascicle exit) — the pattern of RBBB + LAFB.', 'QRS only 120–140 ms with a sharp initial deflection: easily mistaken for SVT with aberrancy.', 'AV dissociation, capture and fusion beats still apply.'],
        pearls: ['Young patient, normal heart, exertional. Terminates with IV verapamil — the one VT where verapamil is correct.', 'Does not respond to adenosine or vagal manoeuvres.'] } },
    { id: 'aivr', group: 'vent', name: 'Accelerated idioventricular rhythm', sub: '≈ 80/min with fusion', focus: 'V', view: 'left',
      cfg: () => ({ sinus: { cl: 800, resp: 0.05, sd: 0.01 }, avn: { fast: { retro: { block: true } } }, foci: [{ id: 'v', node: 'V', cl: 770, site: 'lvInfApical', label: 'AIVR', startAt: 200, sd: 0.008 }] }),
      teach: { mech: 'Enhanced automaticity of a ventricular focus at 50–110/min — close to the sinus rate, so the two pacemakers compete and control passes back and forth (isorhythmic dissociation).',
        ecg: ['Wide-complex rhythm at 50–110/min, gradual onset and offset.', 'Fusion beats where sinus and ventricular wavefronts collide; capture beats when the sinus speeds up.'],
        pearls: ['The classic reperfusion rhythm after thrombolysis or PCI. Benign and self-limiting.', 'Do not suppress it — it may be the only rhythm available. If AV synchrony is needed, speed the sinus node (atropine or atrial pacing).'] } },
    { id: 'pmvt', group: 'vent', name: 'Polymorphic VT (normal QT)', sub: 'ischaemic', focus: 'V', view: 'left',
      cfg: () => ({ sinus: { cl: 700, resp: 0 }, avn: NOVA,
        script: onBeats([{ beat: 4, coupling: 285, site: 'lvAntWall', then: (s, t) => { s.schedule(t + 120, (tt) => s.setVentMode('pmvt', tt)); s.schedule(t + 4900, (tt) => s.setVentMode('normal', tt)); } }]) }),
      teach: { mech: 'Multiple unstable re-entrant waves in the ventricles, with the QRS changing shape and axis beat to beat. When the baseline QT is normal the usual substrate is acute ischaemia; also catecholaminergic polymorphic VT, Brugada syndrome and short-coupled idiopathic VF.',
        ecg: ['Rapid, irregular wide complexes of continuously varying morphology.', 'Preceding sinus beats have a NORMAL QT — this is what separates it from torsades.', 'Often triggered by a short-coupled PVC (R on T).'],
        pearls: ['Treat as ischaemia until proven otherwise: defibrillate if sustained/unstable, then beta-blocker, amiodarone and urgent revascularisation.', 'Magnesium and overdrive pacing — the treatments for torsades — are not expected to work here.'] } },
    { id: 'tdp', group: 'vent', name: 'Torsades de pointes', sub: 'long QT, pause-dependent', focus: 'V', view: 'left',
      cfg: () => ({ sinus: { cl: 1150, resp: 0, sd: 0 }, vent: { mods: LQT },
        script: onBeats([{ beat: 2, coupling: 540, site: 'lvInfApical' },
          { beat: 'next', coupling: 590, site: 'lvAntWall', then: (s, t) => { s.schedule(t + 150, (tt) => s.setVentMode('tdp', tt)); s.schedule(t + 4300, (tt) => s.setVentMode('normal', tt)); } }]) }),
      teach: { mech: 'Prolonged repolarisation lets early after-depolarisations (EADs) reach threshold and fire a triggered beat. Repolarisation is also uneven across the wall, so the triggered beat finds some tissue recovered and some not → re-entry that drifts through the ventricle. The drifting axis makes the QRS appear to twist around the baseline. A pause makes the next QT even longer: short – long – short initiation.',
        ecg: ['Baseline: QTc usually > 500 ms, with large or bizarre T-U waves, worst after a pause.', 'Initiation: PVC → compensatory pause → sinus beat with a giant T-U → PVC on that T-U ("short-long-short").', 'Polymorphic VT 200–250/min whose amplitude waxes and wanes with the peaks rotating about the isoelectric line.', 'Usually self-terminates, recurs, and can degenerate to VF.'],
        pearls: ['Magnesium sulfate 2 g IV even if the level is normal; repeat. Keep K⁺ 4.5–5.0.', 'Speed the heart to shorten the QT and abolish pauses: overdrive pacing at 90–110/min or isoprenaline (acquired LQT only).', 'Stop every QT-prolonging drug. Sustained or pulseless → unsynchronised defibrillation.', 'Avoid amiodarone and procainamide — they prolong the QT further.'] } },
    { id: 'vf', group: 'vent', name: 'Ventricular fibrillation', sub: 'R-on-T initiation', focus: 'V', view: 'left',
      cfg: () => ({ sinus: { cl: 740, resp: 0 }, avn: NOVA,
        script: onBeats([{ beat: 4, coupling: 280, site: 'lvAntWall', then: (s, t) => s.schedule(t + 110, (tt) => s.setVentMode('vf', tt)) }]) }),
      teach: { mech: 'Multiple wavelets and rotors wander chaotically through the ventricles. There is no coordinated contraction and no cardiac output. Coarse VF becomes fine VF and then asystole as the myocardium runs out of energy.',
        ecg: ['Chaotic, irregular deflections of varying amplitude and frequency; no identifiable P, QRS or T.', 'Here a PVC lands on the T wave — the vulnerable period, when part of the ventricle is excitable and part is not.'],
        pearls: ['Defibrillate immediately (biphasic 120–200 J per manufacturer, or maximum), resume CPR at once for 2 min, epinephrine 1 mg every 3–5 min after the second shock, amiodarone 300 mg or lidocaine after the third.', 'Survival falls ≈ 7–10% for each minute without defibrillation.', 'Always check the patient and the leads: artefact and a disconnected lead can look like VF.'] } },
  ];

  R.byId = {};
  for (const r of R.list) R.byId[r.id] = r;

  /* Simulate a library rhythm (or any config) and return a recording.
   * opts: { dur (ms, default 10000), warm (ms), params } */
  R.record = function (entry, opts) {
    opts = opts || {};
    const r = typeof entry === 'string' ? R.byId[entry] : entry;
    const cfg = typeof r.cfg === 'function' ? r.cfg(opts.params || {}) : r.cfg;
    const dur = opts.dur || r.dur || 10000, warm = opts.warm != null ? opts.warm : (r.warm || 0);
    const sim = EP.simulate(cfg, warm + dur);
    const rec = EP.Synth.build(sim, warm, warm + dur, { noise: opts.noise });
    rec.sim = sim; rec.entry = r;
    return rec;
  };
  /* Simple measurements from the event log for the info panel. */
  R.measure = function (rec) {
    const q = rec.events.filter((e) => e.type === 'QRS'), p = rec.events.filter((e) => e.type === 'P');
    const m = { vRate: null, aRate: null, qrs: null, pr: null, qt: null, qtc: null, regular: null };
    if (q.length > 1) {
      const rr = []; for (let i = 1; i < q.length; i++) rr.push(q[i].t - q[i - 1].t);
      const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
      m.vRate = Math.round(60000 / mean);
      m.regular = Math.max(...rr) - Math.min(...rr) < 0.12 * mean;
      m.rrMean = mean;
    }
    if (p.length > 1) { let s = 0; for (let i = 1; i < p.length; i++) s += p[i].t - p[i - 1].t; m.aRate = Math.round(60000 / (s / (p.length - 1))); }
    const seg = rec.segs.find((s) => (s.type === 'fib' || s.type === 'flutter') && s.t0 < rec.t1 && s.t1 > rec.t0);
    if (seg) m.aRate = seg.type === 'flutter' ? Math.round(60000 / seg.cl) : '350–600';
    const cond = q.filter((e) => e.label === 'conducted' || e.label === 'pre-excited');
    const ref = cond.length ? cond[Math.floor(cond.length / 2)] : q[Math.floor(q.length / 2)];
    if (ref) {
      m.qrs = Math.round(ref.wave.qrs); m.qt = Math.round(ref.wave.qt);
      m.qtc = Math.round(ref.wave.qt / Math.sqrt(EP.clamp(ref.rr, 300, 2000) / 1000));
      m.axis = Math.round(Mo.axis(ref.act));
      let best = null;
      for (const e of p) if (e.t < ref.t && (!best || e.t > best.t)) best = e;
      if (best && ref.t - best.t < 700 && !ref.junctional && (ref.label === 'conducted' || ref.label === 'pre-excited')) m.pr = Math.round(ref.t + ref.wave.qrsOn - best.t);
    }
    return m;
  };
})(globalThis.EP = globalThis.EP || {});
