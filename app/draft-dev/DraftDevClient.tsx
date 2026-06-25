"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import DraftSetup from "@/components/draft/DraftSetup";
import DraftPick from "@/components/draft/DraftPick";
import DraftResult from "@/components/draft/DraftResult";
import Season2Overview from "@/components/draft/Season2Overview";
// ↓ This is the dev version — edit SquadManagerDev.tsx to test changes here
import SquadManagerDev from "@/components/draft/SquadManagerDev";
import { createClient } from "@/lib/supabase/client";
import { getPositionColor, FORMATIONS, formatSeasonYear } from "@/components/draft/formations";
import { computeTeamStrength } from "@/lib/seasonSimulator";
import type { PlayerAttributes, SeasonResult } from "@/lib/seasonSimulator";

export interface DraftSettings {
  formation: string;
  eraStart: number;
  eraEnd: number;
  mode: "normal" | "prime";
  draftOrder: "position-first" | "club-first";
  respins: 0 | 1 | 3;
  hiddenRatings?: boolean;
}

export interface DraftPlayer {
  name: string;
  overall: number;
  positions: string;
  club: string;
  clubYear: string;
  assignedPosition: string;
  sofifa_id: string;
  image_url: string | null;
  nationality: string;
  age: number;
  isSub?: boolean;
  attrs?: PlayerAttributes;
}

type GamePhase = "setup" | "formation-pick" | "draft" | "manage" | "result" | "pre-season" | "signing" | "sell" | "sell-signing" | "arrange";

// Separate storage key so dev progress never overwrites the live game
const STORAGE_KEY = "pl-draft-progress-dev";
const MAX_SEASONS = 5;

interface SavedProgress {
  settings: DraftSettings;
  players: DraftPlayer[];
  usedClubYears: string[];
  slotAssignments?: (number | undefined)[];
}

interface DepartedPlayer {
  player: DraftPlayer;
  reason: string;
  convinceable?: boolean;
}

interface RatingChange {
  player: DraftPlayer;
  oldOverall: number;
  newOverall: number;
  change: number;
}

function getSigningBoost(season: number): number {
  if (season >= 5) return Math.floor(Math.random() * 4) + 4;
  if (season >= 4) return Math.floor(Math.random() * 3) + 3;
  if (season >= 2) return Math.floor(Math.random() * 3) + 2;
  return Math.floor(Math.random() * 3) + 1;
}

function applyStatChange(player: DraftPlayer, change: number): DraftPlayer {
  const newPlayer = {
    ...player,
    overall: Math.max(1, Math.min(100, player.overall + change)),
  };
  if (newPlayer.attrs) {
    const attrs = { ...newPlayer.attrs };
    for (const key of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
      attrs[key] = Math.max(1, Math.min(100, (attrs[key] as number) + change));
    }
    newPlayer.attrs = attrs;
  }
  return newPlayer;
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    if (saved.settings?.formation && Array.isArray(saved.players) && saved.players.length > 0 && saved.players.length < 14) {
      return saved;
    }
  } catch {}
  return null;
}

function clearProgress() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

const SELL_POSITION_ORDER: Record<string, number> = { GK: 0, CB: 1, RB: 2, LB: 3, RWB: 2, LWB: 3, CDM: 4, DM: 4, CM: 5, CAM: 6, RM: 7, LM: 7, RW: 8, LW: 8, ST: 9, CF: 9 };

