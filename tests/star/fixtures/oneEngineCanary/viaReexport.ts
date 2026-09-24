// CANARY — using the physics through a re-export. See README.md.
import { launch } from "./reexport";
import type { Scenario } from "@/lib/star/canvasEngine";
export function canaryViaReexport(sc: Scenario) {
  return launch(sc, { x: 0, y: -1 }, 0.5, { cx: 0, cy: 0 }, { power: 50, technique: 50 }, Math.random);
}
