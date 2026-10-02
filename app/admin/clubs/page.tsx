"use client";

/**
 * /admin/clubs — CLUB DATA (Mikey, 2 Oct 2026).
 *
 * Every club in the game, one row each, every piece of information the game
 * uses about it in one column each. Green = given, amber = the game is making
 * it up, red = nothing at all. Filter by division, search, show only gaps,
 * download the lot as a spreadsheet. Read-only: the data itself lives in the
 * club sheets (lib/star/data/sources/) and the game's tables — see
 * lib/star/data/clubAudit.ts.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { AUDIT_COLUMNS, AUDIT_GROUPS, auditAll, type AuditCell, type AuditRow, type AuditStatus, type LineupInfo } from "@/lib/star/data/clubAudit";
import { fetchSharedLineups, loadLineup } from "@/lib/star/lineupStore";
import { getClubLogoMap, lookupClubLogo } from "@/lib/star/clubLogos";

const LOOK: Record<AuditStatus, { bg: string; fg: string; label: string }> = {
  given: { bg: "#14532d", fg: "#ffffff", label: "Given" },
  guess: { bg: "#78350f", fg: "#ffffff", label: "Game guesses" },
  missing: { bg: "#7f1d1d", fg: "#ffffff", label: "Missing" },
  na: { bg: "transparent", fg: "#ffffff", label: "Doesn't apply" },
};

type LogoState = "checking" | "failed" | Map<string, string>;

export default function ClubDataPage() {
  const [lineups, setLineups] = useState<Record<string, LineupInfo>>({});
  const [logos, setLogos] = useState<LogoState>("checking");
  const [group, setGroup] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [column, setColumn] = useState<string>("");

  useEffect(() => {
    const allClubs = AUDIT_GROUPS.flatMap(g => g.clubs);
    const readLineups = () => {
      const out: Record<string, LineupInfo> = {};
      for (const c of allClubs) {
        const l = loadLineup(c);
        if (l) out[c] = { manager: l.manager || undefined, formation: l.formation || undefined };
      }
      setLineups(out);
    };
    readLineups();
    fetchSharedLineups().then(readLineups).catch(() => {});
    getClubLogoMap()
      .then(m => setLogos(m.size > 0 ? m : "failed"))
      .catch(() => setLogos("failed"));
  }, []);

  const rows: AuditRow[] = useMemo(() => {
    const all = auditAll(lineups);
    for (const r of all) {
      if (logos === "checking") r.cells.logo = { value: "", status: "missing", note: "Checking…" };
      else if (logos === "failed") r.cells.logo = { value: "", status: "missing", note: "Couldn't read the badge table" };
      else r.cells.logo = lookupClubLogo(logos, r.club) ? { value: "Yes", status: "given" } : { value: "", status: "missing", note: "Shows initials" };
    }
    return all;
  }, [lineups, logos]);

  const isGap = (c: AuditCell) => c.status === "missing" || c.status === "guess";
  const shown = rows.filter(r =>
    (group === "All" || r.group === group)
    && (!search || r.club.toLowerCase().includes(search.toLowerCase()))
    && (!gapsOnly || Object.values(r.cells).some(isGap))
    && (!column || isGap(r.cells[column])));
  const cols = column ? AUDIT_COLUMNS.filter(c => c.key === column) : AUDIT_COLUMNS;

  /** Per column, across the rows in the current division filter: how many are given. */
  const counts = useMemo(() => {
    const inGroup = rows.filter(r => group === "All" || r.group === group);
    return Object.fromEntries(AUDIT_COLUMNS.map(c => {
      const applies = inGroup.filter(r => r.cells[c.key].status !== "na");
      return [c.key, { have: applies.filter(r => r.cells[c.key].status === "given").length, of: applies.length }];
    }));
  }, [rows, group]);

  const total = useMemo(() => {
    let have = 0, of = 0;
    for (const k of AUDIT_COLUMNS) { have += counts[k.key].have; of += counts[k.key].of; }
    return { have, of };
  }, [counts]);

  const downloadCsv = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const head = ["Club", "Division", ...AUDIT_COLUMNS.flatMap(c => [c.label, `${c.label} (status)`])];
    const lines = [head, ...shown.map(r => [r.club, r.group, ...AUDIT_COLUMNS.flatMap(c => {
      const cell = r.cells[c.key];
      return [cell.value, cell.status === "na" ? "" : LOOK[cell.status].label];
    })])].map(l => l.map(esc).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "knowitball-club-data.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="text-2xl font-black">Club Data</h1>
        <p className="mt-1 text-sm font-bold text-white">
          Every club in the game and everything the game knows about it. {total.have} of {total.of} boxes filled
          {group !== "All" ? ` in ${group}` : ""} ({total.of ? Math.round((total.have / total.of) * 100) : 0}%).
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
          {(["given", "guess", "missing"] as AuditStatus[]).map(s => (
            <span key={s} className="rounded px-2 py-1" style={{ background: LOOK[s].bg, color: LOOK[s].fg }}>{LOOK[s].label}</span>
          ))}
          <span className="rounded border border-white/30 px-2 py-1">— Doesn&apos;t apply</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={group} onChange={e => setGroup(e.target.value)} className="rounded bg-slate-800 px-2 py-2 font-bold text-white">
            <option value="All">All divisions</option>
            {AUDIT_GROUPS.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
          </select>
          <select value={column} onChange={e => setColumn(e.target.value)} className="rounded bg-slate-800 px-2 py-2 font-bold text-white">
            <option value="">All information</option>
            {AUDIT_COLUMNS.map(c => <option key={c.key} value={c.key}>Gaps in: {c.label}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a club"
            className="rounded bg-slate-800 px-2 py-2 font-bold text-white placeholder:text-white/70" />
          <label className="flex items-center gap-2 font-bold">
            <input type="checkbox" checked={gapsOnly} onChange={e => setGapsOnly(e.target.checked)} /> Only clubs with gaps
          </label>
          <button onClick={downloadCsv} className="rounded bg-emerald-600 px-3 py-2 font-black text-white">Download spreadsheet</button>
          <span className="font-bold">{shown.length} clubs</span>
        </div>

        <div className="mt-3 overflow-x-auto rounded border border-white/15">
          <table className="border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900">
                <th className="sticky left-0 z-10 bg-slate-900 px-2 py-2 text-left font-black">Club</th>
                <th className="px-2 py-2 text-left font-black">Division</th>
                {cols.map(c => (
                  <th key={c.key} className="whitespace-nowrap px-2 py-2 text-left font-black">
                    <div>{c.label}</div>
                    <div className="font-bold">{counts[c.key].of ? `${counts[c.key].have}/${counts[c.key].of}` : "—"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.club} className="border-t border-white/10">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-slate-950 px-2 py-1.5 font-black">{r.club}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-bold">{r.group}</td>
                  {cols.map(c => {
                    const cell = r.cells[c.key];
                    const look = LOOK[cell.status];
                    return (
                      <td key={c.key} title={cell.note ?? look.label}
                        className="max-w-[220px] truncate px-2 py-1.5 font-bold"
                        style={{ background: look.bg, color: look.fg }}>
                        {c.key === "kits" && cell.status === "given"
                          ? <KitSwatches hex={cell.value.split(" ")} />
                          : cell.status === "na" ? "—" : cell.value || cell.note || "Missing"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <PageGuide page="/admin/clubs" />
    </main>
  );
}

/** Home shirt/trim, then away shirt/trim, as little squares. */
function KitSwatches({ hex }: { hex: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {hex.map((h, i) => (
        <span key={i} className={`inline-block h-4 w-4 border border-white/60 ${i === 2 ? "ml-2" : ""}`} style={{ background: h }} />
      ))}
    </span>
  );
}
