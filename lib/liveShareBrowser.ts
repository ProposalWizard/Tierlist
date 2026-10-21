/**
 * lib/liveShareBrowser.ts — the browser side of "Live share (test)" (the idea
 * and the pure parts: lib/liveShare.ts). Asks for a screen, writes down what
 * is said (speech recognition, where the browser has it) and once a second sends
 * a small JPEG of the screen when it changed, plus the lines, to
 * /api/admin/live-share. Runs only from a click on the admin Videos page.
 */
import {
  FRAME_EVERY_MS, FRAME_WIDTH, HEARTBEAT_MS, KEEP_FRAMES, MAX_LIVE_MS,
  KEEP_NOTES, THUMB_CHANNELS, THUMB_H, THUMB_W, addLine, changeShare, newLiveCode, pictureChanged, type FrameNote, type LiveLine, type LiveState,
} from "@/lib/liveShare";

export type Voice = LiveState["voice"];

export interface LiveStatus {
  code: string;
  startedAt: number;
  endsAt: number;
  /** Pictures sent so far. */
  frames: number;
  /** When the newest picture got to storage. */
  lastSentAt: number | null;
  lines: LiveLine[];
  hearing: string;
  voice: Voice;
  /** The last send problem, if any. Sending carries on. */
  error: string | null;
  over: boolean;
  /** Where the files can be read (from the server). */
  base: string | null;
}

export interface LiveShareHandle {
  code: string;
  stop: () => Promise<void>;
  /** Adds a typed line (for browsers with no voice, or a quick note). */
  type: (text: string) => void;
}

export function canLiveShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

type SR = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type SRCtor = new () => SR;
type ImageCaptureCtor = new (t: MediaStreamTrack) => { grabFrame(): Promise<ImageBitmap> };

export function speechCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** A timer in a worker: a page in a background tab slows its own timers right down, a worker's much less. */
function ticker(ms: number, fn: () => void): () => void {
  try {
    const url = URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0)," + ms + ")"], { type: "text/javascript" }));
    const w = new Worker(url);
    w.onmessage = fn;
    return () => { w.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}

