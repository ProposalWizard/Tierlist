/**
 * Settings → Saves → Backups (28 Nov 2026, after Harry's "cooked" saves).
 * lib/star/saveBackups.ts (the rows) and storage.ts restoreCareerBackup:
 *   1. the list: one slot's backups, newest first, with the headline and a
 *      "what changed" line
 *   2. restore keeps the save there now as a backup first, then the chosen
 *      one becomes the save, here and online (so the other device gets it)
 *   3. undo puts the old save back, and nothing is ever deleted
 *   4. back and forth never stores the same copy twice
 *   5. a backup that is gone / a full device: nothing changes
 *   6. signed out: this device only, nothing sent
 *   7. the download file's shape
 * Fakes only: a Map for each device's storage, a Map for the server.
 */
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import { readSlotCheck, slotOverwriteRefusal } from "../../lib/star/onlineSlots";
import {
  BACKUP_FILE_KIND, BACKUP_FILE_VERSION, backupCount, backupDownload, backupRows, whatChanged, whenWords, whyWords,
} from "../../lib/star/saveBackups";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); else console.log(`  ✓ ${what}`); };

const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const player = (firstName: string, club: string): StarPlayer => ({
  firstName, lastName: "Player", age: 18, position: "CAM", club, nationality: "England",
} as StarPlayer);
const career = (name: string, club = "Arsenal"): CareerState => makeInitialCareer(player(name, club), CLUBS);
const at = (c: CareerState, season: number, week: number, goals: number): CareerState =>
  ({ ...c, season, week, careerStats: { ...c.careerStats, goals } });

function freshStore() {
  const store = new Map<string, string>();
  return {
    store,
    full: false,
    api: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem(k: string, v: string) {
        if ((this as unknown as { owner: { full: boolean } }).owner?.full && k.startsWith("star-career-backups")) {
          const e = new Error("full"); (e as { name: string }).name = "QuotaExceededError"; throw e;
        }
        store.set(k, String(v));
      },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
    } as Record<string, unknown>,
  };
}
const phone = freshStore(); (phone.api as { owner?: unknown }).owner = phone;
const pc = freshStore(); (pc.api as { owner?: unknown }).owner = pc;
const on = (d: ReturnType<typeof freshStore>) => { (globalThis as { localStorage?: unknown }).localStorage = d.api; };
on(phone);

// A fake server that runs the REAL overwrite check.
const cloud = new Map<number, { career: unknown; updatedAt: string }>();
let clock = Date.now();
let posts = 0;
(globalThis as { fetch?: unknown }).fetch = async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
  const u = new URL(url, "http://x");
  const slot = Number(u.searchParams.get("slot") ?? 1);
  if ((init?.method ?? "GET") === "POST") {
    posts++;
    const body = JSON.parse(init!.body!);
    const refusal = slotOverwriteRefusal(cloud.get(slot)?.career ?? null, body, readSlotCheck(init?.headers?.["x-star-slot-check"]));
    if (refusal) return new Response(JSON.stringify({ ok: false, ...refusal }), { status: 409 });
    clock += 1000;
    cloud.set(slot, { career: body, updatedAt: new Date(clock).toISOString() });
    return new Response(JSON.stringify({ ok: true }));
  }
  return new Response(JSON.stringify(cloud.get(slot) ?? null));
};
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5)); };

const storage = await import("../../lib/star/storage");
const ACC = "user-harry";
const S = (n: number) => storage.slotScope(ACC, n);
const decode = (b: unknown) => storage.careerFromBackup(b as Parameters<typeof storage.careerFromBackup>[0]);
const T0 = Date.UTC(2026, 10, 28, 20, 0);

