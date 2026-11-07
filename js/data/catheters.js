/* Catheter reference data (diagnostic, radial universal, guides). */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};

  // shape paths are schematic tip curves drawn in a 120x170 box, shaft entering from the top
  CL.data.catheters = [
    { id: 'jl4', name: 'Judkins Left 4 (JL4)', kind: 'Diagnostic', target: 'Left coronary',
      shape: 'M38 0 L38 78 C38 122 92 124 94 86 L94 52 C94 38 78 34 70 44 L64 54',
      use: 'Default for the left coronary from the femoral route. "4" = 4 cm between the primary and secondary curves.',
      tech: 'Advance over the wire to the ascending aorta, remove the wire, and keep advancing slowly. The tip usually "falls into" the LM without torque. If it sits below the LM, pull back gently; if it points up and won’t drop, try a larger or smaller curve rather than forcing it.',
      pitfalls: ['Deep seating in a short LM gives a selective LAD or LCx injection.', 'Watch for damping or ventricularization (ostial LM disease).'] },
    { id: 'jl35', name: 'JL3.5', kind: 'Diagnostic', target: 'Left coronary',
      shape: 'M38 0 L38 84 C38 122 86 124 88 92 L88 66 C88 52 74 48 66 57 L61 65',
      use: 'Small or narrow aortic root, short stature, and the usual first choice from the right radial (one half-size smaller than femoral).',
      tech: 'From the right radial the catheter enters the ascending aorta at a different angle, so a 0.5 cm smaller curve sits better.',
      pitfalls: ['In a dilated root it is too short to span the root: the tip sits low in the sinus and never reaches the LM.'] },
    { id: 'jl5', name: 'JL5 / JL6', kind: 'Diagnostic', target: 'Left coronary',
      shape: 'M38 0 L38 66 C38 118 100 122 102 76 L102 34 C102 20 86 16 78 27 L72 37',
      use: 'Wide or dilated aortic root: unfolded hypertensive aorta, aortic stenosis or regurgitation, elderly patients.',
      tech: 'If a JL4 is too short to span a wide root, its tip sits low in the sinus below the LM. Upsize to JL5 or JL6. The opposite sign, a tip pointing up above the LM ("standing up"), means the curve is too big: downsize.',
      pitfalls: ['In a normal root a JL5 or JL6 points up above the LM and can flip or fold.'] },
    { id: 'jr4', name: 'Judkins Right 4 (JR4)', kind: 'Diagnostic', target: 'Right coronary',
      shape: 'M40 0 L40 104 C40 116 46 122 58 124 L74 126 C84 127 88 120 86 112',
      use: 'Default for the RCA from both femoral and radial access. JR5 for a dilated root.',
      tech: 'Advance to just above the aortic valve with the tip pointing toward the patient’s left. Then rotate clockwise while slowly withdrawing about 1–2 cm. The tip swings anteriorly into the right sinus and drops into the RCA ostium. Stop rotating as soon as it engages, because the stored torque keeps turning it.',
      pitfalls: ['Too much clockwise torque lets the tip jump and dive deep, causing conus spasm, damping or dissection.', 'RCA catheter-induced spasm is common; give IC nitroglycerin and re-image.'] },
    { id: 'al1', name: 'Amplatz Left (AL1–AL3)', kind: 'Diagnostic / guide', target: 'RCA (AL1) or LCA in a large root (AL2–3)',
      shape: 'M36 0 L36 60 C36 112 102 116 100 72 C99 48 82 42 76 52 C73 58 74 66 78 72',
      use: 'RCA with a superior or anterior origin, the LCA in a big root, a posterior LM, or an RCA that needs strong backup during PCI.',
      tech: 'The secondary curve rests on the opposite sinus or valve and the tip is pushed up into the ostium. To disengage, advance slightly or rotate the tip out first. Never just pull back: pulling makes an Amplatz dive deeper.',
      pitfalls: ['Highest dissection risk of the common shapes, especially of the RCA ostium.'] },
    { id: 'mp', name: 'Multipurpose (MP)', kind: 'Diagnostic / guide', target: 'SVG to RCA, inferior take-off',
      shape: 'M40 0 L40 118 C40 130 46 136 58 138',
      use: 'Vein graft to the RCA/PDA with a steep inferior take-off, or a native RCA pointing downward. Also used for LV grams and right heart work.',
      tech: 'Rotate and advance or withdraw to point the angled tip at the ostium.',
      pitfalls: [] },
    { id: 'ima', name: 'Internal mammary (IMA)', kind: 'Diagnostic / guide', target: 'LIMA / RIMA',
      shape: 'M40 0 L40 120 C40 128 44 134 52 136 L60 140',
      use: 'Engaging the LIMA (or RIMA). With a LIMA graft, left radial access is usually easiest. A JR4 or VB-1 also works.',
      tech: 'Advance into the subclavian beyond the IMA origin, then pull back slowly with the tip turned anteriorly and down (counterclockwise) until it drops into the IMA. If you can’t engage it, do a non-selective subclavian injection with a cuff on the arm.',
      pitfalls: ['Subclavian stenosis proximal to the LIMA can cause "steal".'] },
    { id: 'lcb', name: 'Left / Right Coronary Bypass (LCB / RCB)', kind: 'Diagnostic', target: 'Vein grafts',
      shape: 'M40 0 L40 96 C40 116 64 124 78 112 L86 104',
      use: 'SVGs from the anterior ascending aorta. Left-sided grafts: LCB, AL1, JR4 or hockey stick. Right-sided grafts: JR4 or MP.',
      tech: 'Typical SVG ostia sit on the anterior aorta, with RCA grafts lowest and OM grafts highest. If you can’t find the grafts, do an aortogram. Graft markers and the op note help.',
      pitfalls: [] },
    { id: 'tig', name: 'Tiger / TIG (Terumo Optitorque)', kind: 'Radial universal', target: 'Both coronaries',
      shape: 'M40 0 L40 92 C40 118 70 124 84 108 C90 101 90 92 84 88 L78 85',
      use: 'One catheter for both coronaries from the radial (current US sizes 4.0 and 4.5; older Tiger II 3.5–5.0). This saves a catheter exchange and reduces radial spasm.',
      tech: 'LCA: advance into the left cusp; it usually engages with little torque, or gentle counterclockwise. RCA: withdraw slightly, rotate over the valve into the right cusp, then withdraw slowly with clockwise rotation, like a JR.',
      pitfalls: ['Diagnostic only; too little backup to use as a PCI guide.', 'In one RCT, total procedure time was Tiger 9.2 min, Jacky 11.9 min, and two Judkins catheters 12.8 min.'] },
    { id: 'jacky', name: 'Jacky Radial (Terumo Optitorque)', kind: 'Radial universal', target: 'Both coronaries',
      shape: 'M40 0 L40 86 C40 116 76 122 90 104 C96 96 92 86 84 86 L74 88',
      use: 'Another single-catheter radial shape (curve 3.5, 5–6 Fr, two side holes) that reaches both ostia by rotation.',
      tech: 'Engage the LCA from the left cusp, then rotate clockwise and withdraw toward the right cusp for the RCA, like the Tiger.',
      pitfalls: ['Side holes can hide damping: the pressure looks fine while the tip is wedged. Watch the contrast run-off.', 'Drawing here is schematic; manufacturer curve geometry not reproduced.'] },
    { id: 'ebu', name: 'Extra backup (EBU / XB / Voda)', kind: 'Guide', target: 'Left coronary PCI',
      shape: 'M38 0 L38 70 C38 120 98 126 98 80 L98 70 C98 60 92 54 84 52 L72 50',
      use: 'Workhorse LCA guide. Its long secondary curve leans on the opposite (contralateral) aortic wall, which gives far more passive support than a JL. Femoral, normal root: EBU 3.75–4.0. Radial: about 3.5. Large root: 4.0–4.5.',
      tech: 'Advance over a wire into the root. The tip often engages the LM on its own as the wire is withdrawn; rotate gently to point it toward the LAD or LCx.',
      pitfalls: ['Can deep-seat in a short LM, and its coaxial position favors the LCx. Watch the pressure.'] },
    { id: 'jl4g', name: 'JL4 guide', kind: 'Guide', target: 'Left coronary PCI',
      shape: 'M38 0 L38 78 C38 122 92 124 94 86 L94 52 C94 38 78 34 70 44 L64 54',
      use: 'Easy, coaxial LCA guide for simple PCI when you don’t need much support.',
      tech: 'Same as the diagnostic JL. For more support, upgrade to an EBU or add a guide extension.',
      pitfalls: ['It backs out under load when pushing stents through calcified or tortuous vessels.'] },
    { id: 'jr4g', name: 'JR4 guide', kind: 'Guide', target: 'RCA PCI',
      shape: 'M40 0 L40 104 C40 116 46 122 58 124 L74 126 C84 127 88 120 86 112',
      use: 'RCA with a normal, horizontal take-off and simple lesions.',
      tech: 'Same as the diagnostic JR. For support, an AL1 or a guide extension.',
      pitfalls: [] },
    { id: 'alg', name: 'AL / AR / Hockey stick guides', kind: 'Guide', target: 'RCA PCI with support or unusual take-off',
      shape: 'M36 0 L36 60 C36 112 102 116 100 72 C99 48 82 42 76 52 C73 58 74 66 78 72',
      use: 'AL1–AL2 for strong RCA backup (calcified, tortuous, CTO). AR or hockey stick for a superior RCA take-off. IMA or AL for a "shepherd’s crook" RCA from the radial.',
      tech: 'Disengage carefully: advance or rotate out first, then withdraw.',
      pitfalls: ['High ostial dissection risk with Amplatz guides.'] },
  ];

  CL.data.frenchTable = [
    { fr: '5 Fr', od: '≈1.67 mm', fits: 'Diagnostics; simple PCI with a single balloon or stent. Kissing balloons are not possible.' },
    { fr: '6 Fr', od: '≈2.0 mm', fits: 'Most PCI, including kissing balloons, provisional, culotte and DK crush (sequential). Rotablator up to about 1.5 mm (1.75 mm "with friction").' },
    { fr: '7 Fr', od: '≈2.33 mm', fits: 'Simultaneous kissing stents (some), 1.75 mm burr, more support and room for complex devices.' },
    { fr: '8 Fr', od: '≈2.67 mm', fits: 'SKS or V-stenting, 2.0 mm burr, large-bore support.' },
  ];

  CL.data.catheterSelector = function (o) {
    // o: { access, root, target, takeoff, need }
    const out = { diag: [], guide: [], notes: [] };
    const rad = o.access === 'rradial';
    const lrad = o.access === 'lradial';
    const sizeAdj = o.root === 'small' ? -0.5 : o.root === 'dilated' ? (o.access === 'femoral' ? 1 : 0.5) : 0;
    const jl = Math.max(3.5, (rad ? 3.5 : 4) + sizeAdj);
    const jlName = 'JL' + (jl % 1 === 0 ? jl.toFixed(0) : jl.toFixed(1));
    if (o.target === 'both' || o.target === 'lca') {
      if (rad || lrad) out.diag.push('TIG (Tiger) or Jacky for both coronaries with one catheter, or ' + jlName + ' for the left');
      else out.diag.push(jlName + ' for the left coronary');
      out.guide.push('EBU / XB ' + (rad ? '3.5' : o.root === 'dilated' ? '4.0–4.5' : o.root === 'small' ? '3.5' : '3.75–4.0') + ' for left PCI support (or ' + jlName + ' guide for simple lesions)');
    }
    if (o.target === 'both' || o.target === 'rca') {
      if (o.takeoff === 'superior') {
        out.diag.push('AL1 or hockey stick (also AR) for a superior or anterior RCA origin');
        out.guide.push('AL1, AR or hockey stick guide for a superior take-off');
      } else if (o.takeoff === 'inferior') {
        out.diag.push('Multipurpose (MP) or JR4 for an RCA pointing downward');
        out.guide.push('MP or JR4 guide; AL1 if more support is needed');
      } else if (o.takeoff === 'shepherd') {
        out.diag.push('JR4 often engages; AL1 seats better');
        out.guide.push('AL1 or IMA guide for a shepherd’s crook RCA (an AL gives the most support)');
      } else {
        out.diag.push(o.root === 'dilated' ? 'JR5 (or AL1) for the RCA in a dilated root' : 'JR4 for the RCA');
        out.guide.push(o.need === 'support' ? 'AL1 (or AL0.75 in a small root) for strong RCA support' : 'JR4 guide for a normal take-off');
      }
    }
    if (o.target === 'grafts') {
      out.diag.push(lrad ? 'Left radial: JR4 or IMA for the LIMA, plus JR4, AL1 or MP for the SVGs' : 'IMA catheter (or JR4 / VB-1) for the LIMA; JR4, LCB, AL1 or MP for the SVGs');
      out.notes.push('With a LIMA graft, the left radial reaches it easily. From the right radial it is often difficult.');
      out.guide.push('SVG PCI: JR4, MP or AL guides; use an embolic protection device when feasible');
    }
    if (o.need === 'support' && o.target !== 'grafts') out.notes.push('Need more backup? Go to an extra-backup or Amplatz shape, upsize the guide, use a buddy wire or anchor balloon, or add a guide extension (GuideLiner or Telescope, which costs about 1 Fr of lumen).');
    if (rad) out.notes.push('Right radial: give heparin (≥5000 U or 50 U/kg) plus a vasodilator (verapamil 2.5–5 mg and/or NTG 100–200 µg) unless contraindicated. Choose curves about 0.5 smaller for the LCA.');
    if (o.root === 'dilated') out.notes.push('Wide root: a JL4 is too short to span it. The tip sits low in the sinus below the LM, so upsize (JL5 or JL6).');
    if (o.root === 'small') out.notes.push('Small root: a JL4 is too long. It angles steeply and the tip points up above the LM ("stands up"), so downsize to JL3.5.');
    return out;
  };

  CL.data.catheterRefs = [
    { t: 'EuroIntervention: Tools & techniques — choice and use of guiding catheters', url: 'https://eurointervention.pcronline.com/article/tools-and-techniques-choice-and-use-of-guiding-catheters' },
    { t: 'Terumo Optitorque (Tiger, Jacky, Sarah) product information', url: 'https://terumois.com/products/catheters/optitorque.html' },
    { t: 'Cardiac Interventions Today: radial catheter selection', url: 'https://citoday.com/articles/2011-mar-apr/radial-catheter-selection' },
    { t: 'Kane et al., JSCAI 2022: Tiger vs Jacky vs Judkins RCT', url: 'https://experts.umn.edu/en/publications/a-comparison-of-three-commonly-used-catheter-strategies-in-diagno/' },
    { t: 'JUDGE trial: Tiger II vs Judkins', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5749733/' },
    { t: 'SCAI tips & tricks: saphenous vein graft intervention', url: 'https://scai.org/tips-and-tricks-saphenous-vein-graft-intervention' },
    { t: 'European expert consensus on rotational atherectomy (burr/guide sizes)', url: 'https://eurointervention.pcronline.com/article/european-expert-consensus-on-rotational-atherectomy' },
    { t: 'Twente GuideLiner registry', url: 'https://eurointervention.pcronline.com/article/usefulness-and-safety-of-the-guideliner-catheter-to-enhance-intubation-and-support-of-guide-catheters-insights-from-the-twente-guideliner-registry' },
  ];
})();
