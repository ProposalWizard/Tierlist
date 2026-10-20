"use client";

/**
 * A DOMESTIC CUP'S OWN SCREEN — the FA Cup, the League Cup and the Lower
 * League Trophy (Harry, 20 Oct 2026: "the Lower League Trophy needs its own
 * screen like Mikey's FA Cup one (and the international ones)").
 *
 * Built from the parts the cups already show after a match, never a copy:
 *   - the results board and the "Road to the Final" bracket are Mikey's
 *     (KnockoutRoundup.tsx, 8 Oct 2026), drawn still here;
 *   - "The draw" replays the latest round's draw (CupDrawReveal.tsx);
 *   - your road through the rounds, like the summer tournament's knockout
 *     road (TournamentScreen.tsx).
 * Reached from League → Table → the cup's tab → "Open". Reads
 * lib/star/cupView.ts; decides nothing.
 */
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import { cupStrength, type CupId } from "@/lib/star/cups";
import { cupBoard, cupBracket } from "@/lib/star/knockoutView";
import { cupViewFor, roundShort, scoreText, type PathStep } from "@/lib/star/cupView";
import { divisionOf, fixtureDateLabel } from "@/lib/star/calendar";
import { competitionLook } from "@/lib/star/competitionLook";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";
import CupDrawReveal from "./CupDrawReveal";
import { Board, Bracket } from "./KnockoutRoundup";
import { CupHero, CupRoad } from "./CupSummary";
import { BarButton, BottomBar, Chev, EdgeArrows, ScreenShell } from "./ui";

function PathRow({ s, career, competition }: { s: PathStep; career: CareerState; competition: CupId }) {
  const tone = s.result === "won" ? "#86efac" : s.result === "lost" ? "#fca5a5" : "#ffffff";
  const f = s.result === null && s.kind === "tie"
    ? career.fixtures.find(x => !x.played && x.kind === "cup" && x.competition === competition && x.opponent === s.opponent)
    : undefined;
  const right = s.kind === "bye" ? "Through"
    : s.you !== undefined ? scoreText(s)
    : f ? fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career))
    : "v";
  return (
    <div data-cup-step={s.round} className="flex items-center gap-2 border-b border-white/10 py-1.5">
      <span className="w-9 shrink-0 text-[11px] font-bold uppercase text-white/70">{roundShort(s.round)}</span>
      {s.kind === "bye" ? (
        <span className="min-w-0 flex-1 text-[13px] font-bold text-white/85">Bye</span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <ClubBadge club={s.opponent ?? ""} size={20} />
          <span className="truncate text-[13px] font-bold text-white">{shortClub(s.opponent ?? "")}</span>
          <span className="shrink-0 text-[10px] font-semibold text-white/60">{s.home ? "H" : "A"}</span>
        </span>
      )}
      <span className="shrink-0 text-right text-[13px] font-bold tabular-nums" style={{ color: tone }}>{right}</span>
    </div>
  );
}

function Section({ title, right, children, ...rest }: { title: string; right?: React.ReactNode; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className="mt-4" {...rest}>
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
        <h3 className="text-[15px] uppercase tracking-wide text-white">{title}</h3>
        {right && <span className="text-[11px] font-semibold text-white/75">{right}</span>}
      </div>
      {children}
    </section>
  );
}

