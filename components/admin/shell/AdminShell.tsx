"use client";
/**
 * The admin pages' frame: a side menu (Home, Team board, Patch notes, the
 * groups) and the Ops room | Clean light switch. Used by /admin/star and
 * /admin/team. On a phone the menu hides behind "☰ Menu".
 */
import "./adminShell.css";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ADMIN_PAGES, GROUPS, visibleTo } from "@/lib/adminRegistry";
import { setAdminLook, setAdminMode, useAdminLook, useAdminMode } from "@/lib/adminLook";

export type ShellTab = "home" | "team" | "notes" | "videos";

const I = {
  home: <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  team: <><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5M14.5 15.2c2.8-.4 5.3.9 6 4.8" /></>,
  notes: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
  back: <path d="M15 5 8 12l7 7" />,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};
export function Icon({ name, size = 17 }: { name: keyof typeof I; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {I[name]}
    </svg>
  );
}

export default function AdminShell({ tab, role, children, onTab }: {
  tab: ShellTab;
  role: "admin" | "tester";
  children: ReactNode;
  /** On the team board, Team and Patch notes switch in place. */
  onTab?: (t: "team" | "notes") => void;
}) {
  const look = useAdminLook();
  const mode = useAdminMode();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [tab]);

  const pages = visibleTo(role);
  const count = (g: string) => pages.filter((p) => p.group === g && p.url !== "/star-dev" && p.url !== "/admin/star").length;

  const navTab = (t: "team" | "notes", label: string, icon: keyof typeof I) => {
    const href = t === "team" ? "/admin/team" : "/admin/team?tab=notes";
    const cur = tab === t ? "page" : undefined;
    return onTab ? (
      <button className="ash-nav" aria-current={cur} onClick={() => { onTab(t); setOpen(false); }}>
        <span className="ash-navl"><Icon name={icon} />{label}</span>
      </button>
    ) : (
      <Link className="ash-nav" aria-current={cur} href={href}><span className="ash-navl"><Icon name={icon} />{label}</span></Link>
    );
  };

  return (
    <div className="ash" data-look={look} data-admin-shell>
      <div className="ash-top">
        <button className="ash-btn ghost" onClick={() => setOpen(true)} aria-label="Open the admin menu"><Icon name="menu" /> Menu</button>
        <b style={{ fontWeight: 900, letterSpacing: ".06em" }}>KNOWITBALL</b>
        <span style={{ width: 70 }} />
      </div>
      <div className="ash-layout">
        {open && <div className="ash-scrim" onClick={() => setOpen(false)} />}
        <aside className="ash-side" data-open={open} aria-label="Admin menu">
          <div className="ash-brand">
            <span className="ash-mark">K</span>
            <span><b>KNOWITBALL</b><small>{role === "admin" ? "Admin" : "Test pages"}</small></span>
          </div>
          <Link className="ash-nav" aria-current={tab === "home" ? "page" : undefined} href="/admin/star">
            <span className="ash-navl"><Icon name="home" />Home</span><span className="n">{pages.length}</span>
          </Link>
          {role === "admin" && navTab("team", "Team board", "team")}
          {role === "admin" && navTab("notes", "Patch notes", "notes")}
          <Link className="ash-nav" aria-current={tab === "videos" ? "page" : undefined} href="/admin/videos">
            <span className="ash-navl"><Icon name="video" />Videos</span>
          </Link>

          <div className="ash-navh">Groups</div>
          {GROUPS.filter((g) => count(g.key)).map((g) => (
            <Link key={g.key} className="ash-nav" href={`/admin/star#${g.key}`}>
              <span className="ash-navl">{g.name}</span><span className="n">{count(g.key)}</span>
            </Link>
          ))}

          <div style={{ flex: 1 }} />
          <div className="ash-navh">Look</div>
          <div className="ash-switch" role="group" aria-label="Admin look">
            <button aria-pressed={look === "ops"} onClick={() => setAdminLook("ops")}>Ops room</button>
            <button aria-pressed={look === "light"} onClick={() => setAdminLook("light")}>Clean light</button>
          </div>
          <div className="ash-toggle">
            <span>Admin mode<br /><small style={{ fontWeight: 500, color: "var(--ash-ink3)" }}>Admin menu on every page</small></span>
            <button className="ash-pill-sw" role="switch" aria-checked={mode} aria-label="Admin mode" onClick={() => setAdminMode(!mode)} />
          </div>
          <Link className="ash-nav" href="/"><span className="ash-navl"><Icon name="back" />Back to Knowitball</span></Link>
          <p style={{ margin: "6px 10px 0", fontSize: 10.5, color: "var(--ash-ink3)" }}>{ADMIN_PAGES.length} pages in the list</p>
        </aside>
        <main className="ash-main">{children}</main>
      </div>
    </div>
  );
}
