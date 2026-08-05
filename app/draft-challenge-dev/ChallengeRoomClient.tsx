"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChallengeBoard from "@/components/draft/challenge/ChallengeBoard";
import BriefReel from "@/components/draft/challenge/BriefReel";
import SquadManager from "@/components/draft/SquadManagerDev";
import { getFlagUrl } from "@/lib/nationalities";
import { boardSizeForPlayers } from "@/lib/challengeDraft";
import { orderForRound } from "@/lib/challengeRoom";
import type { ChallengeRoomState } from "@/lib/challengeRoom";
import type { AmPlayer } from "@/lib/americanDraft";
import type { DraftPlayer } from "@/app/draft/page";

/**
 * The multiplayer Challenge draft.
 *
 * State lives on the room and arrives by Realtime, with a short safety poll —
 * Realtime drops events often enough that two clients could otherwise sit on
 * stale state, each waiting for the other to pick.
 */

interface RoomPlayer { user_id: string; name: string; status: string }

interface RoomSnapshot {
  roomId: string;
  code: string;
  hostId: string;
  isHost: boolean;
  players: RoomPlayer[];
  state: ChallengeRoomState | null;
  mySquad: DraftPlayer[] | null;
}

const ERA_OPTIONS = [
  { label: "All time (2006 – now)", start: 2007, end: 2026 },
  { label: "Modern (2018 – now)", start: 2019, end: 2026 },
  { label: "Classic (2006 – 2015)", start: 2007, end: 2015 },
];

