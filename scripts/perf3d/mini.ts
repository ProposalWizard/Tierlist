// A garden-sized mini scene, DOM-free so it runs on the page OR in a Web
// Worker on an OffscreenCanvas: the garden's own props.glb (every piece laid
// out on a grid), the one-body player + manager with the shared clips, a
// shadowed sun, the shop's room reflection. Same work in both places.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

export async function buildMini(canvas: any, w: number, h: number, pr: number, base: string, onFrame: (ms: number, first: boolean) => void, existing?: THREE.WebGLRenderer) {
  const renderer = existing ?? new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e3d3b6");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight("#cfe0f4", "#4f4428", 0.55));
  const sun = new THREE.DirectionalLight("#ffd7a0", 3);
  sun.position.set(10, 14, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#7f9a5c" }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const camera = new THREE.PerspectiveCamera(56, w / h, 0.1, 160);
  camera.position.set(0, 6, 16); camera.lookAt(0, 1, 0);

  const draco = new DRACOLoader(); draco.setDecoderPath(base + "/star/shop3d/draco/"); draco.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const [props, player, manager, anims] = await Promise.all([
    loader.loadAsync(base + "/star/garden3d/props.glb"), loader.loadAsync(base + "/star/onebody/player.glb"),
    loader.loadAsync(base + "/star/onebody/manager.glb"), loader.loadAsync(base + "/star/people3d/anims.glb"),
  ]);
  let i = 0;
  for (const top of [...props.scene.children]) {
    for (let k = 0; k < 2; k++) {
      const c = top.clone(); c.position.set(((i % 8) - 3.5) * 3.2, 0, (Math.floor(i / 8) - 3) * 3.2); i++;
      c.traverse((o: any) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      scene.add(c);
    }
  }
  const mixers: THREE.AnimationMixer[] = [];
  const clip = anims.animations.find((a: any) => /idle/i.test(a.name)) ?? anims.animations[0];
  for (let k = 0; k < 6; k++) {
    const p = SkeletonUtils.clone((k % 2 ? manager : player).scene);
    p.position.set(-5 + k * 2, 0, 4);
    p.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
    scene.add(p);
    const m = new THREE.AnimationMixer(p);
    if (clip) m.clipAction(clip).play();
    mixers.push(m);
  }
  let last = performance.now(), first = true;
  const PX = new Uint8Array(4);
  const gl = renderer.getContext();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    mixers.forEach((m) => m.update(dt));
    camera.position.x = Math.sin(now / 3000) * 4; camera.lookAt(0, 1, 0);
    const a = performance.now();
    renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PX);
    onFrame(performance.now() - a, first); first = false;
  });
  return { renderer, scene, stop: () => { renderer.setAnimationLoop(null); draco.dispose(); } };
}
