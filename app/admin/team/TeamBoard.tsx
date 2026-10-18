"use client";
/**
 * The team board (Harry, 18 Oct 2026): what Harry, Mikey and Leo are doing,
 * as its own full page. Ops room look (or Clean light), side menu with Team
 * and Patch notes. Tap a push to see it, and the patch note it went out in.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/shell/AdminShell";
import PatchNotesArchive from "@/app/admin/patch-notes/PatchNotesArchive";
import { perDay, type Person, type Push, type TeamBoardData } from "@/lib/teamBoard";
import type { DevStatus } from "@/lib/devStatus";
import "./teamBoard.css";

const REFRESH_MS = 60_000;

function ago(iso: string | null, now: number): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}
const clock = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Green under 30 min, grey after (TB-Q7). */
const liveness = (iso: string | null, now: number) =>
  !iso ? "off" : now - Date.parse(iso) < 30 * 60_000 ? "live" : now - Date.parse(iso) < 3 * 3600_000 ? "quiet" : "off";

export default function TeamBoard({ initialTab, initialVersion }: { initialTab: "team" | "notes"; initialVersion?: string }) {
  const [tab, setTab] = useState<"team" | "notes">(initialTab);
  const [version, setVersion] = useState<string | undefined>(initialVersion);
  const [data, setData] = useState<TeamBoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<Push | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/team", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? `The board answered ${r.status}.`); return; }
      setData(j as TeamBoardData); setError(null);
    } catch {
      setError("Could not reach the site to load the board.");
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, REFRESH_MS); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id); }, []);

  // The address follows the tab, so a link to a patch note can be shared.
  useEffect(() => {
    const q = tab === "notes" ? `?tab=notes${version ? `&v=${encodeURIComponent(version)}` : ""}` : "";
    try { window.history.replaceState(null, "", `/admin/team${q}`); } catch { /* old browser */ }
  }, [tab, version]);

  const openNote = (v: string) => { setVersion(v); setTab("notes"); setOpen(null); window.scrollTo(0, 0); };

  const people = useMemo(() => {
    if (!data) return [];
    return [...data.people].sort((a, b) => Date.parse(b.pushes[0]?.at ?? "0") - Date.parse(a.pushes[0]?.at ?? "0"));
  }, [data]);

  return (
    <AdminShell tab={tab} role="admin" onTab={(t) => { setTab(t); if (t === "team") setVersion(undefined); }}>
      {tab === "notes" ? (
        <div className="tb-notes"><PatchNotesArchive key={version ?? "latest"} initialVersion={version} /></div>
      ) : (
        <div className="tb">
          <header className="tb-head">
            <h1 className="ash-h1">Team</h1>
            <DeployPill data={data} now={now} />
          </header>

          {error && <div className="tb-alert">{error}</div>}
          {data?.problems.map((p) => <div key={p} className="tb-alert">{p}</div>)}

          <div className="tb-people">
            {(data ? people : (["Harry", "Mikey", "Leo"] as Person[]).map((person) => ({ person, branch: person, pushes: [] as Push[], status: null }))).map((c) => (
              <PersonCard key={c.person} person={c.person} pushes={c.pushes} status={"status" in c ? c.status ?? null : null}
                statusOn={!!data?.statusOn} now={now} loading={!data} onOpen={setOpen} onNote={openNote} />
            ))}
          </div>

          {data && data.pulls.length > 0 && (
            <details className="ash-panel tb-drop">
              <summary><span>Pull requests</span><span className="tb-count">{data.pulls.length}</span></summary>
              <ul>
                {data.pulls.slice(0, 12).map((p) => (
                  <li key={p.number}>
                    <a href={p.url} target="_blank" rel="noreferrer" className="tb-row" title={`${p.title} — ${p.branch} → main`}>
                      <span className={`ash-av ${p.person ?? "Shared"} tb-av-sm`}>{(p.person ?? "?")[0]}</span>
                      <span className="tb-row-t">#{p.number} {p.title}</span>
                      <span className={`ash-tag ${p.state === "merged" ? "green" : p.state === "open" ? "amber" : "grey"}`}>{p.state}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {open && <PushSheet push={open} now={now} onClose={() => setOpen(null)} onNote={openNote} />}
    </AdminShell>
  );
}

function DeployPill({ data, now }: { data: TeamBoardData | null; now: number }) {
  const d = data?.deploy;
  const state = d?.state ?? "unknown";
  const word = state === "success" ? "Live" : state === "pending" ? "Deploying" : state === "failure" ? "Deploy failed" : "…";
  const tip = d ? `${word} on knowitball.co.uk${d.title ? ` — ${d.title}` : ""}${d.sha ? ` (${d.sha.slice(0, 7)})` : ""}` : "Checking the live site";
  return (
    <span className={`ash-panel tb-pill ${state}`} title={tip}>
      <span className={`ash-dot ${state === "success" ? "live" : state === "pending" ? "wait" : state === "failure" ? "bad" : ""}`} />
      <b>{word}</b>{d?.at && <small>{ago(d.at, now)}</small>}
    </span>
  );
}

/** "Harry's patch notes: The Arcade pack" → "The Arcade pack". */
const shortTitle = (t: string) => t.replace(/^(Harry|Mikey|Leo)['’]s patch notes\s*(v[\d.]+)?\s*[:—-]?\s*/i, "").trim() || "Patch notes";

/** A person's pushes, grouped by the patch note they went out in; "not in notes yet" first. */
function groupByNote(pushes: Push[]) {
  const groups = new Map<string, { version: string | null; title: string; url: string | null; pushes: Push[] }>();
  for (const p of pushes) {
    const k = p.patch?.version ?? "new";
    if (!groups.has(k)) groups.set(k, { version: p.patch?.version ?? null, title: p.patch ? shortTitle(p.patch.title) : "Not in patch notes yet", url: p.patch?.artifactUrl ?? null, pushes: [] });
    groups.get(k)!.pushes.push(p);
  }
  return Array.from(groups.values()).sort((a, b) => (a.version === null ? -1 : b.version === null ? 1 : parseFloat(b.version) - parseFloat(a.version)));
}

function PersonCard({ person, pushes, status, statusOn, now, loading, onOpen, onNote }: {
  person: Person; pushes: Push[]; status: DevStatus | null; statusOn: boolean; now: number; loading: boolean;
  onOpen: (p: Push) => void; onNote: (v: string) => void;
}) {
  const last = status?.at && (!pushes[0] || Date.parse(status.at) > Date.parse(pushes[0].at)) ? status.at : pushes[0]?.at ?? null;
  const live = liveness(last, now);
  const days = perDay(pushes, now, 7);
  const max = Math.max(1, ...days);
  // Merges aren't work, they are bookkeeping: left off the board.
  const work = pushes.filter((p) => !/^Merge\b/i.test(p.title));
  const groups = groupByNote(work);
  return (
    <section className={`ash-panel tb-person ${person}`}>
      <div className="tb-person-top">
        <span className={`ash-av ${person} tb-big`}>{person[0]}</span>
        <div className="tb-who">
          <b>{person}</b>
          <small title={last ? clock(last) : ""}><span className={`ash-dot ${live === "live" ? "live" : ""}`} /> {loading ? "…" : last ? ago(last, now) : "—"}</small>
        </div>
        <div className="tb-spark" title={`Pushes per day, last 7 days: ${days.join(", ")}`}>
          {days.map((n, i) => <i key={i} style={{ height: `${6 + (n / max) * 24}px`, opacity: n ? 1 : 0.25 }} />)}
        </div>
      </div>

      {status && status.bars.length > 0 ? (
        <div className="tb-bars">
          {status.bars.map((b, i) => (
            <div key={i} className="tb-bar" title={b.note || undefined}>
              <span className="tb-bar-l">{b.label}</span>
              <span className="tb-bar-t"><i style={{ width: `${b.pct}%` }} className={b.pct >= 100 ? "done" : ""} /></span>
              <span className="tb-bar-p">{b.pct}%</span>
            </div>
          ))}
          {status.waiting && <div className="tb-wait" title="Waiting on">⏳ {status.waiting}</div>}
        </div>
      ) : (
        <div className="tb-bars empty" title={statusOn ? "Bars show here after this person's next progress update." : "Live bars need one database file and a shared password (Mikey). Pushes work already."}>
          <span className="tb-bar-t" /><small>{statusOn ? "No update yet" : "Live bars: off"}</small>
        </div>
      )}

      <div className="tb-groups">
        {loading ? <p className="tb-muted">Loading…</p> : groups.length === 0 ? <p className="tb-muted">No pushes yet</p> : groups.map((g, gi) => (
          <Drop key={g.version ?? "new"} open={gi === 0}>
            <summary key="s">
              {g.version ? <span className="ash-tag green">v{g.version}</span> : <span className="ash-tag grey">new</span>}
              <span className="tb-drop-t" title={g.title}>{g.title}</span>
              <span className="tb-count">{g.pushes.length}</span>
            </summary>
            {g.version && (
              <div className="tb-drop-act">
                <button className="ash-chip" onClick={() => onNote(g.version!)}>Open notes</button>
                {g.url && <a className="ash-chip" href={g.url} target="_blank" rel="noreferrer">Full page ↗</a>}
              </div>
            )}
            <Rows pushes={g.pushes} now={now} onOpen={onOpen} />
          </Drop>
        ))}
      </div>
    </section>
  );
}

function Drop({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <details className="tb-drop" open={open}>{children}</details>;
}

/** Five pushes, then "+ n more". */
function Rows({ pushes, now, onOpen }: { pushes: Push[]; now: number; onOpen: (p: Push) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? pushes : pushes.slice(0, 5);
  return (
    <ul>
      {shown.map((p) => (
        <li key={p.sha}>
          <button className="tb-row" onClick={() => onOpen(p)} title={p.title}>
            <span className="tb-row-t">{p.title}</span>
            <span className="tb-row-m">{ago(p.at, now)}</span>
          </button>
        </li>
      ))}
      {pushes.length > 5 && (
        <li><button className="tb-row tb-more-row" onClick={() => setAll(!all)}>{all ? "Fewer" : `+ ${pushes.length - 5} more`}</button></li>
      )}
    </ul>
  );
}

function PushSheet({ push, now, onClose, onNote }: { push: Push; now: number; onClose: () => void; onNote: (v: string) => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="tb-sheet-wrap" onClick={onClose}>
      <div className="ash-panel tb-sheet" role="dialog" aria-label="Push" onClick={(e) => e.stopPropagation()}>
        <div className="tb-sheet-top">
          <span className={`ash-av ${push.person ?? "Shared"}`}>{(push.person ?? "?")[0]}</span>
          <small>{push.person ?? "Someone"} · {push.branch === push.person ? "own branch" : push.branch} · {clock(push.at)} ({ago(push.at, now)})</small>
          <button className="ash-btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <h2 className="tb-sheet-t">{push.title}</h2>

        <div className={`tb-note ${push.patch ? "" : "none"}`}>
          {push.patch ? (<>
            <small>Went out in</small>
            <b>v{push.patch.version} · {push.patch.title}</b>
            <span className="tb-note-why">{push.patch.how === "named" ? "The push names this version." : "This person's next patch note after the push."}</span>
            <div className="tb-note-btns">
              <button className="ash-btn" onClick={() => onNote(push.patch!.version)}>Open in Patch notes</button>
              {push.patch.artifactUrl && <a className="ash-btn ghost" href={push.patch.artifactUrl} target="_blank" rel="noreferrer">Open the full page ↗</a>}
            </div>
          </>) : (<>
            <small>Patch notes</small>
            <b>Not in any patch notes yet</b>
            <span className="tb-note-why">It shows up here once this person's next patch notes go live.</span>
          </>)}
        </div>

        {push.body && <pre className="tb-body">{push.body}</pre>}
        <div className="tb-note-btns">
          <a className="ash-btn ghost" href={push.url} target="_blank" rel="noreferrer">See it on GitHub ↗</a>
          {push.session && <a className="ash-btn ghost" href={push.session} target="_blank" rel="noreferrer">The chat that made it ↗</a>}
        </div>
        <p className="tb-muted ash-mono" style={{ marginTop: 10 }}>{push.sha.slice(0, 7)}</p>
      </div>
    </div>
  );
}
