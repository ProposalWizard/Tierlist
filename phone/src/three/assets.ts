/**
 * THE 3D FILES INSIDE THE APP, by their website address (./assetList.ts),
 * and the phone's side of ./platform.ts: Skia for pictures, the phone's fonts
 * for shirt numbers. The files open with no signal (they are in the app).
 */
import { Skia } from "@shopify/react-native-skia";
import { Asset } from "expo-asset";
import { readAssetBytes } from "./readAsset";
import { phoneFontFor } from "../draw/useDrawing";
import { setThreePlatform } from "./platform";

/* eslint-disable @typescript-eslint/no-require-imports */
const FILES: Record<string, number> = {
  "/star/people3d/toon-p1.glb": require("../../assets/3d/people3d/toon-p1.glb"),
  "/star/people3d/toon-p2.glb": require("../../assets/3d/people3d/toon-p2.glb"),
  "/star/people3d/toon-p3.glb": require("../../assets/3d/people3d/toon-p3.glb"),
  "/star/people3d/toon-p4.glb": require("../../assets/3d/people3d/toon-p4.glb"),
  "/star/people3d/toon-p5.glb": require("../../assets/3d/people3d/toon-p5.glb"),
  "/star/people3d/toon-p6.glb": require("../../assets/3d/people3d/toon-p6.glb"),
  "/star/people3d/anims.glb": require("../../assets/3d/people3d/anims.glb"),
  "/star/anims3d/football.glb": require("../../assets/3d/anims3d/football.glb"),
  "/star/anims3d/mocap.glb": require("../../assets/3d/anims3d/mocap.glb"),
  "/star/ovation3d/greetings.glb": require("../../assets/3d/ovation3d/greetings.glb"),
  "/star/garden3d/props.glb": require("../../assets/3d/garden3d/props.glb"),
  "/star/garden3d/horse.glb": require("../../assets/3d/garden3d/horse.glb"),
  "/star/garden3d/bird.glb": require("../../assets/3d/garden3d/bird.glb"),
  "/star/garden3d/anims.glb": require("../../assets/3d/garden3d/anims.glb"),
  "/star/garden3d/h/leaves.webp": require("../../assets/3d/garden3d/h/leaves.webp"),
  "/star/garden3d/h/needles.webp": require("../../assets/3d/garden3d/h/needles.webp"),
  "/star/garden3d/h/bark.webp": require("../../assets/3d/garden3d/h/bark.webp"),
  "/star/garden3d/h/bark-nrm.webp": require("../../assets/3d/garden3d/h/bark-nrm.webp"),
  "/star/garden3d/h/paving.webp": require("../../assets/3d/garden3d/h/paving.webp"),
  "/star/garden3d/h/paving-nrm.webp": require("../../assets/3d/garden3d/h/paving-nrm.webp"),
  "/star/garden3d/h/straw.webp": require("../../assets/3d/garden3d/h/straw.webp"),
  "/star/garden3d/h/straw-nrm.webp": require("../../assets/3d/garden3d/h/straw-nrm.webp"),
  "/star/garden3d/h/blooms.webp": require("../../assets/3d/garden3d/h/blooms.webp"),
  "/star/garden3d/h/tuft.webp": require("../../assets/3d/garden3d/h/tuft.webp"),
  "/star/h3d/grass-col.webp": require("../../assets/3d/h3d/grass-col.webp"),
  "/star/h3d/grass-nrm.webp": require("../../assets/3d/h3d/grass-nrm.webp"),
  "/star/h3d/grass-orh.webp": require("../../assets/3d/h3d/grass-orh.webp"),
  "/star/h3d/env-golden.hdr": require("../../assets/3d/h3d/env-golden.hdr"),
  "/star/h3d/env-night.hdr": require("../../assets/3d/h3d/env-night.hdr"),
  "/star/look/lut-golden.png": require("../../assets/3d/look/lut-golden.png"),
  "/star/look/lut-night.png": require("../../assets/3d/look/lut-night.png"),
  "/star/bake/garden/meta.json": require("../../assets/3d/bake/garden/meta.bin"),
  "/star/bake/garden/golden-vol.webp": require("../../assets/3d/bake/garden/golden-vol.webp"),
  "/star/bake/garden/golden-floor.webp": require("../../assets/3d/bake/garden/golden-floor.webp"),
  "/star/bake/garden/night-vol.webp": require("../../assets/3d/bake/garden/night-vol.webp"),
  "/star/bake/garden/night-floor.webp": require("../../assets/3d/bake/garden/night-floor.webp"),
  "/star/shop3d/items/car-1.glb": require("../../assets/3d/shop3d/items/car-1.glb"),
  "/star/shop3d/items/car-2.glb": require("../../assets/3d/shop3d/items/car-2.glb"),
  "/star/shop3d/items/car-suv.glb": require("../../assets/3d/shop3d/items/car-suv.glb"),
  "/star/shop3d/items/car-3.glb": require("../../assets/3d/shop3d/items/car-3.glb"),
  "/star/shop3d/items/car-classic.glb": require("../../assets/3d/shop3d/items/car-classic.glb"),
  "/star/shop3d/items/car-4.glb": require("../../assets/3d/shop3d/items/car-4.glb"),
  "/star/shop3d/items/bike-hf.glb": require("../../assets/3d/shop3d/items/bike-hf.glb"),
  "/star/shop3d/items/boot-classic-hf.glb": require("../../assets/3d/shop3d/items/boot-classic-hf.glb"),
  "/star/shop3d/items/boot-control-hf.glb": require("../../assets/3d/shop3d/items/boot-control-hf.glb"),
  "/star/shop3d/items/boot-elite-hf.glb": require("../../assets/3d/shop3d/items/boot-elite-hf.glb"),
  "/star/shop3d/items/boot-hf.glb": require("../../assets/3d/shop3d/items/boot-hf.glb"),
  "/star/shop3d/items/boot-maestro-hf.glb": require("../../assets/3d/shop3d/items/boot-maestro-hf.glb"),
  "/star/shop3d/items/boot-speed-hf.glb": require("../../assets/3d/shop3d/items/boot-speed-hf.glb"),
  "/star/shop3d/items/boot-starter-hf.glb": require("../../assets/3d/shop3d/items/boot-starter-hf.glb"),
  "/star/shop3d/items/can-kib-hf.glb": require("../../assets/3d/shop3d/items/can-kib-hf.glb"),
  "/star/shop3d/items/car-classic-hf.glb": require("../../assets/3d/shop3d/items/car-classic-hf.glb"),
  "/star/shop3d/items/car-family-hf.glb": require("../../assets/3d/shop3d/items/car-family-hf.glb"),
  "/star/shop3d/items/car-hatch-hf.glb": require("../../assets/3d/shop3d/items/car-hatch-hf.glb"),
  "/star/shop3d/items/car-sports-hf.glb": require("../../assets/3d/shop3d/items/car-sports-hf.glb"),
  "/star/shop3d/items/car-super-hf.glb": require("../../assets/3d/shop3d/items/car-super-hf.glb"),
  "/star/shop3d/items/car-suv-hf.glb": require("../../assets/3d/shop3d/items/car-suv-hf.glb"),
  "/star/shop3d/items/home-estate-hf.glb": require("../../assets/3d/shop3d/items/home-estate-hf.glb"),
  "/star/shop3d/items/home-flat1-hf.glb": require("../../assets/3d/shop3d/items/home-flat1-hf.glb"),
  "/star/shop3d/items/home-flat2-hf.glb": require("../../assets/3d/shop3d/items/home-flat2-hf.glb"),
  "/star/shop3d/items/home-house1-hf.glb": require("../../assets/3d/shop3d/items/home-house1-hf.glb"),
  "/star/shop3d/items/home-house2-hf.glb": require("../../assets/3d/shop3d/items/home-house2-hf.glb"),
  "/star/shop3d/items/home-island-hf.glb": require("../../assets/3d/shop3d/items/home-island-hf.glb"),
  "/star/shop3d/items/home-penthouse-hf.glb": require("../../assets/3d/shop3d/items/home-penthouse-hf.glb"),
  "/star/shop3d/items/home-stable-hf.glb": require("../../assets/3d/shop3d/items/home-stable-hf.glb"),
  "/star/shop3d/items/home-villa-hf.glb": require("../../assets/3d/shop3d/items/home-villa-hf.glb"),
  "/star/shop3d/items/jet-hf.glb": require("../../assets/3d/shop3d/items/jet-hf.glb"),
  "/star/shop3d/items/jewel-diamond-hf.glb": require("../../assets/3d/shop3d/items/jewel-diamond-hf.glb"),
  "/star/shop3d/items/jewel-silver-hf.glb": require("../../assets/3d/shop3d/items/jewel-silver-hf.glb"),
  "/star/shop3d/items/watch-gold-hf.glb": require("../../assets/3d/shop3d/items/watch-gold-hf.glb"),
  "/star/shop3d/items/watch-luxury-hf.glb": require("../../assets/3d/shop3d/items/watch-luxury-hf.glb"),
  "/star/shop3d/items/watch-smart-hf.glb": require("../../assets/3d/shop3d/items/watch-smart-hf.glb"),
  "/star/shop3d/h/parquet.webp": require("../../assets/3d/shop3d/h/parquet.webp"),
  "/star/shop3d/h/parquet-nrm.webp": require("../../assets/3d/shop3d/h/parquet-nrm.webp"),
  "/star/shop3d/h/planks.webp": require("../../assets/3d/shop3d/h/planks.webp"),
  "/star/shop3d/h/planks-nrm.webp": require("../../assets/3d/shop3d/h/planks-nrm.webp"),
  "/star/bake/shop/meta.json": require("../../assets/3d/bake/shop/meta.bin"),
  "/star/bake/shop/indoor-vol.webp": require("../../assets/3d/bake/shop/indoor-vol.webp"),
  "/star/bake/shop/indoor-floor.webp": require("../../assets/3d/bake/shop/indoor-floor.webp"),
  "/star/home3d/bike-lod.glb": require("../../assets/3d/home3d/bike-lod.glb"),
  "/star/home3d/boot-classic-lod.glb": require("../../assets/3d/home3d/boot-classic-lod.glb"),
  "/star/home3d/boot-control-lod.glb": require("../../assets/3d/home3d/boot-control-lod.glb"),
  "/star/home3d/boot-elite-lod.glb": require("../../assets/3d/home3d/boot-elite-lod.glb"),
  "/star/home3d/boot-maestro-lod.glb": require("../../assets/3d/home3d/boot-maestro-lod.glb"),
  "/star/home3d/boot-power-lod.glb": require("../../assets/3d/home3d/boot-power-lod.glb"),
  "/star/home3d/boot-speed-lod.glb": require("../../assets/3d/home3d/boot-speed-lod.glb"),
  "/star/home3d/boot-starter-lod.glb": require("../../assets/3d/home3d/boot-starter-lod.glb"),
  "/star/home3d/car-classic-lod.glb": require("../../assets/3d/home3d/car-classic-lod.glb"),
  "/star/home3d/car-family-lod.glb": require("../../assets/3d/home3d/car-family-lod.glb"),
  "/star/home3d/car-hatch-lod.glb": require("../../assets/3d/home3d/car-hatch-lod.glb"),
  "/star/home3d/car-sports-lod.glb": require("../../assets/3d/home3d/car-sports-lod.glb"),
  "/star/home3d/car-super-lod.glb": require("../../assets/3d/home3d/car-super-lod.glb"),
  "/star/home3d/car-suv-lod.glb": require("../../assets/3d/home3d/car-suv-lod.glb"),
  "/star/home3d/furniture.glb": require("../../assets/3d/home3d/furniture.glb"),
  "/star/home3d/jet-lod.glb": require("../../assets/3d/home3d/jet-lod.glb"),
  "/star/home3d/terrace-props.glb": require("../../assets/3d/home3d/terrace-props.glb"),
  "/star/anims3d/casino.glb": require("../../assets/3d/anims3d/casino.glb"),
  "/star/people3d/toon-p7.glb": require("../../assets/3d/people3d/toon-p7.glb"),
  "/star/people3d/toon-p8.glb": require("../../assets/3d/people3d/toon-p8.glb"),
  "/star/people3d/toon-p9.glb": require("../../assets/3d/people3d/toon-p9.glb"),
  "/star/people3d/hair/hair-h3-afro.glb": require("../../assets/3d/people3d/hair/hair-h3-afro.glb"),
  "/star/people3d/hair/hair-h3-braids.glb": require("../../assets/3d/people3d/hair/hair-h3-braids.glb"),
  "/star/people3d/hair/hair-h3-crew.glb": require("../../assets/3d/people3d/hair/hair-h3-crew.glb"),
  "/star/people3d/hair/hair-h3-curlyTop.glb": require("../../assets/3d/people3d/hair/hair-h3-curlyTop.glb"),
  "/star/people3d/hair/hair-h3-highTop.glb": require("../../assets/3d/people3d/hair/hair-h3-highTop.glb"),
  "/star/people3d/hair/hair-h3-locsBun.glb": require("../../assets/3d/people3d/hair/hair-h3-locsBun.glb"),
  "/star/people3d/hair/hair-h3-locsLong.glb": require("../../assets/3d/people3d/hair/hair-h3-locsLong.glb"),
  "/star/people3d/hair/hair-h3-locsShort.glb": require("../../assets/3d/people3d/hair/hair-h3-locsShort.glb"),
  "/star/people3d/hair/hair-h3-manBun.glb": require("../../assets/3d/people3d/hair/hair-h3-manBun.glb"),
  "/star/people3d/hair/hair-h3-mullet.glb": require("../../assets/3d/people3d/hair/hair-h3-mullet.glb"),
  "/star/people3d/hair/hair-h3-ponytail.glb": require("../../assets/3d/people3d/hair/hair-h3-ponytail.glb"),
  "/star/people3d/hair/hair-h3-receding.glb": require("../../assets/3d/people3d/hair/hair-h3-receding.glb"),
  "/star/people3d/hair/hair-h3-slickBack.glb": require("../../assets/3d/people3d/hair/hair-h3-slickBack.glb"),
  "/star/people3d/hair/hair-h3-thinning.glb": require("../../assets/3d/people3d/hair/hair-h3-thinning.glb"),
  "/star/people3d/hair/hair-h3-twists.glb": require("../../assets/3d/people3d/hair/hair-h3-twists.glb"),
  "/star/people3d/hair/hair-m2-afro.glb": require("../../assets/3d/people3d/hair/hair-m2-afro.glb"),
  "/star/people3d/hair/hair-m2-braids.glb": require("../../assets/3d/people3d/hair/hair-m2-braids.glb"),
  "/star/people3d/hair/hair-m2-crew.glb": require("../../assets/3d/people3d/hair/hair-m2-crew.glb"),
  "/star/people3d/hair/hair-m2-curlyTop.glb": require("../../assets/3d/people3d/hair/hair-m2-curlyTop.glb"),
  "/star/people3d/hair/hair-m2-highTop.glb": require("../../assets/3d/people3d/hair/hair-m2-highTop.glb"),
  "/star/people3d/hair/hair-m2-locsBun.glb": require("../../assets/3d/people3d/hair/hair-m2-locsBun.glb"),
  "/star/people3d/hair/hair-m2-locsLong.glb": require("../../assets/3d/people3d/hair/hair-m2-locsLong.glb"),
  "/star/people3d/hair/hair-m2-locsShort.glb": require("../../assets/3d/people3d/hair/hair-m2-locsShort.glb"),
  "/star/people3d/hair/hair-m2-manBun.glb": require("../../assets/3d/people3d/hair/hair-m2-manBun.glb"),
  "/star/people3d/hair/hair-m2-mullet.glb": require("../../assets/3d/people3d/hair/hair-m2-mullet.glb"),
  "/star/people3d/hair/hair-m2-ponytail.glb": require("../../assets/3d/people3d/hair/hair-m2-ponytail.glb"),
  "/star/people3d/hair/hair-m2-receding.glb": require("../../assets/3d/people3d/hair/hair-m2-receding.glb"),
  "/star/people3d/hair/hair-m2-slickBack.glb": require("../../assets/3d/people3d/hair/hair-m2-slickBack.glb"),
  "/star/people3d/hair/hair-m2-thinning.glb": require("../../assets/3d/people3d/hair/hair-m2-thinning.glb"),
  "/star/people3d/hair/hair-m2-twists.glb": require("../../assets/3d/people3d/hair/hair-m2-twists.glb"),
  "/star/trophies/ballon-dor.webp": require("../../assets/trophies/ballon-dor.webp"),
  "/star/trophies/champions-league.webp": require("../../assets/trophies/champions-league.webp"),
  "/star/trophies/championship.webp": require("../../assets/trophies/championship.webp"),
  "/star/trophies/europa-league.webp": require("../../assets/trophies/europa-league.webp"),
  "/star/trophies/fa-cup.webp": require("../../assets/trophies/fa-cup.webp"),
  "/star/trophies/golden-boot.webp": require("../../assets/trophies/golden-boot.webp"),
  "/star/trophies/league-cup.webp": require("../../assets/trophies/league-cup.webp"),
  "/star/trophies/league-one.webp": require("../../assets/trophies/league-one.webp"),
  "/star/trophies/league-two.webp": require("../../assets/trophies/league-two.webp"),
  "/star/trophies/national-league.webp": require("../../assets/trophies/national-league.webp"),
  "/star/trophies/player-of-the-month.webp": require("../../assets/trophies/player-of-the-month.webp"),
  "/star/trophies/player-of-the-season.webp": require("../../assets/trophies/player-of-the-season.webp"),
  "/star/trophies/premier-league.webp": require("../../assets/trophies/premier-league.webp"),
  "/star/trophies/world-cup.webp": require("../../assets/trophies/world-cup.webp"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const bytes = new Map<string, Promise<ArrayBuffer>>();
/** A bundled 3D file's bytes (read once per run of the app). */
export function bundledBytes(url: string): Promise<ArrayBuffer> {
  let p = bytes.get(url);
  if (!p) {
    const mod = FILES[url];
    if (mod === undefined) return Promise.reject(new Error(`3D: ${url} is not in the app (phone/src/three/assetList.ts)`));
    p = (async () => {
      const a = Asset.fromModule(mod);
      if (!a.localUri) await a.downloadAsync();
      const u8 = await readAssetBytes(a.localUri ?? a.uri);
      // a plain ArrayBuffer of exactly the file (three checks `instanceof ArrayBuffer` and reads from byte 0)
      return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength && u8.buffer instanceof ArrayBuffer ? u8.buffer : u8.slice().buffer;
    })();
    p.catch(() => bytes.delete(url));
    bytes.set(url, p);
  }
  return p;
}

let ready = false;
/** Set the phone's 3D surroundings (once). */
export function setupPhone3d(): void {
  if (ready) return;
  ready = true;
  setThreePlatform({ Skia, bytes: bundledBytes, fontFor: phoneFontFor });
}
