"use client";
/**
 * The admin home (/admin/star, and each game's home). ONE layout in every Look
 * (Harry, 20 Oct 2026: "everything to look the same, but with a different
 * kind of skin"): the game's groups as tiles (grid or list), each opening its
 * own page; a search lists the matching pages. The Look only repaints it (the
 * --sk-* skin tokens in adminHome.css). Every page comes from
 * lib/adminRegistry.ts; one flat Higgsfield icon per group (public/admin/icons).
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/shell/AdminShell";
import { GAMES, gameOf, groupIcon, groupsOf, visibleTo, type AdminGameKey, type AdminOwner, type AdminPage } from "@/lib/adminRegistry";
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

export default function AdminHome({ role, game = GAMES[0].key }: { role: "admin" | "tester"; game?: AdminGameKey }) {
  const G = gameOf(game) ?? GAMES[0];
  // Only this game's groups and pages: a game's tab never shows another game's (Harry, 19 Oct 2026).
  const all = useMemo(() => {
    const keys = new Set<string>(groupsOf(game).map((g) => g.key));
    return visibleTo(role).filter((p) => p.url !== "/admin/star" && keys.has(p.group));
  }, [role, game]);
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
    <AdminShell tab="home" role={role} game={game}>
      <div className="ah">
        <div className="ah-bar">
          <label className="ash-search ah-search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input id="ah-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${all.length} pages in ${G.name}`} aria-label="Search pages" />
          </label>
          <div className="ah-chips" role="group" aria-label="Filter">
            <button className="ash-chip" aria-pressed={!owner} onClick={() => setOwner(null)}>All</button>
            {(["Harry", "Mikey", "Leo"] as AdminOwner[]).map((o) => (
              <button key={o} className="ash-chip" aria-pressed={owner === o} onClick={() => setOwner(owner === o ? null : o)}>{o} <span className="ah-n">{count(o)}</span></button>
            ))}
            <button className="ash-chip" aria-pressed={realOnly} onClick={() => setRealOnly(!realOnly)}><span className="ah-full">Saves real data</span><span className="ah-short">Real data</span></button>
          </div>
          {role === "admin" && <TeamWidget />}
        </div>

        {/* One layout in every look (Harry, 20 Oct 2026: "They can't just click
            Clean light and suddenly I'm on a different admin page with a
            different layout"): the home is the groups, each opens its own
            page. A search or filter lists the matching pages instead. */}
        {!filtering && <GroupHome pages={all} game={game} />}
        {filtering && shown.length > 0 && <Board shown={shown} filtering={filtering} game={game} />}

        {shown.length === 0 && (
          <div className="ash-panel ah-empty">
            <b>No pages match</b>
            <button className="ash-btn ghost" onClick={() => { setQ(""); setOwner(null); setRealOnly(false); }}>Clear</button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

/** Search results: every matching page as one short row, under its group
 * (Harry, 19 Oct 2026: "even the groups on the side, it's a bit hard to see
 * everything"). Hovering a row says what the page is for. */
export const TAGLINE: Record<string, string> = {
  career: "Your journey, your story.", chances: "Moments that change everything.", match: "Play, analyse, improve.",
  data: "Real teams. Real numbers.", places3d: "Explore. Shop. Work.", players: "Bring the team to life.",
  money: "Play. Earn. Upgrade.", sound: "Hear the difference.", site: "Keep it fresh.",
  draft: "The draft game.", tierlists: "Rank what matters.", old: "Kept for reference.",
  studio: "The team, the notes, the testers.", research: "What we found out, and what to do.",
  marketing: "Our videos, from idea to posted.",
};
function Board({ shown, filtering, game }: { shown: AdminPage[]; filtering: boolean; game: AdminGameKey }) {
  const groups = groupsOf(game).map((g) => ({ g, pages: shown.filter((p) => p.group === g.key) }))
    .filter((x) => x.pages.length)
    // "Play the game" leads Career screens, as in both pictures.
    .map((x) => ({ ...x, pages: [...x.pages].sort((a, b) => Number(b.url === "/star-dev") - Number(a.url === "/star-dev")) }));
  return (
    <div className="ahb">
      {groups.map(({ g, pages }) => {
        const rows = <ul className="ahb-rows">{pages.map((p) => <Row key={p.url} p={p} />)}</ul>;
        const head = (
          <div className="ahb-head">
            <img src={groupIcon(g.key)} alt="" className="ahb-ic" />
            <span className="ahb-t"><b>{g.name}</b><small>{TAGLINE[g.key]}</small></span>
            <span className="ahb-n" title={`${pages.length} pages`}>{pages.length}</span>
          </div>
        );
        if (g.key === "old") {
          return (
            <details key={g.key} id={g.key} className="ahb-g ahb-old" data-g={g.key} open={filtering}>
              <summary>{head}</summary>
              {rows}
            </details>
          );
        }
        return <section key={g.key} id={g.key} className="ahb-g" data-g={g.key}>{head}{rows}</section>;
      })}
    </div>
  );
}

/** The groups, as big picture tiles or wide banner rows (Harry: "option 1 and 2
 *  for admin home as a grid/list toggle"). Remembered per browser. */
const VIEW_KEY = "kib-admin-home-view";
function GroupHome({ pages, game }: { pages: AdminPage[]; game: AdminGameKey }) {
  const G = gameOf(game) ?? GAMES[0];
  const GROUPS = groupsOf(game);
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => { try { if (localStorage.getItem(VIEW_KEY) === "list") setView("list"); } catch { /* private */ } }, []);
  const pick = (v: "grid" | "list") => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private */ } };
  const groups = GROUPS.map((g) => ({ g, n: pages.filter((p) => p.group === g.key).length })).filter((x) => x.n > 0);
  return (
    <div className="agh" data-view={view}>
      <div className="agh-bar">
        <h1 className="agh-title">{G.name}</h1>
        <div className="agh-toggle" role="group" aria-label="Show groups as">
          <button aria-pressed={view === "grid"} onClick={() => pick("grid")} title="Big tiles">Grid</button>
          <button aria-pressed={view === "list"} onClick={() => pick("list")} title="One row per group">List</button>
        </div>
      </div>
      <div className="agh-groups">
        {groups.map(({ g, n }) => (
          <Link key={g.key} href={`/admin/star/g/${g.key}`} className="agh-g" data-g={g.key} title={`${g.name}: ${TAGLINE[g.key] ?? ""}`}>
            <img src={groupIcon(g.key)} alt="" className="agh-art" />
            <span className="agh-name">{g.name}</span>
            <span className="agh-line">{TAGLINE[g.key]}</span>
            <span className="agh-n">{n} page{n === 1 ? "" : "s"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Row({ p }: { p: AdminPage }) {
  const w = WRITES[p.writes];
  return (
    <li>
      <Link href={p.url} className="ahb-row" title={`${p.name}: ${p.purpose}${w ? ` · ${WRITE_HELP[p.writes]}` : ""}`}>
        <svg className="ahb-doc" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
        <span className="ahb-name">{p.name}</span>
        {w && w.tone !== "grey" && <span className={`ahb-w ${w.tone}`} title={WRITE_HELP[p.writes]} aria-label={WRITE_HELP[p.writes]} />}
        <span className={`ahb-o ${p.owner}`} title={`Owner: ${p.owner}`}>{OWNER_LETTER[p.owner]}</span>
        <svg className="ahb-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
      </Link>
    </li>
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
