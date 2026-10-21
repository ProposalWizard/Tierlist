/**
 * tests/star/teamRoomNotify.mts — the Team room's phone notifications
 * (lib/teamRoom/notify.ts): who a message, a reply, a point, a job given and
 * a pushed job ring; never the sender; @all; one buzz each; pushed jobs only
 * once and only while new; devices kept per account (newest five), and a
 * device the push service says is gone dropped. Fakes only: no network, no
 * web-push, no database.
 */
import fs from "node:fs";
import {
  RungBefore, chatTag, cleanDevices, deliver, deviceFrom, isGone, jobsToRing, mayRing, mentionsAll, payloadForJob, payloadForMessage,
  payloadForTask, ringsForJob, ringsForMessage, ringsForTask, withDevice, withRungJobs, withoutDevices,
  type PushDevice, type PushPayload,
} from "@/lib/teamRoom/notify";
import { composeBody, pointUrl } from "@/lib/teamRoom/extras";
import { markerTitle, type TeamJob } from "@/lib/teamRoom/jobs";
import { TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const who = (r: { person: string; why: string }[]) => r.map((x) => `${x.person}:${x.why}`).join(",");
const NOW = Date.UTC(2026, 9, 20, 12, 0);
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

console.log("Who a chat message rings");
{
  const m = (person: TeamPerson, body: string) => ({ person, body });
  ok(who(ringsForMessage(m("Harry", "@Leo @Mikey look at this"), null)) === "Mikey:mention,Leo:mention", "@Leo @Mikey → both, board order");
  ok(who(ringsForMessage(m("Harry", "@harry note to self, and @MIKEY"), null)) === "Mikey:mention", "never the sender, even if he @'s himself; any case");
  ok(ringsForMessage(m("Harry", "mail x@leo.com about it"), null).length === 0, "an email address is not a mention");
  ok(ringsForMessage(m("Harry", "ok 👍"), null).length === 0, "a plain message rings nobody");
  ok(who(ringsForMessage(m("Leo", "@all deploy at 6"), null)) === "Harry:all,Mikey:all", "@all → the other two, not the sender");
  ok(who(ringsForMessage(m("Mikey", "heads up @everyone"), null)) === "Harry:all,Leo:all", "@everyone too");
  ok(who(ringsForMessage(m("Mikey", "@Team quick one"), null)) === "Harry:all,Leo:all", "@team too");
  ok(!mentionsAll("me@all.com") && !mentionsAll("allstars") && mentionsAll("@All"), "@all only as a word of its own");
  ok(who(ringsForMessage(m("Leo", "@all and @Harry"), null)) === "Harry:mention,Mikey:all", "@all and @Harry → Harry once (as a mention), Mikey once");

  const reply = composeBody("agreed", { replyTo: 41 });
  ok(who(ringsForMessage(m("Mikey", reply), { person: "Harry" })) === "Harry:reply", "a reply rings whoever wrote the message it answers");
  ok(ringsForMessage(m("Mikey", reply), { person: "Mikey" }).length === 0, "replying to your own message rings nobody");
  ok(ringsForMessage(m("Mikey", reply), null).length === 0, "a reply to a message that is gone rings nobody");
  ok(who(ringsForMessage(m("Mikey", composeBody("@Harry yes", { replyTo: 41 })), { person: "Harry" })) === "Harry:reply", "a reply that also @'s the same person rings him once");
  ok(who(ringsForMessage(m("Mikey", composeBody("@Leo see Harry's", { replyTo: 41 })), { person: "Harry" })) === "Harry:reply,Leo:mention", "a reply that @'s someone else rings both");

  const pt = pointUrl("/admin/team", { v: 1, id: "p1", by: "Mikey", to: ["Harry", "Leo"], n: "look", x: 1, y: 1, w: 10, h: 10, sx: 0, sy: 0, vw: 390, vh: 844 });
  ok(who(ringsForMessage(m("Mikey", `@Harry @Leo 👉 look\n${pt}`), null)) === "Harry:point,Leo:point", "a point rings who it is for (as a point, not a mention)");
  const self = pointUrl("/admin/team", { v: 1, id: "p2", by: "Mikey", to: ["Mikey"], n: "", x: 1, y: 1, w: 10, h: 10, sx: 0, sy: 0, vw: 390, vh: 844 });
  ok(ringsForMessage(m("Mikey", `👉\n${self}`), null).length === 0, "a point at yourself rings nobody");

  ok(mayRing("@Mikey") && mayRing("[re:3] ok") && mayRing(`x\n${pt}`) && !mayRing("ok 👍"), "the phone only asks when the text could ring someone");
}

console.log("What a chat buzz says, and where a tap goes");
{
  const msg = { id: 77, person: "Harry" as TeamPerson, body: "@Mikey can you check the keeper page?", image_url: null };
  const p = payloadForMessage(msg, "mention");
  ok(p.title === "Harry mentioned you", `title (${p.title})`);
  ok(p.body === "@Mikey can you check the keeper page?", "body = the message words");
  ok(p.url === `${TEAM_ROOM.home}?tab=chat&m=77`, "tap → the chat, on that message");
  ok(payloadForMessage(msg, "reply").title === "Harry replied to you" && payloadForMessage(msg, "all").title === "Harry to the team"
    && payloadForMessage(msg, "point").title === "Harry pointed at something for you", "titles for reply, @all, point");
  ok(payloadForMessage({ ...msg, body: "", image_url: "https://x/y.webp" }, "mention").body === "📷 Picture", "a picture-only message says Picture");
  ok(payloadForMessage({ ...msg, body: "a".repeat(400) }, "mention").body.length === 160, "long words cut to 160");
  ok(chatTag("@Mikey hi") === "kib-chat" && chatTag(composeBody("yes", { replyTo: 9 })) === "kib-chat-9", "one tag for the chat, one per reply thread (the phone groups them)");
}

console.log("Jobs given on the board");
{
  ok(who(ringsForTask({ owner: "Leo", made_by: "Harry", title: "Fix the lag" })) === "Leo:task", "a job given to Leo rings Leo");
  ok(ringsForTask({ owner: "Harry", made_by: "Harry", title: "Mine" }).length === 0, "your own job rings nobody");
  ok(ringsForTask({ owner: "Harry", made_by: "Harry", title: markerTitle({ id: "lag-test", title: "Lag test" }) }).length === 0, "ticking a pushed job (its tick row) rings nobody");
  const p = payloadForTask({ made_by: "Harry", title: "Fix the lag" });
  ok(p.title === "Harry gave you a job" && p.url === `${TEAM_ROOM.home}?tab=todo` && p.tag === "kib-todo", "says who gave it; tap → To-do");
}

console.log("Pushed jobs (team/jobs.json)");
{
  const job = (id: string, over: Partial<TeamJob> = {}): TeamJob => ({ id, owner: "all", title: `Job ${id}`, prompt: null, from: "Harry", added: iso(30), ...over });
  ok(who(ringsForJob(job("a"))) === "Mikey:job,Leo:job", "for all, from Harry → Mikey and Leo (never whoever asked)");
  ok(who(ringsForJob(job("b", { owner: "Leo", from: "Mikey" }))) === "Leo:job", "for Leo → Leo");
  ok(ringsForJob(job("c", { owner: "Leo", from: "Leo" })).length === 0, "Leo's own reminder rings nobody");
  ok(payloadForJob(job("a")).title === "New job from Harry", "says who asked");

  const jobs = [job("new"), job("old", { added: iso(60 * 25) }), job("future", { added: iso(-60) }), job("leo", { owner: "Leo", from: "Mikey" })];
  const r = jobsToRing(jobs, ["new", "old", "future", "leo", "missing"], NOW, {});
  ok(r.map((x) => x.job.id).join() === "new,leo", `only new jobs, asked for, still in the file (${r.map((x) => x.job.id).join()})`);
  const again = jobsToRing(jobs, ["new", "leo"], NOW, { Mikey: ["new"], Leo: ["leo"] });
  ok(again.length === 1 && again[0].job.id === "new" && again[0].to.join() === "Leo", "each person rung once per job: Mikey had it, Leo hadn't");
  ok(jobsToRing(jobs, ["new"], NOW, { Mikey: ["new"], Leo: ["new"] }).length === 0, "everyone had it → nothing");
  ok(jobsToRing(jobs, [], NOW, {}).length === 0, "nothing asked → nothing");
  ok(withRungJobs(["a", "b"], ["b", "c"]).join() === "a,b,c" && withRungJobs("junk", ["x"]).join() === "x", "remembered list: no doubles, junk ignored");
  ok(withRungJobs(Array.from({ length: 250 }, (_, i) => `j${i}`), ["new"]).length === 200, "remembered list kept to 200");
}

console.log("Devices kept on the account");
{
  const dev = (n: number, at = iso(n)): PushDevice => ({ endpoint: `https://fcm.googleapis.com/fcm/send/dev${n}`, p256dh: `key${n}`, auth: `auth${n}`, at });
  ok(cleanDevices([dev(1), { endpoint: "http://not-https", p256dh: "k", auth: "a" }, { endpoint: "https://x" }, null, "x", dev(1)]).length === 1,
    "junk, plain http, missing keys and doubles left out");
  ok(cleanDevices(undefined).length === 0 && cleanDevices({}).length === 0, "nothing kept yet → none, no crash");
  const sub = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "P", auth: "A" } };
  const d = deviceFrom(sub, NOW);
  ok(!!d && d.endpoint === sub.endpoint && d.p256dh === "P" && d.auth === "A" && d.at === new Date(NOW).toISOString(), "a browser subscription becomes a device");
  ok(deviceFrom({ endpoint: "https://x" }, NOW) === null && deviceFrom(null, NOW) === null, "a broken one does not");

  let list: PushDevice[] = [];
  for (let i = 1; i <= 7; i++) list = withDevice(list, dev(i));
  ok(list.length === TEAM_ROOM.push.maxDevices && list[0].endpoint.endsWith("dev7") && list[4].endpoint.endsWith("dev3"), "newest five kept (7 phones → 7,6,5,4,3)");
  list = withDevice(list, { ...dev(5), p256dh: "fresh" });
  ok(list.length === 5 && list[0].endpoint.endsWith("dev5") && list[0].p256dh === "fresh" && list.filter((x) => x.endpoint.endsWith("dev5")).length === 1,
    "the same phone again moves to the top with its new keys, never twice");
  ok(withoutDevices(list, [dev(7).endpoint, dev(4).endpoint]).map((x) => x.endpoint.slice(-4)).join() === "dev5,dev6,dev3", "turned off / gone → removed");
  ok(isGone(404) && isGone(410) && !isGone(500) && !isGone(429) && !isGone(undefined), "404 and 410 = gone; anything else = try again later");
}

