/**
 * lib/teamRoom/demo.ts — sample rows for a dev build with no database or
 * no sign-in (offlineDevPlayEnabled), so the Team room can be seen and
 * clicked on locally. Never used on the live site. ?teamroom=new shows the
 * "Which one are you?" step instead.
 */
import type { TeamPerson } from "./config";
import type { TeamIdea, TeamMessage, TeamNote, TeamTask, TeamVote } from "./logic";
import { pointUrl, type ReadMarks, type TeamAck } from "./extras";

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
  ];
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
  ];
  const me: TeamPerson | null = fresh ? null : "Harry";
  return { me, taken: fresh ? (["Mikey"] as TeamPerson[]) : [], messages, ideas, votes, tasks, notes, online: ["Harry", "Mikey"] as TeamPerson[], marks, acks };
}
