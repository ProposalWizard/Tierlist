"use client";

import { useState, useCallback } from "react";

/* ── Types ── */

interface ParamDef {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

interface EndpointDef {
  label: string;
  path: string;
  params: ParamDef[];
}

interface EndpointGroup {
  category: string;
  endpoints: EndpointDef[];
}

/* ── All known endpoints ── */

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    category: "Search",
    endpoints: [
      { label: "Search Players", path: "football-players-search", params: [{ name: "search", label: "Query", placeholder: "e.g. Messi", required: true }] },
      { label: "Search Teams", path: "football-teams-search", params: [{ name: "search", label: "Query", placeholder: "e.g. Arsenal", required: true }] },
      { label: "Search Leagues", path: "football-leagues-search", params: [{ name: "search", label: "Query", placeholder: "e.g. Premier League", required: true }] },
      { label: "Search Matches", path: "football-matches-search", params: [{ name: "search", label: "Query", placeholder: "e.g. Arsenal vs Chelsea", required: true }] },
      { label: "Search All", path: "football-all-search", params: [{ name: "search", label: "Query", placeholder: "e.g. Messi", required: true }] },
    ],
  },
  {
    category: "Players",
    endpoints: [
      { label: "Player Detail", path: "football-get-player-detail", params: [{ name: "playerid", label: "Player ID", placeholder: "e.g. 30981", required: true }] },
      { label: "Player Image", path: "football-get-player-image", params: [{ name: "playerid", label: "Player ID", placeholder: "e.g. 30981", required: true }] },
      { label: "Players by Team", path: "football-get-list-player", params: [{ name: "teamid", label: "Team ID", placeholder: "e.g. 8650", required: true }] },
    ],
  },
  {
    category: "Teams",
    endpoints: [
      { label: "Team Detail", path: "football-league-team", params: [{ name: "teamid", label: "Team ID", placeholder: "e.g. 8650", required: true }] },
      { label: "Team Logo", path: "football-get-team-logo", params: [{ name: "teamid", label: "Team ID", placeholder: "e.g. 8650", required: true }] },
      { label: "All Teams by League", path: "football-get-list-all-team", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "Home Teams by League", path: "football-get-list-home-team", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "Away Teams by League", path: "football-get-list-away-team", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
    ],
  },
  {
    category: "Leagues",
    endpoints: [
      { label: "Popular Leagues", path: "football-popular-leagues", params: [] },
      { label: "All Leagues", path: "football-get-all-leagues", params: [] },
      { label: "All Leagues with Countries", path: "football-get-all-leagues-countries", params: [] },
      { label: "League Detail", path: "football-get-league-detail", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "League Logo", path: "football-get-league-logo", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
    ],
  },
  {
    category: "Transfers",
    endpoints: [
      { label: "All Transfers", path: "football-get-all-transfers", params: [] },
      { label: "Top Transfers", path: "football-get-top-transfers", params: [] },
      { label: "Top Market Value", path: "football-get-top-market-value-transfers", params: [] },
      { label: "Transfers by League", path: "football-get-transfers-league", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "Team Contract Extensions", path: "football-get-team-contract-extension", params: [{ name: "teamid", label: "Team ID", placeholder: "e.g. 8650", required: true }] },
      { label: "Team Players In", path: "football-get-team-players-in", params: [{ name: "teamid", label: "Team ID", placeholder: "e.g. 8650", required: true }] },
      { label: "Team Players Out", path: "football-get-team-players-out", params: [{ name: "teamid", label: "Team ID", placeholder: "e.g. 8650", required: true }] },
    ],
  },
  {
    category: "Standings",
    endpoints: [
      { label: "Standings All", path: "football-get-standing-all", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "Standings Home", path: "football-get-standing-home", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "Standings Away", path: "football-get-standing-away", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
    ],
  },
  {
    category: "Top Players",
    endpoints: [
      { label: "Top Assists", path: "football-get-top-assists", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "Top Goals", path: "football-get-top-goals", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
      { label: "Top Rating", path: "football-get-top-rating", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
    ],
  },
  {
    category: "Fixtures / Matches",
    endpoints: [
      { label: "Livescores", path: "football-get-all-livescores", params: [] },
      { label: "Matches by Date", path: "football-get-matches-by-date", params: [{ name: "date", label: "Date", placeholder: "e.g. 20260602" }] },
      { label: "League Matches by Date", path: "football-get-league-matches-by-date", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }, { name: "date", label: "Date", placeholder: "e.g. 20260602" }] },
      { label: "All Matches by League", path: "football-get-all-matches-league", params: [{ name: "leagueid", label: "League ID", placeholder: "e.g. 47", required: true }] },
    ],
  },
  {
    category: "Match Detail",
    endpoints: [
      { label: "Match Detail", path: "football-get-event-detail", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match Score", path: "football-get-event-score", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match Status", path: "football-get-event-status", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match Highlights", path: "football-get-event-highlights", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match Location", path: "football-get-event-location", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match All Stats", path: "football-get-event-all-stats", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match 1st Half Stats", path: "football-get-event-firsthalf-stats", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match 2nd Half Stats", path: "football-get-event-secondhalf-stats", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Match Referee", path: "football-get-event-referee", params: [{ name: "eventid", label: "Event ID", required: true }] },
    ],
  },
  {
    category: "Odds",
    endpoints: [
      { label: "Odds by Event", path: "football-get-event-odds", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Odds Poll", path: "football-get-event-odds-poll", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Odds Vote Result", path: "football-get-event-odds-vote", params: [{ name: "eventid", label: "Event ID", required: true }] },
    ],
  },
  {
    category: "Lineups",
    endpoints: [
      { label: "Home Lineup", path: "football-get-event-lineup-home", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Away Lineup", path: "football-get-event-lineup-away", params: [{ name: "eventid", label: "Event ID", required: true }] },
    ],
  },
  {
    category: "Head to Head",
    endpoints: [
      { label: "H2H by Event", path: "football-get-event-head-to-head", params: [{ name: "eventid", label: "Event ID", required: true }] },
    ],
  },
  {
    category: "Rounds",
    endpoints: [
      { label: "Rounds All", path: "football-get-all-rounds", params: [{ name: "leagueid", label: "League ID", required: true }] },
      { label: "Round Detail", path: "football-get-round-detail", params: [{ name: "roundid", label: "Round ID", required: true }] },
      { label: "Rounds Players", path: "football-get-rounds-players", params: [{ name: "leagueid", label: "League ID", required: true }] },
    ],
  },
  {
    category: "Trophies",
    endpoints: [
      { label: "Trophies All Seasons", path: "football-get-trophies-all-seasons", params: [{ name: "leagueid", label: "League ID", required: true }] },
      { label: "Trophies Detail", path: "football-get-trophies-detail", params: [{ name: "leagueid", label: "League ID", required: true }] },
    ],
  },
  {
    category: "News",
    endpoints: [
      { label: "Trending News", path: "football-get-trending-news", params: [] },
      { label: "News by League", path: "football-get-news-league", params: [{ name: "leagueid", label: "League ID", required: true }] },
      { label: "News by Team", path: "football-get-news-team", params: [{ name: "teamid", label: "Team ID", required: true }] },
      { label: "News by Player", path: "football-get-news-player", params: [{ name: "playerid", label: "Player ID", required: true }] },
    ],
  },
  {
    category: "Other",
    endpoints: [
      { label: "All Countries", path: "football-get-all-countries", params: [] },
      { label: "All Seasons", path: "football-get-all-seasons", params: [] },
      { label: "Statistics by Event", path: "football-get-event-statistics", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Statistics 1st Half", path: "football-get-event-statistics-firsthalf", params: [{ name: "eventid", label: "Event ID", required: true }] },
      { label: "Statistics 2nd Half", path: "football-get-event-statistics-secondhalf", params: [{ name: "eventid", label: "Event ID", required: true }] },
    ],
  },
];

/* ── API helper ── */

async function apiCall(endpoint: string, params?: Record<string, string>): Promise<{ data: unknown; time: number; error?: string }> {
  const qp = new URLSearchParams({ endpoint });
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v.trim()) qp.set(k, v.trim());
    }
  }
  const start = performance.now();
  const res = await fetch(`/api/admin/football-api?${qp.toString()}`);
  const json = await res.json();
  const time = Math.round(performance.now() - start);
  if (json.error) {
    return { data: json.data ?? null, time, error: json.error };
  }
  return { data: json.data, time };
}

/* ── Search result types ── */

interface SearchPlayer { id: string; name: string; teamName?: string; teamId?: number }
interface SearchTeam { id: string; name: string }

type Tab = "search" | "endpoints" | "custom";

/* ── Component ── */

export default function FootballApiExplorer() {
  const [tab, setTab] = useState<Tab>("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"players" | "teams">("players");
  const [searchResults, setSearchResults] = useState<(SearchPlayer | SearchTeam)[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detail, setDetail] = useState<{ json: string; title: string; time: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Endpoint explorer state
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [selectedEndpoint, setSelectedEndpoint] = useState(0);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [epResponse, setEpResponse] = useState<string | null>(null);
  const [epTime, setEpTime] = useState<number | null>(null);
  const [epLoading, setEpLoading] = useState(false);

  // Custom endpoint state
  const [customPath, setCustomPath] = useState("");
  const [customParams, setCustomParams] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [customResponse, setCustomResponse] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState<number | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const setParam = useCallback((name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  /* ── Search handlers ── */

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError(null);
    setSearchResults([]);
    setDetail(null);
    try {
      const endpoint = searchType === "players" ? "football-players-search" : "football-teams-search";
      const result = await apiCall(endpoint, { search: searchQuery });
      if (result.error) {
        setError(result.error);
        return;
      }
      const d = result.data as { response?: { suggestions?: unknown[] } };
      const items = d?.response?.suggestions ?? d?.response ?? [];
      setSearchResults(Array.isArray(items) ? items as (SearchPlayer | SearchTeam)[] : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
    setSearchLoading(false);
  };

  const handleViewDetail = async (type: "player" | "team", id: string, name: string) => {
    setDetailLoading(true);
    setError(null);
    setDetail(null);
    try {
      const endpoint = type === "player" ? "football-get-player-detail" : "football-league-team";
      const paramKey = type === "player" ? "playerid" : "teamid";
      const result = await apiCall(endpoint, { [paramKey]: id });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDetail({ json: JSON.stringify(result.data, null, 2), title: `${name} (${type} #${id})`, time: result.time });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load detail");
    }
    setDetailLoading(false);
  };

  /* ── Endpoint explorer handler ── */

  const handleEndpointSend = async () => {
    const group = ENDPOINT_GROUPS[selectedGroup];
    const ep = group.endpoints[selectedEndpoint];
    setEpLoading(true);
    setError(null);
    setEpResponse(null);
    setEpTime(null);
    const params: Record<string, string> = {};
    for (const p of ep.params) {
      const val = paramValues[p.name]?.trim();
      if (val) params[p.name] = val;
      else if (p.required) {
        setError(`${p.label} is required`);
        setEpLoading(false);
        return;
      }
    }
    try {
      const result = await apiCall(ep.path, params);
      if (result.error) {
        setError(result.error);
        if (result.data) setEpResponse(JSON.stringify(result.data, null, 2));
        setEpTime(result.time);
      } else {
        setEpResponse(JSON.stringify(result.data, null, 2));
        setEpTime(result.time);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
    setEpLoading(false);
  };

  /* ── Custom endpoint handler ── */

  const handleCustomSend = async () => {
    if (!customPath.trim()) { setError("Enter an endpoint path"); return; }
    setCustomLoading(true);
    setError(null);
    setCustomResponse(null);
    setCustomTime(null);
    const params: Record<string, string> = {};
    for (const cp of customParams) {
      if (cp.key.trim() && cp.value.trim()) params[cp.key.trim()] = cp.value.trim();
    }
    try {
      const result = await apiCall(customPath.trim(), params);
      if (result.error) {
        setError(result.error);
        if (result.data) setCustomResponse(JSON.stringify(result.data, null, 2));
        setCustomTime(result.time);
      } else {
        setCustomResponse(JSON.stringify(result.data, null, 2));
        setCustomTime(result.time);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
    setCustomLoading(false);
  };

  /* ── Tab buttons ── */

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => { setTab(t); setError(null); }}
      className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === t ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black">Football API Explorer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Explore the RapidAPI football data. Search for players and teams, or test any endpoint.
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        {tabBtn("search", "Search")}
        {tabBtn("endpoints", "All Endpoints")}
        {tabBtn("custom", "Custom")}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Search Tab ── */}
      {tab === "search" && (
        <div>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => { setSearchType("players"); setSearchResults([]); setDetail(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${searchType === "players" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
            >
              Players
            </button>
            <button
              onClick={() => { setSearchType("teams"); setSearchResults([]); setDetail(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${searchType === "teams" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
            >
              Teams
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "players" ? "Search for a player..." : "Search for a team..."}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {searchLoading ? "..." : "Search"}
            </button>
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="mb-4 space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">{searchResults.length} results — click a row to view full detail</p>
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    handleViewDetail(searchType === "players" ? "player" : "team", item.id, item.name);
                    setTimeout(() => document.getElementById("detail-section")?.scrollIntoView({ behavior: "smooth" }), 100);
                  }}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-left hover:border-indigo-600 hover:bg-gray-800/50 transition-colors"
                >
                  <div>
                    <span className="text-sm font-bold text-white">{item.name}</span>
                    {"teamName" in item && item.teamName && (
                      <span className="ml-2 text-xs text-gray-500">{item.teamName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600">ID: {item.id}</span>
                    <span className="text-xs text-indigo-400 font-bold">View →</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Detail view */}
          <div id="detail-section">
            {detailLoading && (
              <div className="rounded-lg border border-indigo-700/50 bg-indigo-900/20 p-4 text-center">
                <p className="text-sm text-indigo-300 font-bold">Loading player detail...</p>
              </div>
            )}
            {detail && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-indigo-400">{detail.title}</span>
                  <span className="text-xs text-gray-500">{detail.time}ms</span>
                </div>
                <pre className="max-h-[600px] overflow-auto rounded-lg border border-gray-800 bg-gray-900 p-4 text-xs text-green-300 whitespace-pre-wrap break-words">
                  {detail.json}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── All Endpoints Tab ── */}
      {tab === "endpoints" && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {ENDPOINT_GROUPS.map((g, gi) => (
              <button
                key={gi}
                onClick={() => { setSelectedGroup(gi); setSelectedEndpoint(0); setParamValues({}); setEpResponse(null); setError(null); }}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${selectedGroup === gi ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                {g.category}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Endpoint</label>
            <select
              value={selectedEndpoint}
              onChange={(e) => { setSelectedEndpoint(Number(e.target.value)); setParamValues({}); setEpResponse(null); setError(null); }}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-indigo-600 focus:outline-none"
            >
              {ENDPOINT_GROUPS[selectedGroup].endpoints.map((ep, i) => (
                <option key={i} value={i}>{ep.label} — /{ep.path}</option>
              ))}
            </select>
          </div>

          {ENDPOINT_GROUPS[selectedGroup].endpoints[selectedEndpoint].params.length > 0 && (
            <div className="mb-4 space-y-3">
              {ENDPOINT_GROUPS[selectedGroup].endpoints[selectedEndpoint].params.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{p.label}</span>
                    {p.required && <span className="text-[10px] font-bold text-red-400">required</span>}
                  </div>
                  <input
                    type="text"
                    placeholder={p.placeholder}
                    value={paramValues[p.name] ?? ""}
                    onChange={(e) => setParam(p.name, e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleEndpointSend}
            disabled={epLoading}
            className="mb-6 rounded-xl bg-indigo-600 py-3 px-8 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {epLoading ? "Sending..." : "Send Request"}
          </button>

          {epResponse && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-gray-500">Response</span>
                {epTime !== null && <span className="text-xs text-gray-500">{epTime}ms</span>}
              </div>
              <pre className="max-h-[500px] overflow-auto rounded-lg border border-gray-800 bg-gray-900 p-4 text-xs text-green-300 whitespace-pre-wrap break-words">
                {epResponse}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Custom Tab ── */}
      {tab === "custom" && (
        <div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Endpoint path</label>
            <input
              type="text"
              placeholder="e.g. football-get-player-detail"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-xs font-bold uppercase text-gray-500">Query parameters</label>
            <div className="space-y-2">
              {customParams.map((cp, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="key"
                    value={cp.key}
                    onChange={(e) => {
                      const next = [...customParams];
                      next[idx] = { ...next[idx], key: e.target.value };
                      setCustomParams(next);
                    }}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="value"
                    value={cp.value}
                    onChange={(e) => {
                      const next = [...customParams];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setCustomParams(next);
                    }}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    onClick={() => setCustomParams((prev) => prev.filter((_, i) => i !== idx))}
                    className="shrink-0 text-gray-500 hover:text-red-400 text-lg px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCustomParams((prev) => [...prev, { key: "", value: "" }])}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Add parameter
            </button>
          </div>

          <button
            onClick={handleCustomSend}
            disabled={customLoading}
            className="mb-6 rounded-xl bg-indigo-600 py-3 px-8 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {customLoading ? "Sending..." : "Send Request"}
          </button>

          {customResponse && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-gray-500">Response</span>
                {customTime !== null && <span className="text-xs text-gray-500">{customTime}ms</span>}
              </div>
              <pre className="max-h-[500px] overflow-auto rounded-lg border border-gray-800 bg-gray-900 p-4 text-xs text-green-300 whitespace-pre-wrap break-words">
                {customResponse}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
