"use client";
/**
 * "Live share (test)" on the Videos page (Harry, 20 Oct 2026). Share a screen
 * and talk; a Claude chat sees a picture a second and reads what you
 * said, and answers in its chat. The idea and its pure parts:
 * lib/liveShare.ts. Admins only.
 */
import { useEffect, useRef, useState } from "react";
import { claudeLineFor, clock, liveLink } from "@/lib/liveShare";
import { canLiveShare, speechCtor, startLiveShare, type LiveShareHandle, type LiveStatus } from "@/lib/liveShareBrowser";

const VOICE_TEXT: Record<LiveStatus["voice"], string> = {
  on: "Listening: what you say is written down.",
  none: "No voice in this browser (use Chrome, Edge or Safari on a computer). Type below instead.",
  blocked: "The microphone wasn't allowed, so nothing you say is written down. Type below instead.",
  off: "Voice off. Type below instead.",
};

export default function LiveShareCard({ who }: { who: string }) {
  const [can, setCan] = useState(true);
  const [hasVoice, setHasVoice] = useState(true);
  const [voice, setVoice] = useState(true);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [deleted, setDeleted] = useState<"no" | "busy" | "yes">("no");
  const [now, setNow] = useState(Date.now());
  const handle = useRef<LiveShareHandle | null>(null);

  useEffect(() => { setCan(canLiveShare()); setHasVoice(!!speechCtor()); }, []);
  useEffect(() => {
    if (!status || status.over) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);
  // Leaving the page ends the share.
  useEffect(() => () => { void handle.current?.stop(); }, []);

  const start = async () => {
    setError(null); setDeleted("no"); setCopied(null);
    try {
      handle.current = await startLiveShare({ who, voice, onStatus: setStatus });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const stop = async () => { await handle.current?.stop(); };
  const remove = async () => {
    if (!status) return;
    setDeleted("busy");
    const r = await fetch(`/api/admin/live-share?code=${status.code}`, { method: "DELETE" }).catch(() => null);
    setDeleted(r?.ok ? "yes" : "no");
    if (!r?.ok) setError("The pictures weren't deleted. Try again.");
  };
  const copy = (key: string, text: string) =>
    navigator.clipboard?.writeText(text).then(() => setCopied(key), () => setCopied(null));
  const send = () => { if (note.trim()) { handle.current?.type(note); setNote(""); } };

  const link = status ? liveLink(status.code, typeof window !== "undefined" ? window.location.origin : undefined) : "";
  const live = !!status && !status.over;
  const sentAgo = status?.lastSentAt ? Math.max(0, Math.round((now - status.lastSentAt) / 1000)) : null;

  return (
    <section className="ash-panel vt-card ls">
      <div className="ls-head">
        <p className="vt-label">Live share (test)</p>
        {live && <span className="vt-rec"><i /> Live · {clock(now - status.startedAt)}</span>}
      </div>
      <p className="ls-sub">Share your screen and talk. Claude sees a picture a second, reads what you say, and answers in its chat. Good for showing a screen quickly without a push.</p>

      {!can && <p className="vt-note">This browser can't share its screen. Use Chrome or Edge on a computer.</p>}

      {can && !live && (
        <div className="vt-go">
          <button className="vt-record ls-start" onClick={start}><i /> Start live share</button>
          <label className="ash-toggle vt-mic">
            <span>Voice</span>
            <button className="ash-pill-sw" role="switch" aria-checked={voice && hasVoice} disabled={!hasVoice}
              onClick={() => setVoice(!voice)} aria-label="Voice" />
          </label>
        </div>
      )}
      {can && !hasVoice && !live && <p className="vt-hint">No voice in this browser. You can type notes while it runs.</p>}

      {status && (
        <div className="ls-box">
          <div className="ls-code">
            <span>Code</span><b className="ash-mono">{status.code}</b>
          </div>
          <p className="ls-step"><b>1.</b> Paste this into a Claude chat:</p>
          <code className="ash-mono ls-line">{claudeLineFor(status.code)}</code>
          <div className="vt-row">
            <button className="ash-btn" onClick={() => copy("claude", claudeLineFor(status.code))}>{copied === "claude" ? "Copied" : "Copy for Claude"}</button>
            <button className="ash-btn ghost" onClick={() => copy("link", link)}>{copied === "link" ? "Copied" : "Copy link"}</button>
            <a className="ash-btn ghost" href={link} target="_blank" rel="noreferrer">Watch it ↗</a>
          </div>
          <p className="ls-step"><b>2.</b> Go to the game and talk. Claude answers in its chat.</p>

          {live && (
            <>
              <p className="ls-meta">
                {status.frames} pictures sent{sentAgo != null ? ` · newest ${sentAgo} s ago` : ""} · ends by itself at {clock(status.endsAt - status.startedAt)}
              </p>
              <p className={status.voice === "on" ? "vt-ok" : "vt-hint"}>{VOICE_TEXT[status.voice]}</p>
              {status.hearing && <p className="ls-hearing">“{status.hearing}…”</p>}
              <div className="ls-type">
                <input className="vt-input" value={note} maxLength={300} placeholder="Type a note for Claude"
                  onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
                <button className="ash-btn ghost" onClick={send}>Send</button>
              </div>
              <button className="vt-stop" onClick={stop}>Stop</button>
            </>
          )}

          {status.lines.length > 0 && (
            <ol className="ls-lines">
              {status.lines.slice(-6).map((l) => (
                <li key={l.n}><span className="ash-mono">{clock(l.at)}</span> {l.text}{l.by === "typed" ? " (typed)" : ""}</li>
              ))}
            </ol>
          )}

          {status.over && (
            <div className="ls-end">
              <b>Stopped.</b> {status.frames} pictures, {status.lines.length} lines.
              {deleted === "yes"
                ? <span className="vt-ok"> Deleted: the pictures and lines are gone.</span>
                : <button className="ash-btn" onClick={remove} disabled={deleted === "busy"}>{deleted === "busy" ? "Deleting…" : "Delete"}</button>}
            </div>
          )}
          {status.error && <p className="vt-err">{status.error}</p>}
        </div>
      )}
      {error && <p className="vt-err">{error}</p>}

      <ul className="ls-limits">
        <li>A picture a second when the screen changes, not smooth video.</li>
        <li>Claude answers in its chat in about 5–20 s, and may speak up when it sees something.</li>
        <li>Use a computer browser. Android browsers can't share the screen; iPhone only from iOS 27 (not tried yet).</li>
        <li>The link isn't listed anywhere, but anyone with the code can see the pictures while it runs. Don't share private things.</li>
        <li>Pictures and lines are deleted when you press Stop, then Delete.</li>
      </ul>
    </section>
  );
}