// ── 1. The list ─────────────────────────────────────────────────────────────
console.log("The list");
const base = career("Harry");
const s3 = at(base, 3, 10, 22);
const s2 = at(base, 2, 30, 12);
const s1 = at(base, 1, 4, 1);
const other = at(career("Mikey", "Chelsea"), 5, 1, 40);
{
  storage.backupCareer(ACC, 2, s1, "kept this device's copy", T0 - 3 * 86_400_000);
  storage.backupCareer(ACC, 2, s2, "kept the online copy", T0 - 1 * 86_400_000);
  storage.backupCareer(ACC, 2, other, "replaced online from Saves", T0 - 2 * 86_400_000);
  storage.backupCareer(ACC, 1, at(base, 1, 1, 0), "deleted", T0 - 4 * 86_400_000);
  const all = storage.listCareerBackups(ACC);
  check(all.every((b) => typeof b.id === "string" && b.id.length > 4) && new Set(all.map((b) => b.id)).size === all.length, "every backup has its own id");
  const rows = backupRows(all, 2, decode, s3);
  check(rows.length === 3 && backupCount(all, 2) === 3 && backupCount(all, 1) === 1, "only that slot's backups");
  check(rows[0].at > rows[1].at && rows[1].at > rows[2].at, "newest first");
  check(rows[0].playerName === "Harry Player" && rows[0].season === 2 && rows[0].club === "Arsenal" && rows[0].age === 18 && typeof rows[0].stars === "number", "headline: player, club, season, age, stars");
  check(rows.every((r) => r.where === "device" && r.whereWords === "On this device"), "where: this device");
  check(/^1 season behind your save · 10 goals fewer$/.test(rows[0].change), `what changed (same career): "${rows[0].change}"`);
  check(/^A different career: your save now is Harry Player$/.test(rows[1].change), `what changed (different career): "${rows[1].change}"`);
  check(rows[0].why === "Kept when you chose the online copy" && whyWords("deleted") === "Kept when you deleted this save", "why in plain words");
  check(whatChanged(s3, s3) === "Same as your save now" && whatChanged(s3, null) === "This save is empty now", "same point / empty slot");
  check(/^6 weeks behind/.test(whatChanged(at(base, 3, 4, 22), s3)), "weeks when the season is the same");
  const bad = backupRows([{ id: "x", at: 1, slot: 2, why: "", playerName: "Lost Man", season: 4, career: { nope: 1 } }], 2, decode, s3);
  check(bad[0].readable === false && bad[0].playerName === "Lost Man", "an unreadable copy is listed, not restorable");
  check(whenWords(T0, T0 + 60_000).startsWith("Today") && whenWords(T0 - 86_400_000, T0).startsWith("Yesterday"), "when: today / yesterday");
}

// ── 2 & 3. Restore, then undo, across two devices ───────────────────────────
console.log("Restore and undo");
{
  // Both devices hold Save 2 = Harry Season 3, in sync with the account.
  on(phone);
  storage.saveCareer(s3, S(2));
  await storage.saveCareerToCloud(s3, 2, { scope: S(2) });
  on(pc);
  const pcLoad = await storage.reconcileCareerLoad(ACC, 2);
  check(pcLoad.kind === "career" && pcLoad.career?.season === 3, "pc starts on Season 3 from the account");

  on(phone);
  const target = backupRows(storage.listCareerBackups(ACC), 2, decode, s3)[0]; // Season 2
  const before = storage.listCareerBackups(ACC).length;
  const r = storage.restoreCareerBackup(ACC, target.id, s3, T0);
  await settle();
  check(r.ok, "restore went through");
  if (r.ok) {
    check(r.career.season === 2 && storage.loadCareer(S(2))?.season === 2, "the chosen backup is Save 2 on this device");
    check(!!r.kept && decode(r.kept)?.season === 3 && r.kept.why === storage.WHY_BEFORE_RESTORE, "the save there before (Season 3) is kept as a backup first");
    const after = storage.listCareerBackups(ACC);
    check(after.length === before + 1 && after.some((b) => b.id === target.id), "the restored backup is still listed: nothing deleted");
    check((cloud.get(2)?.career as CareerState).season === 2, "sent online, replacing the account's copy");
    check(backupRows(after, 2, decode, r.career)[0].id === r.kept!.id, "the kept save is at the top of the list");

    const phoneAgain = await storage.reconcileCareerLoad(ACC, 2);
    check(phoneAgain.kind === "career" && phoneAgain.career?.season === 2, "phone reopens on the restored save, no clash");
    on(pc);
    const pcAgain = await storage.reconcileCareerLoad(ACC, 2);
    check(pcAgain.kind === "career" && pcAgain.career?.season === 2, "the other device opens on the restored save too");

    // Undo, from the phone.
    on(phone);
    const count = storage.listCareerBackups(ACC).length;
    const u = storage.restoreCareerBackup(ACC, r.kept!.id, r.career, T0 + 1000);
    await settle();
    check(u.ok && u.ok && u.career.season === 3 && storage.loadCareer(S(2))?.season === 3, "undo: Season 3 is Save 2 again");
    check((cloud.get(2)?.career as CareerState).season === 3, "undo goes online too");
    check(storage.listCareerBackups(ACC).length === count, "back and forth never stores the same copy twice");
    check(storage.listCareerBackups(ACC).some((b) => b.id === target.id) && storage.listCareerBackups(ACC).some((b) => b.id === r.kept!.id), "both copies are still kept after undo");
    on(pc);
    const pcUndo = await storage.reconcileCareerLoad(ACC, 2);
    check(pcUndo.kind === "career" && pcUndo.career?.season === 3, "the other device follows the undo");
  }

  // A different player restored into the slot: replaced online on purpose.
  on(phone);
  const mikey = storage.listCareerBackups(ACC).find((b) => b.playerName === "Mikey Player")!;
  const d = storage.restoreCareerBackup(ACC, mikey.id, null, T0 + 2000);
  await settle();
  check(d.ok && (cloud.get(2)?.career as CareerState).player.firstName === "Mikey", "a different career restored: the online copy is replaced (the player chose it)");
  check(d.ok && !!d.kept && decode(d.kept)?.player.firstName === "Harry", "…and Harry's career is kept as a backup first");
  const phoneD = await storage.reconcileCareerLoad(ACC, 2);
  check(phoneD.kind === "career" && phoneD.career?.player.firstName === "Mikey", "this device reopens on it without a clash");
}

