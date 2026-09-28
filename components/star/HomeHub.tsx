"use client";

/**
 * THE MIDDLE HOME SCREEN — you in your kit, your form, your energy.
 *
 * Harry, 27 Sep 2026: "The middle: next game, last 5 form, energy, maybe your
 * player in the club kit." Chosen layout: "you first" — you big at the top,
 * with the star rating, money and age as the headline numbers. His review of
 * the prototype:
 *   - the next match is a SMALL card in the top right ("Sunderland v Chelsea ·
 *     Sat"), with no Play button there — Play is on the bottom bar;
 *   - the energy cans sit here with a Buy button, so you never have to go into
 *     the Shop just to top up.
 * The stats/contract/status card lives on the screen to the left, training on
 * the one to the right (see SwipePages / page.tsx).
 */
import type { CareerState, Fixture } from "@/lib/star/types";
import { KIB_CANS, kibCanEffectLabel, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import ClubBadge from "./ClubBadge";
import KibCanIcon from "./KibCanIcon";
import PlayerAvatar from "./PlayerAvatar";

const ACCENT: Record<KibCan["id"], string> = { basic: "#fb923c", premium: "#60a5fa", elite: "#c084fc" };
const POS_NAME: Record<string, string> = { ST: "Striker", CAM: "Attacking Mid", LW: "Left Wing", RW: "Right Wing", CM: "Central Mid" };

export type HubPhase = "store" | "shop-kib" | "shop-boots" | "shop-lifestyle" | "casino-menu" | "sponsors" | "achievements" | "trophies" | "ownership" | "garden";

interface Props {
  career: CareerState;
  nextFixture: Fixture | null;
  /** "Sat 6 Sep" — see calendar.ts. */
  nextMatchDate?: string;
  /** Your side's name for this fixture — your club, or your country. */
  myTeam: string;
  onUseCan: (id: KibCan["id"]) => void;
  onBuyCan: (can: KibCan) => void;
  onOpen: (phase: HubPhase) => void;
  /** PROTOTYPE (home-screen proto): just you, the next match and the cans —
   *  last 5 moves to the Stats page, the shortcut row to the Shop page/phone. */
  slim?: boolean;
}

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

interface FormResult { res: "W" | "D" | "L"; us: number; them: number; opp: string; rating?: number; week: number }
export function lastFive(career: CareerState): FormResult[] {
  return career.fixtures
    .filter((f) => f.played && f.homeScore !== undefined && f.awayScore !== undefined)
    .sort((a, b) => a.week - b.week)
    .slice(-5)
    .map((f) => {
      const us = f.home ? f.homeScore! : f.awayScore!, them = f.home ? f.awayScore! : f.homeScore!;
      return { res: us > them ? "W" : us === them ? "D" : "L", us, them, opp: f.opponent, rating: f.userRating, week: f.week };
    });
}

export default function HomeHub(p: Props) {
  const { career } = p;
  const kit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  return (
    <div className="space-y-2 pb-2">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10"
        style={{ background: `radial-gradient(120% 90% at 30% 100%, ${kit.shirt}55 0%, #0b1220 62%), linear-gradient(180deg, #111827, #0b1220)` }}
      >
        {!p.slim && <PitchLines />}
        <NextMatchTag {...p} />
        <div className="relative flex items-end">
          <div className="-mb-1 shrink-0 pl-1">
            <PlayerAvatar career={career} width={128} height={196} />
          </div>
          <div className="min-w-0 flex-1 pb-3 pr-3 pt-16">
            <div className="flex items-center gap-2">
              <ClubBadge club={career.player.club} kit={kit} size={26} />
              <div className="min-w-0">
                <div className="truncate text-[11px] font-black uppercase tracking-widest text-white/70">{short(career.player.club)}</div>
                <div className="text-[11px] font-bold text-white/60">#{career.squadNumber ?? "—"} · {POS_NAME[career.player.position] ?? career.player.position}{career.captain ? " · 🅲" : ""}</div>
              </div>
            </div>
            <div className="mt-1.5 truncate text-[20px] font-black leading-tight text-white">
              {career.player.firstName} {career.player.lastName}
            </div>
            {/* PROTOTYPE (slim): the three numbers as small chips under your
                name, so the cans fit on the same screen. */}
            {p.slim && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="rounded-md bg-yellow-500 px-1.5 py-0.5 text-[11px] font-black text-gray-950">★ {career.starRating.toFixed(1)}</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-black text-yellow-200">★ {formatMoney(career.money)}</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-black text-white">Age {career.player.age}</span>
              </div>
            )}
          </div>
        </div>
        {/* The three headline numbers, big — star rating, money, age. */}
        {!p.slim && <div className="relative grid grid-cols-3 gap-1.5 border-t border-white/10 bg-black/25 p-2">
          <Headline label="Star rating" value={`★ ${career.starRating.toFixed(1)}`} gold />
          <Headline label="Money" value={`★ ${formatMoney(career.money)}`} />
          <Headline label="Age" value={String(career.player.age)} />
        </div>}
      </div>
      {!p.slim && <Form career={career} />}
      <Energy {...p} />
      {!p.slim && <More onOpen={p.onOpen} />}
    </div>
  );
}

