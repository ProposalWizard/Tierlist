/**
 * tests/star/teamRoomInbox.mts — the patch-notes Inbox and its phone buzz
 * (lib/teamRoom/inbox.ts): only notes from TEAM_ROOM.inboxFrom on, never
 * your own, cleared by "Read and understood", newest first; one buzz per
 * person for new notes, once per version, never the author, only while new.
 * Also: the real archive has unique versions and sorts 0.100h after 0.99h.
 * Fakes only: no network, no database.
 */
import { compareVersionsDesc, bellCount, inboxFor, noteMentionsFor, noteSeenKey, patchesToRing, payloadForPatches, shortPatchTitle, withRungPatches } from "@/lib/teamRoom/inbox";
import { payloadForNote, ringsForNote, splitQuotes } from "@/lib/teamRoom/notify";
import { cleanQuote, linesOf } from "@/lib/teamRoom/patchQuote";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { patchReadKey, patchReaders, patchUnread, type PatchMeta, type TeamAck } from "@/lib/teamRoom/extras";
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
  // 23 Oct 2026: the buzz is the Patch notes bot's @everyone, and opens its post in #patch-notes.
  ok(one.title === "@everyone New patch notes from Leo · v0.62" && one.body === "Goals", "one note: @everyone, who, which version, its name");
  ok(one.url === "/admin/team?tab=chat&ch=patch-notes&v=0.62" && one.tag === "kib-patch", "tap opens the bot's post in #patch-notes; one tag so buzzes group");
  const many = payloadForPatches([NOTES[0], NOTES[2]]);
  ok(many.title === "@everyone 2 new patch notes to read" && many.body.startsWith("v0.97h Merge · v0.62 Goals"), "several: one buzz that counts them");
  ok(many.url === "/admin/team?tab=chat&ch=patch-notes&v=0.97h", "several: tap opens the newest");
  ok(JSON.stringify(withRungPatches(["a", "b"], ["b", "c"])) === '["a","b","c"]', "remembered versions: no doubles");
  ok(withRungPatches(Array.from({ length: 400 }, (_, i) => `v${i}`), ["new"]).length === 300 && withRungPatches(null, ["x"])[0] === "x", "kept to the newest 300; junk ignored");
}

console.log("Notes under a patch note: @ and quoted lines");
{
  const note = (id: number, person: "Harry" | "Mikey" | "Leo", body: string, created = "2026-10-21T09:00:00Z", kind: "patch" | "idea" = "patch") =>
    ({ id, target_kind: kind, target_id: "0.95h", owner: "Harry" as const, person, body, created_at: created });
  ok(ringsForNote(note(1, "Mikey", "> Auto run\n@Harry is this right?")).map((r) => r.person).join() === "Harry", "@Harry in a note rings Harry");
  ok(ringsForNote(note(2, "Mikey", "@all look")).map((r) => r.person).join() === "Harry,Leo", "@all rings the other two");
  ok(ringsForNote(note(3, "Mikey", "@Mikey to self")).length === 0, "never the writer");
  const sq = splitQuotes("> Auto run takes over\n>Shift sprints\nwhy 0.6 s?");
  ok(sq.quotes.join("|") === "Auto run takes over|Shift sprints" && sq.text === "why 0.6 s?", "quoted lines come first, then the words");
  ok(splitQuotes("no quotes > here").quotes.length === 0, "a > in the middle is not a quote");
  const pay = payloadForNote(note(4, "Leo", "> Shift sprints\n@Harry too fast?"), "mention");
  ok(pay.title === "Leo mentioned you on patch notes v0.95h" && pay.body.includes("about: “Shift sprints”") && pay.url.endsWith("v=0.95h&notes=1"), "note buzz: who, which version, the line, opens the notes");
  const notes = [note(5, "Mikey", "@Harry look"), note(6, "Leo", "@all hi"), note(7, "Harry", "@Mikey"), note(8, "Mikey", "@Harry old", "2026-10-19T09:00:00Z"),
    note(9, "Mikey", "@Harry idea", undefined, "idea"), note(-10, "Mikey", "@Harry local")];
  ok(noteMentionsFor(notes, "Harry", []).map((n) => n.id).join() === "6,5", "Harry's mentions: @Harry and @all from others, patch notes only, from 20 Oct, newest first");
  ok(noteMentionsFor(notes, "Harry", [ack("Harry", noteSeenKey(5))]).map((n) => n.id).join() === "6", "seen clears a mention (receipt n:<id>)");
  ok(inboxFor(NOTES, "Mikey", [ack("Mikey", noteSeenKey(5))]).length === 4, "a mention receipt never clears a patch note");
  const lines = linesOf({ sections: [{ kind: "fixed", title: "", items: [{ title: "A  line" }, { title: "B" }] }, { kind: "history", title: "", items: [{ title: "old" }] }, { kind: "added", title: "", items: [{ title: "B" }] }] });
  ok(lines.join("|") === "A line|B", "tap-able lines: every headline once, history left out");
  ok(cleanQuote("  x ") === null && cleanQuote("two  words") === "two words" && (cleanQuote("y".repeat(300)) ?? "").length === 240, "a selection is cleaned and capped at 240");
}

