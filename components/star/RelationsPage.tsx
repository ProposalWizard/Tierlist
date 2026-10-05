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
import { actionsLeft } from "@/lib/star/week";
import { gamePlayedThisWeek } from "@/lib/star/relationships";
import { fameOf } from "@/lib/star/fame";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { FlatPanel, SquareBar, HelpDot, rgba, useClubTheme } from "./ui";
import { DeltaBar, useSeen, seenScope } from "./screenKit";


type Open = "reputation" | "sponsors";


/** Green / yellow / red at the same lines the bars always used (70, 40). */
const toneColors = (v: number): [string, string] => (v >= 70 ? ["#10b981", "#6ee7b7"] : v >= 40 ? ["#eab308", "#fde047"] : ["#ef4444", "#fda4af"]);

const GAME_LABEL: Record<RelationshipKind, string> = {
  boss: "Talk to your manager", team: "Woodwork challenge", fans: "Signing session", sponsors: "Shoot an advert", happiness: "Day off",
};
/** Each card's own light. */
const CARD_TONE: Record<RelationshipKind, string> = {
  boss: "#60a5fa", team: "#34d399", fans: "#f472b6", sponsors: "#f59e0b", happiness: "#c084fc",
};

const GAME_ICON: Record<RelationshipKind, string> = { boss: "🗣️", team: "🤝", fans: "📣", sponsors: "🎤", happiness: "☀️" };
/** One plain line each, behind the "?" (Harry, 1 Oct 2026, P85-P87: "a good
 *  relationship with the team means you'll get more chances during a match").
 *  Read off what the game really does with each number. */
const HELP: Record<RelationshipKind | "reputation" | "fame", string> = {
  boss: "A good relationship with your boss means you get picked more often.",
  team: "A good relationship with the team means you'll get more chances during a match.",
  fans: "Happy fans lift you in home matches, open up some sponsor deals and set the tone online.",
  sponsors: "Each brand has its own happiness, on the Sponsors screen. It decides whether they renew.",
  happiness: "Happier players get more energy back when they rest. A day off lifts it.",
  reputation: "How the people who run football see you.",
  fame: "Goals, trophies and what you own make you famous.",
};
const NAME: Record<RelationshipKind, string> = { boss: "Boss", team: "Team", fans: "Fans", sponsors: "Sponsors", happiness: "You" };

