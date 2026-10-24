"use client";

/**
 * FOR YOU — the shop as a TikTok feed (Harry, 12 Oct 2026). One item fills the
 * screen; swipe up / down through every item in the store, locked ones too
 * (a lock and the star rating it needs). Almost no UI: a caption bottom-left
 * like a video's (the name small, a short line, tags; never the exact price —
 * Harry, 12 Oct 2026) and small round buttons bottom-right (Like, Info, See
 * all, Buy), like TikTok's.
 *
 * Now and then an "ad": your last match's goals, from the recordings on this
 * device (lib/star/goalClip/, the same videos the media feed plays). It can
 * be skipped after a few seconds. No recordings on this device, no ads.
 */
import { useEffect, useRef, useState } from "react";
import GoalVideo from "../media/GoalVideoSwitch";
import type { CatId, View } from "./ShowroomShop";

export interface FeedItem { cat: CatId; key: string; accent: string; label: string }
export type FeedEntry = { ad: false; item: FeedItem } | { ad: true; id: string };
export interface HighlightAd { clipIds: string[]; title: string; sub: string }

/** Seconds before an ad can be skipped. */
export const AD_SKIP_AFTER = 4;

export default function ForYouFeed({ entries, viewOf, ownLabel, needStars, ad, onDetails, onSeeAll, onAdShown }: {
  entries: FeedEntry[];
  viewOf: (cat: CatId, key: string) => View;
  ownLabel: (cat: CatId, key: string) => string | null;
  /** Locked items: the star rating that opens them, and yours. */
  needStars: (key: string) => { need: number; have: number } | null;
  ad: HighlightAd | null;
  onDetails: (cat: CatId, key: string) => void;
  onSeeAll: (cat: CatId, key: string) => void;
  /** An ad is on screen (the shop hides its top bar: the video goes edge to edge). */
  onAdShown?: (on: boolean) => void;
}) {
  const feed = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  // the ad on screen: counting down to Skip, and the feed held still until then
  const [left, setLeft] = useState(0);
  const onAd = entries[at]?.ad === true;
  useEffect(() => { onAdShown?.(onAd); }, [onAd, onAdShown]);
  useEffect(() => {
    if (!onAd) { setLeft(0); return; }
    setLeft(AD_SKIP_AFTER);
    const t = setInterval(() => setLeft((s) => (s <= 1 ? (clearInterval(t), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [onAd, at]);
  const held = onAd && left > 0;
  const go = (i: number) => {
    const f = feed.current;
    if (!f) return;
    f.scrollTo({ top: Math.max(0, Math.min(entries.length - 1, i)) * f.clientHeight, behavior: "smooth" });
  };
  // PC: the wheel and arrow keys page through it as well (native scroll does the wheel)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (held) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); go(at + 1); }
      if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); go(at - 1); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div ref={feed} data-foryou className="sr-noscroll absolute inset-0 overflow-x-hidden"
      onScroll={() => { const f = feed.current; if (f) setAt(Math.round(f.scrollTop / Math.max(1, f.clientHeight))); }}
      style={{ overflowY: held ? "hidden" : "auto", scrollSnapType: "y mandatory", overscrollBehavior: "contain" }}>
      {entries.map((e, i) => (
        <section key={e.ad ? e.id : `${e.item.cat}-${e.item.key}`} className="relative h-full w-full" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
          data-foryou-page={i}>
          {Math.abs(i - at) <= 1 ? (e.ad
            ? (ad && <AdPage ad={ad} on={i === at} left={i === at ? left : AD_SKIP_AFTER} onSkip={() => go(i + 1)} />)
            : <ItemPost item={e.item} v={viewOf(e.item.cat, e.item.key)} own={ownLabel(e.item.cat, e.item.key)} lock={needStars(e.item.key)}
                onDetails={() => onDetails(e.item.cat, e.item.key)} onSeeAll={() => onSeeAll(e.item.cat, e.item.key)} />) : null}
        </section>
      ))}
    </div>
  );
}

function RoundButton({ icon, label, onClick, disabled, gold, on, data }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; gold?: boolean; on?: boolean; data?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} data-foryou-btn={data} aria-pressed={on} className="kib-press flex w-[52px] flex-col items-center gap-[3px] disabled:opacity-45">
      <span className="grid h-[40px] w-[40px] place-items-center rounded-full text-[17px] font-black"
        style={gold ? { background: "linear-gradient(180deg,#fde68a,#f59e0b 55%,#d97706)", color: "#1c1203", boxShadow: "0 4px 14px -4px rgba(245,158,11,.9)" }
          : { background: "rgba(0,0,0,.35)", color: on ? "#fb7185" : "#fff", backdropFilter: "blur(6px)" }}>{icon}</span>
      <span className="max-w-full truncate text-[10px] font-bold text-white/90" style={{ textShadow: "0 1px 4px rgba(0,0,0,.9)" }}>{label}</span>
    </button>
  );
}

/** A short line under the name, like a video's description: never the exact price. */
const FLAVOUR: Record<CatId, string[]> = {
  cans: ["One can, one big week.", "For the days the legs say no.", "Crack it open before kick-off."],
  boots: ["Laced up and ready.", "Feel every touch.", "New boots, new season."],
  drip: ["Walk in like you own the place.", "The tunnel is a catwalk.", "Dressed for the cameras."],
  gadgets: ["Plugged in between matches.", "Your downtime, upgraded.", "Everyone in the dressing room wants one."],
  cars: ["Turn heads at the training ground.", "The car park will notice.", "Arrive in style."],
  homes: ["Somewhere to call home.", "Room for the trophies.", "The neighbours will talk."],
  holiday: ["Summer break, sorted.", "Switch off between seasons.", "Somewhere far from the press."],
};
const pick = (list: string[], key: string) => list[key.split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % list.length];

function ItemPost({ item, v, own, lock, onDetails, onSeeAll }: {
  item: FeedItem; v: View; own: string | null; lock: { need: number; have: number } | null; onDetails: () => void; onSeeAll: () => void;
}) {
  const locked = v.locked !== null;
  const [liked, setLiked] = useState(false);
  const line = locked ? (lock ? `Opens at ${lock.need}★. You're on ${lock.have}★ — keep playing.` : "Opens at a higher star rating.") : pick(FLAVOUR[item.cat], item.key);
  const tags = [`#${item.label.toLowerCase()}`, ...(v.levels > 1 ? [`#level${v.level}`] : []), "#knowitball"];
  return (
    <div className="absolute inset-0" data-foryou-item={item.key} data-locked={locked ? "1" : "0"}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background: `radial-gradient(60% 36% at 50% 40%, rgba(255,255,255,.15), transparent 70%), radial-gradient(90% 55% at 50% 44%, ${item.accent}33, transparent 72%)`,
      }} />
      <button onClick={locked ? undefined : onDetails} aria-label={`${v.title}: details`}
        className="absolute inset-x-0 flex items-center justify-center" style={{ top: "calc(48px + env(safe-area-inset-top))", bottom: "calc(110px + var(--sr-bot))" }}>
        <span className="relative flex h-full w-full items-center justify-center px-2" style={{ animation: "srFloat 5s ease-in-out infinite", transform: "scale(1.08)" }}>{v.pic}</span>
        {locked && (
          <span className="absolute inset-0 grid place-items-center" data-foryou-lock>
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-black/55 text-[36px] ring-2 ring-amber-300/60">🔒</span>
          </span>
        )}
      </button>

      {/* the caption, bottom-left, like a video's: a small name line, a description, tags */}
      <div className="absolute left-0 right-[64px] px-3.5" style={{ bottom: "calc(12px + var(--sr-bot))", textShadow: "0 1px 6px rgba(0,0,0,.85)" }}>
        <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-white/75" data-foryou-title>
          <span className="truncate">{v.title}</span>
          {own && <span className="shrink-0 rounded-[4px] bg-emerald-700/80 px-1.5 py-[1px] text-[10px] font-black uppercase text-emerald-100">{own}</span>}
        </div>
        <div className="mt-1 text-[14.5px] font-semibold leading-snug text-white" data-foryou-line>{line}</div>
        <div className="mt-0.5 truncate text-[13px] font-bold text-white/85">{tags.join(" ")}</div>
      </div>

      {/* the small round buttons, bottom-right */}
      <div className="absolute right-1.5 flex flex-col items-center gap-3" style={{ bottom: "calc(14px + var(--sr-bot))" }}>
        <RoundButton onClick={() => setLiked((x) => !x)} on={liked} data="like" icon={<span className="leading-none">{liked ? "♥" : "♡"}</span>} label="Like" />
        <RoundButton onClick={locked ? undefined : onDetails} disabled={locked} data="details" icon={<span className="leading-none">ⓘ</span>} label="Info" />
        <RoundButton onClick={onSeeAll} data="see-all" icon={<span className="text-[15px] leading-none">▦</span>} label="See all" />
        {!locked && (
          <RoundButton gold={!v.button.disabled} disabled={v.button.disabled} onClick={v.button.run} data="buy"
            icon={<span className="text-[14px] leading-none">{v.button.label === "Upgrade" ? "▲" : "★"}</span>}
            label={v.button.disabled ? (v.button.price !== undefined ? "Save up" : "Owned") : v.button.label} />
        )}
      </div>
    </div>
  );
}

