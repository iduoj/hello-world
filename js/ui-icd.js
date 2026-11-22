/* EP Simulator — ICD: detection zones, discriminators, anti-tachycardia pacing, shocks,
 * and the common ways therapy goes wrong. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI;
  const NOVA = { fast: { retro: { block: true } } };
  const VT = (cl, o) => Object.assign({ id: 'vt', node: 'V', cl, site: 'lvInfBase', label: 'VT', reentrant: true, startAt: 3200 }, o || {});
  const CASES = {
    vt: { name: 'Monomorphic VT 185/min', cfg: () => ({ sinus: { cl: 820 }, avn: NOVA, hps: { retro: { delay: 60, erp: 200 } }, foci: [VT(325, { atpSuccess: 0.9 })] }),
      note: 'A stable re-entrant circuit. A burst of pacing slightly faster than the tachycardia enters the circuit\'s excitable gap, collides with the returning wave and stops it — painlessly. ATP terminates about 70–90% of monomorphic VT below 200/min.' },
    fvt: { name: 'Fast VT 235/min', cfg: () => ({ sinus: { cl: 820 }, avn: NOVA, hps: { retro: { delay: 60, erp: 180 } }, foci: [VT(255, { atpSuccess: 0.35, accelerate: 0.3 })] }),
      note: 'Falls in the VF zone by rate. Modern devices deliver one ATP attempt while charging; if it fails, the shock follows. Fast VT is less often pace-terminated and can accelerate.' },
    vf: { name: 'Ventricular fibrillation', cfg: () => ({ sinus: { cl: 780 }, avn: NOVA, script: [{ t: 3200, do: (s, t) => s.setVentMode('vf', t) }] }),
      note: 'No organised circuit to pace into. The device counts short, irregular intervals, charges its capacitor (a few seconds), reconfirms, and shocks. Note the under-sensing risk: fine VF electrograms are small.' },
    af: { name: 'Atrial fibrillation with rapid conduction 190/min', cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib', fibMean: 110 }, avn: { fast: { erp: 205, conceal: 0.2, min: 55 } } }),
      note: 'The ventricular rate is in the VT zone but the rhythm is supraventricular. Discriminators — irregular intervals (stability), electrogram morphology matching the sinus template, and in dual-chamber devices more atrial than ventricular events — should withhold therapy. Turn them off to see an inappropriate shock.' },
    st: { name: 'Sinus tachycardia 178/min (exercise)', cfg: () => ({ sinus: { cl: 337, resp: 0, sd: 0.004 }, avn: { fast: { erp: 200, min: 50, alpha: 60 } } }),
      note: 'Gradual onset, 1:1 AV relationship, unchanged electrogram morphology. Inappropriate therapy is avoided by discriminators and, more reliably, by programming the detection rate above the patient\'s achievable sinus rate.' },
    slow: { name: 'Slow VT 150/min (on amiodarone)', cfg: () => ({ sinus: { cl: 900 }, avn: NOVA, hps: { retro: { delay: 60, erp: 200 } }, foci: [VT(400)] }),
      note: 'Antiarrhythmic drugs slow VT. If the tachycardia is below the lowest programmed detection rate the device watches it and does nothing: the patient has VT "under the radar". Lower the VT zone (or add a monitor zone) to see the difference.' },
    tover: { name: 'T-wave over-sensing in sinus rhythm', cfg: () => ({ sinus: { cl: 600, resp: 0 } }), icd: { tOver: true },
      note: 'Every beat is counted twice (R and T), so the device calculates double the true rate. Classic in hyperkalaemia, long QT, low R-wave amplitude, and the S-ICD. The surface ECG shows sinus rhythm while the marker channel shows alternating short intervals.' },
    noise: { name: 'Lead fracture noise', cfg: () => ({ sinus: { cl: 850 } }), icd: { noise: 0.9 },
      note: 'Make-and-break contact in a fractured conductor produces very short, non-physiological intervals that satisfy VF detection. The patient is awake, in sinus rhythm, and shocked repeatedly. First aid: a magnet over the generator suspends detection.' },
    storm: { name: 'Electrical storm (recurrent VT)', storm: true, cfg: () => ({ sinus: { cl: 760 }, avn: NOVA, hps: { retro: { delay: 60, erp: 200 } }, foci: [VT(300, { atpSuccess: 0.5 })] }),
      note: 'Three or more separate VT/VF episodes in 24 hours. Each shock raises sympathetic tone, which begets more VT. The device is doing its job; the treatment is of the patient: sedation, beta-blockade (propranolol or esmolol), amiodarone, correction of potassium and magnesium, treating ischaemia, reprogramming to favour ATP, and urgent ablation or sympathetic blockade if it continues.' },
  };

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'icd', title: 'ICD',
    mount(root) {
      const st = { cs: 'vt', vtRate: 170, vfRate: 220, atp: 2, svtDisc: true, shock: true, magnet: false };
      let sim, icd, live, lastLog = 0;
      const canvas = h('canvas', { 'aria-label': 'Live rhythm with ICD marker channel' }), liveBox = h('div.live', canvas);
      const strip = new EP.LiveStrip(canvas, { channels: [{ lead: 1 }, { key: 'pulse', label: 'Arterial pressure' }], windowMs: 10000, markers: true, rowMm: 22 });
      const logEl = h('div.findings'), noteEl = h('p.muted', { style: { fontSize: '13px' } }), stateEl = h('span.pill', 'monitoring');
      function icdCfg() { return Object.assign({ vtRate: st.vtRate, vfRate: st.vfRate, atp: st.atp, svtDisc: st.svtDisc, shock: st.shock, on: !st.magnet, nidVT: 12, nidVF: 9 }, CASES[st.cs].icd || {}); }
      function rebuild() {
        const c = CASES[st.cs];
        sim = new EP.HeartSim(c.cfg());
        icd = new EP.ICD(sim, icdCfg());
        if (c.storm) { let n = 0; sim.on('shock', (e) => { if (n++ < 3) sim.schedule(e.t + 5200, (t) => sim.addFocus(VT(300, { startAt: t, atpSuccess: 0.4, id: 'vt' + n }))); }); const chk = (t) => { const f = sim.foci.filter((x) => x.reentrant); if (f.length && f.every((x) => !x.enabled) && n < 3 && !chk.wait) { chk.wait = true; n++; sim.schedule(t + 5200, (tt) => { chk.wait = false; sim.addFocus(VT(300, { startAt: tt, atpSuccess: 0.4, id: 'vt' + n })); }); } sim.schedule(t + 500, chk); }; sim.schedule(1000, chk); }
        if (live) live.setSim(sim); else live = new EP.Live({ sim, strips: [strip], pulse: true, noPulse: (b) => b.rr < 290, onTick: tick }).start();
        logEl.innerHTML = ''; lastLog = 0; noteEl.textContent = c.note;
        logEl.append(h('div.muted', 'Therapy log is empty.'));
      }
      function tick(t) {
        if (icd.log.length !== lastLog) {
          lastLog = icd.log.length; logEl.innerHTML = '';
          for (const e of icd.log.slice(-9)) logEl.append(h('div.finding', h('span.pill.mono', (e.t / 1000).toFixed(1) + ' s'), h('div', e.what)));
        }
        const s = !icd.c.on ? 'therapy suspended (magnet)' : icd.state === 'charging' ? 'charging' : icd.state === 'atp' ? 'ATP' : 'monitoring';
        if (stateEl.textContent !== s) { stateEl.textContent = s; stateEl.className = 'pill' + (s === 'monitoring' ? '' : s.startsWith('therapy') ? ' warn' : ' bad'); }
      }
      const apply = () => { Object.assign(icd.c, icdCfg()); };
      const ctl = h('div.ctl');
      function num(label, key, min, max, step, unit) {
        const val = h('span.val', st[key] + ' ' + unit);
        const inp = h('input', { type: 'range', min, max, step, value: st[key], 'aria-label': label, oninput: () => { st[key] = +inp.value; val.textContent = st[key] + ' ' + unit; apply(); } });
        ctl.append(h('label', label), val, inp);
      }
      num('VT zone starts at', 'vtRate', 130, 210, 5, '/min'); num('VF zone starts at', 'vfRate', 190, 260, 5, '/min'); num('ATP bursts before shock', 'atp', 0, 3, 1, '');
      const csSel = UI.select(null, Object.keys(CASES).map((k) => [k, CASES[k].name]), st.cs, (v) => { st.cs = v; rebuild(); });
      csSel.setAttribute('aria-label', 'Rhythm scenario'); csSel.style.width = '100%';
      root.append(h('div.sim',
        h('div.sim-main',
          h('section.card', h('div.card-h', h('h2', 'Live strip with marker channel'), h('span.grow'), stateEl, h('button.btn.sm', { type: 'button', onclick: rebuild }, 'Restart')), liveBox,
            h('div.card-b', h('p.muted', { style: { fontSize: '12px' } }, 'VS sensed (below any zone) · TS in the VT zone · FS in the VF zone · TD/FD detection met · TP anti-tachycardia pace · CHG charging · CD charge delivered · ABT aborted · SVT therapy withheld.'))),
          h('section.card', h('div.card-h', h('h3', 'What is happening')), h('div.card-b', noteEl, h('div', { style: { marginTop: '10px' } }, logEl))),
          h('div.two',
            h('section.card', h('div.card-h', h('h3', 'How an ICD decides')), h('div.card-b.prose',
              h('p', h('b', 'Rate zones. '), 'Every sensed ventricular interval is binned: slower than the VT zone (ignore), VT zone, or VF zone. Detection is met when enough consecutive or recent intervals fall in a zone — e.g. 30 of 40 for VF in modern "long-detection" programming.'),
              h('p', h('b', 'Discriminators (VT zone only). '), 'Onset — sudden (VT) vs gradual (sinus tachycardia). Stability — regular (VT) vs irregular (AF). Morphology — does the electrogram match the stored sinus template? Dual-chamber: more V than A events = VT.'),
              h('p', h('b', 'Therapy. '), 'ATP: 8 pulses at about 85–88% of the tachycardia cycle length, as a burst (fixed) or ramp (shortening). Shock: 30–40 J biphasic, RV coil to can. In the VF zone, shocks, usually with one ATP attempt during charging.'),
              h('p', h('b', 'Programming that saves lives. '), 'High detection rates (≥ 185–200/min for primary prevention) and long detection times reduce inappropriate and unnecessary shocks and reduce mortality (MADIT-RIT, ADVANCE III).'))),
            h('section.card', h('div.card-h', h('h3', 'At the bedside')), h('div.card-b.prose', UI.list([
              'A single shock, patient well: device check within 24–48 h. Multiple shocks, or shock with syncope/chest pain/dyspnoea: emergency assessment.',
              'Magnet over an ICD: suspends tachycardia detection and therapy while it is in place. It does not change pacing. Remove it and therapy resumes. (A pacemaker does the opposite: it paces asynchronously.)',
              'Shocks in sinus rhythm = inappropriate therapy: lead fracture, T-wave over-sensing, EMI, or SVT. Apply a magnet, attach external pads, interrogate.',
              'In VF the external defibrillator still comes first if the ICD has not terminated it: place pads at least 8 cm from the generator, anteroposterior if possible.',
              'Touching a patient during an internal shock is safe.',
              'End of life: discuss and deactivate tachycardia therapies so the patient is not shocked while dying.']))))),
        h('div.sim-main',
          h('section.card', h('div.card-h', h('h3', 'Scenario')), h('div.card-b', csSel)),
          h('section.card', h('div.card-h', h('h3', 'Programming')), h('div.card-b', ctl,
            UI.check('SVT discriminators on', true, (v) => { st.svtDisc = v; apply(); }), h('div'),
            UI.check('Shock therapy on', true, (v) => { st.shock = v; apply(); }), h('div'),
            UI.check('Magnet over the generator', false, (v) => { st.magnet = v; apply(); }))))));
      rebuild();
      return { unmount() { live.destroy(); if (strip.ro) strip.ro.disconnect(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
