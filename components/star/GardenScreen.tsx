"use client";
import type { CareerState } from "@/lib/star/types";
import { SILHOUETTE_SRC } from "@/lib/silhouette";
import ImageWithFallback from "@/components/ImageWithFallback";
import { formatMoney } from "@/lib/star/money";
import { horseRating } from "@/lib/star/horse";

/**
 * THE GARDEN — YOUR OWN PLACE.
 *
 * Phase 1 of STAR_GARDEN.md: a single, real-data-driven "home" scene rather
 * than a free-roam plaza (see that file's own header for why — a genuine
 * walkable/animated space is a second mini game-engine, not a screen, and
 * deserves its own dedicated build if it's still wanted once this exists).
 * Concept images were supplied directly as loose inspiration (a trophy
 * corner, a drinks stand, a bench, a hammock) — explicitly not meant to be
 * copied exactly, and the requested fountain is deliberately left out in
 * favour of plain grass.
 *
 * Every real thing shown here already exists elsewhere in the game — this
 * screen only displays it in one place, the same "art is separate from the
 * data" split every other screen already keeps (ClubBadge/Crest, the
 * silhouette fallback): nothing here computes a new stat or tracks new
 * state. Trophies: `career.trophies` (also SeasonAwardsScreen/TrophiesScreen).
 * The horse: `career.horse` (also Casino.tsx's stable). Teammates: a few real
 * `career.squad` entries, picked deterministically off the save so the same
 * three "visitors" show up on any given career rather than reshuffling on
 * every render.
 *
 * The background photo (`/star/garden/garden-bg.jpg`) and the decorative
 * shrub cutout (`/star/garden/bush.png`) are real, licensed Adobe Stock
 * assets — sourced via Stock search, then resized/cropped and, for the
 * shrub, background-removed into a transparent cutout, all through Adobe's
 * own editing tools rather than any hand-drawn or generated art (this
 * environment has no text-to-image generation available — see this
 * session's own earlier note on that). A dark gradient sits over the photo
 * in code so the white card text stays legible without baking a fixed crop
 * of text-safe space into the image itself.
 */

const TROPHY_ICON: Record<string, string> = {
  "FA Cup": "🏆", "League Cup": "🏆", "Champions League": "⭐", "Europa League": "🌍",
  "Community Shield": "🛡️", "Super Cup": "🛡️",
};

function GroundedCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border-2 border-white/15 bg-black/25 backdrop-blur-[1px] p-3 ${className}`}>
      {children}
    </div>
  );
}

/** A stable pick of a few real teammates to have "hanging around" today —
 *  seeded off how many the squad has and the current week, so it changes
 *  slowly (a new trio most weeks) rather than never or on every render. */
function pickVisitors(career: CareerState): CareerState["squad"] {
  const squad = career.squad ?? [];
  if (squad.length <= 3) return squad;
  const start = (career.week + career.season * 7) % squad.length;
  const out: CareerState["squad"] = [];
  for (let i = 0; i < 3; i++) out.push(squad[(start + i) % squad.length]);
  return out;
}

export default function GardenScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const trophies = career.trophies ?? [];
  const trophyCounts = new Map<string, number>();
  for (const t of trophies) trophyCounts.set(t.competition, (trophyCounts.get(t.competition) ?? 0) + 1);
  const trophyKinds = Array.from(trophyCounts.keys());

  const horse = career.horse;
  const visitors = pickVisitors(career);

  return (
    <div
      className="min-h-screen text-white flex flex-col py-3 px-3 bg-cover bg-top"
      style={{
        backgroundImage: "linear-gradient(180deg,rgba(10,20,10,0.35) 0%,rgba(10,20,10,0.55) 55%,rgba(6,14,6,0.8) 100%), url(/star/garden/garden-bg.jpg)",
      }}
    >
      <div className="w-full max-w-sm mx-auto flex-1">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-black/40 rounded-lg font-black text-sm text-white">← Back</button>
          <div className="font-black text-white text-lg drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">The Garden</div>
          <div />
        </div>

        {/* ── Trophy corner ── */}
        <GroundedCard className="mb-3 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/star/garden/bush.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-3 -right-4 w-28 opacity-90"
          />
          <div className="relative mb-2 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">🏆 Trophy Corner</div>
            {career.ballonDorWins > 0 && (
              <div className="text-[10px] font-black text-amber-300">Ballon d&apos;Or ×{career.ballonDorWins}</div>
            )}
          </div>
          {trophyKinds.length === 0 ? (
            <div className="relative text-center text-sm font-bold text-white py-3">
              An empty shelf, waiting on a first trophy.
            </div>
          ) : (
            <div className="relative grid grid-cols-3 gap-2">
              {trophyKinds.map(kind => (
                <div key={kind} className="rounded-xl bg-gradient-to-b from-yellow-700/60 to-yellow-900/60 border border-yellow-500/40 p-2 text-center">
                  <div className="text-2xl">{TROPHY_ICON[kind] ?? "🏆"}</div>
                  <div className="mt-0.5 text-[9px] font-black text-white leading-tight">{kind}</div>
                  <div className="text-[11px] font-black text-amber-300">×{trophyCounts.get(kind)}</div>
                </div>
              ))}
            </div>
          )}
        </GroundedCard>

        {/* ── The stable, if you own a horse ── */}
        <GroundedCard className="mb-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-200">🐎 The Paddock</div>
          {horse ? (
            <div className="flex items-center gap-3">
              <div className="text-4xl">🐎</div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-white text-base truncate">{horse.name}</div>
                <div className="text-[11px] font-bold text-white">{horse.breed} · Rating {horseRating(horse)}</div>
                <div className="text-[10px] font-bold text-white">{horse.racesWon} wins from {horse.racesRun} races · ★{formatMoney(horse.earnings)} earned</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm font-bold text-white py-2">
              No horse of your own yet — the Casino&apos;s stable is where that starts.
            </div>
          )}
        </GroundedCard>

        {/* ── Teammates hanging around ── */}
        <GroundedCard>
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-sky-200">👥 Who&apos;s Over Today</div>
          {visitors.length === 0 ? (
            <div className="text-center text-sm font-bold text-white py-2">No squad data on file yet.</div>
          ) : (
            <div className="flex justify-around">
              {visitors.map(p => (
                <div key={p.id} className="flex flex-col items-center w-1/3 min-w-0">
                  <ImageWithFallback
                    src={p.imageUrl || SILHOUETTE_SRC}
                    fallbackSrc={SILHOUETTE_SRC}
                    alt=""
                    className="h-12 w-12 rounded-full border-2 border-white/70 bg-black/40 object-cover shadow-md"
                  />
                  <div className="mt-1 truncate max-w-full text-[10px] font-black text-white">{p.shortName || p.name}</div>
                  <div className="text-[9px] font-bold text-white">{p.position}</div>
                </div>
              ))}
            </div>
          )}
        </GroundedCard>
      </div>
    </div>
  );
}