export default function CupScreen({ career, competition, hud, onBack, onPlay }: {
  career: CareerState;
  competition: CupId;
  /** The top HUD, so energy never leaves. */
  hud?: React.ReactNode;
  onBack: () => void;
  /** The bottom bar's Play (your next match, any competition). */
  onPlay?: () => void;
}) {
  const state = (career.cupState ?? []).find(s => s.competition === competition);
  const view = useMemo(() => (state ? cupViewFor(career, state) : null), [career, state]);
  const [selected, setSelected] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  // Opened from part-way down the League page: start at the top.
  useEffect(() => { window.scrollTo(0, 0); }, [watching]);
  const look = competitionLook(competition);
  const you = career.player.club;

  if (!state || !view || state.rounds.length === 0) {
    return (
      <ScreenShell glow={look.glow} title={competition} onBack={onBack} hud={hud}>
        <div className="py-10 text-center text-[14px] font-bold text-white">Not drawn yet this season.</div>
      </ScreenShell>
    );
  }

  const latest = state.rounds[state.rounds.length - 1];
  if (watching) {
    return (
      <CupDrawReveal
        competition={competition}
        round={{ name: latest.name, ties: latest.ties.map(t => ({ home: t.home, away: t.away })) }}
        yourClub={you}
        onContinue={() => setWatching(false)}
      />
    );
  }

  const shown = Math.min(selected ?? view.current, state.rounds.length - 1);
  const round = state.rounds[shown];
  const ties = cupBoard(state, shown, you, (c) => cupStrength(c, career.league));
  const bracket = view.bracketFrom !== null ? cupBracket(state, view.bracketFrom, you) : null;
  const played = round.ties.length > 0 && round.ties.every(t => t.hs !== undefined);
  const roundNote = `${round.ties.length} ${round.ties.length === 1 ? "tie" : "ties"} · ${played ? "played" : "to play"}`;
  const big = view.left.length > 40;

  return (
    <ScreenShell
      bare
      glow={look.glow}
      title={competition}
      hud={hud}
      bottomBar={
        <BottomBar cols="1fr 1fr 1fr">
          <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onBack} />
          <BarButton icon="🎱" label="The draw" onClick={() => setWatching(true)} disabled={!!state.winner || latest.ties.length === 0} ariaLabel="Watch the draw" />
          <BarButton primary icon="▶" label="Play" onClick={onPlay ?? onBack} disabled={!onPlay} />
        </BottomBar>
      }
    >
      <div data-cup-screen={competition}>
        <div className="-mx-3">
          <CupHero career={career} view={view}>
            <div className="px-3 pb-3 pt-4"><CupRoad view={view} /></div>
          </CupHero>
        </div>

        {view.path.length > 0 && (
          <Section title="Your road" data-cup-path>
            {view.path.map(s => <PathRow key={s.round} s={s} career={career} competition={competition} />)}
          </Section>
        )}

        {bracket && (
          <Section title="Road to the Final" data-cup-bracket>
            <div className="-mx-1"><Bracket view={{ ...bracket, animate: null }} you={you} step={9} /></div>
          </Section>
        )}

        <Section title="Every round" right={roundNote} data-cup-rounds>
          {/* Flip between the rounds drawn so far, the League's edge arrows. */}
          <EdgeArrows
            prev={shown > 0 ? { label: roundShort(state.rounds[shown - 1].name), onClick: () => setSelected(shown - 1) } : undefined}
            next={shown < state.rounds.length - 1 ? { label: roundShort(state.rounds[shown + 1].name), onClick: () => setSelected(shown + 1) } : undefined}
          >
            <span data-cup-round-shown={round.name}>{round.name}</span>
          </EdgeArrows>
          <div className="-mx-2 mt-2"><Board ties={ties} still /></div>
          {round.byes && round.byes.length > 0 && (
            <div data-cup-byes className="mt-1 px-0.5 text-[12px] font-semibold leading-snug text-white/90">
              <span className="font-bold text-emerald-300">Byes ({round.byes.length}) · </span>
              {round.byes.map(shortClub).join(" · ")}
            </div>
          )}
        </Section>

        {!state.winner && (
          <Section title="Still in it" right={`${view.left.length} clubs`} data-cup-left>
            <div className="flex flex-wrap gap-1.5">
              {view.left.map(c => (
                <span key={c} title={c} className="rounded-full" style={c === you ? { boxShadow: "0 0 0 2px #facc15, 0 0 8px rgba(250,204,21,.7)" } : undefined}>
                  <ClubBadge club={c} size={big ? 20 : 26} />
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </ScreenShell>
  );
}
