/* EP Simulator — course track: localisation from the 12-lead (units l1–l4; see docs/COURSE_AUTHORING.md).
 *
 * Every bench is the static 'ecg' bench of course-kit.js, fed by four recording builders:
 *   recCond  sinus rhythm with a bundle-branch / fascicular pattern (EP.Morph.spec names)
 *   recPvc   sinus beats alternating with a focal beat from any site (bigeminy)
 *   recAp    sinus rhythm with an accessory pathway at a position on an AV ring (EP.Rhythms.apAt)
 *   recPace  complete heart block with P-synchronous ventricular pacing from a site or a fusion of sites
 * `do` steps are checked from the recording itself: EP.qrsFeatures of the beat in question, plus the mean
 * of single leads over a time window (delta wave, terminal R′).
 *
 * Limits of the model that shape the content (each was measured, not assumed):
 *   - a fascicular block swings the axis the right way but not far enough (LAFB ≈ −40°, LPFB ≈ +70°), so
 *     isolated LPFB is never an unknown;
 *   - neighbouring PVC sites that the model (or the surface ECG) cannot separate are never offered against
 *     each other (REG / UNK below), and the two RVOT sites are one answer;
 *   - pathways on the posterior mitral ring, the mid-septum and one stretch of the tricuspid free wall do
 *     not give the textbook delta wave, so the pathway slider visits only the positions in RING;
 *   - pacing from the middle cardiac vein and from the inferoapical LV does not give an RBBB pattern in the
 *     model, so the "RV lead that is not in the RV" case uses the lateral / posterolateral LV sites.
 */
