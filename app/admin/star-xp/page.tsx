"use client";

/**
 * /admin/star-xp — THE XP BOOK (Mikey, 3 Oct 2026).
 *
 * Every amount of XP the career gives, on one page: match XP, multipliers,
 * trophies, awards, achievements, records, milestones and status. Change a
 * number, mark an item Confirmed or Change it (with a note), and add ideas
 * for achievements, records, awards and milestones that aren't built yet.
 *
 * Save writes it to the shared star_xp_config row (lib/star/xpStore.ts);
 * every career uses those amounts the next time it loads.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { ACHIEVEMENTS } from "@/lib/star/achievements";
import { RECORDS } from "@/lib/star/records";
import { FIRST_STEPS } from "@/lib/star/unlocks";
import { DEFAULT_XP, ALL_DIVISIONS, achievementXp, type XpConfig, type ItemStatus, type AchievementTier, type XpIdea, type MultKey } from "@/lib/star/xpConfig";
import { fetchXpConfig, loadCachedXp, saveXpConfig } from "@/lib/star/xpStore";

type Tab = "match" | "mult" | "trophies" | "awards" | "achievements" | "records" | "other" | "ideas";
const TABS: { id: Tab; label: string }[] = [
  { id: "match", label: "In a match" }, { id: "mult", label: "Multipliers" }, { id: "trophies", label: "Trophies" },
  { id: "awards", label: "Awards" }, { id: "achievements", label: "Achievements" }, { id: "records", label: "Records" },
  { id: "other", label: "Milestones & status" }, { id: "ideas", label: "New ideas" },
];

const DIV_NAME: Record<string, string> = {
  national_league_north: "NL North", national_league_south: "NL South", national_league: "National League",
  league_two: "League Two", league_one: "League One", championship: "Championship", premier: "Premier League",
};
const MULT_ROWS: [MultKey, string, string][] = [
  ["national_league_north", "National League North", "League matches, and cup ties while you're in this league"],
  ["national_league_south", "National League South", "League matches, and cup ties while you're in this league"],
  ["national_league", "National League", "League matches, and cup ties while you're in this league"],
  ["league_two", "League Two", "League matches, and cup ties while you're in this league"],
  ["league_one", "League One", "League matches, and cup ties while you're in this league"],
  ["championship", "Championship", "League matches, and cup ties while you're in this league"],
  ["premier", "Premier League", "League matches, and cup ties while you're in this league"],
  ["champions_league", "Champions League", "Every Champions League match"],
  ["europa_league", "Europa League", "Every Europa League match"],
  ["conference_league", "Conference League", "Every Conference League match"],
  ["intl", "Internationals", "Every match for your country"],
];
const MATCH_ROWS: [keyof XpConfig["match"], string, string][] = [
  ["perMinute", "Each minute played", "90 minutes = 90 × this. A 24-minute sub gets 24 × this."],
  ["win", "A win", ""],
  ["draw", "A draw", ""],
  ["goal", "Each goal", ""],
  ["assist", "Each assist", ""],
  ["ratingPerPoint", "Each match-rating point above 6", "7.0 gets 1 ×, 8.0 gets 2 ×, 9.5 gets 3.5 ×. Under 6 gets nothing."],
];
const ACH_ROWS = [
  // "first-game" is a step but never lands in career.achievements (stepDone reads appearances), so it pays nothing.
  ...FIRST_STEPS.filter(s => s.id !== "first-game").map(s => ({ id: s.id as string, label: `${s.label} (first steps)`, description: s.todo })),
  ...ACHIEVEMENTS.map(a => ({ id: a.id, label: a.label, description: a.description })),
];

const STATUS_NEXT: Record<ItemStatus, ItemStatus> = { unchecked: "confirmed", confirmed: "change", change: "unchecked", idea: "idea" };
const STATUS_LOOK: Record<ItemStatus, { label: string; bg: string; fg: string }> = {
  unchecked: { label: "Not checked", bg: "#475569", fg: "#ffffff" },
  confirmed: { label: "Confirmed ✓", bg: "#16a34a", fg: "#ffffff" },
  change: { label: "Change it", bg: "#f59e0b", fg: "#111827" },
  idea: { label: "Idea", bg: "#2563eb", fg: "#ffffff" },
};
const fmt = (n: number) => n.toLocaleString("en-GB");
const gold = { background: "linear-gradient(180deg, #fde047, #f59e0b)" };

export default function XpBook() {
  const [cfg, setCfg] = useState<XpConfig>(DEFAULT_XP);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("match");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [shared, setShared] = useState<"checking" | "yes" | "missing">("checking");
  const [draft, setDraft] = useState<XpIdea | null>(null);

  useEffect(() => {
    setCfg(loadCachedXp());
    fetchXpConfig().then(({ config, migrationMissing }) => {
      setShared(migrationMissing ? "missing" : "yes");
      if (config) setCfg(config);
    });
  }, []);

  const change = (next: XpConfig) => { setCfg(next); setDirty(true); setMsg(null); };
  const save = async () => {
    const r = await saveXpConfig(cfg);
    setDirty(false);
    setMsg(r.shared ? { text: "Saved for everyone", ok: true } : { text: `Saved on this device only (${r.reason})`, ok: false });
  };

  const statusOf = (key: string): ItemStatus => cfg.notes[key]?.status ?? "unchecked";
  const cycle = (key: string) => change({ ...cfg, notes: { ...cfg.notes, [key]: { ...cfg.notes[key], status: STATUS_NEXT[statusOf(key)] } } });
  const setNote = (key: string, note: string) => change({ ...cfg, notes: { ...cfg.notes, [key]: { ...cfg.notes[key], status: cfg.notes[key]?.status ?? "change", note } } });

  const unchecked = useMemo(() => {
    const keys: Record<Tab, string[]> = {
      match: MATCH_ROWS.map(r => `match:${r[0]}`),
      mult: MULT_ROWS.map(r => `mult:${r[0]}`),
      trophies: Object.keys(cfg.trophies).map(t => `trophy:${t}`),
      awards: Object.keys(cfg.awards).map(a => `award:${a}`),
      achievements: ACH_ROWS.map(a => `achievement:${a.id}`),
      records: RECORDS.map(r => `record:${r.id}`),
      other: ["milestone:firstCap", "milestone:premierDebut", "other:promotionShare", "other:trainingStar", "other:fame", "other:clubOwner", "other:topItem", "other:island", "other:president"],
      ideas: [],
    };
    return Object.fromEntries(Object.entries(keys).map(([t, ks]) => [t, ks.filter(k => statusOf(k) === "unchecked").length])) as Record<Tab, number>;
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const book: Book = { statusOf, cycle, setNote, notes: cfg.notes };
  const setMatch = (f: keyof XpConfig["match"], n: number) => change({ ...cfg, match: { ...cfg.match, [f]: n } });

  return (
    <div className="min-h-screen bg-[#0b0f1a] pb-28 text-white">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0f1a]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-[18px] font-black uppercase tracking-wide">XP Book</div>
          <button onClick={() => change({ ...DEFAULT_XP, notes: cfg.notes, ideas: cfg.ideas })} className="rounded px-3 py-2 text-[12px] font-black uppercase text-white ring-1 ring-white/25">Reset amounts</button>
          <button onClick={save} disabled={!dirty} className="rounded px-4 py-2 text-[13px] font-black uppercase text-gray-950 disabled:opacity-40" style={gold}>Save</button>
        </div>
        <div className="mt-1 text-[12px] font-bold text-white">
          Every XP amount in the career. Match XP is × the competition multiplier; everything else is flat.
          {shared === "missing" && <span className="text-red-400"> · shared save not set up (run star_xp_config.sql)</span>}
          {msg && <span className={`font-black ${msg.ok ? "text-green-400" : "text-amber-300"}`}> · {msg.text}</span>}
          {dirty && !msg && <span className="font-black text-amber-300"> · not saved</span>}
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="shrink-0 rounded px-3 py-1.5 text-[12px] font-black uppercase" style={{
              background: t.id === tab ? "linear-gradient(180deg, #fde047, #f59e0b)" : "rgba(255,255,255,.08)", color: t.id === tab ? "#111827" : "#ffffff",
            }}>
              {t.label}
              {t.id === "ideas" ? <span className="tabular-nums"> {cfg.ideas.length}</span> : unchecked[t.id] > 0 && <span className="tabular-nums"> · {unchecked[t.id]} to check</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-2 px-4 pt-4">
        {tab === "match" && (<>
          {MATCH_ROWS.map(([f, label, desc]) => (
            <Row book={book} key={f} k={`match:${f}`} label={label} desc={desc} value={cfg.match[f]} def={DEFAULT_XP.match[f]} onValue={(n) => setMatch(f, n)} step={f === "perMinute" ? 1 : 10} />
          ))}
          <Example cfg={cfg} />
        </>)}

        {tab === "mult" && MULT_ROWS.map(([k, label, desc]) => (
          <Row book={book} key={k} k={`mult:${k}`} label={label} desc={desc} value={cfg.mult[k]} def={DEFAULT_XP.mult[k]} step={0.05} suffix="×"
            onValue={(n) => change({ ...cfg, mult: { ...cfg.mult, [k]: n } })} />
        ))}

        {tab === "trophies" && (<>
          {Object.keys(cfg.trophies).map((t) => (
            <Row book={book} key={t} k={`trophy:${t}`} label={t} desc={t === "Play-Offs" ? "Winning the play-offs pays the promotion share instead (see Milestones & status)" : "Winning it"}
              value={cfg.trophies[t]} def={DEFAULT_XP.trophies[t]} step={1000} onValue={(n) => change({ ...cfg, trophies: { ...cfg.trophies, [t]: n } })} />
          ))}
          <Row book={book} k="trophy:other" label="Any other trophy" desc="A trophy that isn't listed above" value={cfg.otherTrophy} def={DEFAULT_XP.otherTrophy} step={1000} onValue={(n) => change({ ...cfg, otherTrophy: n })} />
        </>)}

        {tab === "awards" && (<>
          {Object.keys(cfg.awards).map((a) => (
            <div key={a} className="space-y-1.5">
              <div className="pt-2 text-[12px] font-black uppercase tracking-widest text-amber-300">{a}</div>
              {ALL_DIVISIONS.map((d) => (
                <Row book={book} key={d} k={d === "premier" ? `award:${a}` : `award:${a}:${d}`} label={`${a} · ${DIV_NAME[d]}`} value={cfg.awards[a][d] ?? 0} def={DEFAULT_XP.awards[a]?.[d]} step={1000}
                  onValue={(n) => change({ ...cfg, awards: { ...cfg.awards, [a]: { ...cfg.awards[a], [d]: n } } })} />
              ))}
            </div>
          ))}
          <div className="pt-2 text-[12px] font-black uppercase tracking-widest text-amber-300">Ballon d&apos;Or</div>
          {(["win", "top3", "top10"] as const).map((b) => (
            <Row book={book} key={b} k={`ballon:${b}`} label={b === "win" ? "Win the Ballon d'Or" : b === "top3" ? "Finish top 3" : "Finish top 10"} value={cfg.ballon[b]} def={DEFAULT_XP.ballon[b]} step={1000}
              onValue={(n) => change({ ...cfg, ballon: { ...cfg.ballon, [b]: n } })} />
          ))}
        </>)}

        {tab === "achievements" && (<>
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">What each level pays</div>
          {(["easy", "medium", "hard"] as AchievementTier[]).map((t) => (
            <Row book={book} key={t} k={`tier:${t}`} label={t === "easy" ? "Easy (first steps, first things)" : t === "medium" ? "Medium (a good spell)" : "Hard (a career's worth)"}
              value={cfg.achievementTiers[t]} def={DEFAULT_XP.achievementTiers[t]} onValue={(n) => change({ ...cfg, achievementTiers: { ...cfg.achievementTiers, [t]: n } })} />
          ))}
          <div className="pt-3 text-[12px] font-black uppercase tracking-widest text-amber-300">Every achievement · pick its level, or type its own amount</div>
          {ACH_ROWS.map((a) => {
            const own = a.id in cfg.achievementXp;
            const tier = cfg.achievementTier[a.id] ?? "medium";
            return (
              <Row book={book} key={a.id} k={`achievement:${a.id}`} label={a.label} desc={a.description} value={achievementXp(a.id, cfg)} step={100}
                onValue={(n) => change({ ...cfg, achievementXp: { ...cfg.achievementXp, [a.id]: n } })}
                extra={
                  <select value={own ? "own" : tier} onChange={(e) => {
                    const v = e.target.value;
                    const rest = { ...cfg.achievementXp }; delete rest[a.id];
                    if (v === "own") change({ ...cfg, achievementXp: { ...rest, [a.id]: achievementXp(a.id, cfg) } });
                    else change({ ...cfg, achievementXp: rest, achievementTier: { ...cfg.achievementTier, [a.id]: v as AchievementTier } });
                  }} className="rounded bg-black/50 px-2 py-1.5 text-[12px] font-black text-white ring-1 ring-white/20">
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="own">Own amount</option>
                  </select>
                } />
            );
          })}
        </>)}

        {tab === "records" && RECORDS.map((r) => (
          <Row book={book} key={r.id} k={`record:${r.id}`} label={r.label} desc={`Beat ${r.holder}'s ${r.value} ${r.unit} (${r.achieved}). ${r.description}`}
            value={cfg.records[r.id] ?? 0} def={DEFAULT_XP.records[r.id]} step={1000} onValue={(n) => change({ ...cfg, records: { ...cfg.records, [r.id]: n } })} />
        ))}

        {tab === "other" && (<>
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">Milestones</div>
          <Row book={book} k="milestone:firstCap" label="First international cap" value={cfg.milestones.firstCap} def={DEFAULT_XP.milestones.firstCap} step={1000} onValue={(n) => change({ ...cfg, milestones: { ...cfg.milestones, firstCap: n } })} />
          <Row book={book} k="milestone:premierDebut" label="Premier League debut" value={cfg.milestones.premierDebut} def={DEFAULT_XP.milestones.premierDebut} step={1000} onValue={(n) => change({ ...cfg, milestones: { ...cfg.milestones, premierDebut: n } })} />
          <Row book={book} k="other:promotionShare" label="Promotion without winning the league" desc="2nd, 3rd or the play-offs: this share of what winning that league pays. Winning it pays the title only."
            value={Math.round(cfg.promotionShare * 100)} def={Math.round(DEFAULT_XP.promotionShare * 100)} step={5} suffix="%" onValue={(n) => change({ ...cfg, promotionShare: Math.min(100, n) / 100 })} />
          <Row book={book} k="other:trainingStar" label="Each training star" value={cfg.trainingStar} def={DEFAULT_XP.trainingStar} step={10} onValue={(n) => change({ ...cfg, trainingStar: n })} />
          <div className="pt-3 text-[12px] font-black uppercase tracking-widest text-amber-300">Fame (the best level you&apos;ve reached)</div>
          {cfg.fame.map(([min, sp], i) => (
            <Row book={book} key={i} k={i === 0 ? "other:fame" : `other:fame:${min}`} label={["Rising Star", "National Name", "Global Star", "Icon"][i] ?? `Fame ${min}`} desc={`Fame ${min} or more. Only the best level reached pays.`}
              value={sp} def={DEFAULT_XP.fame[i]?.[1]} step={1000} onValue={(n) => change({ ...cfg, fame: cfg.fame.map((p, j) => (j === i ? [p[0], n] : p)) as [number, number][] })} />
          ))}
          <div className="pt-3 text-[12px] font-black uppercase tracking-widest text-amber-300">Status</div>
          <Row book={book} k="other:clubOwner" label="Owning a club (over half of it)" value={cfg.clubOwner} def={DEFAULT_XP.clubOwner} step={1000} onValue={(n) => change({ ...cfg, clubOwner: n })} />
          <Row book={book} k="other:topItem" label="Each level-5 thing you own" value={cfg.topItem} def={DEFAULT_XP.topItem} step={1000} onValue={(n) => change({ ...cfg, topItem: n })} />
          <Row book={book} k="other:island" label="A level-5 Private Island (instead of the above)" value={cfg.island} def={DEFAULT_XP.island} step={1000} onValue={(n) => change({ ...cfg, island: n })} />
          <Row book={book} k="other:president" label="President of a governing body" value={cfg.president} def={DEFAULT_XP.president} step={1000} onValue={(n) => change({ ...cfg, president: n })} />
        </>)}

        {tab === "ideas" && (<>
          <div className="text-[13px] font-bold text-white">Achievements, records, awards and milestones that aren&apos;t in the game yet. Write how you get it and what it should pay; it gets built from this list. An idea pays nothing until it&apos;s built.</div>
          {cfg.ideas.map((i) => (
            <div key={i.id} className="rounded bg-white/[0.05] p-2.5 ring-1 ring-blue-400/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-black uppercase">{i.kind}</span>
                <span className="min-w-0 flex-1 text-[14px] font-black">{i.name}</span>
                <span className="text-[13px] font-black tabular-nums">{fmt(i.xp)} XP</span>
                <button onClick={() => change({ ...cfg, ideas: cfg.ideas.filter(x => x.id !== i.id) })} className="text-[12px] font-black text-red-400">Delete</button>
              </div>
              <div className="mt-1 text-[12px] font-bold text-white">{i.how}</div>
            </div>
          ))}
          {draft ? (
            <div className="space-y-1.5 rounded bg-white/[0.05] p-2.5 ring-1 ring-amber-300/50">
              <div className="flex gap-1.5">
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as XpIdea["kind"] })} className="rounded bg-black/50 px-2 py-1.5 text-[13px] font-black text-white">
                  <option value="achievement">Achievement</option><option value="record">Record</option><option value="award">Award</option><option value="milestone">Milestone</option>
                </select>
                <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" className="min-w-0 flex-1 rounded bg-black/50 px-2 py-1.5 text-[13px] font-bold text-white placeholder:text-white/70" />
              </div>
              <textarea value={draft.how} onChange={(e) => setDraft({ ...draft, how: e.target.value })} placeholder="How do you get it? e.g. Score 5 free kicks in one season" rows={2} className="w-full rounded bg-black/50 px-2 py-1.5 text-[13px] font-bold text-white placeholder:text-white/70" />
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} step={100} value={draft.xp} onChange={(e) => setDraft({ ...draft, xp: Math.max(0, Number(e.target.value) || 0) })} className="w-32 rounded bg-black/50 px-2 py-1.5 text-right text-[13px] font-black text-white" />
                <span className="text-[11px] font-black uppercase">XP</span>
                <button disabled={!draft.name.trim()} onClick={() => { change({ ...cfg, ideas: [...cfg.ideas, { ...draft, name: draft.name.trim(), how: draft.how.trim() }] }); setDraft(null); }} className="ml-auto rounded px-3 py-1.5 text-[12px] font-black uppercase text-gray-950 disabled:opacity-40" style={gold}>Add</button>
                <button onClick={() => setDraft(null)} className="rounded px-2 py-1.5 text-[12px] font-black uppercase ring-1 ring-white/25">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setDraft({ id: `idea-${Date.now()}`, kind: "achievement", name: "", how: "", xp: 2400, status: "idea" })}
              className="w-full rounded py-3 text-[14px] font-black uppercase text-white ring-1 ring-dashed ring-white/30">+ Add an idea</button>
          )}
        </>)}
      </div>
      <PageGuide page="/admin/star-xp" />
    </div>
  );
}

/** One editable row: a name, what it is, an XP box, a status chip, a note. */
interface Book {
  statusOf: (k: string) => ItemStatus;
  cycle: (k: string) => void;
  setNote: (k: string, note: string) => void;
  notes: XpConfig["notes"];
}

