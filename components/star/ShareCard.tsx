"use client";

/**
 * THE SHARE CARD — one picture of a whole career, made for phones.
 *
 * Leo, 6 Oct 2026 (the plans page, "Share card"): "One picture of a whole
 * career for WhatsApp or Instagram." A tall picture, 1080 × 1350: the name,
 * the verdict, the Legacy score, the big numbers, the journey's crests, the
 * goals-by-season bars and the cabinet, with knowitball.co.uk at the bottom.
 * The picture itself is drawn in shareCardDraw.ts.
 *
 * Sharing: the picture is made first (shown as a preview), then Share opens
 * the phone's share menu (WhatsApp, Instagram …). A computer, or a phone that
 * cannot share a file, saves it instead ("Save picture").
 */
import { useEffect, useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { careerOverview, type CareerOverviewData } from "@/lib/star/careerOverview";
import { pitchFont } from "./ui/pitchFont";
import { CARD_W, CARD_H, makeCareerCardPicture } from "./shareCardDraw";

const GOLD = "#fbbf24";

/** "knowitball-jamie-calloway.png". */
export function cardFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "career";
  return `knowitball-${slug}.png`;
}

/** The words that go with the picture when it is shared. */
export function cardShareText(o: CareerOverviewData): string {
  const t = o.totals;
  const bits = [
    `${o.seasonsPlayed} seasons`,
    `${t.goals} goals`,
    ...(t.trophies > 0 ? [t.trophies === 1 ? "1 trophy" : `${t.trophies} trophies`] : []),
    ...(t.ballonDors > 0 ? [`${t.ballonDors}× Ballon d'Or`] : []),
  ];
  return `${o.name} — ${o.verdict.title}. ${bits.join(", ")}. Legacy ${Math.round(o.verdict.score)}. knowitball.co.uk`;
}

type Made = { kind: "making" } | { kind: "ready"; url: string; file: File } | { kind: "failed" };

/** Make the career's picture once; its object URL is freed when it goes. */
function useCardPicture(career: CareerState): { o: CareerOverviewData; made: Made } {
  const o = useMemo(() => careerOverview(career), [career]);
  const [made, setMade] = useState<Made>({ kind: "making" });
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    setMade({ kind: "making" });
    makeCareerCardPicture(o, career.farewell, pitchFont.style.fontFamily)
      .then(blob => {
        if (!alive) return;
        if (!blob) { setMade({ kind: "failed" }); return; }
        url = URL.createObjectURL(blob);
        setMade({ kind: "ready", url, file: new File([blob], cardFileName(o.name), { type: "image/png" }) });
      })
      .catch(err => { console.error("Share card failed:", err); if (alive) setMade({ kind: "failed" }); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [o, career.farewell]);
  return { o, made };
}

/** The picture on its own (the test page shows exactly what is shared). */
export function CareerCardPicture({ career, width = CARD_W }: { career: CareerState; width?: number }) {
  const { o, made } = useCardPicture(career);
  return (
    <div style={{ width, aspectRatio: `${CARD_W} / ${CARD_H}`, background: "#05080f", boxShadow: "0 0 0 1px rgba(255,255,255,.15)" }} data-card-picture={made.kind}>
      {made.kind === "ready"
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={made.url} alt={`${o.name}: the career card`} style={{ display: "block", width: "100%", height: "100%" }} />
        : <div className="grid h-full w-full place-items-center text-[12px] font-black uppercase tracking-wider text-white/70">{made.kind === "making" ? "Making the picture…" : "The picture could not be made."}</div>}
    </div>
  );
}

/**
 * The share sheet: makes the picture (a preview), then Share (the phone's
 * share menu) or Save picture (a download). Closing never loses the career.
 */
export function ShareCardSheet({ career, onClose }: { career: CareerState; onClose: () => void }) {
  const { o, made } = useCardPicture(career);
  const [note, setNote] = useState<string | null>(null);

  const canShareFile = made.kind === "ready" && typeof navigator !== "undefined"
    && typeof navigator.canShare === "function" && navigator.canShare({ files: [made.file] });

  const share = async () => {
    if (made.kind !== "ready") return;
    try {
      await navigator.share({ files: [made.file], text: cardShareText(o) });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setNote("Could not open the share menu. Save the picture instead.");
    }
  };
  const save = () => {
    if (made.kind !== "ready") return;
    const a = document.createElement("a");
    a.href = made.url;
    a.download = made.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setNote("Saved to your downloads.");
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/85 px-4 py-6" data-share-sheet role="dialog" aria-label="Share this career">
      <div className="w-full max-w-[400px]">
        <div className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.24em] text-amber-200">Share this career</div>
        <div className="relative mx-auto overflow-hidden" style={{ width: "min(100%, calc(68vh * 0.8))", aspectRatio: `${CARD_W} / ${CARD_H}`, background: "#05080f", boxShadow: "0 0 0 1px rgba(255,255,255,.12)" }}>
          {made.kind === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={made.url} alt={`${o.name}: the career card`} className="block h-full w-full" data-share-preview />
          ) : (
            <div className="grid h-full w-full place-items-center text-[12px] font-black uppercase tracking-wider text-white/70">
              {made.kind === "making" ? "Making the picture…" : "The picture could not be made."}
            </div>
          )}
        </div>
        {note && <div className="mt-2 text-center text-[11.5px] font-bold text-amber-200">{note}</div>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="kib-press py-3 text-[13px] font-black uppercase tracking-wide text-white" style={{ background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.15)", borderRadius: 2 }}>Close</button>
          {canShareFile ? (
            <button onClick={share} className="kib-press py-3 text-[13px] font-black uppercase tracking-wide text-gray-950" style={{ background: GOLD, borderRadius: 2 }} data-share-go>Share</button>
          ) : (
            <button onClick={save} disabled={made.kind !== "ready"} className="kib-press py-3 text-[13px] font-black uppercase tracking-wide text-gray-950 disabled:opacity-40" style={{ background: GOLD, borderRadius: 2 }} data-share-save>Save picture</button>
          )}
        </div>
        {canShareFile && (
          <button onClick={save} className="mt-2 w-full py-2 text-[11.5px] font-black uppercase tracking-wider text-white/70">Save picture instead</button>
        )}
      </div>
    </div>
  );
}
