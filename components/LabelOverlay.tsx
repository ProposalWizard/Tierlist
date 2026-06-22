"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  imageUrl: string;
  imageName: string;
  currentLabel: string;
  onSave: (label: string) => void;
  onCancel: () => void;
}

export default function LabelOverlay({
  imageUrl,
  imageName,
  currentLabel,
  onSave,
  onCancel,
}: Props) {
  const [text, setText] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl space-y-4">
        <p className="text-sm font-semibold text-gray-300">Add label to image</p>

        {/* Image preview with live label preview */}
        <div className="relative mx-auto overflow-hidden rounded-xl border border-gray-700" style={{ maxWidth: 240 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageName}
            className="block w-full object-contain"
            style={{ maxHeight: 180 }}
          />
          {text && (
            <div className="absolute bottom-0 left-0 right-0 bg-white px-1 py-0.5 text-center">
              <span className="block truncate text-[10px] font-semibold leading-tight text-black">
                {text}
              </span>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(text.trim()); }}
          placeholder="e.g. Player name…"
          maxLength={40}
          className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={() => onSave(text.trim())}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            Save
          </button>
          {currentLabel && (
            <button
              onClick={() => onSave("")}
              className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-red-400 transition-colors hover:border-red-500 hover:text-red-300"
            >
              Remove
            </button>
          )}
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>

        <p className="text-center text-xs text-gray-200">Enter to save · Esc to cancel</p>
      </div>
    </div>
  );
}
