/**
 * EVERY 3D FILE THE PHONE BUNDLES, by its website address. The files are
 * copies of the website's (public/star/…, byte for byte: tools/three-check.ts
 * checks) in phone/assets/3d/…, so the phone reads exactly what the website
 * reads. ./assets.ts maps each address to the bundled file. Only the files the
 * phone's 3D places use: the Home and title player, the card headshots, the
 * guard of honour, the standing ovation and the garden.
 */
export const THREE_ASSET_URLS: readonly string[] = [
  "/star/people3d/toon-p1.glb",
  "/star/people3d/toon-p2.glb",
  "/star/people3d/toon-p3.glb",
  "/star/people3d/toon-p4.glb",
  "/star/people3d/toon-p5.glb",
  "/star/people3d/toon-p6.glb",
  "/star/people3d/anims.glb",
  "/star/anims3d/football.glb",
  "/star/anims3d/mocap.glb",
  "/star/ovation3d/greetings.glb",
  // the garden (the walk-around host: ./walkHost.ts); props and cars are unpacked copies (tools/garden-props-unpack.mjs)
  "/star/garden3d/props.glb",
  "/star/garden3d/horse.glb",
  "/star/garden3d/bird.glb",
  "/star/garden3d/anims.glb",
  "/star/garden3d/h/leaves.webp",
  "/star/garden3d/h/needles.webp",
  "/star/garden3d/h/bark.webp",
  "/star/garden3d/h/bark-nrm.webp",
  "/star/garden3d/h/paving.webp",
  "/star/garden3d/h/paving-nrm.webp",
  "/star/garden3d/h/straw.webp",
  "/star/garden3d/h/straw-nrm.webp",
  "/star/garden3d/h/blooms.webp",
  "/star/garden3d/h/tuft.webp",
  "/star/h3d/grass-col.webp",
  "/star/h3d/grass-nrm.webp",
  "/star/h3d/grass-orh.webp",
  "/star/h3d/env-golden.hdr",
  "/star/h3d/env-night.hdr",
  "/star/look/lut-golden.png",
  "/star/look/lut-night.png",
  "/star/bake/garden/meta.json",
  "/star/bake/garden/golden-vol.webp",
  "/star/bake/garden/golden-floor.webp",
  "/star/bake/garden/night-vol.webp",
  "/star/bake/garden/night-floor.webp",
  "/star/shop3d/items/car-1.glb",
  "/star/shop3d/items/car-2.glb",
  "/star/shop3d/items/car-suv.glb",
  "/star/shop3d/items/car-3.glb",
  "/star/shop3d/items/car-classic.glb",
  "/star/shop3d/items/car-4.glb",
];
