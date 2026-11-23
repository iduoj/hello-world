# Writing a course track

The **Courses** tab teaches one subject per *track*. A track is a list of *units*; a unit is a short
teaching text followed by scored *steps* that the learner works on a *bench* (a tracing or a live
simulation). The engine is `js/course-kit.js`; each track is one file `js/course-<id>.js`.
`js/course-dev.js` (pacing, eight units) is the worked example: read it before writing a track.

## Who it is for, and the standard

- The learner is a physician at **cardiology-fellow level** who wants to understand, not memorise.
  They said about one weak area: "I just don't know enough." So each track starts from first
  principles and builds up; it does not assume the mechanism is already known.
- **Teaching comes first.** A step exists to make the learner use an idea. A fact that cannot be
  reasoned to from the unit's ideas does not belong in a scored step.
- **Accuracy over coverage.** Everything must be defensible against a standard EP / cardiology
  textbook and current guidelines. Where practice varies (drug choice, doses, energies, device
  behaviour by manufacturer) say so in the explanation and test the principle, not one vendor's number.
  If you are not sure a statement is right, leave it out.
- **The simulation must show what the text says.** Before you write a number or a description into a
  step, generate the tracing and check it (see "Verifying"). If the model cannot show something
  faithfully, do not build a bench task on it; use a written question or leave it out.
- British spelling (ischaemia, localisation, hyperkalaemia), plain sentences, no slang, no exclamation
  marks. Lead names: I, II, III, aVR, aVL, aVF, V1–V6, V4R, V7–V9.

## Registering a track

```js
(function (EP) {
  'use strict';
  const C = EP.Course, S = C.S, { para, list, ol, table } = C.T, { pick, shuffle } = C.util;
  C.addTrack({ id: 'arr', title: 'Arrhythmia mechanisms', short: 'Arrhythmias', dom: 'mech',
    blurb: 'One line shown on the course home.',
    bench: 'ecg',                       // default bench kind for steps whose spec has no `kind`
    units: [ { id: 'a1', title: 'The AV node', short: 'AV node', goal: 'One sentence: what the learner can do afterwards.',
               dom: 'mech',             // optional: overrides the track's Assessment domain
               teach: () => [para('…'), list(['…', '…'])],
               steps: (keys) => [ /* step objects, built fresh on every call */ ] } ] });
})(globalThis.EP = globalThis.EP || {});
```

- **Unit ids** are a track prefix plus a number and never change once published (stored answers refer
  to them): `1–8` devices, `a*` arrhythmias, `l*` localisation, `s*` ischaemia, `t*` tox, `m*`
  management, `d*` devices II.
- **`dom`** is the Assessment domain the results count under: `rhythm`, `mech`, `local`, `isch`,
  `device`, `hardware`, `temp`, `icd`, `tox`, `mgmt`.
- `teach()` returns DOM nodes. `para('text with **bold**')`, `list([...])`, `ol([...])`,
  `table(head, rows)`. Five to eight bullets: the ideas, in the order they are needed. Not a fact list.
- `steps(keys)` is called on every run, so pick random numbers / variants **inside** it. `keys` is an
  array of step keys when a single step is being re-tested; a unit that chooses random cases must
  honour it (see `wanted()` in `course-dev.js`). Otherwise ignore it: the runner filters by key.

## Steps (`EP.Course.S`)

| Constructor | Scored | Meaning |
| --- | --- | --- |
| `S.look(title, text, bench)` | no | Tells the learner what to notice. Its bench is shown with the read-out on. |
| `S.mcq(key, title, question, [right, ...wrong], why, {bench, keep, many})` | yes | One best answer. The choice can be changed until "Check answer". `many: true` lays long option lists out as a grid (use it for "which of these 15 sites"). |
| `S.num(key, title, question, answer, tolerance, unit, why, {bench, keep})` | yes | Free numeric answer. `answer`, `tolerance` and `why` may be functions of the bench (`(b) => b.m.pr`). Retry is allowed; only the first answer is scored. |
| `S.act(key, title, instruction, {bench, keep, check, solve, live, hint, why})` | yes | Performed on the bench. `check(x, st)` receives `bench.ctx()` and a per-step scratch object and returns true when the learner has achieved it. `solve(bench)` must achieve it (used by "Show me", which scores the step as missed, and by the test walker). `live(x, st)` may return a one-line status. |
| `S.multi(key, title, intro, [[question, right, [wrong...], why], ...], {bench, tDone, why})` | yes | Linked questions (what is it → why → what do you do). All parts must be right. `tDone` is the title shown once answered. |

Rules that the runner and the walker rely on:

- `key` is unique within the unit and stable for ever. It names the *concept*, not the variant
  (`'tarp'`, not `'tarp-150-250'`), so the review schedule follows the concept across random variants.
