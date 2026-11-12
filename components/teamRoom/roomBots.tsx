"use client";
/**
 * components/teamRoom/roomBots.tsx — a bot's own page, and "Copy thread for
 * Claude" (Harry, 12 Nov 2026: "I should be able to click into patch bot and
 * by clicking on him I shouldn't get a chat … what is he doing right now?
 * what are his abilities? how do I affect what he can do? what does he do
 * every day?").
 *
 * The page is the same for every bot: is it really posting, what it does,
 * when it runs, the last 5 things it did, on/off and its settings. Only the
 * Patch bot can be switched from here; the other two say why not.
 * The sums are in lib/teamRoom/patchBot.ts; saving goes through
 * /api/admin/team/bots (the site's own key writes it, never the browser).
 */
import { useEffect, useMemo, useState } from "react";
import { stamp } from "@/lib/teamRoom/logic";
import {
  PATCH_BOT, botSettings, botStatusLine, patchBotActivity, rowBotActivity, threadForClaude, patchThread,
  type BotInfo, type BotSettings,
} from "@/lib/teamRoom/patchBot";
import { loadBotSettings, runBot, saveBotSettings, useTeamRoom } from "@/lib/teamRoom/store";
import { PATCH_META } from "./roomCounts";
import { BotFace } from "./bits";

/** One button on a patch note's thread: the version and every comment, as text to paste into your own Claude. */
export function CopyForClaude({ version }: { version: string }) {
  const s = useTeamRoom();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const note = PATCH_META.find((n) => n.version === version);
  if (!note) return null;
  const n = patchThread(s.messages, version).length;
  const copy = async () => {
    const text = threadForClaude({ note, messages: s.messages, notes: s.notes, origin: typeof window === "undefined" ? "" : window.location.origin });
    try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("failed"); }
    setTimeout(() => setState("idle"), 2200);
  };
  return (
    <button className="tr-btn ghost trb-copy" onClick={copy}
      title={`Copies v${version} and its ${n} comment${n === 1 ? "" : "s"} as text. Paste it into your own Claude chat: it ends with "make the changes suggested".`}>
      {state === "copied" ? "✓ Copied" : state === "failed" ? "Could not copy here" : "Copy thread for Claude"}
    </button>
  );
}

const TONE = { ok: "Working", wait: "Waiting", off: "Off" } as const;