export default function RelationsPage({ career, onPlayRelationshipGame, onOpen }: {
  career: CareerState;
  onPlayRelationshipGame: (kind: RelationshipKind) => void;
  /** No longer used here: the week and Rest left this page (Harry, 1 Oct 2026, 08:22). */
  onRest?: () => void;
  onOpen: (ph: Open) => void;
}) {
  const left = actionsLeft(career);
  const canPlay = left > 0;
  const r = career.relationships;
  const { glow } = useClubTheme(career);
  const scope = seenScope(career);
  const m = career.manager;
  const mates = (career.squad ?? []).filter((p) => p.imageUrl).slice(0, 5);
  // The brand deals (sponsorDeals.ts). The old career.sponsors list is no
  // longer signed from any screen, so reading it always said "No deals".
  const brands = brandsOf(career);
  const activeDeals = brands.deals;
  const offers = brands.offers.length;
  const gf = career.girlfriend;
  /** The minigame: one square play button, no words. */
  // Each game once a week (relationships.ts): a played one shows a tick.
  const game = (k: RelationshipKind) => {
    const done = gamePlayedThisWeek(career.relGamesPlayed, career.season, career.week, k);
    return <ActBtn tone={CARD_TONE[k]} disabled={!canPlay || done} label={done ? `${GAME_LABEL[k]} · done this week` : `${GAME_LABEL[k]} · 1 day`} onClick={() => onPlayRelationshipGame(k)}>{done ? "✓" : "▶"}</ActBtn>;
  };

  return (
    <div className="pb-2">
      <div className="space-y-px">
        {/* Your manager */}
        <Row
          kind="boss"
          face={<Face src={m ? managerFace(m.name, career.player.portrait ?? DEFAULT_FAKE_FACE) : undefined} tone={CARD_TONE.boss} />}
          value={r.boss}
          seenKey={`${scope}:rel:boss`}
          marks={[40, 70]}
          action={game("boss")}
        />
        {/* The dressing room */}
        <Row
          kind="team"
          face={<div className="flex -space-x-2">{(mates.length ? mates.slice(0, 2) : []).map((p) => <Face key={p.id} src={p.imageUrl} fallback={fakeFaceFor(p.id)} small tone={CARD_TONE.team} />)}{mates.length === 0 && <div className="grid h-[40px] w-[40px] place-items-center text-[22px]">👥</div>}</div>}
          value={r.team}
          seenKey={`${scope}:rel:team`}
          marks={[78]}
          action={game("team")}
        />
        {/* The fans */}
        <Row
          kind="fans"
          face={<div className="grid h-[40px] w-[40px] place-items-center rounded-full text-[22px]" style={{ background: `radial-gradient(circle at 35% 30%, ${rgba(glow, 0.8)}, ${rgba(glow, 0.3)})` }}>🧣</div>}
          value={r.fans}
          seenKey={`${scope}:rel:fans`}
          action={game("fans")}
        />
        {/* Sponsors: no bar any more — each brand has its own happiness on
            the Sponsors screen (Mikey, 4 Oct 2026). Just the way in. */}
        <PlainRow icon="🤝" name={activeDeals.length ? `Sponsors · ${activeDeals.length} deal${activeDeals.length === 1 ? "" : "s"}` : "Sponsors"} tone={CARD_TONE.sponsors} help={HELP.sponsors} onClick={() => onOpen("sponsors")} dot={offers > 0} />
        {/* Your own happiness has no row and no game (Mikey, 5 Oct 2026): it
            is the average of boss, team and fans, shown in the top bar. */}
        {/* A partner slot (blacked out when single) */}
        <PartnerRow gf={gf} />
        {/* Standing: reputation + fame, the same row */}
        <PlainRow icon="🌐" name="Reputation" value={career.reputation} tone="#38bdf8" help={HELP.reputation} onClick={() => onOpen("reputation")} />
        <PlainRow icon="✨" name="Fame" value={Math.min(100, fameOf(career))} shown={fameOf(career)} tone="#d946ef" help={HELP.fame} />
      </div>
    </div>
  );
}

/** The manager's stand-in face — never the same fake face as yours. */
function managerFace(name: string, yours: string) {
  const f = fakeFaceFor(`manager:${name}`);
  return f === yours ? fakeFaceFor(`gaffer:${name}:2`) : f;
}

