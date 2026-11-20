/**
 * PEOPLE PRESETS (lib/star/people/presets.ts): the same id always gets the same look; many ids
 * get many looks; a typical scene's five suits never share a head and coat; the whole skin range
 * is used; managers older than players; bald and shaved only on close-cut heads; known managers
 * keep bald and beard.
 */
import {
  personLook, castScene, lookKey, presetsFor, STAFF_PRESETS, PLAYER_PRESETS, ALL_PRESETS, CUTS, CLOSE_CUT_HEADS, PATTERN_HEADS, beardOf,
  HERITAGE, styleTextures,
  type PersonRole,
} from "../../lib/star/people/presets";
import { SKIN_TONES } from "../../lib/star/playerIdentity";
import { TOON_ALL_HEADS, TOON_PLAYER_HEADS, TOON_SHAPE_HEADS, toonHeadIsSuit, toonHeadFor } from "../../lib/star/style3d/toon/bodies";
import { TOON_HAIRS, TOON_HAIR_INFO, COILY_HAIRS, toonHairFits, toonHairFile, type ToonHair } from "../../lib/star/style3d/toon/hairStyles";
import fs from "node:fs";
import { TOON_FACE_TYPES, TOON_FACE_IDS, HERITAGE_FACES, faceFor, faceFrame, faceShapePoint, faceZone, faceOutlineZone } from "../../lib/star/style3d/toon/faceShape";
import { TOON_FACE_LANDMARKS } from "../../lib/star/style3d/toon/faceLandmarks";
import { managerLook } from "../../lib/star/managerFace";
import { faceIdFor, faceIdKey, FACE_LIMITS, HERITAGE_FEATURES, FACE_EMOTIONS, EMOTION_NAMES, blendEmotions, NEUTRAL_EMOTION } from "../../lib/star/style3d/toon/faceId";
import { presetById } from "../../lib/star/people/presets";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const sig = (l: ReturnType<typeof personLook>) => JSON.stringify([l.preset, l.head, l.build, l.skin, l.hairColour, l.cut, l.hairMesh, l.face, l.faceK, l.suit, l.kit, l.accessories, l.age]);

