"use client";

import { useState } from "react";

interface Props {
  username: string;
  isAnonymous: boolean;
  email: string;
  onSave: (username: string, isAnonymous: boolean) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export default function SettingsModal({ username: initialUsername, isAnonymous: initialAnon, email, onSave, onClose }: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [isAnon, setIsAnon] = useState(initialAnon);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await onSave(username.trim(), isAnon);
    setSaving(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Saved!" });
      setTimeout(onClose, 800);
    } else {
      setMessage({ ok: false, text: result.error ?? "Something went wrong" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white mb-4">Account Settings</h3>
        <p className="text-sm text-gray-500 mb-4">{email}</p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-300">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose a username..."
              maxLength={32}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              Shown as the creator of your tierlists. Leave blank to be anonymous.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isAnon}
              onChange={e => setIsAnon(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 accent-amber-500"
            />
            <span className="text-sm text-gray-300">
              Show as <span className="font-semibold text-white">Anonymous</span> on all tierlists
            </span>
          </label>

          {message && (
            <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>
              {message.text}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-gray-600 py-2.5 text-sm font-bold text-gray-300 hover:border-gray-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
