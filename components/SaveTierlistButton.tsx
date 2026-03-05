"use client";

import { useState } from "react";

interface Props {
  tierlistId: string;
  initialSaved: boolean;
  isLoggedIn: boolean;
}

export default function SaveTierlistButton({ tierlistId, initialSaved, isLoggedIn }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn || loading) return;
    setLoading(true);
    setSaved((v) => !v); // optimistic

    const res = await fetch(`/api/tierlists/${tierlistId}/save`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setSaved(data.saved);
    } else {
      setSaved((v) => !v); // revert
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={!isLoggedIn || loading}
      title={isLoggedIn ? (saved ? "Remove from saved" : "Save to profile") : "Sign in to save"}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
        saved
          ? "border-indigo-500 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
          : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>{saved ? "🔖" : "🔖"}</span>
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
