# EP Simulator — architecture notes

Plain scripts, one global namespace `EP`. Load order is in `index.html`. Logic modules
(`util`, `geometry`, `model`, `morph`, `heartsim`, `synth`, `rhythms`) run under Node too
(see `tools/dev_*.js`).

## Data flow

    rhythm config ──► EP.HeartSim (discrete events) ──► sim.out / sim.segs
                                                         │
                 EP.Morph (activation → waveforms) ◄─────┤  each P / QRS event carries its
                 EP.Model (voxel + atrial Dijkstra)      │  waveform and LAT field (`act`)
                                                         ▼
                              EP.Synth.build(sim,t0,t1) → rec {leads[12], events, spikes, segs}
                                                         │
                         EP.ECGView / EP.LiveStrip ◄─────┴────► EP.Heart3D.setRecording / setTime

## Key APIs

### geometry.js — `EP.G`
- Frame: `G.O` (mitral centre), `G.A` (apex dir), `G.S` (LV→RV), `G.N`; `G.L(s,n,a)` local→world.
- `G.LM` landmarks, `G.PATHS` vessel centre-lines, `G.ANNULI`, `G.ringPoint(ring, th, rScale)`
  (mitral: 0° septal, 90° inferior/posterior, 180° lateral; tricuspid: 0° lateral, 180° septal).
- SDFs: `G.sdMuscle`, `G.sdLVCav`, `G.sdRVCav`, `G.sdVessels.*`; `G.mesh(sdf, bounds, h)` surface nets.

### model.js — `EP.Model` (M), `EP.Leads`
- `M.build()`; voxels 0.3 cm. `M.nearest(p, kind)` kind ∈ any|purkLV|purkRV|endoLV|endoRV|epi.
- `M.activate(seeds[{v,t}], {vm, vp, purkLV, purkRV, purkLVant, purkLVpost, aniso})` → LAT Float32Array.
- `M.dipole(T)` → `{vcg, n, t0, tmin, tmax, area}` (mV, 1 ms samples).
- Atria: `M.atrialActivate`, `M.atrialDipole` over the muscle mesh (vertex-indexed LAT).
- `EP.Leads.vec` Dower lead vectors in world axes; `EP.Leads.project(x,y,z,lead)`.
- Tunables: `M.VM .VP .VA .ANISO .RVW .OTW .BASE_FADE .KV .KA`.

### morph.js — `EP.Morph` (Mo)
- `Mo.init()` builds model + `EP.Anatomy {muscle, region, voxOfVert}`.
- `Mo.SITES` (ventricular named sites), `Mo.ASITES` (atrial sites).
- `Mo.spec(name | {site}, {slow, purkLV, purkRV})` → ventricular activation spec.
  Names: normal, rbbb, lbbb, lafb, lpfb, rbbb+lafb, rbbb+lpfb, irbbb, ilbbb, or any SITES key.
- `Mo.fuse([{spec, t}])` multi-source (fusion, BiV, pre-excitation).
- `Mo.vent(spec)` → cached activation `{T, vcg, on, off, area, seeds}`.
- `Mo.vbeat(spec, {rr, mods})` → waveform `{n, pre, vcg, adds, qrs, qt, jt, act}`.
  mods: `qtc, jtScale, tAmp, tAdd[3], tShape{p,sl,sr}, kappa, stFrac, st[3], stShape:'scoop', u, jWave,
  leadAdd:[{lead, fn(msFromJ, jt)}]`.
- `Mo.pwave(Mo.aspec(site), {amp})`; `Mo.axis(act)`.

### heartsim.js — `EP.HeartSim`, `EP.simulate(cfg, dur)`
Config (deep-merged over defaults): `sinus{on,cl,sd,resp,site,startAt}`,
`atria{mode:'normal'|'flutter'|'fib', flutterCL, flutterDir, fibMean, fibSd, fibAmp, pAmp}`,
`avn{fast{min,alpha,tau,erp,erpExit,conceal,block,retro{delay,erp,block}}, slow{…}|null}`,
`hps{hv,pattern,erp,rbExtra,ashman,blockN,blockProb,block,retro{…}}`,
`ap{aSite,vSite,delay,erp,block,retro{…}}|null`, `vent{erp,mods,slow,mode}`,
`foci[{id,node:'A'|'H'|'V',kind:'auto'|'coupled',cl,sd,site,sites,coupling,every,repeat,count,after,startAt,label,reentrant}]`,
`script[{t, do(sim,t)}]`.
Runtime: `sim.runUntil(t)`, `sim.pace(t,'A'|'V',{site,captured,spec,kind})`, `sim.shock(t)`,
`sim.blockAVN(t,dur)`, `sim.setAtrialMode(m,t)`, `sim.setVentMode(m,t)`, `sim.contribV(t,{type,spec,label})`,
`sim.activateA(t,{site,kind})`, `sim.on('A'|'V0'|'V'|'H'|'shock', fn)`, live-editable `sim.cfg`.
QRS events are emitted `FW` (100 ms) after onset so late contributors can fuse.

### synth.js — `EP.Synth.build(sim, t0, t1, {fs, noise})` → rec; `EP.Synth.pulse(...)` arterial trace.
### rhythms.js — `EP.Rhythms` list/groups/byId, `R.record(entry,{params,dur,warm})`, `R.measure(rec)`,
`R.AP` pathway table, `R.apCfg(loc, overrides)`, `R.onBeats(steps)`.
### ecgview.js — `new EP.ECGView(canvas,{layout:'12'|'strip',strips,ladder,markers,onSeek})`,
`.setRecording(rec)`, `.setCursor(t)`; `new EP.LiveStrip(canvas,{channels,windowMs,markers})`, `.push(rec, extra)`.
### heart3d.js — `new EP.Heart3D(el)`, `.setRecording`, `.setTime`, `.setMode('prop'|'iso'|'anat')`,
`.setOpts({opacity,vessels,conduction,labels})`, `.setView(name)`, `.onPick`, `.group(name)`, `.addLabel`.
### ui.js — `EP.h`, `EP.UI.{seg,check,range,select,kv,teach,store}`, `EP.Player` (ECG card + heart card).
### app.js — modules register in `EP.Modules = [{id,title,mount(root)→{unmount}}]`; tabs + hash routing.

## Dev tools
    node tools/dev_lib.js [id]          run library rhythms, print rates/labels
    node tools/shot.mjs <url> <png> [w] [h] [waitMs] [--dark] [--full] [--eval js]
    node tools/build.mjs                bundle → dist/ep-simulator.html (artifact) + standalone
    NODE_PATH=/opt/node-tools/node_modules node tools/dev_plot.js out.png conduction|pacing|pvc

Published artifact: https://claude.ai/artifact/751ymCuJKLym44rxW3JJx1 (republish `dist/ep-simulator.html`).
