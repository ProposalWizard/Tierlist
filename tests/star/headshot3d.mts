/**
 * HEADSHOTS FROM THE 3D MODEL (lib/star/headshot3d, B15 20 Oct 2026): who a
 * man looks like on a card, the key his picture is kept under, which kept
 * pictures go when there are too many, and the fallback (no WebGL, no
 * picture yet: the drawn head stays, never a blank).
 */
import { headshotLookFor, headshotKey, headshotIdFor, headshotView, HEADSHOT_VERSION, HEADSHOT_SHOT, HEADSHOT_PX } from "../../lib/star/headshot3d/look";
import { headshotsToDrop, KEEP_HEADSHOTS, headshotFromMemory } from "../../lib/star/headshot3d/store";
import { makeHeadshot, headshotsPossible } from "../../lib/star/headshot3d/maker";
import { playerLookFor } from "../../lib/star/playerLook";
import { TOON_PLAYER_HEADS, TOON_BODIES, type ToonPick } from "../../lib/star/style3d/toon/bodies";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const ARSENAL = { shirt: "#EF0107", trim: "#FFFFFF" };
const SPURS = { shirt: "#FFFFFF", trim: "#132257" };

// 1. A man's look is the 3D match's "one man, one look" (playerLookFor), the same every call.
for (const id of ["sp_0", "sp_17", "Arsenal|Saka", "x", ""]) {
  const a = headshotLookFor({ id, kit: ARSENAL }), b = headshotLookFor({ id, kit: ARSENAL });
  const pl = playerLookFor({ id });
  check(JSON.stringify(a) === JSON.stringify(b), `"${id}": look changed between calls`);
  check(a.head === pl.head && a.body === pl.body && a.skin === pl.skin.toLowerCase() && a.hair === pl.hair.toLowerCase(), `"${id}": not his playerLookFor look`);
  check(TOON_PLAYER_HEADS.includes(a.head), `"${id}": head ${a.head} is not a player head`);
  check(TOON_BODIES.includes(a.body), `"${id}": build ${a.body} unknown`);
}
// his position and his real skin are used when given
check(headshotLookFor({ id: "sp_3", position: "GK", kit: ARSENAL }).body === playerLookFor({ id: "sp_3", position: "GK" }).body, "position not passed to playerLookFor");
check(headshotLookFor({ id: "sp_3", skin: "#6B3D1F", kit: ARSENAL }).skin === "#6b3d1f", "real skin not used");

// 2. You: your own look (Settings → Your look), not a seeded one.
const you: ToonPick = { head: "h4", body: "c3", skin: "#8D5524", hair: "#D7B26A" };
const yl = headshotLookFor({ id: "you", you: true, kit: ARSENAL }, you);
check(yl.head === "h4" && yl.body === "c3" && yl.skin === "#8d5524" && yl.hair === "#d7b26a", "you: not your chosen look");

// 3. Kit: shorts default to the trim (the game's rule); colours lower-cased so "#FFF" and "#fff" are one picture.
const k = headshotLookFor({ id: "sp_1", kit: { shirt: "#ABCDEF", trim: "#123456" } });
check(k.shirt === "#abcdef" && k.trim === "#123456" && k.shorts === "#123456", "kit colours not normalised / shorts not the trim");

// 4. The key: the same man in the same look is one key; anything that changes the picture changes it.
const base = headshotLookFor({ id: "sp_9", kit: ARSENAL });
const key = headshotKey("sp_9", base);
check(key === headshotKey("sp_9", headshotLookFor({ id: "sp_9", kit: { shirt: "#ef0107", trim: "#ffffff" } })), "key differs for the same look in another letter case");
check(key.startsWith(`hs${HEADSHOT_VERSION}|`), "key has no version (a new camera would never re-make old pictures)");
check(key !== headshotKey("sp_9", headshotLookFor({ id: "sp_9", kit: SPURS })), "a new kit kept the old picture");
check(key !== headshotKey("sp_10", base), "another man shares the key");
check(key !== headshotKey("sp_9", { ...base, skin: "#000000" }), "a new skin kept the old picture");
check(key !== headshotKey("sp_9", { ...base, head: base.head === "h1" ? "h2" : "h1" }), "a new head kept the old picture");
// the player card's head-to-waist portrait is its own picture; the round headshot's key is unchanged by it
check(headshotKey("sp_9", base, "head") === key, "the default frame is not the headshot");
check(headshotKey("sp_9", base, "card") !== key, "the card portrait shares the headshot's key");
check(headshotKey("you", yl) !== headshotKey("you", headshotLookFor({ id: "you", you: true, kit: ARSENAL }, { ...you, hair: "#17110D" })), "your new hair colour kept the old picture");

// 5. The id rule cards use: you → "you", a squad id when known, else club|name (the PotM rule).
check(headshotIdFor("Saka", "Arsenal", true) === "you", "you not 'you'");
check(headshotIdFor("Saka", "Arsenal", false, "sp_7") === "sp_7", "squad id not used");
check(headshotIdFor("Saka", "Arsenal") === "Arsenal|Saka", "fallback id not club|name");

// 6. Keeping: at most KEEP_HEADSHOTS, the oldest go first.
check(headshotsToDrop([{ k: "a", at: 1 }], 5).length === 0, "dropped one under the cap");
const rows = Array.from({ length: 10 }, (_, i) => ({ k: `k${i}`, at: 100 - i })); // k9 oldest
const drop = headshotsToDrop(rows, 7);
check(drop.length === 3 && drop.join(",") === "k9,k8,k7", `dropped ${drop.join(",")} instead of the three oldest`);
check(KEEP_HEADSHOTS >= 200 && KEEP_HEADSHOTS <= 1000, `KEEP_HEADSHOTS ${KEEP_HEADSHOTS} out of range`);

// 7. The fallback: only a ready picture replaces the drawn head; waiting or failed keeps it.
check(headshotView("ready", "blob:x") === "picture", "a ready picture not shown");
check(headshotView("waiting", null) === "drawn", "waiting is not the drawn head");
check(headshotView("failed", null) === "drawn", "a failed picture is not the drawn head");
check(headshotView("ready", null) === "drawn", "ready with no picture is not the drawn head");

// 8. No WebGL (here: no browser at all): the maker answers null at once and never throws, so cards keep the drawn head.
check(!headshotsPossible(), "headshots claimed possible with no document");
const t0 = Date.now();
const got = await makeHeadshot("sp_1", base).catch(() => "threw");
check(got === null, `makeHeadshot without WebGL gave ${String(got)} (should be null)`);
check(Date.now() - t0 < 2000, "makeHeadshot without WebGL took over 2 s");
check(headshotFromMemory(headshotKey("sp_1", base)) === null, "a failed picture was kept");

// 9. The shot is fixed and sane (one lens, one distance; a real portrait frame).
const frameH = 2 * HEADSHOT_SHOT.distance * Math.tan((HEADSHOT_SHOT.fov * Math.PI) / 360);
check(frameH > 0.45 && frameH < 0.8, `the frame is ${frameH.toFixed(2)} m tall: not head and shoulders`);
check(HEADSHOT_PX >= 224, "pictures smaller than the biggest card shows them on a 2× phone");

if (problems.length) {
  console.error(`headshot3d: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`headshot3d: ok (frame ${frameH.toFixed(2)} m tall, key ${key})`);