function Face({ src, fallback, small, title, tone }: { src?: string; fallback?: string; small?: boolean; title?: string; tone?: string }) {
  const s = small ? 28 : 40;
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

/** A square action button: no words, a label for screen readers. */
function ActBtn({ tone, label, onClick, disabled, dot, children }: { tone: string; label: string; onClick: () => void; disabled?: boolean; dot?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="kib-press relative grid h-[36px] w-[36px] shrink-0 place-items-center text-[15px] font-black leading-none text-gray-950 disabled:opacity-35"
      style={{ borderRadius: 2, background: `linear-gradient(180deg, ${rgba(tone, 0.95)}, ${rgba(tone, 0.7)})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}
    >
      {children}
      {dot && <span className="absolute -right-1 -top-1 h-3 w-3 bg-red-500" style={{ borderRadius: 1 }} />}
    </button>
  );
}

const ROW = "relative flex items-center gap-2.5 px-1 py-2";

/**
 * ONE RELATIONSHIP — a face, one word, a square animated bar with the number
 * on it, a play button and a "?". Nothing else on the card (Harry, P85: "we
 * don't want any of this text on the relations page. None."). Flat: no
 * rounded floating card (P87). The bar glides and flashes when a minigame
 * moved it (useSeen), and its stripes march.
 */
function Row({ kind, face, value, seenKey, action, extraAction, blackedOut = false, marks = [] }: {
  kind: RelationshipKind; face: React.ReactNode; value: number; seenKey: string; action: React.ReactNode; extraAction?: React.ReactNode; blackedOut?: boolean;
  /** Where something changes on this bar (boss: benched below 40, captain-ready
   *  at 70; team: captain-ready at 78). Drawn as ticks, never as numbers. */
  marks?: number[];
}) {
  const v = Math.round(value);
  // The minigame is played on another screen: when you come back the bar
  // glides from what it was to what it is, with the change floating off it.
  const seen = useSeen(seenKey, v);
  const tone = CARD_TONE[kind];
  return (
    <FlatPanel fade="none" edge data-relation={kind} data-blacked-out={blackedOut ? "true" : undefined} className={ROW}>
      <span aria-hidden className="absolute inset-y-1 left-0 w-[3px]" style={{ background: tone }} />
      <div className="flex min-w-0 flex-1 items-center gap-2.5" style={blackedOut ? { filter: "brightness(0.18) saturate(0)" } : undefined}>
        <div className="shrink-0">{face}</div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-black uppercase leading-none tracking-[0.16em] text-white">{NAME[kind]}</div>
          <div className="relative">
            <DeltaBar seen={blackedOut ? { shown: 0, delta: 0, trigger: 0 } : seen} colors={toneColors(seen.shown)} className="h-[20px]" square />
            {marks.map((m) => <span key={m} aria-hidden data-mark={m} className="pointer-events-none absolute -top-[3px] -bottom-[3px] w-[2px] bg-white" style={{ left: `${m}%`, boxShadow: "0 0 0 1px rgba(0,0,0,.6)" }} />)}
          </div>
        </div>
      </div>
      {extraAction}
      {action}
      <HelpDot text={HELP[kind]} />
    </FlatPanel>
  );
}

/** Reputation and Fame: the same row, no minigame. */
function PlainRow({ icon, name, value, shown, tone, help, onClick, dot }: { icon: string; name: string; value?: number; shown?: number; tone: string; help: string; onClick?: () => void; dot?: boolean }) {
  const inner = (
    <>
      <span aria-hidden className="absolute inset-y-1 left-0 w-[3px]" style={{ background: tone }} />
      <div className="grid h-[40px] w-[40px] shrink-0 place-items-center text-[24px]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-black uppercase leading-none tracking-[0.16em] text-white">{name}</div>
        {value !== undefined && <SquareBar value={value} colors={[tone, rgba(tone, 0.6) as string] as [string, string]} className="h-[20px]" animate>{Math.round(shown ?? value)}</SquareBar>}
      </div>
    </>
  );
  return (
    <FlatPanel fade="none" edge className={ROW}>
      {onClick
        ? <button onClick={onClick} aria-label={`${name} — open`} className="kib-press relative flex min-w-0 flex-1 items-center gap-2.5 text-left">{inner}</button>
        : inner}
      {onClick && <span aria-hidden className="relative shrink-0 pr-1 text-[16px] font-black text-amber-300">→{dot && <span className="absolute -right-1 -top-1 h-3 w-3 bg-red-500" style={{ borderRadius: 1 }} />}</span>}
      <HelpDot text={help} />
    </FlatPanel>
  );
}

/** A partner slot: a girlfriend's bar, or a blacked-out silhouette until there is one. */
function PartnerRow({ gf }: { gf: CareerState["girlfriend"] }) {
  const off = !gf;
  return (
    <FlatPanel fade="none" edge data-relation="partner" data-blacked-out={off ? "true" : undefined} className={ROW}>
      <span aria-hidden className="absolute inset-y-1 left-0 w-[3px]" style={{ background: "#ec4899" }} />
      <div className="flex min-w-0 flex-1 items-center gap-2.5" style={off ? { filter: "brightness(0.18) saturate(0)" } : undefined}>
        <div className="grid h-[40px] w-[40px] shrink-0 place-items-center text-[24px]">❤️</div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-black uppercase leading-none tracking-[0.16em] text-white">Partner</div>
          <SquareBar value={gf ? gf.happiness : 0} colors={["#ec4899", "#f9a8d4"]} className="h-[20px]" animate>{gf ? gf.happiness : 0}</SquareBar>
        </div>
      </div>
      <HelpDot text="Gifts keep a partner happy. You have none yet." />
    </FlatPanel>
  );
}
