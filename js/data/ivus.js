/* IVUS teaching content: cases (text), indications, thresholds, optimization criteria. */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};

  CL.data.ivusText = {
    normal: { group: 'Vessel and plaque', title: 'Normal three-layer wall',
      see: 'Bright thin intima, dark (sonolucent) media and bright, speckled adventitia. The media–adventitia border is the EEM, the vessel’s outer boundary on IVUS.',
      why: 'The EEM lets IVUS size the true vessel (EEM diameter) even through plaque. Young normal arteries can look single-layered.' },
    fibrous: { group: 'Vessel and plaque', title: 'Fibrous plaque (eccentric)',
      see: 'Intermediate-brightness plaque between lumen and media, thicker on one side. Very dense fibrous tissue can cast a gradually fading shadow.',
      why: 'Plaque burden = (EEM − lumen) ÷ EEM. Landing a stent edge where plaque burden is ≥50% increases edge restenosis and dissection.' },
    soft: { group: 'Vessel and plaque', title: 'Soft (fibrofatty / lipid-rich) plaque',
      see: 'Plaque darker than the adventitia, covered by a thin brighter fibrous cap.',
      why: 'Lipid-rich plaque is vulnerable. Avoid landing stent edges in it; it is linked to distal embolization.' },
    calcium: { group: 'Vessel and plaque', title: 'Superficial calcium with shadow',
      see: 'Very bright leading edge with a sharp acoustic shadow behind it (you can’t see the EEM there) and evenly spaced reverberation arcs. Report the arc in degrees and the length.',
      why: 'Large calcium arcs (>180–270°), thick or long calcium, and calcified nodules predict stent underexpansion. Plan lesion preparation: NC or cutting/scoring balloon, intravascular lithotripsy or atherectomy.' },
    attenuated: { group: 'Vessel and plaque', title: 'Attenuated plaque (no calcium)',
      see: 'Plaque with deep signal loss behind it but no bright calcium surface. The shadow starts within dark plaque.',
      why: 'Marks a lipid-rich necrotic core or thrombus. High risk of no-reflow and periprocedural MI, so consider distal protection or direct stenting, and have no-reflow drugs ready.' },
    stenosis: { group: 'Vessel and plaque', title: 'Severe stenosis: minimal lumen area',
      see: 'Small, eccentric lumen surrounded by heavy plaque (plaque burden ~80%). Trace the lumen and EEM at the frame with the smallest lumen.',
      why: 'LM: MLA <6 mm² (Western; LITRO showed deferral is safe at ≥6) or about 4.5–4.8 mm² (Asian) suggests a significant lesion. Non-LM: a 4 mm² cut-off predicts FFR poorly (AUC ≈0.56–0.65), so use physiology instead.' },
    stent: { group: 'Stent result', title: 'Well-expanded, well-apposed stent',
      see: 'Bright struts with small shadows, evenly spaced on a round lumen and all touching the vessel wall. The stent area closely matches the reference.',
      why: 'Goals (non-LM): MSA >5.5 mm² (IVUS) or >80–90% of the reference lumen area; no edge dissection involving the media; edges landed in plaque burden <50%.' },
    malapposition: { group: 'Stent result', title: 'Malapposed stent',
      see: 'Struts are not touching the wall: blood speckle sits between the struts and the vessel surface over part of the circumference. Measure the strut-to-wall distance.',
      why: 'The stent is too small for the vessel (or the vessel is bigger there). Fix: post-dilate with a larger-diameter balloon at moderate pressure. Small acute malapposition (<0.4 mm, <1 mm long) can usually be left alone.' },
    underexpansion: { group: 'Stent result', title: 'Underexpanded stent',
      see: 'Struts are against the wall all the way around (apposed) but the stent is small and oval, here over a calcium arc. The MSA is well below the reference.',
      why: 'Underexpansion is the strongest IVUS predictor of restenosis and stent thrombosis. Fix: high-pressure non-compliant balloon sized to the reference, or lithotripsy for calcium. A bigger balloon at low pressure won’t help.' },
    dissection: { group: 'Complications', title: 'Edge dissection',
      see: 'A thin flap of intima and plaque separated from the wall, with blood (a false channel) behind it, just beyond the stent edge.',
      why: 'Treat with another stent if it involves the media, spans ≥60° of arc or is ≥3 mm long, especially at the distal edge. Minor intimal tears can be left alone.' },
    hematoma: { group: 'Complications', title: 'Intramural hematoma',
      see: 'A homogeneous crescent within the media that pushes the lumen inward and the EEM outward. It is often brighter than plaque, with no flow inside and often no visible entry point.',
      why: 'It can propagate and compress the lumen. Seal the entry, usually the proximal edge, with a stent and avoid further pressurized injections.' },
    perforation: { group: 'Complications', title: 'Perforation',
      see: 'A break through the EEM with blood continuous from the lumen to an echolucent space outside the vessel.',
      why: 'Inflate a balloon to tamponade, check echo for effusion, then use a covered stent, coils or protamine as appropriate. Ellis I: crater; II: blush; III: jet (≥1 mm hole), with tamponade in ≈46%.' },
    aneurysm: { group: 'Complications', title: 'Coronary aneurysm',
      see: 'A lumen far larger than the reference, with all three layers intact around the wall.',
      why: 'True aneurysm: intact layers and a maximum lumen area >50% larger than the proximal reference. Pseudoaneurysm: loss of wall integrity. Only about a quarter of angiographic "aneurysms" are true aneurysms on IVUS.' },
    thrombus: { group: 'Complications', title: 'Thrombus',
      see: 'An intraluminal, lobulated mass with sparkling (scintillating) speckle that shifts frame to frame, separate from the wall plaque.',
      why: 'Thrombus raises the risk of no-reflow and distal embolization. Consider aspiration and antithrombotics. Grayscale IVUS can’t always tell thrombus from soft plaque.' },
    isr: { group: 'Stent failure', title: 'In-stent restenosis',
      see: 'Struts of a well-expanded stent with tissue growing inside them. Neointima is often dark with DES.',
      why: 'IVUS sorts out the mechanism: neointimal hyperplasia (stent big enough, tissue inside) vs underexpansion (small stent area) vs edge restenosis or neoatherosclerosis. The treatment differs for each.' },
  };

  CL.data.ivusIndications = [
    { k: '2024 ESC chronic coronary syndromes', v: 'IVUS or OCT guidance for complex PCI, in particular LM, true bifurcations and long lesions: Class I, Level A. Imaging to assess intermediate LM stenosis: IIa.' },
    { k: '2021 ACC/AHA/SCAI revascularization', v: 'IVUS for stent guidance, especially LM or complex stenting: 2a (B-R). IVUS or OCT to find the mechanism of stent failure: 2a (C). IVUS for intermediate LM disease: 2a.' },
    { k: '2025 ACC/AHA ACS', v: 'Intravascular imaging to guide PCI of LM or complex lesions: Class 1 (as reported in secondary summaries).' },
    { k: 'EAPCI 2018 consensus', v: 'Routine imaging for restenosis and stent thrombosis. Also: ambiguous angiography (haziness, suspected dissection or aneurysm), CTO (proximal cap ambiguity, confirming true-lumen re-entry), ostial lesions, and contrast-sparing PCI in CKD.' },
    { k: 'Evidence', v: 'ULTIMATE (TVF 2.9% vs 5.4% at 1 year), IVUS-XPL (5-year MACE 5.6% vs 10.7%), RENOVATE-COMPLEX-PCI (TVF 7.7% vs 12.3%). In 2026, IVUS-CHIP and OPTIMAL were neutral for IVUS guidance, so expect guideline language to keep evolving.' },
  ];

  CL.data.ivusCriteria = [
    { k: 'Stent expansion (non-LM)', v: 'MSA >5.5 mm² by IVUS (>4.5 by OCT), or MSA ≥80–90% of the reference lumen area. ULTIMATE "optimal": MSA >5.0 mm² or ≥90% of the distal reference lumen area.' },
    { k: 'Left main ("5-6-7-8")', v: 'Kang (Korean cohort): LCx ostium 5, LAD ostium 6, polygon of confluence 7, proximal LM 8 mm². Western data give larger values, and EXCEL suggested an LM MSA around 9.8 mm².' },
    { k: 'Edges', v: 'Plaque burden <50% within 5 mm of each edge. No edge dissection involving the media ≥60° of arc or ≥3 mm long.' },
    { k: 'Apposition', v: 'Correct malapposition >0.4 mm extending >1 mm in length (OCT-derived). Smaller acute malapposition often resolves.' },
    { k: 'Lesion significance', v: 'LM MLA <6 mm² (Western) or <4.5–4.8 mm² (Asian). Non-LM MLA is a poor surrogate for ischemia, so use FFR/iFR.' },
  ];

  CL.data.ivusArtifacts = [
    { k: 'Ring-down', v: 'Bright halo around the catheter that hides the near field. Phased-array systems partly subtract it.' },
    { k: 'Guidewire artifact', v: 'Bright dot with a shadow behind it. Mechanical (rotational) catheters run the wire beside the transducer.' },
    { k: 'NURD', v: 'Non-uniform rotational distortion. The drive cable binds in tortuous vessels or tight guides, smearing a wedge of the image (mechanical catheters only).' },
    { k: 'Blood speckle', v: 'Bright, moving speckle in slow-flow or high-frequency imaging that blurs the lumen border. Flush saline to clear it.' },
  ];

  CL.data.ivusRefs = [
    { t: 'Räber L et al. Clinical use of intracoronary imaging, Part 1 (EAPCI consensus). EuroIntervention 2018', url: 'https://eurointervention.pcronline.com/article/clinical-use-of-intracoronary-imaging-part-1-guidance-and-optimization-of-coronary-interventions-an-expert-consensus-document-of-the-european-association-of-percutaneous-cardiovascular-interventions' },
    { t: 'Mintz GS et al. ACC IVUS standards (acquisition, measurement, reporting). JACC 2001;37:1478' },
    { t: 'ESC 2024 CCS guidelines summary — PCRonline', url: 'https://www.pcronline.com/News/Congress-coverages/ESC/2024/ESC-CCS-Guidelines' },
    { t: '2021 ACC/AHA/SCAI revascularization guideline (full text)', url: 'https://www.phri.ca/wp-content/uploads/2021/12/ACC_AHA_SCAI-Coronary-Revascularization-Guideline.-JACC.pdf' },
    { t: 'ULTIMATE trial — WikiJournalClub', url: 'https://www.wikijournalclub.org/wiki/ULTIMATE' },
    { t: 'IVUS optimization targets — EuroIntervention', url: 'https://eurointervention.pcronline.com/article/ivus-for-guidance-of-coronary-interventions-applying-optimisation-targets-to-improve-clinical-outcomes' },
    { t: 'Evolving cut-off values for left main stenting with imaging — EuroIntervention', url: 'https://eurointervention.pcronline.com/article/evolving-cutoff-values-for-optimising-left-main-stenting-with-intravascular-imaging' },
    { t: 'SCAI: Practical aspects of IVUS-guided PCI', url: 'https://scai.org/practical-aspects-ivus-guided-percutaneous-coronary-intervention' },
    { t: 'IVUS-CHIP and OPTIMAL (ACC.26) — CI Today', url: 'https://c4v8.citoday.com/news/IVUS-CHIP-and-OPTIMAL-Studies-Probe-Role-of-IVUS-in-Complex-PCI-and-Left-Main-Disease' },
    { t: 'StatPearls: Coronary artery perforation (Ellis classification)', url: 'https://www.statpearls.com/point-of-care/20013' },
  ];
})();
