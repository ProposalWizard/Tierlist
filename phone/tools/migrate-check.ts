/**
 * OLD-SAVE IMPORT CHECK (WP "release prep"): proves the reader for the packed app's saved game, headless.
 *
 *   cd <repo root> && npx esbuild phone/tools/migrate-check.ts --bundle --platform=neutral --main-fields=module,main \
 *     --format=esm --alias:@=. --external:three --external:react-native-mmkv --external:react --external:react-native \
 *     --external:expo-file-system --loader:.webp=empty --loader:.png=empty --loader:.jpg=empty --outfile=/tmp/mig.mjs && node /tmp/mig.mjs
 *
 * What it does:
 *  1. CRC32C and snappy against known answers and a round trip.
 *  2. Makes a real career with the game's own rules, saves it the way the website/packed app does
 *     (lib/star/storage.ts saveCareer under scope "anon", through a localStorage stand-in), and takes the exact text
 *     it wrote.
 *  3. Lays out a fake WebView folder the way Chromium does (a .ldb table with snappy blocks, a newer .log that
 *     shadows it and is split over 32 KB blocks, a delete, other origins, UTF-16 and Latin-1 values), reads it back
 *     with src/migrate/leveldb.ts, and checks the career equals what the website's own loadCareer gives.
 *  4. Damage: a flipped byte, a torn log tail, garbage files: it must not throw and must keep what is good.
 *  5. The import: backup first, never over an existing career, slots and active slot, hall merged, rolled back on error.
 */
import "./career-rn-globals";
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
import { crc32c, maskCrc, snappyDecompress, readLevelDb, chromiumLocalStorage, readLogPayloads, type LevelDbFile } from "../src/migrate/leveldb";
import { extractOldSave } from "../src/migrate/oldSave";
import { applyOldSave, phoneHasCareer, importState } from "../src/migrate/applyOldSave";
import { getCareer, setCareer } from "../src/game/store";
import { snappyCompress, writeBatch, writeLog, writeTable, lsKey, lsValue, ascii } from "./migrate/levelDbWriter";
import { startCareer } from "../src/game/newCareer";
import { phoneHall } from "../src/world/hall";
import { loadJson } from "../src/game/save";

let failures = 0;
const fail = (m: string) => { failures++; console.log("  FAIL:", m); };
const ok = (m: string) => console.log("  ok:", m);
const check = (c: boolean, m: string) => (c ? ok(m) : fail(m));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ═══ 1. the small parts ═══
console.log("1. crc32c, snappy");
check(crc32c(ascii("123456789")) === 0xe3069283, "CRC32C of 123456789 is 0xE3069283 (the standard check value)");
check(crc32c(new Uint8Array(32)) === 0x8a9136aa, "CRC32C of 32 zero bytes is 0x8A9136AA (RFC 3720 test vector)");
check(maskCrc(0) === 0xa282ead8, "masked CRC of 0 is the LevelDB delta");
{
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const parts: number[] = [];
  const words = ["career", "season", "fixtures", "leagueSquads", "Premier League", "overall", "goals"];
  for (let i = 0; i < 6000; i++) { const w = words[Math.floor(rnd() * words.length)]; for (const c of w) parts.push(c.charCodeAt(0)); if (rnd() < 0.1) parts.push(Math.floor(rnd() * 256)); }
  const src = Uint8Array.from(parts);
  const sq = snappyCompress(src);
  check(sq.length < src.length / 2, `snappy writer shrinks text ${src.length} -> ${sq.length}`);
  check(same(Array.from(snappyDecompress(sq)), Array.from(src)), "snappy decompress gives the original back (literals, copy1/2)");
  const big = new Uint8Array(70000); for (let i = 0; i < big.length; i++) big[i] = i % 251;
  check(same(Array.from(snappyDecompress(snappyCompress(big))), Array.from(big)), "snappy round trip on 70 KB with long-offset copies");
  let threw = false; try { snappyDecompress(Uint8Array.from([5, 1, 2])); } catch { threw = true; }
  check(threw, "a damaged snappy block throws (and the reader skips the block)");
}

// ═══ 2. a real career, saved as the website saves it ═══
console.log("2. a real career, saved by lib/star/storage.ts");
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null), setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(), key: (i: number) => Array.from(mem.keys())[i] ?? null, get length() { return mem.size; },
};
const storage = await import("@/lib/star/storage");
const hallMod = await import("@/lib/star/hallOfFame");
const career1 = startCareer("Łukasz", "Ødegaard"); // letters outside Latin-1: the value is stored as UTF-16
const career2 = { ...startCareer("Mikey", "Test"), season: 3 };
const career3 = { ...startCareer("Third", "Slot"), season: 5, retired: true };
storage.saveCareer(career1, "anon");
storage.saveCareer(career2, storage.slotScope("anon", 2));
storage.saveCareer(career3, storage.slotScope("anon", 3));
storage.saveActiveSlot("anon", 2);
hallMod.addToHall("anon", career3);
const text1 = mem.get("star-career-v2::anon")!;
check(!!text1 && text1.length > 10000, `the saved text is a real save (${text1?.length} characters)`);
const websiteView = storage.loadCareer("anon")!; // what the website itself loads from those keys
const savedAt = mem.get("star-career-saved-at-v1::anon")!;

