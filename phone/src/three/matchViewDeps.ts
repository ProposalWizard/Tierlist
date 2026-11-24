/**
 * What the 3D match view's scene loads with `await import()` on top of what the garden's and the training pitch's do
 * (./gardenDeps.ts, ./trainingDeps.ts), named so the bundler puts it in the main file (see gardenDeps.ts). Only
 * ./matchViewScene.ts requires this file, so none of it runs until a match asks for the 3D.
 */
import "@/lib/star/style3d/real/ball";
import "@/lib/star/style3d/real/arena";
import "@/lib/star/style3d/real/play3dH";
import "three/examples/jsm/loaders/KTX2Loader.js";
export {};