// 1. Library size and shape
const mgrStaff = STAFF_PRESETS.filter((p) => p.roles.includes("manager") || p.roles.includes("staff"));
check(mgrStaff.length >= 24, `only ${mgrStaff.length} manager/staff presets (want 24+)`);
check(PLAYER_PRESETS.length >= 72, `only ${PLAYER_PRESETS.length} player presets (want 72+)`);
check(new Set(ALL_PRESETS.map((p) => p.id)).size === ALL_PRESETS.length, "two presets share an id");
check(new Set(ALL_PRESETS.map((p) => p.name)).size === ALL_PRESETS.length, "two presets share a name");
for (const p of ALL_PRESETS) {
  check(TOON_ALL_HEADS.includes(p.head), `${p.id}: head ${p.head} is not a Style A head`);
  check(p.outfit !== "kit" || !toonHeadIsSuit(p.head), `${p.id}: a kit on a suit head`);
  check(CUTS[p.cut].scalp === 0 || CLOSE_CUT_HEADS.includes(p.head), `${p.id}: bald/shaved on ${p.head}, whose hair is not close cut`);
  check(p.skin >= 0 && p.skin < 8, `${p.id}: skin index ${p.skin}`);
}
// 1b. Hair texture follows heritage, and a style only goes on hair it suits (Harry, 20 Nov 2026:
//     "an assistant manager who's black with a quiff that would only really happen on a white guy")
const STRAIGHT_ONLY = ["h2", "h4", "h5", "m1"];
for (const p of ALL_PRESETS) {
  const H = HERITAGE[p.heritage];
  const cut = CUTS[p.cut];
  check(H.textures.includes(p.texture), `${p.id}: ${p.texture} hair is not a ${p.heritage} texture`);
  check(styleTextures(p.head, cut, p.hairMesh).includes(p.texture), `${p.id}: ${p.head}/${p.cut}/${p.hairMesh ?? "own hair"} does not suit ${p.texture} hair`);
  // a modelled hairstyle: only on a head that wears one; locs, afro, high-top, twists and braids only on coily hair,
  // so only on Black and mixed-race people; the straight styles never on coily hair
  if (p.hairMesh) {
    check(toonHairFits(p.head), `${p.id}: ${p.hairMesh} on ${p.head}, which wears no modelled hair`);
    check(TOON_HAIR_INFO[p.hairMesh].textures.includes(p.texture), `${p.id}: ${p.hairMesh} on ${p.texture} hair`);
    if (COILY_HAIRS.includes(p.hairMesh)) check(p.texture === "coily" && (p.heritage === "black" || p.heritage === "mixed"), `${p.id}: ${p.hairMesh} on a ${p.heritage} person with ${p.texture} hair`);
    if (p.texture === "coily") check(TOON_HAIR_INFO[p.hairMesh].textures.includes("coily"), `${p.id}: coily hair in ${p.hairMesh}`);
  }
  check(p.skin >= H.skin[0] && p.skin <= H.skin[1], `${p.id}: skin ${p.skin} outside ${p.heritage}'s range`);
  check(H.hair.includes(p.hair), `${p.id}: hair ${p.hair} is not a ${p.heritage} colour`);
  if (p.texture === "coily") check(!STRAIGHT_ONLY.includes(p.head) && !(p.head === "h6" && cut.scalp < 0.9), `${p.id}: coily hair in a straight-hair style (${p.head})`);
  if (p.texture === "straight" || p.texture === "wavy") check(p.head !== "h1" && !cut.pattern, `${p.id}: ${p.texture} hair in a curly/coily style (${p.head} ${p.cut})`);
  check(!cut.pattern || PATTERN_HEADS.includes(p.head), `${p.id}: a pattern on ${p.head}, not a close crop`);
}
for (const h of Object.keys(HERITAGE) as (keyof typeof HERITAGE)[]) {
  const mine = ALL_PRESETS.filter((p) => p.heritage === h);
  check(mine.length >= 3, `only ${mine.length} presets of heritage ${h}`);
  check(new Set(mine.map((p) => `${p.head}|${p.cut}`)).size >= Math.min(4, mine.length), `heritage ${h}: too few distinct styles`);
}
// every dark-skinned or mixed person anyone gets wears coily/curly-suited hair (never a quiff, bun or fringe)
for (const role of ["manager", "staff", "player", "agent", "journalist", "fan"] as PersonRole[]) {
  for (let i = 0; i < 300; i++) {
    const l = personLook(`h${i}`, role);
    const p = ALL_PRESETS.find((x) => x.id === l.preset)!;
    const sk = SKIN_TONES.findIndex((t) => t.id === l.skinId);
    check(sk >= HERITAGE[p.heritage].skin[0] && sk <= HERITAGE[p.heritage].skin[1], `${role} h${i}: skin left ${p.heritage}'s range`);
    if (p.heritage === "black" || p.heritage === "mixed") check(!STRAIGHT_ONLY.includes(l.head), `${role} h${i}: ${p.heritage} with ${l.head}`);
  }
}

// 1c. The modelled hairstyles and the new head shapes are all in use, and every file is there
for (const want of ["locsShort", "locsLong", "locsBun", "afro", "highTop", "twists", "braids"] as ToonHair[]) check(COILY_HAIRS.includes(want), `${want} is not a coily-only style`);
for (const h of TOON_HAIRS) {
  check(ALL_PRESETS.some((p) => p.hairMesh === h), `no preset wears ${h}`);
  for (const head of ["h3", "m2"] as const) check(fs.existsSync(`public${toonHairFile(h, head)}`), `missing ${toonHairFile(h, head)}`);
}
for (const h of COILY_HAIRS) check(PLAYER_PRESETS.some((p) => p.hairMesh === h), `no player wears ${h}`);
for (const h of TOON_SHAPE_HEADS) check(ALL_PRESETS.some((p) => p.head === h), `no preset has the ${h} head`);
// nobody in the game changes: the seeded pools still hold only the first eight heads
for (let i = 0; i < 400; i++) check(!TOON_SHAPE_HEADS.includes(toonHeadFor(`g${i}`)) && !TOON_SHAPE_HEADS.includes(toonHeadFor(`g${i}`, true)), `a seeded pick gave a new head shape`);
// every person anyone gets: his modelled hair suits his texture, and thinning or receding hair is never called bald
for (const role of ["manager", "staff", "player", "agent", "journalist", "fan"] as PersonRole[]) {
  for (let i = 0; i < 300; i++) {
    const l = personLook(`m${i}`, role);
    const p = ALL_PRESETS.find((x) => x.id === l.preset)!;
    if (!l.hairMesh) continue;
    check(TOON_HAIR_INFO[l.hairMesh].textures.includes(p.texture) && l.dress.hairMesh === l.hairMesh, `${role} m${i}: ${l.hairMesh} on ${p.texture} hair`);
    check(l.hairStyle !== "none" && l.cut.scalp === Math.max(CUTS[p.cut].scalp, TOON_HAIR_INFO[l.hairMesh].scalp), `${role} m${i}: ${l.hairMesh} scalp`);
  }
}

