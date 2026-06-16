"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { FORMATIONS, getPositionColor, getPositionTextColor } from "./formations";
import ImageWithFallback from "@/components/ImageWithFallback";
import type { DraftSettings, DraftPlayer } from "@/app/draft/page";
import type { PlayerAttributes } from "@/lib/seasonSimulator";

interface RosterPlayer {
  sofifa_id: string;
  name: string;
  overall: number;
  potential: number;
  positions: string;
  age: number;
  image_url: string | null;
  nationality: string;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  finishing: number;
  positioning: number;
  crossing: number;
  vision: number;
  longShots: number;
  shortPassing: number;
  longPassing: number;
  heading: number;
  interceptions: number;
  standingTackle: number;
  marking: number;
  reactions: number;
  sprintSpeed: number;
  gkDiving: number;
  gkPositioning: number;
  gkReflexes: number;
}

interface SpinResult {
  club: string;
  year: number;
  roster: RosterPlayer[];
}

interface Props {
  settings: DraftSettings;
  onComplete: (players: DraftPlayer[]) => void;
  onBack?: () => void;
  isMultiplayer?: boolean;
  initialPicked?: DraftPlayer[];
  initialUsedClubYears?: string[];
  initialSlotAssignments?: (number | undefined)[];
  onProgress?: (picked: DraftPlayer[], usedClubYears: string[], slotAssignments?: (number | undefined)[]) => void;
  totalPicks?: number;
  existingSquad?: DraftPlayer[];
}

const BENCH_POSITIONS: { label: string; positions: string[] }[] = [
  { label: "GK",  positions: ["GK"] },
  { label: "CB",  positions: ["CB"] },
  { label: "LB",  positions: ["LB", "LWB"] },
  { label: "RB",  positions: ["RB", "RWB"] },
  { label: "CDM", positions: ["CDM"] },
  { label: "CM",  positions: ["CM"] },
  { label: "CAM", positions: ["CAM"] },
  { label: "LM",  positions: ["LM", "LW"] },
  { label: "RM",  positions: ["RM", "RW"] },
  { label: "LW",  positions: ["LW", "LM"] },
  { label: "RW",  positions: ["RW", "RM"] },
  { label: "ST",  positions: ["ST", "CF"] },
  { label: "CF",  positions: ["CF", "ST"] },
];

function classifyPos(pos: string): "GK" | "DEF" | "MID" | "ATT" {
  const p = pos.toUpperCase().trim();
  if (p === "GK") return "GK";
  if (["CB", "RB", "LB", "RWB", "LWB", "SW"].includes(p)) return "DEF";
  if (["CDM", "CM", "CAM", "RM", "LM", "DM"].includes(p)) return "MID";
  return "ATT";
}

function keyStatForSlot(slotLabel: string): { label: string; pick: (p: RosterPlayer) => number }[] {
  const s = slotLabel.toUpperCase().trim();

  if (s === "GK") return [
    { label: "OVR", pick: (p) => p.overall },
  ];
  if (s === "CB") return [
    { label: "DEF", pick: (p) => p.defending },
    { label: "PHY", pick: (p) => p.physical },
    { label: "PAC", pick: (p) => p.pace },
  ];
  if (s === "RB" || s === "LB" || s === "RWB" || s === "LWB") return [
    { label: "DEF", pick: (p) => p.defending },
    { label: "CRS", pick: (p) => p.crossing },
    { label: "PAC", pick: (p) => p.pace },
  ];
  if (s === "CDM") return [
    { label: "DEF", pick: (p) => p.defending },
    { label: "PHY", pick: (p) => p.physical },
    { label: "PAS", pick: (p) => p.passing },
  ];
  if (s === "CAM") return [
    { label: "PAS", pick: (p) => p.passing },
    { label: "DRI", pick: (p) => p.dribbling },
    { label: "SHO", pick: (p) => p.shooting },
  ];
  if (s === "CM") return [
    { label: "DEF", pick: (p) => p.defending },
    { label: "PAS", pick: (p) => p.passing },
    { label: "SHO", pick: (p) => p.shooting },
  ];
  if (s === "RM" || s === "LM") return [
    { label: "PAC", pick: (p) => p.pace },
    { label: "DRI", pick: (p) => p.dribbling },
    { label: "DEF", pick: (p) => p.defending },
  ];
  if (s === "RW" || s === "LW") return [
    { label: "PAC", pick: (p) => p.pace },
    { label: "DRI", pick: (p) => p.dribbling },
    { label: "SHO", pick: (p) => p.shooting },
  ];
  if (s === "ST" || s === "CF") return [
    { label: "SHO", pick: (p) => p.shooting },
    { label: "DRI", pick: (p) => p.dribbling },
    { label: "PHY", pick: (p) => p.physical },
  ];
  return [
    { label: "SHO", pick: (p) => p.shooting },
    { label: "PAS", pick: (p) => p.passing },
    { label: "PAC", pick: (p) => p.pace },
  ];
}

function statColor(val: number): string {
  if (val >= 85) return "text-emerald-400";
  if (val >= 75) return "text-yellow-400";
  if (val >= 60) return "text-orange-400";
  if (val > 0) return "text-gray-500";
  return "text-gray-700";
}

