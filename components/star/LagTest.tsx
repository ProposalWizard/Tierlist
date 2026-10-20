"use client";
/**
 * THE LAG TEST, ON SCREEN (B18 step 0, Harry, 20 Oct 2026: "me mikey and Leo
 * have 3 different levels of phones").
 *
 * Testers and admins open it from Settings → 🛠 Dev → Lag test (or
 * /star-dev?lagtest=1). Three parts:
 *   1. the start screen: which device, who you are;
 *   2. the pill at the top: "Lag test · step 3 of 10 · …", I'm there, Skip,
 *      Stop. Each step records for 20–40 s once you tap I'm there. ⇅ moves
 *      the pill to the bottom when it covers something;
 *   3. the results: a ✓/✗ table per step, sent to the team (committed as a
 *      file to the `lag-runs` branch; kept on this device when that can't
 *      happen), and Copy results for the Team chat.
 *
 * Mounted once in app/star-dev/layout.tsx (and the cut-scene test page's
 * layout, for the last step), so it stays up whatever screen the game shows.
 * It renders nothing until opened, and measures nothing until a step records.
 * State and maths: lib/star/lagSession.ts, lib/star/lagTest.ts.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  JITTER_MS, LAG_PEOPLE, LAG_STEPS, LAG_TIERS, barFor, fmt, passCount, stepVerdict, tierDef, tierLabel,
  type Bar, type LagTier,
} from "@/lib/star/lagTest";
import {
  beginLagRun, closeLagTest, lagImThere, lagNext, lagResultsText, lagSend, lagServerState, lagSkip, lagState,
  lagStop, lagSubscribe, lagToggleDock, lastTier, lastWho, openLagTest, restoreLagTest,
} from "@/lib/star/lagSession";
import { isTesterNow } from "@/lib/useIsAdmin";
import { createClient } from "@/lib/supabase/client";

const Z = 2147482000;
const ink = "#e8eefc";
const panel = "#0d1424";

export default function LagTestHost() {
  const s = useSyncExternalStore(lagSubscribe, lagState, lagServerState);

  useEffect(() => {
    restoreLagTest();
    if (new URLSearchParams(window.location.search).get("lagtest") === "1") {
      isTesterNow().then((ok) => { if (ok) openLagTest(); });
    }
  }, []);

  if (s.stage === "off") return null;
  if (s.stage === "setup" || s.stage === "measuring") return <StartSheet measuring={s.stage === "measuring"} />;
  if (s.stage === "end") return <Results />;
  return <Pill />;
}

// ── 1. The start screen ──────────────────────────────────────────────────

function StartSheet({ measuring }: { measuring: boolean }) {
  const [tier, setTier] = useState<LagTier | "">("");
  const [other, setOther] = useState("");
  const [who, setWho] = useState("");
  const [whoOther, setWhoOther] = useState("");

  // Preselect: the Team room name of the signed-in admin, else the last pick on this device.
  useEffect(() => {
    const t = lastTier();
    if (t && tierDef(t)) setTier(t);
    const w = lastWho();
    if (w) { if ((LAG_PEOPLE as readonly string[]).includes(w)) setWho(w); else { setWho("other"); setWhoOther(w); } }
    let live = true;
    (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user || !live) return;
        const { data } = await sb.from("team_members").select("person").eq("user_id", user.id).maybeSingle();
        const p = (data as { person?: string } | null)?.person;
        if (live && p && (LAG_PEOPLE as readonly string[]).includes(p)) setWho(p);
      } catch { /* not signed in, or no Team room: keep the last pick */ }
    })();
    return () => { live = false; };
  }, []);

  const person = who === "other" ? whoOther.trim() : who;
  const device = tier === "other" ? other.trim() : "";
  const ready = !!tier && !!person && (tier !== "other" || !!device);

  const phones = LAG_TIERS.filter((t) => t.kind === "phone");
  const pcs = LAG_TIERS.filter((t) => t.kind === "pc");

  return (
    <div role="dialog" aria-modal="true" data-lag-start className="fixed inset-0 flex items-end justify-center bg-black/75 p-3 sm:items-center" style={{ zIndex: Z }}>
      <div className="w-full max-w-sm rounded-2xl border border-white/15 p-4 shadow-2xl" style={{ background: panel, color: ink, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <div className="text-[18px] font-black">Lag test</div>
        <p className="mt-1 text-[13px] font-semibold text-white">About 10 minutes. Follow the pill at the top.</p>

        {measuring ? (
          <p data-lag-measuring className="mt-5 mb-3 text-center text-[14px] font-black text-white">Measuring your screen… keep still.</p>
        ) : (<>
          <Label>Which device is this?</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="grid gap-1.5">
              {phones.map((t) => <Choice key={t.id} on={tier === t.id} onClick={() => setTier(t.id)}>{t.label}</Choice>)}
            </div>
            <div className="grid gap-1.5">
              {pcs.map((t) => <Choice key={t.id} on={tier === t.id} onClick={() => setTier(t.id)} hint={t.hint}>{t.label}</Choice>)}
            </div>
          </div>
          <div className="mt-1.5">
            <Choice on={tier === "other"} onClick={() => setTier("other")}>Other</Choice>
          </div>
          {tier === "other" && (
            <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} placeholder="What is it? (e.g. iPad Air, Galaxy S23)"
              className="mt-1.5 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-[13px] text-white placeholder:text-white/50" />
          )}

          <Label>Who are you?</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {LAG_PEOPLE.map((p) => <Choice key={p} on={who === p} onClick={() => setWho(p)}>{p}</Choice>)}
            <Choice on={who === "other"} onClick={() => setWho("other")}>Other</Choice>
          </div>
          {who === "other" && (
            <input value={whoOther} onChange={(e) => setWhoOther(e.target.value)} maxLength={40} placeholder="Your name"
              className="mt-1.5 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-[13px] text-white placeholder:text-white/50" />
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={closeLagTest} className="kib-press rounded-xl bg-white/10 py-3 text-[13px] font-black text-white">Cancel</button>
            <button data-lag-begin disabled={!ready} onClick={() => tier && void beginLagRun({ person, tier, device })}
              className="kib-press rounded-xl py-3 text-[13px] font-black text-white disabled:opacity-40" style={{ background: "#16a34a" }}>
              Start
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 mt-4 text-[11px] font-black uppercase tracking-[0.12em] text-white">{children}</div>;
}

function Choice({ on, onClick, hint, children }: { on: boolean; onClick: () => void; hint?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={hint}
      className={`kib-press w-full rounded-lg px-2 py-2 text-left text-[12px] font-black leading-tight ${on ? "text-white" : "text-white/85"}`}
      style={on
        ? { background: "linear-gradient(180deg,#4ade80,#10b981 55%,#047857)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }
        : { background: "rgba(255,255,255,.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
      {on && "✓ "}{children}
      {hint && <span className="block text-[10px] font-semibold text-white/75">{hint}</span>}
    </button>
  );
}

// ── 2. The pill ──────────────────────────────────────────────────────────

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, "0")}`;

function Pill() {
  const s = useSyncExternalStore(lagSubscribe, lagState, lagServerState);
  const def = LAG_STEPS[s.stepIndex];
  if (!def) return null;
  const n = `${s.stepIndex + 1} of ${LAG_STEPS.length}`;
  const pos: React.CSSProperties = s.dock === "top"
    ? { top: "max(6px, env(safe-area-inset-top))" }
    : { bottom: "calc(max(6px, env(safe-area-inset-bottom)) + 64px)" };
  const btn = "kib-press rounded-full px-3 py-1.5 text-[12px] font-black leading-none text-white";
  const move = (
    <button aria-label="Move the pill" onClick={lagToggleDock} className="kib-press shrink-0 rounded-full bg-white/10 px-2 py-1 text-[12px] font-black text-white">⇅</button>
  );

  return (
    <div className="pointer-events-none fixed left-0 right-0 flex justify-center px-14" style={{ ...pos, zIndex: Z }}>
      <div data-lag-pill={s.stepState} className="pointer-events-auto w-full max-w-[320px] rounded-2xl border border-white/20 px-2.5 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,.55)]"
        style={{ background: "rgba(10,16,30,.92)", color: ink, backdropFilter: "blur(6px)" }}>
        {s.stepState === "rec" && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-black">{n} · {def.title}</span>
            <span className="shrink-0 text-[13px] font-black tabular-nums">{mmss(s.leftS)}</span>
            <button onClick={lagStop} className={`${btn} bg-white/15`}>Stop</button>
            {move}
          </div>
        )}

        {s.stepState === "done" && (
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-[12px] font-black text-white">✓ Done, tap Next <span className="font-semibold text-white/75">· {n}</span></span>
            <button data-lag-next onClick={lagNext} className={btn} style={{ background: "#16a34a" }}>Next</button>
            <button onClick={lagStop} className={`${btn} bg-white/15`}>Stop</button>
            {move}
          </div>
        )}

        {s.stepState === "go" && (<>
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white/80">Lag test · step {n}</span>
            <span className="text-[12px] font-black tabular-nums">{mmss(def.seconds)}</span>
            <button onClick={lagStop} className="kib-press shrink-0 rounded-full bg-white/10 px-2 py-1 text-[11px] font-black text-white/85">Stop</button>
            {move}
          </div>
          <div className="mt-0.5 text-[13px] font-bold leading-snug text-white">{def.how}</div>
          {s.reloaded && <div className="mt-0.5 text-[11px] font-semibold text-amber-300">The page reloaded, so this step starts again.</div>}
          {def.link && (
            <a href={def.link.href} className="mt-1 inline-block text-[12px] font-black text-sky-300 underline">{def.link.label}</a>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button data-lag-there onClick={lagImThere} className={btn} style={{ background: "#16a34a" }}>I&apos;m there</button>
            <button onClick={lagSkip} className={`${btn} bg-white/15`}>Can&apos;t get there → Skip</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── 3. The results ───────────────────────────────────────────────────────

function Results() {
  const s = useSyncExternalStore(lagSubscribe, lagState, lagServerState);
  const run = s.run!;
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const text = lagResultsText();
  const { passed, judged } = passCount(run);
  const bar = barFor(run.tier, false, run.refresh.hz);
  const low = !!tierDef(run.tier)?.low;
  const bar3d = barFor(run.tier, true, run.refresh.hz);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied("ok"); }
    catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        setCopied(ok ? "ok" : "fail");
      } catch { setCopied("fail"); }
    }
  };

  return (
    <div role="dialog" aria-modal="true" data-lag-results className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-black/80 p-3" style={{ zIndex: Z }}>
      <div className="my-auto w-full max-w-md rounded-2xl border border-white/15 p-4 shadow-2xl" style={{ background: panel, color: ink, marginTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="text-[18px] font-black">Lag test results</div>
        <p className="mt-0.5 text-[12px] font-semibold text-white">
          {run.person} · {tierLabel(run)} · {run.refresh.hz} Hz screen
        </p>
        <p className="mt-2 text-[15px] font-black" style={{ color: judged && passed === judged ? "#4ade80" : "#fbbf24" }}>
          {judged ? `Passed ${passed} of ${judged}` : "Nothing recorded"}{run.complete ? "" : judged ? " · stopped early" : ""}
        </p>

        {run.steps.length > 0 && (
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-[0.08em] text-white/80">
                <th className="py-1 pr-1">Step</th>
                <th className="w-6 py-1 text-center"> </th>
                <th className="py-1 pr-1 text-right leading-tight">1 in 20<br />slower than</th>
                <th className="py-1 text-right">Worst</th>
              </tr>
            </thead>
            <tbody>
              {run.steps.map((st) => {
                const { bar: b, v } = stepVerdict(run, st);
                const mark = st.status === "skipped" ? "–" : v.pass === null ? "–" : v.pass ? "✓" : "✗";
                const col = mark === "✓" ? "#4ade80" : mark === "✗" ? "#f87171" : "rgba(255,255,255,.6)";
                return (
                  <tr key={st.id} className="border-t border-white/10 align-top" data-lag-row={st.id}>
                    <td className="py-1.5 pr-1 font-bold text-white">
                      {st.title}
                      {st.status === "skipped" && <span className="block text-[10px] font-semibold text-white/70">Skipped</span>}
                      {st.status !== "skipped" && v.pass === false && st.frames && <span className="block text-[10px] font-semibold text-red-300">{shortFails(st.frames, b)}</span>}
                      {st.status !== "skipped" && v.pass === null && <span className="block text-[10px] font-semibold text-white/70">Too short to judge</span>}
                    </td>
                    <td className="py-1.5 text-center text-[15px] font-black" style={{ color: col }}>{mark}</td>
                    <td className="py-1.5 pr-1 text-right tabular-nums text-white">
                      {st.frames && st.status !== "skipped" ? <><Ms v={st.frames.p95} /><span className="block whitespace-nowrap text-[10px] text-white/60">bar {fmt(b.p95)}</span></> : "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-white">{st.frames && st.status !== "skipped" ? <Ms v={st.frames.max} /> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="mt-2 text-[11px] font-semibold leading-snug text-white/85">
          Pass on a {run.refresh.hz} Hz screen: no more than 1 frame in 20 over {fmt(bar.p95)} ms, 1 in 100 over {fmt(bar.p99 ?? 0)} ms, and none over {bar.max} ms.
          {low && ` 3D steps on this tier: a steady 30 fps passes (1 in 20 over ${fmt(bar3d.p95)} ms at most, none over ${bar3d.max} ms).`}
        </p>

        <p data-lag-save={s.save.status} className="mt-3 rounded-lg px-3 py-2 text-[12px] font-bold"
          style={{ background: s.save.status === "shared" ? "rgba(22,163,74,.2)" : s.save.status === "device" ? "rgba(245,158,11,.18)" : "rgba(255,255,255,.07)", color: "#fff" }}>
          {s.save.message || " "}
        </p>
        {copied === "ok" && <p className="mt-1 text-[12px] font-bold text-emerald-300">Copied ✓ — paste it in the Team chat.</p>}
        {copied === "fail" && (
          <textarea readOnly value={text} className="mt-1 h-28 w-full rounded-lg bg-black/40 p-2 text-[10px] text-white" onFocus={(e) => e.currentTarget.select()} />
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button data-lag-copy onClick={copy} className="kib-press rounded-xl bg-white/12 py-3 text-[13px] font-black text-white" style={{ background: "rgba(255,255,255,.12)" }}>Copy results</button>
          {s.save.status === "device"
            ? <button onClick={() => void lagSend()} className="kib-press rounded-xl py-3 text-[13px] font-black text-white" style={{ background: "#2563eb" }}>Send again</button>
            : <button data-lag-close onClick={closeLagTest} className="kib-press rounded-xl py-3 text-[13px] font-black text-white" style={{ background: "#16a34a" }}>Close</button>}
        </div>
        {s.save.status === "device" && (
          <button onClick={closeLagTest} className="kib-press mt-2 w-full rounded-xl bg-white/10 py-2.5 text-[12px] font-black text-white">Close</button>
        )}
      </div>
    </div>
  );
}

/** "633 ms", never split over two lines. */
function Ms({ v }: { v: number }) {
  return <span className="whitespace-nowrap">{fmt(v)}<span className="text-[10px] text-white/70"> ms</span></span>;
}

/** Which rules a step broke, in a few words (the numbers are in the columns). */
function shortFails(f: { p95: number; p99: number; max: number }, b: Bar): string {
  const out: string[] = [];
  if (f.p95 > b.p95 + JITTER_MS) out.push("too many slow frames");
  if (b.p99 !== null && f.p99 > b.p99 + JITTER_MS) out.push("bad hitches");
  if (f.max > b.max) out.push(`a frame over ${b.max} ms`);
  return out.join(" · ");
}
