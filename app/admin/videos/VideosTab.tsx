"use client";
/**
 * The Videos tab (Harry, 18 Oct 2026): record your screen and voice right
 * here, and the recording goes straight to your Drive with a clear name and a
 * line to paste to Claude. A phone records with its own screen recorder and
 * uploads the file here. The breakdown itself runs in a Claude chat
 * (skill screen-video).
 *
 * The recorder itself lives above every page (components/admin/recorder/
 * RecorderProvider.tsx, Harry 12 Nov 2026: leaving this page stopped the
 * recording). This page is its controls; the recording carries on if you
 * leave, with a pill at the bottom of every page.
 */
import { useEffect, useRef, useState } from "react";
import AdminShell from "@/components/admin/shell/AdminShell";
import { RECORDERS, DRIVE_CLIENT_ID, DRIVE_FOLDER_NAME, canRecordScreen, driveWasGranted, lengthLabel, starterFor } from "@/lib/recording";
import { useRecorder } from "@/components/admin/recorder/RecorderProvider";
import LiveShareCard from "./LiveShareCard";
import "./videos.css";

export default function VideosTab({ role }: { role: "admin" | "tester" }) {
  const {
    who, pickWho, about, setAbout, mic, setMic, live, secs, take, name, driveOk, upload, mk, error,
    begin: startRec, stop, connect, saveToDrive, fromFile: takeFile, sendToMarketing, download,
  } = useRecorder();
  const [canScreen, setCanScreen] = useState(true);
  const [granted, setGranted] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCanScreen(canRecordScreen()); setGranted(driveWasGranted()); }, []);
  useEffect(() => { if (driveOk) setGranted(true); }, [driveOk]);

  const begin = () => { setCopied(false); void startRec(); };
  const fromFile = (f: File | undefined) => { setCopied(false); takeFile(f); };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false));

  return (
    <AdminShell tab="videos" role={role}>
      <div className="vt">
        <div>
          <h1 className="ash-h1">Videos</h1>
          <p className="ash-sub">Record the game while you talk. It goes to your Drive with a clear name, ready for Claude.</p>
        </div>

        <section className="ash-panel vt-card">
          <p className="vt-label">Who is recording</p>
          <div className="vt-chips">
            {RECORDERS.map((w) => (
              <button key={w} className="ash-chip" aria-pressed={who === w} onClick={() => pickWho(w)}>{w}</button>
            ))}
          </div>

          <label className="vt-label" htmlFor="vt-about">What is it about?</label>
          <input id="vt-about" className="vt-input" value={about} maxLength={60} placeholder="keeper dive feels slow"
            onChange={(e) => setAbout(e.target.value)} />

          {canScreen ? (
            live ? (
              <div className="vt-live">
                <span className="vt-rec"><i /> Recording · {lengthLabel(secs)}</span>
                <button className="vt-stop" onClick={stop}>Stop</button>
              </div>
            ) : (
              <div className="vt-go">
                <button className="vt-record" onClick={begin}><i /> Record screen</button>
                <label className="ash-toggle vt-mic">
                  <span>Microphone</span>
                  <button className="ash-pill-sw" role="switch" aria-checked={mic} onClick={() => setMic(!mic)} aria-label="Microphone" />
                </label>
              </div>
            )
          ) : (
            <p className="vt-note">This browser can't record the screen. On a phone, use the phone's own screen recorder (with the microphone on), then upload the file below.</p>
          )}

          <div className="vt-drive">
            {DRIVE_CLIENT_ID ? (
              driveOk ? <span className="vt-ok">● Drive connected. Each recording goes into “{DRIVE_FOLDER_NAME}” → {who}, and {who}’s Claude chats read it next time you message them.</span>
                : granted ? <span className="vt-ok">● Drive remembered on this device. When you press Stop, the site asks Google for a fresh key without the Allow box.</span>
                : <><button className="ash-btn ghost" onClick={connect}>Connect Drive</button><span className="vt-hint">Do this once on this device, and each recording saves itself.</span></>
            ) : (
              <span className="vt-hint">Drive isn't switched on yet. Recordings download to this device for now.</span>
            )}
          </div>

          <button className="vt-link" onClick={() => fileRef.current?.click()}>Recorded on your phone? Upload the file</button>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => fromFile(e.target.files?.[0])} />
          {error && <p className="vt-err">{error}</p>}
        </section>

        {take && (
          <section className="ash-panel vt-card">
            <video className="vt-video" src={take.url} controls playsInline />
            <p className="vt-name" title="The file name in Drive">{name}</p>
            <p className="vt-meta">{lengthLabel(take.seconds)} · {(take.blob.size / 1e6).toFixed(1)} MB</p>

            {upload.state === "sending" && (
              <div className="vt-progress"><span><i style={{ width: `${Math.round(upload.share * 100)}%` }} /></span><b>Saving to Drive · {Math.round(upload.share * 100)}%</b></div>
            )}
            {upload.state === "done" && (
              <div className="vt-done">
                <b>Saved to Drive</b>
                <code className="ash-mono">{starterFor(upload.link)}</code>
                <div className="vt-row">
                  <button className="ash-btn" onClick={() => copy(starterFor(upload.link))}>{copied ? "Copied" : "Copy for Claude"}</button>
                  <a className="ash-btn ghost" href={upload.link} target="_blank" rel="noreferrer">Open in Drive ↗</a>
                </div>
              </div>
            )}
            {upload.state === "failed" && <p className="vt-err">{upload.why}</p>}
            {mk.state === "sending" && (
              <div className="vt-progress"><span><i style={{ width: `${Math.round(mk.share * 100)}%` }} /></span><b>Sending to Marketing · {Math.round(mk.share * 100)}%</b></div>
            )}
            {mk.state === "done" && <div className="vt-row"><span className="vt-ok">● In Marketing</span><a className="ash-btn ghost" href={mk.link}>Open in Studio</a></div>}
            {mk.state === "failed" && <p className="vt-err">{mk.why}</p>}

            <div className="vt-row">
              {DRIVE_CLIENT_ID && upload.state !== "sending" && upload.state !== "done" && (
                <button className="ash-btn" onClick={saveToDrive}>Save to Drive</button>
              )}
              {role === "admin" && mk.state !== "sending" && mk.state !== "done" && (
                <button className="ash-btn ghost" onClick={sendToMarketing} title="Into the Marketing tab's video storage, for the editing suite">Send to Marketing</button>
              )}
              <button className="ash-btn ghost" onClick={download}>Download</button>
            </div>
          </section>
        )}

        {/* Live share (test), Harry 20 Oct 2026: admins only. */}
        {role === "admin" && <LiveShareCard who={who} />}

        <details className="ash-panel vt-card vt-else">
          <summary>Recorded somewhere else?</summary>
          <ol>
            <li>Share it as a Google Drive or Dropbox link set to “Anyone with the link”. Loom and TikTok links work too.</li>
            <li>Paste <code className="ash-mono">{starterFor("<the link>")}</code> into a Claude chat.</li>
          </ol>
        </details>

        <p className="ash-sub vt-small">Claude reads the whole video, checks every point against the picture at that second, and saves the breakdown to Drive → Knowitball playtest recordings → Breakdowns.</p>
        <a className="ash-btn ghost vt-self" href="https://drive.google.com/drive/folders/18Gn5Q-pluXr_FjBTqtvADLOwq-oMAq87" target="_blank" rel="noreferrer">Open the Breakdowns folder ↗</a>
      </div>
    </AdminShell>
  );
}
