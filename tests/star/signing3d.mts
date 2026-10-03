import { signingLines, contractRows, wornAccessories, AVIATORS_CARD, SIGNING3D_ACCESSORY_SLOTS } from "../../lib/star/signing3d";
import { ACCESSORIES } from "../../lib/star/store/catalogue";

/**
 * THE LIVE 3D SIGNING — the plain parts: the words carry the career's real
 * seasons and shirt number, the contract prints only the terms it has, and
 * the accessories that reach the 3D are exactly the worn, wearable ones.
 * (The 3D itself is checked by eye, in stills: scripts/signing3d-shot.mjs.)
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// The script: same five beats, the real numbers dropped in.
const a = signingLines({ seasons: 3, number: 17 });
check(a.length === 5, `five lines (${a.length})`);
check(a.map((l) => l.shot).join(",") === "talk,reply,talk,reply,talk", `talk/reply cuts alternate (${a.map((l) => l.shot)})`);
check(a[2].text.includes("Three seasons") && a[2].text.includes("number 17 shirt"), `the offer line names 3 seasons and #17 (${a[2].text})`);
check(signingLines({ seasons: 1 })[2].text.includes("One season."), `one season, no shirt number when there is none (${signingLines({ seasons: 1 })[2].text})`);
check(signingLines()[2].text.includes("Two seasons"), "no terms falls back to two seasons");
// A move to a new club: no trial behind it, same five beats.
const mv = signingLines({ seasons: 2, kind: "transfer" });
check(mv.length === 5 && !/trial/i.test(mv[0].text), `a transfer never mentions the trial (${mv[0].text})`);
check(/trial/i.test(signingLines({ seasons: 2 })[0].text), "the first contract still talks about the trial");

// The contract: only rows with a value, in the printed order.
const rows = contractRows({ seasons: 2, wage: 1250, number: 39, position: "ST", season: null });
check(rows.map((r) => r[0]).join(",") === "Length,Wage,Shirt,Position", `rows in order, empty "From" left out (${rows.map((r) => r[0])})`);
check(rows[1][1] === "★1,250 / wk", `wage printed with the star (${rows[1][1]})`);
check(contractRows({}).length === 0, "no terms, no rows");

// Accessories: worn ones only, celebrations never, an id in the wrong slot ignored.
const worn = wornAccessories({ head: "headband-ninja", boots: "boots-gold", celebration: "celeb-knee-slide", neck: "boots-volt" });
check(worn.map((w) => w.id).sort().join(",") === "boots-gold,headband-ninja", `only real, wearable, right-slot items (${worn.map((w) => w.id)})`);
check(worn.find((w) => w.id === "headband-ninja")?.color2 === "#dc2626", "the second colour comes through");
check(wornAccessories(undefined).length === 0, "nothing equipped, nothing worn");
const rainbow = wornAccessories({ armband: "armband-rainbow" })[0];
check((rainbow?.stripes?.length ?? 0) === 6, "the rainbow armband keeps its six stripes");

// Every wearable store slot has a 3D piece in the scene.
const slots = new Set(ACCESSORIES.map((x) => x.slot).filter((s) => s !== "celebration"));
for (const s of slots) check((SIGNING3D_ACCESSORY_SLOTS as readonly string[]).includes(s), `slot "${s}" has a 3D piece`);
check(AVIATORS_CARD === "pass-gold-aviators", "the aviators are the Star Pass Gold Aviators card");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the 3D signing's words, contract rows and worn accessories come from the career");