console.log("Sending, with a fake push service");
{
  const dev = (name: string): PushDevice => ({ endpoint: `https://push.example/${name}`, p256dh: "k", auth: "a", at: iso(0) });
  const accounts: Record<string, PushDevice[]> = {
    Harry: [dev("harry-phone"), dev("harry-mac")],
    Mikey: [dev("mikey-phone"), dev("mikey-old")],
    Leo: [],
  };
  const sent: string[] = [];
  const bodies: string[] = [];
  const answer: Record<string, number> = { "mikey-old": 410, "harry-mac": 500 };
  const payload: PushPayload = { title: "t", body: "b", tag: "kib-chat", url: "/admin/team?tab=chat&m=1" };
  const r = await deliver({
    rings: [{ person: "Harry", payload }, { person: "Mikey", payload }, { person: "Leo", payload }],
    devicesOf: async (p) => accounts[p].slice(),
    saveDevices: async (p, list) => { accounts[p] = list; },
    send: async (d, body) => {
      const name = d.endpoint.split("/").pop()!;
      if (answer[name]) throw Object.assign(new Error("refused"), { statusCode: answer[name] });
      sent.push(name); bodies.push(body);
    },
    now: NOW + 3_600_000,
  });
  ok(sent.sort().join() === "harry-phone,mikey-phone", `each live device got one buzz (${sent.join()})`);
  ok(r.sent === 2 && r.failed === 1 && r.dropped === 1, `counts: 2 sent, 1 failed, 1 gone (${JSON.stringify(r)})`);
  ok(accounts.Mikey.map((x) => x.endpoint.split("/").pop()).join() === "mikey-phone", "the gone device (410) is dropped from Mikey's account");
  ok(accounts.Harry.length === 2, "a device that failed for another reason (500) is kept");
  ok(r.noDevice.join() === "Leo", "Leo has nothing switched on: noted, nothing sent");
  ok(JSON.parse(bodies[0]).url === payload.url, "the buzz carries where the tap goes");

  // A phone added while the send was in flight is not lost when a gone one is dropped.
  const acc: Record<string, PushDevice[]> = { Leo: [dev("leo-gone")] };
  let reads = 0;
  await deliver({
    rings: [{ person: "Leo", payload }],
    devicesOf: async () => { reads++; return reads === 1 ? [dev("leo-gone")] : [dev("leo-new"), dev("leo-gone")]; },
    saveDevices: async (p, list) => { acc[p] = list; },
    send: async () => { throw Object.assign(new Error("gone"), { statusCode: 404 }); },
    now: NOW + 3_600_000,
  });
  ok(acc.Leo.map((x) => x.endpoint.split("/").pop()).join() === "leo-new", "dropping a gone device keeps one added meanwhile");

  // Seen live: Google answered 410 to a subscription seconds old, then took it 15 s later.
  const fresh: Record<string, PushDevice[]> = { Leo: [{ ...dev("leo-just-on"), at: new Date(NOW).toISOString() }] };
  const rf = await deliver({
    rings: [{ person: "Leo", payload }],
    devicesOf: async () => fresh.Leo.slice(),
    saveDevices: async (p, list) => { fresh[p] = list; },
    send: async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); },
    now: NOW + 30_000,
  });
  ok(fresh.Leo.length === 1 && rf.dropped === 0 && rf.failed === 1, "a device turned on under 2 minutes ago is never dropped on a 410 (counted as failed)");
}

