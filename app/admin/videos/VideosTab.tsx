"use client";
/** The Videos tab: three steps and one line to copy. Kept short on purpose. */
import { useState } from "react";
import AdminShell from "@/components/admin/shell/AdminShell";

const STARTER = "Watch this recording: <paste the link here>";

export default function VideosTab({ role }: { role: "admin" | "tester" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(STARTER).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <AdminShell tab="videos" role={role}>
      <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 className="ash-h1">Videos</h1>
          <p className="ash-sub">Record the game while you talk. Claude turns it into pictures and a transcript, and checks every point.</p>
        </div>
        <ol className="ash-panel" style={{ margin: 0, padding: "14px 18px 14px 36px", display: "flex", flexDirection: "column", gap: 10, fontSize: 14.5 }}>
          <li><b>Record</b> with the microphone on. Say what you expected and what happened.</li>
          <li><b>Share it</b> as a Google Drive or Dropbox link set to &quot;Anyone with the link&quot;. Loom and TikTok links work too.</li>
          <li><b>Paste the link</b> into a Claude chat with the line below.</li>
        </ol>
        <div className="ash-panel" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <code className="ash-mono" style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{STARTER}</code>
          <button className="ash-btn" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <p className="ash-sub" style={{ fontSize: 12.5 }}>You get the findings in the chat, a page with every stretch of the video, and a copy in Drive → Knowitball playtest recordings → Breakdowns, named by date, who and what it is about.</p>
        <a className="ash-btn ghost" style={{ alignSelf: "flex-start" }} href="https://drive.google.com/drive/folders/18Gn5Q-pluXr_FjBTqtvADLOwq-oMAq87" target="_blank" rel="noreferrer">Open the Breakdowns folder ↗</a>
      </div>
    </AdminShell>
  );
}
