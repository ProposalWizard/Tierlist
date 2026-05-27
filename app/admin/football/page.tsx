"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── Types matching Wikidata responses ── */

interface Player {
  id: string;
  name: string;
  nationality: string;
  position: string;
  dob: string;
  image: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface CareerEntry {
  team: string;
  teamId: string;
  startDate: string | null;
  endDate: string | null;
}

interface Club {
  id: string;
  name: string;
  country: string;
  league: string | null;
  image: string | null;
}

/* ── Popular clubs (Wikidata IDs) ── */
const POPULAR_CLUBS = [
  { id: "Q9141", name: "Manchester United" },
  { id: "Q18656", name: "Arsenal" },
  { id: "Q9616", name: "Liverpool" },
  { id: "Q9609", name: "Chelsea" },
  { id: "Q50602", name: "Manchester City" },
  { id: "Q19794", name: "Tottenham" },
  { id: "Q8682", name: "Real Madrid" },
  { id: "Q7156", name: "Barcelona" },
  { id: "Q8687", name: "Bayern Munich" },
  { id: "Q3400", name: "Juventus" },
  { id: "Q3740", name: "Inter Milan" },
  { id: "Q12460", name: "AC Milan" },
  { id: "Q483020", name: "PSG" },
  { id: "Q8682", name: "Real Madrid" },
  { id: "Q12303", name: "Borussia Dortmund" },
];
// Remove duplicate
const POPULAR = POPULAR_CLUBS.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

function Img({ src, alt, size = 40 }: { src?: string | null; alt: string; size?: number }) {
  if (!src) return <div className="rounded-full bg-gray-800 shrink-0" style={{ width: size, height: size }} />;
  return (
    <Image src={src} alt={alt} width={size} height={size}
      className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} unoptimized />
  );
}

