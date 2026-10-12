"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { TransferOffer } from "@/lib/star/transfers";
import {
  ASKABLE_LEAGUES, ASK_CLUB_BOSS_COST, ASK_LEAGUE_BOSS_COST, canAsk, clubsIn, playerOverall,
  requestOf, weeksUntilAskable, type ClubReply,
} from "@/lib/star/transferRequest";
import { divisionOf, leagueNameFor, type CareerDivision } from "@/lib/star/calendar";
import { formatMoneyPrecise } from "@/lib/star/money";
import { canMoveNow, januaryAhead, januaryWindowOpen } from "@/lib/star/januaryTransfer";
import ClubBadge from "./ClubBadge";
import { PressButton, clubTheme } from "./ui";
import { Screen, Kicker } from "./ui/Screen";

/**
 * FIND A NEW CLUB (roadmap #2, Leo 11 Oct 2026).
 *
 * Pick a league, ask every club in it or tap one club, read the answers.
 * A yes can be accepted as it stands or talked up (NegotiationScreen). The
 * deal is signed in the January window (Join now, januaryTransfer.ts) or the
 * summer window, top of the end-of-season offers.
 *
 * The answers: yes first, best first, top 5 with "Show all"; every no folded
 * into one line that opens.
 * All the rules live in lib/star/transferRequest.ts.
 */

interface Props {
  career: CareerState;
  onAsk: (league: CareerDivision, club?: string) => void;
  onAccept: (offer: TransferOffer) => void;
  onTalk: (offer: TransferOffer) => void;
  onCallOff: () => void;
  /** Sign the agreed deal now, in the January window. */
  onJoinNow?: () => void;
  onBack: () => void;
}

/** How many yes cards show before "Show all". */
const YES_SHOWN = 5;

/** A wage you can tell apart from the next one: ★1.5k, not ★1k. */
const wageText = (w: number) => `★${formatMoneyPrecise(w)}`;

const ROLE_RANK: Record<string, number> = { "Star man": 3, "First team": 2, Rotation: 1, "Squad player": 0 };

const SHORT_LEAGUE: Record<CareerDivision, string> = {
  premier: "Premier", championship: "Champ'ship", league_one: "League 1", league_two: "League 2",
  national_league: "National", national_league_north: "Nat. North", national_league_south: "Nat. South",
};

