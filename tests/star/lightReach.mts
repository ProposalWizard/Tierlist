import * as T from "three";
import { lightReach, outOfReach, noLampsChunk } from "../../lib/star/three3d/lightReach";

/**
 * LIGHTS ONLY WHERE THEY REACH (lib/star/three3d/lightReach.ts): a dark light
 * leaves the shader, a material no lamp can reach loses the lamp loop, and
 * anything that moves is put back.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

check(!!noLampsChunk(T.ShaderChunk.lights_fragment_begin), "three's lighting chunk still has the point and spot loops this file takes out");
{
  const c = noLampsChunk(T.ShaderChunk.lights_fragment_begin)!;
  check(c.includes("NUM_DIR_LIGHTS > 0") && c.includes("NUM_HEMI_LIGHTS > 0"), "the sun and the sky light stay");
}
check(outOfReach({ x: 0, y: 0, z: 0 }, 5, { x: 10, y: 0, z: 0 }, 2), "a mesh 10 m off, radius 2, is out of a 5 m lamp");
check(!outOfReach({ x: 0, y: 0, z: 0 }, 5, { x: 6, y: 0, z: 0 }, 2), "a mesh whose edge is 4 m off is in reach");
check(!outOfReach({ x: 0, y: 0, z: 0 }, 0, { x: 999, y: 0, z: 0 }, 1), "a lamp with no range reaches everything");

const scene = new T.Scene();
const near = new T.MeshStandardMaterial(), far = new T.MeshStandardMaterial(), shared = new T.MeshStandardMaterial();
const box = (m: T.Material, x: number) => { const o = new T.Mesh(new T.BoxGeometry(1, 1, 1), m); o.position.x = x; scene.add(o); return o; };
box(near, 1); const farBox = box(far, 30); box(shared, 1); box(shared, 30);
const lamp = new T.PointLight("#fff", 3, 5, 2); scene.add(lamp);
const fill = new T.PointLight("#fff", 0, 9, 2); scene.add(fill);
const sun = new T.DirectionalLight("#fff", 2); scene.add(sun);
const r = lightReach(T, scene);
r.update();
check(!fill.visible && r.stats.darkHidden === 1, "a light at nothing is out of the shader");
check(sun.visible && lamp.visible, "lit lights stay");
check(!!far.userData.noLamps, "a material out of every lamp's reach skips the lamps");
check(!near.userData.noLamps, "a material in reach keeps them");
check(!shared.userData.noLamps, "a material used near and far keeps them");
{
  const sh: any = { fragmentShader: "#include <lights_fragment_begin>", vertexShader: "", uniforms: {} };
  far.onBeforeCompile(sh, null as any);
  check(!sh.fragmentShader.includes("NUM_POINT_LIGHTS > 0") && sh.fragmentShader.includes("#if 0"), "the far material's shader has no lamp loop");
  check(far.customProgramCacheKey() !== near.customProgramCacheKey(), "and its own shader key");
}
fill.intensity = 2;
r.check();
check(fill.visible, "turned up: back in the shader");
farBox.position.x = 2; scene.updateMatrixWorld(true);
r.check();
check(!far.userData.noLamps, "a far mesh that moves puts its material back as built");
r.update();
check(!far.userData.noLamps, "and it is in reach now, so it keeps the lamps");
{
  const s2 = new T.Scene();
  const m2 = new T.MeshStandardMaterial();
  const o = new T.Mesh(new T.BoxGeometry(1, 1, 1), m2); o.position.x = 40; s2.add(o);
  const l2 = new T.PointLight("#fff", 3, 5, 2); s2.add(l2);
  const r2 = lightReach(T, s2);
  r2.update();
  check(!!m2.userData.noLamps, "(second scene) far material patched");
  l2.position.x = 39; s2.updateMatrixWorld(true);
  r2.check();
  check(!m2.userData.noLamps, "a lamp that moves puts every material back");
  r2.dispose();
}
r.dispose();
check(fill.visible && !far.userData.noLamps, "dispose puts everything back");

if (problems.length) { console.error(`lightReach: ${problems.length} problem(s)\n - ` + problems.join("\n - ")); process.exit(1); }
console.log("lightReach: all checks passed");
