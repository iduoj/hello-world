# EP Simulator

A teaching-first cardiac electrophysiology simulator that runs entirely in the browser.
Open `index.html` (needs a network connection for three.js and fonts), or the single-file
build `dist/ep-simulator-standalone.html`.

Educational tool only — not for clinical decision-making.

## What is in it

| Tab | What you do there |
| --- | --- |
| **Rhythms** | 40 rhythms with a 12-lead, rhythm strips, automatic ladder diagram, calipers, measurements, a synchronised 3D activation map and teaching notes |
| **Localise** | Click the ventricles to launch a beat from that point and read its 12-lead; slide an accessory pathway round either AV ring; compare pacing sites |
| **STEMI / OMI** | Occlusion by artery with a timeline (hyperacute T → ST elevation → Q waves), coronary tree and territory on the 3D heart, subtle occlusion patterns (precordial swirl, de Winter, Aslanger, Wellens, South African flag, posterior), LBBB/paced rhythms with a modified Sgarbossa calculator, mimics, V4R and V7–V9 |
| **Devices** | Single/dual chamber, LBB-area and His pacing, CRT, Micra, AVEIR, transvenous / subcutaneous / extravascular ICD, temporary wire — hardware in 3D, simulated PA and lateral chest films, correct vs malpositioned, with the paced 12-lead |
| **Courses** | Each subject taught from first principles in short units: read the idea, predict, measure or calculate, then do it on a tracing or a live strip. Bench tasks are checked against what the simulation does; unknowns need the diagnosis, the reason and the action. Missed items come back on a spaced schedule. Tracks: pacing and device troubleshooting, arrhythmia mechanisms, localisation, ischaemia, drugs and electrolytes, acute management, temporary pacing / ICD / hardware |
| **Pacemaker** | Programmable device on a simulated patient: marker channel, timing-cycle bars, automatic strip interpretation, fault injection and troubleshooting cases |
| **Temporary pacing** | Transvenous box (rate / mA / mV) and transcutaneous pads: capture and sensing threshold drills with an arterial trace |
| **ICD** | Zones, discriminators, ATP, shocks, inappropriate therapy, electrical storm |
| **Tox & electrolytes** | Hyper/hypokalaemia, calcium, hypothermia, tricyclics and other sodium-channel blockers, digoxin, beta-blocker / calcium-channel blocker overdose, acquired long QT — each with a severity slider |
| **Cases** | Ten scenarios on drugs versus electricity; the monitor responds to each intervention |
| **Assessment** | Fellow-level mixed questions (generated ECG items + written items) across ten domains, with a confidence rating, a gap map and a study plan that links each miss to an exercise and a re-test |

## How it works

One physical model drives everything, so the ECG, the 3D map and the localisation tools agree:
procedural anatomy → voxel conduction model with a Purkinje layer → heart dipole → 12 leads
(Dower), and a discrete-event conduction simulator for rhythm. See `docs/ARCHITECTURE.md`.

## Develop

    node tools/dev_lib.js                 # run every library rhythm, print rates and beat labels
    node tools/shot.mjs index.html a.png  # headless screenshot / smoke test
    node tools/build.mjs                  # bundle to dist/

No dependencies to install; plain scripts under `js/`, styles in `css/app.css`.
