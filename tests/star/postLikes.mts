import { toggleLike } from "../../lib/star/media/feed";
import type { CareerState } from "../../lib/star/types";
import type { StoredPost } from "../../lib/star/media/types";

/**
 * Liking a post in the phone feed (23 Sep 2026): the heart goes pink and the
 * count goes up by one; tapping again takes it back. Saved on the post in the
 * career, so it stays liked when you come back.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const post = (id: string): StoredPost => ({
  id, at: 1_030_300, text: "2-1. on to the next one", eventId: id, tags: ["goal"],
  metrics: { likes: 84, reposts: 7, replies: 7 },
  author: { handle: "@nia", name: "Nia", archetype: "fan", platform: "x", verified: false, initials: "N", tint: "#7c3aed" },
});

const career = {
  media: { posts: [post("a"), post("b")], memory: {}, trends: [], lastCycleId: "", lastCycleClock: 0 },
} as unknown as CareerState;

const liked = toggleLike(career, "a");
check(liked.media!.posts[0].liked === true, "tapping the heart likes the post");
check(!liked.media!.posts[1].liked, "only that post is liked");
check(liked.media!.posts[0].metrics.likes === 84, "the stored count is untouched — the +1 is shown on top of it");
check(!career.media!.posts[0].liked, "the old save is not changed in place");

const unliked = toggleLike(liked, "a");
check(!unliked.media!.posts[0].liked, "tapping again unlikes it");

const none = { } as CareerState;
check(toggleLike(none, "a") === none, "a career with no feed yet is left alone");

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — liking a post saves on the post, only that post, and a second tap takes it back");