console.log("An updated note is news again (Leo, 24 Oct 2026)");
{
  const UPD: PatchMeta[] = [
    { version: "0.97h", title: "Harry's patch notes: Merge", publishedAt: "2026-10-21T09:00:00Z" },
    { version: "0.62", title: "Leo's patch notes v0.20: Goals", publishedAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-21T12:00:00Z", updateNote: "Videos added" },
    { version: "0.50", title: "Mikey's patch notes v0.9: Old", publishedAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T10:00:00Z" },
  ];
  ok(patchReadKey(UPD[0]) === "0.97h" && patchReadKey(UPD[1]) === "0.62@2026-10-21T12:00:00Z", "the receipt key is the version, plus the update time once updated");
  ok(patchReadKey(UPD[2]) === "0.50" && vs(inboxFor(UPD, "Harry", [ack("Harry", "0.50"), ack("Harry", "0.62@2026-10-21T12:00:00Z")])) === "", "an old updatedAt with no updateNote is not an update (no flood of old notes)");
  ok(vs(inboxFor(UPD, "Mikey", [ack("Mikey", "0.62"), ack("Mikey", "0.50")])) === "0.62,0.97h", "read before the update: unread again, and first (its update is the newest change)");
  ok(vs(inboxFor(UPD, "Mikey", [ack("Mikey", "0.62@2026-10-21T12:00:00Z"), ack("Mikey", "0.50")])) === "0.97h", "reading the update clears it");
  ok(patchReaders(UPD[1], [ack("Harry", "0.62")]).join(",") === "Leo", "a read of the old version does not show as read on the update (only its author)");
  ok(patchUnread(UPD, "Harry", [ack("Harry", "0.62"), ack("Harry", "0.50")], "2026-10-20").map((n) => n.version).join(",") === "0.62", "the Team board counts it unread again");
  const now = Date.parse("2026-10-21T12:30:00Z");
  const r = patchesToRing(UPD, now, { Mikey: ["0.62", "0.97h", "0.50"] }, "2026-10-20", 6 * 3600_000).find((x) => x.person === "Mikey");
  ok(!!r && vs(r.notes) === "0.62", "rung for the old version: the update buzzes again");
  ok(payloadForPatches([UPD[1]]).title.startsWith("@everyone Updated patch notes from Leo"), "the buzz says Updated, not New");
  const r2 = patchesToRing(UPD, now, { Mikey: ["0.62@2026-10-21T12:00:00Z", "0.97h", "0.50"] }, "2026-10-20", 6 * 3600_000).find((x) => x.person === "Mikey");
  ok(!r2, "rung for the update already: no second buzz");
}

console.log("Version order and the real archive");
{
  const sorted = ["0.94", "0.100h", "0.99h", "0.95h", "0.63h", "1.0", "0.9"].sort(compareVersionsDesc);
  ok(sorted.join(",") === "1.0,0.100h,0.99h,0.95h,0.94,0.63h,0.9", "0.100h sorts after 0.99h (parseFloat would not)");
  const versions = BUILT_IN_PATCH_NOTES.map((n) => n.version);
  ok(new Set(versions).size === versions.length, `every archive version is unique (${versions.length})`);
  const bad = BUILT_IN_PATCH_NOTES.filter((n) => Number.isNaN(Date.parse(n.publishedAt)));
  ok(bad.length === 0, "every archive note has a real publish time");
  const badUpd = BUILT_IN_PATCH_NOTES.filter((n) => n.updateNote && !(Date.parse(n.updatedAt ?? "") > Date.parse(n.publishedAt)));
  ok(badUpd.length === 0, `every note with an updateNote has an update time after it went up${badUpd.length ? ` (${badUpd.map((n) => n.version).join(", ")})` : ""}`);
  const missing = Object.entries(PATCH_NOTE_PAGES).filter(([, f]) => !fs.existsSync(`patch-notes/${f}`));
  ok(missing.length === 0, `every kept page exists${missing.length ? ` (missing: ${missing.map(([v]) => v).join(", ")})` : ""}`);
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
