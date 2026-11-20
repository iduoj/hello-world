# ValvEcho

A zero-dependency web app for the **echocardiographic assessment of native valvular heart disease**.
Enter measurements and the app grades severity with a multi-parameter, guideline-based approach.
It flags discordant data, suggests ACC/AHA staging and management considerations, and produces copyable report text.

Open `index.html` in a browser (or run `npm start` and visit http://localhost:8000).

## Lesions covered

| Tab | What it does |
| --- | --- |
| **Aortic stenosis** | Vmax, mean gradient, AVA (direct or continuity), AVAi, DVI, SVi. Classifies high-gradient, classical low-flow/low-gradient (with DSE result) and paradoxical low-flow/low-gradient AS, with sex-specific CT calcium-score adjudication. Stages A–D3. |
| **Mitral stenosis** | MVA by planimetry or PHT (220/PHT), mean gradient with heart rate, PASP, Wilkins score and PMBC suitability. |
| **Aortic regurgitation** | VC, jet/LVOT ratio, PHT, EROA, RVol, RF, plus aortic flow reversal and LV size; LVESD/LVESDi/LVEF surgical triggers. |
| **Mitral regurgitation** | VC, PISA EROA, RVol, RF, plus morphology, jet, CW, pulmonary vein and inflow signs. Separate primary vs secondary management. |
| **Tricuspid regurgitation** | Extended grading to massive/torrential (VC, EROA, RVol), PISA radius, hepatic vein flow. |
| **Calculators** | Continuity equation, Bernoulli/PASP, PISA, volumetric RF, PHT→MVA. |
| **Reference** | Threshold tables. |

Each lesion tab opens with a schematic **echo screen**: a 2D sector with colour Doppler and a spectral Doppler strip, drawn from the entered values (valve opening, jet size, PISA, envelope shape, pressure half-time slope, venous flow patterns). The screen beats through the cardiac cycle (Freeze/Play) with a sweep cursor on the Doppler strip. Measuring tools work on the screen like a machine's calc package: calipers on the 2D image (LVOT diameter, vena contracta, PISA radius) and velocity points, pressure half-time slopes and envelope traces on the spectral strip. Each measurement is graded against the severity thresholds, compared with the entered value, and can be written into the form with **Use this value**. It is an illustration, not a real image; values not entered use typical figures and are marked `*`.

Each regurgitation tab includes a PISA helper that computes EROA, RVol and RF and fills them in for you.

## Integration logic (regurgitation)

- Quantitative parameters (EROA, RVol, RF) carry the most weight. Their median sets the grade.
- With no quantitative data, the grade comes from vena contracta plus supportive signs. Two or more specific signs of severity (e.g. flail leaflet, systolic pulmonary/hepatic vein reversal, holodiastolic aortic reversal) establish a severe grade.
- When parameters span two or more grades, or specific signs contradict the grade, the result is flagged **discordant**. Confidence is reported as High, Moderate or Low.
- Moderate MR/AR is sub-graded as mild-to-moderate or moderate-to-severe.

## Sources

- Zoghbi WA et al. ASE 2017 Recommendations for Noninvasive Evaluation of Native Valvular Regurgitation.
- Baumgartner H et al. ASE/EACVI 2017 Focused Update on Echocardiographic Assessment of Aortic Valve Stenosis.
- Baumgartner H et al. EAE/ASE 2009 Echocardiographic Assessment of Valve Stenosis.
- Otto CM et al. 2020 ACC/AHA Guideline for the Management of Patients With Valvular Heart Disease.
- Hahn RT, Zamorano JL. The need for a new tricuspid regurgitation grading scheme. EHJ-CVI 2017.

## Development

```bash
npm test
```

All grading logic lives in `js/valve-logic.js` (pure functions, browser + Node). The UI is in `js/app.js`.

> **Decision support only.** This is not a medical device. Interpret all output in light of image quality, the clinical context and other imaging.