function Headline({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-1.5 text-center ${gold ? "bg-yellow-500" : "bg-white/10"}`}>
      <div className={`truncate text-[18px] font-black leading-tight tabular-nums ${gold ? "text-gray-950" : "text-yellow-200"}`}>{value}</div>
      <div className={`text-[9px] font-black uppercase tracking-widest ${gold ? "text-gray-900/80" : "text-white/60"}`}>{label}</div>
    </div>
  );
}

/** The next match, small, in the top-right corner — no Play button (that's
 *  on the bottom bar). "Sunderland v Chelsea · Sat 6 Sep". */
function NextMatchTag({ career, nextFixture, nextMatchDate, myTeam }: Props) {
  if (!nextFixture) {
    return (
      <div className="absolute right-2 top-2 z-10 rounded-lg border border-amber-400/40 bg-black/50 px-2 py-1 text-[10px] font-black text-amber-100">
        Season complete
      </div>
    );
  }
  const home = nextFixture.home ? myTeam : nextFixture.opponent;
  const away = nextFixture.home ? nextFixture.opponent : myTeam;
  const comp = nextFixture.competition ?? leagueNameFor(divisionOf(career));
  return (
    <div className="absolute right-2 top-2 z-10 max-w-[64%] rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-right backdrop-blur-sm">
      <div className="text-[8.5px] font-black uppercase tracking-[0.18em] text-emerald-300">Next match</div>
      <div className="truncate text-[11px] font-black text-white">{short(home)} v {short(away)}</div>
      <div className="truncate text-[9.5px] font-bold text-white/60">{nextMatchDate ?? `Week ${nextFixture.week}`} · {comp}</div>
    </div>
  );
}

export function Form({ career }: { career: CareerState }) {
  const five = lastFive(career);
  const tone = { W: "bg-emerald-500 text-white", D: "bg-gray-500 text-white", L: "bg-red-600 text-white" } as const;
  const rated = five.filter((f) => f.rating !== undefined);
  return (
    <div className="rounded-2xl border border-white/10 bg-gray-800/80 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Last 5</div>
        {rated.length > 0 && (
          <div className="text-[10px] font-bold text-white/50">
            avg rating {(rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length).toFixed(1)}
          </div>
        )}
      </div>
      {five.length === 0 ? (
        <div className="py-1 text-[11px] font-bold text-white/50">No matches yet — your first is up next.</div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }, (_, i) => five[i - (5 - five.length)]).map((f, i) => f ? (
            <div key={i} className="flex flex-col items-center rounded-lg bg-black/25 py-1">
              <span className={`grid h-6 w-6 place-items-center rounded-md text-[12px] font-black ${tone[f.res]}`}>{f.res}</span>
              <span className="mt-0.5 text-[11px] font-black tabular-nums text-white">{f.us}-{f.them}</span>
              <span className="w-full truncate px-0.5 text-center text-[9px] font-bold text-white/55">{short(f.opp)}</span>
              {f.rating !== undefined && <span className="text-[9px] font-black text-amber-300">{f.rating.toFixed(1)}</span>}
            </div>
          ) : (
            <div key={i} className="rounded-lg border border-dashed border-white/10" />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Energy, and the cans — each row: how many you own, Use, and Buy at its price.
 * The Basic can (energy) first and biggest; Premium/Elite give a boot ability
 * for your next match instead.
 */
function Energy(p: Props) {
  const { career, onUseCan, onBuyCan } = p;
  const e = Math.max(0, Math.min(100, Math.round(career.energy)));
  const bar = e >= 60 ? "from-emerald-500 to-emerald-400" : e >= 35 ? "from-amber-500 to-amber-400" : "from-red-600 to-red-500";
  return (
    <div className="rounded-2xl border border-white/10 bg-gray-800/80 p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Energy{p.slim ? " · KIB cans" : ""}</span>
        <span className="text-[15px] font-black tabular-nums text-white">{e}%</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/40">
        <div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${e}%` }} />
      </div>
      {p.slim ? <CansCompact {...p} e={e} /> : (
      <div className="mt-2 space-y-1.5">
        {KIB_CANS.map((c) => {
          const count = career.kibCans[c.id];
          const price = kibCanPrice(c, career.contract.wage);
          // A boot-ability can already drunk and waiting for your next match.
          const ready = !!(c.effect && career.kibAbility?.[c.effect]);
          // An energy can at full energy would be wasted (v0.15 item 28).
          const full = !c.effect && e >= 100;
          const canUse = count > 0 && !ready && !full;
          const canBuy = career.money >= price;
          return (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-xl bg-black/25 p-1.5"
              style={{ boxShadow: `inset 0 0 0 1px ${ACCENT[c.id]}40` }}
            >
              <KibCanIcon can={c} className={c.id === "basic" ? "h-10 w-6 shrink-0" : "h-8 w-5 shrink-0"} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-black text-white">
                  {c.name.replace(" KIB Can", "")} can <span className="tabular-nums text-white/70">×{count}</span>
                </div>
                <div className="truncate text-[9.5px] font-bold text-white/60">{kibCanEffectLabel(c).replace("for your next match", "next match")}</div>
              </div>
              <button
                disabled={!canUse}
                onClick={() => onUseCan(c.id)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase text-gray-950 disabled:bg-gray-700 disabled:text-white/50"
                style={canUse ? { backgroundColor: ACCENT[c.id] } : undefined}
              >
                {ready ? "Ready ✓" : full ? "Full" : "Use"}
              </button>
              <button
                disabled={!canBuy}
                onClick={() => onBuyCan(c)}
                aria-label={`Buy a ${c.name} for ${formatMoney(price)}`}
                className="shrink-0 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-center leading-tight text-white disabled:opacity-40"
              >
                <div className="text-[9px] font-black uppercase">Buy</div>
                <div className="text-[10px] font-black tabular-nums text-yellow-200">★{formatMoney(price)}</div>
              </button>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

/** PROTOTYPE (home-screen proto): the three cans side by side, so you, the
 *  next match and the cans all fit on one phone screen without scrolling. */
function CansCompact({ career, onUseCan, onBuyCan, e }: Props & { e: number }) {
  const shortEffect: Record<KibCan["id"], string> = { basic: "", premium: "Curve", elite: "Extra touch" };
  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {KIB_CANS.map((c) => {
        const count = career.kibCans[c.id];
        const price = kibCanPrice(c, career.contract.wage);
        const ready = !!(c.effect && career.kibAbility?.[c.effect]);
        const full = !c.effect && e >= 100;
        const canUse = count > 0 && !ready && !full;
        const canBuy = career.money >= price;
        return (
          <div key={c.id} className="flex flex-col items-center rounded-xl bg-black/25 p-1.5" style={{ boxShadow: `inset 0 0 0 1px ${ACCENT[c.id]}40` }}>
            <div className="flex items-center gap-1">
              <KibCanIcon can={c} className="h-8 w-5 shrink-0" />
              <div className="leading-tight">
                <div className="text-[11px] font-black text-white">{c.name.replace(" KIB Can", "")}</div>
                <div className="text-[10px] font-black tabular-nums text-white/70">×{count}</div>
              </div>
            </div>
            <div className="mt-0.5 h-3 truncate text-[9px] font-bold text-white/60">{c.effect ? shortEffect[c.id] : `+${c.restore} energy`}</div>
            <button
              disabled={!canUse}
              onClick={() => onUseCan(c.id)}
              className="mt-1 w-full rounded-lg py-1 text-[10px] font-black uppercase text-gray-950 disabled:bg-gray-700 disabled:text-white/50"
              style={canUse ? { backgroundColor: ACCENT[c.id] } : undefined}
            >
              {ready ? "Ready ✓" : full ? "Full" : "Use"}
            </button>
            <button
              disabled={!canBuy}
              onClick={() => onBuyCan(c)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 py-0.5 text-[10px] font-black text-yellow-200 disabled:opacity-40"
            >
              Buy ★{formatMoney(price)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const MORE: [HubPhase, string, string][] = [
  ["shop-kib", "🥤", "KIB"], ["shop-boots", "👟", "Boots"], ["shop-lifestyle", "💎", "Style"],
  ["casino-menu", "🎰", "Casino"], ["sponsors", "🤝", "Sponsors"], ["achievements", "⭐", "Awards"],
  ["trophies", "🏆", "Trophies"], ["ownership", "🏛️", "Owner"], ["garden", "🌳", "Garden"],
];
function More({ onOpen }: { onOpen: (p: HubPhase) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {MORE.map(([ph, icon, label]) => (
        <button key={ph} onClick={() => onOpen(ph)} className="flex flex-col items-center rounded-xl border border-white/10 bg-gray-800/80 py-1.5 active:scale-95">
          <span className="text-[17px] leading-none">{icon}</span>
          <span className="mt-0.5 text-[9px] font-black text-white/85">{label}</span>
        </button>
      ))}
    </div>
  );
}

function PitchLines() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" viewBox="0 0 100 60" preserveAspectRatio="none">
      <line x1="0" y1="52" x2="100" y2="52" stroke="#fff" strokeWidth="0.5" />
      <ellipse cx="50" cy="52" rx="16" ry="5" fill="none" stroke="#fff" strokeWidth="0.5" />
    </svg>
  );
}
