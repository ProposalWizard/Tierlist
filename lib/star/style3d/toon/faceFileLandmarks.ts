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
  "toon-d1": {"eyes":[[-0.045,1.6766,0.0159,0.011],[0.0409,1.677,0.0187,0.0103]],"iris":[[-0.0468,1.6803,0.0091],[0.0389,1.6803,0.0097]],"eyeZ":0.1367,"browY":1.7071,"nose":[-0.0056,1.6361,0.1797],"mouth":[0.0001,1.5953,0.0142,0.1593],"chinY":1.5489,"colors":{"white":"#cdc2ba","lid":"#a1613b","lash":"#3a281d"}},
  "toon-d2": {"eyes":[[-0.0415,1.6902,0.0146,0.0101],[0.0377,1.6905,0.0172,0.0095]],"iris":[[-0.0432,1.6936,0.0084],[0.0359,1.6936,0.0089]],"eyeZ":0.1274,"browY":1.7183,"nose":[-0.0051,1.6528,0.1671],"mouth":[0.0001,1.6152,0.0131,0.1483],"chinY":1.5724,"colors":{"white":"#cdc2ba","lid":"#a1613b","lash":"#3a281d"}},
  "toon-d3": {"eyes":[[-0.0433,1.6835,0.0153,0.0105],[0.0392,1.6839,0.0179,0.0099]],"iris":[[-0.0449,1.6871,0.0087],[0.0374,1.6871,0.0093]],"eyeZ":0.115,"browY":1.7128,"nose":[-0.0054,1.6446,0.1564],"mouth":[0.0001,1.6055,0.0136,0.1368],"chinY":1.5609,"colors":{"white":"#cdc2ba","lid":"#a1613b","lash":"#3a281d"}},
  "toon-d1-h3": {"eyes":[[-0.0526,1.6933,0.018,0.01],[0.0449,1.6933,0.0197,0.01]],"iris":[[-0.0515,1.6956,0.01],[0.0433,1.6956,0.0105]],"eyeZ":0.1448,"browY":1.7227,"nose":[-0.0061,1.6365,0.1931],"mouth":[-0.0001,1.5945,0.0332,0.173],"chinY":1.5332,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}},
  "toon-d2-h3": {"eyes":[[-0.0488,1.7046,0.0167,0.0093],[0.0416,1.7046,0.0183,0.0093]],"iris":[[-0.0478,1.7068,0.0093],[0.0402,1.7068,0.0098]],"eyeZ":0.1359,"browY":1.7319,"nose":[-0.0057,1.6519,0.1807],"mouth":[-0.0001,1.613,0.0308,0.1621],"chinY":1.5561,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}},
  "toon-d3-h3": {"eyes":[[-0.0507,1.699,0.0173,0.0096],[0.0432,1.699,0.019,0.0096]],"iris":[[-0.0496,1.7013,0.0096],[0.0417,1.7013,0.0101]],"eyeZ":0.1235,"browY":1.7274,"nose":[-0.0059,1.6443,0.1701],"mouth":[-0.0001,1.6039,0.032,0.1507],"chinY":1.5448,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}},
};
