/**
 * What the signing scene (and the office, which is the same scene as a stage) loads with `await import()` on top of
 * what the garden's does (./gardenDeps.ts), named so the bundler puts it in the main file (see that file). Only
 * ./signingScene.ts's `loadSigningStart` requires this file, so none of it runs until a signing or an office opens.
 */
// (Not three's GLTFLoader here: this folder holds the phone's own GLTFLoader.ts, and the bundler remembers a file's import
// by the folder it was asked in, so naming it from this folder made the phone's loader import ITSELF. The scenes' own
// import()s, from lib/star, find the phone's loader as they do for the garden.)
import "@/lib/star/three3d/footballAnims";
import "@/lib/star/three3d/meshopt";
import "@/lib/star/style3d/toon/faceIdApply";
import "@/lib/star/style3d/toon/hair";
import "@/lib/star/style3d/toon/clothes";
import "@/lib/star/people/presets";
export {};