// 1d. Face types: several per heritage, every one used, the same id the same face, and the rule never moves
//     the skull, the ears, the sides or the back of the head (where the modelled hair sits)
check(TOON_FACE_IDS.length >= 17, `only ${TOON_FACE_IDS.length} face types`);
for (const h of Object.keys(HERITAGE) as (keyof typeof HERITAGE)[]) {
  const pool = HERITAGE_FACES[h];
  check(!!pool && new Set(pool).size >= 4, `heritage ${h}: fewer than 4 face types`);
  const got = new Set(Array.from({ length: 300 }, (_, i) => faceFor(`f${i}`, h).face));
  check(got.size === new Set(pool).size, `heritage ${h}: 300 people used ${got.size} of ${new Set(pool).size} faces`);
  for (const f of pool ?? []) check(!!TOON_FACE_TYPES[f], `heritage ${h}: unknown face ${f}`);
}
for (const f of TOON_FACE_IDS) check(f === "base" || Object.values(HERITAGE_FACES).some((p) => p.includes(f)), `face ${f} is in no heritage's list`);
for (let i = 0; i < 200; i++) {
  const a = personLook(`face${i}`, "player"), b = personLook(`face${i}`, "player");
  const p = ALL_PRESETS.find((x) => x.id === a.preset)!;
  check(a.face === b.face && a.faceK === b.faceK, `face${i}: the face changed between calls`);
  check(HERITAGE_FACES[p.heritage].includes(a.face) && a.faceK >= 0.8 && a.faceK <= 1.2, `face${i}: ${a.face} x${a.faceK} is not a ${p.heritage} face`);
}
check(new Set(Array.from({ length: 200 }, (_, i) => { const l = personLook(`v${i}`, "player"); return `${l.head}|${l.face}`; })).size >= 40, "200 players: fewer than 40 head-and-face pairs");
{
  // the kit hair head (h3) and the suit hair head (m2): their files' own faces (extras.face, kit.collarY)
  const frames = [
    faceFrame(TOON_FACE_LANDMARKS.h3!, { chinY: 1.5328, eyeY: 1.676, browY: 1.6945, frontZ: 0.1931 }, 1.5067),
    faceFrame(TOON_FACE_LANDMARKS.m2!, { chinY: 1.5096, eyeY: 1.6626, browY: 1.6827, frontZ: 0.2132 }, 1.4296),
  ];
  let most = 0, moved = 0;
  for (const F of frames) for (const f of TOON_FACE_IDS) for (let ix = -4; ix <= 4; ix++) for (let iy = 0; iy <= 16; iy++) for (let iz = -5; iz <= 11; iz++) {
    const q: [number, number, number] = [ix * 0.02, 1.5 + iy * 0.022, iz * 0.02];
    const o = faceShapePoint(q, F, TOON_FACE_TYPES[f].shape, 1.2);
    const d = Math.hypot(o[0] - q[0], o[1] - q[1], o[2] - q[2]);
    most = Math.max(most, d);
    if (d > 0) moved++;
    // above the brow, on and behind the ears, the sides above the ears' lobes, below the chin: nothing moves
    if (q[1] > F.browY + 0.015 || q[2] < F.frontZ - 0.19 || q[1] < F.chinY - 0.04 || (q[2] < F.frontZ - 0.125 && q[1] > F.eyeY - 0.05)) check(d === 0 && faceZone(q, F) === 0 && faceOutlineZone(q, F) === 0, `face ${f}: moved the head outside the face at ${q.join(", ")}`);
  }
  check(moved > 500 && most > 0.003 && most < 0.05, `face types move the face by at most ${(most * 1000).toFixed(1)} mm (want 3 to 50, on a grid that also samples the air round the face)`);
  console.log(`  face types: ${TOON_FACE_IDS.length}, the largest move ${(most * 1000).toFixed(1)} mm, nothing outside the face`);
}

