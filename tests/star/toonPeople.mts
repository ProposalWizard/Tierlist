/**
 * STYLE A PEOPLE (lib/star/style3d/toon): the seeded head / build / skin / hair
 * pick, the club kit → textured kit colours, the suit rule, the cel bands, and
 * the head files (1.83 m, a mask, the kit lines the shader reads, weighted
 * fingers, packed, fewer triangles than the old body).
 */
import fs from "node:fs";
import {
  TOON_BODIES, TOON_FILES, TOON_HEIGHT, toonBodyFor, toonSkinFor, toonHairFor, toonPickFor,
  toonKitColours, toonWearsSuit, setToonYou, toonYou, resolveToonBody, resolveToonHead,
  TOON_HEADS, TOON_PLAYER_HEADS, TOON_SUIT_HEADS, toonHeadFor, TOON_BUILD_SCALE,
} from "../../lib/star/style3d/toon/bodies";
import { toonBand, TOON_BANDS } from "../../lib/star/style3d/toon/shader";
import { SKIN_TONES, HAIR_COLOURS } from "../../lib/star/playerIdentity";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 1. The same id always gets the same body, skin and hair.
for (const id of ["you", "m3", "keeper", "Bukayo Saka", "casino-dealer-0", ""]) {
  const a = toonPickFor(id), b = toonPickFor(id);
  check(a.body === b.body && a.head === b.head && a.skin === b.skin && a.hair === b.hair, `pick for "${id}" changed between calls`);
  check(TOON_BODIES.includes(a.body), `"${id}" got body ${a.body}`);
  check(TOON_PLAYER_HEADS.includes(a.head), `"${id}" got head ${a.head}`);
  check(TOON_SUIT_HEADS.includes(toonPickFor(id, true).head), `"${id}" in a suit got head ${toonPickFor(id, true).head}`);
  check(SKIN_TONES.some((t) => t.hex === a.skin), `"${id}" skin ${a.skin} is not one of the game's tones`);
  check(HAIR_COLOURS.some((h) => h.hex === a.hair), `"${id}" hair ${a.hair} is not one of the game's colours`);
}

// 2. A squad gets every body, a spread of skins, mostly dark hair.
const N = 3000;
const bodies = new Map<string, number>(), skins = new Map<string, number>(), hair = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const id = `player-${i}`;
  bodies.set(toonBodyFor(id), (bodies.get(toonBodyFor(id)) ?? 0) + 1);
  skins.set(toonSkinFor(id), (skins.get(toonSkinFor(id)) ?? 0) + 1);
  hair.set(toonHairFor(id), (hair.get(toonHairFor(id)) ?? 0) + 1);
}
for (const b of TOON_BODIES) {
  const share = (bodies.get(b) ?? 0) / N;
  check(share > 0.28 && share < 0.39, `body ${b} is ${(share * 100).toFixed(1)}% of ${N} men (want about a third)`);
}
check(skins.size === SKIN_TONES.length, `only ${skins.size} of ${SKIN_TONES.length} skin tones used`);
const black = (hair.get(HAIR_COLOURS[0].hex) ?? 0) / N;
check(black > 0.44 && black < 0.56, `black hair ${(black * 100).toFixed(1)}% (want about half)`);
// every player head is used, about evenly (a squad of 25 is not one face)
const heads = new Map<string, number>();
for (let i = 0; i < N; i++) heads.set(toonHeadFor(`player-${i}`), (heads.get(toonHeadFor(`player-${i}`)) ?? 0) + 1);
for (const h of TOON_PLAYER_HEADS) {
  const share = (heads.get(h) ?? 0) / N;
  check(share > 0.12 && share < 0.22, `head ${h} is ${(share * 100).toFixed(1)}% (want about a sixth)`);
}
let worst = 0;
for (let sq = 0; sq < 200; sq++) {
  const m = new Map<string, number>();
  for (let i = 0; i < 25; i++) { const h = toonHeadFor(`club${sq}-p${i}`); m.set(h, (m.get(h) ?? 0) + 1); }
  worst = Math.max(worst, ...m.values());
  check(m.size >= 5, `squad ${sq}: only ${m.size} different heads in 25 men`);
}
check(worst <= 10, `a squad has ${worst} men with the same head`);
// builds: slim narrower, strong broader, tall taller
check(TOON_BUILD_SCALE.c1[0] < 1 && TOON_BUILD_SCALE.c2[0] > 1 && TOON_BUILD_SCALE.c3[1] > 1, "build scales");
// body, skin and hair are picked apart (not all the same as each other)
let same = 0;
for (let i = 0; i < 300; i++) { const p = toonPickFor(`x${i}`); if (TOON_BODIES.indexOf(p.body) === SKIN_TONES.findIndex((t) => t.hex === p.skin) % 3) same++; }
check(same < 160, `body and skin move together (${same}/300)`);

// 3. You: what Settings saved, and nothing else.
setToonYou({ body: "c3", head: "h4", skin: "#4a2b18", hair: "#d7b26a" });
check(toonYou().body === "c3" && toonYou().head === "h4" && toonYou().skin === "#4a2b18" && toonYou().hair === "#d7b26a", "your look did not stick");
setToonYou({ body: "zz" as never, head: "m1" });
check(toonYou().body === "c1", "an unknown body did not fall back to C1");
check(toonYou().head === "h1", "a suit head (or unknown) for you did not fall back to H1");
check(resolveToonHead(undefined) === "h1" && resolveToonHead("h5") === "h5", "resolveToonHead");
check(resolveToonBody(undefined) === "c1" && resolveToonBody("c2") === "c2", "resolveToonBody");

