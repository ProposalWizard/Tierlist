"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ChallengeBoard from "@/components/draft/challenge/ChallengeBoard";
import SquadManager from "@/components/draft/SquadManagerDev";
import { getFlagUrl } from "@/lib/nationalities";
import type { AmPlayer } from "@/lib/americanDraft";
import type { Brief } from "@/lib/challengeDraft";
import type { DraftPlayer } from "@/app/draft/page";

type Phase = "intro" | "loading" | "drafting" | "arrange" | "done";

interface EraOption { label: string; start: number; end: number }
const ERA_OPTIONS: EraOption[] = [
  { label: "All time (2006 – now)", start: 2007, end: 2026 },
  { label: "Modern (2018 – now)", start: 2019, end: 2026 },
  { label: "Classic (2006 – 2015)", start: 2007, end: 2015 },
];

/**
 * Turn a drafted card into the shape the arrange screen and simulator use.
 *
 * Everything starts on the bench with its natural position. The Challenge draft
 * has no formation slots — that is the entire point — so the eleven is chosen
 * afterwards on the arrange screen, which already refuses to continue until it
 * is full.
 */
function toDraftPlayer(p: AmPlayer): DraftPlayer {
  const natural = (p.positions || "").split(",")[0]?.trim().toUpperCase() || "CM";
  return {
    name: p.name,
    overall: p.ovr,
    positions: p.positions,
    club: p.club,
    clubYear: p.season ? `${p.club} ${p.season}` : p.club,
    assignedPosition: natural,
    sofifa_id: p.sofifa_id,
    image_url: p.image_url,
    nationality: p.nationality,
    age: p.age,
    isSub: true,
  } as DraftPlayer;
}

