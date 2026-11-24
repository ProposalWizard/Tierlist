/**
 * What your house's scene loads with `await import()` on top of what the garden's does (./gardenDeps.ts),
 * named so the bundler puts it in the main file (see that file). Only ./houseScene.ts's `loadHouseStart`
 * requires this file, so none of it runs until the house opens.
 */
import "three/examples/jsm/objects/Reflector.js";
import "@/lib/star/look3dStyle";
import "@/lib/star/home3d/roomBuild";
import "@/lib/star/world3d/houseLife";
import "@/lib/star/three3d/footballAnims";
import "@/lib/star/people/presets";
import "@/lib/star/style3d/toon/faceIdApply";
import "@/lib/star/style3d/toon/face";
import "@/lib/star/style3d/toon/hair";
import "@/lib/star/style3d/toon/clothes";
export {};