export function BotPage({ info, onGo }: { info: BotInfo; onGo: (slug: string) => void }) {
  const s = useTeamRoom();
  const now = Date.now();
  const local = useMemo(() => botSettings(s.botRows, info.bot), [s.botRows, info.bot]);
  const [server, setServer] = useState<{ settings: BotSettings; timer: boolean | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setServer(null);
    loadBotSettings().then((v) => { if (live && v.settings[info.bot]) setServer({ settings: v.settings[info.bot], timer: v.timer }); });
    return () => { live = false; };
  }, [info.bot]);
  // A newer settings row seen live (someone else switched it) wins over what was first read.
  const settings = local.at && (!server?.settings.at || local.at >= server.settings.at) ? local : server?.settings ?? local;
  const status = botStatusLine(info.bot, s.botRows, settings, now, s.jobs.length);
  const events = info.bot === PATCH_BOT.bot ? patchBotActivity({ notes: PATCH_META, rows: s.botRows, acks: s.acks })
    : info.bot === "jobs" ? [...s.jobs].sort((a, b) => (Date.parse(b.added) || 0) - (Date.parse(a.added) || 0)).slice(0, 5).map((j) => ({ at: j.added, text: `Showed "${j.title}" for ${j.owner === "all" ? "everyone" : j.owner}` }))
      : rowBotActivity(info.bot, s.botRows);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setRan(null); }, [info.bot]);
  const run = async () => {
    setRunning(true); setRan(null);
    const r = await runBot(info.bot);
    setRunning(false);
    setRan(r.ok ? { ok: true, text: r.text ?? "Done." } : { ok: false, text: r.error });
  };
  const save = async (patch: Partial<Pick<BotSettings, "enabled" | "nudgeHours">>) => {
    setBusy(true); setErr(null);
    const r = await saveBotSettings(info.bot, patch);
    setBusy(false);
    if (!r.ok) setErr(r.error);
    else if (r.settings) setServer((v) => ({ settings: r.settings!, timer: v?.timer ?? null }));
  };
  return (
    <div className="trw-pad trb">
      <div className="trb-top">
        <BotFace bot={info.bot} className="trb-face" />
        <span className="tx">
          <b>{info.name}</b>
          <small>A bot is a small job the site runs by itself. It is not a person to chat with.</small>
        </span>
        <span className={`trb-pill ${status.tone}`}>{TONE[status.tone]}</span>
      </div>
      <p className={`trb-status ${status.tone}`}>{status.text}</p>

      <section className="trb-card">
        <p className="tr-lbl">What it does</p>
        <ul>{info.does.map((d) => <li key={d}>{d}</li>)}</ul>
      </section>

      <section className="trb-card">
        <p className="tr-lbl">When it runs</p>
        <p>{info.runs}</p>
        {server?.timer === false && info.bot !== "jobs" && (
          <p className="trb-warn">{info.bot === "health"
            ? "The site's timer is not switched on (CRON_SECRET is not set in Vercel), so the 08:00 post does not go out by itself. Run now still works."
            : info.bot === "bug"
              ? "The 15-minute timer is not switched on (CRON_SECRET is not set in Vercel). The rule inside the database still posts each report; the safety-net check runs when one of us opens an admin page."
              : "The 15-minute timer is not switched on (CRON_SECRET is not set in Vercel). Until it is, the bot runs when one of us opens an admin page."}</p>
        )}
      </section>

      <section className="trb-card">
        <p className="tr-lbl">Run now</p>
        {info.runnable ? (
          <div className="trh-run">
            <span className="tx"><b>Do its job this minute</b><small>{info.runDoes}</small></span>
            <button className="tr-btn" data-run-bot={info.bot} onClick={run} disabled={running}>{running ? "Running…" : "Run now"}</button>
            {ran && <p className={`res${ran.ok ? "" : " bad"}`} role="status">{ran.text}</p>}
          </div>
        ) : <p className="tr-muted">{info.noRun}</p>}
      </section>

      <section className="trb-card">
        <p className="tr-lbl">The last things it did</p>
        {events.length === 0 ? <p className="tr-muted">Nothing yet.</p> : (
          <ol className="trb-log">{events.map((e, i) => <li key={i}><span>{e.text}</span><small>{stamp(e.at, now)}</small></li>)}</ol>
        )}
      </section>

      <section className="trb-card">
        <p className="tr-lbl">Settings</p>
        <div className="trb-row">
          <span className="tx"><b>{info.name} is {settings.enabled ? "on" : "off"}</b>
            <small>{info.switchable ? (settings.by ? `Last changed by ${settings.by}${settings.at ? `, ${stamp(settings.at, now)}` : ""}. Anyone on the team can change it.` : "Anyone on the team can change it. Everyone sees the change.") : info.fixed}</small></span>
          <button className="trb-switch" role="switch" aria-checked={settings.enabled} aria-label={`${info.name} on or off`} disabled={!info.switchable || busy}
            onClick={() => save({ enabled: !settings.enabled })}><i /></button>
        </div>
        {info.bot === PATCH_BOT.bot && (
          <div className="trb-row">
            <span className="tx"><b>Nudge</b><small>Remind whoever has still not read a patch note, once, in #general.</small></span>
            <span className="tr-seg trb-seg" role="group" aria-label="Remind after">
              {PATCH_BOT.nudgeChoices.map((h) => (
                <button key={h} aria-pressed={settings.nudgeHours === h} disabled={busy} onClick={() => save({ nudgeHours: h })}>{h === 0 ? "Never" : `After ${h} h`}</button>
              ))}
            </span>
          </div>
        )}
        {err && <p className="tr-err">{err}</p>}
      </section>

      <button className="tr-btn ghost" onClick={() => onGo(info.channel)}>See its posts in #{info.channel}</button>
    </div>
  );
}
