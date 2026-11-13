"use client";
/**
 * The admin home's screen (app/admin/page.tsx). Harry, 12 Nov 2026: "this
 * thing here should be a home page … we have no kind of hub to go to".
 * Big tiles to each area, every tile drawn the same way (one line icon on a
 * coloured square: 19:04 "I don't like how some of them have images on the
 * front, some of them don't"), and one small panel of what changed.
 * Lives inside the admin shell (side menu, game tabs, Look), painted by the
 * --sk-* / --ash-* skin tokens like every other admin page.
 */
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import AdminShell from "@/components/admin/shell/AdminShell";
import { GAMES, TEAM_HOME, gamesFor, groupsOf, visibleTo, type AdminGameKey } from "@/lib/adminRegistry";
import type { TeamBoardData } from "@/lib/teamBoard";
import "./adminHub.css";

type Tile = { key: string; name: string; line: string; href: string; icon: ReactNode; tint: string; count?: number; links?: { label: string; href: string }[] };

const svg = (d: ReactNode) => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const ICONS: Record<string, ReactNode> = {
  team: svg(<><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5M14.5 15.2c2.8-.4 5.3.9 6 4.8" /></>),
  rbd: svg(<><circle cx="12" cy="10" r="6" /><path d="M9 15.5 8 21l4-2 4 2-1-5.5" /><path d="m12 7 1 2h2l-1.6 1.3.6 2-2-1.2-2 1.2.6-2L9 9h2z" /></>),
  web: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 8.5h18M7 6.2h.01M10 6.2h.01" /><path d="M8 13h3v4H8zM13 13h3M13 16h3" /></>),
  studio: svg(<><path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="m4 9 1.5-4.5 15 1.5L20 9" /><path d="m9 5 1.5 3.6M14 5.5l1.4 3.4" /></>),
  marketing: svg(<><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /></>),
  videos: svg(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /><circle cx="9.5" cy="12" r="2" /></>),
};
const TINT: Record<string, string> = { team: "#34e08b", rbd: "#f5c542", web: "#5aa0ff", studio: "#c58cff", marketing: "#ff7a59", videos: "#ff5a7a" };
const LINE: Record<AdminGameKey, string> = {
  rbd: "Every admin tool and test page for the game",
  web: "Draft, tierlists, Tic Tac Toe and the rest of the site",
  studio: "Team notes, research, testers, scene generator",
  marketing: "The production board, uploads and the editing suite",
};

export default function AdminHub({ role }: { role: "admin" | "tester" }) {
  const pages = visibleTo(role);
  const countOf = (k: AdminGameKey) => {
    const groups = new Set<string>(groupsOf(k).map((g) => g.key));
    return pages.filter((p) => groups.has(p.group) && p.url !== "/admin/star").length;
  };
  const tiles: Tile[] = [
    ...(role === "admin" ? [{
      key: "team", name: "Team", line: "The team room: channels, DMs, patch notes", href: `${TEAM_HOME}?tab=chat`, icon: ICONS.team, tint: TINT.team,
      links: [{ label: "Team board", href: TEAM_HOME }, { label: "Patch notes", href: `${TEAM_HOME}?tab=notes` }],
    }] : []),
    ...gamesFor(role).map((g) => ({ key: g.key, name: g.name, line: LINE[g.key], href: g.home, icon: ICONS[g.key], tint: TINT[g.key], count: countOf(g.key) })),
    { key: "videos", name: "Videos", line: "Record your screen and voice, straight to Drive", href: "/admin/videos", icon: ICONS.videos, tint: TINT.videos },
  ];

  return (
    <AdminShell tab="hub" role={role}>
      <div className="ahub">
        <div className="ahub-head">
          <h1 className="ash-h1">Admin</h1>
          <p className="ash-sub">Pick where to go. The back arrow on every admin page brings you back here.</p>
        </div>
        <div className="ahub-grid">
          {tiles.map((t) => (
            <div key={t.key} className="ahub-tile" data-k={t.key} style={{ ["--ahub-tint" as string]: t.tint }}>
              <Link href={t.href} className="ahub-main" title={`${t.name}: ${t.line}`}>
                <span className="ahub-ic">{t.icon}</span>
                <span className="ahub-name">{t.name}</span>
                <span className="ahub-line">{t.line}</span>
                {t.count != null && <span className="ahub-n">{t.count} page{t.count === 1 ? "" : "s"}</span>}
              </Link>
              {t.links && (
                <span className="ahub-subs">
                  {t.links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
                </span>
              )}
            </div>
          ))}
        </div>
        {role === "admin" && <WhatChanged />}
        <p className="ahub-foot">{GAMES.length} games · {pages.length} admin and test pages</p>
      </div>
    </AdminShell>
  );
}

/** Small: is the live site up to date, and the last few pushes. Full detail is on the Team board. */
function WhatChanged() {
  const [d, setD] = useState<TeamBoardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/admin/team", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) { setD(j); setFailed(false); setNow(Date.now()); } })
      .catch(() => { if (alive) setFailed(true); });
    load();
    // Once a minute, only while the tab is visible.
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const pushes = (d?.people ?? [])
    .flatMap((p) => p.pushes.filter((x) => !/^Merge\b/i.test(x.title)).slice(0, 3).map((x) => ({ ...x, who: p.person })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 4);
  const dep = d?.deploy;
  const site = !d ? (failed ? "Can't read the live site right now" : "Checking the live site…")
    : dep?.state === "success" ? `Live site up to date${dep.at ? ` · ${ago(dep.at, now)}` : ""}`
    : dep?.state === "pending" ? "Deploying a new version now"
    : dep?.state === "failure" ? `Last deploy failed${dep.at ? ` · ${ago(dep.at, now)}` : ""}`
    : "Can't see the live site's state";
  const tone = dep?.state === "success" ? "ok" : dep?.state === "failure" ? "bad" : dep?.state === "pending" ? "wait" : "none";

  return (
    <section className="ash-panel ahub-changed" aria-label="What changed">
      <div className="ahub-ch-top">
        <b>What changed</b>
        <span className="ahub-site" data-tone={tone}><i aria-hidden />{site}</span>
        <Link href={TEAM_HOME} className="ahub-more">Team board ›</Link>
      </div>
      {pushes.length > 0 && (
        <ul className="ahub-pushes">
          {pushes.map((p) => (
            <li key={p.sha}>
              <span className={`ash-av ${p.who}`} title={p.who}>{p.who[0]}</span>
              <span className="ahub-pt">{p.title}</span>
              <span className="ahub-when">{ago(p.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ago(at: string, now: number): string {
  const m = Math.max(0, Math.round((now - Date.parse(at)) / 60_000));
  if (!Number.isFinite(m)) return "";
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
