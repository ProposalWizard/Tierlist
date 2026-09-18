"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { actionsLeft } from "@/lib/star/week";
import { formatMoney } from "@/lib/star/money";
import {
  spendOn, endFreeAgentWeek, grantTrial, trialDue, WEEKS_BETWEEN_TRIALS,
  GARDEN_GYM_CAP, FREE_AGENT_WEEKLY_PAY, type LeisureAction,
} from "@/lib/star/freeAgent";
import { nextStage, STAGE_LABEL, trialScore, trialComplete } from "@/lib/star/trial";

/**
 * THE DASHBOARD FOR A CAREER NOBODY HAS SIGNED.
 *
 * Specified directly: "cut down dashboard, home, video games, gym, social".
 *
 * The omissions are the design. There is no League, no Play, no squad, no team
 * sheet, no manager, no transfer window and no contract screen, because a
 * player with no club has nothing to put on any of them — and a row of greyed
 * out buttons would be a worse lie than an honest four.
 *
 * It is a separate shell rather than the real dashboard with things hidden,
 * for the same reason the five-a-side is a separate screen: the club dashboard
 * is about a club, every part of it assumes one, and teaching it to pretend
 * otherwise would put an "unless they have no club" guard on every future
 * feature.
 */

type Tab = "home" | "games" | "gym" | "social";

export interface FreeAgentShellProps {
  career: CareerState;
  onCareer: (next: CareerState) => void;
  /** Go and play the trial you have been offered. */
  onTrial?: () => void;
  onSettings: () => void;
}

