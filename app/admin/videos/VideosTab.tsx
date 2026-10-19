"use client";
/**
 * The Videos tab (Harry, 18 Oct 2026): record your screen and voice right
 * here, and the recording goes straight to your Drive with a clear name and a
 * line to paste to Claude. A phone records with its own screen recorder and
 * uploads the file here. The breakdown itself runs in a Claude chat
 * (skill screen-video).
 */
import { useEffect, useRef, useState } from "react";
import AdminShell from "@/components/admin/shell/AdminShell";
import {
  RECORDERS, DRIVE_CLIENT_ID, DRIVE_FOLDER_NAME, canRecordScreen, connectDrive, lengthLabel,
  recordingName, startRecording, starterFor, uploadToDrive, type LiveRecording, type Recorder,
} from "@/lib/recording";
import "./videos.css";

type Take = { blob: Blob; ext: string; seconds: number; at: Date; url: string };
type Upload = { state: "idle" } | { state: "sending"; share: number } | { state: "done"; link: string } | { state: "failed"; why: string };

const WHO_KEY = "kib-rec-who";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

export default function VideosTab({ role }: { role: "admin" | "tester" }) {
  const [who, setWho] = useState<Recorder>("Harry");
  const [about, setAbout] = useState("");
  const [mic, setMic] = useState(true);
  const [canScreen, setCanScreen] = useState(true);
  const [live, setLive] = useState<LiveRecording | null>(null);
  const [secs, setSecs] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [drive, setDrive] = useState<{ token: string; until: number } | null>(null);
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const t0 = useRef(0);
  // The name is read when the upload starts, so a change typed mid-recording counts.
  const latest = useRef({ who, about });
  latest.current = { who, about };

  useEffect(() => {
    const w = read(WHO_KEY);
    if (w && (RECORDERS as string[]).includes(w)) setWho(w as Recorder);
    setCanScreen(canRecordScreen());
  }, []);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSecs((performance.now() - t0.current) / 1000), 250);
    return () => clearInterval(id);
  }, [live]);
  useEffect(() => () => { if (take) URL.revokeObjectURL(take.url); }, [take]);

  const driveOk = !!drive && drive.until > Date.now();
  const name = take ? recordingName({ at: take.at, who, about, seconds: take.seconds, ext: take.ext }) : "";

  const pickWho = (w: Recorder) => { setWho(w); write(WHO_KEY, w); };

  const connect = async () => {
    setError(null);
    try { setDrive(await connectDrive()); } catch (e) { setError((e as Error).message); }
  };

  const send = async (t: Take, token: string) => {
    setUpload({ state: "sending", share: 0 });
    try {
      const n = recordingName({ at: t.at, ...latest.current, seconds: t.seconds, ext: t.ext });
      const who = latest.current.who;
      const { link } = await uploadToDrive(token, t.blob, n, (share) => setUpload({ state: "sending", share }), who);
      setUpload({ state: "done", link });
      // The recorder's own chats pick it up next time they're messaged (recordings-hook.mjs).
      fetch("/api/dev-recordings", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ person: who, title: n.replace(/\.[a-z0-9]+$/, ""), link }) }).catch(() => {});
    } catch (e) {
      setUpload({ state: "failed", why: (e as Error).message });
    }
  };

  const begin = async () => {
    setError(null); setUpload({ state: "idle" }); setCopied(false);
    if (take) { URL.revokeObjectURL(take.url); setTake(null); }
    try {
      const r = await startRecording(mic);
      t0.current = performance.now(); setSecs(0); setLive(r);
      if (mic && !r.mic) setError("The microphone wasn't allowed, so this records the screen only.");
      const out = await r.done;
      setLive(null);
      const t: Take = { ...out, at: new Date(), url: URL.createObjectURL(out.blob) };
      setTake(t);
      // Straight to Drive when it is connected.
      if (drive && drive.until > Date.now()) void send(t, drive.token);
    } catch (e) {
      setLive(null);
      setError((e as Error).message);
    }
  };

  const saveToDrive = async () => {
    if (!take) return;
    let d = drive;
    if (!d || d.until <= Date.now()) {
      try { d = await connectDrive(); setDrive(d); } catch (e) { setUpload({ state: "failed", why: (e as Error).message }); return; }
    }
    await send(take, d.token);
  };

  const fromFile = (f: File | undefined) => {
    if (!f) return;
    setError(null); setUpload({ state: "idle" }); setCopied(false);
    if (take) URL.revokeObjectURL(take.url);
    const url = URL.createObjectURL(f);
    const ext = (f.name.split(".").pop() || "mp4").toLowerCase();
    // Read the length from the file itself so the name is right.
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => setTake({ blob: f, ext, seconds: isFinite(v.duration) ? v.duration : 0, at: new Date(f.lastModified || Date.now()), url });
    v.onerror = () => setTake({ blob: f, ext, seconds: 0, at: new Date(), url });
    v.src = url;
  };

  const download = () => {
    if (!take) return;
    const a = document.createElement("a");
    a.href = take.url; a.download = name; a.click();
  };

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
                <button className="vt-stop" onClick={() => live.stop()}>Stop</button>
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
                : <><button className="ash-btn ghost" onClick={connect}>Connect Drive</button><span className="vt-hint">Do this first, and each recording saves itself.</span></>
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

            <div className="vt-row">
              {DRIVE_CLIENT_ID && upload.state !== "sending" && upload.state !== "done" && (
                <button className="ash-btn" onClick={saveToDrive}>Save to Drive</button>
              )}
              <button className="ash-btn ghost" onClick={download}>Download</button>
            </div>
          </section>
        )}

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
