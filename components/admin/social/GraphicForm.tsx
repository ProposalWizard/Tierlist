"use client";
/**
 * One form per picture the feed can draw (GraphicSpec, lib/star/media/types.ts),
 * plus "Edit as text" for anything the form doesn't cover.
 */
import { useEffect, useState } from "react";
import type { GraphicRow, GraphicSpec, GotmEntry, PotmNominee, TotwSlot } from "@/lib/star/media/types";
import type { SynthGoal as SynthGoalLike } from "@/lib/star/goalClip/synth";
import { Check, Field, Num, RowsEditor, Select, Text } from "./kit";
import { listClips, type ClipListing } from "@/lib/star/goalClip/store";

const lines = (s: string) => s.split(/\n|,/).map(x => x.trim()).filter(Boolean);
const KINDS = ["run_in", "header", "long_range", "tap_in", "penalty"] as const;
export const STYLES = [
  { value: "", label: "The poster's own" },
  { value: "broadcast", label: "Broadcast (TV + replays)" },
  { value: "reverse", label: "Reverse angle" },
  { value: "fan", label: "Fan in the stand" },
  { value: "tiktok", label: "TikTok edit" },
] as const;

function Rows({ rows, onChange }: { rows: GraphicRow[]; onChange: (r: GraphicRow[]) => void }) {
  return (
    <RowsEditor<GraphicRow> rows={rows} onChange={onChange} blank={() => ({ label: "Goals", value: "1" })}
      render={(r, set) => (<>
        <Text value={r.label} onChange={label => set({ ...r, label })} placeholder="Label" />
        <Text value={r.value} onChange={value => set({ ...r, value })} placeholder="Value" />
        <span style={{ flex: "0 0 auto" }}><Check value={!!r.highlight} onChange={highlight => set({ ...r, highlight })} label="Bold" /></span>
      </>)} />
  );
}

export function SynthEditor({ goals, onChange }: { goals: SynthGoalLike[]; onChange: (g: SynthGoalLike[]) => void }) {
  return (
    <RowsEditor<SynthGoalLike> rows={goals} onChange={onChange} addLabel="+ Add a made-up goal"
      blank={() => ({ home: goals[0]?.home ?? "Home", away: goals[0]?.away ?? "Away", scorer: goals[0]?.scorer ?? "Scorer", scorerShort: (goals[0]?.scorer ?? "Scorer").split(" ").slice(-1)[0], scorerHome: true, minute: 70, seed: `g${Date.now() % 100000}` })}
      render={(g, set) => (
        <div className="ss-grid3" style={{ padding: 8, border: "1px solid var(--bc-line)", borderRadius: 6 }}>
          <Field label="Home"><Text value={g.home} onChange={home => set({ ...g, home })} /></Field>
          <Field label="Away"><Text value={g.away} onChange={away => set({ ...g, away })} /></Field>
          <Field label="Scorer"><Text value={g.scorer} onChange={scorer => set({ ...g, scorer, scorerShort: scorer.split(" ").slice(-1)[0] })} /></Field>
          <Field label="Scored for"><Select value={g.scorerHome ? "home" : "away"} onChange={v => set({ ...g, scorerHome: v === "home" })} options={[{ value: "home", label: "Home side" }, { value: "away", label: "Away side" }]} /></Field>
          <Field label="Minute"><Num value={g.minute} min={1} max={120} onChange={minute => set({ ...g, minute })} /></Field>
          <Field label="Kind of goal"><Select value={g.kind ?? ""} onChange={k => set({ ...g, kind: (k || undefined) as SynthGoalLike["kind"] })} options={[{ value: "", label: "Random" }, ...KINDS.map(k => ({ value: k, label: k.replace("_", " ") }))]} /></Field>
          <Field label="Seed (same seed = same goal)"><span className="ss-row" style={{ flexWrap: "nowrap" }}><Text mono value={g.seed} onChange={seed => set({ ...g, seed })} /><button type="button" className="bc-btn" title="A new goal" onClick={() => set({ ...g, seed: Math.random().toString(36).slice(2, 8) })}>🎲</button></span></Field>
          <Field label="Score after (home-away)"><Text value={g.scoreAfter ? `${g.scoreAfter[0]}-${g.scoreAfter[1]}` : ""} placeholder="1-0" onChange={v => { const m = v.match(/(\d+)\s*-\s*(\d+)/); set({ ...g, scoreAfter: m ? [Number(m[1]), Number(m[2])] : undefined }); }} /></Field>
        </div>
      )} />
  );
}