export default function ChallengeDraftClient() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [era, setEra] = useState<EraOption>(ERA_OPTIONS[0]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [round, setRound] = useState(0);
  const [players, setPlayers] = useState<AmPlayer[]>([]);
  const [picks, setPicks] = useState<{ brief: Brief; player: AmPlayer }[]>([]);
  const [squad, setSquad] = useState<DraftPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Everyone drafted so far, sent with each round so nobody is offered twice.
  const takenRef = useRef<{ sofifa_id: string; name: string }[]>([]);

  const loadRound = useCallback(async (briefList: Brief[], idx: number) => {
    if (idx >= briefList.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/draft-challenge/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefId: briefList[idx].id,
          taken: takenRef.current,
          eraStart: era.start,
          eraEnd: era.end,
        }),
      });
      const data = await res.json().catch(() => null) as
        | { players?: AmPlayer[]; error?: string } | null;
      if (!res.ok || !data?.players?.length) {
        setError(data?.error ?? "Could not load this round.");
        setPlayers([]);
        return;
      }
      setPlayers(data.players);

      // Warm the next round's images while this one is being decided.
      const next = briefList[idx + 1];
      if (next) void prefetchNext(briefList, idx + 1);
    } catch {
      setError("Network problem loading this round.");
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [era]);

  // Best-effort image warming. Failures are silent — it only buys a head start.
  const prefetchNext = useCallback(async (briefList: Brief[], idx: number) => {
    try {
      const res = await fetch("/api/draft-challenge/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefId: briefList[idx].id,
          taken: takenRef.current,
          eraStart: era.start,
          eraEnd: era.end,
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as { players?: AmPlayer[] };
      for (const p of data.players ?? []) {
        if (p.image_url) new Image().src = p.image_url;
        if (p.club_logo_url) new Image().src = p.club_logo_url;
        const flag = getFlagUrl(p.nationality);
        if (flag) new Image().src = flag;
      }
    } catch { /* head start only */ }
  }, [era]);

  const start = useCallback(async () => {
    setPhase("loading");
    setError(null);
    takenRef.current = [];
    setPicks([]);
    setRound(0);
    try {
      const res = await fetch("/api/draft-challenge/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eraStart: era.start, eraEnd: era.end }),
      });
      const data = await res.json().catch(() => null) as
        | { briefs?: Brief[]; error?: string } | null;
      if (!res.ok || !data?.briefs?.length) {
        setError(data?.error ?? "Could not start the draft.");
        setPhase("intro");
        return;
      }
      setBriefs(data.briefs);
      setPhase("drafting");
      await loadRound(data.briefs, 0);
    } catch {
      setError("Network problem starting the draft.");
      setPhase("intro");
    }
  }, [era, loadRound]);

  const handlePick = useCallback(async (sofifaId: string) => {
    const player = players.find(p => p.sofifa_id === sofifaId);
    if (!player) return;
    const brief = briefs[round];

    takenRef.current = [...takenRef.current, { sofifa_id: player.sofifa_id, name: player.name }];
    const nextPicks = [...picks, { brief, player }];
    setPicks(nextPicks);

    const nextRound = round + 1;
    if (nextRound >= briefs.length) {
      setSquad(nextPicks.map(p => toDraftPlayer(p.player)));
      setPhase("arrange");
      window.scrollTo({ top: 0 });
      return;
    }
    setRound(nextRound);
    setPlayers([]);
    await loadRound(briefs, nextRound);
  }, [players, briefs, round, picks, loadRound]);

  const restart = useCallback(() => {
    setPhase("intro");
    setBriefs([]);
    setPicks([]);
    setPlayers([]);
    setRound(0);
    setError(null);
    takenRef.current = [];
  }, []);

  // ── Intro ────────────────────────────────────────────────────────────────
  if (phase === "intro" || phase === "loading") {
    return (
      <div className="min-h-screen bg-[#060d1a] px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-white/40 font-black text-xl select-none">{">>"}</span>
            <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight leading-none">
              <span className="text-white">CHALLENGE </span>
              <span className="text-cyan-400">DRAFT</span>
            </h1>
            <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
          </div>

          <div className="bg-[#080f1e] rounded-2xl border border-white/[0.08] p-5 mb-4">
            <p className="text-sm text-white/80 leading-relaxed mb-3">
              Fourteen rounds. Ten cards each. But the rounds are not positions —
              every one is a randomly drawn <strong className="text-white">brief</strong>:
              a rating band, a nationality, a minimum attribute, a club, an era.
            </p>
            <p className="text-sm text-white/60 leading-relaxed mb-4">
              You draft whoever the brief throws up, then work out a formation
              from the fourteen players you ended up with. Premier League only.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {["88 – 92 RATED", "90+ PACE", "BRAZIL", "KEEPERS ONLY", "2010 – 2014", "UNDER 21"].map(t => (
                <span key={t} className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border border-white/10 text-white/60">
                  {t}
                </span>
              ))}
            </div>

            <label className="block text-[10px] font-bold tracking-widest text-white/50 uppercase mb-2">
              Era
            </label>
            <div className="grid gap-2 mb-5">
              {ERA_OPTIONS.map(o => (
                <button
                  key={o.label}
                  onClick={() => setEra(o)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-xs font-bold transition-colors ${
                    era.label === o.label
                      ? "border-cyan-400/50 bg-cyan-400/10 text-white"
                      : "border-white/10 text-white/60 hover:border-white/25"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="text-red-400 text-xs font-semibold mb-3">{error}</p>
            )}

            <button
              onClick={start}
              disabled={phase === "loading"}
              className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-white text-sm disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
            >
              {phase === "loading" ? "Drawing briefs…" : "Start draft"}
            </button>
          </div>

          <p className="text-[11px] text-white/35 text-center">
            Dev sandbox — single player, nothing is saved.
          </p>
        </div>
      </div>
    );
  }

  // ── Drafting ─────────────────────────────────────────────────────────────
  if (phase === "drafting" && briefs[round]) {
    return (
      <ChallengeBoard
        brief={briefs[round]}
        round={round}
        totalRounds={briefs.length}
        players={players}
        picks={picks}
        loading={loading}
        error={error}
        onPick={handlePick}
        onRestart={restart}
      />
    );
  }

  // ── Arrange ──────────────────────────────────────────────────────────────
  if (phase === "arrange") {
    return (
      <div className="min-h-screen bg-[#050b14]">
        <SquadManager
          players={squad}
          formationName="4-3-3"
          title="Challenge Draft"
          subtitle="Arrange Your Squad"
          isMultiplayer
          onConfirm={(arranged) => { setSquad(arranged); setPhase("done"); window.scrollTo({ top: 0 }); }}
        />
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#060d1a] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black uppercase italic tracking-tight text-white mb-1">
          Squad locked in
        </h1>
        <p className="text-sm text-white/60 mb-6">
          Fourteen briefs, fourteen players. Here is what each round asked for.
        </p>

        <div className="bg-[#080f1e] rounded-2xl border border-white/[0.08] divide-y divide-white/[0.05] mb-6">
          {picks.map(({ brief, player }, i) => (
            <div key={`${player.sofifa_id}-${i}`} className="flex items-center gap-3 p-3">
              <span className="w-5 text-[10px] font-black text-white/35 tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">{player.name}</div>
                <div className="text-[10px] text-white/45 truncate">
                  {brief.title} · {player.club} {player.season}
                </div>
              </div>
              <span className="text-sm font-black text-emerald-400 tabular-nums">{player.ovr}</span>
            </div>
          ))}
        </div>

        <button
          onClick={restart}
          className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-white text-sm"
          style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
        >
          Draft again
        </button>
      </div>
    </div>
  );
}
