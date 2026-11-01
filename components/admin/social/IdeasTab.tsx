"use client";
/**
 * Ideas: make the media react to anything — a made-up match, a career
 * moment, any event, one line from one account — preview it, keep what you
 * like. Plus Goal of the Month on demand and the trends ticker.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerRecord, Facts, GotmEntry, StoredPost, Subject, Tag, Trend } from "@/lib/star/media/types";
import {
  ALL_TAGS, ARCHETYPES, MOMENT_KINDS, addPosts, authorOf, baseFacts, defaultMatchForm, defaultMoment, eventIdea, eventKinds,
  gotmEntriesFromLog, matchIdea, momentIdea, nowClock, openGotmPoll, postFromTemplate, rivalEntry, studioPostId,
  templateCatalogue, withStudio, youName, type IdeaResult, type MatchForm, type MomentKind,
} from "@/lib/star/media/studioTools";
import { MONTH_NAMES, monthOfCareer } from "@/lib/star/potm";
import { formatVolume } from "@/lib/star/media/trending";
import PostCard from "@/components/star/media/PostCard";
import { Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import { Check, Field, Num, RowsEditor, Select, Text, useStudio } from "./kit";
import type { CareerState } from "@/lib/star/types";

type Mode = "match" | "moment" | "event" | "line" | "gotm" | "trends";
type EventSpec = { id: string; subject: Subject; tags: Tag[]; importance: number; facts: Facts };

interface Preset { id: string; emoji: string; label: string; note: string; mode: Mode; match?: (c: CareerState, f: MatchForm) => MatchForm; moment?: MomentKind; event?: (c: CareerState) => EventSpec }

const PRESETS: Preset[] = [
  { id: "hat", emoji: "⚽⚽⚽", label: "Hat-trick reaction", note: "3 goals, 3-1 win", mode: "match", match: (_c, f) => ({ ...f, us: 3, them: 1, yourGoals: 3, rating: 9.3, lastGoalMinute: 78, starMan: true }) },
  { id: "late", emoji: "⏱️", label: "Last-minute winner", note: "2-1, your goal in the 90th", mode: "match", match: (_c, f) => ({ ...f, us: 2, them: 1, yourGoals: 1, lastGoalMinute: 90, rating: 8.1 }) },
  { id: "screamer", emoji: "🚀", label: "30-yard screamer", note: "1-0 from distance", mode: "match", match: (_c, f) => ({ ...f, us: 1, them: 0, yourGoals: 1, how: "long_range", distance: 31, lastGoalMinute: 64, rating: 8.4 }) },
  { id: "derby", emoji: "🔥", label: "Derby thrashing", note: "4-0 in the derby", mode: "match", match: (_c, f) => ({ ...f, derby: true, us: 4, them: 0, yourGoals: 2, yourAssists: 1, rating: 9.0 }) },
  { id: "nightmare", emoji: "😬", label: "Nightmare + hooked", note: "0-4, rating 4.6, subbed", mode: "match", match: (_c, f) => ({ ...f, us: 0, them: 4, yourGoals: 0, rating: 4.6, hooked: "form", starMan: false }) },
  { id: "assists", emoji: "🎯", label: "Assist king", note: "3 assists in a 3-0", mode: "match", match: (_c, f) => ({ ...f, us: 3, them: 0, yourGoals: 0, yourAssists: 3, rating: 8.7 }) },
  { id: "final", emoji: "🏆", label: "Cup final winner", note: "FA Cup final, 2-1", mode: "match", match: (_c, f) => ({ ...f, kind: "cup", competition: "FA Cup", round: "Final", us: 2, them: 1, yourGoals: 1, lastGoalMinute: 84 }) },
  { id: "rumour", emoji: "👀", label: "Transfer rumour", note: "the insiders start talking", mode: "event", event: c => ({ id: "transfer-rumour", subject: { kind: "you", name: youName(c) }, tags: ["rumour"], importance: 72, facts: baseFacts(c) }) },
  { id: "done", emoji: "✍️", label: "Done deal", note: "you sign for a rival", mode: "moment", moment: "transfer" },
  { id: "sack", emoji: "🪑", label: "Manager meme", note: "the boss is sacked", mode: "moment", moment: "manager-out" },
  { id: "bdor", emoji: "🥇", label: "Ballon d'Or night", note: "you win it", mode: "moment", moment: "ballon-dor" },
  { id: "armband", emoji: "©️", label: "Made captain", note: "the armband", mode: "moment", moment: "captain" },
  { id: "callup", emoji: "🏴", label: "International call-up", note: "your first", mode: "moment", moment: "call-up" },
  { id: "casino", emoji: "🎰", label: "Casino scandal", note: "spotted at the tables", mode: "moment", moment: "casino-scandal" },
  { id: "contract", emoji: "📝", label: "New contract", note: "4 more years", mode: "moment", moment: "contract" },
  { id: "wonder", emoji: "🌟", label: "Wonderkid hype", note: "a kid at another club", mode: "event", event: c => { const club = c.league.find(t => t.name !== c.player.club)?.name ?? "Another club"; return { id: "wonderkid-hype", subject: { kind: "club", name: club }, tags: ["rumour"], importance: 50, facts: { player: "Jayden Okafor", short: "Okafor", club, age: 17, position: "AM" } }; } },
  { id: "gotm", emoji: "🗳️", label: "Goal of the Month poll now", note: "your best goals v the rest", mode: "gotm" },
  { id: "storm", emoji: "🌪️", label: "Trend storm", note: "5 hot trends about you", mode: "trends" },
];

const SUBJECTS: Subject["kind"][] = ["you", "club", "teammate", "opponent", "league", "rival", "manager"];
const HOWS = ["one_on_one", "tight_angle", "long_range", "volley", "header", "penalty", "free_kick", "corner", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "rebound", "solo"] as const;

export default function IdeasTab() {
  const { career, apply, flash, media, rows, accounts } = useStudio();
  const [mode, setMode] = useState<Mode>("match");
  const [form, setForm] = useState<MatchForm>(() => defaultMatchForm(career));
  const [momentKind, setMomentKind] = useState<MomentKind>("transfer");
  const [moment, setMoment] = useState<CareerRecord["moment"]>(() => defaultMoment(career, "transfer"));
  const [ev, setEv] = useState<EventSpec>(() => ({ id: "transfer-rumour", subject: { kind: "you", name: youName(career) }, tags: ["rumour"], importance: 70, facts: baseFacts(career) }));
  const [evScope, setEvScope] = useState<"club" | "league">("club");
  const [seed, setSeed] = useState(1);
  const [results, setResults] = useState<{ label: string; r: IdeaResult }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [timing, setTiming] = useState<"made" | "now">("made");
  const [withTrends, setWithTrends] = useState(true);

  const resultsRef = useRef<HTMLDivElement>(null);
  const show = (list: { label: string; r: IdeaResult }[]) => {
    setResults(list);
    setPicked(new Set(list.flatMap(x => x.r.posts.map(p => p.id))));
    // The posts land under the form: bring them into view.
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const run = (m: Mode = mode, s = seed) => {
    try {
      if (m === "match") show([{ label: `${form.us}-${form.them} v ${form.opponent}`, r: matchIdea(career, form, `m${s}`) }]);
      if (m === "moment") show([{ label: MOMENT_KINDS.find(k => k.kind === moment.kind)?.label ?? moment.kind, r: momentIdea(career, moment, `k${s}`) }]);
      if (m === "event") show([{ label: ev.id, r: eventIdea(career, ev, `e${s}`, evScope) }]);
    } catch (e) { flash(`Couldn't make that: ${(e as Error).message}`); }
  };
  const usePreset = (p: Preset) => {
    setMode(p.mode);
    if (p.mode === "match" && p.match) { const f = p.match(career, defaultMatchForm(career)); setForm(f); show([{ label: p.label, r: matchIdea(career, f, `p${seed}`) }]); }
    if (p.mode === "moment" && p.moment) { const k = defaultMoment(career, p.moment); setMomentKind(p.moment); setMoment(k); show([{ label: p.label, r: momentIdea(career, k, `p${seed}`) }]); }
    if (p.mode === "event" && p.event) { const e = p.event(career); setEv(e); show([{ label: p.label, r: eventIdea(career, e, `p${seed}`) }]); }
    if (p.mode === "gotm" || p.mode === "trends") setResults([]);
    if (p.id === "storm") setStorm(true);
  };
  const [storm, setStorm] = useState(false);
  const random = () => {
    const pool = PRESETS.filter(p => p.mode === "match" || p.mode === "moment" || p.mode === "event");
    const s = Math.floor(Math.random() * 1e6);
    const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    const list = picks.map((p, i) => {
      if (p.mode === "match" && p.match) {
        const f = p.match(career, defaultMatchForm(career));
        const opp = career.league.filter(t => t.name !== career.player.club);
        const tweak = { ...f, opponent: opp[(s + i) % Math.max(1, opp.length)]?.name ?? f.opponent, lastGoalMinute: Math.min(90, Math.max(5, f.lastGoalMinute + ((s >> i) % 11) - 5)) };
        return { label: `${p.emoji} ${p.label}`, r: matchIdea(career, tweak, `r${s}-${i}`) };
      }
      if (p.mode === "moment" && p.moment) return { label: `${p.emoji} ${p.label}`, r: momentIdea(career, defaultMoment(career, p.moment), `r${s}-${i}`) };
      return { label: `${p.emoji} ${p.label}`, r: eventIdea(career, p.event!(career), `r${s}-${i}`) };
    });
    // A random idea keeps it short: a few posts from each.
    show(list.map(x => ({ ...x, r: { ...x.r, posts: [...x.r.posts].sort(() => Math.random() - 0.5).slice(0, 4) } })));
  };

  const keep = () => {
    const chosen = results.flatMap(x => x.r.posts).filter(p => picked.has(p.id));
    if (!chosen.length) { flash("Tick at least one post."); return; }
    const trends = withTrends ? results.flatMap(x => x.r.trends) : [];
    apply(`Add ${chosen.length} idea posts`, m => {
      const now = nowClock(career);
      const timed = chosen.map((p, i) => (timing === "now" ? { ...p, at: now - i } : p));
      const out = addPosts(m, timed);
      return trends.length ? { ...out, trends: trends.slice(0, 8) } : out;
    });
    flash(`${chosen.length} posts added to the feed.`);
    setResults([]);
  };

  const allPosts = results.flatMap(x => x.r.posts);
  return (
    <div className="ss-col">
      <div className="ss-row" style={{ justifyContent: "space-between" }}>
        <b>Quick ideas — tap one to see what the media would say</b>
        <Btn main onClick={random}>🎲 Random idea</Btn>
      </div>
      <div className="ss-grid3">
        {PRESETS.map(p => (
          <button key={p.id} className="ss-idea" onClick={() => usePreset(p)}>
            <b>{p.emoji} {p.label}</b><small>{p.note}</small>
          </button>
        ))}
      </div>

      <div className="ss-tabs" style={{ marginTop: 6 }}>
        {([["match", "A match"], ["moment", "A career moment"], ["event", "Any event"], ["line", "One line"], ["gotm", "Goal of the Month"], ["trends", "Trends"]] as [Mode, string][]).map(([m, l]) => (
          <Pill key={m} on={mode === m} onClick={() => setMode(m)}>{l}</Pill>
        ))}
      </div>

      {mode === "match" && (
        <div className="ss-col">
          <div className="ss-grid3">
            <Field label="Opponent"><Select value={form.opponent} onChange={opponent => setForm({ ...form, opponent })} options={Array.from(new Set([form.opponent, ...career.league.map(t => t.name).filter(n => n !== career.player.club)])).map(n => ({ value: n, label: n }))} /></Field>
            <Field label="Venue"><Select value={form.home ? "h" : "a"} onChange={v => setForm({ ...form, home: v === "h" })} options={[{ value: "h", label: "Home" }, { value: "a", label: "Away" }]} /></Field>
            <Field label="Competition"><Text value={form.competition} onChange={competition => setForm({ ...form, competition })} /></Field>
            <Field label="Kind"><Select value={form.kind} onChange={kind => setForm({ ...form, kind })} options={[{ value: "league", label: "League" }, { value: "cup", label: "Cup" }, { value: "europe", label: "Europe" }]} /></Field>
            <Field label="Round (cups)"><Text value={form.round ?? ""} onChange={round => setForm({ ...form, round: round || undefined })} placeholder="Final" /></Field>
            <Field label="Week"><Num value={form.week} min={0} onChange={week => setForm({ ...form, week })} /></Field>
            <Field label="Your side scored"><Num value={form.us} min={0} max={15} onChange={us => setForm({ ...form, us, yourGoals: Math.min(form.yourGoals, us) })} /></Field>
            <Field label="They scored"><Num value={form.them} min={0} max={15} onChange={them => setForm({ ...form, them })} /></Field>
            <Field label="Your goals"><Num value={form.yourGoals} min={0} max={form.us} onChange={yourGoals => setForm({ ...form, yourGoals })} /></Field>
            <Field label="Your assists"><Num value={form.yourAssists} min={0} max={10} onChange={yourAssists => setForm({ ...form, yourAssists })} /></Field>
            <Field label="Your rating"><Num value={form.rating} min={3} max={10} step={0.1} onChange={rating => setForm({ ...form, rating })} /></Field>
            <Field label="Minute of your last goal"><Num value={form.lastGoalMinute} min={1} max={120} onChange={lastGoalMinute => setForm({ ...form, lastGoalMinute })} /></Field>
            <Field label="How you scored"><Select value={form.how} onChange={how => setForm({ ...form, how })} options={HOWS.map(h => ({ value: h, label: h.replace(/_/g, " ") }))} /></Field>
            <Field label="Distance (metres)"><Num value={form.distance} min={1} max={50} onChange={distance => setForm({ ...form, distance })} /></Field>
            <Field label="Taken off"><Select value={form.hooked} onChange={hooked => setForm({ ...form, hooked })} options={[{ value: "", label: "No" }, { value: "form", label: "For playing badly" }, { value: "legs", label: "Tired legs" }]} /></Field>
          </div>
          <div className="ss-row">
            <Check value={form.derby} onChange={derby => setForm({ ...form, derby })} label="Derby" />
            <Check value={form.captain} onChange={captain => setForm({ ...form, captain })} label="You were captain" />
            <Check value={form.starMan} onChange={starMan => setForm({ ...form, starMan })} label="Man of the match" />
          </div>
          <div className="ss-row"><Btn main onClick={() => run("match")}>See the reaction</Btn><span className="ss-sub">Every real detector runs on this made-up match; the game picks who posts and what they say. Includes the highlights video (made-up goals).</span></div>
        </div>
      )}

      {mode === "moment" && (
        <div className="ss-col">
          <Field label="What happened"><Select value={momentKind} onChange={k => { setMomentKind(k); setMoment(defaultMoment(career, k)); }} options={MOMENT_KINDS.map(k => ({ value: k.kind, label: k.label }))} /></Field>
          <div className="ss-grid3">
            {Object.entries(moment).filter(([k]) => k !== "kind").map(([k, v]) => (
              <Field key={k} label={k}>
                {typeof v === "number" ? <Num value={v} onChange={n => setMoment({ ...moment, [k]: n } as CareerRecord["moment"])} />
                  : typeof v === "boolean" ? <Check value={v} onChange={b => setMoment({ ...moment, [k]: b } as CareerRecord["moment"])} label={v ? "yes" : "no"} />
                  : <Text value={String(v)} onChange={s => setMoment({ ...moment, [k]: s } as CareerRecord["moment"])} />}
              </Field>
            ))}
          </div>
          <div className="ss-row"><Btn main onClick={() => run("moment")}>See the reaction</Btn></div>
        </div>
      )}

      {mode === "event" && <EventEditor ev={ev} setEv={setEv} scope={evScope} setScope={setEvScope} onRun={() => run("event")} />}
      {mode === "line" && <LineMaker />}
      {mode === "gotm" && <GotmMaker />}
      {mode === "trends" && <TrendsEditor storm={storm} onStormDone={() => setStorm(false)} />}

      {results.length > 0 && (mode === "match" || mode === "moment" || mode === "event" || results.length > 1) && (
        <div ref={resultsRef} className="ss-col" style={{ marginTop: 8, padding: 12, border: "1px solid var(--bc-accent)", borderRadius: 6, scrollMarginTop: 12 }}>
          <div className="ss-row" style={{ justifyContent: "space-between" }}>
            <b>{allPosts.length} posts this would make · {picked.size} ticked</b>
            <span className="ss-row">
              <Btn onClick={() => { setSeed(s => s + 1); run(mode, seed + 1); }}>🔁 Re-roll</Btn>
              <Btn onClick={() => setPicked(new Set(allPosts.map(p => p.id)))}>Tick all</Btn>
              <Btn onClick={() => setPicked(new Set())}>Untick all</Btn>
            </span>
          </div>
          {results.map(x => (
            <div key={x.label} className="ss-col">
              <div className="ss-row"><b style={{ fontSize: 13 }}>{x.label}</b>{x.r.events.slice(0, 14).map(e => <span key={e.id} className="ss-chip">{e.id}</span>)}</div>
              {!x.r.posts.length && <div className="ss-sub">Nobody would post about this. Try more importance, other tags, or another kind of moment.</div>}
              <div className="ss-grid2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}>
                {x.r.posts.map(p => (
                  <label key={p.id} className="ss-col" style={{ gap: 4, cursor: "pointer" }}>
                    <Check value={picked.has(p.id)} onChange={on => setPicked(s => { const n = new Set(s); if (on) n.add(p.id); else n.delete(p.id); return n; })} label={`Keep · ${p.scope === "league" ? "England" : "Club"} tab`} />
                    <div className="ss-card-preview"><PostCard post={p} now={Math.max(nowClock(career), p.at)} /></div>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="ss-row">
            <Select value={timing} onChange={setTiming} options={[{ value: "made", label: "Dated as made (that week)" }, { value: "now", label: "Dated now (top of the feed)" }]} />
            <Check value={withTrends} onChange={setWithTrends} label="Also update the trends" />
            <Btn main onClick={keep}>Add {picked.size} to the feed</Btn>
          </div>
          <span className="ss-sub">{media.posts.length} posts in the save · {rows.length} accounts · {accounts.length} can post</span>
        </div>
      )}
    </div>
  );
}

function EventEditor({ ev, setEv, scope, setScope, onRun }: { ev: EventSpec; setEv: (e: EventSpec) => void; scope: "club" | "league"; setScope: (s: "club" | "league") => void; onRun: () => void }) {
  const kinds = useMemo(() => eventKinds(), []);
  const { career } = useStudio();
  const facts = Object.entries(ev.facts).map(([k, v]) => ({ k, v: String(v) }));
  return (
    <div className="ss-col">
      <div className="ss-grid3">
        <Field label="Kind of event (pick or type a new one)">
          <input className="ss-input" list="ss-event-kinds" value={ev.id} onChange={e => setEv({ ...ev, id: e.target.value })} />
          <datalist id="ss-event-kinds">{kinds.map(k => <option key={k} value={k} />)}</datalist>
        </Field>
        <Field label="About"><Select value={ev.subject.kind} onChange={kind => setEv({ ...ev, subject: { ...ev.subject, kind } })} options={SUBJECTS.map(s => ({ value: s, label: s }))} /></Field>
        <Field label="Who (name)"><Text value={ev.subject.name} onChange={name => setEv({ ...ev, subject: { ...ev.subject, name } })} /></Field>
        <Field label={`How big (0–100): ${ev.importance}`}><input type="range" min={0} max={100} value={ev.importance} onChange={e => setEv({ ...ev, importance: Number(e.target.value) })} /></Field>
        <Field label="Phone tab"><Select value={scope} onChange={setScope} options={[{ value: "club", label: "Club" }, { value: "league", label: "England" }]} /></Field>
      </div>
      <Field label="Subjects (who is interested: tap to turn on)">
        <div className="ss-row" style={{ gap: 4 }}>
          {ALL_TAGS.map(t => <button key={t} type="button" className="ss-chip ss-chip-btn" aria-pressed={ev.tags.includes(t)} onClick={() => setEv({ ...ev, tags: ev.tags.includes(t) ? ev.tags.filter(x => x !== t) : [...ev.tags, t] })}>{t}</button>)}
        </div>
      </Field>
      <Field label="Facts the lines can use ({player}, {club}, {opponent}, {score}, {manager}, {to}…)">
        <RowsEditor rows={facts} blank={() => ({ k: "key", v: "" })} onChange={r => setEv({ ...ev, facts: Object.fromEntries(r.filter(x => x.k).map(x => [x.k, /^-?\d+(\.\d+)?$/.test(x.v) ? Number(x.v) : x.v])) })}
          render={(r, set) => (<>
            <span style={{ flex: 1 }}><Text mono value={r.k} onChange={k => set({ ...r, k })} /></span>
            <span style={{ flex: 2 }}><Text value={r.v} onChange={v => set({ ...r, v })} /></span>
          </>)} />
      </Field>
      <div className="ss-row">
        <Btn main onClick={onRun}>See the reaction</Btn>
        <Btn onClick={() => setEv({ ...ev, facts: baseFacts(career) })}>Reset facts from the save</Btn>
      </div>
      <div className="ss-sub">An event the lines are written for (in the list) gets its own lines; a new one gets lines written for its subjects, or each account&apos;s general line.</div>
    </div>
  );
}

function LineMaker() {
  const { career, accounts, apply, flash } = useStudio();
  const cat = useMemo(() => templateCatalogue(), []);
  const [arch, setArch] = useState<string>("tabloid");
  const [q, setQ] = useState("");
  const list = cat.filter(t => (!arch || t.archetype === arch) && (!q || `${t.id} ${t.body} ${t.events.join(" ")} ${t.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const [tid, setTid] = useState<string>(list[0]?.id ?? "");
  const t = cat.find(x => x.id === tid) ?? list[0];
  const who = accounts.filter(a => a.archetype === t?.archetype);
  const [acc, setAcc] = useState<string>("");
  const account = who.find(a => a.id === acc) ?? who[0];
  const [facts, setFacts] = useState<Facts>(() => baseFacts(career));
  const [roll, setRoll] = useState(0);
  const post: StoredPost | null = t && account ? postFromTemplate(t.id, account, facts, nowClock(career), `line-${t.id}-${roll}`) : null;
  return (
    <div className="ss-col">
      <div className="ss-grid3">
        <Field label="Kind of account"><Select value={arch} onChange={setArch} options={[{ value: "", label: "Any" }, ...ARCHETYPES.map(a => ({ value: a, label: a }))]} /></Field>
        <Field label="Search the lines"><Text value={q} onChange={setQ} placeholder="word, event, subject" /></Field>
        <Field label={`Line (${list.length})`}><Select value={t?.id ?? ""} onChange={setTid} options={list.slice(0, 300).map(x => ({ value: x.id, label: `${x.id} — ${x.body.slice(0, 60)}` }))} /></Field>
        <Field label="Account"><Select value={account?.id ?? ""} onChange={setAcc} options={who.map(a => ({ value: a.id, label: `${a.name} (${a.handle})` }))} /></Field>
      </div>
      {t && <div className="ss-sub ss-mono">{t.body}{t.events.length ? ` · for ${t.events.join(", ")}` : ""}{t.tags.length ? ` · subjects ${t.tags.join(", ")}` : ""}</div>}
      {t && (
        <div className="ss-grid3">
          {t.slots.map(k => (
            <Field key={k} label={`{${k}}`}><Text value={facts[k] === undefined ? "" : String(facts[k])} onChange={v => setFacts({ ...facts, [k]: v })} /></Field>
          ))}
        </div>
      )}
      {!account && <div className="ss-sub">No account of that kind posts in this save: make one in Accounts.</div>}
      {post && <div className="ss-card-preview"><PostCard post={post} now={nowClock(career)} /></div>}
      <div className="ss-row">
        <Btn onClick={() => setRoll(r => r + 1)}>🔁 Other wording</Btn>
        <Btn main disabled={!post} onClick={() => { if (!post) return; apply("Add a line", m => addPosts(m, [{ ...post, id: studioPostId(m, "line") }])); flash("Added to the feed."); }}>Add to the feed</Btn>
      </div>
    </div>
  );
}

function GotmMaker() {
  const { career, accounts, apply, flash } = useStudio();
  const mine = useMemo(() => gotmEntriesFromLog(career, 5), [career]);
  const [use, setUse] = useState<Set<number>>(() => new Set(mine.slice(0, 3).map((_, i) => i)));
  const [rivals, setRivals] = useState<GotmEntry[]>(() => {
    const other = career.league.filter(t => t.name !== career.player.club);
    return [
      rivalEntry("Marcus Hale", other[0]?.name ?? "Rivals", "25-yard curler", 78, "riv1"),
      rivalEntry("Teo Varga", other[1]?.name ?? "Rivals", "solo run from halfway", 74, "riv2"),
    ];
  });
  const [month, setMonth] = useState(MONTH_NAMES[monthOfCareer(career, career.week)] ?? "This month");
  const league = accounts.find(a => a.archetype === "league") ?? accounts[0];
  const [who, setWho] = useState(league?.id ?? "");
  const author = accounts.find(a => a.id === who) ?? league;
  const entries = [...mine.filter((_, i) => use.has(i)), ...rivals].sort((a, b) => b.quality - a.quality);
  const [text, setText] = useState(`🗳️ ${month} Goal of the Month. Which one gets your vote?`);
  return (
    <div className="ss-col">
      <div className="ss-grid3">
        <Field label="Month"><Text value={month} onChange={setMonth} /></Field>
        <Field label="Posted by"><Select value={author?.id ?? ""} onChange={setWho} options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.handle})` }))} /></Field>
        <Field label="Words" wide><Text value={text} onChange={setText} /></Field>
      </div>
      <Field label={`Your goals this season (${mine.length} best; tick the ones in the poll)`}>
        {mine.length ? mine.map((e, i) => (
          <Check key={i} value={use.has(i)} onChange={on => setUse(s => { const n = new Set(s); if (on) n.add(i); else n.delete(i); return n; })} label={`${e.detail} · quality ${e.quality}${e.clipId ? " · 🎥 recorded" : " · made-up video"}`} />
        )) : <span className="ss-sub">No goals this season yet — the poll can still run on the rivals&apos; goals.</span>}
      </Field>
      <Field label="Other players' goals">
        <RowsEditor<GotmEntry> rows={rivals} onChange={setRivals} blank={() => rivalEntry("New Player", career.league[0]?.name ?? "Club", "volley from the edge", 70, `riv${Date.now() % 10000}`)}
          render={(e, set) => (<>
            <span style={{ flex: 2 }}><Text value={e.scorer} onChange={scorer => set({ ...e, scorer, scorerShort: scorer.split(" ").slice(-1)[0] })} /></span>
            <span style={{ flex: 2 }}><Text value={e.club} onChange={club => set({ ...e, club, synth: e.synth ? { ...e.synth, home: club } : e.synth })} /></span>
            <span style={{ flex: 3 }}><Text value={e.detail} onChange={detail => set({ ...e, detail })} /></span>
            <Num value={e.quality} min={0} max={100} onChange={quality => set({ ...e, quality })} />
          </>)} />
      </Field>
      <div className="ss-row">
        <Btn main disabled={entries.length < 2 || !author} onClick={() => { apply("Goal of the Month poll", () => openGotmPoll(career, entries, authorOf(author!), text, month)); flash("Poll is live. The game closes it after your next match and posts the winner."); }}>Open the poll now ({entries.length} goals)</Btn>
      </div>
      <div className="ss-sub">Needs 2 goals or more. Fans&apos; votes are set from the goals&apos; quality and your fame, like the game&apos;s own polls; your tap adds to one. Poll posts only show when Leo&apos;s update &quot;Goal of the Month&quot; is on.</div>
    </div>
  );
}

function TrendsEditor({ storm, onStormDone }: { storm: boolean; onStormDone: () => void }) {
  const { media, apply, career } = useStudio();
  const [draft, setDraft] = useState<Trend[]>(media.trends);
  const pinned = media.studio?.pinnedTrends ?? [];
  const stormTrends = (): Trend[] => {
    const s = career.player.lastName;
    return [
      { label: s, volume: 184_000, tag: "goal", hot: true },
      { label: `#${s.replace(/\W/g, "")}Szn`, volume: 92_400, tag: "form", hot: true },
      { label: `${s} Ballon d'Or`, volume: 61_000, tag: "award", hot: true },
      { label: career.player.club, volume: 48_300, tag: "table", hot: true },
      { label: `${s} transfer`, volume: 33_900, tag: "rumour", hot: true },
    ];
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (storm) { onStormDone(); setDraft(d => [...stormTrends(), ...d].slice(0, 10)); } }, [storm]);
  return (
    <div className="ss-col">
      <div className="ss-sub">The ticker across the top of the phone. The game writes new trends after each match; pinned ones stay first whatever happens.</div>
      <RowsEditor<Trend> rows={draft} onChange={setDraft} blank={() => ({ label: "#NewTrend", volume: 12_000, tag: "goal", hot: false })}
        render={(t, set) => (<>
          <span style={{ flex: 3 }}><Text value={t.label} onChange={label => set({ ...t, label })} /></span>
          <span title={formatVolume(t.volume)}><Num value={t.volume} min={0} onChange={volume => set({ ...t, volume })} /></span>
          <Select value={t.tag} onChange={tag => set({ ...t, tag })} options={ALL_TAGS.map(x => ({ value: x, label: x }))} />
          <span style={{ flex: "0 0 auto" }}><Check value={t.hot} onChange={hot => set({ ...t, hot })} label="🔥" /></span>
          <span style={{ flex: "0 0 auto" }}><button type="button" className="ss-chip ss-chip-btn" aria-pressed={pinned.some(p => p.label === t.label)}
            onClick={() => apply(pinned.some(p => p.label === t.label) ? "Unpin trend" : "Pin trend", m => withStudio(m, st => ({ ...st, pinnedTrends: (st.pinnedTrends ?? []).some(p => p.label === t.label) ? (st.pinnedTrends ?? []).filter(p => p.label !== t.label) : [...(st.pinnedTrends ?? []), t] })))}>📌</button></span>
        </>)} />
      <div className="ss-row">
        <Btn main onClick={() => apply("Edit trends", m => ({ ...m, trends: draft }))}>Save trends</Btn>
        <Btn onClick={() => setDraft(d => [...stormTrends(), ...d].slice(0, 10))}>🌪️ Trend storm</Btn>
        <Btn onClick={() => setDraft(media.trends)}>Undo edits</Btn>
        {pinned.length > 0 && <Btn onClick={() => apply("Unpin all trends", m => withStudio(m, st => ({ ...st, pinnedTrends: [] })))}>Unpin all ({pinned.length})</Btn>}
      </div>
    </div>
  );
}
