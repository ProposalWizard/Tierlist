"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SFX_CATALOG, SFX_GROUPS, cleanOverrideMap, type SfxOverrideMap } from "@/lib/star/sfxCatalog";

/**
 * The Sound Board. Every sound in public/sfx with: what it is, where the game
 * plays it, a play button, and an upload to replace it. A replaced sound is
 * stored in Supabase Storage (tierlist-images/sfx-overrides) and the game
 * picks it up the next time it loads (lib/star/sfx.ts).
 */

interface Meta { duration?: number; kb?: number }

export default function SoundBoard() {
  const [overrides, setOverrides] = useState<SfxOverrideMap | null>(null);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ name: string; text: string; bad: boolean } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

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

  const changed = overrides ? Object.keys(overrides).length : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 pb-24 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-black">Sound Board</h1>
        <p className="mt-1 text-sm font-bold text-white">
          Every game sound. Tap ▶ to listen. Tap Replace to upload a new one. The game uses it from the next load.
        </p>
        <p className="mt-1 text-xs font-bold text-white/70">
          {overrides === null ? "Loading…" : changed === 0 ? "All sounds are the original ones." : `${changed} replaced.`}
        </p>

        {SFX_GROUPS.map((g) => (
          <section key={g} className="mt-6">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">{g}</h2>
            <ul className="mt-2 space-y-2">
              {SFX_CATALOG.filter((s) => s.group === g).map((s) => {
                const ov = overrides?.[s.name];
                const cur = ov ? `cur:${s.name}` : `orig:${s.name}`;
                const m = meta[s.name];
                const isBusy = busy === s.name;
                return (
                  <li key={s.name} className={`rounded-xl border p-3 ${ov ? "border-amber-400/70 bg-amber-400/10" : "border-white/15 bg-white/5"}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => play(cur, ov ? ov.url : `/sfx/${s.name}.mp3`)}
                        aria-label={`Play ${s.label}`}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black text-slate-950 ${playing === cur ? "bg-white" : "bg-emerald-400"}`}
                      >
                        {playing === cur ? "■" : "▶"}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-black">{s.label}</span>
                          {ov && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-950">Replaced</span>}
                          {!s.wired && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase">Not in the game yet</span>}
                        </div>
                        <div className="text-xs font-bold text-white/70">
                          {s.name}
                          {m?.duration != null ? ` · original ${m.duration.toFixed(1)}s` : ""}
                          {m?.kb != null ? ` · ${m.kb} KB` : ""}
                        </div>
                        <p className="mt-1 text-sm font-bold text-white">{s.where}</p>
                        {ov && (
                          <p className="mt-1 text-xs font-bold text-amber-200">
                            Now playing your upload{ov.original ? ` (${ov.original})` : ""}.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className={`cursor-pointer rounded-lg border border-white/30 px-3 py-2 text-xs font-black ${isBusy ? "opacity-50" : ""}`}>
                        {isBusy ? "Working…" : ov ? "Replace again" : "Replace"}
                        <input
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
                          className="hidden"
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
                          <button
                            onClick={() => play(`orig:${s.name}`, `/sfx/${s.name}.mp3`)}
                            className="rounded-lg border border-white/30 px-3 py-2 text-xs font-black"
                          >
                            {playing === `orig:${s.name}` ? "■ Original" : "▶ Original"}
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => void revert(s.name)}
                            className="rounded-lg border border-rose-300/60 px-3 py-2 text-xs font-black text-rose-200 disabled:opacity-50"
                          >
                            Put the original back
                          </button>
                        </>
                      )}
                    </div>
                    {msg?.name === s.name && (
                      <p className={`mt-2 text-xs font-black ${msg.bad ? "text-rose-300" : "text-emerald-300"}`}>{msg.text}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
