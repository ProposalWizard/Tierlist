"use client";

/**
 * RELATIONS — the people in your career, one card each.
 *
 * PROTOTYPE (home-screen proto, 27 Sep 2026). Harry: "lets build it up" —
 * Relations was just five bars. Everything here is data the game already
 * keeps; nothing new is tracked and no mechanic is added:
 *   - the week (days left, energy, Rest) — exactly what LifeScreen had;
 *   - your manager (career.manager), the dressing room (career.squad), the
 *     fans (your club and city), your sponsors (career.sponsors), and you
 *     (happiness, and a partner if career.girlfriend is set);
 *   - reputation and fame, lifestyle (ownedItems), the Garden and the horse.
 * "What moves it" lines are read off the real rules (matchStats.ts,
 * careerFlow.ts's sponsor gain), not written as flavour.
 */
import type { CareerState } from "@/lib/star/types";
import type { RelationshipKind } from "./RelationshipMinigame";
import { actionsLeft, WEEK_ACTIONS } from "@/lib/star/week";
import { reputationLabel } from "@/lib/star/reputation";
import { reputationTier, styleBlurb } from "@/lib/star/manager";
import { fameOf, fameLevel } from "@/lib/star/fame";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import ClubBadge from "./ClubBadge";

type Open = "reputation" | "garden" | "casino-menu" | "shop-lifestyle" | "sponsors";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

