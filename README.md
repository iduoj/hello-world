# Cath Lab Atlas

An interactive study atlas for coronary anatomy, left heart catheterization and PCI, built for visual learners.

Everything runs in the browser with no build step and no server code. Open `index.html` and it works offline too: Three.js is vendored in `vendor/`.

## What's inside

| Tab | What you can do |
| --- | --- |
| **3D Anatomy** | Rotate a 3D heart with the full coronary tree and tap any vessel for its SYNTAX segment definition (where proximal ends and mid begins), territory, ECG pattern and best views. Switch right, left or codominant circulation, add a ramus, and overlay the "circle and loop". |
| **Angio Views** | A virtual C-arm. Swing LAO/RAO and cranial/caudal, load the standard projections, inject contrast (femoral or radial catheter), drop a lesion into any segment and set TIMI 0–3 flow. Includes a "Name that view" drill. |
| **Catheters** | Catheter picker by access, aortic root, target and RCA take-off. Simulators show JL sizing in the aortic root and the JR clockwise engagement. Covers JL/JR/AL/MP/IMA/LCB, Tiger and Jacky, EBU guides and French sizes. |
| **Drugs** | Radial cocktail, IC nitroglycerin, no-reflow agents (adenosine, verapamil, nicardipine, nitroprusside, epinephrine), hyperemia, ACT targets, protamine and rescue drugs, plus scenario walkthroughs. |
| **FFR / iFR** | Live Pa/Pd tracings driven by a stenosis model, with adenosine, the wave-free window, and pitfalls (damping, drift, microvascular disease). A serial-lesion pullback, cut-offs and the trials. |
| **ECG + Echo** | Pick a culprit and see the generated 12-lead (hyperacute, acute or evolved; V4R and V7–V9), animated echo views (PLAX, PSAX, A4C, A2C, A3C), the 17-segment bull's-eye and the expected complications. Jump to the same lesion on angiography. |
| **IVUS** | 15 simulated cross-sections built from tissue physics: plaque types, calcium shadowing, stent apposition and expansion, edge dissection, intramural hematoma, perforation, aneurysm, thrombus and ISR. Each comes with measurements and indications. |
| **Stent Sizing** | Drag landing zones on a pullback and compare EEM-based, lumen-based and angiographic sizing. A post-stent optimization checklist (EAPCI, ULTIMATE, IVUS-XPL, LM 5-6-7-8) and a Finet's-law calculator. |
| **Bifurcation** | Medina classifier, DEFINITION criteria, and step-by-step drawings of provisional, T/TAP, culotte, classic crush, mini-crush, DK crush and SKS. Ostial techniques and the key trials. |
| **CICU Cases** | Ten time-stamped, branching scenarios with a live bedside monitor (ECG, arterial line with IABP, Impella or ECMO waveforms, pleth, PA and wedge with V waves) and Swan numbers (CPO, PAPi). Each decision is graded best / reasonable / not recommended / harmful, with the trial or guideline behind it; you can retry any decision. Cases: STEMI cardiogenic shock, RV infarct with complete heart block, papillary muscle rupture, VSR, free-wall rupture, decompensated AS, post-MI HFrEF (beta-blocker timing, MRA, LV thrombus, ICD timing), VT storm, type A dissection presenting as STEMI, high-risk PE. Plus reference tables for shock profiles, SCAI stages, vasoactive drugs and MCS devices. |
| **Quiz** | About 45 board-style questions with explanations, plus "name the culprit" from a generated 12-lead. |

## Run it

- **Quickest:** open `index.html` in a browser.
- **Local server (optional):** `python3 -m http.server` in this folder, then open http://localhost:8000.
- **GitHub Pages:** Settings → Pages → deploy from branch → `/ (root)`.
- **One self-contained file:** `python3 tools/build.py` writes `dist/cath-lab-atlas.html`, with all CSS, JS and Three.js inlined, so you can share it or open it on a phone.

## Accuracy and sources

The content was checked against guidelines, consensus documents and trials. Each tab has a **Sources** list, and [`docs/SOURCES.md`](docs/SOURCES.md) records what was verified, where sources disagree, and what still needs a second look.

All images (angiograms, ECGs, echo, IVUS) are schematic simulations generated in code, not patient data. Doses and thresholds are typical values for study purposes. Always follow your lab's protocols and your attending's plan.

## Code map

```
index.html            app shell (tabs + script order)
css/styles.css        design tokens (light/dark), layout, components
js/core.js            DOM helpers, router, event bus, safe storage
js/data/*.js          content: segments, views, catheters, drugs, culprits, IVUS text, bifurcation steps, quiz
js/modules/heart3d.js Three.js engine: parametric heart, coronary tree, fluoro shading, dye/TIMI, C-arm camera
js/modules/*.js       one file per tab (anatomy, views, catheters, drugs, physiology, ecg, echo, territories, ivus, stents, bifurcation, cicu, quiz)
js/modules/monitor.js bedside monitor (rhythms, arterial line incl. IABP/Impella/ECMO, pleth, PA/wedge)
js/data/cicu*.js      CICU reference tables and branching cases
tools/build.py        bundles everything into a single HTML file
vendor/three.min.js   Three.js r128 (MIT)
```

Geometry notes: the world frame is +X = patient's left, +Y = head, +Z = anterior. The C-arm angle is LAO-positive and cranial-positive. The image is displayed as the detector sees it, so the spine falls on the image right in LAO and the image left in RAO, as in a real lab.
