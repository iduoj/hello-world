/* EP Simulator — course track: pacing and device troubleshooting (units 1–8).
 * Uses the live 'pacer' bench defined here: a simulated patient, a programmable pacemaker and a strip
 * with the marker channel. Bench spec: { patient, pm, fault, force, show:[control keys], tog:[toggles],
 * inter (interrogation button), fixedProg }. ctx() = what the strip has shown since the last change.
 */
(function (EP) {
  'use strict';
  const h = EP.h, UI = EP.UI, D = EP.PacerData, DEF = EP.Pacemaker.DEF, C = EP.Course, S = C.S;
  const { para, list, table, fmt } = C.T, { pick, shuffle } = C.util;
  const look = S.look, mcq = S.mcq, num = S.num, act = S.act;

  // ---- patients and controls ------------------------------------------------------------------------
  const P = Object.assign({}, D.PATIENTS, {
    brady45: { name: 'Sinus bradycardia 45/min, normal AV conduction', cfg: () => ({ sinus: { cl: 1330, resp: 0.02 } }) },
    retro4: { name: 'Sinus node disease, intact retrograde (VA) conduction, frequent PVCs', cfg: () => ({ sinus: { cl: 1500, resp: 0 }, avn: { fast: { retro: { delay: 210, erp: 240, block: false } } }, foci: [{ id: 'pvc', node: 'V', kind: 'coupled', coupling: 640, every: 4, site: 'rvotSeptal', label: 'PVC' }] }) },
  });
  const CTL = {
    lrl: ['Lower rate', 30, 120, 5, '/min'], url: ['Upper tracking rate', 90, 180, 5, '/min'],
    avdP: ['Paced AV delay', 80, 400, 10, 'ms'], avdS: ['Sensed AV delay', 60, 400, 10, 'ms'],
    pvarp: ['PVARP', 150, 500, 10, 'ms'], vrp: ['Ventricular refractory period', 150, 500, 10, 'ms'],
    vOut: ['Ventricular output', 0.25, 7.5, 0.25, 'V'], vSens: ['Ventricular sensitivity', 0.5, 12, 0.5, 'mV'],
    hyst: ['Hysteresis rate (0 = off)', 0, 55, 5, '/min'], sinus: ['Sinus rate (the patient, not the device)', 90, 180, 2, '/min'],
  };
  const TOG = { magnet: 'Magnet on the generator', pvcExt: 'PVARP extension after a PVC', safetyPace: 'Ventricular safety pacing' };

  // ---- bench: a patient, a device, a live strip -----------------------------------------------------
  class Bench {
    constructor() {
      this.canvas = h('canvas', { 'aria-label': 'Live rhythm strip, lead II, with the device marker channel' });
      this.prog = h('span.muted'); this.pat = h('div', { style: { fontSize: '13px', marginBottom: '8px' } });
      this.ctl = h('div.ctl'); this.tog = h('div.row', { style: { marginTop: '4px' } });
      this.inter = h('div', { style: { marginTop: '8px' } }); this.find = h('div.findings', { style: { marginTop: '10px' } });
      this.interBtn = h('button.btn.sm', { type: 'button', onclick: () => this.interrogate() }, 'Interrogate');
      this.freeze = h('button.btn.sm', { type: 'button', onclick: () => { if (this.live.running) { this.live.stop(); this.freeze.textContent = 'Resume'; } else { this.live.start(); this.freeze.textContent = 'Freeze'; } } }, 'Freeze');
      this.el = h('section.card', h('div.card-h', h('h3', 'Bench — lead II and the marker channel'), h('span.grow'), this.interBtn, this.freeze),
        h('div.live', this.canvas), h('div.card-b', this.pat, this.ctl, this.tog, this.inter, this.find));
      this.strip = new EP.LiveStrip(this.canvas, { channels: [{ lead: 1 }], windowMs: 8000, markers: true, timers: true, rowMm: 24 });
      this.showFind = false; this.setters = {};
    }
    load(spec) {
      this.spec = spec;
      const f = D.FAULTS[spec.fault || 'none'];
      this.nominal = Object.assign({}, DEF, spec.pm || {});
      const c = Object.assign({}, this.nominal, f.set, spec.force || {}); if (f.set.forceMode) c.mode = f.set.forceMode;
      const sim = (this.sim = new EP.HeartSim(P[spec.patient].cfg())), dev = (this.dev = new EP.Pacemaker(sim, c));
      if (f.set.intermittent) { const flip = (t) => { dev.c.noOutput = sim.rng() < f.set.intermittent; sim.schedule(t + 900 + 1500 * sim.rng(), flip); }; sim.schedule(600, flip); }
      if (this.live) this.live.setSim(sim); else this.live = new EP.Live({ sim, strips: [this.strip], onTick: (t) => this._tick(t) });
      this.live.start(); this.freeze.textContent = 'Freeze';
      this.changed = sim.t; this.base = Object.assign({}, dev.c); this._lastFind = -1e9;
      this.controls(spec);
    }
    /* Rebuild the visible controls without restarting the patient. */
    controls(spec) {
      this.spec = Object.assign({}, this.spec, { show: spec.show, tog: spec.tog, inter: spec.inter });
      this.ctl.innerHTML = ''; this.tog.innerHTML = ''; this.inter.innerHTML = ''; this.setters = {};
      this.pat.innerHTML = ''; this.pat.append(h('b', 'Patient: '), P[this.spec.patient].name + '. ', this.prog);
      for (const k of spec.show || []) {
        const [label, min, max, step, unit] = CTL[k], cur = k === 'sinus' ? Math.round(60000 / this.sim.sinus.cl) : this.dev.c[k];
        const val = h('span.val', cur + ' ' + unit), inp = h('input', { type: 'range', min, max, step, value: cur, 'aria-label': label, oninput: () => this.set(k, +inp.value) });
        this.setters[k] = (v) => { inp.value = v; val.textContent = v + ' ' + unit; };
        this.ctl.append(h('label', label), val, inp);
      }
      for (const k of spec.tog || []) { const chk = UI.check(TOG[k], !!this.dev.c[k], (v) => this.set(k, v)); this.setters[k] = (v) => { chk.input.checked = v; }; this.tog.append(chk); }
      this.interBtn.style.display = spec.inter ? '' : 'none';
      this.describe();
    }
    set(k, v) {
      if (k === 'sinus') this.sim.sinus.cl = 60000 / v; else this.dev.set({ [k]: v });
      if (this.setters[k]) this.setters[k](v);
      this.changed = this.live.t; this.describe();
    }
    describe() {
      const c = this.spec.fixedProg ? this.nominal : this.dev.c, dual = /^(DDD|DDI|VDD)$/.test(c.mode);
      this.prog.textContent = 'Programmed ' + c.mode + ' ' + c.lrl + (dual ? '–' + c.url : '') + '/min' + (dual ? ' · AV delay ' + c.avdS + ' sensed / ' + c.avdP + ' paced ms · PVARP ' + c.pvarp + ' ms' : '') + (c.hyst ? ' · hysteresis ' + c.hyst + '/min' : '') + '.';
    }
    interrogate() {
      const c = this.dev.c, f = D.FAULTS[this.spec.fault || 'none'], dual = this.nominal.mode !== 'VVI';
      const row = (name, a, v) => h('tr', h('td', name), dual ? h('td.mono', a) : null, h('td.mono', v));
      this.inter.innerHTML = '';
      this.inter.append(h('div.scroll-x', h('table.tbl', h('thead', h('tr', h('th', ''), dual ? h('th', 'Atrial lead') : null, h('th', 'Ventricular lead'))),
        h('tbody', row('Capture threshold', c.aThr + ' V', c.vThr + ' V'), row('Programmed output', c.aOut + ' V', c.vOut + ' V'),
          row('Sensed amplitude', 'P ' + c.pAmp + ' mV', 'R ' + c.rAmp + ' mV'), row('Programmed sensitivity', c.aSens + ' mV', c.vSens + ' mV'),
          row('Other signals on the electrogram', 'far-field R ' + c.ffr + ' mV', 'T wave ' + c.tAmp + ' mV' + (c.noiseV ? '; intermittent non-physiological noise up to ' + (c.noiseV * 1.4).toFixed(1) + ' mV' : '')),
          row('Lead impedance', f.imp[0] + ' Ω', f.imp[1] + ' Ω'), row('Blanking / refractory', 'PVAB ' + c.pvab + ' ms', 'blanking ' + c.vBlank + ' ms · VRP ' + c.vrp + ' ms'),
          h('tr', h('td', 'Sensing polarity · safety pacing'), h('td.mono', { colSpan: dual ? 2 : 1 }, c.kind + ' · ' + (dual ? (c.safetyPace ? 'on' : 'OFF') : 'n/a'))),
          h('tr', h('td', 'Operating mode now'), h('td.mono', { colSpan: dual ? 2 : 1 }, this.dev.mode + ' ' + c.lrl + '/min' + (this.dev.switched ? ' (mode-switched)' : ''))),
          h('tr', h('td', 'Battery'), h('td.mono', { colSpan: dual ? 2 : 1 }, f.batt))))),
        h('p.muted', { style: { fontSize: '12px', marginTop: '6px' } }, 'Margins: output ≥ 2 × threshold; sensitivity setting ≤ half the sensed amplitude. Usual impedance ≈ 300–1200 Ω.'));
    }
    findings(on) { this.showFind = on; this._lastFind = -1e9; if (!on) { this.find.innerHTML = ''; this.find.append(h('div.muted', { style: { fontSize: '12px' } }, 'The automatic strip read-out is hidden until you have answered.')); } }
    _tick(t) {
      if (this.onTick) this.onTick(t);
      if (!this.showFind || Math.abs(t - this._lastFind) < 700) return;
      this._lastFind = t; this.find.innerHTML = '';
      for (const [lv, title, text] of EP.pacerAnalyze(this.sim, this.dev, t)) this.find.append(h('div.finding', h('span.pill' + (lv ? '.' + lv : ''), lv === 'good' ? 'ok' : lv === 'bad' ? 'fault' : lv === 'warn' ? 'note' : 'info'), h('div', h('b', title), h('div.muted', text))));
    }
    /* What has happened on the strip since the last change of settings (first cycle ignored, 9 s at most). */
    ctx() {
      const sim = this.sim, dev = this.dev, t = this.live.t, from = Math.max(this.changed + 1500, t - 9000);
      const ev = sim.out.filter((e) => e.t > from && e.t <= t - 160);
      const q = ev.filter((e) => e.type === 'QRS'), mk = ev.filter((e) => e.type === 'mark'), Pw = ev.filter((e) => e.type === 'P');
      const vS = ev.filter((e) => e.type === 'spike' && e.ch === 'V');
      const paced = (x) => x.label === 'paced' || (x.parts && x.parts.some((p) => p.cap && p.c.type === 'pace'));
      const intr = q.filter((x) => !paced(x)), vsM = mk.filter((m) => m.text === 'VS');
      const cnt = (k) => mk.filter((m) => m.text === k).length;
      const pv = q.filter((x) => x.label === 'PVC'), lastPvc = pv.length ? pv[pv.length - 1].t : 0;
      return { t, since: t - this.changed, c: dev.c, base: this.base, dev, seq: mk.filter((m) => m.text !== 'MS').map((m) => m.text).join(' ') + ' ',
        vSp: vS.length, nc: vS.filter((s) => !s.captured && !q.some((x) => s.t - x.t > -20 && s.t - x.t < 340)).length,
        ghost: vsM.filter((m) => !q.some((x) => m.t - x.t > -40 && m.t - x.t < 200)).length, intr: intr.length, paced: q.length - intr.length,
        n: { AS: cnt('AS'), AP: cnt('AP'), AR: cnt('AR'), VS: cnt('VS'), VP: cnt('VP') },
        retro: Pw.filter((x) => x.kind === 'retro').length, lastPvc, retroAfter: Pw.filter((x) => x.kind === 'retro' && x.t > lastPvc).length };
    }
    destroy() { if (this.live) this.live.destroy(); if (this.strip.ro) this.strip.ro.disconnect(); }
  }
  const pmt = (x) => /(AS VP ){4}/.test(x.seq) && x.retro >= 4;

  /* Unknown-fault answers: what the device is doing, and the one best action. */
  const FN = {
    cap: 'Failure to capture: stimuli are delivered into excitable tissue and nothing follows',
    under: 'Under-sensing: stimuli appear where an intrinsic beat should have inhibited them',
    pause: 'Output withheld or delayed: pauses, or a rate below the programmed lower rate',
    atrial: 'Atrial sensing error: P waves are missed, or extra atrial events are counted (the atrial markers do not match the P waves)',
    mode: 'No lead problem: every marker matches the ECG, but the device is not behaving as programmed',
  };
  const FIX = {
    repos: 'Chest film and lead repositioning; temporary pacing back-up if pacing-dependent',
    out: 'Raise the output and treat the reversible cause (K⁺, pH, drug); no lead revision needed',
    moreV: 'Make the ventricular channel more sensitive (lower the mV setting)',
    moreA: 'Make the atrial channel more sensitive (lower the mV setting) and check the lead position',
    less: 'Make the ventricular channel less sensitive (raise the mV setting) or lengthen the ventricular refractory period',
    lead: 'Replace the lead; asynchronous pacing as a bridge if pacing-dependent',
    pvab: 'Lengthen post-ventricular atrial blanking or reduce atrial sensitivity',
    safety: 'Turn ventricular safety pacing on; lengthen ventricular blanking or lower the atrial output',
    gen: 'Replace the generator',
    pvarp: 'Lengthen PVARP',
    bip: 'Reprogram sensing from unipolar to bipolar',
  };
  // fault → [what it does, fix, functional options not offered (also true), fixes not offered (arguable)]
  const CASE = {
    vDislodge: ['cap', 'repos', ['under'], ['lead']], exit: ['cap', 'out', ['under']], vUnder: ['under', 'moreV'], tOver: ['pause', 'less'], xtalk: ['pause', 'safety', [], ['less']],
    fracture: ['pause', 'lead', ['under'], ['less', 'repos']], insulation: ['pause', 'lead', ['under'], ['less', 'repos', 'bip']], aUnder: ['atrial', 'moreA'], ffr: ['atrial', 'pvab'],
    battery: ['mode', 'gen'], myo: ['pause', 'bip', [], ['less']],
  };
  const caseBench = (qz) => ({ patient: qz.patientOverride || qz.patient, pm: qz.pm, force: qz.force, fault: qz.fault, show: [], tog: ['magnet'], inter: true, fixedProg: true });
  /* Unknown fault: what is the device doing → cause → fix. */
  const cas = (qz) => {
    const f = D.FAULTS[qz.fault], cs = CASE[qz.fault];
    const same = Object.keys(CASE).filter((k) => k !== qz.fault).sort((p, q) => (CASE[q][0] === cs[0]) - (CASE[p][0] === cs[0]) || Math.random() - 0.5).slice(0, 5);
    return S.multi('case-' + qz.fault, 'Unknown fault', 'A fault has been applied. Read the strip and markers, interrogate, use the magnet if it helps.', [
      ['What is the device doing wrong?', FN[cs[0]], Object.keys(FN).filter((k) => k !== cs[0] && (cs[2] || []).indexOf(k) < 0).map((k) => FN[k]), f.dx + '.'],
      ['What is the cause?', f.name, same.map((k) => D.FAULTS[k].name), f.why],
      ['What do you do?', FIX[cs[1]], shuffle(Object.keys(FIX).filter((k) => k !== cs[1] && (cs[3] || []).indexOf(k) < 0)).slice(0, 4).map((k) => FIX[k]), f.fix],
    ], { bench: caseBench(qz), tDone: 'Unknown fault: ' + f.name, why: f.why, qz });
  };
  const HW = ['fracture', 'insulation', 'vDislodge', 'exit'].map((fault) => ({ patient: 'chb', pm: { mode: 'VVI', lrl: 70 }, fault }));
  const wanted = (want, pool, n) => { const w = (want || []).filter((k) => k.indexOf('case-') === 0).map((k) => pool.find((q) => q.fault === k.slice(5))).filter(Boolean); return w.length ? w : shuffle(pool).slice(0, n); };

  // ---- the eight units ------------------------------------------------------------------------------
  const UNITS = [
    { id: 1, title: 'One lead, one clock', short: 'VVI timing', goal: 'Explain every spike, and every missing spike, on a single-chamber strip.',
      teach: () => [
        para('A single-chamber pacemaker runs one clock: the **lower rate interval** (LRI = 60 000 ÷ the programmed rate; 60/min is 1000 ms).'),
        list(['Every ventricular event the device recognises, paced (**VP**) or sensed (**VS**), resets the clock to zero. If the clock runs out, the device paces.',
          'So the device does not pace "at a rate". It guarantees that no gap is longer than the LRI. A patient whose own beats arrive sooner keeps resetting the clock, and there are no spikes at all. **Inhibition is normal function.**',
          'Keep three words apart. **Output**: a stimulus was delivered (a spike). **Capture**: the stimulus depolarised the chamber (a wide QRS and T wave follow at once). **Sensing**: the device saw an intrinsic beat (a VS marker, and the clock restarts).',
          'The marker channel is the device\'s opinion; the ECG is what happened. Troubleshooting is the search for places where the two disagree.'])],
      steps: () => {
        const r1 = pick([50, 70, 75, 80, 90]), r2 = pick([60, 70, 75]), gap = pick([350, 400, 450]), lri2 = Math.round(60000 / r2);
        const B = { patient: 'chb', pm: { mode: 'VVI', lrl: 60 }, show: ['lrl'] };
        return [
          look('Read the strip', 'Complete heart block with a ventricular escape of 32/min; the device is VVI 60. Every beat is paced: a spike, a wide QRS, and a VP marker under it. The P waves march through at 75/min, unrelated to anything, because a VVI device does not know the atria exist. The bar after each marker is the ventricular refractory period.', B),
          num('lri', 'Lower rate interval', `A device is programmed VVI ${r1}/min. What is its lower rate interval?`, 60000 / r1, 12, 'ms', `60 000 ms in a minute ÷ ${r1} = ${Math.round(60000 / r1)} ms. Work in intervals, not rates: every timer in the device is an interval.`),
          mcq('inhibit-predict', 'Predict: a rate below the escape rhythm', 'The escape rhythm is 32/min, about 1850 ms between beats. You are about to turn the lower rate down to 30/min (2000 ms). What will the strip show?',
            ['No spikes: each escape beat arrives before the 2000 ms clock runs out and resets it', 'Pacing at 30/min alternating with escape beats', 'Spikes that fail to capture because the rate is too low', 'Pacing at 32/min, matched to the escape rhythm'],
            'The clock only reaches zero if 2000 ms pass with no ventricular event. The escape beat comes at about 1850 ms, is sensed (VS) and restarts the clock, every time.', { bench: B }),
          act('inhibit', 'Inhibit the device', 'Do it on the bench: lower the rate until the device is completely inhibited.', { bench: B, keep: true,
            check: (x) => x.c.lrl <= 30 && x.vSp === 0 && x.intr >= 2 && x.since >= 5500, solve: (b) => b.set('lrl', 30), hint: 'The clock must be longer than the patient\'s own cycle of about 1850 ms.',
            live: (x) => (x.c.lrl <= 30 ? 'Rate set. Watching several beats to confirm there are no spikes…' : null),
            why: 'A strip with no spikes and a VS marker on every QRS is a working pacemaker. "No pacing seen" is only a fault if a gap longer than the lower rate interval went unanswered.' }),
          num('reset', 'A sensed beat resets the clock', `VVI ${r2}/min. A paced beat is followed ${gap} ms later by a PVC, which the device senses. How long after the PVC is the next stimulus delivered?`, lri2, 12, 'ms',
            `${lri2} ms: the full lower rate interval, counted from the PVC. A sensed event restarts the clock from zero; it does not subtract what had already elapsed. The gap between the two paced beats is therefore ${gap} + ${lri2} = ${gap + lri2} ms, longer than the LRI, with nothing wrong.`),
          mcq('hyst', 'Slower than programmed, no spikes', 'Pacemaker clinic. Programmed VVI 60/min. The strip shows sinus rhythm at 45/min, no spikes, and a VS marker on every QRS and nowhere else. Capture and sensing tests were normal last month. What explains it?',
            ['Rate hysteresis: after a sensed beat the device waits a longer interval (here 1500 ms, i.e. 40/min) before it paces', 'Over-sensing: a false signal is inhibiting the output', 'Battery depletion with a fall in the pacing rate', 'Failure to output from a lead fracture'],
            'Every marker sits on a QRS, so nothing false is being sensed. Hysteresis deliberately lets the patient\'s own rhythm run below the pacing rate, to avoid unnecessary pacing. Set the hysteresis rate to 0 on the bench and pacing at 60/min starts at once.',
            { bench: { patient: 'brady45', pm: { mode: 'VVI', lrl: 60, hyst: 40 }, show: ['hyst'] } }),
        ];
      } },

    { id: 2, title: 'Capture: threshold and safety margin', short: 'Capture', goal: 'Measure a threshold, program a margin, and say why capture was lost.',
      teach: () => [
        para('The **capture threshold** is the lowest output that depolarises the chamber every time. Output has two dials: amplitude (V) and pulse width (ms).'),
        list(['**Strength–duration curve.** Short pulses need more voltage; beyond about 1 ms a wider pulse buys almost nothing (rheobase). The most efficient pulse width is near chronaxie, typically 0.3–0.5 ms.',
          '**Energy per pulse ∝ V² × pulse width ÷ impedance.** Doubling the voltage quadruples the drain; doubling the pulse width only doubles it.',
          '**Safety margin.** Program the amplitude to at least twice the voltage threshold (or the pulse width to three times the pulse-width threshold). Thresholds move with sleep, meals, illness and drugs.',
          '**Time course.** The threshold rises over the first weeks after implant (inflammation at the tip), then settles; steroid-eluting leads blunt the peak. Early high outputs are deliberate.',
          '**What raises it:** hyperkalaemia, acidosis, hypoxia, ischaemia or infarction at the tip, class I antiarrhythmics (flecainide above all), fibrosis at the tip (exit block), and a tip that has moved.',
          '**Loss of capture** is a spike followed by nothing while the tissue was excitable. A spike that lands in the refractory period of an intrinsic beat also does nothing, but that is a sensing or timing problem. Always ask first: could the tissue have responded?'])],
      steps: () => {
        const thr = pick([0.75, 1, 1.25, 1.5, 1.75]);
        const B = { patient: 'chb', pm: { mode: 'VVI', lrl: 70, vThr: thr, vOut: 5 }, show: ['vOut'] };
        return [
          num('thr', 'Run a threshold test', 'Complete heart block, VVI 70, output 5.0 V as left at implant. Step the ventricular output down until a spike is no longer followed by a QRS, then back up. What is the capture threshold?', (b) => b.dev.c.vThr, 0.01, 'V',
            (b) => `${b.dev.c.vThr} V: the lowest output that still captured every stimulus, not the first setting that failed. Note what the strip did below it: spikes at 70/min with nothing after them, and the escape rhythm showing through.`, { bench: B, nb: 1 }),
          act('margin', 'Program the safety margin', 'Now program the output for long-term use with the standard safety margin. (If you have not measured the threshold yet, do that first.)', { bench: B, keep: true,
            check: (x) => x.c.vOut >= 2 * x.c.vThr - 1e-9 && x.c.vOut <= 2 * x.c.vThr + 0.25 && x.nc === 0 && x.paced >= 2 && x.since >= 4000, solve: (b) => b.set('vOut', 2 * b.dev.c.vThr),
            live: (x) => (x.c.vOut > 2 * x.c.vThr + 0.25 ? 'It captures, but with more margin than needed: the drain rises with the square of the voltage.' : x.c.vOut >= x.c.vThr && x.c.vOut < 2 * x.c.vThr ? 'It captures now, but a small rise in threshold would lose it.' : null),
            hint: 'Twice the voltage threshold: enough to cover day-to-day variation, no more than needed.', why: 'Twice the voltage threshold. Less leaves no room for the threshold to drift; much more wastes battery, since energy rises with V².' }),
          mcq('energy', 'What costs the battery', 'There are two ways to add margin: double the amplitude (2.5 → 5.0 V at 0.4 ms) or double the pulse width (0.4 → 0.8 ms at 2.5 V). What happens to the energy of each pulse?',
            ['Doubling the voltage quadruples it; doubling the pulse width doubles it', 'Both double it', 'Doubling the pulse width quadruples it; doubling the voltage doubles it', 'Neither changes it: energy depends only on lead impedance'],
            'Energy = V² × t ÷ R. That is why a high threshold is managed by finding the cause, not by leaving the device at 5 V for years.'),
          act('exit', 'Restore capture', 'Six weeks after implant, on flecainide, potassium 6.4 mmol/L. Lead position and impedance are unchanged. Interrogate, then restore reliable capture on the bench with a proper margin.', {
            bench: { patient: 'chb', pm: { mode: 'VVI', lrl: 70 }, fault: 'exit', show: ['vOut'], inter: true },
            check: (x) => x.c.vOut >= 2 * x.c.vThr - 1e-9 && x.nc === 0 && x.paced >= 3 && x.since >= 5000, solve: (b) => b.set('vOut', 7),
            live: (x) => (x.c.vOut >= x.c.vThr && x.c.vOut < 2 * x.c.vThr ? 'Capture is back, but the margin is less than 2:1.' : null), hint: 'The interrogation gives the new threshold. Twice that.',
            why: 'The threshold has risen to 3.4 V with a normal impedance and a normal R wave: the lead is where it was, the tissue has changed. The high output is a bridge; the treatment is the potassium and the drug.' }),
          mcq('funcnc', 'A spike with nothing after it', 'DDD pacemaker, ventricular threshold 0.75 V, output 2.5 V. A ventricular spike falls in the ST segment of a PVC and no QRS follows it. What is the fault?',
            ['Under-sensing of the PVC: the stimulus fell in refractory tissue, so it says nothing about capture', 'Loss of capture: raise the output', 'Exit block at the lead tip', 'Conductor fracture'],
            'The tissue could not have responded. The real question is why the device paced there at all: it did not see the PVC. This is functional non-capture, and raising the output would treat the wrong problem.'),
          mcq('hyperk', 'Intermittent non-capture, sick patient', 'A pacing-dependent patient with renal failure is dizzy. Ventricular spikes intermittently fail to capture. Potassium 7.1 mmol/L. Lead impedance 540 Ω, unchanged. Best immediate action?',
            ['Treat the hyperkalaemia, raise the output as a bridge, and have transcutaneous pacing ready', 'Arrange urgent lead replacement', 'Apply a magnet', 'Reduce the ventricular sensitivity'],
            'Normal impedance and a metabolic cause: the hardware is intact and the threshold has risen. A magnet changes sensing, not capture. Hyperkalaemia also widens the paced QRS and can cause latency between spike and QRS.'),
        ];
      } },

    { id: 3, title: 'Sensing: the height of the fence', short: 'Sensing', goal: 'Predict what under- and over-sensing do to a strip, and move the setting the right way.',
      teach: () => [
        para('The lead records the local electrogram: typically 5–20 mV for an R wave on a ventricular lead, 1.5–5 mV for a P wave on an atrial lead. The **sensitivity setting** is the smallest signal the device will count.'),
        list(['Think of a fence. Only signals taller than the fence are seen. **Raising the mV number raises the fence: the device sees less.** Lowering the number lets it see more.',
          '**Under-sensing:** real beats do not clear the fence. The device believes nothing happened and paces anyway, so there are too many spikes, in the wrong places (ST segments, T waves). Fix: lower the number, or find why the signal shrank.',
          '**Over-sensing:** something that is not a QRS clears the fence: a T wave, muscle potentials, noise from a damaged lead, the other chamber\'s stimulus (crosstalk), or the far-field R wave on the atrial lead. The device believes a beat occurred and withholds output: pauses, or a rate below the one programmed. Fix: raise the number, lengthen a refractory or blanking period, or repair the cause.',
          'One line to keep: **over-sensing causes under-pacing; under-sensing causes over-pacing.**',
          '**Margin:** set the fence no higher than half the measured signal.',
          '**Magnet test:** a magnet makes a pacemaker pace asynchronously, with sensing off. Pauses that disappear under the magnet were over-sensing. Pauses that persist are a failure to deliver or to capture.'])],
      steps: () => {
        const pa = pick([0.8, 1.2, 2]);
        const B = { patient: 'nsr', pm: { mode: 'VVI', lrl: 60 }, show: ['vSens'], inter: true };
        const T = { patient: 'chb', pm: { mode: 'VVI', lrl: 70 }, fault: 'tOver', show: ['vSens', 'vrp'], inter: true };
        return [
          look('Read the strip', 'Sinus rhythm at 72/min with a VVI 60 pacemaker. There are no spikes, and each QRS carries a VS marker. The R wave measures 10 mV on the lead and the sensitivity is 2.5 mV: the fence is a quarter of the height of the signal.', B),
          mcq('dir-predict', 'Predict: raise the number', 'You are about to change the ventricular sensitivity from 2.5 mV to 12 mV. What will the strip show?',
            ['Spikes at 60/min regardless of the patient\'s own beats, some in the ST segment or on the T wave', 'Nothing: a higher number makes the device more sensitive', 'Pauses, because the device is now inhibited by small signals', 'Loss of capture, because output falls as sensitivity rises'],
            'At 12 mV the fence is taller than the 10 mV R wave. The device no longer sees the patient\'s beats and behaves as a fixed-rate pacemaker.', { bench: B, keep: true }),
          act('under', 'Produce under-sensing', 'Do it: make the device under-sense the R wave.', { bench: B, keep: true, check: (x) => x.c.vSens > x.c.rAmp && x.vSp >= 2 && x.since >= 3500, solve: (b) => b.set('vSens', 12),
            hint: 'The R wave is 10 mV. Put the fence above it.', why: 'Look at where the spikes land. Those inside the refractory period do nothing. One that arrives late enough on the T wave captures: that is R-on-T, and it is why under-sensing is not a cosmetic problem.' }),
          act('restore', 'Restore sensing with a margin', 'Restore sensing, with a 2:1 safety margin on the 10 mV R wave.', { bench: { patient: 'nsr', pm: { mode: 'VVI', lrl: 60, vSens: 12 }, show: ['vSens'], inter: true }, keep: true,
            check: (x) => x.c.vSens <= x.c.rAmp / 2 && x.vSp === 0 && x.n.VS >= 3 && x.since >= 5000, solve: (b) => b.set('vSens', 5),
            live: (x) => (x.c.vSens <= x.c.rAmp && x.c.vSens > x.c.rAmp / 2 ? 'It senses now, but the fence is more than half the height of the R wave: no margin.' : null),
            hint: 'Lower the number until the fence is no higher than half the R wave.', why: '5 mV or lower. The margin matters because electrograms shrink: with respiration, with a new bundle branch block or infarct, and for PVCs, which approach the lead from another direction.' }),
          num('tover-int', 'T-wave over-sensing: the arithmetic', 'A different patient: complete heart block, VVI 70/min (LRI 857 ms), but the rate on the strip is slower. Count the markers: about 390 ms after every VP there is a VS with no QRS above it. What stimulus-to-stimulus interval does that produce?', 1247, 30, 'ms',
            '857 + 390 = about 1247 ms (48/min). The false VS restarts the clock, so the full lower rate interval is counted from the T wave. A paced rate below the programmed rate, with an extra marker at a fixed distance after each beat, is T-wave over-sensing.', { bench: T }),
          act('tover-fix', 'Fix it without losing the R wave', 'Fix it on the bench. On this lead the R wave is 10 mV and the T wave 3.4 mV. Keep a 2:1 margin on the R wave.', { bench: T, keep: true,
            check: (x) => x.ghost === 0 && x.c.vSens <= x.c.rAmp / 2 && x.n.VP >= 4 && x.since >= 6500, solve: (b) => b.set('vSens', 4),
            live: (x) => (x.c.vSens > x.c.rAmp / 2 ? 'The T wave is no longer sensed, but there is no longer a 2:1 margin on the R wave either.' : null),
            hint: 'Two routes: put the fence between the T wave and half the R wave, or make the ventricular refractory period long enough to cover the T wave.',
            why: 'Either a sensitivity between 3.5 and 5 mV, or a refractory period that outlasts the T wave. Each has a cost: a taller fence may miss small PVCs; a long refractory period ignores early ones. In an ICD the fence cannot be raised freely, because fine VF must still be seen.' }),
          mcq('dir-atrial', 'Which way to move it', `Atrial lead: the P wave measures ${pa} mV, the atrial sensitivity is programmed at ${(pa * 1.25).toFixed(1)} mV, and the device is not tracking. Which setting restores sensing with a 2:1 margin?`,
            [(pa / 2).toFixed(1) + ' mV', (pa * 2).toFixed(1) + ' mV', pa.toFixed(1) + ' mV', (pa * 2.5).toFixed(1) + ' mV'],
            `Half the measured amplitude: ${(pa / 2).toFixed(1)} mV. More sensitive means a lower number. Setting it equal to the P wave senses only on a good day.`),
          mcq('magnet-test', 'Pauses, then a magnet', 'A pacing-dependent patient has pauses with no spikes. You place a magnet over the generator and regular pacing with capture resumes at once. What have you learned?',
            ['The pauses were over-sensing: the circuit can deliver and capture, and removing sensing removed the inhibition', 'The battery is depleted', 'The lead is fractured with an open circuit', 'The capture threshold has risen above the output'],
            'Asynchronous pacing proves the generator, conductor and tissue can do the job. What the magnet removed was sensing, so sensing was the problem. An open circuit or a high threshold would still fail under the magnet.'),
          mcq('pseudo', 'A spike on the QRS', 'A patient with right bundle branch block has a VVI pacemaker with a right ventricular apical lead. Some spikes fall within the first 60 ms of a native QRS whose shape is unchanged. Sensing tests are normal. Explanation?',
            ['Pseudofusion: in RBBB activation reaches the RV lead late, so the clock expires before the local electrogram arrives. Normal function', 'Ventricular under-sensing: make the channel more sensitive', 'Loss of capture', 'Over-sensing of the P wave'],
            'The device senses where its lead is, not at the start of the surface QRS. A spike at the very onset of an unchanged QRS is pseudofusion. A spike well after the QRS, in the ST segment or on the T wave, is under-sensing.'),
        ];
      } },

    { id: 4, title: 'Two leads: the AV delay', short: 'DDD states', goal: 'Name the four states of a DDD device, say which one a patient will produce, and change it.',
      teach: () => [
        para('DDD means pace both chambers, sense both, and respond in both ways (inhibit and trigger). One clock is added: the **AV delay**, the device\'s own PR interval.'),
        list(['After every ventricular event the **atrial escape (VA) interval** runs: lower rate interval minus the paced AV delay. If no P wave is sensed before it ends, the device paces the atrium (**AP**).',
          'Any atrial event, sensed (**AS**) or paced (AP), starts the AV delay. If no R wave is sensed before it ends, the device paces the ventricle (**VP**).',
          'That gives four states, and **the patient chooses, not the device**. Is the sinus rate above the lower rate? AS, otherwise AP. Does the beat conduct within the AV delay? VS, otherwise VP.',
          '**AS–VS** fully inhibited · **AS–VP** tracking (P-synchronous pacing) · **AP–VS** atrial pacing with intrinsic conduction · **AP–VP** AV sequential pacing.',
          'The **sensed AV delay** is programmed 30–50 ms shorter than the paced one, because a sensed P wave is detected only when activation reaches the atrial lead, part-way through atrial depolarisation.',
          '**Right ventricular pacing is not free.** It desynchronises the ventricle, and a high burden (above roughly 20–40 %) can cause pacing-induced cardiomyopathy. If the patient conducts, program so that they do: a longer AV delay or an algorithm that searches for intrinsic conduction. The cost of a long AV delay comes in the next unit.',
          '**Fusion** (AV delay about equal to the PR interval, so paced and conducted wavefronts collide) gives an intermediate QRS. It is not a malfunction.'])],
      steps: () => {
        const v = pick([
          ['sinus rhythm at 78/min with complete AV block', 'AS–VP'], ['sinus bradycardia at 44/min with complete AV block', 'AP–VP'],
          ['sinus bradycardia at 44/min with a PR interval of 150 ms after atrial pacing', 'AP–VS'], ['sinus rhythm at 80/min with a PR interval of 140 ms', 'AS–VS']]);
        const rate = pick([50, 60, 70]), avd = pick([150, 180, 200]);
        return [
          mcq('state', 'Which state?', `DDD 60/min, sensed AV delay 200 ms, paced AV delay 220 ms. The patient has ${v[0]}. Which marker pattern do you expect?`, [v[1]].concat(['AS–VP', 'AP–VP', 'AP–VS', 'AS–VS'].filter((s) => s !== v[1])),
            'Two questions. Is the sinus rate above the lower rate of 60? Then AS, otherwise AP. Does the impulse reach the ventricle before the AV delay ends? Then VS, otherwise VP.'),
          look('Unnecessary pacing', 'This patient conducts normally (PR about 160 ms), yet every QRS has a spike in front of it: AS–VP, with fusion. The sensed AV delay (150 ms) is a little shorter than the PR interval, so the device paces a ventricle that was about to activate itself.', { patient: 'nsr', pm: { mode: 'DDD' }, show: ['avdS', 'avdP'] }),
          act('avs', 'Stop the unnecessary pacing', 'Stop the ventricular pacing without changing the mode or the rate.', { bench: { patient: 'nsr', pm: { mode: 'DDD' }, show: ['avdS', 'avdP'] }, keep: true,
            check: (x) => x.n.VP === 0 && x.n.AS >= 3 && x.n.VS >= 3 && x.since >= 5000, solve: (b) => { b.set('avdS', 220); b.set('avdP', 250); }, hint: 'The device\'s PR interval must be longer than the patient\'s.',
            why: 'With the sensed AV delay longer than the PR interval the QRS arrives first, is sensed, and inhibits the ventricular output: AS–VS. Same patient, same mode, 0 % instead of 100 % ventricular pacing.' }),
          act('apvs', 'Pace the atrium only', 'Sinus node disease: sinus rate 38/min, AV conduction intact. The device is pacing both chambers (AP–VP). Reprogram it so the atrium is paced and the patient\'s own AV node conducts.', { bench: { patient: 'brady', pm: { mode: 'DDD', avdP: 120, avdS: 100 }, show: ['avdP', 'avdS', 'lrl'] },
            check: (x) => x.n.AP >= 3 && x.n.VS >= 3 && x.n.VP === 0 && x.since >= 5000, solve: (b) => b.set('avdP', 250), hint: 'After an atrial paced beat this patient conducts in about 180 ms.',
            why: 'AP–VS: the device replaces the sinus node and leaves the ventricle alone. This is the aim in sinus node disease with intact conduction, and what minimised-ventricular-pacing algorithms automate.' }),
          act('apvp', 'From tracking to AV sequential', 'Complete heart block with a sinus rate of 75/min: the device is tracking (AS–VP). Without touching either AV delay, make it AP–VP.', { bench: { patient: 'chb', pm: { mode: 'DDD' }, show: ['lrl', 'avdP', 'avdS', 'pvarp'] },
            check: (x) => x.n.AS === 0 && x.n.AP >= 3 && x.n.VP >= 3 && x.c.avdP === x.base.avdP && x.c.avdS === x.base.avdS && x.since >= 5500, solve: (b) => b.set('lrl', 90), hint: 'The atrium is paced only when the VA interval runs out before a P wave arrives.',
            why: 'Raise the lower rate above the sinus rate: the VA interval now ends before the next sinus P wave, so the device paces the atrium. Whether you see AS or AP is decided by the race between the sinus node and the VA interval.' }),
          num('va', 'The atrial escape interval', `DDD ${rate}/min, paced AV delay ${avd} ms, ventricular-based timing. After a ventricular paced beat, how long until the next atrial stimulus if no P wave is sensed?`, Math.round(60000 / rate) - avd, 12, 'ms',
            `Lower rate interval ${Math.round(60000 / rate)} ms minus the paced AV delay ${avd} ms = ${Math.round(60000 / rate) - avd} ms. The VA interval plus the AV delay make up one full cycle at the lower rate.`),
          mcq('savd', 'Sensed versus paced AV delay', 'Why is the sensed AV delay programmed shorter than the paced AV delay?',
            ['A sensed P wave is detected only when activation reaches the atrial lead, part-way through atrial depolarisation; a paced P wave is timed from its very start', 'Sensed beats conduct more slowly through the AV node', 'To prevent pacemaker-mediated tachycardia', 'Because PVARP is shorter after sensed beats'],
            'The offset (30–50 ms) keeps the real interval between atrial and ventricular contraction the same whether the P wave was sensed or paced.'),
          mcq('rvp', 'Too much ventricular pacing', 'Sinus node disease, PR interval 190 ms, DDD device. At follow-up there is 92 % ventricular pacing and the LVEF has fallen from 55 % to 42 %. Most appropriate programming?',
            ['Promote intrinsic conduction: lengthen the AV delay or enable an AV-search / minimised-ventricular-pacing algorithm', 'Shorten the AV delay to guarantee full capture', 'Raise the lower rate to 80/min', 'Shorten PVARP'],
            'The patient conducts; the device is not letting them. Removing unnecessary right ventricular pacing comes first. If pacing cannot be avoided and the LVEF stays low, the next step is an upgrade to biventricular or conduction-system pacing.'),
        ];
      } },

    { id: 5, title: 'Refractory periods and the upper rate', short: 'Upper rate', goal: 'Calculate TARP and the 2:1 rate, and predict Wenckebach versus 2:1 block.',
      teach: () => [
        para('After every ventricular event the atrial channel is refractory for the **PVARP** (post-ventricular atrial refractory period). A P wave that falls inside it is seen (marker **AR**) but does not start an AV delay. Its job is to keep retrograde P waves and far-field R waves from being tracked.'),
        list(['The atrial channel is also refractory during the AV delay. Together: **TARP = sensed AV delay + PVARP**.',
          'The device cannot track an atrial cycle shorter than TARP: every second P wave falls in PVARP. **2:1 block rate = 60 000 ÷ TARP.**',
          'Programmed separately, the **upper tracking rate** (maximum tracking rate) is the shortest ventricular paced interval the device will allow.',
          'As the sinus rate climbs there are three zones. Below the upper tracking rate: 1:1 tracking. Between the upper tracking rate and the 2:1 rate: **pacemaker Wenckebach**, where each ventricular pace is held back to respect the upper rate, so the AS–VP interval stretches until a P wave lands in PVARP and is dropped. Above the 2:1 rate: the ventricular rate **suddenly halves**.',
          'If the upper rate interval is shorter than TARP there is no Wenckebach zone: tracking goes straight from 1:1 to 2:1. The patient\'s story is abrupt breathlessness at a reproducible level of exertion.',
          'Programming aim: a 2:1 rate above the patient\'s peak sinus rate. Shorten PVARP (the limit comes in the next unit) or use a rate-adaptive AV delay.'])],
      steps: () => {
        const a1 = pick([120, 150, 180]), p1 = pick([250, 275, 300, 325]), c2 = pick([[150, 250], [120, 280], [200, 300], [180, 320], [150, 350]]);
        const B = { patient: 'chbFast', pm: { mode: 'DDD' }, show: ['url', 'avdS', 'pvarp'] };
        return [
          num('tarp', 'TARP', `Sensed AV delay ${a1} ms, PVARP ${p1} ms. What is the total atrial refractory period?`, a1 + p1, 2, 'ms', `${a1} + ${p1} = ${a1 + p1} ms. During all of it a P wave cannot start a new AV delay.`),
          num('2to1', 'The 2:1 block rate', `Sensed AV delay ${c2[0]} ms, PVARP ${c2[1]} ms. Above what atrial rate will the device track only every second P wave?`, 60000 / (c2[0] + c2[1]), 3, '/min',
            `TARP = ${c2[0] + c2[1]} ms; 60 000 ÷ ${c2[0] + c2[1]} = ${Math.round(60000 / (c2[0] + c2[1]))}/min. Do this sum for every dual-chamber device you see: it is the rate at which the patient will fall off a cliff.`),
          mcq('zone-predict', 'Predict the upper rate behaviour', 'On the bench: upper tracking rate 130/min, sensed AV delay 150 ms, PVARP 250 ms, so the 2:1 rate is 150/min. Complete heart block, sinus rate 138/min. What do you expect?',
            ['Pacemaker Wenckebach: the AS–VP interval lengthens until one P wave falls in PVARP and is not tracked', '1:1 tracking at 138/min', '2:1 block with a ventricular rate of 69/min', 'Mode switch to DDI'],
            '138/min is above the upper tracking rate (so not 1:1) and below the 2:1 rate (so not 2:1). In that window the device Wenckebachs.'),
          look('Watch it', 'Follow the markers: the gap from AS to VP stretches beat by beat, then an AR appears with no VP after it, and the cycle restarts. The ventricular rate never exceeds 130/min. Now slide the patient\'s sinus rate slowly from 100 to 170/min and find the three zones.', { patient: 'chbFast', pm: { mode: 'DDD' }, show: ['sinus'] }),
          act('2to1-make', 'Make it block 2:1', 'The sinus rate is 138/min (cycle 435 ms). Reprogram one timer so that the device blocks 2:1.', { bench: B,
            check: (x) => /(AS VP AR ){3}/.test(x.seq) && x.since >= 5000, solve: (b) => b.set('pvarp', 300), hint: 'TARP must become longer than the sinus cycle of 435 ms.',
            why: 'With TARP longer than 435 ms every second P wave falls in PVARP. The ventricular rate drops from about 130 to 69/min in one beat: this is what the patient feels on the stairs.' }),
          act('1to1', 'Make it track 1:1', 'Now make the device track every P wave at 138/min.', { bench: { patient: 'chbFast', pm: { mode: 'DDD', pvarp: 300 }, show: ['url', 'avdS', 'pvarp'] }, keep: true,
            check: (x) => /(AS VP ){7}/.test(x.seq) && x.n.AR === 0 && x.since >= 6000, solve: (b) => { b.set('pvarp', 250); b.set('url', 150); }, hint: 'Two conditions: TARP shorter than the sinus cycle, and an upper tracking rate above the sinus rate.',
            live: (x) => (x.c.avdS + x.c.pvarp < 435 && x.c.url < 140 ? 'TARP is short enough now, but the upper tracking rate is still below 138/min: Wenckebach.' : x.c.url >= 140 && x.c.avdS + x.c.pvarp >= 435 ? 'The upper rate allows it, but TARP is still longer than the sinus cycle: 2:1.' : null),
            why: 'Both limits have to clear the sinus rate: TARP below 435 ms and an upper tracking rate above 138/min. Raising the upper tracking rate alone does nothing if TARP is the limit.' }),
          mcq('treadmill', 'Breathless at a fixed heart rate', 'An active 58-year-old with complete heart block: at about 125/min on the treadmill the heart rate drops abruptly to 63/min. Sensed AV delay 180 ms, PVARP 300 ms, upper tracking rate 140/min. Best change?',
            ['Shorten PVARP (and/or use a rate-adaptive AV delay) so TARP is shorter than the cycle at peak sinus rate', 'Raise the upper tracking rate to 160/min', 'Lengthen PVARP to 350 ms', 'Lower the lower rate to 50/min'],
            'TARP is 480 ms, so 2:1 block begins at 125/min, below the upper tracking rate of 140. The upper rate is not the limit; TARP is. Raising the upper tracking rate changes nothing.'),
          mcq('window', 'The Wenckebach window', 'Upper tracking rate 120/min (500 ms); TARP 400 ms. Over what range of atrial rates will the device show Wenckebach behaviour?',
            ['From 120 to 150/min', 'From 100 to 120/min', 'Only above 150/min', 'There is no Wenckebach window'],
            'From the upper tracking rate (120) up to the 2:1 rate (60 000 ÷ 400 = 150). A window exists only when the upper rate interval is longer than TARP.'),
        ];
      } },

    { id: 6, title: 'When the device joins the circuit', short: 'PMT, mode switch, magnet', goal: 'Start, stop and prevent pacemaker-mediated tachycardia; read a mode switch; know what a magnet does.',
      teach: () => [
        para('**Pacemaker-mediated tachycardia** (endless-loop tachycardia) needs three things: a tracking mode, retrograde (VA) conduction, and an event that separates the P wave from the QRS so the atrium has recovered when the retrograde impulse arrives. The usual trigger is a PVC; others are loss of atrial capture, atrial under- or over-sensing, a very long AV delay, and taking a magnet off.'),
        list(['The loop: ventricular pace → retrograde P wave → sensed after PVARP → AV delay → ventricular pace. The device is the antegrade limb.',
          '**Cycle length = retrograde conduction time + sensed AV delay, but never shorter than the upper rate interval.** So PMT runs at the upper tracking rate or below it.',
          'A paced tachycardia near the upper rate has three causes to separate: sinus tachycardia being tracked, an atrial arrhythmia being tracked, and PMT.',
          '**Stop it:** a magnet (no sensing, so the loop breaks), or any single beat that is not tracked. **Prevent it:** a PVARP longer than the retrograde conduction time measured during ventricular pacing, PVARP extension after a PVC, or a PMT-termination algorithm.',
          'The cost of a long PVARP is a long TARP and a low 2:1 rate. That trade between units 5 and 6 is the central compromise of dual-chamber programming.',
          '**Mode switch:** when the atrial channel counts a rate above the detection rate (about 170–180/min) the device stops tracking and paces DDI or VVI. Appropriate in AF, flutter and atrial tachycardia. A false mode switch usually means the far-field R wave is being counted as a P wave.',
          '**Magnet.** Pacemaker: asynchronous pacing at a rate that depends on the manufacturer and the battery, for as long as the magnet is on. ICD: tachyarrhythmia detection and therapy are suspended; in almost all models pacing is unchanged and does not become asynchronous.'])],
      steps: () => {
        const r = pick([[400, 150, 130], [250, 150, 120], [320, 180, 130], [380, 160, 125]]), cyc = Math.max(r[0] + r[1], 60000 / r[2]);
        const B = { patient: 'retro4', pm: { mode: 'DDD', pvarp: 320 }, show: ['pvarp'] };
        return [
          look('The retrograde P wave', 'Sinus node disease with intact retrograde conduction. Watch a PVC: about 270 ms after it a retrograde P wave reaches the atrium and gets an AR marker. It fell inside the 320 ms PVARP, so it was seen and ignored.', B),
          mcq('pmt-predict', 'Predict: shorten PVARP', 'You are about to shorten PVARP to 200 ms. What will the next PVC do?',
            ['Its retrograde P wave will be sensed and tracked, starting a loop of ventricular pace → retrograde P → ventricular pace', 'Nothing: PVARP only matters at high sinus rates', 'The device will mode-switch', 'The device will block 2:1'],
            'The retrograde P wave arrives at about 270 ms. With a 200 ms PVARP it is outside the refractory period, is marked AS, and starts an AV delay.', { bench: B, keep: true }),
          act('pmt-make', 'Start PMT', 'Do it, and wait for a PVC.', { bench: B, keep: true, check: (x) => x.c.pvarp <= 260 && pmt(x), solve: (b) => b.set('pvarp', 200),
            live: (x) => (x.c.pvarp <= 260 ? 'PVARP is now shorter than the retrograde conduction time. Waiting for a PVC…' : null), hint: 'PVARP must be shorter than the 270 ms it takes the PVC to reach the atrium.',
            why: 'Every paced beat now conducts back to the atrium, and every retrograde P wave triggers the next paced beat. Nothing is wrong with the hardware: the device is doing exactly what DDD means.' }),
          mcq('pmt-why', 'Why this rate?', 'The upper tracking rate is 130/min, yet this PMT runs at about 118/min. Why?',
            ['Its cycle is the retrograde conduction time plus the sensed AV delay (about 360 + 150 ms), which is longer than the upper rate interval', 'PMT always runs 10 % below the upper tracking rate', 'The device is in Wenckebach', 'The lower rate limit is controlling the rate'],
            'After a paced beat retrograde conduction takes about 360 ms here (longer than after the PVC). 360 + 150 = 510 ms, or 118/min. Only when that sum is shorter than the upper rate interval does PMT sit exactly at the upper tracking rate.', { bench: { patient: 'retro4', pm: { mode: 'DDD', pvarp: 200 }, show: ['pvarp'] }, keep: true }),
          act('pmt-break', 'Stop it at the bedside', 'Terminate the tachycardia without reprogramming.', { bench: { patient: 'retro4', pm: { mode: 'DDD', pvarp: 200 }, show: [], tog: ['magnet'] }, keep: true,
            check: (x, st) => { if (!x.c.magnet && pmt(x)) st.seen = 1; return !!st.seen && x.c.magnet && x.since >= 3500; }, solve: (b) => b.set('magnet', true),
            live: (x, st) => (!st.seen ? 'Waiting for a PVC to start the tachycardia…' : x.c.magnet ? 'Asynchronous pacing: the retrograde P waves are no longer sensed.' : 'PMT is running. Stop it.'),
            why: 'The magnet removes sensing, so the retrograde P wave cannot trigger anything and the loop ends. But nothing has been fixed: take the magnet off and the next PVC, or the magnet removal itself, restarts it.' }),
          act('pmt-prevent', 'Prevent it for good', 'Now prevent it permanently, keeping the DDD mode, and take the magnet off. The check waits for the next PVC.', { bench: { patient: 'retro4', pm: { mode: 'DDD', pvarp: 200 }, show: ['pvarp'], tog: ['pvcExt', 'magnet'] }, keep: true,
            check: (x) => !x.c.magnet && x.lastPvc > 0 && x.t - x.lastPvc > 2800 && x.retroAfter <= 1 && !pmt(x), solve: (b) => { b.set('pvarp', 380); b.set('magnet', false); },
            live: (x) => (x.c.magnet ? 'The magnet is still on.' : pmt(x) ? 'PMT is running. PVARP extension after a PVC only prevents the next start; this loop needs a PVARP longer than the 360 ms retrograde time, or the magnet again.' : 'Waiting for a PVC to test your programming…'),
            hint: 'PVARP must outlast retrograde conduction: about 270 ms after a PVC, about 360 ms after a paced beat.',
            why: 'A PVARP longer than the retrograde conduction time turns every retrograde P wave into an AR. PVARP extension after a PVC covers the commonest trigger without lengthening PVARP on every beat. Measure retrograde conduction during ventricular pacing: it is longer than after a PVC.' }),
          num('pmt-rate', 'How fast will PMT run?', `Retrograde conduction time ${r[0]} ms, sensed AV delay ${r[1]} ms, upper tracking rate ${r[2]}/min. At what rate will PMT run?`, 60000 / cyc, 3, '/min',
            `Loop time = ${r[0]} + ${r[1]} = ${r[0] + r[1]} ms; upper rate interval = ${Math.round(60000 / r[2])} ms. The device uses the longer of the two: ${Math.round(cyc)} ms, i.e. ${Math.round(60000 / cyc)}/min.`),
          mcq('tradeoff', 'The price of a long PVARP', 'Retrograde conduction measures 380 ms, so you lengthen PVARP to 430 ms. The sensed AV delay is 150 ms. What have you given up?',
            ['The 2:1 block rate has fallen to about 103/min', 'Atrial pacing support', 'The ability to mode-switch', 'Ventricular sensing during PVARP'],
            'TARP is now 580 ms, and 60 000 ÷ 580 is 103/min. In an active patient that is a poor trade: prefer PVARP extension after PVCs or a PMT algorithm, which act only when needed.'),
          mcq('ms', 'A sudden fall in paced rate', 'DDD pacemaker, complete heart block. Holter: the paced ventricular rate falls abruptly from about 125/min, irregular, to 60/min, regular, for 40 minutes and then returns. During the episode the atrial markers run irregularly at about 300/min.',
            ['Appropriate mode switch during atrial fibrillation', '2:1 upper-rate block', 'Battery at elective replacement', 'Ventricular over-sensing'],
            'A fast, irregular atrial rate, tracked irregularly near the upper rate until the device stops tracking and paces at the lower rate. 2:1 block would halve the rate, not send it to the lower rate, and the atrial rate would be regular.'),
          mcq('ffr', 'Mode switches with no arrhythmia', 'Frequent brief mode-switch episodes are logged, but the stored electrograms show sinus rhythm with an extra atrial marker 40–80 ms after each ventricular pace. What is it, and what do you do?',
            ['Far-field R-wave over-sensing: lengthen post-ventricular atrial blanking or reduce atrial sensitivity', 'Atrial fibrillation: start anticoagulation', 'Atrial lead fracture: replace the lead', 'PMT: lengthen PVARP'],
            'The atrial lead is hearing the ventricle, so the device counts two atrial events per cycle and doubles the atrial rate. Lengthening PVARP would not help, because refractory events are still counted towards mode switch; blanking removes them. Do not anticoagulate on a device diagnosis without looking at the electrograms.'),
          mcq('icd-magnet', 'A magnet on an ICD', 'A magnet is taped over an ICD for surgery with diathermy. What does it do?',
            ['It suspends tachyarrhythmia detection and therapy; bradycardia pacing continues unchanged and can still be inhibited by diathermy', 'It makes pacing asynchronous and suspends therapy', 'It has no effect on an ICD', 'It disables the device until it is reprogrammed'],
            'In almost all ICDs the magnet affects only tachycardia therapy. A pacing-dependent ICD patient therefore still needs reprogramming to an asynchronous mode if diathermy will be used near the device.'),
        ];
      } },

    { id: 7, title: 'Reading the hardware', short: 'Lead and battery failure', goal: 'Tell fracture, insulation breach, dislodgement, exit block and battery depletion apart from the numbers.',
      teach: () => [
        para('A pacing circuit is a loop: generator → conductor → electrode → tissue → back. **Impedance** summarises its health. The usual range is roughly 300–1200 Ω, and a change from the patient\'s own baseline matters more than the absolute value.'),
        table(['Problem', 'Impedance', 'Threshold', 'Sensing', 'Clues'], [
          ['Conductor fracture / loose set-screw', 'very high (> 2000 Ω), often intermittent', 'no output reaches the heart when open', 'make-break noise → over-sensing', 'pauses with posture or arm movement; clavicle–first rib'],
          ['Insulation breach', 'low (< 200–250 Ω)', 'apparently higher (current leaks away)', 'smaller signal; muscle potentials get in', 'early battery depletion; pocket or pectoral twitching'],
          ['Dislodgement / perforation', 'near normal', 'much higher', 'much smaller', 'early after implant; the film shows the tip has moved'],
          ['Exit block, metabolic, drugs', 'normal', 'higher', 'normal', 'weeks after implant, or with K⁺, acidosis, flecainide, infarct'],
          ['Battery at elective replacement', 'normal', 'normal', 'normal', 'reverts to VVI at a fixed rate; magnet rate falls']]),
        list(['Order of thought: **is the loop broken, leaking, moved, or intact?** High impedance is a break. Low impedance is a leak. Normal impedance with threshold and sensing both bad is a tip that has moved. Normal impedance with only the threshold up is the tissue.',
          'A fractured lead does two things at once: its noise inhibits the device, and when the circuit is open nothing reaches the heart. A magnet cures the first and not the second.',
          'Battery depletion looks like a change of personality, not a lead fault: capture and sensing are fine, but dual-chamber and rate-response functions have been switched off to save energy.'])],
      steps: (want) => [
        mcq('imp-high', 'Pauses when reaching overhead', 'Intermittent pauses when the patient reaches overhead. Interrogation: ventricular lead impedance > 2500 Ω (previously 610 Ω), with bursts of non-physiological high-frequency signals on the ventricular electrogram.',
          ['Conductor fracture or a loose set-screw: an open circuit with make-break noise', 'Insulation breach', 'Lead dislodgement', 'Exit block'], 'High impedance means the loop is broken. The noise is the broken ends touching; it is sensed as R waves and inhibits output.'),
        mcq('imp-low', 'Everything slightly wrong', 'Impedance 180 Ω (previously 560 Ω). The threshold has risen from 0.75 to 2.0 V, the R wave has fallen from 11 to 3 mV, the battery is draining faster than projected, and the pectoral muscle twitches with each stimulus.',
          ['Insulation breach', 'Conductor fracture', 'Lead dislodgement', 'Battery at elective replacement'], 'Low impedance means current is leaking out of the loop: less reaches the tip, less signal comes back, the muscle beside the leak is stimulated, and the battery pays for all of it.'),
        mcq('early', 'Day two', 'Day 2 after implant: no ventricular capture at maximum output, and the R wave is 1.8 mV (12 mV at implant). Impedance 480 Ω (520 Ω at implant).',
          ['Lead dislodgement: chest film, reposition', 'Conductor fracture', 'Exit block: raise the output and review in six weeks', 'Battery depletion'], 'Threshold and sensing have failed together, early, with an intact loop: the tip is no longer where it was left. Exit block spares sensing and takes weeks.'),
        mcq('eri', 'A change of personality', 'DDDR device. The patient reports fatigue and neck pulsations. ECG: ventricular pacing at a fixed 65/min with dissociated P waves. Capture, sensing and impedance are normal. The magnet rate was 85/min at implant and is now 65/min.',
          ['Elective replacement indicator: the device has reverted to VVI. Arrange a generator change', 'Atrial lead dislodgement', 'Mode switch for atrial fibrillation', 'Upper rate behaviour'], 'Nothing is wrong with either lead. The fall in magnet rate is the bedside sign of battery depletion; the neck pulsations are cannon waves from the loss of AV synchrony (pacemaker syndrome).'),
        mcq('crush', 'Where to look on the film', 'A lead placed by a medial subclavian puncture shows intermittent high impedance four years later. Where on the chest film is the fracture most likely?',
          ['Between the clavicle and the first rib', 'At the tricuspid valve', 'At the lead tip', 'Inside the generator header'], 'Subclavian crush: the lead is pinched between clavicle and first rib with every arm movement. A header problem (loose set-screw) appears early after an implant or generator change, not years later.'),
        mcq('magnet-open', 'The magnet does not help', 'A pacing-dependent patient has pauses. Under a magnet the marker channel shows regular paced events at the magnet rate, but several are followed by no spike on the ECG and no QRS. Impedance is > 3000 Ω.',
          ['Open circuit from a conductor fracture: the device is firing but the stimulus does not reach the heart', 'Over-sensing only: leave the magnet on', 'Threshold rise: increase the output', 'Battery depletion'], 'A marker without a spike means the output never left the lead. Asynchronous pacing cannot rescue an open circuit; this patient needs temporary pacing and a new lead.'),
      ].concat(wanted(want, HW, 2).map(cas)) },

    { id: 8, title: 'Unknown faults', short: 'Troubleshooting', goal: 'Given a strip and an interrogation, say what the device is doing wrong, why, and what to do. Four of five to pass.',
      teach: () => [
        para('Use the same order every time. It stops you from pattern-matching on the first abnormal thing you see.'),
        h('ol', { style: { margin: '0.4em 0 0', paddingLeft: '1.2em' } }, [
          '**What is programmed?** Mode, rates, AV delay. Decide what this strip ought to look like before you read it.',
          '**Output.** Is there a stimulus whenever one is due? No gap may exceed the lower rate (or hysteresis) interval.',
          '**Capture.** Is each stimulus, delivered into tissue that could respond, followed by depolarisation?',
          '**Sensing.** Does every intrinsic event get a marker and reset the timers, and does nothing else?',
          '**Timing.** Is the AV relationship as programmed, and the paced rate within the limits?',
          '**Numbers.** Threshold, sensed amplitude, impedance, battery: these turn "what" into "why".',
          '**Magnet,** if there are pauses: it separates over-sensing (pacing returns) from failure to deliver or capture (it does not).'].map((s) => h('li', { html: fmt(s) }))),
        para('Each case below applies one hidden fault. The automatic read-out is off. You may interrogate and use the magnet. All three answers must be right for the case to count.')],
      steps: (want) => wanted(want, D.QUIZ, 5).map(cas) },
  ];

  C.benches.pacer = () => new Bench();
  C.PacerBench = Bench; C.pacerPatients = P; C._dbg = { CASE, FN, FIX };
  C.addTrack({ id: 'dev', title: 'Pacing and device troubleshooting', short: 'Devices', dom: 'device', bench: 'pacer',
    blurb: 'From one clock in a single-chamber device to diagnosing an unknown fault from the strip and the interrogation.', units: UNITS });
})(globalThis.EP = globalThis.EP || {});
