"use client";
import { useState } from "react";
import type { StoredPost } from "@/lib/star/media/types";
import PostCard, { FEED_LIST_CLASS } from "./PostCard";

/**
 * The feed, with fixed sample posts, for judging how a post LOOKS.
 *
 * Every row is drawn by the real `PostCard`, in the same scrolling column the
 * phone uses, so what is judged here is what a player sees. Reached from the
 * Media Lab (`/star-dev/media-lab?feed`). Seeded: the same posts every time.
 */

const WEEK = 10_000;
const AT = 1 * 1_000_000 + 3 * WEEK + 300;
export const PREVIEW_NOW = AT + WEEK;

const base = (id: string, author: StoredPost["author"], text: string, metrics: StoredPost["metrics"], extra: Partial<StoredPost> = {}): StoredPost => ({
  id, at: AT, author, text, metrics, eventId: id, tags: ["goal"], ...extra,
});

export const PREVIEW_POSTS: StoredPost[] = [
  base("p1", { handle: "@northbank_nia", name: "Nia", archetype: "fan", platform: "x", verified: false, initials: "N", tint: "#7c3aed", tint2: "#a855f7", glyph: "flag" },
    "2-1. on to the next one 💪", { replies: 7, reposts: 7, likes: 84 }),
  base("p2", { handle: "@TheStarBack", name: "The Star — Back Page", archetype: "tabloid", platform: "news", verified: true, initials: "TS", tint: "#15803d", tint2: "#22c55e", glyph: "flag" },
    "NS DIED DOES IT AGAIN! ⚽", { replies: 95, reposts: 351, likes: 1500 }),
  base("p3", { handle: "@Barnet", name: "Barnet FC", archetype: "club", platform: "x", verified: true, initials: "BF", tint: "#b45309", tint2: "#f59e0b" },
    "Days like that are why you support a football club. 2-1! 💛", { replies: 180, reposts: 529, likes: 3400 }),
  base("p4", { handle: "@MatchdayMirror", name: "Matchday Mirror", archetype: "broadsheet", platform: "news", verified: true, initials: "MM", tint: "#3b82f6", tint2: "#60a5fa", glyph: "flag" },
    "BARNET 2-1 CARDIFF CITY 👑", { replies: 181, reposts: 207, likes: 1200 },
    { graphic: { type: "scoreline", home: "Barnet", away: "Cardiff City", hs: 2, as: 1, competition: "National League", homeScorers: ["NS Died 23'", "K. Dempsey 71'"], awayScorers: ["R. Colwill 58'"] } }),
  base("p5", { handle: "@OptaLeague", name: "Numbers FC", archetype: "stats", platform: "x", verified: true, initials: "NF", tint: "#059669", tint2: "#34d399", glyph: "grid" },
    "3 goals in his last 4 games.\n\n- Kyle Dempsey: 🔥", { replies: 64, reposts: 310, likes: 2900 },
    { graphic: { type: "statLine", title: "Kyle Dempsey — last 4", context: "National League", rows: [{ label: "Goals", value: "3", highlight: true }, { label: "Assists", value: "1" }, { label: "Shots", value: "11" }, { label: "Rating", value: "7.8" }] } }),
  base("p6", { handle: "@NationalLeague", name: "National League", archetype: "league", platform: "x", verified: true, initials: "NL", tint: "#1e3a8a", tint2: "#3b82f6", glyph: "trophy" },
    "Your Player of the Month for August 🏆", { replies: 212, reposts: 890, likes: 6100 },
    { graphic: { type: "potmWinner", month: "August", firstName: "NS", lastName: "Died", club: "Barnet", goals: 6, assists: 2, isYou: true, number: 9 } }),
  base("p8", { handle: "@Barnet", name: "Barnet FC", archetype: "club", platform: "x", verified: true, initials: "BF", tint: "#b45309", tint2: "#f59e0b" },
    "CHAMPIONS 🏆", { replies: 402, reposts: 2100, likes: 18000 },
    { graphic: { type: "trophy", competition: "Premier League", club: "Barnet", season: 3 } }),
  base("p7", { handle: "@tactics_tom", name: "Tom · Tactics", archetype: "pundit", platform: "x", verified: false, initials: "TT", tint: "#be123c", tint2: "#f43f5e", glyph: "mic" },
    "Barnet's shape without the ball is the most improved thing in the league this season. Everyone talks about the goals, but look at how narrow they get when Cardiff try to play through the middle — nothing gets in.", { replies: 41, reposts: 58, likes: 402 }),
];

export default function FeedPreview() {
  // Hearts work here too, in this tab only, so a like can be tried and judged.
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setLiked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="min-h-screen bg-gray-950 py-4">
      <div className="mx-auto w-[390px] max-w-full overflow-hidden rounded-[28px] border border-white/15 bg-black">
        <div className={FEED_LIST_CLASS}>
          {PREVIEW_POSTS.map(p => <PostCard key={p.id} post={{ ...p, liked: liked.has(p.id) }} now={PREVIEW_NOW} onToggleLike={toggle} />)}
        </div>
      </div>
    </div>
  );
}
