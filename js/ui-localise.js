/* EP Simulator — Localisation lab: where does this QRS come from?
 * PVC / VT exit site (click the heart), accessory pathway (delta-wave polarity), pacing site. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, Mo = EP.Morph, G = EP.G, M = EP.Model, R = EP.Rhythms, Lds = EP.Leads;

  /* Measurements a clinician reads off a single QRS. */
  function features(act) {
    const n0 = Math.max(0, Math.round(act.on - act.t0)), n1 = Math.min(act.n - 1, Math.round(act.off - act.t0));
    const f = { qrs: Math.round(act.off - act.on), lead: [] };
    for (let l = 0; l < 12; l++) {
      let mx = 0, mn = 0, area = 0, init = 0;
      for (let i = n0; i <= n1; i++) { const v = Lds.project(act.vcg[i * 3], act.vcg[i * 3 + 1], act.vcg[i * 3 + 2], l); if (v > mx) mx = v; if (v < mn) mn = v; area += v; if (i - n0 < 40) init += v; }
      f.lead.push({ r: mx, s: -mn, area, init: init / 40, pos: mx >= -mn });
    }
    f.v1 = f.lead[6].area >= 0 ? 'R' : 'L';
    f.axis = Math.round(Mo.axis(act));
    f.inferior = f.lead[1].area > 0 && f.lead[5].area > 0; f.superior = f.lead[1].area < 0 && f.lead[5].area < 0;
    f.trans = 7; for (let k = 6; k < 12; k++) if (f.lead[k].pos) { f.trans = k - 5; break; }
    f.negConc = f.trans === 7; f.posConc = f.lead.slice(6).every((x) => x.pos);
    f.leadI = f.lead[0].area;
    return f;
  }
  EP.qrsFeatures = features;
  function readPVC(f) {
    const out = [];
    out.push(f.v1 === 'L' ? ['V1 is negative (LBBB pattern)', 'the wave moves away from V1 → it starts in the right ventricle or the septum'] : ['V1 is positive (RBBB pattern)', 'the wave moves toward V1 → it starts in the left ventricle']);
    out.push(f.inferior ? ['Tall R waves in II, III, aVF (inferior axis)', 'activation travels downward → origin high: outflow tracts, summit, anterior base'] : f.superior ? ['QS in II, III, aVF (superior axis)', 'activation travels upward → origin low: inferior wall, apex, posterior papillary muscle or fascicle'] : ['Intermediate axis (' + f.axis + '°)', 'origin is mid-level: septum or lateral free wall']);
    out.push(f.negConc ? ['No precordial transition (negative concordance)', 'everything moves away from the chest leads → apical origin'] : f.posConc ? ['Positive concordance V1–V6', 'everything moves toward the chest → basal left ventricle / mitral annulus'] : ['Precordial transition at V' + f.trans, f.v1 === 'L' ? (f.trans <= 2 ? 'early transition → think LVOT / aortic cusps rather than RVOT' : f.trans === 3 ? 'V3 is the grey zone: compare with the sinus beat — a PVC that transitions earlier than sinus rhythm points to the LVOT, later to the RVOT' : 'transition V4 or later → right ventricular origin') : 'R dominant from V1 with later loss of R → lateral or apical LV']);
    out.push(f.leadI > 0.15 * Math.abs(f.lead[1].area) || f.leadI > 4 ? ['Lead I positive', 'wave travels right-to-left → origin on the rightward / septal side'] : f.leadI < -4 ? ['Lead I negative', 'wave travels left-to-right → origin on the far left: LV free wall, summit, anterior RVOT'] : ['Lead I small or isoelectric', 'origin near the midline (septum, outflow tracts)']);
    out.push(f.qrs < 130 ? ['QRS only ' + f.qrs + ' ms', 'relatively narrow → close to the conduction system or septum (both ventricles reached quickly)'] : f.qrs > 165 ? ['QRS ' + f.qrs + ' ms', 'very wide → free wall or epicardial origin, far from the Purkinje network'] : ['QRS ' + f.qrs + ' ms', 'typical width for a myocardial origin']);
    return out;
  }
  function regionName(p) {
    const l = G.toLocal(p), info = {};
    const inV = G.ventInfo(p[0], p[1], p[2], info);
    const lv = !inV || info.inLV;
    const level = l[2] < 2.2 ? 'basal' : l[2] < 5.2 ? 'mid' : 'apical';
    if (!lv) { if (l[1] < -2.0 && l[2] < 2.4) return 'RV outflow tract'; return 'right ventricle, ' + level + (l[0] > 5 ? ' free wall' : l[1] > 1.5 ? ' inferior wall' : ' anterior wall'); }
    const ang = Math.atan2(l[1], l[0]) * 180 / Math.PI;      // 0 = septal (+S), 90 = inferior (+N), ±180 lateral, −90 anterior
    const wall = Math.abs(ang) < 45 ? 'septum' : ang >= 45 && ang < 135 ? 'inferior wall' : ang <= -45 && ang > -135 ? 'anterior wall' : 'lateral wall';
    if (l[2] > 7.4) return 'left ventricular apex';
    return 'left ventricle, ' + level + ' ' + wall;
  }

  const PRESETS = [['rvotSeptal', 'RVOT, septal'], ['rvotFree', 'RVOT, free wall'], ['lvotSeptal', 'LVOT / aortic cusps'], ['lvSummit', 'LV summit (epicardial)'], ['mitralAnt', 'Mitral annulus, anterior'], ['mitralLat', 'Mitral annulus, lateral'], ['mitralPost', 'Mitral annulus, posterior'],
    ['papAL', 'Anterolateral papillary muscle'], ['papPM', 'Posteromedial papillary muscle'], ['fascPost', 'Left posterior fascicle'], ['fascAnt', 'Left anterior fascicle'], ['moderator', 'Moderator band'], ['rvInflow', 'Tricuspid annulus'], ['rvApex', 'RV apex'], ['rvFreeWall', 'RV free wall'], ['lvApex', 'LV apex'], ['lvInfBase', 'LV inferobasal (inferior MI scar)'], ['lvAntWall', 'LV anterior wall'], ['lvLatEpi', 'LV lateral wall (epicardial)']];
  const PACE = [['rvApex', 'RV apex', () => Mo.spec('rvApex')], ['rvMidSeptum', 'RV mid-septum', () => Mo.spec('rvMidSeptum')], ['rvotSeptal', 'RV outflow tract', () => Mo.spec('rvotSeptal')],
    ['his', 'His bundle (selective)', () => ({ seeds: Mo.hps({ t: 42 }), purkLV: 1, purkRV: 1 })], ['lbbArea', 'Left bundle branch area', () => Mo.spec('lbbArea')],
    ['lvLatEpi', 'LV lateral vein (LV only)', () => Mo.spec('lvLatEpi')], ['biv', 'Biventricular', () => Mo.fuse([{ spec: Mo.spec('rvApex'), t: 0 }, { spec: Mo.spec('lvLatEpi'), t: 0 }])], ['lvInfApical', 'LV endocardium (lead across a PFO)', () => Mo.spec('lvInfApical')], ['midCardiacVein', 'Middle cardiac vein', () => Mo.spec('midCardiacVein')]];
  const PACE_NOTE = {
    rvApex: 'LBBB pattern, superior axis (negative II/III/aVF), positive I and aVL. The widest of the right-sided sites.',
    rvMidSeptum: 'LBBB pattern but narrower; axis normal to leftward. Lead I positive.',
    rvotSeptal: 'LBBB pattern with an inferior axis (tall R in II/III/aVF) — looks like an RVOT PVC.',
    his: 'An isoelectric gap after the spike (the HV interval), then the patient\'s own narrow QRS.',
    lbbArea: 'Narrow QRS with a terminal R in V1 (Qr / rSR′): the left ventricle leads, the right ventricle is late. Short stimulus-to-peak in V5–V6.',
    lvLatEpi: 'RBBB pattern (dominant R in V1), negative in I and aVL, right axis: activation runs from the left lateral wall toward the right.',
    biv: 'Fusion of RV apical and LV lateral wavefronts: narrower than either alone, Q/QS in lead I, superior or right-superior axis, usually an R in V1.',
    lvInfApical: 'RBBB pattern with a superior axis. If you expected an RV lead, this lead is in the left ventricle.',
    midCardiacVein: 'RBBB-type pattern with a superior axis — an "RV" lead that has entered the coronary sinus and a posterior vein.',
  };

  /* Small multi-lead thumbnail of one QRS-T. */
  function mini(beat, leads, w, hgt) {
    const c = h('canvas', { width: w * 2, height: hgt * 2, style: { width: w + 'px', height: hgt + 'px', display: 'block' } });
    const ctx = c.getContext('2d'), col = EP.cssColors(document.body);
    ctx.scale(2, 2); ctx.lineJoin = 'round';
    const cw = w / leads.length, n = Math.min(beat.n, 520), sx = (cw - 8) / n, sy = hgt * 0.17;
    leads.forEach((l, k) => {
      ctx.strokeStyle = col.major; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(k * cw + 2, hgt / 2); ctx.lineTo((k + 1) * cw - 2, hgt / 2); ctx.stroke();
      ctx.strokeStyle = col.trace; ctx.lineWidth = 1.1; ctx.beginPath();
      for (let i = 0; i < n; i += 2) { const v = Lds.project(beat.vcg[i * 3], beat.vcg[i * 3 + 1], beat.vcg[i * 3 + 2], l); const x = k * cw + 4 + i * sx, y = hgt / 2 - EP.clamp(v, -2.6, 2.6) * sy; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = col.label; ctx.font = '600 9px ' + col.font; ctx.fillText(Lds.names[l], k * cw + 3, 10);
    });
    return c;
  }

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'localise', title: 'Localise',
    mount(root) {
      const player = new EP.Player({ layout: '12', ladder: false });
      const st = { tool: 'pvc', depth: 'epi', quiz: null, point: null, apRing: 'tricuspid', apDeg: 0, apMax: true, pace: 'rvApex' };
      let marker = null, mlabel = null;
      const panel = h('div.card-b'), sideEl = h('div.stack');
      function setMarker(p, text) {
        const hd = player.heart; if (!hd) return;
        const g = hd.group('marker'); while (g.children.length) g.remove(g.children[0]);
        if (mlabel) { mlabel.remove(); mlabel = null; }
        if (!p) { hd.invalidate(); return; }
        marker = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshBasicMaterial({ color: 0x18e0ff }));
        marker.position.set(p[0], p[1], p[2]); marker.renderOrder = 20; marker.material.depthTest = false; g.add(marker);
        mlabel = hd.addLabel(text || 'Origin', [p[0], p[1] + 0.9, p[2]], 'note');
        hd.invalidate();
      }
      function recFor(spec, label) {
        const sim = EP.simulate({ sinus: { cl: 900, resp: 0 }, avn: { fast: { retro: { block: true } } }, foci: [{ id: 'x', node: 'V', kind: 'coupled', after: 'hps', coupling: 470, every: 1, spec, label: label || 'PVC' }] }, 10000);
        const rec = EP.Synth.build(sim, 0, 10000); rec.sim = sim; return rec;
      }
      // ---------------- PVC tool ----------------
      function pvcAt(p, kind, name, quiet) {
        const v = M.nearest(p, kind || 'any'), pos = M.pos(v);
        const st0 = typeof name === 'string' && Mo.SITES[name] ? Mo.SITES[name] : null;
        const spec = st0 ? Mo.spec(name) : Mo.siteSpec({ p: pos, kind: 'any' });
        const act = Mo.vent(spec), f = features(act);
        st.point = pos; st.feat = f;
        const rec = recFor(spec);
        const q = rec.events.find((e) => e.type === 'QRS' && e.label === 'PVC');
        player.load(rec, { title: 'Sinus beats alternating with the ectopic beat', t: q ? q.t + act.tmax * 0.6 : null });
        if (!quiet) { setMarker(pos, st0 ? st0.name : 'Origin'); if (player.heart) { player.heart.setMode('iso'); player.modeSeg.set('iso'); player._legend('iso'); } drawPvc(st0 ? st0.name : regionName(pos), f); }
        return { f, pos, spec };
      }
      function drawPvc(name, f) {
        panel.innerHTML = '';
        panel.append(h('div.eyebrow', 'Origin'), h('h3', { style: { fontSize: '16px', marginBottom: '8px' } }, name),
          UI.kv([['V1', f.v1 === 'L' ? 'LBBB type' : 'RBBB type'], ['Axis', f.axis + '°'], ['Transition', f.negConc ? 'none' : 'V' + f.trans], ['QRS', f.qrs, 'ms'], ['Lead I', f.leadI > 4 ? 'positive' : f.leadI < -4 ? 'negative' : 'flat']]),
          h('div.prose', { style: { marginTop: '10px', fontSize: '13px' } }, h('h4', 'Reading it step by step'), h('ol', { style: { margin: 0, paddingLeft: '1.2em' } }, readPVC(f).map(([a, b]) => h('li', h('b', a), ' — ' + b)))));
      }
      function pvcControls() {
        const selEl = UI.select('Jump to', [['', '— named sites —']].concat(PRESETS), '', (v) => { if (!v) return; st.quiz = null; const s0 = Mo.SITES[v]; pvcAt(s0.p, s0.kind, v); });
        const depth = UI.seg([['epi', 'Epicardial'], ['endo', 'Endocardial']], st.depth, (v) => { st.depth = v; }, 'Depth of clicked site');
        const quizBtn = h('button.btn', { type: 'button', onclick: startPvcQuiz }, 'Quiz me');
        return h('div.row', selEl, depth, quizBtn);
      }
      function startPvcQuiz() {
        const pick = PRESETS[Math.floor(Math.random() * PRESETS.length)], s0 = Mo.SITES[pick[0]];
        const others = PRESETS.filter((x) => x[0] !== pick[0]).sort(() => Math.random() - 0.5).slice(0, 4);
        const opts = others.concat([pick]).sort(() => Math.random() - 0.5);
        st.quiz = pick[0];
        pvcAt(s0.p, s0.kind, pick[0], true); setMarker(null);
        if (player.heart) { player.heart.setMode('anat'); player.modeSeg.set('anat'); player._legend('anat'); }
        panel.innerHTML = '';
        const box = h('div.opts');
        panel.append(h('div.eyebrow', 'Quiz'), h('h3', { style: { fontSize: '16px', margin: '0 0 8px' } }, 'Where does the wide beat come from?'), box);
        for (const o of opts) box.append(h('button.opt', { type: 'button', onclick: (ev) => {
          for (const b of box.children) { b.disabled = true; if (b.textContent === pick[1]) b.classList.add('right'); }
          if (o[0] !== pick[0]) ev.currentTarget.classList.add('wrong');
          const r = pvcAt(s0.p, s0.kind, pick[0]);
          panel.prepend(h('div.note' + (o[0] === pick[0] ? '.good' : '.bad'), { style: { marginBottom: '10px' } }, (o[0] === pick[0] ? 'Correct. ' : 'It was: ' + pick[1] + '. ') + 'The map now shows the activation sequence from that site.'), h('div', { style: { marginBottom: '10px' } }, h('button.btn.sm', { type: 'button', onclick: startPvcQuiz }, 'Another')));
          void r;
        } }, o[1]));
      }
      // ---------------- accessory pathway tool ----------------
      function apShow() {
        const ap = R.apAt(st.apRing, st.apDeg);
        const sim = EP.simulate({ sinus: { cl: 880, resp: 0 }, avn: { fast: { min: st.apMax ? 150 : 66 } }, ap: R.apCfg(ap) }, 10000);
        const rec = EP.Synth.build(sim, 0, 10000); rec.sim = sim;
        const q = rec.events.find((e) => e.type === 'QRS' && e.t > 1500);
        player.load(rec, { title: 'Sinus rhythm with pre-excitation', t: q ? q.t + 30 : null });
        if (player.heart) { player.heart.setMode('prop'); player.modeSeg.set('prop'); player._legend('prop'); }
        setMarker(null);
        const f = q ? features(q.act) : null;
        panel.innerHTML = '';
        if (!f) return;
        const pol = (x) => (x > 0.035 ? '+' : x < -0.035 ? '−' : '±');
        const name = Object.values(R.AP).find((a) => a.ring === st.apRing && Math.abs(((a.deg - st.apDeg + 540) % 360) - 180) < 22);
        const steps = [];
        const dI = f.lead[0].init, dV1 = f.lead[6].init, dII = f.lead[1].init, dF = f.lead[5].init, dIII = f.lead[2].init;
        steps.push(dI < -0.035 || f.lead[6].r > f.lead[6].s ? ['Delta negative in I (or R > S in V1)', 'the pathway is on the LEFT free wall — the early vector points away from the left lateral leads.'] : ['Delta positive in I and V1 not dominant', 'not a left free-wall pathway → septal or right-sided.']);
        steps.push(dV1 < -0.035 ? ['Delta negative / isoelectric in V1', 'septal or right-sided insertion: the early vector points away from V1.'] : ['Delta positive in V1', 'the early vector points anteriorly/rightward → posterior or left-sided insertion.']);
        steps.push(dF < -0.035 || dIII < -0.035 ? ['Delta negative in III / aVF', 'the pathway is INFERIOR (posterior ring, posteroseptal): pre-excitation spreads upward. This is the pattern that mimics an inferior MI.'] : ['Delta positive in the inferior leads', 'the pathway is on the ANTERIOR/SUPERIOR part of the ring (anteroseptal, anterolateral).']);
        if (dII < -0.035) steps.push(['Delta negative in lead II as well', 'suggests a posteroseptal pathway near the coronary sinus / middle cardiac vein (sometimes epicardial).']);
        panel.append(h('div.eyebrow', st.apRing === 'mitral' ? 'Mitral ring' : 'Tricuspid ring'), h('h3', { style: { fontSize: '16px', marginBottom: '8px' } }, (name ? name.name : 'Pathway') + ' pathway'),
          h('div.scroll-x', h('table.tbl', h('thead', h('tr', h('th', 'Delta'), Lds.names.map((n) => h('th', n)))), h('tbody', h('tr', h('td', 'first 40 ms'), f.lead.map((x) => h('td.mono', pol(x.init))))))),
          UI.kv([['PR', q ? Math.round(q.t - rec.events.filter((e) => e.type === 'P' && e.t < q.t).pop().t) : null, 'ms'], ['QRS', f.qrs, 'ms'], ['V1', f.v1 === 'L' ? 'negative' : 'positive'], ['Axis', f.axis + '°']]),
          h('div.prose', { style: { marginTop: '10px', fontSize: '13px' } }, h('h4', 'Reading the delta wave'), h('ol', { style: { margin: 0, paddingLeft: '1.2em' } }, steps.map(([a, b]) => h('li', h('b', a), ' — ' + b))),
            h('p', { style: { marginTop: '8px' } }, 'The rule behind every algorithm: the delta wave is the first 40 ms of ventricular activation spreading from the pathway insertion, so it is negative in leads that look at the insertion site and positive in leads on the opposite side.')));
      }
      function apControls() {
        const ringSeg = UI.seg([['tricuspid', 'Tricuspid ring (right)'], ['mitral', 'Mitral ring (left)']], st.apRing, (v) => { st.apRing = v; apShow(); }, 'Ring');
        const deg = UI.range('Position', { min: 0, max: 345, step: 15, value: st.apDeg, fmt: (v) => v + '°', grow: true }, (v) => { st.apDeg = v; clearTimeout(deg._t); deg._t = setTimeout(apShow, 120); });
        const mx = UI.check('Maximise pre-excitation (slow AV node)', st.apMax, (v) => { st.apMax = v; apShow(); });
        const named = UI.select('Named', [['', '— common locations —']].concat(Object.keys(R.AP).map((k) => [k, R.AP[k].name])), '', (k) => { if (!k) return; st.apRing = R.AP[k].ring; st.apDeg = R.AP[k].deg; ringSeg.set(st.apRing); deg.set(st.apDeg); apShow(); });
        return h('div', h('div.row', ringSeg, named, mx), h('div.row', { style: { marginTop: '8px' } }, deg), h('p.muted', { style: { fontSize: '12px', marginTop: '4px' } }, 'Tricuspid ring: 0° lateral free wall, 90° inferior/posterior, 180° septal, 270° anterior. Mitral ring: 0° septal, 90° posterior, 180° lateral, 270° anterior.'));
      }
      // ---------------- pacing site tool ----------------
      function paceShow() {
        const item = PACE.find((x) => x[0] === st.pace), spec = item[2]();
        const sim = new EP.HeartSim({ sinus: { cl: 820, resp: 0 }, avn: { fast: { block: true, retro: { block: true } } } });
        new EP.Pacemaker(sim, { mode: 'DDD', lrl: 60, vSpec: spec, vSite: st.pace === 'his' || st.pace === 'biv' ? 'rvApex' : st.pace });
        sim.runUntil(12500);
        const rec = EP.Synth.build(sim, 2000, 12000); rec.sim = sim;
        const q = rec.events.find((e) => e.type === 'QRS' && e.t > 3000);
        player.load(rec, { title: 'Paced 12-lead — ' + item[1], t: q ? q.t + 40 : null });
        if (player.heart) { player.heart.setMode('iso'); player.modeSeg.set('iso'); player._legend('iso'); }
        const s0 = Mo.SITES[st.pace]; setMarker(s0 ? s0.p : st.pace === 'his' ? G.LM.his : null, 'Pacing site');
        const f = features(Mo.vent(spec));
        panel.innerHTML = '';
        panel.append(h('div.eyebrow', 'Pacing site'), h('h3', { style: { fontSize: '16px', marginBottom: '8px' } }, item[1]),
          UI.kv([['V1', f.v1 === 'L' ? 'LBBB type' : 'RBBB type'], ['Axis', f.axis + '°'], ['QRS', f.qrs, 'ms'], ['Lead I', f.leadI > 4 ? 'positive' : f.leadI < -4 ? 'negative' : 'flat'], ['Transition', f.negConc ? 'none' : 'V' + f.trans]]),
          h('p', { style: { marginTop: '10px', fontSize: '13px' } }, PACE_NOTE[st.pace]));
      }
      function paceControls() {
        const row = h('div.variants');
        for (const it of PACE) { const b = h('button.btn.sm', { type: 'button', 'aria-pressed': String(it[0] === st.pace), onclick: () => { st.pace = it[0]; for (const x of row.children) x.setAttribute('aria-pressed', String(x === b)); paceShow(); } }, it[1]); row.append(b); }
        return row;
      }
      function chart(title, items, getSpec) {
        const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' } });
        for (const it of items) { const b = Mo.vbeat(getSpec(it), { rr: 900 }); grid.append(h('div', h('div', { style: { fontSize: '12px', fontWeight: '600', marginBottom: '2px' } }, it[1]), mini(b, [0, 1, 2, 6, 11], 250, 62))); }
        return h('section.card', h('div.card-h', h('h3', title), h('span.grow'), h('span.muted', { style: { fontSize: '12px' } }, 'leads I · II · III · V1 · V6')), h('div.card-b', grid));
      }

      const ctl = h('div.card-b');
      const toolSeg = UI.seg([['pvc', 'PVC / VT origin'], ['ap', 'Accessory pathway'], ['pace', 'Pacing site']], st.tool, (v) => { st.tool = v; setTool(); }, 'Tool');
      const intro = h('p.muted', { style: { fontSize: '13px' } });
      const charts = h('div.stack');
      function setTool() {
        ctl.innerHTML = ''; charts.innerHTML = ''; st.quiz = null;
        if (player.heart) player.heart.onPick = null;
        if (st.tool === 'pvc') {
          intro.textContent = 'Click anywhere on the ventricles. The model starts a beat there, spreads it cell-to-cell, and derives the 12-lead from the result — the QRS vector always points away from the origin.';
          ctl.append(pvcControls());
          if (player.heart) { player.setOpacity(1); player.heart.setView('front'); player.heart.onPick = (pk) => { if (pk.atrial) return; st.quiz = null; let p = pk.point; if (st.depth === 'endo') { const kind = G.toLocal(p)[0] > 3.3 || pk.region === G.REG.RV || pk.region === G.REG.RVOT ? 'endoRV' : 'endoLV'; p = M.pos(M.nearest(p, kind)); } pvcAt(p, 'any'); }; }
          const s0 = Mo.SITES.rvotSeptal; pvcAt(s0.p, s0.kind, 'rvotSeptal');
          charts.append(chart('Signature chart — ectopic origins', PRESETS, (it) => Mo.spec(it[0])));
        } else if (st.tool === 'ap') {
          intro.textContent = 'Slide the pathway around either AV ring. With pre-excitation maximised the QRS is almost entirely the wave spreading from the pathway insertion, which is what delta-wave algorithms assume.';
          ctl.append(apControls());
          if (player.heart) { player.setOpacity(0.32); player.heart.setView('base'); }
          apShow();
        } else {
          intro.textContent = 'The paced QRS tells you where the lead tip is. Compare each site with the apex, and note which leads change.';
          ctl.append(paceControls());
          if (player.heart) { player.setOpacity(0.4); player.heart.setView('lao'); }
          paceShow();
          charts.append(chart('Signature chart — pacing sites', PACE, (it) => it[2]()));
        }
      }
      root.append(h('div.sim', { style: { gridTemplateColumns: '' } },
        h('div.sim-main', h('section.card', h('div.card-h', h('h2', 'Localisation lab'), h('span.grow'), toolSeg), h('div.card-b', intro), ctl), player.ecgCard, charts),
        h('div.sim-main', player.heartCard || h('div'), h('section.card', panel))));
      setTool();
      return { unmount() { player.destroy(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
