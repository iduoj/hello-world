/*
 * ValvEcho — grading logic for native valvular heart disease by echocardiography.
 *
 * Thresholds follow:
 *  - ASE 2017 Recommendations for Noninvasive Evaluation of Native Valvular Regurgitation (Zoghbi et al.)
 *  - ASE/EACVI 2017 Focused Update on Echocardiographic Assessment of Aortic Valve Stenosis (Baumgartner et al.)
 *  - EAE/ASE 2009 Recommendations on Valve Stenosis (mitral stenosis)
 *  - 2020 ACC/AHA Guideline for the Management of Valvular Heart Disease (staging)
 *  - Hahn & Zamorano 2017 proposed "massive"/"torrential" TR grades
 *
 * Pure functions only; works in the browser (window.ValveLogic) and in Node (module.exports).
 * Decision support only — not a substitute for clinical judgement.
 */
(function (root) {
  'use strict';

  const GRADE_NAMES = ['None/trace', 'Mild', 'Moderate', 'Severe', 'Massive', 'Torrential'];

  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    const n = typeof x === 'string' ? parseFloat(x) : x;
    return Number.isFinite(n) ? n : null;
  }

  function round(x, dp) {
    if (x === null || !Number.isFinite(x)) return null;
    const f = Math.pow(10, dp);
    return Math.round(x * f) / f;
  }

  // ---------------------------------------------------------------------------
  // Calculators
  // ---------------------------------------------------------------------------

  /** Body surface area (Mosteller), m². */
  function bsaMosteller(heightCm, weightKg) {
    const h = num(heightCm), w = num(weightKg);
    if (!h || !w || h <= 0 || w <= 0) return null;
    return Math.sqrt((h * w) / 3600);
  }

  /** Circular cross-sectional area from diameter (cm) → cm². */
  function circleArea(diameterCm) {
    const d = num(diameterCm);
    if (!d || d <= 0) return null;
    return Math.PI * Math.pow(d / 2, 2);
  }

  /** Stroke volume (mL) = CSA × VTI (cm). */
  function strokeVolume(diameterCm, vtiCm) {
    const a = circleArea(diameterCm), v = num(vtiCm);
    if (a === null || !v || v <= 0) return null;
    return a * v;
  }

  /** Continuity-equation AVA (cm²) using VTIs. */
  function continuityAVA(lvotDiameterCm, lvotVtiCm, avVtiCm) {
    const sv = strokeVolume(lvotDiameterCm, lvotVtiCm), av = num(avVtiCm);
    if (sv === null || !av || av <= 0) return null;
    return sv / av;
  }

  /** Dimensionless index (velocity ratio) — LVOT / AV, VTI or Vmax. */
  function dimensionlessIndex(lvot, av) {
    const l = num(lvot), a = num(av);
    if (!l || !a || a <= 0) return null;
    return l / a;
  }

  /** Simplified Bernoulli peak gradient (mmHg) from velocity (m/s). */
  function bernoulli(vMs) {
    const v = num(vMs);
    if (v === null || v < 0) return null;
    return 4 * v * v;
  }

  /**
   * PISA EROA (cm²) = 2πr² × Va / Vmax.
   * radius in cm; aliasing velocity and peak regurgitant velocity in cm/s.
   */
  function pisaEROA(radiusCm, aliasCmS, peakCmS) {
    const r = num(radiusCm), va = num(aliasCmS), vm = num(peakCmS);
    if (!r || !va || !vm || r <= 0 || va <= 0 || vm <= 0) return null;
    return (2 * Math.PI * r * r * va) / vm;
  }

  /** Regurgitant volume (mL) = EROA (cm²) × regurgitant jet VTI (cm). */
  function regurgVolumeFromEROA(eroa, vtiCm) {
    const e = num(eroa), v = num(vtiCm);
    if (!e || !v || e <= 0 || v <= 0) return null;
    return e * v;
  }

  /** Regurgitant fraction (%) = RVol / total stroke volume across the leaking valve. */
  function regurgFraction(rvol, totalSV) {
    const r = num(rvol), t = num(totalSV);
    if (r === null || !t || t <= 0 || r < 0) return null;
    return (r / t) * 100;
  }

  /** Mitral valve area (cm²) from pressure half-time (ms): 220 / PHT. */
  function mvaFromPHT(phtMs) {
    const p = num(phtMs);
    if (!p || p <= 0) return null;
    return 220 / p;
  }

  /** PASP (mmHg) = 4·TRVmax² + RAP. */
  function pasp(trVmaxMs, rapMmHg) {
    const g = bernoulli(trVmaxMs), r = num(rapMmHg);
    if (g === null) return null;
    return g + (r === null ? 0 : r);
  }

  // ---------------------------------------------------------------------------
  // Regurgitant lesions — parameter definitions
  // ---------------------------------------------------------------------------
  // Numeric parameter: grade = 1 + number of `cuts` the value meets or exceeds
  // (or, with `inverse`, the number of cuts the value falls below).
  // `kind`: 'quant' (EROA/RVol/RF — weighted highest), 'semi' (VC, jet ratio, PHT, PISA r),
  // 'support' (qualitative/supportive signs).
  // Select parameter options carry `grade` (null = non-diagnostic) and `specific: true`
  // when the finding is a specific sign for that grade.

  const MR_PARAMS = [
    { key: 'vc', label: 'Vena contracta width', unit: 'cm', kind: 'semi', cuts: [0.3, 0.7], step: 0.01,
      hint: 'Mild <0.3 · Moderate 0.3–0.69 · Severe ≥0.7' },
    { key: 'eroa', label: 'EROA (PISA)', unit: 'cm²', kind: 'quant', cuts: [0.2, 0.4], sub: 0.3, step: 0.01,
      hint: 'Mild <0.20 · Moderate 0.20–0.39 · Severe ≥0.40' },
    { key: 'rvol', label: 'Regurgitant volume', unit: 'mL', kind: 'quant', cuts: [30, 60], sub: 45, step: 1,
      hint: 'Mild <30 · Moderate 30–59 · Severe ≥60' },
    { key: 'rf', label: 'Regurgitant fraction', unit: '%', kind: 'quant', cuts: [30, 50], sub: 40, step: 1,
      hint: 'Mild <30 · Moderate 30–49 · Severe ≥50' },
    { key: 'morph', label: 'Mitral valve morphology', type: 'select', kind: 'support', options: [
      { value: 'normal', label: 'Normal / mildly abnormal leaflets', grade: 1 },
      { value: 'moderate', label: 'Moderately abnormal leaflets / moderate tenting', grade: 2 },
      { value: 'flail', label: 'Flail leaflet, ruptured papillary muscle, large coaptation defect', grade: 3, specific: true },
    ] },
    { key: 'jet', label: 'Color flow jet', type: 'select', kind: 'support', options: [
      { value: 'small', label: 'Small, central, narrow, brief', grade: 1, specific: true },
      { value: 'variable', label: 'Variable / intermediate', grade: 2 },
      { value: 'large', label: 'Large central (>50% LA) or eccentric wall-impinging, swirling', grade: 3, specific: true },
    ] },
    { key: 'flow', label: 'Flow convergence (Nyquist 30–40 cm/s)', type: 'select', kind: 'support', options: [
      { value: 'none', label: 'Not visible, transient or small', grade: 1 },
      { value: 'intermediate', label: 'Intermediate size and duration', grade: 2 },
      { value: 'large', label: 'Large throughout systole', grade: 3 },
    ] },
    { key: 'cw', label: 'CW Doppler jet', type: 'select', kind: 'support', options: [
      { value: 'faint', label: 'Faint / partial / parabolic', grade: 1 },
      { value: 'dense', label: 'Dense, parabolic', grade: 2 },
      { value: 'triangular', label: 'Holosystolic, dense, triangular', grade: 3 },
    ] },
    { key: 'pv', label: 'Pulmonary vein flow', type: 'select', kind: 'support', options: [
      { value: 'sdom', label: 'Systolic dominance (may be blunted in LV dysfunction/AF)', grade: 1 },
      { value: 'blunted', label: 'Systolic blunting', grade: 2 },
      { value: 'reversal', label: 'Systolic flow reversal', grade: 3, specific: true },
    ] },
    { key: 'inflow', label: 'Mitral inflow', type: 'select', kind: 'support', options: [
      { value: 'adom', label: 'A-wave dominant', grade: 1 },
      { value: 'variable', label: 'Variable', grade: null },
      { value: 'edom', label: 'E-wave dominant (E >1.2 m/s)', grade: 3 },
    ] },
    { key: 'chambers', label: 'LA / LV size', type: 'select', kind: 'support', options: [
      { value: 'normal', label: 'Normal LV and LA size', grade: 1 },
      { value: 'normal-dilated', label: 'Normal or mildly dilated', grade: 2 },
      { value: 'dilated', label: 'Dilated (no other cause)', grade: 3 },
    ] },
  ];

  const AR_PARAMS = [
    { key: 'vc', label: 'Vena contracta width', unit: 'cm', kind: 'semi', cuts: [0.3, 0.6], strictTop: true, step: 0.01,
      hint: 'Mild <0.3 · Moderate 0.3–0.6 · Severe >0.6' },
    { key: 'jetRatio', label: 'Jet width / LVOT width', unit: '%', kind: 'semi', cuts: [25, 65], step: 1,
      hint: 'Mild <25 · Moderate 25–64 · Severe ≥65 (central jets)' },
    { key: 'pht', label: 'Pressure half-time', unit: 'ms', kind: 'semi', inverse: true, cuts: [500, 200], step: 1,
      hint: 'Mild >500 · Moderate 200–500 · Severe <200' },
    { key: 'eroa', label: 'EROA (PISA)', unit: 'cm²', kind: 'quant', cuts: [0.1, 0.3], sub: 0.2, step: 0.01,
      hint: 'Mild <0.10 · Moderate 0.10–0.29 · Severe ≥0.30' },
    { key: 'rvol', label: 'Regurgitant volume', unit: 'mL', kind: 'quant', cuts: [30, 60], sub: 45, step: 1,
      hint: 'Mild <30 · Moderate 30–59 · Severe ≥60' },
    { key: 'rf', label: 'Regurgitant fraction', unit: '%', kind: 'quant', cuts: [30, 50], sub: 40, step: 1,
      hint: 'Mild <30 · Moderate 30–49 · Severe ≥50' },
    { key: 'morph', label: 'Aortic valve morphology', type: 'select', kind: 'support', options: [
      { value: 'normal', label: 'Normal or mildly abnormal', grade: null },
      { value: 'flail', label: 'Flail / wide coaptation defect / perforation', grade: 3, specific: true },
    ] },
    { key: 'desc', label: 'Descending aorta diastolic flow reversal', type: 'select', kind: 'support', options: [
      { value: 'brief', label: 'Brief, early diastolic reversal', grade: 1 },
      { value: 'intermediate', label: 'Intermediate', grade: 2 },
      { value: 'holo', label: 'Holodiastolic reversal (EDV >20 cm/s)', grade: 3, specific: true },
    ] },
    { key: 'abd', label: 'Abdominal aorta flow reversal', type: 'select', kind: 'support', options: [
      { value: 'absent', label: 'Absent', grade: null },
      { value: 'holo', label: 'Holodiastolic reversal present', grade: 3, specific: true },
    ] },
    { key: 'cw', label: 'CW Doppler jet density', type: 'select', kind: 'support', options: [
      { value: 'faint', label: 'Incomplete or faint', grade: 1 },
      { value: 'dense', label: 'Dense', grade: 2 },
      { value: 'dense-steep', label: 'Dense with steep deceleration', grade: 3 },
    ] },
    { key: 'lv', label: 'LV size', type: 'select', kind: 'support', options: [
      { value: 'normal', label: 'Normal', grade: 1 },
      { value: 'normal-dilated', label: 'Normal or dilated', grade: 2 },
      { value: 'dilated', label: 'Dilated (no other cause)', grade: 3 },
    ] },
  ];
  const TR_PARAMS = [
    { key: 'vc', label: 'Vena contracta width', unit: 'cm', kind: 'semi', cuts: [0.3, 0.7, 1.4, 2.1], step: 0.01,
      hint: 'Mild <0.3 · Mod 0.3–0.69 · Severe 0.7–1.3 · Massive 1.4–2.0 · Torrential ≥2.1' },
    { key: 'pisaR', label: 'PISA radius (Nyquist ~28 cm/s)', unit: 'cm', kind: 'semi', cuts: [0.6, 1.0], step: 0.01,
      hint: 'Mild ≤0.5 · Moderate 0.6–0.9 · Severe >0.9' },
    { key: 'eroa', label: 'EROA (PISA)', unit: 'cm²', kind: 'quant', cuts: [0.2, 0.4, 0.6, 0.8], step: 0.01,
      hint: 'Mild <0.20 · Mod 0.20–0.39 · Severe 0.40–0.59 · Massive 0.60–0.79 · Torrential ≥0.80' },
    { key: 'rvol', label: 'Regurgitant volume', unit: 'mL', kind: 'quant', cuts: [30, 45, 60, 75], step: 1,
      hint: 'Mild <30 · Mod 30–44 · Severe 45–59 · Massive 60–74 · Torrential ≥75' },
    { key: 'morph', label: 'Tricuspid valve morphology', type: 'select', kind: 'support', options: [
      { value: 'normal', label: 'Normal / mildly abnormal leaflets', grade: 1 },
      { value: 'moderate', label: 'Moderately abnormal leaflets', grade: 2 },
      { value: 'severe', label: 'Severe lesions: flail, severe retraction, large perforation', grade: 3, specific: true },
    ] },
    { key: 'jet', label: 'Color flow jet', type: 'select', kind: 'support', options: [
      { value: 'small', label: 'Small, narrow, central', grade: 1 },
      { value: 'moderate', label: 'Moderate central', grade: 2 },
      { value: 'large', label: 'Large central or eccentric wall-impinging jet', grade: 3 },
    ] },
    { key: 'cw', label: 'CW Doppler jet', type: 'select', kind: 'support', options: [
      { value: 'faint', label: 'Faint / partial / parabolic', grade: 1 },
      { value: 'dense', label: 'Dense, parabolic or triangular', grade: 2 },
      { value: 'triangular', label: 'Dense, often triangular with early peak (<2 m/s in massive TR)', grade: 3 },
    ] },
    { key: 'hv', label: 'Hepatic vein flow', type: 'select', kind: 'support', options: [
      { value: 'sdom', label: 'Systolic dominance', grade: 1 },
      { value: 'blunted', label: 'Systolic blunting', grade: 2 },
      { value: 'reversal', label: 'Systolic flow reversal', grade: 3, specific: true },
    ] },
    { key: 'inflow', label: 'Tricuspid inflow', type: 'select', kind: 'support', options: [
      { value: 'adom', label: 'A-wave dominant', grade: 1 },
      { value: 'variable', label: 'Variable', grade: null },
      { value: 'edom', label: 'E-wave dominant (E >1.0 m/s)', grade: 3 },
    ] },
    { key: 'chambers', label: 'RV / RA size, IVC', type: 'select', kind: 'support', options: [
      { value: 'normal', label: 'Normal', grade: 1 },
      { value: 'normal-dilated', label: 'Normal or mildly dilated', grade: 2 },
      { value: 'dilated', label: 'RV/RA dilated, IVC dilated with reduced respiratory variation', grade: 3 },
    ] },
  ];

  const REGURG_DEFS = {
    MR: { name: 'Mitral regurgitation', params: MR_PARAMS, maxGrade: 3 },
    AR: { name: 'Aortic regurgitation', params: AR_PARAMS, maxGrade: 3 },
    TR: { name: 'Tricuspid regurgitation', params: TR_PARAMS, maxGrade: 5 },
  };

  function gradeNumeric(def, value) {
    const v = num(value);
    if (v === null || v < 0) return null;
    if (def.inverse) {
      // e.g. AR pressure half-time: >500 mild, 200–500 moderate, <200 severe
      if (v < def.cuts[1]) return 3;
      if (v <= def.cuts[0]) return 2;
      return 1;
    }
    let g = 1;
    def.cuts.forEach(function (cut, i) {
      const last = i === def.cuts.length - 1;
      const meets = last && def.strictTop ? v > cut : v >= cut;
      if (meets) g = i + 2;
    });
    return g;
  }

  function subgradeLabel(def, value, grade) {
    if (grade !== 2 || def.sub === undefined) return null;
    return num(value) >= def.sub ? 'moderate-to-severe' : 'mild-to-moderate';
  }

  function median(arr) {
    const s = arr.slice().sort(function (a, b) { return a - b; });
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /**
   * Integrate multiple regurgitation parameters into an overall grade, following the
   * spirit of the ASE 2017 integrative algorithm: quantitative parameters carry the most
   * weight; concordant specific signs strengthen confidence; discordance is flagged.
   */
  function assessRegurg(lesion, inputs) {
    const def = REGURG_DEFS[lesion];
    if (!def) throw new Error('Unknown lesion ' + lesion);
    inputs = inputs || {};
    const findings = [];

    def.params.forEach(function (p) {
      const raw = inputs[p.key];
      if (raw === undefined || raw === null || raw === '') return;
      if (p.type === 'select') {
        const opt = p.options.find(function (o) { return o.value === raw; });
        if (!opt) return;
        findings.push({ key: p.key, label: p.label, kind: p.kind, display: opt.label,
          grade: opt.grade, specific: !!opt.specific });
      } else {
        const g = gradeNumeric(p, raw);
        if (g === null) return;
        findings.push({ key: p.key, label: p.label, kind: p.kind,
          display: raw + ' ' + p.unit, value: num(raw), grade: g, sub: subgradeLabel(p, raw, g) });
      }
    });

    const graded = findings.filter(function (f) { return f.grade !== null; });
    const result = { lesion: lesion, name: def.name, findings: findings, grade: null, gradeName: 'Insufficient data',
      subgrade: null, confidence: null, discordant: false, notes: [] };
    if (!graded.length) return result;

    const quant = graded.filter(function (f) { return f.kind === 'quant'; });
    const semi = graded.filter(function (f) { return f.kind === 'semi'; });
    const support = graded.filter(function (f) { return f.kind === 'support'; });

    // Overall grade: quantitative median if available, else semi-quantitative + supportive.
    let base;
    if (quant.length) base = median(quant.map(function (f) { return f.grade; }));
    else if (semi.length) base = median(semi.concat(support).map(function (f) { return f.grade; }));
    else base = median(support.map(function (f) { return f.grade; }));
    // When the median falls between two grades, use the higher one only if a specific sign supports it.
    let grade = Math.floor(base);
    if (base !== grade) {
      const hasSpecificHigher = graded.some(function (f) { return f.specific && f.grade >= grade + 1; });
      if (hasSpecificHigher) grade += 1;
    }

    // Specific signs of severity present but grade below severe → upgrade only when no quantitative data.
    const specificSevere = graded.filter(function (f) { return f.specific && f.grade >= 3; });
    const specificMild = graded.filter(function (f) { return f.specific && f.grade === 1; });
    if (!quant.length && specificSevere.length >= 2 && grade < 3) {
      grade = 3;
      result.notes.push('Two or more specific signs of severe regurgitation are present.');
    }

    const all = graded.map(function (f) { return f.grade; });
    // For TR, treat massive/torrential as "severe" for concordance purposes.
    const collapse = function (g) { return Math.min(g, 3); };
    const spread = Math.max.apply(null, all.map(collapse)) - Math.min.apply(null, all.map(collapse));
    result.discordant = spread >= 2 || (specificSevere.length > 0 && grade < 3) || (specificMild.length > 0 && grade === 3);

    if (quant.length >= 2 && !result.discordant && spread === 0) result.confidence = 'High';
    else if (graded.length >= 3 && !result.discordant) result.confidence = 'Moderate';
    else result.confidence = 'Low';

    if (lesion === 'TR' && grade >= 3) {
      // Allow massive/torrential only when supported by VC/EROA/RVol directly
      const extended = graded.filter(function (f) { return f.kind !== 'support' && f.key !== 'pisaR'; })
        .map(function (f) { return f.grade; });
      const top = extended.length ? Math.floor(median(extended)) : 3;
      grade = Math.max(3, Math.min(top, def.maxGrade));
    } else {
      grade = Math.min(grade, 3);
    }

    result.grade = grade;
    result.gradeName = GRADE_NAMES[grade];
    if (grade === 2) {
      const subs = quant.map(function (f) { return f.sub; }).filter(Boolean);
      if (subs.length) {
        const hi = subs.filter(function (s) { return s === 'moderate-to-severe'; }).length;
        result.subgrade = hi * 2 >= subs.length ? 'moderate-to-severe' : 'mild-to-moderate';
      }
    }

    if (!quant.length) result.notes.push('No quantitative parameters (EROA, RVol, RF) entered — add PISA or volumetric data to strengthen the grade.');
    if (result.discordant) result.notes.push('Parameters are discordant. Re-check technical quality (eccentric jets, multiple jets, non-holosystolic regurgitation, loading conditions) and consider TEE or CMR.');
    if (quant.length === 1 && quant[0].key === 'eroa' && lesion === 'MR') {
      result.notes.push('Single-point PISA may overestimate EROA in non-holosystolic MR (e.g. MVP late-systolic) and underestimate it with crescentic secondary-MR orifices.');
    }

    result.management = regurgManagement(lesion, grade, inputs);
    return result;
  }

  function regurgManagement(lesion, grade, inputs) {
    const out = [];
    const lvef = num(inputs.lvef), lvesd = num(inputs.lvesd), lvesdi = num(inputs.lvesdi),
      lvedd = num(inputs.lvedd), paspv = num(inputs.pasp);
    const symptomatic = !!inputs.symptomatic;
    if (lesion === 'MR') {
      const etiology = inputs.etiology;
      if (grade >= 3 && !etiology) {
        out.push('Severe MR: select the mechanism (primary vs secondary) for guideline-based management.');
      } else if (grade >= 3 && etiology === 'primary') {
        if (symptomatic) out.push('Symptomatic severe primary MR (Stage D): mitral valve surgery recommended (Class 1); repair preferred when durable repair is likely.');
        else {
          const triggers = [];
          if (lvef !== null && lvef <= 60) triggers.push('LVEF ≤60%');
          if (lvesd !== null && lvesd >= 40) triggers.push('LVESD ≥40 mm');
          if (triggers.length) out.push('Asymptomatic severe primary MR with LV dysfunction (Stage C2: ' + triggers.join(', ') + '): surgery recommended (Class 1).');
          else out.push('Asymptomatic severe primary MR with preserved LV (Stage C1): repair reasonable at a Comprehensive Valve Center if >95% likelihood of durable repair and <1% mortality; otherwise surveillance every 6–12 months.');
          if (paspv !== null && paspv > 50) out.push('PASP >50 mmHg supports earlier intervention.');
        }
      } else if (grade >= 3 && etiology === 'secondary') {
        out.push('Severe secondary MR: optimise GDMT (and CRT if indicated) first. Re-assess; TEER reasonable if persistent symptoms on GDMT with LVEF 20–50%, LVESD ≤70 mm and PASP ≤70 mmHg (COAPT criteria).');
      } else if (grade === 2) {
        out.push('Moderate MR (Stage B): clinical and echo surveillance every 1–2 years.');
      }
    } else if (lesion === 'AR') {
      if (grade >= 3) {
        if (symptomatic) out.push('Symptomatic severe AR (Stage D): aortic valve surgery recommended regardless of LV function (Class 1).');
        else {
          const triggers = [];
          if (lvef !== null && lvef <= 55) triggers.push('LVEF ≤55%');
          if (lvesd !== null && lvesd > 50) triggers.push('LVESD >50 mm');
          if (lvesdi !== null && lvesdi > 25) triggers.push('LVESDi >25 mm/m²');
          if (triggers.length) out.push('Asymptomatic severe AR with LV dysfunction/dilation (Stage C2: ' + triggers.join(', ') + '): surgery recommended.');
          else {
            out.push('Asymptomatic severe AR with normal LV (Stage C1): surveillance every 6–12 months.');
            if (lvedd !== null && lvedd > 65) out.push('LVEDD >65 mm: surgery may be considered if low surgical risk (Class 2b).');
          }
        }
      } else if (grade === 2) {
        out.push('Moderate AR (Stage B): echo every 1–2 years; assess aortic root/ascending aorta.');
      }
    } else if (lesion === 'TR') {
      if (grade >= 3) {
        out.push('Severe TR: assess RV size/function, PASP and RA pressure. Surgery recommended at the time of left-sided valve surgery (Class 1); isolated surgery reasonable for symptoms or progressive RV dilation/dysfunction in primary TR.');
        if (grade >= 4) out.push('Massive/torrential TR: consider evaluation for transcatheter tricuspid intervention at a Heart Valve Center.');
      } else if (grade === 2 && inputs.annulus && num(inputs.annulus) >= 40) {
        out.push('Moderate TR with annulus ≥40 mm (or ≥21 mm/m²): tricuspid repair can be beneficial at the time of left-sided valve surgery (Class 2a).');
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Aortic stenosis
  // ---------------------------------------------------------------------------

  function gradeVmax(v) {
    if (v === null) return null;
    if (v >= 5) return 4;
    if (v >= 4) return 3;
    if (v >= 3) return 2;
    if (v >= 2.6) return 1;
    return 0;
  }
  function gradeMG(g) {
    if (g === null) return null;
    if (g >= 60) return 4;
    if (g >= 40) return 3;
    if (g >= 20) return 2;
    return 1;
  }
  function gradeAVA(a) {
    if (a === null) return null;
    if (a < 1.0) return 3;
    if (a <= 1.5) return 2;
    return 1;
  }

  const AS_NAMES = ['Aortic sclerosis / no AS', 'Mild AS', 'Moderate AS', 'Severe AS', 'Very severe AS'];

  /**
   * inputs: vmax (m/s), mg (mmHg), ava (cm², optional), lvotD (cm), lvotVti (cm), avVti (cm),
   * lvotV (m/s), height, weight, sex ('M'|'F'), lvef (%), symptomatic (bool),
   * calcium (Agatston AU), dse ('true'|'pseudo'|'noreserve')
   */
  function assessAS(inputs) {
    inputs = inputs || {};
    const vmax = num(inputs.vmax), mg = num(inputs.mg), lvef = num(inputs.lvef);
    const bsa = num(inputs.bsa) || bsaMosteller(inputs.height, inputs.weight);
    const sv = strokeVolume(inputs.lvotD, inputs.lvotVti);
    let ava = num(inputs.ava);
    let avaSource = ava !== null ? 'entered' : null;
    if (ava === null) {
      ava = continuityAVA(inputs.lvotD, inputs.lvotVti, inputs.avVti);
      if (ava !== null) avaSource = 'continuity (VTI)';
    }
    const dvi = dimensionlessIndex(inputs.lvotVti, inputs.avVti) ||
      dimensionlessIndex(inputs.lvotV, inputs.vmax);
    const avai = ava !== null && bsa ? ava / bsa : null;
    const svi = sv !== null && bsa ? sv / bsa : (num(inputs.svi));
    const calcium = num(inputs.calcium);
    const sex = inputs.sex;
    const symptomatic = !!inputs.symptomatic;

    const derived = { bsa: round(bsa, 2), sv: round(sv, 0), svi: round(svi, 1), ava: round(ava, 2), avaSource: avaSource,
      avai: round(avai, 2), dvi: round(dvi, 2), peakGradient: round(bernoulli(vmax), 0) };

    const findings = [];
    const gV = gradeVmax(vmax), gM = gradeMG(mg), gA = gradeAVA(ava);
    if (gV !== null) findings.push({ label: 'Peak velocity', display: vmax + ' m/s', grade: gV });
    if (gM !== null) findings.push({ label: 'Mean gradient', display: mg + ' mmHg', grade: gM });
    if (gA !== null) findings.push({ label: 'AVA', display: round(ava, 2) + ' cm²', grade: gA });
    if (avai !== null) findings.push({ label: 'AVA indexed', display: round(avai, 2) + ' cm²/m²', grade: avai < 0.6 ? 3 : (avai <= 0.85 ? 2 : 1) });
    if (dvi !== null) findings.push({ label: 'Dimensionless index', display: String(round(dvi, 2)), grade: dvi < 0.25 ? 3 : (dvi <= 0.5 ? 2 : 1) });

    const res = { name: 'Aortic stenosis', derived: derived, findings: findings, grade: null, gradeName: 'Insufficient data',
      pattern: null, stage: null, notes: [], management: [] };
    if (gV === null && gM === null && gA === null) return res;

    const highGradient = (vmax !== null && vmax >= 4) || (mg !== null && mg >= 40);
    const smallArea = ava !== null && ava <= 1.0;
    let grade;

    if (highGradient) {
      grade = Math.max(gV || 0, gM || 0);
      res.pattern = 'High-gradient';
      if (lvef !== null && lvef < 50) res.stage = symptomatic ? 'D1' : 'C2';
      else res.stage = symptomatic ? 'D1' : 'C1';
      if (ava !== null && ava > 1.0) {
        res.notes.push('High gradient with AVA >1.0 cm²: check for high-flow states (significant AR, anaemia, fever, hyperthyroidism, AV fistula) and for overestimated LVOT diameter; review AVAi and DVI. Large body size may also explain this.');
      }
    } else if (smallArea) {
      // Low-gradient with small AVA
      if (lvef !== null && lvef < 50) {
        res.pattern = 'Classical low-flow, low-gradient (reduced LVEF)';
        if (inputs.dse === 'true') { grade = 3; res.stage = 'D2'; res.notes.push('DSE: Vmax ≥4 m/s with AVA ≤1.0 cm² at any flow rate — true severe AS.'); }
        else if (inputs.dse === 'pseudo') { grade = 2; res.stage = 'B'; res.pattern += ' — pseudo-severe'; res.notes.push('DSE: AVA increases to >1.0 cm² with normalised flow — pseudo-severe (moderate) AS; treat the cardiomyopathy.'); }
        else {
          grade = null;
          if (inputs.dse === 'noreserve') res.notes.push('DSE without contractile reserve (SV increase <20%): severity indeterminate — use CT calcium scoring.');
          else res.notes.push('Perform low-dose dobutamine stress echo (up to 20 µg/kg/min) to distinguish true severe from pseudo-severe AS.');
        }
      } else {
        const lowFlow = svi !== null && svi < 35;
        if (lowFlow) {
          res.pattern = 'Paradoxical low-flow, low-gradient (preserved LVEF)';
          res.notes.push('Confirm: measurement errors excluded (LVOT diameter, Doppler alignment), BP controlled at time of study, small hypertrophied LV. AVAi ≤0.6 cm²/m² and DVI <0.25 support severe AS.');
        } else if (svi !== null) {
          res.pattern = 'Normal-flow, low-gradient (preserved LVEF)';
          res.notes.push('Normal flow with low gradient and small AVA usually means moderate AS or measurement error (most often an underestimated LVOT diameter). Re-measure, consider 3D LVOT planimetry or CT.');
        } else {
          res.pattern = 'Low-gradient, small AVA';
          res.notes.push('Enter LVOT diameter, LVOT VTI and height/weight to calculate SVi and distinguish low-flow from normal-flow.');
        }
        grade = null;
      }
      // CT calcium score adjudication
      if (calcium !== null && (sex === 'M' || sex === 'F') && grade === null) {
        const likely = sex === 'M' ? 2000 : 1200, very = sex === 'M' ? 3000 : 1600;
        if (calcium >= very) { grade = 3; res.notes.push('AV calcium score ≥' + very + ' AU: severe AS highly likely.'); }
        else if (calcium >= likely) { grade = 3; res.notes.push('AV calcium score ≥' + likely + ' AU: severe AS likely.'); }
        else if (calcium < (sex === 'M' ? 1600 : 800)) { grade = 2; res.notes.push('AV calcium score low (<' + (sex === 'M' ? 1600 : 800) + ' AU): severe AS unlikely.'); }
        else res.notes.push('AV calcium score in the indeterminate range.');
        if (grade === 3 && !res.stage) res.stage = lvef !== null && lvef < 50 ? 'D2' : 'D3';
      }
      if (grade === 3 && !res.stage) res.stage = 'D3';
      if (grade === 3 && res.stage === 'D3' && !symptomatic) res.notes.push('Stage D3 is defined for symptomatic patients; correlate clinically.');
    } else {
      grade = Math.max(gV || 0, gM || 0, gA !== null && !gV && !gM ? gA : 0);
      if (gV === null && gM === null && gA !== null) grade = gA;
      res.pattern = 'Concordant';
      res.stage = grade === 0 ? 'A' : 'B';
      if (gA === 3 && grade < 3) res.pattern = 'Discordant';
    }

    if (grade === null) {
      res.gradeName = 'Indeterminate — possible severe AS';
    } else {
      res.grade = grade;
      res.gradeName = AS_NAMES[grade];
    }

    // Management (2020 ACC/AHA)
    if (res.grade >= 3) {
      if (symptomatic) res.management.push('Symptomatic severe AS: AVR recommended (Class 1). SAVR vs TAVI per age, life expectancy, anatomy and Heart Team discussion.');
      else if (lvef !== null && lvef < 50) res.management.push('Asymptomatic severe AS with LVEF <50% (Stage C2): AVR recommended (Class 1).');
      else {
        res.management.push('Asymptomatic severe AS (Stage C1): consider exercise testing to unmask symptoms; AVR reasonable if very severe (Vmax ≥5 m/s), BNP >3× normal, rapid progression (≥0.3 m/s/yr) or fall in BP on exercise.');
      }
    } else if (res.grade === 2) {
      res.management.push('Moderate AS: echo every 1–2 years. In AVR for other cardiac surgery, concomitant AVR is reasonable.');
    } else if (res.grade === 1) {
      res.management.push('Mild AS: echo every 3–5 years.');
    }
    return res;
  }

  // ---------------------------------------------------------------------------
  // Mitral stenosis
  // ---------------------------------------------------------------------------

  /** Wilkins (Abascal) score — four components each 1–4. */
  function wilkinsScore(w) {
    if (!w) return null;
    const parts = ['mobility', 'thickening', 'calcification', 'subvalvular'].map(function (k) { return num(w[k]); });
    if (parts.some(function (p) { return p === null; })) return null;
    return parts.reduce(function (a, b) { return a + b; }, 0);
  }

  /**
   * inputs: planimetry (cm²), pht (ms), mg (mmHg), hr (bpm), pasp (mmHg), symptomatic,
   * mr ('none'|'mild'|'moderate'|'severe'), laThrombus (bool), wilkins {mobility, thickening, calcification, subvalvular}
   */
  function assessMS(inputs) {
    inputs = inputs || {};
    const plan = num(inputs.planimetry), pht = num(inputs.pht), mg = num(inputs.mg),
      hr = num(inputs.hr), paspv = num(inputs.pasp);
    const phtArea = mvaFromPHT(pht);
    const mva = plan !== null ? plan : phtArea;
    const mvaSource = plan !== null ? 'planimetry' : (phtArea !== null ? 'pressure half-time (220/PHT)' : null);
    const ws = wilkinsScore(inputs.wilkins);
    const symptomatic = !!inputs.symptomatic;
    const findings = [];
    if (plan !== null) findings.push({ label: 'MVA (planimetry)', display: plan + ' cm²', grade: plan <= 1.0 ? 4 : plan <= 1.5 ? 3 : plan <= 2.0 ? 2 : 1 });
    if (phtArea !== null) findings.push({ label: 'MVA (PHT)', display: round(phtArea, 2) + ' cm² (PHT ' + pht + ' ms)', grade: pht >= 220 ? 4 : pht >= 150 ? 3 : 2 });
    if (mg !== null) findings.push({ label: 'Mean gradient', display: mg + ' mmHg' + (hr ? ' @ ' + hr + ' bpm' : ''), grade: mg > 10 ? 3 : mg >= 5 ? 2 : 1 });
    if (paspv !== null) findings.push({ label: 'PASP', display: paspv + ' mmHg', grade: paspv > 50 ? 3 : paspv >= 30 ? 2 : 1 });

    const res = { name: 'Mitral stenosis', derived: { mva: round(mva, 2), mvaSource: mvaSource, wilkins: ws },
      findings: findings, grade: null, gradeName: 'Insufficient data', stage: null, notes: [], management: [] };
    if (mva === null) {
      if (mg !== null) res.notes.push('Mean gradient is heart-rate and flow dependent — enter planimetry or PHT for an area-based grade.');
      return res;
    }
    let grade;
    if (mva <= 1.0) grade = 4;
    else if (mva <= 1.5) grade = 3;
    else if (mva <= 2.0) grade = 2;
    else grade = 1;
    res.grade = grade;
    res.gradeName = ['', 'Mild MS (MVA >2.0 cm²)', 'Moderate / progressive MS', 'Severe MS', 'Very severe MS'][grade];
    res.stage = grade >= 3 ? (symptomatic ? 'D' : 'C') : 'B';

    if (plan === null && phtArea !== null) {
      res.notes.push('PHT-derived MVA is unreliable immediately after PMBC, with significant AR, reduced LV compliance/diastolic dysfunction, or ASD. Planimetry (ideally 3D) is the reference.');
    }
    if (mg !== null && hr !== null && hr > 90) res.notes.push('Heart rate >90 bpm inflates the mean gradient; consider re-measuring at controlled rate.');
    if (mg !== null && grade >= 3 && mg < 5) res.notes.push('Low gradient for the measured area — consider low cardiac output or overestimated severity.');
    if (mg !== null && grade <= 2 && mg > 10) res.notes.push('High gradient with MVA >1.5 cm²: consider tachycardia, concomitant MR or high-output state; exercise echo may help.');

    if (ws !== null) {
      res.notes.push('Wilkins score ' + ws + '/16: ' + (ws <= 8 ? 'morphology favourable for PMBC.' : 'less favourable for PMBC (>8); outcomes poorer — consider surgery.'));
    }
    const favourable = ws !== null && ws <= 8 && inputs.mr !== 'moderate' && inputs.mr !== 'severe' && !inputs.laThrombus;
    if (grade >= 3) {
      if (symptomatic) {
        if (favourable) res.management.push('Symptomatic severe rheumatic MS with favourable anatomy, ≤mild MR and no LA thrombus: PMBC recommended (Class 1).');
        else res.management.push('Symptomatic severe MS: PMBC if anatomy suitable; otherwise mitral valve surgery (Class 1) if not high risk.');
      } else {
        if (favourable && paspv !== null && paspv > 50) res.management.push('Asymptomatic severe MS with PASP >50 mmHg and favourable anatomy: PMBC reasonable (Class 2a).');
        else res.management.push('Asymptomatic severe MS: surveillance; PMBC reasonable if PASP >50 mmHg, may be considered with new-onset AF (favourable anatomy).');
      }
      if (inputs.laThrombus) res.management.push('LA thrombus present — contraindication to PMBC; anticoagulate and reassess.');
      if (inputs.mr === 'moderate' || inputs.mr === 'severe') res.management.push('Moderate or greater MR is a contraindication to PMBC.');
    } else if (grade === 2) {
      res.management.push('Progressive MS (Stage B): echo every 3–5 years (MVA >1.5 cm²); exercise testing if symptoms are discordant with resting haemodynamics.');
    }
    return res;
  }

  /** Build a concise, copyable report sentence. */
  function reportText(result) {
    if (!result || (result.grade === null && !/Indeterminate/.test(result.gradeName))) return '';
    const parts = [];
    let headline = result.gradeName;
    if (result.subgrade) headline += ' (' + result.subgrade + ')';
    if (result.lesion) headline += ' ' + result.name.toLowerCase();
    parts.push(headline + '.');
    if (result.pattern && result.pattern !== 'Concordant') parts.push('Pattern: ' + result.pattern + '.');
    if (result.stage) parts.push('ACC/AHA stage ' + result.stage + '.');
    const fs = (result.findings || []).map(function (f) { return f.label + ' ' + f.display; });
    if (fs.length) parts.push('Supporting parameters: ' + fs.join('; ') + '.');
    if (result.confidence) parts.push('Confidence: ' + result.confidence.toLowerCase() + (result.discordant ? ' (discordant parameters)' : '') + '.');
    return parts.join(' ');
  }

  const api = {
    GRADE_NAMES: GRADE_NAMES,
    REGURG_DEFS: REGURG_DEFS,
    num: num, round: round,
    bsaMosteller: bsaMosteller, circleArea: circleArea, strokeVolume: strokeVolume,
    continuityAVA: continuityAVA, dimensionlessIndex: dimensionlessIndex, bernoulli: bernoulli,
    pisaEROA: pisaEROA, regurgVolumeFromEROA: regurgVolumeFromEROA, regurgFraction: regurgFraction,
    mvaFromPHT: mvaFromPHT, pasp: pasp, wilkinsScore: wilkinsScore,
    gradeNumeric: gradeNumeric,
    assessRegurg: assessRegurg, assessAS: assessAS, assessMS: assessMS, reportText: reportText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ValveLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