function AdPage({ ad, on, left, onSkip }: { ad: HighlightAd; on: boolean; left: number; onSkip: () => void }) {
  // Edge to edge, like a TikTok video (Harry, 12 Oct 2026): no top bar, no buttons on the video,
  // only the bottom bar, a tiny line at the top, Skip, and the thin progress line. Swipe up to move on.
  return (
    <div className="absolute inset-0 bg-black" data-foryou-ad>
      <div className="absolute inset-x-0 top-0" style={{ bottom: "var(--sr-bot)" }}>
        {on && (
          <GoalVideo clipIds={ad.clipIds} style="tiktok" title={ad.title} autoStart priority={2} fill
            fallback={<div className="grid h-full place-items-center text-[13px] font-bold text-white/70">Highlights</div>} />
        )}
      </div>
      {/* tiny, at the top: the video carries its own caption along the bottom */}
      <div className="pointer-events-none absolute left-3 right-[96px] truncate text-[12px] font-bold text-white/85" style={{ top: "calc(12px + env(safe-area-inset-top))", textShadow: "0 1px 6px rgba(0,0,0,.9)" }} data-ad-caption>
        Sponsored · {ad.title}
      </div>
      {left > 0 ? (
        <span className="pointer-events-none absolute right-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white/85" style={{ top: "calc(8px + env(safe-area-inset-top))" }} data-ad-skip>Skip in {left}</span>
      ) : (
        <button onClick={onSkip} data-ad-skip className="kib-press absolute right-3 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-bold text-white" style={{ top: "calc(6px + env(safe-area-inset-top))" }}>Skip ›</button>
      )}
    </div>
  );
}
