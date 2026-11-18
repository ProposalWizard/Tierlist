/**
 * THE PHONE'S `withMeshopt` (stands in for lib/star/three3d/meshopt.ts).
 *
 * Every GLTFLoader in the game calls withMeshopt(loader) before loading
 * (RUL-3D-007: the files are meshopt-packed). On the website that hands the
 * loader three's WebAssembly decoder and starts the frame meter and the
 * versioned file addresses (both browser-only). On the phone the bundler
 * (phone/metro.config.js) points every `import … from "…/three3d/meshopt"`
 * here instead: the same call, the same files, read by the plain-JavaScript
 * decoder (./meshoptDecoder.ts) because the phone has no WebAssembly.
 */
import { MeshoptDecoderJS } from "./meshoptDecoder";

type MeshoptDecoderLike = typeof MeshoptDecoderJS;

/** Give a GLTFLoader the meshopt decoder. Returns the loader. */
export async function withMeshopt<L extends { setMeshoptDecoder(d: never): unknown }>(loader: L): Promise<L> {
  loader.setMeshoptDecoder(MeshoptDecoderJS as unknown as never);
  return loader;
}

export type { MeshoptDecoderLike };
