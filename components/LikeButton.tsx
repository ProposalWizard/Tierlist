"use client";

import { useState } from "react";

interface Props {
  tierlistId: string;
  initialCount: number;
  initialLiked: boolean;
  isLoggedIn: boolean;
}

export default function LikeButton({ tierlistId, initialCount, initialLiked, isLoggedIn }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn || loading) return;
    setLoading(true);
    // Optimistic update
    setLiked((v) => !v);
    setCount((v) => (liked ? v - 1 : v + 1));

    const res = await fetch(`/api/tierlists/${tierlistId}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } else {
      // Revert
      setLiked((v) => !v);
      setCount((v) => (liked ? v + 1 : v - 1));
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={!isLoggedIn || loading}
      title={isLoggedIn ? (liked ? "Unlike" : "Like") : "Sign in to like"}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
        liked
          ? "border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>{liked ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
