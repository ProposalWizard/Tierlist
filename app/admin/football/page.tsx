"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── Types ── */

interface CompetitionResult {
  id: string;
  name: string;
  title?: string;
  countryName?: string;
  country?: string;
}

interface ClubResult {
  id: string;
  name: string;
  image?: string;
}

interface SquadPlayer {
  id: string;
  name: string;
  position: string;
  dateOfBirth: string;
  nationality: string[];
  height: string | null;
  foot: string | null;
  joinedOn: string;
  signedFrom: string | null;
  marketValue: string | null;
  imageURL?: string;
}

interface PlayerProfile {
  id: string;
  name: string;
  fullName: string;
  imageURL: string;
  dateOfBirth: string;
  placeOfBirth: { city: string; country: string } | null;
  age: number;
  height: string | null;
  citizenship: string[];
  position: { main: string; other: string[] };
  foot: string | null;
  club: { id: string; name: string; joined: string; contractExpires: string } | null;
  marketValue: string | null;
}

interface Transfer {
  id: string;
  from: { clubID: string; clubName: string };
  to: { clubID: string; clubName: string };
  date: string;
  fee: string | null;
  season: string;
}

interface PlayerStat {
  competitionID: string;
  clubID: string;
  seasonID: string;
  competitionName: string;
  appearances: string | null;
  goals: string | null;
  assists: string | null;
  yellowCards: string | null;
  redCards: string | null;
  minutesPlayed: string | null;
}

interface Achievement {
  title: string;
  count?: number | string;
  details?: string[];
}

/* ── Quick-access competitions (Transfermarkt IDs) ── */
const POPULAR = [
  { id: "GB1", name: "Premier League" },
  { id: "ES1", name: "La Liga" },
  { id: "IT1", name: "Serie A" },
  { id: "L1", name: "Bundesliga" },
  { id: "FR1", name: "Ligue 1" },
  { id: "CL", name: "Champions League" },
  { id: "PO1", name: "Primeira Liga" },
  { id: "NL1", name: "Eredivisie" },
  { id: "SC1", name: "Scottish Premiership" },
  { id: "MLS1", name: "MLS" },
];

const POSITION_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Midfield", "Attack", "Forward", "Striker"];
function posGroup(pos: string): string {
  const p = pos.toLowerCase();
  if (p.includes("keeper")) return "Goalkeepers";
  if (p.includes("back") || p.includes("defen")) return "Defenders";
  if (p.includes("mid")) return "Midfielders";
  return "Forwards";
}

function Img({ src, alt, size = 40 }: { src?: string | null; alt: string; size?: number }) {
  if (!src) return <div className={`bg-gray-800 rounded-full`} style={{ width: size, height: size }} />;
  return <Image src={src} alt={alt} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} unoptimized />;
}

