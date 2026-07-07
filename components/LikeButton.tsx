"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  tierlistId: string;
  initialCount?: number;
  initialLiked?: boolean;
  isLoggedIn?: boolean;
  endpoint?: string;
}

export default function LikeButton({ tierlistId, initialCount = 0, initialLiked = false, isLoggedIn = false, endpoint }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [authed, setAuthed] = useState(isLoggedIn);
  const [loading, setLoading] = useState(false);
  const toggleInFlight = useRef(false);

  useEffect(() => {
    const url = endpoint ?? `/api/tierlists/${tierlistId}/like`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (toggleInFlight.current) return;
        setLiked(data.liked);
        setCount(data.count);
        setAuthed(data.isLoggedIn);
      })
      .catch(() => {});
  }, [tierlistId, endpoint]);

  async function toggle() {
    if (!authed || toggleInFlight.current) return;
    toggleInFlight.current = true;
    setLoading(true);
    setLiked((v) => !v);
    setCount((v) => (liked ? v - 1 : v + 1));

    try {
      const res = await fetch(endpoint ?? `/api/tierlists/${tierlistId}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setCount(data.count);
      } else {
        // Roll back the optimistic update
        setLiked((v) => !v);
        setCount((v) => (liked ? v + 1 : v - 1));
      }
    } catch {
      // Network error — roll back so the UI matches the server
      setLiked((v) => !v);
      setCount((v) => (liked ? v + 1 : v - 1));
    } finally {
      setLoading(false);
      toggleInFlight.current = false;
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={!authed || loading}
      title={authed ? (liked ? "Unlike" : "Like") : "Sign in to like"}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
        liked
          ? "border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          : "border-gray-700 text-white hover:border-gray-500 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>{liked ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