export async function startLiveShare(opts: {
  who: string;
  voice: boolean;
  onStatus: (s: LiveStatus) => void;
  endpoint?: string;
}): Promise<LiveShareHandle> {
  const endpoint = opts.endpoint ?? "/api/admin/live-share";
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
  } catch {
    throw new Error("No screen was chosen, so nothing is being shared.");
  }
  const track = stream.getVideoTracks()[0];

  // Two ways to read the screen: ImageCapture (Chrome, Edge) keeps working in
  // a background tab; a hidden video element everywhere else.
  const IC = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
  let capture = IC ? new IC(track) : null;
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.srcObject = stream;
  await video.play().catch(() => {});

  const big = document.createElement("canvas");
  const small = document.createElement("canvas");
  small.width = THUMB_W; small.height = THUMB_H;

  const code = newLiveCode();
  const startedAt = Date.now();
  const endsAt = startedAt + MAX_LIVE_MS;
  const s: LiveStatus = { code, startedAt, endsAt, frames: 0, lastSentAt: null, lines: [], hearing: "", voice: "off", error: null, over: false, base: null };
  let lastFrame = 0, lastFrameAt = 0, lastPost = 0, prevThumb: Uint8Array | null = null;
  let recent: FrameNote[] = [];
  let linesDirty = false, hearingSent = "", busy = false;
  const emit = () => opts.onStatus({ ...s, lines: [...s.lines] });

  // ── Voice ──
  const Ctor = opts.voice ? speechCtor() : null;
  let rec: SR | null = null;
  if (!opts.voice) s.voice = "off";
  else if (!Ctor) s.voice = "none";
  else {
    s.voice = "on";
    const listen = () => {
      if (s.over || s.voice !== "on") return;
      const r = new Ctor();
      r.continuous = true; r.interimResults = true; r.lang = "en-GB";
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) { s.lines = addLine(s.lines, res[0].transcript, Date.now() - startedAt, "voice"); linesDirty = true; }
          else interim += res[0].transcript;
        }
        s.hearing = interim.trim();
        emit();
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { s.voice = "blocked"; emit(); }
      };
      // Chrome stops listening after a quiet spell: start again.
      r.onend = () => { rec = null; if (!s.over && s.voice === "on") setTimeout(listen, 250); };
      try { r.start(); rec = r; } catch { setTimeout(listen, 1000); }
    };
    listen();
  }

  async function grab(): Promise<CanvasImageSource & { width: number; height: number } | null> {
    if (capture) {
      try { return await capture.grabFrame(); } catch { capture = null; }
    }
    if (!video.videoWidth) return null;
    return Object.assign(video, { width: video.videoWidth, height: video.videoHeight });
  }

  async function post(form: FormData): Promise<boolean> {
    try {
      const r = await fetch(endpoint, { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { s.error = (j as { error?: string }).error ?? `The site answered ${r.status}.`; return false; }
      s.base = (j as { base?: string }).base ?? s.base;
      s.error = null;
      return true;
    } catch {
      s.error = "Couldn't reach the site. Still trying.";
      return false;
    }
  }

  const stateFor = (frameNo: number, frameAt: number, stoppedAt: number | null): Partial<LiveState> => ({
    who: opts.who, startedAt, endsAt, stoppedAt, lastFrame: frameNo, lastFrameAt: frameAt,
    firstFrame: frameNo ? Math.max(1, frameNo - KEEP_FRAMES + 1) : 0, recent,
    voice: s.voice, hearing: s.hearing, lines: s.lines.length,
  });

  async function tick() {
    if (busy || s.over) return;
    if (Date.now() > endsAt) { void stop(); return; }
    busy = true;
    try {
      let jpeg: Blob | null = null, thumbNow: Uint8Array | null = null, change = 0;
      const at = Date.now();
      const img = await grab();
      if (img && img.width) {
        const w = Math.min(FRAME_WIDTH, img.width);
        const h = Math.round((w * img.height) / img.width);
        const sx = small.getContext("2d", { willReadFrequently: true })!;
        sx.drawImage(img, 0, 0, small.width, small.height);
        const px = sx.getImageData(0, 0, small.width, small.height).data;
        const thumb = new Uint8Array(small.width * small.height * THUMB_CHANNELS);
        for (let p = 0, i = 0; p < small.width * small.height; p++) { thumb[i++] = px[p * 4]; thumb[i++] = px[p * 4 + 1]; thumb[i++] = px[p * 4 + 2]; }
        // Compared with the last picture that got through, so a failed send is tried again.
        if (pictureChanged(prevThumb, thumb)) {
          if (big.width !== w || big.height !== h) { big.width = w; big.height = h; }
          big.getContext("2d")!.drawImage(img, 0, 0, w, h);
          jpeg = await new Promise<Blob | null>((res) => big.toBlob(res, "image/jpeg", 0.7));
          thumbNow = thumb;
          change = changeShare(prevThumb, thumb);
        }
        if ("close" in img && typeof img.close === "function") img.close();
      }
      const heard = s.hearing !== hearingSent;
      if (!jpeg && !linesDirty && !heard && Date.now() - lastPost < HEARTBEAT_MS) return;

      const n = jpeg ? lastFrame + 1 : lastFrame;
      const before = recent;
      if (jpeg) recent = [...recent, { n, at, change: Math.round(change * 1000) / 1000 }].slice(-KEEP_NOTES);
      const form = new FormData();
      form.set("code", code);
      form.set("state", JSON.stringify(stateFor(n, jpeg ? at : lastFrameAt, null)));
      if (jpeg) form.set("frame", jpeg, "frame.jpg");
      const sendingLines = linesDirty;
      if (sendingLines) form.set("lines", JSON.stringify(s.lines));
      linesDirty = false;
      const ok = await post(form);
      lastPost = Date.now();
      if (ok) {
        hearingSent = s.hearing;
        if (jpeg) { lastFrame = n; lastFrameAt = at; s.frames = n; s.lastSentAt = Date.now(); prevThumb = thumbNow; }
      } else {
        recent = before;
        if (sendingLines) linesDirty = true;
      }
      emit();
    } finally {
      busy = false;
    }
  }

  const stopTicker = ticker(FRAME_EVERY_MS, () => { void tick(); });

  async function stop() {
    if (s.over) return;
    s.over = true;
    stopTicker();
    try { rec?.stop(); } catch { /* already stopped */ }
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    // Wait for a send in flight, then say it has ended.
    for (let i = 0; i < 40 && busy; i++) await new Promise((r) => setTimeout(r, 100));
    const form = new FormData();
    form.set("code", code);
    form.set("state", JSON.stringify(stateFor(lastFrame, lastFrameAt, Date.now())));
    form.set("lines", JSON.stringify(s.lines));
    await post(form);
    emit();
  }

  // The browser's own "Stop sharing" bar ends it too.
  track.addEventListener("ended", () => { void stop(); });

  emit();
  void tick();
  return {
    code,
    stop,
    type: (text: string) => {
      if (s.over) return;
      const next = addLine(s.lines, text, Date.now() - startedAt, "typed");
      if (next !== s.lines) { s.lines = next; linesDirty = true; emit(); void tick(); }
    },
  };
}
