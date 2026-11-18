"use client";
/**
 * Where a take goes (Harry, 12 Nov 2026: "make it link to R2 as well as Drive
 * so everyone can use it"): on Stop it saves to team storage (Cloudflare R2,
 * lib/recordings/) FIRST, with no Google involved, and that gives the link for
 * Claude. THEN, when Drive is connected on this device, a second copy goes to
 * Drive. Drive is never asked for; "Also save to Drive" is a small button.
 *
 * The screen recorder lives HERE, above every page (Harry, 12 Nov 2026, 00:33:
 * "if I click on any other page here other than this, this recording will
 * stop"). It used to live inside the Videos page, so leaving the page threw
 * the recording away. Now the Videos page is only the controls: the recording,
 * the finished take and the Drive upload carry on while you move around the
 * admin (and the test pages, which sit outside /admin), and a small pill
 * shows on every page: "● Recording 12:34 · Stop".
 *
 * Mounted once in app/layout.tsx. Renders nothing extra until a recording
 * starts. A full page reload (typing an address, F5) still ends a recording:
 * the browser stops screen sharing when the page goes away.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  RECORDERS, connectDrive, driveWasGranted, lengthLabel, recordingName, startRecording, storedDrive, uploadToDrive,
  type DriveKey, type LiveRecording, type Recorder,
} from "@/lib/recording";
import { uploadToMarketing, suiteLink } from "@/lib/marketing/uploadClient";
import { RecordingSaveError, saveRecording } from "@/lib/recordings/client";
import "./recorder.css";

export type Take = { blob: Blob; ext: string; seconds: number; at: Date; url: string };
export type Upload = { state: "idle" } | { state: "sending"; share: number } | { state: "done"; link: string } | { state: "failed"; why: string };

export const VIDEOS_PAGE = "/admin/videos";
const WHO_KEY = "kib-rec-who";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

interface RecorderApi {
  who: Recorder; pickWho: (w: Recorder) => void;
  about: string; setAbout: (s: string) => void;
  mic: boolean; setMic: (b: boolean) => void;
  live: LiveRecording | null; secs: number;
  take: Take | null; name: string;
  drive: DriveKey | null; driveOk: boolean;
  /** Team storage (R2): the first save, and the link for Claude. */
  cloud: Upload;
  /** False once this site said team storage is not connected. */
  cloudOn: boolean;
  /** Goes up by one each time a recording reaches team storage (the list reloads). */
  savedCount: number;
  /** Drive: the second copy. */
  upload: Upload; mk: Upload;
  error: string | null; setError: (e: string | null) => void;
  begin: () => Promise<void>; stop: () => void;
  connect: () => Promise<void>; saveToDrive: () => Promise<void>; saveToTeam: () => Promise<void>;
  fromFile: (f: File | undefined) => void; sendToMarketing: () => Promise<void>; download: () => void;
  reset: () => void;
}

const Ctx = createContext<RecorderApi | null>(null);
export const useRecorder = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRecorder needs <RecorderProvider> (app/layout.tsx).");
  return c;
};