// ═══ 3. a WebView folder as Chromium lays it out ═══
console.log("3. a fake app_webview/Default/Local Storage/leveldb folder");
const ORIGIN = "https://localhost/";
const OLD_ORIGIN = "https://localhost"; // older Chromium: no closing slash
const bytesOf = (s: string) => lsValue(s);
// a save in a real career is 180-550 KB: a 600 KB value in a table and a 330 KB one in the log
const bigTable = JSON.stringify(Array.from({ length: 6000 }, (_, i) => ({ id: "p" + i, name: "Player Number " + i, overall: 50 + (i % 40), goals: i % 17, pos: ["ST", "CM", "GK", "LB"][i % 4] })));
const bigLog = bigTable.slice(0, 330000);
const older = writeTable([
  { key: lsKey(ORIGIN, "kib-big-table"), seq: 19, value: bytesOf(bigTable) },
  { key: lsKey(ORIGIN, "star-career-v2::anon"), seq: 10, value: bytesOf(text1.replace('"season":1', '"season":9')) }, // an OLDER copy of slot 1
  { key: lsKey(ORIGIN, "star-career-v2::anon#slot2"), seq: 11, value: bytesOf(mem.get("star-career-v2::anon#slot2")!) },
  { key: lsKey(ORIGIN, "star-career-v2::anon#slot3"), seq: 12, value: bytesOf(mem.get("star-career-v2::anon#slot3")!) },
  { key: lsKey(ORIGIN, "star-career-active-slot-v1::anon"), seq: 13, value: bytesOf("1") },
  { key: lsKey(ORIGIN, "star-hall-of-fame-v1::anon"), seq: 14, value: bytesOf(mem.get("star-hall-of-fame-v1::anon")!) },
  { key: lsKey(ORIGIN, "star-career-saved-at-v1::anon"), seq: 15, value: bytesOf("1700000000000") },
  { key: lsKey(ORIGIN, "star-career-phase-v1::anon"), seq: 16, value: bytesOf('{"phase":"career-hub"}') },
  { key: lsKey("https://other.example/", "star-career-v2::anon"), seq: 17, value: bytesOf("{}") },
  { key: ascii("META:https://localhost/"), seq: 18, value: Uint8Array.of(8, 1) },
  ...Array.from({ length: 300 }, (_, i) => ({ key: lsKey(ORIGIN, `kib-setting-${String(i).padStart(3, "0")}`), seq: 20 + i, value: bytesOf("x".repeat(30 + (i % 7))) })),
], { blockSize: 2048 });
const olderTable2 = writeTable([{ key: lsKey(ORIGIN, "star-career-v2::anon"), seq: 3, value: bytesOf("{}") }]); // an even older table: must lose
const batch1 = writeBatch(1000, [
  { key: lsKey(ORIGIN, "kib-big-log"), value: bytesOf(bigLog) },
  { key: lsKey(ORIGIN, "star-career-v2::anon"), value: bytesOf(text1) }, // the CURRENT slot 1 (big: crosses 32 KB blocks)
  { key: lsKey(ORIGIN, "star-career-active-slot-v1::anon"), value: bytesOf("2") },
  { key: lsKey(ORIGIN, "star-career-saved-at-v1::anon"), value: bytesOf(savedAt) },
  { key: lsKey(ORIGIN, "star-career-phase-v1::anon"), value: null }, // deleted
]);
const log = writeLog([batch1]);
check(log.length > 32768 * 1, `the log holds a save split over 32 KB blocks (${log.length} bytes, ${Math.ceil(log.length / 32768)} blocks)`);
const folder: LevelDbFile[] = [
  { name: "000005.ldb", bytes: older }, { name: "000004.ldb", bytes: olderTable2 }, { name: "000006.log", bytes: log },
  { name: "MANIFEST-000001", bytes: ascii("not read") }, { name: "CURRENT", bytes: ascii("MANIFEST-000001\n") }, { name: "LOCK", bytes: new Uint8Array(0) }, { name: "LOG", bytes: ascii("text") },
];
const rd = readLevelDb(folder);
check(rd.filesRead === 3, `3 data files read (${rd.filesRead}), MANIFEST/CURRENT/LOCK/LOG left alone`);
const ls = chromiumLocalStorage(rd);
check(ls.origin === ORIGIN, `the origin found is ${ls.origin}`);
check(ls.entries.get("star-career-v2::anon") === text1, "slot 1 is the NEWEST copy (log beats table, byte for byte, UTF-16 value decoded)");
check(ls.entries.get("kib-big-table") === bigTable && ls.entries.get("kib-big-log") === bigLog, `a ${Math.round(bigTable.length / 1000)} KB value in a table and a ${Math.round(bigLog.length / 1000)} KB one in the log (${Math.ceil(log.length / 32768)} log blocks) come out byte for byte`);
check(!ls.entries.has("star-career-phase-v1::anon"), "a key deleted in the log stays deleted");
check(ls.entries.get("star-career-active-slot-v1::anon") === "2", "the active slot is the newer 2");
check(ls.entries.size >= 300, `${ls.entries.size} localStorage entries came out, other origins and META keys left out`);
check(rd.notes.length === 0, "no notes about damage on a clean folder");
{
  const oldOrigin = chromiumLocalStorage(readLevelDb([{ name: "1.ldb", bytes: writeTable([{ key: lsKey(OLD_ORIGIN, "a"), seq: 1, value: lsValue("b") }]) }]));
  check(oldOrigin.entries.get("a") === "b", "the older origin spelling (no closing slash) is read too");
  const uncompressed = chromiumLocalStorage(readLevelDb([{ name: "1.sst", bytes: writeTable([{ key: lsKey(ORIGIN, "a"), seq: 1, value: lsValue("é") }], { compress: false }) }]));
  check(uncompressed.entries.get("a") === "é", "an uncompressed table with a Latin-1 value (é) is read");
}

