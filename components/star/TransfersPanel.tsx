import type { CareerState } from "@/lib/star/types";
import { seasonStartYear } from "@/lib/star/calendar";

/**
 * THIS WINDOW'S BUSINESS.
 *
 * Moved here from the League screen's own tab bar — requested directly, to
 * make room in a seven-tab bar that had grown one tab past comfortable, and
 * because a transfer is news, which is what this screen already exists for.
 * Reads the exact same career fields (`leagueTransferNews`/`leagueLoanNews`/
 * `activeLoans`) LeagueScreen always did; nothing about the data changed,
 * only where it's shown.
 */

const isYourClub = (club: string, career: CareerState) => club === career.player.club;

/** "2027/28" — the season a loan actually comes home FOR, not the one it was
 *  made in (returnLoansHome runs before that season's own number is set —
 *  see lib/star/leagueTransfers.ts). */
function loanReturnLabel(career: CareerState, returnSeason: number): string {
  const y = seasonStartYear(career.player.startYear, returnSeason + 1);
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

export default function TransfersPanel({ career }: { career: CareerState }) {
  return (
    <div className="space-y-2">
      {/* ── This window's business ──
          leagueTransferNews/leagueLoanNews are replaced whole every time
          a window closes (see lib/star/careerFlow.ts) — this is "what
          just happened", not a running history. Sales and loans for the
          whole division, yours highlighted, most relevant (yours) first
          within each list rather than in whatever order the engine
          produced them. */}
      <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
        <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 border-b border-black/50">
          This Window
        </div>
        {(!career.leagueTransferNews?.length && !career.leagueLoanNews?.length) && (
          <div className="px-2 py-2 text-[11px] font-bold text-white/70">
            No business yet. The rest of the division deals in the summer and
            again in January — check back once a window has opened and closed.
          </div>
        )}
        {[...(career.leagueTransferNews ?? [])]
          .sort((a, b) => Number(isYourClub(b.from, career) || isYourClub(b.to, career))
            - Number(isYourClub(a.from, career) || isYourClub(a.to, career)))
          .map((m, i) => {
            const yours = isYourClub(m.from, career) || isYourClub(m.to, career);
            return (
              <div
                key={`sale-${i}-${m.player}`}
                className={`px-2 py-1.5 border-b border-black/20 last:border-b-0 ${
                  yours ? "bg-emerald-600 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-black truncate">{m.player}</span>
                  <span className="text-[10px] font-black tabular-nums text-amber-200">
                    {m.fee > 0 ? `£${m.fee}m` : "Free Transfer"}
                  </span>
                </div>
                <div className="text-[10px] font-bold text-white/80">
                  {m.from} → {m.to}
                  {m.unhappy && <span className="ml-1.5 text-amber-300">· forced the move</span>}
                </div>
              </div>
            );
          })}
        {[...(career.leagueLoanNews ?? [])]
          .sort((a, b) => Number(isYourClub(b.parentClub, career) || isYourClub(b.loanClub, career))
            - Number(isYourClub(a.parentClub, career) || isYourClub(a.loanClub, career)))
          .map((l, i) => {
            const yours = isYourClub(l.parentClub, career) || isYourClub(l.loanClub, career);
            return (
              <div
                key={`loan-${i}-${l.playerId}`}
                className={`px-2 py-1.5 border-b border-black/20 last:border-b-0 ${
                  yours ? "bg-sky-700 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-black truncate">{l.player}</span>
                  <span className="text-[10px] font-black uppercase tracking-wide text-sky-200">Loan</span>
                </div>
                <div className="text-[10px] font-bold text-white/80">
                  {l.parentClub} → {l.loanClub} · back for {loanReturnLabel(career, l.returnSeason)}
                </div>
              </div>
            );
          })}
      </div>

      {/* ── Live state: who is out on loan right now, whichever window it
          was made in ── */}
      {(career.activeLoans ?? []).length > 0 && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-sky-300 border-b border-black/50">
            Currently On Loan
          </div>
          {[...(career.activeLoans ?? [])]
            .sort((a, b) => Number(isYourClub(b.parentClub, career) || isYourClub(b.loanClub, career))
              - Number(isYourClub(a.parentClub, career) || isYourClub(a.loanClub, career)))
            .map((l, i) => {
              const yours = isYourClub(l.parentClub, career) || isYourClub(l.loanClub, career);
              return (
                <div
                  key={`active-${l.playerId}`}
                  className={`px-2 py-1.5 border-b border-black/20 last:border-b-0 text-[10px] font-bold ${
                    yours ? "bg-sky-700 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"}`}
                >
                  <span className="font-black">{l.player}</span> — {l.parentClub}&apos;s player, out at {l.loanClub}
                  {" "}· back for {loanReturnLabel(career, l.returnSeason)}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
