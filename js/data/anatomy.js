/* Coronary segment reference data.
   Segment numbers follow the SYNTAX score / modified AHA classification (Sianos et al., EuroIntervention 2005). */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};

  const S = {};
  function seg(id, o) { S[id] = Object.assign({ id }, o); }

  /* ---------------- LEFT MAIN ---------------- */
  seg('lm', {
    name: 'Left main (LM)', label: 'LM', syntax: '5', vessel: 'LM', tree: 'L',
    def: 'From the left coronary ostium in the left aortic sinus to its bifurcation into the LAD and LCx (or trifurcation when a ramus intermedius is present). Usually 5–15 mm long and 4–5 mm wide. Described as ostial, body (shaft) and distal/bifurcation.',
    supplies: 'Through the LAD and LCx, most of the LV: about 75% in a right-dominant heart and essentially all of it in a left-dominant heart.',
    ecg: 'Severe LM ischemia is subendocardial and diffuse: ST elevation in aVR (often aVR ≥ V1) with ST depression in ≥6 leads. Acute total LM occlusion usually presents as cardiogenic shock or arrest.',
    views: ['AP (0°/0°) or shallow LAO/RAO for the ostium and body', 'LAO caudal "spider" for the distal LM and bifurcation', 'RAO caudal and AP caudal for the body and bifurcation'],
    pearls: [
      'Pressure damping or "ventricularization" when you engage suggests ostial LM disease or a catheter against the wall. Disengage before injecting.',
      'Angiographically significant LM disease is ≥50% diameter stenosis (≥70% elsewhere).',
      'IVUS MLA <6 mm² suggests a physiologically significant LM in Western patients (≈4.5–4.8 mm² in Asian cohorts).',
      'A short LM, or separate LAD and LCx ostia, makes the injection selective into one branch. Do not mistake that for an occluded vessel.',
    ],
  });

  /* ---------------- LAD ---------------- */
  seg('lad-p', {
    name: 'Proximal LAD', label: 'pLAD', syntax: '6', vessel: 'LAD', tree: 'L',
    def: 'From the LM bifurcation to and including the origin of the first major septal perforator (SYNTAX). Some schemes (CASS/ACC) end it at the first major septal or first diagonal, whichever comes first.',
    supplies: 'Anterior wall, anterior two-thirds of the septum (including the basal septum and conduction system through S1) and the apex. This is the largest single territory.',
    ecg: 'ST elevation in V1–V4. Occlusion before S1 adds STE in aVR, STE in V1 >2.5 mm or a new RBBB. Occlusion before D1 adds STE in I and aVL with reciprocal inferior ST depression.',
    views: ['LAO cranial', 'RAO cranial', 'AP cranial', 'LAO caudal or RAO caudal for the ostium'],
    pearls: [
      'A proximal LAD occlusion is the "widowmaker" territory.',
      'Wellens T waves (V2–V3, pain-free) and de Winter T waves mean critical proximal LAD disease or an occlusion equivalent.',
      'New RBBB or LAFB in an anterior MI points to septal perforator involvement and a large infarct.',
    ],
  });
  seg('lad-m', {
    name: 'Mid LAD', label: 'mLAD', syntax: '7', vessel: 'LAD', tree: 'L',
    def: 'From just past the first septal perforator to the point where the LAD forms an angle in the RAO view. If no angle is seen, it ends halfway between the first septal and the apex.',
    supplies: 'Mid and apical anterior wall and anteroseptum, and usually the apex.',
    ecg: 'STE in V2–V5 without STE in I/aVL, because D1 is spared. aVL may show reciprocal depression.',
    views: ['RAO cranial', 'AP cranial', 'LAO cranial'],
    pearls: ['The mid LAD is the usual LIMA anastomosis site. The LIMA–LAD anastomosis is often best seen in the lateral view.', 'Myocardial bridging is most common here: the vessel narrows in systole and opens in diastole.'],
  });
  seg('lad-d', {
    name: 'Distal (apical) LAD', label: 'dLAD', syntax: '8', vessel: 'LAD', tree: 'L',
    def: 'The terminal LAD, from the end of the mid segment to the apex and beyond.',
    supplies: 'Apex. A "wraparound" LAD also supplies the inferior apex.',
    ecg: 'STE in V3–V6. A wraparound LAD gives anterior plus inferior STE without inferior reciprocal depression and can mimic multivessel disease.',
    views: ['RAO cranial', 'Lateral (LAO 90°)', 'AP cranial'],
    pearls: ['Apical akinesis after an LAD infarct is the classic setting for LV thrombus.'],
  });
  seg('d1', {
    name: 'First diagonal (D1)', label: 'D1', syntax: '9', vessel: 'LAD', tree: 'L',
    def: 'The first diagonal branch, coursing from the LAD over the anterolateral LV wall. 9a is an accessory first diagonal.',
    supplies: 'Anterolateral wall. Shares the anterolateral papillary muscle with the OMs (dual supply).',
    ecg: 'High lateral STEMI: STE in I, aVL and V2 with reciprocal STD in III (the "South African flag" pattern).',
    views: ['LAO cranial (best for separating diagonal origins)', 'RAO cranial', 'AP cranial'],
    pearls: ['The LAD/D1 bifurcation is the most common true bifurcation treated with PCI. Classify it with Medina.'],
  });
  seg('d2', {
    name: 'Second diagonal (D2)', label: 'D2', syntax: '10', vessel: 'LAD', tree: 'L',
    def: 'The second diagonal branch of the LAD. 10a is an accessory second diagonal.',
    supplies: 'Anterolateral and apical lateral wall.',
    ecg: 'Lateral precordial changes. Small diagonal occlusions may give subtle or no STE.',
    views: ['LAO cranial', 'RAO cranial'],
    pearls: ['SYNTAX scores a side branch only if it is ≥1.5 mm.'],
  });
  seg('sept', {
    name: 'Septal perforators', label: 'S1', syntax: '—', vessel: 'LAD', tree: 'L',
    def: 'Branches leaving the LAD at roughly right angles and diving into the interventricular septum. The first major septal (S1) is the proximal/mid LAD landmark.',
    supplies: 'Anterior two-thirds of the septum, the right bundle branch and the left anterior fascicle.',
    ecg: 'Septal STE (V1–V2). Conduction defects: new RBBB, LAFB or bifascicular block with proximal LAD occlusion.',
    views: ['RAO cranial and RAO caudal (septals run downward toward the inferior wall)', 'AP cranial'],
    pearls: ['S1 is the target for alcohol septal ablation in obstructive HCM.', 'Septals are the main collateral route between the LAD and PDA in CTO PCI.'],
  });

  /* ---------------- LCx ---------------- */
  seg('lcx-p', {
    name: 'Proximal circumflex', label: 'pLCx', syntax: '11', vessel: 'LCx', tree: 'L',
    def: 'The main stem of the circumflex from its origin at the LM to and including the origin of the first obtuse marginal.',
    supplies: 'Lateral wall (through the OMs), the inferolateral wall when large, and the SA node in about 40% of hearts.',
    ecg: 'Lateral STE (I, aVL, V5–V6) and/or posterior changes (STD V1–V3 with tall R). Often "electrically silent": ECG changes can be absent with an LCx occlusion.',
    views: ['RAO caudal', 'AP caudal', 'LAO caudal (spider)'],
    pearls: ['Of all NSTEMIs that turn out to be occlusions, the LCx is the most commonly missed artery. Get posterior leads V7–V9.'],
  });
  seg('lcx-d', {
    name: 'Distal circumflex', label: 'dLCx', syntax: '13', vessel: 'LCx', tree: 'L',
    def: 'The circumflex distal to the obtuse marginal(s), running in the posterior left AV groove. In SYNTAX, segment 13 is the stem beyond the most distal OM. It may be small or absent in a right-dominant heart.',
    supplies: 'Inferolateral wall. In a left-dominant heart it continues to the crux and gives the PDA (15) and posterolateral branches (14).',
    ecg: 'Inferolateral or posterior pattern. In left dominance, an inferior STEMI with II ≥ III and STE in V5–V6.',
    views: ['RAO caudal', 'AP caudal', 'LAO caudal'],
    pearls: ['In a left-dominant system the RCA is small. Do not mistake a small, non-dominant RCA for an occluded one.'],
  });
  seg('om1', {
    name: 'First obtuse marginal (OM1)', label: 'OM1', syntax: '12a', vessel: 'LCx', tree: 'L',
    def: 'The first marginal branch of the LCx, coursing over the obtuse (lateral) margin of the heart toward the apex.',
    supplies: 'Lateral wall and the anterolateral papillary muscle, shared with D1.',
    ecg: 'Lateral STE (I, aVL, V5–V6). An OM can produce a high-lateral pattern.',
    views: ['RAO caudal', 'AP caudal', 'LAO caudal'],
    pearls: ['OM bifurcations are often best opened up in the RAO caudal view.'],
  });
  seg('om2', {
    name: 'Second obtuse marginal (OM2)', label: 'OM2', syntax: '12b', vessel: 'LCx', tree: 'L',
    def: 'The second marginal branch of the LCx.',
    supplies: 'Lateral and inferolateral wall.',
    ecg: 'Lateral or posterolateral pattern.',
    views: ['RAO caudal', 'AP caudal'],
    pearls: [],
  });
  seg('ramus', {
    name: 'Ramus intermedius', label: 'Ramus', syntax: '12', vessel: 'Ramus', tree: 'L',
    def: 'An intermediate branch arising from a trifurcating LM between the LAD and LCx. Present in roughly 15–30% of hearts. SYNTAX segment 12 is the "intermediate/anterolateral" artery.',
    supplies: 'Anterolateral or lateral wall, like a high diagonal or a high OM.',
    ecg: 'High-lateral or lateral pattern.',
    views: ['RAO caudal', 'LAO caudal (spider)', 'AP cranial'],
    pearls: ['A trifurcation makes LM PCI more complex. Ostial ramus disease is a common reason for a two-stent LM strategy.'],
  });
  seg('lpda', {
    name: 'Left PDA', label: 'L-PDA', syntax: '15', vessel: 'LCx', tree: 'L',
    def: 'The posterior descending artery arising from the LCx in a left-dominant circulation.',
    supplies: 'Inferior wall, the inferior third of the septum and the posteromedial papillary muscle.',
    ecg: 'Inferior STE, usually with II ≥ III and lateral involvement.',
    views: ['RAO caudal', 'LAO caudal', 'AP cranial'],
    pearls: ['In left dominance an LM or LCx occlusion threatens the whole LV, including the inferior wall.'],
  });
  seg('lpl', {
    name: 'Left posterolateral', label: 'L-PL', syntax: '14', vessel: 'LCx', tree: 'L',
    def: 'Posterolateral branch(es) of the distal circumflex running toward the inferolateral wall (14, 14a, 14b).',
    supplies: 'Inferolateral (posterior) wall.',
    ecg: 'Posterior pattern: STD V1–V3, tall R in V1–V2, STE in V7–V9.',
    views: ['RAO caudal', 'AP caudal'],
    pearls: [],
  });

  /* ---------------- RCA ---------------- */
  seg('rca-p', {
    name: 'Proximal RCA', label: 'pRCA', syntax: '1', vessel: 'RCA', tree: 'R',
    def: 'From the RCA ostium in the right (anterior) aortic sinus to halfway between the ostium and the acute margin of the heart.',
    supplies: 'RV free wall (through RV branches downstream), the SA node in about 60% of hearts, and the conus/RVOT. In a right-dominant heart, everything downstream as well.',
    ecg: 'Inferior STE (III > II) plus RV infarction: STE in V4R (≥1 mm classic; ≥0.5 mm in the UDMI) and STE in V1, with V1 STE plus V2 STD especially specific.',
    views: ['LAO 30–45° (ostium and proximal RCA, the "C" shape)', 'RAO 30°', 'LAO cranial'],
    pearls: [
      'Proximal RCA occlusion before the RV branches causes RV infarction. These patients are preload-dependent, so avoid nitrates and give fluids for hypotension.',
      'RCA ostial disease or catheter-induced spasm is common. Watch for damping, and give IC nitroglycerin to sort out spasm.',
    ],
  });
  seg('rca-m', {
    name: 'Mid RCA', label: 'mRCA', syntax: '2', vessel: 'RCA', tree: 'R',
    def: 'From the end of segment 1 to the acute margin of the heart.',
    supplies: 'RV free wall through the RV (acute) marginal branches, plus the distal territory.',
    ecg: 'Inferior STE. RV involvement depends on whether the RV branches are proximal or distal to the occlusion.',
    views: ['LAO 30–45°', 'RAO 30° (mid RCA laid out, the "L" shape)', 'Lateral'],
    pearls: ['The mid RCA moves a lot with each beat, which blurs images. Use higher frame rates.'],
  });
  seg('rca-d', {
    name: 'Distal RCA', label: 'dRCA', syntax: '3', vessel: 'RCA', tree: 'R',
    def: 'From the acute margin to the origin of the PDA at the crux.',
    supplies: 'Inferior wall and, beyond the crux, the AV node (AV nodal artery) and the inferolateral wall.',
    ecg: 'Inferior STE (II, III, aVF; III > II), reciprocal STD in aVL > I. AV block is common because the AV nodal artery arises at the crux.',
    views: ['LAO cranial', 'AP cranial', 'RAO'],
    pearls: ['The crux (distal RCA bifurcation into PDA and PL) opens up best with cranial angulation.'],
  });
  seg('pda', {
    name: 'Posterior descending (PDA)', label: 'PDA', syntax: '4', vessel: 'RCA', tree: 'R',
    def: 'Runs in the posterior interventricular groove toward the apex and gives inferior septal perforators. Arises from the RCA in a right-dominant heart.',
    supplies: 'Inferior wall, the inferior (posterior) third of the septum and the posteromedial papillary muscle, which has a single blood supply.',
    ecg: 'Inferior STE.',
    views: ['RAO 30° (PDA along the inferior septum)', 'LAO cranial', 'AP cranial'],
    pearls: ['Posteromedial papillary muscle rupture (acute severe MR) is a complication of inferior MI because this muscle depends on the PDA alone.'],
  });
  seg('rpl', {
    name: 'Right posterolateral (RPL / PLV)', label: 'PLV', syntax: '16', vessel: 'RCA', tree: 'R',
    def: 'The RCA continuation beyond the crux toward the inferolateral LV, giving posterolateral branches (16a–c). Only present in right-dominant or codominant hearts.',
    supplies: 'Inferolateral (posterior) LV wall.',
    ecg: 'Posterior extension: STD V1–V3 and STE in V7–V9.',
    views: ['LAO cranial', 'AP cranial'],
    pearls: [],
  });
  seg('conus', {
    name: 'Conus branch', label: 'Conus', syntax: '—', vessel: 'RCA', tree: 'R',
    def: 'Usually the first RCA branch. It wraps the RV outflow tract and arises from a separate ostium in about a third of hearts.',
    supplies: 'RV outflow tract (infundibulum).',
    ecg: '—',
    views: ['LAO', 'RAO'],
    pearls: ['A separate conus ostium can be mistaken for the RCA. A small vessel heading toward the RVOT is the conus.', 'An important collateral source to the LAD (Vieussens ring).'],
  });
  seg('sanode', {
    name: 'SA nodal artery', label: 'SA nodal', syntax: '—', vessel: 'RCA', tree: 'R',
    def: 'Runs up and back toward the SVC–right atrial junction. Arises from the proximal RCA in about 60% of hearts and from the proximal LCx in about 40%.',
    supplies: 'Sinus node and right atrium.',
    ecg: 'Sinus bradycardia or sinus arrest in inferior MI.',
    views: ['LAO', 'RAO'],
    pearls: [],
  });
  seg('rvb', {
    name: 'RV (acute marginal) branches', label: 'RV br', syntax: '—', vessel: 'RCA', tree: 'R',
    def: 'Branches of the proximal and mid RCA crossing the RV free wall. The acute marginal runs along the acute (inferior-right) margin.',
    supplies: 'RV free wall.',
    ecg: 'An occlusion proximal to these causes RV infarction (STE in V4R and V1).',
    views: ['RAO', 'LAO'],
    pearls: [],
  });
  seg('avn', {
    name: 'AV nodal artery', label: 'AVN', syntax: '—', vessel: 'RCA', tree: 'R',
    def: 'A small branch rising from the dominant artery at the crux. From the RCA in about 80–90% of hearts.',
    supplies: 'AV node and proximal His bundle.',
    ecg: 'AV-nodal block (Wenckebach or complete block with a narrow escape) in inferior MI. Usually transient.',
    views: ['LAO cranial'],
    pearls: [],
  });

  CL.data.segments = S;

  CL.data.vesselColor = { LM: 'lm', LAD: 'lad', LCx: 'lcx', RCA: 'rca', Ramus: 'ramus' };

  CL.data.dominance = {
    right: { label: 'Right dominant', prevalence: '≈70–85%', text: 'The RCA gives the PDA and posterolateral branches, so it supplies the inferior wall, the inferior septum and usually the AV node.' },
    left: { label: 'Left dominant', prevalence: '≈5–10%', text: 'The LCx continues to the crux and gives the PDA and posterolateral branches. The RCA is small and supplies mainly the RV.' },
    co: { label: 'Codominant', prevalence: '≈5–10%', text: 'The RCA gives the PDA and the LCx gives the posterolateral branches, or both contribute to the inferior wall.' },
  };

  CL.data.glossary = [
    { term: 'Ostium', def: 'The mouth or origin of a vessel. Aorto-ostial: the LM and RCA from the aortic sinuses (and SVGs from the aorta). Branch-ostial: the origin of a branch from its parent, such as LAD, LCx, D1 or OM. An ostial lesion lies within 3 mm of the origin.' },
    { term: 'Proximal / mid / distal', def: 'Defined by landmarks, not by thirds. LAD: S1 (and, in some schemes, D1) ends the proximal segment. RCA: the acute margin. LCx: OM1. Exact SYNTAX definitions are in each segment card.' },
    { term: 'Dominance', def: 'The dominant artery gives the PDA and the posterolateral branch, so it supplies the inferior wall. Right ≈70–85%, left ≈5–10%, codominant ≈5–10%.' },
    { term: 'Bifurcation lesion', def: 'A stenosis next to and/or involving the origin of a significant side branch (one you do not want to lose). SYNTAX scores side branches ≥1.5 mm; the EBC practical threshold is ≈2 mm.' },
    { term: 'Significant stenosis', def: 'Visual ≥70% diameter stenosis (≥50% for the LM). Use physiology (FFR/iFR) for intermediate lesions, roughly 40–90%.' },
    { term: 'Tandem / serial lesions', def: 'Two or more stenoses in the same vessel. They interact hemodynamically, so assess them with a pressure-wire pullback.' },
    { term: 'Diffuse disease', def: 'In SYNTAX, more than 75% of the segment length has vessel diameter <2 mm. Lesions >20 mm long score as "long lesions".' },
    { term: 'CTO', def: 'Chronic total occlusion: TIMI 0 flow with an estimated duration of ≥3 months.' },
    { term: 'Acute / obtuse margin', def: 'Acute margin: the sharp inferior-right border of the RV and the landmark between the mid and distal RCA. Obtuse margin: the rounded lateral LV border, crossed by the OMs.' },
    { term: 'Crux', def: 'The point on the diaphragmatic surface where the AV groove meets the posterior interventricular groove. The dominant artery gives the PDA, PL and AV nodal branches here.' },
  ];
})();
