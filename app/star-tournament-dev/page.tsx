"use client";

/**
 * TOURNAMENT TEST PAGE — draw and play a whole Euros or World Cup in seconds.
 *
 * Leo, 12 Oct 2026: "an area where everything new can be … tested and
 * simulated easily (like tournaments etc)". Every result here comes from the
 * real tournament code (lib/star/tournament.ts: the real field, draw, group
 * matches and knockouts with extra time and penalties). It reads and writes
 * nothing but this screen.
 */
import { useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Note } from "@/components/admin/broadcast/BroadcastPage";
import NationFlag from "@/components/star/NationFlag";
import "./tournament.css";
import {
  tournamentField, drawGroups, playMatchday, finishTournament, groupTable, tournamentStrength,
  type TournamentCompetition, type TournamentState,
} from "@/lib/star/tournament";
import { mulberry32 } from "@/lib/star/season";
import { clubNameSeed } from "@/lib/star/squadData";

function fresh(competition: TournamentCompetition, season: number, nation: string): TournamentState {
  const field = tournamentField(competition, season, nation);
  const groups = drawGroups(field, mulberry32(clubNameSeed(`groups|${competition}|${season}`)));
  const strengths: Record<string, number> = {};
  for (const n of field) strengths[n] = tournamentStrength(n);
  const entered = field.includes(nation);
  return { season, competition, nation, entered, selected: entered, chance: entered ? 1 : 0, strengths, groups, matchday: 0, ko: [] };
}

export default function TournamentDev() {
  const [competition, setCompetition] = useState<TournamentCompetition>("European Championship");
  const [nation, setNation] = useState("England");
  const [seed, setSeed] = useState(2);
  const start = useMemo(() => fresh(competition, seed * 2, nation), [competition, seed, nation]);
  const [state, setState] = useState<TournamentState | null>(null);
  const s = state && state.competition === competition && state.season === seed * 2 && state.nation === nation ? state : start;
  const rng = () => mulberry32(clubNameSeed(`dev|${competition}|${seed}|${s.matchday}|${s.ko.length}`));
  const stage = s.winner ? "Finished" : s.ko.length ? s.ko[s.ko.length - 1].name : s.matchday ? `After matchday ${s.matchday}` : "The draw";

  return (
    <BroadcastPage title="Tournaments" sub="The real tournament code: draw, groups, knockouts with extra time and penalties. Nothing is saved.">
      <div className="tn" data-tournament-dev>
        <Panel title="Set up" note={stage}>
          <div className="tn-controls">
            <select className="tn-field" value={competition} onChange={e => { setCompetition(e.target.value as TournamentCompetition); setState(null); }} aria-label="Tournament">
              <option>European Championship</option><option>World Cup</option>
            </select>
            <label className="tn-nation">
              <NationFlag nation={nation} width={30} />
              <input className="tn-field" value={nation} onChange={e => { setNation(e.target.value); setState(null); }} aria-label="Your nation" />
            </label>
            <Btn onClick={() => { setSeed(x => x + 1); setState(null); }}>New draw</Btn>
          </div>
          <div className="tn-controls">
            <Btn disabled={s.matchday >= 3} onClick={() => setState(playMatchday(s, s.matchday + 1, rng()))}>Play matchday {Math.min(3, s.matchday + 1)}</Btn>
            <Btn main onClick={() => setState(finishTournament(s, rng()))}>Play to the final</Btn>
            <Btn onClick={() => setState(null)}>Reset</Btn>
          </div>
          {!s.entered && <p className="tn-warn">{nation} did not qualify for this one.</p>}
        </Panel>

        {s.winner && (
          <div className="tn-hero" data-winner>
            <NationFlag nation={s.winner} width={110} rounded={4} />
            <div><div className="tn-hero-k">🏆 Winners</div><h2>{s.winner} win the {competition}</h2></div>
          </div>
        )}

        <Panel title="Groups" note={`after matchday ${s.matchday}`}>
          <div className="tn-groups">
            {s.groups.map(g => (
              <div key={g.name} className="tn-table">
                <div className="tn-tr tn-th"><span>Group {g.name}</span><span>P</span><span>GD</span><span>Pts</span></div>
                {groupTable(g).map((r, i) => (
                  <div key={r.name} className="tn-tr" data-me={r.name === nation ? "true" : undefined} data-through={i < 2 ? "true" : undefined}>
                    <span className="tn-team"><NationFlag nation={r.name} width={18} /> {r.name}</span><span>{r.p}</span><span>{r.gf - r.ga}</span><b>{r.pts}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>

        {s.ko.length > 0 && (
          <Panel title="Knockouts">
            <div className="tn-bracket">
              {s.ko.map(round => (
                <div key={round.name} className="tn-round">
                  <div className="bc-label">{round.name}</div>
                  {round.ties.map((t, i) => {
                    const hw = t.hs != null && t.as != null && (t.hs > t.as || (t.hs === t.as && !!t.pens && t.pens.home > t.pens.away));
                    return (
                      <div key={i} className="tn-tie" data-me={t.home === nation || t.away === nation ? "true" : undefined}>
                        <div className="tn-side" data-won={hw ? "true" : undefined}><NationFlag nation={t.home} width={18} /><span>{t.home}</span><b>{t.hs ?? "–"}</b></div>
                        <div className="tn-side" data-won={!hw && t.hs != null ? "true" : undefined}><NationFlag nation={t.away} width={18} /><span>{t.away}</span><b>{t.as ?? "–"}</b></div>
                        {(t.wentToExtraTime || t.pens) && <div className="tn-extra">{t.wentToExtraTime ? "after extra time" : ""}{t.pens ? ` · pens ${t.pens.home}–${t.pens.away}` : ""}</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Panel>
        )}
        {s.ko.length === 0 && <Note>The knockouts show here once the groups are played.</Note>}
      </div>
      <PageGuide page="/star-tournament-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
