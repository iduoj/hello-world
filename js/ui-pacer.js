/* EP Simulator — Pacemaker simulator: programmable device on a simulated patient, with a marker
 * channel, timing-cycle bars, automatic strip interpretation and troubleshooting cases. */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI;
  const CHB = () => ({ fast: { block: true, retro: { block: true } } });
  const ESC = (cl) => ({ id: 'esc', node: 'V', cl: cl || 1850, site: 'fascPost', label: 'escape', startAt: 700, sd: 0.02 });

  const PATIENTS = {
    chb: { name: 'Complete heart block — sinus 75, escape 32/min', cfg: () => ({ sinus: { cl: 800 }, avn: CHB(), foci: [ESC()] }) },
    brady: { name: 'Sinus bradycardia 38/min, normal AV conduction', cfg: () => ({ sinus: { cl: 1580, resp: 0.02 } }) },
    arrest: { name: 'Sinus arrest — junctional escape 34/min', cfg: () => ({ sinus: { on: false }, foci: [{ id: 'j', node: 'H', cl: 1760, label: 'junctional', startAt: 500 }] }) },
    nsr: { name: 'Sinus rhythm 72/min (device should stay quiet)', cfg: () => ({ sinus: { cl: 833 } }) },
    first: { name: 'Sinus 68/min with PR 320 ms', cfg: () => ({ sinus: { cl: 880 }, avn: { fast: { min: 215 } } }) },
    chbFast: { name: 'Complete heart block with sinus tachycardia 138/min', cfg: () => ({ sinus: { cl: 435, resp: 0, sd: 0.004 }, avn: CHB(), foci: [ESC()] }) },
    afSlow: { name: 'Atrial fibrillation, slow ventricular response', cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib' }, avn: { fast: { erp: 1150, conceal: 0.12 } } }) },
    afChb: { name: 'Atrial fibrillation with complete heart block', cfg: () => ({ sinus: { on: false }, atria: { mode: 'fib' }, avn: CHB(), foci: [ESC(1900)] }) },
    retro: { name: 'Sinus node disease, intact retrograde (VA) conduction, PVCs', cfg: () => ({ sinus: { cl: 1500, resp: 0 }, avn: { fast: { retro: { delay: 210, erp: 240, block: false } } }, foci: [{ id: 'pvc', node: 'V', kind: 'coupled', coupling: 640, every: 6, site: 'rvotSeptal', label: 'PVC' }] }) },
    asys: { name: 'Complete heart block with no escape rhythm', cfg: () => ({ sinus: { cl: 780 }, avn: CHB() }) },
  };

  const FAULTS = {
    none: { name: 'No fault', set: {}, imp: [520, 610], batt: '2.78 V (good)' },
    vDislodge: { name: 'Ventricular lead dislodgement', set: { vThr: 6.5, rAmp: 2.0 }, imp: [520, 480], batt: '2.78 V', dx: 'Ventricular failure to capture and under-sensing',
      why: 'The tip has lost contact with the endocardium: the capture threshold is far above the programmed output and the sensed R wave is small. Usually early (first weeks). The chest X-ray shows the tip somewhere other than where it was left.',
      fix: 'Raise the output as a temporary measure if any capture is possible; reposition the lead. If pacing-dependent: transcutaneous / temporary transvenous back-up.' },
    aDislodge: { name: 'Atrial lead dislodgement', set: { aThr: 7, pAmp: 0.25 }, imp: [430, 610], batt: '2.78 V', dx: 'Atrial failure to capture and under-sensing',
      why: 'Atrial spikes are not followed by P waves, and native P waves are not seen (no AS markers, so no tracking). The ventricle is still paced, but AV synchrony is lost.',
      fix: 'Reposition the atrial lead. Meanwhile program VVI/DDI to avoid meaningless atrial output.' },
    exit: { name: 'Threshold rise (exit block, hyperkalaemia, class Ic drug, MI at the tip)', set: { vThr: 3.4 }, imp: [520, 640], batt: '2.78 V', dx: 'Ventricular failure to capture — threshold now above output',
      why: 'Lead position and impedance are unchanged but the myocardium needs more energy: inflammation/fibrosis at the tip weeks after implant, hyperkalaemia, acidosis, flecainide/propafenone, or infarction of the paced tissue.',
      fix: 'Increase the output to restore a 2:1 voltage safety margin and treat the cause (K⁺, pH, drug).' },
    fracture: { name: 'Conductor fracture', set: { noiseV: 7, intermittent: 0.45 }, imp: [520, '> 2500'], batt: '2.78 V', dx: 'Over-sensing of make-break noise and intermittent failure to output',
      why: 'The broken conductor ends touch and separate. Each contact generates a non-physiological signal that the device reads as an R wave (inhibition → pauses with no spikes); when open, the stimulus never reaches the heart. Impedance is very high. Classic site: between clavicle and first rib (subclavian crush).',
      fix: 'Lead replacement. In a pacing-dependent patient program asynchronous pacing (or apply a magnet) so noise cannot inhibit output — it will not fix an open circuit.' },
    insulation: { name: 'Insulation breach', set: { vThr: 2.1, rAmp: 3.0, noiseV: 3 }, imp: [520, '< 200'], batt: '2.61 V (draining early)', dx: 'Current leak: under-sensing, intermittent non-capture, low impedance',
      why: 'Current escapes through the defect, so less reaches the tip (threshold appears higher), the electrogram is attenuated, and muscle potentials can enter the circuit. Impedance is low and the battery depletes quickly.',
      fix: 'Lead revision. Unipolar reprogramming can sometimes temporise an outer-insulation failure.' },
    tOver: { name: 'T-wave over-sensing', set: { tAmp: 3.4, vrp: 200 }, imp: [520, 610], batt: '2.78 V', dx: 'Ventricular over-sensing — the paced rate is slower than programmed',
      why: 'The device counts the T wave as a second ventricular event and restarts its timer, so the escape interval is measured from the T wave: the pacing rate falls below the lower rate limit by exactly the QRS-to-T time.',
      fix: 'Make the ventricular channel less sensitive (higher mV) or lengthen the ventricular refractory period.' },
    myo: { name: 'Myopotential over-sensing (unipolar sensing)', set: { noiseV: 4.2, kind: 'unipolar' }, imp: [520, 610], batt: '2.78 V', dx: 'Ventricular over-sensing with inhibition — pauses during arm movement',
      why: 'A unipolar circuit uses the generator can as the anode, so pectoral muscle potentials are in the sensing field. They inhibit ventricular output; in a dual-chamber device they can also be tracked.',
      fix: 'Reprogram to bipolar sensing or reduce sensitivity (raise the mV value) while keeping a 2:1 margin on the R wave.' },
    vUnder: { name: 'Ventricular under-sensing', set: { rAmp: 1.7 }, imp: [520, 610], batt: '2.78 V', dx: 'Ventricular under-sensing — spikes march through intrinsic beats',
      why: 'The R wave at the lead is smaller than the programmed sensitivity (new bundle branch block, infarct, PVC morphology, lead maturation). The device behaves as if asynchronous: stimuli land in the ST-T and cannot capture — or capture on the T wave.',
      fix: 'Make the channel more sensitive (LOWER the mV value). If the electrogram is tiny, reposition the lead.' },
    aUnder: { name: 'Atrial under-sensing', set: { pAmp: 0.3 }, imp: [520, 610], batt: '2.78 V', dx: 'Atrial under-sensing — P waves are not tracked; atrial spikes follow native P waves',
      why: 'The atrial electrogram is below the sensitivity setting, so the device does not start an AV delay after native P waves. It paces the atrium at the lower rate (often uselessly, just after a P wave) and AV synchrony is lost.',
      fix: 'Increase atrial sensitivity (lower mV value); check for lead dislodgement.' },
    xtalk: { name: 'Crosstalk (safety pacing off)', set: { crosstalk: true, safetyPace: false }, imp: [520, 610], batt: '2.78 V', dx: 'Crosstalk inhibition — atrial spikes with no ventricular output',
      why: 'The ventricular channel senses the atrial stimulus and concludes the ventricle has depolarised. Ventricular output is inhibited: in complete heart block that is asystole with atrial spikes marching on. Promoted by high atrial output, high ventricular sensitivity and a short ventricular blanking period.',
      fix: 'Lengthen ventricular blanking, lower atrial output, reduce ventricular sensitivity, and turn ventricular safety pacing ON (a sense in the crosstalk window then triggers a committed pace at 110 ms).' },
    ffr: { name: 'Far-field R-wave over-sensing on the atrial lead', set: { ffr: 1.2, pvab: 15 }, imp: [520, 610], batt: '2.78 V', dx: 'Atrial over-sensing of the QRS → false mode switch',
      why: 'The atrial lead sees the ventricular depolarisation as a second atrial event each cycle. The device calculates an atrial rate twice the real one, declares an atrial tachyarrhythmia and switches to a non-tracking mode — AV synchrony is lost with no arrhythmia present.',
      fix: 'Lengthen post-ventricular atrial blanking (PVAB) or reduce atrial sensitivity.' },
    battery: { name: 'Battery at elective replacement / end of life', set: { forceMode: 'VVI', lrl: 65, vOut: 1.6, vThr: 0.9 }, imp: [520, 610], batt: '2.42 V — ERI reached', dx: 'Reversion to VVI at a fixed rate',
      why: 'To save energy the device has abandoned dual-chamber and rate-response functions and paces VVI at its elective-replacement rate. A magnet rate lower than at implant is the bedside clue. Pacemaker syndrome can appear because AV synchrony is lost.',
      fix: 'Generator change. Do not confuse with malfunction of the leads — capture and sensing are intact.' },
  };

  const QUIZ = [
    { patient: 'chb', pm: { mode: 'DDD' }, fault: 'vDislodge' }, { patient: 'nsr', pm: { mode: 'VVI', lrl: 60 }, fault: 'vUnder' },
    { patient: 'chb', pm: { mode: 'VVI', lrl: 70 }, fault: 'tOver' }, { patient: 'chb', pm: { mode: 'DDD' }, fault: 'xtalk', force: { aSens: 0.5 }, patientOverride: 'asys2' },
    { patient: 'chb', pm: { mode: 'VVI', lrl: 70 }, fault: 'fracture' }, { patient: 'chb', pm: { mode: 'DDD' }, fault: 'aUnder' },
    { patient: 'chb', pm: { mode: 'DDD' }, fault: 'ffr' }, { patient: 'chb', pm: { mode: 'DDD' }, fault: 'battery' }, { patient: 'chb', pm: { mode: 'VVI', lrl: 70 }, fault: 'exit' },
  ];
  PATIENTS.asys2 = { name: 'Complete heart block, sinus bradycardia 45/min, no escape', hidden: true, cfg: () => ({ sinus: { cl: 1330 }, avn: CHB() }) };

  /* Read the last few seconds of the strip the way a clinician would. → [[level, title, text]] */
  function analyze(sim, dev, t) {
    const W = 9000, ev = sim.out.filter((e) => e.t > t - W && e.t <= t - 160), f = [];
    const q = ev.filter((e) => e.type === 'QRS'), sp = ev.filter((e) => e.type === 'spike'), mk = ev.filter((e) => e.type === 'mark'), P = ev.filter((e) => e.type === 'P');
    const cap = EP.Pacemaker.MODES[dev.mode] || {}, lri = dev.lri;
    const vS = sp.filter((s) => s.ch === 'V'), aS = sp.filter((s) => s.ch === 'A');
    const paced = (x) => x.label === 'paced' || (x.parts && x.parts.some((p) => p.cap && p.c.type === 'pace'));
    const intrinsic = q.filter((x) => !paced(x) || x.label === 'fusion');
    if (!cap.pa && !cap.pv) return [['', 'Pacing off', 'The device is only monitoring.']];
    // capture
    const vNc = vS.filter((s) => !s.captured);
    const func = vNc.filter((s) => q.some((x) => s.t - x.t > -20 && s.t - x.t < 340));
    const trueNc = vNc.filter((s) => !func.includes(s));
    if (trueNc.length) f.push(['bad', 'Ventricular failure to capture', `${trueNc.length} of ${vS.length} ventricular stimuli were not followed by a QRS although the ventricle was excitable.`]);
    else if (vS.length) f.push(['good', 'Ventricular capture', 'Each ventricular stimulus is followed immediately by a wide QRS and a discordant T wave — and by a pulse.']);
    if (func.length) f.push(['warn', 'Stimulus in the refractory period', `${func.length} stimuli fell on or just after an intrinsic QRS and could not capture. Either the device did not sense that beat (under-sensing) or it is pacing asynchronously (magnet, VOO/DOO).`]);
    const aNc = aS.filter((s) => !s.captured);
    const aFunc = aNc.filter((s) => P.some((x) => s.t - x.t > -20 && s.t - x.t < 240));
    if (aNc.length - aFunc.length > 0) f.push(['bad', 'Atrial failure to capture', 'Atrial stimuli are not followed by P waves.']);
    else if (aS.length) f.push(['good', 'Atrial capture', 'Each atrial stimulus is followed by a (paced-morphology) P wave.']);
    // ventricular sensing
    if (cap.sv) {
      const vsM = mk.filter((m) => m.text === 'VS');
      const missed = intrinsic.filter((x) => !vsM.some((m) => m.t - x.t > -30 && m.t - x.t < 190) && x.label !== 'fusion');
      if (missed.length && intrinsic.length) f.push(['bad', 'Ventricular under-sensing', `${missed.length} intrinsic QRS complexes produced no VS marker; the timer was not reset.`]);
      const ghost = vsM.filter((m) => !q.some((x) => m.t - x.t > -40 && m.t - x.t < 200));
      if (ghost.length) f.push(['bad', 'Ventricular over-sensing', `${ghost.length} VS markers do not line up with a QRS (T wave, noise, crosstalk or far-field signal). Output is inhibited and the rate falls below the lower rate limit.`]);
      if (!missed.length && !ghost.length && intrinsic.length) f.push(['good', 'Ventricular sensing', 'Intrinsic beats are marked VS and inhibit ventricular output.']);
    }
    if (cap.sa) {
      const asM = mk.filter((m) => m.text === 'AS' || m.text === 'AR');
      const nat = P.filter((x) => x.kind !== 'paced');
      const missedA = nat.filter((x) => !asM.some((m) => m.t - x.t > -10 && m.t - x.t < 160));
      if (nat.length >= 3 && missedA.length > nat.length * 0.5) f.push(['bad', 'Atrial under-sensing', 'Native P waves are not marked AS/AR.']);
      const ghostA = asM.filter((m) => !P.some((x) => m.t - x.t > -20 && m.t - x.t < 170));
      if (sim.A.mode === 'normal' && ghostA.length >= 3) f.push(['bad', 'Atrial over-sensing', 'Atrial markers without P waves (far-field R wave or noise).']);
    }
    // pauses
    if (cap.pv) {
      let pause = 0;
      const all = q.map((x) => x.t).concat(trueNc.map((s) => s.t)).sort((a, b) => a - b);
      for (let i = 1; i < all.length; i++) if (all[i] - all[i - 1] > lri * 1.18 + 60) pause++;
      if (all.length && t - 160 - all[all.length - 1] > lri * 1.3 + 100) pause++;
      if (!all.length) pause++;
      if (pause) f.push(['bad', 'Pauses longer than the lower rate interval', 'No stimulus was delivered when one was due: over-sensing (inhibition), an open circuit, or battery failure. A magnet restores pacing if the cause is over-sensing.']);
    }
    // patterns
    const txt = mk.map((m) => m.text).join(' ');
    if (/MS/.test(txt) || dev.switched) f.push(['warn', 'Mode switch', 'A fast atrial rate was detected, so the device stopped tracking the atrium (DDI/VVI behaviour) to avoid rapid ventricular pacing.']);
    if (cap.track && /AS VP/.test(txt) && !dev.switched) {
      const ars = (txt.match(/AR/g) || []).length, vps = (txt.match(/VP/g) || []).length;
      const vv = []; const vpm = mk.filter((m) => m.text === 'VP'); for (let i = 1; i < vpm.length; i++) vv.push(vpm[i].t - vpm[i - 1].t);
      const atUrl = vv.length > 3 && vv.filter((x) => Math.abs(x - dev.uri) < 25).length >= vv.length * 0.6;
      const retro = P.filter((x) => x.kind === 'retro').length;
      if (atUrl && retro >= 3) f.push(['bad', 'Pacemaker-mediated tachycardia', 'Ventricular pacing at the upper rate, each paced beat conducting backwards to the atrium; the retrograde P is sensed after PVARP and triggers the next paced beat. The device is the antegrade limb of a re-entry circuit. A magnet, a longer PVARP, or PVARP extension after a PVC breaks it.']);
      else if (atUrl && ars >= 1) f.push(['warn', 'Upper rate behaviour — pacemaker Wenckebach', 'The sinus rate exceeds the maximum tracking rate. The device delays each ventricular pace to respect the upper rate, so the AS–VP interval lengthens until a P wave falls in PVARP and is not tracked.']);
      else if (ars >= 2 && ars >= vps * 0.6) f.push(['warn', 'Upper rate behaviour — 2:1 block', 'The atrial cycle is shorter than the total atrial refractory period (AV delay + PVARP): every other P wave falls in PVARP and is ignored. The paced rate suddenly halves.']);
      else f.push(['good', 'P-synchronous ventricular pacing', 'Each native P wave (AS) starts the sensed AV delay and is followed by a ventricular pace (VP): AV synchrony is preserved.']);
    }
    if (/AP VS/.test(txt)) f.push(['good', 'Atrial pacing with intrinsic conduction', 'The atrium is paced (AP) and the impulse conducts through the patient\'s own AV node (VS) — the ventricular channel is inhibited.']);
    if (/AP VP/.test(txt)) f.push(['good', 'AV sequential pacing', 'Atrial then ventricular pacing separated by the programmed paced AV delay.']);
    if (!sp.length && q.length) f.push(['good', 'Complete inhibition', 'The intrinsic rate is above the lower rate limit and conduction is intact: the device senses and does nothing. No spikes is the expected finding.']);
    if (dev.c.magnet) f.push(['', 'Magnet applied', 'Asynchronous pacing at the magnet rate: sensing is disabled, so stimuli compete with any intrinsic rhythm.']);
    return f;
  }
  EP.pacerAnalyze = analyze;

  const NBG = [['I — chamber paced', 'O none · A atrium · V ventricle · D dual'], ['II — chamber sensed', 'O none · A · V · D dual'], ['III — response to sensing', 'O none · I inhibited · T triggered · D dual (inhibit + trigger)'], ['IV — rate modulation', 'R = sensor-driven rate response'], ['V — multisite pacing', 'O · A · V · D (e.g. biventricular)']];
  const MODES = [['DDD', 'Paces and senses both chambers. A sensed P inhibits atrial output and triggers a ventricular pace after the AV delay; a sensed R inhibits ventricular output. The workhorse for AV block with a working sinus node.'], ['VVI', 'Ventricular demand pacing. Ignores the atria. For permanent AF with a slow ventricular rate, or as back-up.'], ['AAI', 'Atrial demand pacing. Only for sinus node disease with reliable AV conduction — it cannot rescue AV block.'], ['DDI', 'Paces both chambers, senses both, but never tracks: a sensed P inhibits atrial output only. Used for atrial tachyarrhythmias (and is where mode switch goes).'], ['VDD', 'Senses atrium and ventricle, paces only the ventricle. P-synchronous pacing from a single lead or a leadless device with atrial mechanical sensing; no atrial pacing support.'], ['VOO / DOO / AOO', 'Asynchronous: fixed-rate output, no sensing. Magnet mode; used around electrocautery and MRI in pacing-dependent patients. Risk: stimulus on a T wave.']];

  EP.Modules = EP.Modules || [];
  EP.Modules.push({
    id: 'pacemaker', title: 'Pacemaker',
    mount(root) {
      const state = { patient: 'chb', fault: 'none', quiz: null, pm: Object.assign({}, EP.Pacemaker.DEF, { mode: 'DDD' }) };
      let sim, dev, live;
      const canvas = h('canvas', { 'aria-label': 'Live rhythm strip with marker channel' });
      const liveBox = h('div.live', canvas);
      const strip = new EP.LiveStrip(canvas, { channels: [{ lead: 1 }, { key: 'pulse', label: 'Arterial pressure' }], windowMs: 8500, markers: true, timers: true, rowMm: 22 });
      const findEl = h('div.findings'), interEl = h('div');
      function devCfg() {
        const f = FAULTS[state.fault], c = Object.assign({}, state.pm, f.set);
        if (f.set.forceMode) c.mode = f.set.forceMode;
        return c;
      }
      function rebuild() {
        sim = new EP.HeartSim(PATIENTS[state.patient].cfg());
        dev = new EP.Pacemaker(sim, devCfg());
        const f = FAULTS[state.fault];
        if (f.set.intermittent) { const flip = (t) => { dev.c.noOutput = sim.rng() < f.set.intermittent; sim.schedule(t + 900 + 1500 * sim.rng(), flip); }; sim.schedule(600, flip); }
        if (live) live.setSim(sim); else live = new EP.Live({ sim, strips: [strip], pulse: true, onTick: tick }).start();
        interEl.innerHTML = '';
      }
      let lastFind = 0;
      function tick(t) {
        if (t - lastFind < 700) return; lastFind = t;
        const f = analyze(sim, dev, t);
        findEl.innerHTML = '';
        for (const [lv, title, text] of f) findEl.append(h('div.finding', h('span.pill' + (lv ? '.' + lv : ''), lv === 'good' ? 'ok' : lv === 'bad' ? 'fault' : lv === 'warn' ? 'note' : 'info'), h('div', h('b', title), h('div.muted', text))));
        if (!f.length) findEl.append(h('div.muted', 'Collecting a few seconds of rhythm…'));
        rateEl.textContent = dev.mode + (dev.switched ? ' (switched)' : '');
      }
      // ---- controls ----
      const ctl = h('div.ctl');
      const setters = {};
      function num(label, key, min, max, step, unit) {
        const val = h('span.val', state.pm[key] + ' ' + unit);
        const inp = h('input', { type: 'range', min, max, step, value: state.pm[key], 'aria-label': label, oninput: () => { state.pm[key] = +inp.value; val.textContent = state.pm[key] + ' ' + unit; dev.set(devCfg()); } });
        setters[key] = (v) => { state.pm[key] = v; inp.value = v; val.textContent = v + ' ' + unit; };
        ctl.append(h('label', label), val, inp);
      }
      const modeSel = h('select', { 'aria-label': 'Pacing mode', onchange: () => { state.pm.mode = modeSel.value; dev.set(devCfg()); } }, ['DDD', 'VVI', 'AAI', 'DDI', 'VDD', 'DOO', 'VOO', 'AOO', 'ODO'].map((m) => h('option', { value: m }, m === 'ODO' ? 'ODO (sensing only)' : m)));
      modeSel.value = state.pm.mode;
      ctl.append(h('label', 'Mode'), h('span.val', ''), modeSel);
      num('Lower rate', 'lrl', 30, 120, 5, '/min'); num('Upper tracking rate', 'url', 90, 180, 5, '/min');
      num('Paced AV delay', 'avdP', 80, 350, 10, 'ms'); num('Sensed AV delay', 'avdS', 60, 320, 10, 'ms'); num('PVARP', 'pvarp', 150, 500, 10, 'ms');
      num('Ventricular output', 'vOut', 0.25, 7.5, 0.25, 'V'); num('Atrial output', 'aOut', 0.25, 7.5, 0.25, 'V');
      num('Ventricular sensitivity', 'vSens', 0.5, 12, 0.5, 'mV'); num('Atrial sensitivity', 'aSens', 0.1, 4, 0.1, 'mV');
      const magnet = UI.check('Magnet on the generator', false, (v) => { state.pm.magnet = v; dev.set(devCfg()); });
      const patSel = UI.select(null, Object.keys(PATIENTS).filter((k) => !PATIENTS[k].hidden).map((k) => [k, PATIENTS[k].name]), state.patient, (v) => { state.patient = v; state.quiz = null; quizBox(); rebuild(); });
      patSel.setAttribute('aria-label', 'Patient rhythm'); patSel.style.width = '100%';
      const faultSel = UI.select(null, Object.keys(FAULTS).map((k) => [k, FAULTS[k].name]), 'none', (v) => { state.fault = v; state.quiz = null; quizBox(); rebuild(); faultNote(); });
      faultSel.setAttribute('aria-label', 'Fault'); faultSel.style.width = '100%';
      const faultInfo = h('div');
      function faultNote() {
        faultInfo.innerHTML = '';
        const f = FAULTS[state.fault];
        if (state.fault !== 'none' && !state.quiz) faultInfo.append(h('div.prose', { style: { marginTop: '8px', fontSize: '13px' } }, h('h4', 'What you should see'), h('p', f.dx + '.'), h('h4', 'Why'), h('p', f.why), h('h4', 'What to do'), h('p', f.fix)));
      }
      const rateEl = h('span.pill', 'DDD');
      const freeze = h('button.btn.sm', { type: 'button', onclick: () => { if (live.running) { live.stop(); freeze.textContent = 'Resume'; } else { live.start(); freeze.textContent = 'Freeze'; } } }, 'Freeze');
      // ---- interrogation ----
      const interBtn = h('button.btn.sm', { type: 'button', onclick: () => {
        const c = dev.c, f = FAULTS[state.fault];
        interEl.innerHTML = '';
        interEl.append(h('div.scroll-x', h('table.tbl', h('thead', h('tr', h('th', ''), h('th', 'Atrial lead'), h('th', 'Ventricular lead'))),
          h('tbody', h('tr', h('td', 'Capture threshold'), h('td.mono', c.aThr + ' V'), h('td.mono', c.vThr + ' V')),
            h('tr', h('td', 'Programmed output'), h('td.mono', c.aOut + ' V'), h('td.mono', c.vOut + ' V')),
            h('tr', h('td', 'Sensed amplitude'), h('td.mono', 'P ' + c.pAmp + ' mV'), h('td.mono', 'R ' + c.rAmp + ' mV')),
            h('tr', h('td', 'Programmed sensitivity'), h('td.mono', c.aSens + ' mV'), h('td.mono', c.vSens + ' mV')),
            h('tr', h('td', 'Lead impedance'), h('td.mono', f.imp[0] + ' Ω'), h('td.mono', f.imp[1] + ' Ω')),
            h('tr', h('td', 'Battery'), h('td.mono', { colSpan: 2 }, f.batt))))),
          h('p.muted', { style: { fontSize: '12px', marginTop: '6px' } }, 'Safety margins: output ≥ 2× the voltage threshold; sensitivity setting ≤ half the measured P/R amplitude. Normal impedance ≈ 300–1200 Ω.'));
      } }, 'Interrogate the device');
      // ---- troubleshooting quiz ----
      const quizEl = h('div');
      function quizBox() {
        quizEl.innerHTML = '';
        if (!state.quiz) { quizEl.append(h('p.muted', 'A fault is applied without telling you which. Read the strip and markers, interrogate the device, then commit to a diagnosis.'), h('div', { style: { marginTop: '8px' } }, h('button.btn.primary', { type: 'button', onclick: startQuiz }, 'Give me a mystery fault'))); return; }
        const q = state.quiz;
        quizEl.append(h('p', h('b', 'Patient: '), PATIENTS[q.patient].name + '. Programmed ' + q.pm.mode + (q.pm.lrl ? ' ' + q.pm.lrl : ' 60') + '/min.'), h('p.muted', { style: { margin: '4px 0 8px' } }, 'What is wrong?'));
        const opts = h('div.opts');
        for (const k of q.options) {
          const b = h('button.opt', { type: 'button', onclick: () => {
            if (q.done) return; q.done = true;
            for (const x of opts.children) { x.disabled = true; if (x.dataset.k === q.fault) x.classList.add('right'); }
            if (k !== q.fault) b.classList.add('wrong');
            const f = FAULTS[q.fault];
            quizEl.append(h('div.note' + (k === q.fault ? '.good' : '.bad'), { style: { marginTop: '8px' } }, h('b', (k === q.fault ? 'Correct — ' : 'Not quite — ') + f.name + '. '), f.dx + '. ' + f.why + ' ', h('b', 'Fix: '), f.fix),
              h('div', { style: { marginTop: '8px' } }, h('button.btn', { type: 'button', onclick: startQuiz }, 'Next case')));
          } }, FAULTS[k].name);
          b.dataset.k = k; opts.append(b);
        }
        quizEl.append(opts);
      }
      function startQuiz() {
        const q = Object.assign({}, QUIZ[Math.floor(Math.random() * QUIZ.length)]);
        const others = Object.keys(FAULTS).filter((k) => k !== 'none' && k !== q.fault).sort(() => Math.random() - 0.5).slice(0, 3);
        q.options = others.concat([q.fault]).sort(() => Math.random() - 0.5); q.done = false;
        state.quiz = q; state.patient = q.patientOverride || q.patient; state.fault = q.fault;
        Object.assign(state.pm, EP.Pacemaker.DEF, q.pm, q.force || {}); state.pm.magnet = false; magnet.input.checked = false;
        modeSel.value = state.pm.mode; for (const k in setters) setters[k](state.pm[k]);
        patSel.sel ? (patSel.sel.value = q.patient) : (patSel.value = q.patient); faultSel.value = 'none'; faultInfo.innerHTML = '';
        rebuild(); quizBox();
      }
      const ref = h('div.two',
        h('section.card', h('div.card-h', h('h3', 'Is it working? A five-question read')), h('div.card-b.prose', h('ol', { style: { margin: 0, paddingLeft: '1.2em' } },
          h('li', h('b', 'Is there output when there should be? '), 'No interval between ventricular events should exceed the lower rate interval. A pause without a spike = over-sensing or an open circuit.'),
          h('li', h('b', 'Does every stimulus capture? '), 'Atrial spike → P wave. Ventricular spike → wide QRS with a T wave, and a pulse. A spike followed by nothing while the tissue is excitable = failure to capture.'),
          h('li', h('b', 'Does it sense? '), 'Intrinsic P and R waves should reset the timers (AS/VS markers). Spikes marching through native beats = under-sensing.'),
          h('li', h('b', 'Is the AV relationship as programmed? '), 'AS–VP at the sensed AV delay, AP–VP at the paced AV delay, never faster than the upper tracking rate.'),
          h('li', h('b', 'Does the paced QRS fit the lead position? '), 'RV apex → LBBB pattern with a superior axis. A new RBBB pattern asks where the lead is (see Devices).')))),
        h('section.card', h('div.card-h', h('h3', 'Timing cycles')), h('div.card-b.prose',
          h('p', h('b', 'Lower rate interval (LRI): '), 'longest time allowed between ventricular events. '), h('p', h('b', 'AV delay: '), 'the device\'s PR interval. Sensed AVD is shorter than paced because the P wave is detected after atrial activation has begun.'),
          h('p', h('b', 'PVARP: '), 'after each ventricular event the atrial channel ignores signals for tracking, so retrograde P waves and far-field R waves cannot trigger a paced beat.'),
          h('p', h('b', 'TARP = AVD + PVARP: '), 'atrial rates faster than 60 000 / TARP are tracked 2:1. Between the upper tracking rate and the 2:1 rate the device Wenckebachs.'),
          h('p', h('b', 'VRP and blanking: '), 'windows in which the ventricular channel ignores its own stimulus, the evoked response and the T wave.'))),
        h('section.card', h('div.card-h', h('h3', 'NBG code')), h('div.card-b.scroll-x', h('table.tbl', h('tbody', NBG.map(([a, b]) => h('tr', h('td', h('b', a)), h('td', b))))))),
        h('section.card', h('div.card-h', h('h3', 'Modes')), h('div.card-b.scroll-x', h('table.tbl', h('tbody', MODES.map(([a, b]) => h('tr', h('td.mono', h('b', a)), h('td', b))))))));

      root.append(h('div.sim',
        h('div.sim-main',
          h('section.card', h('div.card-h', h('h2', 'Live strip — lead II, arterial line, marker channel'), h('span.grow'), rateEl, freeze), liveBox,
            h('div.card-b', h('p.muted', { style: { fontSize: '12px' } }, 'Markers: AS/VS sensed, AP/VP paced, AR atrial sense inside the refractory period, MS mode switch. Bars show when each timer is running.'))),
          h('section.card', h('div.card-h', h('h3', 'What the strip shows'), h('span.grow'), interBtn), h('div.card-b', findEl, h('div', { style: { marginTop: '10px' } }, interEl))),
          h('section.card', h('div.card-h', h('h3', 'Troubleshooting practice')), h('div.card-b', quizEl)),
          ref),
        h('div.sim-main',
          h('section.card', h('div.card-h', h('h3', 'Patient')), h('div.card-b', patSel)),
          h('section.card', h('div.card-h', h('h3', 'Programming')), h('div.card-b', ctl, magnet)),
          h('section.card', h('div.card-h', h('h3', 'Introduce a fault')), h('div.card-b', faultSel, faultInfo)))));
      rebuild(); quizBox();
      return { unmount() { live.destroy(); if (strip.ro) strip.ro.disconnect(); } };
    },
  });
})(globalThis.EP = globalThis.EP || {});
