/* CICU reference tables: shock profiles, SCAI stages, vasoactive drugs, mechanical support. */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};
  CL.data.cicuRef = {
    profiles: [
      ['Cardiogenic (LV)', '↑', '↑↑', '↓↓', '↑', 'Cold and wet. PCWP >15–18 mmHg, CI <2.2 (or <1.8 without support)'],
      ['RV-dominant (RV infarct)', '↑↑', 'N or ↓', '↓', '↑', 'RA:PCWP >0.8, PAPi <0.9, clear lungs with high JVP'],
      ['Hypovolemic', '↓', '↓', '↓', '↑', 'Flat IVC; responds to volume'],
      ['Distributive / vasoplegic', 'N or ↓', 'N or ↓', 'N or ↑', '↓↓', 'Warm extremities; may coexist with cardiogenic shock (mixed)'],
      ['Tamponade', '↑', '↑ (≈ RA)', '↓', '↑', 'Equalized diastolic pressures, pulsus paradoxus >10 mmHg, RA collapse (late diastole to early systole), RV collapse (early diastole), plethoric IVC'],
      ['Massive PE', '↑↑', 'N or ↓', '↓', '↑', 'Dilated RV, septal flattening; PA systolic often only ~40s'],
    ],
    scai: [
      ['A · At risk', 'No signs of shock, but at risk (e.g. large acute MI, acute HF).'],
      ['B · Beginning', 'Hypotension or tachycardia without hypoperfusion.'],
      ['C · Classic', 'Hypoperfusion needing intervention beyond volume: a vasopressor, an inotrope or MCS. Lactate is typically ≥2.'],
      ['D · Deteriorating', 'Initial interventions fail to restore stability or perfusion despite ≥30 minutes of treatment.'],
      ['E · Extremis', 'Cardiac arrest with ongoing CPR or ECMO, or refractory collapse on multiple supports.'],
    ],
    vasoactives: [
      ['Norepinephrine', 'α1 ≫ β1', '0.01–0.5 µg/kg/min (higher in refractory shock)', 'First-line vasopressor in cardiogenic shock', 'Raises afterload; ischemia; extravasation'],
      ['Epinephrine', 'β1, β2, α1', '0.01–0.5 µg/kg/min', 'Refractory shock, post-arrest', 'Tachyarrhythmia, lactate rise. More refractory shock than norepinephrine in AMI shock (OptimaMI)'],
      ['Dopamine', 'D1 → β1 → α (dose-dependent)', '2–20 µg/kg/min', 'Largely abandoned in shock', 'Twice the arrhythmias of norepinephrine (SOAP II); a mortality signal in the cardiogenic shock subgroup (exploratory)'],
      ['Dobutamine', 'β1 > β2 (mild α1)', '2.5–10 (up to 20) µg/kg/min', 'Low output once MAP is acceptable', 'Hypotension (vasodilation), tachyarrhythmia, ↑ MVO₂'],
      ['Milrinone', 'PDE-3 inhibitor', '0.125–0.75 µg/kg/min', 'Low output, beta-blocked patients, high PVR', 'Hypotension; renally cleared, so reduce in CKD; long half-life'],
      ['Vasopressin', 'V1', '0.03–0.04 U/min', 'Catecholamine-sparing second agent (vasoplegia)', 'Digital or mesenteric ischemia'],
      ['Phenylephrine', 'α1', '0.5–5 µg/kg/min', 'Hypotension with fixed obstruction (AS, LVOT obstruction)', 'Lowers CO in LV failure; reflex bradycardia'],
      ['Nitroprusside', 'NO donor (arterial + venous)', 'Start 0.3–0.5 µg/kg/min, titrate', 'Acute MR or AR, VSR, decompensated severe AS with low CI (arterial line, MAP ≥60–65)', 'Hypotension; cyanide/thiocyanate with high dose, long use or renal failure'],
    ],
    mcs: [
      ['IABP', '≈0.5 L/min', 'Inflates in diastole (↑ coronary perfusion), deflates before systole (↓ afterload)', 'IABP-SHOCK II: no 30-day mortality benefit (39.7% vs 41.3%). Routine use is rated 3: No Benefit (2025 ACC/AHA ACS). Still a useful bridge for acute MR and VSR.', 'Contraindicated in significant AR and aortic dissection; needs a stable rhythm'],
      ['Impella CP (microaxial)', '≈3.5–4 L/min', 'Pulls blood from the LV into the aorta and unloads the LV', 'DanGer Shock: lower 180-day death in selected STEMI shock (45.8% vs 58.5%). Rated 2a in the 2025 ACC/AHA ACS guideline', 'Bleeding, limb ischemia, hemolysis, kidney injury. Excluded: comatose OHCA, RV failure. Not with LV thrombus or a mechanical aortic valve'],
      ['Impella 5.5', '≈5.5 L/min', 'Surgical axillary microaxial pump', 'Longer support and bridge to decision', 'Surgical access; hemolysis'],
      ['VA-ECMO', '4–6 L/min + gas exchange', 'Venous drainage → oxygenator → arterial return', 'ECLS-SHOCK: no 30-day mortality benefit (47.8% vs 49.0%); more bleeding and vascular complications. Routine use is rated 3: No Benefit', 'Raises LV afterload (LV distension, pulmonary edema; may need venting); limb ischemia, stroke'],
      ['RV support (Impella RP, ProtekDuo)', '≈3–4 L/min', 'RA/IVC → PA bypass of the failing RV', 'Observational data in RV infarct and post-LVAD RV failure', 'Anticoagulation, hemolysis, positioning'],
    ],
    refs: [
      { t: 'van Diepen S et al. Contemporary management of cardiogenic shock (AHA scientific statement). Circulation 2017', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000525' },
      { t: 'SCAI SHOCK stage classification expert consensus update (2022)', url: 'https://www.jscai.org/article/S2772-9303(21)00182-6/fulltext' },
      { t: 'Møller JE et al. DanGer Shock: microaxial flow pump in STEMI cardiogenic shock. NEJM 2024', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2312572' },
      { t: 'Thiele H et al. IABP-SHOCK II. NEJM 2012', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1208410' },
      { t: 'Thiele H et al. ECLS-SHOCK. NEJM 2023', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2307227' },
      { t: 'De Backer D et al. SOAP II: dopamine vs norepinephrine. NEJM 2010', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa0907118' },
      { t: 'Mathew R et al. DOREMI: milrinone vs dobutamine. NEJM 2021', url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2026845' },
    ],
  };
})();
