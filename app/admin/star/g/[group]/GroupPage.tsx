"use client";
/**
 * A group's own page: one picture card per admin page in the group (Harry's
 * pick, option 1, 19 Oct 2026). Everything comes from lib/adminRegistry.ts,
 * so a new admin page appears here by adding its one line there; its picture
 * comes from lib/adminPreviews.ts, else the group's icon.
 */
import Link from "next/link";
import AdminShell from "@/components/admin/shell/AdminShell";
import { GROUPS, groupIcon, groupsOf, isTestPage, visibleTo, type AdminGroup, type AdminOwner, type AdminPage } from "@/lib/adminRegistry";
import { ADMIN_PREVIEW } from "@/lib/adminPreviews";
import { TAGLINE } from "../../AdminHome";
import "../../adminHome.css";

const OWNER_LETTER: Record<AdminOwner, string> = { Harry: "H", Mikey: "M", Leo: "L", Shared: "★" };
const WRITE_TAG: Record<string, { text: string; tone: string; help: string } | undefined> = {
  shared: { text: "Saves real data", tone: "amber", help: "Its buttons change what other players see" },
  repo: { text: "Writes the code", tone: "red", help: "Its buttons can write into the game's code" },
};

export default function GroupPage({ group, role }: { group: AdminGroup; role: "admin" | "tester" }) {
  const g = GROUPS.find((x) => x.key === group)!;
  const pages = visibleTo(role).filter((p) => p.group === group && p.url !== "/admin/star");
  // Only this game's other groups (Harry, 19 Oct 2026: a game's tab never shows another game's pages).
  const others = groupsOf(g.game).filter((x) => x.key !== group && visibleTo(role).some((p) => p.group === x.key));
  return (
    <AdminShell tab="home" role={role} game={g.game} group={group}>
      <div className="agp" data-g={group}>
        {/* The back arrow is the shell's, top left (it goes to the game's home). */}
        <div className="agp-banner">
          <h1>{g.name}</h1>
          <span>{TAGLINE[group]} · {pages.length} page{pages.length === 1 ? "" : "s"}</span>
        </div>
        <nav className="agp-jump" aria-label="Other groups">
          {others.map((o) => <Link key={o.key} href={`/admin/star/g/${o.key}`}>{o.name}</Link>)}
        </nav>
        {/* Tools (features we have and tune) first, then tests (new features being tried). */}
        {([["Admin tools", pages.filter((p) => !isTestPage(p.url))], ["Test pages", pages.filter((p) => isTestPage(p.url))]] as [string, AdminPage[]][])
          .filter(([, list]) => list.length)
          .map(([title, list]) => (
            <section key={title} className="agp-sec">
              <h2 className="agp-h2">{title} <span>{list.length}</span></h2>
              <div className="agp-grid">{list.map((p) => <Card key={p.url} p={p} group={group} />)}</div>
            </section>
          ))}
      </div>
    </AdminShell>
  );
}

function Card({ p, group }: { p: AdminPage; group: AdminGroup }) {
  const w = WRITE_TAG[p.writes];
  const pic = ADMIN_PREVIEW[p.url];
  return (
    <Link href={p.url} className="agp-card" title={`${p.name}: ${p.purpose}`}>
      <span className="agp-pic">
        {pic ? <img src={pic} alt="" loading="lazy" /> : <img src={groupIcon(group)} alt="" className="agp-icon" />}
      </span>
      <span className="agp-body">
        <b>{p.name}</b>
        <span className="agp-purpose">{p.purpose}</span>
        <span className="agp-foot">
          <span className={`ahb-o ${p.owner}`} title={`Owner: ${p.owner}`}>{OWNER_LETTER[p.owner]}</span>
          {w && <span className={`ash-tag ${w.tone}`} title={w.help}>{w.text}</span>}
          {p.access === "admin" && <span className="ash-tag grey" title="Only admins can open this page">Admins</span>}
          <span className="agp-open">Open</span>
        </span>
      </span>
    </Link>
  );
}
