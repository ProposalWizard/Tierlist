"use client";
/**
 * The admin pages' frame: one tab per GAME across the top (Harry, 19 Oct
 * 2026: "stuff on the wider website should be on a completely different tab
 * than road to ballon dor stuff"), a side menu (the game's home and its
 * groups, then the Team room, Patch notes, Videos) and the Look switch
 * (Broadcast, Bento, Ops room, Clean light). Games and groups come from
 * lib/adminRegistry.ts (GAMES, GROUPS). Used by /admin/star (and its game
 * and group pages), /admin/team and /admin/videos. On a phone the menu hides
 * behind "☰ Menu"; on a computer « folds it to a thin strip of icons
 * (Harry, 19 Oct 2026: "we need to be able to close the side tab").
 */
import "./adminShell.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ADMIN_PAGES, GAMES, gameForPath, gameOf, groupGame, groupIcon, groupsOf, visibleTo, type AdminGameKey, type AdminGroup } from "@/lib/adminRegistry";
import { ADMIN_LOOKS, isBoardLook, setAdminLook, setAdminMode, useAdminLook, useAdminMode } from "@/lib/adminLook";

export type ShellTab = "home" | "team" | "notes" | "videos" | "ideas" | "chat" | "todo";
export type RoomTab = "team" | "ideas" | "chat" | "todo" | "notes";
const FOLD_KEY = "kib-admin-side-folded";

const I = {
  home: <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  team: <><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5M14.5 15.2c2.8-.4 5.3.9 6 4.8" /></>,
  notes: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
  back: <path d="M15 5 8 12l7 7" />,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  ideas: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>,
  chat: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" />,
  todo: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></>,
  fold: <path d="M11 6 5 12l6 6M19 6l-6 6 6 6" />,
  unfold: <path d="m13 6 6 6-6 6M5 6l6 6-6 6" />,
};
export function Icon({ name, size = 17 }: { name: keyof typeof I; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {I[name]}
    </svg>
  );
}

