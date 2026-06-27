"use client";

import { useState } from "react";
import { FRAME_STYLES } from "@/lib/xp";
import type { Reward } from "@/lib/xp";

interface Props {
  username: string;
  email: string;
  unlockedCards: (Reward & { unlocked: boolean })[];
  equippedFrame: string;
  onSave: (username: string) => Promise<{ ok: boolean; error?: string }>;
  onEquipFrame: (frameId: string) => void;
  onClose: () => void;
}

export default function SettingsModal({ username: initialUsername, email, unlockedCards, equippedFrame, onSave, onEquipFrame, onClose }: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPicturePicker, setShowPicturePicker] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(equippedFrame);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await onSave(username.trim());
    setSaving(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Saved!" });
      setTimeout(onClose, 800);
    } else {
      setMessage({ ok: false, text: result.error ?? "Something went wrong" });
    }
  }

  const frameCards = unlockedCards.filter(c => c.category === "frame" && c.unlocked);

  if (showPicturePicker) {
    const selectedStyle = FRAME_STYLES[previewFrame] ?? FRAME_STYLES.frame_default;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowPicturePicker(false)}>
        <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-white mb-4">Choose Profile Picture</h3>

          {/* Preview */}
          <div className="flex justify-center mb-5">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-amber-500/50 shadow-lg shadow-amber-500/20">
              {selectedStyle.image ? (
                <img
                  src={selectedStyle.image}
                  alt="Preview"
                  className="w-full h-full"
                  style={{ objectFit: "cover", objectPosition: "center 28%", transform: "scale(1.6)", transformOrigin: "center 28%" }}
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${selectedStyle.gradient ?? "from-gray-700 to-gray-900"}`} />
              )}
            </div>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-4 gap-3 max-h-[280px] overflow-y-auto pb-2">
            {frameCards.map(card => {
              const style = FRAME_STYLES[card.id] ?? FRAME_STYLES.frame_default;
              const isSelected = previewFrame === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setPreviewFrame(card.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                    isSelected
                      ? "bg-amber-500/20 ring-2 ring-amber-400 scale-105"
                      : "bg-gray-800/50 hover:bg-gray-800 hover:scale-105"
                  }`}
                >
                  <div className="w-16 h-[84px] rounded-lg overflow-hidden shadow-md">
                    {style.image ? (
                      <img src={style.image} alt={card.name} className="w-full h-full object-cover" draggable={false} />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${style.gradient ?? "from-gray-700 to-gray-900"}`} />
                    )}
                  </div>
                  <span className={`text-[9px] font-bold text-center leading-tight ${isSelected ? "text-amber-400" : "text-white"}`}>
                    {card.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                onEquipFrame(previewFrame);
                setShowPicturePicker(false);
              }}
              disabled={previewFrame === equippedFrame}
              className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {previewFrame === equippedFrame ? "Current" : "Set as Profile Picture"}
            </button>
            <button
              onClick={() => { setPreviewFrame(equippedFrame); setShowPicturePicker(false); }}
              className="flex-1 rounded-xl border border-gray-600 py-2.5 text-sm font-bold text-white hover:border-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStyle = FRAME_STYLES[equippedFrame] ?? FRAME_STYLES.frame_default;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white mb-4">Account Settings</h3>
        <p className="text-sm text-white mb-4">{email}</p>

        <div className="space-y-4">
          {/* Profile Picture */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">Profile Picture</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/40 shrink-0">
                {currentStyle.image ? (
                  <img
                    src={currentStyle.image}
                    alt="Profile"
                    className="w-full h-full"
                    style={{ objectFit: "cover", objectPosition: "center 28%", transform: "scale(1.6)", transformOrigin: "center 28%" }}
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${currentStyle.gradient ?? "from-gray-700 to-gray-900"}`} />
                )}
              </div>
              <button
                onClick={() => setShowPicturePicker(true)}
                className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-sm font-bold text-white hover:text-white hover:border-gray-500 transition-all"
              >
                Change Picture
              </button>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-white">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose a username..."
              maxLength={32}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-white">
              You get one free username change. After that, once every 30 days.
            </p>
          </div>

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
              className="flex-1 rounded-xl border border-gray-600 py-2.5 text-sm font-bold text-white hover:border-gray-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