console.log("Asked twice, rung once");
{
  const once = new RungBefore(3);
  ok(once.first("m:1") && !once.first("m:1"), "the same message twice → once");
  once.first("m:2"); once.first("m:3"); once.first("m:4");
  ok(once.first("m:1"), "oldest forgotten past the cap (memory stays small)");
}

console.log("The wiring");
{
  const sw = fs.readFileSync("public/admin/team-sw.js", "utf8");
  ok(!/addEventListener\(\s*["']fetch["']/.test(sw) && !/caches\./.test(sw), "the worker never handles or stores a page (no fetch, no cache)");
  ok(/addEventListener\("push"/.test(sw) && /addEventListener\("notificationclick"/.test(sw), "the worker shows a buzz and opens the Team room on a tap");
  ok(TEAM_ROOM.push.worker.startsWith(TEAM_ROOM.push.scope) && TEAM_ROOM.push.scope === "/admin/", "worker and scope are /admin only (never the game or the public site)");
  ok(/^B[A-Za-z0-9_-]{86}$/.test(TEAM_ROOM.push.publicKey), "the public key looks like one (65 bytes, url-safe)");
  const repo = [
    "lib/teamRoom/config.ts", "lib/teamRoom/notify.ts", "lib/teamRoom/notifyServer.ts", "lib/teamRoom/push.ts",
    "app/api/admin/team/notify/route.ts", "public/admin/team-sw.js", "CLAUDE.md",
  ].map((f) => fs.readFileSync(f, "utf8")).join("\n");
  ok(!/TEAM_PUSH_PRIVATE_KEY\s*=\s*["'][A-Za-z0-9_-]{30,}/.test(repo), "no private key written into the code");
  const route = fs.readFileSync("app/api/admin/team/notify/route.ts", "utf8");
  ok(/isAdmin\(/.test(route) && /createServiceClient\(/.test(route) && /row\.person !== me/.test(route) && /row\.made_by !== me/.test(route),
    "the route checks admin, reads the row itself, and only the sender can ring for it");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  ok(/^\d+\.\d+\.\d+$/.test(pkg.dependencies["web-push"] ?? ""), `web-push pinned to an exact version (${pkg.dependencies["web-push"]})`);
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll good");
