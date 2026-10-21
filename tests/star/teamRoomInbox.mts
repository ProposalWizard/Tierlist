/**
 * tests/star/teamRoomInbox.mts — the patch-notes Inbox and its phone buzz
 * (lib/teamRoom/inbox.ts): only notes from TEAM_ROOM.inboxFrom on, never
 * your own, cleared by "Read and understood", newest first; one buzz per
 * person for new notes, once per version, never the author, only while new.
 * Also: the real archive has unique versions and sorts 0.100h after 0.99h.
 * Fakes only: no network, no database.
 */
import { compareVersionsDesc, bellCount, inboxFor, patchesToRing, payloadForPatches, shortPatchTitle, withRungPatches } from "@/lib/teamRoom/inbox";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import type { PatchMeta, TeamAck } from "@/lib/teamRoom/extras";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import { PATCH_NOTE_PAGES } from "@/lib/patchNotePages";
import fs from "node:fs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const vs = (l: PatchMeta[]) => l.map((n) => n.version).join(",");

const NOTES: PatchMeta[] = [ // the archive's order: newest first
  { version: "0.97h", title: "Harry's patch notes: Merge", publishedAt: "2026-10-21T09:00:00Z" },
  { version: "0.64", title: "Mikey's patch notes v0.20: Shop", publishedAt: "2026-10-21T08:00:00Z" },
  { version: "0.62", title: "Leo's patch notes v0.20: Goals", publishedAt: "2026-10-21T09:00:00Z" },
  { version: "0.94", title: "Harry's patch notes: Bodies", publishedAt: "2026-10-20T00:10:00Z" },
  { version: "0.80", title: "Harry's patch notes: Old", publishedAt: "2026-10-19T23:59:00Z" },
  { version: "0.70", title: "Patch notes with no author", publishedAt: "2026-10-20T12:00:00Z" },
];
const ack = (person: "Harry" | "Mikey" | "Leo", target: string, kind: "patch" | "point" = "patch"): TeamAck => ({ kind, target, person, at: "2026-10-21T10:00:00Z" });

console.log("The Inbox list");
{
  ok(TEAM_ROOM.inboxFrom === "2026-10-20", "starts from yesterday's notes (20 Oct 2026)");
  ok(vs(inboxFor(NOTES, "Mikey", [])) === "0.97h,0.62,0.70,0.94", "Mikey: newest first, his own (0.64) and the 19 Oct one (0.80) left out");
  ok(vs(inboxFor(NOTES, "Harry", [])) === "0.62,0.64,0.70", "Harry: his own notes never appear; same time keeps the archive's order");
  ok(vs(inboxFor(NOTES, "Leo", [])) === "0.97h,0.64,0.70,0.94", "Leo: never his own");
  ok(vs(inboxFor(NOTES, "Mikey", [ack("Mikey", "0.97h"), ack("Mikey", "0.70")])) === "0.62,0.94", "Read and understood clears a note");
  ok(vs(inboxFor(NOTES, "Mikey", [ack("Leo", "0.97h"), ack("Mikey", "0.97h", "point")])) === "0.97h,0.62,0.70,0.94", "someone else's read, or a 'Got it' on a point, does not clear yours");
  ok(inboxFor(NOTES, null, []).length === 0, "nobody picked: an empty Inbox");
  ok(vs(inboxFor(NOTES, "Mikey", [], "2026-10-21")) === "0.97h,0.62", "the start day is a setting");
  ok(bellCount(0) === "" && bellCount(7) === "7" && bellCount(120) === "99+", "bell number: blank, 7, 99+");
  ok(shortPatchTitle("Harry's patch notes: B14 Running After A Chance") === "B14 Running After A Chance", "short title drops the author");
  ok(shortPatchTitle("Mikey's patch notes v0.19: New pop-ups") === "New pop-ups", "short title drops the author's own number");
}

console.log("The buzz for new patch notes");
{
  const now = Date.parse("2026-10-21T10:00:00Z");
  const r = patchesToRing(NOTES, now, {});
  const get = (p: string) => vs(r.find((x) => x.person === p)?.notes ?? []);
  ok(get("Harry") === "0.62,0.64,0.70", "Harry is rung for Leo's and Mikey's (and the no-author one), not his own");
  ok(get("Mikey") === "0.97h,0.62,0.70,0.94", "Mikey: everything new but his own, newest first");
  const again = patchesToRing(NOTES, now, { Harry: ["0.62", "0.64", "0.70"], Mikey: ["0.97h", "0.62", "0.70", "0.94"], Leo: ["0.97h", "0.64", "0.70", "0.94"] });
  ok(again.length === 0, "rung once per version: a second ask rings nobody");
  const later = patchesToRing(NOTES, Date.parse("2026-10-24T08:00:00Z"), {});
  ok(vs(later.find((x) => x.person === "Mikey")?.notes ?? []) === "0.97h,0.62", "only while new: older than 3 days is never rung");
  const future = patchesToRing([{ version: "9.9", title: "Leo's patch notes: x", publishedAt: "2026-10-21T11:00:00Z" }], now, {});
  ok(future.length === 0, "a note dated more than 5 minutes ahead is not rung yet");
  ok(patchesToRing(NOTES.filter((n) => n.version === "0.80"), Date.parse("2026-10-20T10:00:00Z"), {}).length === 0, "a note from before the start day is never rung");

  const one = payloadForPatches([NOTES[2]]);
  ok(one.title === "New patch notes from Leo · v0.62" && one.body === "Goals", "one note: who, which version, its name");
  ok(one.url === "/admin/team?tab=notes&v=0.62" && one.tag === "kib-patch", "tap opens that note on the Patch notes tab; one tag so buzzes group");
  const many = payloadForPatches([NOTES[0], NOTES[2]]);
  ok(many.title === "2 new patch notes to read" && many.body.startsWith("v0.97h Merge · v0.62 Goals"), "several: one buzz that counts them");
  ok(many.url === "/admin/team?tab=notes&v=0.97h", "several: tap opens the newest");
  ok(JSON.stringify(withRungPatches(["a", "b"], ["b", "c"])) === '["a","b","c"]', "remembered versions: no doubles");
  ok(withRungPatches(Array.from({ length: 400 }, (_, i) => `v${i}`), ["new"]).length === 300 && withRungPatches(null, ["x"])[0] === "x", "kept to the newest 300; junk ignored");
}

console.log("Version order and the real archive");
{
  const sorted = ["0.94", "0.100h", "0.99h", "0.95h", "0.63h", "1.0", "0.9"].sort(compareVersionsDesc);
  ok(sorted.join(",") === "1.0,0.100h,0.99h,0.95h,0.94,0.63h,0.9", "0.100h sorts after 0.99h (parseFloat would not)");
  const versions = BUILT_IN_PATCH_NOTES.map((n) => n.version);
  ok(new Set(versions).size === versions.length, `every archive version is unique (${versions.length})`);
  const bad = BUILT_IN_PATCH_NOTES.filter((n) => Number.isNaN(Date.parse(n.publishedAt)));
  ok(bad.length === 0, "every archive note has a real publish time");
  const missing = Object.entries(PATCH_NOTE_PAGES).filter(([, f]) => !fs.existsSync(`patch-notes/${f}`));
  ok(missing.length === 0, `every kept page exists${missing.length ? ` (missing: ${missing.map(([v]) => v).join(", ")})` : ""}`);
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
