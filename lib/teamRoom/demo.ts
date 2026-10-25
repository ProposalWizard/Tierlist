/**
 * lib/teamRoom/demo.ts — sample rows for a dev build with no database or
 * no sign-in (offlineDevPlayEnabled), so the Team room can be seen and
 * clicked on locally. Never used on the live site. ?teamroom=new shows the
 * "Which one are you?" step instead.
 */
import type { TeamPerson } from "./config";
import type { TeamIdea, TeamMessage, TeamNote, TeamTask, TeamVote } from "./logic";
import { pointUrl, type ReadMarks, type TeamAck } from "./extras";
import type { BotRow, ChannelReads, ChannelRow, TeamDm, TeamReaction } from "./channels";
import type { StatusRow } from "./status";
import type { WelcomeRead, WelcomeRow } from "./welcome";
import type { BugMark } from "./bugs";

export function demoRoom(now: number) {
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const fresh = typeof window !== "undefined" && /[?&]teamroom=new\b/.test(window.location.search);
  const messages: TeamMessage[] = [
    { id: 1, person: "Harry", body: "Run dev_status.sql when you get a sec", image_url: null, page: "/admin/team", pinned: true, created_at: ago(60 * 26) },
    { id: 2, person: "Mikey", body: "keeper dive looks late on corners", image_url: null, page: "/star-highlights-dev", pinned: false, created_at: ago(14) },
    { id: 3, person: "Leo", body: "same on my clips, the goal clip page shows it too", image_url: null, page: "/star-goal-clips-dev", pinned: false, created_at: ago(12) },
    { id: 4, person: "Harry", body: "looking now 👀", image_url: null, page: "/admin/team?tab=chat", pinned: false, created_at: ago(9) },
    { id: 5, person: "Mikey", body: "Vercel: push main on its own first, then the branches", image_url: null, page: null, pinned: true, created_at: ago(5) },
    // Round two: a reply, an @mention, a page card and a point.
    { id: 6, person: "Leo", body: "[re:2] I think it's the dive start, @Harry can you check the keeper page?", image_url: null, page: "/star-goal-clips-dev", pinned: false, created_at: ago(4) },
    { id: 7, person: "Harry", body: "Here's the page\n/star-gallery-dev", image_url: null, page: "/admin/team?tab=chat", pinned: false, created_at: ago(3) },
    { id: 8, person: "Mikey", body: `@Harry 👉 this card's numbers look off\n${pointUrl("/admin/team", {
      v: 1, id: "demo-pt1", by: "Mikey", to: ["Harry"], n: "this card's numbers look off", pn: "Team board",
      sel: ".tb-person.Harry", ex: 0, ey: 0, ew: 1, eh: 0.16,
      x: 24, y: 330, w: 320, h: 140, sx: 0, sy: 0, vw: 390, vh: 844,
    })}`, image_url: null, page: "/admin/team", pinned: false, created_at: ago(2) },
    // Channels (23 Oct 2026): two more thread replies under 2, and a message in each channel.
    { id: 9, person: "Mikey", body: "[re:2] fixed on my branch, the dive starts 4 frames earlier now", image_url: null, page: "/star-highlights-dev", pinned: false, created_at: ago(1.9) },
    { id: 10, person: "Harry", body: "[re:2] 👍 looks right on my phone", image_url: null, page: "/admin/team?tab=chat", pinned: false, created_at: ago(1.8) },
    { id: 11, person: "Leo", body: "[#ideas] Rain idea: can the ball skid on wet grass?", image_url: null, page: "/admin/team?tab=chat", pinned: false, created_at: ago(1.7) },
    { id: 12, person: "Mikey", body: "[#ideas] [re:11] yes, only on grass pitches. Adding it to the board", image_url: null, page: "/admin/team?tab=chat", pinned: false, created_at: ago(1.6) },
    { id: 13, person: "Mikey", body: "[#bugs] Keeper freezes after a save on corners @Harry", image_url: null, page: "/star-highlights-dev", pinned: false, created_at: ago(1.5) },
    { id: 14, person: "Harry", body: "[#marketing] v03 short is in the Studio, notes welcome\n/admin/marketing/studio", image_url: null, page: "/admin/marketing", pinned: false, created_at: ago(1.4) },
    { id: 15, person: "Leo", body: "[#context] Ruling: the FA Cup has ten rounds now, each league joins at its real round", image_url: null, page: "/admin/team?tab=chat", pinned: false, created_at: ago(1.3) },
    { id: 16, person: "Mikey", body: "[#patch-notes] read 0.108, the bicycle kicks look great @everyone", image_url: null, page: "/admin/team?tab=chat", pinned: false, created_at: ago(1.2) },
  ];
  const reactions: TeamReaction[] = [
    { message_id: 2, emoji: "👀", person: "Harry", at: ago(13) }, { message_id: 2, emoji: "👀", person: "Leo", at: ago(12) },
    { message_id: 2, emoji: "🔥", person: "Mikey", at: ago(12) },
    { message_id: 4, emoji: "👍", person: "Mikey", at: ago(8) }, { message_id: 4, emoji: "👍", person: "Leo", at: ago(8) },
    { message_id: 5, emoji: "✅", person: "Harry", at: ago(4) },
    { message_id: 11, emoji: "🔥", person: "Harry", at: ago(1.6) },
  ];
  const dms: TeamDm[] = [
    { id: 1, from_person: "Mikey", to_person: "Harry", body: "can you look at my shop branch before the push?", created_at: ago(50) },
    { id: 2, from_person: "Harry", to_person: "Mikey", body: "yes, after lunch", created_at: ago(45) },
    { id: 3, from_person: "Mikey", to_person: "Harry", body: "cheers, no rush", created_at: ago(3) },
    { id: 4, from_person: "Leo", to_person: "Harry", body: "the clip page is slow on my phone, not sure it's worth the whole team seeing yet", created_at: ago(6) },
  ];
  const channelRows: ChannelRow[] = [
    { slug: "3d-world", name: "3d-world", topic: "The garden, the shop and the house", made_by: "Mikey", created_at: ago(60 * 5) },
  ];
  // You (Harry) have read #general up to 5 and your DM with Mikey up to 2.
  const chRead: ChannelReads = { general: 5, "dm:Mikey": 2, "3d-world": 0 };
  // Mikey has seen up to 7, Leo up to 4, Harry (you) up to 5.
  const marks: ReadMarks = { Harry: 5, Mikey: 7, Leo: 4 };
  const acks: TeamAck[] = [
    { kind: "patch", target: "0.59", person: "Harry", at: ago(60) },
    { kind: "patch", target: "0.57", person: "Mikey", at: ago(90) },
    { kind: "patch", target: "0.57", person: "Leo", at: ago(80) },
  ];
  const ideas: TeamIdea[] = [
    { id: 1, person: "Mikey", title: "Rainy matches slow the ball", stage: "doing", created_at: ago(60 * 48), updated_at: ago(60 * 3) },
    { id: 2, person: "Harry", title: "Weekly Hall of Fame post in the media feed", stage: "idea", created_at: ago(60), updated_at: ago(60) },
    { id: 3, person: "Leo", title: "Manager rants after a red card", stage: "idea", created_at: ago(300), updated_at: ago(300) },
    { id: 4, person: "Mikey", title: "Night kits for floodlit games", stage: "idea", created_at: ago(60 * 72), updated_at: ago(60 * 72) },
    { id: 5, person: "Harry", title: "Admin home-screen app", stage: "done", created_at: ago(60 * 96), updated_at: ago(60 * 20) },
  ];
  const votes: TeamVote[] = [
    { idea_id: 1, person: "Harry" }, { idea_id: 1, person: "Mikey" }, { idea_id: 1, person: "Leo" },
    { idea_id: 2, person: "Harry" }, { idea_id: 2, person: "Mikey" }, { idea_id: 3, person: "Leo" },
  ];
  const tasks: TeamTask[] = [
    { id: 1, owner: "Harry", made_by: "Harry", title: "Test the Drive upload on my phone", done_at: null, created_at: ago(200) },
    { id: 2, owner: "Harry", made_by: "Leo", title: "Check goal clips on iPhone", done_at: null, created_at: ago(30) },
    { id: 3, owner: "Harry", made_by: "Mikey", title: "Say yes or no on night kits", done_at: null, created_at: ago(60 * 20) },
    { id: 4, owner: "Harry", made_by: "Harry", title: "Run tester_access.sql", done_at: ago(120), created_at: ago(60 * 30) },
    { id: 5, owner: "Mikey", made_by: "Harry", title: "Run dev_status.sql", done_at: null, created_at: ago(60 * 26) },
  ];
  const notes: TeamNote[] = [
    { id: 1, target_kind: "idea", target_id: "1", owner: "Mikey", person: "Harry", body: "only on grass pitches, not 3G", created_at: ago(60 * 20) },
    { id: 2, target_kind: "idea", target_id: "1", owner: "Mikey", person: "Leo", body: "can the goal clips show the splash?", created_at: ago(180) },
    { id: 3, target_kind: "idea", target_id: "2", owner: "Harry", person: "Mikey", body: "yes, and a share picture", created_at: ago(40) },
    { id: 4, target_kind: "patch", target_id: "0.59", owner: "Mikey", person: "Leo", body: "Ageing reads well. Are League Two fees still too big?", created_at: ago(30) },
    // The Inbox's "Mentions" (21 Oct 2026): a note that @'s you, quoting a line.
    { id: 5, target_kind: "patch", target_id: "0.94", owner: "Harry", person: "Mikey", body: "> Pick a body\n@Harry C looks best to me, can we see it in a match?", created_at: ago(8) },
  ];
  // Round four (25 Oct 2026): sample statuses, a schedule, the first-open note and two bug reports.
  // Neutral sample words only (the repo is public).
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const statuses: Partial<Record<TeamPerson, StatusRow>> = {
    Mikey: { person: "Mikey", emoji: "🎬", text: "filming clips", clear_at: new Date(now + 3 * 3600_000).toISOString(), dnd_until: null, schedules: [], tz: null, updated_at: ago(30) },
    Leo: {
      person: "Leo", emoji: null, text: null, clear_at: null, dnd_until: null, tz: null, updated_at: ago(300),
      // On now in the sample (from the hour before to three hours on), so the "back at" line shows.
      schedules: [{ id: "s1", emoji: "💼", text: "Work", days: [0, 1, 2, 3, 4, 5, 6], from: `${String(Math.max(0, new Date(now).getHours() - 1)).padStart(2, "0")}:00`, to: `${String(Math.min(23, new Date(now).getHours() + 3)).padStart(2, "0")}:00`, pause: true }],
    },
  };
  const welcome: WelcomeRow = {
    body: "Welcome to the Team room, {name}. Chat, bugs, plans and bots now live here, in channels on the left.\n\nSet a status so the others know when you're free. Busy is fine.",
    lines: { Mikey: "Sample line for Mikey.", Leo: "Sample line for Leo." }, version: 1, updated_at: ago(60), updated_by: "Harry",
  };
  const welcomeReads: WelcomeRead[] = [{ person: "Harry", version: 1, at: ago(60) }, { person: "Mikey", version: 1, at: ago(20) }];
  const botRows: BotRow[] = [
    { id: 481, bot: "bug", channel: "bugs", title: "Keeper froze mid dive in the cup semi", body: "Keeper froze mid dive in the cup semi\nSecond half, took the penalty, the keeper stopped mid dive.", url: "/star-dev", everyone: false, created_at: ago(95), meta: { page: "https://knowitball.co.uk/star-dev", signed_in: true } },
    { id: 482, bot: "bug", channel: "bugs", title: "Shop button is off the screen on my phone", body: "Shop button is off the screen on my phone", url: "/star-dev", everyone: false, created_at: ago(7), meta: { page: "https://knowitball.co.uk/star-dev", signed_in: false } },
  ];
  const bugMarks: BugMark[] = [{ post_id: 481, handed_to: "Leo", fixed_by: null, fixed_at: null, updated_by: "Leo", updated_at: ago(80) }];
  const me: TeamPerson | null = fresh ? null : "Harry";
  return {
    me, taken: fresh ? (["Mikey"] as TeamPerson[]) : [], messages, ideas, votes, tasks, notes, online: ["Harry", "Mikey"] as TeamPerson[], marks, acks,
    reactions, dms: me ? dms : [], channelRows, botRows, chRead, statuses, welcome, welcomeReads, bugMarks,
  };
}
