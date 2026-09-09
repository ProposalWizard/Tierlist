import type { CareerState } from "@/lib/star/types";
import type { Role } from "@/lib/star/formations";
import { seasonStartYear } from "@/lib/star/calendar";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";
import ClubBadge from "./ClubBadge";
import { SILHOUETTE_SRC } from "@/lib/silhouette";
import ImageWithFallback from "@/components/ImageWithFallback";

/**
 * THIS WINDOW'S BUSINESS.
 *
 * Redesigned from a concept image supplied directly, replacing what was a
 * plain, dense text list — moved here from the League screen's own tab bar
 * originally, because a transfer is news, which is what this screen already
 * exists for. Still reads the exact same career fields
 * (`leagueTransferNews`/`leagueLoanNews`/`activeLoans`) LeagueScreen always
 * did; nothing about WHAT is shown changed, only how.
 *
 * Two things the concept added that the data didn't carry yet — a real
 * photo and a position/age line per player — are why `TransferMove`/
 * `LoanMove` (leagueTransfers.ts) now also carry `position`/`age`/
 * `imageUrl`: every `Candidate` that file already reads had them the whole
 * time, they just never survived into the news feed. Missing photo falls
 * back to the same silhouette every other screen in this game uses
 * (lib/silhouette.ts) — a generated squad-filler player has never had a
 * real photo, same as before.
 *
 * The "forced the move" callout the concept dropped is gone — reported
 * directly as unnecessary noise, it showed up on nearly every row. The
 * underlying `unhappy` flag survives on the data (still drives real
 * transfer logic elsewhere); this only removes the label.
 */

const isYourClub = (club: string, career: CareerState) => club === career.player.club;

/** "2027/28" — the season a loan actually comes home FOR, not the one it was
 *  made in (returnLoansHome runs before that season's own number is set —
 *  see lib/star/leagueTransfers.ts). */
