/**
 * What the training pitch's two scenes load with `await import()` on top of what the garden's does
 * (./gardenDeps.ts), named so the bundler puts it in the main file (see that file). Only
 * ./trainingScene.ts requires this file, so none of it runs until the training pitch opens.
 */
import "@/lib/star/style3d/real/look";
import "@/lib/star/style3d/real/assets";
import "@/lib/star/three3d/runPosture";
import "@/lib/star/three3d/footballAnims";
export {};
