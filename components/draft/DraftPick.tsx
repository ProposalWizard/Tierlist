"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { FORMATIONS, getPositionColor, getPositionTextColor, formatSeasonYear } from "./formations";
import ImageWithFallback from "@/components/ImageWithFallback";
import type { DraftSettings, DraftPlayer } from "@/app/draft/page";
import type { PlayerAttributes } from "@/lib/seasonSimulator";
import { getFlagUrl } from "@/lib/nationalities";

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
  respinsRemaining?: number;
  onUseRespin?: () => void;
}


function classifyPos(pos: string): "GK" | "DEF" | "MID" | "ATT" {
  const p = pos.toUpperCase().trim();
  if (p === "GK") return "GK";
  if (["CB", "RB", "LB", "RWB", "LWB", "SW"].includes(p)) return "DEF";
  if (["CDM", "CM", "CAM", "RM", "LM", "DM"].includes(p)) return "MID";
  return "ATT";
}

function slotFitness(playerPositions: string[], slotPos: string): number {
  const assigned = slotPos.toUpperCase().trim();
  const natural = playerPositions.map(p => p.trim().toUpperCase()).filter(Boolean);
  if (natural.length === 0) return 1.0;
  if (natural.includes(assigned)) return 1.0;
  const assignedRole = classifyPos(assigned);
  if (natural.some(p => classifyPos(p) === assignedRole)) return 0.96;
  const mediumPairs: [string[], string[]][] = [
    [["LB", "LWB"], ["LM"]],
    [["RB", "RWB"], ["RM"]],
    [["CDM", "DM"], ["CB"]],
  ];
  for (const [groupA, groupB] of mediumPairs) {
    if (groupA.includes(assigned) && natural.some(p => groupB.includes(p))) return 0.88;
    if (groupB.includes(assigned) && natural.some(p => groupA.includes(p))) return 0.88;
  }
  const adjacent: Record<string, string[]> = { ATT: ["MID"], MID: ["ATT", "DEF"], DEF: ["MID"], GK: [] };
  if (natural.some(p => (adjacent[assignedRole] ?? []).includes(classifyPos(p)))) return 0.82;
  return 0.6;
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
  if (val > 0) return "text-white";
  return "text-white";
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
  respinsRemaining: respinsRemainingProp,
  onUseRespin,
}: Props) {
  const formation = FORMATIONS.find((f) => f.name === settings.formation) ?? FORMATIONS[0];
  const isClubFirst = settings.draftOrder === "club-first";
  const maxPicks = totalPicks ?? 14;
  const isSeason2Draft = !!existingSquad;
  const [pickedPlayers, setPickedPlayers] = useState<DraftPlayer[]>(initialPicked ?? []);
  const [confirmExit, setConfirmExit] = useState(false);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(initialPicked?.length ?? 0);
  const [phase, setPhase] = useState<"spin" | "spinning" | "reveal" | "pick" | "assign">("spin");
  const [pendingPlayer, setPendingPlayer] = useState<RosterPlayer | null>(null);
  const [slotAssignments, setSlotAssignments] = useState<(number | undefined)[]>(() => {
    const initial = initialSlotAssignments ?? [];
    if (!isClubFirst && initial.length > 0 && initial.every(s => s === undefined)) {
      return initial.map((_, i) => i < 11 ? i : undefined);
    }
    return initial;
  });
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
  const [chosenSlotIdx, setChosenSlotIdx] = useState<number | null>(null);
  const [swapSel, setSwapSel] = useState<number | null>(null); // pickIdx selected for rearranging
  const spinContainerRef = useRef<HTMLDivElement>(null);
  // Spin timers, cleared on unmount so they don't setState / fetch after the
  // component is gone (e.g. leaving a multiplayer room mid-spin).
  const spinTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { spinTimersRef.current.forEach(clearTimeout); }, []);
  const maxRespins = settings.respins ?? 3;
  // If parent tracks respins across phases, use that; otherwise local state.
  const [localRespins, setLocalRespins] = useState(maxRespins);
  const respinsRemaining = respinsRemainingProp ?? localRespins;

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

    spinTimersRef.current.push(setTimeout(() => {
      setSpinDisplay(target);
      setPhase("pick");
      fetchRoster(target.club, target.year);
    }, 2200));
  }, [getRandomClubYear, generateSpinItems]);

  const handleRespin = useCallback(() => {
    if (respinsRemaining <= 0) return;
    if (onUseRespin) {
      onUseRespin();
    } else {
      setLocalRespins(r => Math.max(0, r - 1) as 0 | 1 | 3);
    }
    setSpinResult(null);
    setSpinDisplay(null);
    setSpinAnimating(false);
    setPhase("spin");
    setSpinning(false);
    spinTimersRef.current.push(setTimeout(() => {
      handleSpin();
    }, 50));
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

  const isSubPick = !isClubFirst && pickedPlayers.length >= 11 && !isSeason2Draft;

  const finalizePick = useCallback(
    (player: RosterPlayer, slotLabel: string, slotIdx?: number, isBench?: boolean) => {
      const currentIsSub = !!isBench || (!isClubFirst && pickedPlayers.length >= 11 && !isSeason2Draft);
      const drafted: DraftPlayer = {
        name: player.name,
        overall: player.overall,
        positions: player.positions,
        club: spinResult!.club,
        clubYear: `${buildClubAbbr()} ${formatSeasonYear(spinResult!.year)}`,
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
        if (!currentIsSub && !isClubFirst) setChosenSlotIdx(null);
        setSpinResult(null);
        setSpinDisplay(null);
        setSpinAnimating(false);
        setPhase("spin");
      }
    },
    [onComplete, onProgress, pickedPlayers, spinResult, usedClubYears, slotAssignments, maxPicks, isSeason2Draft, isClubFirst]
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
        const primaryPos = (player.positions || "CM").split(",")[0]?.trim() || "CM";
        finalizePick(player, primaryPos, undefined, true);
        return;
      }
      if (isClubFirst) {
        setPendingPlayer(player);
        setPhase("assign");
        return;
      }
      const slot = formation.slots[chosenSlotIdx!];
      finalizePick(player, slot.label, chosenSlotIdx!);
    },
    [isClubFirst, isSubPick, isSeason2Draft, chosenSlotIdx, formation.slots, finalizePick]
  );

  const handleAssignSlot = useCallback(
    (slotIndex: number) => {
      if (!pendingPlayer) return;
      const slot = formation.slots[slotIndex];
      finalizePick(pendingPlayer, slot.label, slotIndex);
    },
    [pendingPlayer, formation.slots, finalizePick]
  );

  // The old picked-player chip list is hidden (pitch + bench cover it). Kept in
  // code behind this flag rather than deleted. Typed boolean so TS still narrows.
  const showPickedList: boolean = false;

  // Map slot indices to picked players for pitch rendering
  const filledSlots = new Set(slotAssignments.filter((s): s is number => s !== undefined));
  const slotToPlayer = new Map<number, DraftPlayer>();
  const slotToPickIdx = new Map<number, number>();
  pickedPlayers.forEach((p, pickIdx) => {
    const s = slotAssignments[pickIdx];
    if (s !== undefined) {
      slotToPlayer.set(s, p);
      slotToPickIdx.set(s, pickIdx);
    }
  });

  // Season-2 signing bench = your remaining substitutes PLUS the new signings,
  // shown together and uncapped (a bad season can leave more than 3 to sort out).
  // You set the final XI on the arrange screen afterwards.
  const s2Bench: { p: DraftPlayer; isNew: boolean }[] = isSeason2Draft
    ? [
        ...(existingSquad ?? []).filter(p => p.isSub).map(p => ({ p, isNew: false })),
        ...pickedPlayers.filter(p => p.isSub).map(p => ({ p, isNew: true })),
      ]
    : [];

  // ── Rearrange placed players by tapping (idle draft only) ──────────────────
  // Swapping is a plain UI re-arrangement of already-picked players; it never
  // touches the spin/pick flow, so it's only enabled when the draft is idle.
  const canSwap = !isSeason2Draft && phase === "spin" && chosenSlotIdx === null && !pendingPlayer && !spinning;

  // Swap two picked players (starters and/or subs). isSub follows the slot, so a
  // starter↔sub swap keeps 11 starters + 3 subs; assignedPosition follows too.
  const performSwap = useCallback((pickIdxA: number, pickIdxB: number) => {
    const slotA = slotAssignments[pickIdxA];
    const slotB = slotAssignments[pickIdxB];
    const nextAssign = [...slotAssignments];
    nextAssign[pickIdxA] = slotB;
    nextAssign[pickIdxB] = slotA;
    const nextPicked = [...pickedPlayers];
    nextPicked[pickIdxA] = {
      ...nextPicked[pickIdxA],
      isSub: slotB === undefined,
      assignedPosition: slotB !== undefined ? formation.slots[slotB].label : nextPicked[pickIdxA].assignedPosition,
    };
    nextPicked[pickIdxB] = {
      ...nextPicked[pickIdxB],
      isSub: slotA === undefined,
      assignedPosition: slotA !== undefined ? formation.slots[slotA].label : nextPicked[pickIdxB].assignedPosition,
    };
    setSlotAssignments(nextAssign);
    setPickedPlayers(nextPicked);
    onProgress?.(nextPicked, Array.from(usedClubYears) as string[], nextAssign);
    setSwapSel(null);
  }, [slotAssignments, pickedPlayers, formation.slots, onProgress, usedClubYears]);

  // Move a selected player into an empty slot.
  const performMoveToEmpty = useCallback((pickIdx: number, slotIdx: number) => {
    const nextAssign = [...slotAssignments];
    nextAssign[pickIdx] = slotIdx;
    const nextPicked = [...pickedPlayers];
    nextPicked[pickIdx] = { ...nextPicked[pickIdx], isSub: false, assignedPosition: formation.slots[slotIdx].label };
    setSlotAssignments(nextAssign);
    setPickedPlayers(nextPicked);
    onProgress?.(nextPicked, Array.from(usedClubYears) as string[], nextAssign);
    setSwapSel(null);
  }, [slotAssignments, pickedPlayers, formation.slots, onProgress, usedClubYears]);

  // Handle a tap on a placed player (starter or sub) while rearranging.
  const handleSwapTapPlayer = useCallback((pickIdx: number) => {
    setSwapSel((sel) => {
      if (sel === null) return pickIdx;
      if (sel === pickIdx) return null;
      performSwap(sel, pickIdx);
      return null;
    });
  }, [performSwap]);

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
  const getTop3Stats = (player: RosterPlayer) =>
    [...clubFirstStats]
      .sort((a, b) => b.pick(player) - a.pick(player))
      .slice(0, 3);
  const displayStats = (isClubFirst || isSubPick || isSeason2Draft) ? clubFirstStats : keyStats;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
      {/* Header with progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {onBack && (pickedPlayers.length === 0 || isMultiplayer) && (
              <>
                <button
                  onClick={() => isMultiplayer ? setConfirmExit(true) : onBack()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white hover:text-white hover:bg-gray-800 transition"
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
                      <p className="text-white text-sm mb-5">You'll go back to the lobby. Any picks you've made will be lost.</p>
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
              <p className="text-white text-xs">
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
                <div className="text-[10px] font-bold tracking-widest text-white uppercase">
                  New Signing
                </div>
                <div className="text-lg font-extrabold text-amber-400">
                  {pickedPlayers.length + 1}/{maxPicks}
                </div>
              </>
            ) : isSubPick ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase">
                  Substitute
                </div>
                <div className="text-lg font-extrabold text-purple-400">
                  {pickedPlayers.length - 11 + 1}/3
                </div>
              </>
            ) : isClubFirst ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase">
                  Pick
                </div>
                <div className="text-lg font-extrabold text-sky-400">
                  {pickedPlayers.length + 1}/14
                </div>
              </>
            ) : chosenSlotIdx !== null ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase">
                  Picking for
                </div>
                <div className={`text-lg font-extrabold ${getPositionTextColor(currentSlot?.label ?? "")}`}>
                  {currentSlot?.label}
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase">
                  Choose position
                </div>
                <div className="text-lg font-extrabold text-emerald-400">
                  {pickedPlayers.filter(p => !p.isSub).length}/11
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
          <span className="text-xs font-bold text-white tabular-nums">
            {pickedPlayers.length}/{maxPicks}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pitch with picked players — on mobile, show below the action area */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          {/* Height is always reserved (when any players exist) so the hint
              appearing/disappearing between spins doesn't shift the pitch. */}
          {pickedPlayers.length > 0 && (
            <div className="mb-2 min-h-[16px] text-center text-[10px] font-bold text-amber-400/90">
              {canSwap
                ? (swapSel !== null
                    ? "Tap another player or an empty spot to move · tap the same player to cancel"
                    : "Tap two players to swap · tap a player then an empty spot to move")
                : ""}
            </div>
          )}
          <div className="relative w-full aspect-[3/4] max-h-[66vh] sm:max-h-[72vh] lg:max-h-none mx-auto rounded-xl overflow-hidden border border-emerald-800/40">
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
              const isCurrent = !isClubFirst && chosenSlotIdx !== null && i === chosenSlotIdx && !displayPlayer;
              const isAssignable = isClubFirst && phase === "assign" && !displayPlayer;
              const isPickable = !isClubFirst && !isSubPick && !isSeason2Draft && phase === "spin" && chosenSlotIdx === null && !filledSlots.has(i) && !displayPlayer;
              const pendingPositions = pendingPlayer
                ? (pendingPlayer.positions || "").split(",").map((p) => p.trim())
                : [];
              const isNaturalFit = isAssignable && pendingPositions.includes(slot.label);
              return (
                <div
                  key={i}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300 ${
                    (isAssignable || isPickable || (canSwap && (displayPlayer || swapSel !== null))) ? "cursor-pointer" : ""
                  }`}
                  style={{ left: `${slot.x}%`, top: `${slot.y >= 88 ? slot.y - 4 : slot.y}%` }}
                  onClick={() => {
                    if (canSwap) {
                      const pi = slotToPickIdx.get(i);
                      if (pi !== undefined) { handleSwapTapPlayer(pi); return; }
                      if (swapSel !== null) { performMoveToEmpty(swapSel, i); return; }
                    }
                    if (isAssignable) handleAssignSlot(i);
                    else if (isPickable) { setChosenSlotIdx(i); setCurrentSlotIndex(i); }
                  }}
                >
                  {displayPlayer ? (
                    <>
                      <div className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 shadow-lg transition-all ${
                        slotToPickIdx.get(i) === swapSel
                          ? "border-amber-400 ring-2 ring-amber-400 scale-110"
                          : existing && !picked ? "border-white/40" : "border-white/70"
                      }`}>
                        {displayPlayer.image_url ? (
                          <ImageWithFallback
                            src={displayPlayer.image_url}
                            alt={displayPlayer.name}
                            className="w-full h-full object-cover"
                            fallbackText={displayPlayer.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${getPositionColor(displayPlayer.assignedPosition)}`}>
                            <span className="text-xs sm:text-sm font-black text-white">
                              {displayPlayer.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center mt-0.5 max-w-[64px] sm:max-w-[80px]">
                        <span className="text-[10px] sm:text-xs font-bold text-white truncate w-full text-center leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                          {displayPlayer.name.split(" ").pop()}
                        </span>
                        <div className="flex items-center gap-1">
                          {getFlagUrl(displayPlayer.nationality) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getFlagUrl(displayPlayer.nationality)!} alt="" className="w-3 h-2 object-cover rounded-[1px]" />
                          ) : displayPlayer.nationality ? (
                            <span className="text-[7px] sm:text-[8px] text-white/60 leading-tight max-w-[36px] truncate">{displayPlayer.nationality}</span>
                          ) : null}
                          <span className="text-[10px] sm:text-xs font-black text-emerald-400 leading-tight">{displayPlayer.overall}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-extrabold border-2 transition-all duration-300 ${
                        isCurrent
                          ? "bg-emerald-500/80 border-emerald-300 text-white animate-pulse shadow-lg shadow-emerald-500/30"
                          : isNaturalFit
                            ? "bg-emerald-600/80 border-emerald-400 text-white animate-pulse shadow-lg shadow-emerald-500/30"
                            : isAssignable
                              ? "bg-gray-700/80 border-sky-500/60 text-sky-300 hover:bg-sky-900/40 hover:border-sky-400"
                              : isPickable
                                ? "bg-gray-700/80 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-400"
                                : "bg-gray-800/80 border-gray-600/50 text-white/80"
                      }`}
                    >
                      {slot.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bench — Season 2 shows current subs + new signings together (uncapped);
              the main draft keeps the fixed 3-slot bench. */}
          {isSeason2Draft ? (
            <div className="mt-3 bg-purple-900/10 border border-purple-700/30 rounded-xl p-3">
              <div className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-1">
                Substitutes ({s2Bench.length})
              </div>
              <p className="text-[10px] text-white/50 mb-2">Signings join your bench — set your final XI on the next screen.</p>
              <div className="flex flex-wrap gap-2">
                {s2Bench.length === 0 && <span className="text-[11px] text-white/50">No substitutes.</span>}
                {s2Bench.map(({ p, isNew }, i) => {
                  const initials = p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={i} className={`flex flex-col items-center rounded-xl px-2 py-2 border w-[76px] ${isNew ? "bg-amber-900/20 border-amber-500/40" : "bg-purple-900/30 border-purple-600/40"}`}>
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/60">
                        {p.image_url ? (
                          <ImageWithFallback src={p.image_url} alt={p.name} className="w-full h-full object-cover" fallbackText={initials} />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${getPositionColor(p.assignedPosition)}`}>
                            <span className="text-xs font-black text-white">{initials}</span>
                          </div>
                        )}
                      </div>
                      <span className={`mt-1 text-[8px] font-black text-white px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)}`}>{p.assignedPosition}</span>
                      <span className="mt-0.5 text-[10px] font-bold text-white truncate max-w-[68px] text-center leading-tight">{p.name.split(" ").pop()}</span>
                      <div className="flex items-center gap-1">
                        {getFlagUrl(p.nationality) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getFlagUrl(p.nationality)!} alt="" className="w-3 h-2 object-cover rounded-[1px]" />
                        ) : p.nationality ? (
                          <span className="text-[7px] text-white/60 leading-tight max-w-[36px] truncate">{p.nationality}</span>
                        ) : null}
                        <span className="text-[10px] font-black text-emerald-400">{p.overall}</span>
                      </div>
                      {isNew && <span className="mt-0.5 text-[7px] font-black tracking-wider text-amber-400">NEW</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (isSubPick || pickedPlayers.filter(p => p.isSub).length > 0 || (isClubFirst && filledSlots.size >= 11)) && (
            <div className="mt-3 bg-purple-900/10 border border-purple-700/30 rounded-xl p-3">
              <div className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-2">
                Substitutes ({pickedPlayers.filter(p => p.isSub).length}/3)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(i => {
                  const subs = pickedPlayers.filter(p => p.isSub);
                  const sub = subs[i];
                  const subPickIdx = sub ? pickedPlayers.indexOf(sub) : -1;
                  const isNext = i === subs.length;
                  const initials = (n: string) => n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={i}
                      onClick={() => { if (canSwap && sub) handleSwapTapPlayer(subPickIdx); }}
                      className={`flex flex-col items-center rounded-xl px-2 py-2 border transition-all ${canSwap && sub ? "cursor-pointer" : ""} ${
                        sub && subPickIdx === swapSel
                          ? "bg-purple-900/40 border-amber-400 ring-2 ring-amber-400"
                          : sub
                            ? "bg-purple-900/30 border-purple-600/40"
                            : isNext
                              ? "bg-purple-900/20 border-2 border-dashed border-purple-500/50 animate-pulse"
                              : "bg-gray-800/40 border-gray-700/30"
                      }`}
                    >
                      {sub ? (
                        <>
                          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white/60">
                            {sub.image_url ? (
                              <ImageWithFallback src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" fallbackText={initials(sub.name)} />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center ${getPositionColor(sub.assignedPosition)}`}>
                                <span className="text-xs font-black text-white">{initials(sub.name)}</span>
                              </div>
                            )}
                          </div>
                          <span className={`mt-1 text-[8px] font-black text-white px-1.5 py-0.5 rounded ${getPositionColor(sub.assignedPosition)}`}>{sub.assignedPosition}</span>
                          <span className="mt-0.5 text-[10px] font-bold text-white truncate max-w-[72px] text-center leading-tight">{sub.name.split(" ").pop()}</span>
                          <div className="flex items-center gap-1">
                            {getFlagUrl(sub.nationality) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getFlagUrl(sub.nationality)!} alt="" className="w-3 h-2 object-cover rounded-[1px]" />
                            ) : sub.nationality ? (
                              <span className="text-[7px] text-white/60 leading-tight max-w-[36px] truncate">{sub.nationality}</span>
                            ) : null}
                            <span className="text-[10px] font-black text-emerald-400">{sub.overall}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-1 text-white/40">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-[9px] font-bold">SUB</div>
                          <span className="mt-1 text-[9px] font-medium">Sub {i + 1}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Picked list removed — the pitch (with faces/flags/ratings) and the
              bench below cover this, so the old chip list is hidden. */}
          {showPickedList && pickedPlayers.length > 0 && (
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
                  <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
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
                      <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
                      <span className="font-extrabold text-emerald-400 text-sm">{p.overall}</span>
                    </div>
                  ))}
                </>
              )}
              {isSeason2Draft && existingSquad && existingSquad.filter(p => p.isSub).length > 0 && (
                <>
                  <div className="text-[10px] font-bold tracking-widest uppercase pt-2 text-purple-400">
                    Current Bench
                  </div>
                  {existingSquad.filter(p => p.isSub).map((p, i) => (
                    <div
                      key={`existing-sub-${i}`}
                      className="flex items-center gap-2 text-sm bg-purple-900/10 border border-purple-800/30 rounded-lg px-3 py-1.5"
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                        {p.assignedPosition}
                      </span>
                      <span className="flex-1 truncate font-medium text-white">{p.name}</span>
                      <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
                      <span className="font-extrabold text-purple-400 text-sm">{p.overall}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {showPickedList && pickedPlayers.length > 0 && (
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
                  <span className="font-medium text-white">{p.name.split(" ").pop()}</span>
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

          {/* Position picker — position-first starters only */}
          {phase === "spin" && !isClubFirst && !isSubPick && !isSeason2Draft && chosenSlotIdx === null && (
            <div className="flex flex-col items-center justify-center py-4 sm:py-10">
              <div className="mb-3 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 text-emerald-400 mb-4">
                  <span className="text-xs font-bold tracking-widest uppercase">
                    Pick {pickedPlayers.filter(p => !p.isSub).length + 1} of 11
                  </span>
                </div>
                <p className="text-white text-sm">Choose a position to spin for</p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-w-lg mx-auto w-full px-4">
                {formation.slots.map((slot, i) => {
                  const filled = filledSlots.has(i);
                  const player = slotToPlayer.get(i);
                  return (
                    <button
                      key={i}
                      onClick={() => { setChosenSlotIdx(i); setCurrentSlotIndex(i); }}
                      disabled={filled}
                      className={`relative py-3 px-2 rounded-xl text-center transition-all duration-200 ${
                        filled
                          ? "bg-gray-800/40 border border-gray-700/30 cursor-not-allowed"
                          : "bg-gray-800/80 border-2 border-emerald-600/40 hover:bg-emerald-900/30 hover:border-emerald-400 hover:scale-105 active:scale-95"
                      }`}
                    >
                      <div className={`text-lg font-extrabold ${filled ? "text-white" : getPositionTextColor(slot.label)}`}>
                        {slot.label}
                      </div>
                      {filled && player ? (
                        <div className="text-[10px] text-white truncate mt-0.5">{player.name.split(" ").pop()}</div>
                      ) : !filled ? (
                        <div className="text-[10px] text-white mt-0.5">Available</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spin button — shown when position is chosen (or club-first / subs / season2) */}
          {phase === "spin" && (isClubFirst || isSubPick || isSeason2Draft || chosenSlotIdx !== null) && (
            <div className="flex flex-col items-center justify-center py-4 sm:py-10">
              <div className="mb-3 text-center">
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
                          : `Pick ${pickedPlayers.filter(p => !p.isSub).length + 1} of 11 · ${currentSlot?.label}`
                    }
                  </span>
                </div>
                <p className="text-white text-sm">
                  {isSeason2Draft
                    ? "Spin to sign a replacement player"
                    : "Spin to get a random Premier League club & season"
                  }
                </p>
                {!isClubFirst && !isSubPick && !isSeason2Draft && chosenSlotIdx !== null && (
                  <button
                    onClick={() => setChosenSlotIdx(null)}
                    className="mt-2 text-xs text-white hover:text-emerald-400 underline transition"
                  >
                    Change position
                  </button>
                )}
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
            <div className="flex flex-col items-center justify-center py-4 sm:py-10">
              {/* Slot machine container */}
              <div className="relative w-full max-w-md h-24 overflow-hidden rounded-xl border border-emerald-700/40 bg-gray-900/80 mb-3">
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
                        {formatSeasonYear(item.year)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-white text-sm animate-pulse">Spinning...</p>
            </div>
          )}

          {phase === "pick" && spinDisplay && (
            <div>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">{spinDisplay.club}</h2>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 text-sm font-bold">
                    {formatSeasonYear(spinDisplay.year)}
                  </span>
                </div>
                <p className="text-white text-sm">
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
                        ? "bg-gray-800 hover:bg-gray-700 border border-gray-700/50 text-white"
                        : "bg-gray-900 border border-gray-800/30 text-white cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Re-spin
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ml-1 ${
                      respinsRemaining > 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-gray-800 text-white"
                    }`}>
                      {respinsRemaining}/{maxRespins}
                    </span>
                  </button>
                </div>
              )}

              {!spinResult && (
                <div className="flex flex-col items-center justify-center py-4 sm:py-10">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-white text-sm">Loading roster...</p>
                </div>
              )}

              {spinResult && <div className="max-h-[60vh] overflow-y-auto">
                {/* Stat column headers — desktop only */}
                {displayStats.length > 0 && !settings.hiddenRatings && !isClubFirst && !isSubPick && !isSeason2Draft && (
                  <div className="hidden sm:flex items-center gap-3 px-4 mb-1 sticky top-0 bg-gray-950 z-10 py-1">
                    <div className="w-9 shrink-0" />
                    <div className="w-10 shrink-0" />
                    <div className="flex-1 min-w-0" />
                    <div className="shrink-0" />
                    <div className="flex gap-0 shrink-0">
                      {displayStats.map((ks) => (
                        <span key={ks.label} className="w-9 text-center text-[9px] font-bold tracking-wider text-white uppercase">
                          {ks.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                {[...spinResult.roster]
                  .sort((a, b) => {
                    if (!isClubFirst && !isSubPick && !isSeason2Draft && currentSlot) {
                      const aCompat = currentSlot.compatiblePositions.some((cp) =>
                        (a.positions || "").split(",").map((p) => p.trim()).includes(cp)
                      ) ? 1 : 0;
                      const bCompat = currentSlot.compatiblePositions.some((cp) =>
                        (b.positions || "").split(",").map((p) => p.trim()).includes(cp)
                      ) ? 1 : 0;
                      if (bCompat !== aCompat) return bCompat - aCompat;
                    }
                    if (settings.hiddenRatings) {
                      const ha = ((parseInt(a.sofifa_id, 10) * 2654435761) >>> 0);
                      const hb = ((parseInt(b.sofifa_id, 10) * 2654435761) >>> 0);
                      return ha - hb;
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
                  const fitness = (!isClubFirst && !isSubPick && !isSeason2Draft && currentSlot)
                    ? slotFitness(playerPositions, currentSlot.label)
                    : null;
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
                        settings.hiddenRatings
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : player.overall >= 85
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : player.overall >= 75
                              ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                              : "bg-gray-800/80 text-white border border-gray-700/40"
                      }`}>
                        {settings.hiddenRatings ? "?" : player.overall}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate group-hover:text-white transition-colors">
                          {player.name}
                        </div>
                        <div className="text-[11px] sm:text-xs text-white flex items-center gap-1">
                          {player.nationality && (() => {
                            const url = getFlagUrl(player.nationality);
                            return url
                              ? <img src={url} alt={player.nationality} className="w-4 h-3 object-cover rounded-[1px] shrink-0" />
                              : <span className="text-gray-400">{player.nationality}</span>;
                          })()}
                          <span>Age {player.age}</span>
                        </div>
                        {hasStats && !settings.hiddenRatings && (
                          <div className="flex gap-2 sm:hidden mt-0.5">
                            {((isClubFirst || isSubPick || isSeason2Draft) ? getTop3Stats(player) : displayStats.slice(0, 3)).map((ks) => {
                              const val = ks.pick(player);
                              return (
                                <span key={ks.label} className={`text-[10px] font-bold tabular-nums ${statColor(val)}`}>
                                  <span className="text-white">{ks.label}</span> {val > 0 ? val : "-"}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex gap-1">
                          {playerPositions.map((pos) => (
                            <span
                              key={pos}
                              className={`text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded ${
                                isClubFirst || isSubPick || isSeason2Draft || currentSlot?.compatiblePositions.includes(pos)
                                  ? getPositionColor(pos) + " text-white"
                                  : "bg-gray-800 text-white"
                              }`}
                            >
                              {pos}
                            </span>
                          ))}
                        </div>
                        {fitness !== null && fitness < 1.0 && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            fitness >= 0.92 ? "bg-yellow-900/40 text-yellow-400" :
                            fitness >= 0.80 ? "bg-orange-900/40 text-orange-400" :
                            "bg-red-900/40 text-red-400"
                          }`}>
                            {Math.round(fitness * 100)}% fit
                          </span>
                        )}
                      </div>
                      {hasStats && !settings.hiddenRatings && (
                        <div className="hidden sm:flex gap-0 shrink-0">
                          {((isClubFirst || isSubPick || isSeason2Draft) ? getTop3Stats(player) : displayStats).map((ks) => {
                            const val = ks.pick(player);
                            return (
                              <span key={ks.label} className={`w-9 text-center text-[11px] font-bold tabular-nums ${statColor(val)}`}>
                                <span className="block text-[8px] text-white font-normal leading-none">{ks.label}</span>
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
              <div className="text-center mb-3">
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
                    <div className="text-sm text-white">
                      OVR <span className="text-emerald-400 font-bold">{settings.hiddenRatings ? "?" : pendingPlayer.overall}</span>
                      {" · "}
                      {spinDisplay.club}
                      {" · "}
                      {pendingPlayer.positions}
                    </div>
                  </div>
                </div>
                <p className="text-white text-sm">Choose a position to assign this player</p>
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

              {/* Bench option — only in club-first, only when bench isn't full */}
              {pickedPlayers.filter(p => p.isSub).length < 3 && (
                <div className="mt-4 max-w-md mx-auto">
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase text-center mb-2">or</div>
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
                  className="px-5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-lg font-bold text-sm transition-all text-white"
                >
                  Back to roster
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