// the career, through the same code the import uses
const old = extractOldSave(ls.entries)!;
check(!!old && old.slots.length === 3, `three saves found (${old?.slots.map((s) => `${s.slot}:${s.summary.name}`).join(", ")})`);
check(old.activeSlot === 2, "the open slot was 2");
check(old.slots[0].summary.name === "Łukasz Ødegaard", "the non-Latin-1 name survived");
check(same(old.slots[0].career, websiteView), "slot 1 is EXACTLY what the website's own loadCareer gives from the same text");
check(old.slots[0].savedAt === Number(savedAt), "the saved-at stamp is read");
check(!!old.hall && old.hall.entries.length === 1, "the Hall of Fame book came with it (1 entry)");
check(old.problems.length === 0, "no problems");
check(JSON.parse(old.backupText).keys["star-career-v2::anon"] === text1, "the backup text holds the raw old save");

// ═══ 4. damage ═══
console.log("4. damaged files");
{
  const bad = Uint8Array.from(older); bad[Math.floor(bad.length / 3)] ^= 0xff;
  const r = readLevelDb([{ name: "1.ldb", bytes: bad }, { name: "2.log", bytes: log }]);
  check(r.notes.some((n) => /checksum|skipped/.test(n)), "a flipped byte in a table is noticed (" + (r.notes[0] ?? "") + ")");
  check(chromiumLocalStorage(r).entries.get("star-career-v2::anon") === text1, "the good log still gives the newest save");
  const torn = log.subarray(0, log.length - 100);
  const tn: string[] = [];
  check(readLogPayloads(torn, tn).length === 0 && tn.length > 0, "a torn log tail gives no half-save (noted)");
  const twoBatches = writeLog([writeBatch(1, [{ key: lsKey(ORIGIN, "k"), value: lsValue("v1") }]), writeBatch(2, [{ key: lsKey(ORIGIN, "k"), value: lsValue("v2") }])]);
  const t2 = twoBatches.subarray(0, twoBatches.length - 3);
  check(chromiumLocalStorage(readLevelDb([{ name: "1.log", bytes: t2 }])).entries.get("k") === "v1", "a torn LAST record falls back to the one before it");
  let threw = false;
  try {
    readLevelDb([{ name: "9.ldb", bytes: new Uint8Array(10) }, { name: "9.log", bytes: Uint8Array.from({ length: 5000 }, (_, i) => (i * 37) & 255) }, { name: "8.ldb", bytes: Uint8Array.from({ length: 3000 }, (_, i) => (i * 91) & 255) }]);
  } catch { threw = true; }
  check(!threw, "garbage files never throw");
  check(extractOldSave(new Map([["star-career-v2::anon", "{not json"]])) === null, "unreadable save text gives null, not a crash");
  const half = extractOldSave(new Map([["star-career-v2::anon", text1], ["star-career-v2::anon#slot2", "{\"version\":2}"]]))!;
  check(half.slots.length === 1 && half.problems.length === 1, "one good save and one bad: the good one is offered, the bad one noted");
}

// ═══ 5. the import ═══
console.log("5. applying the import");
check(!phoneHasCareer(), "the phone starts with no career");
{
  const noBackup = applyOldSave(old, { backup: () => null });
  check(!noBackup.ok && noBackup.ok === false && noBackup.reason === "no-backup" && !getCareer(), "no safety copy, no import (nothing changed)");
  let made = 0;
  const res = applyOldSave(old, { backup: () => { made++; return "memory://backup.json"; } });
  check(res.ok && made === 1, "imported, backup made first");
  const now = getCareer()!;
  check(!!now && now.player.firstName === "Mikey", "the open slot (2) is the career being played");
  check(same(loadJson("career-slot-1"), old.slots[0].career) && same(loadJson("career-slot-3"), old.slots[2].career), "the other two saves wait in their slots");
  check(loadJson<number>("career-active-slot") === 2, "the active slot is remembered");
  check(phoneHall().entries.length === 1, "the Hall of Fame came over");
  check(importState()?.state === "imported", "the import is remembered (asked once)");
  const again = applyOldSave(old, { backup: () => "x" });
  check(!again.ok && again.reason === "has-career", "a second import never replaces a career");
  setCareer(null);
}

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
