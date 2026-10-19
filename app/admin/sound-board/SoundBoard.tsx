"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SFX_CATALOG, SFX_GROUPS, cleanOverrideMap, type SfxOverrideMap } from "@/lib/star/sfxCatalog";
import { Panel, Pill, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./soundboard.css";

/**
 * The Sound Board. Every sound in public/sfx with: what it is, where the game
 * plays it, a play button, and an upload to replace it. A replaced sound is
 * stored in Supabase Storage (tierlist-images/sfx-overrides) and the game
 * picks it up the next time it loads (lib/star/sfx.ts).
 * Look: the Broadcast frame, laid out like the Sound Lab's "All sounds"
 * (compact rows, an edit panel on the right; under the row on a phone).
 */

interface Meta { duration?: number; kb?: number }
type Sfx = (typeof SFX_CATALOG)[number];

function useNarrow() {
  const [n, setN] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 900px)");
    const f = () => setN(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return n;
}

const groupId = (g: string) => `sb-g-${g.replace(/\W+/g, "-")}`;

export default function SoundBoard() {
  const [overrides, setOverrides] = useState<SfxOverrideMap | null>(null);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ name: string; text: string; bad: boolean } | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [group, setGroup] = useState<string>(SFX_GROUPS[0]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const narrow = useNarrow();

  const load = useCallback(() => {
    fetch("/api/star/sfx-overrides", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { overrides: {} }))
      .then((j: { overrides?: unknown }) => setOverrides(cleanOverrideMap(j.overrides)))
      .catch(() => setOverrides({}));
  }, []);

  useEffect(() => {
    load();
    fetch("/sfx/manifest.json")
      .then((r) => (r.ok ? r.json() : { sounds: [] }))
      .then((m: { sounds?: { name: string; duration: number; kb: number }[] }) => {
        const out: Record<string, Meta> = {};
        for (const s of m.sounds ?? []) out[s.name] = { duration: s.duration, kb: s.kb };
        setMeta(out);
      })
      .catch(() => {});
    return () => audio.current?.pause();
  }, [load]);

  function play(key: string, url: string) {
    audio.current?.pause();
    const a = new Audio(url);
    audio.current = a;
    setPlaying(key);
    a.onended = () => setPlaying((p) => (p === key ? null : p));
    a.play().catch(() => setPlaying(null));
  }

  async function upload(name: string, file: File) {
    setBusy(name);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("file", file);
      const r = await fetch("/api/star/sfx-overrides", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { overrides?: unknown; error?: string };
      if (!r.ok) throw new Error(j.error ?? "The upload failed.");
      setOverrides(cleanOverrideMap(j.overrides));
      setMsg({ name, text: "Saved. The game uses it from the next load.", bad: false });
    } catch (e) {
      setMsg({ name, text: e instanceof Error ? e.message : "The upload failed.", bad: true });
    } finally {
      setBusy(null);
    }
  }

  async function revert(name: string) {
    setBusy(name);
    setMsg(null);
    try {
      const r = await fetch(`/api/star/sfx-overrides?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { overrides?: unknown; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not put the original back.");
      setOverrides(cleanOverrideMap(j.overrides));
      setMsg({ name, text: "The original sound is back.", bad: false });
    } catch (e) {
      setMsg({ name, text: e instanceof Error ? e.message : "Could not put the original back.", bad: true });
    } finally {
      setBusy(null);
    }
  }

  function jump(g: string) {
    setGroup(g);
    document.getElementById(groupId(g))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const changed = overrides ? Object.keys(overrides).length : 0;
  const curKey = (s: Sfx) => (overrides?.[s.name] ? `cur:${s.name}` : `orig:${s.name}`);
  const curUrl = (s: Sfx) => overrides?.[s.name]?.url ?? `/sfx/${s.name}.mp3`;

  const tags = (s: Sfx) => (
    <>
      {overrides?.[s.name] && <span className="sb-tag" data-kind="rep">Replaced</span>}
      {!s.wired && <span className="sb-tag" data-kind="off">Not in the game yet</span>}
    </>
  );

  const edit = (s: Sfx) => {
    const ov = overrides?.[s.name];
    const m = meta[s.name];
    const isBusy = busy === s.name;
    return (
      <div className="sb-edit" data-sound-open={s.name}>
        <div className="sb-edit-head">
          <button
            className="sb-play"
            onClick={() => play(curKey(s), curUrl(s))}
            aria-label={`Play ${s.label}`}
            data-on={playing === curKey(s) ? "true" : undefined}
          >
            {playing === curKey(s) ? "■" : "▶"}
          </button>
          <div className="sb-edit-name">
            <b>{s.label}</b> {tags(s)}
            <p>
              {s.name}
              {m?.duration != null ? ` · original ${m.duration.toFixed(1)}s` : ""}
              {m?.kb != null ? ` · ${m.kb} KB` : ""}
            </p>
          </div>
          <button className="sb-x" onClick={() => setOpenName(null)} aria-label="Close">✕</button>
        </div>
        <p className="sb-where">{s.where}</p>
        {ov && <p className="sb-now">Now playing your upload{ov.original ? ` (${ov.original})` : ""}.</p>}
        <div className="sb-btns">
          <label className="bc-btn sb-file" data-main="true" aria-disabled={isBusy || undefined}>
            {isBusy ? "Working…" : ov ? "Replace again" : "Replace"}
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
              disabled={isBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(s.name, f);
              }}
            />
          </label>
          {ov && (
            <>
              <button className="bc-btn" onClick={() => play(`orig:${s.name}`, `/sfx/${s.name}.mp3`)}>
                {playing === `orig:${s.name}` ? "■ Original" : "▶ Original"}
              </button>
              <button className="bc-btn sb-danger" disabled={isBusy} onClick={() => void revert(s.name)}>
                Put the original back
              </button>
            </>
          )}
        </div>
        {msg?.name === s.name && <p className="sb-msg" data-bad={msg.bad ? "true" : undefined}>{msg.text}</p>}
      </div>
    );
  };

  const open = SFX_CATALOG.find((s) => s.name === openName);

  return (
    <>
      <div className="sb-jump">
        <span className="sb-count">{overrides === null ? "Loading…" : changed === 0 ? "All original" : `${changed} replaced`}</span>
        {SFX_GROUPS.map((g) => (
          <Pill key={g} on={g === group} onClick={() => jump(g)}>{g}</Pill>
        ))}
      </div>
      <div className="sb-layout">
        <div className="sb-rows">
          {SFX_GROUPS.map((g) => {
            const list = SFX_CATALOG.filter((s) => s.group === g);
            return (
              <section key={g} id={groupId(g)} className="sb-group" data-current={g === group ? "true" : undefined}>
                <div className="sb-group-head"><h3>{g}</h3><span>{list.length} sounds</span></div>
                {list.map((s) => {
                  const isOpen = openName === s.name;
                  const toggle = () => setOpenName((o) => (o === s.name ? null : s.name));
                  return (
                    <div key={s.name}>
                      <div className="sb-row" data-sound={s.name} data-open={isOpen ? "true" : undefined} data-replaced={overrides?.[s.name] ? "true" : undefined}>
                        <button className="sb-row-play" onClick={() => play(curKey(s), curUrl(s))} aria-label={`Play ${s.label}`}>
                          {playing === curKey(s) ? "■" : "▶"}
                        </button>
                        <button className="sb-row-name" onClick={toggle}>
                          <b>{s.label}</b>
                          <span>{tags(s)}<i>{s.where}</i></span>
                        </button>
                        <button className="sb-row-edit" onClick={toggle} aria-expanded={isOpen} title="Replace or compare">
                          ≡<span>{isOpen ? "Close" : "Edit"}</span>
                        </button>
                      </div>
                      {narrow && isOpen && <div className="sb-inline">{edit(s)}</div>}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
        {!narrow && (
          <aside className="sb-aside">
            <Panel title="Edit sound">
              {open ? edit(open) : <Note>Tap a sound&apos;s name or Edit to replace it, hear the original or put the original back.</Note>}
            </Panel>
          </aside>
        )}
      </div>
    </>
  );
}
