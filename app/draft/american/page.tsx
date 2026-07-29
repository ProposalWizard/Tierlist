"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AmericanDraftRoom from "@/components/draft/american/AmericanDraftRoom";
import { POSITION_LABELS } from "@/lib/americanDraft";
import type { AmRoom, AmParticipant } from "@/lib/americanDraft";

type Phase = "loading" | "home" | "lobby" | "drafting" | "complete" | "redirecting";

const POS_TEXT: Record<string, string> = {
  GK: "text-yellow-400", RB: "text-blue-400", CB: "text-blue-400", LB: "text-blue-400",
  CM: "text-green-400", RW: "text-red-400", LW: "text-red-400", ST: "text-red-400",
  ANY: "text-purple-400",
};

const POSITION_SEQUENCE = ["GK","RB","CB","CB","LB","CM","CM","CM","RW","ST","LW","ANY","ANY","ANY"];

// ── Complete / fallback screen (shown if linked_room_code is missing) ─────────
function CompleteScreen({
  participants,
  onBack,
}: {
  participants: AmParticipant[];
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#050b14] p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-1">American Draft</div>
          <h1 className="text-2xl font-black text-white uppercase italic">Draft Complete!</h1>
          <p className="text-gray-500 text-sm mt-1">All squads have been selected.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {participants.map(p => (
            <div key={p.id} className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
              <div className="font-black text-white text-sm uppercase italic mb-3">{p.display_name}</div>
              <div className="space-y-1.5">
                {(p.squad || []).map((pick, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold w-7 shrink-0 ${POS_TEXT[pick.position] || "text-gray-400"}`}>
                      {pick.position === "ANY" ? "SUB" : pick.position}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {pick.player.image_url && (
                        <img
                          src={pick.player.image_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover shrink-0"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <span className="text-[11px] text-white/80 truncate">{pick.player.name}</span>
                    </div>
                    <span className="text-[9px] text-gray-500 shrink-0 tabular-nums">{pick.player.ovr}</span>
                  </div>
                ))}
              </div>
              {p.squad.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">Avg OVR</span>
                  <span className="text-xs font-black text-white tabular-nums">
                    {Math.round(p.squad.reduce((s, x) => s + x.player.ovr, 0) / p.squad.length)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AmericanDraftPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [room, setRoom] = useState<AmRoom | null>(null);
  const [participants, setParticipants] = useState<AmParticipant[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setPhase("home");
    });
  }, []);

  const redirectToLinkedRoom = useCallback((linkedCode: string) => {
    setPhase("redirecting");
    window.location.href = `/draft?room=${linkedCode}`;
  }, []);

  const loadRoom = useCallback(async (code: string) => {
    const res = await fetch(`/api/draft/american/${code}`);
    if (!res.ok) { setError("Room not found"); return; }
    const { room: r, participants: p } = (await res.json()) as { room: AmRoom; participants: AmParticipant[] };
    setRoom(r);
    setParticipants(p);
    if (r.status === "drafting") setPhase("drafting");
    else if (r.status === "complete") {
      if (r.linked_room_code) {
        redirectToLinkedRoom(r.linked_room_code);
      } else {
        setPhase("complete");
      }
    } else {
      setPhase("lobby");
    }
  }, [redirectToLinkedRoom]);

  // Realtime subscription
  useEffect(() => {
    if (!room) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`am-draft-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "american_draft_rooms", filter: `id=eq.${room.id}` },
        payload => {
          const updated = payload.new as AmRoom;
          setRoom(updated);
          if (updated.status === "drafting") setPhase("drafting");
          if (updated.status === "complete") {
            if (updated.linked_room_code) {
              redirectToLinkedRoom(updated.linked_room_code);
            } else {
              setPhase("complete");
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "american_draft_participants", filter: `room_id=eq.${room.id}` },
        () => {
          fetch(`/api/draft/american/${room.code}`)
            .then(r => r.json())
            .then(({ participants: p }: { participants: AmParticipant[] }) => setParticipants(p));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room?.id, room?.code, redirectToLinkedRoom]);

  const createRoom = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/draft/american", { method: "POST" });
      if (!res.ok) { setError(await res.text()); return; }
      const { code } = (await res.json()) as { code: string };
      await loadRoom(code);
    } finally { setBusy(false); }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError("Enter a 6-character room code"); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/draft/american/${code}/join`, { method: "POST" });
      if (!res.ok) { setError(await res.text()); return; }
      await loadRoom(code);
    } finally { setBusy(false); }
  };

  const startDraft = async () => {
    if (!room) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/draft/american/${room.code}/start`, { method: "POST" });
      if (!res.ok) setError(await res.text());
    } finally { setBusy(false); }
  };

  const makePick = useCallback(async (sofifa_id: string) => {
    if (!room) return;
    const res = await fetch(`/api/draft/american/${room.code}/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sofifa_id }),
    });
    if (!res.ok) setError(await res.text());
  }, [room]);

  const goHome = () => { setRoom(null); setParticipants([]); setPhase("home"); };

  // ── Loading / redirecting ──
  if (phase === "loading" || phase === "redirecting") {
    return (
      <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
        <div className="text-white/30 text-sm">
          {phase === "redirecting" ? "Joining season room…" : "Loading…"}
        </div>
      </div>
    );
  }

  // ── Not signed in ──
  if (!userId) {
    return (
      <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <h1 className="text-2xl font-black text-white uppercase italic mb-2">American Draft</h1>
          <p className="text-gray-400 text-sm mb-6">Sign in to create or join a multiplayer room.</p>
          <Link
            href="/auth?next=/draft/american"
            className="inline-block px-6 py-3 rounded-xl font-bold text-white transition-all"
            style={{ background: "linear-gradient(90deg,#0d9488,#06b6d4)" }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ── Drafting ──
  if (phase === "drafting" && room) {
    return (
      <AmericanDraftRoom
        room={room}
        participants={participants}
        userId={userId}
        onPick={makePick}
      />
    );
  }

  // ── Complete fallback (if linked_room_code is null) ──
  if (phase === "complete") {
    return <CompleteScreen participants={participants} onBack={goHome} />;
  }

  // ── Lobby ──
  if (phase === "lobby" && room) {
    const isHost = room.host_id === userId;

    return (
      <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-1">American Draft</div>
            <h1 className="text-3xl font-black text-white uppercase italic">Lobby</h1>
          </div>

          {/* Room code */}
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 text-center mb-3">
            <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-1">Room Code</div>
            <div className="text-4xl font-black text-white tracking-widest font-mono">{room.code}</div>
            <div className="text-[10px] text-gray-600 mt-1">Share this code with friends</div>
          </div>

          {/* Players */}
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 mb-3">
            <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-2">
              Players ({participants.length}/6)
            </div>
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-cyan-700/60 border border-cyan-500/30 flex items-center justify-center text-xs font-black text-white shrink-0">
                    {p.display_name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-white flex-1">{p.display_name}</span>
                  {p.user_id === room.host_id && (
                    <span className="text-[9px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded font-bold uppercase">Host</span>
                  )}
                  {p.user_id === userId && (
                    <span className="text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-bold uppercase">You</span>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, 6 - participants.length) }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 opacity-25">
                  <div className="w-8 h-8 rounded-full border border-dashed border-gray-700" />
                  <span className="text-xs text-gray-600">Waiting for player…</span>
                </div>
              ))}
            </div>
          </div>

          {/* Format info */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4">
            <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase mb-1.5">Format</div>
            <div className="text-[10px] text-gray-500 space-y-0.5">
              <div>· Premier League players only</div>
              <div>· 14 rounds — 11 positions + 3 subs (any position)</div>
              <div>· 10 players shown per round, pick order randomised</div>
              <div>· 2–6 players · Leads into season simulation</div>
            </div>
          </div>

          {error && <div className="text-red-400 text-xs text-center mb-3">{error}</div>}

          {isHost ? (
            <button
              onClick={startDraft}
              disabled={busy || participants.length < 2}
              className="w-full py-4 rounded-xl font-black italic text-lg text-white uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(115deg,#059669 0%,#0d9488 45%,#0891b2 100%)" }}
            >
              {busy ? "Starting…" : participants.length < 2 ? "Waiting for players…" : "Start Draft →"}
            </button>
          ) : (
            <div className="w-full py-4 text-center text-sm text-gray-500">
              Waiting for host to start…
            </div>
          )}

          <button onClick={goHome} className="w-full mt-3 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Leave Lobby
          </button>
        </div>
      </div>
    );
  }

  // ── Home ──
  return (
    <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase mb-3">Multiplayer Only · PL Players</div>
          <h1 className="text-4xl sm:text-5xl font-black text-white uppercase italic leading-none mb-2">
            American<br />
            <span className="text-cyan-400">Draft</span>
          </h1>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-xs mx-auto">
            14 rounds of picks — all players visible to everyone. Take turns choosing Premier League stars. Build the best squad, then play the season.
          </p>
        </div>

        {/* Positions preview */}
        <div className="flex flex-wrap gap-1 justify-center mb-8">
          {POSITION_SEQUENCE.map((p, i) => (
            <span
              key={i}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                POS_TEXT[p] || "text-gray-400"
              } border-current/20 bg-current/[0.06]`}
            >
              {p === "ANY" ? "SUB" : p}
            </span>
          ))}
        </div>

        <button
          onClick={createRoom}
          disabled={busy}
          className="w-full py-4 rounded-xl font-black italic text-xl text-white uppercase mb-3 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(115deg,#059669 0%,#0d9488 45%,#0891b2 100%)", boxShadow: "0 8px 24px rgba(6,182,212,0.3)" }}
        >
          {busy ? "Creating…" : "Create Room"}
        </button>

        <div className="relative mb-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-px bg-white/[0.08]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#050b14] px-3 text-[10px] text-gray-600 uppercase tracking-widest">or join</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={e => e.key === "Enter" && joinRoom()}
            placeholder="ROOM CODE"
            maxLength={6}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 tracking-widest uppercase"
          />
          <button
            onClick={joinRoom}
            disabled={busy}
            className="px-5 py-3 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-all disabled:opacity-50"
          >
            Join
          </button>
        </div>

        {error && <div className="text-red-400 text-xs text-center mt-3">{error}</div>}

        <div className="mt-8 text-center">
          <Link href="/draft" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to Draft
          </Link>
        </div>
      </div>
    </div>
  );
}