- A step with a `bench` spec loads that bench from scratch. Add `keep: true` to keep the previous
  step's state and only change the visible controls (the previous step must use the same kind of bench).
  Every bench-dependent step still needs its own complete `bench` spec, because it may be run alone as
  a re-test.
- A step with no `bench` leaves whatever is on screen. **Do not put a bench on a "predict" question if
  the tracing would give the answer away**; show it in the `look` or `do` step that follows.
- `check` must be false before the learner acts and true after `solve`. Never make it depend on wall
  time alone.

## Benches

`bench: { kind: '…', … }`. The kind defaults to the track's `bench`.

### `ecg`: a static tracing driven by parameters (`EP.Course.EcgBench`)

```js
{ kind: 'ecg',
  make: (p, bench) => recording,          // called at load and after every control change
  p: { coupling: 420 },                   // parameter defaults
  ctl: [ { k: 'coupling', label: 'PAC coupling interval', min: 250, max: 600, step: 10, unit: 'ms' },   // slider (fmt: (v) => text to show a name instead of a number)
         { k: 'ap', label: 'Pathway', opts: [['leftLateral', 'Left lateral'], …] },                      // select
         { k: 'lbbb', label: 'Left bundle branch block', toggle: true },                                 // checkbox
         { k: 'aden', label: 'Give adenosine', button: true } ],                                        // counter
  layout: 'strip' | '12',  strips: [1],   // lead indices: 0 I, 1 II, 2 III, 3 aVR, 4 aVL, 5 aVF, 6–11 V1–V6, 12 V4R, 13–15 V7–V9
  ladder: true, markers: false, rowMm: 34, gain: 10,       // gain in mm/mV: lower it when tall complexes overlap
  title: '…', cap: 'one line under the tracing',           // or cap: (p, m, rec) => '…', re-evaluated after every change
  wide: true,                             // force the full-width layout (default: 12-leads wide, strips beside the steps)
  measure: (rec, p) => m,                 // default EP.Rhythms.measure(rec): vRate, aRate, pr, qrs, qt, qtc, axis, regular
  read: (rec, p, m) => [['PR', m.pr, 'ms'], …] }   // read-out, hidden until the step is answered
```

`ctx()` → `{ p, base, rec, m, ev, changes }` (`ev` = `rec.events`; `changes` = number of control
changes). A 12-lead uses the full page width with the steps underneath; a strip sits beside the steps.
The learner can drag on the tracing to measure, so tolerances on measured values should be generous
(about ±20 ms on intervals, ±0.5 mm on ST levels, ±10/min on rates).

Making recordings:

- `EP.Rhythms.record(idOrEntry, { params, dur, warm })` for a library rhythm, or
  `EP.Rhythms.record({ cfg: () => ({ …HeartSim config… }) }, { dur })` for your own. The recording
  carries `rec.sim` (the simulator: `sim.out` events, `sim.foci`, …) and `rec.events`
  (`P`, `QRS` with `.label`/`.wave`/`.rr`, `cond`, `spike`, `mark`).
- Config reference: the `DEF` object and the header comment in `js/heartsim.js`; examples for every
  rhythm in `js/rhythms.js` (`R.onBeats` scripts timed events; `cfg.script: [{ t, do: (sim, t) => … }]`
  runs code at a time, e.g. `sim.blockAVN(t, 4000)` for adenosine; `R.apCfg`, `R.apAt` for pathways).
- QRS morphology from a site or pattern: `EP.Morph` (`js/morph.js`), `EP.LocData`, `EP.qrsFeatures`
  (`js/ui-localise.js`). Ischaemia: `EP.Isch`, `EP.Stemi` (`js/ischemia.js`, `js/ui-stemi.js`).
  Drugs and electrolytes: `EP.Tox` (`js/ui-tox.js`). See `docs/ARCHITECTURE.md` for the module map.

### `pacer`: a live patient + pacemaker + strip (`EP.Course.PacerBench`, in `course-dev.js`)

Spec `{ patient, pm, fault, force, show: [control keys], tog: [toggles], inter, fixedProg }`;
`ctx()` reports what the strip has shown since the last change (marker sequence, counts,
non-capture, false senses, …). Read the class for the details.

### Your own bench

Register `C.benches.mykind = () => new MyBench()`. Interface:

```
el                 the DOM element (a section.card)
load(spec)         show this spec from scratch
controls(spec)     optional: change controls but keep state (used by keep: true)
ctx()              the object passed to check()
findings(on)       show / hide any automatic interpretation (it is off while a step is unanswered)
destroy()
onTick, onChange   set by the runner; call this.onTick(t) while running live, this.onChange() after a
                   learner action, so `do` steps are re-checked
live               (live benches only) an EP.Live instance; the walker fast-forwards with live.advance(ms)
```

A canvas view (`EP.ECGView`, `EP.LiveStrip`) must be created after its canvas has a parent element.

### Things the first six tracks learned

