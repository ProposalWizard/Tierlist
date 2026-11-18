/**
 * tests/star/teamRoomActiveNow.mts — the Team board tab's "active now" rule
 * and its three kinds of work bar (lib/teamRoom/activeNow.ts).
 * Run: npx tsx tests/star/teamRoomActiveNow.mts
 */
import { activeNow, activeStrip, agoWords, barState, foldDone, waitsOn, WORKING_WINDOW_MS, type ActiveSignals } from "@/lib/teamRoom/activeNow";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const NOW = Date.UTC(2026, 10, 13, 15, 0);
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const sig = (o: Partial<ActiveSignals>): ActiveSignals => ({ here: false, status: "", updateAt: null, pushAt: null, messageAt: null, ...o });

console.log("Who is active now");
{
  const a = activeNow(sig({ here: true, updateAt: ago(300) }), NOW);
  ok(a.kind === "active" && a.live && a.label === "Active now", "room open and used = Active now");
  ok(activeNow(sig({ here: true, status: "🎬 filming clips" }), NOW).detail === "🎬 filming clips", "Active now keeps their status beside it");

  const w = activeNow(sig({ updateAt: ago(6) }), NOW);
  ok(w.kind === "working" && w.live && w.label === "Working now" && w.detail === "via Claude chat", "a progress update 6 min ago = Working now · via Claude chat");
  ok(activeNow(sig({ pushAt: ago(19) }), NOW).kind === "working", "a push 19 min ago = Working now");
  ok(WORKING_WINDOW_MS === 20 * 60_000 && activeNow(sig({ pushAt: ago(20) }), NOW).kind === "last", "at 20 minutes it stops being Working now");
  ok(activeNow(sig({ messageAt: ago(2) }), NOW).kind === "last", "a message alone is not Working now (it only feeds last active)");
  ok(activeNow(sig({ updateAt: ago(6), status: "💼 Work · back at 17:00" }), NOW).kind === "working", "Working now beats a set status");

  const s = activeNow(sig({ status: "💼 Work · back at 17:00", updateAt: ago(125) }), NOW);
  ok(s.kind === "status" && !s.live && s.label === "💼 Work · back at 17:00" && s.detail === "last active 2h ago", "not live with a set status: the status, then last active 2h ago");

  const l = activeNow(sig({ updateAt: ago(600), pushAt: ago(125), messageAt: ago(400) }), NOW);
  ok(l.kind === "last" && l.label === "Last active 2h ago", "no status: Last active, from the newest of update, push and message");
  ok(activeNow(sig({ messageAt: ago(45) }), NOW).label === "Last active 45 min ago", "a message counts for last active");

  const n = activeNow(sig({}), NOW);
  ok(n.kind === "away" && n.label === "Away" && n.lastAt === null, "nothing known = Away");
  ok(activeNow(sig({ updateAt: "not a time" }), NOW).kind === "away", "a broken time is ignored");
  ok(activeNow(sig({ pushAt: new Date(NOW + 90_000).toISOString() }), NOW).kind === "working", "a time a little ahead of now (a clock off) reads as now");
}

console.log("How long ago");
ok(agoWords(NOW - 20_000, NOW) === "just now" && agoWords(NOW - 5 * 60_000, NOW) === "5 min ago" && agoWords(NOW - 3 * 3600_000, NOW) === "3h ago", "just now, 5 min ago, 3h ago");
ok(agoWords(NOW - 30 * 3600_000, NOW) === "yesterday" && agoWords(NOW - 3 * 86400_000, NOW) === "3 days ago", "yesterday, 3 days ago");

console.log("The strip at the top");
{
  const harry = activeNow(sig({ here: true }), NOW), mikey = activeNow(sig({ updateAt: ago(6) }), NOW), leo = activeNow(sig({ pushAt: ago(300) }), NOW);
  const a = activeStrip({ Harry: harry, Mikey: mikey, Leo: leo }, NOW);
  ok(a.live.join() === "Harry,Mikey" && a.words === "", "names the people who are active or working now");
  const b = activeStrip({ Harry: activeNow(sig({ pushAt: ago(125) }), NOW), Leo: leo }, NOW);
  ok(b.live.length === 0 && b.words === "Nobody is active right now. Last: Harry, 2h ago.", "nobody live: says who was last and when");
  ok(activeStrip({}, NOW).words === "Nobody is active right now.", "nothing known: just says nobody");
}

console.log("Work bars: in progress, waiting, done");
ok(barState({ label: "Team room", pct: 60, note: "building" }) === "progress", "60% building = in progress");
ok(barState({ label: "Green top bar", pct: 100, note: "live" }) === "done", "100% = done");
ok(barState({ label: "Night kits", pct: 40, note: "waiting on Harry's yes" }) === "waiting" && barState({ label: "Shop", pct: 80, note: "blocked: needs the SQL run" }) === "waiting", "a note that says waiting or blocked = waiting");
ok(barState({ label: "Done but waiting on film", pct: 100, note: "waiting" }) === "done", "100% is done even if the note says waiting");
ok(waitsOn("Mikey: run the bug SQL file", "Harry").join() === "Mikey", "a name in the line is who it waits on");
ok(waitsOn("you: pick a look", "Harry").join() === "Harry" && waitsOn("your yes on the mikeyish idea", "Leo").length === 0, "\"you\" means the card's own person; words that only contain a name do not count");
ok(waitsOn("Harry and you", "Harry").join() === "Harry" && waitsOn(null, "Leo").length === 0, "no doubles; no line, nobody");
ok(foldDone([1, 2, 3]).shown.length === 3 && foldDone([1, 2, 3]).more === 0, "3 done: all three shown");
ok(foldDone([1, 2, 3, 4]).shown.length === 2 && foldDone([1, 2, 3, 4]).more === 2, "4 done: 2 shown and +2");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll passed");
