/**
 * EVERY 3D FILE THE PHONE BUNDLES, by its website address. The files are
 * copies of the website's (public/star/…, byte for byte: tools/three-check.ts
 * checks) in phone/assets/3d/…, so the phone reads exactly what the website
 * reads. ./assets.ts maps each address to the bundled file. Only the files the
 * phone's 3D places use: the Home and title player, the card headshots, the
 * guard of honour and the standing ovation.
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
];