export default function FootballDataPage() {
  const [view, setView] = useState<"home" | "clubs" | "squad" | "player">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchType, setSearchType] = useState<"player" | "club" | "competition">("player");
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [competitions, setCompetitions] = useState<CompetitionResult[]>([]);
  const [clubs, setClubs] = useState<ClubResult[]>([]);
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>([]);
  const [playerDetail, setPlayerDetail] = useState<{
    profile: PlayerProfile;
    transfers: { transfers: Transfer[] } | null;
    stats: { stats: PlayerStat[] } | null;
    achievements: { achievements: Achievement[] } | null;
  } | null>(null);

  // Context
  const [selectedCompetition, setSelectedCompetition] = useState<{ id: string; name: string } | null>(null);
  const [selectedClub, setSelectedClub] = useState<{ id: string; name: string } | null>(null);
  const [playerFilter, setPlayerFilter] = useState("");

  /* ── Helpers ── */
  const api = async (url: string) => {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  };

  /* ── Actions ── */
  const loadCompetitionClubs = async (compId: string, compName: string) => {
    setSelectedCompetition({ id: compId, name: compName });
    setSelectedClub(null);
    setView("clubs");
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/api/admin/football/teams?competition=${compId}`);
      setClubs(data.clubs ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  const loadClubSquad = async (clubId: string, clubName: string) => {
    setSelectedClub({ id: clubId, name: clubName });
    setView("squad");
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/api/admin/football/players?club=${clubId}`);
      setSquadPlayers(data.players ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  const loadPlayerDetail = async (playerId: string) => {
    setView("player");
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/api/admin/football/players?player=${playerId}&detail=full`);
      setPlayerDetail(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (searchType === "player") {
        const data = await api(`/api/admin/football/players?q=${encodeURIComponent(searchQuery)}`);
        const results = data.results ?? [];
        if (results.length === 1) {
          await loadPlayerDetail(results[0].id);
          return;
        }
        setCompetitions([]);
        setClubs([]);
        setSquadPlayers(results.map((r: Record<string, unknown>) => ({
          id: r.id,
          name: r.name ?? r.playerName,
          position: (r.position as string) ?? "",
          dateOfBirth: (r.dateOfBirth as string) ?? "",
          nationality: Array.isArray(r.nationality) ? r.nationality : [],
          height: null,
          foot: null,
          joinedOn: "",
          signedFrom: null,
          marketValue: (r.marketValue as string) ?? null,
          imageURL: null,
        })));
        setView("squad");
        setSelectedClub({ id: "", name: `Search: "${searchQuery}"` });
        setSelectedCompetition(null);
      } else if (searchType === "club") {
        const data = await api(`/api/admin/football/teams?q=${encodeURIComponent(searchQuery)}`);
        setClubs(data.clubs ?? []);
        setView("clubs");
        setSelectedCompetition({ id: "", name: `Search: "${searchQuery}"` });
      } else {
        const data = await api(`/api/admin/football/leagues?q=${encodeURIComponent(searchQuery)}`);
        setCompetitions(data.results ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
    setLoading(false);
  };

  const filteredSquad = useMemo(() => {
    if (!playerFilter.trim()) return squadPlayers;
    const q = playerFilter.toLowerCase();
    return squadPlayers.filter((p) => p.name.toLowerCase().includes(q));
  }, [squadPlayers, playerFilter]);

  const groupedSquad = useMemo(() => {
    const groups: Record<string, SquadPlayer[]> = {};
    for (const p of filteredSquad) {
      const g = posGroup(p.position);
      (groups[g] ??= []).push(p);
    }
    return groups;
  }, [filteredSquad]);

  /* ── Breadcrumb ── */
  const crumbs = (
    <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
      <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
      <span>/</span>
      <button onClick={() => { setView("home"); setSelectedCompetition(null); setSelectedClub(null); setPlayerDetail(null); }}
        className={`transition-colors ${view === "home" ? "text-white font-bold" : "hover:text-white"}`}>
        Football Data
      </button>
      {selectedCompetition && (
        <>
          <span>/</span>
          <button onClick={() => { setView("clubs"); setSelectedClub(null); setPlayerDetail(null); }}
            className={`transition-colors ${view === "clubs" ? "text-white font-bold" : "hover:text-white"}`}>
            {selectedCompetition.name}
          </button>
        </>
      )}
      {selectedClub && (
        <>
          <span>/</span>
          <button onClick={() => { setView("squad"); setPlayerDetail(null); }}
            className={`transition-colors ${view === "squad" ? "text-white font-bold" : "hover:text-white"}`}>
            {selectedClub.name}
          </button>
        </>
      )}
      {view === "player" && playerDetail && (
        <>
          <span>/</span>
          <span className="text-white font-bold">{playerDetail.profile.name}</span>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {crumbs}

        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ════════ HOME ════════ */}
        {view === "home" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">Football Data</h1>
              <p className="mt-1 text-sm text-gray-500">
                Browse players, clubs, and competitions from Transfermarkt. Full career histories, transfers, and stats.
              </p>
            </div>

            {/* Search bar */}
            <div className="mb-6 flex gap-2">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as "player" | "club" | "competition")}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-indigo-600 focus:outline-none"
              >
                <option value="player">Player</option>
                <option value="club">Club</option>
                <option value="competition">Competition</option>
              </select>
              <input
                type="text"
                placeholder={`Search ${searchType}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? "..." : "Search"}
              </button>
            </div>

            {/* Popular competitions */}
            <div className="mb-6">
              <h2 className="mb-3 text-xs font-bold uppercase text-gray-500">Popular Leagues</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadCompetitionClubs(c.id, c.name)}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:border-indigo-600 hover:bg-gray-800"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Competition search results */}
            {competitions.length > 0 && (
              <div className="mt-4">
                <h2 className="mb-3 text-xs font-bold uppercase text-gray-500">Competition Results</h2>
                <div className="space-y-1 rounded-xl border border-gray-800 overflow-hidden">
                  {competitions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => loadCompetitionClubs(c.id, c.name || c.title || c.id)}
                      className="flex w-full items-center gap-3 border-b border-gray-800 px-4 py-3 text-left transition-colors hover:bg-gray-900 last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-white">{c.name || c.title}</p>
                        {(c.countryName || c.country) && (
                          <p className="text-xs text-gray-500">{c.countryName || c.country}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">{c.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════ CLUBS ════════ */}
        {view === "clubs" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">{selectedCompetition?.name}</h1>
              <p className="text-sm text-gray-500">{clubs.length} clubs</p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading clubs...</div>
            ) : clubs.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No clubs found.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clubs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadClubSquad(c.id, c.name)}
                    className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50"
                  >
                    <Img src={c.image} alt={c.name} size={40} />
                    <p className="font-bold text-white truncate flex-1">{c.name}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════ SQUAD ════════ */}
        {view === "squad" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">{selectedClub?.name}</h1>
              <p className="text-sm text-gray-500">{squadPlayers.length} players</p>
            </div>

            <input
              type="text"
              placeholder="Filter players..."
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
            />

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading squad...</div>
            ) : Object.keys(groupedSquad).length === 0 ? (
              <div className="py-12 text-center text-gray-500">No players found.</div>
            ) : (
              Object.entries(groupedSquad).map(([group, players]) => (
                <div key={group} className="mb-6">
                  <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">
                    {group} ({players.length})
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => loadPlayerDetail(p.id)}
                        className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50"
                      >
                        <Img src={p.imageURL} alt={p.name} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{p.position}</span>
                            {p.nationality?.length > 0 && <span>· {p.nationality[0]}</span>}
                          </div>
                          {p.marketValue && (
                            <p className="text-xs font-bold text-green-400">{p.marketValue}</p>
                          )}
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
            ) : !playerDetail ? (
              <div className="py-12 text-center text-gray-500">Player not found.</div>
            ) : (
              <PlayerDetailView
                data={playerDetail}
                onClubClick={(clubId, clubName) => loadClubSquad(clubId, clubName)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Player Detail Component ── */

function PlayerDetailView({
  data,
  onClubClick,
}: {
  data: {
    profile: PlayerProfile;
    transfers: { transfers: Transfer[] } | null;
    stats: { stats: PlayerStat[] } | null;
    achievements: { achievements: Achievement[] } | null;
  };
  onClubClick: (id: string, name: string) => void;
}) {
  const { profile, transfers, stats, achievements } = data;
  const [tab, setTab] = useState<"career" | "stats" | "trophies">("career");

  const transferList = transfers?.transfers ?? [];
  const statList = stats?.stats ?? [];
  const achievementList = achievements?.achievements ?? [];

  // Build career clubs from transfers
  const careerClubs = useMemo(() => {
    const clubs: { id: string; name: string; from: string; to: string; fee: string | null }[] = [];
    for (const t of transferList) {
      clubs.push({
        id: t.to.clubID,
        name: t.to.clubName,
        from: t.date,
        to: "",
        fee: t.fee,
      });
    }
    return clubs;
  }, [transferList]);

  // Group stats by season
  const statsBySeason = useMemo(() => {
    const map = new Map<string, PlayerStat[]>();
    for (const s of statList) {
      const key = s.seasonID;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [statList]);

  return (
    <div>
      {/* Header card */}
      <div className="mb-6 flex items-start gap-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <Img src={profile.imageURL} alt={profile.name} size={80} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black">{profile.name}</h1>
          {profile.fullName !== profile.name && (
            <p className="text-sm text-gray-500">{profile.fullName}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
            <span>{profile.position?.main}</span>
            {profile.age && <span>{profile.age} years old</span>}
            {profile.citizenship?.length > 0 && <span>{profile.citizenship.join(", ")}</span>}
            {profile.height && <span>{profile.height}</span>}
            {profile.foot && <span>{profile.foot} foot</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profile.club && (
              <button
                onClick={() => onClubClick(profile.club!.id, profile.club!.name)}
                className="font-bold text-indigo-400 hover:text-indigo-300"
              >
                {profile.club.name}
              </button>
            )}
            {profile.marketValue && (
              <span className="font-bold text-green-400">{profile.marketValue}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
        {(["career", "stats", "trophies"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition-colors ${
              tab === t
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "career" ? `Career (${transferList.length})` : t === "stats" ? `Stats (${statsBySeason.length})` : `Trophies (${achievementList.length})`}
          </button>
        ))}
      </div>

      {/* Career / Transfers */}
      {tab === "career" && (
        <div className="space-y-1">
          {transferList.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No transfer history found.</p>
          ) : (
            transferList.map((t, i) => (
              <div
                key={`${t.id}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => onClubClick(t.from.clubID, t.from.clubName)}
                      className="font-bold text-white hover:text-indigo-400 truncate"
                    >
                      {t.from.clubName}
                    </button>
                    <span className="text-gray-600">→</span>
                    <button
                      onClick={() => onClubClick(t.to.clubID, t.to.clubName)}
                      className="font-bold text-white hover:text-indigo-400 truncate"
                    >
                      {t.to.clubName}
                    </button>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{t.date}</span>
                    <span>{t.season}</span>
                  </div>
                </div>
                {t.fee && (
                  <span className={`shrink-0 text-sm font-bold ${
                    t.fee.toLowerCase().includes("loan") ? "text-amber-400" :
                    t.fee === "free transfer" || t.fee === "Free transfer" ? "text-gray-400" :
                    "text-green-400"
                  }`}>
                    {t.fee}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats */}
      {tab === "stats" && (
        <div className="space-y-4">
          {statsBySeason.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No stats found.</p>
          ) : (
            statsBySeason.map(([season, seasonStats]) => (
              <div key={season}>
                <h3 className="mb-2 text-sm font-bold text-gray-400">{season}</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900 text-xs text-gray-500">
                        <th className="px-3 py-2 text-left font-bold">Competition</th>
                        <th className="px-3 py-2 text-center font-bold">Apps</th>
                        <th className="px-3 py-2 text-center font-bold">Goals</th>
                        <th className="px-3 py-2 text-center font-bold">Assists</th>
                        <th className="px-3 py-2 text-center font-bold">Mins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasonStats.map((s, i) => (
                        <tr key={i} className="border-b border-gray-800/50 last:border-0">
                          <td className="px-3 py-2 text-white">{s.competitionName}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{s.appearances ?? "-"}</td>
                          <td className="px-3 py-2 text-center font-bold text-green-400">{s.goals ?? "-"}</td>
                          <td className="px-3 py-2 text-center text-blue-400">{s.assists ?? "-"}</td>
                          <td className="px-3 py-2 text-center text-gray-500 font-mono text-xs">{s.minutesPlayed ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Trophies */}
      {tab === "trophies" && (
        <div className="space-y-2">
          {achievementList.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No trophies found.</p>
          ) : (
            achievementList.map((a, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white">{a.title}</p>
                  {a.count && (
                    <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-xs font-bold text-amber-400">
                      x{a.count}
                    </span>
                  )}
                </div>
                {a.details && a.details.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">{a.details.join(", ")}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
