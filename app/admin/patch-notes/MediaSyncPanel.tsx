"use client";
/**
 * The "Patch-note pictures in Cloudflare" card (Harry, 22 Oct 2026), on
 * /admin/patch-notes AND the admin menu's Patch notes tab (the Team board,
 * app/admin/team/TeamBoard.tsx: that is the page Harry opens, and it had no
 * card until 12 Nov 2026). The move runs by itself on the live site every
 * 5 minutes (vercel.json crons); this card shows how far it is and refreshes
 * every minute. The button still runs it faster from an open tab. Files
 * already there at the same size are skipped, so a stop is always safe.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Status = {
  mode?: "r2" | "dev" | "off";
  connected?: boolean;
  totalFiles: number;
  totalBytes: number;
  doneFiles: number;
  doneBytes: number;
  finished?: boolean;
  uploaded?: number;
  failed?: { rel: string; error: string }[];
  error?: string;
};

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;

export default function MediaSyncPanel() {
  const [s, setS] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fails, setFails] = useState<{ rel: string; error: string }[]>([]);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/patch-notes/media-sync", { cache: "no-store" });
      const j = (await r.json()) as Status;
      setS(j);
      if (j.error) setErr(j.error);
    } catch {
      // Never stick on "Checking…": show the card with the reason.
      setS((old) => old ?? { totalFiles: 0, totalBytes: 0, doneFiles: 0, doneBytes: 0, connected: false });
      setErr("Could not read how far the move is.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // The timed job moves files with no tab open: refresh the bar once a minute until done.
  useEffect(() => {
    if (running || s?.finished || !s?.connected) return;
    const t = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(t);
  }, [load, running, s?.finished, s?.connected]);

  const run = async () => {
    setRunning(true); setErr(null); setFails([]); stop.current = false;
    const seen: { rel: string; error: string }[] = [];
    try {
      for (let i = 0; i < 200 && !stop.current; i++) {
        const r = await fetch("/api/admin/patch-notes/media-sync", { method: "POST", cache: "no-store" });
        const j = (await r.json()) as Status;
        if (!r.ok || j.error) { setErr(j.error ?? `The site answered ${r.status}.`); break; }
        setS(j);
        for (const f of j.failed ?? []) seen.push(f);
        setFails(seen.slice(-5));
        if (j.finished) break;
        // A batch that moved nothing but had failures will fail the same way again: stop and say so.
        if ((j.uploaded ?? 0) === 0 && (j.failed?.length ?? 0) > 0) { setErr(`${j.failed!.length} files would not copy. Press again to retry them.`); break; }
      }
    } catch { setErr("Lost the connection. Press again to carry on: finished files are skipped."); }
    setRunning(false);
  };

  if (!s) return <Shell><p className="text-[13px] text-[#9fb6aa]">Checking Cloudflare…</p></Shell>;
  const pct = s.totalFiles ? Math.round((s.doneFiles / s.totalFiles) * 100) : 0;
  const done = !!s.finished;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold">Patch-note pictures in Cloudflare</div>
          <div className="text-[13px] text-[#9fb6aa]">
            {!s.connected
              ? "Works on the live site only (the Cloudflare keys are in Vercel)."
              : done
                ? "Done: every patch-note picture is in Cloudflare. Nothing to do."
                : `${s.doneFiles.toLocaleString()} of ${s.totalFiles.toLocaleString()} files · ${mb(s.doneBytes)} of ${mb(s.totalBytes)} · moving by itself every 5 minutes`}
            {s.mode === "dev" && <span className="ml-1 text-[#f5b942]">(test copy on this computer)</span>}
          </div>
        </div>
        {s.connected && !done && (running
          ? <button type="button" onClick={() => { stop.current = true; }} className="rounded-full border border-[#24332b] px-4 py-2 text-[13px] font-bold text-[#f2f7f4]">Stop</button>
          : <button type="button" onClick={run} className="rounded-full bg-[#3ddc84] px-4 py-2 text-[13px] font-black text-[#06170e]">
              Move faster now
            </button>)}
      </div>
      {s.connected && s.totalFiles > 0 && (
        <div className="mt-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#24332b]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Files moved">
            <div className={`h-full rounded-full ${done ? "bg-[#3ddc84]" : "bg-[#6fb8ff]"} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[12px] text-[#6f8679]">
            <span>{running ? "Moving faster while this tab is open" : done ? "Nothing left to move" : "No need to press anything: it carries on by itself"}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-[13px] text-[#ff6b6b]">{err}</p>}
      {fails.length > 0 && (
        <ul className="mt-1 text-[12px] text-[#9fb6aa]">
          {fails.map((f) => <li key={f.rel}>✕ {f.rel}: {f.error}</li>)}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0b100e] px-4 pt-6 text-[#f2f7f4] lg:px-8">
      <div className="mx-auto max-w-[1180px] rounded-2xl border border-[#24332b] bg-[#141d18] p-4">{children}</div>
    </div>
  );
}
