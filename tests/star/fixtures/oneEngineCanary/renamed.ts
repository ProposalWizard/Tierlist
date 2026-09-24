// CANARY — a renamed import. See README.md; never import this file.
import { stepBall as roll, type Ball, type Scenario } from "@/lib/star/canvasEngine";
export function canaryRenamed(b: Ball, sc: Scenario) { return roll(b, sc, Math.random, 0.01); }