const playerKeys = new Set(PLAYER_PRESETS.map((p) => `${p.head}|${p.cut}|${p.hairMesh ?? ""}|${p.build}|${p.skin}|${p.hair}`));
check(PLAYER_PRESETS.filter((p) => p.heritage === "black" || p.heritage === "mixed").length >= 24, "too few Black and mixed-race players");
check(playerKeys.size === PLAYER_PRESETS.length, `player presets: ${PLAYER_PRESETS.length - playerKeys.size} are the same look`);
for (let s = 0; s < 8; s++) {
  check(PLAYER_PRESETS.some((p) => p.skin === s), `no player preset at skin ${SKIN_TONES[s].label}`);
  check(mgrStaff.some((p) => p.skin === s), `no manager/staff preset at skin ${SKIN_TONES[s].label}`);
}

// 2. Same id, same look (and across roles the call is pure)
for (const role of ["manager", "staff", "player", "journalist", "agent", "fan"] as PersonRole[]) {
  for (const id of ["boss", "chairman", "Bukayo Saka", "signing-manager", "", "squad-17"]) {
    check(sig(personLook(id, role, { club: "Arsenal" })) === sig(personLook(id, role, { club: "Arsenal" })), `${role} "${id}" changed between calls`);
  }
  check(presetsFor(role).length > 0, `no presets for ${role}`);
}

// 3. Variety: 100 ids → many distinct looks
const N_DISTINCT = { player: 80, manager: 60 } as const;
for (const role of ["player", "manager"] as const) {
  const looks = Array.from({ length: 100 }, (_, i) => personLook(`${role}-${i * 37 + 11}`, role, { club: "Arsenal" }));
  const distinct = new Set(looks.map(sig)).size;
  check(distinct >= N_DISTINCT[role], `${role}: 100 ids gave only ${distinct} distinct looks (want ${N_DISTINCT[role]}+)`);
  const presets = new Set(looks.map((l) => l.preset)).size;
  check(presets >= (role === "player" ? 35 : 15), `${role}: 100 ids used only ${presets} presets`);
  const skins = new Set(looks.map((l) => l.skinId));
  check(skins.size === 8, `${role}: 100 ids covered only ${skins.size} of 8 skin tones`);
  const heads = new Set(looks.map((l) => l.head));
  check(heads.size >= (role === "player" ? 6 : 5), `${role}: only ${heads.size} heads`);
  console.log(`  ${role}: 100 ids → ${distinct} distinct looks, ${presets} presets, ${heads.size} heads, ${skins.size} skin tones`);
}

// 4. Ages: managers older on average; players 17 to 38
const avgAge = (role: PersonRole) => { const a = Array.from({ length: 200 }, (_, i) => personLook(`a${i}`, role).age); return a.reduce((s, x) => s + x, 0) / a.length; };
const am = avgAge("manager"), ap = avgAge("player");
check(am > ap + 12, `managers (${am.toFixed(1)}) not clearly older than players (${ap.toFixed(1)})`);
for (let i = 0; i < 300; i++) { const a = personLook(`p${i}`, "player").age; check(a >= 17 && a <= 38, `player age ${a}`); }
const greyMgr = Array.from({ length: 200 }, (_, i) => personLook(`g${i}`, "manager")).filter((l) => l.grey > 0.4).length;
check(greyMgr > 50, `only ${greyMgr} of 200 managers greying`);
const bald = Array.from({ length: 200 }, (_, i) => personLook(`b${i}`, "manager")).filter((l) => l.hairStyle === "none").length;
check(bald >= 15, `only ${bald} of 200 managers bald`);
const beards = Array.from({ length: 200 }, (_, i) => personLook(`b${i}`, "manager")).filter((l) => l.beard !== "none").length;
check(beards >= 100, `only ${beards} of 200 managers with a beard or stubble`);

