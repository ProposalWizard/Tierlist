"use client";
/**
 * components/teamRoom/roomTools.tsx — every channel's own way of working
 * (Harry, 12 Nov 2026: "each page gets its own custom stuff"). Which tabs a
 * channel has is decided in lib/teamRoom/channels.ts (CHANNEL_TABS); this file
 * draws each one:
 *
 *   #today        Today (each person's check-in) · This week (a grid)
 *   #ideas        Ideas board (post, 👍, Ideas / Doing / Done)
 *   #todo         Tasks (Mine | Everyone, proposals with Accept / Decline)
 *   #bugs         Open reports · Fixed (cards from players' reports)
 *   #health       Limits (the morning post in four coloured lines + history)
 *   #patch-notes  Archive (every announced note and who has read it)
 *   #marketing    Production board (how many videos at each step)
 *   #context      Brain (where the notes live)
 */
import { useMemo, useState } from "react";
import bundledBoard from "@/marketing/board.json";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { patchAuthor, patchReaders } from "@/lib/teamRoom/extras";
import { stamp, tasksFor } from "@/lib/teamRoom/logic";
import { asksFor, askTitle } from "@/lib/teamRoom/asks";
import { pushedFor } from "@/lib/teamRoom/jobs";
import { CHANNEL_HOW, type Channel } from "@/lib/teamRoom/channels";
import { everyoneRead } from "@/lib/teamRoom/patchBot";
import { HEALTH_WORD, healthLevel, healthLines, healthPosts, isLimitsPost, latestLimits } from "@/lib/teamRoom/health";
import { checkInBody, checkInsFor, ukDay, weekGrid } from "@/lib/teamRoom/today";
import { STAGES, parseBoard } from "@/lib/marketing/board";
import { sendMessage, setAck, useTeamRoom } from "@/lib/teamRoom/store";
import type { BotRow } from "@/lib/teamRoom/channels";
import { Av, TodoList } from "./parts";
import IdeasBoard from "./IdeasBoard";
import { PATCH_META } from "./roomCounts";
import { BugList } from "./roomBugs";

/** The line at the top of a working tab: what this channel is for. */
const What = ({ slug }: { slug: string }) => (CHANNEL_HOW[slug] ? <p className="trh-what">{CHANNEL_HOW[slug]}</p> : null);

export function ChannelPanel({ channel, tab, onOpenPatch, onBot }: { channel: Channel; tab: string; onOpenPatch?: (v: string) => void; onBot?: (bot: string) => void }) {
  if (tab === "today") return <div className="trw-pad trh"><What slug="today" /><TodayTab /></div>;
  if (tab === "week") return <div className="trw-pad trh"><WeekTab /></div>;
  if (tab === "ideas") return <div className="trw-pad trh"><What slug="ideas" /><IdeasBoard /></div>;
  if (tab === "tasks") return <TasksTab />;
  if (tab === "open") return <div className="trw-pad trh"><What slug="bugs" /><BugList show="open" /></div>;
  if (tab === "fixed") return <div className="trw-pad trh"><BugList show="fixed" /></div>;
  if (tab === "health") return <HealthTab onBot={onBot} />;
  if (tab === "archive") return <Archive onOpenPatch={onOpenPatch} />;
  if (tab === "production") return <ProductionTab />;
  if (tab === "brain") return (
    <div className="trw-pad trh trw-links">
      <What slug={channel.slug} />
      <a className="tr-pcard" href="https://github.com/ProposalWizard/Tierlist/blob/main/brain/_index.md" target="_blank" rel="noreferrer">
        <span className="ic" aria-hidden>🧠</span><span className="tx"><b>The Brain&apos;s index</b><small>Every note on GitHub, one line each. A Claude chat writes a new note from what is posted here.</small></span><span className="go" aria-hidden>↗</span>
      </a>
    </div>
  );
  return null;
}

/* ── #today ─────────────────────────────────────────────────────────── */

function TodayTab() {
  const s = useTeamRoom();
  const now = Date.now();
  const have = checkInsFor(s.messages, ukDay(now).day);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!text.trim()) return;
    const r = await sendMessage(checkInBody(text), null, "/admin/team?tab=chat&ch=today");
    if (r.ok) { setText(""); setErr(null); } else setErr(r.error);
  };
  return (
    <div className="trh-today">
      {TEAM_PEOPLE.map((p) => {
        const c = have[p];
        return (
          <div key={p} className={`trh-ci${c ? "" : " none"}`} data-checkin={p}>
            <Av p={p} card />
            <span className="tx"><b>{p}{p === s.me ? " (you)" : ""}</b><span>{c ? c.text : "Not checked in yet today."}</span>{c && <small>{stamp(c.at, now)}</small>}</span>
          </div>
        );
      })}
      {s.me && (
        <span className="tr-add">
          <input id="trh-checkin" value={text} maxLength={200} placeholder={have[s.me] ? "Change your line for today…" : "What are you on today? One line."} aria-label="Your check-in for today"
            onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
          <button className="tr-btn" onClick={save} disabled={!text.trim()}>{have[s.me] ? "Update" : "Check in"}</button>
        </span>
      )}
      {err && <p className="tr-err">{err}</p>}
    </div>
  );
}

