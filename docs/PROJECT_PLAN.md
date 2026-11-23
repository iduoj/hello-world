# EP Simulator — Project Plan & Working Notes

> Living document. Read this first after any context loss. Update the
> **Status** section at the end of each work block.

## Goal (from the user's brief)
A teaching-first 12-lead ECG / electrophysiology simulator:

1. 12-lead ECG simulator with common arrhythmias: polymorphic VT / torsades,
   monomorphic VT, AVNRT, AVRT, AF, flutter, blocks, etc.
2. Rotatable 3D heart with an electrical (activation) map tied to each rhythm,
   plus other mechanism tools (ladder diagrams, calipers, explanations).
3. Devices: pacemakers (single/dual chamber, CRT, LBB-area pacing, leadless
   Micra VR/AV, AVEIR VR/AR/DR) and ICDs (transvenous, S-ICD, EV-ICD):
   lead positions in 3D, simulated chest X-ray in correct vs incorrect
   positions and what gives it away.
4. Localisation from the 12-lead: paced QRS by pacing site, PVC/VT origin,
   accessory pathway.
5. Drug overdose / electrolyte ECG effects.
6. Patient scenarios: pharmacologic vs electrical management.
7. Pacemaker troubleshooting: modes, timing cycles, what "working properly"
   looks like, malfunctions.
8. Temporary pacing: transcutaneous + transvenous (mA, capture, sensitivity).

Assumed audience: clinician learner (resident / fellow / advanced nurse / PA).
Delivery: static web app (no server), works in a browser, also published as a
Claude artifact.

## Core design decision
One physical model drives everything, so the ECG, the 3D map and the
localisation tools always agree:

- **Anatomy** is procedural (signed-distance fields → surface-nets mesh). No
  external assets.
- **Ventricular activation**: voxel model of the myocardium with a fast
  endocardial (Purkinje) layer; multi-source Dijkstra gives local activation
  time (LAT) for any set of sources (His-Purkinje exits, PVC focus, pacing
  lead tip, accessory pathway insertion).
- **ECG**: the heart dipole is the sum of LAT gradients (uniform double
  layer); T wave from the ventricular-gradient rule (T area = G − QRS area),
  so wide/ectopic beats get discordant T waves automatically. Dipole → 12
  leads through the Dower matrix.
- **Atria**: surface-mesh geodesic activation → P-wave dipole.
- **Rhythm**: discrete-event conduction simulator (SA node, atria, dual
  AV-node pathways, His/ventricles, accessory pathway, ectopic foci, device)
  with delays + refractory periods. Re-entry, Wenckebach, PMT etc. emerge
  from it; drugs/shocks/pacing are parameter changes or injected events.

