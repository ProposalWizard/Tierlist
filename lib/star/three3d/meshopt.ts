/**
 * The 3D files are packed small (scripts/perf3d/shrink-models.mjs, 6 Oct
 * 2026): geometry and clips with EXT_meshopt_compression, textures as WebP.
 * Every GLTFLoader that can read one of them calls this first. The decoder is
 * three's own (three/examples/jsm/libs/meshopt_decoder.module.js, ~25 KB,
 * plain WebAssembly — no SIMD needed, so older iPhones read it too).
 */
type MeshoptDecoderLike = typeof import("three/examples/jsm/libs/meshopt_decoder.module.js").MeshoptDecoder;

import { installFrameMeter } from "./frameMeter";

let decoder: Promise<MeshoptDecoderLike> | null = null;

/** Give a GLTFLoader the meshopt decoder (loaded once per page). Returns the loader. */
export async function withMeshopt<L extends { setMeshoptDecoder(d: MeshoptDecoderLike): unknown }>(loader: L): Promise<L> {
  installFrameMeter(); // every 3D scene comes through here: the testers' fps readout (frameMeter.ts)
  if (!decoder) {
    decoder = import("three/examples/jsm/libs/meshopt_decoder.module.js").then((m) => m.MeshoptDecoder);
    decoder.catch(() => { decoder = null; });
  }
  loader.setMeshoptDecoder(await decoder);
  return loader;
}