// A word for where each one stands. Same thresholds for all, words to suit.
const WORDS: Record<RelationshipKind, [string, string, string, string, string]> = {
  boss: ["Rates you", "Trusts you", "Not sure yet", "Frosty", "Wants you out"],
  team: ["Brothers", "Get on well", "Getting there", "Distant", "Frozen out"],
  fans: ["Idolise you", "Sing your name", "Warming up", "Grumbling", "Booing"],
  sponsors: ["Delighted", "Happy", "Ticking over", "Uneasy", "Unhappy"],
  happiness: ["Loving life", "Happy", "Okay", "Low", "Miserable"],
};
const word = (k: RelationshipKind, v: number) => WORDS[k][v >= 80 ? 0 : v >= 60 ? 1 : v >= 40 ? 2 : v >= 20 ? 3 : 4];
const tone = (v: number) => (v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-yellow-500" : "bg-red-500");
const toneText = (v: number) => (v >= 70 ? "text-emerald-300" : v >= 40 ? "text-yellow-300" : "text-red-300");

const GAME_LABEL: Record<RelationshipKind, string> = {
  boss: "Boss meeting", team: "Team bonding", fans: "Meet the fans", sponsors: "Sponsor event", happiness: "Take a break",
};

export default function RelationsPage({ career, onPlayRelationshipGame, onRest, onOpen }: {
  career: CareerState;
  onPlayRelationshipGame: (kind: RelationshipKind) => void;
  onRest: () => void;
  onOpen: (ph: Open) => void;
}) {
  const left = actionsLeft(career);
  const canPlay = left > 0;
  const r = career.relationships;
  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const m = career.manager;
  const seasonsIn = m ? career.season - m.since + 1 : 0;
  const mates = (career.squad ?? []).filter((p) => p.imageUrl).slice(0, 5);
  const activeDeals = (career.sponsors ?? []).filter((s) => s.active);
  const gf = career.girlfriend;
  const game = (k: RelationshipKind) => (
    <button
      disabled={!canPlay}
      onClick={() => onPlayRelationshipGame(k)}
      className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white active:scale-95 disabled:bg-gray-700 disabled:text-white/50"
    >
      {GAME_LABEL[k]} · 1 day
    </button>
  );

  return (
    <div className="space-y-2 pb-2">
      {/* The week — unchanged from LifeScreen. */}
      <div className="rounded-2xl border border-white/10 bg-gray-800/80 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">This week</span>
          <span className="text-[10px] font-bold text-white/70">{left} of {WEEK_ACTIONS} days left</span>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {Array.from({ length: WEEK_ACTIONS }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < left ? "bg-emerald-400" : "bg-white/15"}`} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-black/40">
            <div className={`absolute inset-y-0 left-0 ${tone(career.energy)}`} style={{ width: `${Math.round(career.energy)}%` }} />
            <div className="relative flex h-full items-center justify-center text-[12px] font-black text-white">⚡ Energy {Math.round(career.energy)}</div>
          </div>
          <button onClick={onRest} disabled={left === 0} className="h-8 shrink-0 rounded-lg bg-emerald-600 px-3 text-[12px] font-black text-white disabled:bg-gray-700 disabled:text-white/50">
            Rest 😴
          </button>
        </div>
      </div>

      {/* Your manager */}
      <Card
        face={<Face src={m ? managerFace(m.name, career.player.portrait ?? DEFAULT_FAKE_FACE) : undefined} />}
        title={m ? m.name : "No manager"}
        sub={m ? `Manager · ${seasonsIn <= 1 ? "1st season" : `${seasonsIn} seasons`} · ${reputationTier(m.reputation)}` : "The club has no manager right now"}
        value={r.boss}
        kind="boss"
        note={m ? styleBlurb(m.style) : undefined}
        moves="Up: match ratings 7+ (+3, +6 at 8+), Star Man +4. Down: ratings under 5 (−2 to −5)."
        action={game("boss")}
      />

      {/* The dressing room */}
      <Card
        face={<ClubBadge club={career.player.club} kit={kit} size={38} />}
        title="Team-mates"
        sub={`${short(career.player.club)} dressing room · ${(career.squad ?? []).length} players`}
        value={r.team}
        kind="team"
        extra={mates.length > 0 && (
          <div className="mt-1.5 flex -space-x-2">
            {mates.map((p) => <Face key={p.id} src={p.imageUrl} fallback={fakeFaceFor(p.id)} small title={p.shortName} />)}
          </div>
        )}
        moves="Up: assists (+3 each), good ratings, Star Man. Down: ratings under 5."
        action={game("team")}
      />

      {/* The fans */}
      <Card
        face={<div className="grid h-[38px] w-[38px] place-items-center rounded-full text-[22px]" style={{ background: `${kit.shirt}55` }}>🧣</div>}
        title={`${short(career.player.club)} fans`}
        sub={career.homeCity ? `${career.homeCity} · the stands` : "The stands"}
        value={r.fans}
        kind="fans"
        moves="Up: goals (+3 each), ratings 8+ (+8), Star Man (+5). Down: poor ratings."
        action={game("fans")}
      />

      {/* Sponsors */}
      <Card
        face={<div className="grid h-[38px] w-[38px] place-items-center rounded-full bg-amber-500/25 text-[20px]">🤝</div>}
        title="Sponsors"
        sub={activeDeals.length ? `${activeDeals.length} deal${activeDeals.length === 1 ? "" : "s"}: ${activeDeals.map((s) => s.category).join(", ")}` : "No deals signed yet"}
        value={r.sponsors}
        kind="sponsors"
        moves="Up: good matches. Higher = more money every match."
        action={<div className="flex gap-1.5"><button onClick={() => onOpen("sponsors")} className="rounded-lg border border-white/20 px-2 py-1.5 text-[10px] font-black text-white">Deals →</button>{game("sponsors")}</div>}
      />

      {/* You, and a partner if you have one */}
      <Card
        face={<Face src={career.player.portrait ?? DEFAULT_FAKE_FACE} />}
        title="You"
        sub={gf ? `With ${gf.name} · ${gf.gifts} gift${gf.gifts === 1 ? "" : "s"} given` : "Single"}
        value={career.happiness}
        kind="happiness"
        extra={gf && (
          <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-pink-500/10 px-2 py-1">
            <span className="text-[14px]">❤️</span>
            <span className="flex-1 text-[11px] font-bold text-white">{gf.name}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-pink-400" style={{ width: `${gf.happiness}%` }} /></div>
            <span className="text-[10px] font-black tabular-nums text-pink-200">{gf.happiness}</span>
          </div>
        )}
        moves="Up: resting, the break minigame, some choices in the week's dilemmas."
        action={game("happiness")}
      />

      {/* Standing: reputation + fame */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onOpen("reputation")} className="rounded-2xl border border-white/10 bg-gray-800/80 p-2.5 text-left">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Reputation</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-[13px] font-black text-white">{reputationLabel(career.reputation)}</span>
            <span className="text-[13px] font-black tabular-nums text-white">{Math.round(career.reputation)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-sky-400" style={{ width: `${career.reputation}%` }} /></div>
          <div className="mt-1 text-[9.5px] font-bold text-white/55">With the people who run football →</div>
        </button>
        <div className="rounded-2xl border border-white/10 bg-gray-800/80 p-2.5">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Fame</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-[13px] font-black text-white">{fameLevel(fameOf(career)).name}</span>
            <span className="text-[13px] font-black tabular-nums text-white">{fameOf(career)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-fuchsia-400" style={{ width: `${Math.min(100, fameOf(career))}%` }} /></div>
          <div className="mt-1 text-[9.5px] font-bold text-white/55">Goals, trophies and what you own</div>
        </div>
      </div>

      {/* Lifestyle */}
      <div className="rounded-2xl border border-white/10 bg-gray-800/80 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Lifestyle</span>
          <button onClick={() => onOpen("shop-lifestyle")} className="text-[10px] font-black text-white/70">Shop →</button>
        </div>
        {career.ownedItems.length === 0 ? (
          <div className="text-[11px] font-bold text-white/50">Nothing bought yet — no house, no car.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...career.ownedItems].sort((a, b) => order(a.category) - order(b.category)).map((it) => (
              <span key={it.id} className="rounded-lg bg-black/30 px-2 py-1 text-[11px] font-black text-white">
                {it.category === "property" ? "🏠" : it.category === "vehicle" ? "🚗" : "💎"} {it.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button onClick={() => onOpen("garden")} className="rounded-lg bg-green-700/40 py-1.5 text-[11px] font-black text-white">🌳 Garden</button>
          <button onClick={() => onOpen("casino-menu")} className="rounded-lg bg-amber-700/40 py-1.5 text-[11px] font-black text-white">
            🐎 {career.horse ? `${career.horse.name} · ${career.horse.racesWon}/${career.horse.racesRun} won` : "Buy a horse"}
          </button>
        </div>
      </div>
      {!canPlay && <div className="text-center text-[10px] font-bold text-white/50">No days left this week — the minigames open again after the next match.</div>}
    </div>
  );
}

/** The manager's stand-in face — never the same fake face as yours. */
function managerFace(name: string, yours: string) {
  const f = fakeFaceFor(`manager:${name}`);
  return f === yours ? fakeFaceFor(`gaffer:${name}:2`) : f;
}

const order = (c: string) => (c === "property" ? 0 : c === "vehicle" ? 1 : 2);

function Face({ src, fallback, small, title }: { src?: string; fallback?: string; small?: boolean; title?: string }) {
  const s = small ? 26 : 38;
  // A stored photo that no longer loads falls back to a fake face, never a
  // broken-image icon (the game's own rule: always a face).
  return (
    <div title={title} className="shrink-0 overflow-hidden rounded-full border-2 border-gray-800 bg-gray-600" style={{ width: s, height: s }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover object-top" onError={(e) => { const im = e.currentTarget; const fb = fallback ?? DEFAULT_FAKE_FACE; if (!im.src.endsWith(encodeURI(fb))) im.src = fb; }} /> : <div className="grid h-full w-full place-items-center text-[18px]">🙂</div>}
    </div>
  );
}

function Card({ face, title, sub, value, kind, note, moves, extra, action }: {
  face: React.ReactNode; title: string; sub: string; value: number; kind: RelationshipKind;
  note?: string; moves: string; extra?: React.ReactNode; action: React.ReactNode;
}) {
  const v = Math.round(value);
  return (
    <div className="rounded-2xl border border-white/10 bg-gray-800/80 p-2.5">
      <div className="flex items-center gap-2.5">
        {face}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-black leading-tight text-white">{title}</div>
          <div className="truncate text-[10.5px] font-bold text-white/60">{sub}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[18px] font-black leading-none tabular-nums text-white">{v}</div>
          <div className={`text-[10px] font-black ${toneText(v)}`}>{word(kind, v)}</div>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
        <div className={`h-full rounded-full ${tone(v)}`} style={{ width: `${v}%` }} />
      </div>
      {extra}
      {note && <div className="mt-1.5 text-[10.5px] font-bold italic text-white/60">&ldquo;{note}&rdquo;</div>}
      <div className="mt-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[10px] font-bold leading-snug text-white/55">{moves}</div>
        {action}
      </div>
    </div>
  );
}
