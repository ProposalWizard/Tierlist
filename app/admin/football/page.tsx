"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── Types ── */

interface League {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; flag: string | null };
  seasons: { year: number; current: boolean }[];
}

interface Team {
  team: { id: number; name: string; logo: string; country: string; founded: number | null };
  venue: { name: string | null; city: string | null; capacity: number | null };
}

interface SquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string;
  photo: string;
}

interface PlayerStats {
  player: { id: number; name: string; firstname: string; lastname: string; age: number; nationality: string; photo: string; birth: { date: string; country: string } };
  statistics: { team: { id: number; name: string }; games: { appearences: number | null; minutes: number | null; position: string }; goals: { total: number | null; assists: number | null } }[];
}

/* ── Popular leagues for quick access ── */
const POPULAR_LEAGUES = [
  { id: 39, name: "Premier League", country: "England" },
  { id: 140, name: "La Liga", country: "Spain" },
  { id: 135, name: "Serie A", country: "Italy" },
  { id: 78, name: "Bundesliga", country: "Germany" },
  { id: 61, name: "Ligue 1", country: "France" },
  { id: 2, name: "Champions League", country: "Europe" },
  { id: 94, name: "Primeira Liga", country: "Portugal" },
  { id: 88, name: "Eredivisie", country: "Netherlands" },
  { id: 203, name: "Super Lig", country: "Turkey" },
  { id: 253, name: "MLS", country: "USA" },
];