// 5. A typical scene: boss, chairman, agent, journalist, manager never share head + coat
const scene = (club: string, n: string) => castScene([
  { id: `boss${n}`, role: "manager", club }, { id: `chairman${n}`, role: "staff", club }, { id: `agent${n}`, role: "agent", club },
  { id: `journalist${n}`, role: "journalist", club }, { id: `signing-manager${n}`, role: "manager", club },
]);
for (const [club, n] of [["Arsenal", ""], ["Chelsea", ""], ["Wrexham", ""], ["Everton", "-2"], ["Barnet", "#7"]]) {
  const s = scene(club, n);
  check(new Set(s.map(lookKey)).size === s.length, `${club}${n}: two of the five share a head and coat (${s.map(lookKey).join(", ")})`);
  check(new Set(s.map((l) => l.preset)).size === s.length, `${club}${n}: two of the five share a preset`);
}
let clash = 0;
for (let i = 0; i < 500; i++) { const s = scene("Arsenal", `-${i}`); if (new Set(s.map(lookKey)).size < s.length) clash++; }
check(clash === 0, `${clash} of 500 five-person scenes had two people sharing head and coat`);
// a squad of 25: castScene gives everyone a different preset
const squad = castScene(Array.from({ length: 25 }, (_, i) => ({ id: `Chelsea #${i}`, role: "player" as const, club: "Chelsea" })));
check(new Set(squad.map((l) => l.preset)).size === 25, "a squad of 25 had two players on one preset");
check(squad.every((l) => l.kit?.shirt === squad[0].kit?.shirt), "a squad wore different kits");