function Row({ book, k, label, desc, value, def, onValue, step = 100, suffix = "XP", extra }: {
    book: Book; k: string; label: string; desc?: string; value: number; def?: number; onValue: (n: number) => void; step?: number; suffix?: string; extra?: React.ReactNode;
  }) {
    const { statusOf, cycle, setNote } = book;
    const cfg = { notes: book.notes };
    const st = statusOf(k);
    const look = STATUS_LOOK[st];
    return (
      <div className="rounded bg-white/[0.05] p-2.5 ring-1 ring-white/10" data-row={k}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-w-0 sm:w-auto sm:flex-1">
            <div className="text-[14px] font-black">{label}</div>
            {desc && <div className="text-[12px] font-bold text-white">{desc}</div>}
          </div>
          {extra}
          <label className="ml-auto flex items-center gap-1 sm:ml-0">
            {/* Text, not type="number": a number box kept a stray leading 0 when you cleared it and typed. */}
            <input type="text" inputMode={step < 1 ? "decimal" : "numeric"} value={value}
              onChange={(e) => { const t = e.target.value.replace(/[^0-9.]/g, ""); const n = t === "" ? 0 : Number(t); if (Number.isFinite(n) && n >= 0) onValue(n); }}
              className="w-28 rounded bg-black/50 px-2 py-1.5 text-right text-[14px] font-black tabular-nums text-white ring-1 ring-white/20" />
            <span className="text-[11px] font-black uppercase">{suffix}</span>
          </label>
          <button onClick={() => cycle(k)} className="rounded px-2 py-1 text-[11px] font-black uppercase" style={{ background: look.bg, color: look.fg }}>{look.label}</button>
        </div>
        {def !== undefined && def !== value && <div className="mt-1 text-[11px] font-black text-amber-300">Was {fmt(def)} in the code</div>}
        {(st === "change" || cfg.notes[k]?.note) && (
          <input value={cfg.notes[k]?.note ?? ""} onChange={(e) => setNote(k, e.target.value)} placeholder="What should change? (your note for the next build)"
            className="mt-2 w-full rounded bg-black/50 px-2 py-1.5 text-[12px] font-bold text-white ring-1 ring-amber-300/50 placeholder:text-white/70" />
        )}
      </div>
    );
  }

