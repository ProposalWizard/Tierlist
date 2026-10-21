"use client";
/**
 * The production board (Harry, 21 Oct 2026; plan piece 2): one card per
 * video, seven columns. The cards come from marketing/board.json, read from
 * GitHub about once a minute (lib/marketing/board.ts, /api/admin/marketing/board),
 * so a Claude session that moves a card and pushes shows here with no deploy.
 * Phone: a stage switch and the cards under it. Computer: the seven columns.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BOARD, STAGES, inStage, repoLink, repoRaw, stageName, type BoardCard, type BoardRead, type StageKey } from "@/lib/marketing/board";
import "./marketing.css";

type Filter = StageKey | "all";

export default function ProductionBoard({ initial }: { initial: BoardRead }) {
  const [data, setData] = useState<BoardRead>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(BOARD.api, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch { /* keep what is on screen */ } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, BOARD.refreshMs);
    return () => clearInterval(id);
  }, [load]);

  const cards = data.cards;
  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.key, inStage(cards, s.key).length])) as Record<StageKey, number>, [cards]);
  const shown = STAGES.filter((s) => filter === "all" || s.key === filter);

  return (
    <div className="mk-board">
      <div className="mk-status">
        <span>{cards.length} video{cards.length === 1 ? "" : "s"} · {data.from === "github" ? "read from GitHub" : "the copy built into the site"} · {new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <button className="bc-pill" aria-pressed={false} onClick={load} disabled={busy}>{busy ? "Checking…" : "↻ Check now"}</button>
      </div>
      {data.problems.length > 0 && <div className="mk-problems">{data.problems.map((p) => <p key={p}>{p}</p>)}</div>}

      {/* Phone: pick a stage. Computer: every column shows, so this hides. */}
      <div className="mk-filter" role="group" aria-label="Stage">
        <button className="bc-pill" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <b>{cards.length}</b></button>
        {STAGES.map((s) => (
          <button key={s.key} className="bc-pill" aria-pressed={filter === s.key} onClick={() => setFilter(s.key)} title={s.help}>{s.name} <b>{counts[s.key]}</b></button>
        ))}
      </div>

      <div className="mk-cols" data-filter={filter}>
        {shown.map((s) => (
          <section key={s.key} className="mk-col" data-stage={s.key} data-empty={counts[s.key] === 0}>
            <h3 title={s.help}><span>{s.name}</span><b>{counts[s.key]}</b></h3>
            {counts[s.key] === 0 ? <p className="mk-empty">Nothing here</p> : inStage(cards, s.key).map((c) => <Card key={c.id} c={c} />)}
          </section>
        ))}
      </div>
    </div>
  );
}

function Card({ c }: { c: BoardCard }) {
  const [noPic, setNoPic] = useState(false);
  const files: [string, string | null][] = [["Script", c.script], ["Cover", c.cover], ["Video", c.video]];
  return (
    <article className="mk-card" data-stage={c.stage}>
      <div className="mk-card-top">
        {c.cover && !noPic && (
          <a href={repoLink(c.cover, c.branch)} target="_blank" rel="noreferrer" className="mk-cover" title="Open the cover">
            <img src={repoRaw(c.cover, c.branch)} alt={`Cover of ${c.title}`} loading="lazy" onError={() => setNoPic(true)} />
          </a>
        )}
        <div className="mk-card-main">
          <b className="mk-title">{c.title}</b>
          <div className="mk-meta">
            <span className="mk-stage">{stageName(c.stage)}</span>
            <span title="Who is making it">{c.owner}</span>
            {c.postOn && <span title={c.stage === "posted" ? "Went out" : "Goes out"}>{c.stage === "posted" ? "Out" : "Due"} {fmtDay(c.postOn)}</span>}
            {c.seconds != null && <span>{c.seconds} s</span>}
          </div>
          {c.line && <p className="mk-line">{c.line}</p>}
        </div>
      </div>
      <div className="mk-links">
        {files.filter(([, p]) => p).map(([label, p]) => (
          <a key={label} href={repoLink(p!, c.branch)} target="_blank" rel="noreferrer">{label} ↗</a>
        ))}
        {c.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
      </div>
      {c.log.length > 0 && (
        <details className="mk-log">
          <summary>What happened ({c.log.length})</summary>
          <ol>{c.log.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </details>
      )}
      <small className="mk-from">From {c.branch === "main" ? "main" : `${c.branch}'s branch`} · changed {fmtDay(c.updated.slice(0, 10))}</small>
    </article>
  );
}

const fmtDay = (d: string) => {
  const t = Date.parse(`${d}T12:00:00Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : d;
};
