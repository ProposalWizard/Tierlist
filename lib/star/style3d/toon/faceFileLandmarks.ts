/**
 * WHERE THE FACE IS ON A BODY FILE BEING JUDGED (bodies.ts TOON_BODY_SETS),
 * keyed by the file's model name (its extras.model, e.g. "toon-q1"). Read
 * before the head's own TOON_FACE_LANDMARKS, so a judged body never wears
 * another head's eyes. Measured off the file's own picture by the bench's
 * Faces page (`/star-3d-bench-dev/faces?files=/star/people3d/toon-q1.glb`) and
 * written here by `node scripts/bench3d/faces.mjs --files=… --write`.
 * Do not edit by hand: measure again.
 */
import type { ToonFaceLandmarks } from "./faceLandmarks";

export const TOON_FACE_FILE_LANDMARKS: Record<string, ToonFaceLandmarks> = {
  "toon-q1": {"eyes":[[-0.0372,1.6917,0.0136,0.0058],[0.0366,1.6926,0.0128,0.0069]],"iris":[[-0.0371,1.693,0.0069],[0.0351,1.6942,0.0078]],"eyeZ":0.1165,"browY":1.7145,"nose":[-0.004,1.6501,0.1543],"mouth":[0.0004,1.6275,0.0262,0.1362],"chinY":1.5765,"colors":{"white":"#c3c7cb","lid":"#ae6b3f","lash":"#322119"}},
  "toon-f2": {"eyes":[[-0.038,1.6745,0.0136,0.0099],[0.0339,1.6744,0.0152,0.0092]],"iris":[[-0.0389,1.6781,0.0087],[0.0326,1.6766,0.0087]],"eyeZ":0.0466,"browY":1.7011,"nose":[-0.004,1.6385,0.0806],"mouth":[0.0016,1.6039,0.0108,0.0662],"chinY":1.5689,"colors":{"white":"#cbc5c1","lid":"#a1643b","lash":"#37261b"}},
  "toon-f3": {"eyes":[[-0.04,1.665,0.0144,0.0104],[0.0357,1.6648,0.0164,0.0096]],"iris":[[-0.0411,1.6689,0.0091],[0.0344,1.6674,0.009]],"eyeZ":0.0607,"browY":1.6929,"nose":[-0.006,1.6275,0.0955],"mouth":[0.0008,1.5921,0.0124,0.0792],"chinY":1.5571,"colors":{"white":"#ccc5c0","lid":"#a1633c","lash":"#38261a"}},
};
