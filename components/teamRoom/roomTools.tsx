"use client";
/**
 * components/teamRoom/roomTools.tsx — the tool a channel carries as a tab
 * beside its messages: #ideas the idea board, #todo the jobs, #marketing the
 * video links, #context the Brain, #patch-notes who has read each note,
 * #bugs the open bug reports (the Bug bot, roomBugs.tsx).
 */
import { TEAM_PEOPLE, TEAM_ROOM } from "@/lib/teamRoom/config";
import { patchAuthor, patchReaders } from "@/lib/teamRoom/extras";
import type { ChannelTool } from "@/lib/teamRoom/channels";
import { setAck, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, TodoList } from "./parts";
import IdeasBoard from "./IdeasBoard";
import { PATCH_META } from "./roomCounts";
import { BugList } from "./roomBugs";

/** The name of a channel's tool tab (null = Messages and Pinned only). */
export const TOOL_TAB: Record<ChannelTool, string | null> = {
  pinned: null, none: null, ideas: "💡 Board", marketing: "🎬 Studio", context: "🧠 Brain", jobs: "✓ Tasks", patches: "📄 Receipts", bugs: "🐞 Open reports",
};

const MARKETING_LINKS = [
  { url: "/admin/marketing/studio", name: "Studio", line: "The editing suite: watch a cut, leave notes and edits for Claude" },
  { url: "/admin/marketing/uploads", name: "Uploads", line: "Put videos and pictures into private storage" },
  { url: "/admin/marketing", name: "Production board", line: "Every video and the step it is at" },
  { url: "/admin/marketing/client", name: "Knowitball client", line: "Our voice, audience, rules and best scripts" },
];

export function ToolPanel({ tool, onOpenPatch, onOpenThread }: { tool: ChannelTool; onOpenPatch?: (v: string) => void; onOpenThread?: (key: string) => void }) {
  if (tool === "ideas") return <div className="trw-pad"><IdeasBoard /></div>;
  if (tool === "jobs") return <div className="trw-pad trw-jobs"><TodoList visible /></div>;
  if (tool === "bugs") return <div className="trw-pad"><BugList onOpen={onOpenThread} /></div>;
  if (tool === "marketing") return (
    <div className="trw-pad trw-links">
      {MARKETING_LINKS.map((l) => (
        <a key={l.url} className="tr-pcard" href={l.url}><span className="ic" aria-hidden>🎬</span><span className="tx"><b>{l.name}</b><small>{l.line}</small></span><span className="go" aria-hidden>›</span></a>
      ))}
    </div>
  );
  if (tool === "context") return (
    <div className="trw-pad trw-links">
      <p className="tr-muted">Drop facts and rulings here as messages. They become Brain notes (brain/ in the code) when a Claude chat writes them up; later a Claude bot will propose them here for a yes or no.</p>
      <a className="tr-pcard" href="https://github.com/ProposalWizard/Tierlist/blob/main/brain/_index.md" target="_blank" rel="noreferrer">
        <span className="ic" aria-hidden>🧠</span><span className="tx"><b>The Brain&apos;s index</b><small>Every note on GitHub, one line each</small></span><span className="go" aria-hidden>↗</span>
      </a>
    </div>
  );
  if (tool === "patches") return <Receipts onOpenPatch={onOpenPatch} />;
  return null;
}

/** #patch-notes → Receipts: every patch note since the receipts started, who has read it, your button. */
function Receipts({ onOpenPatch }: { onOpenPatch?: (v: string) => void }) {
  const s = useTeamRoom();
  const start = Date.parse(TEAM_ROOM.patchReceiptsFrom) || 0;
  const notes = PATCH_META.filter((n) => (Date.parse(n.publishedAt) || 0) >= start);
  return (
    <div className="trw-pad trw-receipts">
      {notes.map((n) => {
        const readers = patchReaders(n, s.acks);
        const author = patchAuthor(n.title);
        const mine = !!s.me && readers.includes(s.me);
        return (
          <div key={n.version} className="trw-rc">
            <span className="tx"><b>v{n.version}</b><small>{n.title}</small></span>
            <span className="faces">{TEAM_PEOPLE.map((p) => <Av key={p} p={p} xs off={!readers.includes(p)} title={p === author ? `${p} wrote it` : readers.includes(p) ? `${p} has read it` : `${p} hasn't yet`} />)}</span>
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
