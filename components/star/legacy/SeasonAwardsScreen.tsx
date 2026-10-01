"use client";
import TrophyImage from "@/components/star/TrophyImage";
import type { CareerState } from "@/lib/star/types";
import { trophyWinners, type AwardWinner } from "@/lib/star/seasonAwards";
import { kitsOf, labelInk } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { formationOf } from "@/lib/star/formations";
import { faceOrFake } from "@/lib/star/fakeFaces";
import ImageWithFallback from "@/components/ImageWithFallback";
import { Burst, PressButton, Shine, clubTheme } from "@/components/star/legacy/ui";
import { Screen, Rays, Kicker, SectionLabel } from "@/components/star/legacy/ui/Screen";

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

/** A real face when the database has one, otherwise that player's own fake
 *  face — never a silhouette (Harry, v0.15 item 37). */
function Face({ image, name, size }: { image?: string; name: string; size: number }) {
  return (
    <ImageWithFallback
      src={faceOrFake(image, name)}
      fallbackSrc={faceOrFake(null, name)}
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

function TrophyCard({ competition, club, isYou, index }: {
  competition: string; club: string | null; isYou: boolean; index: number;
}) {
  return (
    <div
      className="kit-card kit-rise relative overflow-hidden p-2.5"
      style={{ animationDelay: `${150 + index * 90}ms`, ...(isYou ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,.6), 0 0 22px rgba(251,191,36,.25)" } : {}) }}
    >
      {isYou && <Shine trigger={1} />}
      <div className="text-[9px] font-black uppercase tracking-widest text-amber-300/90">
        <span className="kit-trophy-in mr-1 inline-flex align-middle" style={{ animationDelay: `${220 + index * 90}ms` }}><TrophyImage name={competition} height={22} fallback={TROPHY_ICON[competition] ?? "🏆"} /></span>{competition}
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
  playerOfSeason: { label: "Player of the Season", icon: "🌟", unit: "votes" },
  youngPlayerOfSeason: { label: "Young Player of the Season", icon: "💎", unit: "votes" },
};

function AwardCard({ id, winner, index }: { id: keyof typeof AWARD_META; winner: AwardWinner | null; index: number }) {
  const meta = AWARD_META[id];
  return (
    <div
      className="kit-card kit-rise relative overflow-hidden p-3"
      style={{ animationDelay: `${700 + index * 110}ms`, ...(winner?.isYou ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,.6), 0 0 22px rgba(251,191,36,.25)" } : {}) }}
    >
      {winner?.isYou && <Shine trigger={1} />}
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300/90">
        <span className="kit-trophy-in inline-flex" style={{ animationDelay: `${780 + index * 110}ms` }}><TrophyImage name={meta.label} height={22} fallback={meta.icon} /></span> {meta.label}
      </div>
      {winner ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Face image={winner.image} name={winner.name} size={34} />
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
        className="relative aspect-[3/4] overflow-hidden rounded-2xl"
        style={{ background: "repeating-linear-gradient(180deg, #1f7a3a 0 9%, #1a6d33 9% 18%)", boxShadow: "inset 0 0 40px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.12), 0 12px 26px -12px rgba(0,0,0,.9)" }}
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
            <div className="kit-rise flex w-full flex-col items-center" style={{ animationDelay: `${1300 + i * 70}ms` }}>
            <div className="relative">
              <ImageWithFallback
                src={faceOrFake(m.image, m.name)}
                fallbackSrc={faceOrFake(null, m.name)}
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
  const theme = clubTheme(career.player.club, career);
  const youWon = trophies.some(t => t.isYou)
    || [stats.goldenBoot, stats.assistKing, stats.goldenGlove, stats.playerOfSeason, stats.youngPlayerOfSeason].some(w => w?.isYou);

  return (
    <Screen glow="#d4a017" tone={theme.glow} className="max-w-md px-3 py-5">
      <div className="relative w-full">
        <div className="relative text-center">
          <Rays color="#fde68a" size={260} className="top-[55%]" />
          {youWon && <Burst colors={[theme.shirt, theme.trim, "#fde047", "#ffffff"]} count={26} className="left-1/2 top-[60%]" />}
          <div className="relative"><Kicker color="#fcd34d">Season {stats.season}</Kicker></div>
          <h1
            className="kit-drop-in kit-text-shine relative mt-2 pr-1 text-[30px] font-black italic uppercase leading-none"
            style={{ backgroundImage: "linear-gradient(100deg,#fde68a 20%,#ffffff 45%,#fbbf24 60%,#fde68a 80%)", filter: "drop-shadow(0 3px 0 rgba(0,0,0,.5))" }}
          >
            Season Awards
          </h1>
        </div>

        <div className="mt-4">
          <SectionLabel className="mb-1.5 text-amber-300/90">Trophies</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {trophies.map((t, i) => (
              <TrophyCard key={t.competition} competition={t.competition} club={t.club} isYou={t.isYou} index={i} />
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <SectionLabel className="mb-1.5 text-amber-300/90">{stats.leagueName} Awards</SectionLabel>
          <AwardCard id="goldenBoot" winner={stats.goldenBoot} index={0} />
          <AwardCard id="assistKing" winner={stats.assistKing} index={1} />
          <AwardCard id="goldenGlove" winner={stats.goldenGlove} index={2} />
          <AwardCard id="playerOfSeason" winner={stats.playerOfSeason} index={3} />
          <AwardCard id="youngPlayerOfSeason" winner={stats.youngPlayerOfSeason} index={4} />
        </div>

        <div className="mt-4">
          <TeamOfSeasonPitch career={career} />
        </div>

        <PressButton variant="primary" size="lg" pulse onClick={onContinue} className="relative mt-4 w-full overflow-hidden">
          <Shine loop every={5} />
          Continue
        </PressButton>
      </div>
    </Screen>
  );
}
