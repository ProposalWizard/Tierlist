"use client";
/**
 * The team board (Harry, 18 Oct 2026): what Harry, Mikey and Leo are doing,
 * as its own full page. Ops room look (or Clean light), side menu with Team
 * and Patch notes. Tap a push to see it, and the patch note it went out in.
 *
 * The Team room (Harry, 19 Oct 2026): a toggle along the top switches
 * Board | Chat | Ideas | To-do in place (also lines in the side menu).
 * Pushes take notes (components/teamRoom).
 *
 * The Team area is the admin's home (Harry, 20 Oct 2026): every way into the
 * admin lands here, on Board. "Team" is the first tab of the side menu
 * (components/admin/shell/AdminShell.tsx).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell, { type RoomTab } from "@/components/admin/shell/AdminShell";
import IdeasBoard from "@/components/teamRoom/IdeasBoard";
import ChatPage from "@/components/teamRoom/ChatPage";
import { NoteCount, NotesThread, RoomGate, TodoList } from "@/components/teamRoom/parts";
import { newGivenTasks, unreadChat, unreadNotes } from "@/lib/teamRoom/logic";
import { newPushedJobs } from "@/lib/teamRoom/jobs";
import { useTeamRoom } from "@/lib/teamRoom/store";
import { isTeamPerson, TEAM_ROOM, type TeamPerson as TeamPersonName } from "@/lib/teamRoom/config";
import { patchUnread, waitingOnMe, type PatchMeta } from "@/lib/teamRoom/extras";
import { compareVersionsDesc } from "@/lib/teamRoom/inbox";
import { OPEN_PATCH_EVENT } from "@/components/teamRoom/InboxBell";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import "@/components/teamRoom/teamRoom.css";
import PatchNotesArchive from "@/app/admin/patch-notes/PatchNotesArchive";
import { perDay, type Person, type PullRequest, type Push, type PushCount, type TeamBoardData } from "@/lib/teamBoard";
import type { DevStatus } from "@/lib/devStatus";
import "./teamBoard.css";

const REFRESH_MS = 60_000;
const PATCH_META: PatchMeta[] = BUILT_IN_PATCH_NOTES.map((n) => ({ version: n.version, title: n.title, publishedAt: n.publishedAt }));

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

// Same order as the Team area's side menu (Team board, Team chat, Ideas, My to-do).
const ROOM: { key: Exclude<RoomTab, "notes">; name: string; title: string }[] = [
  { key: "team", name: "Board", title: "Team" },
  { key: "chat", name: "Chat", title: "Team chat" },
  { key: "ideas", name: "Ideas", title: "Ideas" },
  { key: "todo", name: "To-do", title: "My to-do" },
];

export default function TeamBoard({ initialTab, initialVersion, initialMessage }: {
  initialTab: RoomTab; initialVersion?: string;
  /** ?m=<id>: a phone notification opened the chat on this message. */
  initialMessage?: number | null;
}) {
  const [tab, setTab] = useState<RoomTab>(initialTab);
  const room = useTeamRoom();
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
    const q = tab === "notes" ? `?tab=notes${version ? `&v=${encodeURIComponent(version)}` : ""}` : tab === "team" ? "" : `?tab=${tab}`;
    try { window.history.replaceState(null, "", `/admin/team${q}`); } catch { /* old browser */ }
  }, [tab, version]);

  const openNote = (v: string) => { setVersion(v); setTab("notes"); setOpen(null); window.scrollTo(0, 0); };
  // The Inbox bell opens a patch note here in place (no reload).
  useEffect(() => {
    const h = (e: Event) => { const v = (e as CustomEvent<string>).detail; if (typeof v === "string") { e.preventDefault(); openNote(v); } };
    window.addEventListener(OPEN_PATCH_EVENT, h);
    return () => window.removeEventListener(OPEN_PATCH_EVENT, h);
  }, []);

  const people = useMemo(() => {
    if (!data) return [];
    return [...data.people].sort((a, b) => Date.parse(b.pushes[0]?.at ?? "0") - Date.parse(a.pushes[0]?.at ?? "0"));
  }, [data]);

  const pulls = data?.pulls ?? [];
  const waiting = waitingOnMe(room.messages, room.me, room.marks, room.acks).length;
  const toRead = (p: Person) => (isTeamPerson(p) ? patchUnread(PATCH_META, p, room.acks, TEAM_ROOM.patchReceiptsFrom).length : 0);
  const badges: Partial<Record<RoomTab, number>> = {
    team: unreadNotes(room.notes, room.me, room.read.pushNotes, "push"),
    ideas: unreadNotes(room.notes, room.me, room.read.notes, "idea"),
    chat: (tab === "chat" ? 0 : unreadChat(room.messages, room.me, room.read.chat)) + waiting,
    todo: tab === "todo" ? 0 : newGivenTasks(room.tasks, room.me, room.read.tasks) + newPushedJobs(room.jobs, room.tasks, room.me, room.seenJobs),
    notes: room.me ? toRead(room.me) + unreadNotes(room.notes, room.me, room.read.patchNotes, "patch") : 0,
  };
  const title = ROOM.find((r) => r.key === tab)?.title ?? "Team";
  return (
    <AdminShell tab={tab} role="admin" badges={badges} onTab={(t) => { setTab(t); if (t !== "notes") setVersion(undefined); }}>
      {tab === "notes" ? (
        <div className="tb-notes"><PatchNotesArchive key={version ?? "latest"} initialVersion={version} /></div>
      ) : (
        <div className="tb">
          {tab === "team" && <PitchLines />}
          <header className="tb-head">
            <div>
              <p className="tb-eyebrow">Team room</p>
              <h1 className="ash-h1">{title}</h1>
              {tab === "team" && <p className="ash-sub">Three of us. One game.</p>}
            </div>
            {tab === "team" && <DeployPill data={data} now={now} />}
          </header>
          <nav className="tr tr-seg tb-roomtabs" aria-label="Team room">
            {ROOM.map((r) => {
              const n = badges[r.key] ?? 0;
              return (
                <button key={r.key} aria-pressed={tab === r.key} onClick={() => setTab(r.key)}>
                  {r.name}{n > 0 && <span className={`tr-badge${r.key === "todo" ? " amber" : ""}`}>{n > 99 ? "99+" : n}</span>}
                </button>
              );
            })}
          </nav>

          {tab === "ideas" && <IdeasBoard />}
          {tab === "chat" && <ChatPage jumpTo={initialTab === "chat" ? initialMessage : null} />}
          {tab === "todo" && <div className="tr ash-panel tb-todo"><RoomGate><TodoList /></RoomGate></div>}
          {tab === "team" && (<>

          {error && <div className="tb-alert">{error}</div>}
          {data?.problems.map((p) => <div key={p} className="tb-alert">{p}</div>)}

          <div className="tb-grid">
            <div className="tb-people">
              {(data ? people : (["Harry", "Mikey", "Leo"] as Person[]).map((person) => ({ person, branch: person, pushes: [] as Push[], status: null }))).map((c) => (
                <PersonCard key={c.person} person={c.person} pushes={c.pushes} status={"status" in c ? c.status ?? null : null}
                  count={"count" in c ? c.count ?? null : null} logFrom={data?.pushLogFrom ?? null}
                  statusOn={!!data?.statusOn} now={now} loading={!data} onOpen={setOpen} onNote={openNote}
                  toRead={room.status === "ready" ? patchUnread(PATCH_META, c.person as TeamPersonName, room.acks, TEAM_ROOM.patchReceiptsFrom) : null} />
              ))}
            </div>
            <PullPanel pulls={pulls} now={now} loading={!data} />
          </div>
          </>)}
        </div>
      )}
      {open && <PushSheet push={open} now={now} onClose={() => setOpen(null)} onNote={openNote} />}
    </AdminShell>
  );
}

