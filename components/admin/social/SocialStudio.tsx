"use client";
/**
 * SOCIAL STUDIO (/admin/social, Leo 30 Oct 2026): "make an admin page where
 * I can do LOADS for social media stuff … FULL CONTROL OVER EVERYTHING".
 *
 * Works on a career saved in THIS browser (star-career-v2::<scope>). Every
 * change re-reads the save first (so a match played in another tab is never
 * overwritten), changes only its media part, and writes it back at once.
 * Undo puts the media back as it was before the last change. The phone on
 * the right is the game's own MediaFeed, drawn from the same save.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { MediaState } from "@/lib/star/media/types";
import { mediaOf, toggleLike, voteGoalOfMonth } from "@/lib/star/media/feed";
import { loadCareerFromStoredForm, peekDeviceSaves, saveCareer, saveStarPhase, ANON_SCOPE } from "@/lib/star/storage";
import { accountRows } from "@/lib/star/media/studioTools";
import { buildRoster, selfAccount } from "@/lib/star/media/accounts";
import { studioRoster } from "@/lib/star/media/studio";
import { setMediaUpdate } from "@/lib/star/media/updateFlags";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import MediaFeed from "@/components/star/MediaFeed";
import { BroadcastPage, Btn, Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import { Ctx, download, pickFile, type StudioCtx } from "./kit";
import FeedTab from "./FeedTab";
import ComposeTab from "./ComposeTab";
import AccountsTab from "./AccountsTab";
import IdeasTab from "./IdeasTab";
import VideoTab from "./VideoTab";
import SettingsTab from "./SettingsTab";
import { sampleCareer } from "./sample";
import "./studio.css";

const PREFIX = "star-career-v2::";
const PICK_KEY = "kib-social-studio-save";
const TAB_KEY = "kib-social-studio-tab";
type Tab = "feed" | "write" | "accounts" | "ideas" | "video" | "settings" | "phone";
const TABS: [Tab, string][] = [
  ["feed", "📰 Feed"], ["write", "✏️ Write"], ["accounts", "👤 Accounts"], ["ideas", "💡 Ideas"], ["video", "🎬 Video lab"], ["settings", "⚙️ Settings"],
];

const scopeOf = (key: string) => key.slice(PREFIX.length);
function readSave(key: string): CareerState | null {
  try { const raw = localStorage.getItem(key); return raw ? loadCareerFromStoredForm(JSON.parse(raw)) : null; } catch { return null; }
}
function saveLabel(key: string, c: CareerState): string {
  const scope = scopeOf(key);
  const who = scope === ANON_SCOPE ? "signed out" : scope.startsWith(`${ANON_SCOPE}#`) ? `signed out, ${scope.split("#")[1]}` : scope.includes("#") ? `account …${scope.split("#")[0].slice(-4)}, ${scope.split("#")[1]}` : `account …${scope.slice(-4)}`;
  return `${c.player.firstName} ${c.player.lastName} · ${c.player.club || "no club"} · S${c.season} W${c.week} (${who})`;
}

export default function SocialStudio() {
  const [saves, setSaves] = useState<{ key: string; career: CareerState }[] | null>(null);
  const [key, setKey] = useState("");
  const [career, setCareer] = useState<CareerState | null>(null);
  const [undo, setUndo] = useState<{ label: string; media: MediaState }[]>([]);
  const [tab, setTab] = useState<Tab>("feed");
  const [phoneMode, setPhoneMode] = useState<"browse" | "moment">("browse");
  const [toast, setToast] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const [narrow, setNarrow] = useState(false);

  const flash = useCallback((msg: string) => { setToast(msg); window.setTimeout(() => setToast(t => (t === msg ? null : t)), 2600); }, []);

  const refreshSaves = useCallback((prefer?: string) => {
    const list = peekDeviceSaves().filter(s => s.key.startsWith(PREFIX));
    setSaves(list);
    let pick = prefer ?? "";
    if (!pick) { try { pick = localStorage.getItem(PICK_KEY) ?? ""; } catch { /* ignore */ } }
    const chosen = list.find(s => s.key === pick) ?? list.find(s => s.key === PREFIX + ANON_SCOPE) ?? list[0];
    setKey(chosen?.key ?? "");
    setCareer(chosen?.career ?? null);
  }, []);

  useEffect(() => {
    // Football Twitter's accounts and lines follow Leo's switch on this device, as in the game.
    setMediaUpdate({ footballTwitter: leoUpdateOn("footballTwitter") });
    refreshSaves();
    try { const t = localStorage.getItem(TAB_KEY) as Tab | null; if (t && TABS.some(x => x[0] === t)) setTab(t); } catch { /* ignore */ }
    const mq = window.matchMedia("(max-width: 1180px)");
    const sync = () => setNarrow(mq.matches);
    sync(); mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [refreshSaves]);

  // The game playing in another tab: show its newest state.
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === key) { const c = readSave(key); if (c) setCareer(c); } };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, [key]);

  const write = useCallback((c: CareerState): boolean => {
    const ok = saveCareer(c, scopeOf(key));
    if (!ok) flash("Couldn't save on this device (out of space?) — nothing changed.");
    return ok;
  }, [key, flash]);

  const apply = useCallback<StudioCtx["apply"]>((label, f) => {
    if (!key) return;
    const base = readSave(key) ?? career;
    if (!base) return;
    const before = mediaOf(base);
    const next: CareerState = { ...base, media: f(before) };
    if (!write(next)) return;
    setCareer(next);
    setUndo(u => [...u, { label, media: before }].slice(-40));
  }, [key, career, write]);

  const undoLast = () => {
    const last = undo[undo.length - 1];
    if (!last || !key) return;
    const base = readSave(key) ?? career;
    if (!base) return;
    const next = { ...base, media: last.media };
    if (!write(next)) return;
    setCareer(next);
    setUndo(u => u.slice(0, -1));
    flash(`Undone: ${last.label}`);
  };

  const backup = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { flash("No save to back up."); return; }
      const d = new Date();
      download(`knowitball-save-backup-${scopeOf(key).replace(/[^a-z0-9]+/gi, "-")}-${d.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`, raw);
      flash("Backup downloaded.");
    } catch { flash("Couldn't read the save."); }
  }, [key, flash]);

  const confirm = useCallback<StudioCtx["confirm"]>((title, body, run) => setAsk({ title, body, run }), []);

  const restore = async () => {
    const text = await pickFile();
    if (!text) return;
    let c: CareerState | null = null;
    try { c = loadCareerFromStoredForm(JSON.parse(text)); } catch { c = null; }
    if (!c) { flash("That file isn't a Knowitball save backup."); return; }
    const target = key || PREFIX + ANON_SCOPE;
    const restored = c;
    confirm("Restore this backup?", `${restored.player.firstName} ${restored.player.lastName}, Season ${restored.season} Week ${restored.week}, replaces the career in this slot. Undo can't bring the old one back — back it up first.`, () => {
      if (saveCareer(restored, scopeOf(target))) { setUndo([]); refreshSaves(target); flash("Backup restored."); }
      else flash("Couldn't save on this device.");
    });
  };

  const makeSample = () => {
    const c = sampleCareer(6);
    if (saveCareer(c, ANON_SCOPE)) {
      saveStarPhase("dashboard", ANON_SCOPE);
      refreshSaves(PREFIX + ANON_SCOPE);
      flash("Sample career made (signed-out slot on this device).");
    }
  };

  const ctx: StudioCtx | null = useMemo(() => {
    if (!career) return null;
    const media = mediaOf(career);
    return {
      career, media, apply, confirm, flash,
      rows: accountRows(career),
      accounts: studioRoster([...buildRoster(career), selfAccount(career)], media.studio),
    };
  }, [career, apply, confirm, flash]);

  const actions = (
    <>
      {saves && saves.length > 1 && (
        <select className="ss-select" style={{ maxWidth: 320 }} value={key} onChange={e => { const s = saves.find(x => x.key === e.target.value); if (!s) return; setKey(s.key); setCareer(readSave(s.key) ?? s.career); setUndo([]); try { localStorage.setItem(PICK_KEY, s.key); } catch { /* ignore */ } }}>
          {saves.map(s => <option key={s.key} value={s.key}>{saveLabel(s.key, s.career)}</option>)}
        </select>
      )}
      <Btn disabled={!undo.length} onClick={undoLast} title={undo.length ? `Undo: ${undo[undo.length - 1].label}` : "Nothing to undo"}>↶ Undo{undo.length ? `: ${undo[undo.length - 1].label}` : ""}</Btn>
      <Btn disabled={!key} onClick={backup}>⬇ Export save backup</Btn>
      <Btn onClick={restore}>⬆ Restore backup</Btn>
      <Btn href="/star-dev">Open the game</Btn>
    </>
  );

  const pickTab = (t: Tab) => { setTab(t); try { if (t !== "phone") localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };

  const phone = career && (
    <div className="ss-phone">
      <div className="ss-tabs">
        <Pill on={phoneMode === "browse"} onClick={() => setPhoneMode("browse")}>Phone → Social</Pill>
        <Pill on={phoneMode === "moment"} onClick={() => setPhoneMode("moment")}>After the match</Pill>
      </div>
      <div className="ss-phone-box" style={phoneMode === "moment" ? { overflowY: "auto", borderRadius: 24 } : undefined}>
        <MediaFeed career={career} mode={phoneMode}
          onContinue={phoneMode === "moment" ? () => setPhoneMode("browse") : undefined}
          onToggleLike={id => apply("Like", m => toggleLike({ ...career, media: m }, id).media!)}
          onVote={(id, i) => apply("Vote", m => voteGoalOfMonth({ ...career, media: m }, id, i).media!)} />
      </div>
      <span className="ss-sub" style={{ textAlign: "center", maxWidth: 372 }}>The game&apos;s own feed, live from this save. What you see is what the player sees.</span>
    </div>
  );

  return (
    <BroadcastPage title="Social Studio" sub={narrow ? undefined : "Run the in-game social media: every post, account, idea and goal video"} actions={narrow ? undefined : actions} width={1560}>
      {narrow && <div className="ss-row">{actions}</div>}
      {saves === null ? <Panel><div className="ss-sub">Reading this device&apos;s saves…</div></Panel>
        : !career || !ctx ? (
          <Panel title="No career on this device">
            <div className="ss-col">
              <p className="ss-sub" style={{ fontSize: 14 }}>The studio works on a career saved in this browser. Play the game here first, restore a save backup, or make a sample career to try things on.</p>
              <div className="ss-row"><Btn href="/star-dev" main>Open the game</Btn><Btn onClick={restore}>⬆ Restore backup</Btn><Btn onClick={makeSample}>Make a sample career</Btn></div>
            </div>
          </Panel>
        ) : (
          <Ctx.Provider value={ctx}>
            <div className="ss-tabs" style={{ marginBottom: 2 }}>
              {TABS.map(([t, l]) => <Pill key={t} on={tab === t} onClick={() => pickTab(t)}>{l}</Pill>)}
              {narrow && <Pill on={tab === "phone"} onClick={() => pickTab("phone")}>📱 Phone</Pill>}
            </div>
            <div className="ss-layout">
              {!(narrow && tab === "phone") && (
                <Panel title={TABS.find(x => x[0] === tab)?.[1] ?? ""} note={`${saveLabel(key, career)} · ${ctx.media.posts.length} posts`}>
                  {tab === "feed" && <FeedTab />}
                  {tab === "write" && <ComposeTab />}
                  {tab === "accounts" && <AccountsTab />}
                  {tab === "ideas" && <IdeasTab />}
                  {tab === "video" && <VideoTab />}
                  {tab === "settings" && <SettingsTab />}
                </Panel>
              )}
              {(!narrow || tab === "phone") && phone}
            </div>
          </Ctx.Provider>
        )}
      {ask && (
        <div className="ss-modal-back" onClick={() => setAsk(null)}>
          <div className="ss-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <h3>{ask.title}</h3>
            <p>{ask.body}</p>
            <div className="ss-row">
              <button className="bc-btn" data-main="true" onClick={() => { backup(); const r = ask.run; setAsk(null); r(); }}>Back up the save, then do it</button>
              <button className="bc-btn ss-danger" onClick={() => { const r = ask.run; setAsk(null); r(); }}>Do it</button>
              <button className="bc-btn" onClick={() => setAsk(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="ss-toast" role="status">{toast}</div>}
    </BroadcastPage>
  );
}
