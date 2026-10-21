"use client";
/** Watching a live share in a browser: the newest picture and the lines, every 2 s. */
import { useEffect, useState } from "react";
import { claudeLineFor, clock, frameName, isOver, livePath, type LiveLine, type LiveState } from "@/lib/liveShare";

export default function LiveViewer({ code, base }: { code: string; base: string | null }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!base) return;
    let stop = false, lineCount = -1;
    const read = async () => {
      const t = Date.now();
      try {
        const r = await fetch(`${base}/${livePath(code, "state.json")}?t=${t}`, { cache: "no-store" });
        if (!r.ok) { setMissing(true); return; }
        const s = (await r.json()) as LiveState;
        setMissing(false); setState(s); setNow(Date.now());
        if (s.lines !== lineCount) {
          const lr = await fetch(`${base}/${livePath(code, "transcript.json")}?t=${t}`, { cache: "no-store" });
          if (lr.ok) { setLines((await lr.json()) as LiveLine[]); lineCount = s.lines; }
        }
        if (isOver(s, Date.now())) stop = true;
      } catch { /* try again next time */ }
    };
    void read();
    const id = setInterval(() => { if (!stop) void read(); }, 2000);
    return () => clearInterval(id);
  }, [base, code]);

  const over = state ? isOver(state, now) : false;
  return (
    <div className="vt">
      <div>
        <h1 className="ash-h1">Live share {code}</h1>
        <p className="ash-sub">The newest picture and what was said, every 2 seconds. A Claude chat watches with: <code className="ash-mono">npx tsx scripts/live-watch.mts {code}</code></p>
      </div>
      {!base && <p className="vt-err">Live share can't be read here: the site has no storage key.</p>}
      {base && !state && <p className="vt-hint">{missing ? "Nothing here yet. It starts when someone presses Start live share and picks a screen." : "Loading…"}</p>}
      {state && (
        <section className="ash-panel vt-card">
          <p className={over ? "vt-hint" : "vt-ok"}>
            {over ? "Ended." : `● Live · ${state.who || "someone"} · ${clock(now - state.startedAt)}`}
            {state.lastFrame > 0 && ` · picture ${state.lastFrame}, ${Math.max(0, Math.round((now - state.lastFrameAt) / 1000))} s ago`}
          </p>
          {state.lastFrame > 0
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="vt-video" src={`${base}/${livePath(code, frameName(state.lastFrame))}`} alt={`The shared screen, picture ${state.lastFrame}`} />
            : <p className="vt-hint">No picture yet.</p>}
          {state.hearing && <p className="ls-hearing">“{state.hearing}…”</p>}
          {lines.length > 0 && (
            <ol className="ls-lines">
              {lines.slice(-12).map((l) => <li key={l.n}><span className="ash-mono">{clock(l.at)}</span> {l.text}{l.by === "typed" ? " (typed)" : ""}</li>)}
            </ol>
          )}
          <code className="ash-mono ls-line">{claudeLineFor(code)}</code>
        </section>
      )}
    </div>
  );
}
