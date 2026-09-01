"use client";
import type { CareerState } from "@/lib/star/types";
import { trophyWinners, type AwardWinner } from "@/lib/star/seasonAwards";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { formationOf } from "@/lib/star/formations";
import { SILHOUETTE_SRC } from "@/lib/silhouette";
import ImageWithFallback from "@/components/ImageWithFallback";

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

/** A real face when the database has one, the shared silhouette otherwise —
 *  never a fabricated player. */
function Face({ image, size }: { image?: string; size: number }) {
  return (
    <ImageWithFallback
      src={image || SILHOUETTE_SRC}
      fallbackSrc={SILHOUETTE_SRC}
      alt=""
      className="shrink-0 rounded-full border border-white/20 bg-white/10 object-cover"
      style={{ width: size, height: size }}
    />
  );
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

function TrophyCard({ competition, club, isYou }: {
  competition: string; club: string | null; isYou: boolean;
}) {
  return (
    <div className={`rounded-xl border p-2.5 ${isYou ? "border-amber-400/50 bg-amber-500/10" : "border-white/12 bg-white/[0.04]"}`}>
      <div className="text-[9px] font-black uppercase tracking-widest text-amber-300/90">
        {TROPHY_ICON[competition] ?? "🏆"} {competition}
      </div>
      {club ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Crest club={club} size={20} />
          <span className="min-w-0 flex-1 truncate text-[12px] font-black text-white">
            {shortClub(club)}{isYou ? " (You)" : ""}
          </span>
        </div>
      ) : (
        <div className="mt-1.5 text-[11px] font-bold text-white">Not contested this season</div>
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
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300/90">
        <span>{meta.icon}</span> {meta.label}
      </div>
      {winner ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Face image={winner.image} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-black text-white">
              {winner.name}{winner.isYou ? " (You)" : ""}
            </div>
            <div className="flex items-center gap-1">
              <Crest club={winner.club} size={13} />
              <span className="truncate text-[10px] font-bold text-white">{shortClub(winner.club)}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-black tabular-nums text-amber-300">{winner.value}</div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-white">{meta.unit}</div>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 text-[11px] font-bold text-white">No qualifying player this season</div>
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
        <div className="text-[10px] font-black uppercase tracking-widest text-amber-300/90">Team of the Season</div>
        <div className="text-[9px] font-bold text-white">{formation.name}</div>
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
        {/* The face, not a kit-coloured initial — requested directly: these
            are eleven real footballers and the photo is the thing that says
            so. The club moves to a small crest tucked against the photo,
            with his name under both. */}
        {team.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: "26%" }}
            title={`${m.name} — ${shortClub(m.club)}`}
          >
            <div className="relative">
              <ImageWithFallback
                src={m.image || SILHOUETTE_SRC}
                fallbackSrc={SILHOUETTE_SRC}
                alt=""
                className={`h-9 w-9 rounded-full border-2 bg-black/40 object-cover shadow-md ${
                  m.isYou ? "border-amber-300" : "border-white/80"}`}
              />
              <span className="absolute -bottom-0.5 -right-0.5">
                <Crest club={m.club} size={14} />
              </span>
            </div>
            <div className="mt-0.5 flex w-full flex-col items-center px-0.5">
              <span className={`truncate text-[9px] font-black leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                m.isYou ? "text-amber-300" : "text-white"}`}
              >
                {m.isYou ? "YOU" : m.name}
              </span>
              <span className="truncate text-[7px] font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                {shortClub(m.club)}
              </span>
            </div>
          </div>
        ))}
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
          <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300/90">Trophies</div>
          <div className="grid grid-cols-2 gap-2">
            {trophies.map(t => (
              <TrophyCard key={t.competition} competition={t.competition} club={t.club} isYou={t.isYou} />
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300/90">{stats.leagueName} Awards</div>
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
