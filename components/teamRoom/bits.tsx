"use client";
/**
 * components/teamRoom/bits.tsx — the smallest Team room pieces, shared by
 * the chat, the notes, the point layer and the patch-note receipts: a face,
 * linked text with @names lit up, and page names for page cards.
 */
import { Fragment, useId } from "react";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import type { TeamPerson } from "@/lib/teamRoom/config";
import { pageLabel } from "@/lib/teamRoom/logic";

export const PAGE_NAMES: Record<string, string> = Object.fromEntries([
  ...ADMIN_PAGES.map((p) => [p.url.split("?")[0], p.name]),
  ["/admin/team", "Team board"], ["/admin/star", "Golden Ball home"], ["/admin/videos", "Videos"], ["/admin/patch-notes", "Patch notes"],
]);

/** The page's name as the admin menu calls it ("Scenario gallery"), else a tidy guess. */
export const nameOfPage = (path: string) => pageLabel(path, PAGE_NAMES) ?? path;

/** This site's own addresses: a full link to one of them is a page card. */
export function siteOrigins(): string[] {
  const own = typeof window === "undefined" ? [] : [window.location.origin];
  return [...own, "https://knowitball.co.uk", "https://www.knowitball.co.uk"];
}

/** Each person's crest: a small club badge in their colour (Harry, 12 Nov 2026: "one of those ESPN-like profile pictures … something football related for each of us"). */
const CREST: Record<TeamPerson, { a: string; b: string }> = { Harry: { a: "#34e08b", b: "#0c3d22" }, Mikey: { a: "#6fb8ff", b: "#0e2f52" }, Leo: { a: "#b18cff", b: "#2c1a57" } };
const SHIELD = "M20 2 36 7v13c0 9-6.5 15-16 18C10.5 35 4 29 4 20V7z";

export function Crest({ p }: { p: TeamPerson }) {
  const id = useId();
  const c = CREST[p];
  return (
    <svg viewBox="0 0 40 40" aria-hidden focusable="false">
      <path d={SHIELD} fill={c.a} />
      <clipPath id={id}><path d={SHIELD} /></clipPath>
      <g clipPath={`url(#${id})`}>
        {p === "Harry" && (<><path d="M20 2 36 7v13c0 9-6.5 15-16 18z" fill={c.b} opacity=".28" /><circle cx="20" cy="19" r="8" fill="#fff" /><path d="m20 14.5 4 2.9-1.5 4.7h-5L16 17.4z" fill={c.b} /></>)}
        {p === "Mikey" && (<><path d="M12 4.5h5v31h-5zM23 4.5h5v31h-5z" fill={c.b} opacity=".3" /><path d="m20 9 2.9 6 6.6.9-4.8 4.6 1.2 6.5L20 23.9 14.1 27l1.2-6.5-4.8-4.6 6.6-.9z" fill="#fff" /></>)}
        {p === "Leo" && (<><path d="M4 16 20 26 36 16v6L20 32 4 22z" fill={c.b} opacity=".35" /><path d="M4 7 20 17 36 7v6L20 23 4 13z" fill="#fff" /></>)}
      </g>
      <path d={SHIELD} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" />
    </svg>
  );
}

export function Av({ p, sm, xs, off, title, card }: { p: TeamPerson; sm?: boolean; xs?: boolean; off?: boolean; title?: string; card?: boolean }) {
  // `card`: in the Team room, hovering (or tapping) this face opens the person's little profile.
  return <span className={`tr-av crest ${p}${sm ? " sm" : ""}${xs ? " xs" : ""}${off ? " off" : ""}`} title={card ? undefined : title ?? p} data-person={card ? p : undefined} role="img" aria-label={p}><Crest p={p} /></span>;
}

/** A bot's round badge: its own colour and a drawn sign. */
const BOT_BADGE: Record<string, { a: string; b: string }> = {
  "patch-notes": { a: "#f5b942", b: "#3d2a05" }, bug: { a: "#ff8f6b", b: "#4a1d0e" }, health: { a: "#7de3d0", b: "#0d3b34" },
  jobs: { a: "#9db4ff", b: "#16225a" }, today: { a: "#ffd166", b: "#4a3300" },
};
export function BotFace({ bot, className = "tr-botav" }: { bot: string; className?: string }) {
  const c = BOT_BADGE[bot] ?? { a: "#b5bac1", b: "#2b2d31" };
  return (
    <span className={`${className} crest`} aria-hidden>
      <svg viewBox="0 0 40 40" focusable="false">
        <circle cx="20" cy="20" r="18" fill={c.b} /><circle cx="20" cy="20" r="18" fill="none" stroke={c.a} strokeWidth="2.5" />
        {bot === "patch-notes" && (<><path d="M11 17v6h4l8 5V12l-8 5z" fill="#fff" /><path d="M26 16c2 1.5 2 6.5 0 8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></>)}
        {bot === "bug" && (<><ellipse cx="20" cy="22" rx="6" ry="8" fill="#fff" /><circle cx="20" cy="12.5" r="3.5" fill="#fff" /><path d="M10 18l4 2M30 18l-4 2M10 27l4-2M30 27l-4-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></>)}
        {bot === "health" && <path d="M10 21h5l2.5-6 4 11 2.5-5h6" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {bot === "jobs" && <path d="m12 20 5.5 5.5L28 14.5" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {bot === "today" && (<><circle cx="20" cy="20" r="5.5" fill="#fff" /><path d="M20 9v3M20 28v3M9 20h3M28 20h3M12.2 12.2l2.1 2.1M25.700 25.700l2.1 2.1M12.2 27.800l2.1-2.1M25.700 14.300l2.1-2.1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></>)}
        {!BOT_BADGE[bot] && <rect x="12" y="14" width="16" height="13" rx="3" fill="#fff" />}
      </svg>
    </span>
  );
}

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
const AT = /(@(?:Harry|Mikey|Leo|everyone|all|team)\b)/gi;

/** Text with web links clickable and @Harry / @Mikey / @Leo lit up (yours brighter). */
export function Linked({ text, me }: { text: string; me?: TeamPerson | null }) {
  const parts = text.split(LINK);
  return (
    <>
      {parts.map((x, i) => (i % 2
        ? <a key={i} href={x} target="_blank" rel="noreferrer">{x}</a>
        : <Fragment key={i}>{x.split(AT).map((y, j) => (j % 2
          ? <span key={j} className={`tr-at${me && y.slice(1).toLowerCase() === me.toLowerCase() ? " me" : ""}`}>{y}</span>
          : y))}</Fragment>))}
    </>
  );
}
