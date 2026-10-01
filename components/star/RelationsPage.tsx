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
 *
 * Reskinned 28 Sep 2026 to the home screen's look: each card lit in its own
 * colour, glossy bars, pressable buttons. A minigame is played on another
 * screen, so when you come back each bar that moved glides from its old
 * value to the new one with a floating "+4" (or a red "−2") — see useSeen.
 */
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import type { RelationshipKind } from "./RelationshipMinigame";
import { actionsLeft, WEEK_ACTIONS } from "@/lib/star/week";
import { reputationLabel } from "@/lib/star/reputation";
import { reputationTier, styleBlurb } from "@/lib/star/manager";
import { fameOf, fameLevel } from "@/lib/star/fame";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import ClubBadge from "./ClubBadge";
import { ClubCard, PressButton, StatBar, Glow, Pop, rgba, levelColors, cardStyle, useClubTheme } from "./ui";
import { CardTitle, DeltaBar, useSeen, seenScope } from "./screenKit";

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
/** Green / yellow / red at the same lines the bars always used (70, 40). */
const toneColors = (v: number): [string, string] => (v >= 70 ? ["#10b981", "#6ee7b7"] : v >= 40 ? ["#eab308", "#fde047"] : ["#ef4444", "#fda4af"]);
const toneText = (v: number) => (v >= 70 ? "text-emerald-300" : v >= 40 ? "text-yellow-300" : "text-red-300");

