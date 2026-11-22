/* EP Simulator — 3D heart (three.js r128 global THREE).
 *
 * EP.Heart3D(container, opts)
 *   .setRecording(rec)   event log to animate
 *   .setTime(t)          colour the myocardium by time since local activation; move conduction pulses
 *   .setMode('prop' | 'iso' | 'anat')
 *   .setOpts({ opacity, vessels, conduction, labels, cavities })
 *   .setView(name)       camera presets
 *   .onPick = ({ point, region, vox }) => …
 *   .group('name')       THREE.Group for add-ons (devices, markers)
 */
(function (EP) {
  'use strict';
  if (typeof THREE === 'undefined') { EP.Heart3D = null; return; }
  const G = EP.G, M = EP.Model, Mo = EP.Morph, A = EP.Anatomy, V = EP.V;
  const TAU = Math.PI * 2;

  function geom(m) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    return g;
  }
  const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);
  function tubeMesh(points, r, color, o) {
    const curve = new THREE.CatmullRomCurve3(points.map(v3), false, 'centripetal');
    const g = new THREE.TubeGeometry(curve, Math.max(8, points.length * 8), r, 8, false);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.05 }, o || {})));
    m.userData.curve = curve;
    return m;
  }
  EP.tubeMesh = tubeMesh;

  // colour ramps -----------------------------------------------------------------------------------
  const RAMP = [[0, [1, 1, 0.86]], [0.05, [1, 0.9, 0.3]], [0.2, [0.99, 0.5, 0.12]], [0.5, [0.8, 0.2, 0.3]], [0.8, [0.5, 0.2, 0.5]], [1, null]];
  const ISO = [[0, [0.86, 0.1, 0.1]], [0.18, [0.96, 0.5, 0.1]], [0.36, [0.95, 0.88, 0.2]], [0.54, [0.25, 0.75, 0.3]], [0.72, [0.15, 0.6, 0.85]], [0.88, [0.2, 0.25, 0.8]], [1, [0.5, 0.15, 0.65]]];
  function rampAt(tbl, f, base, out) {
    for (let i = 0; i < tbl.length - 1; i++) {
      if (f <= tbl[i + 1][0]) {
        const a = tbl[i], b = tbl[i + 1], k = (f - a[0]) / (b[0] - a[0]), cb = b[1] || base, ca = a[1] || base;
        out[0] = ca[0] + (cb[0] - ca[0]) * k; out[1] = ca[1] + (cb[1] - ca[1]) * k; out[2] = ca[2] + (cb[2] - ca[2]) * k; return;
      }
    }
    out[0] = base[0]; out[1] = base[1]; out[2] = base[2];
  }
  EP.ISO_RAMP = ISO;

  const BASE_V = [0.6, 0.25, 0.23], BASE_A = [0.68, 0.38, 0.36], BASE_ENDO = [0.42, 0.16, 0.16];
  const APD_V = 300, APD_A = 190;

  const VIEWS = {
    front: { az: 0, el: 0.08, dist: 48, target: [1.2, 0.2, -0.6] },
    back: { az: Math.PI, el: 0.15, dist: 48, target: [1.2, 0.6, -0.6] },
    left: { az: 1.35, el: 0.05, dist: 46, target: [1.5, -0.6, -0.4] },
    right: { az: -1.35, el: 0.1, dist: 46, target: [0, 0.2, -0.6] },
    lao: { az: 0.75, el: 0.02, dist: 46, target: [1.2, -0.2, -0.5] },
    rao: { az: -0.55, el: 0.05, dist: 46, target: [1.2, -0.2, -0.5] },
    koch: { az: -1.15, el: -0.12, dist: 26, target: [-0.3, -1.1, -0.9] },
    flutter: { az: -0.7, el: -0.45, dist: 40, target: [-1.6, -0.6, -0.6] },
    base: { az: 2.6, el: 0.75, dist: 44, target: [0.6, 0.2, -1.2] },
    inferior: { az: 0.5, el: -1.1, dist: 46, target: [1.5, -1, 0] },
    chest: { az: 0, el: 0.02, dist: 120, target: [0, 3, -2] },
    chestLat: { az: 1.5708, el: 0.02, dist: 120, target: [0, 3, -2] },
  };

  class Heart3D {
    constructor(el, o) {
      Mo.init();
      this.el = el; this.o = Object.assign({ opacity: 1, vessels: true, conduction: true, labels: true, cavities: true, mode: 'prop' }, o || {});
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }));
      r.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
      r.domElement.style.display = 'block'; r.domElement.style.touchAction = 'none'; r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
      el.appendChild(r.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
      this.cam = { az: 0, el: 0.08, dist: 48, target: new THREE.Vector3(1.2, 0.2, -0.6) };
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a60, 0.62));
      this.key = new THREE.DirectionalLight(0xffffff, 0.5); this.scene.add(this.key);
      this.fill = new THREE.DirectionalLight(0xffe8e0, 0.14); this.scene.add(this.fill);
      this.root = new THREE.Group(); this.scene.add(this.root);
      this.groups = {};
      this.lab = document.createElement('div'); this.lab.className = 'h3d-labels'; el.appendChild(this.lab);
      this.rec = null; this.t = 0; this.pulses = [];
      this._build();
      this._controls();
      this._resize();
      if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this._resize()); this.ro.observe(el); }
      this.dirty = true;
      const loop = () => { this._raf = requestAnimationFrame(loop); this._tick(); };
      loop();
      this.setTime(-1e6);
    }
    dispose() { cancelAnimationFrame(this._raf); if (this.ro) this.ro.disconnect(); this.renderer.dispose(); this.el.innerHTML = ''; }
    group(name) { if (!this.groups[name]) { this.groups[name] = new THREE.Group(); this.root.add(this.groups[name]); } return this.groups[name]; }
    invalidate() { this.dirty = true; }

    // ---------------------------------------------------------------------------------------------
    _build() {
      const mesh = A.muscle, n = mesh.pos.length / 3;
      // muscle
      this.colors = new Float32Array(n * 3);
      const g = geom(mesh);
      g.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
      this.muscleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02, transparent: true, opacity: 1 });
      this.muscle = new THREE.Mesh(g, this.muscleMat);
      this.muscle.renderOrder = 5;
      this.root.add(this.muscle);
      this.nv = n; this.isAtr = new Uint8Array(n);
      for (let i = 0; i < n; i++) this.isAtr[i] = G.isAtrial(A.region[i]) ? 1 : 0;
      this.phase = new Float32Array(n);
      // endocardial cavities (visible through a translucent wall)
      this.cav = [];
      for (const [name, sdf, b] of [['lv', G.sdLVCav, G.BOUNDS.lvcav], ['rv', G.sdRVCav, G.BOUNDS.rvcav]]) {
        const cm = G.mesh(sdf, b, 0.3), cn = cm.pos.length / 3;
        const cg = geom(cm), col = new Float32Array(cn * 3);
        cg.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
        const vox = M.mapMesh(cm.pos, cm.nrm, null, -0.22);
        this.cav.push({ name, mesh: m, col, vox, n: cn });
        this.group('cavities').add(m);
      }
      // vessels
      const vdef = [['aorta', 0xb23a3a], ['pa', 0x3f66a8], ['veins', 0x44609c], ['pvs', 0xb04c4c]];
      for (const [k, color] of vdef) {
        const vm = G.mesh(G.sdVessels[k], G.BOUNDS[k], 0.3);
        const m = new THREE.Mesh(geom(vm), new THREE.MeshStandardMaterial({ color, roughness: 0.55, transparent: true, opacity: 1 }));
        m.renderOrder = 4; m.userData.vessel = k;
        this.group('vessels').add(m);
      }
      this._buildConduction();
      this._buildRings();
      this._buildLabels();
      this._atrialLookups();
    }
    _buildConduction() {
      const L = G.L, LM = G.LM, c = this.group('conduction');
      const yellow = 0xf2c230, emis = { emissive: 0x6b4a00, emissiveIntensity: 0.6, roughness: 0.4 };
      const node = (p, r, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial(Object.assign({ color: yellow }, emis))); m.position.copy(v3(p)); if (s) m.scale.set(s[0], s[1], s[2]); c.add(m); return m; };
      this.cs = {};
      this.cs.sa = node(LM.saNode, 0.42, [0.8, 1.5, 0.8]);
      this.cs.avn = node(LM.avNode, 0.36);
      // internodal tracts (anterior, middle, posterior) hugging the right atrium
      const inter = [
        [LM.saNode, [-3.3, 2.6, 0.6], [-1.9, 1.3, 0.5], [-1.2, -0.3, -0.2], LM.avNode],
        [LM.saNode, [-4.0, 1.0, -2.2], [-2.6, -0.4, -2.2], LM.avNode],
        [LM.saNode, [-5.3, 0.3, -0.9], [-4.6, -2.0, -1.2], [-2.6, -2.2, -1.0], LM.avNode],
      ];
      this.cs.inter = inter.map((p) => { const m = tubeMesh(p, 0.07, yellow, Object.assign({ transparent: true, opacity: 0.55 }, emis)); c.add(m); return m; });
      // AV-nodal inputs: fast (anterior-superior) and slow (posterior, from the CS os)
      const avn = LM.avNode;
      this.cs.fast = tubeMesh([V.addS(avn, [-0.7, 1.7, 0.5], 1), V.addS(avn, [-0.4, 0.9, 0.35], 1), avn], 0.16, 0x3b82d9, { emissive: 0x0a2a55, emissiveIntensity: 0.7 });
      this.cs.slow = tubeMesh([LM.csOs, V.addS(V.lerp(LM.csOs, avn, 0.5), [0.15, -0.45, 0.1], 1), avn], 0.16, 0xe08a2c, { emissive: 0x5a2c00, emissiveIntensity: 0.7 });
      c.add(this.cs.fast); c.add(this.cs.slow);
      const his = [avn, LM.his, L(2.62, -0.45, 1.3)];
      this.cs.his = tubeMesh(his, 0.13, yellow, emis); c.add(this.cs.his);
      const bif = L(2.62, -0.45, 1.3);
      this.cs.rbb = tubeMesh([bif, L(3.05, -0.2, 2.6), L(2.95, 0.0, 4.2), L(3.2, 0.1, 5.2), L(4.4, -0.3, 5.0), L(5.45, -0.6, 4.3)], 0.09, yellow, emis); c.add(this.cs.rbb);
      this.cs.lbb = tubeMesh([bif, L(2.25, -0.3, 1.9), L(2.02, 0.0, 2.8)], 0.11, yellow, emis); c.add(this.cs.lbb);
      this.cs.laf = tubeMesh([L(2.02, 0.0, 2.8), L(1.5, -1.1, 3.4), L(0.3, -1.8, 3.8), L(-0.9, -1.75, 4.0)], 0.08, yellow, emis); c.add(this.cs.laf);
      this.cs.lpf = tubeMesh([L(2.02, 0.0, 2.8), L(1.8, 0.9, 3.6), L(1.2, 1.6, 4.2), L(0.5, 1.85, 4.6)], 0.08, yellow, emis); c.add(this.cs.lpf);
      // Purkinje arborisation: random walks over the endocardial layer
      const rng = EP.rng(42), pos = [], seeds = ['lvSeptal', 'laf', 'lpf', 'rvSeptal', 'rvFree'];
      for (const s of seeds) {
        const kind = s.startsWith('rv') ? 'purkRV' : 'purkLV';
        for (let b = 0; b < 16; b++) {
          let p = M.pos(M.nearest(G.LM.exits[s], kind));
          const dir = V.norm([rng.gauss(), rng.gauss(), rng.gauss()]);
          for (let k = 0; k < 9; k++) {
            const q = M.pos(M.nearest(V.addS(V.addS(p, dir, 0.75), [rng.gauss(), rng.gauss(), rng.gauss()], 0.3), kind));
            if (V.dist(p, q) < 0.05) break;
            pos.push(p[0], p[1], p[2], q[0], q[1], q[2]); p = q;
          }
        }
      }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.cs.purk = new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.55 }));
      c.add(this.cs.purk);
      // accessory pathway bridge (shown when a rhythm has one)
      this.cs.ap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 10), new THREE.MeshStandardMaterial({ color: 0xc23aa0, emissive: 0x5a0a48, emissiveIntensity: 0.8 }));
      this.cs.ap.visible = false; c.add(this.cs.ap);
      // travelling pulses
      const pm = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.pulsePool = [];
      for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), pm); m.visible = false; c.add(m); this.pulsePool.push(m); }
    }
    _buildRings() {
      const grp = this.group('rings');
      for (const k in G.ANNULI) {
        const a = G.ANNULI[k];
        const m = new THREE.Mesh(new THREE.TorusGeometry(a.r, 0.1, 8, 40), new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.6 }));
        m.position.copy(v3(a.c)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3(a.n));
        grp.add(m);
      }
      // coronary sinus along the posterior AV groove
      const cs = [];
      for (const d of [200, 170, 140, 110, 80, 50]) cs.push(V.addS(G.ringPoint(G.ANNULI.mitral, (d * Math.PI) / 180, 1.95), G.A, -0.45));
      cs.push(G.LM.csOs);
      this.csPath = cs;
      grp.add(tubeMesh(cs, 0.26, 0x5d7fbf, { roughness: 0.6 }));
    }
    _buildLabels() {
      const LM = G.LM;
      const defs = [
        ['RA', 'Right atrium', [-5.4, -0.6, 0.2], 'ch'], ['LA', 'Left atrium', [1.0, 2.6, -5.9], 'ch'], ['RV', 'Right ventricle', G.L(5.4, 0.3, 3.2), 'ch'], ['LV', 'Left ventricle', G.L(-2.9, -0.8, 4.2), 'ch'],
        ['RAA', 'RA appendage', [-2.2, 2.6, 2.4], 'ch2'], ['LAA', 'LA appendage', [5.3, 2.3, -1.0], 'ch2'], ['RVOT', 'RV outflow tract', G.L(3.2, -4.4, 1.2), 'ch2'], ['apex', 'Apex', G.L(0, 0, 8.7), 'ch2'],
        ['Ao', 'Aorta', [-1.6, 6.2, 1.0], 'ves'], ['PA', 'Pulmonary artery', [3.6, 4.8, 1.4], 'ves'], ['SVC', 'SVC', [-3.5, 7.4, -0.6], 'ves'], ['IVC', 'IVC', [-3.0, -6.4, -1.4], 'ves'],
        ['PV', 'Pulmonary veins', [6.2, 3.6, -5.2], 'ves'], ['CS', 'Coronary sinus', this.csPath[3], 'ves'],
        ['SAN', 'Sinus node', LM.saNode, 'cs'], ['AVN', 'AV node', LM.avNode, 'cs'], ['His', 'His bundle', LM.his, 'cs'], ['RBB', 'Right bundle', G.L(3.2, 0.1, 5.2), 'cs'], ['LBB', 'Left bundle', G.L(2.02, 0.0, 2.8), 'cs'],
      ];
      this.labels = defs.map(([id, text, p, cls]) => {
        const d = document.createElement('div'); d.className = 'h3d-label h3d-' + cls; d.textContent = text; this.lab.appendChild(d);
        return { id, el: d, p: v3(p), cls, on: true };
      });
      this.extraLabels = [];
    }
    /* Add a custom floating label; returns handle with .remove() */
    addLabel(text, p, cls) {
      const d = document.createElement('div'); d.className = 'h3d-label h3d-' + (cls || 'note'); d.textContent = text; this.lab.appendChild(d);
      const l = { el: d, p: v3(p), cls: cls || 'note', on: true, always: true };
      this.labels.push(l); this.invalidate();
      return { remove: () => { d.remove(); const i = this.labels.indexOf(l); if (i >= 0) this.labels.splice(i, 1); this.invalidate(); } };
    }
    _atrialLookups() {
      // flutter: angle of every right-atrial vertex round the tricuspid annulus; LA passive from the septum
      const n = this.nv, P = A.muscle.pos, ring = G.ANNULI.tricuspid;
      const u = V.norm(V.sub(G.S, V.scale(ring.n, V.dot(G.S, ring.n)))), w = V.cross(ring.n, u);
      this.flutterFrac = new Float32Array(n);
      const la = Mo.atrial({ seeds: [{ p: G.LM.fossaOvalis, t: 0 }, { p: G.LM.csOs, t: 15 }] });
      for (let i = 0; i < n; i++) {
        if (!this.isAtr[i]) continue;
        const reg = A.region[i];
        if (reg === G.REG.RA || reg === G.REG.RAA) {
          const d = [P[i * 3] - ring.c[0], P[i * 3 + 1] - ring.c[1], P[i * 3 + 2] - ring.c[2]];
          let th = Math.atan2(V.dot(d, w), V.dot(d, u)); th = (th - Math.PI + 2 * TAU) % TAU;   // 0 at the septum, increasing counter-clockwise
          this.flutterFrac[i] = th / TAU;
        } else {
          const t = la.T[i] < Infinity ? la.T[i] : 80;
          this.flutterFrac[i] = 0.08 + Math.min(0.9, t / 200);
        }
      }
      // vertex lists for rotor fields
      this.atrIdx = []; this.venIdx = [];
      for (let i = 0; i < n; i++) (this.isAtr[i] ? this.atrIdx : this.venIdx).push(i);
    }
    _rotors(seg, idx, k) {
      if (seg._rot) return seg._rot;
      const r = EP.rng((seg.seed || 1) + 17), P = A.muscle.pos, Nn = A.muscle.nrm, rot = [];
      for (let q = 0; q < k; q++) {
        const i = idx[Math.floor(r() * idx.length)];
        const c = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], nn = [Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]];
        let e1 = V.cross(nn, [0.3, 1, 0.2]); e1 = V.norm(e1); const e2 = V.cross(nn, e1);
        rot.push({ c, e1, e2, s: q % 2 ? -1 : 1, w: [r.range(0.3, 0.8), r.range(0.3, 0.8), r() * TAU, r() * TAU], amp: r.range(0.8, 1.8) });
      }
      return (seg._rot = rot);
    }

    /* Per-vertex LAT for an activation (inverse-distance blend of nearby voxels), cached on the act. */
    _vlat(act) {
      if (act._vl) return act._vl;
      if (!this.vw) {
        // 4 nearest voxels per ventricular vertex
        const n = this.nv, P = A.muscle.pos, Nn = A.muscle.nrm;
        const build = (pos, nrm, cnt, inset, test) => {
          const idx = new Int32Array(cnt * 4).fill(-1), wt = new Float32Array(cnt * 4);
          for (let i = 0; i < cnt; i++) {
            if (test && !test(i)) continue;
            const p = [pos[i * 3] - nrm[i * 3] * inset, pos[i * 3 + 1] - nrm[i * 3 + 1] * inset, pos[i * 3 + 2] - nrm[i * 3 + 2] * inset];
            const near = M.nearestK(p, 4); let sw = 0;
            for (let k = 0; k < near.length; k++) { idx[i * 4 + k] = near[k][0]; wt[i * 4 + k] = 1 / (0.02 + near[k][1]); sw += wt[i * 4 + k]; }
            for (let k = 0; k < 4; k++) wt[i * 4 + k] /= sw || 1;
          }
          return { idx, wt };
        };
        this.vw = build(P, Nn, n, 0.3, (i) => !this.isAtr[i]);
        for (const c of this.cav) c.vw = build(c.mesh.geometry.attributes.position.array, c.mesh.geometry.attributes.normal.array, c.n, -0.22, null);
      }
      const T = act.T, blend = (vw, cnt) => {
        const out = new Float32Array(cnt);
        for (let i = 0; i < cnt; i++) { let s = 0, any = false; for (let k = 0; k < 4; k++) { const v = vw.idx[i * 4 + k]; if (v >= 0) { s += vw.wt[i * 4 + k] * T[v]; any = true; } } out[i] = any ? s : NaN; }
        return out;
      };
      act._vl = { m: blend(this.vw, this.nv), c: this.cav.map((c) => blend(c.vw, c.n)) };
      return act._vl;
    }

    // ---------------------------------------------------------------------------------------------
    setRecording(rec) {
      this.rec = rec;
      // accessory pathway marker
      const ap = rec && rec.sim && rec.sim.cfg.ap;
      this.cs.ap.visible = !!ap;
      if (ap) {
        const a = v3((Mo.ASITES[ap.aSite] || { p: ap.aSite }).p), b = v3((Mo.SITES[ap.vSite] || { p: ap.vSite }).p);
        this.cs.ap.position.copy(a).add(b).multiplyScalar(0.5);
        this.cs.ap.scale.set(1, a.distanceTo(b), 1);
        this.cs.ap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        this.apEnds = [a, b];
        if (!this.apLabel) this.apLabel = this.addLabel('Accessory pathway', [0, 0, 0], 'cs');
        this.labels[this.labels.length - 1].p.copy(this.cs.ap.position);
      } else if (this.apLabel) { this.apLabel.remove(); this.apLabel = null; }
      const hasSlow = !!(rec && rec.sim && rec.sim.cfg.avn.slow);
      this.cs.slow.visible = hasSlow; this.cs.fast.visible = hasSlow;
      this.setTime(this.t);
    }
    setMode(m) { this.o.mode = m; this.setTime(this.t); }
    setOpts(o) {
      Object.assign(this.o, o);
      const op = this.o.opacity;
      this.muscleMat.opacity = op; this.muscleMat.depthWrite = op > 0.97;
      for (const m of this.group('vessels').children) { m.visible = this.o.vessels; m.material.opacity = Math.min(1, op + 0.25); m.material.depthWrite = op > 0.7; }
      this.group('conduction').visible = this.o.conduction;
      this.group('cavities').visible = this.o.cavities && op < 0.97;
      this.group('rings').visible = op < 0.97;
      this.lab.style.display = this.o.labels ? '' : 'none';
      this.invalidate();
    }

    /* Colour the heart for time t (ms on the recording's clock). */
    setTime(t) {
      this.t = t;
      const rec = this.rec, n = this.nv, ph = this.phase, mode = this.o.mode;
      const col = this.colors, tmp = [0, 0, 0];
      ph.fill(1e9);
      let vEv = null, aEv = null;
      const cavPh = this.cav.map((c) => { c.ph = c.ph || new Float32Array(c.n); c.ph.fill(1e9); return c.ph; });
      let apdV = APD_V, apdA = APD_A, isoV = null, isoA = null;
      if (rec && mode !== 'anat') {
        const vox = A.voxOfVert, ev = rec.events;
        for (let e = 0; e < ev.length; e++) {
          const x = ev[e];
          if (x.t > t) break;
          if (x.type === 'QRS' && t - x.t < 700) {
            const vl = this._vlat(x.act), T = vl.m;
            for (let i = 0; i < n; i++) { const d = t - x.t - T[i]; if (d >= 0 && d < ph[i]) ph[i] = d; }
            for (let c = 0; c < this.cav.length; c++) { const cv = this.cav[c], cp = cavPh[c], Tc = vl.c[c]; for (let i = 0; i < cv.n; i++) { const d = t - x.t - Tc[i]; if (d >= 0 && d < cp[i]) cp[i] = d; } }
            vEv = x; apdV = EP.clamp(x.wave.qt * 0.82, 150, 420);
          } else if (x.type === 'P' && t - x.t < 450) {
            const T = x.act.T, t0 = x.act.tmin;
            for (let i = 0; i < n; i++) { if (!this.isAtr[i]) continue; const d = t - x.t - (T[i] - t0); if (d >= 0 && d < ph[i]) ph[i] = d; }
            aEv = x;
          }
        }
        for (const s of rec.segs) {
          if (t < s.t0 || t > s.t1) continue;
          if (s.type === 'flutter') {
            const cl = s.cl, dir = s.dir === 'cw' ? -1 : 1; apdA = cl * 0.8;
            for (const i of this.atrIdx) { let f = ((t - s.t0) / cl - dir * this.flutterFrac[i]) % 1; if (f < 0) f += 1; ph[i] = f * cl; }
          } else {
            const atr = s.type === 'fib', idx = atr ? this.atrIdx : this.venIdx;
            const cl = atr ? 165 : s.type === 'vf' ? 190 : (s.cl || 250);
            const rot = this._rotors(s, idx, atr ? 5 : s.type === 'tdp' ? 1 : s.type === 'pmvt' ? 2 : 4);
            const P = A.muscle.pos, ts = (t - s.t0) / 1000;
            if (atr) apdA = cl * 0.85; else apdV = cl * 0.85;
            const cs = rot.map((r) => [r.c[0] + r.amp * Math.sin(r.w[0] * ts * TAU * 0.25 + r.w[2]), r.c[1] + r.amp * Math.sin(r.w[1] * ts * TAU * 0.25 + r.w[3]), r.c[2] + r.amp * Math.cos(r.w[0] * ts * TAU * 0.2)]);
            for (const i of idx) {
              let a = 0;
              for (let q = 0; q < rot.length; q++) {
                const r = rot[q], c = cs[q];
                const dx = P[i * 3] - c[0], dy = P[i * 3 + 1] - c[1], dz = P[i * 3 + 2] - c[2];
                a += r.s * (Math.atan2(dx * r.e2[0] + dy * r.e2[1] + dz * r.e2[2], dx * r.e1[0] + dy * r.e1[1] + dz * r.e1[2]) + 0.55 * Math.sqrt(dx * dx + dy * dy + dz * dz));
              }
              let f = (a / TAU + (t - s.t0) / cl) % 1; if (f < 0) f += 1;
              ph[i] = f * cl;
            }
            if (!atr) for (let c = 0; c < this.cav.length; c++) cavPh[c].fill(1e9);
          }
        }
        if (mode === 'iso') { isoV = vEv; isoA = aEv; }
      }
      // write colours
      const vox = A.voxOfVert;
      for (let i = 0; i < n; i++) {
        const atr = this.isAtr[i], base = atr ? BASE_A : BASE_V;
        if (mode === 'iso' && (atr ? isoA : isoV)) {
          const x = atr ? isoA : isoV;
          const lat = atr ? x.act.T[i] - x.act.tmin : (vox[i] >= 0 ? this._vlat(x.act).m[i] - x.act.tmin : 0);
          const span = atr ? Math.max(40, x.act.tmax - x.act.tmin) : Math.max(40, x.act.tmax - x.act.tmin);
          rampAt(ISO, EP.clamp(lat / span, 0, 1), base, tmp);
        } else {
          const f = ph[i] / (atr ? apdA : apdV);
          if (f >= 1) { tmp[0] = base[0]; tmp[1] = base[1]; tmp[2] = base[2]; } else rampAt(RAMP, f, base, tmp);
        }
        col[i * 3] = tmp[0]; col[i * 3 + 1] = tmp[1]; col[i * 3 + 2] = tmp[2];
      }
      this.muscle.geometry.attributes.color.needsUpdate = true;
      for (let c = 0; c < this.cav.length; c++) {
        const cv = this.cav[c], cp = cavPh[c];
        for (let i = 0; i < cv.n; i++) {
          if (mode === 'iso' && isoV && cv.vox[i] >= 0) rampAt(ISO, EP.clamp((this._vlat(isoV.act).c[c][i] - isoV.act.tmin) / Math.max(40, isoV.act.tmax - isoV.act.tmin), 0, 1), BASE_ENDO, tmp);
          else { const f = cp[i] / apdV; if (f >= 1) { tmp[0] = BASE_ENDO[0]; tmp[1] = BASE_ENDO[1]; tmp[2] = BASE_ENDO[2]; } else rampAt(RAMP, f, BASE_ENDO, tmp); }
          cv.col[i * 3] = tmp[0]; cv.col[i * 3 + 1] = tmp[1]; cv.col[i * 3 + 2] = tmp[2];
        }
        cv.mesh.geometry.attributes.color.needsUpdate = true;
      }
      this._pulses(t);
      this.isoEvents = { v: isoV || vEv, a: isoA || aEv };
      this.invalidate();
    }
    _pulses(t) {
      const rec = this.rec, pool = this.pulsePool; let k = 0;
      const glow = { sa: 0, avn: 0, his: 0 };
      const put = (curve, f) => { if (k >= pool.length) return; const m = pool[k++]; m.visible = true; m.position.copy(curve.getPoint(EP.clamp(f, 0, 1))); };
      if (rec && this.o.mode !== 'anat') {
        for (const ev of rec.events) {
          if (ev.t > t) break;
          if (ev.type === 'P' && ev.kind === 'sinus' && t - ev.t < 70) glow.sa = 1;
          if (ev.type !== 'cond' || !ev.ok || t < ev.t0 || t > ev.t1 + 20) continue;
          const f0 = (t - ev.t0) / Math.max(1, ev.t1 - ev.t0), f = ev.dir === 'f' ? f0 : 1 - f0;
          if (ev.path === 'fast') { put(this.cs.fast.userData.curve, f); glow.avn = 1; }
          else if (ev.path === 'slow') { put(this.cs.slow.userData.curve, f); glow.avn = 1; }
          else if (ev.path === 'hps') {
            glow.his = 1;
            if (f < 0.35) put(this.cs.his.userData.curve, f / 0.35);
            else { const q = (f - 0.35) / 0.65; put(this.cs.rbb.userData.curve, q); put(this.cs.lbb.userData.curve, Math.min(1, q * 2)); if (q > 0.5) { put(this.cs.laf.userData.curve, (q - 0.5) * 2); put(this.cs.lpf.userData.curve, (q - 0.5) * 2); } }
          } else if (ev.path === 'ap' && this.apEnds && k < pool.length) { const m = pool[k++]; m.visible = true; m.position.copy(this.apEnds[0]).lerp(this.apEnds[1], EP.clamp(f, 0, 1)); }
        }
      }
      for (; k < pool.length; k++) pool[k].visible = false;
      this.cs.sa.material.emissiveIntensity = 0.6 + 2.2 * glow.sa; this.cs.avn.material.emissiveIntensity = 0.6 + 2.2 * glow.avn; this.cs.his.material.emissiveIntensity = 0.6 + 1.6 * glow.his;
    }

    // ---------------------------------------------------------------------------------------------
    setView(name, instant) {
      const v = VIEWS[name]; if (!v) return;
      const c = this.cam, from = { az: c.az, el: c.el, dist: c.dist, t: c.target.clone() }, to = { az: v.az, el: v.el, dist: v.dist, t: v3(v.target) };
      let da = to.az - from.az; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      if (instant) { c.az = to.az; c.el = to.el; c.dist = to.dist; c.target.copy(to.t); this.invalidate(); return; }
      const t0 = performance.now();
      this._anim = () => {
        const k = Math.min(1, (performance.now() - t0) / 550), e = k * k * (3 - 2 * k);
        c.az = from.az + da * e; c.el = from.el + (to.el - from.el) * e; c.dist = from.dist + (to.dist - from.dist) * e; c.target.lerpVectors(from.t, to.t, e);
        this.invalidate(); if (k >= 1) this._anim = null;
      };
    }
    _controls() {
      const el = this.renderer.domElement, c = this.cam, pts = new Map();
      let moved = 0, last = null, pinch = 0;
      const mid = () => { const a = [...pts.values()]; return [(a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)]; };
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }); moved = 0; if (pts.size === 2) { last = mid(); pinch = last[2]; } this._anim = null; });
      el.addEventListener('pointermove', (e) => {
        const p = pts.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        if (pts.size === 1) {
          if (p.b === 2 || p.shift) this._pan(dx, dy);
          else { c.az -= dx * 0.0085; c.el = EP.clamp(c.el + dy * 0.0085, -1.5, 1.5); }
        } else if (pts.size === 2) {
          const m = mid(); this._pan(m[0] - last[0], m[1] - last[1]); c.dist = EP.clamp(c.dist * (pinch / Math.max(20, m[2])), 14, 200); pinch = m[2]; last = m;
        }
        this.invalidate();
      });
      const up = (e) => {
        const p = pts.get(e.pointerId); pts.delete(e.pointerId);
        if (p && moved < 5 && this.onPick) this._pick(e);
      };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
      el.addEventListener('wheel', (e) => { e.preventDefault(); c.dist = EP.clamp(c.dist * Math.exp(e.deltaY * 0.0012), 14, 200); this.invalidate(); }, { passive: false });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    _pan(dx, dy) {
      const c = this.cam, k = c.dist * 0.00125;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), upv = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      c.target.addScaledVector(right, -dx * k).addScaledVector(upv, dy * k);
    }
    _pick(e) {
      const r = this.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.camera);
      const hit = rc.intersectObject(this.muscle, false)[0];
      if (!hit) return;
      const p = [hit.point.x, hit.point.y, hit.point.z];
      const fi = hit.face.a, region = A.region[fi];
      this.onPick({ point: p, region, vertex: fi, vox: A.voxOfVert[fi], atrial: !!this.isAtr[fi] });
    }
    _resize() {
      const w = Math.max(50, this.el.clientWidth), h = Math.max(50, this.el.clientHeight);
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.w = w; this.h = h; this.invalidate();
    }
    _tick() {
      if (this._anim) this._anim();
      if (!this.dirty) return;
      this.dirty = false;
      const c = this.cam, cam = this.camera;
      cam.position.set(c.target.x + c.dist * Math.sin(c.az) * Math.cos(c.el), c.target.y + c.dist * Math.sin(c.el), c.target.z + c.dist * Math.cos(c.az) * Math.cos(c.el));
      cam.lookAt(c.target); cam.updateMatrixWorld();
      this.key.position.copy(cam.position).add(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(-c.dist * 0.4)).add(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar(c.dist * 0.5));
      this.fill.position.copy(cam.position).add(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(c.dist * 0.6));
      if (this.onBeforeRender) this.onBeforeRender();
      this.renderer.render(this.scene, cam);
      // labels
      if (this.o.labels) {
        const p = new THREE.Vector3(), dir = new THREE.Vector3(), ctr = new THREE.Vector3(1.0, 0.3, -1.0), view = new THREE.Vector3();
        const op = this.o.opacity;
        for (const l of this.labels) {
          p.copy(l.p).project(cam);
          dir.copy(l.p).sub(ctr).normalize(); view.copy(cam.position).sub(l.p).normalize();
          const facing = dir.dot(view);
          const inner = l.cls === 'cs';
          let show = l.on && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
          if (inner && !l.always) show = show && op < 0.9 && this.o.conduction;
          else if (!l.always) show = show && facing > -0.15;
          if (l.cls === 'ves' && !this.o.vessels) show = false;
          if (l.cls === 'ch2' && this.cam.dist > 42) show = false;
          if (inner && this.cam.dist > 40 && l.id !== 'SAN' && l.id !== 'AVN') show = false;
          l.el.style.display = show ? '' : 'none';
          if (show) l.el.style.transform = `translate(-50%,-50%) translate(${((p.x + 1) / 2 * this.w).toFixed(1)}px,${((1 - p.y) / 2 * this.h).toFixed(1)}px)`;
        }
      }
    }
    snapshot() { this._tick(); return this.renderer.domElement.toDataURL('image/png'); }
  }
  Heart3D.VIEWS = VIEWS;
  EP.Heart3D = Heart3D;
})(globalThis.EP = globalThis.EP || {});
