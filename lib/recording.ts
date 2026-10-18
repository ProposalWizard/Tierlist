/**
 * lib/recording.ts — the admin Videos tab's screen recorder (Harry, 18 Oct
 * 2026: "the screen recorder tool should auto update to the drive with a
 * relevant name"; then "add the recording to the admin as in a screen
 * recorded").
 *
 * Pure parts (tested in tests/star/recording.mts): the file name, the length
 * label and which video format this browser can make. The browser parts
 * (screen + microphone, Google Drive) are below them and only run on a click.
 */

export type Recorder = "Harry" | "Mikey" | "Leo";
export const RECORDERS: Recorder[] = ["Harry", "Mikey", "Leo"];

/** The Drive folder the site makes in the recorder's own Drive. */
export const DRIVE_FOLDER_NAME = "Knowitball screen recordings";

/** 252 s → "4m12s"; 45 s → "45s"; 3725 s → "1h02m05s". */
export function lengthLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h) return `${h}h${String(m).padStart(2, "0")}m${String(r).padStart(2, "0")}s`;
  if (m) return `${m}m${String(r).padStart(2, "0")}s`;
  return `${r}s`;
}

/** Characters Drive and every computer accept in a file name. */
function clean(text: string): string {
  return text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * The same name the screen-video skill gives a breakdown, so the recording
 * and its breakdown sort side by side:
 * "2026-10-18 · Harry · keeper dive feels slow (4m12s).webm"
 */
export function recordingName(opts: { at: Date; who: Recorder; about: string; seconds: number; ext: string }): string {
  const d = opts.at;
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const about = clean(opts.about) || "screen recording";
  return `${date} · ${opts.who} · ${about} (${lengthLabel(opts.seconds)}).${opts.ext}`;
}

/** The best format this browser records in, and its file ending. */
export function pickFormat(isSupported: (mime: string) => boolean): { mime: string; ext: string } | null {
  const tries: [string, string][] = [
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
    ["video/mp4;codecs=avc1,mp4a", "mp4"],
    ["video/mp4", "mp4"],
  ];
  for (const [mime, ext] of tries) if (isSupported(mime)) return { mime, ext };
  return null;
}

/** The line to paste into a Claude chat. */
export const starterFor = (link: string) => `Watch this recording: ${link}`;

/* ── Browser: screen and voice ───────────────────────────────────────── */

export function canRecordScreen(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined";
}

export interface LiveRecording {
  stop: () => void;
  /** Resolves with the finished video when it stops (Stop, or "Stop sharing"). */
  done: Promise<{ blob: Blob; ext: string; seconds: number }>;
  /** True when the microphone is in the recording. */
  mic: boolean;
}

/**
 * Asks for a screen (and its sound, where the browser offers it) and the
 * microphone, mixes both sounds into one track and records. Throws a plain
 * English message when the person says no.
 */
export async function startRecording(withMic: boolean): Promise<LiveRecording> {
  const fmt = pickFormat((m) => MediaRecorder.isTypeSupported(m));
  if (!fmt) throw new Error("This browser can't record video. Try Chrome or Edge on a computer.");

  let screen: MediaStream;
  try {
    screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
  } catch {
    throw new Error("No screen was chosen, so nothing is recording.");
  }
  let voice: MediaStream | null = null;
  if (withMic) {
    try { voice = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { voice = null; }
  }

  // One sound track: the screen's sound plus your voice.
  const tracks: MediaStreamTrack[] = [...screen.getVideoTracks()];
  let ctx: AudioContext | null = null;
  const sounds = [screen, voice].filter((s): s is MediaStream => !!s && s.getAudioTracks().length > 0);
  if (sounds.length === 1) tracks.push(sounds[0].getAudioTracks()[0]);
  else if (sounds.length > 1) {
    ctx = new AudioContext();
    const out = ctx.createMediaStreamDestination();
    for (const s of sounds) ctx.createMediaStreamSource(s).connect(out);
    tracks.push(out.stream.getAudioTracks()[0]);
  }

  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: fmt.mime, videoBitsPerSecond: 2_500_000 });
  const parts: Blob[] = [];
  const started = performance.now();
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const done = new Promise<{ blob: Blob; ext: string; seconds: number }>((resolve) => {
    rec.onstop = async () => {
      for (const s of [screen, voice]) s?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      const ms = performance.now() - started;
      let blob = new Blob(parts, { type: fmt.mime.split(";")[0] });
      // A browser's WebM has no length written in it: players can't seek and
      // Drive's preview struggles. Write the length in (fix-webm-duration).
      if (fmt.ext === "webm") {
        try { const { default: fix } = await import("fix-webm-duration"); blob = await fix(blob, ms, { logger: false }); } catch { /* keep it as it is */ }
      }
      resolve({ blob, ext: fmt.ext, seconds: ms / 1000 });
    };
  });
  const stop = () => { if (rec.state !== "inactive") rec.stop(); };
  // The browser's own "Stop sharing" bar ends the recording too.
  screen.getVideoTracks()[0]?.addEventListener("ended", stop);
  rec.start(1000);
  return { stop, done, mic: !!voice };
}

