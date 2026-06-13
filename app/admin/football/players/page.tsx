"use client";

import { useState } from "react";
import Link from "next/link";

/* ── Attribute label map ── */
const ATTR_LABELS: Record<string, string> = {
  attr_pac: "Pace",
  attr_sho: "Shooting",
  attr_pas: "Passing",
  attr_dri: "Dribbling",
  attr_def: "Defending",
  attr_phy: "Physical",
  attr_oa: "Overall",
  attr_pt: "Potential",
  attr_ae: "Age",
  attr_fi: "Finishing",
  attr_po: "Positioning",
  attr_cr: "Crossing",
  attr_vi: "Vision",
  attr_lo: "Long Shots",
  attr_sh: "Short Passing",
  attr_lp: "Long Passing",
  attr_he: "Heading Accuracy",
  attr_in: "Interceptions",
  attr_st: "Standing Tackle",
  attr_sl: "Sliding Tackle",
  attr_ma: "Marking",
  attr_re: "Reactions",
  attr_sp: "Sprint Speed",
  attr_ac: "Acceleration",
  attr_ag: "Agility",
  attr_ba: "Balance",
  attr_bc: "Ball Control",
  attr_co: "Composure",
  attr_cu: "Curve",
  attr_fr: "Free Kick Accuracy",
  attr_jm: "Jumping",
  attr_pe: "Penalties",
  attr_so: "Shot Power",
  attr_sm: "Stamina",
  attr_sr: "Strength",
  attr_vo: "Volleys",
  attr_aw: "Attacking Work Rate",
  attr_dw: "Defensive Work Rate",
  attr_sk: "Skill Moves",
  attr_wf: "Weak Foot",
  attr_ir: "International Reputation",
  attr_pf: "Preferred Foot",
  attr_gd: "GK Diving",
  attr_gh: "GK Handling",
  attr_gk: "GK Kicking",
  attr_gp: "GK Positioning",
  attr_gr: "GK Reflexes",
  attr_div: "GK Diving",
  attr_han: "GK Handling",
  attr_kic: "GK Kicking",
  attr_pos: "GK Positioning",
  attr_ref: "GK Reflexes",
  attr_spd: "GK Speed",
};

/* ── FIFA year label ── */
function yearLabel(year: number): string {
  const y = year > 100 ? year % 100 : year;
  if (y >= 24) return `FC ${String(y).padStart(2, "0")}`;
  return `FIFA ${String(y).padStart(2, "0")}`;
}

/* ── Year options (7-26) ── */
const YEAR_OPTIONS: { value: number; label: string }[] = [];
for (let y = 26; y >= 7; y--) {
  YEAR_OPTIONS.push({ value: y, label: yearLabel(y) });
}

/* ── Player type from API ── */
interface SofifaPlayer {
  sofifa_id: string;
  fifa_year: number;
  name: string;
  positions: string | null;
  club: string | null;
  league: string | null;
  overall: number | null;
  manual_overall: number | null;
  potential: number | null;
  age: number | null;
  image_url: string | null;
  attributes: Record<string, unknown> | null;
}