const GAME_LABEL: Record<RelationshipKind, string> = {
  boss: "Boss meeting", team: "Team bonding", fans: "Meet the fans", sponsors: "Sponsor event", happiness: "Take a break",
};
/** Each card's own light. */
const CARD_TONE: Record<RelationshipKind, string> = {
  boss: "#60a5fa", team: "#34d399", fans: "#f472b6", sponsors: "#f59e0b", happiness: "#c084fc",
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
  const { glow } = useClubTheme(career);
  const scope = seenScope(career);
  const m = career.manager;
  const seasonsIn = m ? career.season - m.since + 1 : 0;
  const mates = (career.squad ?? []).filter((p) => p.imageUrl).slice(0, 5);
  // The brand deals (sponsorDeals.ts). The old career.sponsors list is no
  // longer signed from any screen, so reading it always said "No deals".
  const brands = brandsOf(career);
  const activeDeals = brands.deals;
  const offers = brands.offers.length;
  const gf = career.girlfriend;
  const energy = useSeen(`${scope}:energy`, Math.round(career.energy));
  const game = (k: RelationshipKind) => (
    <PressButton
      variant="accent"
      accent={CARD_TONE[k]}
      disabled={!canPlay}
      onClick={() => onPlayRelationshipGame(k)}
      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black"
    >
      {GAME_LABEL[k]} · 1 day
    </PressButton>
  );

  return (
    <div className="space-y-2 pb-2">
      {/* The week — unchanged from LifeScreen. */}
      <ClubCard glow={glow} className="relative overflow-hidden p-2.5">
        <div className="flex items-center justify-between">
          <CardTitle tone="text-emerald-300">This week</CardTitle>
          <span className="text-[10px] font-bold text-white/80"><Pop value={left}>{left}</Pop> of {WEEK_ACTIONS} days left</span>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {Array.from({ length: WEEK_ACTIONS }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${i < left ? "bg-gradient-to-b from-emerald-300 to-emerald-500" : "bg-black/45"}`}
              style={i < left ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 0 8px rgba(52,211,153,.55)" } : { boxShadow: "inset 0 1px 3px rgba(0,0,0,.6)" }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">⚡ Energy</span>
              <span className="text-[15px] font-black tabular-nums text-white"><Pop value={energy.shown}>{energy.shown}</Pop></span>
            </div>
            <DeltaBar seen={energy} colors={levelColors(energy.shown)} className="mt-1 h-3.5" />
          </div>
          <PressButton variant="primary" size="none" onClick={onRest} disabled={left === 0} className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-black">
            Rest 😴
          </PressButton>
        </div>
      </ClubCard>

      {/* Your manager */}
      <Card
        face={<Face src={m ? managerFace(m.name, career.player.portrait ?? DEFAULT_FAKE_FACE) : undefined} tone={CARD_TONE.boss} />}
        title={m ? m.name : "No manager"}
        sub={m ? `Manager · ${seasonsIn <= 1 ? "1st season" : `${seasonsIn} seasons`} · ${reputationTier(m.reputation)}` : "The club has no manager right now"}
        value={r.boss}
        kind="boss"
        seenKey={`${scope}:rel:boss`}
        note={m ? styleBlurb(m.style) : undefined}
        moves="Up: match ratings 7+ (+3, +6 at 8+), Star Man +4. Down: ratings under 5 (−2 to −5)."
        action={game("boss")}
      />

      {/* The dressing room */}
      <Card
        face={<div style={{ filter: `drop-shadow(0 3px 8px ${rgba(glow, 0.7)})` }}><ClubBadge club={career.player.club} kit={kit} size={40} /></div>}
        title="Team-mates"
        sub={`${short(career.player.club)} dressing room · ${(career.squad ?? []).length} players`}
        value={r.team}
        kind="team"
        seenKey={`${scope}:rel:team`}
        extra={mates.length > 0 && (
          <div className="mt-1.5 flex -space-x-2">
            {mates.map((p) => <Face key={p.id} src={p.imageUrl} fallback={fakeFaceFor(p.id)} small title={p.shortName} tone={CARD_TONE.team} />)}
          </div>
        )}
        moves="Up: assists (+3 each), good ratings, Star Man. Down: ratings under 5."
        action={game("team")}
      />

      {/* The fans */}
      <Card
        face={<div className="grid h-[40px] w-[40px] place-items-center rounded-full text-[22px]" style={{ background: `radial-gradient(circle at 35% 30%, ${kit.shirt}cc, ${kit.shirt}55)`, boxShadow: `0 0 12px ${rgba(kit.shirt, 0.6)}, inset 0 1px 0 rgba(255,255,255,.3)` }}>🧣</div>}
        title={`${short(career.player.club)} fans`}
        sub={career.homeCity ? `${career.homeCity} · the stands` : "The stands"}
        value={r.fans}
        kind="fans"
        seenKey={`${scope}:rel:fans`}
        moves="Up: goals (+3 each), ratings 8+ (+8), Star Man (+5). Down: poor ratings."
        action={game("fans")}
      />

      {/* Sponsors */}
      <Card
        face={<div className="grid h-[40px] w-[40px] place-items-center rounded-full bg-gradient-to-b from-amber-300/45 to-amber-700/35 text-[20px] ring-1 ring-amber-200/40">🤝</div>}
        title="Sponsors"
        sub={activeDeals.length ? `${activeDeals.length} deal${activeDeals.length === 1 ? "" : "s"}: ${activeDeals.map((d) => d.brand).join(", ")}` : "No deals signed yet"}
        value={r.sponsors}
        kind="sponsors"
        seenKey={`${scope}:rel:sponsors`}
        moves="Up: good matches. Higher = more money every match."
        action={<div className="flex gap-1.5"><PressButton variant="secondary" size="none" onClick={() => onOpen("sponsors")} className={`rounded-lg px-2 py-1.5 text-[10px] font-black ${offers ? "ring-2 ring-emerald-300/80" : ""}`}>{offers ? `${offers} offer${offers === 1 ? "" : "s"} →` : "Deals →"}</PressButton>{game("sponsors")}</div>}
      />

      {/* You, and a partner if you have one */}
      <Card
        face={<Face src={career.player.portrait ?? DEFAULT_FAKE_FACE} tone={CARD_TONE.happiness} />}
        title="You"
        sub={gf ? `With ${gf.name} · ${gf.gifts} gift${gf.gifts === 1 ? "" : "s"} given` : "Single"}
        value={career.happiness}
        kind="happiness"
        seenKey={`${scope}:rel:happiness`}
        extra={gf && (
          <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-pink-500/10 px-2 py-1 ring-1 ring-pink-300/20">
            <span className="text-[14px]">❤️</span>
            <span className="flex-1 text-[11px] font-bold text-white">{gf.name}</span>
            <StatBar value={gf.happiness} colors={["#ec4899", "#f9a8d4"]} className="h-2 w-20" />
            <span className="text-[10px] font-black tabular-nums text-pink-200">{gf.happiness}</span>
          </div>
        )}
        moves="Up: resting, the break minigame, some choices in the week's dilemmas."
        action={game("happiness")}
      />

      {/* Standing: reputation + fame */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onOpen("reputation")} className="kib-press rounded-2xl p-2.5 text-left" style={cardStyle("#38bdf8")}>
          <CardTitle>Reputation</CardTitle>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-[13px] font-black text-white">{reputationLabel(career.reputation)}</span>
            <span className="text-[13px] font-black tabular-nums text-white">{Math.round(career.reputation)}</span>
          </div>
          <StatBar value={career.reputation} colors={["#0ea5e9", "#7dd3fc"]} className="mt-1 h-2" />
          <div className="mt-1 text-[9.5px] font-bold text-white/60">With the people who run football →</div>
        </button>
        <ClubCard glow="#d946ef" className="p-2.5">
          <CardTitle>Fame</CardTitle>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-[13px] font-black text-white">{fameLevel(fameOf(career)).name}</span>
            <span className="text-[13px] font-black tabular-nums text-white">{fameOf(career)}</span>
          </div>
          <StatBar value={Math.min(100, fameOf(career))} colors={["#d946ef", "#f0abfc"]} className="mt-1 h-2" />
          <div className="mt-1 text-[9.5px] font-bold text-white/60">Goals, trophies and what you own</div>
        </ClubCard>
      </div>

      {/* Lifestyle */}
      <ClubCard glow={glow} className="p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <CardTitle>Lifestyle</CardTitle>
          <PressButton variant="secondary" size="none" onClick={() => onOpen("shop-lifestyle")} className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">Shop →</PressButton>
        </div>
        {career.ownedItems.length === 0 ? (
          <div className="text-[11px] font-bold text-white/60">Nothing bought yet — no house, no car.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {[...career.ownedItems].sort((a, b) => order(a.category) - order(b.category)).map((it) => (
              <span key={it.id} className="rounded-lg bg-black/30 px-2 py-1 text-[11px] font-black text-white ring-1 ring-white/10">
                {it.category === "property" ? "🏠" : it.category === "vehicle" ? "🚗" : "💎"} {it.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <PressButton variant="accent" accent="#16a34a" onClick={() => onOpen("garden")} className="rounded-lg py-2 text-[11px] font-black">🌳 Garden</PressButton>
          <PressButton variant="accent" accent="#d97706" onClick={() => onOpen("casino-menu")} className="truncate rounded-lg px-1 py-2 text-[11px] font-black">
            🐎 {career.horse ? `${career.horse.name} · ${career.horse.racesWon}/${career.horse.racesRun} won` : "Buy a horse"}
          </PressButton>
        </div>
      </ClubCard>
      {!canPlay && <div className="text-center text-[10px] font-bold text-white/60">No days left this week — the minigames open again after the next match.</div>}
    </div>
  );
}

/** The manager's stand-in face — never the same fake face as yours. */
function managerFace(name: string, yours: string) {
  const f = fakeFaceFor(`manager:${name}`);
  return f === yours ? fakeFaceFor(`gaffer:${name}:2`) : f;
}

const order = (c: string) => (c === "property" ? 0 : c === "vehicle" ? 1 : 2);

function Face({ src, fallback, small, title, tone }: { src?: string; fallback?: string; small?: boolean; title?: string; tone?: string }) {
  const s = small ? 26 : 40;
  // A stored photo that no longer loads falls back to a fake face, never a
  // broken-image icon (the game's own rule: always a face).
  return (
    <div
      title={title}
      className="shrink-0 overflow-hidden rounded-full border-2 border-gray-900 bg-gray-600"
      style={{ width: s, height: s, boxShadow: tone ? `0 0 ${small ? 6 : 12}px ${rgba(tone, 0.6)}` : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover object-top" onError={(e) => { const im = e.currentTarget; const fb = fallback ?? DEFAULT_FAKE_FACE; if (!im.src.endsWith(encodeURI(fb))) im.src = fb; }} /> : <div className="grid h-full w-full place-items-center text-[18px]">🙂</div>}
    </div>
  );
}

function Card({ face, title, sub, value, kind, seenKey, note, moves, extra, action }: {
  face: React.ReactNode; title: string; sub: string; value: number; kind: RelationshipKind; seenKey: string;
  note?: string; moves: string; extra?: React.ReactNode; action: React.ReactNode;
}) {
  const v = Math.round(value);
  // The minigame is played on another screen: when you come back the bar
  // glides from what it was to what it is, with the change floating off it.
  const seen = useSeen(seenKey, v);
  const tone = CARD_TONE[kind];
  return (
    <ClubCard glow={tone} className="relative overflow-hidden p-2.5">
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <Glow color={tone} alpha={0.35} className="-inset-1 blur-md" />
          <div className="relative">{face}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-black leading-tight text-white">{title}</div>
          <div className="truncate text-[10.5px] font-bold text-white/65">{sub}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[20px] font-black leading-none tabular-nums text-white"><Pop value={seen.shown}>{seen.shown}</Pop></div>
          <div className={`text-[10px] font-black ${toneText(seen.shown)}`}>{word(kind, seen.shown)}</div>
        </div>
      </div>
      <div className="mt-2">
        <DeltaBar seen={seen} colors={toneColors(seen.shown)} className="h-3" />
      </div>
      {extra}
      {note && <div className="mt-1.5 text-[10.5px] font-bold italic text-white/65">&ldquo;{note}&rdquo;</div>}
      <div className="mt-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[10px] font-bold leading-snug text-white/60">{moves}</div>
        {action}
      </div>
    </ClubCard>
  );
}