export default function AdminShell({ tab, role, children, onTab, badges, game: gameProp, group }: {
  tab: ShellTab;
  role: "admin" | "tester";
  /** Which game's tab is open. Default: worked out from the page's address. */
  game?: AdminGameKey;
  /** The group page being shown, lit in the side list. */
  group?: AdminGroup;
  children: ReactNode;
  /** On the team board, the Team room's parts and Patch notes switch in place. */
  onTab?: (t: RoomTab) => void;
  /** Little counts beside the Team room lines (new chat, new jobs…). */
  badges?: Partial<Record<RoomTab, number>>;
}) {
  const look = useAdminLook();
  const mode = useAdminMode();
  const [open, setOpen] = useState(false);
  const [folded, setFolded] = useState(false);
  useEffect(() => { setOpen(false); }, [tab]);
  useEffect(() => { try { setFolded(localStorage.getItem(FOLD_KEY) === "1"); } catch { /* private */ } }, []);
  const fold = (f: boolean) => { setFolded(f); try { localStorage.setItem(FOLD_KEY, f ? "1" : "0"); } catch { /* private */ } };

  const path = usePathname() ?? "/admin/star";
  const game = gameProp ?? (group ? groupGame(group) : gameForPath(path));
  const G = gameOf(game) ?? GAMES[0];
  const pages = visibleTo(role);
  const count = (g: string) => pages.filter((p) => p.group === g && p.url !== "/star-dev" && p.url !== "/admin/star").length;
  const gameCount = (k: AdminGameKey) => groupsOf(k).reduce((n, g) => n + count(g.key), 0);
  // Broadcast/Bento open a group's own page; Ops room / Clean light jump down the game's home.
  const groupHref = (k: AdminGroup) => (isBoardLook(look) ? `/admin/star/g/${k}` : `${G.home}#${k}`);

  const navTab = (t: RoomTab, label: string, icon: keyof typeof I) => {
    const href = t === "team" ? "/admin/team" : `/admin/team?tab=${t}`;
    const cur = tab === t ? "page" : undefined;
    const n = badges?.[t] ?? 0;
    const inner = <><span className="ash-navl"><Icon name={icon} /><span className="ash-navt">{label}</span></span>{n > 0 && <span className="ash-nbadge">{n > 99 ? "99+" : n}</span>}</>;
    return onTab ? (
      <button className="ash-nav" aria-current={cur} title={label} onClick={() => { onTab(t); setOpen(false); }}>{inner}</button>
    ) : (
      <Link className="ash-nav" aria-current={cur} title={label} href={href}>{inner}</Link>
    );
  };

  return (
    <div className="ash" data-look={look} data-folded={folded} data-admin-shell>
      <div className="ash-top">
        <button className="ash-btn ghost" onClick={() => setOpen(true)} aria-label="Open the admin menu"><Icon name="menu" /> Menu</button>
        <b className="ash-word">KNOWITBALL</b>
        <span style={{ width: 70 }} />
      </div>
      <div className="ash-layout">
        {open && <div className="ash-scrim" onClick={() => setOpen(false)} />}
        <aside className="ash-side" data-open={open} aria-label="Admin menu">
          <div className="ash-brand">
            <span className="ash-mark">K</span>
            <span className="ash-navt"><b>KNOWITBALL</b><small>{role === "admin" ? "Admin" : "Test pages"}</small></span>
            <button className="ash-fold" onClick={() => fold(!folded)} aria-label={folded ? "Open the side menu" : "Fold the side menu away"} title={folded ? "Open the side menu" : "Fold the side menu away"}>
              <Icon name={folded ? "unfold" : "fold"} size={15} />
            </button>
          </div>
          <Link className="ash-nav" aria-current={tab === "home" && !group ? "page" : undefined} href={G.home} title={`${G.name}: home`}>
            <span className="ash-navl"><Icon name="home" /><span className="ash-navt">{G.short} home</span></span><span className="n ash-navt">{gameCount(game)}</span>
          </Link>

          {/* The game's groups, one slanted bar each (Harry, 19 Oct 2026: "on
              broadcast there should still be side tabs"). */}
          <div className="ash-navh">{G.name}</div>
          <div className="ash-glist">
            {groupsOf(game).filter((g) => count(g.key)).map((g) => (
              <Link key={g.key} className="ash-gnav" data-g={g.key} aria-current={group === g.key ? "page" : undefined}
                href={groupHref(g.key)} title={`${g.name}: ${count(g.key)} page${count(g.key) === 1 ? "" : "s"}`}>
                <img src={groupIcon(g.key)} alt="" className="ash-gic" />
                <span className="ash-navt ash-gname">{g.name}</span><span className="n ash-navt">{count(g.key)}</span>
              </Link>
            ))}
          </div>

          {role === "admin" && <div className="ash-navh">Team room</div>}
          {role === "admin" && navTab("team", "Team board", "team")}
          {role === "admin" && navTab("ideas", "Ideas", "ideas")}
          {role === "admin" && navTab("chat", "Team chat", "chat")}
          {role === "admin" && navTab("todo", "My to-do", "todo")}
          {role === "admin" && <div className="ash-navh">Other</div>}
          {role === "admin" && navTab("notes", "Patch notes", "notes")}
          <Link className="ash-nav" aria-current={tab === "videos" ? "page" : undefined} href="/admin/videos" title="Videos">
            <span className="ash-navl"><Icon name="video" /><span className="ash-navt">Videos</span></span>
          </Link>


          <div style={{ flex: 1 }} />
          <div className="ash-navh">Look</div>
          <div className="ash-switch" role="group" aria-label="Admin look">
            {ADMIN_LOOKS.map((l) => (
              <button key={l.id} aria-pressed={look === l.id} onClick={() => setAdminLook(l.id)}>{l.name}</button>
            ))}
          </div>
          <div className="ash-toggle">
            <span>Admin mode<br /><small style={{ fontWeight: 500, color: "var(--ash-ink3)" }}>Admin menu on every page</small></span>
            <button className="ash-pill-sw" role="switch" aria-checked={mode} aria-label="Admin mode" onClick={() => setAdminMode(!mode)} />
          </div>
          <Link className="ash-nav" href="/" title="Back to Knowitball"><span className="ash-navl"><Icon name="back" /><span className="ash-navt">Back to Knowitball</span></span></Link>
          <p style={{ margin: "6px 10px 0", fontSize: 10.5, color: "var(--ash-ink3)" }}>{ADMIN_PAGES.length} pages in the list</p>
        </aside>
        <main className="ash-main">
          {/* One tab per game; inside a tab you only see that game's pages. */}
          <nav className="ash-games" aria-label="Games">
            {GAMES.map((g) => (
              <Link key={g.key} href={g.home} className="ash-game" aria-current={g.key === game ? "page" : undefined} title={`${g.name}: ${gameCount(g.key)} pages`}>
                <span className="ash-game-full">{g.name}</span><span className="ash-game-short">{g.short}</span>
                <span className="ash-game-n">{gameCount(g.key)}</span>
              </Link>
            ))}
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
