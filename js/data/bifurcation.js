/* Bifurcation techniques as drawable step sequences.
   Drawing vocabulary (see modules/bifurcation.js):
   wires: 'mv' main-vessel wire, 'sb' side-branch wire, 'sbJ' side-branch wire jailed behind an MV stent, 'sbX' wire recrossed through MV stent struts, 'mvX' MV wire recrossed through SB stent struts
   balloons: 'pre' MV pre-dilation, 'pot' proximal optimization, 'mvKiss' + 'sbKiss' kissing pair, 'sbOpen' SB balloon through struts, 'mvCrush' MV balloon crushing SB stent, 'mvSKS' + 'sbSKS'
   stents: { k: 'mv' | 'sb' | 'culotteSB' | 'culotteMV' | 'sksMV' | 'sksSB', id: 1|2, protrude: mm, crushed: bool } */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};

  CL.data.bifTechniques = [
    { id: 'provisional', name: 'Provisional', when: 'The default for most bifurcations (including most LM) when the side branch is not severely and extensively diseased. EBC MAIN found no advantage for planned dual stenting in the LM.',
      steps: [
        { t: 'Wire both branches. The SB wire protects the branch and marks it if it closes.', wires: ['mv', 'sb'] },
        { t: 'Prepare the main vessel (pre-dilate). Prepare the SB only if it is severely diseased.', wires: ['mv', 'sb'], balloons: ['pre'] },
        { t: 'Stent the MV across the SB origin, sized to the DISTAL main vessel. The SB wire is now "jailed" behind the stent.', wires: ['mv', 'sbJ'], stents: [{ k: 'mv', id: 1 }] },
        { t: 'POT: inflate a short NC balloon sized to the PROXIMAL main vessel, with its distal marker just proximal to the carina. This restores the proximal stent to the right size and opens the struts facing the SB.', wires: ['mv', 'sbJ'], stents: [{ k: 'mv', id: 1 }], balloons: ['pot'] },
        { t: 'Check the SB. If flow is TIMI 3 without a severe pinch or dissection, you’re done. Otherwise rewire the SB through a DISTAL strut, then pull the jailed wire.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }] },
        { t: 'Kissing balloon inflation (or POT–side–POT), then a final POT to correct proximal distortion.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }], balloons: ['mvKiss', 'sbKiss'] },
        { t: 'Bail-out if the SB is still compromised (dissection, TIMI <3): stent it with TAP or T, or convert to culotte.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }, { k: 'sb', id: 2, protrude: 1.5 }] },
      ] },
    { id: 'tap', name: 'T and TAP', when: 'Bail-out after provisional, or planned when the bifurcation angle is wide (near 90°). TAP (T and small protrusion) leaves 1–2 mm of SB stent in the MV so the ostium is fully covered.',
      steps: [
        { t: 'Provisional MV stent with POT is already in place. Rewire the SB through a distal strut and open the struts.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }], balloons: ['sbOpen'] },
        { t: 'Position the SB stent at the ostium. For TAP, let it protrude 1–2 mm into the MV, with an uninflated balloon waiting in the MV.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }, { k: 'sb', id: 2, protrude: 1.5 }], balloons: ['mvWait'] },
        { t: 'Deploy the SB stent. Pure T-stenting aims for exact ostial placement with no protrusion, which risks a gap at the ostium.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }, { k: 'sb', id: 2, protrude: 1.5 }] },
        { t: 'Final kissing: the SB stent balloon plus the MV balloon create a short single-layer neocarina.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }, { k: 'sb', id: 2, protrude: 1.5 }], balloons: ['mvKiss', 'sbKiss'] },
        { t: 'Final POT and imaging to confirm full ostial coverage and expansion.', wires: ['mv', 'sbX'], stents: [{ k: 'mv', id: 1 }, { k: 'sb', id: 2, protrude: 1.5 }], balloons: ['pot'] },
      ] },
    { id: 'culotte', name: 'Culotte', when: 'Both branches similar in size, usually with a narrow angle. It gives complete ostial coverage, at the cost of two layers of metal in the proximal MV. Fits a 6 Fr guide.',
      steps: [
        { t: 'Wire both branches and prepare both.', wires: ['mv', 'sb'] },
        { t: 'Stent the more angulated branch (usually the SB) from the SB into the proximal main vessel.', wires: ['mv', 'sb'], stents: [{ k: 'culotteSB', id: 2 }] },
        { t: 'Rewire the distal MV through the SB stent struts and dilate the struts toward the MV.', wires: ['mvX', 'sb'], stents: [{ k: 'culotteSB', id: 2 }], balloons: ['mvOpen'] },
        { t: 'Stent the MV from the proximal MV into the distal MV, overlapping the first stent proximally (the "trouser legs").', wires: ['mvX', 'sb'], stents: [{ k: 'culotteSB', id: 2 }, { k: 'culotteMV', id: 1 }] },
        { t: 'Rewire the SB through the MV stent, do a kissing inflation, then a final POT.', wires: ['mvX', 'sbX'], stents: [{ k: 'culotteSB', id: 2 }, { k: 'culotteMV', id: 1 }], balloons: ['mvKiss', 'sbKiss'] },
      ] },
    { id: 'crush', name: 'Classic crush', when: 'Older planned two-stent technique: the SB stent protrudes 3–5 mm and the MV stent crushes it. It leaves three layers of metal at the carina; the final kiss is mandatory. Largely replaced by mini-crush and DK crush.',
      steps: [
        { t: 'Wire both branches. Position the MV stent (not yet deployed) and the SB stent, with the SB stent protruding 3–5 mm into the MV.', wires: ['mv', 'sb'], stents: [{ k: 'sb', id: 2, protrude: 4 }], balloons: ['mvWait'] },
        { t: 'Deploy the SB stent, then remove the SB balloon and wire.', wires: ['mv'], stents: [{ k: 'sb', id: 2, protrude: 4 }], balloons: ['mvWait'] },
        { t: 'Deploy the MV stent. It crushes the protruding SB stent flat against the MV wall.', wires: ['mv'], stents: [{ k: 'sb', id: 2, protrude: 4, crushed: true }, { k: 'mv', id: 1 }] },
        { t: 'Rewire the SB through the crushed layers, dilate the SB at high pressure, then do the final kissing and POT.', wires: ['mv', 'sbX'], stents: [{ k: 'sb', id: 2, protrude: 4, crushed: true }, { k: 'mv', id: 1 }], balloons: ['mvKiss', 'sbKiss'] },
      ] },
    { id: 'minicrush', name: 'Mini-crush', when: 'Crush with only 1–2 mm of SB stent protrusion. Less metal and easier SB rewiring. Step crush is the 6 Fr version: the SB stent is crushed with a balloon before the MV stent goes in.',
      steps: [
        { t: 'Position the SB stent with 1–2 mm protrusion and a balloon or stent in the MV.', wires: ['mv', 'sb'], stents: [{ k: 'sb', id: 2, protrude: 1.5 }], balloons: ['mvWait'] },
        { t: 'Deploy the SB stent; withdraw the SB balloon and wire.', wires: ['mv'], stents: [{ k: 'sb', id: 2, protrude: 1.5 }], balloons: ['mvWait'] },
        { t: 'Deploy the MV stent, crushing the short protrusion.', wires: ['mv'], stents: [{ k: 'sb', id: 2, protrude: 1.5, crushed: true }, { k: 'mv', id: 1 }] },
        { t: 'Rewire the SB, then final kissing and POT.', wires: ['mv', 'sbX'], stents: [{ k: 'sb', id: 2, protrude: 1.5, crushed: true }, { k: 'mv', id: 1 }], balloons: ['mvKiss', 'sbKiss'] },
      ] },
    { id: 'dkcrush', name: 'DK crush (double kissing)', when: 'The best-supported planned two-stent technique for complex bifurcations (DEFINITION II) and distal LM disease (DKCRUSH-V). The first kiss after the balloon crush makes the final SB rewiring and kiss far more reliable.',
      steps: [
        { t: 'Wire both and prepare both branches. Stent the SB with 1–2 mm protrusion into the MV.', wires: ['mv', 'sb'], stents: [{ k: 'sb', id: 2, protrude: 1.5 }] },
        { t: 'Remove the SB wire. Balloon-crush the protruding SB stent with an MV balloon (the first "crush").', wires: ['mv'], stents: [{ k: 'sb', id: 2, protrude: 1.5, crushed: true }], balloons: ['mvCrush'] },
        { t: 'Rewire the SB through the struts of the balloon-crushed SB stent, then do the FIRST kiss. Check that the wire is in the true lumen and not behind the struts.', wires: ['mv', 'sbX'], stents: [{ k: 'sb', id: 2, protrude: 1.5, crushed: true }], balloons: ['mvKiss', 'sbKiss'] },
        { t: 'Remove the SB wire. Stent the main vessel, then POT.', wires: ['mv'], stents: [{ k: 'sb', id: 2, protrude: 1.5, crushed: true }, { k: 'mv', id: 1 }], balloons: ['pot'] },
        { t: 'Rewire the SB again and do the SECOND (final) kiss, then a final POT. Image to confirm expansion of both ostia.', wires: ['mv', 'sbX'], stents: [{ k: 'sb', id: 2, protrude: 1.5, crushed: true }, { k: 'mv', id: 1 }], balloons: ['mvKiss', 'sbKiss'] },
      ] },
    { id: 'sks', name: 'V-stent / SKS', when: 'Simultaneous kissing stents: for Medina 0,1,1 disease with a large, disease-free proximal MV. Fast in unstable patients, but leaves a long double-barrel metal carina and needs a 7–8 Fr guide.',
      steps: [
        { t: 'Wire both branches.', wires: ['mv', 'sb'] },
        { t: 'Position two stents, one in the distal MV and one in the SB, with their proximal ends side by side in the proximal MV.', wires: ['mv', 'sb'], stents: [{ k: 'sksMV', id: 1 }, { k: 'sksSB', id: 2 }] },
        { t: 'Inflate both at the same time. The two stents create a new metal carina in the proximal MV (longer for SKS than for V-stenting).', wires: ['mv', 'sb'], stents: [{ k: 'sksMV', id: 1 }, { k: 'sksSB', id: 2 }], balloons: ['mvSKS', 'sbSKS'] },
      ] },
  ];

  CL.data.bifTrials = [
    ['EBC MAIN (distal LM)', 'Provisional vs planned dual stenting: death/MI/TLR 14.7% vs 17.7% (NS). Provisional remains the default.'],
    ['DKCRUSH-V (distal LM)', 'DK crush vs provisional: TLF 5.0% vs 10.7% at 1 year; 8.3% vs 16.9% at 3 years.'],
    ['DEFINITION II (complex)', 'Two-stent (mostly DK crush) vs provisional in DEFINITION-complex lesions: TLF 6.1% vs 11.4%.'],
    ['Nordic I', 'Simple (provisional) strategy as good as complex at 5 years in unselected bifurcations.'],
    ['Nordic III', 'Final kissing did not change MACE, but reduced SB restenosis in true bifurcations (7.6% vs 20%).'],
    ['Nordic-Baltic IV', 'Large SB: 2-year MACE 12.9% simple vs 8.4% complex (NS).'],
  ];

  CL.data.definition = {
    major: 'SB stenosis ≥70% (LM) or ≥90% (non-LM), AND SB lesion length ≥10 mm',
    minor: ['Moderate–severe calcification', 'Multiple lesions', 'Bifurcation angle <45° or >70°', 'MV reference diameter <2.5 mm', 'MV lesion length ≥25 mm', 'Thrombus'],
    rule: 'Complex = 1 major + any 2 minor criteria. Complex lesions do better with a planned two-stent strategy (usually DK crush). Simple lesions do better with provisional.',
  };

  CL.data.ostial = [
    { k: 'Definition', v: 'An ostial lesion lies within 3 mm of the vessel origin. Aorto-ostial: RCA, LM, vein grafts; often fibrocalcific with recoil, and the plaque continues into the aortic wall. Branch-ostial: LAD, LCx, diagonals, OMs; plaque can shift into the parent vessel.' },
    { k: 'Aorto-ostial stenting', v: 'Disengage the guide during deployment and leave the stent 1–2 mm proximal to the ostium, protruding into the aorta. Then flare the proximal end with a larger NC balloon or a dedicated ostial balloon. The Szabo technique (an anchor wire through the last strut) helps place the stent precisely but can deform or dislodge it.' },
    { k: 'Ostial LAD / LCx', v: 'Choose between precise ostial placement (IVUS from both branches helps) and crossover stenting from the LM into the LAD. Use crossover when the LM or the other ostium is diseased or the ostium can’t be defined; it then becomes an LM bifurcation strategy.' },
    { k: 'Why image', v: 'Angiography foreshortens and overlaps ostia. IVUS defines the true extent, calcium and the risk of plaque shift, and confirms coverage and expansion. Use IVUS rather than OCT at the aorto-ostium, where blood can’t be cleared.' },
  ];

  CL.data.bifRefs = [
    { t: 'EBC: PCI for bifurcation disease — consensus from 10 years of EBC meetings', url: 'https://eurointervention.pcronline.com/article/percutaneous-coronary-intervention-for-coronary-bifurcation-disease-consensus-from-the-first-10-years-of-the-european-bifurcation-club-meetings' },
    { t: 'Bif-ARC definitions and endpoints for bifurcation trials', url: 'https://eurointervention.pcronline.com/article/definitions-and-standardized-endpoints-for-treatment-of-coronary-bifurcations' },
    { t: 'EBC 12th consensus: LM and other bifurcations', url: 'https://eurointervention.pcronline.com/article/percutaneous-coronary-intervention-for-the-left-main-stem-and-other-bifurcation-lesions-12th-consensus-document-from-the-european-bifurcation-club' },
    { t: 'DKCRUSH-V 3-year outcomes — PCRonline', url: 'https://www.pcronline.com/PCR-Publications/PCR-Journal-Club/2019/Three-year-outcomes-of-the-DKCRUSH-V-trial-comparing-DK-crush-with-provisional-stenting-for-left-main-bifurcation-lesions' },
    { t: 'DEFINITION II — PCRonline', url: 'https://www.pcronline.com/PCR-Publications/PCR-Journal-Club/2020/Multicentre-randomised-comparison-of-two-stent-and-provisional-stenting-techniques-in-patients-with-complex-coronary-bifurcation-lesions-the-DEFINITION-II-trial' },
    { t: 'DEFINITION criteria — Chen SL et al.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5855162' },
    { t: 'EuroIntervention: PCI of ostial lesions', url: 'https://eurointervention.pcronline.com/article/percutaneous-coronary-intervention-of-ostial-lesions' },
    { t: 'ACC Coronary Interventions Handbook ch. 10: bifurcation approaches', url: 'https://www.acc.org/-/media/Non-Clinical/Files-PDFs-Excel-MS-Word-etc/Membership/Coronary-Interventions-Handbook/Chapter-10_Bifurcation-Approaches.pdf' },
  ];
})();
