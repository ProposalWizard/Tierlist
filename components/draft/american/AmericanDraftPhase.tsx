"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import AmericanDraftRoom from "./AmericanDraftRoom";
import type { AmericanState } from "@/lib/americanDraft";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  roomCode: string;
  userId: string;
  /**
   * Called once every squad has been written to the room as 'ready', with this
   * player's own drafted squad so they can arrange it before the season.
   */
  onComplete: (mySquad: DraftPlayer[]) => void;
}

/**
 * The American draft as a phase of a real multiplayer room.
 *
 * State lives on draft_rooms.american_state, so this reads the room and follows
 * it over Realtime — the same channel shape the lobby uses. When the state flips
 * to complete the server has already written every player's squad to their own
 * draft_room_players row with status 'ready', so we just hand control back to
 * the lobby and the normal simulate flow continues.
 */
export default function AmericanDraftPhase({ roomCode, userId, onComplete }: Props) {
  const [state, setState] = useState<AmericanState | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const completedRef = useRef(false);

  // Read back the squad the server just wrote for this player, so the arrange
  // screen shows the real drafted eleven rather than rebuilding it client-side.
  const finish = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    let mySquad: DraftPlayer[] = [];
    try {
      const res = await fetch(`/api/draft/rooms/${roomCode}`);
      if (res.ok) {
        const data = await res.json();
        const mine = (data.players as Array<{ user_id: string; squad?: DraftPlayer[] | null }> | undefined)
          ?.find(p => p.user_id === userId);
        if (Array.isArray(mine?.squad)) mySquad = mine.squad;
      }
    } catch {
      // Fall through with an empty squad — the caller drops straight to the
      // lobby, where the squad is already saved as ready either way.
    }
    onComplete(mySquad);
  }, [onComplete, roomCode, userId]);

  // Initial load + Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: room, error: roomErr } = await supabase
        .from("draft_rooms")
        .select("id, american_state")
        .eq("code", roomCode.toUpperCase())
        .maybeSingle();

      if (cancelled) return;

      if (roomErr || !room) {
        setError("Could not load the draft room.");
        setLoading(false);
        return;
      }

      const { data: players } = await supabase
        .from("draft_room_players")
        .select("user_id, display_name, team_name")
        .eq("room_id", room.id);

      if (cancelled) return;

      setNames(
        Object.fromEntries(
          (players ?? []).map(p => [p.user_id, p.team_name || p.display_name || "Player"])
        )
      );

      const initial = room.american_state as AmericanState | null;
      setState(initial);
      setLoading(false);
      if (initial?.complete) { void finish(); return; }

      channel = supabase
        .channel(`american-draft-${roomCode}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "draft_rooms", filter: `id=eq.${room.id}` },
          payload => {
            const next = (payload.new as { american_state?: AmericanState | null })?.american_state;
            if (!next) return;
            setState(next);
            if (next.complete) void finish();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomCode, finish]);

  const makePick = useCallback(async (sofifaId: string) => {
    setError(null);
    const res = await fetch(`/api/draft/rooms/${roomCode}/american/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sofifa_id: sofifaId }),
    });

    const payload = await res.json().catch(() => null) as
      | { ok?: boolean; complete?: boolean; error?: string }
      | null;

    if (!res.ok) {
      setError(payload?.error ?? "Could not make that pick.");
      return;
    }

    // Act on the response rather than waiting for the Realtime event — the last
    // pick produces no further room update for the final picker to observe.
    if (payload?.complete) { void finish(); return; }

    // Fallback refresh in case the Realtime event is dropped.
    const supabase = createClient();
    const { data: room } = await supabase
      .from("draft_rooms")
      .select("american_state")
      .eq("code", roomCode.toUpperCase())
      .maybeSingle();
    const next = room?.american_state as AmericanState | null;
    if (next) {
      setState(next);
      if (next.complete) void finish();
    }
  }, [roomCode, finish]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
        <div className="text-white/50 text-sm">Loading draft…</div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 font-bold text-sm mb-1">{error}</p>
          <p className="text-white/50 text-xs">Try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-white font-bold text-sm mb-1">Waiting for the host to start the draft…</p>
          <p className="text-white/50 text-xs">Room {roomCode}</p>
        </div>
      </div>
    );
  }

  // An empty pool on an unfinished round is a dead end, not a loading state —
  // say so rather than showing "Loading players…" forever.
  if (!state.complete && state.round_players.length === 0) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-white font-bold text-sm mb-1">No players available for this round</p>
          <p className="text-white/60 text-xs mb-4">
            {error ?? "The pool for this position came back empty."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-white"
            style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-center">
          <span className="text-red-400 text-xs font-semibold">{error}</span>
        </div>
      )}
      <AmericanDraftRoom
        positionSequence={state.position_sequence}
        currentRound={state.current_round}
        pickOrder={state.pick_order}
        currentPickIdx={state.current_pick_idx}
        roundPlayers={state.round_players}
        lastPick={state.last_pick ?? {}}
        names={names}
        userId={userId}
        onPick={makePick}
      />
    </>
  );
}
