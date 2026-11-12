/* Standard angiographic projections. theta: + LAO / − RAO; phi: + cranial / − caudal.
   Angles are typical starting points; adjust them to the patient's anatomy to remove overlap and foreshortening. */
(function () {
  const CL = (window.CL = window.CL || {});
  CL.data = CL.data || {};
  CL.data.views = [
    { id: 'rao-cau', tree: 'LCA', name: 'RAO caudal', theta: -25, phi: -25, range: 'RAO 10–30° / CAU 15–30°',
      best: 'LM bifurcation, proximal LAD, the whole LCx and the OMs.', segs: ['lcx-p', 'om1', 'om2', 'lcx-d', 'lm', 'lad-p'],
      look: 'Spine and catheter on the image left. The LCx and OMs run down toward the bottom, the LAD along the top toward the apex at the lower right. No diaphragm.' },
    { id: 'rao-cra', tree: 'LCA', name: 'RAO cranial', theta: -15, phi: 35, range: 'RAO 0–30° / CRA 25–40°',
      best: 'Mid and distal LAD laid out, diagonal origins (the diagonals lift upward off the LAD), septals running down.', segs: ['lad-m', 'lad-d', 'd1', 'd2', 'sept'],
      look: 'Diaphragm in the lower field (take a deep breath). The LAD runs left to right toward the apex with the septals hanging down from it.' },
    { id: 'ap-cra', tree: 'LCA', name: 'AP cranial', theta: 0, phi: 35, range: 'CRA 30–40°',
      best: 'Proximal and mid LAD and the LAD/diagonal bifurcation. With 40° cranial between RAO 10° and LAO 10°, it shows LM ostial stent coverage.', segs: ['lad-p', 'lad-m', 'd1', 'sept'],
      look: 'Spine centred behind the heart; diaphragm visible. The septals and diagonals branch in opposite directions from the LAD.' },
    { id: 'lao-cra', tree: 'LCA', name: 'LAO cranial', theta: 40, phi: 25, range: 'LAO 30–60° / CRA 15–30°',
      best: 'Mid LAD and the diagonal origins separated (diagonals to the right, septals to the left). Also the LAD/D1 bifurcation, and the distal LCx in left dominance.', segs: ['lad-p', 'lad-m', 'd1', 'd2'],
      look: 'Spine on the image right. The LAD runs down the middle of the screen along the septum, seen edge-on.' },
    { id: 'lao-cau', tree: 'LCA', name: 'LAO caudal ("spider")', theta: 45, phi: -28, range: 'LAO 40–60° / CAU 20–30°',
      best: 'LM body and bifurcation, ostial and proximal LAD and LCx: the LM seen down the barrel, with the branches spreading like spider legs.', segs: ['lm', 'lad-p', 'lcx-p', 'ramus'],
      look: 'Spine on the image right, no diaphragm. The LAD is foreshortened (it runs toward you), so do not judge the mid LAD here.' },
    { id: 'ap-cau', tree: 'LCA', name: 'AP caudal', theta: 0, phi: -28, range: 'CAU 20–30°',
      best: 'LM body, proximal LCx and the OMs, ostial LAD.', segs: ['lm', 'lcx-p', 'om1'],
      look: 'Spine centred, no diaphragm. The LCx and OMs head down toward the bottom of the image.' },
    { id: 'ap', tree: 'LCA', name: 'AP', theta: 0, phi: 0, range: '0° / 0°',
      best: 'LM ostium and body. Commonly the first "engagement" view.', segs: ['lm'],
      look: 'Spine centred. A shallow RAO or LAO is often used instead to clear the spine.' },
    { id: 'lat-l', tree: 'LCA', name: 'Left lateral', theta: 90, phi: 0, range: 'LAO 90°',
      best: 'Mid and distal LAD and the LIMA–LAD anastomosis.', segs: ['lad-m', 'lad-d'],
      look: 'The spine sits at the image right edge. The LAD runs along the anterior (left of screen) heart border.' },

    { id: 'rca-lao', tree: 'RCA', name: 'LAO (RCA)', theta: 35, phi: 0, range: 'LAO 30–45°',
      best: 'RCA ostium and proximal and mid RCA. The RCA forms a "C".', segs: ['rca-p', 'rca-m', 'rca-d'],
      look: 'Spine on the image right. The RCA forms a C open to the right, with the crux at the bottom.' },
    { id: 'rca-lao-cra', tree: 'RCA', name: 'LAO cranial (RCA)', theta: 35, phi: 22, range: 'LAO 30–45° / CRA 15–30°',
      best: 'Distal RCA, the crux and the PDA/PL bifurcation opened up.', segs: ['rca-d', 'pda', 'rpl', 'avn'],
      look: 'Spine right, diaphragm visible. The PDA and PLV split at the bottom of the C.' },
    { id: 'rca-rao', tree: 'RCA', name: 'RAO (RCA)', theta: -30, phi: 0, range: 'RAO 30°',
      best: 'Mid RCA laid out, the PDA along the inferior septum with its septals, and the conus and RV branches. The RCA forms an "L".', segs: ['rca-m', 'pda', 'conus', 'rvb'],
      look: 'Spine on the image left. The RCA drops vertically in the AV groove (edge-on), then the PDA runs right toward the apex.' },
    { id: 'rca-ap-cra', tree: 'RCA', name: 'AP cranial (RCA)', theta: 0, phi: 25, range: 'CRA 20–30°',
      best: 'Distal RCA bifurcation, PDA and posterolateral branches.', segs: ['rca-d', 'pda', 'rpl'],
      look: 'Spine centred, diaphragm visible. The crux branches fan out under the heart.' },
  ];

  CL.data.viewRules = [
    { k: 'Naming', v: 'A view is named for where the detector (image intensifier or flat panel) sits. LAO: detector over the patient’s left; RAO: over the right. Cranial: detector tilted toward the head; caudal: toward the feet.' },
    { k: 'Spine and catheter', v: 'Spine and catheter shaft on the image right means LAO. On the image left means RAO. Centred means AP.' },
    { k: 'Diaphragm', v: 'Diaphragm or liver shadow over the heart means a cranial view (have the patient breathe in to drop it). No diaphragm suggests caudal.' },
    { k: 'Circle and loop', v: 'The "circle" is the RCA plus LCx in the AV groove; the "loop" is the LAD plus PDA in the septal plane. LAO looks along the septum: the loop is edge-on and the circle opens, which separates left from right. RAO looks at the septum face-on: the loop opens (LAD and PDA lengths, septals) and the circle is edge-on (the RCA and LCx overlap).' },
    { k: 'Rule of thumb', v: 'Cranial views for the LAD and diagonals; caudal views for the LM and LCx. RCA: LAO for the proximal and mid vessel, cranial for the crux.' },
    { k: 'Shapes', v: 'RCA = "C" in LAO and "L" in RAO. LCA in LAO caudal = "spider".' },
  ];

  CL.data.viewRefs = [
    { t: 'Tools and techniques: angiographic views — EuroIntervention', url: 'https://eurointervention.pcronline.com/article/tools-and-techniques-angiographic-views' },
    { t: 'Optimal angiographic views for invasive coronary angiography: a guide for trainees — Br J Cardiol 2016', url: 'https://bjcardio.co.uk/2016/11/optimal-angiographic-views-for-invasive-coronary-angiography-a-guide-for-trainees-2/' },
    { t: 'Angiographic projections made simple — Cath Lab Digest', url: 'https://www.hmpgloballearningnetwork.com/site/cathlab/articles/angiographic-projections-made-simple-easy-guide-understanding-oblique-views' },
    { t: 'Coronary angiography standard views — WikiDoc', url: 'https://www.wikidoc.org/index.php/Coronary_angiography_standard_views' },
    { t: 'SYNTAX score segment definitions (Sianos et al., EuroIntervention 2005)', url: 'https://eurointervention.pcronline.com/article/the-syntax-score-an-angiographic-tool-grading-the-complexity-of-coronary-artery-disease' },
  ];
})();