/** The faint pitch behind the board, as in the Ops room design. */
function PitchLines() {
  return (
    <svg className="tb-pitch" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMin slice" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="40" y="40" width="1120" height="620" rx="4" />
        <line x1="600" y1="40" x2="600" y2="660" />
        <circle cx="600" cy="350" r="95" />
        <rect x="40" y="200" width="150" height="300" /><rect x="1010" y="200" width="150" height="300" />
      </g>
    </svg>
  );
}

function DeployPill({ data, now }: { data: TeamBoardData | null; now: number }) {
  const d = data?.deploy;
  const state = d?.state ?? "unknown";
  const word = state === "success" ? "Live on knowitball.co.uk" : state === "pending" ? "Going live now" : state === "failure" ? "Last deploy failed" : "Checking the live site";
  const tip = d?.title ? `Last change to go live: ${d.title}` : undefined;
  return (
    <a className={`ash-panel tb-pill ${state}`} title={tip} href={d?.url ?? undefined} target="_blank" rel="noreferrer">
      <span className={`ash-dot big ${state === "success" ? "live" : state === "pending" ? "wait" : state === "failure" ? "bad" : ""}`} />
      <span><b>{word}</b>{d?.at && <small>deployed {ago(d.at, now)}{d.sha ? ` · ${d.sha.slice(0, 7)}` : ""}</small>}</span>
    </a>
  );
}

