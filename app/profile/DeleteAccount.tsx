"use client";

/**
 * app/profile/DeleteAccount.tsx — "Delete my account" (App Store rule 5.1.1(v)).
 * Two steps: press the button, then type DELETE.
 */

import { useState } from "react";

export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      try { localStorage.clear(); } catch { /* private window */ }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-7xl border-t border-gray-800/50 px-4 pb-10 pt-6">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-xs font-semibold text-red-400 underline hover:text-red-300">
          Delete my account
        </button>
      ) : (
        <div className="max-w-md rounded-xl border border-red-900/60 bg-red-950/20 p-4">
          <p className="mb-1 text-sm font-bold text-white">Delete your account?</p>
          <p className="mb-3 text-xs text-white">
            This permanently deletes your account, saved games, tierlists, votes and uploaded
            images. It cannot be undone. Type <b>DELETE</b> to confirm.
          </p>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
            className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
          />
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={go}
              disabled={busy || text !== "DELETE"}
              className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
            >
              {busy ? "Deleting..." : "Delete forever"}
            </button>
            <button
              onClick={() => { setOpen(false); setText(""); setError(""); }}
              disabled={busy}
              className="flex-1 rounded-lg border border-gray-600 py-2 text-sm font-semibold text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
