/* EP Simulator — STEMI / occlusion MI: culprit artery ↔ territory ↔ 12-lead, subtle occlusion patterns,
 * LBBB and paced rhythms with the (modified) Sgarbossa criteria, and mimics. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, I = EP.Isch, G = EP.G, Mo = EP.Morph, R = EP.Rhythms, Lds = EP.Leads;
  const CHB = () => ({ fast: { block: true, retro: { block: true } } });
  const plat = (x) => EP.smoothstep(0, 0.045, x) * (1 - EP.smoothstep(0.22, 0.68, x));
  const upslope = (x) => EP.smoothstep(0, 0.03, x) * (1 - EP.smoothstep(0.03, 0.42, x));
  const term = (amp) => (ms, jt) => { if (ms < 0) return 0; const u = (ms / jt - 0.87) / 0.075; return -amp * Math.exp(-u * u); };
  const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];

  const S = (EP.Stemi = {});
  S.groups = [{ id: 'art', name: 'Occlusion by artery' }, { id: 'omi', name: 'Subtle occlusion patterns' }, { id: 'wide', name: 'Abnormal QRS — Sgarbossa' }, { id: 'mimic', name: 'Mimics' }];
  S.list = [
    // ------------------------------------------------------------------ by artery
    { id: 'ladProx', group: 'art', name: 'Proximal LAD', sub: 'before the first septal and diagonal', evol: true, occl: ['lad', 0.03], terr: 'ladProx', view: 'front',
      cfg: (t) => ({ sinus: { cl: 720 }, vent: I.vent({ terr: 'ladProx', stage: t }) }),
      teach: { mech: 'Everything the LAD supplies is ischaemic: the anterior two-thirds of the septum (septal perforators), the anterior and anterolateral wall (diagonals) and the apex. The injury vector points anteriorly and slightly up and right, because basal septum and high anterior wall are included.',
        ecg: ['ST elevation V1–V4 (often to V6), I and aVL.', 'Markers of a PROXIMAL lesion: ST elevation in aVR and V1 > 2.5 mm, ST elevation in aVL, reciprocal ST depression in II, III, aVF, new RBBB or left anterior fascicular block.', 'Evolution: hyperacute T waves within minutes → convex ST elevation → loss of R waves and Q waves V1–V4 → T inversion.'],
        pearls: ['About 40% of the left ventricle is at risk: cardiogenic shock and VF are the early dangers.', 'New RBBB (± LAFB) in anterior MI means the first septal perforator territory is infarcting: infranodal conduction disease with a high risk of sudden complete heart block.', 'Drag the timeline to watch the same occlusion evolve.'] } },
    { id: 'ladMid', group: 'art', name: 'Mid LAD', sub: 'after the first septal and diagonal', evol: true, occl: ['lad', 0.3], terr: 'ladMid', view: 'front',
      cfg: (t) => ({ sinus: { cl: 760 }, vent: I.vent({ terr: 'ladMid', stage: t }) }),
      teach: { mech: 'The basal septum and high lateral wall are spared, so the injury vector points straight anteriorly and toward the apex.',
        ecg: ['ST elevation V2–V5, maximal in V2–V4.', 'No ST elevation in aVR or aVL; inferior leads isoelectric (no reciprocal depression) or slightly elevated.', 'V1 is spared or minimally elevated.'],
        pearls: ['Absence of reciprocal inferior ST depression does not argue against anterior MI — it argues against a proximal lesion.', 'Subtle LAD occlusion vs early repolarisation: occlusion has loss of R-wave height, a longer QTc, terminal QRS distortion (loss of the S wave or J wave in V2–V3) and convexity.'] } },
    { id: 'ladWrap', group: 'art', name: 'Wraparound LAD', sub: 'anterior and inferior ST elevation', evol: true, occl: ['lad', 0.32], terr: 'ladWrap', view: 'inferior',
      cfg: (t) => ({ sinus: { cl: 760 }, vent: I.vent({ terr: 'ladWrap', stage: t }) }),
      teach: { mech: 'A long LAD that curls round the apex to supply the inferoapical wall. Occlusion beyond the first diagonal makes anterior AND inferior walls ischaemic at once; the vector points to the apex.',
        ecg: ['ST elevation in V2–V5 and in II, III, aVF simultaneously.', 'ST elevation II ≥ III (the apex faces lead II) — unlike RCA occlusion, where III > II.', 'No reciprocal depression in aVL.'],
        pearls: ['Simultaneous anterior and inferior ST elevation is far more often one wraparound LAD than two occluded arteries. Pericarditis and takotsubo are the other causes of diffuse elevation.'] } },
    { id: 'd1', group: 'art', name: 'First diagonal — high lateral', sub: '"South African flag" sign', evol: true, occl: ['d1', 0.06], terr: 'd1', view: 'left',
      cfg: (t) => { const v = I.vent({ terr: 'd1', stage: t, amp: 1.25 }), k = Math.max(0, v.mods.st[0]) / 0.05; v.mods.leadAdd = [{ lead: 7, fn: (ms, jt) => (ms < 0 ? 0 : 0.03 * Math.min(4, k) * plat(ms / jt)) }]; return { sinus: { cl: 800 }, vent: v }; },
      teach: { mech: 'A small territory high on the anterolateral wall, under leads I and aVL. The injury vector points up and to the left — almost directly away from lead III.',
        ecg: ['ST elevation in I, aVL and V2; ST depression in III (and aVF).', 'On a standard 4 × 3 printout those four leads (I, aVL, V2, III) form the pattern of the South African flag.', 'ST elevation is often < 1 mm: the reciprocal depression in III may be the most obvious abnormality.'],
        pearls: ['This is the occlusion most often called "non-diagnostic". aVL and III are reciprocal: any ST depression in III should send your eye to aVL.', 'High lateral leads (V4–V6 one or two interspaces up) can confirm.'] } },
    { id: 'lcx', group: 'art', name: 'Circumflex / obtuse marginal', sub: 'lateral ± posterior', evol: true, occl: ['lcx', 0.3], terr: 'lcx', view: 'left',
      cfg: (t) => ({ sinus: { cl: 800 }, vent: I.vent({ terr: 'lcx', stage: t }) }),
      teach: { mech: 'The lateral and posterolateral wall. It faces away from most of the standard leads, so circumflex occlusion is the one most often missed: up to half produce no diagnostic ST elevation on a standard 12-lead.',
        ecg: ['ST elevation in I, aVL, V5–V6 (lateral), usually small.', 'ST depression V1–V3 with upright T waves: the mirror image of posterior ST elevation.', 'Posterior leads V7–V9 show the elevation directly — tick the box above.'],
        pearls: ['Ongoing ischaemic pain with a "normal" or only ST-depressed ECG: record V7–V9 and repeat the ECG. Refractory pain needs the cath lab whatever the ECG shows.', 'Voltage in posterior leads is low: 0.5 mm of ST elevation is significant in V7–V9.'] } },
    { id: 'post', group: 'art', name: 'Isolated posterior MI', sub: 'ST depression V1–V4 is the STEMI', evol: true, occl: ['lcx', 0.72], terr: 'post', view: 'back', extra: true,
      cfg: (t) => ({ sinus: { cl: 820 }, vent: I.vent({ terr: 'post', stage: t, amp: 1.5 }) }),
      teach: { mech: 'The posterior (inferobasal) wall has no lead facing it on a standard ECG. V1–V3 see its injury current from the opposite side, so everything is inverted: ST elevation appears as depression, a posterior Q wave as a tall R, and the terminal T inversion as an upright T.',
        ecg: ['Horizontal ST depression maximal in V1–V4 (not V5–V6), with upright T waves.', 'Later: R/S ratio > 1 in V2 with a broad R (the "Q-wave equivalent").', 'V7–V9: ST elevation ≥ 0.5 mm in any one lead confirms it.'],
        pearls: ['ST depression maximal in V1–V4 = posterior occlusion until proven otherwise. ST depression maximal in V5–V6 and II with ST elevation in aVR = diffuse subendocardial ischaemia. The distinction decides who goes to the cath lab now.', 'Turn the trace upside down and look from behind: V2 becomes a classic STEMI.'] } },
    { id: 'rcaProx', group: 'art', name: 'Proximal RCA', sub: 'inferior MI with right ventricular infarction', evol: true, occl: ['rca', 0.12], terr: 'rcaProx', view: 'inferior', extra: true,
      cfg: (t) => ({ sinus: { cl: 1120 }, avn: { fast: { min: 150 } }, vent: I.vent({ terr: 'rcaProx', stage: t }) }),
      teach: { mech: 'Inferior wall, inferior septum and — because the occlusion is proximal to the RV marginal branches — the right ventricular free wall. The vector points down and to the RIGHT. The RCA also supplies the sinus node (60%) and AV node (90%).',
        ecg: ['ST elevation III > II, with reciprocal ST depression in aVL and I: the vector points toward lead III.', 'Right ventricular involvement: ST elevation in V1 (with ST depression in V2 — a discordance that is almost specific), and ST elevation ≥ 1 mm in V4R.', 'Sinus bradycardia, first-degree block, Wenckebach or complete block with a narrow junctional escape.'],
        pearls: ['Record right-sided leads in every inferior MI — V4R elevation fades within hours.', 'RV infarction is preload-dependent: hypotension with clear lungs and raised JVP. Avoid nitrates, diuretics and morphine; give fluid; maintain AV synchrony.', 'AV block here is nodal (vagal, then ischaemic): usually narrow-complex, atropine-responsive and transient. It rarely needs a permanent pacemaker.'] } },
    { id: 'rcaDist', group: 'art', name: 'Distal RCA', sub: 'inferior MI without RV involvement', evol: true, occl: ['rca', 0.62], terr: 'rcaDist', view: 'inferior',
      cfg: (t) => ({ sinus: { cl: 950 }, vent: I.vent({ terr: 'rcaDist', stage: t }) }),
      teach: { mech: 'Occlusion beyond the RV branches: inferior wall and inferior septum only.',
        ecg: ['ST elevation III > II, reciprocal depression in aVL (the most sensitive single sign of inferior MI) and I.', 'V1 isoelectric; V4R < 1 mm.', 'Q waves in III and aVF later (a Q in III alone is a normal variant).'],
        pearls: ['ST depression in aVL can precede the inferior ST elevation: a new down-sloping ST and inverted T in aVL deserves a repeat ECG in 10 minutes.'] } },
    { id: 'lcxInf', group: 'art', name: 'Dominant circumflex', sub: 'inferolateral-posterior MI', evol: true, occl: ['lcx', 0.22], terr: 'lcxInf', view: 'left', extra: true,
      cfg: (t) => ({ sinus: { cl: 860 }, vent: I.vent({ terr: 'lcxInf', stage: t }) }),
      teach: { mech: 'When the circumflex supplies the posterior descending artery, its occlusion infarcts the inferior, posterior and lateral walls. The vector points down, back and to the LEFT.',
        ecg: ['ST elevation II ≥ III (vector toward the left).', 'No reciprocal depression in aVL/I — they may even be elevated; ST elevation in V5–V6.', 'ST depression V1–V3 from the posterior component.'],
        pearls: ['Inferior MI: III > II with ST depression in I → RCA. II ≥ III with isoelectric or elevated I/aVL and V5–V6 → circumflex.', 'No right ventricular infarction and less bradycardia than with the RCA.'] } },
    { id: 'lm', group: 'art', name: 'Left main / multivessel ischaemia', sub: 'diffuse ST depression with ST elevation in aVR', occl: ['lm', 0.4], terr: null, view: 'front',
      cfg: () => ({ sinus: { cl: 590, resp: 0 }, vent: I.vent({ sub: 1 }) }),
      teach: { mech: 'Global subendocardial ischaemia: the inner layer of the whole left ventricle is ischaemic while the outer layer is not. The injury vector points from epicardium to cavity everywhere; summed, it points toward the base and the right shoulder — toward aVR and away from nearly everything else.',
        ecg: ['ST depression in ≥ 6 leads, maximal in V4–V6 and II.', 'ST elevation in aVR ≥ 1 mm (≥ V1).', 'It is a pattern of supply-demand mismatch, not of one occluded artery.'],
        pearls: ['Causes: left main or proximal LAD subocclusion, triple-vessel disease — but also tachyarrhythmia, severe anaemia, hypoxia, aortic stenosis, post-arrest and massive PE. Treat the cause first; persistent pattern with ongoing pain → urgent angiography.', 'True total left main occlusion usually presents as anterolateral STEMI with shock or arrest, not with this pattern.'] } },
    // ------------------------------------------------------------------ subtle OMI
    { id: 'hyper', group: 'omi', name: 'Hyperacute T waves', sub: 'the first minutes of LAD occlusion', occl: ['lad', 0.3], terr: 'ladMid', view: 'front',
      cfg: () => ({ sinus: { cl: 780 }, vent: I.vent({ terr: 'ladMid', stage: 0.06 }) }),
      teach: { mech: 'Before the ST segment rises, extracellular potassium leaks from ischaemic cells and shortens their action potential: the T wave over the territory becomes broad, bulky and symmetrical.',
        ecg: ['T waves that are large RELATIVE to the QRS that precedes them — wide-based, symmetrical, with a straightened ST take-off. Size is judged against the R wave, not in absolute millimetres.', 'Minimal or no ST elevation yet; reciprocal changes may already be present.', 'Hyperkalaemia gives narrow, pointed, tented T waves in all leads; hyperacute T waves are fat and regional.'],
        pearls: ['This is the earliest sign of occlusion and it is transient: repeat the ECG every 10–15 minutes. The next tracing declares itself.', 'A T wave taller than the R wave in V2–V4 in someone with chest pain is abnormal until proven otherwise.'] } },
    { id: 'dewinter', group: 'omi', name: 'de Winter pattern', sub: 'LAD occlusion without ST elevation', occl: ['lad', 0.08], terr: 'ladProx', view: 'front',
      cfg: () => { const v = I.terr('ladMid').vec; return { sinus: { cl: 760 }, vent: { mods: { st: scale(v, -0.5), stShape: upslope, tAdd: scale(v, 135 * 1.7), tShape: { p: 0.66, sl: 0.17, sr: 0.14 }, leadAdd: [{ lead: 3, fn: (ms, jt) => (ms < 0 ? 0 : 0.09 * plat(ms / jt)) }] } } }; },
      teach: { mech: 'A static pattern (it does not evolve into ST elevation) seen in about 2% of acute LAD occlusions. The usual explanation is subendocardial ischaemia with preserved subepicardial flow from collaterals or a wraparound vessel.',
        ecg: ['1–3 mm of UPSLOPING ST depression at the J point in V1–V6…', '…continuing into tall, symmetrical, prominent T waves.', '0.5–1 mm ST elevation in aVR; no precordial ST elevation.'],
        pearls: ['A STEMI equivalent: activate the cath lab. It is not "ischaemia with peaked T waves".', 'Upsloping ST depression is benign on an exercise test and dangerous at rest with chest pain.'] } },
    { id: 'swirl', group: 'omi', name: 'Precordial swirl', sub: 'septal STEMI — LAD proximal to the first septal', occl: ['lad', 0.02], terr: 'septal', view: 'front',
      cfg: () => ({ sinus: { cl: 740 }, vent: I.vent({ terr: 'septal', stage: 0.36, amp: 1.1 }) }),
      teach: { mech: 'When the basal septum is the dominant ischaemic territory the injury vector points from the left side of the septum to the right — toward V1 and aVR and directly away from V5–V6. Looked at across the precordium, the ST segments "swirl" from elevation on the right to depression on the left. Make the wall translucent in the 3D view to see the septal territory.',
        ecg: ['ST elevation in V1 and aVR (often V2), with hyperacute T waves in V1–V2.', 'RECIPROCAL ST depression in V5 and V6 — the feature that defines the pattern.', 'The ST elevation in V1–V2 may be only 1–2 mm and is easily dismissed as LVH or "anterior early repolarisation".'],
        pearls: ['Described by Smith and Meyers as a sign of LAD occlusion proximal to the first septal perforator. It is frequently misread as left main / diffuse ischaemia because of the aVR elevation: the difference is that here V1–V2 are elevated and the depression is confined to the lateral leads.', 'Mimics that give ST elevation in V1 with lateral depression: LVH with strain and LBBB — in both the QRS is abnormal and the ST change is proportionate to it.'] } },
    { id: 'aslanger', group: 'omi', name: 'Aslanger pattern', sub: 'inferior occlusion hidden by multivessel disease', occl: ['rca', 0.75], terr: 'infSmall', view: 'inferior',
      cfg: () => ({ sinus: { cl: 700 }, vent: I.vent({ terr: 'infSmall', stage: 0.36, sub: 0.55 }) }),
      teach: { mech: 'Two vectors at once: a small inferior injury current (pointing down and right, toward lead III) and diffuse subendocardial ischaemia from disease in the other vessels (pointing toward aVR). They cancel in II and aVF, leaving ST elevation in lead III alone.',
        ecg: ['ST elevation in III but not in the other inferior leads.', 'ST depression in V4–V6 (not V2) with a positive or terminally positive T wave.', 'ST segment in V1 higher than in V2.'],
        pearls: ['Does not meet STEMI criteria (needs two contiguous leads) yet marks an acute inferior occlusion with multivessel disease — and a larger infarct and higher mortality than other NSTEMI.', 'Isolated ST elevation in III is not automatically benign: look at aVL (reciprocal), V1 vs V2, and the lateral leads.'] } },
    { id: 'wellensA', group: 'omi', name: 'Wellens pattern A', sub: 'biphasic T waves V2–V3', occl: null, terr: 'ladMid', view: 'front',
      cfg: () => { const v = I.vent({ terr: 'ladMid', st: 0, t: -0.18, q: 0 }); v.mods.leadAdd = [{ lead: 7, fn: term(0.34) }, { lead: 8, fn: term(0.4) }, { lead: 9, fn: term(0.22) }]; return { sinus: { cl: 900 }, vent: v }; },
      teach: { mech: 'A REPERFUSION pattern: the LAD occluded, caused pain, and has spontaneously reopened. The terminal T inversion is the same change seen after successful PCI. The artery still has a critical unstable lesion.',
        ecg: ['Pain-free ECG: biphasic T waves in V2–V3 — up first, then sharply down (type A, ≈ 25%).', 'Isoelectric or minimally elevated ST (< 1 mm), preserved precordial R waves, no Q waves.', 'Normal or slightly raised troponin.'],
        pearls: ['Wellens syndrome is a history (recent angina, now pain-free) plus the ECG. The same T waves in someone with ongoing pain mean something else.', 'If pain returns the T waves "pseudo-normalise" to upright — that is re-occlusion, not improvement.', 'Do not stress-test. Early angiography.'] } },
    { id: 'wellensB', group: 'omi', name: 'Wellens pattern B', sub: 'deep symmetrical T inversion', occl: null, terr: 'ladMid', view: 'front',
      cfg: () => { const v = I.vent({ terr: 'ladMid', st: 0.02, t: -1.3, q: 0 }); v.mods.tShape = { p: 0.7, sl: 0.15, sr: 0.13 }; v.mods.qtc = 450; return { sinus: { cl: 920 }, vent: v }; },
      teach: { mech: 'The later stage of the same reperfusion process: pattern A evolves into B over hours to days.',
        ecg: ['Deep (> 2 mm), symmetrical T-wave inversion in V2–V4, often extending to V1–V6 (type B, ≈ 75%).', 'QT prolonged; R waves preserved.', 'Differential of deep precordial T inversion: PE (with inversion in III and V1, tachycardia), raised intracranial pressure, takotsubo, hypertrophic cardiomyopathy (apical), post-pacing/post-tachycardia memory T waves.'],
        pearls: ['Cardiac memory after RV pacing or LBBB: T inversion in the precordium but upright T in I and aVL, and the precordial T inversion is deeper than in lead III — the opposite of LAD ischaemia.'] } },
    // ------------------------------------------------------------------ abnormal QRS
    { id: 'lbbb0', group: 'wide', name: 'LBBB without occlusion', sub: 'appropriate discordance', wide: true, occl: null, terr: null, view: 'front',
      cfg: () => ({ sinus: { cl: 820 }, hps: { pattern: 'lbbb' } }),
      teach: { mech: 'Abnormal depolarisation produces abnormal repolarisation. In LBBB the ST segment and T wave point opposite to the main QRS deflection in every lead — and the size of the ST shift is proportional to the size of the QRS.',
        ecg: ['Leads with a deep S (V1–V3): ST elevation and upright T. Leads with a tall R (I, aVL, V5–V6): ST depression and inverted T.', 'The ST elevation in V1–V3 is typically 10–20% of the S-wave depth; 5 mm of elevation can be normal behind a 40 mm S wave.', 'Nothing here meets any Sgarbossa criterion — check the calculator.'],
        pearls: ['"New LBBB" on its own is no longer a STEMI equivalent: most such patients do not have an occlusion. Look for the specific signs instead.'] } },
    { id: 'lbbbLad', group: 'wide', name: 'LBBB + LAD occlusion', sub: 'excessive discordance', wide: true, occl: ['lad', 0.05], terr: 'ladProx', view: 'front',
      cfg: () => ({ sinus: { cl: 760 }, hps: { pattern: 'lbbb' }, vent: I.vent({ terr: 'ladProx', stage: 0.36, amp: 0.7 }) }),
      teach: { mech: 'The injury current adds to the baseline secondary ST shift. In V1–V3 both point the same way (up), so the ST elevation stays discordant — but becomes too large for the S wave it follows.',
        ecg: ['Original Sgarbossa: concordant ST elevation ≥ 1 mm (5 points), concordant ST depression ≥ 1 mm in V1–V3 (3), discordant ST elevation ≥ 5 mm (2). Score ≥ 3 is specific (≈ 98%) but insensitive (≈ 20–36%).', 'Smith-modified: replace the absolute 5 mm rule with a RATIO — ST elevation ÷ S-wave depth ≥ 0.25 (ST/S ≤ −0.25) in any lead with ≥ 1 mm of elevation. Any one of the three criteria is positive. Sensitivity ≈ 80–91%, specificity ≈ 90%.', 'Measure ST at the J point relative to the PR segment, and the S (or R) from the PR segment to its nadir (or peak).'],
        pearls: ['The same rules apply to right ventricular paced rhythms.', 'Unstable patient with LBBB and ischaemic symptoms: angiography regardless of the score.'] } },
    { id: 'lbbbInf', group: 'wide', name: 'LBBB + inferoposterior occlusion', sub: 'concordant ST depression V1–V3', wide: true, occl: ['lcx', 0.22], terr: 'lcxInf', view: 'left',
      cfg: () => ({ sinus: { cl: 800 }, hps: { pattern: 'lbbb' }, vent: I.vent({ terr: 'lcxInf', stage: 0.36, amp: 0.95 }) }),
      teach: { mech: 'A posterior injury vector pulls the ST segment in V1–V3 downward — the same direction as their QS complexes. Concordance in LBBB is always abnormal.',
        ecg: ['ST DEPRESSION in V1–V3, where LBBB should produce ST elevation: concordant depression ≥ 1 mm (3 points — positive on its own).', 'Inferior leads: ST elevation out of proportion to their small QRS complexes (ratio criterion).', 'Lateral leads may lose their expected ST depression ("pseudo-normalisation").'],
        pearls: ['In LBBB the question is never "is there ST elevation?" but "is the ST segment where the QRS says it should be?"'] } },
    { id: 'paceLad', group: 'wide', name: 'Paced rhythm + LAD occlusion', sub: 'Sgarbossa applies', wide: true, occl: ['lad', 0.05], terr: 'ladProx', view: 'front',
      cfg: () => ({ sinus: { cl: 820 }, avn: CHB(), vent: I.vent({ terr: 'ladProx', stage: 0.36, amp: 0.7 }) }), pm: { mode: 'DDD', lrl: 60, vSite: 'rvApex' },
      teach: { mech: 'RV apical pacing activates the ventricles much as LBBB does (right before left), so it has the same discordant repolarisation — and the same rules for finding an infarct behind it.',
        ecg: ['Paced QRS: LBBB pattern with a superior axis, so the inferior leads are also negative with discordant ST elevation at baseline.', 'Here V1–V4 show ST elevation exceeding 25% of the S wave.', 'Concordant ST elevation is rarer in paced rhythms because few leads have a positive QRS (I, aVL, sometimes V5–V6).'],
        pearls: ['If the patient is not pacing-dependent, temporarily lowering the rate to reveal the intrinsic QRS helps — but T-wave inversion afterwards may be cardiac memory, not ischaemia.', 'Biventricular and left-bundle-area pacing change the baseline pattern; compare with a previous paced ECG.'] } },
    { id: 'rbbbLad', group: 'wide', name: 'New RBBB + LAFB with anterior MI', sub: 'a high-risk combination', occl: ['lad', 0.02], terr: 'ladProx', view: 'front',
      cfg: () => ({ sinus: { cl: 700 }, hps: { pattern: 'rbbb+lafb' }, vent: I.vent({ terr: 'ladProx', stage: 0.4, amp: 0.9 }) }),
      teach: { mech: 'The right bundle and the left anterior fascicle run in the anterior septum and are supplied by the first septal perforator. Their loss means a very proximal LAD (or left main) occlusion with a large septal infarct.',
        ecg: ['RBBB (wide terminal R in V1, wide S in I and V6) with left axis deviation.', 'RBBB does not hide infarction: the first 80 ms and the ST segment are still readable. The expected T inversion in V1–V3 is replaced by ST elevation. Q waves replace the initial r in V1–V3 (qR).', 'Do not apply Sgarbossa to RBBB — read the ST segment normally, measuring from the J point (the end of the R′).'],
        pearls: ['Mortality is several times that of anterior MI without block; progression to complete infranodal heart block can be abrupt. Pacing pads on; many centres place a temporary wire.', 'Persisting bifascicular block with transient complete block after MI is an indication for permanent pacing.'] } },
    // ------------------------------------------------------------------ mimics
    { id: 'peri', group: 'mimic', name: 'Acute pericarditis', sub: 'diffuse ST elevation with PR depression', occl: null, terr: null, view: 'front',
      cfg: () => ({ sinus: { cl: 640 }, atria: { prDep: 0.075 }, vent: { mods: { st: scale(G.A, 0.17), tAmp: 1.0 } } }),
      teach: { mech: 'Inflammation of the whole epicardial surface: a superficial injury current over both ventricles, whose sum points to the apex (down, left and forward) — and over the atria, which shifts the PR segment the opposite way.',
        ecg: ['Widespread concave-up ST elevation: I, II, aVF, V2–V6. ST elevation II > III.', 'PR depression in the same leads; PR ELEVATION with ST depression in aVR (and V1).', 'No reciprocal ST depression other than aVR/V1; no Q waves; T waves invert only after the ST segments normalise.', 'ST/T ratio in V6 > 0.25 favours pericarditis over early repolarisation.'],
        pearls: ['Any reciprocal depression (especially in aVL), ST elevation III > II, convex or horizontal ST, or new Q waves → treat as MI.', 'Spodick\'s sign: a down-sloping TP segment.'] } },
    { id: 'er', group: 'mimic', name: 'Early repolarisation', sub: 'benign precordial ST elevation', occl: null, terr: null, view: 'front',
      cfg: () => ({ sinus: { cl: 1020 }, vent: { mods: { st: [0.075, -0.035, 0.12], jWave: 0.13, tAmp: 1.4 } } }),
      teach: { mech: 'A normal variant of early repolarisation in the anterolateral epicardium, most marked at slow heart rates in young, athletic people.',
        ecg: ['Concave ST elevation V2–V5 with a notch or slur at the J point, and tall but ASYMMETRIC T waves (slow up, fast down).', 'Tall R waves, normal R-wave progression, short QTc, no reciprocal depression.', 'Stable from one ECG to the next.'],
        pearls: ['Subtle LAD occlusion is distinguished by: low R-wave amplitude in V4, longer QTc, ST elevation 60 ms after the J point in V3, and low QRS amplitude in V2 (the Smith four-variable formula). Terminal QRS distortion — no S wave and no J wave in V2 or V3 — does not occur in early repolarisation.', 'When in doubt, serial ECGs and echo: early repolarisation does not change over 20 minutes.'] } },
    { id: 'aneurysm', group: 'mimic', name: 'Left ventricular aneurysm', sub: 'old anterior MI with persistent ST elevation', occl: null, terr: 'ladProx', view: 'front',
      cfg: () => ({ sinus: { cl: 860 }, vent: I.vent({ terr: 'ladProx', st: 0.26, t: -0.1, q: 0.93 }) }),
      teach: { mech: 'A thinned, scarred, dyskinetic anterior wall weeks or more after an un-reperfused LAD infarct. The scar no longer depolarises (deep QS waves) and the ST segment never returns to baseline.',
        ecg: ['QS or Qr waves in V1–V4 with coved ST elevation of 1–3 mm.', 'Small, flat or shallowly inverted T waves.', 'T-wave to QRS amplitude ratio < 0.36 in ALL of V1–V4 suggests aneurysm; a ratio ≥ 0.36 in any one of them suggests acute MI (the T wave is still tall in acute occlusion).'],
        pearls: ['The rule only applies when symptoms are recent (< 6 h): subacute MI also has small T waves.', 'The scar border is a substrate for monomorphic VT — the scar-related VT in the Rhythms tab.'] } },
  ];
  S.byId = {}; for (const x of S.list) S.byId[x.id] = x;

  /* Simulate a pattern → recording with all 16 leads. */
  S.record = function (pt, stage) {
    const sim = new EP.HeartSim(pt.cfg(stage));
    if (pt.pm) new EP.Pacemaker(sim, pt.pm);
    sim.runUntil(12500);
    const rec = EP.Synth.build(sim, 2200, 12200); rec.sim = sim;
    return rec;
  };

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'stemi', title: 'STEMI / OMI',
    mount(root) {
      let cur = null, stage = 0.36, extra = false, timer = 0, corH = null;
      const player = new EP.Player({ layout: '12', ladder: false });
      const rail = h('nav.card.rail', { 'aria-label': 'Patterns' }), listEl = h('div', { style: { paddingBottom: '8px' } }); rail.append(listEl);
      const sel = UI.select(null, S.groups.map((g) => ({ group: g.name, items: S.list.filter((x) => x.group === g.id).map((x) => [x.id, x.name]) })), 'ladProx', (v) => show(v));
      sel.classList.add('rail-sel'); sel.setAttribute('aria-label', 'Pattern');
      const ctl = h('div.card-b'), stEl = h('div'), sgEl = h('div'), head = h('div.card-h'), teach = h('div.card-b');
      function fill() { listEl.innerHTML = ''; for (const g of S.groups) { listEl.append(h('div.rail-g', g.name)); for (const x of S.list.filter((y) => y.group === g.id)) listEl.append(h('button.rail-i', { type: 'button', 'aria-current': String(cur === x), onclick: () => show(x.id) }, x.name, h('small', x.sub))); } }
      function render(keep) {
        const rec = S.record(cur, stage);
        player.o.strips = extra ? [12, 13, 14, 15] : [1]; player._applyLayout();
        player.load(rec, { title: cur.name + (cur.evol ? ' — ' + I.stageName(stage) : ''), t: keep ? player.t : null });
        const q = rec.events.filter((e) => e.type === 'QRS' && e.t > rec.t0 + 1500)[1];
        if (!q) return;
        const m = I.measure(rec, q);
        stEl.innerHTML = '';
        const chip = (l) => { const mm = m[l].st * 10, big = Math.abs(mm) >= (l >= 13 ? 0.5 : 1); return h('div', { style: { background: big ? (mm > 0 ? 'color-mix(in srgb, var(--bad) 16%, var(--surface))' : 'color-mix(in srgb, var(--ecg-caliper) 16%, var(--surface))') : 'var(--surface)' } }, h('div.k', Lds.names[l]), h('div.v', { style: { fontSize: '13px' } }, (mm > 0 ? '+' : '') + mm.toFixed(1))); };
        stEl.append(h('div.eyebrow', { style: { margin: '0 0 4px' } }, 'ST level at the J point (mm) — red elevation, blue depression'), h('div.kv', { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))' } }, [...Array(extra ? 16 : 12).keys()].map(chip)));
        sgEl.innerHTML = '';
        if (cur.wide) {
          const sg = I.sgarbossa(m);
          const yes = (b) => h('span.pill' + (b ? '.bad' : '.good'), b ? 'met' : 'not met');
          const crit = h('div.findings',
            h('div.finding', yes(sg.concSTE.length), h('div', h('b', 'Concordant ST elevation ≥ 1 mm'), h('span.muted', ' in a lead with a positive QRS' + (sg.concSTE.length ? ': ' + sg.concSTE.join(', ') : '')))),
            h('div.finding', yes(sg.concSTD.length), h('div', h('b', 'Concordant ST depression ≥ 1 mm in V1–V3'), h('span.muted', sg.concSTD.length ? ': ' + sg.concSTD.join(', ') : ''))),
            h('div.finding', yes(sg.ratio.length), h('div', h('b', 'Excessively discordant ST elevation: ST/S ≤ −0.25'), h('span.muted', sg.ratio.length ? ': ' + sg.ratio.join(', ') : ''),
              h('div.muted', 'Original third criterion (discordant elevation ≥ 5 mm): ' + (sg.disc5.length ? sg.disc5.join(', ') : 'none')))));
          const flag = (r) => (r.ratio <= -0.25 && r.st >= 1) || r.conc;
          const table = h('table.tbl',
            h('thead', h('tr', h('th', 'Lead'), sg.rows.map((r) => h('th', r.name)))),
            h('tbody',
              h('tr', h('td', 'QRS'), sg.rows.map((r) => h('td.mono', r.pos ? '+' : '−'))),
              h('tr', h('td', 'R or S (mm)'), sg.rows.map((r) => h('td.mono', r.dom.toFixed(0)))),
              h('tr', h('td', 'ST (mm)'), sg.rows.map((r) => h('td.mono', r.st.toFixed(1)))),
              h('tr', h('td', 'ST ÷ QRS'), sg.rows.map((r) => h('td.mono', { style: { fontWeight: flag(r) ? '700' : '400', color: flag(r) ? 'var(--bad)' : '' } }, r.ratio.toFixed(2))))));
          sgEl.append(h('section.card',
            h('div.card-h', h('h3', 'Sgarbossa calculator'), h('span.grow'), h('span.pill' + (sg.modified ? '.bad' : '.good'), sg.modified ? 'modified criteria POSITIVE' : 'modified criteria negative'), h('span.pill', 'original score ' + sg.original)),
            h('div.card-b', crit, h('div.scroll-x', { style: { marginTop: '10px' } }, table))));
        }
      }
      function show(id) {
        cur = S.byId[id] || S.list[0]; stage = 0.36; extra = !!cur.extra;
        if (sel.sel) sel.sel.value = cur.id; else sel.value = cur.id;
        ctl.innerHTML = '';
        const exChk = UI.check('Show V4R and posterior leads V7–V9', extra, (v) => { extra = v; render(true); });
        if (cur.evol) {
          const out = h('b', I.stageName(stage));
          const rng = h('input', { type: 'range', min: 0.02, max: 1, step: 0.02, value: stage, 'aria-label': 'Time since occlusion', style: { flex: '1', minWidth: '160px' }, oninput: () => { stage = +rng.value; out.textContent = I.stageName(stage); clearTimeout(timer); timer = setTimeout(() => render(true), 90); } });
          ctl.append(h('div.row', h('span.muted', 'Onset'), rng, h('span.muted', 'Weeks'), out));
        }
        ctl.append(h('div.row', { style: { marginTop: cur.evol ? '8px' : '0' } }, exChk));
        head.innerHTML = ''; head.append(h('div', h('div.eyebrow', (S.groups.find((g) => g.id === cur.group) || {}).name), h('h2', { style: { fontSize: '17px' } }, cur.name)));
        teach.innerHTML = ''; teach.append(UI.teach(cur.teach));
        if (player.heart) {
          if (corH) corH.remove();
          corH = I.addCoronaries(player.heart, cur.occl);
          player.heart.setTint(cur.terr ? I.terr(cur.terr).w : null);
          player.heart.setMode('anat'); player.modeSeg.set('anat'); player._legend('anat');
          player.setOpacity(cur.terr === 'septal' ? 0.45 : 1); player.heart.setView(cur.view || 'front');
        }
        fill(); render(false);
      }
      const rules = h('section.card', h('div.card-h', h('h3', 'Reading for occlusion, not for millimetres')), h('div.card-b.prose', UI.list([
        'STEMI criteria (≥ 1 mm in two contiguous leads; in V2–V3 ≥ 2 mm men ≥ 40, ≥ 2.5 mm men < 40, ≥ 1.5 mm women) miss a quarter to a third of acute coronary occlusions. The patterns under "Subtle occlusion" are how the rest are found.',
        'Reciprocal change is the most useful single discriminator: ST elevation with depression in the opposite leads is an occlusion; diffuse elevation without it is usually not.',
        'Proportion matters more than size: a 1 mm ST elevation after a 3 mm QRS is large; 4 mm after a 40 mm S wave is not.',
        'The ECG is a single frame of a film. Repeat it every 10–15 minutes while symptoms continue, and compare with an old one.',
        'Add leads when the story and the standard 12 disagree: V7–V9 for ST depression in V1–V4, V4R for any inferior MI.',
        'Arrhythmias by territory: inferior MI → sinus bradycardia and nodal AV block (atropine-responsive, transient). Anterior MI → bundle branch block and infranodal block (abrupt, needs pacing). Any territory → VF in the first hours; accelerated idioventricular rhythm at reperfusion (leave it alone).'])));
      root.append(h('div.lab', rail, h('div.stack', sel, h('section.card', ctl), player.ecgCard, stEl, sgEl, h('section.card', head, teach), rules),
        h('div.side', player.heartCard || h('div'), h('div.note', 'The shaded area is the ischaemic territory; the dark band marks the occlusion. ST vectors are computed from that territory, so reciprocal changes follow from the anatomy. Lower the "Wall" slider to see the septum.'))));
      show((EP.pending && EP.pending.id) || 'ladProx');
      return { unmount() { player.destroy(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