export default function FootballDataPage() {
  /* ── State ── */
  const [view, setView] = useState<"leagues" | "teams" | "players">("leagues");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedLeague, setSelectedLeague] = useState<{ id: number; name: string; country: string } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ id: number; name: string; logo: string } | null>(null);
  const [season, setSeason] = useState("2024");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");

  /* ── Fetch leagues ── */
  const loadLeagues = async () => {
    if (leagues.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/football/leagues");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLeagues(json.leagues);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load leagues");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLeagues();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fetch teams ── */
  const loadTeams = async (leagueId: number, leagueName: string, country: string) => {
    setSelectedLeague({ id: leagueId, name: leagueName, country });
    setSelectedTeam(null);
    setSquad([]);
    setPlayerStats([]);
    setView("teams");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/teams?league=${leagueId}&season=${season}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTeams(json.teams);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load teams");
    }
    setLoading(false);
  };

  /* ── Fetch players ── */
  const loadPlayers = async (teamId: number, teamName: string, logo: string) => {
    setSelectedTeam({ id: teamId, name: teamName, logo });
    setView("players");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/players?team=${teamId}&season=${season}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const squadData = json.squad?.[0]?.players ?? [];
      setSquad(squadData);
      setPlayerStats(json.stats ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load players");
    }
    setLoading(false);
  };

  /* ── Filtered data ── */
  const filteredLeagues = useMemo(() => {
    if (!leagueSearch.trim()) return leagues;
    const q = leagueSearch.toLowerCase();
    return leagues.filter(
      (l) =>
        l.league.name.toLowerCase().includes(q) ||
        l.country.name.toLowerCase().includes(q)
    );
  }, [leagues, leagueSearch]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return teams;
    const q = teamSearch.toLowerCase();
    return teams.filter((t) => t.team.name.toLowerCase().includes(q));
  }, [teams, teamSearch]);

  const statsMap = useMemo(() => {
    const m = new Map<number, PlayerStats>();
    for (const s of playerStats) m.set(s.player.id, s);
    return m;
  }, [playerStats]);

  const filteredSquad = useMemo(() => {
    if (!playerSearch.trim()) return squad;
    const q = playerSearch.toLowerCase();
    return squad.filter((p) => p.name.toLowerCase().includes(q));
  }, [squad, playerSearch]);

  /* ── Breadcrumb ── */
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
      <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
      <span>/</span>
      <button
        onClick={() => { setView("leagues"); setSelectedLeague(null); setSelectedTeam(null); }}
        className={`transition-colors ${view === "leagues" ? "text-white font-bold" : "hover:text-white"}`}
      >
        Football Data
      </button>
      {selectedLeague && (
        <>
          <span>/</span>
          <button
            onClick={() => { setView("teams"); setSelectedTeam(null); }}
            className={`transition-colors ${view === "teams" ? "text-white font-bold" : "hover:text-white"}`}
          >
            {selectedLeague.name}
          </button>
        </>
      )}
      {selectedTeam && (
        <>
          <span>/</span>
          <span className="text-white font-bold">{selectedTeam.name}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {breadcrumb}

        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ════════ LEAGUES VIEW ════════ */}
        {view === "leagues" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">Football Data</h1>
              <p className="mt-1 text-sm text-gray-500">
                Browse leagues, teams, and players from API-Football. Uses {leagues.length > 0 ? "cached" : "live"} data.
              </p>
            </div>

            {/* Quick access */}
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-bold uppercase text-gray-500">Popular Leagues</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR_LEAGUES.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => loadTeams(l.id, l.name, l.country)}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:border-indigo-600 hover:bg-gray-800"
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Search all leagues */}
            <div className="mb-4">
              <h2 className="mb-3 text-xs font-bold uppercase text-gray-500">All Leagues ({filteredLeagues.length})</h2>
              <input
                type="text"
                placeholder="Search leagues or countries..."
                value={leagueSearch}
                onChange={(e) => setLeagueSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading leagues...</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-800">
                {filteredLeagues.map((l) => (
                  <button
                    key={l.league.id}
                    onClick={() => loadTeams(l.league.id, l.league.name, l.country.name)}
                    className="flex w-full items-center gap-3 border-b border-gray-800 px-4 py-3 text-left transition-colors hover:bg-gray-900 last:border-0"
                  >
                    {l.league.logo && (
                      <Image src={l.league.logo} alt="" width={24} height={24} className="h-6 w-6 object-contain" unoptimized />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{l.league.name}</p>
                      <p className="text-xs text-gray-500">
                        {l.country.name} · {l.league.type}
                      </p>
                    </div>
                    <span className="text-xs text-gray-600">{l.league.id}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Season selector */}
            <div className="mt-4 flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500">Season:</label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-indigo-600 focus:outline-none"
              >
                {[2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map((y) => (
                  <option key={y} value={String(y)}>{y}/{y + 1}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* ════════ TEAMS VIEW ════════ */}
        {view === "teams" && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black">{selectedLeague?.name}</h1>
                <p className="text-sm text-gray-500">{selectedLeague?.country} · {season}/{Number(season) + 1} · {teams.length} teams</p>
              </div>
              <select
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  if (selectedLeague) loadTeams(selectedLeague.id, selectedLeague.name, selectedLeague.country);
                }}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-indigo-600 focus:outline-none"
              >
                {[2024, 2023, 2022, 2021, 2020].map((y) => (
                  <option key={y} value={String(y)}>{y}/{y + 1}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Search teams..."
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
            />

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading teams...</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTeams.map((t) => (
                  <button
                    key={t.team.id}
                    onClick={() => loadPlayers(t.team.id, t.team.name, t.team.logo)}
                    className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50"
                  >
                    {t.team.logo && (
                      <Image src={t.team.logo} alt="" width={40} height={40} className="h-10 w-10 object-contain" unoptimized />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">{t.team.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.team.country}
                        {t.team.founded ? ` · Est. ${t.team.founded}` : ""}
                      </p>
                      {t.venue.name && (
                        <p className="text-xs text-gray-600 truncate">
                          {t.venue.name}{t.venue.capacity ? ` (${t.venue.capacity.toLocaleString()})` : ""}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════ PLAYERS VIEW ════════ */}
        {view === "players" && (
          <>
            <div className="mb-6 flex items-center gap-3">
              {selectedTeam?.logo && (
                <Image src={selectedTeam.logo} alt="" width={40} height={40} className="h-10 w-10 object-contain" unoptimized />
              )}
              <div>
                <h1 className="text-2xl font-black">{selectedTeam?.name}</h1>
                <p className="text-sm text-gray-500">
                  {squad.length} players · {season}/{Number(season) + 1}
                </p>
              </div>
            </div>

            <input
              type="text"
              placeholder="Search players..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
            />

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading players...</div>
            ) : filteredSquad.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No players found.</div>
            ) : (
              <div className="space-y-1">
                {/* Group by position */}
                {(["Goalkeeper", "Defender", "Midfielder", "Attacker"] as const).map((pos) => {
                  const group = filteredSquad.filter((p) => p.position === pos);
                  if (group.length === 0) return null;
                  return (
                    <div key={pos} className="mb-4">
                      <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">{pos}s ({group.length})</h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {group.map((p) => {
                          const stats = statsMap.get(p.id);
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 transition-colors hover:border-gray-700"
                            >
                              {p.photo && (
                                <Image src={p.photo} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" unoptimized />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-white truncate">
                                  {p.number != null && <span className="text-gray-600 mr-1">#{p.number}</span>}
                                  {p.name}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{p.position}</span>
                                  {p.age && <span>· {p.age}y</span>}
                                  {stats?.player.nationality && (
                                    <span>· {stats.player.nationality}</span>
                                  )}
                                </div>
                                {stats?.statistics?.[0] && (
                                  <div className="mt-0.5 flex gap-3 text-xs">
                                    {stats.statistics[0].games.appearences != null && (
                                      <span className="text-gray-400">
                                        <span className="text-white font-bold">{stats.statistics[0].games.appearences}</span> apps
                                      </span>
                                    )}
                                    {stats.statistics[0].goals.total != null && stats.statistics[0].goals.total > 0 && (
                                      <span className="text-gray-400">
                                        <span className="text-green-400 font-bold">{stats.statistics[0].goals.total}</span> goals
                                      </span>
                                    )}
                                    {stats.statistics[0].goals.assists != null && stats.statistics[0].goals.assists > 0 && (
                                      <span className="text-gray-400">
                                        <span className="text-blue-400 font-bold">{stats.statistics[0].goals.assists}</span> assists
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