function loanReturnLabel(career: CareerState, returnSeason: number): string {
  const y = seasonStartYear(career.player.startYear, returnSeason + 1);
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

type RightSide =
  | { kind: "fee"; fee: number }
  | { kind: "free" }
  | { kind: "loan"; returnLabel: string };

interface Row {
  key: string;
  player: string;
  position: Role;
  age?: number;
  imageUrl?: string;
  from: string;
  to: string;
  yours: boolean;
  right: RightSide;
}

export default function TransfersPanel({ career }: { career: CareerState }) {
  const sales = career.leagueTransferNews ?? [];
  const loans = career.leagueLoanNews ?? [];

  // Same "yours first" ordering the original list used, kept separately per
  // source so a loan never gets sorted in among sales — the two lists are
  // just presented one after another now instead of under two headers.
  const saleRows: Row[] = [...sales]
    .sort((a, b) => Number(isYourClub(b.from, career) || isYourClub(b.to, career))
      - Number(isYourClub(a.from, career) || isYourClub(a.to, career)))
    .map((m, i) => ({
      key: `sale-${i}-${m.player}`,
      player: m.player, position: m.position, age: m.age, imageUrl: m.imageUrl,
      from: m.from, to: m.to,
      yours: isYourClub(m.from, career) || isYourClub(m.to, career),
      right: m.fee > 0 ? { kind: "fee", fee: m.fee } : { kind: "free" },
    }));

  const loanRows: Row[] = [...loans]
    .sort((a, b) => Number(isYourClub(b.parentClub, career) || isYourClub(b.loanClub, career))
      - Number(isYourClub(a.parentClub, career) || isYourClub(a.loanClub, career)))
    .map((l, i) => ({
      key: `loan-${i}-${l.playerId}`,
      player: l.player, position: l.position, age: l.age, imageUrl: l.imageUrl,
      from: l.parentClub, to: l.loanClub,
      yours: isYourClub(l.parentClub, career) || isYourClub(l.loanClub, career),
      right: { kind: "loan", returnLabel: loanReturnLabel(career, l.returnSeason) },
    }));

  const rows = [...saleRows, ...loanRows];

  // Whole division's spending, not just yours — "This Window" already shows
  // everybody's business, so the total above it is the same scope.
  const totalSpent = sales.reduce((sum, m) => sum + m.fee, 0);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-base font-black italic tracking-tight text-white">This Window</h2>
          {totalSpent > 0 && (
            <div className="rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-500 px-2.5 py-1 text-[11px] font-black tabular-nums text-emerald-950 shadow-md">
              £{totalSpent.toFixed(1)}m <span className="opacity-70">SPENT</span>
            </div>
          )}
        </div>

        {rows.length === 0 && (
          <div className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-6 text-center text-[11px] font-bold text-white/60">
            No business yet. The rest of the division deals in the summer and
            again in January — check back once a window has opened and closed.
          </div>
        )}

        <div className="space-y-2">
          {rows.map(row => <TransferRow key={row.key} row={row} />)}
        </div>
      </div>

      {/* ── Live state: who is out on loan right now, whichever window it
          was made in ── */}
      {(career.activeLoans ?? []).length > 0 && (
        <div>
          <div className="mb-2 px-0.5 text-[11px] font-black uppercase tracking-widest text-sky-300">
            Currently On Loan
          </div>
          <div className="space-y-1.5">
            {[...(career.activeLoans ?? [])]
              .sort((a, b) => Number(isYourClub(b.parentClub, career) || isYourClub(b.loanClub, career))
                - Number(isYourClub(a.parentClub, career) || isYourClub(a.loanClub, career)))
              .map((l) => {
                const yours = isYourClub(l.parentClub, career) || isYourClub(l.loanClub, career);
                return (
                  <div
                    key={`active-${l.playerId}`}
                    className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
                      yours ? "border-sky-400/60 bg-sky-500/10 text-white" : "border-white/10 bg-white/[0.03] text-white/80"
                    }`}
                  >
                    <span className="font-black">{l.player}</span> — {l.parentClub}&apos;s player, out at {l.loanClub}
                    {" "}· back for {loanReturnLabel(career, l.returnSeason)}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

const POSITION_STYLE: Record<Role, string> = {
  GK: "bg-amber-400 text-amber-950",
  CB: "bg-sky-500 text-sky-950", LB: "bg-sky-500 text-sky-950", RB: "bg-sky-500 text-sky-950",
  CDM: "bg-emerald-500 text-emerald-950", CM: "bg-emerald-500 text-emerald-950", CAM: "bg-emerald-500 text-emerald-950",
  LW: "bg-rose-500 text-rose-950", RW: "bg-rose-500 text-rose-950", ST: "bg-rose-500 text-rose-950",
};

function PositionChip({ position }: { position: Role }) {
  return (
    <span className={`rounded px-1.5 py-[1px] text-[9px] font-black leading-tight ${POSITION_STYLE[position] ?? "bg-white/20 text-white"}`}>
      {position}
    </span>
  );
}

/** One club, as a small badge — `ClubBadge` (the real crest when one
 *  exists, its kit-colour-and-initials fallback otherwise), the same
 *  device ClubCrest.tsx and CupDrawReveal.tsx's TeamBadge already use
 *  everywhere a club needs to read as more than a name. `Free Agents` (a
 *  synthetic "club" — see leagueSquads.ts) isn't a real club to look a
 *  crest or kit colours up for, so it gets its own dashed, colourless
 *  marker instead of a misleading dot that would read as an actual side. */
function ClubDot({ club }: { club: string }) {
  if (club === FREE_AGENTS_CLUB) {
    return (
      <div
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-white/40 bg-white/5 text-[7px] font-black text-white/50"
        title="Free Agents"
      >
        FA
      </div>
    );
  }
  return <ClubBadge club={club} size={24} />;
}

function MoveArrow() {
  return (
    <svg width="12" height="10" viewBox="0 0 16 12" fill="none" className="shrink-0 text-white/40">
      <path d="M1 6h13M9 1l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TransferRow({ row }: { row: Row }) {
  return (
    <div
      className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 ${
        row.yours
          ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.22)]"
          : "border-sky-400/15 bg-sky-950/25"
      }`}
    >
      {row.yours && (
        <span className="absolute -top-1.5 right-2.5 rounded-full bg-emerald-400 px-2 py-[1px] text-[8px] font-black uppercase tracking-wide text-emerald-950 shadow">
          Fee Agreed
        </span>
      )}

      <ImageWithFallback
        src={row.imageUrl || SILHOUETTE_SRC}
        fallbackSrc={SILHOUETTE_SRC}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full border border-white/15 bg-gray-800 object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-black leading-tight text-white">{row.player}</div>
        <div className="truncate text-[10px] font-bold leading-tight text-white/60">{row.from} → {row.to}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <PositionChip position={row.position} />
          {row.age !== undefined && <span className="text-[10px] font-bold text-white/45">Age {row.age}</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-1">
          <ClubDot club={row.from} />
          <MoveArrow />
          <ClubDot club={row.to} />
        </div>
        {row.right.kind === "fee" && (
          <span className="text-[11px] font-black tabular-nums text-amber-300">£{row.right.fee}m</span>
        )}
        {row.right.kind === "free" && (
          <span className="rounded-full border border-amber-400/60 px-2 py-[1px] text-[8px] font-black uppercase tracking-wide text-amber-300">
            Free Transfer
          </span>
        )}
        {row.right.kind === "loan" && (
          <span className="rounded-full border border-sky-400/60 px-2 py-[1px] text-[8px] font-black uppercase tracking-wide text-sky-300">
            Loan · {row.right.returnLabel}
          </span>
        )}
      </div>
    </div>
  );
}
