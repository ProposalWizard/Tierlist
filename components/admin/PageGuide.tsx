"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ADMIN_GUIDES, type AdminGuide, type GuidePage } from "@/lib/adminGuides";

/**
 * THE PAGE GUIDE — the little eye on every admin and dev page.
 *
 * Asked for directly: "there should be an information panel on every single
 * page in the admin sections: just a little eye on how to use whatever's
 * currently on the page... the same UI across everything and just summarises
 * how to use every button on the screen, how it works in terms of the
 * website, saving stuff, committing to the repo, where stuff goes."
 *
 * The words live in ONE file, lib/adminGuides.ts, keyed by route. This
 * component only draws them, always in the same order, so every page's guide
 * reads the same way:
 *
 *   What this page is → Buttons → Saving → Committing to the repo →
 *   Where this shows up in the game → Needs setting up → For developers
 *
 * A page with nothing to commit still shows that heading with one plain line,
 * so "does this go into the code?" always has an answer in the same place.
 *
 * Portaled to <body> so it survives the immersive pages (gallery, play area,
 * highlights), which hide the site nav, and so no page's own stacking context
 * can bury it. It never reads or writes anything — purely a panel of words.
 */

type Corner = "bottom-right" | "bottom-left" | "top-right";

const CORNER: Record<Corner, string> = {
  "bottom-right": "right-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))]",
  "bottom-left": "left-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))]",
  "top-right": "right-2 top-2",
};

const NO_COMMIT = "Nothing on this page commits to the repo.";

export default function PageGuide({
  page,
  corner = "bottom-right",
}: {
  /** The route this guide describes — the key into lib/adminGuides.ts. */
  page: GuidePage;
  /** Where the eye sits, if bottom-right would cover one of the page's own controls. */
  corner?: Corner;
}) {
  const [open, setOpen] = useState(false);
  // createPortal needs a real document, which does not exist during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onKey]);

  const g: AdminGuide | undefined = ADMIN_GUIDES[page];
  if (!mounted || !g) return null;

  return createPortal(
    <div data-page-guide>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How this page works"
        title="How this page works"
        className={`fixed z-[95] grid h-9 w-9 place-items-center rounded-full border border-sky-400/50 bg-gray-950/85 text-sky-300 shadow-lg shadow-black/50 backdrop-blur transition hover:border-sky-300 hover:text-white ${CORNER[corner]} ${open ? "pointer-events-none opacity-0" : "opacity-90"}`}
      >
        <EyeIcon />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`How to use ${g.title}`}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b111d] text-left text-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-white/10 px-5 pb-3 pt-4">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-300">
                <EyeIcon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black uppercase tracking-widest text-sky-300/80">How this page works</div>
                <div className="text-lg font-black leading-tight">{g.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-lg font-black text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
              <p className="text-[15px] font-bold leading-snug text-white">{g.what}</p>

              <Heading>Buttons</Heading>
              <div className="space-y-4">
                {g.buttons.map((grp, gi) => (
                  <div key={gi}>
                    {grp.group && (
                      <div className="mb-1.5 text-[12px] font-black uppercase tracking-wider text-white/55">{grp.group}</div>
                    )}
                    <ul className="space-y-1.5">
                      {grp.items.map(([label, does], i) => (
                        <li key={i} className="text-[13.5px] leading-snug text-white/90">
                          <span className="mr-1.5 inline-block rounded-md border border-white/15 bg-white/[0.07] px-1.5 py-px text-[12.5px] font-black text-white">
                            {label}
                          </span>
                          {does}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <Heading>Saving</Heading>
              <Bullets items={g.saving} />

              <Heading>Committing to the repo</Heading>
              <Bullets items={g.commit?.length ? g.commit : [NO_COMMIT]} />

              <Heading>Where this shows up in the game</Heading>
              <Bullets items={g.inGame} />

              {g.needs && g.needs.length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
                  <div className="mb-1 text-[12px] font-black uppercase tracking-wider text-amber-300">Needs setting up</div>
                  <Bullets items={g.needs} tone="amber" />
                </div>
              )}

              <div className="mt-6 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
                <span className="font-bold text-white/60">For developers: </span>
                <span className="font-mono [overflow-wrap:anywhere]">{g.dev}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 text-[12px] font-black uppercase tracking-widest text-sky-300">{children}</div>
  );
}

function Bullets({ items, tone }: { items: string[]; tone?: "amber" }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className={`flex gap-2 text-[13.5px] leading-snug ${tone === "amber" ? "text-amber-100" : "text-white/90"}`}>
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "amber" ? "bg-amber-300" : "bg-sky-400"}`} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