## Coordinates
World, centimetres: **+x = patient's left, +y = superior, +z = anterior**.
Viewer faces the patient (patient's left on screen right), same as a PA film.
Heart-local frame: A = LV long axis (base→apex), S = LV→RV (septal normal),
N = A×S (points to the inferior wall). `G.L(s,n,a)` maps local → world.

## Code layout (plain scripts, global `EP` namespace, no build needed)
See docs/ARCHITECTURE.md for module APIs.

    index.html            app shell, loads css + js in order
    css/app.css
    js/util.js            vec math, RNG, helpers
    js/geometry.js        SDF anatomy, landmarks, surface nets mesher
    js/model.js           voxel ventricles, atrial graph, Dijkstra, dipoles
    js/morph.js           beat waveforms (P/QRS/T), modifiers, Dower leads
    js/heartsim.js        discrete-event conduction simulator
    js/device.js          pacemaker / ICD / temporary pacer logic
    js/rhythms.js         rhythm library presets + teaching text
    js/ecgview.js         canvas ECG paper, 12-lead, strips, ladder, calipers
    js/heart3d.js         three.js scene, activation animation, labels
    js/devices3d.js       leads, generators, torso, chest X-ray mode
    js/ui-*.js            app modules (one per tab)
    js/content-*.js       teaching content (scenarios, tox, device notes)
    tools/build.mjs       bundles to dist/ single-file + artifact fragment
    tools/shot.mjs        Playwright screenshot / smoke-test harness

## Modules (tabs)
1. Rhythm Lab — library, 12-lead, rhythm strip, ladder diagram, calipers,
   synced 3D activation map, mechanism notes.
2. Localisation Lab — click-the-heart PVC/VT origin, accessory pathway,
   pacing-site QRS; rules + quiz.
3. Devices — device explorer: 3D leads + simulated CXR (PA/lateral),
   correct vs malpositioned, paced 12-lead.
4. Pacemaker Simulator — modes, timing cycles, marker channel,
   malfunctions, troubleshooting cases, magnet.
5. Temporary Pacing — transcutaneous + transvenous boxes (rate, mA, mV).
6. ICD — zones, discriminators, ATP/shock, inappropriate therapy.
7. Tox & Electrolytes — severity sliders, patterns, antidotes.
8. Scenarios — cases with live monitor; drugs vs electricity; debrief.
9. Quiz — rhythm identification.

## Testing
- cdnjs is blocked in the dev sandbox; three.js r128 is fetched from npm into
  the scratchpad and Playwright routes the CDN URL to it (tools/shot.mjs).
- Pure-logic modules run under Node (they only touch `globalThis.EP`).

## Status log
- [x] Block 1: geometry + activation model + ECG synthesis (model-derived QRS validated visually)
- [x] Block 2: ECG renderer + rhythm engine + library (40 rhythms)
- [x] Block 3: 3D heart + sync
- [x] Block 4: app shell + Rhythm Lab
- [x] Block 5: devices (3D hardware, simulated CXR, catalogue + malpositions), pacemaker simulator,
      temporary pacing, ICD
- [x] Block 6: localisation lab (PVC/VT origin, accessory pathway, pacing site)
- [x] Block 7: tox & electrolytes, cases, quiz
- [x] Block 8: bundle, artifact published, draft PR #4

### Round 2 (user feedback: fellow level is right; wants more self-testing to find gaps; expand STEMI)
- [x] Ischaemia engine: voxel territories → injury (ST) vector from transmural directions, scar mask for
      Q waves, extra leads V4R/V7–V9, PR depression, custom ST shapes (`js/ischemia.js`)
- [x] STEMI / OMI tab (`js/ui-stemi.js`): occlusion by artery with evolution slider, coronary tree +
      territory on the 3D heart, subtle OMI patterns (hyperacute T, de Winter, precordial swirl, South
      African flag, Aslanger, Wellens, posterior), LBBB / paced + modified Sgarbossa calculator, mimics
- [x] Assessment tab (`js/ui-assess.js`, replaces the simple quiz): mixed-domain fellow-level questions
      (generated ECG items + written MCQs), confidence rating, per-domain gap map, history in
      localStorage and in the artifact `db` capability (collection `assessment`) so results can be read
      back to tailor later content

### Round 3 (user took the baseline: 16/30; asked "what do we do with it / how do I improve?")
- [x] Study plan on the Assessment home: every missed / guessed item → key point, a concrete exercise,
      a deep link into the right tab (`EP.open(tab, focus)`, consumed via `EP.pending` in each mount), and
      a re-test. Item clears after two correct, non-guessed answers on separate sets (`Store.ledger()`).
- [x] Fairness: paced-strip fault questions now include interrogation values; indistinguishable sites are
      never offered against each other (`CONFUSE`).
- User's first baseline (2026-11-23): weakest = pacemaker troubleshooting 0/4, mechanisms 0/3 (two
  confident-wrong: VT specificity, concealed conduction), pacing-site localisation 1/3, tox 1/3.
  Strong = acute management, ICD, temporary pacing. Next content should deepen device troubleshooting
  and paced-QRS ↔ lead position.

### Round 4 (user feedback after the baseline) — done
User said: (a) could not change an answer after tapping an option, so the VT / AV-dissociation item was
a mis-tap, not a miss; (b) the AF item was a fair miss; (c) devices are weak "because I just don't know
enough" — wants teaching, re-testing and progressively harder testing there; (d) asked how confident I
am that using this builds knowledge.
- [x] Assessment: an option stays changeable until a confidence button locks it in; "Mis-tap — don't
      count this" after the reveal; "Not a real miss — remove" on Study-plan rows. Sessions carry `rev`
      and items carry `void`; `Store.amend(q)` writes the edit back to the db doc (`_id`); `Store.init`
      is idempotent, merges db and browser copies by `t` (higher `rev` wins) and uploads sets that were
      answered while the db was unreachable. Voided items are ignored by stats and ledger.
