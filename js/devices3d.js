/* EP Simulator — device hardware geometry: generators, leads, leadless capsules, thoracic skeleton,
 * and a simulated chest radiograph (orthographic "X-ray" rendering of the same 3D objects).
 *
 * EP.Hardware.build(parts)      → { gens, leads, caps, pads } in world coordinates
 * EP.Hardware.add3D(heart, hw)  → adds meshes + labels to a Heart3D; returns { remove() }
 * new EP.XRay(el)               .setHardware(hw, extras) .setView('pa' | 'lat')
 */
(function (EP) {
  'use strict';
  if (typeof THREE === 'undefined') { EP.Hardware = null; EP.XRay = null; return; }
  const G = EP.G, V = EP.V, Mo = EP.Morph, L = G.L;
  const HW = (EP.Hardware = {});
  const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);

  // ---- anatomical routes ------------------------------------------------------------------------
  const GEN_L = [10.6, 12.2, 6.9];
  const AX_L = [[9.2, 14.4, 6.4], [7.2, 15.5, 5.2], [4.2, 14.9, 2.6], [0.6, 13.2, 0.5], [-2.5, 11.3, -1.0], [-3.4, 9.0, -1.7], [-3.5, 5.6, -1.6], [-3.5, 2.9, -1.4]];
  const IJ_R = [[-4.8, 22, 2.8], [-4.2, 17, 0.8], [-3.6, 12, -1.3], [-3.4, 9.0, -1.7], [-3.5, 5.6, -1.6], [-3.5, 2.9, -1.4]];
  const RA_IN = [[-3.45, 0.7, -1.1], [-2.8, -1.1, -0.7]];
  const TV = () => G.LM.tricuspid;
  const loop = (c, r, turns) => { const o = []; for (let i = 0; i <= turns * 10; i++) { const a = (i / 10) * 2 * Math.PI + 0.6; o.push([c[0] + r * Math.cos(a), c[1] + r * 0.9 * Math.sin(a), c[2] - 0.35]); } return o; };
  const R = (HW.routes = {
    raa: () => [[-3.7, 0.9, -1.0], [-3.95, -0.6, -0.35], [-3.55, -0.5, 0.65], [-2.8, 0.7, 1.1], [-2.3, 1.75, 1.25]],
    rvApex: () => RA_IN.concat([TV(), L(4.45, 0.45, 1.8), L(4.3, 0.5, 3.6), L(3.9, 0.5, 5.3), L(3.45, 0.5, 6.45)]),
    rvSeptal: () => RA_IN.concat([TV(), L(4.5, 0.4, 1.6), L(4.3, 0.2, 2.7), L(3.75, 0.05, 3.3), L(3.22, 0.0, 3.4)]),
    rvot: () => RA_IN.concat([TV(), L(4.6, -0.4, 1.6), L(4.2, -1.8, 1.6), L(3.4, -3.0, 1.3), L(2.6, -3.4, 1.15)]),
    lbb: () => RA_IN.concat([TV(), L(4.5, 0.3, 1.5), L(4.2, 0.0, 2.2), L(3.4, -0.15, 2.25), L(2.3, -0.2, 2.2)]),
    his: () => [[-3.3, 0.4, -1.1], [-2.3, -0.8, -0.6], V.lerp([-2.3, -0.8, -0.6], G.LM.his, 0.6), G.LM.his],
    cs: () => {
      const p = [[-3.4, 0.2, -1.2], [-3.0, -1.8, -1.6], G.LM.csOs];
      for (const d of [50, 80, 110, 140, 165]) p.push(V.addS(G.ringPoint(G.ANNULI.mitral, (d * Math.PI) / 180, 1.95), G.A, -0.45));
      p.push(L(-3.25, 0.75, 0.6), L(-3.3, 0.7, 1.7), L(-3.2, 0.6, 2.8));
      return p;
    },
    // malpositions
    rvBackInRA: () => [[-3.5, 0.6, -1.1], [-3.2, -1.2, -0.9], [-2.6, -2.0, -0.4], [-1.9, -1.9, 0.3]],
    raDown: () => [[-3.6, 0.9, -1.1], [-3.8, -0.8, -1.0], [-3.6, -2.2, -1.2]],
    perforated: () => RA_IN.concat([TV(), L(4.45, 0.45, 1.8), L(4.3, 0.5, 3.6), L(3.9, 0.5, 5.3), L(3.4, 0.5, 6.9), L(3.5, 0.9, 8.1)]),
    midCardiacVein: () => [[-3.4, 0.2, -1.2], [-3.0, -1.8, -1.6], G.LM.csOs, L(2.9, 2.75, 0.6), L(2.3, 2.95, 1.9), L(1.7, 2.75, 3.3)],
    lvViaASD: () => [[-3.3, 1.2, -1.6], G.LM.fossaOvalis, [0.2, 0.0, -3.3], G.LM.mitral, L(0.1, 0.5, 2.5), L(0.2, 1.0, 4.8), L(0.3, 1.5, 6.2)],
    csBackInRA: () => [[-3.4, 0.2, -1.2], [-3.0, -1.8, -1.6], G.LM.csOs, V.addS(G.ringPoint(G.ANNULI.mitral, (50 * Math.PI) / 180, 1.95), G.A, -0.45)],
    anteriorVein: () => {
      const p = [[-3.4, 0.2, -1.2], [-3.0, -1.8, -1.6], G.LM.csOs];
      for (const d of [50, 90, 130, 170, 210, 250]) p.push(V.addS(G.ringPoint(G.ANNULI.mitral, (d * Math.PI) / 180, 1.95), G.A, -0.45));
      p.push(L(0.9, -3.15, 1.2), L(1.4, -3.05, 2.6), L(1.7, -2.8, 4.0));
      return p;
    },
    tvpCoiled: () => [[-3.5, 0.8, -1.1], [-4.4, -0.8, -0.6], [-3.6, -2.0, 0.2], [-2.4, -1.0, 0.4], [-2.9, 0.6, -0.2], [-4.0, 0.2, -0.6]],
  });
  HW.sites = { rvApex: 'rvApex', rvSeptal: 'rvMidSeptum', rvot: 'rvotSeptal', lbb: 'lbbArea', midCardiacVein: 'midCardiacVein', lvViaASD: 'lvInfApical', cs: 'lvLatEpi', anteriorVein: 'lvAntWall' };

  /* parts: { gen:'pm'|'icd'|'crt'|null, access:'left'|'ij', leads:[{route, name, coil:[fromEnd0,fromEnd1], svcCoil, gap}], caps:[{name, tip, from, len}],
   *          sicd, evicd, pads, twiddler, genAt } */
  HW.build = function (parts) {
    const hw = { gens: [], leads: [], caps: [], pads: [], notes: [] };
    const big = parts.gen === 'icd' || parts.gen === 'crtd';
    const gp = parts.genAt || GEN_L;
    if (parts.gen) hw.gens.push({ pos: gp, size: big ? [6.6, 5.4, 1.2] : [4.7, 4.3, 0.75], name: big ? 'ICD generator' : 'Pulse generator' });
    const ax = parts.access === 'ij' ? IJ_R : AX_L;
    (parts.leads || []).forEach((ld, i) => {
      let pts;
      if (parts.twiddler) {
        // leads wound round the generator and retracted
        pts = loop(gp, 2.9 + i * 0.35, 3.2).concat(ax.slice(0, ld.route === 'raa' ? 6 : 8));
        if (ld.route !== 'raa') pts.push([-3.5, 1.2, -1.2], [-3.2, -0.6, -0.9]);
      } else {
        const head = parts.gen ? [[gp[0] - 0.4 + i * 0.25, gp[1] + 2.3, gp[2] - 0.1]].concat(loop([gp[0] + 0.2, gp[1] - 0.2, gp[2] - 0.5], 2.5 + i * 0.3, 1)) : [];
        pts = head.concat(ax, R[ld.route]());
      }
      const o = { pts, name: ld.name, r: ld.coil || ld.svcCoil ? 0.13 : 0.1, coils: [], tip: pts[pts.length - 1], gap: ld.gap, gapAt: ld.gapAt, route: ld.route };
      if (ld.coil) o.coils.push({ kind: 'end', from: ld.coil[0], to: ld.coil[1] });
      if (ld.svcCoil) o.coils.push({ kind: 'world', a: [-3.4, 10.2, -1.5], b: [-3.5, 4.4, -1.6] });
      hw.leads.push(o);
    });
    for (const c of parts.caps || []) hw.caps.push(c);
    if (parts.sicd) {
      const m = parts.sicd === 'bad';
      hw.gens.push({ pos: m ? [12.4, -5.5, 6.2] : [15.4, -3.2, -1.2], size: [7.6, 6.4, 1.3], name: 'S-ICD generator', rotY: m ? 0.5 : 1.45 });
      const pts = m ? [[12, -6.5, 6.8], [8, -8.2, 8.8], [4.6, -8.4, 9.8], [4.9, -3, 10.2], [5.2, 5.5, 9.6]] : [[14.2, -5.2, 3.4], [9.5, -7.6, 8.2], [2.2, -8.0, 10.2], [1.7, -3, 10.5], [1.6, 5.8, 9.9]];
      hw.leads.push({ pts, name: 'Subcutaneous lead', r: 0.16, coils: [{ kind: 'end', from: 0.4, to: 8.6 }], tip: pts[pts.length - 1], sub: true });
    }
    if (parts.evicd) {
      hw.gens.push({ pos: [15.3, -3.4, -1.0], size: [6.6, 5.6, 1.2], name: 'EV-ICD generator', rotY: 1.45 });
      const pts = [[14.2, -5.4, 3.2], [9, -8.4, 7.6], [2.4, -9.2, 8.4], [0.8, -7.2, 7.5], [1.5, -4.2, 7.3], [0.4, -1.6, 7.4], [1.3, 1.2, 7.4], [0.7, 3.6, 7.5]];
      hw.leads.push({ pts, name: 'Substernal lead', r: 0.15, coils: [{ kind: 'end', from: 0.3, to: 9 }], tip: pts[pts.length - 1], sub: true });
    }
    for (const p of parts.pads || []) hw.pads.push(p);
    hw.pneumothorax = !!parts.pneumothorax;
    return hw;
  };

  // ---- mesh helpers -------------------------------------------------------------------------------
  function leadMeshes(ld, mats) {
    const out = [];
    const curve = new THREE.CatmullRomCurve3(ld.pts.map(v3), false, 'centripetal', 0.5);
    const len = curve.getLength(), seg = Math.max(40, Math.round(len * 6));
    if (ld.gap || ld.gapAt) {
      // conductor fracture: draw the lead in two pieces with a short gap
      const u = ld.gapAt ? nearestU(curve, v3(ld.gapAt)) : ld.gap / len;
      for (const [a, b] of [[0, u - 0.004], [u + 0.004, 1]]) {
        const pts = []; for (let i = 0; i <= 80; i++) pts.push(curve.getPointAt(a + (b - a) * (i / 80)));
        out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, ld.r, 8, false), mats.lead));
      }
    } else out.push(new THREE.Mesh(new THREE.TubeGeometry(curve, seg, ld.r, 8, false), mats.lead));
    for (const c of ld.coils) {
      let a, b;
      if (c.kind === 'end') { a = 1 - c.to / len; b = 1 - c.from / len; }
      else { a = nearestU(curve, v3(c.a)); b = nearestU(curve, v3(c.b)); if (a > b) { const t = a; a = b; b = t; } }
      const pts = []; for (let i = 0; i <= 40; i++) pts.push(curve.getPointAt(EP.clamp(a + (b - a) * (i / 40), 0, 1)));
      out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, ld.r * 2.0, 10, false), mats.coil));
    }
    // tip electrode + ring
    const tip = new THREE.Mesh(new THREE.SphereGeometry(ld.r * 1.7, 10, 8), mats.metal); tip.position.copy(curve.getPointAt(1)); out.push(tip);
    if (!ld.sub) { const ring = new THREE.Mesh(new THREE.SphereGeometry(ld.r * 1.5, 10, 8), mats.metal); ring.position.copy(curve.getPointAt(Math.max(0, 1 - 1.1 / len))); out.push(ring); }
    return out;
  }
  function nearestU(curve, p) { let best = 0, bd = 1e9; for (let i = 0; i <= 200; i++) { const d = curve.getPointAt(i / 200).distanceTo(p); if (d < bd) { bd = d; best = i / 200; } } return best; }
  function genMesh(g, mat, detailMat) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(g.size[0] / 2, g.size[0] / 2, g.size[2], 28), mat);
    body.rotation.x = Math.PI / 2; body.scale.set(1, 1, g.size[1] / g.size[0]);
    grp.add(body);
    const header = new THREE.Mesh(new THREE.BoxGeometry(g.size[0] * 0.62, g.size[1] * 0.26, g.size[2] * 0.9), detailMat || mat);
    header.position.set(-g.size[0] * 0.08, g.size[1] * 0.5, 0); grp.add(header);
    if (detailMat) { const batt = new THREE.Mesh(new THREE.CylinderGeometry(g.size[0] * 0.3, g.size[0] * 0.3, g.size[2] * 1.02, 20), detailMat); batt.rotation.x = Math.PI / 2; batt.position.set(g.size[0] * 0.05, -g.size[1] * 0.1, 0); grp.add(batt); }
    grp.position.copy(v3(g.pos)); if (g.rotY) grp.rotation.y = g.rotY;
    return grp;
  }
  function capMesh(c, mat) {
    const dir = V.norm(V.sub(c.tip, c.from)), len = c.len || 2.6;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, len, 14), mat);
    const mid = V.addS(c.tip, dir, -len / 2);
    m.position.copy(v3(mid)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(dir));
    return m;
  }

  /* Add hardware to a Heart3D scene. */
  HW.add3D = function (heart, hw, o) {
    o = o || {};
    const grp = heart.group('devices');
    while (grp.children.length) grp.remove(grp.children[0]);
    const mats = {
      lead: new THREE.MeshStandardMaterial({ color: 0x2c3e55, roughness: 0.45, metalness: 0.2 }),
      coil: new THREE.MeshStandardMaterial({ color: 0xd5dae1, roughness: 0.4, metalness: 0.3 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.35, metalness: 0.3 }),
      gen: new THREE.MeshStandardMaterial({ color: 0xc3cad3, roughness: 0.45, metalness: 0.25 }),
      pad: new THREE.MeshStandardMaterial({ color: 0xe9e2c8, roughness: 0.9, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    };
    const labels = [];
    for (const g of hw.gens) { grp.add(genMesh(g, mats.gen)); labels.push(heart.addLabel(g.name, [g.pos[0], g.pos[1] + 3.4, g.pos[2]], 'dev')); }
    for (const ld of hw.leads) { for (const m of leadMeshes(ld, mats)) grp.add(m); if (ld.name) labels.push(heart.addLabel(ld.name, ld.tip, 'dev')); }
    for (const c of hw.caps) { grp.add(capMesh(c, mats.metal)); labels.push(heart.addLabel(c.name, c.tip, 'dev')); }
    for (const p of hw.pads) { const m = new THREE.Mesh(new THREE.PlaneGeometry(p.size[0], p.size[1]), mats.pad); m.position.copy(v3(p.pos)); if (p.rotY) m.rotation.y = p.rotY; grp.add(m); labels.push(heart.addLabel(p.name, p.pos, 'dev')); }
    if (o.chest !== false) for (const m of skeleton(new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.8, transparent: true, opacity: 0.22, depthWrite: false }))) grp.add(m);
    heart.invalidate();
    return { remove() { while (grp.children.length) grp.remove(grp.children[0]); for (const l of labels) l.remove(); heart.invalidate(); } };
  };

  // ---- thoracic skeleton (shared by the 3D overlay and the radiograph) ------------------------------
  let _skel = null;
  function skelGeoms() {
    if (_skel) return _skel;
    const g = { ribs: [], spine: [], clav: [], sternum: [] };
    for (let i = 0; i < 10; i++) {
      const y0 = 18.2 - i * 2.85, k = Math.sin(Math.PI * (i + 1.4) / 12.5);
      const Rx = 5.6 + 9.2 * Math.pow(k, 0.8), Rz = 5.2 + 4.6 * k, drop = 5.2 + 0.35 * i, fmax = i < 7 ? 0.9 : 0.9 - 0.07 * (i - 6);
      for (const sgn of [-1, 1]) {
        const pts = [];
        for (let q = 0; q <= 18; q++) { const f = 0.07 + (fmax - 0.07) * (q / 18), ph = f * Math.PI; pts.push(new THREE.Vector3(sgn * Rx * Math.pow(Math.sin(ph), 0.85), y0 - drop * Math.pow(f, 1.5), -0.6 - Rz * Math.cos(ph))); }
        g.ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.5, 6, false));
      }
    }
    for (let i = 0; i < 15; i++) { const b = new THREE.BoxGeometry(3.7, 2.1, 2.9); b.translate(0, 21.5 - i * 2.75, -9.4); g.spine.push(b); const sp = new THREE.BoxGeometry(0.9, 1.3, 2.4); sp.translate(0, 21.2 - i * 2.75, -12); g.spine.push(sp); }
    for (const sgn of [-1, 1]) g.clav.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sgn * 1.7, 15.7, 7.4), new THREE.Vector3(sgn * 6.5, 16.4, 6.6), new THREE.Vector3(sgn * 11.5, 17.3, 3.4), new THREE.Vector3(sgn * 15.6, 18.0, 0.4)]), 24, 0.72, 7, false));
    const st = new THREE.BoxGeometry(3.3, 13.5, 1.1); st.translate(0, 6.6, 9.3); g.sternum.push(st);
    const mn = new THREE.BoxGeometry(5.2, 4.6, 1.2); mn.translate(0, 15.3, 8.6); g.sternum.push(mn);
    return (_skel = g);
  }
  function skeleton(mat) {
    const g = skelGeoms(), out = [];
    for (const k of ['ribs', 'spine', 'clav', 'sternum']) for (const geo of g[k]) out.push(new THREE.Mesh(geo, mat));
    return out;
  }

  // ---- simulated radiograph ---------------------------------------------------------------------------
  function xmat(gain, pw, rim, blending) {
    return new THREE.ShaderMaterial({
      uniforms: { gain: { value: gain }, pw: { value: pw }, rim: { value: rim || 0 } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float gain; uniform float pw; uniform float rim; varying vec3 vN; void main(){ float d = abs(normalize(vN).z); float v = gain * (pow(d, pw) + rim * pow(1.0 - d, 2.5)); gl_FragColor = vec4(vec3(v), 1.0); }',
      blending: blending || THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.FrontSide,
    });
  }
  function ellip(c, r, mat) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat); m.position.set(c[0], c[1], c[2]); m.scale.set(r[0], r[1], r[2]); return m; }

  class XRay {
    constructor(el) {
      this.el = el;
      const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true }));
      r.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1)); r.setClearColor(0x000000, 1);
      r.domElement.style.display = 'block'; r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
      el.appendChild(r.domElement);
      this.scene = new THREE.Scene();
      this.cam = new THREE.OrthographicCamera(-18, 18, 25, -17, -200, 200);
      this.view = 'pa';
      this._base();
      this.hwGroup = new THREE.Group(); this.scene.add(this.hwGroup);
      this.marks = document.createElement('div'); this.marks.className = 'xr-marks'; el.appendChild(this.marks);
      if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.render()); this.ro.observe(el); }
      this.render();
    }
    dispose() { if (this.ro) this.ro.disconnect(); this.renderer.dispose(); this.el.innerHTML = ''; }
    _base() {
      const s = this.scene, A = EP.Anatomy;
      const add = (m, order) => { m.renderOrder = order; s.add(m); return m; };
      add(ellip([0, 3, -0.6], [17.6, 31, 12.2], xmat(0.27, 0.45)), 1);                       // soft tissue
      add(ellip([-7.6, 6.0, -1.5], [6.3, 13.4, 8.3], xmat(0.72, 0.8, 0, THREE.SubtractiveBlending)), 2);   // right lung
      this.lungL = add(ellip([8.0, 6.4, -1.5], [5.9, 13.0, 8.3], xmat(0.72, 0.8, 0, THREE.SubtractiveBlending)), 2);
      add(ellip([-7.5, -16.2, 0], [10.2, 8.8, 10.6], xmat(0.3, 0.7)), 3);                     // right hemidiaphragm / liver
      add(ellip([8.2, -17.6, 0], [9.6, 8.6, 10.6], xmat(0.27, 0.7)), 3);
      add(ellip([0, 9, -2.4], [3.2, 13, 7.2], xmat(0.1, 0.7)), 3);                             // mediastinum
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.BufferAttribute(A.muscle.pos, 3)); hg.setAttribute('normal', new THREE.BufferAttribute(A.muscle.nrm, 3)); hg.setIndex(new THREE.BufferAttribute(A.muscle.idx, 1));
      add(new THREE.Mesh(hg, xmat(0.15, 0.5)), 3);
      for (const k of ['aorta', 'pa', 'veins']) {
        const vm = G.mesh(G.sdVessels[k], G.BOUNDS[k], 0.34), vg = new THREE.BufferGeometry();
        vg.setAttribute('position', new THREE.BufferAttribute(vm.pos, 3)); vg.setAttribute('normal', new THREE.BufferAttribute(vm.nrm, 3)); vg.setIndex(new THREE.BufferAttribute(vm.idx, 1));
        add(new THREE.Mesh(vg, xmat(k === 'aorta' ? 0.07 : 0.035, 0.6)), 3);
      }
      const sk = skelGeoms();
      for (const geo of sk.ribs) add(new THREE.Mesh(geo, xmat(0.085, 0.6, 2.4)), 4);
      for (const geo of sk.spine) add(new THREE.Mesh(geo, xmat(0.06, 0.4)), 4);
      for (const geo of sk.clav) add(new THREE.Mesh(geo, xmat(0.12, 0.6, 1.8)), 4);
      this.sternum = sk.sternum.map((geo) => add(new THREE.Mesh(geo, xmat(0.05, 0.4)), 4));
      // pneumothorax (hidden unless needed): extra-dark apical crescent + visceral pleural line
      this.ptx = add(ellip([9.6, 11.5, -1.5], [4.3, 8.2, 7.6], xmat(0.55, 0.6, 0, THREE.SubtractiveBlending)), 5);
      const pl = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.07, 6, 40, Math.PI * 0.95), new THREE.MeshBasicMaterial({ color: 0xbbbbbb }));
      pl.position.set(8.2, 8.8, 0); pl.rotation.z = 0.35; pl.scale.set(1, 1.75, 1); pl.renderOrder = 9; s.add(pl); this.ptxLine = pl;
      this.ptx.visible = false; pl.visible = false;
    }
    setHardware(hw) {
      const g = this.hwGroup;
      while (g.children.length) g.remove(g.children[0]);
      this.hw = hw;
      const nd = { depthTest: false, depthWrite: false, transparent: true };   // transparent pass so they draw after the lungs
      const metal = new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff }, nd)), body = new THREE.MeshBasicMaterial(Object.assign({ color: 0xd0d0d0 }, nd)), dark = new THREE.MeshBasicMaterial(Object.assign({ color: 0x8a8a8a }, nd)), wire = new THREE.MeshBasicMaterial(Object.assign({ color: 0xf4f4f4 }, nd));
      if (hw) {
        for (const ge of hw.gens) { const m = genMesh(ge, body, dark); m.traverse((x) => { x.renderOrder = 10; }); g.add(m); }
        for (const ld of hw.leads) for (const m of leadMeshes(Object.assign({}, ld, { r: ld.r * 1.5 }), { lead: wire, coil: metal, metal })) { m.renderOrder = 11; g.add(m); }
        for (const c of hw.caps) { const m = capMesh(c, metal); m.renderOrder = 11; g.add(m); }
        for (const p of hw.pads) { const m = new THREE.Mesh(new THREE.PlaneGeometry(p.size[0], p.size[1]), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide })); m.position.copy(v3(p.pos)); if (p.rotY) m.rotation.y = p.rotY; m.renderOrder = 9; g.add(m); }
      }
      this.ptx.visible = this.ptxLine.visible = !!(hw && hw.pneumothorax);
      this.render();
    }
    setView(v) { this.view = v; this.render(); }
    render() {
      const w = Math.max(60, this.el.clientWidth), hgt = Math.max(60, this.el.clientHeight), cam = this.cam, lat = this.view === 'lat';
      this.renderer.setSize(w, hgt, false);
      const H = 42, W = H * (w / hgt);
      cam.left = -W / 2; cam.right = W / 2; cam.top = 25; cam.bottom = 25 - H;
      if (lat) { cam.position.set(60, 0, -0.5); cam.up.set(0, 1, 0); cam.lookAt(0, 0, -0.5); }
      else { cam.position.set(0.5, 0, 60); cam.up.set(0, 1, 0); cam.lookAt(0.5, 0, 0); }
      cam.updateProjectionMatrix();
      for (const m of this.sternum) m.material.uniforms.gain.value = lat ? 0.16 : 0.05;
      this.renderer.render(this.scene, cam);
      this.marks.innerHTML = lat ? '<span style="left:8px;top:6px">LATERAL</span><span style="left:8px;bottom:6px">anterior</span><span style="right:8px;bottom:6px">posterior</span>' : '<span style="left:8px;top:6px">PA</span><span style="right:10px;top:6px">L</span>';
    }
  }
  EP.XRay = XRay;
})(globalThis.EP = globalThis.EP || {});