export default function PlayerSearchPage() {
  const [nameQuery, setNameQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");

  const [players, setPlayers] = useState<SofifaPlayer[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [expandedEdition, setExpandedEdition] = useState<string | null>(null);
  const [editingOvr, setEditingOvr] = useState<string | null>(null);
  const [editOvrValue, setEditOvrValue] = useState("");
  const [savingOvr, setSavingOvr] = useState(false);

  const handleSearch = async () => {
    const q = nameQuery.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setPlayers([]);
    setCount(null);
    setExpandedPlayer(null);
    setExpandedEdition(null);

    try {
      const params = new URLSearchParams({ q, limit: "200" });
      if (yearFilter) params.set("year", yearFilter);
      if (clubFilter.trim()) params.set("club", clubFilter.trim());
      if (posFilter.trim()) params.set("position", posFilter.trim());

      const res = await fetch(`/api/admin/football/player-search?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? "Search failed");

      setPlayers(json.players ?? []);
      setCount(json.count ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleSaveOvr = async (sofifaId: string, fifaYear: number) => {
    const val = editOvrValue.trim();
    const newOvr = val === "" ? null : parseInt(val, 10);
    if (val !== "" && (isNaN(newOvr!) || newOvr! < 1 || newOvr! > 99)) return;

    setSavingOvr(true);
    try {
      const res = await fetch("/api/admin/football/player-search", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofifa_id: sofifaId, fifa_year: fifaYear, manual_overall: newOvr }),
      });
      if (res.ok) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.sofifa_id === sofifaId && p.fifa_year === fifaYear
              ? { ...p, manual_overall: newOvr }
              : p
          )
        );
      }
    } catch {}
    setSavingOvr(false);
    setEditingOvr(null);
  };

  interface PlayerGroup {
    sofifa_id: string;
    name: string;
    editions: SofifaPlayer[];
  }

  const grouped: PlayerGroup[] = (() => {
    const map = new Map<string, PlayerGroup>();
    for (const p of players) {
      let group = map.get(p.sofifa_id);
      if (!group) {
        group = { sofifa_id: p.sofifa_id, name: p.name, editions: [] };
        map.set(p.sofifa_id, group);
      }
      group.editions.push(p);
    }
    for (const g of Array.from(map.values())) {
      g.editions.sort((a, b) => b.fifa_year - a.fifa_year);
    }
    return Array.from(map.values());
  })();

  const renderAttributes = (attrs: Record<string, unknown>) => {
    const entries = Object.entries(attrs)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
      return (
        <p className="text-sm text-gray-500">No attributes available.</p>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {entries.map(([key, value]) => {
          const label = ATTR_LABELS[key];
          const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
          return (
            <div key={key} className="flex items-baseline gap-2 py-0.5">
              <span className="shrink-0 text-xs font-mono text-gray-500" title={key}>
                {key}
              </span>
              {label && (
                <span className="shrink-0 text-xs text-gray-400">
                  ({label})
                </span>
              )}
              <span className="text-sm font-bold text-white truncate">
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Back link */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/admin" className="hover:text-white transition-colors">
            Admin
          </Link>
          <span>/</span>
          <Link
            href="/admin/football"
            className="hover:text-white transition-colors"
          >
            Football Data
          </Link>
          <span>/</span>
          <span className="text-white font-bold">SoFIFA Player Search</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black">SoFIFA Player Search</h1>
          <p className="mt-1 text-sm text-gray-500">
            Search the sofifa_players database. View all player attributes from
            any FIFA edition.
          </p>
        </div>

        {/* Search controls */}
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Player name */}
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Player Name
              </label>
              <input
                type="text"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Messi, Ronaldo, Haaland..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* FIFA year */}
            <div className="w-full sm:w-36">
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                FIFA Year
              </label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">All Years</option>
                {YEAR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Club name */}
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Club Name
              </label>
              <input
                type="text"
                value={clubFilter}
                onChange={(e) => setClubFilter(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Manchester United, Barcelona..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Position */}
            <div className="w-full sm:w-32">
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Position
              </label>
              <input
                type="text"
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. ST, GK"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={loading || !nameQuery.trim()}
              className="shrink-0 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-12 text-center text-gray-500">
            Searching sofifa_players...
          </div>
        )}

        {/* Results */}
        {!loading && count !== null && (
          <>
            <div className="mb-4 text-sm text-gray-400">
              <span className="font-bold text-white">{count}</span> result
              {count !== 1 ? "s" : ""} across{" "}
              <span className="font-bold text-white">{grouped.length}</span> player
              {grouped.length !== 1 ? "s" : ""}
              {count === 200 && (
                <span className="text-yellow-400 ml-2">
                  (limit reached -- narrow your search for more specific results)
                </span>
              )}
            </div>

            {grouped.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                No players match your search criteria.
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map((group) => {
                  const isOpen = expandedPlayer === group.sofifa_id;
                  const bestOvr = Math.max(...group.editions.map(e => e.manual_overall ?? e.overall ?? 0));
                  const editionRange = `${yearLabel(group.editions[group.editions.length - 1].fifa_year)} – ${yearLabel(group.editions[0].fifa_year)}`;
                  return (
                    <div key={group.sofifa_id} className="rounded-xl border border-gray-800 overflow-hidden">
                      <button
                        onClick={() => setExpandedPlayer(isOpen ? null : group.sofifa_id)}
                        className={`w-full text-left px-5 py-3.5 flex items-center gap-4 transition-colors ${
                          isOpen ? "bg-gray-800" : "bg-gray-900 hover:bg-gray-850"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-white text-base">{group.name}</span>
                          <span className="ml-3 text-xs text-gray-500">ID: {group.sofifa_id}</span>
                        </div>
                        <div className="text-sm text-gray-400">{editionRange}</div>
                        <div className="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 text-sm font-bold">
                          Peak {bestOvr}
                        </div>
                        <div className="text-sm text-gray-400 font-medium">
                          {group.editions.length} edition{group.editions.length !== 1 ? "s" : ""}
                        </div>
                        <div className="text-gray-500">{isOpen ? "▲" : "▼"}</div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-gray-800">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-900/80 border-b border-gray-800/50">
                                <th className="px-5 py-2 text-left text-xs font-bold uppercase text-gray-500">Edition</th>
                                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Club</th>
                                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Positions</th>
                                <th className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">OVR</th>
                                <th className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">POT</th>
                                <th className="px-3 py-2 text-center text-xs font-bold uppercase text-gray-500">Age</th>
                                <th className="px-3 py-2 w-10"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.editions.map((p) => {
                                const edKey = `${p.sofifa_id}-${p.fifa_year}`;
                                const edExpanded = expandedEdition === edKey;
                                const isEditing = editingOvr === edKey;
                                const effectiveOvr = p.manual_overall ?? p.overall;
                                const hasOverride = p.manual_overall !== null && p.manual_overall !== undefined;
                                return (
                                  <tr key={edKey} className="border-b border-gray-800/30">
                                    <td colSpan={7} className="p-0">
                                      <div className={`flex items-center transition-colors ${
                                        edExpanded ? "bg-gray-800/60" : "hover:bg-gray-900/60"
                                      }`}>
                                        <button
                                          onClick={() => setExpandedEdition(edExpanded ? null : edKey)}
                                          className="flex items-center flex-1 min-w-0 text-left"
                                        >
                                          <div className="px-5 py-2.5 text-gray-300 min-w-[100px] font-medium">
                                            {yearLabel(p.fifa_year)}
                                          </div>
                                          <div className="px-3 py-2.5 text-gray-300 truncate min-w-[140px] max-w-[220px]">
                                            {p.club ?? "--"}
                                          </div>
                                          <div className="px-3 py-2.5 text-yellow-400 min-w-[100px]">
                                            {p.positions ?? "--"}
                                          </div>
                                        </button>
                                        <div className="px-3 py-2.5 text-center font-bold min-w-[50px]">
                                          {isEditing ? (
                                            <input
                                              type="number"
                                              min={1}
                                              max={99}
                                              autoFocus
                                              value={editOvrValue}
                                              onChange={(e) => setEditOvrValue(e.target.value)}
                                              onBlur={() => handleSaveOvr(p.sofifa_id, p.fifa_year)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveOvr(p.sofifa_id, p.fifa_year);
                                                if (e.key === "Escape") setEditingOvr(null);
                                              }}
                                              disabled={savingOvr}
                                              className="w-12 bg-gray-700 border border-emerald-500 rounded px-1 py-0.5 text-center text-sm font-bold text-white focus:outline-none"
                                            />
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingOvr(edKey);
                                                setEditOvrValue(String(effectiveOvr ?? ""));
                                              }}
                                              className={`hover:ring-1 hover:ring-emerald-500 rounded px-1.5 py-0.5 transition-all ${
                                                hasOverride ? "text-amber-400" : "text-emerald-400"
                                              }`}
                                              title={hasOverride ? `Manual: ${p.manual_overall} (scraped: ${p.overall ?? "?"})` : "Click to edit"}
                                            >
                                              {effectiveOvr ?? "--"}
                                              {hasOverride && <span className="text-[9px] text-amber-500 ml-0.5">*</span>}
                                            </button>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => setExpandedEdition(edExpanded ? null : edKey)}
                                          className="flex items-center text-left"
                                        >
                                          <div className="px-3 py-2.5 text-center text-gray-300 min-w-[50px]">
                                            {p.potential ?? "--"}
                                          </div>
                                          <div className="px-3 py-2.5 text-center text-gray-400 min-w-[50px]">
                                            {p.age ?? "--"}
                                          </div>
                                          <div className="px-3 py-2.5 text-center text-gray-600 min-w-[40px]">
                                            {edExpanded ? "▲" : "▼"}
                                          </div>
                                        </button>
                                      </div>

                                      {edExpanded && (
                                        <div className="border-t border-gray-700 bg-gray-900/40 px-6 py-4">
                                          <h4 className="mb-3 text-xs font-bold uppercase text-gray-500">
                                            All Attributes ({p.attributes ? Object.keys(p.attributes).length : 0} keys)
                                          </h4>
                                          {p.attributes && Object.keys(p.attributes).length > 0 ? (
                                            renderAttributes(p.attributes)
                                          ) : (
                                            <p className="text-sm text-gray-500">
                                              No attributes stored for this player.
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
