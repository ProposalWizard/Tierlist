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
import { loadBotSettings, runBot, saveAiBotSettings, saveBotSettings, setComposeDraft, useTeamRoom, type AiBotView } from "@/lib/teamRoom/store";
import { ASK_ME, botHandle, isReplyRow } from "@/lib/teamRoom/atBots";
import { CLAUDE_BOT, DEFAULT_AI_SETTINGS, aiSettings, botOwner, canChangeAi, isAiBot, ownKeyName, pounds, spendLine, type AiBotSettings } from "@/lib/teamRoom/claudeBot";
import { listChannels } from "@/lib/teamRoom/channels";
import { ChatThread } from "./chat";
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
  const [aiView, setAiView] = useState<AiBotView | null>(null);
  const ai = isAiBot(info.bot);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setServer(null); setAiView(null);
    loadBotSettings().then((v) => { if (!live) return; if (v.settings[info.bot]) setServer({ settings: v.settings[info.bot], timer: v.timer }); setAiView(v.ai?.[info.bot] ?? null); });
    return () => { live = false; };
  }, [info.bot]);
  // A newer settings row seen live (someone else switched it) wins over what was first read.
  const settings = local.at && (!server?.settings.at || local.at >= server.settings.at) ? local : server?.settings ?? local;
  const baseStatus = botStatusLine(info.bot, s.botRows, settings, now, s.jobs.length);
  // An AI bot is really on only when the site has its key AND its own switch is on.
  const aiOn = ai ? (aiView ? aiView.settings.enabled : aiSettings(s.botRows, info.bot).enabled) : true;
  const status = !ai ? baseStatus
    : !aiView ? { tone: "wait" as const, text: "Checking…" }
      : !aiView.keySet ? { tone: "off" as const, text: `${info.name} is not switched on yet: one Vercel setting.` }
        : !aiOn ? { tone: "off" as const, text: `Switched off${aiView.settings.by ? ` by ${aiView.settings.by}` : ""}. It answers nobody until it is on again.` }
          : aiView.spend.atCap ? { tone: "off" as const, text: `It has hit this month's limit (${spendLine(aiView.spend)}). It starts again on the 1st.` }
            : { tone: "ok" as const, text: `On. It answers when someone @s it. ${spendLine(aiView.spend)}.` };
  // What a bot answered when someone @ed it also counts as "things it did".
  const answers = s.botReplies.filter((r) => r.bot === info.bot && isReplyRow(r)).map((r) => ({ at: r.created_at, text: r.title }));
  const asks = ASK_ME[ai ? "claude" : info.bot] ?? [];
  const ask = (say: string) => { setComposeDraft(`${botHandle(info.bot)} ${say}`); onGo("general"); };
  const baseEvents = info.bot === PATCH_BOT.bot ? patchBotActivity({ notes: PATCH_META, rows: s.botRows, acks: s.acks })
    : info.bot === "jobs" ? [...s.jobs].sort((a, b) => (Date.parse(b.added) || 0) - (Date.parse(a.added) || 0)).slice(0, 5).map((j) => ({ at: j.added, text: `Showed "${j.title}" for ${j.owner === "all" ? "everyone" : j.owner}` }))
      : rowBotActivity(info.bot, s.botRows);
  const events = [...baseEvents, ...answers].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).slice(0, 5);
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
          <small>{ai ? (botOwner(info.bot) ? `${botOwner(info.bot)}'s own helper. It answers questions. It is a bot, not ${botOwner(info.bot)}.` : "An AI helper. It answers questions and changes nothing.") : "A bot is a small job the site runs by itself. You can @ it with a question."}</small>
        </span>
        <span className={`trb-pill ${status.tone}`}>{TONE[status.tone]}</span>
      </div>
      <p className={`trb-status ${status.tone}`}>{status.text}</p>

      {ai && aiView && !aiView.keySet && (
        <section className="trb-card trb-setup" data-ai-off>
          <p className="tr-lbl">Not switched on yet</p>
          <p><b>{info.name} is not switched on yet: one Vercel setting.</b></p>
          <ol>
            <li>Make a key at console.anthropic.com → API keys.</li>
            <li>In Vercel: the site&apos;s project → Settings → Environment Variables → add <code>ANTHROPIC_API_KEY</code> with that key (Production).</li>
            <li>Redeploy once. This page then shows On, with the month&apos;s spend.</li>
          </ol>
          <small>The key stays on the server. It is never in the code and never sent to a browser. Until then, an @{info.name} gets this same one line as its reply.</small>
        </section>
      )}
      {ai && aiView && aiView.keySet && <SpendCard view={aiView} bot={info.bot} />}

      {asks.length > 0 && (
        <section className="trb-card">
          <p className="tr-lbl">Ask me</p>
          <p className="tr-muted">Type {botHandle(info.bot)} and your words in any channel. I answer in a thread under your message. Tap one to try it in #general:</p>
          <div className="trb-asks">
            {asks.map((x) => (
              <button key={x.say} className="trb-ask" data-ask={x.say} onClick={() => ask(x.say)} title={`Puts "${botHandle(info.bot)} ${x.say}" in the message box in #general`}>
                <b>{botHandle(info.bot)} {x.say}</b><small>{x.gets}</small>
              </button>
            ))}
          </div>
        </section>
      )}

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

      {!ai && <section className="trb-card">
        <p className="tr-lbl">Run now</p>
        {info.runnable ? (
          <div className="trh-run">
            <span className="tx"><b>Do its job this minute</b><small>{info.runDoes}</small></span>
            <button className="tr-btn" data-run-bot={info.bot} onClick={run} disabled={running}>{running ? "Running…" : "Run now"}</button>
            {ran && <p className={`res${ran.ok ? "" : " bad"}`} role="status">{ran.text}</p>}
          </div>
        ) : <p className="tr-muted">{info.noRun}</p>}
      </section>}

      <section className="trb-card">
        <p className="tr-lbl">The last things it did</p>
        {events.length === 0 ? <p className="tr-muted">Nothing yet.</p> : (
          <ol className="trb-log">{events.map((e, i) => <li key={i}><span>{e.text}</span><small>{stamp(e.at, now)}</small></li>)}</ol>
        )}
      </section>

      {ai && <AiSettingsCard bot={info.bot} name={info.name} view={aiView} onSaved={(st) => setAiView((v) => (v ? { ...v, settings: st } : v))} />}

      {ai && s.me && (
        <section className="trb-card trb-dm">
          <p className="tr-lbl">Ask {info.name} here</p>
          <p className="tr-muted">Your own side room with {info.name}. It is kept off the channel list, but it is not locked: Mikey, Leo and Harry could each read it.</p>
          <div className="trb-dmbox"><ChatThread view={{ kind: "channel", slug: `ask-${info.bot.replace(/-bot$/, "")}-${s.me.toLowerCase()}` }} sayTo={botHandle(info.bot)} autoFocus={false} visible={false} emptyLine={`Nothing asked yet. Type a question below.`} /></div>
        </section>
      )}

      {!ai && <section className="trb-card">
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
      </section>}

      {!ai && <button className="tr-btn ghost" onClick={() => onGo(info.channel)}>See its posts in #{info.channel}</button>}
    </div>
  );
}

