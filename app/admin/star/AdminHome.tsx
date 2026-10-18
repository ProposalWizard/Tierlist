"use client";
/**
 * The admin home (/admin/star) — Harry's grouped admin, in the Ops room look
 * (Higgsfield design B, 18 Oct 2026) or Clean light. Every page comes from
 * lib/adminRegistry.ts. Harry, 18 Oct: "this is too much for an admin page -
 * focus on simplicity", then "keep pictures just simpler than these": one
 * flat Higgsfield icon per group (public/admin/icons), no picture banners.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/shell/AdminShell";
import { GROUPS, visibleTo, type AdminOwner, type AdminPage } from "@/lib/adminRegistry";
import type { TeamBoardData } from "@/lib/teamBoard";
import "./adminHome.css";

const WRITES: Record<AdminPage["writes"], { text: string; tone: string } | null> = {
  none: null,
  browser: { text: "This browser", tone: "grey" },
  own: { text: "Your account", tone: "grey" },
  shared: { text: "Saves real data", tone: "amber" },
  repo: { text: "Writes the code", tone: "red" },
};
const WRITE_HELP: Record<AdminPage["writes"], string> = {
  none: "Saves nothing",
  browser: "Saves in this browser only",
  own: "Saves to your own account only",
  shared: "Its buttons change what other players see",
  repo: "Its buttons can write into the game's code",
};
const OWNER_LETTER: Record<AdminOwner, string> = { Harry: "H", Mikey: "M", Leo: "L", Shared: "★" };

export default function AdminHome({ role }: { role: "admin" | "tester" }) {
  const all = useMemo(() => visibleTo(role).filter((p) => p.url !== "/admin/star"), [role]);
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<AdminOwner | null>(null);
  const [realOnly, setRealOnly] = useState(false);

  const match = (p: AdminPage) => {
    if (owner && p.owner !== owner) return false;
    if (realOnly && p.writes !== "shared" && p.writes !== "repo") return false;
    const s = q.trim().toLowerCase();
    return !s || `${p.name} ${p.purpose} ${p.url}`.toLowerCase().includes(s);
  };
  const shown = all.filter(match);
  const count = (o: AdminOwner) => all.filter((p) => p.owner === o).length;
  const filtering = !!(q.trim() || owner || realOnly);

  return (
    <AdminShell tab="home" role={role}>
      <div className="ah">
        <div className="ah-bar">
          <label className="ash-search ah-search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input id="ah-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${all.length} pages`} aria-label="Search pages" />
          </label>
          <div className="ah-chips" role="group" aria-label="Filter">
            <button className="ash-chip" aria-pressed={!owner} onClick={() => setOwner(null)}>All</button>
            {(["Harry", "Mikey", "Leo"] as AdminOwner[]).map((o) => (
              <button key={o} className="ash-chip" aria-pressed={owner === o} onClick={() => setOwner(owner === o ? null : o)}>{o} <span className="ah-n">{count(o)}</span></button>
            ))}
            <button className="ash-chip" aria-pressed={realOnly} onClick={() => setRealOnly(!realOnly)}>Saves real data</button>
          </div>
          {role === "admin" && <TeamWidget />}
        </div>

        {!filtering && (
          <Link href="/star-dev" className="ash-panel ah-play">
            <img src="/admin/icons/play.webp" alt="Play the game" title="Play the game" className="ah-ic ah-ic-lg" />
            <span><b>Play the game</b><small>Road to Ballon d&apos;Or, as players see it</small></span>
          </Link>
        )}

        {shown.length === 0 && (
          <div className="ash-panel ah-empty">
            <b>No pages match</b>
            <button className="ash-btn ghost" onClick={() => { setQ(""); setOwner(null); setRealOnly(false); }}>Clear</button>
          </div>
        )}

        {GROUPS.map((g) => {
          const pages = shown.filter((p) => p.group === g.key && p.url !== "/star-dev");
          if (!pages.length) return null;
          const body = (
            <div className="ah-grid">{pages.map((p) => <Card key={p.url} p={p} />)}</div>
          );
          if (g.key === "old") {
            return (
              <details key={g.key} id={g.key} className="ah-group ah-old" open={filtering}>
                <summary><span className="ash-h2" style={{ margin: 0 }}>Old tests ({pages.length})</span></summary>
                {body}
              </details>
            );
          }
          return (
            <section key={g.key} id={g.key} className="ah-group">
              <div className="ah-ghead"><img src={`/admin/icons/${g.key}.webp`} alt={g.name} title={g.name} className="ah-ic" /><h2>{g.name}</h2><span>{pages.length}</span></div>
              {body}
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}

function Card({ p }: { p: AdminPage }) {
  const w = WRITES[p.writes];
  return (
    <Link href={p.url} className="ash-panel ah-card" title={`${p.name}: ${p.purpose}`}>
      <div className="ah-card-top">
        <b>{p.name}</b>
      </div>
      <p>{p.purpose}</p>
      <div className="ah-card-foot">
        <span className={`ash-av ${p.owner}`} title={`Owner: ${p.owner}`}>{OWNER_LETTER[p.owner]}</span>
        <span className="ah-owner">{p.owner === "Shared" ? "Shared" : p.owner}</span>
        {w && <span className={`ash-tag ${w.tone}`} title={WRITE_HELP[p.writes]}>{w.text}</span>}
        {p.access === "admin" && <span className="ash-tag grey" title="Only admins can open this page">Admins</span>}
      </div>
    </Link>
  );
}

/** Top-right: the three of you, green if they pushed in the last 30 minutes. Opens the team board. */
function TeamWidget() {
  const [d, setD] = useState<TeamBoardData | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/team").then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setD(j); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const now = Date.now();
  return (
    <Link href="/admin/team" className="ash-panel ah-team" aria-label="Open the team board">
      <span className="ah-team-t"><b>The team</b><small>{d ? (d.deploy.state === "success" ? "Site live" : d.deploy.state === "pending" ? "Deploying" : "Team board") : "Team board"}</small></span>
      {(["Harry", "Mikey", "Leo"] as const).map((p) => {
        const last = d?.people.find((x) => x.person === p)?.pushes[0]?.at;
        const live = last && now - Date.parse(last) < 30 * 60_000;
        return (
          <span key={p} className="ah-team-p">
            <span className={`ash-av ${p}`}>{p[0]}</span>
            <span className={`ash-dot ${live ? "live" : ""}`} />
          </span>
        );
      })}
    </Link>
  );
}