export default function ChallengeRoomClient({ onExit }: { onExit: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [era, setEra] = useState(ERA_OPTIONS[0]);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arranged, setArranged] = useState(false);
  const [reelFor, setReelFor] = useState<number | null>(null);

  // Set while OUR pick is in flight, so incoming state cannot put the card we
  // just took back on screen for a moment before removing it again.
  const pendingPickRef = useRef<string | null>(null);
  const [awaitingServer, setAwaitingServer] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const refresh = useCallback(async (force = false) => {
    if (!code) return;
    if (!force && pendingPickRef.current) return;
    try {
      const res = await fetch(`/api/draft-challenge/rooms/${code}`);
      if (!res.ok) return;
      const data = await res.json() as RoomSnapshot;
      pendingPickRef.current = null;
      setAwaitingServer(false);
      setRoom(data);
    } catch { /* the poll will try again */ }
  }, [code]);

  // Realtime, plus a 2s safety poll for as long as the draft is live.
  useEffect(() => {
    if (!code) return;
    void refresh(true);
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: r } = await supabase
        .from("draft_rooms").select("id").eq("code", code.toUpperCase()).maybeSingle();
      if (!r) return;
      channel = supabase
        .channel(`challenge-${code}-${Date.now()}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "draft_rooms", filter: `id=eq.${r.id}` },
          () => { void refresh(); })
        .on("postgres_changes",
          { event: "*", schema: "public", table: "draft_room_players", filter: `room_id=eq.${r.id}` },
          () => { void refresh(); })
        .subscribe();
    })();

    const poll = setInterval(() => { void refresh(); }, 2000);
    return () => {
      clearInterval(poll);
      if (channel) supabase.removeChannel(channel);
    };
  }, [code, refresh]);

  const state = room?.state ?? null;
  const order = state ? orderForRound(state.base_order, state.current_round) : [];
  const names = Object.fromEntries((room?.players ?? []).map(p => [p.user_id, p.name]));
  const myPicks = state && userId ? (state.picks[userId] ?? []) : [];
  const boardSize = boardSizeForPlayers(state?.base_order.length ?? room?.players.length ?? 1);

  // Show the reel once per round, for everyone, when a new round opens.
  const seenRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (!state || state.complete) return;
    if (seenRoundRef.current === state.current_round) return;
    seenRoundRef.current = state.current_round;
    setReelFor(state.current_round);
  }, [state]);

  // Warm the next round's faces while this one is being decided.
  useEffect(() => {
    for (const p of state?.round_players ?? []) {
      if (p.image_url) new Image().src = p.image_url;
      if (p.club_logo_url) new Image().src = p.club_logo_url;
      const flag = getFlagUrl(p.nationality);
      if (flag) new Image().src = flag;
    }
  }, [state?.round_players]);

  // ── Turn clock ───────────────────────────────────────────────────────────
  const deadline = state?.pick_deadline ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline || !state || state.complete) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline, state]);
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  const autoFiredRef = useRef<string | null>(null);
  const autoBusyRef = useRef(false);
  useEffect(() => {
    if (!state || state.complete || !deadline || !code) return;
    if ((state.round_players?.length ?? 0) === 0) return;
    if (now < deadline + 1500 || autoBusyRef.current) return;

    const key = `${state.current_round}-${state.current_pick_idx}-${deadline}`;
    if (autoFiredRef.current === key) return;
    autoFiredRef.current = key;
    autoBusyRef.current = true;

    void (async () => {
      try {
        const res = await fetch(`/api/draft-challenge/rooms/${code}/pick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto: true }),
        });
        // A failed attempt clears the guard so the next tick retries — otherwise
        // one rejected call leaves the room stalled exactly as it was before
        // there was a clock at all.
        if (!res.ok) autoFiredRef.current = null;
        await refresh(true);
      } catch {
        autoFiredRef.current = null;
      } finally {
        autoBusyRef.current = false;
      }
    })();
  }, [state, deadline, now, code, refresh]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const createRoom = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/draft-challenge/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eraStart: era.start, eraEnd: era.end }),
      });
      const data = await res.json().catch(() => null) as { code?: string; error?: string } | null;
      if (!res.ok || !data?.code) { setError(data?.error ?? "Could not create a room."); return; }
      setCode(data.code);
    } catch { setError("Network problem creating the room."); }
    finally { setBusy(false); }
  }, [era]);

  const joinRoom = useCallback(async () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 6) { setError("Room codes are six characters."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/draft-challenge/rooms/${c}/join`, { method: "POST" });
      const data = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) { setError(data?.error ?? "Could not join that room."); return; }
      setCode(c);
    } catch { setError("Network problem joining the room."); }
    finally { setBusy(false); }
  }, [joinCode]);

  const startDraft = useCallback(async () => {
    if (!code) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/draft-challenge/rooms/${code}/start`, { method: "POST" });
      const data = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) { setError(data?.error ?? "Could not start the draft."); return; }
      await refresh(true);
    } catch { setError("Network problem starting the draft."); }
    finally { setBusy(false); }
  }, [code, refresh]);

  const makePick = useCallback(async (sofifaId: string) => {
    if (!code) return;
    setError(null);
    pendingPickRef.current = sofifaId;
    setAwaitingServer(true);

    // Optimistic: take the card off our own board immediately. The server is
    // still the authority and its reply overwrites this.
    setRoom(prev => prev?.state
      ? { ...prev, state: { ...prev.state, round_players: prev.state.round_players.filter(p => p.sofifa_id !== sofifaId) } }
      : prev);

    try {
      const res = await fetch(`/api/draft-challenge/rooms/${code}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofifa_id: sofifaId }),
      });
      const data = await res.json().catch(() => null) as
        | { state?: ChallengeRoomState; error?: string } | null;
      pendingPickRef.current = null;
      setAwaitingServer(false);
      if (!res.ok) { setError(data?.error ?? "Could not make that pick."); await refresh(true); return; }
      if (data?.state) setRoom(prev => (prev ? { ...prev, state: data.state! } : prev));
      // The finished draft writes squads server-side; pick them up.
      if (data?.state?.complete) await refresh(true);
    } catch {
      pendingPickRef.current = null;
      setAwaitingServer(false);
      setError("Network problem — retrying from the server state.");
      await refresh(true);
    }
  }, [code, refresh]);

  // ── Screens ──────────────────────────────────────────────────────────────
  if (!userId) {
    return (
      <Shell>
        <p className="text-sm text-white/85">
          You need to be signed in to play with friends.
        </p>
        <button onClick={onExit} className="mt-4 text-xs font-bold text-cyan-400 underline">
          Back
        </button>
      </Shell>
    );
  }

  // Create / join
  if (!code) {
    return (
      <Shell>
        <h2 className="text-lg font-black uppercase italic text-white mb-4">Play with friends</h2>

        <label className="block text-[10px] font-bold tracking-widest text-white/75 uppercase mb-2">Era</label>
        <div className="grid gap-2 mb-5">
          {ERA_OPTIONS.map(o => (
            <button
              key={o.label}
              onClick={() => setEra(o)}
              className={`text-left px-3 py-2.5 rounded-lg border text-xs font-bold transition-colors ${
                era.label === o.label
                  ? "border-cyan-400/50 bg-cyan-400/10 text-white"
                  : "border-white/15 text-white/85 hover:border-white/30"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          onClick={createRoom}
          disabled={busy}
          className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-white text-sm disabled:opacity-60 mb-5"
          style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
        >
          {busy ? "Creating…" : "Create room"}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">or join</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="CODE"
            maxLength={6}
            className="flex-1 px-3 py-3 rounded-lg bg-[#0d1a2b] border border-white/15 text-white font-black tracking-[0.3em] text-center uppercase placeholder:text-white/40 focus:outline-none focus:border-cyan-400/60"
          />
          <button
            onClick={joinRoom}
            disabled={busy}
            className="px-5 rounded-lg font-black uppercase tracking-widest text-white text-xs border border-white/15 hover:border-white/30 disabled:opacity-60"
          >
            Join
          </button>
        </div>

        {error && <p className="mt-4 text-red-400 text-xs font-semibold">{error}</p>}
        <button onClick={onExit} className="mt-5 text-xs font-bold text-white/75 hover:text-white underline">
          Play solo instead
        </button>
      </Shell>
    );
  }

  // Lobby
  if (!state) {
    return (
      <Shell>
        <div className="text-[10px] font-bold tracking-widest text-white/75 uppercase mb-1">Room code</div>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-4xl font-black tracking-[0.25em] text-cyan-400">{code}</span>
          <button
            onClick={() => { void navigator.clipboard?.writeText(code).catch(() => {}); }}
            className="text-[10px] font-bold uppercase tracking-widest text-white/85 border border-white/15 rounded px-2 py-1 hover:text-white"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-white/85 mb-5">
          Share that code. Everyone drafts from the same board, one at a time.
        </p>

        <div className="text-[10px] font-bold tracking-widest text-white/75 uppercase mb-2">
          In the room ({room?.players.length ?? 0})
        </div>
        <div className="space-y-1.5 mb-5">
          {(room?.players ?? []).map(p => (
            <div key={p.user_id} className="flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-white font-bold">{p.name}</span>
              {p.user_id === room?.hostId && (
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Host</span>
              )}
              {p.user_id === userId && <span className="text-[10px] text-white/75">(you)</span>}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-white/75 mb-4">
          {boardSize} cards per round for {room?.players.length ?? 1}{" "}
          {(room?.players.length ?? 1) === 1 ? "manager" : "managers"}.
        </p>

        {room?.isHost ? (
          <button
            onClick={startDraft}
            disabled={busy}
            className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-white text-sm disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
          >
            {busy ? "Drawing briefs…" : "Start draft"}
          </button>
        ) : (
          <p className="text-sm text-white/85 text-center py-3">Waiting for the host to start…</p>
        )}

        {error && <p className="mt-4 text-red-400 text-xs font-semibold">{error}</p>}
      </Shell>
    );
  }

  // Finished — arrange your own squad
  if (state.complete) {
    const squad = room?.mySquad ?? [];
    if (!arranged && squad.length > 0) {
      return (
        <div className="min-h-screen bg-[#050b14]">
          <SquadManager
            players={squad}
            formationName="4-3-3"
            title="Challenge Draft"
            subtitle="Arrange Your Squad"
            allowFormationChange
            isMultiplayer
            onConfirm={() => { setArranged(true); window.scrollTo({ top: 0 }); }}
          />
        </div>
      );
    }
    return (
      <Shell>
        <h2 className="text-lg font-black uppercase italic text-white mb-2">Squad locked in</h2>
        <p className="text-sm text-white/85 mb-5">
          {squad.length === 0
            ? "Your squad is still being saved — this will update in a moment."
            : "Everyone's squads are saved to the room."}
        </p>
        <div className="space-y-1.5 mb-5">
          {(room?.players ?? []).map(p => (
            <div key={p.user_id} className="flex items-center justify-between text-sm">
              <span className="text-white font-bold">{p.name}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                {p.status === "ready" ? "Ready" : p.status}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onExit}
          className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-white text-sm"
          style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
        >
          Done
        </button>
      </Shell>
    );
  }

  // Drafting
  const brief = state.briefs[state.current_round];
  const decoys = state.briefs.filter((_, i) => i !== state.current_round).map(b => b.title);
  const lastPick = Object.fromEntries(
    Object.entries(state.last_pick ?? {}).map(([uid, p]) => [uid, { name: p.name, image_url: p.image_url }])
  );

  return (
    <>
      <ChallengeBoard
        brief={brief}
        round={state.current_round}
        totalRounds={state.briefs.length}
        players={state.round_players}
        picks={myPicks.map(p => ({
          brief: state.briefs.find(b => b.id === p.briefId) ?? brief,
          player: p.player as AmPlayer,
        }))}
        loading={false}
        error={error}
        onPick={makePick}
        onRestart={onExit}
        boardSize={boardSize}
        pickOrder={order}
        currentPickIdx={state.current_pick_idx}
        names={names}
        lastPick={lastPick}
        userId={userId}
        secondsLeft={secondsLeft}
        locked={awaitingServer}
      />
      {reelFor === state.current_round && (
        <BriefReel brief={brief} decoys={decoys} onDone={() => setReelFor(null)} />
      )}
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060d1a] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-white/70 font-black text-xl select-none">{">>"}</span>
          <h1 className="text-2xl font-black uppercase italic tracking-tight leading-none">
            <span className="text-white">CHALLENGE </span>
            <span className="text-cyan-400">DRAFT</span>
          </h1>
          <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
        </div>
        <div className="bg-[#080f1e] rounded-2xl border border-white/[0.08] p-5">{children}</div>
      </div>
    </div>
  );
}
