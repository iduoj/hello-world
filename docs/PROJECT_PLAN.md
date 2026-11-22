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
- [ ] Ischaemia engine: voxel territories → injury (ST) vector from transmural directions, scar mask for
      Q waves, extra leads V4R/V7–V9, PR depression, custom ST shapes (`js/ischemia.js`)
- [ ] STEMI / OMI tab (`js/ui-stemi.js`): occlusion by artery with evolution slider, coronary tree +
      territory on the 3D heart, subtle OMI patterns (hyperacute T, de Winter, precordial swirl, South
      African flag, Aslanger, Wellens, posterior), LBBB / paced + modified Sgarbossa calculator, mimics
- [ ] Assessment tab (`js/ui-assess.js`, replaces the simple quiz): mixed-domain fellow-level questions
      (generated ECG items + written MCQs), confidence rating, per-domain gap map, history in
      localStorage and in the artifact `db` capability (collection `assessment`) so results can be read
      back to tailor later content

### Ideas not done yet (candidates for the next round)
- Rate response (R) and AV-search / minimised-ventricular-pacing algorithms in the pacemaker sim
- Intracardiac electrogram channels (A/V EGM) beside the marker channel
- Scar-based VT circuit drawn on the 3D map (isthmus, exit) and entrainment concepts
- STEMI / pericarditis / LVH morphologies (outside pure EP but useful for the quiz)
- Epicardial post-surgical wires; S-ICD sensing-vector screening tool
- Spaced-repetition scheduling for the quiz; per-topic progress

### Notes for whoever resumes
- Hemiblock axis shift is boosted by small additive lobes (`LOBES` in morph.js) — the uniform
  Purkinje sheet alone under-shifts the axis. Everything else is pure model output.
- Normal frontal axis ≈ +30°; normal QRS 78 ms (visible), PR ≈ 160 ms.
- Sandbox blocks cdnjs: tests map the three.js URL to the npm copy (tools/shot.mjs).
- X-ray hardware materials must be `transparent: true` or the subtractive lung pass darkens them.
- Canvas views (ECGView/LiveStrip) must be created after their canvas has a parent element.
