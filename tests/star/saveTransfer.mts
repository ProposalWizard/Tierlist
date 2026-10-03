import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { StarPlayer } from "../../lib/star/types";

/**
 * "Move my saves" — lib/star/saveTransfer.ts.
 *
 * An iPhone Home Screen app has its own storage, apart from Safari's. The
 * code carries every save slot from one to the other. Two separate stores
 * here stand in for Safari (A) and the Home Screen app (B).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function freshStore() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  return store;
}
function useStore(store: Map<string, string>) {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

const safari = freshStore();
const storage = await import("../../lib/star/storage");
const transfer = await import("../../lib/star/saveTransfer");
const { saveCareer, loadCareer, slotScope, listSaveSlots, saveActiveSlot, loadActiveSlot, saveStarPhase, loadStarPhase } = storage;
const { packSaves, buildPack, encodePack, unpackSaves, applySaves, checkPack, MAX_CODE_CHARS } = transfer;

const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const player = (firstName: string, club: string): StarPlayer => ({
  firstName, lastName: "Mover", age: 18, position: "CAM", club, nationality: "England",
} as StarPlayer);

const ACCOUNT = "user-harry";

// ── Safari: three saves, on save 2, save 3 sitting on a resumable screen ──
const made = [
  makeInitialCareer(player("One", "Arsenal"), CLUBS),
  { ...makeInitialCareer(player("Two", "Chelsea"), CLUBS), season: 4, money: 123456 },
  { ...makeInitialCareer(player("Three", "Liverpool"), CLUBS), season: 2 },
];
made.forEach((c, i) => saveCareer(c, slotScope(ACCOUNT, i + 1)));
saveActiveSlot(ACCOUNT, 2);
saveStarPhase("ballon-dor", slotScope(ACCOUNT, 3), undefined, true);
const before = [1, 2, 3].map(s => JSON.stringify(loadCareer(slotScope(ACCOUNT, s))));
const beforeList = JSON.stringify(listSaveSlots(ACCOUNT));

const { code, slots } = await packSaves(ACCOUNT);
check(slots === 3, `all three saves are packed (${slots})`);
check(code.startsWith("KIBSAVE1.z."), "the code is compressed in a browser that can");
const plain = await encodePack(buildPack(ACCOUNT), { compress: false });
check(plain.startsWith("KIBSAVE1.j."), "the plain form is marked as plain");
check(code.length < plain.length, `compressed is smaller (${code.length} vs ${plain.length})`);
console.log(`  code size: ${code.length} chars compressed, ${plain.length} plain`);

// ── The Home Screen app: empty, its own storage ──
for (const which of [code, plain]) {
  const app = freshStore();
  check(listSaveSlots(ACCOUNT).every(s => s.empty), "the app starts with no saves (its own storage)");
  // Pasted through Notes, which wraps lines.
  const wrapped = which.replace(/(.{76})/g, "$1\n");
  const res = await unpackSaves(wrapped);
  check(res.ok, `a real code unpacks${res.ok ? "" : `: ${res.reason}`}`);
  if (!res.ok) continue;
  check(res.pack.slots.map(s => s.slot).join() === "1,2,3", "it holds slots 1, 2 and 3");
  check(res.pack.slots[1].summary.club === "Chelsea" && res.pack.slots[1].summary.season === 4, "the summary shows club and season");
  const out = applySaves(ACCOUNT, res.pack);
  check(out.written.join() === "1,2,3" && out.failed.length === 0, "all three are written");
  check(out.openSlot === 2 && loadActiveSlot(ACCOUNT) === 2, "the app opens on the save Harry was on (2)");
  const after = [1, 2, 3].map(s => JSON.stringify(loadCareer(slotScope(ACCOUNT, s))));
  for (let i = 0; i < 3; i++) check(after[i] === before[i], `save ${i + 1} is exactly the same after the move`);
  check(JSON.stringify(listSaveSlots(ACCOUNT)) === beforeList, "the saves list reads the same on both sides");
  check(loadStarPhase(slotScope(ACCOUNT, 3))?.phase === "ballon-dor", "a save on the Ballon d'Or screen still resumes there");
  check(loadStarPhase(slotScope(ACCOUNT, 3))?.wonBallonDor === true, "…with the win it was holding");
  check(app.size > 0, "the app's own storage now has the saves");
}

// ── Into a different account, and only some slots ──
{
  const app = freshStore();
  const own = makeInitialCareer(player("Mine", "Spurs"), CLUBS);
  saveCareer(own, slotScope("other-account", 3));
  const res = await unpackSaves(code);
  if (res.ok) {
    const out = applySaves("other-account", res.pack, [1, 2]);
    check(out.written.join() === "1,2", "only the chosen slots are written");
    check(loadCareer(slotScope("other-account", 3))?.player.firstName === "Mine", "a slot not chosen is left exactly as it was");
    check(loadCareer(slotScope("other-account", 1))?.player.firstName === "One", "the save lands under whoever is pasting it");
  }
  void app;
}

// ── An old-format save still loads after the move ──
{
  useStore(safari);
  // A save from before managers, squad numbers, energy, KIB cans, coins and
  // thin squads — written the way an old version of the game wrote it.
  const old = JSON.parse(JSON.stringify(makeInitialCareer(player("Oldie", "Spurs"), CLUBS))) as Record<string, unknown>;
  for (const k of ["manager", "squadNumber", "energy", "injury", "kibCans", "coins", "stars", "availableManagers", "lastTrainedWeek", "squad"]) delete old[k];
  old.reputation = { world: 40, club: 60, government: 50, shareholders: 50 };
  // …and under the flat, pre-account key, so slot 1 has to claim it first.
  safari.clear();
  safari.set("star-career-v2", JSON.stringify(old));
  const res1 = await packSaves(ACCOUNT);
  check(res1.slots === 1, "an old flat save is found and packed as save 1");
  freshStore();
  const res = await unpackSaves(res1.code);
  check(res.ok, `the old save's code unpacks${res.ok ? "" : `: ${res.reason}`}`);
  if (res.ok) {
    applySaves(ACCOUNT, res.pack);
    const loaded = loadCareer(slotScope(ACCOUNT, 1));
    check(loaded?.player.firstName === "Oldie", "the old save opens after the move");
    check(!!loaded?.manager && loaded.squadNumber !== undefined && loaded.energy === 100, "…with the same backfills a normal load gives it");
    check(typeof loaded?.reputation === "number", "…reputation moved onto one number, as a normal load does");
    check(!!loaded?.squad?.length, "…and a squad");
  }
}

// ── Malformed or hostile codes are refused, plainly, and change nothing ──
{
  const app = freshStore();
  saveCareer(makeInitialCareer(player("Keep", "Brighton"), CLUBS), slotScope(ACCOUNT, 1));
  const snapshot = JSON.stringify([...app.entries()]);

  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
  const gz = async (bytes: Uint8Array) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return Buffer.from(await new Response(stream).arrayBuffer()).toString("base64");
  };
  const realPack = buildPack("nobody");
  const goodCareer = JSON.parse(JSON.stringify(makeInitialCareer(player("X", "Arsenal"), CLUBS)));
  const packJson = (o: unknown) => `KIBSAVE1.j.${b64(JSON.stringify(o))}`;
  const base = { app: "knowitball-star", kind: "save-pack", v: 1, made: 1, activeSlot: 1 };

  const bad: [string, string][] = [
    ["empty", ""],
    ["random text", "hello there"],
    ["broken base64", "KIBSAVE1.z.!!!notbase64!!!"],
    ["newer version", "KIBSAVE2.z.AAAA"],
    ["cut in half", code.slice(0, Math.floor(code.length / 2))],
    ["plain cut in half", plain.slice(0, Math.floor(plain.length / 2))],
    ["base64 of not-JSON", `KIBSAVE1.j.${b64("not json at all")}`],
    ["JSON array", packJson([1, 2, 3])],
    ["wrong app", packJson({ ...base, app: "something-else", slots: [{ slot: 1, career: goodCareer }] })],
    ["future pack version", packJson({ ...base, v: 9, slots: [{ slot: 1, career: goodCareer }] })],
    ["no saves", packJson({ ...base, slots: [] })],
    ["four saves", packJson({ ...base, slots: [1, 2, 3, 3].map(slot => ({ slot, career: goodCareer })) })],
    ["slot 7", packJson({ ...base, slots: [{ slot: 7, career: goodCareer }] })],
    ["slot 1.5", packJson({ ...base, slots: [{ slot: 1.5, career: goodCareer }] })],
    ["same slot twice", packJson({ ...base, slots: [{ slot: 1, career: goodCareer }, { slot: 1, career: goodCareer }] })],
    ["career version 1", packJson({ ...base, slots: [{ slot: 1, career: { ...goodCareer, version: 1 } }] })],
    ["career with no player", packJson({ ...base, slots: [{ slot: 1, career: { ...goodCareer, player: null } }] })],
    ["career is a string", packJson({ ...base, slots: [{ slot: 1, career: "<script>alert(1)</script>" }] })],
    ["one good one broken", packJson({ ...base, slots: [{ slot: 1, career: goodCareer }, { slot: 2, career: { version: 2 } }] })],
    ["too big", "KIBSAVE1.j." + "A".repeat(MAX_CODE_CHARS)],
    ["zip bomb", `KIBSAVE1.z.${await gz(new Uint8Array(40_000_000))}`],
  ];
  void realPack;
  for (const [what, text] of bad) {
    const res = await unpackSaves(text);
    check(!res.ok, `refused: ${what}`);
    if (!res.ok) check(res.reason.length > 0 && res.reason.length < 140 && !/error|exception|undefined|null/i.test(res.reason),
      `${what}: a plain short reason ("${res.reason}")`);
  }
  check(JSON.stringify([...app.entries()]) === snapshot, "no refused code changed anything on the device");

  // A photo from somewhere else is dropped; the game's own kinds are kept.
  const evil = checkPack({ ...base, slots: [{ slot: 1, career: { ...goodCareer, player: { ...goodCareer.player, portrait: "https://tracker.example/x.png" } } }] });
  check(evil.ok && evil.pack.slots[0].career.player.portrait === undefined, "an outside photo link is dropped");
  const own = checkPack({ ...base, slots: [{ slot: 1, career: { ...goodCareer, player: { ...goodCareer.player, portrait: "/fake-faces/a.png" } } }] });
  check(own.ok && own.pack.slots[0].career.player.portrait === "/fake-faces/a.png", "the game's own face file is kept");
  // An active slot that isn't in the code falls back to one that is.
  const odd = checkPack({ ...base, activeSlot: 3, slots: [{ slot: 2, career: goodCareer }] });
  check(odd.ok && odd.pack.activeSlot === 2, "an active slot not in the code falls back to one that is");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — three saves move exactly, old saves still load, and bad codes are refused without touching anything");