- [x] The user's baseline doc (`assessment/c1ngb7p3wtrqz6i4mb45`) was edited by hand: `w7` is `void`,
      `rev: 1`.
- [x] Device course tab (`js/ui-course.js`, id `course`, after `devices`): eight units, 56 scored steps.
      1 VVI timing · 2 capture/threshold · 3 sensing · 4 DDD states and AV delay · 5 PVARP/TARP/upper
      rate · 6 PMT, mode switch, magnet · 7 hardware signatures · 8 unknown faults (4 of 5 to pass).
      Step types: `look` (unscored), `mcq`, `num` (numbers regenerated each run), `do` (performed on
      the bench, verified from simulator state via `Bench.ctx()`), `case` (what is wrong → cause → fix).
      First-attempt scoring, pass mark 80 %. Spaced review: missed = due at once; right n times = due
      after 2 / 7 / 21 / 60 days (`Prog`, localStorage `ep.course`, db doc `course/progress`).
      Results are also saved as Assessment sessions (`src: 'course'`, domain `device`, ids
      `c-<unit>-<key>`), so they feed the gap map and the Study plan; `EP.Course.describe(q)` gives the
      deep link `{unit, step}` and "Re-test this" opens that single step.
- [x] Engine fixes found while building the course: rate hysteresis now applies after any sensed beat
      (it was skipped after escape/PVC beats); mode switch uses "4 of the last 7" atrial intervals, so
      far-field R-wave over-sensing really does cause a false mode switch; the strip analyser recognises
      PMT that runs below the upper tracking rate (VA time + AV delay > upper rate interval).
- Verified headlessly: every unit walked start to finish with correct answers; every `do` step fails
  before the action and passes 3–8 s after its `solve`; all 13 unknown-fault cases load, show on the
  strip and can be answered. Test scripts were ad hoc (scratchpad), see "Testing the course" below.

#### Testing the course
`EP.Course._run` exposes the live runner: `.inst` (step instances), `.bench`, `.state()`, `.poll()`.
A walker can answer `mcq` with `s.a[0]`, `num` with `s.ans`, call `s.solve(run.bench)` for `do` steps
and fast-forward with `run.bench.live.advance(500)`; `EP.Course._dbg` has the case answer tables.

#### What I told the user about how much this helps (keep the claims honest)
Good evidence for the method (retrieval practice with feedback, spacing, generated items, doing rather
than recognising). Limits: content written by one author and not reviewed by an electrophysiologist;
the simulator is a simplified model and its tracings are cleaner than real ones; device behaviour is
generic, not manufacturer-specific; no external benchmark yet. Suggested check: an outside set of real
tracings / board-style device questions before and after.

### Ideas not done yet (candidates for the next round)
- Rate response (R) and AV-search / minimised-ventricular-pacing algorithms in the pacemaker sim
- Course follow-ons: a matching course for ICDs (zones, discriminators, inappropriate shocks) and for
  paced-QRS ↔ lead position; calipers on the live strip; pulse-width control (strength–duration curve)
- Intracardiac electrogram channels (A/V EGM) beside the marker channel
- Scar-based VT circuit drawn on the 3D map (isthmus, exit) and entrainment concepts
- LVH with strain, takotsubo, PE patterns as further STEMI mimics; Smith 4-variable formula calculator
- Epicardial post-surgical wires; S-ICD sensing-vector screening tool
- Spaced-repetition scheduling for the quiz; per-topic progress

### Notes for whoever resumes
- Hemiblock axis shift is boosted by small additive lobes (`LOBES` in morph.js) — the uniform
  Purkinje sheet alone under-shifts the axis. Everything else is pure model output.
- Normal frontal axis ≈ +30°; normal QRS 78 ms (visible), PR ≈ 160 ms.
- Sandbox blocks cdnjs: tests map the three.js URL to the npm copy (tools/shot.mjs).
- X-ray hardware materials must be `transparent: true` or the subtractive lung pass darkens them.
- Canvas views (ECGView/LiveStrip) must be created after their canvas has a parent element.