// 4. Kit colours: shirt, shorts (own, else trim), socks (own, else shirt), trim.
const k1 = toonKitColours({ shirt: "#c8102e", trim: "#ffffff" });
check(k1.shirt === "#c8102e" && k1.shorts === "#ffffff" && k1.socks === "#c8102e" && k1.trim === "#ffffff", `plain kit maps to ${JSON.stringify(k1)}`);
const k2 = toonKitColours({ shirt: "#6cabdd", trim: "#1c2c5b", shorts: "#ffffff", socks: "#1c2c5b" });
check(k2.shorts === "#ffffff" && k2.socks === "#1c2c5b" && k2.trim === "#1c2c5b", `full kit maps to ${JSON.stringify(k2)}`);

// 5. Who wears the suit.
check(toonWearsSuit("manager"), "a manager wears the suit");
check(!toonWearsSuit("player"), "a player wears the kit");
check(!toonWearsSuit("player", "kit-home") && !toonWearsSuit("player", "keeper"), "kits and keepers wear the kit");
check(toonWearsSuit("player", "suit") && toonWearsSuit("player", "casual01"), "a non-kit outfit wears the suit");

// 6. The cel bands: three steps, nothing in between.
check(toonBand(0)[0] === 0 && toonBand(TOON_BANDS.shadowBelow - 0.01)[0] === 0, "the shadow side gets no direct light");
check(toonBand(0.2) === TOON_BANDS.mid && toonBand(0.41) === TOON_BANDS.mid, "the mid band");
check(toonBand(0.5) === TOON_BANDS.lit && toonBand(1) === TOON_BANDS.lit, "the lit band");
const levels = new Set<string>();
for (let d = 0; d <= 1; d += 0.01) levels.add(toonBand(d).join(","));
check(levels.size === 3, `${levels.size} light levels (want 3)`);

// 7. The head files.
for (const b of TOON_HEADS) {
  const f = `public${TOON_FILES[b]}`;
  if (!fs.existsSync(f)) { problems.push(`${f} missing`); continue; }
  const buf = fs.readFileSync(f);
  const len = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + len).toString());
  const ex = j.scenes[0].extras;
  check(ex.toon === true && `public/star/people3d/${ex.model}.glb` === f, `${f}: extras.toon/model`);
  check(!!ex.fingers?.L && !!ex.fingers?.R, `${f}: finger bones (relaxed hands)`);
  // the fingers are skinned (a hand vertex follows a finger bone, not only the hand)
  const sk = j.skins[0];
  const fingerJoints = new Set(sk.joints.map((n: number, i: number) => [j.nodes[n].name, i]).filter(([n]: [string]) => /Hand(Index|Middle|Ring|Little)\d/.test(n)).map(([, i]: [string, number]) => i));
  check(fingerJoints.size >= 24, `${f}: ${fingerJoints.size} finger joints`);
  const pos = j.accessors[j.meshes[0].primitives[0].attributes.POSITION];
  // quantized: the box comes back through extras.quant
  const norm = pos.normalized ? ({ 5122: 32767, 5123: 65535, 5120: 127, 5121: 255 } as Record<number, number>)[pos.componentType] : 1;
  const top = ex.quant ? (pos.max[1] / norm) * ex.quant.scale + ex.quant.offset[1] : pos.max[1];
  check(Math.abs(top - TOON_HEIGHT) < 0.01, `${f}: ${top.toFixed(3)} m tall (want ${TOON_HEIGHT})`);
  check(j.materials[0].occlusionTexture && j.materials[0].pbrMetallicRoughness.baseColorTexture, `${f}: colour + mask textures`);
  const kl = ex.kit;
  // (a suit has no kit lines: its clothes keep their own colours)
  if (!TOON_SUIT_HEADS.includes(b)) check(kl.bootY < kl.sockY && kl.sockY < kl.shortsLoY && kl.shortsLoY < kl.hemY && kl.hemY < kl.collarY, `${f}: kit lines out of order ${JSON.stringify(kl)}`);
  check(ex.face.chinY < ex.face.eyeY && ex.face.eyeY < TOON_HEIGHT, `${f}: face lines ${JSON.stringify(ex.face)}`);
  const tris = j.accessors[j.meshes[0].primitives[0].indices].count / 3;
  check(tris < 15500, `${f}: ${tris} triangles (old body: 20,865)`);
  check(buf.length < 420 * 1024, `${f}: ${(buf.length / 1024).toFixed(0)} KB`);
  check(j.extensionsUsed?.includes("EXT_meshopt_compression"), `${f}: not packed (scripts/perf3d/shrink-models.mjs)`);
}

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(`toonPeople: seeded picks over ${N} men (builds ${TOON_BODIES.map((b) => `${b} ${((bodies.get(b) ?? 0) / N * 100).toFixed(0)}%`).join(", ")}; heads ${TOON_PLAYER_HEADS.map((h) => `${h} ${((heads.get(h) ?? 0) / N * 100).toFixed(0)}%`).join(", ")}; worst squad of 25: ${worst} alike), kits, suits, 3 cel bands, ${TOON_HEADS.length} head files: all checks pass`);
