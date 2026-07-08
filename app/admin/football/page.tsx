"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  { id: "Q18656", name: "Manchester United" },
  { id: "Q9617", name: "Arsenal" },
  { id: "Q1130849", name: "Liverpool" },
  { id: "Q9616", name: "Chelsea" },
  { id: "Q50602", name: "Manchester City" },
  { id: "Q18741", name: "Tottenham" },
  { id: "Q8682", name: "Real Madrid" },
  { id: "Q7156", name: "Barcelona" },
  { id: "Q8687", name: "Bayern Munich" },
  { id: "Q1422", name: "Juventus" },
  { id: "Q631", name: "Inter Milan" },
  { id: "Q1543", name: "AC Milan" },
  { id: "Q483020", name: "PSG" },
  { id: "Q41420", name: "Borussia Dortmund" },
  { id: "Q18711", name: "Aston Villa" },
  { id: "Q8701", name: "Atletico Madrid" },
  { id: "Q702455", name: "RB Leipzig" },
  { id: "Q2641", name: "Napoli" },
];
const POPULAR = POPULAR_CLUBS;

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

interface ImportLog {
  message: string;
  time: string;
}

export default function FootballDataPage() {
  const [tab, setTab] = useState<"browse" | "helper" | "database">("browse");
  const [view, setView] = useState<"home" | "squad" | "player">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Database tab state
  const [dbStats, setDbStats] = useState<{ players: number; clubs: number; careers: number; countries: number } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [startYear, setStartYear] = useState(1920);

  // Single-player add state
  const [addPlayerId, setAddPlayerId] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerResult, setAddPlayerResult] = useState<string | null>(null);

  // Fill missing careers state
  const [fixingCareers, setFixingCareers] = useState(false);
  const [fixCareersLog, setFixCareersLog] = useState<string[]>([]);

  // Re-fetch career for current player
  const [refetchingCareer, setRefetchingCareer] = useState(false);

  const addLog = (message: string) => {
    setImportLogs((prev) => [...prev, { message, time: new Date().toLocaleTimeString() }]);
  };

  const loadDbStats = async () => {
    setDbLoading(true);
    try {
      const res = await fetch("/api/admin/football/import");
      const json = await res.json();
      if (res.ok) setDbStats(json);
    } catch {
      // ignore
    }
    setDbLoading(false);
  };

  const runImport = async () => {
    setImporting(true);
    setImportLogs([]);
    setImportProgress(0);

    const END_YEAR = 2010;
    const totalSteps = (END_YEAR - startYear + 1) * 2; // 2 halves per year
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const callWithRetry = async (body: Record<string, unknown>, retries = 3): Promise<Record<string, unknown>> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch("/api/admin/football/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (!res.ok) {
            if (attempt < retries) {
              const wait = (attempt + 1) * 5000;
              addLog(`Retry ${attempt + 1}/${retries} after error, waiting ${wait / 1000}s...`);
              await delay(wait);
              continue;
            }
            throw new Error(json.error ?? "Request failed");
          }
          return json;
        } catch (e: unknown) {
          if (attempt < retries) {
            const wait = (attempt + 1) * 5000;
            addLog(`Retry ${attempt + 1}/${retries} after error, waiting ${wait / 1000}s...`);
            await delay(wait);
            continue;
          }
          throw e;
        }
      }
      throw new Error("Max retries exceeded");
    };

    try {
      // Phase 1: Players by birth year (split into H1/H2 halves)
      setImportPhase("Importing players...");
      addLog(`Phase 1: Player names + DOB (${startYear}-${END_YEAR}, half-year batches)`);
      let totalPlayers = 0;
      let stepsDone = 0;
      for (let year = startYear; year <= END_YEAR; year++) {
        for (const half of [1, 2] as const) {
          setImportPhase(`Importing players born ${year} H${half}...`);
          const json = await callWithRetry({ step: "players", year, half });
          const imported = json.imported as number;
          totalPlayers += imported;
          if (imported > 0) {
            addLog(`${year} H${half}: +${imported} players (total: ${totalPlayers})`);
          }
          stepsDone++;
          setImportProgress(Math.round((stepsDone / totalSteps) * 15));
          await delay(2000);
        }
      }

      // Players without DOB
      setImportPhase("Importing players without birth date...");
      addLog("Fetching players without DOB");
      try {
        const json = await callWithRetry({ step: "players-no-dob" });
        totalPlayers += json.imported as number;
        addLog(`No-DOB: +${json.imported} players (total: ${totalPlayers})`);
      } catch {
        addLog("Warning: no-DOB query failed — skipping");
      }
      addLog(`Phase 1 complete: ${totalPlayers} players`);
      setImportProgress(15);

      // Phase 2: Enrich players with nationality, position, image
      setImportPhase("Enriching player details...");
      addLog("Phase 2: Player details (nationality, position, image)");
      let offset = 0;
      let batch = 1;
      let totalEnriched = 0;
      while (true) {
        setImportPhase(`Enriching player details (batch ${batch})...`);
        const json = await callWithRetry({ step: "player-details", offset });
        totalEnriched += json.imported as number;
        if ((json.imported as number) > 0) {
          addLog(`Details batch ${batch}: +${json.imported} enriched`);
        }
        batch++;
        setImportProgress(15 + Math.min(15, Math.round((batch / (totalPlayers / 200)) * 15)));
        if (!json.hasMore || json.nextOffset == null) break;
        offset = json.nextOffset as number;
        await delay(2000);
      }
      addLog(`Phase 2 complete: ${totalEnriched} players enriched`);
      setImportProgress(30);

      // Phase 3: Careers
      setImportPhase("Importing career records...");
      addLog("Phase 3: Career records (25 players per batch)");
      offset = 0;
      let totalCareers = 0;
      batch = 1;
      while (true) {
        setImportPhase(`Importing careers (batch ${batch})...`);
        const json = await callWithRetry({ step: "careers", offset });
        totalCareers += json.imported as number;
        if ((json.imported as number) > 0) {
          addLog(`Careers batch ${batch}: +${json.imported} (total: ${totalCareers})`);
        }
        batch++;
        setImportProgress(30 + Math.min(40, Math.round((batch / (totalPlayers / 100)) * 40)));
        if (!json.hasMore || json.nextOffset == null) break;
        offset = json.nextOffset as number;
        await delay(2000);
      }
      addLog(`Phase 3 complete: ${totalCareers} career records`);
      setImportProgress(70);

      // Phase 4: Country flags
      setImportPhase("Fetching country flags...");
      addLog("Phase 4: Country flags");
      {
        const json = await callWithRetry({ step: "flags" });
        addLog(`Flags imported: ${json.imported}`);
      }
      setImportProgress(85);

      // Phase 5: Club details
      setImportPhase("Enriching club details...");
      addLog("Phase 5: Club details (country, league, image)");
      offset = 0;
      let totalClubDetails = 0;
      batch = 1;
      while (true) {
        const json = await callWithRetry({ step: "club-details", offset });
        totalClubDetails += json.imported as number;
        addLog(`Club details batch ${batch}: +${json.imported}`);
        batch++;
        if (!json.hasMore || json.nextOffset == null) break;
        offset = json.nextOffset as number;
        await delay(2000);
      }
      addLog(`Phase 5 complete: ${totalClubDetails} clubs enriched`);
      setImportProgress(100);

      setImportPhase("Import complete!");
      addLog("All phases complete");
      loadDbStats();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setImportPhase(`Error: ${msg}`);
      addLog(`ERROR: ${msg}`);
    }

    setImporting(false);
  };

  const clearDatabase = async () => {
    if (!confirm("Delete ALL football data? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/football/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "clear" }),
      });
      if (!res.ok) throw new Error("Clear failed");
      addLog("Database cleared");
      loadDbStats();
    } catch {
      addLog("Failed to clear database");
    }
  };

  const handleAddPlayer = async () => {
    const id = addPlayerId.trim();
    if (!id) return;
    setAddingPlayer(true);
    setAddPlayerResult(null);
    try {
      const res = await fetch("/api/admin/football/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "single-player", wikidataId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setAddPlayerResult(`✓ Added "${json.name}" — ${json.careersImported} career(s), ${json.clubsImported} club(s)`);
      setAddPlayerId("");
      loadDbStats();
    } catch (e: unknown) {
      setAddPlayerResult(`✗ ${e instanceof Error ? e.message : "Error"}`);
    }
    setAddingPlayer(false);
  };

  const refetchCareer = async (playerId: string) => {
    setRefetchingCareer(true);
    try {
      const res = await fetch("/api/admin/football/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "single-player", wikidataId: playerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      // Reload the player view to reflect new career data
      await loadPlayer(playerId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Re-fetch failed");
    }
    setRefetchingCareer(false);
  };

  const fillMissingCareers = async () => {
    setFixingCareers(true);
    setFixCareersLog([]);
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let offset = 0;
    let batch = 1;
    let totalImported = 0;
    try {
      while (true) {
        const res = await fetch("/api/admin/football/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "fill-missing-careers", offset }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed");
        totalImported += json.imported as number;
        if ((json.missingCount as number) > 0 || (json.imported as number) > 0) {
          setFixCareersLog((prev) => [...prev,
            `Batch ${batch}: checked ${json.checked}, missing ${json.missingCount}, imported ${json.imported} careers`]);
        }
        if (!json.hasMore) break;
        offset = json.nextOffset as number;
        batch++;
        await delay(3000);
      }
      setFixCareersLog((prev) => [...prev, `Done — ${totalImported} total career records added`]);
      loadDbStats();
    } catch (e: unknown) {
      setFixCareersLog((prev) => [...prev, `ERROR: ${e instanceof Error ? e.message : "Failed"}`]);
    }
    setFixingCareers(false);
  };

  // Search
  const [searchType, setSearchType] = useState<"player" | "club">("player");
  const [searchQuery, setSearchQuery] = useState("");

  // Results
  const [playerResults, setPlayerResults] = useState<Player[]>([]);
  const [clubResults, setClubResults] = useState<Club[]>([]);

  // Autocomplete
  const [acResults, setAcResults] = useState<(Player | Club)[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const acRef = useRef<HTMLDivElement>(null);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAutocomplete = useCallback(async (q: string, type: "player" | "club") => {
    if (q.length < 2) { setAcResults([]); setAcOpen(false); return; }
    setAcLoading(true);
    try {
      const endpoint = type === "player"
        ? `/api/admin/football/players?q=${encodeURIComponent(q)}`
        : `/api/admin/football/leagues?q=${encodeURIComponent(q)}`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (res.ok) {
        const results = type === "player" ? (json.players ?? []) : (json.clubs ?? []);
        setAcResults(results);
        setAcOpen(results.length > 0);
      }
    } catch {
      // ignore
    }
    setAcLoading(false);
  }, []);

  const onSearchInput = (value: string) => {
    setSearchQuery(value);
    if (acTimer.current) clearTimeout(acTimer.current);
    if (value.trim().length < 2) {
      setAcResults([]);
      setAcOpen(false);
      return;
    }
    acTimer.current = setTimeout(() => runAutocomplete(value.trim(), searchType), 300);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) {
        setAcOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Squad view
  const [squadClub, setSquadClub] = useState<Club | null>(null);
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Player detail
  const [playerProfile, setPlayerProfile] = useState<Player | null>(null);
  const [playerCareer, setPlayerCareer] = useState<CareerEntry[]>([]);

  // TTT Grid Builder
  const emptySlots = (): (Club | null)[] => [null, null, null];
  const emptyQueries = (): string[] => ["", "", ""];
  const emptyResults = (): Club[][] => [[], [], []];
  const [gridRows, setGridRows] = useState<(Club | null)[]>(emptySlots);
  const [gridCols, setGridCols] = useState<(Club | null)[]>(emptySlots);
  const [gridRowQueries, setGridRowQueries] = useState<string[]>(emptyQueries);
  const [gridColQueries, setGridColQueries] = useState<string[]>(emptyQueries);
  const [gridRowResults, setGridRowResults] = useState<Club[][]>(emptyResults);
  const [gridColResults, setGridColResults] = useState<Club[][]>(emptyResults);
  const [gridCells, setGridCells] = useState<Player[][] | null>(null);
  const [gridClubNames, setGridClubNames] = useState<{ rows: string[]; cols: string[] } | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridSearching, setGridSearching] = useState<Record<string, boolean>>({});
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDifficulty, setSaveDifficulty] = useState<"easy" | "medium" | "extreme">("easy");
  const [savingPuzzle, setSavingPuzzle] = useState(false);
  const [savePuzzleError, setSavePuzzleError] = useState<string | null>(null);
  const [savedPuzzleId, setSavedPuzzleId] = useState<string | null>(null);

  // TTT debug — check a specific player's club IDs vs the grid
  const [debugQuery, setDebugQuery] = useState("");
  const [debugSearching, setDebugSearching] = useState(false);
  const [debugPlayer, setDebugPlayer] = useState<{ name: string; clubs: { id: string; name: string; start: string | null; end: string | null }[] } | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  const checkPlayerInGrid = async () => {
    const q = debugQuery.trim();
    if (!q) return;
    setDebugSearching(true);
    setDebugPlayer(null);
    setDebugError(null);
    try {
      // Search for the player
      const searchRes = await fetch(`/api/admin/football/players?q=${encodeURIComponent(q)}`);
      const searchJson = await searchRes.json();
      if (!searchRes.ok) throw new Error(searchJson.error ?? "Search failed");
      const players: Player[] = searchJson.players ?? [];
      if (players.length === 0) throw new Error(`No player found for "${q}"`);
      const player = players[0];

      // Get their career
      const careerRes = await fetch(`/api/admin/football/players?player=${player.id}`);
      const careerJson = await careerRes.json();
      if (!careerRes.ok) throw new Error(careerJson.error ?? "Career fetch failed");

      const clubs = (careerJson.career ?? []).map((c: CareerEntry) => ({
        id: c.teamId,
        name: c.team,
        start: c.startDate,
        end: c.endDate,
      }));
      setDebugPlayer({ name: player.name, clubs });
    } catch (e: unknown) {
      setDebugError(e instanceof Error ? e.message : "Failed");
    }
    setDebugSearching(false);
  };

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

  /* ── TTT Grid Builder ── */
  const searchGridClub = async (type: "row" | "col", idx: number) => {
    const queries = type === "row" ? gridRowQueries : gridColQueries;
    const q = queries[idx]?.trim();
    if (!q) return;
    const key = `${type}-${idx}`;
    setGridSearching((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/admin/football/leagues?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const setter = type === "row" ? setGridRowResults : setGridColResults;
      setter((prev) => { const next = [...prev]; next[idx] = json.clubs ?? []; return next; });
    } catch {
      // silently fail
    }
    setGridSearching((prev) => ({ ...prev, [key]: false }));
  };

  const selectGridClub = (type: "row" | "col", idx: number, club: Club) => {
    setGridCells(null); setGridClubNames(null);
    if (type === "row") {
      setGridRows((prev) => { const next = [...prev]; next[idx] = club; return next; });
      setGridRowQueries((prev) => { const next = [...prev]; next[idx] = club.name; return next; });
      setGridRowResults((prev) => { const next = [...prev]; next[idx] = []; return next; });
    } else {
      setGridCols((prev) => { const next = [...prev]; next[idx] = club; return next; });
      setGridColQueries((prev) => { const next = [...prev]; next[idx] = club.name; return next; });
      setGridColResults((prev) => { const next = [...prev]; next[idx] = []; return next; });
    }
  };

  const clearGridClub = (type: "row" | "col", idx: number) => {
    setGridCells(null); setGridClubNames(null);
    if (type === "row") {
      setGridRows((prev) => { const next = [...prev]; next[idx] = null; return next; });
      setGridRowQueries((prev) => { const next = [...prev]; next[idx] = ""; return next; });
    } else {
      setGridCols((prev) => { const next = [...prev]; next[idx] = null; return next; });
      setGridColQueries((prev) => { const next = [...prev]; next[idx] = ""; return next; });
    }
  };

  const allGridClubsSelected = gridRows.every(Boolean) && gridCols.every(Boolean);

  const generateGrid = async () => {
    if (!allGridClubsSelected) return;
    setGridLoading(true);
    setGridCells(null);
    setGridClubNames(null);
    setError(null);
    try {
      const rowParams = gridRows.map((c) => `row=${c!.id}`).join("&");
      const colParams = gridCols.map((c) => `col=${c!.id}`).join("&");
      const res = await fetch(`/api/admin/football/ttt-grid?${rowParams}&${colParams}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setGridCells(json.cells ?? []);
      setGridClubNames({ rows: json.rowClubs, cols: json.colClubs });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Grid generation failed");
    }
    setGridLoading(false);
  };

  const savePuzzle = async () => {
    if (!saveTitle.trim() || !gridCells || !gridClubNames) return;
    setSavingPuzzle(true);
    setSavePuzzleError(null);
    setSavedPuzzleId(null);
    const { rows: rowLabels, cols: colLabels } = gridClubNames;
    const apiGrid = rowLabels.map((_, ri) =>
      colLabels.map((_, ci) => {
        const players = gridCells[ri * 3 + ci] ?? [];
        return {
          type: "normal" as const,
          conditions: [rowLabels[ri], colLabels[ci]] as [string, string],
          answers: players.map((p) => ({ name: p.name, points: 1 })),
          maxScore: players.length,
        };
      })
    );
    try {
      const res = await fetch("/api/tictactoe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: saveTitle.trim(),
          difficulty: saveDifficulty,
          row_labels: rowLabels,
          col_labels: colLabels,
          grid: apiGrid,
          three_in_a_row_bonus: 10,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setSavedPuzzleId(json.id);
      setSaveTitle("");
    } catch (e: unknown) {
      setSavePuzzleError(e instanceof Error ? e.message : "Save failed");
    }
    setSavingPuzzle(false);
  };

  /* ── Breadcrumb ── */
  const crumbs = (
    <div className="flex items-center gap-2 text-sm text-white mb-6 flex-wrap">
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
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === "browse" ? "bg-indigo-600 text-white" : "text-white hover:text-white"}`}>
            Browse
          </button>
          <button onClick={() => setTab("helper")}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === "helper" ? "bg-indigo-600 text-white" : "text-white hover:text-white"}`}>
            TTT Helper
          </button>
          <button onClick={() => { setTab("database"); if (!dbStats) loadDbStats(); }}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === "database" ? "bg-indigo-600 text-white" : "text-white hover:text-white"}`}>
            Database
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</div>
        )}

        {/* ════════ TTT GRID BUILDER ════════ */}
        {tab === "helper" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">TTT Grid Builder</h1>
              <p className="mt-1 text-sm text-white">
                Set 3 row clubs and 3 column clubs, then generate a full grid of answers.
              </p>
            </div>

            {/* Club selectors */}
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              {/* Row clubs */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase text-white">Row Clubs</h3>
                <div className="space-y-2">
                  {[0, 1, 2].map((idx) => (
                    <div key={`row-${idx}`}>
                      {gridRows[idx] ? (
                        <div className="flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-900/20 px-3 py-2">
                          <Img src={gridRows[idx]!.image} alt={gridRows[idx]!.name} size={24} />
                          <span className="font-bold text-white flex-1 truncate text-sm">{gridRows[idx]!.name}</span>
                          <span className="text-[10px] font-mono text-gray-500 shrink-0">{gridRows[idx]!.id}</span>
                          <button onClick={() => clearGridClub("row", idx)} className="text-white hover:text-white">&times;</button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="flex gap-2">
                            <input type="text" placeholder={`Row ${idx + 1} club...`}
                              value={gridRowQueries[idx]}
                              onChange={(e) => setGridRowQueries((prev) => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                              onKeyDown={(e) => e.key === "Enter" && searchGridClub("row", idx)}
                              className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none" />
                            <button onClick={() => searchGridClub("row", idx)} disabled={!!gridSearching[`row-${idx}`]}
                              className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-white hover:bg-gray-700 disabled:opacity-50">
                              {gridSearching[`row-${idx}`] ? "..." : "Search"}
                            </button>
                          </div>
                          {gridRowResults[idx]?.length > 0 && (
                            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                              {gridRowResults[idx].map((c) => (
                                <button key={c.id} onClick={() => selectGridClub("row", idx, c)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800">
                                  <Img src={c.image} alt={c.name} size={20} />
                                  <span className="text-white truncate">{c.name}</span>
                                  <span className="text-xs text-white ml-auto shrink-0">{c.country}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Column clubs */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase text-white">Column Clubs</h3>
                <div className="space-y-2">
                  {[0, 1, 2].map((idx) => (
                    <div key={`col-${idx}`}>
                      {gridCols[idx] ? (
                        <div className="flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-900/20 px-3 py-2">
                          <Img src={gridCols[idx]!.image} alt={gridCols[idx]!.name} size={24} />
                          <span className="font-bold text-white flex-1 truncate text-sm">{gridCols[idx]!.name}</span>
                          <span className="text-[10px] font-mono text-gray-500 shrink-0">{gridCols[idx]!.id}</span>
                          <button onClick={() => clearGridClub("col", idx)} className="text-white hover:text-white">&times;</button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="flex gap-2">
                            <input type="text" placeholder={`Column ${idx + 1} club...`}
                              value={gridColQueries[idx]}
                              onChange={(e) => setGridColQueries((prev) => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                              onKeyDown={(e) => e.key === "Enter" && searchGridClub("col", idx)}
                              className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none" />
                            <button onClick={() => searchGridClub("col", idx)} disabled={!!gridSearching[`col-${idx}`]}
                              className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-white hover:bg-gray-700 disabled:opacity-50">
                              {gridSearching[`col-${idx}`] ? "..." : "Search"}
                            </button>
                          </div>
                          {gridColResults[idx]?.length > 0 && (
                            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                              {gridColResults[idx].map((c) => (
                                <button key={c.id} onClick={() => selectGridClub("col", idx, c)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800">
                                  <Img src={c.image} alt={c.name} size={20} />
                                  <span className="text-white truncate">{c.name}</span>
                                  <span className="text-xs text-white ml-auto shrink-0">{c.country}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate button */}
            <button onClick={generateGrid}
              disabled={!allGridClubsSelected || gridLoading}
              className="mb-8 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors md:w-auto md:px-8">
              {gridLoading ? "Generating grid..." : "Generate Grid"}
            </button>

            {gridLoading && (
              <div className="py-12 text-center text-white">
                Querying Wikidata for all 6 clubs and finding intersections...
                <br />
                <span className="text-xs">This may take 15-30 seconds.</span>
              </div>
            )}

            {/* Results grid */}
            {!gridLoading && gridCells && gridClubNames && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2" />
                        {gridClubNames.cols.map((name, ci) => (
                          <th key={ci} className="p-2 text-center text-xs font-bold uppercase text-indigo-400 min-w-[180px]">
                            {name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gridClubNames.rows.map((rowName, ri) => (
                        <tr key={ri}>
                          <td className="p-2 text-right text-xs font-bold uppercase text-indigo-400 whitespace-nowrap align-top pt-4">
                            {rowName}
                          </td>
                          {[0, 1, 2].map((ci) => {
                            const cellPlayers = gridCells[ri * 3 + ci] ?? [];
                            return (
                              <td key={ci} className="p-1 align-top">
                                <div className="rounded-lg border border-gray-800 bg-gray-900 p-2 min-h-[80px]">
                                  {cellPlayers.length === 0 ? (
                                    <div className="flex items-center justify-center h-[80px] text-xs text-white">
                                      No players
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="text-[10px] font-bold text-white mb-1">
                                        {cellPlayers.length} player{cellPlayers.length !== 1 ? "s" : ""}
                                      </div>
                                      {cellPlayers.map((p) => (
                                        <button key={p.id}
                                          onClick={() => { setTab("browse"); loadPlayer(p.id); }}
                                          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-gray-800 transition-colors">
                                          <Img src={p.image} alt={p.name} size={20} />
                                          <span className="text-xs text-white truncate">{p.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Save as TTT Puzzle */}
                <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900 p-5">
                  <h3 className="mb-1 text-sm font-bold text-white">Save as TTT Puzzle</h3>
                  <p className="mb-4 text-xs text-white">All players found in each cell become valid answers (1 point each).</p>
                  <div className="flex flex-wrap gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="Puzzle title..."
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") savePuzzle(); }}
                      className="flex-1 min-w-[200px] rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex gap-1">
                      {(["easy", "medium", "extreme"] as const).map((d) => (
                        <button key={d} onClick={() => setSaveDifficulty(d)}
                          className={`rounded-lg px-3 py-2 text-xs font-bold uppercase transition-colors ${
                            saveDifficulty === d
                              ? d === "easy" ? "bg-green-600 text-white"
                              : d === "medium" ? "bg-yellow-600 text-white"
                              : "bg-red-600 text-white"
                              : "border border-gray-700 bg-gray-800 text-white hover:border-gray-600"
                          }`}>{d}</button>
                      ))}
                    </div>
                    <button
                      onClick={savePuzzle}
                      disabled={savingPuzzle || !saveTitle.trim()}
                      className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingPuzzle ? "Saving..." : "Save Puzzle"}
                    </button>
                  </div>
                  {savePuzzleError && <p className="text-sm text-red-400">{savePuzzleError}</p>}
                  {savedPuzzleId && (
                    <p className="text-sm text-green-400">
                      Puzzle saved!{" "}
                      <Link href={`/tic-tac-toe/${savedPuzzleId}`} className="underline font-bold">
                        Play it →
                      </Link>
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ── Debug: check a specific player's club IDs ── */}
            <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h3 className="mb-1 text-xs font-bold uppercase text-white">Debug: Check Player in Grid</h3>
              <p className="mb-3 text-xs text-white">
                Search a player to see exactly which club IDs their career uses. Compare against the IDs shown next to each selected club above.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={debugQuery}
                  onChange={(e) => setDebugQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") checkPlayerInGrid(); }}
                  placeholder="e.g. Mahrez"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={checkPlayerInGrid}
                  disabled={debugSearching || !debugQuery.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {debugSearching ? "Checking..." : "Check"}
                </button>
              </div>
              {debugError && <p className="mt-2 text-xs text-red-400">{debugError}</p>}
              {debugPlayer && (() => {
                const gridClubIds = new Set([
                  ...gridRows.filter(Boolean).map(c => c!.id),
                  ...gridCols.filter(Boolean).map(c => c!.id),
                ]);
                return (
                  <div className="mt-3">
                    <p className="text-sm font-bold text-white mb-2">{debugPlayer.name} — {debugPlayer.clubs.length} club(s)</p>
                    <div className="space-y-1 font-mono text-xs">
                      {debugPlayer.clubs.length === 0 ? (
                        <p className="text-red-400">No career entries in DB — run "Re-fetch from Wikidata" in Browse tab</p>
                      ) : debugPlayer.clubs.map((c) => {
                        const inGrid = gridClubIds.has(c.id);
                        return (
                          <div key={`${c.id}-${c.start}`} className={`flex items-start gap-2 rounded px-2 py-1 ${inGrid ? "bg-emerald-900/40 border border-emerald-700/50" : "bg-gray-800/50"}`}>
                            <span className={`shrink-0 font-bold ${inGrid ? "text-emerald-400" : "text-gray-500"}`}>{inGrid ? "✓" : "–"}</span>
                            <span className={`flex-1 ${inGrid ? "text-emerald-300" : "text-white"}`}>{c.name || <span className="text-gray-500 italic">unnamed</span>}</span>
                            <span className="text-gray-500 shrink-0">{c.id}</span>
                          </div>
                        );
                      })}
                    </div>
                    {gridClubIds.size > 0 && (
                      <p className="mt-2 text-xs text-white">
                        Grid club IDs: {Array.from(gridClubIds).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* ════════ API EXPLORER ════════ */}

        {/* ════════ HOME ════════ */}
        {tab === "browse" && view === "home" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">Football Data</h1>
              <p className="mt-1 text-sm text-white">
                Search players and clubs via Wikidata. Full career histories, nationalities, positions — free and unlimited.
              </p>
            </div>

            {/* Search with autocomplete */}
            <div className="mb-6" ref={acRef}>
              <div className="relative">
                <div className="flex gap-2">
                  <select value={searchType} onChange={(e) => {
                    setSearchType(e.target.value as "player" | "club");
                    setAcResults([]); setAcOpen(false);
                    if (searchQuery.trim().length >= 2) {
                      if (acTimer.current) clearTimeout(acTimer.current);
                      acTimer.current = setTimeout(() => runAutocomplete(searchQuery.trim(), e.target.value as "player" | "club"), 300);
                    }
                  }}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-indigo-600 focus:outline-none">
                    <option value="player">Player</option>
                    <option value="club">Club</option>
                  </select>
                  <input type="text" placeholder={`Search ${searchType}s...`}
                    value={searchQuery}
                    onChange={(e) => onSearchInput(e.target.value)}
                    onFocus={() => { if (acResults.length > 0) setAcOpen(true); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { setAcOpen(false); handleSearch(); }
                      if (e.key === "Escape") setAcOpen(false);
                    }}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none" />
                  <button onClick={() => { setAcOpen(false); handleSearch(); }} disabled={loading}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {loading ? "..." : "Search"}
                  </button>
                </div>

                {/* Autocomplete dropdown */}
                {acOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                    {acLoading && acResults.length === 0 && (
                      <div className="px-4 py-3 text-sm text-white">Searching...</div>
                    )}
                    {searchType === "player" ? (
                      (acResults as Player[]).map((p) => (
                        <button key={p.id} onClick={() => { setAcOpen(false); setSearchQuery(p.name); loadPlayer(p.id); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-800 border-b border-gray-800/50 last:border-0">
                          <Img src={p.image} alt={p.name} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-sm truncate">{p.name}</p>
                            <div className="flex items-center gap-2 text-xs text-white">
                              {p.position && <span>{p.position}</span>}
                              {p.nationality && <span>· {p.nationality}</span>}
                              {p.dob && <span>· {calcAge(p.dob)}y</span>}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      (acResults as Club[]).map((c) => (
                        <button key={c.id} onClick={() => { setAcOpen(false); setSearchQuery(c.name); loadSquad(c.id, c.name); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-800 border-b border-gray-800/50 last:border-0">
                          <Img src={c.image} alt={c.name} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-sm truncate">{c.name}</p>
                            <p className="text-xs text-white">{c.country}{c.league ? ` · ${c.league}` : ""}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Player search results */}
            {playerResults.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-xs font-bold uppercase text-white">Players ({playerResults.length})</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {playerResults.map((p) => (
                    <button key={p.id} onClick={() => loadPlayer(p.id)}
                      className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                      <Img src={p.image} alt={p.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{p.name}</p>
                        <div className="flex items-center gap-2 text-xs text-white">
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
                <h2 className="mb-3 text-xs font-bold uppercase text-white">Clubs ({clubResults.length})</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {clubResults.map((c) => (
                    <button key={c.id} onClick={() => loadSquad(c.id, c.name)}
                      className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                      <Img src={c.image} alt={c.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{c.name}</p>
                        <p className="text-xs text-white">
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
              <h2 className="mb-3 text-xs font-bold uppercase text-white">Popular Clubs</h2>
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
                  <p className="text-sm text-white">
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
                    : "border-gray-700 bg-gray-900 text-white hover:border-gray-600"
                }`}
              >
                {showHistory ? "Showing All-Time" : "Show All-Time"}
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-white">Loading{showHistory ? " all-time players" : " current squad"}...</div>
            ) : squadPlayers.length === 0 ? (
              <div className="py-12 text-center text-white">No players found. Try &quot;Show All-Time&quot; for historical data.</div>
            ) : showHistory ? (
              /* All-time: flat list sorted by date */
              <div className="space-y-1">
                {squadPlayers.map((p, i) => (
                  <button key={`${p.id}-${i}`} onClick={() => loadPlayer(p.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-left transition-colors hover:border-indigo-600">
                    <Img src={p.image} alt={p.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">{p.name}</p>
                      <div className="flex items-center gap-2 text-xs text-white">
                        {p.position && <span>{p.position}</span>}
                        {p.nationality && <span>· {p.nationality}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-white">
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
                  <h3 className="mb-2 text-xs font-bold uppercase text-white">{group} ({players.length})</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map((p) => (
                      <button key={p.id} onClick={() => loadPlayer(p.id)}
                        className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors hover:border-indigo-600 hover:bg-gray-800/50">
                        <Img src={p.image} alt={p.name} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-xs text-white">
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
              <div className="py-12 text-center text-white">Loading player...</div>
            ) : !playerProfile ? (
              <div className="py-12 text-center text-white">Player not found.</div>
            ) : (
              <>
                {/* Profile card */}
                <div className="mb-6 flex items-start gap-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
                  <Img src={playerProfile.image} alt={playerProfile.name} size={80} />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-black">{playerProfile.name}</h1>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white">
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
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-sm font-bold uppercase text-white flex-1">
                      Career ({playerCareer.length} clubs)
                    </h2>
                    <button
                      onClick={() => refetchCareer(playerProfile.id)}
                      disabled={refetchingCareer}
                      className="rounded-lg border border-indigo-600 bg-indigo-900/30 px-3 py-1 text-xs font-bold text-indigo-300 hover:bg-indigo-900/60 disabled:opacity-50"
                    >
                      {refetchingCareer ? "Re-fetching..." : "Re-fetch from Wikidata"}
                    </button>
                  </div>
                  {playerCareer.length === 0 ? (
                    <p className="py-8 text-center text-white">No career data found.</p>
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
                          <div className="shrink-0 text-right text-sm text-white">
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

        {/* ════════ DATABASE TAB ════════ */}
        {tab === "database" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-black">Football Database</h1>
              <p className="mt-1 text-sm text-white">
                Import player and club data from Wikidata into your own database for instant search.
              </p>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["players", "clubs", "careers", "countries"] as const).map((key) => (
                <div key={key} className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
                  <p className="text-2xl font-black text-white">
                    {dbLoading ? "..." : dbStats ? dbStats[key].toLocaleString() : "—"}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-white">{key}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                onClick={loadDbStats}
                disabled={dbLoading}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                Refresh Stats
              </button>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-white">Start year:</label>
                <input
                  type="number"
                  min={1920}
                  max={2010}
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                  disabled={importing}
                  className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm font-mono text-white disabled:opacity-50"
                />
              </div>
              <button
                onClick={runImport}
                disabled={importing}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {importing ? "Importing..." : startYear > 1920 ? `Resume from ${startYear}` : "Import from Wikidata"}
              </button>
              <button
                onClick={clearDatabase}
                disabled={importing}
                className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-900/50 disabled:opacity-50"
              >
                Clear All Data
              </button>
            </div>

            {/* Add single player */}
            <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h3 className="mb-3 text-xs font-bold uppercase text-white">Add / Re-import Player by Wikidata ID</h3>
              <p className="mb-3 text-xs text-white">Use this for players born before 1967 (e.g. Lineker = Q211147) or players with missing careers.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addPlayerId}
                  onChange={(e) => setAddPlayerId(e.target.value)}
                  placeholder="e.g. Q211147"
                  disabled={addingPlayer}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono text-white disabled:opacity-50"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPlayer(); }}
                />
                <button
                  onClick={handleAddPlayer}
                  disabled={addingPlayer || !addPlayerId.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {addingPlayer ? "Importing..." : "Import"}
                </button>
              </div>
              {addPlayerResult && (
                <p className={`mt-2 text-xs font-mono ${addPlayerResult.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
                  {addPlayerResult}
                </p>
              )}
            </div>

            {/* Fill missing careers */}
            <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-4">
              <h3 className="mb-3 text-xs font-bold uppercase text-white">Fill Missing Careers</h3>
              <p className="mb-3 text-xs text-white">Finds all players with 0 career entries and re-fetches their clubs from Wikidata in batches of 25 (reduces timeout risk).</p>
              <button
                onClick={fillMissingCareers}
                disabled={fixingCareers || importing}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {fixingCareers ? "Running..." : "Fix Missing Careers"}
              </button>
              {fixCareersLog.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
                  {fixCareersLog.map((line, i) => (
                    <div key={i} className={line.startsWith("ERROR") ? "text-red-400" : line.startsWith("Done") ? "text-green-400" : "text-white"}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Progress */}
            {(importing || importPhase) && (
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-white">{importPhase}</span>
                  <span className="font-mono text-white">{importProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Logs */}
            {importLogs.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase text-white">Import Log</h3>
                <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
                  {importLogs.map((log, i) => (
                    <div key={i} className={`${log.message.startsWith("ERROR") ? "text-red-400" : "text-white"}`}>
                      <span className="text-white">[{log.time}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-sm text-white">
              <p className="font-bold text-white mb-2">How it works</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Phase 1: Downloads all footballers from Wikidata (name, DOB, nationality, position, photo)</li>
                <li>Phase 2: Downloads career records (which clubs each player played for, with dates)</li>
                <li>Phase 3: Fetches country flag images</li>
                <li>Phase 4: Enriches clubs with country, league, and crest image</li>
                <li>Full import takes ~10-15 minutes. Data is upserted so re-running refreshes everything.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
