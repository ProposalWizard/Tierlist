"use client";

import { useState, useEffect } from "react";
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
  manual_positions: string | null;
  nationality: string | null;
  manual_nationality: string | null;
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
  const [editingPos, setEditingPos] = useState<string | null>(null);
  const [editPosValue, setEditPosValue] = useState("");
  const [savingPos, setSavingPos] = useState(false);
  const [editingNat, setEditingNat] = useState<string | null>(null);
  const [editNatValue, setEditNatValue] = useState("");
  const [savingNat, setSavingNat] = useState(false);
  const [deletingEdition, setDeletingEdition] = useState<string | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState<string | null>(null);
  const [cloningEdition, setCloningEdition] = useState<string | null>(null);
  const [cloneTargetYear, setCloneTargetYear] = useState<number>(26);
  const [cloneOvr, setCloneOvr] = useState("");
  const [cloneClub, setCloneClub] = useState("");
  const [clonePositions, setClonePositions] = useState("");
  const [cloneMoveMode, setCloneMoveMode] = useState(false);
  const [cloningInProgress, setCloningInProgress] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const [dataStats, setDataStats] = useState<Record<number, number> | null>(null);
  const [clubSuggestions, setClubSuggestions] = useState<string[]>([]);
  const [showClubDropdown, setShowClubDropdown] = useState(false);
  const [loadingClubs, setLoadingClubs] = useState(false);

  // Load data stats (player count per year) on mount
  useEffect(() => {
    fetch("/api/admin/football/data-stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.stats) setDataStats(d.stats); })
      .catch(() => {});
  }, []);

  // Fetch club suggestions when year changes
  const fetchClubSuggestions = async (yearVal: string) => {
    if (!yearVal) { setClubSuggestions([]); return; }
    setLoadingClubs(true);
    try {
      const res = await fetch(`/api/admin/football/data-stats?year=${yearVal}&clubs=1`);
      if (res.ok) {
        const d = await res.json();
        setClubSuggestions(d.clubs ?? []);
      }
    } catch { /* ignore */ }
    setLoadingClubs(false);
  };

  const hasAnyFilter = nameQuery.trim() || yearFilter || clubFilter.trim() || posFilter.trim();

  const handleSearch = async () => {
    if (!hasAnyFilter) {
      setError("Enter at least one filter (name, year, club, or position).");
      return;
    }

    setLoading(true);
    setError(null);
    setPlayers([]);
    setCount(null);
    setExpandedPlayer(null);
    setExpandedEdition(null);

    try {
      const params = new URLSearchParams({ limit: "200" });
      if (nameQuery.trim()) params.set("q", nameQuery.trim());
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

  const handleSavePos = async (sofifaId: string, fifaYear: number) => {
    const val = editPosValue.trim().toUpperCase();
    const newPos = val === "" ? null : val;

    setSavingPos(true);
    try {
      const res = await fetch("/api/admin/football/player-search", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofifa_id: sofifaId, fifa_year: fifaYear, manual_positions: newPos }),
      });
      if (res.ok) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.sofifa_id === sofifaId && p.fifa_year === fifaYear
              ? { ...p, manual_positions: newPos }
              : p
          )
        );
      }
    } catch {}
    setSavingPos(false);
    setEditingPos(null);
  };

  const handleSaveNat = async (sofifaId: string, fifaYear: number) => {
    const val = editNatValue.trim();
    const newNat = val === "" ? null : val;

    setSavingNat(true);
    try {
      const res = await fetch("/api/admin/football/player-search", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofifa_id: sofifaId, fifa_year: fifaYear, manual_nationality: newNat }),
      });
      if (res.ok) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.sofifa_id === sofifaId && p.fifa_year === fifaYear
              ? { ...p, manual_nationality: newNat }
              : p
          )
        );
      }
    } catch {}
    setSavingNat(false);
    setEditingNat(null);
  };

  const handleDelete = async (sofifaId: string, fifaYear: number) => {
    const edKey = `${sofifaId}-${fifaYear}`;
    setDeletingInProgress(edKey);
    try {
      const res = await fetch("/api/admin/football/player-search", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofifa_id: sofifaId, fifa_year: fifaYear }),
      });
      if (res.ok) {
        setPlayers((prev) => prev.filter((p) => !(p.sofifa_id === sofifaId && p.fifa_year === fifaYear)));
        setCount((c) => (c !== null ? c - 1 : null));
      }
    } catch {}
    setDeletingInProgress(null);
    setDeletingEdition(null);
  };

  const openCloneForm = (p: SofifaPlayer, existingYears: Set<number>) => {
    const edKey = `${p.sofifa_id}-${p.fifa_year}`;
    setCloningEdition(edKey);
    setCloneOvr(String(p.manual_overall ?? p.overall ?? ""));
    setCloneClub(p.club ?? "");
    setClonePositions((p.manual_positions ?? p.positions) ?? "");
    setCloneMoveMode(false);
    setCloneError(null);
    for (let y = 26; y >= 7; y--) {
      if (!existingYears.has(y)) {
        setCloneTargetYear(y);
        break;
      }
    }
  };

  const handleClone = async (sourcePlayer: SofifaPlayer) => {
    setCloningInProgress(true);
    setCloneError(null);
    const ovr = cloneOvr.trim() ? parseInt(cloneOvr.trim(), 10) : undefined;
    const club = cloneClub.trim() || undefined;
    const positions = clonePositions.trim() || undefined;
    try {
      const res = await fetch("/api/admin/football/player-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sofifa_id: sourcePlayer.sofifa_id,
          source_year: sourcePlayer.fifa_year,
          target_year: cloneTargetYear,
          overrides: {
            ...(ovr !== undefined && !isNaN(ovr) ? { overall: ovr } : {}),
            ...(club ? { club } : {}),
            ...(positions ? { positions } : {}),
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.player) {
        setPlayers((prev) => [...prev, json.player]);
        setCount((c) => (c !== null ? c + 1 : null));

        if (cloneMoveMode) {
          // Delete the source year entry
          const delRes = await fetch("/api/admin/football/player-search", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sofifa_id: sourcePlayer.sofifa_id, fifa_year: sourcePlayer.fifa_year }),
          });
          if (delRes.ok) {
            setPlayers((prev) => prev.filter(
              (p) => !(p.sofifa_id === sourcePlayer.sofifa_id && p.fifa_year === sourcePlayer.fifa_year)
            ));
            setCount((c) => (c !== null ? c - 1 : null));
          } else {
            setCloneError("Moved to new year but failed to delete old entry — delete it manually.");
            setCloningInProgress(false);
            return;
          }
        }

        setCloningEdition(null);
      } else {
        setCloneError(json.error ?? "Clone failed");
      }
    } catch {
      setCloneError("Clone failed");
    }
    setCloningInProgress(false);
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
        <p className="text-sm text-white">No attributes available.</p>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {entries.map(([key, value]) => {
          const label = ATTR_LABELS[key];
          const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
          return (
            <div key={key} className="flex items-baseline gap-2 py-0.5">
              <span className="shrink-0 text-xs font-mono text-white" title={key}>
                {key}
              </span>
              {label && (
                <span className="shrink-0 text-xs text-white">
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
        <div className="mb-6 flex items-center gap-2 text-sm text-white">
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
          <p className="mt-1 text-sm text-white">
            Search the sofifa_players database. View all player attributes from
            any FIFA edition.
          </p>
        </div>

        {/* Data availability */}
        {dataStats && (
          <div className="mb-4 rounded-lg border border-gray-800/60 bg-gray-900/60 px-4 py-2.5 text-xs text-white">
            <span className="font-bold text-white">Imported data: </span>
            {Object.entries(dataStats)
              .filter(([, v]) => v > 0)
              .sort(([a], [b]) => parseInt(b) - parseInt(a))
              .map(([y, v]) => (
                <span key={y} className="inline-block mr-3">
                  <span className="text-emerald-400 font-bold">{yearLabel(parseInt(y, 10))}</span>
                  <span className="text-white ml-1">({(v as number).toLocaleString()})</span>
                </span>
              ))
            }
            {Object.values(dataStats).every(v => v === 0) && (
              <span className="text-yellow-500">No data imported yet.</span>
            )}
          </div>
        )}

        {/* Search controls */}
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Player name */}
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold uppercase text-white">
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
            <div className="w-full sm:w-44">
              <label className="mb-1 block text-xs font-bold uppercase text-white">
                FIFA Year
              </label>
              <select
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  fetchClubSuggestions(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">All Years</option>
                {YEAR_OPTIONS.map((opt) => {
                  const cnt = dataStats?.[opt.value];
                  return (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}{cnt ? ` (${cnt.toLocaleString()})` : cnt === 0 ? " (empty)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Club name */}
            <div className="flex-1 relative">
              <label className="mb-1 block text-xs font-bold uppercase text-white">
                Club Name
              </label>
              <input
                type="text"
                value={clubFilter}
                onChange={(e) => {
                  setClubFilter(e.target.value);
                  setShowClubDropdown(true);
                }}
                onFocus={() => { if (clubSuggestions.length > 0) setShowClubDropdown(true); }}
                onBlur={() => setTimeout(() => setShowClubDropdown(false), 200)}
                onKeyDown={handleKeyDown}
                placeholder={loadingClubs ? "Loading clubs..." : "e.g. Manchester United, Barcelona..."}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
              />
              {showClubDropdown && clubSuggestions.length > 0 && (() => {
                const filtered = clubFilter.trim()
                  ? clubSuggestions.filter(c => c.toLowerCase().includes(clubFilter.toLowerCase()))
                  : clubSuggestions;
                if (filtered.length === 0) return null;
                return (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
                    {filtered.slice(0, 30).map(c => (
                      <button
                        key={c}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setClubFilter(c); setShowClubDropdown(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                    {filtered.length > 30 && (
                      <div className="px-3 py-1.5 text-xs text-white">...{filtered.length - 30} more</div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Position */}
            <div className="w-full sm:w-32">
              <label className="mb-1 block text-xs font-bold uppercase text-white">
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
              disabled={loading || !hasAnyFilter}
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
          <div className="py-12 text-center text-white">
            Searching sofifa_players...
          </div>
        )}

        {/* Results */}
        {!loading && count !== null && (
          <>
            <div className="mb-4 text-sm text-white">
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
              <div className="py-12 text-center text-white">
                <p>No players match your search criteria.</p>
                {yearFilter && dataStats && !dataStats[parseInt(yearFilter, 10)] && (
                  <p className="mt-2 text-xs text-yellow-500">No data has been imported for {yearLabel(parseInt(yearFilter, 10))} yet. Import data first via the Scrape Data page.</p>
                )}
                {!yearFilter && dataStats && (
                  <p className="mt-2 text-xs text-white">
                    Data available for: {Object.entries(dataStats).filter(([,v]) => v > 0).map(([y]) => yearLabel(parseInt(y, 10))).join(", ") || "none"}
                  </p>
                )}
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
                          <span className="ml-3 text-xs text-white">ID: {group.sofifa_id}</span>
                        </div>
                        <div className="text-sm text-white">{editionRange}</div>
                        <div className="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 text-sm font-bold">
                          Peak {bestOvr}
                        </div>
                        <div className="text-sm text-white font-medium">
                          {group.editions.length} edition{group.editions.length !== 1 ? "s" : ""}
                        </div>
                        <div className="text-white">{isOpen ? "▲" : "▼"}</div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-gray-800">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-900/80 border-b border-gray-800/50">
                                <th className="px-5 py-2 text-left text-xs font-bold uppercase text-white">Edition</th>
                                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-white">Club</th>
                                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-white">Positions</th>
                                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-white">Nationality</th>
                                <th className="px-3 py-2 text-center text-xs font-bold uppercase text-white">OVR</th>
                                <th className="px-3 py-2 text-center text-xs font-bold uppercase text-white">POT</th>
                                <th className="px-3 py-2 text-center text-xs font-bold uppercase text-white">Age</th>
                                <th className="px-3 py-2 text-right text-xs font-bold uppercase text-white pr-4">Actions</th>
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
                                    <td colSpan={8} className="p-0">
                                      <div
                                        onClick={() => setExpandedEdition(edExpanded ? null : edKey)}
                                        className={`flex items-center cursor-pointer transition-colors ${
                                          edExpanded ? "bg-gray-800/60" : "hover:bg-gray-900/60"
                                        }`}
                                      >
                                        <div className="px-5 py-2.5 text-white min-w-[100px] font-medium">
                                          {yearLabel(p.fifa_year)}
                                        </div>
                                        <div className="px-3 py-2.5 text-white truncate min-w-[140px] max-w-[220px]">
                                          {p.club ?? "--"}
                                        </div>
                                        <div
                                          className="px-3 py-2.5 min-w-[120px] relative z-10"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {editingPos === edKey ? (
                                            <input
                                              type="text"
                                              autoFocus
                                              value={editPosValue}
                                              onChange={(e) => setEditPosValue(e.target.value)}
                                              onBlur={() => handleSavePos(p.sofifa_id, p.fifa_year)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSavePos(p.sofifa_id, p.fifa_year);
                                                if (e.key === "Escape") setEditingPos(null);
                                              }}
                                              disabled={savingPos}
                                              placeholder="e.g. ST, RW, CF"
                                              className="w-28 bg-gray-700 border border-yellow-500 rounded px-1 py-0.5 text-sm font-bold text-white focus:outline-none"
                                            />
                                          ) : (
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => {
                                                setEditingPos(edKey);
                                                setEditPosValue((p.manual_positions ?? p.positions) || "");
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  setEditingPos(edKey);
                                                  setEditPosValue((p.manual_positions ?? p.positions) || "");
                                                }
                                              }}
                                              className={`inline-block cursor-pointer rounded px-2 py-0.5 hover:bg-gray-700 hover:ring-1 hover:ring-yellow-500 transition-all ${
                                                p.manual_positions ? "text-amber-400" : "text-yellow-400"
                                              }`}
                                              title={p.manual_positions ? `Manual: ${p.manual_positions} (scraped: ${p.positions ?? "?"})` : "Click to edit positions"}
                                            >
                                              {(p.manual_positions ?? p.positions) || "--"}
                                              {p.manual_positions && <span className="text-[9px] text-amber-500 ml-0.5">*</span>}
                                            </span>
                                          )}
                                        </div>
                                        <div
                                          className="px-3 py-2.5 min-w-[110px] relative z-10"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {editingNat === edKey ? (
                                            <input
                                              type="text"
                                              autoFocus
                                              value={editNatValue}
                                              onChange={(e) => setEditNatValue(e.target.value)}
                                              onBlur={() => handleSaveNat(p.sofifa_id, p.fifa_year)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveNat(p.sofifa_id, p.fifa_year);
                                                if (e.key === "Escape") setEditingNat(null);
                                              }}
                                              disabled={savingNat}
                                              placeholder="e.g. Belgium"
                                              className="w-28 bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-sm font-bold text-white focus:outline-none"
                                            />
                                          ) : (
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => {
                                                setEditingNat(edKey);
                                                setEditNatValue((p.manual_nationality ?? p.nationality) || "");
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  setEditingNat(edKey);
                                                  setEditNatValue((p.manual_nationality ?? p.nationality) || "");
                                                }
                                              }}
                                              className={`inline-block cursor-pointer rounded px-2 py-0.5 hover:bg-gray-700 hover:ring-1 hover:ring-blue-500 transition-all ${
                                                p.manual_nationality ? "text-amber-400" : (p.nationality ? "text-blue-300" : "text-gray-500 italic")
                                              }`}
                                              title={p.manual_nationality ? `Manual: ${p.manual_nationality} (scraped: ${p.nationality ?? "?"})` : "Click to set nationality"}
                                            >
                                              {(p.manual_nationality ?? p.nationality) || "none"}
                                              {p.manual_nationality && <span className="text-[9px] text-amber-500 ml-0.5">*</span>}
                                            </span>
                                          )}
                                        </div>
                                        <div
                                          className="px-3 py-2.5 text-center font-bold min-w-[60px] shrink-0 relative z-10"
                                          onClick={(e) => e.stopPropagation()}
                                        >
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
                                              className="w-14 bg-gray-700 border border-emerald-500 rounded px-1 py-0.5 text-center text-sm font-bold text-white focus:outline-none"
                                            />
                                          ) : (
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => {
                                                setEditingOvr(edKey);
                                                setEditOvrValue(String(effectiveOvr ?? ""));
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  setEditingOvr(edKey);
                                                  setEditOvrValue(String(effectiveOvr ?? ""));
                                                }
                                              }}
                                              className={`inline-block cursor-pointer rounded px-2 py-0.5 hover:bg-gray-700 hover:ring-1 hover:ring-emerald-500 transition-all ${
                                                hasOverride ? "text-amber-400" : "text-emerald-400"
                                              }`}
                                              title={hasOverride ? `Manual: ${p.manual_overall} (scraped: ${p.overall ?? "?"})` : "Click to edit OVR"}
                                            >
                                              {effectiveOvr ?? "--"}
                                              {hasOverride && <span className="text-[9px] text-amber-500 ml-0.5">*</span>}
                                            </span>
                                          )}
                                        </div>
                                        <div className="px-3 py-2.5 text-center text-white min-w-[50px]">
                                          {p.potential ?? "--"}
                                        </div>
                                        <div className="px-3 py-2.5 text-center text-white min-w-[50px]">
                                          {p.age ?? "--"}
                                        </div>
                                        <div className="px-3 py-2.5 text-center text-white min-w-[40px]">
                                          {edExpanded ? "▲" : "▼"}
                                        </div>
                                        <div
                                          className="px-3 py-2.5 flex items-center gap-2 relative z-10 ml-auto"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {deletingEdition === edKey ? (
                                            <>
                                              <span className="text-xs text-red-400 whitespace-nowrap">Delete?</span>
                                              <button
                                                onClick={() => handleDelete(p.sofifa_id, p.fifa_year)}
                                                disabled={deletingInProgress === edKey}
                                                className="px-2 py-0.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded font-bold disabled:opacity-50"
                                              >
                                                {deletingInProgress === edKey ? "..." : "Yes"}
                                              </button>
                                              <button
                                                onClick={() => setDeletingEdition(null)}
                                                className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded font-bold"
                                              >
                                                No
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => {
                                                  setDeletingEdition(edKey);
                                                  setCloningEdition(null);
                                                }}
                                                title="Delete this edition"
                                                className="px-2 py-0.5 text-xs bg-red-900/40 hover:bg-red-700 text-red-400 hover:text-white rounded transition-colors"
                                              >
                                                Delete
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const existingYears = new Set(group.editions.map((e) => e.fifa_year));
                                                  openCloneForm(p, existingYears);
                                                  setDeletingEdition(null);
                                                }}
                                                title="Clone to another year"
                                                className="px-2 py-0.5 text-xs bg-blue-900/40 hover:bg-blue-700 text-blue-400 hover:text-white rounded transition-colors"
                                              >
                                                Clone
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {edExpanded && (
                                        <div className="border-t border-gray-700 bg-gray-900/40 px-6 py-4">
                                          <h4 className="mb-3 text-xs font-bold uppercase text-white">
                                            All Attributes ({p.attributes ? Object.keys(p.attributes).length : 0} keys)
                                          </h4>
                                          {p.attributes && Object.keys(p.attributes).length > 0 ? (
                                            renderAttributes(p.attributes)
                                          ) : (
                                            <p className="text-sm text-white">
                                              No attributes stored for this player.
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {cloningEdition === edKey && (
                                        <div className="border-t border-blue-900/50 bg-blue-950/20 px-6 py-4">
                                          <h4 className="mb-3 text-xs font-bold uppercase text-blue-400">
                                            {cloneMoveMode ? "Move" : "Clone"} {yearLabel(p.fifa_year)} → new edition
                                          </h4>
                                          <div className="flex flex-wrap items-end gap-3">
                                            <div>
                                              <label className="block text-xs text-white mb-1">Target Year</label>
                                              <select
                                                value={cloneTargetYear}
                                                onChange={(e) => setCloneTargetYear(parseInt(e.target.value, 10))}
                                                className="rounded bg-gray-800 border border-gray-600 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                              >
                                                {YEAR_OPTIONS.filter(
                                                  (opt) => !group.editions.some((e) => e.fifa_year === opt.value)
                                                ).map((opt) => (
                                                  <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                            <div>
                                              <label className="block text-xs text-white mb-1">
                                                OVR <span className="text-white">(blank = copy source)</span>
                                              </label>
                                              <input
                                                type="number"
                                                min={1}
                                                max={99}
                                                value={cloneOvr}
                                                onChange={(e) => setCloneOvr(e.target.value)}
                                                placeholder={String(p.manual_overall ?? p.overall ?? "")}
                                                className="w-16 rounded bg-gray-800 border border-gray-600 px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-white mb-1">
                                                Club <span className="text-white">(blank = copy source)</span>
                                              </label>
                                              <input
                                                type="text"
                                                value={cloneClub}
                                                onChange={(e) => setCloneClub(e.target.value)}
                                                placeholder={p.club ?? ""}
                                                className="w-48 rounded bg-gray-800 border border-gray-600 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-white mb-1">
                                                Positions <span className="text-white">(blank = copy source)</span>
                                              </label>
                                              <input
                                                type="text"
                                                value={clonePositions}
                                                onChange={(e) => setClonePositions(e.target.value)}
                                                placeholder={(p.manual_positions ?? p.positions) ?? ""}
                                                className="w-36 rounded bg-gray-800 border border-gray-600 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                              />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                  type="checkbox"
                                                  checked={cloneMoveMode}
                                                  onChange={(e) => setCloneMoveMode(e.target.checked)}
                                                  className="w-3.5 h-3.5 accent-orange-500"
                                                />
                                                <span className={`text-xs font-bold ${cloneMoveMode ? "text-orange-400" : "text-gray-400"}`}>
                                                  Move (delete {yearLabel(p.fifa_year)} after copying)
                                                </span>
                                              </label>
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={() => handleClone(p)}
                                                  disabled={cloningInProgress}
                                                  className={`px-3 py-1.5 text-sm text-white rounded font-bold disabled:opacity-50 ${
                                                    cloneMoveMode
                                                      ? "bg-orange-600 hover:bg-orange-500"
                                                      : "bg-blue-600 hover:bg-blue-500"
                                                  }`}
                                                >
                                                  {cloningInProgress ? (cloneMoveMode ? "Moving..." : "Cloning...") : (cloneMoveMode ? "Move" : "Clone")}
                                                </button>
                                                <button
                                                  onClick={() => setCloningEdition(null)}
                                                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded font-bold"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                          {cloneError && (
                                            <p className="mt-2 text-sm text-red-400">{cloneError}</p>
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