function SellPhase({ players, onSell, onSkip, seasonNumber }: {
  players: DraftPlayer[];
  onSell: (player: DraftPlayer) => void;
  onSkip: () => void;
  seasonNumber: number;
}) {
  const sorted = useMemo(
    () => [...players].sort((a, b) =>
      (a.isSub === b.isSub ? (SELL_POSITION_ORDER[a.assignedPosition] ?? 5) - (SELL_POSITION_ORDER[b.assignedPosition] ?? 5) : a.isSub ? 1 : -1)
    ),
    [players],
  );

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/30 bg-red-500/5 mb-4">
          <span className="text-xs font-bold tracking-widest uppercase text-red-400">Transfer Window</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Sell a Player?</h1>
        <p className="text-white text-sm mt-1">Tap a player to sell them and spin for a replacement.</p>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">Season {seasonNumber} Squad</h3>
        <div className="space-y-1">
          {sorted.map((p, i) => (
            <button
              key={i}
              onClick={() => onSell(p)}
              className="w-full flex items-center gap-2 text-sm py-2.5 px-3 rounded-lg transition-all text-left hover:bg-red-900/30 border-2 border-transparent hover:border-red-400/50 active:scale-[0.98]"
            >
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-9 text-center`}>
                {p.assignedPosition}
              </span>
              <span className="flex-1 ml-1 font-medium">{p.name}</span>
              {p.isSub && <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">SUB</span>}
              <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
              <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onSkip}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
      >
        Skip &mdash; Keep Squad
      </button>
    </div>
  );
}

export default function DraftDevClient() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [settings, setSettings] = useState<DraftSettings | null>(null);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [resume, setResume] = useState<SavedProgress | null>(null);

  const [currentSeason, setCurrentSeason] = useState(1);
  const [previousResults, setPreviousResults] = useState<SeasonResult[]>([]);
  const [nextSeasonPlayers, setNextSeasonPlayers] = useState<DraftPlayer[]>([]);
  const [departedPlayers, setDepartedPlayers] = useState<DepartedPlayer[]>([]);
  const [ratingChanges, setRatingChanges] = useState<RatingChange[]>([]);
  const [signingSlots, setSigningSlots] = useState(2);
  const [nextUsedClubYears, setNextUsedClubYears] = useState<string[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [respinsRemaining, setRespinsRemaining] = useState(0);

  useEffect(() => {
    setResume(loadProgress());
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
  }, []);

  const scrollTop = useCallback(() => window.scrollTo({ top: 0 }), []);

  const handleStartDraft = useCallback((s: DraftSettings) => {
    clearProgress();
    setResume(null);
    setSettings(s);
    setPlayers([]);
    setRespinsRemaining(s.respins ?? 0);
    setPhase("draft");
    scrollTop();
  }, [scrollTop]);

  const handleResume = useCallback(() => {
    if (!resume) return;
    setSettings(resume.settings);
    setPlayers([]);
    setRespinsRemaining(resume.settings.respins ?? 0);
    setPhase("draft");
    scrollTop();
  }, [resume, scrollTop]);

  const handleDiscardResume = useCallback(() => {
    clearProgress();
    setResume(null);
  }, []);

  const handleProgress = useCallback(
    (picked: DraftPlayer[], usedClubYears: string[], slotAssignments?: (number | undefined)[]) => {
      if (!settings) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, players: picked, usedClubYears, slotAssignments })); } catch {}
    },
    [settings]
  );

  const handleDraftComplete = useCallback((picked: DraftPlayer[]) => {
    clearProgress();
    setResume(null);
    setPlayers(picked);
    setPhase("manage");
    scrollTop();
  }, [scrollTop]);

  const handleManageConfirm = useCallback((arranged: DraftPlayer[]) => {
    setPlayers(arranged);
    setPhase("result");
    scrollTop();
  }, [scrollTop]);

  const handleNewRun = useCallback(() => {
    clearProgress();
    setResume(null);
    setPhase("setup");
    setSettings(null);
    setPlayers([]);
    setCurrentSeason(1);
    setPreviousResults([]);
    setNextSeasonPlayers([]);
    setDepartedPlayers([]);
    setRatingChanges([]);
    setNextUsedClubYears([]);
    setRespinsRemaining(0);
    scrollTop();
  }, [scrollTop]);

  const handlePlayNextSeason = useCallback((season: SeasonResult, currentPlayers: DraftPlayer[]) => {
    const sorted = [...currentPlayers].sort((a, b) => (b.age || 0) - (a.age || 0));
    const departed: DepartedPlayer[] = [];
    const twoDepartures = Math.random() < 0.6;

    if (twoDepartures) {
      if (Math.random() < 0.5) {
        const retiree = Math.random() < 0.5 ? sorted[0] : sorted[1];
        departed.push({ player: retiree, reason: `Retired (age ${retiree.age || "?"})` });
        const rest = currentPlayers.filter(p => p !== retiree);
        departed.push({ player: rest[Math.floor(Math.random() * rest.length)], reason: "Left the club" });
      } else {
        const shuffled = [...currentPlayers].sort(() => Math.random() - 0.5);
        departed.push({ player: shuffled[0], reason: "Left the club" });
        departed.push({ player: shuffled[1], reason: "Left the club" });
      }
      const convinceIdx = Math.floor(Math.random() * 2);
      departed[convinceIdx] = { ...departed[convinceIdx], convinceable: true };
    } else {
      if (Math.random() < 0.5) {
        const retiree = Math.random() < 0.5 ? sorted[0] : sorted[1];
        departed.push({ player: retiree, reason: `Retired (age ${retiree.age || "?"})`, convinceable: true });
      } else {
        const shuffled = [...currentPlayers].sort(() => Math.random() - 0.5);
        departed.push({ player: shuffled[0], reason: "Left the club", convinceable: true });
      }
    }

    const departedSet = new Set(departed.map(d => d.player));
    const remaining = currentPlayers.filter(p => !departedSet.has(p));
    const statsMap = new Map(season.playerStats.map(s => [s.name, s]));
    const changes: RatingChange[] = remaining.map(player => {
      const stats = statsMap.get(player.name);
      const avgRating = stats?.avgRating ?? 6.5;
      let change = 0;
      if (avgRating >= 8.5) change = 3;
      else if (avgRating >= 7.7) change = 2;
      else if (avgRating >= 7.0) change = 1;
      else if (avgRating <= 6.5) change = -1;
      return { player: applyStatChange(player, change), oldOverall: player.overall, newOverall: applyStatChange(player, change).overall, change };
    });

    const usedCYs = currentPlayers.map(p => {
      const yearPart = p.clubYear.split(" ")[1] ?? "";
      const rawYear = yearPart.includes("/") ? String(2000 + parseInt(yearPart.split("/")[1], 10)) : yearPart;
      return `${p.club}-${rawYear}`;
    });

    setDepartedPlayers(departed);
    setRatingChanges(changes);
    setNextSeasonPlayers(changes.map(rc => rc.player));
    setPreviousResults(prev => [...prev, season]);
    setNextUsedClubYears(usedCYs);
    setSigningSlots(departed.length);
    setCurrentSeason(s => s + 1);
    setPhase("pre-season");
    scrollTop();
  }, [scrollTop]);

  const handlePreSeasonContinue = useCallback((trainingPlayerName: string, retainedPlayer?: DraftPlayer) => {
    const trainingRoll = Math.floor(Math.random() * 3) + 1;
    const updatedSquad = [
      ...nextSeasonPlayers.map(p => {
        if (p.name !== trainingPlayerName) return p;
        const boost = p.overall >= 90 ? Math.min(2, trainingRoll) : trainingRoll;
        return applyStatChange(p, boost);
      }),
      ...(retainedPlayer ? [retainedPlayer] : []),
    ];
    setNextSeasonPlayers(updatedSquad);
    const actualSlots = retainedPlayer ? Math.max(0, signingSlots - 1) : signingSlots;
    setSigningSlots(actualSlots);
    if (actualSlots === 0) {
      setPlayers(updatedSquad);
      setPhase("sell");
    } else {
      setPhase("signing");
    }
    scrollTop();
  }, [nextSeasonPlayers, signingSlots, scrollTop]);

  const handleSigningComplete = useCallback((newPlayers: DraftPlayer[]) => {
    const boosted = newPlayers.map(p => applyStatChange(p, getSigningBoost(currentSeason)));
    setPlayers([...nextSeasonPlayers, ...boosted]);
    setPhase("sell");
    scrollTop();
  }, [nextSeasonPlayers, scrollTop, currentSeason]);

  const handleSellPlayer = useCallback((soldPlayer: DraftPlayer) => {
    setPlayers(prev => prev.filter(p => p !== soldPlayer));
    setPhase("sell-signing");
    scrollTop();
  }, [scrollTop]);

  const handleSkipSell = useCallback(() => {
    setPhase("arrange");
    scrollTop();
  }, [scrollTop]);

  const handleSellSigningComplete = useCallback((newPlayers: DraftPlayer[]) => {
    const boosted = newPlayers.map(p => applyStatChange(p, getSigningBoost(currentSeason)));
    setPlayers(prev => [...prev, ...boosted]);
    setPhase("arrange");
    scrollTop();
  }, [scrollTop, currentSeason]);

  const handleArrangeConfirm = useCallback((arranged: DraftPlayer[]) => {
    setPlayers(arranged);
    setPhase("result");
    scrollTop();
  }, [scrollTop]);

  const handleSkipToTest = useCallback(async () => {
    const defaultSettings: DraftSettings = {
      formation: "4-3-3", eraStart: 2007, eraEnd: 2026, mode: "normal", draftOrder: "position-first", respins: 1,
    };
    setAutoFilling(true);
    try {
      const clubsRes = await fetch("/api/draft/clubs");
      const clubsData = await clubsRes.json();
      const availableClubs: { name: string; seasons: number[] }[] = clubsData.clubs ?? [];
      if (availableClubs.length === 0) { alert("No clubs found — import player data first"); setAutoFilling(false); return; }

      const usedClubYears = new Set<string>();
      const formation = FORMATIONS.find(f => f.name === "4-3-3") ?? FORMATIONS[0];
      const squad: DraftPlayer[] = [];

      const pickClubYear = (): { club: string; year: number } | null => {
        const pairs: { club: string; year: number }[] = [];
        for (const c of availableClubs) {
          for (const y of c.seasons) {
            if (y >= defaultSettings.eraStart && y <= defaultSettings.eraEnd && !usedClubYears.has(`${c.name}-${y}`)) pairs.push({ club: c.name, year: y });
          }
        }
        if (pairs.length === 0) return null;
        const byYear = new Map<number, typeof pairs>();
        for (const p of pairs) { if (!byYear.has(p.year)) byYear.set(p.year, []); byYear.get(p.year)!.push(p); }
        const years = Array.from(byYear.keys());
        const year = years[Math.floor(Math.random() * years.length)];
        const pool = byYear.get(year)!;
        return pool[Math.floor(Math.random() * pool.length)];
      };

      const buildAttrs = (p: Record<string, number>): PlayerAttributes => ({
        pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling,
        defending: p.defending, physical: p.physical, finishing: p.finishing,
        positioning: p.positioning, crossing: p.crossing, vision: p.vision,
        longShots: p.longShots, shortPassing: p.shortPassing, longPassing: p.longPassing,
        heading: p.heading, interceptions: p.interceptions, standingTackle: p.standingTackle,
        marking: p.marking, reactions: p.reactions, sprintSpeed: p.sprintSpeed,
        gkDiving: p.gkDiving, gkPositioning: p.gkPositioning, gkReflexes: p.gkReflexes,
      });

      const fetchRosterSafe = async (club: string, year: number): Promise<Record<string, unknown>[]> => {
        try { const res = await fetch(`/api/draft/roster?club=${encodeURIComponent(club)}&year=${year}`); if (!res.ok) return []; const data = await res.json(); return Array.isArray(data.roster) ? data.roster : []; } catch { return []; }
      };

      const spinAndPick = async (): Promise<{ roster: Record<string, unknown>[]; clubYear: { club: string; year: number } } | null> => {
        for (let r = 0; r < 5; r++) {
          const cy = pickClubYear();
          if (!cy) return null;
          usedClubYears.add(`${cy.club}-${cy.year}`);
          const roster = await fetchRosterSafe(cy.club, cy.year);
          if (roster.length > 0) return { roster, clubYear: cy };
        }
        return null;
      };

      for (let i = 0; i < formation.slots.length; i++) {
        const slot = formation.slots[i];
        const pick = await spinAndPick();
        if (!pick) continue;
        const { roster, clubYear } = pick;
        const compatible = roster.filter(p => String(p.positions ?? "").split(",").map(s => s.trim()).some(pp => slot.compatiblePositions.includes(pp)));
        const pool = compatible.length > 0 ? compatible : roster;
        const best = pool.reduce((a, b) => (Number(b.overall) > Number(a.overall) ? b : a), pool[0]) as Record<string, unknown>;
        const abbr = clubYear.club.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);
        squad.push({ name: String(best.name), overall: Number(best.overall), positions: String(best.positions ?? ""), club: clubYear.club, clubYear: `${abbr} ${formatSeasonYear(clubYear.year)}`, assignedPosition: slot.label, sofifa_id: String(best.sofifa_id), image_url: best.image_url as string | null, nationality: String(best.nationality ?? ""), age: Number(best.age ?? 0), isSub: false, attrs: buildAttrs(best as Record<string, number>) });
      }

      for (let i = 0; i < 3; i++) {
        const pick = await spinAndPick();
        if (!pick) continue;
        const { roster, clubYear } = pick;
        const best = roster.reduce((a, b) => (Number(b.overall) > Number(a.overall) ? b : a), roster[0]) as Record<string, unknown>;
        const primaryPos = String(best.positions ?? "CM").split(",")[0].trim() || "CM";
        const abbr = clubYear.club.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);
        squad.push({ name: String(best.name), overall: Number(best.overall), positions: String(best.positions ?? ""), club: clubYear.club, clubYear: `${abbr} ${formatSeasonYear(clubYear.year)}`, assignedPosition: primaryPos, sofifa_id: String(best.sofifa_id), image_url: best.image_url as string | null, nationality: String(best.nationality ?? ""), age: Number(best.age ?? 0), isSub: true, attrs: buildAttrs(best as Record<string, number>) });
      }

      if (squad.length === 0) { alert("Auto-draft found no players"); setAutoFilling(false); return; }
      setSettings(defaultSettings);
      setPlayers(squad);
      setCurrentSeason(1);
      setPreviousResults([]);
      setPhase("manage");
      scrollTop();
    } catch (e) {
      console.error("Auto-fill failed:", e);
      alert("Auto-fill failed — check console");
    } finally {
      setAutoFilling(false);
    }
  }, [scrollTop]);

  const totalPicked = resume?.players.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Dev mode banner — always visible */}
      <div className="sticky top-0 z-50 bg-amber-500 text-black text-center text-xs font-black py-1 tracking-widest uppercase">
        ⚠ Dev Preview — Admin Only — Changes here do not affect live /draft
      </div>

      {phase === "setup" && (
        <>
          {resume && (
            <div className="max-w-2xl mx-auto px-4 pt-4">
              <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-emerald-400">Draft in progress (dev)</div>
                  <div className="text-xs text-white">{totalPicked}/14 picked · {resume.settings.formation}</div>
                </div>
                <button onClick={handleDiscardResume} className="px-3 py-1.5 text-xs font-bold text-white hover:text-white rounded-lg hover:bg-gray-800 transition">Discard</button>
                <button onClick={handleResume} className="px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-lg transition">Resume</button>
              </div>
            </div>
          )}
          <DraftSetup onStart={handleStartDraft} />
          <div className="text-center pb-6">
            <button onClick={handleSkipToTest} disabled={autoFilling} className="text-xs text-white hover:text-gray-500 underline transition disabled:cursor-wait">
              {autoFilling ? "auto-drafting squad…" : "[test] skip draft → auto-fill squad"}
            </button>
          </div>
        </>
      )}
      {phase === "formation-pick" && settings && (
        <div className="flex flex-col items-center justify-center min-h-screen px-3 sm:px-4 py-6">
          <div className="max-w-lg w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black tracking-tight mb-2">Choose Your Formation</h1>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-8">
              {FORMATIONS.map(f => (
                <button key={f.name} onClick={() => setSettings(prev => prev ? { ...prev, formation: f.name } : prev)}
                  className={`py-2.5 px-1.5 rounded-lg text-xs font-bold transition-all ${settings.formation === f.name ? "bg-emerald-600 text-white ring-2 ring-emerald-400" : "bg-gray-800/80 text-white hover:bg-gray-700 border border-gray-700/50"}`}>
                  {f.name}
                </button>
              ))}
            </div>
            <button onClick={() => { setPhase("draft"); scrollTop(); }}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl font-bold text-lg transition-all">
              Start Draft
            </button>
          </div>
        </div>
      )}
      {phase === "draft" && settings && (
        <DraftPick
          settings={settings}
          onComplete={handleDraftComplete}
          onBack={handleNewRun}
          isMultiplayer={false}
          initialPicked={resume?.players}
          initialUsedClubYears={resume?.usedClubYears}
          initialSlotAssignments={resume?.slotAssignments}
          onProgress={handleProgress}
          respinsRemaining={respinsRemaining}
          onUseRespin={() => setRespinsRemaining(r => Math.max(0, r - 1))}
        />
      )}
      {/* ↓ Uses SquadManagerDev — edit that file to test UI changes */}
      {phase === "manage" && players.length > 0 && (
        <SquadManagerDev
          players={players}
          onConfirm={handleManageConfirm}
          title="Pre-Season"
          subtitle="Arrange Your Squad"
          formationName={settings?.formation}
          seasonNumber={currentSeason}
        />
      )}
      {phase === "result" && players.length > 0 && (
        <DraftResult
          players={players}
          onNewRun={handleNewRun}
          onPlayNextSeason={currentSeason < MAX_SEASONS ? handlePlayNextSeason : undefined}
          seasonNumber={currentSeason}
          previousResult={previousResults[previousResults.length - 1]}
          allSeasonResults={previousResults}
          formationName={settings?.formation}
          isSignedIn={isSignedIn}
          mode={settings?.mode}
        />
      )}
      {phase === "pre-season" && (
        <Season2Overview
          departedPlayers={departedPlayers}
          ratingChanges={ratingChanges}
          season2Players={nextSeasonPlayers}
          onContinue={handlePreSeasonContinue}
          seasonNumber={currentSeason}
          previousFinish={previousResults.length > 0 ? previousResults[previousResults.length - 1].actualFinish : undefined}
        />
      )}
      {phase === "signing" && settings && signingSlots > 0 && (
        <DraftPick
          settings={{ ...settings, draftOrder: "club-first", respins: 0 }}
          onComplete={handleSigningComplete}
          totalPicks={signingSlots}
          existingSquad={nextSeasonPlayers}
          initialUsedClubYears={nextUsedClubYears}
          onProgress={() => {}}
        />
      )}
      {phase === "sell" && players.length > 0 && (
        <SellPhase players={players} onSell={handleSellPlayer} onSkip={handleSkipSell} seasonNumber={currentSeason} />
      )}
      {phase === "sell-signing" && settings && (
        <DraftPick
          settings={{ ...settings, draftOrder: "club-first", respins: 0 }}
          onComplete={handleSellSigningComplete}
          totalPicks={1}
          existingSquad={players}
          initialUsedClubYears={nextUsedClubYears}
          onProgress={() => {}}
        />
      )}
      {/* ↓ Uses SquadManagerDev for the between-seasons arrange phase too */}
      {phase === "arrange" && players.length > 0 && (
        <SquadManagerDev
          players={players}
          onConfirm={handleArrangeConfirm}
          title={`Season ${currentSeason}`}
          subtitle="Arrange Your Squad"
          formationName={settings?.formation}
          seasonNumber={currentSeason}
        />
      )}
    </div>
  );
}
