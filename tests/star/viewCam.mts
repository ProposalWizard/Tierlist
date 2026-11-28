import { FOLLOW_CAM_D, FOLLOW_CAM_FAR, FollowBoom, boxRoom, capOnLine, riseForMin, zoomedFollowCam } from "../../lib/star/three3d/followCam";
import {
  BODY_SHOW_FROM, EYE_ABOVE_HEAD_BONE, EYE_HEIGHT, EYE_PITCH_MAX, EYE_PITCH_MIN, EYE_PITCH_REST, FIRST_FOV, VIEW_BLEND_S, VIEW_MODE_KEY,
  ViewCam, blendView, eyeHeightFor, eyePose, headWorld, loadViewMode, showBody, zoomForLens,
} from "../../lib/star/three3d/viewCam";

/**
 * FIRST PERSON | THIRD PERSON, AND CAMERA D ZOOMED OUT (Harry, 28 Nov 2026: "we need to
 * zoom out the camera a bit and add a toggle for first person"). Pure maths of
 * lib/star/three3d/viewCam.ts and the new camera D numbers in followCam.ts:
 *  1. distance: camera D stands further back and higher than before (2.5 m, 2.2 m up);
 *  2. walls: in the starter flat's smallest room and walking into a corner the boom
 *     pulls in and the camera never leaves the room;
 *  3. eyes: at his head, by his build (the Tall build's eyes are higher);
 *  4. the switch: 0.4 s, up and over his head, never through it; using something
 *     steps out to third person and back; remembered per device.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e;

// 1. distance
check(FOLLOW_CAM_D.back > 2.5 + 0.3, `camera D further back than 2.5 m (now ${FOLLOW_CAM_D.back})`);
check(FOLLOW_CAM_D.height > 2.2, `camera D higher than 2.2 m (now ${FOLLOW_CAM_D.height})`);
check(FOLLOW_CAM_D.back < FOLLOW_CAM_FAR.back && FOLLOW_CAM_D.height <= FOLLOW_CAM_FAR.height, "the zoom still goes further out than D");
check(zoomedFollowCam(0).back === FOLLOW_CAM_D.back && zoomedFollowCam(1).back === FOLLOW_CAM_FAR.back, "zoom 0 = D, zoom 1 = the furthest");
{
  // his whole body in the picture: from D, the top of his head and his feet both inside the upright phone's lens
  const fovV = FOLLOW_CAM_D.fov * Math.PI / 180;
  const pitch = Math.atan2(FOLLOW_CAM_D.height - FOLLOW_CAM_D.lookY, FOLLOW_CAM_D.back + FOLLOW_CAM_D.lookAhead);
  const toHead = Math.atan2(FOLLOW_CAM_D.height - 1.85, FOLLOW_CAM_D.back), toFeet = Math.atan2(FOLLOW_CAM_D.height, FOLLOW_CAM_D.back);
  check(toFeet - pitch < fovV / 2 && pitch - toHead < fovV / 2, `D: head and feet in the picture (feet ${((toFeet - pitch) * 180 / Math.PI).toFixed(1)}°, half lens ${(FOLLOW_CAM_D.fov / 2).toFixed(1)}°)`);
}

// 2. walls: a 3.2 x 3.4 m room (the starter flat's bathroom-sized room), walked into every corner
{
  const W2 = 1.6 - 0.3, D2 = 1.7 - 0.3;
  let worst = 0, outside = 0;
  for (const [px, pz] of [[0, 0], [1.1, 1.2], [-1.1, 1.2], [1.1, -1.2], [-1.1, -1.2], [0, 1.3]]) {
    for (let a = 0; a < 16; a++) {
      const yaw = (a / 16) * Math.PI * 2, dx = Math.sin(yaw), dz = Math.cos(yaw);
      const b = new FollowBoom();
      let len = 0;
      for (let f = 0; f < 60; f++) len = b.step(FOLLOW_CAM_D.back, boxRoom(px, pz, dx, dz, -W2, W2, -D2, D2), 1 / 30);
      const cam = { x: px + dx * len, z: pz + dz * len };
      if (Math.abs(cam.x) > W2 + 1e-6 || Math.abs(cam.z) > D2 + 1e-6) outside++;
      // an eased camera that lagged out past the wall is brought back along its own line
      const lag = { x: px + dx * FOLLOW_CAM_D.back, z: pz + dz * FOLLOW_CAM_D.back };
      capOnLine(lag, px, pz, (ux, uz) => boxRoom(px, pz, ux, uz, -W2, W2, -D2, D2));
      if (Math.abs(lag.x) > W2 + 1e-6 || Math.abs(lag.z) > D2 + 1e-6) outside++;
      worst = Math.max(worst, FOLLOW_CAM_D.back - len);
      // pulled in: it rises over him rather than sitting on his head, under a 2.4 m ceiling
      const y = riseForMin(len, FOLLOW_CAM_D.height, 2.4 - 0.15);
      check(y <= 2.25 + 1e-9, "walls: the camera stays under the ceiling");
    }
  }
  check(outside === 0, `walls: the camera never outside the room (${outside} times)`);
  check(worst > 1, `walls: the boom does pull in, in a small room (most ${worst.toFixed(2)} m)`);
}

// 3. eyes
check(near(eyeHeightFor(1), EYE_HEIGHT), "eyes: the usual build at EYE_HEIGHT");
check(eyeHeightFor(1.05) > eyeHeightFor(1) + 0.07, `eyes: the Tall build's eyes higher (${eyeHeightFor(1.05).toFixed(3)} m)`);
check(eyeHeightFor(1) > 1.5 && eyeHeightFor(1) < 1.75, "eyes: a man's eye height");
{
  // no head bone: from his feet; a head bone: from it (whatever his build or pose)
  const out = { x: 0, y: 0, z: 0 };
  headWorld(null, { position: { x: 1, y: 0, z: 2 }, scale: { x: 1, y: 1.05, z: 1 } }, out);
  check(near(out.y + EYE_ABOVE_HEAD_BONE, eyeHeightFor(1.05)) && out.x === 1 && out.z === 2, "eyes: no head bone, his feet plus his build's eye height");
  const bone = { getWorldPosition: (v: { x: number; y: number; z: number }) => { v.x = 3; v.y = 1.1; v.z = 4; return v; } }; // sat down
  headWorld(bone, { position: { x: 0, y: 0, z: 0 } }, out);
  check(out.y === 1.1 && out.x === 3, "eyes: the head bone wins (sat down, the eyes come down)");
  const eye = { x: 0, y: 0, z: 0 }, look = { x: 0, y: 0, z: 0 };
  eyePose({ x: 0, y: 1.55, z: 0 }, 0, -1, 0, eye, look);
  check(eye.z < 0 && near(eye.y, 1.55 + EYE_ABOVE_HEAD_BONE) && near(look.y, eye.y) && look.z < eye.z, "eyes: in front of his head, looking the way he faces");
  eyePose({ x: 0, y: 1.55, z: 0 }, 0, -1, 0.3, eye, look);
  check(look.y < eye.y, "eyes: a down drag looks down");
}

// 4. the switch
{
  const third = { x: 0, y: 2.6, z: 3.2 }, thirdLook = { x: 0, y: 1, z: -1.8 };
  const head = { x: 0, y: 1.55, z: 0 };
  const eye = { x: 0, y: 0, z: 0 }, eyeLook = { x: 0, y: 0, z: 0 };
  eyePose(head, 0, -1, EYE_PITCH_REST, eye, eyeLook);
  const pos = { x: 0, y: 0, z: 0 }, look = { x: 0, y: 0, z: 0 };
  blendView(third, thirdLook, eye, eyeLook, 0, 99, pos, look);
  check(near(pos.z, third.z) && near(pos.y, third.y), "switch: k 0 is the third-person camera");
  blendView(third, thirdLook, eye, eyeLook, 1, 99, pos, look);
  check(near(pos.z, eye.z) && near(pos.y, eye.y), "switch: k 1 is his eyes");
  // on the way: never inside his head until it arrives (up and over, not through)
  let nearest = 9;
  for (let k = 0; k <= 0.9; k += 0.01) {
    blendView(third, thirdLook, eye, eyeLook, k, 99, pos, look);
    const d = Math.hypot(pos.x - head.x, pos.y - head.y, pos.z - head.z);
    if (pos.z > 0.15) nearest = Math.min(nearest, d); // behind his face
  }
  check(nearest > 0.3, `switch: over his head, not through it (nearest ${nearest.toFixed(2)} m from his head while behind it)`);
  // a low ceiling holds it down
  blendView(third, thirdLook, eye, eyeLook, 0.5, 2.3, pos, look);
  check(pos.y <= 2.3 + 1e-9, "switch: never through the ceiling");

  const v = new ViewCam("third", false);
  v.set("first");
  let t = 0, frames = 0;
  while (v.k < 1 && frames < 200) { v.step(1 / 60); t += 1 / 60; frames++; }
  check(Math.abs(t - VIEW_BLEND_S) < 0.03, `switch: ${VIEW_BLEND_S} s (took ${t.toFixed(2)} s)`);
  check(v.inEyes && !v.moving, "switch: arrived and still");
  // using something: out to third person, then back in
  for (let i = 0; i < 30; i++) v.step(1 / 60, true);
  check(v.k === 0 && v.first, "switch: using something steps out to third person (still first person chosen)");
  for (let i = 0; i < 30; i++) v.step(1 / 60, false);
  check(v.k === 1, "switch: and back into his eyes after");
  // switched back mid-way: it turns round smoothly from where it is
  v.set("third"); v.step(0.1); const mid = v.k; v.set("first"); v.step(1 / 60);
  check(mid > 0 && mid < 1 && Math.abs(v.k - mid) < 0.1, "switch: changed mind half-way, no jump");
  // the drag tilts the eyes, within limits, and only in first person
  for (let i = 0; i < 40; i++) v.drag(60); for (let i = 0; i < 120; i++) v.step(1 / 60);
  check(v.pitch <= EYE_PITCH_MAX + 1e-9 && v.pitch > EYE_PITCH_MAX - 0.05, "switch: look down, held at the limit");
  for (let i = 0; i < 80; i++) v.drag(-60); for (let i = 0; i < 120; i++) v.step(1 / 60);
  check(v.pitch >= EYE_PITCH_MIN - 1e-9, "switch: look up, held at the limit");
  const v3 = new ViewCam("third", false); v3.drag(300); v3.step(1);
  check(v3.pitch === EYE_PITCH_REST, "switch: third person ignores the eyes' tilt");
  // the lens: wider in his eyes, untouched in third person
  check(zoomForLens(56, 0) === 1 && zoomForLens(56, 1) < 1 && near(2 * Math.atan(Math.tan(28 * Math.PI / 180) / zoomForLens(56, 1)) * 180 / Math.PI, FIRST_FOV, 1e-6), "lens: first person's own wider lens");
  // he is hidden only with the camera inside his head
  const cam = { position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } }, lookAt: () => {}, fov: 56, aspect: 0.46, zoom: 1, updateProjectionMatrix: () => {} };
  const w = new ViewCam("first", false);
  check(!w.place(cam, third, thirdLook, head, 0, -1, 99, 1 / 60), "body: hidden in his eyes");
  const w0 = new ViewCam("third", false);
  check(w0.place(cam, third, thirdLook, head, 0, -1, 99, 1 / 60) && cam.zoom === 1, "body: shown in third person, lens as it was");
  check(BODY_SHOW_FROM > 0.3, "body: hidden only near his head");
}

// hiding him never touches root.visible (the world kit reads it as "here or away": hiding it froze his walk)
{
  const root = { visible: true, children: [{ visible: true }, { visible: false }, { visible: true }] };
  showBody(root, false); showBody(root, false);
  check(root.visible && root.children.every((c) => !c.visible), "body: hidden by its parts, the root still 'here'");
  showBody(root, true);
  check(root.children.map((c) => c.visible).join() === "true,false,true", "body: shown again as it was (an outline left off stays off)");
}

// toggle memory (per device)
{
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  check(loadViewMode() === "third", "memory: third person until chosen");
  const v = new ViewCam(loadViewMode());
  v.toggle();
  check(store.get(VIEW_MODE_KEY) === "first" && loadViewMode() === "first", "memory: first person remembered");
  check(new ViewCam(loadViewMode()).k === 1, "memory: the next place opens in his eyes");
  v.toggle();
  check(loadViewMode() === "third", "memory: back to third remembered");
  (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  check(loadViewMode() === "third", "memory: blocked storage = third person, no crash");
  new ViewCam("third").toggle();
}

if (problems.length) { console.error("FAIL viewCam\n- " + problems.join("\n- ")); process.exit(1); }
console.log(`PASS viewCam (camera D ${FOLLOW_CAM_D.back} m back, ${FOLLOW_CAM_D.height} m up; switch ${VIEW_BLEND_S} s)`);
