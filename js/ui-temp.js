/* EP Simulator — Temporary pacing: transvenous box (rate / output mA / sensitivity mV) and
 * transcutaneous pacing (rate / current mA), with capture and sensing threshold drills. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, Mo = EP.Morph;
  const CHB = () => ({ fast: { block: true, retro: { block: true } } });
  const PATIENTS = {
    chb: { name: 'Complete heart block, wide escape 30/min, BP 74/40', intrinsic: 30, cfg: () => ({ sinus: { cl: 760 }, avn: CHB(), foci: [{ id: 'esc', node: 'V', cl: 2000, site: 'fascPost', label: 'escape', startAt: 600, sd: 0.02 }] }) },
    brady: { name: 'Sinus bradycardia 42/min after beta-blocker overdose', intrinsic: 42, cfg: () => ({ sinus: { cl: 1430, resp: 0.02 } }) },
    asys: { name: 'Ventricular standstill — P waves only', intrinsic: 0, cfg: () => ({ sinus: { cl: 700 }, avn: CHB() }) },
    af: { name: 'Slow atrial fibrillation 36/min (digoxin toxicity)', intrinsic: 36, cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib' }, avn: { fast: { erp: 1500, conceal: 0.08 } } }) },
  };

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'temp', title: 'Temporary pacing',
    mount(root) {
      const st = { kind: 'tv', patient: 'chb', rate: 70, out: 0, sens: 2, async: false, on: false, thr: 0.9, rAmp: 7, minCap: null, lostAt: null, sawUnder: false, capRun: 0 };
      if (EP.pending && EP.pending.kind) st.kind = EP.pending.kind;
      let sim, dev, live, lastHandled = 0;
      const canvas = h('canvas', { 'aria-label': 'Monitor: lead II and arterial pressure' });
      const liveBox = h('div.live', canvas);
      const strip = new EP.LiveStrip(canvas, { channels: [{ lead: 1 }, { key: 'pulse', label: 'Arterial pressure' }], windowMs: 8000, rowMm: 24 });
      const vit = h('div.vitals'), steps = h('div.findings'), lcd = h('div.box-lcd'), boxCtl = h('div.ctl'), status = h('div.findings');
      const paceLight = h('span.pill', 'PACE'), senseLight = h('span.pill', 'SENSE');

      function newPatient() {
        const tv = st.kind === 'tv';
        st.thr = tv ? +(0.5 + Math.random() * 1.1).toFixed(1) : Math.round(48 + Math.random() * 44);
        st.rAmp = +(4 + Math.random() * 7).toFixed(1);
        st.minCap = null; st.lostAt = null; st.sawUnder = false; st.capRun = 0; st.on = false; st.out = tv ? 0 : 0; st.sens = 2; st.async = false; st.rate = tv ? 70 : 70;
      }
      function cfg() {
        const tv = st.kind === 'tv';
        return {
          mode: !st.on ? 'OFF' : (st.async ? 'VOO' : 'VVI'), lrl: st.rate, vOut: st.out, vThr: st.thr, vSens: st.sens, rAmp: st.rAmp, tAmp: 0.9, vrp: 250,
          kind: tv ? 'temp' : 'tcp', tcpArtifact: !tv, vSite: tv ? 'rvApex' : 'rvFreeWall', vSpec: tv ? null : Mo.fuse([{ spec: Mo.spec('rvFreeWall'), t: 0 }, { spec: Mo.spec('lvAntWall'), t: 6 }]),
        };
      }
      function rebuild() {
        sim = new EP.HeartSim(PATIENTS[st.patient].cfg());
        dev = new EP.Pacemaker(sim, cfg());
        lastHandled = 0;
        if (live) live.setSim(sim); else live = new EP.Live({ sim, strips: [strip], pulse: true, onTick: tick }).start();
        drawBox();
      }
      function apply() { dev.set(cfg()); drawLcd(); }
      function drawLcd() {
        const tv = st.kind === 'tv';
        lcd.innerHTML = '';
        lcd.append(h('div', 'RATE', h('b', st.on ? String(st.rate) : '--'), 'ppm'), h('div', 'OUTPUT', h('b', st.on ? (tv ? st.out.toFixed(1) : String(st.out)) : '--'), 'mA'),
          tv ? h('div', 'SENSITIVITY', h('b', st.async ? 'ASYNC' : st.sens.toFixed(1)), st.async ? '' : 'mV') : h('div', 'MODE', h('b', st.async ? 'FIXED' : 'DEMAND'), ''));
      }
      function slider(label, key, min, max, step, fmt) {
        const val = h('span.val', fmt(st[key]));
        const inp = h('input', { type: 'range', min, max, step, value: st[key], 'aria-label': label, oninput: () => { st[key] = +inp.value; val.textContent = fmt(st[key]); apply(); } });
        boxCtl.append(h('label', label), val, inp);
      }
      function drawBox() {
        const tv = st.kind === 'tv';
        boxCtl.innerHTML = '';
        slider('Rate', 'rate', 30, 180, 5, (v) => v + ' ppm');
        if (tv) { slider('Output', 'out', 0, 20, 0.1, (v) => v.toFixed(1) + ' mA'); slider('Sensitivity (higher mV = less sensitive)', 'sens', 0.4, 20, 0.2, (v) => v.toFixed(1) + ' mV'); }
        else slider('Current', 'out', 0, 160, 2, (v) => v + ' mA');
        drawLcd();
      }
      const onBtn = h('button.btn.primary', { type: 'button', onclick: () => { st.on = !st.on; onBtn.textContent = st.on ? 'Pacing ON — turn off' : 'Start pacing'; apply(); } }, 'Start pacing');
      const asyncChk = UI.check('Asynchronous (fixed rate, no sensing)', false, (v) => { st.async = v; apply(); });
      function flash(el) { el.classList.add('good'); setTimeout(() => el.classList.remove('good'), 160); }

      function tick(t) {
        // lights + bookkeeping from new events
        for (const e of sim.out) {
          if (e.t <= lastHandled || e.t > t) continue;
          if (e.type === 'spike') {
            flash(paceLight);
            if (e.captured) { st.capRun++; if (st.minCap == null || st.out < st.minCap) st.minCap = st.out; }
            else { const q = sim.out.filter((x) => x.type === 'QRS' && e.t - x.t > 0 && e.t - x.t < 330).length; if (!q) { st.capRun = 0; if (st.minCap != null && st.out < st.minCap) st.lostAt = st.out; } else st.sawUnder = true; }
          }
          if (e.type === 'mark' && e.text === 'VS') flash(senseLight);
        }
        lastHandled = t;
        if (Math.floor(t / 600) === Math.floor((t - 20) / 600)) return;
        // vitals from the last 6 s
        const q = sim.out.filter((e) => e.type === 'QRS' && e.t > t - 6000 && e.t < t - 150);
        const hr = q.length > 1 ? Math.round(60000 / ((q[q.length - 1].t - q[0].t) / (q.length - 1))) : (q.length ? 10 : 0);
        const bp = hr === 0 ? [0, 0] : hr < 36 ? [72, 38] : hr < 50 ? [84, 46] : hr <= 110 ? [108, 62] : hr <= 150 ? [96, 60] : [78, 50];
        vit.innerHTML = '';
        vit.append(h('div', h('div.k', 'Pulse'), h('div.v' + (hr < 45 ? '.bad' : ''), String(hr))), h('div', h('div.k', 'Arterial BP'), h('div.v' + (bp[0] < 90 ? '.bad' : ''), bp[0] ? bp[0] + '/' + bp[1] : '—')),
          h('div', h('div.k', 'Perfusion'), h('div.v' + (bp[0] < 90 ? '.bad' : ''), { style: { fontSize: '13px' } }, bp[0] === 0 ? 'pulseless' : bp[0] < 90 ? 'cool, confused' : 'improving')));
        drawSteps(t, hr);
      }
      function row(done, title, text) { return h('div.finding', h('span.pill' + (done ? '.good' : ''), done ? 'done' : 'to do'), h('div', h('b', title), h('div.muted', text))); }
      function drawSteps(t, hr) {
        const tv = st.kind === 'tv', intr = PATIENTS[st.patient].intrinsic;
        const sp = sim.out.filter((e) => e.type === 'spike' && e.t > t - 5000), cap = sp.filter((e) => e.captured).length;
        const capturing = st.on && sp.length >= 3 && cap >= sp.length - 1;
        steps.innerHTML = ''; status.innerHTML = '';
        const thrFound = st.minCap != null && st.lostAt != null;
        if (tv) {
          steps.append(
            row(st.on && st.rate >= intr + 10, 'Set the rate 10–20/min above the intrinsic rate', 'You cannot judge capture unless the device is pacing faster than the patient.'),
            row(capturing || thrFound, 'Raise the output until every spike captures', 'Capture = a wide QRS with a discordant T wave immediately after each spike, and a pulse with it.'),
            row(thrFound, 'Find the capture threshold', thrFound ? `Lowest output that captured: ${st.minCap.toFixed(1)} mA (capture was lost at ${st.lostAt.toFixed(1)} mA).` : 'Turn the output down slowly until spikes stop producing QRS complexes, then back up. The threshold is the lowest output with 1:1 capture — ideally < 1 mA for a well-placed wire.'),
            row(thrFound && capturing && st.out >= 2 * st.minCap && st.out <= Math.max(4 * st.minCap, 3), 'Leave the output at 2–3 × threshold', 'A safety margin for threshold rise (oedema, drugs, hyperkalaemia, lead movement). Re-check the threshold every shift.'),
            intr > 0 ? row(st.sawUnder || st.sens > st.rAmp, 'Find the sensing threshold', 'Drop the pacing rate below the intrinsic rate, then turn the sensitivity dial toward higher mV until the SENSE light stops and the box paces across native beats. That value is the R-wave amplitude it can see.') : null,
            intr > 0 ? row((st.sawUnder || st.sens > st.rAmp || true) && !st.async && st.sens <= st.rAmp / 2 && st.sens >= 1, 'Set sensitivity to half the sensing threshold', `Typical setting ≈ 2 mV. Too high a number → under-sensing (pacing on T waves). Too low → over-sensing of T waves or muscle (inappropriate inhibition).`) : null);
        } else {
          steps.append(
            row(st.on && st.rate >= 60, 'Pads on, rate 60–80/min', 'Anterior–posterior (left parasternal + left infrascapular) or anterior–lateral. Keep the monitor leads away from the pads.'),
            row(capturing, 'Increase the current until electrical capture', 'Every stimulus is followed by a wide QRS AND a broad T wave. The stimulus artefact alone can look like a QRS — look for the T wave.'),
            row(capturing && hr >= 55, 'Confirm mechanical capture', 'A pulse with every paced beat: arterial line or pulse-oximeter waveform, or a femoral pulse (the neck twitches with every stimulus and misleads you).'),
            row(capturing && st.minCap != null && st.out >= st.minCap + 4 && st.out <= st.minCap + 22, 'Set the current about 10% (5–10 mA) above threshold', st.minCap != null ? `Lowest current that captured so far: ${st.minCap} mA.` : 'Typical thresholds are 40–80 mA; higher with obesity, COPD, effusions or poor pad contact.'),
            row(false, 'Analgesia, sedation, and plan the next step', 'Transcutaneous pacing is painful and unreliable beyond minutes to hours: it is a bridge to a transvenous wire or to the reversible cause being treated.'));
        }
        if (st.on && sp.length >= 3) {
          if (capturing) status.append(h('div.note.good', h('b', 'Capturing. '), tv ? 'Spike → wide QRS (LBBB pattern from the RV apex) → pulse.' : 'Artefact → wide QRS with T wave → arterial upstroke.'));
          else if (cap === 0) status.append(h('div.note.bad', h('b', 'No capture. '), tv ? 'Spikes without QRS complexes. Increase the output; if > 5–10 mA is needed the wire has moved — reposition, check connections and battery.' : 'Stimulus artefacts without a T wave or a pulse. Increase the current; check pad contact and position.'));
          else status.append(h('div.note', h('b', 'Intermittent capture. '), 'You are sitting at threshold. This is where an unsupervised patient loses pacing — raise the output.'));
          const under = sim.out.some((e) => e.type === 'spike' && e.t > t - 5000 && !e.captured && sim.out.some((x) => x.type === 'QRS' && e.t - x.t > 0 && e.t - x.t < 330));
          if (under && !st.async) status.append(h('div.note.bad', h('b', 'Under-sensing. '), 'Spikes are landing on the ST-T of native beats: the R wave is smaller than the sensitivity setting. Turn sensitivity to a LOWER mV value. A stimulus on the T wave can start VF.'));
          if (st.async && intr > 0) status.append(h('div.note', h('b', 'Asynchronous. '), 'The box ignores the patient\'s own beats. Acceptable in standstill; with an underlying rhythm it risks R-on-T.'));
        } else if (!st.on) status.append(h('div.muted', 'The device is off. The patient is on the monitor with their own rhythm.'));
        if (st.on && tv && !st.async && st.sens < 1) status.append(h('div.note', h('b', 'Very sensitive setting. '), 'Below about 1 mV the box may count T waves, P waves or muscle noise as R waves and withhold pacing.'));
      }

      const kindSeg = UI.seg([['tv', 'Transvenous wire'], ['tc', 'Transcutaneous pads']], st.kind, (v) => { st.kind = v; newPatient(); onBtn.textContent = 'Start pacing'; asyncChk.input.checked = false; teach(); rebuild(); }, 'Pacing method');
      const patSel = UI.select(null, Object.keys(PATIENTS).map((k) => [k, PATIENTS[k].name]), st.patient, (v) => { st.patient = v; newPatient(); onBtn.textContent = 'Start pacing'; asyncChk.input.checked = false; rebuild(); });
      patSel.setAttribute('aria-label', 'Patient'); patSel.style.width = '100%';
      const teachEl = h('div.card-b.prose');
      function teach() {
        teachEl.innerHTML = '';
        if (st.kind === 'tv') teachEl.append(
          h('h4', 'The three dials'), UI.list(['RATE — pulses per minute. Set above the intrinsic rate to take over; for overdrive suppression of torsades use 90–110.', 'OUTPUT (mA) — current delivered. The capture threshold is the smallest current that reliably depolarises the ventricle; aim < 1 mA at insertion, run at 2–3× threshold.', 'SENSITIVITY (mV) — the smallest signal the box will call an R wave. It is a fence height: a HIGHER number is a higher fence, so fewer signals get over (less sensitive). Fully clockwise is ASYNC: no sensing at all.']),
          h('h4', 'Getting the wire there'), UI.list(['Right internal jugular or left subclavian give the straightest route to the RV apex. Balloon-tipped wires float with flow; advance with the balloon up, deflate once across the tricuspid valve.', 'ECG guidance from the tip: large P waves in the RA, large QRS in the RV, ST elevation (injury current) when the tip touches endocardium.', 'Correct position paces with an LBBB pattern and superior axis (negative II, III, aVF). An RBBB pattern suggests the coronary sinus, septal perforation or the left ventricle.']),
          h('h4', 'When it stops working'), UI.list(['Spike, no QRS: threshold has risen or the wire has moved — increase output, turn the patient on the left side, reposition.', 'No spike: disconnected cable, flat battery, or over-sensing — switch to ASYNC as a test.', 'Spikes on T waves: under-sensing — lower the mV number.', 'Hiccups or abdominal twitching: diaphragmatic pacing; suspect perforation if new.']));
        else teachEl.append(
          h('h4', 'What counts as capture'), UI.list(['Electrical: each pacing artefact is followed by a wide QRS and — the part people miss — a tall, broad T wave.', 'Mechanical: a pulse with each one. Use the arterial line or the pulse-oximeter waveform; the carotid is unreliable because the neck muscles jerk with every stimulus.', 'The artefact has an after-potential that looks like a QRS. If the "QRS" has no T wave and there is no pulse, it is artefact.']),
          h('h4', 'Settings'), UI.list(['Demand mode at 60–80/min for bradycardia; start at 0 mA and climb in 5–10 mA steps (in arrest, start at maximum and come down).', 'Typical threshold 40–80 mA; set 10% above it.', 'Fixed (asynchronous) mode only if artefact prevents sensing.']),
          h('h4', 'Limits'), UI.list(['Painful: give analgesia and sedation as blood pressure allows.', 'Failure to capture: pad position, poor contact, large chest, pneumothorax, pericardial effusion, acidosis, hyperkalaemia.', 'It buys time. Atropine and chronotropes (epinephrine, dopamine, isoprenaline) run in parallel while a transvenous wire or definitive treatment is arranged.']));
      }
      root.append(h('div.sim',
        h('div.sim-main',
          h('section.card', h('div.card-h', h('h2', 'Bedside monitor'), h('span.grow'), paceLight, senseLight), liveBox, h('div.card-b', vit)),
          h('section.card', h('div.card-h', h('h3', 'Procedure')), h('div.card-b', steps, h('div.findings', { style: { marginTop: '10px' } }, status))),
          h('section.card', h('div.card-h', h('h3', 'Notes')), teachEl)),
        h('div.sim-main',
          h('section.card', h('div.card-b', h('div', { style: { marginBottom: '10px' } }, kindSeg), patSel, h('div', { style: { marginTop: '8px' } }, h('button.btn.sm', { type: 'button', onclick: () => { newPatient(); onBtn.textContent = 'Start pacing'; asyncChk.input.checked = false; rebuild(); } }, 'New patient (new thresholds)')))),
          h('section.card', h('div.card-h', h('h3', 'Pacing box')), h('div.card-b', h('div.box', lcd, boxCtl, asyncChk, onBtn))))));
      newPatient(); teach(); rebuild();
      return { unmount() { live.destroy(); if (strip.ro) strip.ro.disconnect(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
