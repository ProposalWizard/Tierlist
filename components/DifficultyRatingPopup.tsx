"use client";

import { useState } from "react";

interface Props {
  puzzleId: string;
  onDismiss: () => void;
}

function StarIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function getRatingLabel(r: number): string {
  if (r <= 0.5) return "Trivial";
  if (r <= 1)   return "Very Easy";
  if (r <= 1.5) return "Easy";
  if (r <= 2)   return "Fairly Easy";
  if (r <= 2.5) return "Moderate";
  if (r <= 3)   return "Average";
  if (r <= 3.5) return "Challenging";
  if (r <= 4)   return "Hard";
  if (r <= 4.5) return "Very Hard";
  return "Extreme";
}

export default function DifficultyRatingPopup({ puzzleId, onDismiss }: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const display = hovered || rating;

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>, star: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    setHovered(star - (isLeft ? 0.5 : 0));
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, star: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    setRating(star - (isLeft ? 0.5 : 0));
  };

  const handleConfirm = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/tictactoe/${puzzleId}/difficulty-rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch {}
    setSubmitted(true);
    setSubmitting(false);
    setTimeout(onDismiss, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl text-center">
        {submitted ? (
          <div className="py-2">
            <p className="text-5xl mb-3">⭐</p>
            <h2 className="text-xl font-black text-white">Thanks for rating!</h2>
            <p className="mt-1 text-sm text-gray-400">Your rating helps others gauge difficulty.</p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-black text-white mb-1">Rate the Difficulty</h2>
            <p className="text-sm text-gray-400 mb-6">
              How difficult was this daily Tic Tac Toe?
            </p>

            {/* Half-star rating widget */}
            <div
              className="flex justify-center gap-1 mb-3"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFull = display >= star;
                const isHalf = !isFull && display >= star - 0.5;
                return (
                  <button
                    key={star}
                    className="relative h-10 w-10 flex-shrink-0 focus:outline-none"
                    onMouseMove={(e) => handleMouseMove(e, star)}
                    onClick={(e) => handleClick(e, star)}
                    aria-label={`${star} stars`}
                  >
                    {/* Gray background star */}
                    <StarIcon className="absolute inset-0 h-full w-full text-gray-600" />
                    {/* Gold fill (half or full) — inner star must be h-10 w-10 to match the
                        button size, not h-full/w-full of the narrow clip container */}
                    {(isFull || isHalf) && (
                      <div
                        className={`absolute inset-y-0 left-0 overflow-hidden ${isHalf ? "w-1/2" : "w-full"}`}
                      >
                        <StarIcon className="absolute inset-0 h-10 w-10 text-amber-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Label for selected/hovered rating */}
            <p className="mb-5 h-5 text-sm font-bold text-amber-400">
              {display > 0 ? getRatingLabel(display) : "Tap a star to rate"}
            </p>

            <div className="flex gap-3">
              <button
                onClick={onDismiss}
                className="flex-1 rounded-xl border border-gray-700 py-3 text-sm font-bold text-gray-400 transition-colors hover:bg-gray-800"
              >
                Skip
              </button>
              <button
                onClick={handleConfirm}
                disabled={!rating || submitting}
                className="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-500 disabled:opacity-40"
              >
                {submitting ? "Saving…" : "Confirm"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
