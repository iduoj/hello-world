/* ValvEcho UI — renders forms from field specs and the shared grading logic. */
(function () {
  'use strict';
  const V = window.ValveLogic;
  const STORE_KEY = 'valvecho.v1';

  // ---------------------------------------------------------------------------
  // Field specs
  // ---------------------------------------------------------------------------
  const n = (key, label, unit, opts) => Object.assign({ key, label, unit, type: 'number' }, opts || {});
  const sel = (key, label, options, opts) => Object.assign({ key, label, type: 'select', options }, opts || {});
  const chk = (key, label) => ({ key, label, type: 'check' });

  const PATIENT = [
    n('height', 'Height', 'cm', { step: 1 }),
    n('weight', 'Weight', 'kg', { step: 0.1 }),
    sel('sex', 'Sex', [{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }]),
    n('lvef', 'LVEF', '%', { step: 1 }),
    chk('symptomatic', 'Symptomatic'),
  ];

  const AS_FIELDS = {
    main: [
      n('vmax', 'Peak aortic velocity', 'm/s', { step: 0.1, hint: 'Mild 2.6–2.9 · Mod 3.0–3.9 · Severe ≥4.0' }),
      n('mg', 'Mean gradient', 'mmHg', { step: 1, hint: 'Mild <20 · Mod 20–39 · Severe ≥40' }),
      n('ava', 'AVA (if measured directly)', 'cm²', { step: 0.01, hint: 'Leave blank to use continuity' }),
    ],
    continuity: [
      n('lvotD', 'LVOT diameter', 'cm', { step: 0.01 }),
      n('lvotVti', 'LVOT VTI', 'cm', { step: 0.1 }),
      n('avVti', 'AV VTI', 'cm', { step: 0.1 }),
      n('lvotV', 'LVOT peak velocity', 'm/s', { step: 0.01, hint: 'Optional, for DVI by Vmax' }),
    ],
    lowflow: [
      sel('dse', 'Dobutamine stress echo', [
        { value: 'true', label: 'Vmax ≥4 m/s, AVA ≤1.0 cm² (true severe)' },
        { value: 'pseudo', label: 'AVA >1.0 cm² at normal flow (pseudo-severe)' },
        { value: 'noreserve', label: 'No contractile reserve (SV ↑ <20%)' },
      ], { hint: 'For classical low-flow, low-gradient AS' }),
      n('calcium', 'CT AV calcium score', 'AU', { step: 10, hint: 'Severe likely: ♂ ≥2000 · ♀ ≥1200' }),
    ],
  };

  const WILKINS = {
    mobility: ['Highly mobile; only leaflet tips restricted', 'Mid and base of leaflets normal mobility', 'Valve moves forward in diastole, mainly from base', 'No or minimal forward diastolic movement'],
    thickening: ['Near normal (4–5 mm)', 'Mid-leaflets normal, margins thickened (5–8 mm)', 'Whole leaflet thickened (5–8 mm)', 'Considerable thickening of all leaflet tissue (>8–10 mm)'],
    calcification: ['Single area of increased brightness', 'Scattered bright areas, leaflet margins', 'Brightness extending into mid-leaflets', 'Extensive brightness through most of leaflet'],
    subvalvular: ['Minimal thickening just below leaflets', 'Thickening of chordae up to one-third length', 'Thickening extending to distal third of chords', 'Extensive thickening and shortening to papillary muscles'],
  };

  const MS_FIELDS = {
    main: [
      n('planimetry', 'MVA by planimetry', 'cm²', { step: 0.01, hint: 'Reference method (2D/3D)' }),
      n('pht', 'Pressure half-time', 'ms', { step: 1, hint: 'MVA = 220 / PHT' }),
      n('mg', 'Mean gradient', 'mmHg', { step: 0.5 }),
      n('hr', 'Heart rate', 'bpm', { step: 1 }),
      n('pasp', 'PASP', 'mmHg', { step: 1 }),
      sel('mr', 'Concomitant MR', [
        { value: 'none', label: 'None / trace' }, { value: 'mild', label: 'Mild' },
        { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe' },
      ]),
      chk('laThrombus', 'LA / LAA thrombus'),
    ],
    wilkins: Object.keys(WILKINS).map((k) => sel('w_' + k, k[0].toUpperCase() + k.slice(1),
      WILKINS[k].map((d, i) => ({ value: String(i + 1), label: (i + 1) + ' — ' + d })))),
  };

  const CONTEXT = {
    MR: [
      sel('etiology', 'Mechanism', [{ value: 'primary', label: 'Primary (degenerative)' }, { value: 'secondary', label: 'Secondary (functional)' }]),
      n('lvesd', 'LVESD', 'mm', { step: 1 }),
      n('pasp', 'PASP', 'mmHg', { step: 1 }),
    ],
    AR: [
      n('lvesd', 'LVESD', 'mm', { step: 1 }),
      n('lvesdi', 'LVESD indexed', 'mm/m²', { step: 0.1, hint: 'Auto from LVESD/BSA if blank' }),
      n('lvedd', 'LVEDD', 'mm', { step: 1 }),
    ],
    TR: [
      n('annulus', 'Tricuspid annulus (diastole)', 'mm', { step: 1 }),
      n('pasp', 'PASP', 'mmHg', { step: 1 }),
    ],
  };

  const PISA = {
    MR: { alias: 40, note: 'MR Vmax typically 5–6 m/s' },
    AR: { alias: 40, note: 'AR Vmax typically 4–5 m/s' },
    TR: { alias: 28, note: 'Use baseline shift; TR Vmax often 2–3 m/s' },
  };

  const TABS = [
    { id: 'AS', label: 'Aortic stenosis' },
    { id: 'MS', label: 'Mitral stenosis' },
    { id: 'AR', label: 'Aortic regurg.' },
    { id: 'MR', label: 'Mitral regurg.' },
    { id: 'TR', label: 'Tricuspid regurg.' },
    { id: 'calc', label: 'Calculators' },
    { id: 'ref', label: 'Reference' },
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let state = { tab: 'AS', patient: {}, AS: {}, MS: {}, AR: {}, MR: {}, TR: {}, calc: {} };
  let hadSaved = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') { state = Object.assign(state, saved); hadSaved = true; }
  } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fid = (scope, key) => 'f-' + scope + '-' + key;

  function fieldHTML(scope, f) {
    const id = fid(scope, f.key);
    const val = state[scope][f.key];
    const hint = f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '';
    const data = ' data-scope="' + scope + '" data-key="' + f.key + '"';
    if (f.type === 'check') {
      return '<div class="field check"><input type="checkbox" id="' + id + '"' + data + (val ? ' checked' : '') +
        '><label for="' + id + '">' + esc(f.label) + '</label></div>';
    }
    if (f.type === 'select') {
      const opts = ['<option value="">—</option>'].concat(f.options.map((o) =>
        '<option value="' + esc(o.value) + '"' + (val === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>'));
      return '<div class="field"><label for="' + id + '">' + esc(f.label) + '</label><select id="' + id + '"' + data + '>' +
        opts.join('') + '</select>' + hint + '</div>';
    }
    return '<div class="field"><label for="' + id + '">' + esc(f.label) + '</label><div class="inputwrap">' +
      '<input type="number" inputmode="decimal" min="0" step="' + (f.step || 'any') + '" id="' + id + '"' + data +
      ' value="' + (val === undefined || val === null ? '' : esc(val)) + '"><span class="unit">' + esc(f.unit) + '</span></div>' +
      hint + '</div>';
  }
  const grid = (scope, fields, wide) => '<div class="grid' + (wide ? ' wide' : '') + '">' + fields.map((f) => fieldHTML(scope, f)).join('') + '</div>';

  function regurgFields(lesion) {
    return V.REGURG_DEFS[lesion].params.map((p) => p.type === 'select'
      ? sel(p.key, p.label, p.options.map((o) => ({ value: o.value, label: o.label })))
      : n(p.key, p.label, p.unit, { step: p.step, hint: p.hint }));
  }

  function gradeClass(g) { return g === null || g === undefined ? 'gnull' : 'g' + g; }
  function regurgChipLabel(g) { return g === null ? 'n/d' : V.GRADE_NAMES[g]; }
  const AS_CHIP = ['None', 'Mild', 'Moderate', 'Severe', 'V. severe'];
  const MS_CHIP = ['', 'Mild', 'Moderate', 'Severe', 'V. severe'];

  // ---------------------------------------------------------------------------
  // Build static layout
  // ---------------------------------------------------------------------------
  const tabsEl = document.getElementById('tabs');
  const panelsEl = document.getElementById('panels');
  document.getElementById('patient-fields').innerHTML = PATIENT.map((f) => fieldHTML('patient', f)).join('');

  tabsEl.innerHTML = TABS.map((t) => '<button role="tab" type="button" id="tab-' + t.id + '" aria-controls="panel-' + t.id +
    '" data-tab="' + t.id + '"><span class="dot" id="dot-' + t.id + '"></span>' + esc(t.label) + '</button>').join('');

  function resultShell(id) {
    return '<section class="card result" id="result-' + id + '" aria-live="polite"></section>';
  }

  function buildPanels() {
    let html = '';
    // AS
    html += '<div class="panel" role="tabpanel" id="panel-AS"><section class="card inputs"><h2>Aortic stenosis</h2>' +
      '<h3>Doppler</h3>' + grid('AS', AS_FIELDS.main) +
      '<h3>Continuity equation / DVI</h3>' + grid('AS', AS_FIELDS.continuity) +
      '<h3>Low-gradient work-up</h3>' + grid('AS', AS_FIELDS.lowflow, true) +
      '</section>' + resultShell('AS') + '</div>';
    // MS
    html += '<div class="panel" role="tabpanel" id="panel-MS"><section class="card inputs"><h2>Mitral stenosis</h2>' +
      '<h3>Haemodynamics</h3>' + grid('MS', MS_FIELDS.main) +
      '<h3>Wilkins score (PMBC suitability)</h3>' + grid('MS', MS_FIELDS.wilkins, true) +
      '</section>' + resultShell('MS') + '</div>';
    // Regurgitation
    ['AR', 'MR', 'TR'].forEach((L) => {
      const fields = regurgFields(L);
      const numeric = fields.filter((f) => f.type === 'number');
      const qual = fields.filter((f) => f.type === 'select');
      html += '<div class="panel" role="tabpanel" id="panel-' + L + '"><section class="card inputs"><h2>' + esc(V.REGURG_DEFS[L].name) + '</h2>' +
        '<h3>Quantitative &amp; semi-quantitative</h3>' + grid(L, numeric) +
        pisaHelperHTML(L) +
        '<h3>Qualitative &amp; supportive signs</h3>' + grid(L, qual, true) +
        '<h3>Chamber size &amp; context</h3>' + grid(L, CONTEXT[L]) +
        '</section>' + resultShell(L) + '</div>';
    });
    html += '<div class="panel" role="tabpanel" id="panel-calc" style="grid-template-columns:1fr">' + calculatorsHTML() + '</div>';
    html += '<div class="panel" role="tabpanel" id="panel-ref" style="grid-template-columns:1fr">' + referenceHTML() + '</div>';
    panelsEl.innerHTML = html;
  }

  function pisaHelperHTML(L) {
    const s = 'pisa' + L;
    if (!state[s]) state[s] = { alias: PISA[L].alias };
    const fields = [
      n('r', 'PISA radius', 'cm', { step: 0.01 }),
      n('alias', 'Aliasing velocity', 'cm/s', { step: 1 }),
      n('vmax', 'Regurgitant peak velocity', 'cm/s', { step: 1, hint: PISA[L].note }),
      n('vti', 'Regurgitant jet VTI', 'cm', { step: 1 }),
    ];
    if (L !== 'TR') fields.push(n('fsv', 'Forward SV (for RF)', 'mL', { step: 1, hint: L === 'MR' ? 'LVOT stroke volume' : 'RVOT or mitral inflow SV' }));
    return '<div class="sub"><div class="row"><strong>PISA helper</strong><span class="calcout" id="pisa-out-' + L + '"></span></div>' +
      grid(s, fields) + '<div class="row" style="margin-top:10px"><span class="calcout">Fills EROA, RVol' + (L !== 'TR' ? ' and RF' : '') +
      ' above.</span><button type="button" class="primary" data-pisa-apply="' + L + '">Apply</button></div></div>';
  }

  function calculatorsHTML() {
    const c = (title, fields, outId) => '<section class="card"><h2>' + esc(title) + '</h2>' + grid('calc', fields) +
      '<p class="derived" id="' + outId + '"></p></section>';
    return '<div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">' +
      c('Continuity equation', [n('lvotD', 'LVOT diameter', 'cm'), n('lvotVti', 'LVOT VTI', 'cm'), n('avVti', 'AV VTI', 'cm')], 'calc-cont') +
      c('Simplified Bernoulli', [n('v', 'Peak velocity', 'm/s'), n('rap', 'RA pressure (for PASP)', 'mmHg', { hint: 'Use with TR Vmax' })], 'calc-bern') +
      c('PISA', [n('r', 'Radius', 'cm'), n('alias', 'Aliasing velocity', 'cm/s'), n('pv', 'Peak velocity', 'cm/s'), n('vti', 'Jet VTI', 'cm')], 'calc-pisa') +
      c('Volumetric regurgitant fraction', [n('svLeak', 'SV across regurgitant valve', 'mL', { hint: 'e.g. mitral annulus SV for MR' }), n('svFwd', 'SV across competent valve', 'mL', { hint: 'e.g. LVOT SV' })], 'calc-vol') +
      c('Mitral valve area (PHT)', [n('pht', 'Pressure half-time', 'ms')], 'calc-pht') +
      '</div>';
  }

  function referenceHTML() {
    const regTable = (L) => {
      const d = V.REGURG_DEFS[L];
      const rows = d.params.filter((p) => p.type !== 'select').map((p) => '<tr><td>' + esc(p.label) + ' (' + esc(p.unit) + ')</td><td>' + esc(p.hint) + '</td></tr>').join('');
      return '<h3>' + esc(d.name) + '</h3><table><thead><tr><th>Parameter</th><th>Thresholds</th></tr></thead><tbody>' + rows + '</tbody></table>';
    };
    return '<section class="card ref">' +
      '<h3>Aortic stenosis</h3><table><thead><tr><th></th><th>Sclerosis</th><th class="">Mild</th><th>Moderate</th><th>Severe</th></tr></thead><tbody>' +
      '<tr><td>Peak velocity (m/s)</td><td>≤2.5</td><td class="c1">2.6–2.9</td><td class="c2">3.0–3.9</td><td class="c3">≥4.0 (very severe ≥5.0)</td></tr>' +
      '<tr><td>Mean gradient (mmHg)</td><td>—</td><td class="c1">&lt;20</td><td class="c2">20–39</td><td class="c3">≥40 (very severe ≥60)</td></tr>' +
      '<tr><td>AVA (cm²)</td><td>—</td><td class="c1">&gt;1.5</td><td class="c2">1.0–1.5</td><td class="c3">&lt;1.0</td></tr>' +
      '<tr><td>AVA indexed (cm²/m²)</td><td>—</td><td class="c1">&gt;0.85</td><td class="c2">0.60–0.85</td><td class="c3">&lt;0.6</td></tr>' +
      '<tr><td>Dimensionless index</td><td>—</td><td class="c1">&gt;0.50</td><td class="c2">0.25–0.50</td><td class="c3">&lt;0.25</td></tr>' +
      '</tbody></table>' +
      '<p class="derived">Low-flow: SVi &lt;35 mL/m². Calcium score: severe likely ♂ ≥2000 AU, ♀ ≥1200 AU; highly likely ♂ ≥3000, ♀ ≥1600.</p>' +
      '<h3>Mitral stenosis</h3><table><thead><tr><th></th><th>Progressive</th><th>Severe</th><th>Very severe</th></tr></thead><tbody>' +
      '<tr><td>MVA (cm²)</td><td class="c2">&gt;1.5</td><td class="c3">≤1.5</td><td class="c3">≤1.0</td></tr>' +
      '<tr><td>Pressure half-time (ms)</td><td class="c2">&lt;150</td><td class="c3">≥150</td><td class="c3">≥220</td></tr>' +
      '</tbody></table>' +
      '<p class="derived">Mean gradient (supportive; heart-rate and flow dependent, HR 60–80): mild &lt;5 · moderate 5–10 · severe &gt;10 mmHg. PASP &gt;50 mmHg supports severity.</p>' +
      regTable('AR') + regTable('MR') + regTable('TR') +
      '<h3>Integration approach</h3><ul class="notes">' +
      '<li>Quantitative parameters (EROA, RVol, RF) carry the most weight; when absent, vena contracta and supportive signs are combined.</li>' +
      '<li>Specific signs (e.g. flail leaflet, pulmonary/hepatic vein systolic reversal, holodiastolic aortic reversal) strengthen a severe grade.</li>' +
      '<li>Discordance between parameters is flagged — consider TEE, CMR or 3D quantitation.</li>' +
      '</ul></section>';
  }

  // ---------------------------------------------------------------------------
  // Result rendering
  // ---------------------------------------------------------------------------
  function patientInputs() {
    const p = state.patient;
    return { height: p.height, weight: p.weight, sex: p.sex, lvef: p.lvef, symptomatic: !!p.symptomatic };
  }
  function bsa() { return V.bsaMosteller(state.patient.height, state.patient.weight); }

  function renderResult(id, res, chipNames) {
    const el = document.getElementById('result-' + id);
    const dot = document.getElementById('dot-' + id);
    if (!res.findings.length) {
      el.innerHTML = '<h2>Assessment</h2><p class="empty">Enter measurements to grade ' + esc(res.name.toLowerCase()) + '.</p>';
      dot.style.background = 'transparent';
      return;
    }
    const g = res.grade;
    const color = g === null ? 'var(--g2)' : 'var(--g' + g + ')';
    dot.style.background = color;
    let head = '<h2>Assessment</h2><div class="verdict"><span class="badge" style="background:' + color + '">' + esc(res.gradeName) +
      (res.subgrade ? ' <small style="font-weight:500">(' + esc(res.subgrade) + ')</small>' : '') + '</span></div>';
    const pills = [];
    if (res.stage) pills.push('<span class="pill">ACC/AHA stage ' + esc(res.stage) + '</span>');
    if (res.pattern) pills.push('<span class="pill' + (/low-gradient|Discordant|Paradoxical|Classical/i.test(res.pattern) ? ' warn' : '') + '">' + esc(res.pattern) + '</span>');
    if (res.confidence) pills.push('<span class="pill">Confidence: ' + esc(res.confidence) + '</span>');
    if (res.discordant) pills.push('<span class="pill warn">Discordant parameters</span>');
    head += pills.length ? '<div class="meta">' + pills.join('') + '</div>' : '';

    const rows = res.findings.map((f) => '<tr><td>' + esc(f.label) + '<br><span style="color:var(--muted)">' + esc(f.display) + '</span></td><td>' +
      '<span class="chip ' + gradeClass(f.grade) + '">' + esc(f.grade === null ? 'n/d' : chipNames(f.grade)) + '</span>' +
      (f.specific ? '<span class="spec" title="Specific sign">specific</span>' : '') + '</td></tr>').join('');
    let body = '<table class="params"><tbody>' + rows + '</tbody></table>';

    if (res.derived) {
      const d = res.derived, bits = [];
      if (d.peakGradient !== null && d.peakGradient !== undefined) bits.push('Peak gradient ' + d.peakGradient + ' mmHg');
      if (d.sv !== null && d.sv !== undefined) bits.push('LVOT SV ' + d.sv + ' mL');
      if (d.svi !== null && d.svi !== undefined) bits.push('SVi ' + d.svi + ' mL/m²' + (d.svi < 35 ? ' (low flow)' : ''));
      if (d.avaSource === 'continuity (VTI)') bits.push('AVA (continuity) ' + d.ava + ' cm²');
      if (d.mvaSource) bits.push('MVA from ' + d.mvaSource);
      if (d.wilkins !== null && d.wilkins !== undefined) bits.push('Wilkins ' + d.wilkins + '/16');
      if (bits.length) body += '<p class="derived">' + esc(bits.join(' · ')) + '</p>';
    }
    if (res.notes.length) body += '<h3>Interpretation notes</h3><ul class="notes">' + res.notes.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    if (res.management && res.management.length) body += '<h3>Guideline considerations (2020 ACC/AHA)</h3><ul class="notes mgmt">' + res.management.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    const rep = V.reportText(res);
    if (rep) {
      body += '<div class="report"><div class="row"><h3 style="margin:0">Report text</h3><button type="button" data-copy="' + id + '">Copy</button></div>' +
        '<textarea id="report-' + id + '" readonly>' + esc(rep) + '</textarea></div>';
    }
    el.innerHTML = head + body;
  }

  function renderAS() {
    const r = V.assessAS(Object.assign({}, state.AS, patientInputs()));
    renderResult('AS', r, (g) => AS_CHIP[g]);
  }
  function renderMS() {
    const s = state.MS;
    const w = { mobility: s.w_mobility, thickening: s.w_thickening, calcification: s.w_calcification, subvalvular: s.w_subvalvular };
    const r = V.assessMS(Object.assign({}, s, { wilkins: w, symptomatic: !!state.patient.symptomatic, laThrombus: !!s.laThrombus }));
    renderResult('MS', r, (g) => MS_CHIP[g]);
  }
  function renderRegurg(L) {
    const inp = Object.assign({}, state[L], patientInputs());
    if (L === 'AR' && (inp.lvesdi === undefined || inp.lvesdi === '') && inp.lvesd && bsa()) inp.lvesdi = V.round(inp.lvesd / bsa(), 1);
    const r = V.assessRegurg(L, inp);
    renderResult(L, r, regurgChipLabel);
    renderPisa(L);
  }

  function pisaCalc(L) {
    const p = state['pisa' + L] || {};
    const eroa = V.pisaEROA(p.r, p.alias, p.vmax);
    const rvol = V.regurgVolumeFromEROA(eroa, p.vti);
    const rf = rvol !== null && V.num(p.fsv) ? V.regurgFraction(rvol, rvol + V.num(p.fsv)) : null;
    return { eroa, rvol, rf };
  }
  function renderPisa(L) {
    const c = pisaCalc(L), out = document.getElementById('pisa-out-' + L);
    const bits = [];
    if (c.eroa !== null) bits.push('EROA ' + V.round(c.eroa, 2) + ' cm²');
    if (c.rvol !== null) bits.push('RVol ' + V.round(c.rvol, 0) + ' mL');
    if (c.rf !== null) bits.push('RF ' + V.round(c.rf, 0) + '%');
    out.textContent = bits.join(' · ');
  }

  function renderCalc() {
    const c = state.calc, set = (id, t) => { document.getElementById(id).textContent = t; };
    const sv = V.strokeVolume(c.lvotD, c.lvotVti), ava = V.continuityAVA(c.lvotD, c.lvotVti, c.avVti), dvi = V.dimensionlessIndex(c.lvotVti, c.avVti);
    set('calc-cont', [sv !== null && 'LVOT SV ' + V.round(sv, 0) + ' mL', bsa() && sv !== null && 'SVi ' + V.round(sv / bsa(), 1) + ' mL/m²',
      ava !== null && 'AVA ' + V.round(ava, 2) + ' cm²', ava !== null && bsa() && 'AVAi ' + V.round(ava / bsa(), 2) + ' cm²/m²',
      dvi !== null && 'DVI ' + V.round(dvi, 2)].filter(Boolean).join(' · '));
    const g = V.bernoulli(c.v);
    set('calc-bern', g === null ? '' : 'Gradient ' + V.round(g, 0) + ' mmHg' + (V.num(c.rap) !== null ? ' · PASP ' + V.round(g + V.num(c.rap), 0) + ' mmHg' : ''));
    const e = V.pisaEROA(c.r, c.alias, c.pv), rv = V.regurgVolumeFromEROA(e, c.vti);
    set('calc-pisa', [e !== null && 'EROA ' + V.round(e, 2) + ' cm²', rv !== null && 'RVol ' + V.round(rv, 0) + ' mL'].filter(Boolean).join(' · '));
    const leak = V.num(c.svLeak), fwd = V.num(c.svFwd);
    set('calc-vol', leak && fwd !== null && leak > fwd ? 'RVol ' + V.round(leak - fwd, 0) + ' mL · RF ' + V.round(V.regurgFraction(leak - fwd, leak), 0) + '%' : (leak && fwd !== null ? 'Leaking-valve SV must exceed forward SV' : ''));
    const m = V.mvaFromPHT(c.pht);
    set('calc-pht', m === null ? '' : 'MVA ' + V.round(m, 2) + ' cm²');
  }

  function renderPatient() {
    const b = bsa();
    document.getElementById('patient-derived').textContent = b ? 'BSA ' + V.round(b, 2) + ' m² (Mosteller)' : 'Height and weight enable indexed values (BSA, SVi, AVAi, LVESDi).';
  }

  function renderAll() {
    renderPatient(); renderAS(); renderMS(); ['AR', 'MR', 'TR'].forEach(renderRegurg); renderCalc();
  }
  function renderScope(scope) {
    if (scope === 'patient') return renderAll();
    if (scope === 'AS') return renderAS();
    if (scope === 'MS') return renderMS();
    if (scope === 'calc') return renderCalc();
    if (/^pisa/.test(scope)) return renderPisa(scope.slice(4));
    renderRegurg(scope);
  }

  function selectTab(id) {
    state.tab = id;
    TABS.forEach((t) => {
      document.getElementById('tab-' + t.id).setAttribute('aria-selected', String(t.id === id));
      document.getElementById('panel-' + t.id).hidden = t.id !== id;
    });
    save();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function onInput(e) {
    const t = e.target, scope = t.dataset.scope, key = t.dataset.key;
    if (!scope || !key) return;
    if (!state[scope]) state[scope] = {};
    if (t.type === 'checkbox') state[scope][key] = t.checked;
    else if (t.value === '') delete state[scope][key];
    else state[scope][key] = t.type === 'number' ? parseFloat(t.value) : t.value;
    if (state.example) { state.example = false; renderExampleFlag(); }
    renderScope(scope);
    save();
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onInput(e); });

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) return selectTab(tab.dataset.tab);
    const apply = e.target.closest('[data-pisa-apply]');
    if (apply) {
      const L = apply.dataset.pisaApply, c = pisaCalc(L);
      const put = (k, v, dp) => { if (v === null) return; state[L][k] = V.round(v, dp); const el = document.getElementById(fid(L, k)); if (el) el.value = state[L][k]; };
      put('eroa', c.eroa, 2); put('rvol', c.rvol, 0); if (L !== 'TR') put('rf', c.rf, 0);
      renderRegurg(L); save();
      return;
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const ta = document.getElementById('report-' + copy.dataset.copy);
      const done = () => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); });
      else { ta.select(); document.execCommand('copy'); done(); }
    }
  });

  tabsEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t.id === state.tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    selectTab(next);
    document.getElementById('tab-' + next).focus();
  });

  const resetBtn = document.getElementById('reset');
  let resetArmed = null;
  resetBtn.addEventListener('click', () => {
    if (!resetArmed) {
      resetBtn.textContent = 'Click again to clear';
      resetBtn.classList.add('armed');
      resetArmed = setTimeout(() => { resetArmed = null; resetBtn.textContent = 'Clear all'; resetBtn.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = null;
    resetBtn.textContent = 'Clear all'; resetBtn.classList.remove('armed');
    loadState({ tab: state.tab, patient: {}, AS: {}, MS: {}, AR: {}, MR: {}, TR: {}, calc: {} }, false);
  });
  document.getElementById('load-example').addEventListener('click', () => loadState(exampleState(), true));

  function loadState(next, isExample) {
    state = next;
    state.example = !!isExample;
    save();
    document.getElementById('patient-fields').innerHTML = PATIENT.map((f) => fieldHTML('patient', f)).join('');
    buildPanels(); selectTab(state.tab); renderAll(); renderExampleFlag();
  }
  function renderExampleFlag() { document.getElementById('example-flag').hidden = !state.example; }

  function exampleState() {
    return {
      tab: 'AS', example: true,
      patient: { height: 165, weight: 68, sex: 'F', lvef: 62, symptomatic: true },
      AS: { vmax: 3.6, mg: 32, lvotD: 1.9, lvotVti: 16, avVti: 64, calcium: 1750 },
      MS: { planimetry: 1.2, pht: 190, mg: 8, hr: 72, pasp: 48, mr: 'mild', w_mobility: '2', w_thickening: '2', w_calcification: '2', w_subvalvular: '1' },
      AR: { vc: 0.4, pht: 380, jetRatio: 35, desc: 'intermediate', lvesd: 38 },
      MR: { vc: 0.75, eroa: 0.48, rvol: 72, rf: 54, morph: 'flail', pv: 'reversal', cw: 'triangular', etiology: 'primary', lvesd: 42, pasp: 45 },
      TR: { vc: 1.5, eroa: 0.65, rvol: 62, hv: 'reversal', chambers: 'dilated', annulus: 44 },
      pisaMR: { r: 1.0, alias: 40, vmax: 500, vti: 150, fsv: 60 },
      calc: {},
    };
  }

  if (!hadSaved) {
    const ex = exampleState();
    Object.keys(ex).forEach((k) => { state[k] = ex[k]; });
    document.getElementById('patient-fields').innerHTML = PATIENT.map((f) => fieldHTML('patient', f)).join('');
  }
  buildPanels();
  selectTab(TABS.some((t) => t.id === state.tab) ? state.tab : 'AS');
  renderAll();
  renderExampleFlag();
})();