// ── 5. Nothing changes when it cannot be done ──────────────────────────────
console.log("Refusals");
{
  on(phone);
  const before = storage.loadCareer(S(2))?.player.firstName;
  const gone = storage.restoreCareerBackup(ACC, "b-not-there", null);
  check(!gone.ok && /not on this device/.test(gone.why) && storage.loadCareer(S(2))?.player.firstName === before, "a backup that is gone: nothing changed");
  storage.saveCareer(at(career("Leo", "Spurs"), 9, 9, 99), S(3));
  // A slot-3 backup put in place while there is room; then the device fills.
  storage.backupCareer(ACC, 3, at(career("Leo", "Spurs"), 1, 1, 0), "deleted", T0);
  phone.full = true;
  const leoOld = storage.listCareerBackups(ACC).find((b) => b.slot === 3)!;
  const full = storage.restoreCareerBackup(ACC, leoOld.id, null);
  check(!full.ok && /could not be kept/.test(full.why) && storage.loadCareer(S(3))?.season === 9, "device full: the save is not replaced");
  phone.full = false;
}

// ── 6. Signed out: this device only ─────────────────────────────────────────
console.log("Signed out");
{
  on(phone);
  const A = storage.ANON_SCOPE;
  const s = storage.slotScope(A, 1);
  storage.saveCareer(at(base, 4, 1, 30), s);
  storage.backupCareer(A, 1, at(base, 2, 1, 5), "deleted", T0);
  const b = storage.listCareerBackups(A)[0];
  const n = posts;
  const r = storage.restoreCareerBackup(A, b.id, null, T0 + 5);
  await settle();
  check(r.ok && storage.loadCareer(s)?.season === 2 && posts === n, "signed out: restored here, nothing sent online");
  check(storage.listCareerBackups(A).some((x) => decode(x)?.season === 4), "signed out: the old save is kept too");
}

// ── 7. The download ─────────────────────────────────────────────────────────
console.log("Download");
{
  const b = storage.listCareerBackups(ACC)[0];
  const { filename, text, file } = backupDownload(b);
  const back = JSON.parse(text);
  check(back.kind === BACKUP_FILE_KIND && back.version === BACKUP_FILE_VERSION && file.kind === BACKUP_FILE_KIND, "file kind and version");
  check(back.slot === b.slot && back.playerName === b.playerName && back.season === b.season && back.keptAt === new Date(b.at).toISOString(), "slot, player, season and when");
  check(JSON.stringify(back.career) === JSON.stringify(b.career), "the save inside is exactly as stored");
  check(storage.loadCareerFromStoredForm(back.career)?.player.lastName === "Player", "the save inside opens as a career");
  check(/^knowitball-save\d-[a-z0-9-]+-season\d+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/.test(filename), `file name: ${filename}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("\nsaveBackupsView: all checks passed");