export default function DraftPick({
  settings,
  onComplete,
  onBack,
  isMultiplayer,
  initialPicked,
  initialUsedClubYears,
  initialSlotAssignments,
  onProgress,
  totalPicks,
  existingSquad,
}: Props) {
  const formation = FORMATIONS.find((f) => f.name === settings.formation) ?? FORMATIONS[0];
  const isClubFirst = settings.draftOrder === "club-first";
  const maxPicks = totalPicks ?? 14;
  const isSeason2Draft = !!existingSquad;
  const [pickedPlayers, setPickedPlayers] = useState<DraftPlayer[]>(initialPicked ?? []);
  const [confirmExit, setConfirmExit] = useState(false);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(initialPicked?.length ?? 0);
  const [phase, setPhase] = useState<"spin" | "spinning" | "reveal" | "pick" | "assign" | "assign-bench">("spin");
  const [pendingPlayer, setPendingPlayer] = useState<RosterPlayer | null>(null);
  const [slotAssignments, setSlotAssignments] = useState<(number | undefined)[]>(initialSlotAssignments ?? []);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinDisplay, setSpinDisplay] = useState<{ club: string; year: number } | null>(null);
  const [usedClubYears, setUsedClubYears] = useState<Set<string>>(
    new Set(initialUsedClubYears ?? [])
  );
  const [error, setError] = useState<string | null>(null);
  const [availableClubs, setAvailableClubs] = useState<{ name: string; seasons: number[] }[] | null>(null);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [spinItems, setSpinItems] = useState<{ club: string; year: number }[]>([]);
  const [spinAnimating, setSpinAnimating] = useState(false);
  const spinContainerRef = useRef<HTMLDivElement>(null);
  const maxRespins = settings.respins ?? 3;
  const [respinsRemaining, setRespinsRemaining] = useState(maxRespins);

  const loadClubs = useCallback(() => {
    setClubsLoading(true);
    setError(null);
    fetch("/api/draft/clubs")
      .then((r) => r.json())
      .then((d) => {
        if (d.clubs && d.clubs.length > 0) {
          setAvailableClubs(d.clubs);
        } else if (d.error) {
          setError(`Failed to load clubs: ${d.error}`);
        } else {
          setError("No Premier League clubs found in the database. Import player data first.");
        }
      })
      .catch((e) => {
        setError(`Failed to load clubs: ${e.message}`);
      })
      .finally(() => setClubsLoading(false));
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const getRandomClubYear = useCallback((): { club: string; year: number } | null => {
    if (!availableClubs || availableClubs.length === 0) return null;

    // Build all valid (club, year) pairs
    const allPairs: { club: string; year: number }[] = [];
    for (const c of availableClubs) {
      for (const y of c.seasons) {
        if (y >= settings.eraStart && y <= settings.eraEnd && !usedClubYears.has(`${c.name}-${y}`)) {
          allPairs.push({ club: c.name, year: y });
        }
      }
    }

    if (allPairs.length === 0) return null;

    // Group by year for balanced selection: pick a year first, then a club
    const byYear = new Map<number, { club: string; year: number }[]>();
    for (const pair of allPairs) {
      if (!byYear.has(pair.year)) byYear.set(pair.year, []);
      byYear.get(pair.year)!.push(pair);
    }

    const years = Array.from(byYear.keys());
    const year = years[Math.floor(Math.random() * years.length)];
    const clubsForYear = byYear.get(year)!;
    return clubsForYear[Math.floor(Math.random() * clubsForYear.length)];
  }, [availableClubs, settings.eraStart, settings.eraEnd, usedClubYears]);

  const generateSpinItems = useCallback((target: { club: string; year: number }): { club: string; year: number }[] => {
    const items: { club: string; year: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const rand = getRandomClubYear();
      if (rand) {
        items.push(rand);
      } else {
        items.push(target);
      }
    }
    items.push(target);
    return items;
  }, [getRandomClubYear]);

  const handleSpin = useCallback(async () => {
    setError(null);
    setSpinning(true);
    setPhase("spinning");

    const target = getRandomClubYear();
    if (!target) {
      setError("No more available clubs in this era range");
      setSpinning(false);
      setPhase("spin");
      return;
    }

    const items = generateSpinItems(target);
    setSpinItems(items);
    setSpinAnimating(false);
    setSpinDisplay(items[0]);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinAnimating(true);
      });
    });

    setTimeout(() => {
      setSpinDisplay(target);
      setPhase("pick");
      fetchRoster(target.club, target.year);
    }, 2200);
  }, [getRandomClubYear, generateSpinItems]);

  const handleRespin = useCallback(() => {
    if (respinsRemaining <= 0) return;
    setRespinsRemaining(r => Math.max(0, r - 1) as 0 | 1 | 3);
    setSpinResult(null);
    setSpinDisplay(null);
    setSpinAnimating(false);
    setPhase("spin");
    setSpinning(false);
    setTimeout(() => {
      handleSpin();
    }, 50);
  }, [handleSpin, respinsRemaining]);

  const fetchRoster = async (club: string, year: number) => {
    try {
      let url = `/api/draft/roster?club=${encodeURIComponent(club)}&year=${year}`;
      if (settings.mode === "prime") url += "&prime=true";
      const res = await fetch(url);
      const data = await res.json();
      if (data.roster && data.roster.length > 0) {
        setSpinResult({ club, year, roster: data.roster });
      } else {
        setError(`No players found for ${club} ${year}`);
        setPhase("spin");
      }
    } catch {
      setError("Failed to fetch roster");
      setPhase("spin");
    }
    setSpinning(false);
  };

  const buildAttrs = (player: RosterPlayer): PlayerAttributes => ({
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    finishing: player.finishing,
    positioning: player.positioning,
    crossing: player.crossing,
    vision: player.vision,
    longShots: player.longShots,
    shortPassing: player.shortPassing,
    longPassing: player.longPassing,
    heading: player.heading,
    interceptions: player.interceptions,
    standingTackle: player.standingTackle,
    marking: player.marking,
    reactions: player.reactions,
    sprintSpeed: player.sprintSpeed,
    gkDiving: player.gkDiving,
    gkPositioning: player.gkPositioning,
    gkReflexes: player.gkReflexes,
  });

  const buildClubAbbr = () =>
    spinResult!.club.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3);

  // Club-first handles bench via the assign grid, so isSubPick only applies to position-first
  const isSubPick = !isClubFirst && pickedPlayers.length >= 11 && !isSeason2Draft;

  const finalizePick = useCallback(
    (player: RosterPlayer, slotLabel: string, slotIdx?: number, isBench?: boolean) => {
      const currentIsSub = !!isBench || (!isClubFirst && pickedPlayers.length >= 11 && !isSeason2Draft);
      const drafted: DraftPlayer = {
        name: player.name,
        overall: player.overall,
        positions: player.positions,
        club: spinResult!.club,
        clubYear: `${buildClubAbbr()} ${spinResult!.year}`,
        assignedPosition: slotLabel,
        sofifa_id: player.sofifa_id,
        image_url: player.image_url,
        nationality: player.nationality,
        age: player.age || 0,
        isSub: currentIsSub || isSeason2Draft,
        attrs: buildAttrs(player),
      };

      const newPicked = [...pickedPlayers, drafted];
      const newUsed: string[] = [
        ...Array.from(usedClubYears) as string[],
        `${spinResult!.club}-${spinResult!.year}`,
      ];
      const newAssignments = [...slotAssignments, slotIdx];

      setPickedPlayers(newPicked);
      setUsedClubYears(new Set(newUsed));
      setSlotAssignments(newAssignments);
      setPendingPlayer(null);

      if (newPicked.length >= maxPicks) {
        onComplete(newPicked);
      } else {
        onProgress?.(newPicked, newUsed, newAssignments);
        if (!currentIsSub) setCurrentSlotIndex(currentSlotIndex + 1);
        setSpinResult(null);
        setSpinDisplay(null);
        setSpinAnimating(false);
        setRespinsRemaining(maxRespins);
        setPhase("spin");
      }
    },
    [currentSlotIndex, onComplete, onProgress, pickedPlayers, spinResult, usedClubYears, slotAssignments, maxPicks, isSeason2Draft]
  );

  const handlePickPlayer = useCallback(
    (player: RosterPlayer) => {
      if (isSeason2Draft) {
        // Season 2 signing: auto-assign primary position
        const primaryPos = (player.positions || "CM").split(",")[0]?.trim() || "CM";
        finalizePick(player, primaryPos);
        return;
      }
      if (isSubPick) {
        // Sub pick in position-first: auto-assign primary position
        const primaryPos = (player.positions || "CM").split(",")[0]?.trim() || "CM";
        finalizePick(player, primaryPos, undefined, true);
        return;
      }
      if (isClubFirst) {
        // Club-first: show assign grid (includes bench option)
        setPendingPlayer(player);
        setPhase("assign");
        return;
      }
      const slot = formation.slots[currentSlotIndex];
      finalizePick(player, slot.label);
    },
    [isClubFirst, isSubPick, isSeason2Draft, currentSlotIndex, formation.slots, finalizePick]
  );

  const handleAssignSlot = useCallback(
    (slotIndex: number) => {
      if (!pendingPlayer) return;
      const slot = formation.slots[slotIndex];
      finalizePick(pendingPlayer, slot.label, slotIndex);
    },
    [pendingPlayer, formation.slots, finalizePick]
  );

  // Map slot indices to picked players for pitch rendering
  const filledSlots = new Set(isClubFirst ? slotAssignments.filter((s): s is number => s !== undefined) : Array.from({ length: pickedPlayers.length }, (_, i) => i));
  const slotToPlayer = new Map<number, DraftPlayer>();
  if (isClubFirst) {
    pickedPlayers.forEach((p, pickIdx) => {
      const s = slotAssignments[pickIdx];
      if (s !== undefined) {
        slotToPlayer.set(s, p);
      }
    });
  } else {
    pickedPlayers.forEach((p, i) => slotToPlayer.set(i, p));
  }

  const existingSlotMap = useMemo(() => {
    if (!existingSquad) return new Map<number, DraftPlayer>();
    const map = new Map<number, DraftPlayer>();
    const starters = existingSquad.filter(p => !p.isSub);
    const usedSlots = new Set<number>();
    for (const player of starters) {
      const slotIdx = formation.slots.findIndex((slot, i) =>
        !usedSlots.has(i) && slot.label === player.assignedPosition
      );
      if (slotIdx >= 0) {
        map.set(slotIdx, player);
        usedSlots.add(slotIdx);
      }
    }
    return map;
  }, [existingSquad, formation.slots]);

  const currentSlot = formation.slots[currentSlotIndex];
  const keyStats = currentSlot ? keyStatForSlot(currentSlot.label) : [];
  const clubFirstStats: { label: string; pick: (p: RosterPlayer) => number }[] = [
    { label: "PAC", pick: (p) => p.pace },
    { label: "SHO", pick: (p) => p.shooting },
    { label: "PAS", pick: (p) => p.passing },
    { label: "DRI", pick: (p) => p.dribbling },
    { label: "DEF", pick: (p) => p.defending },
    { label: "PHY", pick: (p) => p.physical },
  ];
  const displayStats = (isClubFirst || isSubPick || isSeason2Draft) ? clubFirstStats : keyStats;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
      {/* Header with progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {onBack && (pickedPlayers.length === 0 || isMultiplayer) && (
              <>
                <button
                  onClick={() => isMultiplayer ? setConfirmExit(true) : onBack()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition"
                  aria-label="Back"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {/* Confirm exit dialog */}
                {confirmExit && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl">
                      <div className="text-2xl mb-3">🚪</div>
                      <h3 className="text-white font-black text-lg mb-2">Leave the Draft?</h3>
                      <p className="text-gray-400 text-sm mb-5">You'll go back to the lobby. Any picks you've made will be lost.</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmExit(false)}
                          className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm transition"
                        >
                          Stay
                        </button>
                        <button
                          onClick={() => { setConfirmExit(false); onBack(); }}
                          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition"
                        >
                          Leave
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                <span className="text-white">PL</span>{" "}
                <span className="text-emerald-400">DRAFT</span>
              </h1>
              <p className="text-gray-500 text-xs">
                {settings.formation}
                {settings.mode === "prime" && (
                  <span className="ml-1.5 text-amber-400 font-bold">· PRIME</span>
                )}
                {isClubFirst && (
                  <span className="ml-1.5 text-sky-400 font-bold">· CLUB FIRST</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            {isSeason2Draft ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  New Signing
                </div>
                <div className="text-lg font-extrabold text-amber-400">
                  {pickedPlayers.length + 1}/{maxPicks}
                </div>
              </>
            ) : isSubPick ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  Substitute
                </div>
                <div className="text-lg font-extrabold text-purple-400">
                  {pickedPlayers.length - 11 + 1}/3
                </div>
              </>
            ) : isClubFirst ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  Pick
                </div>
                <div className="text-lg font-extrabold text-sky-400">
                  {pickedPlayers.length + 1}/14
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  Picking for
                </div>
                <div className={`text-lg font-extrabold ${getPositionTextColor(currentSlot?.label ?? "")}`}>
                  {currentSlot?.label}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1 items-center">
            {Array.from({ length: maxPicks }, (_, i) => (
              <div key={i} className="contents">
                {i === 11 && !isSeason2Draft && <div className="w-1 h-3 bg-gray-700 rounded-full mx-0.5 shrink-0" />}
                <div
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < pickedPlayers.length
                      ? i >= 11 && !isSeason2Draft ? "bg-purple-500" : "bg-emerald-500"
                      : i === pickedPlayers.length
                        ? i >= 11 && !isSeason2Draft ? "bg-purple-500/40 animate-pulse" : "bg-emerald-500/40 animate-pulse"
                        : "bg-gray-800"
                  }`}
                />
              </div>
            ))}
          </div>
          <span className="text-xs font-bold text-gray-500 tabular-nums">
            {pickedPlayers.length}/{maxPicks}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pitch with picked players — on mobile, show below the action area */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="relative w-full aspect-[4/3] lg:aspect-[3/4] max-h-[35vh] sm:max-h-[50vh] lg:max-h-none mx-auto rounded-xl overflow-hidden border border-emerald-800/40">
            {/* Pitch gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 via-emerald-900/40 to-emerald-950/80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-800/20 via-transparent to-transparent" />

            {/* Pitch lines */}
            <div className="absolute inset-x-[10%] top-[5%] bottom-[5%] border border-emerald-600/30 rounded" />
            <div className="absolute inset-x-[10%] top-[5%] h-[18%] border-b border-emerald-600/30" />
            <div className="absolute inset-x-[10%] bottom-[5%] h-[18%] border-t border-emerald-600/30" />
            <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-emerald-600/30" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-emerald-600/30" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-600/40" />

            {formation.slots.map((slot, i) => {
              const picked = slotToPlayer.get(i);
              const existing = existingSlotMap.get(i);
              const displayPlayer = picked || existing;
              const isCurrent = !isClubFirst && i === currentSlotIndex && !displayPlayer;
              const isAssignable = isClubFirst && phase === "assign" && !displayPlayer;
              const pendingPositions = pendingPlayer
                ? (pendingPlayer.positions || "").split(",").map((p) => p.trim())
                : [];
              const isNaturalFit = isAssignable && pendingPositions.includes(slot.label);
              return (
                <div
                  key={i}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300 ${
                    isAssignable ? "cursor-pointer" : ""
                  }`}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  onClick={() => isAssignable && handleAssignSlot(i)}
                >
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-extrabold border-2 transition-all duration-300 ${
                      displayPlayer
                        ? `${getPositionColor(slot.label)} ${existing && !picked ? 'border-white/50 text-white/80' : 'border-white/80 text-white'} shadow-lg`
                        : isCurrent
                          ? "bg-emerald-500/80 border-emerald-300 text-white animate-pulse shadow-lg shadow-emerald-500/30"
                          : isNaturalFit
                            ? "bg-emerald-600/80 border-emerald-400 text-white animate-pulse shadow-lg shadow-emerald-500/30"
                            : isAssignable
                              ? "bg-gray-700/80 border-sky-500/60 text-sky-300 hover:bg-sky-900/40 hover:border-sky-400"
                              : "bg-gray-800/80 border-gray-600/50 text-gray-500"
                    }`}
                  >
                    {displayPlayer ? (
                      <span className="text-sm font-black">{displayPlayer.overall}</span>
                    ) : (
                      slot.label
                    )}
                  </div>
                  <span
                    className={`text-[8px] mt-0.5 max-w-[56px] sm:max-w-[64px] truncate text-center font-medium ${
                      displayPlayer ? "text-white/90" : "text-gray-600"
                    }`}
                  >
                    {displayPlayer ? displayPlayer.name.split(" ").pop() : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Sub bench — visible during sub picks or when subs exist in club-first */}
          {(isSubPick || (isClubFirst && pickedPlayers.filter(p => p.isSub).length > 0)) && (
            <div className="mt-3 bg-purple-900/10 border border-purple-700/30 rounded-xl p-3">
              <div className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-2">
                Bench ({pickedPlayers.filter(p => p.isSub).length}/3)
              </div>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2].map(i => {
                  const sub = pickedPlayers.filter(p => p.isSub)[i];
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${
                        sub
                          ? "bg-purple-900/30 border border-purple-600/40"
                          : i === pickedPlayers.filter(p => p.isSub).length
                            ? "bg-purple-900/20 border-2 border-purple-500/50 border-dashed animate-pulse"
                            : "bg-gray-800/50 border border-gray-700/30"
                      }`}
                    >
                      {sub ? (
                        <>
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(sub.assignedPosition)} text-white`}>
                            {sub.assignedPosition}
                          </span>
                          <span className="font-medium">{sub.name.split(" ").pop()}</span>
                          <span className="font-extrabold text-emerald-400">{sub.overall}</span>
                        </>
                      ) : (
                        <span className="text-gray-500 font-medium">Sub {i + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Picked list — compact on mobile, full on desktop */}
          {pickedPlayers.length > 0 && (
            <div className="mt-3 hidden lg:block space-y-1">
              {pickedPlayers.filter(p => !p.isSub).map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm bg-gray-900/80 border border-gray-800/50 rounded-lg px-3 py-1.5 hover:bg-gray-800/80 transition"
                >
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(
                      p.assignedPosition
                    )} text-white`}
                  >
                    {p.assignedPosition}
                  </span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                  <span className="font-extrabold text-emerald-400 text-sm">{p.overall}</span>
                </div>
              ))}
              {pickedPlayers.filter(p => p.isSub).length > 0 && (
                <>
                  <div className={`text-[10px] font-bold tracking-widest uppercase pt-2 ${isSeason2Draft ? "text-amber-400" : "text-purple-400"}`}>
                    {isSeason2Draft ? "New Signings" : "Substitutes"}
                  </div>
                  {pickedPlayers.filter(p => p.isSub).map((p, i) => (
                    <div
                      key={`sub-${i}`}
                      className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 transition ${
                        isSeason2Draft
                          ? "bg-amber-900/10 border border-amber-800/30 hover:bg-amber-900/20"
                          : "bg-purple-900/10 border border-purple-800/30 hover:bg-purple-900/20"
                      }`}
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                        {p.assignedPosition}
                      </span>
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                      <span className="font-extrabold text-emerald-400 text-sm">{p.overall}</span>
                    </div>
                  ))}
                </>
              )}
              {/* Existing subs from previous season — shown during Season 2 signing */}
              {isSeason2Draft && existingSquad && existingSquad.filter(p => p.isSub).length > 0 && (
                <>
                  <div className="text-[10px] font-bold tracking-widest uppercase pt-2 text-purple-400">
                    Existing Subs
                  </div>
                  {existingSquad.filter(p => p.isSub).map((p, i) => (
                    <div
                      key={`existing-sub-${i}`}
                      className="flex items-center gap-2 text-sm bg-purple-900/10 border border-purple-800/30 rounded-lg px-3 py-1.5"
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                        {p.assignedPosition}
                      </span>
                      <span className="flex-1 truncate font-medium text-gray-300">{p.name}</span>
                      <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                      <span className="font-extrabold text-purple-400 text-sm">{p.overall}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {pickedPlayers.length > 0 && (
            <div className="mt-3 lg:hidden flex gap-1.5 overflow-x-auto pb-1">
              {pickedPlayers.filter(p => !p.isSub).map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs bg-gray-900/80 border border-gray-800/50 rounded-lg px-2 py-1 shrink-0"
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                    {p.assignedPosition}
                  </span>
                  <span className="font-medium">{p.name.split(" ").pop()}</span>
                  <span className="font-extrabold text-emerald-400">{p.overall}</span>
                </div>
              ))}
              {pickedPlayers.filter(p => p.isSub).map((p, i) => (
                <div
                  key={`sub-${i}`}
                  className="flex items-center gap-1.5 text-xs bg-purple-900/20 border border-purple-800/30 rounded-lg px-2 py-1 shrink-0"
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded bg-purple-700 text-white`}>
                    {p.assignedPosition}
                  </span>
                  <span className="font-medium">{p.name.split(" ").pop()}</span>
                  <span className="font-extrabold text-emerald-400">{p.overall}</span>
                </div>
              ))}
              {isSeason2Draft && existingSquad?.filter(p => p.isSub).map((p, i) => (
                <div
                  key={`existing-sub-mobile-${i}`}
                  className="flex items-center gap-1.5 text-xs bg-purple-900/10 border border-purple-800/20 rounded-lg px-2 py-1 shrink-0"
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                    {p.assignedPosition}
                  </span>
                  <span className="font-medium text-gray-400">{p.name.split(" ").pop()}</span>
                  <span className="font-extrabold text-purple-400">{p.overall}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Spin & Pick — on mobile, show first */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 mb-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {phase === "spin" && (
            <div className="flex flex-col items-center justify-center py-8 sm:py-16">
              <div className="mb-6 text-center">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 ${
                  isSeason2Draft ? "text-amber-400" :
                  isSubPick ? "text-purple-400" :
                  isClubFirst ? "text-sky-400" : getPositionTextColor(currentSlot?.label ?? "")
                } border-current/20 bg-current/5`}>
                  <span className="text-xs font-bold tracking-widest uppercase">
                    {isSeason2Draft
                      ? `New Signing ${pickedPlayers.length + 1} of ${maxPicks}`
                      : isClubFirst
                        ? `Pick ${pickedPlayers.length + 1} of 14`
                        : isSubPick
                          ? `Substitute ${pickedPlayers.length - 11 + 1} of 3`
                          : `Pick ${pickedPlayers.length + 1} of 11`
                    }
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  {isSeason2Draft
                    ? "Spin to sign a replacement player"
                    : "Spin to get a random Premier League club & season"
                  }
                </p>
              </div>
              {!availableClubs && !clubsLoading && error ? (
                <button
                  onClick={loadClubs}
                  className="px-10 py-4 bg-red-800 hover:bg-red-700 rounded-2xl text-lg font-extrabold transition-all"
                >
                  Retry Loading Clubs
                </button>
              ) : (
                <button
                  onClick={handleSpin}
                  disabled={!availableClubs || clubsLoading}
                  className="group relative px-10 sm:px-16 py-4 sm:py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-gray-700 disabled:to-gray-700 rounded-2xl text-lg sm:text-xl font-extrabold transition-all duration-300 shadow-lg shadow-emerald-900/50 hover:shadow-emerald-800/60 hover:scale-105 active:scale-95"
                >
                  {availableClubs ? (
                    <span className="flex items-center gap-3">
                      <svg className="w-6 h-6 transition-transform group-hover:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      SPIN
                    </span>
                  ) : (
                    "Loading clubs..."
                  )}
                </button>
              )}
            </div>
          )}

          {phase === "spinning" && (
            <div className="flex flex-col items-center justify-center py-8 sm:py-16">
              {/* Slot machine container */}
              <div className="relative w-full max-w-md h-24 overflow-hidden rounded-xl border border-emerald-700/40 bg-gray-900/80 mb-6">
                {/* Top fade */}
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-gray-900 to-transparent z-10 pointer-events-none" />
                {/* Bottom fade */}
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-900 to-transparent z-10 pointer-events-none" />
                {/* Center highlight line */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 border-y border-emerald-500/40 bg-emerald-500/5 z-10 pointer-events-none" />

                {/* Scrolling items */}
                <div
                  ref={spinContainerRef}
                  className="flex flex-col items-center"
                  style={{
                    transform: spinAnimating
                      ? `translateY(-${(spinItems.length - 1) * 96 - 12}px)`
                      : "translateY(12px)",
                    transition: spinAnimating
                      ? "transform 2.0s cubic-bezier(0.15, 0.85, 0.25, 1)"
                      : "none",
                  }}
                >
                  {spinItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-center h-24 shrink-0"
                    >
                      <div className="text-lg sm:text-2xl font-extrabold text-white tracking-tight max-w-[280px] truncate text-center">
                        {item.club}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-emerald-400">
                        {item.year}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-gray-500 text-sm animate-pulse">Spinning...</p>
            </div>
          )}

          {phase === "pick" && spinDisplay && (
            <div>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">{spinDisplay.club}</h2>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 text-sm font-bold">
                    {spinDisplay.year >= 2024 ? "FC" : "FIFA"}{" "}
                    {String(spinDisplay.year % 100).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-gray-500 text-sm">
                  {isSeason2Draft ? (
                    "Sign a player from this roster"
                  ) : isClubFirst ? (
                    "Pick any player — assign to XI or bench"
                  ) : isSubPick ? (
                    "Pick a substitute from this roster"
                  ) : (
                    <>
                      Pick a player for{" "}
                      <span className={`font-bold ${getPositionTextColor(currentSlot?.label ?? "")}`}>
                        {currentSlot?.label}
                      </span>
                      {" "}&middot;{" "}
                      <span className="hidden sm:inline text-emerald-500/60 font-medium">
                        compatible: {currentSlot?.compatiblePositions.join(", ")}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {/* Re-spin button */}
              {maxRespins > 0 && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={handleRespin}
                    disabled={spinning || respinsRemaining <= 0}
                    className={`px-5 py-2 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2 ${
                      respinsRemaining > 0
                        ? "bg-gray-800 hover:bg-gray-700 border border-gray-700/50 text-gray-300"
                        : "bg-gray-900 border border-gray-800/30 text-gray-700 cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Re-spin
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ml-1 ${
                      respinsRemaining > 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-gray-800 text-gray-600"
                    }`}>
                      {respinsRemaining}/{maxRespins}
                    </span>
                  </button>
                </div>
              )}

              {!spinResult && (
                <div className="flex flex-col items-center justify-center py-8 sm:py-16">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-gray-500 text-sm">Loading roster...</p>
                </div>
              )}

              {spinResult && <div className="max-h-[60vh] overflow-y-auto">
                {/* Stat column headers — desktop only */}
                {displayStats.length > 0 && (
                  <div className="hidden sm:flex items-center gap-3 px-4 mb-1 sticky top-0 bg-gray-950 z-10 py-1">
                    <div className="w-9 shrink-0" />
                    <div className="w-10 shrink-0" />
                    <div className="flex-1 min-w-0" />
                    <div className="shrink-0" />
                    <div className="flex gap-0 shrink-0">
                      {displayStats.map((ks) => (
                        <span key={ks.label} className="w-9 text-center text-[9px] font-bold tracking-wider text-gray-600 uppercase">
                          {ks.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                {[...spinResult.roster]
                  .sort((a, b) => {
                    if (!isClubFirst) {
                      const aCompat = currentSlot?.compatiblePositions.some((cp) =>
                        (a.positions || "").split(",").map((p) => p.trim()).includes(cp)
                      ) ? 1 : 0;
                      const bCompat = currentSlot?.compatiblePositions.some((cp) =>
                        (b.positions || "").split(",").map((p) => p.trim()).includes(cp)
                      ) ? 1 : 0;
                      if (bCompat !== aCompat) return bCompat - aCompat;
                    }
                    return b.overall - a.overall;
                  })
                  .map((player) => {
                  const playerPositions = (player.positions || "")
                    .split(",")
                    .map((p) => p.trim())
                    .filter(Boolean);
                  const isCompatible = !isClubFirst && currentSlot?.compatiblePositions.some((cp) =>
                    playerPositions.includes(cp)
                  );
                  const alreadyPicked = pickedPlayers.some(
                    (p) => p.sofifa_id === player.sofifa_id || p.name === player.name
                  ) || (existingSquad?.some(
                    (p) => p.name === player.name
                  ) ?? false);
                  const isGk = playerPositions.includes("GK") && (player.gkDiving > 0 || player.gkReflexes > 0);
                  const hasStats = isClubFirst ? !isGk && (player.pace > 0 || player.shooting > 0) : player.pace > 0 || player.shooting > 0;

                  return (
                    <button
                      key={player.sofifa_id}
                      onClick={() => handlePickPlayer(player)}
                      disabled={alreadyPicked}
                      className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-left transition-all duration-150 group ${
                        alreadyPicked
                          ? "opacity-20 cursor-not-allowed bg-gray-900/50"
                          : isClubFirst
                            ? "bg-gray-900/50 hover:bg-gray-800/80 border border-gray-700/30 hover:border-gray-600/50 hover:scale-[1.01]"
                            : isCompatible
                              ? "bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-700/40 hover:border-emerald-600/60 hover:scale-[1.01]"
                              : "bg-gray-900/50 hover:bg-gray-800/80 border border-transparent hover:border-gray-700/50"
                      }`}
                    >
                      {player.image_url ? (
                        <ImageWithFallback
                          src={player.image_url}
                          alt={player.name}
                          fallbackText=""
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-800 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-800 shrink-0" />
                      )}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-extrabold text-xs sm:text-sm shrink-0 ${
                        player.overall >= 85
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : player.overall >= 75
                            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            : "bg-gray-800/80 text-gray-400 border border-gray-700/40"
                      }`}>
                        {player.overall}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate group-hover:text-white transition-colors">
                          {player.name}
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-500">
                          {player.nationality} &middot; Age {player.age}
                        </div>
                        {hasStats && (
                          <div className="flex gap-2 sm:hidden mt-0.5">
                            {displayStats.slice(0, 3).map((ks) => {
                              const val = ks.pick(player);
                              return (
                                <span key={ks.label} className={`text-[10px] font-bold tabular-nums ${statColor(val)}`}>
                                  <span className="text-gray-600">{ks.label}</span> {val > 0 ? val : "-"}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {playerPositions.map((pos) => (
                          <span
                            key={pos}
                            className={`text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded ${
                              isClubFirst || currentSlot?.compatiblePositions.includes(pos)
                                ? getPositionColor(pos) + " text-white"
                                : "bg-gray-800 text-gray-500"
                            }`}
                          >
                            {pos}
                          </span>
                        ))}
                      </div>
                      {hasStats && (
                        <div className="hidden sm:flex gap-0 shrink-0">
                          {displayStats.map((ks) => {
                            const val = ks.pick(player);
                            return (
                              <span key={ks.label} className={`w-9 text-center text-[11px] font-bold tabular-nums ${statColor(val)}`}>
                                {val > 0 ? val : "-"}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              </div>}
            </div>
          )}

          {phase === "assign" && pendingPlayer && spinDisplay && (
            <div>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  {pendingPlayer.image_url ? (
                    <ImageWithFallback
                      src={pendingPlayer.image_url}
                      alt={pendingPlayer.name}
                      fallbackText=""
                      className="w-14 h-14 rounded-full bg-gray-800 object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-800" />
                  )}
                  <div className="text-left">
                    <div className="text-xl font-extrabold">{pendingPlayer.name}</div>
                    <div className="text-sm text-gray-400">
                      OVR <span className="text-emerald-400 font-bold">{pendingPlayer.overall}</span>
                      {" · "}
                      {spinDisplay.club}
                      {" · "}
                      {pendingPlayer.positions}
                    </div>
                  </div>
                </div>
                <p className="text-gray-500 text-sm">Choose a position to assign this player</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md mx-auto">
                {formation.slots.map((slot, i) => {
                  if (filledSlots.has(i)) return null;

                  const pendingPositions = (pendingPlayer.positions || "").split(",").map((p) => p.trim());
                  const isNatural = pendingPositions.includes(slot.label);

                  return (
                    <button
                      key={i}
                      onClick={() => handleAssignSlot(i)}
                      className={`relative py-3 px-4 rounded-xl text-center transition-all duration-200 hover:scale-105 active:scale-95 ${
                        isNatural
                          ? "bg-emerald-900/30 border-2 border-emerald-600/60 hover:bg-emerald-900/50 hover:border-emerald-400 shadow-lg shadow-emerald-900/20"
                          : "bg-gray-800/80 border border-gray-700/50 hover:bg-gray-700 hover:border-gray-500"
                      }`}
                    >
                      <div className={`text-lg font-extrabold ${getPositionTextColor(slot.label)}`}>
                        {slot.label}
                      </div>
                      {isNatural && (
                        <div className="text-[10px] font-bold text-emerald-500 mt-0.5">NATURAL FIT</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Bench option — available as long as bench isn't full */}
              {pickedPlayers.filter(p => p.isSub).length < 3 && (
                <div className="mt-4 max-w-md mx-auto">
                  <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase text-center mb-2">or</div>
                  <button
                    onClick={() => {
                      if (!pendingPlayer) return;
                      const primaryPos = (pendingPlayer.positions || "CM").split(",")[0]?.trim() || "CM";
                      finalizePick(pendingPlayer, primaryPos, undefined, true);
                    }}
                    className="w-full py-3 px-4 rounded-xl text-center border-2 border-purple-600/50 bg-purple-900/20 hover:bg-purple-900/40 hover:border-purple-500 transition-all active:scale-95"
                  >
                    <div className="text-lg font-extrabold text-purple-400">BENCH</div>
                    <div className="text-[10px] text-purple-500/70 mt-0.5">
                      {3 - pickedPlayers.filter(p => p.isSub).length} spot{3 - pickedPlayers.filter(p => p.isSub).length !== 1 ? "s" : ""} remaining
                    </div>
                  </button>
                </div>
              )}

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => { setPendingPlayer(null); setPhase("pick"); }}
                  className="px-5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-lg font-bold text-sm transition-all text-gray-300"
                >
                  Back to roster
                </button>
              </div>
            </div>
          )}

          {/* Bench position picker — for both club-first bench and position-first sub picks */}
          {phase === "assign-bench" && pendingPlayer && spinDisplay && (
            <div>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-3 mb-3">
                  {pendingPlayer.image_url ? (
                    <ImageWithFallback
                      src={pendingPlayer.image_url}
                      alt={pendingPlayer.name}
                      fallbackText=""
                      className="w-14 h-14 rounded-full bg-gray-800 object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-800" />
                  )}
                  <div className="text-left">
                    <div className="text-xl font-extrabold">{pendingPlayer.name}</div>
                    <div className="text-sm text-gray-400">
                      OVR <span className="text-purple-400 font-bold">{pendingPlayer.overall}</span>
                      {" · "}{spinDisplay.club}{" · "}{pendingPlayer.positions}
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-purple-900/30 border border-purple-600/40 rounded-full px-3 py-1">
                  <span className="text-purple-400 font-bold text-xs">BENCH</span>
                </div>
                <p className="text-gray-500 text-sm mt-2">Choose their bench position</p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-w-md mx-auto">
                {BENCH_POSITIONS.map((bp) => {
                  const playerPositions = (pendingPlayer.positions || "").split(",").map(p => p.trim());
                  const isNatural = bp.positions.some(p => playerPositions.includes(p)) || playerPositions.includes(bp.label);
                  return (
                    <button
                      key={bp.label}
                      onClick={() => finalizePick(pendingPlayer, bp.label, undefined, true)}
                      className={`relative py-3 px-2 rounded-xl text-center transition-all duration-200 hover:scale-105 active:scale-95 ${
                        isNatural
                          ? "bg-emerald-900/30 border-2 border-emerald-600/60 hover:bg-emerald-900/50 hover:border-emerald-400"
                          : "bg-gray-800/80 border border-gray-700/50 hover:bg-gray-700 hover:border-gray-500"
                      }`}
                    >
                      <div className={`text-base font-extrabold ${getPositionTextColor(bp.label)}`}>
                        {bp.label}
                      </div>
                      {isNatural && (
                        <div className="text-[9px] font-bold text-emerald-500 mt-0.5">FIT</div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setPhase(isClubFirst ? "assign" : "pick")}
                  className="px-5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-lg font-bold text-sm transition-all text-gray-300"
                >
                  {isClubFirst ? "Back to positions" : "Back to roster"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline keyframes for the reveal animation */}
      <style jsx>{`
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
