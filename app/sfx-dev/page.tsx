"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Sound audition page — every sound in public/sfx/manifest.json with a play
 * button and what it's for, so the set can be judged on a phone. Unlinked dev
 * page; nothing here is wired into the game. Files come from
 * scripts/sfx/generate.py.
 */
interface Sound {
  name: string;
  file: string;
  duration: number;
  kb: number;
  purpose: string;
  prompt: string;
}

export default function SfxDevPage() {
  const [sounds, setSounds] = useState<Sound[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/sfx/manifest.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sounds: [] }))
      .then((m: { sounds: Sound[] }) => setSounds(m.sounds ?? []))
      .catch(() => setSounds([]));
  }, []);

  function play(s: Sound) {
    audio.current?.pause();
    const a = new Audio(s.file);
    audio.current = a;
    setPlaying(s.name);
    a.onended = () => setPlaying((p) => (p === s.name ? null : p));
    a.play().catch(() => setPlaying(null));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <h1 className="text-xl font-black">Sound effects</h1>
      <p className="mt-1 text-sm font-bold text-white/80">Tap to listen. Not in the game yet.</p>
      {sounds === null && <p className="mt-6 font-bold">Loading…</p>}
      {sounds?.length === 0 && <p className="mt-6 font-bold">No sounds generated yet.</p>}
      <ul className="mt-4 space-y-2">
        {sounds?.map((s) => (
          <li key={s.name}>
            <button
              onClick={() => play(s)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                playing === s.name ? "border-emerald-400 bg-emerald-500/20" : "border-white/15 bg-white/5"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-slate-950">
                {playing === s.name ? "■" : "▶"}
              </span>
              <span className="min-w-0">
                <span className="block font-black">{s.name}</span>
                <span className="block text-sm font-bold text-white/90">{s.purpose}</span>
                <span className="block text-xs font-bold text-white/60">
                  {s.duration.toFixed(1)}s · {s.kb} KB
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