function WeekTab() {
  const s = useTeamRoom();
  const rows = useMemo(() => weekGrid(s.messages, Date.now()), [s.messages]);
  return (
    <>
      <p className="trh-what">This week, a row a day. A cell is that person&apos;s check-in for the day; an empty one means none was written.</p>
      <table className="trh-week">
        <thead><tr><th>Day</th>{TEAM_PEOPLE.map((p) => <th key={p}><Av p={p} xs />{p}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} className={r.today ? "today" : r.future ? "future" : undefined}>
              <td>{r.label}{r.today ? " · today" : ""}</td>
              {TEAM_PEOPLE.map((p) => <td key={p} className={r.cells[p] ? undefined : "none"}>{r.cells[p]?.text ?? (r.future ? "" : "–")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ── #todo ──────────────────────────────────────────────────────────── */

function TasksTab() {
  const [who, setWho] = useState<"mine" | "everyone">("mine");
  return (
    <div className="trw-pad trh trw-jobs">
      <What slug="todo" />
      <div className="tr-seg trh-seg" role="group" aria-label="Whose tasks">
        <button aria-pressed={who === "mine"} onClick={() => setWho("mine")}>Mine</button>
        <button aria-pressed={who === "everyone"} onClick={() => setWho("everyone")}>Everyone</button>
      </div>
      {who === "mine" ? <div className="trh-todo"><TodoList visible /></div> : <EveryoneTasks />}
    </div>
  );
}

/** Everyone's open jobs side by side (to look, not to tick: each person ticks their own). */
function EveryoneTasks() {
  const s = useTeamRoom();
  const now = Date.now();
  return (
    <div className="trh-everyone">
      {TEAM_PEOPLE.map((p) => {
        const l = tasksFor(s.tasks, p, now);
        const open = [...l.given, ...l.mine];
        const asks = asksFor(s.tasks, p);
        const pushed = pushedFor(s.jobs, s.tasks, p, now).open;
        const n = open.length + pushed.length;
        return (
          <section key={p} className="trh-card" aria-label={`${p}'s tasks`}>
            <h3><Av p={p} card />{p}<small>{n} open{asks.length ? ` · ${asks.length} to answer` : ""}</small></h3>
            {n === 0 && asks.length === 0 && <p className="tr-muted">Nothing open.</p>}
            {asks.map((x) => (
              <div key={`a${x.id}`} className="trh-erow"><span className="tx">{askTitle(x).replace(/\s*\(message \d+\)$/, "")}<small>asked by {x.made_by} · {stamp(x.created_at, now)}</small></span><span className="tag">proposal</span></div>
            ))}
            {open.map((x) => (
              <div key={x.id} className="trh-erow"><span className="tx">{x.title}<small>{x.made_by === p ? "their own" : `from ${x.made_by}`} · {stamp(x.created_at, now)}</small></span></div>
            ))}
            {pushed.map((j) => (
              <div key={j.id} className="trh-erow"><span className="tx">{j.title}<small>from a push · {j.from}</small></span></div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/* ── #health ────────────────────────────────────────────────────────── */

/** A Health bot post as its coloured lines (used in the chat too). */
export function HealthLines({ row }: { row: Pick<BotRow, "body" | "meta"> }) {
  const lines = healthLines(row);
  return (
    <ul className="trh-hlines">
      {lines.map((l, i) => (
        <li key={i}>{l.note ? <span className="trh-dot" aria-hidden /> : <span className={`trh-dot ${l.level}`} role="img" aria-label={l.level === "unknown" ? "not read" : l.level} />}<span>{l.text}</span></li>
      ))}
    </ul>
  );
}

function HealthTab({ onBot }: { onBot?: (bot: string) => void }) {
  const s = useTeamRoom();
  const now = Date.now();
  const latest = useMemo(() => latestLimits(s.botRows), [s.botRows]);
  const history = useMemo(() => healthPosts(s.botRows, 14), [s.botRows]);
  return (
    <div className="trw-pad trh">
      <What slug="health" />
      <div className="trh-health">
        {latest ? (
          <section className="trh-card" aria-label="The newest limits post">
            <h3>{latest.title.split(" · ").slice(0, 2).join(" · ")}<span className={`trh-level ${healthLevel(latest)}`} style={{ marginLeft: "auto" }}>{HEALTH_WORD[healthLevel(latest)]}</span></h3>
            <HealthLines row={latest} />
            <small className="tr-muted">Posted {stamp(latest.created_at, now)}. Amber at 75% full, red at 90%.</small>
          </section>
        ) : (
          <p className="trh-empty"><b>No morning post yet.</b>The Health bot posts at 08:00 UK time once the site&apos;s timer is switched on. An admin can also press Run now on its page.</p>
        )}
        {history.length > 0 && (
          <section className="trh-card" aria-label="History">
            <p className="trh-lbl">History · last {history.length}</p>
            <div className="trh-hist">
              {history.map((r) => (
                <div key={r.id}>
                  <span className="dots">{isLimitsPost(r) ? healthLines(r).filter((l) => !l.note).map((l, i) => <span key={i} className={`trh-dot ${l.level}`} title={l.text} />) : <span className="trh-dot red" />}</span>
                  <span className="t" title={r.title}>{r.title}</span>
                  <small>{stamp(r.created_at, now)}</small>
                </div>
              ))}
            </div>
          </section>
        )}
        {onBot && <button className="trh-linkbtn" onClick={() => onBot("health")}>Open the Health bot&apos;s page (when it runs, Run now) →</button>}
      </div>
    </div>
  );
}

/* ── #patch-notes ───────────────────────────────────────────────────── */

/** Every patch note since the receipts started: who has read it, your button, and where its post is now. */
function Archive({ onOpenPatch }: { onOpenPatch?: (v: string) => void }) {
  const s = useTeamRoom();
  const start = Date.parse(TEAM_ROOM.patchReceiptsFrom) || 0;
  const notes = PATCH_META.filter((n) => (Date.parse(n.publishedAt) || 0) >= start);
  return (
    <div className="trw-pad trh trw-receipts">
      <What slug="patch-notes" />
      {notes.map((n) => {
        const readers = patchReaders(n, s.acks);
        const author = patchAuthor(n.title);
        const mine = !!s.me && readers.includes(s.me);
        const all = everyoneRead(n, s.acks);
        return (
          <div key={n.version} className="trw-rc">
            <span className="tx"><b>v{n.version}</b><small>{n.title} · {all ? "everyone has read it" : `waiting on ${TEAM_PEOPLE.filter((p) => !readers.includes(p)).join(" and ")}`}</small></span>
            <span className="faces">{TEAM_PEOPLE.map((p: TeamPerson) => <Av key={p} p={p} xs off={!readers.includes(p)} title={p === author ? `${p} wrote it` : readers.includes(p) ? `${p} has read it` : `${p} hasn't yet`} />)}</span>
            {s.me && s.me !== author && (
              <button className={`tr-btn${mine ? " ghost" : ""}`} onClick={() => setAck("patch", n.version, !mine)} title={mine ? "Take back your Read and understood" : "Say you have read and understood it"}>{mine ? "✓ Read" : "Read"}</button>
            )}
            {onOpenPatch && <button className="tr-btn ghost" onClick={() => onOpenPatch(n.version)}>Open</button>}
          </div>
        );
      })}
      {s.v2 === "off" && <p className="tr-muted">Ticks here are saved on this device only until <code>{TEAM_ROOM.sqlFileV2}</code> runs.</p>}
    </div>
  );
}

/* ── #marketing ─────────────────────────────────────────────────────── */

const MARKETING_LINKS = [
  { url: "/admin/marketing", name: "Production board", line: "Every video and the step it is at" },
  { url: "/admin/marketing/studio", name: "Studio", line: "The editing suite: watch a cut, leave notes and edits for Claude" },
  { url: "/admin/marketing/uploads", name: "Uploads", line: "Put videos and pictures into private storage" },
];

/** The production board in one card: how many videos are at each of the seven steps (as of the last deploy). */
function ProductionTab() {
  const cards = useMemo(() => parseBoard(bundledBoard), []);
  const waiting = cards.filter((c) => c.stage !== "posted").sort((a, b) => (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0));
  return (
    <div className="trw-pad trh trw-links">
      <What slug="marketing" />
      <section className="trh-card" aria-label="Production board summary">
        <h3>Production board<small>{cards.length} video{cards.length === 1 ? "" : "s"}</small></h3>
        <div className="trh-stages">
          {STAGES.map((st) => {
            const n = cards.filter((c) => c.stage === st.key).length;
            return <div key={st.key} className={`trh-stage${n ? " has" : ""}`} title={st.help}><b>{n}</b><small>{st.name}</small></div>;
          })}
        </div>
        {waiting.length > 0 && <p className="trh-lbl">Not posted yet · {waiting.length}</p>}
        {waiting.slice(0, 4).map((c) => (
          <div key={c.id} className="trh-erow"><span className="tx">{c.title}<small>{STAGES.find((x) => x.key === c.stage)?.name} · {c.owner}</small></span></div>
        ))}
        <small className="tr-muted">Counted from the board as it was at the last deploy. The live board is one tap away.</small>
      </section>
      {MARKETING_LINKS.map((l) => (
        <a key={l.url} className="tr-pcard" href={l.url}><span className="ic" aria-hidden>🎬</span><span className="tx"><b>{l.name}</b><small>{l.line}</small></span><span className="go" aria-hidden>›</span></a>
      ))}
    </div>
  );
}
