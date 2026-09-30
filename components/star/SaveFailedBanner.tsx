"use client";

import { useEffect, useState } from "react";
import { getSaveFailure, onSaveFailureChange, type SaveFailure } from "@/lib/star/storage";

/**
 * "Couldn't save on this device" — a small bar pinned to the top of the
 * screen, on every Star Career screen, the moment writing the save to this
 * device fails (see SaveFailure in lib/star/storage.ts). Non-blocking: the
 * game carries on underneath it. It clears itself as soon as a save works
 * again, and once dismissed it stays away until saving recovers and then
 * fails a second time.
 *
 * Mounted from app/star-dev/layout.tsx rather than page.tsx, so it shows
 * whichever phase the page is in without adding to the shared page file.
 */
export default function SaveFailedBanner() {
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  useEffect(() => {
    setFailure(getSaveFailure());
    return onSaveFailureChange(setFailure);
  }, []);

  if (!failure || failure.id === dismissedId) return null;
  const tone = failure.signedIn
    ? "bg-amber-500 border-amber-300 text-black"
    : "bg-red-600 border-red-400 text-white";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="save-failed-banner"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
    >
      <div className={`pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl border p-3 shadow-lg ${tone}`}>
        <p className="flex-1 text-xs font-bold leading-snug">{failure.message}</p>
        <button
          onClick={() => setDismissedId(failure.id)}
          className="shrink-0 text-sm leading-none opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