(function (EP) {
  'use strict';
  const C = EP.Course, S = C.S, h = EP.h, { para, list } = C.T, { pick } = C.util;
  const Mo = EP.Morph, R = EP.Rhythms, G = EP.G, M = EP.Model, Lds = EP.Leads;
  const look = S.look, mcq = S.mcq, num = S.num, act = S.act, multi = S.multi;

  // ---- recordings -----------------------------------------------------------------------------------
  const built = (sim, t0, t1) => { const r = EP.Synth.build(sim, t0, t1); r.sim = sim; return r; };
  const ESCAPE = () => ({ id: 'esc', node: 'V', cl: 1820, site: 'fascPost', label: 'escape', startAt: 400, sd: 0.02 });
  /* pat: a Morph pattern name, or 'chb' (all three fascicles blocked: ventricular escape). */
  const recCond = (pat, slow) => R.record({ cfg: () => (pat === 'chb' ? { sinus: { cl: 860, resp: 0 }, hps: { block: true }, foci: [ESCAPE()] }
    : { sinus: { cl: 860, resp: 0 }, hps: { pattern: pat }, vent: slow && slow !== 1 ? { slow } : {} }) }, { dur: 10000 });
  const recPvc = (spec) => built(EP.simulate({ sinus: { cl: 900, resp: 0 }, avn: { fast: { retro: { block: true } } },
    foci: [{ id: 'x', node: 'V', kind: 'coupled', after: 'hps', coupling: 640, every: 1, spec, label: 'PVC' }] }, 10000), 0, 10000);
  const recAp = (ring, deg, slowNode) => built(EP.simulate({ sinus: { cl: 880, resp: 0 }, avn: { fast: { min: slowNode ? 150 : 66 } }, ap: R.apCfg(R.apAt(ring, deg)) }, 10000), 0, 10000);
  /* spec = null: the stimulus does not capture (an escape rhythm is provided). */
  const recPace = (spec) => {
    const sim = new EP.HeartSim({ sinus: { cl: 820, resp: 0 }, avn: { fast: { block: true, retro: { block: true } } }, foci: spec ? [] : [ESCAPE()] });
    new EP.Pacemaker(sim, spec ? { mode: 'DDD', lrl: 60, vSpec: spec, vSite: 'rvApex' } : { mode: 'DDD', lrl: 60, vThr: 9 });
    sim.runUntil(12500); return built(sim, 2000, 12000);
  };

  // ---- measurements ---------------------------------------------------------------------------------
  const NM = () => Lds.names;
  /* Mean of one lead between t0 and t1 ms after the onset of the QRS. */
  const win = (a, l, t0, t1) => {
    const n0 = Math.round(a.on - a.t0), n1 = Math.round(a.off - a.t0); let s = 0, c = 0;
    for (let i = Math.max(0, n0 + t0); i <= Math.min(a.n - 1, n1, n0 + t1); i++) { s += Lds.project(a.vcg[i * 3], a.vcg[i * 3 + 1], a.vcg[i * 3 + 2], l); c++; }
    return c ? s / c : 0;
  };
  const tail = (a, l, ms) => win(a, l, a.off - a.on - ms, a.off - a.on);
  const beat = (rec, label) => rec.events.find((e) => e.type === 'QRS' && e.label === label && e.t > rec.t0 + 1200) || rec.events.find((e) => e.type === 'QRS' && e.label === label);
  /* R.measure plus the features of the first beat with this label: m.f (EP.qrsFeatures), m.act, m.q. */
  const mBeat = (label) => (rec) => { const m = R.measure(rec), q = beat(rec, label); if (q) { m.q = q; m.act = q.act; m.f = EP.qrsFeatures(q.act); } return m; };
  const neg = (f, l) => f.lead[l].area < 0, posi = (f, l) => f.lead[l].area > 0;
  const trans = (f) => (f.negConc ? 'none (all negative)' : f.posConc ? 'none (all positive)' : 'V' + f.trans);
  const readSite = (f) => [['V1', f.v1 === 'L' ? 'negative (LBBB type)' : 'positive (RBBB type)'], ['Axis', f.axis, '°'], ['Inferior leads', f.inferior ? 'positive' : f.superior ? 'negative' : 'mixed'],
    ['R > S from', trans(f)], ['Lead I', f.leadI > 4 ? 'positive' : f.leadI < -4 ? 'negative' : 'flat'], ['QRS', f.qrs, 'ms']];

  // ---- figures for the teaching text (inline SVG, drawn in the text colour) --------------------------
  const fig = (svg, cap) => h('div', { style: { margin: '10px 0 4px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' } }, h('div', { html: svg, style: { flex: '0 0 auto' } }), h('div.muted', { style: { flex: '1 1 220px', fontSize: '13px' } }, cap));
  const HEX = (() => {
    const cx = 120, cy = 104, r = 78, pt = (deg, k) => [cx + r * k * Math.cos(deg * Math.PI / 180), cy + r * k * Math.sin(deg * Math.PI / 180)];
    const leads = [['I', 0], ['II', 60], ['aVF', 90], ['III', 120], ['aVL', -30], ['aVR', -150]];
    let s = '<svg viewBox="0 0 240 216" width="240" height="216" role="img" aria-label="Hexaxial reference: lead I at 0 degrees, II at +60, aVF at +90, III at +120, aVL at −30, aVR at −150" fill="none" stroke="currentColor" font-size="11" font-family="inherit">';
    const a = pt(-30, 1), b = pt(90, 1);
    s += `<path d="M${cx} ${cy} L${a[0].toFixed(1)} ${a[1].toFixed(1)} A${r} ${r} 0 0 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)} Z" fill="currentColor" fill-opacity="0.09" stroke="none"/>`;
    for (const [n, d] of leads) {
      const p = pt(d, 1), q = pt(d + 180, 1), t = pt(d, d === 90 ? 1.3 : 1.2);
      s += `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke-opacity="0.45"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="currentColor" stroke="none"/>`;
      s += `<text x="${t[0].toFixed(1)}" y="${(t[1] + 4).toFixed(1)}" text-anchor="middle" fill="currentColor" stroke="none"><tspan font-weight="600">${n}</tspan> ${d > 0 ? '+' + d : d < 0 ? '−' + -d : '0'}°</text>`;
    }
    return s + '</svg>';
  })();
  const RINGS = (() => {
    const t = (x, y, s, w) => `<text x="${x}" y="${y}" text-anchor="middle" fill="currentColor" stroke="none"${w ? ' font-weight="600"' : ''}>${s}</text>`;
    return '<svg viewBox="0 0 330 190" width="330" height="190" role="img" aria-label="The tricuspid and mitral rings seen from the apex, with the names of the pathway positions" fill="none" stroke="currentColor" font-size="10.5" font-family="inherit">'
      + '<circle cx="108" cy="98" r="46" stroke-opacity="0.6"/><circle cx="222" cy="98" r="46" stroke-opacity="0.6"/>'
      + t(108, 101, 'tricuspid', 1) + t(222, 101, 'mitral', 1) + t(165, 12, 'anterior (top): II, III, aVF positive') + t(165, 186, 'posterior (bottom): III, aVF negative')
      + t(165, 44, 'anteroseptal') + t(165, 158, 'posteroseptal') + t(70, 36, 'right anterior') + t(70, 166, 'right posterior') + t(260, 36, 'left anterior') + t(260, 166, 'left posterior')
      + t(30, 101, 'right') + t(30, 113, 'lateral') + t(300, 101, 'left') + t(300, 113, 'lateral') + '</svg>';
  })();

  // =====================================================================================================
  // l1  conduction: three fascicles
  // =====================================================================================================
  const patOf = (p) => (p.laf && p.lpf ? (p.rbb ? 'chb' : 'lbbb') : (p.rbb ? 'rbbb' + (p.laf || p.lpf ? '+' : '') : '') + (p.laf ? 'lafb' : p.lpf ? 'lpfb' : '') || 'normal');
  const PAT = {
    normal: 'Normal conduction', rbbb: 'Right bundle branch block', lbbb: 'Left bundle branch block', lafb: 'Left anterior fascicular block', lpfb: 'Left posterior fascicular block',
    'rbbb+lafb': 'RBBB + LAFB (bifascicular block)', 'rbbb+lpfb': 'RBBB + LPFB (bifascicular block)', chb: 'Complete block below the His bundle',
  };
  const LEFT = { rbbb: 'The whole left bundle, via both of its fascicles', lbbb: 'The right bundle branch and nothing else', 'rbbb+lafb': 'The left posterior fascicle and nothing else',
    'rbbb+lpfb': 'The left anterior fascicle and nothing else', lafb: 'The right bundle and the left posterior fascicle' };
  const mCond = (rec) => { const m = mBeat('conducted')(rec); if (m.act) m.v1end = tail(m.act, 6, 40); return m; };
  const FASC = [{ k: 'rbb', label: 'Block the right bundle branch', toggle: true }, { k: 'laf', label: 'Block the left anterior fascicle', toggle: true }, { k: 'lpf', label: 'Block the left posterior fascicle', toggle: true }];
  const condBench = (p, sw) => ({ kind: 'ecg', layout: '12', title: '12-lead ECG: sinus rhythm', make: (q) => recCond(q.pat || patOf(q), q.slow), p: Object.assign({ rbb: false, laf: false, lpf: false }, p), ctl: sw ? FASC : [], measure: mCond,
    cap: sw ? 'Three fascicles carry the impulse from the His bundle to the ventricles. The model swings the axis the right way in a fascicular block, but less far than in a patient.' : '',
    read: (rec, q, m) => [['Conduction', PAT[q.pat || patOf(q)]], ['QRS', m.f ? m.f.qrs : m.qrs, 'ms'], ['Axis', m.f ? m.f.axis : m.axis, '°'], ['PR', m.pr, 'ms']] });
  const leadName = (n) => (n[0] === 'a' ? n : 'lead ' + n), cap1 = (t) => t[0].toUpperCase() + t.slice(1);
  const LEADS6 = [['I', 0], ['II', 60], ['III', 120], ['aVR', -150], ['aVL', -30], ['aVF', 90]];
  const deg = (d) => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) + '°';
  /* The working for an axis estimate, written from the tracing that is on the bench. */
  const axisWhy = (b) => {
    const f = b.m.f; if (!f) return '';
    let k = 0; for (let i = 1; i < 6; i++) if (Math.abs(f.lead[i].area) < Math.abs(f.lead[k].area)) k = i;
    const perp = [LEADS6[k][1] + 90, LEADS6[k][1] - 90].map((d) => (d > 180 ? d - 360 : d <= -180 ? d + 360 : d)), d = (x) => Math.abs(((x - f.axis + 540) % 360) - 180);
    const near = d(perp[0]) < d(perp[1]) ? perp[0] : perp[1], off = Math.round(f.axis - near), nm = leadName(LEADS6[k][0]);
    return `About ${deg(f.axis)}. Lead I is net ${posi(f, 0) ? 'positive' : 'negative'} and aVF net ${posi(f, 5) ? 'positive' : 'negative'}, which gives the quadrant. The limb lead with the smallest net deflection is ${nm} (it points to ${deg(LEADS6[k][1])}), so the axis is close to a right angle from it: ${deg(near)}${Math.abs(off) >= 5 ? `, and because ${nm} is slightly ${f.lead[k].area > 0 ? 'positive' : 'negative'} rather than flat, a little ${off > 0 ? 'clockwise' : 'anticlockwise'} of that` : ''}. Judge the net area of each QRS, not the height of its tallest wave.`;
  };
  const ISO = [['aVL', 'lead II is positive', '+60°', ['−120°', '−30°', '+150°'], '−30°'], ['II', 'lead I is positive', '−30°', ['+150°', '+60°', '−120°'], '+60°'], ['aVR', 'lead I is positive', '−60°', ['+120°', '−150°', '+30°'], '−150°'],
    ['III', 'lead I is positive', '+30°', ['−150°', '+120°', '−60°'], '+120°'], ['I', 'aVF is negative', '−90°', ['+90°', '0°', '180°'], '0°'], ['aVF', 'lead I is negative', '180°', ['0°', '+90°', '−90°'], '+90°']];

  const L1 = { id: 'l1', title: 'The QRS as a vector: bundle branch block, fascicular block and axis', short: 'QRS vector',
    goal: 'Build the QRS of each bundle branch and fascicular block from the order of activation, and work out the axis from two leads.',
    teach: () => [
      para('One rule builds everything in this course: **a lead writes a positive deflection for as long as the wavefront of depolarisation travels towards it**, a negative one while it travels away, and nothing while it travels across. The size depends on how much muscle is being activated at that moment and how squarely it is aimed at the lead.'),
      fig(HEX, 'The six limb leads as directions in the frontal plane. Positive angles run clockwise from lead I. The shaded sector is the normal QRS axis, −30° to +90°.'),
      list(['**Where the leads look from.** V1 sits in front and to the right, over the right ventricle and the septum. V6, I and aVL look from the left. II, III and aVF look from below, aVR from the right shoulder.',
        '**The normal order.** The septum first, from left to right: a small r in V1, a small q in I, aVL and V6. Then both ventricles together; the left has more muscle, so the sum points left, down and back: S in V1, R in V6. The Purkinje network starts almost the whole endocardium at once, so it is over in 80–100 ms.',
        '**Right bundle branch block.** The septum and left ventricle are activated as usual, so the start of the QRS keeps its shape. The right ventricle is then reached late, through muscle, with nothing to oppose it: a slow terminal force to the right and front. V1 gains a late R′; I and V6 gain a wide, slurred S. QRS ≥ 120 ms.',
        '**Left bundle branch block.** The septum is now activated from the right bundle, right to left: the q in I and V6 is lost, and the r in V1 shrinks or disappears. The left ventricle is then crossed slowly through muscle, so every force points left and back for the whole QRS: QS or rS in V1 and a broad R without a q in I, aVL and V6. The first millisecond is already abnormal, so Q waves and ST segments cannot be read by the usual rules.',
        '**The fascicles.** The left bundle divides into an anterior fascicle (anterior and superior wall) and a posterior one (inferior and posterior wall). Block one, and the left ventricle is started by the other and finished in the territory of the blocked one. The route is still Purkinje, so the QRS widens by only about 20 ms, but the main force swings towards the region activated last.',
        '**Left anterior fascicular block** starts below (small r in II, III, aVF; q in I, aVL) and ends above and to the left: deep S in II, III, aVF, tall R in aVL, axis −45° to −90°. **Left posterior fascicular block** is the mirror image: rS in I and aVL, qR in III, axis to the right of +90°. It is rare alone and is diagnosed only after right ventricular overload, lateral infarction and a vertical heart have been excluded.',
        '**Bifascicular block** is RBBB with one fascicle: a left axis for the anterior fascicle, a right axis for the posterior. Conduction to the ventricles then rests on the one fascicle that is left.',
        '**The axis from two leads.** I and aVF are at right angles and give the quadrant. Then find the limb lead with the smallest net deflection: the axis is at right angles to it. Lead II (+60°) is at right angles to −30°, so with a positive lead I a net negative II means left axis deviation.'])],
    steps: () => {
      const wide = pick([['rbbb', 1], ['rbbb', 1.15], ['rbbb', 1.3], ['rbbb+lafb', 1.15], ['rbbb+lafb', 1.3], ['lbbb', 1]]);
      const iso = pick(ISO), ax = pick(['normal', 'lafb', 'lpfb', 'rbbb+lafb', 'rbbb+lpfb', 'lbbb']), unk = pick(['rbbb', 'lbbb', 'rbbb+lafb', 'rbbb+lpfb', 'lafb']);
      const UW = {
        rbbb: 'V1 ends with a broad R′ and I and V6 with a wide S: a late, slow force to the right and front, which is the right ventricle being reached through muscle. The start of the QRS and the axis are normal, so both left fascicles are working.',
        lbbb: 'V1 is negative from the first millisecond and I, aVL and V6 are a broad R with no q wave: the septum is activated from right to left and the left ventricle through muscle. Both fascicles of the left bundle have failed, or the bundle before it divides.',
        'rbbb+lafb': 'The terminal R′ in V1 and the wide S in I and V6 are RBBB. The limb leads add a second fault: II, III and aVF are mainly negative and aVL is tall, an axis far to the left, so the left ventricle is being activated from below upwards. Read the axis from the first 80 ms, before the right ventricular forces arrive.',
        'rbbb+lpfb': 'The terminal R′ in V1 is RBBB. Lead I is mainly negative and III is tall: a right axis, so the left ventricle is being activated from above downwards. This is the rarer bifascicular block: the posterior fascicle is broad and has a double blood supply, so its failure implies extensive disease. The diagnosis assumes that right ventricular overload and lateral infarction have been excluded.',
        lafb: 'The QRS is narrow, so both bundle branches conduct. But II, III and aVF are rS and aVL is qR: the axis is to the left of −30°. The left ventricle is started by the posterior fascicle, below, and finished above and to the left.' };
      return [
        look('Normal activation, lead by lead', 'Sinus rhythm, normal conduction. V1 starts with a small r: the septum is activated first, left to right, towards V1. Then the deep S: the left ventricle outweighs the right, and the sum points left and back, away from V1. V6 is the reverse: a small septal q, then a tall R. The QRS is over in about 80 ms. In the limb leads I and II are both upright and III is nearly flat, so the axis is about +30°.', condBench({ pat: 'normal' })),
        mcq('rbbb-predict', 'Predict: block the right bundle', 'The right bundle is about to be blocked in a heart with normal conduction. The left bundle is intact. Which part of the QRS will change?',
          ['The end: a late, slow force to the right and front is added', 'The start: the r wave in V1 and the q wave in V6 are both lost', 'All of it: every force now points to the left and backwards', 'The axis: it swings to the left of −30° with no widening'],
          'The septum and the left ventricle are still reached through the left bundle, so the start of the QRS keeps its shape. The right ventricle is then activated late, through muscle, unopposed. Losing the septal r and q is what left bundle branch block does; a swing of the axis without widening is a fascicular block.'),
        look('See it', 'The right bundle is blocked. V1: the first R wave and the S are still there, then a broad second positive wave (R′) that lasts to the end of the QRS. I and V6: the usual q and R, then a wide, shallow S over the same late period. That late part is the right ventricle, activated from the left through muscle; V1 sees it coming, I and V6 see it leaving.', condBench({ pat: 'rbbb' })),
        num('qrs-dur', 'Measure the QRS', 'Drag across one QRS to measure its duration, from the first deflection to the end of the last slow wave. Use the lead in which it looks widest.', (b) => b.m.f.qrs, 22, 'ms',
          (b) => `${b.m.f.qrs} ms. The slow terminal part belongs to the QRS, and it is easy to cut short in a lead where it runs along the baseline: measure where the QRS is widest. 120 ms or more with a supraventricular rhythm means that one ventricle is being activated through muscle and not through its bundle branch.`, { bench: condBench({ pat: wide[0], slow: wide[1] }) }),
        act('bifasc-make', 'Make a bifascicular block', 'Use the three switches. Produce a QRS of 120 ms or more that ends with an R′ in V1 and has an axis to the left of −30° (II and aVF mainly negative, I positive).', { bench: condBench({}, true),
          check: (x) => !!x.m.f && x.m.f.qrs >= 120 && x.m.v1end > 0.1 && neg(x.m.f, 1) && neg(x.m.f, 5) && posi(x.m.f, 0), solve: (b) => { b.set('lpf', false); b.set('rbb', true); b.set('laf', true); },
          live: (x) => ({ rbbb: 'The R′ in V1 is there, but the axis has not moved: both left fascicles still work.', lafb: 'The axis is to the left, but the QRS is narrow and V1 has no R′.', lpfb: 'The axis has swung to the right, not the left, and the QRS is narrow.',
            'rbbb+lpfb': 'RBBB with a right axis: the wrong fascicle.', lbbb: 'V1 is now negative throughout: this is left bundle branch block.', chb: 'All three are blocked, so nothing conducts: P waves, and a slow ventricular escape.' }[patOf(x.p)] || null),
          hint: 'The R′ needs the right ventricle to be late. A left axis needs the left ventricle to be finished above and to the left, in the territory of one fascicle.',
          why: 'RBBB with left anterior fascicular block. The R′ and the wide S in I and V6 are the late right ventricle. The left axis is the left ventricle, activated from the posterior fascicle upwards. One fascicle now carries every beat.' }),
        act('lbbb-make', 'Make a left bundle branch block', 'There is no switch for the left bundle itself. Produce left bundle branch block: a QRS of 120 ms or more, V1 negative throughout, and no S wave in lead I.', { bench: condBench({}, true),
          check: (x) => !!x.m.f && x.m.f.qrs >= 120 && x.m.f.lead[6].r < 0.08 && x.m.f.lead[0].s < 0.05, solve: (b) => { b.set('rbb', false); b.set('laf', true); b.set('lpf', true); },
          live: (x) => ({ rbbb: 'V1 ends with an R′: the right ventricle is late, not the left.', lafb: 'One fascicle: the axis moves, but the QRS stays narrow because the other fascicle still feeds the Purkinje network.', lpfb: 'One fascicle: the axis moves, but the QRS stays narrow because the other fascicle still feeds the Purkinje network.',
            'rbbb+lafb': 'This is a bifascicular block: V1 still ends with an R′.', 'rbbb+lpfb': 'This is a bifascicular block: V1 still ends with an R′.', chb: 'All three are blocked, so nothing conducts.' }[patOf(x.p)] || null),
          hint: 'The left bundle is its fascicles.', why: 'With both fascicles blocked the left ventricle can be reached only through the septum, from the right bundle. The septal r in V1 and the q in I and V6 go, and the left ventricle is crossed slowly through muscle: every force points left and back for the whole QRS. Add the third switch and nothing conducts at all, which is why bifascicular block matters.' }),
        mcq('iso-lead', 'The axis from the flattest lead', `The QRS is equiphasic (as much above the line as below) in ${leadName(iso[0])}, and ${iso[1]}. What is the frontal axis?`, [iso[2]].concat(iso[3]),
          `The axis is at right angles to the lead that shows no net deflection. ${cap1(leadName(iso[0]))} points to ${iso[4]}, so the axis is 90° to one side of it or the other; ${iso[1]}, which settles it: ${iso[2]}. The common mistake is to give the direction of the flat lead itself.`),
        num('axis-est', 'Estimate the axis', 'Estimate the frontal QRS axis of this tracing from the limb leads, in degrees (lead I is 0°; negative values lie above it, towards aVL).', (b) => b.m.f.axis, 25, '°', axisWhy, { bench: condBench({ pat: ax }) }),
        multi('ivcd-unknown', 'Unknown conduction pattern', 'Sinus rhythm. Read V1 and V6 for the bundle branches, then the limb leads for the fascicles.', [
          ['What is the conduction abnormality?', PAT[unk], Object.keys(PAT).filter((k) => k !== unk && k !== 'chb').map((k) => PAT[k]), UW[unk], true],
          ['What still carries the impulse to the ventricles?', LEFT[unk], Object.keys(LEFT).filter((k) => k !== unk).map((k) => LEFT[k]), 'Count what is left of the three: the right bundle, the left anterior fascicle and the left posterior fascicle. Whatever the tracing shows as late or mis-directed has failed.'],
        ], { bench: condBench({ pat: unk }), tDone: 'Unknown: ' + PAT[unk], why: UW[unk] }),
        mcq('bifasc-syncope', 'Why the pattern matters', 'A 76-year-old has had two abrupt syncopal episodes. ECG: sinus rhythm, PR 230 ms, RBBB, axis −65°. What does the ECG suggest about the mechanism?',
          ['Only one fascicle conducts: intermittent block below the node', 'The AV node is diseased: Wenckebach block at night, with pauses', 'The right ventricle is strained: recurrent pulmonary embolism', 'The pattern is incidental: a reflex faint is the likeliest cause'],
          'RBBB with left anterior fascicular block leaves the left posterior fascicle as the only route. Block there is all-or-none with a slow, unreliable escape: the substrate of Mobitz II and of abrupt complete block. The long PR does not locate the delay; it may be in the node or in the last fascicle. Syncope with bifascicular block is investigated or treated as intermittent high-grade block until shown otherwise; whether an electrophysiological study, monitoring or pacing comes first varies.'),
      ];
    } };

  // =====================================================================================================
  // l2  PVC / VT origin
  // =====================================================================================================
  /* Answers at the grain the 12-lead supports. `no` lists the regions a shown site must not be offered against. */
  const REG = { rvot: 'RV outflow tract', lvot: 'LV outflow tract or aortic cusp', rvApex: 'RV apex', rvFree: 'RV free wall (body)', lvApex: 'LV apex', infBase: 'Basal inferior LV', latMA: 'Lateral mitral annulus',
    antMA: 'Anterior mitral annulus', postFasc: 'Posteromedial papillary muscle or fascicle', antFasc: 'Anterolateral papillary muscle or fascicle' };
  const UNK = {
    rvotFree: { reg: 'rvot', no: [], why: 'V1 is negative throughout: the right ventricle or septum is first. II, III and aVF are tall and positive, so the origin is at the top of the heart: an outflow tract. The chest leads stay negative as far as V3, a late transition, so the origin lies in front, directly under V1–V3: the right ventricular outflow tract. A focus in the LV outflow tract or a cusp lies further back and shows its R wave earlier, usually by V2.' },
    lvotSeptal: { reg: 'lvot', no: ['antMA'], why: 'II, III and aVF are tall and positive: an outflow tract. V1 is mainly negative, but it already has an r wave, and the R is dominant from V2. A transition this early means the origin is behind the right ventricular outflow tract: the LV outflow tract or an aortic cusp. An LBBB-like V1 does not prove a right ventricular origin until the transition has been read.' },
    mitralLat: { reg: 'latMA', no: ['antFasc', 'antMA'], why: 'V1 is a tall, single R: the left ventricle is first, from far behind and to the left. Lead I is QS: the wave runs from left to right, so the origin is on the lateral wall. R waves last across to V4 and are lost only in V5–V6, the electrodes that lie over the lateral wall: a basal lateral origin. The QRS is very wide because the lateral free wall is as far from the septum and the Purkinje network as a focus can be.' },
    rvApex: { reg: 'rvApex', no: ['rvFree'], why: 'V1 to V3 are QS and V4 is nearly flat: the right ventricle is first and the wave runs away from the front of the chest. II, III and aVF are QS: the wave travels upwards from the bottom of the heart. I and aVL are positive: right to left. LBBB pattern, superior axis and late transition make the RV apex. Apical pacing looks the same.' },
    lvInfBase: { reg: 'infBase', no: [], why: 'V1 is positive: the left ventricle is first. III and aVF are QS and II is negative: the origin is on the inferior wall. Every chest lead is positive (positive concordance): the wave travels from the base towards the apex and the chest wall, so the origin is basal. This is the inferobasal left ventricle or the posterior mitral annulus, the usual exit of VT after inferior infarction.' },
    papPM: { reg: 'postFasc', no: [], why: 'V1 is positive: the left ventricle. II, III and aVF are negative: the inferior wall. But the R waves do not last across the chest: V5 and V6 are negative, so the origin is in the body of the ventricle, nearer the apex than the base. Inferior and mid-ventricular means the posteromedial papillary muscle or the posterior fascicle beside it. The 12-lead does not separate those two reliably; a fascicular beat is usually the narrower.' },
    lvApex: { reg: 'lvApex', no: [], why: 'No chest lead has a dominant R wave (negative concordance): the wave runs away from every chest electrode, so it starts at the apex. II, III and aVF are negative for the same reason. Lead I is small and negative and aVR is upright, so the origin is on the left side of the apex, not the right. At the apex V1 is a poor guide to the chamber; concordance and lead I do the work.' },
  };
  const regOpts = (k) => Object.keys(REG).filter((r) => r !== UNK[k].reg && UNK[k].no.indexOf(r) < 0).map((r) => REG[r]);
  const mPvc = mBeat('PVC');
  const pvcBench = (site) => ({ kind: 'ecg', layout: '12', title: '12-lead ECG: sinus beats alternating with ectopic beats', make: () => recPvc(typeof site === 'function' ? site() : Mo.spec(site)), p: {}, ctl: [], measure: mPvc, read: (rec, p, m) => (m.f ? readSite(m.f) : []) });
  const unkStep = (key, title, k) => mcq(key, title, 'Each sinus beat is followed by an ectopic beat. Read the ectopic beat in order: V1, the inferior leads, the chest-lead transition, lead I, the width. Where does it arise?',
    [REG[UNK[k].reg]].concat(regOpts(k)), UNK[k].why, { many: true, bench: pvcBench(k) });

  /* Predict-then-see: three predictions for a named site, each checked against the model. */
  const V1O = ['Mainly negative: an LBBB-like pattern', 'Mainly positive: an RBBB-like pattern', 'Equiphasic: R and S of equal size'];
  const INFO = ['Positive: R waves in II, III and aVF', 'Negative: QS waves in II, III and aVF', 'Mixed: positive in II, negative in III'];
  const TRO = ['Late: negative as far as V3 or beyond', 'None: R waves in every lead, V1 to V6', 'Early: R waves in V1 to V3, then lost'];
  const PRED = [
    { k: 'rvApex', name: 'the apex of the right ventricle', v1: 0, inf: 1, q3: ['And the chest leads?', TRO[0], [TRO[1], TRO[2]], 'The apex is the point furthest from the chest electrodes on the path of the wave, so they stay negative until V5.'],
      seen: 'The RV apex. V1–V3 are QS and V4 is nearly flat, II, III and aVF are QS, I and aVL are upright, and R waves appear only in V5–V6.' },
    { k: 'lvInfBase', name: 'the basal inferior wall of the left ventricle', v1: 1, inf: 1, q3: ['And the chest leads?', TRO[1], [TRO[0], TRO[2]], 'From the base the wave travels towards the apex and the chest wall: every chest lead sees it coming. Positive concordance marks a basal origin.'],
      seen: 'The inferobasal left ventricle. V1 is positive, III and aVF are QS (II is negative but small), and every chest lead from V1 to V6 is upright.' },
    { k: 'mitralLat', spec: () => lvSpec({ ang: 210, lvl: 0 }), name: 'the anterolateral mitral annulus, the upper outer part of the ring', v1: 1, inf: 0, q3: ['And lead I?', 'Negative: the wave runs from left to right', ['Positive: the wave runs from right to left', 'Flat: the origin is close to the midline'], 'Lead I looks from the left. A focus on the lateral wall sends the wave away from it.'],
      seen: 'The anterolateral mitral annulus. V1 is a tall single R, lead I is QS, II, III and aVF are upright, and the R waves are lost only in V5–V6.' },
  ];

  /* The focus-placing bench: a point on the left ventricle from two sliders. ang: 0 septum, 90 inferior, 180 lateral, 270 anterior. */
  const WALL = ['septum', 'inferoseptal wall', 'inferior wall', 'inferolateral wall', 'lateral wall', 'anterolateral wall', 'anterior wall', 'anteroseptal wall'];
  const lvName = (p) => (p.lvl >= 10 ? 'the apex' : (p.lvl <= 2 ? 'basal ' : p.lvl <= 6 ? 'mid ' : 'apical ') + WALL[Math.round(p.ang / 45) % 8]);
  const lvSpec = (p) => {
    const a = 0.4 + 0.7 * p.lvl, r = 3.4 * Math.sqrt(Math.max(0.05, 1 - (a / 8.2) * (a / 8.2))), th = p.ang * Math.PI / 180;
    return Mo.siteSpec({ p: M.pos(M.nearest(G.L(r * Math.cos(th), r * Math.sin(th), a), 'epi')), kind: 'any' });
  };
  const lvBench = (p) => ({ kind: 'ecg', layout: '12', title: '12-lead ECG: ectopic beats from the site you set', p: Object.assign({ ang: 0, lvl: 5 }, p), measure: mPvc,
    make: (q, b) => { if (b && b.cap) b.cap.textContent = 'Focus: left ventricle, ' + lvName(q) + '. Each sinus beat is followed by a beat from the focus.'; return recPvc(lvSpec(q)); },
    ctl: [{ k: 'ang', label: 'Wall: 0° septum, 90° inferior, 180° lateral, 270° anterior', min: 0, max: 345, step: 15, unit: '°' }, { k: 'lvl', label: 'Level: 0 at the base, 10 at the apex', min: 0, max: 10, step: 1 }],
    read: (rec, q, m) => (m.f ? [['Focus', lvName(q)]].concat(readSite(m.f)) : []) });
  const PLACE = [
    { want: 'positive in V1, negative in II, III and aVF, and upright in every chest lead from V1 to V6', sol: { ang: 90, lvl: 1 },
      parts: [['V1', (f) => f.v1 === 'R'], ['the inferior leads', (f) => f.superior], ['the chest leads', (f) => f.posConc]],
      why: 'The basal inferior wall. Positive V1: left ventricle. Negative inferior leads: the wave travels up from the inferior wall. Positive concordance: it travels from the base towards the apex and the chest. Slide the focus towards the apex and watch V6, then V5, turn negative.' },
    { want: 'negative in every chest lead from V1 to V6, and negative in II, III and aVF', sol: { ang: 90, lvl: 10 },
      parts: [['the chest leads', (f) => f.negConc], ['the inferior leads', (f) => f.superior]],
      why: 'The apex. From there the wave travels towards the base and away from every chest electrode (negative concordance) and upwards (negative inferior leads). At the apex V1 no longer tells you the chamber.' },
    { want: 'positive in V1, upright in II, III and aVF, and QS in lead I', sol: { ang: 195, lvl: 1 },
      parts: [['V1', (f) => f.v1 === 'R'], ['the inferior leads', (f) => f.inferior], ['lead I', (f) => f.lead[0].r < 0.08 && f.leadI < -4]],
      why: 'The basal lateral or anterolateral wall. Positive V1: left ventricle, from behind. QS in lead I: the wave runs from the far left towards the right. Upright inferior leads: it starts above the middle of the ventricle and travels down.' },
  ];
  /* One-line coaching for the matching tasks: which named features of the target are present. */
  const coach = (parts, v) => { const ok = parts.filter((q) => q[1](v)).map((q) => q[0]), no = parts.filter((q) => !q[1](v)).map((q) => q[0]); return (ok.length ? 'Matches the target: ' + ok.join(', ') + '. ' : '') + (no.length ? 'Not yet: ' + no.join(', ') + '.' : ''); };

  const L2 = { id: 'l2', title: 'Where a PVC or VT comes from', short: 'PVC and VT origin',
    goal: 'Read a ventricular beat in a fixed order (V1, inferior leads, transition, lead I, width) and name the region it comes from.',
    teach: () => [
      para('A ventricular ectopic beat starts at one point and spreads from it, mostly through muscle. So the QRS vector points **away from the origin**: leads on the same side as the focus are negative, leads on the far side are positive. Ask each group of leads in turn whether the focus is on its side.'),
      list(['**V1: which side goes first.** V1 looks from the front and right. Negative (LBBB-like): the wave starts in front or to the right, in the right ventricle, the septum or an outflow tract. Positive (RBBB-like): it starts behind and to the left, in the body of the left ventricle.',
        '**II, III, aVF: how high.** The outflow tracts are the top of the heart, so the wave travels down and the inferior leads show tall R waves. The apex and the inferior wall are the bottom: the wave travels up, and the inferior leads are QS.',
        '**The chest leads: base or apex, front or back.** From the base the wave runs towards the apex and the chest wall: R waves in every chest lead (positive concordance). From the apex it runs away from all of them (negative concordance). In between, the earlier the R wave becomes dominant, the further back or the more basal the origin.',
        '**The outflow tracts** share an LBBB-like V1 and tall inferior R waves. The RV outflow tract is the most anterior structure in the heart, directly under V1–V3, so the transition is late (V3–V4 or beyond). The LV outflow tract and aortic cusps lie behind it: transition by V2. V3 is the grey zone; the sinus beat on the same tracing is the control.',
        '**Lead I: left or right.** A focus far to the left (lateral LV, lateral mitral annulus) gives a QS in lead I. A focus far to the right (RV free wall) gives a tall R. Septal and outflow sites give a small lead I.',
        '**Width and onset.** A focus in or beside the Purkinje network (a fascicle, the septum) reaches both ventricles quickly: a relatively narrow QRS with a brisk start. A free-wall focus is wide; an epicardial one is widest, with a slurred start.',
        '**What you get is a region, not a point.** The 12-lead narrows the origin to a few centimetres. Neighbours overlap (a papillary muscle and the fascicle beside it; the left coronary cusp and the anterior mitral annulus), and in scar-related VT the QRS marks where the wave leaves the scar, not the circuit inside it.'])],
    steps: () => {
      const pr = pick(PRED), pl = pick(PLACE);
      const not = (a) => a.filter((k) => k !== pr.k), top = pick(not(['rvotFree', 'lvotSeptal', 'mitralLat'])), low = pick(not(['rvApex', 'lvInfBase', 'papPM', 'lvApex']));
      const fin = pick(not(['rvotFree', 'lvotSeptal', 'mitralLat', 'rvApex', 'lvInfBase', 'papPM']).filter((k) => k !== top && k !== low)), F = UNK[fin];
      const left = fin === 'mitralLat' || fin === 'lvInfBase' || fin === 'papPM', high = fin === 'rvotFree' || fin === 'lvotSeptal' || fin === 'mitralLat';
      return [
        look('Read one beat in order', 'Each sinus beat is followed by a PVC. Read the PVC, not the sinus beat. V1 is negative throughout: the wave starts in front, in the right ventricle or septum, and leaves V1. II, III and aVF are tall: it starts at the top and travels down. aVR and aVL are both negative: high and near the midline. V1 and V2 are QS and the R wave appears at V3. Lead I is small. LBBB-like V1 with tall inferior R waves is an outflow tract; no r wave at all in V1 and V2, with the transition at V3 or later, points to the right one.', pvcBench('rvotSeptal')),
        multi('site-predict', 'Predict the QRS from the site', `A different focus now: an ectopic beat arises from ${pr.name}. Predict what it will look like before you see it. (Any tracing still on the bench belongs to the last step.)`, [
          ['V1?', V1O[pr.v1], V1O.filter((x, i) => i !== pr.v1), pr.v1 ? 'The left ventricle is behind and to the left of V1: the wave travels towards it.' : 'The right ventricle lies in front, under V1: the wave starts there and leaves.'],
          ['II, III and aVF?', INFO[pr.inf], INFO.filter((x, i) => i !== pr.inf), pr.inf ? 'The origin is low, so the wave travels up, away from the inferior leads.' : 'The origin is above the middle of the ventricles, so the wave travels down towards the inferior leads.'],
          pr.q3], { tDone: 'Predicted: ' + pr.name.split(',')[0], why: 'Work from the position of the focus to each group of leads: V1 for front-right against back-left, the inferior leads for height, the chest leads for base against apex, lead I for left against right.' }),
        look('See it', pr.seen + ' Check each of your three predictions against the tracing.', pvcBench(pr.spec || pr.k)),
        act('place-focus', 'Put the focus where the ECG says', `Move the focus round the left ventricle and between base and apex until the ectopic beat is ${pl.want}.`, { bench: lvBench({}),
          check: (x) => !!x.m.f && x.changes > 0 && pl.parts.every((q) => q[1](x.m.f)), solve: (b) => { b.set('ang', pl.sol.ang); b.set('lvl', pl.sol.lvl); },
          live: (x) => (x.m.f && x.changes ? coach(pl.parts, x.m.f) : null),
          hint: 'Take the features one at a time. V1 chooses between the septal and the free-wall side, the inferior leads between the anterior and the inferior wall, and the chest leads between base and apex.', why: pl.why }),
        mcq('width', 'What the width adds', 'Two ectopic beats have the same pattern: positive in V1 with QS in II, III and aVF. Beat A is 130 ms wide with a brisk first deflection. Beat B is 165 ms wide. What is the most useful inference?',
          ['A starts in or beside the Purkinje network: a fascicle', 'A starts on the epicardium, far from the Purkinje network', 'B starts in the septum, where both ventricles are reached', 'Neither: the width reflects heart size and not the origin'],
          'A focus that enters the conduction system early is distributed by it, so both ventricles are reached quickly and the first deflection is brisk: fascicular VT is typically less than 140 ms wide. A focus in working muscle, such as a papillary muscle or the free wall, is wider, and an epicardial focus is the widest, with a slurred start.'),
        unkStep('unk-high', 'Unknown 1', top),
        unkStep('unk-low', 'Unknown 2', low),
        mcq('v3-control', 'The grey zone at V3', 'A PVC has an LBBB-like V1, tall R waves in II, III and aVF, and its chest-lead transition at V3. In the sinus beats of the same tracing the transition is at V2. Where is the PVC most likely to arise?',
          ['RV outflow tract: the PVC transition is later than the sinus one', 'LV outflow tract: a transition at V3 or earlier is left-sided', 'Either: a transition at V3 cannot be taken any further', 'Aortic cusp: an early sinus transition shows a rotated heart'],
          'The sinus beat is the control for the position of the heart and of the electrodes. A PVC whose transition is later than the sinus transition comes from the RV outflow tract. One that transitions earlier than sinus suggests the LV outflow tract or a cusp, and is refined by comparing the R and S in V2 with the sinus beat (the V2 transition ratio).'),
        multi('unk-read', 'Unknown 3: the full read', 'Each sinus beat is followed by an ectopic beat. Go through the read step by step.', [
          ['V1: where does the wave start?', left ? 'Behind and to the left: the body of the LV' : 'In front or to the right: RV, septum, outflow', [left ? 'In front or to the right: RV, septum, outflow' : 'Behind and to the left: the body of the LV', 'It cannot be told from V1: it is equiphasic here'], left ? 'V1 is mainly positive: the wave travels towards it.' : 'V1 is mainly negative: the wave leaves it.'],
          ['II, III and aVF: which way does it travel?', high ? 'Downwards: the origin is in the upper half of the heart' : 'Upwards: the origin is in the lower half of the heart', [high ? 'Upwards: the origin is in the lower half of the heart' : 'Downwards: the origin is in the upper half of the heart', 'Neither way: the inferior leads are flat in this tracing'], high ? 'The inferior leads are upright.' : 'The inferior leads are mainly negative.'],
          ['Where does the beat arise?', REG[F.reg], regOpts(fin), F.why, true],
        ], { bench: pvcBench(fin), tDone: 'Unknown 3: ' + REG[F.reg], why: F.why }),
        mcq('scar-exit', 'What the QRS marks in scar-related VT', 'A patient with an old inferior infarct has monomorphic VT: positive in V1, QS in II, III and aVF, R waves from V1 to V6. What does this 12-lead localise?',
          ['The exit: where the wave leaves the scar, at the inferior base', 'The isthmus: it lies beneath the lead with the tallest R wave', 'The entrance: on the apical side of the scar, facing V6', 'The artery: positive concordance marks the circumflex'],
          'The surface QRS begins when the wave emerges from the protected channel into enough healthy muscle to register. The isthmus itself is silent on the 12-lead and may lie centimetres from the exit. Read the exit as you would a PVC: positive V1 is left ventricle, a superior axis is the inferior wall, and positive concordance is the base.'),
      ];
    } };

  // =====================================================================================================
  // l3  accessory pathways
  // =====================================================================================================
  /* Ring positions the model renders faithfully, in order round the two rings. Left posterior positions and the mid-septum are left out. */
  const RING = [['tricuspid', 0, 'right lateral'], ['tricuspid', 330, 'right anterolateral'], ['tricuspid', 300, 'right anterior'], ['tricuspid', 270, 'right anterior'], ['tricuspid', 240, 'anteroseptal'], ['tricuspid', 225, 'anteroseptal'],
    ['mitral', 270, 'left anterior'], ['mitral', 240, 'left anterolateral'], ['mitral', 210, 'left lateral'], ['mitral', 180, 'left lateral'],
    ['tricuspid', 150, 'posteroseptal'], ['tricuspid', 135, 'posteroseptal'], ['tricuspid', 120, 'posteroseptal'], ['tricuspid', 105, 'right posterior'], ['tricuspid', 90, 'right posterior'], ['tricuspid', 75, 'right posterior'], ['tricuspid', 60, 'right posterolateral']];
  const DL = [0, 4, 1, 2, 5, 6, 7];                                   // leads shown in the delta read-out
  const mAp = (rec) => { const m = mBeat('pre-excited')(rec); if (m.act) m.d = NM().slice(0, 12).map((n, l) => win(m.act, l, 20, 60)); return m; };
  /* Polarity as the eye reads it: the delta wave (20–60 ms) and the net QRS must not disagree. */
  const dn = (m, l) => m.f.lead[l].area < 0 && m.d[l] < 0.05, up = (m, l) => m.f.lead[l].area > 0 && m.d[l] > -0.05;
  const dword = (v) => (v > 0.05 ? 'positive' : v < -0.05 ? 'negative' : 'flat');
  const apBench = (p, ctl) => ({ kind: 'ecg', layout: '12', title: '12-lead ECG: sinus rhythm with pre-excitation', p: Object.assign({ pos: 0, slow: true }, p), measure: mAp,
    make: (q, b) => { const r = RING[q.pos]; if (b && b.cap && !q.hide) b.cap.textContent = 'Pathway: ' + r[2] + ' (' + r[0] + ' ring). ' + (q.slow ? 'The AV node is slowed, so pre-excitation is maximal.' : 'The AV node conducts normally.'); return recAp(r[0], r[1], q.slow); },
    ctl: (ctl || []).map((k) => (k === 'pos' ? { k: 'pos', label: 'Pathway position, step by step round the two rings', min: 0, max: RING.length - 1, step: 1 } : { k: 'slow', label: 'Slow the AV node', toggle: true })),
    cap: p && p.hide ? 'The position of the pathway is hidden.' : '',
    read: (rec, q, m) => (m.f ? [['Pathway', RING[q.pos][2]], ['PR', m.pr, 'ms'], ['QRS', m.f.qrs, 'ms']].concat(DL.map((l) => ['Delta in ' + NM()[l], dword(m.d[l])])) : []) });
  const MATCH = [
    { want: 'positive in V1, negative in aVL, and positive in II, III and aVF', start: 0, sol: 8, parts: [['V1', (m) => up(m, 6)], ['aVL', (m) => dn(m, 4)], ['the inferior leads', (m) => up(m, 1) && up(m, 2) && up(m, 5)]],
      why: 'A left lateral or anterolateral pathway. Positive in V1: the wave starts behind and to the left and travels towards V1. Negative in aVL: it starts under the lateral leads and leaves them. Positive inferior leads: it starts in the upper half of the ring.' },
    { want: 'negative in V1, negative in II, III and aVF, and positive in I and aVL', start: 9, sol: 14, parts: [['V1', (m) => dn(m, 6)], ['the inferior leads', (m) => dn(m, 1) && dn(m, 2) && dn(m, 5)], ['I and aVL', (m) => up(m, 0) && up(m, 4)]],
      why: 'A right posterior or posteroseptal pathway, at the bottom of the tricuspid ring. Negative in V1: right-sided or septal. Negative inferior leads: the wave starts at the bottom of the ring and travels up; these are the delta waves that are mistaken for inferior Q waves. Positive I and aVL: it travels from right to left.' },
    { want: 'negative in V1 and V2, positive in II and aVF, and positive in lead I', start: 14, sol: 3, parts: [['V1 and V2', (m) => dn(m, 6) && dn(m, 7)], ['II and aVF', (m) => up(m, 1) && up(m, 5)], ['lead I', (m) => up(m, 0)]],
      why: 'A right anterior or anteroseptal pathway, at the top of the tricuspid ring. Negative V1 and V2: right-sided, in front. Positive inferior leads: the wave starts at the top of the ring and travels down. Positive lead I: right to left.' },
  ];
  const QUAD = { la: 'Left lateral or anterolateral', lp: 'Left posterior or posterolateral', ra: 'Right anterior or anteroseptal', rp: 'Right posterior or posteroseptal' };
  const APU = [
    { pos: [8, 9, 7], q: 'la', left: 1, top: 1, why: 'V1 is positive and aVL negative: the wave starts behind and to the left, under the lateral leads. The inferior leads are positive, so it starts in the upper half of the mitral ring: left lateral or anterolateral, the commonest site.' },
    { pos: [12, 13, 14], q: 'rp', left: 0, top: 0, why: 'V1 is negative: right-sided or septal. III and aVF are negative: the wave starts at the bottom of the ring and travels up. I and aVL are positive. A posteroseptal or right posterior pathway; the negative inferior delta waves are the ones mistaken for an old inferior infarct.' },
    { pos: [3, 4, 5], q: 'ra', left: 0, top: 1, why: 'V1 is negative: right-sided or septal. II and aVF are positive: the wave starts at the top of the ring and travels down. An anteroseptal or right anterior pathway. Anteroseptal pathways lie beside the His bundle, which matters for ablation.' },
  ];

  const L3 = { id: 'l3', title: 'Accessory-pathway localisation', short: 'Accessory pathways',
    goal: 'Place an accessory pathway on the AV rings from the polarity of the delta wave, and say when the ECG cannot be trusted to do it.',
    teach: () => [
      para('A pre-excited QRS is a fusion. Part of the ventricle is activated early, through muscle, from the point where the pathway inserts; the rest is activated by the His–Purkinje system when it arrives. The **delta wave** is the slurred first 40 ms or so of that early wave, and like any wave it **points away from where it starts**.'),
      fig(RINGS, 'The two AV rings seen from the apex (the left anterior oblique view used in the laboratory). A pathway can cross anywhere on either ring except where the aortic and mitral valves are in continuity.'),
      list(['**Negative where it starts.** Leads that look at the insertion see the delta wave leaving: negative, or flat. Leads on the far side see it coming: positive. Because every pathway inserts at the base, only two questions are left: which side, and where round the ring.',
        '**V1: left or right.** A left free-wall pathway starts behind and to the left, and the wave travels towards V1: positive delta, R ≥ S in V1. A right-sided or septal pathway starts close to V1, and the wave leaves it: negative or flat delta, QS or rS, an LBBB-like QRS.',
        '**III, aVF and II: top or bottom of the ring.** Negative delta waves in the inferior leads mean an insertion at the bottom (posterior, posteroseptal): the wave travels up. This is the pattern mistaken for an inferior infarct. Positive inferior delta waves mean the top of the ring (anterior, anteroseptal).',
        '**I and aVL: the lateral wall.** A negative or flat delta wave in I or aVL means the wave starts under those leads: a left lateral pathway, the commonest site.',
        '**Septum or free wall.** On the right side, a negative V1 with the R wave already dominant in V2 points to the septum; a right free-wall pathway looks like LBBB with a later transition.',
        '**Put in order:** V1, then the inferior leads, then I and aVL. Published algorithms (Arruda, Milstein, Fitzpatrick and others) are refinements of these three questions. They differ in detail, and none is right every time, least of all when the delta wave is small.',
        '**They all assume a large delta wave.** How much of the QRS is pre-excited depends on the race between the pathway and the AV node. A left lateral pathway is far from the sinus node, so the impulse reaches the AV node long before it reaches the pathway: the PR is nearly normal, the delta wave is small, and the rest of the QRS is ordinary conduction that says nothing about the pathway. Slowing the node (vagal manoeuvres, adenosine) or pacing the atrium near the pathway brings the delta wave out.'])],
    steps: () => {
      const prPos = pick([0, 14, 4]), mt = pick(MATCH), u = pick(APU), uPos = pick(u.pos);
      return [
        look('A right lateral pathway', 'Sinus rhythm with a pathway on the right free wall; the AV node has been slowed so that the whole QRS comes from the pathway. The P wave runs straight into a slurred upstroke: no PR segment. V1 and V2 are negative: the wave starts on the right, in front, and leaves them. I and aVL are positive: it travels from right to left. III and aVF are negative and II is nearly flat: an axis to the left, as in left bundle branch block.', apBench({ pos: 0 })),
        num('pr', 'Measure the PR interval', 'A different pathway, with the AV node conducting normally. Measure the PR interval: from the start of the P wave to the first slurring of the QRS.', (b) => b.m.pr, 22, 'ms',
          (b) => `About ${b.m.pr} ms, below the normal lower limit of 120 ms. The pathway has none of the AV node's delay, so ventricular activation starts early; that early, slow start is the delta wave. The normal impulse arrives through the node at the usual time, so the end of the QRS is on time and the QRS is wider by what the PR has lost.`, { bench: apBench({ pos: prPos, slow: false, hide: true }) }),
        mcq('delta-rule', 'Predict: a left lateral pathway', 'A pathway inserts into the lateral wall of the left ventricle, at the mitral ring. In which leads will the delta wave be negative or flat?',
          ['I and aVL', 'V1 and V2', 'III and aVF', 'V1 and III'],
          'The delta wave is negative in the leads that look at the insertion. I and aVL look from the left. V1 is on the far side and sees the wave coming, so it is positive; III and aVF are negative for pathways at the bottom of the ring.'),
        act('ap-match', 'Find the pathway', `Slide the pathway round the rings until the pre-excited QRS is ${mt.want}.`, { bench: apBench({ pos: mt.start }, ['pos']),
          check: (x) => !!x.m.f && x.changes > 0 && mt.parts.every((q) => q[1](x.m)), solve: (b) => b.set('pos', mt.sol),
          live: (x) => (x.m.f && x.changes ? coach(mt.parts, x.m) : null),
          hint: 'V1 decides the side. The inferior leads decide top or bottom of the ring. Left posterior positions and the mid-septum are not on this slider.', why: mt.why }),
        act('unmask', 'Bring out a small delta wave', 'A left lateral pathway with the AV node conducting normally: the PR is almost normal, the QRS is narrow, and lead I is upright. Without moving the pathway, make the pre-excitation large enough to read.', { bench: apBench({ pos: 9, slow: false }, ['slow']),
          check: (x) => !!x.m.f && x.p.slow && x.m.f.qrs >= 140, solve: (b) => b.set('slow', true), hint: 'The delta wave is the head start of the pathway over the AV node. Lengthen the head start.',
          why: 'With the node slowed, the pathway activates the whole ventricle before the His–Purkinje wave arrives. Now lead I and aVL are negative and V1 is a tall R: a left lateral pathway. Before, only aVL hinted at it: lead I was upright and most of the QRS was ordinary conduction, which says nothing about the pathway. In practice adenosine or atrial pacing does this; adenosine can precipitate atrial fibrillation, so it is given with a defibrillator at hand.' }),
        mcq('why-subtle', 'Why the left lateral pathway hides', 'Why does a left lateral pathway produce the least pre-excitation in sinus rhythm?',
          ['It is far from the sinus node: the AV node has a head start', 'It conducts more slowly than the pathways on the right side do', 'Its ventricular end inserts into the Purkinje network', 'It conducts only from ventricle to atrium in sinus rhythm'],
          'The sinus impulse reaches the AV node, in the low right atrium, tens of milliseconds before it has crossed to the lateral left atrium. The node has spent much of its delay by the time the pathway is reached. A pathway that conducts only backwards is concealed: it gives no delta wave at all, which is a different matter.'),
        multi('ap-unknown', 'Unknown pathway', 'Sinus rhythm with pre-excitation. The AV node has been slowed, so the delta wave is as large as it can be.', [
          ['V1: which side?', u.left ? 'Left free wall: the QRS is positive in V1' : 'Right side or septum: negative in V1', [u.left ? 'Right side or septum: negative in V1' : 'Left free wall: the QRS is positive in V1', 'Neither: V1 is flat and gives no help here'], u.left ? 'The wave travels towards V1, so it starts behind and to the left.' : 'The wave leaves V1, so it starts in front: the right ring or the septum.'],
          ['Inferior leads: top or bottom of the ring?', u.top ? 'Top: positive in II and aVF' : 'Bottom: negative in III and aVF', [u.top ? 'Bottom: negative in III and aVF' : 'Top: positive in II and aVF', 'Neither: flat in II, III and aVF'], u.top ? 'The wave travels down towards the inferior leads.' : 'The wave travels up, away from the inferior leads.'],
          ['Where is the pathway?', QUAD[u.q], Object.keys(QUAD).filter((k) => k !== u.q).map((k) => QUAD[k]), u.why],
        ], { bench: apBench({ pos: uPos, slow: true, hide: true }), tDone: 'Unknown pathway: ' + QUAD[u.q].toLowerCase(), why: u.why }),
        mcq('pseudo-mi', 'The infarct that is not', 'A 28-year-old with palpitations is referred with "old inferior infarct" on the ECG report. The tracing shows a PR of 100 ms, a slurred start to the QRS, and wide negative waves in III and aVF. What are the negative waves?',
          ['Delta waves: a pathway at the bottom of the AV ring', 'Q waves: an old infarct with a short PR by chance', 'S waves: left anterior fascicular block', 'Delta waves: a pathway on the left lateral wall'],
          'A pathway that inserts posteriorly sends its early wave upwards, away from III and aVF, and the negative delta wave looks like a pathological Q. The short PR and the slurred onset give it away. A left lateral pathway gives its negative delta in I and aVL and can imitate a lateral infarct in the same way.'),
      ];
    } };

  // =====================================================================================================
  // l4  the paced QRS
  // =====================================================================================================
  const PACE = EP.LocData.PACE, paceSpec = (k) => PACE.find((x) => x[0] === k)[2]();
  const PNAME = { rvApex: 'RV apex', rvMidSeptum: 'RV mid-septum', rvotSeptal: 'RV outflow tract', his: 'His bundle (selective)', lbbArea: 'Left bundle branch area', lvLatEpi: 'LV lateral vein only', biv: 'Biventricular (RV + LV)' }, paceName = (k) => PNAME[k];
  const mPace = (rec) => { const m = mBeat('paced')(rec); if (m.q) m.gap = Math.round(m.q.wave.qrsOn); return m; };
  const readPace = (f) => [['V1', f.v1 === 'L' ? 'negative (LBBB type)' : 'positive (RBBB type)'], ['Axis', f.axis, '°'], ['Inferior leads', f.inferior ? 'positive' : f.superior ? 'negative' : 'mixed'], ['Lead I', f.leadI > 4 ? 'positive' : f.leadI < -4 ? 'negative' : 'flat'], ['QRS', f.qrs, 'ms']];
  const paceBench = (spec, title) => ({ kind: 'ecg', layout: '12', title: title || 'Paced 12-lead ECG: complete heart block, each P wave tracked', make: () => recPace(spec()), p: {}, ctl: [], measure: mPace, read: (rec, p, m) => (m.f ? readPace(m.f) : []) });
  /* The RV lead bench: the tip slides along the septum from the apex to the outflow tract. */
  const TRACK = [[3.3, 0.5, 6.6], [2.95, 0.0, 3.4], [3.1, -1.2, 1.6], [2.3, -3.4, 1.1]];
  const trackSpec = (k) => { const u = k / 4, i = Math.min(2, Math.floor(u)), f = u - i, a = TRACK[i], b = TRACK[i + 1]; return Mo.siteSpec({ p: M.pos(M.nearest(G.L(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f), 'endoRV')), kind: 'endoRV' }); };
  const trackName = (k) => (k <= 1 ? 'apex' : k <= 3 ? 'apical septum' : k <= 6 ? 'mid-septum' : k <= 9 ? 'high septum' : 'outflow tract');
  const rvBench = () => ({ kind: 'ecg', layout: '12', title: 'Paced 12-lead ECG: right ventricular lead', p: { tip: 0 }, measure: mPace,
    make: (q, b) => { if (b && b.cap) b.cap.textContent = 'Lead tip: right ventricular ' + trackName(q.tip) + '.'; return recPace(trackSpec(q.tip)); },
    ctl: [{ k: 'tip', label: 'Lead tip: 0 at the apex, 12 in the outflow tract', min: 0, max: 12, step: 1 }], read: (rec, q, m) => (m.f ? [['Tip', trackName(q.tip)]].concat(readPace(m.f)) : []) });
  /* The CRT bench: which leads capture. */
  const crtSpec = (p) => (p.rv && p.lv ? paceSpec('biv') : p.rv ? Mo.spec('rvApex') : p.lv ? Mo.spec('lvLatEpi') : null);
  const crtBench = (p, sw) => ({ kind: 'ecg', layout: '12', title: 'Paced 12-lead ECG: CRT device, RV apical and LV lateral-vein leads', p: Object.assign({ rv: true, lv: true }, p), measure: mPace, make: (q) => recPace(crtSpec(q)),
    ctl: sw ? [{ k: 'rv', label: 'RV lead captures', toggle: true }, { k: 'lv', label: 'LV lead captures', toggle: true }] : [], read: (rec, q, m) => (m.f ? [['Capturing', q.rv && q.lv ? 'both leads' : q.rv ? 'RV lead only' : 'LV lead only']].concat(readPace(m.f)) : [['Capturing', 'neither lead']]) });
  const CRT = { both: ['Both leads capture: nothing has changed', { rv: true, lv: true }, 'Lead I still starts with a q wave and V1 with an R wave, and the inferior leads are still negative: both wavefronts are present. A CRT tracing is judged against its own baseline, lead I and V1 first.'],
    rv: ['The LV lead has lost capture: RV pacing only', { rv: true, lv: false }, 'Lead I is now a single R wave and V1 is QS: the left-sided wavefront has gone and what remains is RV apical pacing. Lead I and V1 are the two leads that show whether the left ventricular lead is contributing. Loss of LV capture is a common and correctable reason for CRT to stop working.'],
    lv: ['The RV lead has lost capture: LV pacing only', { rv: false, lv: true }, 'Lead I is now QS and V1 a tall single R, and the QRS is wider: all activation spreads from the lateral left ventricle. The right-sided wavefront that gave lead I its r wave has gone.'] };
  /* Unknown pacing sites (specs from the Localise lab's PACE table); rvMidSeptum is never offered against the apex. */
  const PSITE = ['rvApex', 'rvMidSeptum', 'rvotSeptal', 'his', 'lbbArea', 'lvLatEpi', 'biv'];
  const PWHY = {
    rvApex: 'V1–V3 are QS: the right ventricle is first. II, III and aVF are QS: the wave travels up from the apex. I and aVL are upright. LBBB pattern with a superior axis is the RV apex.',
    rvotSeptal: 'V1 is still QS, so the right ventricle is first, but II, III and aVF are now tall: the wave travels down from the top of the septum. LBBB pattern with an inferior axis is the outflow tract or high septum, the same picture as an RVOT ectopic beat.',
    his: 'After the spike there is a short flat interval, then a narrow QRS of normal shape. The stimulus captured only the His bundle; the flat interval is the HV time, and the ventricles are activated through both bundle branches as in a conducted beat.',
    lbbArea: 'The QRS is fairly narrow and V1 ends with an R′: the left ventricle is activated first, through its own Purkinje network, and the right ventricle follows late. This right-bundle-delay pattern is the expected result of left bundle branch area pacing, not a complication.',
    lvLatEpi: 'V1 is a tall single R and lead I is QS, with V5–V6 negative: all activation spreads from the lateral left ventricle towards the right. The QRS is very wide because the stimulus is on the epicardium, far from the Purkinje network.',
    biv: 'Neither a right nor a left ventricular pattern: lead I starts with a q wave and V1 with an R wave (the left ventricular wavefront), but the inferior leads are QS (the apical wavefront). Two wavefronts that meet: biventricular pacing.' };
  const paceOpts = (k) => PSITE.filter((s) => s !== k && !(k === 'rvApex' && s === 'rvMidSeptum')).map(paceName);

  const L4 = { id: 'l4', title: 'The paced QRS and where the lead is', short: 'Paced QRS',
    goal: 'Say where a ventricular lead is pacing from the paced QRS, and recognise a lead that is not where the operation note says.',
    teach: () => [
      para('A paced beat is an ectopic beat from a known address. The stimulus starts a wave at the lead tip, the wave spreads away from it, and the 12-lead reads exactly as in the unit on PVCs: **V1 for which ventricle is first, the inferior leads for apex against base, lead I for right against left.**'),
      list(['**RV apex.** The right ventricle is first: V1 negative, an LBBB pattern. The wave travels from the apex up to the base: QS in II, III and aVF, a superior axis. It also travels from right to left: I and aVL upright. The chest leads stay negative to V4 or beyond.',
        '**RV septum and outflow tract.** V1 is still negative. The higher the tip, the more the wave travels downwards: the inferior leads go from QS (apex) through flat (mid-septum) to tall R waves (outflow tract).',
        '**LV free wall through a coronary vein.** The wave starts on the lateral epicardium and travels to the right: a dominant R in V1 (RBBB pattern), a QS in lead I, negative V5–V6, and a very wide QRS.',
        '**Biventricular pacing** is a fusion of the two, with features of each. The left ventricular wavefront usually shows as a q or QS in lead I and an R wave in V1. If lead I becomes a plain R and V1 a QS, the LV lead is no longer contributing. Always compare with the tracing taken at implant.',
        '**His bundle pacing (selective):** the spike, a flat interval equal to the HV time, then a QRS like the patient\'s own conducted beat. If neighbouring muscle is captured too (non-selective), the flat interval is replaced by a slurred start.',
        '**Left bundle branch area pacing:** the lead is screwed through the septum to the left side. The left ventricle is activated first through its own Purkinje network, the right ventricle late: a fairly narrow QRS that ends with an R′ in V1. A lead that is not deep enough paces the right side of the septum instead: QS in V1.',
        '**A dominant R in V1 from an "RV" lead is not normal until proved so.** It means the left ventricle is activated first. The tip may be in a coronary vein (entered through the coronary sinus), in the left ventricle (across an atrial or ventricular septal defect, or placed through an artery), or through the septum or free wall after perforation. A lead in the left ventricular cavity can work perfectly and still cause a stroke. First repeat V1 and V2 one interspace lower; then find the tip with a lateral film and an echocardiogram.'])],
    steps: () => {
      const crt = pick(['rv', 'lv', 'both', 'rv']), a = pick(['rvApex', 'rvotSeptal', 'lvLatEpi']), b = pick(['lbbArea', 'his', 'biv']), wrong = pick(['lvLatEpi', 'lvPostLat']);
      return [
        look('RV apical pacing', 'Complete heart block; the device tracks each P wave and paces the ventricle. Each spike is followed at once by a wide QRS. V1–V3 are QS: the right ventricle is first, an LBBB pattern. II, III and aVF are QS: the wave travels from the apex up to the base. I and aVL are upright: right to left. R waves appear only in V5–V6.', paceBench(() => paceSpec('rvApex'))),
        mcq('rvot-predict', 'Predict: a higher lead', 'The lead is to be moved from the apex to the top of the septum, in the outflow tract. V1 will stay negative. What will happen to II, III and aVF?',
          ['They turn upright: the wave now travels downwards', 'They stay QS: all right ventricular pacing looks alike', 'They turn flat: the wave now travels from front to back', 'They turn upright only if the left bundle is captured'],
          'The chamber has not changed, so V1 has not. The height has: from the outflow tract the wave travels down towards the inferior leads, exactly as an RVOT ectopic beat does.'),
        act('lead-up', 'Move the lead', 'Withdraw the lead from the apex and take it up the septum until the paced QRS is upright in II, III and aVF, with V1 still negative.', { bench: rvBench(),
          check: (x) => !!x.m.f && posi(x.m.f, 1) && posi(x.m.f, 2) && posi(x.m.f, 5) && x.m.f.v1 === 'L', solve: (b2) => b2.set('tip', 11),
          live: (x) => (x.m.f && x.p.tip > 0 ? (posi(x.m.f, 1) && !posi(x.m.f, 2) ? 'Lead II is upright but III is not: the axis is roughly horizontal. Higher.' : !posi(x.m.f, 1) ? 'The inferior leads are still negative: the wave is still travelling upwards.' : null) : null),
          hint: 'The inferior leads are positive when the wave travels down towards them.', why: 'On the way up the axis turns steadily: QS in the inferior leads at the apex, lead II flat at the mid-septum, all three upright in the outflow tract. V1 is negative throughout, because the right ventricle is first at every position. LBBB pattern with an inferior axis is high septal or outflow-tract pacing.' }),
        multi('lv-predict', 'Predict: pacing the left ventricle alone', 'A different device now: a CRT system set to pace only from its left ventricular lead, in a lateral coronary vein. Predict the paced QRS before you see it. (Any tracing still on the bench belongs to the last step.)', [
          ['V1?', V1O[1], [V1O[0], V1O[2]], 'The wave starts behind and to the left and travels towards V1.'],
          ['Lead I?', 'Negative: the wave runs from left to right', ['Positive: the wave runs from right to left', 'Flat: the origin is close to the midline'], 'Lead I looks from the left, and the wave starts under it.'],
          ['V5 and V6?', 'Negative: the wave starts beneath them', ['Positive: the left ventricle is first', 'Unchanged from right ventricular pacing'], 'V5 and V6 lie over the lateral wall. They see the wave leave.'],
        ], { tDone: 'Predicted: left ventricular pacing', why: 'A lateral left ventricular lead is the mirror image of a right ventricular one: dominant R in V1, QS in lead I and in V5–V6.' }),
        look('Two leads, and each alone', 'Biventricular pacing: an RV apical and an LV lateral-vein lead fire together and their wavefronts meet. Lead I starts with a small q and V1 with an R wave: that is the left ventricular lead. The inferior leads are QS: that is the apex. Now switch each lead off in turn. Without the LV lead, lead I is a plain R and V1 is QS. Without the RV lead, lead I is QS and V1 a tall R, and the QRS is at its widest. With both off, the spikes are followed by nothing and a slow escape rhythm appears.', crtBench({}, true)),
        mcq('crt-loss', 'A CRT follow-up tracing', 'The same CRT system at follow-up. At implant, biventricular pacing gave a q wave at the start of lead I, an R wave at the start of V1, and QS complexes in II, III and aVF. What does today\'s tracing show?',
          [CRT[crt][0]].concat(Object.keys(CRT).filter((k) => k !== crt).map((k) => CRT[k][0])).concat(['Neither lead captures: an escape rhythm']), CRT[crt][2], { bench: crtBench(CRT[crt][1], false) }),
        num('his-gap', 'His bundle pacing: measure the gap', 'Selective His bundle pacing. Measure from the pacing spike to the first deflection of the QRS.', (b2) => b2.m.gap, 20, 'ms',
          (b2) => `About ${b2.m.gap} ms. The stimulus captures only the His bundle, so nothing is seen until the impulse has travelled down both bundle branches: the flat interval is the HV time (normally 35–55 ms), and the QRS that follows has the shape of a conducted beat. A spike followed at once by a wide QRS is muscle capture.`, { bench: paceBench(() => paceSpec('his'), 'Paced 12-lead ECG: His bundle lead') }),
        mcq('pace-unk-a', 'Unknown pacing site 1', 'Complete heart block with ventricular pacing. Where is the ventricle being paced from?', [paceName(a)].concat(paceOpts(a)), PWHY[a], { many: true, bench: paceBench(() => paceSpec(a)) }),
        mcq('pace-unk-b', 'Unknown pacing site 2', 'Complete heart block with ventricular pacing. Where is the ventricle being paced from?', [paceName(b)].concat(paceOpts(b)), PWHY[b], { many: true, bench: paceBench(() => paceSpec(b)) }),
        multi('wrong-place', 'The lead that is not where it should be', 'A dual-chamber pacemaker was implanted two days ago for complete heart block. The operation note says "ventricular lead: RV apex". Capture and sensing thresholds are normal. This is the paced 12-lead.', [
          ['What does V1 say?', 'The left ventricle is activated first', ['The right ventricle is activated first', 'Only the His bundle is being captured', 'Nothing: V1 does not depend on the site'], 'A dominant R in V1 means the wave travels towards V1, from behind and the left. An apical RV lead gives a QS.'],
          ['Which explanations have to be considered?', 'A coronary vein, the LV through a septal defect, or perforation', ['The RV inflow, the outflow tract, or a tip back in the right atrium', 'Fusion with conducted beats, or late capture in a refractory period', 'A reversed lead connection, or a switch to unipolar pacing'], 'Each of the three puts the tip against left ventricular muscle. Dislodgement within the right heart keeps V1 negative or loses capture; there is no conduction to fuse with in complete heart block.'],
          ['What do you do first?', 'Find the tip: lateral chest film and echocardiogram', ['Raise the output and repeat the ECG in six weeks', 'Nothing: normal thresholds mean a safe position', 'Reprogram to a lower rate to reduce pacing'], 'Normal thresholds prove nothing about position. On the lateral film an RV lead runs forwards to the sternum; a lead in the coronary sinus or the left ventricle runs backwards. A lead in the left ventricular cavity needs anticoagulation and a plan for repositioning; how and when is a specialist decision.'],
        ], { bench: paceBench(() => Mo.spec(wrong), 'Paced 12-lead ECG, two days after implant'), tDone: 'An "RV" lead pacing the left ventricle', why: 'A tall R in V1 with a negative lead I, from a lead meant for the right ventricle: the tip is against the left ventricle until proved otherwise. A small terminal r in V1 can come from electrodes placed too high, so repeat V1–V2 one interspace lower; a tall R with a negative lead I is not explained that way.' }),
      ];
    } };

  C._loc = { UNK, REG, RING, MATCH, PLACE, PRED, APU, CRT, PSITE, ISO, lvSpec, lvName, trackSpec, recCond, recPvc, recAp, recPace, mAp, mPvc, mPace, mCond, win, tail, patOf };
  C.addTrack({ id: 'loc', title: 'Localisation from the 12-lead', short: 'Localisation', dom: 'local', bench: 'ecg',
    blurb: 'One rule, a lead is positive while the wave travels towards it, applied to bundle branch block, the origin of a PVC or VT, accessory pathways and the paced QRS.',
    units: [L1, L2, L3, L4] });
})(globalThis.EP = globalThis.EP || {});