/** "Harry's patch notes: The Arcade pack" → "The Arcade pack". */
const shortTitle = (t: string) => t.replace(/^(Harry|Mikey|Leo)['’]s patch notes\s*(v[\d.]+)?\s*[:—-]?\s*/i, "").trim() || "Patch notes";

/** The patch notes a person's pushes went out in, newest first. */
function notesOf(pushes: Push[]) {
  const m = new Map<string, { version: string; title: string; url: string | null; n: number }>();
  for (const p of pushes) {
    if (!p.patch) continue;
    const g = m.get(p.patch.version) ?? { version: p.patch.version, title: shortTitle(p.patch.title), url: p.patch.artifactUrl ?? null, n: 0 };
    g.n++; m.set(p.patch.version, g);
  }
  return Array.from(m.values()).sort((a, b) => compareVersionsDesc(a.version, b.version));
}

const STATUS_WORD = { live: "Live", quiet: "Active", off: "Quiet" } as const;

function PersonCard({ person, pushes, status, count, logFrom, statusOn, now, loading, onOpen, onNote, toRead }: {
  person: Person; pushes: Push[]; status: DevStatus | null; statusOn: boolean; now: number; loading: boolean;
  /** Pushes from GitHub's push log (null = the log could not be read). */
  count: PushCount | null; logFrom: string | null;
  onOpen: (p: Push) => void; onNote: (v: string) => void;
  /** Patch notes this person still has to read (null = team room not loaded). */
  toRead: PatchMeta[] | null;
}) {
  const [all, setAll] = useState(false);
  // Merges aren't work, they are bookkeeping: left off the board.
  const work = pushes.filter((p) => !/^Merge\b/i.test(p.title));
  const last = [status?.at, count?.last, work[0]?.at].filter((x): x is string => !!x)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const live = liveness(last, now);
  // B13: real pushes (GitHub's push log, any branch, named by who pushed).
  // Without the log, the person's own changes on their branch this week.
  const week = count ? count.week : work.filter((p) => now - Date.parse(p.at) < 7 * 86400_000).length;
  const weekLine = loading ? "…"
    : !count ? `${week} change${week === 1 ? "" : "s"} this week`
    : count.weekComplete ? `${week} push${week === 1 ? "" : "es"} this week`
    : `${week}+ pushes since ${logFrom ? new Date(logFrom).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "the log starts"}`;
  const weekTitle = count
    ? "Times this person pushed to GitHub in the last 7 days, on any branch, from GitHub's push log. A push can carry several changes. Other people's work merged in from main is not counted."
    : "GitHub's push log could not be read, so this counts the changes on this person's own branch this week instead.";
  const notes = notesOf(work);
  const unsent = work.filter((p) => !p.patch).length;
  const hasBars = !!status && status.bars.length > 0;
  const asleep = !loading && (!last || now - Date.parse(last) > 2 * 86400_000);
  const shown = all ? work.slice(0, 30) : work.slice(0, 5);

  return (
    <section className={`ash-panel tb-person ${person}`}>
      <div className="tb-person-top">
        <span className={`tb-ring ${person}`}>{person[0]}</span>
        <div className="tb-who">
          <b>{person}</b>
          <small title={weekTitle} data-push-count>{weekLine}</small>
          {toRead && (toRead.length > 0
            ? <button className="tb-toread" onClick={() => onNote(toRead[toRead.length - 1].version)} title={`Not read yet: ${toRead.map((n) => `v${n.version}`).join(", ")}`}>
                <DocIcon /> {toRead.length} patch note{toRead.length === 1 ? "" : "s"} to read</button>
            : <span className="tb-toread done" title="Every patch note since the receipts started is read">✓ Patch notes read</span>)}
        </div>
        <div className={`tb-state ${live}`} title={last ? clock(last) : ""}>
          <b><span className={`ash-dot ${live === "live" ? "live" : live === "quiet" ? "on" : ""}`} /> {loading ? "…" : STATUS_WORD[live]}</b>
          <small>{loading ? "" : last ? ago(last, now) : "—"}</small>
        </div>
      </div>

      {hasBars ? (
        <div className="tb-sec">
          <p className="tb-label">Current work</p>
          {status!.bars.map((b, i) => (
            <div key={i} className="tb-work">
              <div className="tb-work-h"><b>{b.label}</b><span>{b.pct}%</span></div>
              {b.note && <small>{b.note}</small>}
              <span className="tb-track"><i style={{ width: `${b.pct}%` }} /></span>
            </div>
          ))}
          {status!.waiting && (
            <div className="tb-waiting"><ClockIcon /><span><small>Waiting on</small><b>{status!.waiting}</b></span></div>
          )}
        </div>
      ) : asleep ? (
        <div className="tb-empty">
          <PitchIcon />
          <b>No live updates yet</b>
          <small>{last ? `${person} hasn't pushed for ${ago(last, now).replace(" ago", "")}.` : `${person} hasn't pushed yet.`}</small>
        </div>
      ) : work[0] ? (
        <button className="tb-latest" onClick={() => onOpen(work[0])} title={statusOn ? "Live bars show here after the next progress update." : "Live bars are off until Mikey switches them on."}>
          <BranchIcon />
          <span><small>Latest push · {ago(work[0].at, now)}</small><b>{work[0].title}</b>
            {work[0].patch ? <em>In v{work[0].patch.version}</em> : <em className="new">Not in patch notes yet</em>}</span>
          <span className="tb-chev">›</span>
        </button>
      ) : null}

      <Activity days={count ? count.days : perDay(work, now, 14)} />

      <div className="tb-sec">
        <div className="tb-label-row">
          <p className="tb-label"><BranchIcon /> Recent pushes</p>
          {work.length > 5 && <button className="tb-link" onClick={() => setAll(!all)}>{all ? "Fewer" : "View all"} →</button>}
        </div>
        {loading ? <p className="tb-muted">Loading…</p> : work.length === 0 ? <p className="tb-muted">No pushes yet</p> : (
          <ul className="tb-pushes">
            {shown.map((p) => (
              <li key={p.sha}>
                <button onClick={() => onOpen(p)} title={p.title}>
                  <span className={`tb-pdot ${p.patch ? "in" : ""}`} />
                  <span className="tb-sha">{p.sha.slice(0, 7)}</span>
                  <span className="tb-msg">{p.title}</span>
                  <NoteCount kind="push" id={p.sha} />
                  <span className="tb-time">{ago(p.at, now).replace(" ago", "")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && (notes.length > 0 || unsent > 0) && (
        <details className="tb-notesdrop">
          <summary><DocIcon /> Patch notes <span className="tb-count">{[notes.length ? `${notes.length} out` : "", unsent ? `${unsent} pushes not in yet` : ""].filter(Boolean).join(" · ")}</span></summary>
          <ul>
            {notes.map((n) => (
              <li key={n.version}>
                <button onClick={() => onNote(n.version)} title={`Open v${n.version} in Patch notes`}>
                  <span className="ash-tag green">v{n.version}</span>
                  <span className="tb-msg">{n.title}</span>
                  <span className="tb-time">{n.n} push{n.n === 1 ? "" : "es"}</span>
                </button>
              </li>
            ))}
            {unsent > 0 && <li className="tb-unsent"><span className="ash-tag grey">next</span><span className="tb-msg">{unsent} push{unsent === 1 ? "" : "es"} waiting for the next patch notes</span></li>}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Pushes per day over two weeks, with a scale. A day before GitHub's push
 *  log starts (null) is left empty and named under the chart, never drawn
 *  as zero. */
function Activity({ days }: { days: (number | null)[] }) {
  const max = Math.max(2, ...days.map((n) => n ?? 0));
  const top = Math.ceil(max / 2) * 2;
  const unknown = days.filter((n) => n === null).length;
  return (
    <div className="tb-sec">
      <p className="tb-label">Activity · pushes a day</p>
      <div className="tb-chart" title={days.map((n, i) => `${13 - i === 0 ? "today" : `${13 - i}d ago`}: ${n ?? "not in the log"}`).join(" · ")}>
        <div className="tb-y"><span>{top}</span><span>{top / 2}</span><span>0</span></div>
        <div className="tb-bars14">
          {days.map((n, i) => (n === null
            ? <i key={i} style={{ height: 0, background: "transparent" }} />
            : <i key={i} style={{ height: `${Math.max(3, (n / top) * 100)}%` }} className={n ? "" : "zero"} />))}
        </div>
      </div>
      <div className="tb-x"><span>2 weeks ago</span><span>1 week</span><span>today</span></div>
      {unknown > 0 && <p className="tb-muted" style={{ marginTop: 4, fontSize: 11 }}>The first {unknown} day{unknown === 1 ? "" : "s"}: not known (GitHub keeps its last 300 events).</p>}
    </div>
  );
}

function PullPanel({ pulls, now, loading }: { pulls: PullRequest[]; now: number; loading: boolean }) {
  const open = pulls.filter((p) => p.state === "open").length;
  const merged = pulls.filter((p) => p.state === "merged").length;
  return (
    <aside className="ash-panel tb-prs">
      <div className="tb-prs-h">
        <h2><BranchIcon /> Pull requests</h2>
        <span className="tb-prs-c"><span className="on">{open} open</span><span>{merged} merged</span></span>
      </div>
      {loading ? <p className="tb-muted">Loading…</p> : pulls.length === 0 ? <p className="tb-muted">None right now</p> : (
        <ul>
          {pulls.slice(0, 10).map((p) => (
            <li key={p.number}>
              <a href={p.url} target="_blank" rel="noreferrer" title={p.title}>
                <span className="tb-pr-t"><b>#{p.number}</b> {p.title}</span>
                <span className="tb-pr-b">main ← {p.branch}</span>
                <span className="tb-pr-m">
                  <span className={`ash-av ${p.person ?? "Shared"} tb-av-sm`}>{(p.person ?? "?")[0]}</span>
                  <span>{p.person ?? p.login}</span>
                  <span className="tb-time">{ago(p.at, now)}</span>
                  <span className={`tb-st ${p.state}`}>{p.state === "merged" ? "Merged" : p.state === "open" ? "Open" : "Closed"}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

const ClockIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const BranchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="6" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="8" r="2.2" /><path d="M6 7.2v9.6M18 10.2c0 4-6 3-11 7" /></svg>;
const DocIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
const PitchIcon = () => (
  <svg width="120" height="84" viewBox="0 0 120 84" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="tb-pitchicon">
    <rect x="6" y="20" width="108" height="60" rx="3" /><line x1="60" y1="20" x2="60" y2="80" /><circle cx="60" cy="50" r="11" />
    <path d="M6 38h10v24H6M114 38h-10v24h10" />
    <text x="78" y="16" fontSize="13" fill="currentColor" stroke="none" fontWeight="700">z</text>
    <text x="88" y="10" fontSize="11" fill="currentColor" stroke="none" fontWeight="700">z</text>
    <text x="96" y="5" fontSize="9" fill="currentColor" stroke="none" fontWeight="700">z</text>
  </svg>
);

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
        <div className="tr tb-pushnotes"><NotesThread kind="push" id={push.sha} owner={isTeamPerson(push.person) ? push.person : null} /></div>
      </div>
    </div>
  );
}