export default function RecorderProvider({ children }: { children: ReactNode }) {
  const [who, setWho] = useState<Recorder>("Harry");
  const [about, setAbout] = useState("");
  const [mic, setMic] = useState(true);
  const [live, setLive] = useState<LiveRecording | null>(null);
  const [secs, setSecs] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [drive, setDrive] = useState<DriveKey | null>(null);
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const [cloud, setCloud] = useState<Upload>({ state: "idle" });
  const [cloudOn, setCloudOn] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  // True while this take is in team storage (then Drive is only a copy: no second note for Claude).
  const inCloud = useRef(false);
  const [mk, setMk] = useState<Upload>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const t0 = useRef(0);
  // The name is read when the upload starts, so a change typed mid-recording counts.
  const latest = useRef({ who, about });
  latest.current = { who, about };
  // A fresh Drive key asked for at the Stop tap (Google's window needs a tap).
  const freshKey = useRef<Promise<DriveKey | null> | null>(null);

  useEffect(() => {
    const w = read(WHO_KEY);
    if (w && (RECORDERS as string[]).includes(w)) setWho(w as Recorder);
    // Drive stays connected across visits for as long as Google's key lasts (one hour).
    setDrive(storedDrive());
  }, []);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSecs((performance.now() - t0.current) / 1000), 250);
    return () => clearInterval(id);
  }, [live]);
  useEffect(() => () => { if (take) URL.revokeObjectURL(take.url); }, [take]);

  const driveOk = !!drive && drive.until > Date.now();
  const name = take ? recordingName({ at: take.at, who, about, seconds: take.seconds, ext: take.ext }) : "";

  const pickWho = useCallback((w: Recorder) => { setWho(w); write(WHO_KEY, w); }, []);

  const connect = useCallback(async () => {
    setError(null);
    try { setDrive(await connectDrive()); } catch (e) { setError((e as Error).message); }
  }, []);

  /** First: team storage (R2). No Google. True when it is in. */
  const sendCloud = useCallback(async (t: Take): Promise<boolean> => {
    setCloud({ state: "sending", share: 0 });
    try {
      const { link } = await saveRecording(t.blob, { ...latest.current, seconds: t.seconds, ext: t.ext }, (share) => setCloud({ state: "sending", share }));
      inCloud.current = true;
      setCloud({ state: "done", link });
      setSavedCount((n) => n + 1);
      return true;
    } catch (e) {
      const off = e instanceof RecordingSaveError && e.status === 503;
      if (off) setCloudOn(false);
      // Not connected here is not a fault to shout about: Drive or Download still work.
      setCloud(off ? { state: "idle" } : { state: "failed", why: (e as Error).message });
      return false;
    }
  }, []);

  /** Second: a copy in the recorder's own Drive. */
  const send = useCallback(async (t: Take, token: string) => {
    setUpload({ state: "sending", share: 0 });
    try {
      const n = recordingName({ at: t.at, ...latest.current, seconds: t.seconds, ext: t.ext });
      const person = latest.current.who;
      const { link } = await uploadToDrive(token, t.blob, n, (share) => setUpload({ state: "sending", share }), person);
      setUpload({ state: "done", link });
      // In team storage already: that person's chats read it from there. Only a
      // Drive-only recording is noted here (recordings-hook.mjs reads both).
      if (!inCloud.current) fetch("/api/dev-recordings", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ person, title: n.replace(/\.[a-z0-9]+$/, ""), link }) }).catch(() => {});
    } catch (e) {
      setUpload({ state: "failed", why: (e as Error).message });
    }
  }, []);

  const reset = useCallback(() => {
    setError(null); setUpload({ state: "idle" }); setCloud({ state: "idle" }); setMk({ state: "idle" }); inCloud.current = false;
    setTake((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
  }, []);

  const begin = useCallback(async () => {
    reset();
    try {
      const r = await startRecording(mic);
      t0.current = performance.now(); setSecs(0); setLive(r); freshKey.current = null;
      if (mic && !r.mic) setError("The microphone wasn't allowed, so this records the screen only.");
      const out = await r.done;
      setLive(null);
      const t: Take = { ...out, at: new Date(), url: URL.createObjectURL(out.blob) };
      setTake(t);
      // Team storage first (no Google). Then a copy to Drive, only when Drive is
      // connected: the key kept on this device, or the one asked for at Stop.
      await sendCloud(t);
      const key = storedDrive() ?? (freshKey.current ? await freshKey.current : null);
      if (key) { setDrive(key); void send(t, key.token); }
    } catch (e) {
      setLive(null);
      setError((e as Error).message);
    }
  }, [mic, reset, send, sendCloud]);

  const stop = useCallback(() => {
    // This tap may open Google's window: if the hour ran out and Drive was
    // allowed before, ask for a fresh key now, quietly (no Allow box).
    if (!storedDrive() && driveWasGranted()) freshKey.current = connectDrive({ quiet: true }).catch(() => null);
    live?.stop();
  }, [live]);

  const saveToDrive = useCallback(async () => {
    if (!take) return;
    let d = storedDrive();
    if (!d) {
      try { d = await connectDrive({ quiet: false }); setDrive(d); } catch (e) { setUpload({ state: "failed", why: (e as Error).message }); return; }
    }
    await send(take, d.token);
  }, [take, send]);

  const saveToTeam = useCallback(async () => { if (take) await sendCloud(take); }, [take, sendCloud]);

  const fromFile = useCallback((f: File | undefined) => {
    if (!f) return;
    reset();
    const url = URL.createObjectURL(f);
    const ext = (f.name.split(".").pop() || "mp4").toLowerCase();
    // Read the length from the file itself so the name is right.
    const v = document.createElement("video");
    v.preload = "metadata";
    // A picked file is saved to team storage the same way a recording is.
    const ready = (t: Take) => { setTake(t); void sendCloud(t); };
    v.onloadedmetadata = () => ready({ blob: f, ext, seconds: isFinite(v.duration) ? v.duration : 0, at: new Date(f.lastModified || Date.now()), url });
    v.onerror = () => ready({ blob: f, ext, seconds: 0, at: new Date(), url });
    v.src = url;
  }, [reset, sendCloud]);

  const sendToMarketing = useCallback(async () => {
    if (!take) return;
    setMk({ state: "sending", share: 0 });
    try {
      const { key } = await uploadToMarketing(take.blob, name, null, (share) => setMk({ state: "sending", share }));
      setMk({ state: "done", link: suiteLink(key) });
    } catch (e) { setMk({ state: "failed", why: (e as Error).message }); }
  }, [take, name]);

  const download = useCallback(() => {
    if (!take) return;
    const a = document.createElement("a");
    a.href = take.url; a.download = name; a.click();
  }, [take, name]);

  const api = useMemo<RecorderApi>(() => ({
    who, pickWho, about, setAbout, mic, setMic, live, secs, take, name, drive, driveOk, cloud, cloudOn, savedCount, upload, mk, error, setError,
    begin, stop, connect, saveToDrive, saveToTeam, fromFile, sendToMarketing, download, reset,
  }), [who, pickWho, about, mic, live, secs, take, name, drive, driveOk, cloud, cloudOn, savedCount, upload, mk, error, begin, stop, connect, saveToDrive, saveToTeam, fromFile, sendToMarketing, download, reset]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <RecorderPill api={api} />
    </Ctx.Provider>
  );
}

/** The pill on every page while a recording runs (and while its take is still saving). */
function RecorderPill({ api }: { api: RecorderApi }) {
  const path = usePathname() ?? "";
  const onVideos = path === VIDEOS_PAGE;
  if (api.live) {
    return (
      <div className="kb-recpill" role="status" aria-live="polite">
        <Link href={VIDEOS_PAGE} className="kb-recpill-t" title="Open Videos">
          <i aria-hidden /> Recording <b>{lengthLabel(api.secs)}</b>
        </Link>
        <button type="button" className="kb-recpill-stop" onClick={api.stop}>Stop</button>
      </div>
    );
  }
  // After Stop, away from the Videos page: say where the take is.
  if (onVideos || !api.take) return null;
  // Team storage speaks first; Drive only when team storage is not in play.
  const u = api.cloud.state !== "idle" ? api.cloud : api.upload;
  const text = u.state === "sending" ? `Saving · ${Math.round(u.share * 100)}%`
    : u.state === "done" ? "Saved" : u.state === "failed" ? "Not saved yet" : "Recording ready";
  return (
    <div className="kb-recpill" data-state={u.state} role="status" aria-live="polite">
      <Link href={VIDEOS_PAGE} className="kb-recpill-t" title="Open Videos to copy the link or save it">
        {text} <b>Open</b>
      </Link>
    </div>
  );
}
