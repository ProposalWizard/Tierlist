"use client";
import type { CareerState } from "@/lib/star/types";
import { trophyWinners, type AwardWinner } from "@/lib/star/seasonAwards";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { formationOf } from "@/lib/star/formations";

/**
 * WHAT THE SEASON HANDED OUT.
 *
 * Shown once, right after a season rolls over — trophies first (every
 * competition this game actually has, whoever won them), then the
 * individual awards, then a Team of the Season. Requested directly, after a
 * first Ballon d'Or ceremony: "I'd also like to see some more awards and
 * trophies."
 *
 * See lib/star/seasonAwards.ts for what each award is actually computed
 * from, and its honest limits — Community Shield/Super Cup only resolve a
 * winner in a season your own club was in one, and Player/Young Player of
 * the Season are a composite of overall plus real league goals and assists
 * rather than a match-rating vote nothing outside your own games could ever
 * produce.
 */

interface Props {
  career: CareerState;
  onContinue: () => void;
}

function Crest({ club, size = 22 }: { club: string; size?: number }) {
  const kit = kitsOf(club).home;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border-2 font-black"
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.34),
        backgroundColor: kit.shirt, borderColor: kit.trim, color: labelInk(kit.shirt),
      }}
    >
      {club.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
    </span>
  );
}

const TROPHY_ICON: Record<string, string> = {
  "FA Cup": "🏆", "League Cup": "🏆", "Champions League": "⭐", "Europa League": "🌍",
  "Community Shield": "🛡️", "Super Cup": "🛡️",
};

function TrophyCard({ competition, club, isYou, isGuess }: {
  competition: string; club: string | null; isYou: boolean; isGuess: boolean;
}) {
  return (
    <div className={`rounded-xl border p-2.5 ${isYou ? "border-amber-400/50 bg-amber-500/10" : "border-white/12 bg-white/[0.04]"}`}>
      <div className="text-[9px] font-black uppercase tracking-widest text-white/50">
        {TROPHY_ICON[competition] ?? "🏆"} {competition}
      </div>
      {club ? (
        <>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Crest club={club} size={20} />
            <span className="min-w-0 flex-1 truncate text-[12px] font-black text-white">
              {shortClub(club)}{isYou ? " (You)" : ""}
            </span>
          </div>
          {/* A Community Shield/Super Cup you were not in is a genuine
              estimate, not a settled result — said outright rather than
              presented with the same confidence as a real score. */}
          {isGuess && <div className="mt-1 text-[8px] font-bold uppercase tracking-wide text-white/35">Estimated — not your match</div>}
        </>
      ) : (
        <div className="mt-1.5 text-[11px] font-bold text-white/35">Not contested this season</div>
      )}
    </div>
  );
}

const AWARD_META: Record<string, { label: string; icon: string; unit: string }> = {
  goldenBoot: { label: "Golden Boot", icon: "👟", unit: "goals" },
  assistKing: { label: "Assist King", icon: "🎯", unit: "assists" },
  goldenGlove: { label: "Golden Glove", icon: "🧤", unit: "clean sheets" },
  playerOfSeason: { label: "Player of the Season", icon: "🌟", unit: "rating" },
  youngPlayerOfSeason: { label: "Young Player of the Season", icon: "💎", unit: "rating" },
};

function AwardCard({ id, winner }: { id: keyof typeof AWARD_META; winner: AwardWinner | null }) {
  const meta = AWARD_META[id];
  return (
    <div className={`rounded-xl border p-3 ${winner?.isYou ? "border-amber-400/50 bg-amber-500/10" : "border-white/12 bg-white/[0.04]"}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60">
        <span>{meta.icon}</span> {meta.label}
      </div>
      {winner ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Crest club={winner.club} size={24} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-black text-white">
              {winner.name}{winner.isYou ? " (You)" : ""}
            </div>
            <div className="truncate text-[10px] font-bold text-white/50">{shortClub(winner.club)}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-black tabular-nums text-amber-300">{winner.value}</div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-white/40">{meta.unit}</div>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 text-[11px] font-bold text-white/35">No qualifying player this season</div>
      )}
    </div>
  );
}

function TeamOfSeasonPitch({ career }: { career: CareerState }) {
  const stats = career.lastSeasonAwardStats;
  const team = stats?.teamOfSeason ?? [];
  const formation = formationOf("433");
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Team of the Season</div>
        <div className="text-[9px] font-bold text-white/35">{formation.name}</div>
      </div>
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-emerald-900/70"
        style={{ background: "linear-gradient(#1f9006,#187406)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
          <div className="absolute left-1/2 top-1/2 h-[13%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
          <div className="absolute left-1/2 top-0 h-[13%] w-[52%] -translate-x-1/2 border-x border-b border-white/30" />
          <div className="absolute bottom-0 left-1/2 h-[13%] w-[52%] -translate-x-1/2 border-x border-t border-white/30" />
        </div>
        {team.map((m, i) => {
          const kit = kitsOf(m.club).home;
          return (
            <div
              key={`${m.role}-${i}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: "26%" }}
              title={`${m.name} — ${shortClub(m.club)}`}
            >
              <div
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-white/70 text-[9px] font-black shadow-md"
                style={{ backgroundColor: kit.shirt, color: labelInk(kit.shirt) }}
              >
                {m.label ?? m.role}
              </div>
              <div className="mt-0.5 flex w-full flex-col items-center px-0.5">
                <span className="truncate text-[9px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                  {m.isYou ? "YOU" : m.name}
                </span>
                <span className="truncate text-[7px] font-bold leading-tight text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                  {shortClub(m.club)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SeasonAwardsScreen({ career, onContinue }: Props) {
  const stats = career.lastSeasonAwardStats;
  if (!stats) return null;
  const trophies = trophyWinners(career, stats);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-gray-950 to-gray-950 px-3 py-5 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <div className="inline-block rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
            Season {stats.season}
          </div>
          <h1 className="mt-2 text-2xl font-black">Season Awards</h1>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-white/60">Trophies</div>
          <div className="grid grid-cols-2 gap-2">
            {trophies.map(t => (
              <TrophyCard key={t.competition} competition={t.competition} club={t.club} isYou={t.isYou} isGuess={t.isGuess} />
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-white/60">{stats.leagueName} Awards</div>
          <AwardCard id="goldenBoot" winner={stats.goldenBoot} />
          <AwardCard id="assistKing" winner={stats.assistKing} />
          <AwardCard id="goldenGlove" winner={stats.goldenGlove} />
          <AwardCard id="playerOfSeason" winner={stats.playerOfSeason} />
          <AwardCard id="youngPlayerOfSeason" winner={stats.youngPlayerOfSeason} />
        </div>

        <div className="mt-4">
          <TeamOfSeasonPitch career={career} />
        </div>

        <button
          onClick={onContinue}
          className="mt-4 w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-3 text-sm font-black uppercase tracking-widest text-emerald-950 shadow-[0_6px_16px_-2px_rgba(16,185,129,0.5)] transition hover:brightness-105 active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