/** "£3.10 of £20 this month", as a bar, and the limits in plain words. */
function SpendCard({ view, bot }: { view: AiBotView; bot: string }) {
  const sp = view.spend;
  const pct = Math.max(0, Math.min(100, (sp.gbp / sp.capGbp) * 100));
  const owner = botOwner(bot);
  return (
    <section className="trb-card" data-ai-spend>
      <p className="tr-lbl">Spend this month</p>
      <p><b>{spendLine(sp)}</b></p>
      <div className={`trb-bar${pct >= 90 ? " red" : pct >= 75 ? " amber" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={sp.capGbp} aria-valuenow={Math.round(sp.gbp * 100) / 100} aria-label="Spend this month"><i style={{ width: `${Math.max(pct, sp.gbp > 0 ? 1.5 : 0)}%` }} /></div>
      <small>
        {sp.replies} answer{sp.replies === 1 ? "" : "s"} this month, {view.today} today. A hard limit of {pounds(sp.capGbp)} a calendar month: at the limit it says so and makes no AI call.
        {" "}{owner && !view.ownKey ? `${owner} bot shares this one limit with Claude and the other two bots. ` : owner ? `${owner} set their own key (${ownKeyName(bot)}), so this is ${owner} bot's own limit. ` : "Claude and the three people's bots share this one limit. "}
        Also: one answer per person every {CLAUDE_BOT.perPersonMs / 1000} seconds, {CLAUDE_BOT.perDay} a day in all.
        Each answer is costed from the count the AI service returns; every dollar is counted as a pound, so it stops early, never late.
      </small>
    </section>
  );
}

/** An AI bot's settings. A person's bot: only its owner can change them; the other two see them greyed. */
function AiSettingsCard({ bot, name, view, onSaved }: { bot: string; name: string; view: AiBotView | null; onSaved: (s: AiBotSettings) => void }) {
  const s = useTeamRoom();
  const owner = botOwner(bot);
  const mine = canChangeAi(bot, s.me);
  const local = useMemo(() => aiSettings(s.botRows, bot), [s.botRows, bot]);
  const st: AiBotSettings = local.at && (!view?.settings.at || local.at >= view.settings.at) ? local : view?.settings ?? DEFAULT_AI_SETTINGS;
  const [text, setText] = useState(st.instructions);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setText(st.instructions); }, [st.instructions, bot]);
  const channels = useMemo(() => listChannels(s.channelRows), [s.channelRows]);
  const save = async (patch: Partial<Pick<AiBotSettings, "enabled" | "instructions" | "channels" | "handoff">>, said = "Saved.") => {
    setBusy(true); setNote(null);
    const r = await saveAiBotSettings(bot, patch);
    setBusy(false);
    if (!r.ok) setNote({ ok: false, text: r.error }); else { if (r.settings) onSaved(r.settings); setNote({ ok: true, text: said }); }
  };
  const all = st.channels === null;
  const toggle = (slug: string) => {
    const now = all ? channels.map((c) => c.slug) : st.channels!;
    const next = now.includes(slug) ? now.filter((x) => x !== slug) : [...now, slug];
    void save({ channels: next.length === channels.length ? null : next });
  };
  return (
    <section className="trb-card" data-ai-settings={mine ? "owner" : "other"}>
      <p className="tr-lbl">Settings{owner && !mine ? ` · only ${owner} can change these` : ""}</p>
      <div className="trb-row">
        <span className="tx"><b>{name} is {st.enabled ? "on" : "off"}</b>
          <small>{owner ? (mine ? "Your bot. Only you can switch it." : `${owner}'s bot. Only ${owner} can switch it.`) : "Anyone on the team can switch it. Everyone sees the change."}{st.by ? ` Last changed by ${st.by}${st.at ? `, ${stamp(st.at, Date.now())}` : ""}.` : ""}</small></span>
        <button className="trb-switch" role="switch" aria-checked={st.enabled} aria-label={`${name} on or off`} disabled={!mine || busy} onClick={() => save({ enabled: !st.enabled }, st.enabled ? "Switched off." : "Switched on.")}><i /></button>
      </div>
      {owner && (<>
        <div className="trb-field">
          <label htmlFor={`trb-how-${bot}`}><b>How I should answer</b><small>A short note added to what {name} is told. It is a preference, never permission to change anything.</small></label>
          <textarea id={`trb-how-${bot}`} rows={3} maxLength={CLAUDE_BOT.maxInstructions} value={text} readOnly={!mine} disabled={busy && mine} placeholder={mine ? "For example: keep it to three lines. Football words, not coder words." : `${owner} has not written anything here yet.`} onChange={(e) => setText(e.target.value)} />
          {mine && <span className="trb-fieldfoot"><small>{text.length} of {CLAUDE_BOT.maxInstructions}</small><button className="tr-btn" disabled={busy || text.trim() === st.instructions} onClick={() => save({ instructions: text })}>Save</button></span>}
        </div>
        <div className="trb-field">
          <span><b>Where it may answer</b><small>{all ? "Every channel." : st.channels!.length ? `Only: ${st.channels!.map((c) => `#${c}`).join(", ")}.` : "Nowhere yet."} Asked anywhere else, it says so in one line.</small></span>
          <div className="trb-chips" role="group" aria-label="Channels it may answer in">
            {channels.map((c) => <button key={c.slug} aria-pressed={all || st.channels!.includes(c.slug)} disabled={!mine || busy} onClick={() => toggle(c.slug)}>#{c.name}</button>)}
          </div>
        </div>
        <div className="trb-row">
          <span className="tx"><b>Hand bigger asks to my Claude</b><small>A bigger ask is anything that needs a change to the game, files or database. {name} never does it. With “Ask me first” it posts a card only {owner} can Accept or Decline.</small></span>
          <span className="tr-seg trb-seg" role="group" aria-label="Hand bigger asks to my Claude">
            <button aria-pressed={st.handoff === "ask"} disabled={!mine || busy} onClick={() => save({ handoff: "ask" })}>Ask me first</button>
            <button aria-pressed={st.handoff === "never"} disabled={!mine || busy} onClick={() => save({ handoff: "never" })}>Never</button>
          </span>
        </div>
      </>)}
      {note && <p className={note.ok ? "trb-saved" : "tr-err"} role="status">{note.text}</p>}
    </section>
  );
}