function posGroup(pos: string): string {
  const p = pos.toLowerCase();
  if (p.includes("keeper") || p.includes("goalk")) return "Goalkeepers";
  if (p.includes("back") || p.includes("defen")) return "Defenders";
  if (p.includes("mid")) return "Midfielders";
  if (p.includes("forw") || p.includes("strik") || p.includes("wing") || p.includes("attack")) return "Forwards";
  return "Other";
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

export default function FootballDataPage() {
  const [view, setView] = useState<"home" | "squad" | "player">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchType, setSearchType] = useState<"player" | "club">("player");
  const [searchQuery, setSearchQuery] = useState("");

  // Results
  const [playerResults, setPlayerResults] = useState<Player[]>([]);
  const [clubResults, setClubResults] = useState<Club[]>([]);

  // Squad view
  const [squadClub, setSquadClub] = useState<Club | null>(null);
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Player detail
  const [playerProfile, setPlayerProfile] = useState<Player | null>(null);
  const [playerCareer, setPlayerCareer] = useState<CareerEntry[]>([]);

  /* ── API calls ── */

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setPlayerResults([]);
    setClubResults([]);

    try {
      if (searchType === "player") {
        const res = await fetch(`/api/admin/football/players?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setPlayerResults(json.players ?? []);
      } else {
        const res = await fetch(`/api/admin/football/leagues?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setClubResults(json.clubs ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
    setLoading(false);
  };

  const loadSquad = async (clubId: string, clubName: string, history = false) => {
    setView("squad");
    setShowHistory(history);
    setSquadPlayers([]);
    setSquadClub({ id: clubId, name: clubName, country: "", league: null, image: null });
    setLoading(true);
    setError(null);

    try {
      const url = `/api/admin/football/teams?club=${clubId}${history ? "&history=true" : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSquadClub(json.club);
      setSquadPlayers(json.players ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load squad");
    }
    setLoading(false);
  };

  const loadPlayer = async (playerId: string) => {
    setView("player");
    setPlayerProfile(null);
    setPlayerCareer([]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/football/players?player=${playerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPlayerProfile(json.player);
      setPlayerCareer(json.career ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load player");
    }
    setLoading(false);
  };

  /* ── Breadcrumb ── */
  const crumbs = (
    <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
      <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
      <span>/</span>
      <button onClick={() => { setView("home"); setSquadClub(null); setPlayerProfile(null); }}
        className={`transition-colors ${view === "home" ? "text-white font-bold" : "hover:text-white"}`}>
        Football Data
      </button>
      {view === "squad" && squadClub && (
        <>
          <span>/</span>
          <span className="text-white font-bold">{squadClub.name}</span>
        </>
      )}
      {view === "player" && playerProfile && (
        <>
          {squadClub && (
            <>
              <span>/</span>
              <button onClick={() => setView("squad")} className="hover:text-white transition-colors">
                {squadClub.name}
              </button>
            </>
          )}
          <span>/</span>
          <span className="text-white font-bold">{playerProfile.name}</span>
        </>
      )}
    </div>
  );

  /* ── Group squad by position ── */
  const grouped: Record<string, Player[]> = {};
  for (const p of squadPlayers) {
    const g = posGroup(p.position);
    (grouped[g] ??= []).push(p);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {crumbs}

        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</div>
        )}

        {/* ════════ HOME ════════ */}
        {view === "home" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">Football Data</h1>
              <p className="mt-1 text-sm text-gray-500">
                Search players and clubs via Wikidata. Full career histories, nationalities, positions — free and unlimited.
              </p>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="flex gap-2">
                <select value={searchType} onChange={(e) => setSearchType(e.target.value as "player" | "club")}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-indigo-600 focus:outline-none">
                  <option value="player">Player</option>
                  <option value="club">Club</option>
                </select>
                <input type="text" placeholder={`Search ${searchType}s...`}
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none" />
                <button onClick={handleSearch} disabled={loading}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                  {loading ? "..." : "Search"}
                </button>
              </div>
            </div>

            {/* Player search results */}
            {playerResults.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-xs font-bold uppercase text-gray-500">Players ({playerResults.length})</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {playerResults.map((p) => (
                    <button key={p.id} onClick={() => loadPlayer(p.id)}
                      className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                      <Img src={p.image} alt={p.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{p.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {p.position && <span>{p.position}</span>}
                          {p.nationality && <span>· {p.nationality}</span>}
                          {p.dob && <span>· {calcAge(p.dob)}y</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Club search results */}
            {clubResults.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-xs font-bold uppercase text-gray-500">Clubs ({clubResults.length})</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {clubResults.map((c) => (
                    <button key={c.id} onClick={() => loadSquad(c.id, c.name)}
                      className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                      <Img src={c.image} alt={c.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{c.name}</p>
                        <p className="text-xs text-gray-500">
                          {c.country}{c.league ? ` · ${c.league}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular clubs */}
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase text-gray-500">Popular Clubs</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((c) => (
                  <button key={c.id} onClick={() => loadSquad(c.id, c.name)}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:border-indigo-600 hover:bg-gray-800">
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ════════ SQUAD ════════ */}
        {view === "squad" && squadClub && (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Img src={squadClub.image} alt={squadClub.name} size={48} />
                <div>
                  <h1 className="text-2xl font-black">{squadClub.name}</h1>
                  <p className="text-sm text-gray-500">
                    {squadClub.country}{squadClub.league ? ` · ${squadClub.league}` : ""}
                    {" · "}{squadPlayers.length} players
                  </p>
                </div>
              </div>
              <button
                onClick={() => loadSquad(squadClub.id, squadClub.name, !showHistory)}
                className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
                  showHistory
                    ? "border-amber-700 bg-amber-900/30 text-amber-300"
                    : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
                }`}
              >
                {showHistory ? "Showing All-Time" : "Show All-Time"}
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading{showHistory ? " all-time players" : " current squad"}...</div>
            ) : squadPlayers.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No players found. Try &quot;Show All-Time&quot; for historical data.</div>
            ) : showHistory ? (
              /* All-time: flat list sorted by date */
              <div className="space-y-1">
                {squadPlayers.map((p, i) => (
                  <button key={`${p.id}-${i}`} onClick={() => loadPlayer(p.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-left transition-colors hover:border-indigo-600">
                    <Img src={p.image} alt={p.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">{p.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {p.position && <span>{p.position}</span>}
                        {p.nationality && <span>· {p.nationality}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-gray-500">
                      {p.startDate && <span>{formatDate(p.startDate)}</span>}
                      {(p.startDate || p.endDate) && <span> — </span>}
                      {p.endDate ? <span>{formatDate(p.endDate)}</span> : p.startDate ? <span className="text-green-400">Present</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Current squad: grouped by position */
              Object.entries(grouped).map(([group, players]) => (
                <div key={group} className="mb-6">
                  <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">{group} ({players.length})</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map((p) => (
                      <button key={p.id} onClick={() => loadPlayer(p.id)}
                        className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                        <Img src={p.image} alt={p.name} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {p.position && <span>{p.position}</span>}
                            {p.nationality && <span>· {p.nationality}</span>}
                            {p.dob && <span>· {calcAge(p.dob)}y</span>}
                          </div>
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
            ) : !playerProfile ? (
              <div className="py-12 text-center text-gray-500">Player not found.</div>
            ) : (
              <>
                {/* Profile card */}
                <div className="mb-6 flex items-start gap-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
                  <Img src={playerProfile.image} alt={playerProfile.name} size={80} />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-black">{playerProfile.name}</h1>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                      {playerProfile.position && <span>{playerProfile.position}</span>}
                      {playerProfile.nationality && <span>{playerProfile.nationality}</span>}
                      {playerProfile.dob && (
                        <span>{playerProfile.dob} ({calcAge(playerProfile.dob)} years old)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Career */}
                <div>
                  <h2 className="mb-3 text-sm font-bold uppercase text-gray-400">
                    Career ({playerCareer.length} clubs)
                  </h2>
                  {playerCareer.length === 0 ? (
                    <p className="py-8 text-center text-gray-500">No career data found.</p>
                  ) : (
                    <div className="space-y-1">
                      {playerCareer.map((c, i) => (
                        <div key={`${c.teamId}-${i}`}
                          className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <button onClick={() => loadSquad(c.teamId, c.team)}
                              className="font-bold text-white hover:text-indigo-400 truncate block text-left">
                              {c.team}
                            </button>
                          </div>
                          <div className="shrink-0 text-right text-sm text-gray-500">
                            {c.startDate && <span>{formatDate(c.startDate)}</span>}
                            {(c.startDate || c.endDate) && <span> — </span>}
                            {c.endDate ? (
                              <span>{formatDate(c.endDate)}</span>
                            ) : c.startDate ? (
                              <span className="text-green-400 font-bold">Present</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
