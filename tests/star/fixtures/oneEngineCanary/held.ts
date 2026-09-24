// CANARY — the physics held in a variable. See README.md.
import { stepReactions, type Ball, type Scenario } from "@/lib/star/canvasEngine";
const step = stepReactions;
export function canaryHeld(sc: Scenario, b: Ball) { step(sc, b, 0.01); }