/** What a few real matches are worth with the amounts on screen. */
function Example({ cfg }: { cfg: XpConfig }) {
  const m = cfg.match;
  const rows: [string, number][] = [
    ["Full 90, a win, no goal, rating 7.0", 90 * m.perMinute + m.win + 1 * m.ratingPerPoint],
    ["Full 90, a win, one goal, rating 8.0", 90 * m.perMinute + m.win + m.goal + 2 * m.ratingPerPoint],
    ["Full 90, a win, a hat-trick, rating 9.5", 90 * m.perMinute + m.win + 3 * m.goal + 3.5 * m.ratingPerPoint],
    ["24 minutes off the bench, a draw, rating 6.5", 24 * m.perMinute + m.draw + 0.5 * m.ratingPerPoint],
  ];
  return (
    <div className="rounded bg-black/40 p-3 ring-1 ring-white/10">
      <div className="mb-1.5 text-[12px] font-black uppercase tracking-widest text-amber-300">What that makes a match worth (× the multiplier)</div>
      {rows.map(([label, n]) => (
        <div key={label} className="flex justify-between gap-2 py-0.5 text-[13px] font-bold">
          <span>{label}</span>
          <span className="font-black tabular-nums">{fmt(Math.round(n))} XP · NL {fmt(Math.round(n * cfg.mult.national_league))} · PL {fmt(Math.round(n * cfg.mult.premier))}</span>
        </div>
      ))}
    </div>
  );
}
