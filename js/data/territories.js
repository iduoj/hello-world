/* Culprit scenarios linking a coronary occlusion to its 12-lead ECG and echo wall-motion pattern.
   ST deviations are in mm at the J point (1 mm = 0.1 mV). Echo scores (ASE): 1 normal, 2 hypokinetic, 3 akinetic, 4 dyskinetic. */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};

  CL.data.culprits = [
    { id: 'normal', name: 'Normal', vessel: null, seg: null,
      ecg: { st: {} },
      echo: {},
      teach: ['Normal sinus rhythm, normal axis, R-wave progression with the transition at V3–V4, upright T waves except aVR (and sometimes V1/III).'],
      cx: [] },

    { id: 'plad', name: 'Proximal LAD (before S1 and D1)', vessel: 'LAD', seg: 'lad-p', view: 'rao-cra', lesionPos: 0.35,
      ecg: { st: { V1: 2.5, V2: 4.5, V3: 4.5, V4: 3, V5: 1.5, V6: 0.5, I: 1, aVL: 1.5, aVR: 1, II: -1, III: -2, aVF: -1.5 } },
      echo: { 1: 2, 2: 2, 7: 3, 8: 3, 12: 2, 13: 3, 14: 3, 15: 2, 16: 3, 17: 3 },
      teach: [
        'Anterior STE (V1–V4) means LAD territory.',
        'STE in I and aVL with reciprocal inferior STD means the occlusion is before D1 (the high lateral wall is also ischemic).',
        'STE in aVR, STE in V1 >2.5 mm or a new RBBB means it is before S1: the basal septum and conduction system are at risk.',
        'Echo: anterior, anteroseptal and the whole apex akinetic. A large territory means shock risk.'],
      cx: ['Cardiogenic shock (largest territory)', 'LV apical thrombus and apical aneurysm', 'Apical VSD', 'Infranodal block: Mobitz II, CHB with a wide escape, new RBBB/LAFB (septal perforators)'] },

    { id: 'mlad', name: 'Mid LAD (after D1)', vessel: 'LAD', seg: 'lad-m', view: 'rao-cra', lesionPos: 0.3,
      ecg: { st: { V1: 1, V2: 3, V3: 4, V4: 3.5, V5: 1.5, aVL: -0.5 } },
      echo: { 7: 2, 8: 2, 13: 3, 14: 3, 16: 2, 17: 3 },
      teach: ['Precordial STE (V2–V5) without STE in I/aVL. aVL may even show STD, because D1 is spared.', 'Echo: mid-anterior/anteroseptal hypokinesis with apical akinesis. Basal segments move normally.'],
      cx: ['Apical thrombus', 'Apical aneurysm'] },

    { id: 'wrap', name: 'Distal "wraparound" LAD', vessel: 'LAD', seg: 'lad-d', view: 'rao-cra', lesionPos: 0.15,
      ecg: { st: { V2: 1, V3: 2.5, V4: 3, V5: 2.5, V6: 1.5, II: 1.5, III: 1, aVF: 1.5, aVR: -0.8 } },
      echo: { 13: 3, 14: 3, 15: 3, 16: 3, 17: 4 },
      teach: ['A wraparound LAD crosses the apex to supply the inferior apex. You get anterior STE plus inferior STE with no inferior reciprocal STD.', 'It can mimic multivessel disease or an inferior STEMI with anterior extension.', 'Echo: circumferential apical akinesis and a dyskinetic apical cap.'],
      cx: ['Apical aneurysm / thrombus'] },

    { id: 'd1', name: 'First diagonal: high lateral', vessel: 'LAD', seg: 'd1', view: 'lao-cra', lesionPos: 0.2,
      ecg: { st: { I: 1.5, aVL: 2.5, V2: 1.5, V5: 0.5, V6: 0.5, III: -2, aVF: -1, II: -0.5 } },
      echo: { 7: 2, 12: 3, 6: 2, 16: 2 },
      teach: ['"South African flag": STE in I, aVL and V2 with STD in III (the leads sit in the flag’s shape on a 12-lead layout).', 'High lateral is a territory, not one artery: usually D1, sometimes a ramus or high OM.', 'Easily missed because STE in aVL is small. Reciprocal STD in III is often the most obvious finding.'],
      cx: [] },

    { id: 'om', name: 'LCx / obtuse marginal: lateral', vessel: 'LCx', seg: 'om1', view: 'rao-cau', lesionPos: 0.25,
      ecg: { st: { I: 1, aVL: 1.5, V5: 1.5, V6: 2, III: -1, aVF: -0.5, V1: -1, V2: -1.5 } },
      echo: { 5: 2, 6: 3, 11: 2, 12: 3, 16: 2 },
      teach: ['Lateral STE (I, aVL, V5–V6), often with posterior STD in V1–V2.', 'The LCx is "electrically silent": up to half of LCx occlusions miss STEMI criteria, so get V7–V9 and an echo.'],
      cx: ['Anterolateral papillary muscle has dual supply (D1 + OM), so rupture is rare.'] },

    { id: 'prca', name: 'Proximal RCA with RV infarct', vessel: 'RCA', seg: 'rca-p', view: 'rca-lao', lesionPos: 0.6, rhythm: 'brady', rv: true,
      ecg: { st: { II: 2, III: 3.5, aVF: 3, V1: 1.5, V2: -0.5, I: -1, aVL: -2, V4R: 1.5 } },
      echo: { 3: 2, 4: 3, 9: 2, 10: 3, 15: 2, 5: 2 },
      teach: ['Inferior STE with III > II and reciprocal STD in aVL > I: RCA.', 'STE in V1 (V1 > V2, or V1 STE with V2 STD) and STE in V4R (≥1 mm classic; ≥0.5 mm UDMI) mean RV infarction: the occlusion is proximal to the RV branches.', 'The RV is preload-dependent: give fluids, avoid nitrates and diuretics, and watch for hypotension.', 'Echo: inferior/inferoseptal akinesis plus a dilated, hypokinetic RV free wall with low TAPSE.'],
      cx: ['RV failure and hypotension (preload dependent)', 'AV block or sinus bradycardia (AV nodal and SA nodal arteries); usually transient', 'Posteromedial papillary muscle rupture (single PDA supply), causing acute severe MR', 'Basal inferoseptal VSD (complex, serpiginous)'] },

    { id: 'drca', name: 'Distal RCA: inferior', vessel: 'RCA', seg: 'rca-d', view: 'rca-lao-cra', lesionPos: 0.4, rhythm: 'wenck',
      ecg: { st: { II: 1.5, III: 3, aVF: 2.5, I: -0.8, aVL: -1.5, V1: -0.5, V2: -0.5 } },
      echo: { 3: 2, 4: 3, 9: 2, 10: 3, 15: 2 },
      teach: ['Inferior STE (III > II) with reciprocal STD in aVL. No RV involvement because the RV branches arise proximally.', 'Wenckebach (Mobitz I) AV block is common: AV nodal ischemia plus vagal tone. It is usually narrow-complex and transient.', 'Echo: inferior and inferoseptal hypo- or akinesis.'],
      cx: ['Mobitz I or complete heart block with a narrow junctional escape; usually recovers within 24–72 h', 'Posteromedial papillary muscle rupture'] },

    { id: 'lcxinf', name: 'Dominant LCx: inferolateral', vessel: 'LCx', seg: 'lcx-p', view: 'rao-cau', lesionPos: 0.6, dom: 'left',
      ecg: { st: { II: 2, III: 1.5, aVF: 1.8, I: 0.5, V5: 1.5, V6: 2, V1: -1.5, V2: -2.5, V3: -1.5, aVL: 0 } },
      echo: { 4: 2, 5: 3, 6: 2, 10: 2, 11: 3, 12: 2, 16: 2 },
      teach: ['Inferior STE with II ≥ III, with I and aVL isoelectric or elevated (not depressed).', 'STE in V5–V6 plus posterior STD in V1–V3 means inferolateral and posterior: LCx.', 'Compare the RCA: III > II and STD in I/aVL.'],
      cx: ['Posteromedial papillary muscle rupture (in left dominance the PDA comes from the LCx)', 'Free-wall rupture (lateral/inferolateral)'] },

    { id: 'post', name: 'Isolated posterior', vessel: 'LCx', seg: 'lcx-d', view: 'rao-cau', lesionPos: 0.4, posterior: true,
      ecg: { st: { V1: -2, V2: -3, V3: -2.5, V4: -1, V7: 1, V8: 1.5, V9: 1 } },
      echo: { 5: 3, 11: 3, 4: 2, 10: 2 },
      teach: ['Horizontal STD in V1–V3 with tall, broad R waves (R/S >1 in V2) and upright T waves: STE seen "from the front".', 'Confirm with posterior leads V7–V9: STE ≥0.5 mm (≥1 mm in men <40).', 'This is a STEMI equivalent, usually an LCx/OM or the RCA posterolateral branch. Isolated posterior MI is ~3% of MIs.'],
      cx: ['Missed reperfusion if read as "anterior ischemia"'] },

    { id: 'avr', name: 'Left main / multivessel ischemia (aVR)', vessel: 'LM', seg: 'lm', view: 'lao-cau', lesionPos: 0.5, ischemia: true,
      ecg: { st: { aVR: 2, V1: 1, I: -1.5, II: -2, aVF: -1.5, III: -0.5, aVL: -0.5, V3: -1.5, V4: -2.5, V5: -3, V6: -2.5 } },
      echo: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2 },
      teach: ['STE in aVR ≥1 mm (aVR ≥ V1 is more ominous) with diffuse STD in ≥6 leads (4th UDMI; older documents say ≥8): circumferential subendocardial ischemia.', 'Think LM, proximal LAD or 3-vessel disease, or supply–demand mismatch. Most of these patients do not have an acutely occluded artery, and a true acute LM occlusion usually presents in shock or arrest.', 'Absence of STE in aVR makes significant LM disease unlikely.'],
      cx: ['Cardiogenic shock', 'Often needs urgent angiography and surgical consultation'] },

    { id: 'wellensA', name: 'Wellens type A (biphasic T)', vessel: 'LAD', seg: 'lad-p', view: 'rao-cra', lesionPos: 0.4, special: 'wellensA', sev: 0.9, timi: 3,
      ecg: { st: {} },
      echo: { 8: 2, 14: 2 },
      teach: ['Pain-free tracing after an episode of angina: biphasic T waves (up then down) in V2–V3, ST isoelectric or <1 mm, no Q waves, R-wave progression preserved.', 'Means critical proximal LAD stenosis. A stress test is contraindicated because it can precipitate an anterior MI. Go to angiography.', 'Type A (biphasic) is ~25%; type B (deep symmetric inversion) is ~75%. The labels are reversed in some sources.'],
      cx: ['Extensive anterior MI if not revascularized'] },

    { id: 'wellensB', name: 'Wellens type B (deep T inversion)', vessel: 'LAD', seg: 'lad-p', view: 'rao-cra', lesionPos: 0.4, special: 'wellensB', sev: 0.9, timi: 3,
      ecg: { st: {} },
      echo: { 8: 2, 14: 2 },
      teach: ['Deep, symmetric T-wave inversion in V2–V3, sometimes V1–V6, with the patient pain-free.', 'Same meaning as type A: critical proximal LAD stenosis, often reperfused. Needs angiography, not a stress test.'],
      cx: [] },

    { id: 'dewinter', name: 'de Winter T waves', vessel: 'LAD', seg: 'lad-p', view: 'rao-cra', lesionPos: 0.35, special: 'dewinter',
      ecg: { st: { aVR: 1 } },
      echo: { 1: 2, 2: 2, 7: 3, 8: 3, 13: 3, 14: 3, 16: 2, 17: 3 },
      teach: ['1–3 mm upsloping J-point STD in V1–V6 running into tall, symmetric T waves, with ~1 mm STE in aVR.', 'A STEMI equivalent: acute proximal LAD occlusion (~2% of LAD occlusions). Treat it as a STEMI.'],
      cx: ['As for proximal LAD occlusion'] },
  ];

  CL.data.stemiCriteria = [
    { leads: 'All leads except V2–V3', thr: '≥1 mm new J-point STE in 2 contiguous leads' },
    { leads: 'V2–V3', thr: '≥2 mm men ≥40 y · ≥2.5 mm men <40 y · ≥1.5 mm women' },
    { leads: 'V7–V9 (posterior)', thr: '≥0.5 mm (≥1 mm in men <40)' },
    { leads: 'V3R–V4R (right-sided)', thr: '≥0.5 mm (≥1 mm men <30) per UDMI; classic teaching ≥1 mm' },
    { leads: 'Diffuse STD + aVR', thr: 'STD ≥1 mm in ≥6 leads with STE in aVR and/or V1 suggests LM or multivessel ischemia' },
  ];

  CL.data.segNames = {
    1: 'Basal anterior', 2: 'Basal anteroseptal', 3: 'Basal inferoseptal', 4: 'Basal inferior', 5: 'Basal inferolateral', 6: 'Basal anterolateral',
    7: 'Mid anterior', 8: 'Mid anteroseptal', 9: 'Mid inferoseptal', 10: 'Mid inferior', 11: 'Mid inferolateral', 12: 'Mid anterolateral',
    13: 'Apical anterior', 14: 'Apical septal', 15: 'Apical inferior', 16: 'Apical lateral', 17: 'Apex',
  };
  CL.data.segTerritory = { 1: 'LAD', 2: 'LAD', 7: 'LAD', 8: 'LAD', 13: 'LAD', 14: 'LAD', 17: 'LAD', 3: 'RCA', 4: 'RCA', 9: 'RCA', 10: 'RCA', 15: 'RCA', 5: 'LCx', 6: 'LCx', 11: 'LCx', 12: 'LCx', 16: 'LCx' };

  CL.data.mechanicalCx = [
    { cx: 'Papillary muscle rupture', terr: 'Inferior/posterior MI. The posteromedial muscle has a single (PDA) supply and ruptures 3–12× more often than the anterolateral (dual D1 + OM supply).', echo: 'Flail leaflet, severe eccentric MR; often a small infarct. Day 2–7.' },
    { cx: 'Ventricular septal rupture', terr: 'Anterior MI: apical septum (simple). Inferior MI: basal inferoseptum (complex, serpiginous, RV involved).', echo: 'Left-to-right color jet, new harsh murmur, step-up in O₂ saturation. Days 2–8.' },
    { cx: 'Free-wall rupture', terr: 'Transmural MI, often lateral or inferolateral; the elderly and first MI.', echo: 'Pericardial effusion and tamponade; pseudoaneurysm if contained. ~50% within 5 days.' },
    { cx: 'True LV aneurysm', terr: '~85% apical/anteroseptal (LAD).', echo: 'Wide neck, all wall layers, dyskinetic; persistent STE weeks later.' },
    { cx: 'LV pseudoaneurysm', terr: 'Contained rupture, classically inferior/posterolateral.', echo: 'Narrow neck relative to the sac (contained by pericardium); high rupture risk.' },
    { cx: 'LV thrombus', terr: 'Anterior STEMI with apical akinesis (~9% of anterior STEMI).', echo: 'Mass in an akinetic apex; contrast echo or CMR if windows are poor.' },
    { cx: 'RV infarction', terr: 'Proximal RCA, before the RV branches; ~40% of inferior STEMIs.', echo: 'RV dilation, free-wall hypokinesis, low TAPSE. McConnell’s sign is not specific to PE.' },
  ];

  CL.data.territoryRefs = [
    { t: 'Fourth Universal Definition of MI (Thygesen et al., Circulation 2018)', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000617' },
    { t: 'Fifth Universal Definition of MI (2026) — check its updated ECG thresholds', url: 'https://www.jacc.org/doi/10.1016/j.jacc.2026.07.025' },
    { t: 'Engelen et al. ECG localization of LAD occlusion. JACC 1999', url: 'https://pubmed.ncbi.nlm.nih.gov/10440150/' },
    { t: 'LITFL ECG library: inferior, high lateral, posterior, RV infarction, Wellens, de Winter, aVR', url: 'https://litfl.com/inferior-stemi-ecg-library/' },
    { t: 'StatPearls: Inferior MI; Posterior MI; Lateral MI', url: 'https://www.ncbi.nlm.nih.gov/books/NBK470572/' },
    { t: 'Cerqueira et al. Standardized myocardial segmentation (AHA 17-segment). Circulation 2002', url: 'https://www.ahajournals.org/doi/10.1161/hc0402.102975' },
    { t: 'Lang et al. ASE/EACVI chamber quantification 2015', url: 'https://www.asecho.org/wp-content/uploads/2015/01/ChamberQuantification2015.pdf' },
    { t: 'StatPearls: Papillary muscle rupture; Ventricular septal rupture', url: 'https://www.ncbi.nlm.nih.gov/books/NBK499976/' },
  ];
})();