export default function FreeAgentShell({
  career, onCareer, onTrial, onSettings,
}: FreeAgentShellProps) {
  const [tab, setTab] = useState<Tab>("home");
  const [note, setNote] = useState<string>("");

  const left = actionsLeft(career);
  const trial = career.trial;
  const stage = trial ? nextStage(trial) : null;
  const finished = trial ? trialComplete(trial) : false;

  const act = (what: LeisureAction) => {
    const res = spendOn(career, what);
    onCareer(res.career);
    setNote(res.note);
  };

  const name = `${career.player.firstName} ${career.player.lastName}`;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col px-4 py-4 text-white">
      {/* Who you are. Deliberately no club, no star bar, no next match — the
          three things this header would normally lead with. */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-black leading-tight">{name}</div>
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-300">
            Free agent
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
        <Stat label="This week" value={`${left} left`} />
        <Stat label="Happiness" value={`${Math.round(career.happiness)}`} />
      </div>

      <div className="mt-4 flex-1">
        {tab === "home" && (
          <div className="space-y-3">
            {trial && !finished && (
              <Panel title={stage ? `Trial — up next: ${STAGE_LABEL[stage]}` : "Trial"}>
                <p className="text-[12px] font-bold text-white/70">
                  Somebody is watching. Finish it.
                </p>
                {onTrial && (
                  <button
                    onClick={onTrial}
                    className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-400"
                  >
                    Go to the trial →
                  </button>
                )}
              </Panel>
            )}

            {/* ── The way back ──
                A failed trial used to be a permanent dead end: startTrial was
                called in exactly one place in the whole game, career creation,
                so a player nobody wanted could never reach a club again by any
                path — while this very screen told him "now you wait" for
                something that did not exist. */}
            {trial && finished && (
              <Panel title="Your last trial">
                <div className="text-4xl font-black tabular-nums">{trialScore(trial)}</div>
                {trialDue(career) ? (
                  <>
                    <p className="mt-2 text-[12px] font-bold leading-relaxed text-emerald-300">
                      A club down the leagues wants a look at you. Lower bar,
                      same afternoon.
                    </p>
                    <button
                      onClick={() => { onCareer(grantTrial(career)); setNote("They want you in on Tuesday."); }}
                      className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-400"
                    >
                      Take the trial →
                    </button>
                  </>
                ) : (
                  <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/60">
                    out of 100. Nothing this week — keep yourself right.
                    Somebody usually comes looking within a month.
                    <span className="mt-1 block text-white/40">
                      {Math.max(0, WEEKS_BETWEEN_TRIALS - (career.weeksSinceTrial ?? 0))} week(s) to go
                    </span>
                  </p>
                )}
              </Panel>
            )}

            <Panel title="Where you are">
              <p className="text-[12px] font-bold leading-relaxed text-white/70">
                No club, no contract. {formatMoney(FREE_AGENT_WEEKLY_PAY)} a week comes in and that
                is all of it. Train in the garden, keep yourself right, and wait
                for somebody to give you a look.
              </p>
            </Panel>
          </div>
        )}

        {tab === "gym" && (
          <Panel title="The garden gym">
            <p className="text-[12px] font-bold leading-relaxed text-white/70">
              Weights and a wall. It will get you fit and it will get you sharp,
              but only so far — nobody is coaching you, and there is a ceiling
              at {GARDEN_GYM_CAP} on what you can reach on your own.
            </p>
            <Bar label="Power" value={career.skills.power} cap={GARDEN_GYM_CAP} />
            <Bar label="Technique" value={career.skills.technique} cap={GARDEN_GYM_CAP} />
            <Do label="Train" disabled={left <= 0} onClick={() => act("gym")} />
          </Panel>
        )}

        {tab === "games" && (
          <Panel title="Video games">
            <p className="text-[12px] font-bold leading-relaxed text-white/70">
              Costs you nothing but the afternoon.
            </p>
            <Do label="Play" disabled={left <= 0} onClick={() => act("games")} />
          </Panel>
        )}

        {tab === "social" && (
          <Panel title="Out with your mates">
            <p className="text-[12px] font-bold leading-relaxed text-white/70">
              Does you more good than the console. Costs a bit more too.
            </p>
            <Do label="Go out" disabled={left <= 0} onClick={() => act("social")} />
          </Panel>
        )}

        {note && (
          <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-[12px] font-bold text-white/70">
            {note}
          </div>
        )}
        {/* ── The week has to be able to end ──
            A free agent has no fixtures, and a week normally rolls over when
            one is settled. Without this button the screen said "that is the
            week gone" and stayed that way forever: three actions and the
            career was over. Found in review. It is also the only thing that
            ever pays the ★10 — it was displayed here and credited by nothing. */}
        {left <= 0 && (
          <div className="mt-3 rounded-xl bg-amber-500/15 p-3">
            <div className="text-[12px] font-bold text-amber-200">That is the week gone.</div>
            <button
              onClick={() => {
                onCareer(endFreeAgentWeek(career));
                setNote(`A new week. ${formatMoney(FREE_AGENT_WEEKLY_PAY)} in.`);
              }}
              className="mt-2 w-full rounded-lg bg-amber-400 py-2.5 text-[12px] font-black uppercase tracking-widest text-amber-950 hover:bg-amber-300"
            >
              Next week →
            </button>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-4 flex gap-1 rounded-xl bg-black/70 p-1 backdrop-blur">
        <Nav label="Home" icon="🏠" active={tab === "home"} onClick={() => setTab("home")} />
        <Nav label="Gym" icon="🏋️" active={tab === "gym"} onClick={() => setTab("gym")} />
        <Nav label="Games" icon="🎮" active={tab === "games"} onClick={() => setTab("games")} />
        <Nav label="Social" icon="🍻" active={tab === "social"} onClick={() => setTab("social")} />
        {/* No Exit to the club dashboard — this career has no club, and that
            screen has nothing to show it. Settings is reachable from the
            header; there is nowhere else to be. */}
        <Nav label="Week" icon="📅" active={false} onClick={() => { onCareer(endFreeAgentWeek(career)); setNote("A new week."); }} />
      </div>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-white/60">{title}</div>
      {children}
    </div>
  );
}

function Bar({ label, value, cap }: { label: string; value: number; cap: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/50">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
        {/* Where the garden runs out — shown rather than discovered by grinding. */}
        <div className="absolute inset-y-0 w-px bg-amber-300/80" style={{ left: `${cap}%` }} />
      </div>
    </div>
  );
}

function Do({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`mt-4 w-full rounded-xl py-3 text-sm font-black uppercase tracking-widest ${
        disabled ? "bg-white/10 text-white/40" : "bg-emerald-500 text-white hover:bg-emerald-400"
      }`}
    >
      {label}
    </button>
  );
}

function Nav({ label, icon, active, onClick }: {
  label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center rounded-lg py-2 text-[9px] font-black uppercase tracking-widest ${
        active ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="mt-1">{label}</span>
    </button>
  );
}
