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
  const [tab, setTab] = useState<"browse" | "helper">("browse");
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

  // TTT Helper
  const [club1Query, setClub1Query] = useState("");
  const [club2Query, setClub2Query] = useState("");
  const [club1Results, setClub1Results] = useState<Club[]>([]);
  const [club2Results, setClub2Results] = useState<Club[]>([]);
  const [club1Selected, setClub1Selected] = useState<Club | null>(null);
  const [club2Selected, setClub2Selected] = useState<Club | null>(null);
  const [crossResults, setCrossResults] = useState<Player[]>([]);
  const [crossClubNames, setCrossClubNames] = useState<{ club1: string; club2: string } | null>(null);
  const [crossLoading, setCrossLoading] = useState(false);
  const [club1Searching, setClub1Searching] = useState(false);
  const [club2Searching, setClub2Searching] = useState(false);

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

  /* ── TTT Helper: club search ── */
  const searchClubFor = async (slot: 1 | 2) => {
    const q = (slot === 1 ? club1Query : club2Query).trim();
    if (!q) return;
    if (slot === 1) setClub1Searching(true); else setClub2Searching(true);
    try {
      const res = await fetch(`/api/admin/football/leagues?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (slot === 1) setClub1Results(json.clubs ?? []);
      else setClub2Results(json.clubs ?? []);
    } catch {
      // silently fail
    }
    if (slot === 1) setClub1Searching(false); else setClub2Searching(false);
  };

  const selectClub = (slot: 1 | 2, club: Club) => {
    setCrossResults([]); setCrossClubNames(null);
    if (slot === 1) { setClub1Selected(club); setClub1Results([]); setClub1Query(club.name); }
    else { setClub2Selected(club); setClub2Results([]); setClub2Query(club.name); }
  };

  const selectPopularClub = (slot: 1 | 2, id: string, name: string) => {
    const club: Club = { id, name, country: "", league: null, image: null };
    setCrossResults([]); setCrossClubNames(null);
    if (slot === 1) { setClub1Selected(club); setClub1Query(name); setClub1Results([]); }
    else { setClub2Selected(club); setClub2Query(name); setClub2Results([]); }
  };

  const findCrossPlayers = async () => {
    if (!club1Selected || !club2Selected) return;
    setCrossLoading(true);
    setCrossResults([]);
    setCrossClubNames(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/crossclub?club1=${club1Selected.id}&club2=${club2Selected.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCrossResults(json.players ?? []);
      setCrossClubNames({ club1: json.club1, club2: json.club2 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cross-club search failed");
    }
    setCrossLoading(false);
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

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 w-fit">
          <button onClick={() => setTab("browse")}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === "browse" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>
            Browse
          </button>
          <button onClick={() => setTab("helper")}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === "helper" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>
            TTT Helper
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</div>
        )}

        {/* ════════ TTT HELPER ════════ */}
        {tab === "helper" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">TTT Helper</h1>
              <p className="mt-1 text-sm text-gray-500">
                Select two clubs to find every player who has played for both. Useful for building Tic Tac Toe puzzles.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              {/* Club 1 */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-gray-500">Club 1</label>
                {club1Selected ? (
                  <div className="flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-900/20 px-4 py-3">
                    <Img src={club1Selected.image} alt={club1Selected.name} size={28} />
                    <span className="font-bold text-white flex-1 truncate">{club1Selected.name}</span>
                    <button onClick={() => { setClub1Selected(null); setClub1Query(""); setCrossResults([]); setCrossClubNames(null); }}
                      className="text-gray-400 hover:text-white text-lg">&times;</button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Search club..." value={club1Query}
                        onChange={(e) => setClub1Query(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchClubFor(1)}
                        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none" />
                      <button onClick={() => searchClubFor(1)} disabled={club1Searching}
                        className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50">
                        {club1Searching ? "..." : "Search"}
                      </button>
                    </div>
                    {club1Results.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                        {club1Results.map((c) => (
                          <button key={c.id} onClick={() => selectClub(1, c)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800">
                            <Img src={c.image} alt={c.name} size={24} />
                            <span className="text-white truncate">{c.name}</span>
                            <span className="text-xs text-gray-500 ml-auto shrink-0">{c.country}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!club1Selected && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {POPULAR.slice(0, 8).map((c) => (
                      <button key={c.id} onClick={() => selectPopularClub(1, c.id, c.name)}
                        className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:border-gray-500 hover:text-white">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Club 2 */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-gray-500">Club 2</label>
                {club2Selected ? (
                  <div className="flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-900/20 px-4 py-3">
                    <Img src={club2Selected.image} alt={club2Selected.name} size={28} />
                    <span className="font-bold text-white flex-1 truncate">{club2Selected.name}</span>
                    <button onClick={() => { setClub2Selected(null); setClub2Query(""); setCrossResults([]); setCrossClubNames(null); }}
                      className="text-gray-400 hover:text-white text-lg">&times;</button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Search club..." value={club2Query}
                        onChange={(e) => setClub2Query(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchClubFor(2)}
                        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none" />
                      <button onClick={() => searchClubFor(2)} disabled={club2Searching}
                        className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50">
                        {club2Searching ? "..." : "Search"}
                      </button>
                    </div>
                    {club2Results.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                        {club2Results.map((c) => (
                          <button key={c.id} onClick={() => selectClub(2, c)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800">
                            <Img src={c.image} alt={c.name} size={24} />
                            <span className="text-white truncate">{c.name}</span>
                            <span className="text-xs text-gray-500 ml-auto shrink-0">{c.country}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!club2Selected && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {POPULAR.slice(0, 8).map((c) => (
                      <button key={c.id} onClick={() => selectPopularClub(2, c.id, c.name)}
                        className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:border-gray-500 hover:text-white">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Find button */}
            <button onClick={findCrossPlayers}
              disabled={!club1Selected || !club2Selected || crossLoading}
              className="mb-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors md:w-auto md:px-8">
              {crossLoading ? "Searching Wikidata..." : "Find Players"}
            </button>

            {/* Results */}
            {crossLoading && (
              <div className="py-12 text-center text-gray-500">Searching for players who played for both clubs...</div>
            )}

            {!crossLoading && crossClubNames && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-black text-white">
                    {crossClubNames.club1} &amp; {crossClubNames.club2}
                  </h2>
                  <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-bold text-gray-300">
                    {crossResults.length} player{crossResults.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {crossResults.length === 0 ? (
                  <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 text-center text-gray-500">
                    No players found who played for both clubs in Wikidata.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {crossResults.map((p) => (
                      <button key={p.id} onClick={() => { setTab("browse"); loadPlayer(p.id); }}
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
                )}
              </div>
            )}
          </>
        )}

        {/* ════════ HOME ════════ */}
        {tab === "browse" && view === "home" && (
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
        {tab === "browse" && view === "squad" && squadClub && (
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
        {tab === "browse" && view === "player" && (
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
