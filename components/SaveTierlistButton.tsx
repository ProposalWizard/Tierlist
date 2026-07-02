"use client";

import { useState, useEffect } from "react";

interface Props {
  tierlistId: string;
  initialSaved?: boolean;
  isLoggedIn?: boolean;
}

export default function SaveTierlistButton({ tierlistId, initialSaved = false, isLoggedIn = false }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [authed, setAuthed] = useState(isLoggedIn);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/tierlists/${tierlistId}/save`)
      .then((r) => r.json())
      .then((data) => {
        setSaved(data.saved);
        setAuthed(data.isLoggedIn);
      })
      .catch(() => {});
  }, [tierlistId]);

  async function toggle() {
    if (!authed || loading) return;
    setLoading(true);
    setSaved((v) => !v);

    try {
      const res = await fetch(`/api/tierlists/${tierlistId}/save`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
      } else {
        setSaved((v) => !v);
      }
    } catch {
      // Network error — roll back the optimistic flip
      setSaved((v) => !v);
    } finally {
      setLoading(false);
    }
  }

  if (!authed) return null;

  return (
    <button
      onClick={toggle}
      disabled={!authed || loading}
      title={saved ? "Remove bookmark" : "Bookmark this tierlist"}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
        saved
          ? "border-indigo-500 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
          : "border-gray-700 text-white hover:border-gray-500 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span>🔖</span>
      <span>{saved ? "Bookmarked" : "Bookmark"}</span>
    </button>
  );
}
