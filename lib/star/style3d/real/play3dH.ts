/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H ON THE 3D DRILLS — what Play3D hands createPlay3DScene when Settings
 * → Look → "3D look" is H: the drill's World, people and camera stay exactly
 * as they are; the picture round them becomes look H (a full stadium, real
 * sky light, the PBR pitch, the match ball, the broadcast pass).
 *
 * Usage: const h = await play3dH(world); createPlay3DScene(..., { bare: true, ...h.opts });
 */
import { CX } from "../../play3d/constants";
import type { World } from "../../play3d/world";
import type { Play3DBuilt } from "../../play3d/scene";
import { quality3dTier } from "../../three3d/quality";
import { grassMaps, hTexture, type TimeOfDay } from "./assets";
import type { RealLook } from "./look";
import type { ArenaColours } from "./arena";

/** Look H drills: people a touch broader than the shop model (see onBuilt). */
export const BUILD_WIDTH = 1.1;

export interface Play3dH {
  opts: {
    bare: true;
    sharp: true;
    onBuilt: (ctx: Play3DBuilt) => void;
    draw: (renderer: any, scene: any, camera: any) => void;
  };
  /** Call from the scene's onFrame. */
  frame(dt: number): void;
  dispose(): void;
}

/**
 * The time of day for a drill: Golden hour (Harry, 9 Oct 2026: "Golden hour
 * has by far the best textures and everything has to match"). It used to
 * follow the phone's clock (day / golden / night). ?tod=day|golden|night still
 * picks one on a test page.
 */
export function drillTod(_now = new Date()): TimeOfDay {
  const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("tod") : null;
  if (q === "day" || q === "golden" || q === "night") return q;
  return "golden";
}

export async function play3dH(world: World, o: { tod?: TimeOfDay; colours?: ArenaColours } = {}): Promise<Play3dH> {
  const T: any = await import("three");
  // the files first, so the stadium is there on the first frame
  await Promise.all([grassMaps(T), hTexture(T, "crowd.webp"), hTexture(T, "led.webp")]);
  const { createRealLook } = await import("./look");
  const tier = quality3dTier();
  let look: RealLook | null = null;
  let built: Play3DBuilt | null = null;
  let dead = false;
  let scored = false;
  const cones: any[] = [];
  return {
    opts: {
      bare: true,
      sharp: true,
      onBuilt: (ctx) => {
        built = ctx;
        ctx.camera.far = 600; ctx.camera.updateProjectionMatrix();
        // a training patch keeps its cones
        if (!world.goal) {
          const coneMat = new T.MeshStandardMaterial({ color: "#ff6a12", roughness: 0.55 });
          for (const [x, z] of [[-6, 19], [6, 19], [-6, 25], [6, 25]]) {
            const c = new T.Mesh(new T.ConeGeometry(0.16, 0.34, 18), coneMat);
            c.position.set(x, 0.17, z); c.castShadow = true; ctx.root.add(c); cones.push(c);
          }
        }
        void createRealLook(T, ctx.renderer, ctx.scene, tier, { tod: o.tod ?? drillTod(), ball: ctx.ball, colours: o.colours, sharp: true }).then((l) => {
          if (dead) { l.dispose(); return; }
          look = l;
          l.dressPeople(ctx.bodies.map((b) => b.p));
          // a broadcast footballer's build (Harry: "the player looks like a slim pixel character"): measured from behind,
          // shoulders were 0.24 of his height; a real one with his arms is about 0.27
          for (const b of ctx.bodies) b.p.root.scale.set(BUILD_WIDTH, 1, BUILD_WIDTH);
          for (const b of ctx.bodies) { const raw = b.p.body.material as any; for (const m of Array.isArray(raw) ? raw : [raw]) if (m) { m.roughness = 0.62; m.metalness = 0; } }
        }).catch((e) => console.error("look H failed to load", e));
      },
      draw: (renderer, scene, camera) => {
        if (look) look.render(scene, camera);
        else { renderer.setRenderTarget(null); renderer.setClearColor("#0b0f14", 1); renderer.clear(); }
      },
    },
    frame(dt) {
      if (!look || !built) return;
      const b = world.ball;
      if (b.y < -0.3 && Math.abs(b.x - CX) < 3.7 && b.z < 2.44) { if (!scored) look.cheer(1); scored = true; } else if (b.y > 2) scored = false;
      look.update(dt, built.camera, { x: b.x - CX, z: b.y }, { x: b.x - CX, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
    },
    dispose() {
      dead = true;
      look?.dispose(); look = null;
      for (const c of cones) { c.parent?.remove(c); c.geometry.dispose(); }
    },
  };
}