/* ── Browser: Google Drive ───────────────────────────────────────────── */

const SCOPE = "https://www.googleapis.com/auth/drive.file";

/** The Google sign-in id for Drive. Unset = Drive is not switched on yet. */
export const DRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface GoogleOauth { initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void }): { requestAccessToken(o?: { prompt?: string }): void } }
declare global { interface Window { google?: { accounts?: { oauth2?: GoogleOauth } } } }

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error("Couldn't reach Google. Check the connection and try again.")); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Opens Google's "Allow Knowitball to add files to your Drive" box. Must run from a tap. */
export async function connectDrive(): Promise<{ token: string; until: number }> {
  if (!DRIVE_CLIENT_ID) throw new Error("Drive isn't switched on yet (no Google id on the site).");
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => r.access_token
        ? resolve({ token: r.access_token, until: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 })
        : reject(new Error(r.error === "access_denied" ? "Drive wasn't allowed." : "Google said no. Try again.")),
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "The Google box was closed." : "Google's box didn't open. Allow pop-ups and try again.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function driveJson(token: string, url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (r.status === 401) throw new Error("The Drive connection ran out. Tap Connect Drive again.");
  if (!r.ok) throw new Error(`Drive answered ${r.status}.`);
  return r.status === 204 ? {} : r.json();
}

/** The site's folder in your Drive, made the first time. */
async function folderId(token: string): Promise<string> {
  const q = encodeURIComponent(`name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await driveJson(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`);
  const files = (found.files as { id: string }[] | undefined) ?? [];
  if (files[0]) return files[0].id;
  const made = await driveJson(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  return made.id as string;
}

/**
 * Puts the video in the site's Drive folder, opens it to "anyone with the
 * link" (so Claude can fetch it) and returns the link.
 */
export async function uploadToDrive(token: string, file: Blob, name: string, onProgress: (share: number) => void): Promise<{ link: string; id: string }> {
  const parent = await folderId(token);
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Upload-Content-Type": file.type || "video/webm", "X-Upload-Content-Length": String(file.size) },
    body: JSON.stringify({ name, parents: [parent], description: "Recorded on knowitball.co.uk → Admin → Videos" }),
  });
  if (start.status === 401) throw new Error("The Drive connection ran out. Tap Connect Drive again.");
  const where = start.headers.get("Location");
  if (!start.ok || !where) throw new Error(`Drive wouldn't start the upload (${start.status}).`);

  const meta = await new Promise<{ id: string; webViewLink?: string }>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", where);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve(JSON.parse(x.responseText)) : reject(new Error(`The upload stopped (${x.status}). Try Save to Drive again.`)));
    x.onerror = () => reject(new Error("The upload stopped. Check the connection and try again."));
    x.send(file);
  });
  await driveJson(token, `https://www.googleapis.com/drive/v3/files/${meta.id}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  return { id: meta.id, link: meta.webViewLink ?? `https://drive.google.com/file/d/${meta.id}/view` };
}
