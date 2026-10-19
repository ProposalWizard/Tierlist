"use client";

/**
 * /admin/clubs → International: every nation in the game with its real home
 * and away kit (Leo, 13 Oct 2026). Same idea as the club rows: what the game
 * knows, where it came from, and the gaps. Read-only; the data is
 * lib/star/data/sources/nation_kits_2026-10.json (see lib/star/data/nationKits.ts).
 */
import { useMemo, useState } from "react";
import { NATIONS } from "@/lib/star/intl/nations";
import { nationKitProfile, type NationKitInfo } from "@/lib/star/data/nationKits";
import { nationKits } from "@/lib/star/international";
import { hasDrawnFlag } from "@/lib/star/nationFlags";
import NationFlag from "@/components/star/NationFlag";

const CONFEDS = ["All", "UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"] as const;

/** A small drawn kit: sleeves, shirt with its second colour, shorts, socks. */
export function KitPicture({ kit, worn }: { kit?: NationKitInfo; worn: { shirt: string; trim: string } }) {
  if (!kit?.shirtHex) return <span className="text-red-300">Missing</span>;
  const shirt = kit.shirtHex, sleeves = kit.sleevesHex ?? shirt, second = worn.trim;
  const p = (kit.pattern ?? "").toLowerCase();
  const stripes = /stripes/.test(p), hoops = /hoops/.test(p), halves = /halves/.test(p), band = /band|sash/.test(p);
  return (
    <svg viewBox="0 0 40 46" width={64} height={74} aria-label={kit.pattern}>
      <path d="M2 6 L11 2 L11 14 L4 16 Z" fill={sleeves} stroke="#000" strokeWidth="0.6" />
      <path d="M38 6 L29 2 L29 14 L36 16 Z" fill={sleeves} stroke="#000" strokeWidth="0.6" />
      <rect x="11" y="2" width="18" height="22" fill={shirt} stroke="#000" strokeWidth="0.6" />
      {stripes && [13, 18, 23].map(x => <rect key={x} x={x} y="2" width="2.5" height="22" fill={second} />)}
      {hoops && [6, 12, 18].map(y => <rect key={y} x="11" y={y} width="18" height="2.5" fill={second} />)}
      {halves && <rect x="20" y="2" width="9" height="22" fill={second} />}
      {band && <rect x="11" y="9" width="18" height="4" fill={second} />}
      <path d="M16 2 Q20 6 24 2" fill="none" stroke={second} strokeWidth="1.4" />
      <rect x="11" y="2" width="18" height="22" fill="none" stroke="#000" strokeWidth="0.6" />
      <rect x="11" y="25" width="18" height="8" fill={kit.shortsHex ?? "#fff"} stroke="#000" strokeWidth="0.6" />
      <rect x="12" y="35" width="6" height="10" fill={kit.socksHex ?? "#fff"} stroke="#000" strokeWidth="0.6" />
      <rect x="22" y="35" width="6" height="10" fill={kit.socksHex ?? "#fff"} stroke="#000" strokeWidth="0.6" />
    </svg>
  );
}

function KitWords({ kit }: { kit?: NationKitInfo }) {
  if (!kit?.shirtHex) return null;
  return (
    <div className="min-w-[170px] leading-tight">
      <div className="font-black">{kit.pattern}</div>
      <div className="font-bold">Shorts {kit.shorts} · Socks {kit.socks}</div>
    </div>
  );
}

export default function NationKitsTable() {
  const [confed, setConfed] = useState<(typeof CONFEDS)[number]>("All");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => NATIONS.map(n => ({ n, p: nationKitProfile(n.name), worn: nationKits(n.name) })), []);
  const shown = rows.filter(r =>
    (confed === "All" || r.n.confederation === confed)
    && (!search || r.n.name.toLowerCase().includes(search.toLowerCase())));
  const withKits = rows.filter(r => r.p?.homeKit.shirtHex && r.p?.awayKit.shirtHex).length;
  const withFlags = rows.filter(r => hasDrawnFlag(r.n.name)).length;

  const downloadCsv = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const side = (k?: NationKitInfo) => [k?.pattern ?? "", k?.shirtHex ?? "", k?.trimHex ?? "", k?.sleevesHex ?? "", k?.shorts ?? "", k?.shortsHex ?? "", k?.socks ?? "", k?.socksHex ?? ""];
    const parts = ["pattern", "shirt", "second colour", "sleeves", "shorts", "shorts hex", "socks", "socks hex"];
    const head = ["Nation", "Confederation", "FIFA rank", "Flag drawn", ...parts.map(p => `Home ${p}`), ...parts.map(p => `Away ${p}`), "Source"];
    const lines = [head, ...shown.map(({ n, p }) => [
      n.name, n.confederation, String(n.rank), hasDrawnFlag(n.name) ? "Yes" : "No",
      ...side(p?.homeKit), ...side(p?.awayKit), p?.source ?? "",
    ])].map(l => l.map(esc).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "knowitball-nation-kits.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <p className="mt-1 text-sm font-bold text-white">
        Every nation in the game. Kits: {withKits} of {rows.length}. Drawn flags: {withFlags} of {rows.length} (the
        rest show two bands in their kit colours).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={confed} onChange={e => setConfed(e.target.value as (typeof CONFEDS)[number])} className="rounded bg-slate-800 px-2 py-2 font-bold text-white">
          {CONFEDS.map(c => <option key={c} value={c}>{c === "All" ? "All confederations" : c}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a nation"
          className="rounded bg-slate-800 px-2 py-2 font-bold text-white placeholder:text-white/70" />
        <button onClick={downloadCsv} className="rounded bg-emerald-600 px-3 py-2 font-black text-white">Download spreadsheet</button>
        <span className="font-bold">{shown.length} nations</span>
      </div>
      <div className="mt-3 overflow-x-auto rounded border border-white/15">
        <table className="border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-left">
              <th className="sticky left-0 z-10 bg-slate-900 px-2 py-2 font-black">Nation</th>
              <th className="px-2 py-2 font-black">Confed.</th>
              <th className="px-2 py-2 font-black">Flag</th>
              <th className="px-2 py-2 font-black" colSpan={2}>Home kit</th>
              <th className="px-2 py-2 font-black" colSpan={2}>Away kit</th>
              <th className="px-2 py-2 font-black">Source</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ n, p, worn }) => (
              <tr key={n.code} className="border-t border-white/10 align-middle">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-slate-950 px-2 py-1.5 font-black">{n.name}</td>
                <td className="px-2 py-1.5 font-bold">{n.confederation}</td>
                <td className="px-2 py-1.5" style={{ background: hasDrawnFlag(n.name) ? "#14532d" : "#78350f" }}
                  title={hasDrawnFlag(n.name) ? "Drawn flag" : "No drawing yet: two bands in the kit colours"}>
                  <NationFlag nation={n.name} width={30} />
                </td>
                <td className="px-2 py-1.5"><KitPicture kit={p?.homeKit} worn={worn.home} /></td>
                <td className="px-2 py-1.5"><KitWords kit={p?.homeKit} /></td>
                <td className="px-2 py-1.5"><KitPicture kit={p?.awayKit} worn={worn.away} /></td>
                <td className="px-2 py-1.5"><KitWords kit={p?.awayKit} /></td>
                <td className="px-2 py-1.5 font-bold">
                  {p ? <a href={p.source} target="_blank" rel="noreferrer" className="underline">Wikipedia</a> : <span className="text-red-300">Missing</span>}
                  {p?.checked && <div className="whitespace-nowrap">{p.checked}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
