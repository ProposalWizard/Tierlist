"use client";
import type { CareerState, Skills } from "@/lib/star/types";
import { actionsLeft } from "@/lib/star/week";
import { formatMoney } from "@/lib/star/money";
import { leagueNameFor } from "@/lib/star/calendar";
import {
  placementLabel, youthAbility, youthLevelFor, readyForPromotion,
  PROMOTION_AT,
} from "@/lib/star/youth";

/**
 * THE YOUTH TEAM.
 *
 * What a week here is made of, on one screen: the first team playing without
 * you, your own youth fixture, the three days of the week you can spend on
 * anything, and — the only thing that actually matters — how close the
 * manager is to taking you up.
 *
 * The meter is deliberately the biggest thing on the page. A youth spell
 * with no visible way out is the free-agent limbo with a better badge on it,
 * which is the exact thing this whole feature replaces.
 *
 * It is not the club dashboard with bits hidden, for the same reason
 * FreeAgentShell is not: the club dashboard is about being in a team, every
 * part of it assumes you are picked, and teaching it to pretend otherwise
 * would put an "unless he is in the youth team" guard on every future
 * feature.
 */
export default function YouthTeam({
  career, seasonOver, onPlayWeek, onTrain, onRest, onPromote, onLeague, onSettings,
}: {
  career: CareerState;
  /** Every one of the club's fixtures is played — there is no week left to
   *  be left out of, and the button becomes the way into the close season
   *  rather than into another youth match. */
  seasonOver?: boolean;
  /** Play this week's youth match — which also plays the first team's
   *  fixture without you and rolls the week over. */
  onPlayWeek: () => void;
  onTrain: (skill: keyof Skills) => void;
  onRest: () => void;
  /** Only offered once the meter is full. */
  onPromote: () => void;
  onLeague: () => void;
  onSettings: () => void;
}) {
  const p = career.placement;
  if (!p) return null;

  const left = actionsLeft(career);
  const ability = youthAbility(career.skills);
  const level = youthLevelFor(p.division);
  const ready = readyForPromotion(career);
  const last = p.last;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col px-4 py-4 text-white">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-black leading-tight">
            {career.player.firstName} {career.player.lastName}
          </div>
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-300">
            {placementLabel(career)} · {p.club}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
            {leagueNameFor(p.division)}
          </div>
        </div>
        <button
          onClick={onSettings}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-white/20"
        >
          Settings
        </button>
      </div>

      <div className="mt-3 flex gap-2 text-center">
        <Stat label="In the bank" value={formatMoney(career.money)} />
        <Stat label="Wage" value={`${formatMoney(career.contract.wage)}/wk`} />
        <Stat label="This week" value={`${left} left`} />
      </div>

      {/* ── How you got here ──
          Only on the way in, and it matters most for a form collapse: being
          dropped happens on the post-match screen, which belongs to
          everybody and says nothing about the youth team, so without this
          the first a player knows of it is a different screen with no
          explanation on it. */}
      {p.apps === 0 && (
        <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-300">
            {p.reason === "form" ? "You have been dropped" : "Where you have ended up"}
          </div>
          <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/80">
            {p.reason === "form"
              ? `The manager has stopped picking you altogether. You are training with ${p.club}'s kids until you give him a reason not to.`
              : `Nobody put a professional contract in front of you. ${p.club} took you into their youth team instead — which is a club, a coach and a way in.`}
          </p>
        </div>
      )}

      {/* ── The only thing that matters ── */}
      <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
            Getting into the first team
          </div>
          <div className="text-sm font-black tabular-nums">
            {Math.round(p.progress)}/{PROMOTION_AT}
          </div>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }}
          />
        </div>
        {ready ? (
          <>
            <p className="mt-3 text-[12px] font-bold leading-relaxed text-emerald-200">
              The manager has seen enough. He wants you training with the
              first team from Monday.
            </p>
            <button
              onClick={onPromote}
              className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-400"
            >
              Go up →
            </button>
          </>
        ) : (
          <p className="mt-3 text-[12px] font-bold leading-relaxed text-white/70">
            Play well and it moves. Play badly and it goes back. There is no
            other way out of here.
          </p>
        )}
      </div>

      {/* ── Where you stand against the football you are playing ── */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] font-black uppercase tracking-widest text-white/60">
          You against this level
        </div>
        <Gauge label="You" value={ability} tone="bg-sky-400" />
        <Gauge label={`${p.club} youth football`} value={level} tone="bg-white/40" />
        <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/60">
          {ability >= level + 8
            ? "You are too good for this. Go and prove it every week and they cannot keep you here."
            : ability >= level
              ? "You can hold your own here. Small margins now."
              : "You are behind this standard. Training is not optional."}
        </p>
      </div>

      {/* ── Last week ── */}
      {last && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-black uppercase tracking-widest text-white/60">
              Last youth match
            </div>
            <div className="text-sm font-black tabular-nums">
              {last.scored}–{last.conceded}
            </div>
          </div>
          <div className="mt-1 flex gap-3 text-[12px] font-black tabular-nums">
            <span>{last.goals} goal{last.goals === 1 ? "" : "s"}</span>
            <span>{last.assists} assist{last.assists === 1 ? "" : "s"}</span>
            <span className={last.rating >= 7 ? "text-emerald-300" : last.rating < 6 ? "text-red-300" : ""}>
              {last.rating.toFixed(1)}
            </span>
            <span className={last.progressDelta >= 0 ? "text-emerald-300" : "text-red-300"}>
              {last.progressDelta >= 0 ? "+" : ""}{last.progressDelta}
            </span>
          </div>
          <p className="mt-2 text-[12px] font-bold italic leading-relaxed text-white/70">
            “{last.verdict}”
          </p>
        </div>
      )}

      <div className="mt-3 text-[11px] font-black uppercase tracking-widest text-white/50">
        This spell: {p.apps} app{p.apps === 1 ? "" : "s"}, {p.goals} goal{p.goals === 1 ? "" : "s"}, {p.assists} assist{p.assists === 1 ? "" : "s"}
      </div>

      {/* ── The week ── */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] font-black uppercase tracking-widest text-white/60">
          The week
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Small label="Train pace" disabled={left <= 0} onClick={() => onTrain("pace")} />
          <Small label="Train power" disabled={left <= 0} onClick={() => onTrain("power")} />
          <Small label="Train technique" disabled={left <= 0} onClick={() => onTrain("technique")} />
          <Small label="Train vision" disabled={left <= 0} onClick={() => onTrain("vision")} />
          <Small label="Free kicks" disabled={left <= 0} onClick={() => onTrain("freeKick")} />
          <Small label="Rest" disabled={left <= 0} onClick={onRest} />
        </div>
        <button
          onClick={onPlayWeek}
          className="mt-3 w-full rounded-xl bg-amber-400 py-3 text-sm font-black uppercase tracking-widest text-amber-950 hover:bg-amber-300"
        >
          {seasonOver ? "The season is over →" : "Play the youth match →"}
        </button>
        <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/50">
          {seasonOver
            ? "Nothing left to play. The season ends for you the same week it ends for the first team."
            : "The first team play their fixture on Saturday whether you are in it or not. You play yours."}
        </p>
      </div>

      <button
        onClick={onLeague}
        className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-[12px] font-black uppercase tracking-widest text-white/80 hover:bg-white/20"
      >
        How the first team are doing →
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-white/5 px-2 py-2">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}

function Gauge({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/50">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function Small({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg py-2.5 text-[11px] font-black uppercase tracking-widest ${
        disabled ? "bg-white/5 text-white/30" : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {label}
    </button>
  );
}
