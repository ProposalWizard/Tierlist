"use client";
/**
 * components/teamRoom/bits.tsx — the smallest Team room pieces, shared by
 * the chat, the notes, the point layer and the patch-note receipts: a face,
 * linked text with @names lit up, and page names for page cards.
 */
import { Fragment } from "react";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import type { TeamPerson } from "@/lib/teamRoom/config";
import { pageLabel } from "@/lib/teamRoom/logic";

export const PAGE_NAMES: Record<string, string> = Object.fromEntries([
  ...ADMIN_PAGES.map((p) => [p.url.split("?")[0], p.name]),
  ["/admin/team", "Team board"], ["/admin/star", "Admin home"], ["/admin/videos", "Videos"], ["/admin/patch-notes", "Patch notes"],
]);

/** The page's name as the admin menu calls it ("Scenario gallery"), else a tidy guess. */
export const nameOfPage = (path: string) => pageLabel(path, PAGE_NAMES) ?? path;

/** This site's own addresses: a full link to one of them is a page card. */
export function siteOrigins(): string[] {
  const own = typeof window === "undefined" ? [] : [window.location.origin];
  return [...own, "https://knowitball.co.uk", "https://www.knowitball.co.uk"];
}

export function Av({ p, sm, xs, off, title }: { p: TeamPerson; sm?: boolean; xs?: boolean; off?: boolean; title?: string }) {
  return <span className={`tr-av ${p}${sm ? " sm" : ""}${xs ? " xs" : ""}${off ? " off" : ""}`} title={title ?? p}>{p[0]}</span>;
}

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
const AT = /(@(?:Harry|Mikey|Leo)\b)/gi;

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
