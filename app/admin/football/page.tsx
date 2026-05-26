"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── Quick-access leagues (API-Football IDs) ── */
const POPULAR = [
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 135, name: "Serie A" },
  { id: 78, name: "Bundesliga" },
  { id: 61, name: "Ligue 1" },
  { id: 2, name: "Champions League" },
  { id: 94, name: "Primeira Liga" },
  { id: 88, name: "Eredivisie" },
  { id: 203, name: "Super Lig" },
  { id: 253, name: "MLS" },
  { id: 40, name: "Championship" },
  { id: 3, name: "Europa League" },
];

function Img({ src, alt, size = 40 }: { src?: string | null; alt: string; size?: number }) {
  if (!src) return <div className="rounded-full bg-gray-800" style={{ width: size, height: size }} />;
  return <Image src={src} alt={alt} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} unoptimized />;
}

function posGroup(pos: string): string {
  const p = pos.toLowerCase();
  if (p.includes("keeper")) return "Goalkeepers";
  if (p.includes("defender")) return "Defenders";
  if (p.includes("midfielder")) return "Midfielders";
  return "Forwards";
}

export default function FootballDataPage() {
  const [view, setView] = useState<"home" | "clubs" | "squad" | "player">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);

  // Data
  const [leagues, setLeagues] = useState<Record<string, unknown>[]>([]);
  const [teams, setTeams] = useState<Record<string, unknown>[]>([]);
  const [squad, setSquad] = useState<Record<string, unknown>[]>([]);
  const [playerData, setPlayerData] = useState<Record<string, unknown> | null>(null);
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);

  // Context
  const [selectedLeague, setSelectedLeague] = useState<{ id: number; name: string } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ id: number; name: string; logo: string } | null>(null);
  const [season, setSeason] = useState("2024");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");

  /* ── Load leagues on mount ── */
  const loadLeagues = async () => {
    if (leagues.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/football/leagues");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLeagues(json.leagues ?? []);
      setRequestCount((c) => c + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load leagues");
    }
    setLoading(false);
  };

  useEffect(() => { loadLeagues(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load teams for a league ── */
  const loadTeams = async (leagueId: number, leagueName: string) => {
    setSelectedLeague({ id: leagueId, name: leagueName });
    setSelectedTeam(null);
    setPlayerData(null);
    setView("clubs");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/teams?league=${leagueId}&season=${season}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTeams(json.teams ?? []);
      setRequestCount((c) => c + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  /* ── Load squad ── */
  const loadSquad = async (teamId: number, teamName: string, logo: string) => {
    setSelectedTeam({ id: teamId, name: teamName, logo });
    setPlayerData(null);
    setView("squad");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/players?team=${teamId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const players = json.squad?.[0]?.players ?? [];
      setSquad(players);
      setRequestCount((c) => c + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  /* ── Load player detail ── */
  const loadPlayer = async (playerId: number) => {
    setView("player");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/players?player=${playerId}&detail=full&season=${season}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPlayerData(json);
      setRequestCount((c) => c + 4); // career + transfers + trophies + stats
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  /* ── Search players ── */
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/players?q=${encodeURIComponent(searchQuery)}&season=${season}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSearchResults(json.players ?? []);
      setRequestCount((c) => c + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
    setLoading(false);
  };

  /* ── Filtered data ── */
  const filteredLeagues = useMemo(() => {
    if (!leagueSearch.trim()) return [];
    const q = leagueSearch.toLowerCase();
    return leagues.filter((l) => {
      const lg = l.league as Record<string, unknown> | undefined;
      const co = l.country as Record<string, unknown> | undefined;
      return (
        ((lg?.name as string) ?? "").toLowerCase().includes(q) ||
        ((co?.name as string) ?? "").toLowerCase().includes(q)
      );
    });
  }, [leagues, leagueSearch]);

  const groupedSquad = useMemo(() => {
    let filtered = squad;
    if (playerFilter.trim()) {
      const q = playerFilter.toLowerCase();
      filtered = squad.filter((p) => ((p.name as string) ?? "").toLowerCase().includes(q));
    }
    const groups: Record<string, Record<string, unknown>[]> = {};
    for (const p of filtered) {
      const g = posGroup((p.position as string) ?? "");
      (groups[g] ??= []).push(p);
    }
    return groups;
  }, [squad, playerFilter]);

  /* ── Career data from player detail ── */
  const career = (playerData?.career as Record<string, unknown>[]) ?? [];
  const transfers = ((playerData?.transfers as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.transfers as Record<string, unknown>[] ?? [];
  const trophies = (playerData?.trophies as Record<string, unknown>[]) ?? [];
  const playerStats = (playerData?.stats as Record<string, unknown>[]) ?? [];
  const playerInfo = playerStats[0] as Record<string, unknown> | undefined;

  /* ── Breadcrumb ── */
  const crumbs = (
    <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
      <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
      <span>/</span>
      <button onClick={() => { setView("home"); setSelectedLeague(null); setSelectedTeam(null); setPlayerData(null); setSearchResults([]); }}
        className={`transition-colors ${view === "home" ? "text-white font-bold" : "hover:text-white"}`}>
        Football Data
      </button>
      {selectedLeague && (
        <>
          <span>/</span>
          <button onClick={() => { setView("clubs"); setSelectedTeam(null); setPlayerData(null); }}
            className={`transition-colors ${view === "clubs" ? "text-white font-bold" : "hover:text-white"}`}>
            {selectedLeague.name}
          </button>
        </>
      )}
      {selectedTeam && (
        <>
          <span>/</span>
          <button onClick={() => { setView("squad"); setPlayerData(null); }}
            className={`transition-colors ${view === "squad" ? "text-white font-bold" : "hover:text-white"}`}>
            {selectedTeam.name}
          </button>
        </>
      )}
      {view === "player" && playerInfo && (
        <>
          <span>/</span>
          <span className="text-white font-bold">{(playerInfo.player as Record<string, unknown>)?.name as string}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {crumbs}

        {/* Request counter */}
        <div className="mb-4 flex items-center gap-3">
          {error && (
            <div className="flex-1 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <span className="ml-auto shrink-0 rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-gray-400">
            ~{requestCount}/100 requests used
          </span>
        </div>

        {/* ════════ HOME ════════ */}
        {view === "home" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">Football Data</h1>
              <p className="mt-1 text-sm text-gray-500">
                Browse players, clubs, and leagues from API-Football. 100 free requests per day.
              </p>
            </div>

            {/* Player search */}
            <div className="mb-6">
              <h2 className="mb-2 text-xs font-bold uppercase text-gray-500">Search Players</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search player name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
                />
                <button onClick={handleSearch} disabled={loading}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                  {loading ? "..." : "Search"}
                </button>
              </div>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-2 text-xs font-bold uppercase text-gray-500">
                  Results ({searchResults.length})
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.map((item) => {
                    const p = item.player as Record<string, unknown>;
                    const stats = (item.statistics as Record<string, unknown>[]) ?? [];
                    const team = stats[0]?.team as Record<string, unknown> | undefined;
                    return (
                      <button
                        key={p.id as number}
                        onClick={() => loadPlayer(p.id as number)}
                        className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50"
                      >
                        <Img src={p.photo as string} alt={p.name as string} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">{p.name as string}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {team && <span>{team.name as string}</span>}
                            {p.nationality && <span>· {p.nationality as string}</span>}
                            {p.age && <span>· {p.age as number}y</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Popular leagues */}
            <div className="mb-6">
              <h2 className="mb-2 text-xs font-bold uppercase text-gray-500">Popular Leagues</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((l) => (
                  <button key={l.id} onClick={() => loadTeams(l.id, l.name)}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:border-indigo-600 hover:bg-gray-800">
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            {/* League search */}
            <div className="mb-4">
              <h2 className="mb-2 text-xs font-bold uppercase text-gray-500">Search All Leagues</h2>
              <input
                type="text"
                placeholder="Type to filter leagues..."
                value={leagueSearch}
                onChange={(e) => setLeagueSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {loading && leagues.length === 0 && (
              <div className="py-12 text-center text-gray-500">Loading leagues...</div>
            )}

            {filteredLeagues.length > 0 && (
              <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-gray-800">
                {filteredLeagues.slice(0, 50).map((l) => {
                  const lg = l.league as Record<string, unknown>;
                  const co = l.country as Record<string, unknown>;
                  return (
                    <button
                      key={lg.id as number}
                      onClick={() => loadTeams(lg.id as number, lg.name as string)}
                      className="flex w-full items-center gap-3 border-b border-gray-800 px-4 py-3 text-left transition-colors hover:bg-gray-900 last:border-0"
                    >
                      {lg.logo && <Img src={lg.logo as string} alt="" size={24} />}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{lg.name as string}</p>
                        <p className="text-xs text-gray-500">{co?.name as string} · {lg.type as string}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Season selector */}
            <div className="mt-4 flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500">Season:</label>
              <select value={season} onChange={(e) => setSeason(e.target.value)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-indigo-600 focus:outline-none">
                {[2024, 2023, 2022, 2021, 2020].map((y) => (
                  <option key={y} value={String(y)}>{y}/{y + 1}</option>
                ))}
              </select>
              <span className="text-xs text-gray-600">(Free plan: 2022-2024)</span>
            </div>
          </>
        )}

        {/* ════════ CLUBS ════════ */}
        {view === "clubs" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">{selectedLeague?.name}</h1>
              <p className="text-sm text-gray-500">{season}/{Number(season) + 1} · {teams.length} teams</p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading teams...</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((t) => {
                  const team = t.team as Record<string, unknown>;
                  const venue = t.venue as Record<string, unknown> | undefined;
                  return (
                    <button key={team.id as number}
                      onClick={() => loadSquad(team.id as number, team.name as string, team.logo as string)}
                      className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                      <Img src={team.logo as string} alt={team.name as string} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{team.name as string}</p>
                        <p className="text-xs text-gray-500">
                          {team.country as string}
                          {team.founded ? ` · Est. ${team.founded}` : ""}
                        </p>
                        {venue?.name && (
                          <p className="text-xs text-gray-600 truncate">
                            {venue.name as string}
                            {venue.capacity ? ` (${(venue.capacity as number).toLocaleString()})` : ""}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ════════ SQUAD ════════ */}
        {view === "squad" && (
          <>
            <div className="mb-6 flex items-center gap-3">
              {selectedTeam?.logo && <Img src={selectedTeam.logo} alt="" size={40} />}
              <div>
                <h1 className="text-2xl font-black">{selectedTeam?.name}</h1>
                <p className="text-sm text-gray-500">{squad.length} players</p>
              </div>
            </div>

            <input type="text" placeholder="Filter players..."
              value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none" />

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading squad...</div>
            ) : (
              Object.entries(groupedSquad).map(([group, players]) => (
                <div key={group} className="mb-6">
                  <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">{group} ({players.length})</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map((p) => (
                      <button key={p.id as number}
                        onClick={() => loadPlayer(p.id as number)}
                        className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                        <Img src={p.photo as string} alt={p.name as string} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">
                            {p.number != null && <span className="text-gray-600 mr-1">#{p.number as number}</span>}
                            {p.name as string}
                          </p>
                          <p className="text-xs text-gray-500">{p.position as string} · {p.age as number}y</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ════════ PLAYER DETAIL ════════ */}
        {view === "player" && (
          <>
            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading player...</div>
            ) : !playerInfo ? (
              <div className="py-12 text-center text-gray-500">Player not found.</div>
            ) : (
              <PlayerDetail
                info={playerInfo}
                career={career}
                transfers={transfers}
                trophies={trophies}
                onTeamClick={(id, name, logo) => loadSquad(id, name, logo)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Player Detail ── */

function PlayerDetail({
  info,
  career,
  transfers,
  trophies,
  onTeamClick,
}: {
  info: Record<string, unknown>;
  career: Record<string, unknown>[];
  transfers: Record<string, unknown>[];
  trophies: Record<string, unknown>[];
  onTeamClick: (id: number, name: string, logo: string) => void;
}) {
  const [tab, setTab] = useState<"career" | "transfers" | "trophies">("career");
  const player = info.player as Record<string, unknown>;
  const stats = (info.statistics as Record<string, unknown>[]) ?? [];
  const currentTeam = stats[0]?.team as Record<string, unknown> | undefined;
  const currentStats = stats[0] as Record<string, unknown> | undefined;
  const games = currentStats?.games as Record<string, unknown> | undefined;
  const goals = currentStats?.goals as Record<string, unknown> | undefined;
  const birth = player.birth as Record<string, unknown> | undefined;

  return (
    <div>
      {/* Header card */}
      <div className="mb-6 flex items-start gap-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <Img src={player.photo as string} alt={player.name as string} size={80} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black">{player.name as string}</h1>
          <p className="text-sm text-gray-500">
            {(player.firstname as string)} {(player.lastname as string)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
            {games?.position && <span>{games.position as string}</span>}
            {player.age && <span>{player.age as number} years old</span>}
            {player.nationality && <span>{player.nationality as string}</span>}
            {player.height && <span>{player.height as string}</span>}
            {player.weight && <span>{player.weight as string}</span>}
            {birth?.date && <span>Born: {birth.date as string}</span>}
            {birth?.country && <span>({birth.country as string})</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 text-sm">
            {currentTeam && (
              <button
                onClick={() => onTeamClick(currentTeam.id as number, currentTeam.name as string, currentTeam.logo as string)}
                className="font-bold text-indigo-400 hover:text-indigo-300"
              >
                {currentTeam.name as string}
              </button>
            )}
            {games?.appearences != null && (
              <span className="text-gray-400">
                <span className="font-bold text-white">{games.appearences as number}</span> apps
              </span>
            )}
            {(goals?.total as number) > 0 && (
              <span className="text-gray-400">
                <span className="font-bold text-green-400">{goals?.total as number}</span> goals
              </span>
            )}
            {(goals?.assists as number) > 0 && (
              <span className="text-gray-400">
                <span className="font-bold text-blue-400">{goals?.assists as number}</span> assists
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
        {([
          ["career", `Career (${career.length})`],
          ["transfers", `Transfers (${transfers.length})`],
          ["trophies", `Trophies (${trophies.length})`],
        ] as const).map(([key, label]) => (
          <button key={key}
            onClick={() => setTab(key as "career" | "transfers" | "trophies")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition-colors ${
              tab === key ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Career — all clubs played for */}
      {tab === "career" && (
        <div className="space-y-1">
          {career.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No career data available.</p>
          ) : (
            career.map((c, i) => {
              const team = c.team as Record<string, unknown>;
              const seasons = (c.seasons as Record<string, unknown>[]) ?? [];
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
                  <Img src={team?.logo as string} alt="" size={32} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onTeamClick(team?.id as number, team?.name as string, team?.logo as string)}
                      className="font-bold text-white hover:text-indigo-400 truncate block"
                    >
                      {team?.name as string}
                    </button>
                    <p className="text-xs text-gray-500">
                      {seasons.length > 0 && (
                        <span>
                          {seasons.map((s) => s.season as string).join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Transfers */}
      {tab === "transfers" && (
        <div className="space-y-1">
          {transfers.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No transfer history available.</p>
          ) : (
            transfers.map((t, i) => {
              const teams = t.teams as Record<string, unknown> | undefined;
              const inTeam = (teams as Record<string, unknown>)?.in as Record<string, unknown> | undefined;
              const outTeam = (teams as Record<string, unknown>)?.out as Record<string, unknown> | undefined;
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      {outTeam && (
                        <button onClick={() => onTeamClick(outTeam.id as number, outTeam.name as string, "")}
                          className="font-bold text-white hover:text-indigo-400 truncate">
                          {outTeam.name as string}
                        </button>
                      )}
                      <span className="text-gray-600">→</span>
                      {inTeam && (
                        <button onClick={() => onTeamClick(inTeam.id as number, inTeam.name as string, "")}
                          className="font-bold text-white hover:text-indigo-400 truncate">
                          {inTeam.name as string}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{t.date as string} · {t.type as string}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Trophies */}
      {tab === "trophies" && (
        <div className="space-y-1">
          {trophies.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No trophies found.</p>
          ) : (
            trophies.map((t, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
                <div>
                  <p className="font-bold text-white">{t.league as string}</p>
                  <p className="text-xs text-gray-500">{t.season as string} · {t.place as string}</p>
                </div>
                {t.country && (
                  <span className="text-xs text-gray-600">{t.country as string}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
