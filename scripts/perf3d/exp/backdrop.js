// PRE-RENDERED BACKDROP WITH DEPTH (fixed-camera cutscenes).
// The room (everything not skinned and not riding on a person) is drawn ONCE
// into a colour + depth texture whenever the camera moves. Each frame then
// draws that picture as a full-screen card that also writes the room's depth,
// and only the people (and what they hold) are drawn live on top, depth-tested
// against the room — so a desk edge still hides a hand.
(() => {
  const T = THREE;
  const st = { rt: null, memo: [], bakes: 0, live: 0 };
  const quadScene = new T.Scene();
  const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let quadMat = null;
  const isDynamic = (o) => { for (let p = o; p; p = p.parent) { if (p.isSkinnedMesh || p.isBone) return true; } return false; };
  const split = (scene) => {
    const dyn = [], stat = [];
    scene.traverse((o) => { if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return; (isDynamic(o) || o.userData.__dynamic ? dyn : stat).push(o); });
    // attachments parented to a bone count as dynamic already; also anything whose world matrix changed since last frame
    return { dyn, stat };
  };
  let lastMat = new Map();
  __M.hook = (r, scene, cam, orig) => {
    if (__M.wantHold && !__M.held && __M.ctrl) { __M.held = 1; const p = cam.position.clone(); const d = new THREE.Vector3(); cam.getWorldDirection(d); const l = p.clone().add(d); __M.ctrl.debugCamera([p.x, p.y, p.z], [l.x, l.y, l.z], cam.fov); }
    const a = performance.now();
    __M.inHook = true;
    let calls = 0, tris = 0;
    const count = () => { calls += r.info.render.calls; tris += r.info.render.triangles; };
    const size = r.getDrawingBufferSize(new T.Vector2());
    if (!st.rt || st.rt.width !== size.x || st.rt.height !== size.y) {
      st.rt?.dispose();
      const dt = new T.DepthTexture(size.x, size.y); dt.type = T.UnsignedIntType;
      st.rt = new T.WebGLRenderTarget(size.x, size.y, { type: T.HalfFloatType, depthTexture: dt, samples: 0 });
      st.memo = [];
      quadMat = new T.ShaderMaterial({
        uniforms: { tColor: { value: st.rt.texture }, tDepth: { value: dt } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: "uniform sampler2D tColor; uniform sampler2D tDepth; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tColor, vUv); gl_FragDepth = texture2D(tDepth, vUv).x; \n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
        depthTest: true, depthFunc: T.AlwaysDepth, depthWrite: true, toneMapped: true,
      });
      quadScene.clear(); quadScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), quadMat));
    }
    const { dyn, stat } = split(scene);
    // a static mesh that moved (a door, the pen's rest) forces a re-bake too
    if (__M.frames.length === 4) st.memo = []; // re-bake once textures have loaded
    let moved = P.cameraMoved(cam, st.memo);
    for (const o of stat) { const e = o.matrixWorld.elements; const k = lastMat.get(o); if (!k || k.some((v, i) => Math.abs(v - e[i]) > 1e-6)) { moved = true; lastMat.set(o, e.slice()); } }
    const vis = new Map();
    if (moved) {
      st.bakes++;
      for (const o of dyn) { vis.set(o, o.visible); o.visible = false; }
      r.setRenderTarget(st.rt); orig(scene, cam); count(); r.setRenderTarget(null);
      for (const [o, v] of vis) o.visible = v;
      vis.clear();
    }
    // the card (writes colour + the room's depth)
    orig(quadScene, quadCam); count();
    // the people on top
    for (const o of stat) { vis.set(o, o.visible); o.visible = false; }
    const bg = scene.background; scene.background = null;
    const ac = r.autoClear; r.autoClear = false;
    orig(scene, cam); count();
    r.autoClear = ac; scene.background = bg;
    for (const [o, v] of vis) o.visible = v;
    const g = r.getContext(); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4));
    __M.inHook = false;
    __M.scene = scene;
    __M.frames.push({ tag: __M.tag, at: a, cpu: performance.now() - a, calls, tris });
    __M.extra = { bakes: st.bakes, frames: __M.frames.length, dyn: dyn.length, stat: stat.length };
    return "done";
  };
})();