// 6. Known managers keep their broad strokes
for (const name of ["Pep Guardiola", "Mikel Arteta", "Jurgen Klopp", "Thomas Tuchel", "Sean Dyche", "Eddie Howe"]) {
  const k = managerLook(name);
  const l = personLook(name, "manager", { known: k });
  check((k.hair === "bald") === (l.hairStyle === "none"), `${name}: bald ${k.hair === "bald"} but look ${l.hairStyle}`);
  check((k.beard === "none") === (l.beard === "none"), `${name}: beard ${k.beard} but look ${l.beard}`);
  check(l.dress.grey === 0 && /^#[0-9a-f]{6}$/.test(l.hairColour), `${name}: hair colour not final (${l.hairColour})`);
}

// 7. Shape of the result: kit for players, a suit for the rest; beard words agree with the cut
for (let i = 0; i < 100; i++) {
  const p = personLook(`x${i}`, "player", { club: "Liverpool" });
  check(!!p.kit && !p.suit && p.accessories.some((a) => a.slot === "boots"), `player x${i}: no kit or boots`);
  const m = personLook(`x${i}`, "manager", { club: "Liverpool" });
  check(!!m.suit && !m.kit, `manager x${i}: no suit`);
  check(m.beard === beardOf(m.head, m.cut), `manager x${i}: beard word disagrees`);
}

// THE FACE SYSTEM (style3d/toon/faceId.ts): the same id → the same face; features only from his heritage's
// pools and every number inside FACE_LIMITS (RUL-3D-010: never caricature); many different faces; 8 emotions
{
  const looks = Array.from({ length: 500 }, (_, i) => personLook(`player-${i}`, "player", { club: "Arsenal" }));
  const inR = (x: number, r: readonly number[]) => x >= r[0] - 1e-9 && x <= r[1] + 1e-9;
  for (const l of looks) {
    const f = l.faceId, her = presetById(l.preset)!.heritage, H = HERITAGE_FEATURES[her];
    check(JSON.stringify(f) === JSON.stringify(personLook(l.id, "player", { club: "Arsenal" }).faceId), `face ${l.id}: not the same face twice`);
    check(H.eyes.some(([e]) => e === f.eyeShape) && H.brows.some(([b]) => b === f.browStyle), `face ${l.id}: an eye or brow shape outside ${her}'s`);
    check(H.iris.some(([c]) => c === f.irisName) || her === "white", `face ${l.id}: iris ${f.irisName} outside ${her}'s`);
    for (const k of ["eyeW", "eyeUp", "eyeLow", "eyeTilt", "eyeGap", "irisR", "browH", "browT", "browArch", "browTilt", "browLen", "mouthW", "lipUp", "lipLow"] as const) check(inR(f[k], FACE_LIMITS[k]), `face ${l.id}: ${k} ${f[k]} outside its limits`);
    for (const [k, r] of Object.entries(FACE_LIMITS.shape)) check(inR((f.shape as unknown as Record<string, number>)[k], r), `face ${l.id}: mould ${k} outside its limits`);
    check((f.beardStyle === "none") === (l.beard === "none"), `face ${l.id}: beard ${f.beardStyle} against the look's ${l.beard}`);
    check(/^#[0-9a-f]{6}$/.test(f.iris) && /^#[0-9a-f]{6}$/.test(f.lip) && /^#[0-9a-f]{6}$/.test(f.brow), `face ${l.id}: a colour is not a hex`);
  }
  const words = new Set(looks.map((l) => faceIdKey(l.faceId))).size;
  const four = new Set(looks.map((l) => [l.faceId.eyeShape, l.faceId.irisName, l.faceId.browStyle, l.faceId.beardStyle].join())).size;
  check(words >= 450 && four >= 300, `500 players have only ${words} distinct faces (${four} on eyes, iris, brows and beard alone; want 450+ and 300+)`);
  // every heritage has several eye shapes, and no shape belongs to one heritage alone except by count
  for (const [her, H] of Object.entries(HERITAGE_FEATURES)) check(H.eyes.length >= 5 && H.brows.length >= 5 && H.iris.length >= 3, `${her}: too few eye, brow or iris choices`);
  check(EMOTION_NAMES.length === 8 && Object.keys(NEUTRAL_EMOTION).length === 14, `emotions: ${EMOTION_NAMES.length} of 8, ${Object.keys(NEUTRAL_EMOTION).length} numbers of 14`);
  const half = blendEmotions({ happy: 0.5, angry: 0.5 });
  check(Math.abs(half.smile - (NEUTRAL_EMOTION.smile + (FACE_EMOTIONS.happy.smile - NEUTRAL_EMOTION.smile) * 0.5 + (FACE_EMOTIONS.angry.smile - NEUTRAL_EMOTION.smile) * 0.5)) < 1e-9, "emotions do not blend");
  check(JSON.stringify(blendEmotions({})) === JSON.stringify(NEUTRAL_EMOTION), "no emotion is not neutral");
  // a face's own mould moves nothing outside the face (the modelled hair still fits), and no more than 5 cm on this grid
  const lm = TOON_FACE_LANDMARKS.h3!, F = faceFrame(lm, { chinY: lm.chinY, eyeY: lm.eyes[0][1], browY: lm.browY, frontZ: lm.nose[2] - 0.02 }, lm.chinY - 0.03);
  let most = 0;
  for (const l of looks.slice(0, 60)) for (let x = -0.1; x <= 0.1; x += 0.01) for (let y = lm.chinY - 0.08; y <= lm.browY + 0.06; y += 0.01) for (const z of [F.frontZ - 0.22, F.frontZ - 0.15, F.frontZ - 0.08, F.frontZ - 0.02]) {
    const q: [number, number, number] = [x, y, z];
    const o = faceShapePoint(q, F, l.faceId.shape, 1);
    const d = Math.hypot(o[0] - q[0], o[1] - q[1], o[2] - q[2]);
    most = Math.max(most, d);
    if (faceZone(q, F) === 0 && faceOutlineZone(q, F) === 0) check(d === 0, `face ${l.id}: its mould moved the head outside the face`);
  }
  check(most > 0.004 && most < 0.05, `the moulds move the face by at most ${(most * 1000).toFixed(1)} mm (want 4 to 50, on a grid that also samples the air round the face)`);
  console.log(`  face system: ${words} of 500 players have a face of their own (${four} on eye shape, iris, brows and beard alone); the mould moves up to ${(most * 1000).toFixed(1)} mm`);
}

if (problems.length) {
  console.error(`peoplePresets: ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 30)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`peoplePresets: ok (${STAFF_PRESETS.length} staff/manager/press/fan presets, ${PLAYER_PRESETS.length} player presets)`);
