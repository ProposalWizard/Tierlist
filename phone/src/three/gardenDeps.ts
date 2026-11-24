/**
 * What the garden's scene loads with `await import()`, named so the bundler puts it in the main file.
 *
 * The phone's bundle is one file, so an `import()` is just a `require` there. The web build of the
 * app (phone/tools/look) cuts every `import()` into a separate file, and for a few of them the call
 * did not know the file ("Requiring unknown module", seen on assetVersions). Named here, each is in
 * the main file in both builds. Only ./gardenScene.ts's `loadGardenStart` requires this file, so none
 * of it runs until the Garden opens. (On the phone this changes nothing: they were in the one file already.)
 */
import "three/examples/jsm/environments/RoomEnvironment.js";
import "three/examples/jsm/loaders/RGBELoader.js";
import "three/examples/jsm/loaders/DRACOLoader.js";
import "three/examples/jsm/utils/SkeletonUtils.js";
import "three/examples/jsm/utils/BufferGeometryUtils.js";
import "@/lib/star/three3d/assetVersions";
import "@/lib/star/three3d/runPosture";
import "@/lib/star/style3d/real/enhance";
import "@/lib/star/style3d/toon/face";
import "@/lib/star/home3d/wear";
import "@/lib/star/people3d";
import "@/lib/star/look3d";
export {};