- A course `mcq` can be re-tested from the Assessment tab **without its bench**, so its stem must stand
  on its own (put the finding in words as well as on the tracing) and its `why` must be a plain string.
- `describe()` and the review schedule call `steps()` often. If a step's text quotes numbers taken from a
  simulation, run that simulation once and memoise it.
- Where the model cannot show something (a small terminal R wave, a U wave, acceleration of pre-excited
  AF by nodal blockers), say so in the `look` text or the `why`, and score something it does show.
- If a behaviour is scripted by a rule in your track rather than emerging from the simulator (torsades
  triggers, the vulnerable period), state the rule on screen.
- Two sites or patterns that look alike in the model are never offered against each other.

## Designing a unit

1. **One idea per unit**, stated in `goal` as something the learner will be able to *do*.
2. Order the steps so the difficulty climbs:
   **look** (what to notice) → **predict** (`mcq`, before the tracing shows it) → **measure / calculate**
   (`num`, numbers randomised) → **do** (`act`: make it happen, or put it right) → **diagnose**
   (`multi`: an unknown, all parts right).
3. Five to ten scored steps. At least two that are not multiple choice. The last steps of a track
   should be unknowns that need everything before them.
4. Prefer a parameter the learner can move over a paragraph that describes what would happen.

## Writing questions

- One best answer that an expert would give without seeing the options. Distractors are the mistakes
  people actually make (wrong direction, wrong chamber, the neighbouring diagnosis), not jokes.
- **Options of similar length and form.** The walker counts how often the correct option is the
  longest and fails the track above 45 %. Do not write a detailed correct answer beside three stubs:
  move the detail into `why`.
- No "all / none of the above", no negatives ("which is NOT"), no two options that are both defensible.
  If a second option is arguably right, remove it or change the stem.
- Every number in a stem must be the number the tracing shows. Give units.
- `why` (one to three sentences) explains the reasoning and names the commonest wrong idea. It is
  shown whether the learner was right or wrong, and again in the study plan.
- Doses, energies and thresholds: use widely accepted values, say "typical" where they vary, and never
  present this as a protocol. The app carries a "not for clinical decision-making" notice.

## Verifying

```
node tools/course_walk.mjs --track <id>      # must end with WALK OK
node tools/shot.mjs "index.html#course" out.png 1400 950 2500 --eval "EP.open('course',{unit:'a1'})"
```

The walker answers every step correctly (the unit must pass), proves each `do` step fails before the
action and passes after `solve`, repeats the unit with wrong answers, checks keys and option lists, and
reports console errors. It cannot tell whether the content is *right*: probe the simulation yourself.
Examples of probing from Node are in `tools/dev_*.js` (they load the non-UI modules and print events).
Look at one screenshot per bench layout you use and read it: is the thing you ask about visible?

## When several tracks are written at once

- Edit only your own `js/course-<id>.js`, plus small **additive** exports in the lab modules assigned
  to you (never change their behaviour). Do not edit `course-kit.js`, `course-dev.js`, `index.html`,
  `css/app.css`, `docs/`, `tools/`, or `dist/`; do not run `tools/build.mjs`; do not use git commands
  that change state. Use inline styles and existing CSS classes.
- If the engine lacks something you need, write the step another way and report the gap.
- Temporary probe scripts go in the scratchpad or `tools/tmp-<id>-*.js`, deleted when you finish.

## Track outlines (round 5)

| Track | Units |
| --- | --- |
| `arr` → mech | a1 AV node: decrement, refractoriness, levels of block · a2 dual AV-nodal physiology and AVNRT · a3 accessory pathways: pre-excitation, orthodromic / antidromic AVRT, pre-excited AF · a4 atrial flutter and fibrillation · a5 wide-complex tachycardia and monomorphic VT · a6 polymorphic VT, torsades, VF |
| `loc` → local | l1 the QRS as a vector: bundle branch and fascicular blocks, axis · l2 PVC / VT origin · l3 accessory-pathway localisation · l4 paced QRS and lead position |
| `isch` → isch | s1 the injury current and the territories · s2 culprit artery, RV and posterior infarction · s3 evolution and subtle occlusion patterns · s4 LBBB and paced rhythms: modified Sgarbossa · s5 mimics and diffuse ischaemia |
| `tox` → tox | t1 potassium · t2 sodium-channel blockade · t3 QT: calcium, drugs, torsades · t4 AV-nodal poisons and digoxin |
| `mgmt` → mgmt | m1 stable or unstable, synchronised or not · m2 regular narrow-complex tachycardia · m3 AF, flutter and pre-excited AF · m4 wide-complex tachycardia · m5 polymorphic VT, torsades, VF, storm · m6 bradycardia and AV block |
| `dev2` → temp / icd / hardware | d1 temporary transvenous pacing · d2 transcutaneous pacing · d3 ICD detection and discriminators · d4 ICD therapy and inappropriate shocks · d5 devices and leads on the film |