export default function TransferRequest({ career, onAsk, onAccept, onTalk, onCallOff, onJoinNow, onBack }: Props) {
  const req = requestOf(career);
  const [league, setLeague] = useState<CareerDivision>(req.league ?? divisionOf(career));
  const [picked, setPicked] = useState<string | null>(null);
  const [allYes, setAllYes] = useState(false);
  const [showNo, setShowNo] = useState(false);
  const theme = clubTheme(career.player.club, career);
  const block = canAsk(career);
  const clubs = clubsIn(career, league);
  const overall = playerOverall(career);
  const replies = req.league === league ? req.replies : [];
  // Best first: the bigger club, then the bigger role, then the bigger wage.
  const yes = replies.filter(r => r.yes && r.offer).sort((a, b) =>
    b.strength - a.strength
    || (ROLE_RANK[b.role ?? ""] ?? 0) - (ROLE_RANK[a.role ?? ""] ?? 0)
    || (b.offer!.wage - a.offer!.wage));
  const yesShown = allYes ? yes : yes.slice(0, YES_SHOWN);
  const no = replies.filter(r => !r.yes);
  const boss = Math.round(career.relationships.boss);

  return (
    <Screen glow="#8b5cf6" tone={theme.glow} className="max-w-sm px-3 py-5">
      <div className="w-full" data-transfer-request>
        <div className="text-center">
          <Kicker color="#c4b5fd">Transfer request</Kicker>
          <h1 className="kit-drop-in mt-2 text-2xl font-black uppercase leading-tight" style={{ textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>
            Find a new club
          </h1>
          <p className="mt-1 text-xs font-bold text-white" data-transfer-window>
            {januaryWindowOpen(career) ? "The January window is open: moves happen now."
              : januaryAhead(career) ? "Moves happen in January or the summer."
              : "Moves happen in the summer window."}
          </p>
        </div>

        {/* Your manager's mood: the price of asking. */}
        <div className="kit-card mt-3 p-3">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white">
            <span>Your manager</span>
            <span>{boss}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden bg-white/10" style={{ borderRadius: 2 }}>
            <div className="h-full" style={{ width: `${boss}%`, background: boss >= 60 ? "#34d399" : boss >= 35 ? "#fbbf24" : "#f87171" }} />
          </div>
          <p className="mt-1 text-[11px] font-bold text-white">Asking for a move upsets him.</p>
        </div>

        {req.agreed ? (
          <AgreedCard career={career} offer={req.agreed} onCallOff={onCallOff} onJoinNow={onJoinNow} />
        ) : (
          <>
            {/* The league. */}
            <div className="mt-3 grid grid-cols-4 gap-1.5" data-transfer-leagues>
              {ASKABLE_LEAGUES.map(d => (
                <button
                  key={d}
                  onClick={() => { setLeague(d); setPicked(null); }}
                  className={`kib-press px-1 py-1.5 text-[10px] font-black uppercase leading-tight ${league === d ? "bg-violet-500 text-white" : "bg-white/10 text-white"}`}
                  style={{ borderRadius: 2 }}
                >
                  {SHORT_LEAGUE[d]}
                </button>
              ))}
            </div>

            {/* The answers, newest first: yes before no. */}
            {yes.length > 0 && (
              <div className="mt-3 space-y-2" data-transfer-yes>
                <div className="flex items-baseline justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-emerald-300">{yes.length === 1 ? "1 club wants you" : `${yes.length} clubs want you`}</span>
                  <span className="text-white">You're on {wageText(career.contract.wage)} a week</span>
                </div>
                {yesShown.map(r => <YesCard key={r.club} career={career} reply={r} onAccept={onAccept} onTalk={onTalk} />)}
                {yes.length > YES_SHOWN && (
                  <button
                    onClick={() => setAllYes(v => !v)}
                    className="kib-press w-full bg-white/10 py-2 text-[12px] font-black text-white"
                    style={{ borderRadius: 2 }}
                    data-transfer-show-all
                  >
                    {allYes ? "Show the top 5" : `Show all (${yes.length})`}
                  </button>
                )}
              </div>
            )}
            {no.length > 0 && (
              <div className="mt-3" data-transfer-no>
                <button
                  onClick={() => setShowNo(v => !v)}
                  className="kit-card kib-press flex w-full items-center justify-between px-3 py-2 text-left"
                  data-transfer-no-toggle
                >
                  <span className="text-[12px] font-black text-red-300">
                    {no.length === 1 ? "1 club said no" : `${no.length} clubs said no`}
                  </span>
                  <span className="text-[11px] font-black text-white">{showNo ? "Hide ▴" : "Why ▾"}</span>
                </button>
                {showNo && <div className="kit-card mt-1 divide-y divide-white/10">
                  {no.map(r => (
                    <div key={r.club} className="flex items-center gap-2 px-2 py-1.5">
                      <ClubBadge club={r.club} size={20} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-black text-white">{r.club}</div>
                        <div className="text-[11px] font-bold text-white">“{r.message}”</div>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
            )}

            {/* The clubs in the league: tap one to ask only them. */}
            <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-white">
              {leagueNameFor(league)} · tap a club to ask just them
            </div>
            <div className="kit-card mt-1 max-h-[40vh] overflow-y-auto" data-transfer-clubs>
              {clubs.map(c => {
                const wait = weeksUntilAskable(career, c.club);
                const on = picked === c.club;
                const level = Math.max(4, Math.min(100, ((c.strength - 40) / 55) * 100));
                return (
                  <button
                    key={c.club}
                    onClick={() => setPicked(on ? null : c.club)}
                    disabled={wait > 0}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${on ? "bg-violet-500/30" : ""} ${wait > 0 ? "opacity-50" : ""}`}
                  >
                    <ClubBadge club={c.club} size={20} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{c.club}</span>
                    {wait > 0 ? (
                      <span className="text-[10px] font-bold text-white">ask in {wait} wk</span>
                    ) : (
                      // Their level against yours: a bar, not a number.
                      <span className="relative h-1.5 w-14 bg-white/10" style={{ borderRadius: 2 }}>
                        <span className="absolute inset-y-0 left-0" style={{ width: `${level}%`, background: c.strength > overall + 4 ? "#f87171" : c.strength < overall - 4 ? "#34d399" : "#fbbf24", borderRadius: 2 }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {block.ok ? (
              <PressButton
                variant="primary"
                onClick={() => { setAllYes(false); setShowNo(false); onAsk(league, picked ?? undefined); }}
                className="mt-3 w-full py-3 normal-case"
              >
                {picked ? `Ask ${picked} (manager −${ASK_CLUB_BOSS_COST})` : `Ask every club (manager −${ASK_LEAGUE_BOSS_COST})`}
              </PressButton>
            ) : (
              <div className="kit-card mt-3 p-3 text-center text-[12px] font-black text-white" data-transfer-blocked>
                {block.why === "asked-this-week" ? "You've asked this week. Try again next week." : "You need a club first."}
              </div>
            )}
          </>
        )}

        <PressButton variant="secondary" onClick={onBack} className="mt-3 w-full py-3 normal-case">
          Back
        </PressButton>
      </div>
    </Screen>
  );
}

function YesCard({ career, reply, onAccept, onTalk }: {
  career: CareerState; reply: ClubReply;
  onAccept: (o: TransferOffer) => void; onTalk: (o: TransferOffer) => void;
}) {
  const o = reply.offer!;
  const glow = clubTheme(o.club).glow;
  return (
    <div className="kit-card kit-rise p-3" style={{ ["--kit-glow" as string]: glow } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <ClubBadge club={o.club} size={28} />
          <span className="truncate text-base font-black text-white">{o.club}</span>
        </span>
        <span className="shrink-0 bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200" style={{ borderRadius: 2 }}>
          {reply.role}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-bold text-white">“{reply.message}”</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Cell label="Wage /wk" value={wageText(o.wage)} tone={o.wage > career.contract.wage ? "up" : o.wage < career.contract.wage ? "down" : undefined} />
        <Cell label="Signing" value={wageText(o.signingFee)} />
        <Cell label="Years" value={`${o.seasons}`} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <PressButton variant="secondary" size="sm" onClick={() => onTalk(o)} className="normal-case">Talk terms</PressButton>
        <PressButton variant="primary" size="sm" onClick={() => onAccept(o)} className="normal-case">Agree</PressButton>
      </div>
    </div>
  );
}

function AgreedCard({ career, offer, onCallOff, onJoinNow }: {
  career: CareerState; offer: TransferOffer; onCallOff: () => void; onJoinNow?: () => void;
}) {
  const now = canMoveNow(career) && !!onJoinNow;
  return (
    <div className="kit-card mt-3 p-4" data-transfer-agreed>
      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Deal agreed</div>
      <div className="mt-1 flex items-center gap-2">
        <ClubBadge club={offer.club} size={32} />
        <span className="truncate text-lg font-black text-white">{offer.club}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Cell label="Wage /wk" value={wageText(offer.wage)} tone={offer.wage > career.contract.wage ? "up" : offer.wage < career.contract.wage ? "down" : undefined} />
        <Cell label="Signing" value={wageText(offer.signingFee)} />
        <Cell label="Years" value={`${offer.seasons}`} />
      </div>
      <p className="mt-2 text-[12px] font-bold text-white">
        {now ? "The January window is open. Join them now, or wait for the summer."
          : januaryAhead(career) ? "You can join in the January window."
          : "You sign when the season ends."}
      </p>
      {now && (
        <PressButton variant="primary" onClick={onJoinNow} className="mt-2 w-full py-3 normal-case" data-transfer-join-now>
          Join {offer.club} now
        </PressButton>
      )}
      <PressButton variant="danger" size="sm" onClick={onCallOff} className="mt-2 w-full normal-case">Call it off</PressButton>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="kit-row rounded-lg py-1.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white">{label}</div>
      <div className={`text-sm font-black ${tone === "up" ? "text-emerald-300" : tone === "down" ? "text-red-300" : "text-white"}`}>{value}</div>
    </div>
  );
}