export function ClipPicker({ chosen, onChange }: { chosen: string[]; onChange: (ids: string[]) => void }) {
  const [clips, setClips] = useState<ClipListing[] | null>(null);
  useEffect(() => { listClips().then(setClips).catch(() => setClips([])); }, []);
  if (!clips) return <div className="ss-sub">Looking for recorded goals on this device…</div>;
  if (!clips.length) return <div className="ss-sub">No recorded goals on this device. Play a match in the game (goals you see are recorded), or use made-up goals.</div>;
  return (
    <div className="ss-col" style={{ maxHeight: 220, overflowY: "auto" }}>
      {clips.map(c => (
        <Check key={c.id} value={chosen.includes(c.id)} label={`${c.scorer} ${c.minuteLabel}' · ${c.home} v ${c.away}${c.how ? ` · ${c.how.replace("_", " ")}` : ""}`}
          onChange={on => onChange(on ? [...chosen, c.id] : chosen.filter(x => x !== c.id))} />
      ))}
    </div>
  );
}

export default function GraphicForm({ spec, onChange }: { spec: GraphicSpec; onChange: (s: GraphicSpec) => void }) {
  const [asText, setAsText] = useState(false);
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);
  // Filled when "Edit as text" is ticked, not on every change (that would undo your typing).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (asText) { setDraft(JSON.stringify(spec, null, 2)); setBad(false); } }, [asText]);

  const body = (() => {
    const s = spec;
    switch (s.type) {
      case "scoreline": return (
        <div className="ss-grid2">
          <Field label="Home"><Text value={s.home} onChange={home => onChange({ ...s, home })} /></Field>
          <Field label="Away"><Text value={s.away} onChange={away => onChange({ ...s, away })} /></Field>
          <Field label="Home goals"><Num value={s.hs} min={0} onChange={hs => onChange({ ...s, hs })} /></Field>
          <Field label="Away goals"><Num value={s.as} min={0} onChange={as => onChange({ ...s, as })} /></Field>
          <Field label="Competition" wide><Text value={s.competition} onChange={competition => onChange({ ...s, competition })} /></Field>
          <Field label="Home scorers (one per line)"><textarea className="ss-text" value={(s.homeScorers ?? s.scorers ?? []).join("\n")} onChange={e => onChange({ ...s, homeScorers: lines(e.target.value), scorers: undefined })} /></Field>
          <Field label="Away scorers (one per line)"><textarea className="ss-text" value={(s.awayScorers ?? []).join("\n")} onChange={e => onChange({ ...s, awayScorers: lines(e.target.value) })} /></Field>
        </div>
      );
      case "breaking": return (
        <div className="ss-grid2">
          <Field label="Strapline"><Text value={s.strapline} onChange={strapline => onChange({ ...s, strapline })} /></Field>
          <Field label="Headline" wide><Text value={s.headline} onChange={headline => onChange({ ...s, headline })} /></Field>
        </div>
      );
      case "playerCard": return (
        <div className="ss-col">
          <div className="ss-grid3">
            <Field label="Name"><Text value={s.name} onChange={name => onChange({ ...s, name })} /></Field>
            <Field label="Number"><Num value={s.number} onChange={number => onChange({ ...s, number })} /></Field>
            <Field label="Position"><Text value={s.position} onChange={position => onChange({ ...s, position })} /></Field>
            <Field label="Rating"><Num value={s.rating} step={0.1} onChange={rating => onChange({ ...s, rating })} /></Field>
            <Field label="From (e.g. v Spurs (H))"><Text value={s.context ?? ""} onChange={context => onChange({ ...s, context: context || undefined })} /></Field>
          </div>
          <Rows rows={s.rows} onChange={rows => onChange({ ...s, rows })} />
        </div>
      );
      case "statLine": return (
        <div className="ss-col">
          <div className="ss-grid2">
            <Field label="Title"><Text value={s.title} onChange={title => onChange({ ...s, title })} /></Field>
            <Field label="From"><Text value={s.context ?? ""} onChange={context => onChange({ ...s, context: context || undefined })} /></Field>
          </div>
          <Rows rows={s.rows} onChange={rows => onChange({ ...s, rows })} />
        </div>
      );
      case "tableSnippet": return (
        <div className="ss-col">
          <Field label="Club to light up"><Text value={s.highlight} onChange={highlight => onChange({ ...s, highlight })} /></Field>
          <RowsEditor rows={s.rows} onChange={rows => onChange({ ...s, rows })} blank={() => ({ pos: s.rows.length + 1, name: "Club", played: 10, gd: 0, points: 10 })}
            render={(r, set) => (<>
              <Num value={r.pos} onChange={pos => set({ ...r, pos })} />
              <span style={{ flex: 3 }}><Text value={r.name} onChange={name => set({ ...r, name })} /></span>
              <Num value={r.played} onChange={played => set({ ...r, played })} />
              <Num value={r.gd} onChange={gd => set({ ...r, gd })} />
              <Num value={r.points} onChange={points => set({ ...r, points })} />
            </>)} />
          <div className="ss-sub">Columns: place · club · played · goal difference · points</div>
        </div>
      );
      case "topScorers": return (
        <div className="ss-col">
          <div className="ss-grid2">
            <Field label="Title"><Text value={s.title} onChange={title => onChange({ ...s, title })} /></Field>
            <Field label="Name to light up"><Text value={s.highlight} onChange={highlight => onChange({ ...s, highlight })} /></Field>
          </div>
          <Rows rows={s.rows} onChange={rows => onChange({ ...s, rows })} />
        </div>
      );
      case "teamOfTheWeek": return (
        <div className="ss-col">
          <Field label="Formation"><Text value={s.formation} onChange={formation => onChange({ ...s, formation })} /></Field>
          <RowsEditor<TotwSlot> rows={s.players} onChange={players => onChange({ ...s, players })} blank={() => ({ name: "Player", position: "CM", note: "", isYou: false })}
            render={(p, set) => (<>
              <span style={{ flex: 3 }}><Text value={p.name} onChange={name => set({ ...p, name })} /></span>
              <Text value={p.position} onChange={position => set({ ...p, position })} />
              <span style={{ flex: 2 }}><Text value={p.note} placeholder="note" onChange={note => set({ ...p, note })} /></span>
              <span style={{ flex: "0 0 auto" }}><Check value={p.isYou} onChange={isYou => set({ ...p, isYou })} label="You" /></span>
            </>)} />
        </div>
      );
      case "hatTrick": return (
        <div className="ss-grid2">
          <Field label="Name"><Text value={s.name} onChange={name => onChange({ ...s, name })} /></Field>
          <Field label="Minutes (comma between)"><Text value={s.minutes.join(", ")} onChange={v => onChange({ ...s, minutes: lines(v).map(Number).filter(Number.isFinite) })} /></Field>
        </div>
      );
      case "transfer": return (
        <div className="ss-grid2">
          <Field label="Player"><Text value={s.player} onChange={player => onChange({ ...s, player })} /></Field>
          <Field label="Fee"><Text value={s.fee ?? ""} onChange={fee => onChange({ ...s, fee: fee || undefined })} /></Field>
          <Field label="From"><Text value={s.from} onChange={from => onChange({ ...s, from })} /></Field>
          <Field label="To"><Text value={s.to} onChange={to => onChange({ ...s, to })} /></Field>
        </div>
      );
      case "trophy": return (
        <div className="ss-grid3">
          <Field label="Competition"><Text value={s.competition} onChange={competition => onChange({ ...s, competition })} /></Field>
          <Field label="Club"><Text value={s.club} onChange={club => onChange({ ...s, club })} /></Field>
          <Field label="Season"><Num value={s.season} onChange={season => onChange({ ...s, season })} /></Field>
        </div>
      );
      case "poll": return (
        <div className="ss-col">
          <Field label="Question"><Text value={s.question} onChange={question => onChange({ ...s, question })} /></Field>
          <RowsEditor rows={s.options.map((o, i) => ({ o, v: s.votes[i] ?? 0 }))} blank={() => ({ o: "Option", v: 10 })}
            onChange={r => onChange({ ...s, options: r.map(x => x.o), votes: r.map(x => x.v) })}
            render={(r, set) => (<>
              <span style={{ flex: 3 }}><Text value={r.o} onChange={o => set({ ...r, o })} /></span>
              <Num value={r.v} min={0} onChange={v => set({ ...r, v })} />
            </>)} />
          <div className="ss-sub">Each option and its share of the votes (the card works out the per cent).</div>
        </div>
      );
      case "potmNominees": return (
        <div className="ss-col">
          <div className="ss-grid3">
            <Field label="Month"><Text value={s.month} onChange={month => onChange({ ...s, month })} /></Field>
            <Field label="League"><Text value={s.league ?? ""} onChange={league => onChange({ ...s, league: league || undefined })} /></Field>
            <Field label="Winner (blank = vote not done)"><Text value={s.winner ?? ""} onChange={winner => onChange({ ...s, winner: winner || undefined })} /></Field>
          </div>
          <RowsEditor<PotmNominee> rows={s.nominees} onChange={nominees => onChange({ ...s, nominees })} blank={() => ({ name: "Player", club: "Club", goals: 3, assists: 1, isYou: false })}
            render={(n, set) => (<>
              <span style={{ flex: 3 }}><Text value={n.name} onChange={name => set({ ...n, name })} /></span>
              <span style={{ flex: 2 }}><Text value={n.club} onChange={club => set({ ...n, club })} /></span>
              <Num value={n.goals} onChange={goals => set({ ...n, goals })} />
              <Num value={n.assists} onChange={assists => set({ ...n, assists })} />
              <span style={{ flex: "0 0 auto" }}><Check value={n.isYou} onChange={isYou => set({ ...n, isYou })} label="You" /></span>
            </>)} />
        </div>
      );
      case "potmWinner": return (
        <div className="ss-grid3">
          <Field label="Month"><Text value={s.month} onChange={month => onChange({ ...s, month })} /></Field>
          <Field label="First name"><Text value={s.firstName} onChange={firstName => onChange({ ...s, firstName })} /></Field>
          <Field label="Last name"><Text value={s.lastName} onChange={lastName => onChange({ ...s, lastName })} /></Field>
          <Field label="Club"><Text value={s.club} onChange={club => onChange({ ...s, club })} /></Field>
          <Field label="Goals"><Num value={s.goals} onChange={goals => onChange({ ...s, goals })} /></Field>
          <Field label="Assists"><Num value={s.assists} onChange={assists => onChange({ ...s, assists })} /></Field>
          <Field label="Shirt number"><Num value={s.number ?? 9} onChange={number => onChange({ ...s, number })} /></Field>
          <Field label="Who"><Check value={s.isYou} onChange={isYou => onChange({ ...s, isYou })} label="It's you" /></Field>
        </div>
      );
      case "goalVideo": return (
        <div className="ss-col">
          <div className="ss-grid2">
            <Field label="Title on the video"><Text value={s.title} onChange={title => onChange({ ...s, title })} /></Field>
            <Field label="Style"><Select value={(s.style ?? "") as string} options={STYLES.map(x => ({ value: x.value as string, label: x.label }))} onChange={v => onChange({ ...s, style: (v || undefined) as typeof s.style })} /></Field>
            <Field label="Cut (any number; blank = the poster's own)"><Text value={s.variant === undefined ? "" : String(s.variant)} onChange={v => onChange({ ...s, variant: v === "" ? undefined : Number(v) || 0 })} /></Field>
            <Field label="Make it first"><Check value={!!s.priority} onChange={priority => onChange({ ...s, priority: priority || undefined })} label="Make this video before others" /></Field>
          </div>
          <Field label="Recorded goals on this device"><ClipPicker chosen={s.clips} onChange={clips => onChange({ ...s, clips })} /></Field>
          <Field label="Made-up goals"><SynthEditor goals={s.synth ?? []} onChange={synth => onChange({ ...s, synth: synth.length ? synth : undefined })} /></Field>
        </div>
      );
      case "thumbnail": return (
        <div className="ss-grid2">
          <Field label="Title"><Text value={s.title} onChange={title => onChange({ ...s, title })} /></Field>
          <Field label="Badge"><Text value={s.badge} onChange={badge => onChange({ ...s, badge })} /></Field>
        </div>
      );
      case "gotmPoll": return (
        <div className="ss-col">
          <div className="ss-grid3">
            <Field label="Month"><Text value={s.monthName} onChange={monthName => onChange({ ...s, monthName })} /></Field>
            <Field label="Closed"><Check value={!!s.closed} onChange={closed => onChange({ ...s, closed: closed || undefined, winner: closed ? (s.winner ?? 0) : undefined })} label="Voting finished" /></Field>
            {s.closed && <Field label="Winner (1 = first)"><Num value={(s.winner ?? 0) + 1} min={1} max={s.entries.length} onChange={w => onChange({ ...s, winner: Math.max(0, w - 1) })} /></Field>}
          </div>
          <RowsEditor<GotmEntry> rows={s.entries} blank={() => ({ scorer: "Player", scorerShort: "Player", club: "Club", isYou: false, detail: "20-yard curler", quality: 70 })}
            onChange={entries => onChange({ ...s, entries, fanVotes: entries.map((_, i) => s.fanVotes[i] ?? 20) })}
            render={(e, set, i) => (<>
              <span style={{ flex: 3 }}><Text value={e.scorer} onChange={scorer => set({ ...e, scorer, scorerShort: scorer.split(" ").slice(-1)[0] })} /></span>
              <span style={{ flex: 2 }}><Text value={e.club} onChange={club => set({ ...e, club })} /></span>
              <span style={{ flex: 3 }}><Text value={e.detail} onChange={detail => set({ ...e, detail })} /></span>
              <span title="Fans' votes"><Num value={s.fanVotes[i] ?? 0} min={0} onChange={v => onChange({ ...s, fanVotes: s.entries.map((_, k) => (k === i ? v : s.fanVotes[k] ?? 0)) })} /></span>
            </>)} />
          <div className="ss-sub">Each goal: scorer · club · what it was · fans&apos; votes. To open a poll the game closes for you after your next match, use Ideas → Goal of the Month.</div>
        </div>
      );
      default: return null;
    }
  })();

  return (
    <div className="ss-col">
      <div className="ss-row" style={{ justifyContent: "flex-end" }}>
        <Check value={asText} onChange={setAsText} label="Edit as text" />
      </div>
      {asText ? (
        <div className="ss-col">
          <textarea className="ss-text ss-mono" style={{ minHeight: 220 }} value={draft} onChange={e => {
            setDraft(e.target.value);
            try { const j = JSON.parse(e.target.value) as GraphicSpec; if (j && typeof j === "object" && "type" in j) { setBad(false); onChange(j); } else setBad(true); } catch { setBad(true); }
          }} />
          {bad && <div className="ss-sub" style={{ color: "#ff9aa5" }}>Not readable yet — the picture keeps its last good version.</div>}
        </div>
      ) : body}
    </div>
  );
}
