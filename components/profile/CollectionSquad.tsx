"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { FRAME_STYLES } from "@/lib/xp";
import type { UserProgression } from "@/lib/xp";
import type { SeasonLevelReward } from "@/components/profile/XPProgressBar";

interface SlotDef {
  id: string;
  label: string;
  x: number; // 0-100 %
  y: number; // 0-100 %
}

const FORMATIONS: Record<string, SlotDef[]> = {
  "4-3-3": [
    { id: "GK",  label: "GK",  x: 50, y: 92 },
    { id: "LB",  label: "LB",  x: 11, y: 74 },
    { id: "LCB", label: "CB",  x: 32, y: 74 },
    { id: "RCB", label: "CB",  x: 68, y: 74 },
    { id: "RB",  label: "RB",  x: 89, y: 74 },
    { id: "LCM", label: "CM",  x: 20, y: 48 },
    { id: "CM",  label: "CM",  x: 50, y: 48 },
    { id: "RCM", label: "CM",  x: 80, y: 48 },
    { id: "LW",  label: "LW",  x: 14, y: 20 },
    { id: "ST",  label: "ST",  x: 50, y: 10 },
    { id: "RW",  label: "RW",  x: 86, y: 20 },
  ],
  "4-4-2": [
    { id: "GK",  label: "GK",  x: 50, y: 92 },
    { id: "LB",  label: "LB",  x: 11, y: 74 },
    { id: "LCB", label: "CB",  x: 32, y: 74 },
    { id: "RCB", label: "CB",  x: 68, y: 74 },
    { id: "RB",  label: "RB",  x: 89, y: 74 },
    { id: "LM",  label: "LM",  x: 11, y: 48 },
    { id: "LCM", label: "CM",  x: 36, y: 48 },
    { id: "RCM", label: "CM",  x: 64, y: 48 },
    { id: "RM",  label: "RM",  x: 89, y: 48 },
    { id: "ST1", label: "ST",  x: 34, y: 14 },
    { id: "ST2", label: "ST",  x: 66, y: 14 },
  ],
  "4-2-3-1": [
    { id: "GK",  label: "GK",  x: 50, y: 92 },
    { id: "LB",  label: "LB",  x: 11, y: 74 },
    { id: "LCB", label: "CB",  x: 32, y: 74 },
    { id: "RCB", label: "CB",  x: 68, y: 74 },
    { id: "RB",  label: "RB",  x: 89, y: 74 },
    { id: "LDM", label: "CDM", x: 34, y: 56 },
    { id: "RDM", label: "CDM", x: 66, y: 56 },
    { id: "LW",  label: "LW",  x: 14, y: 32 },
    { id: "CAM", label: "CAM", x: 50, y: 32 },
    { id: "RW",  label: "RW",  x: 86, y: 32 },
    { id: "ST",  label: "ST",  x: 50, y: 10 },
  ],
  "3-4-3": [
    { id: "GK",  label: "GK",  x: 50, y: 92 },
    { id: "LCB", label: "CB",  x: 20, y: 74 },
    { id: "CB",  label: "CB",  x: 50, y: 74 },
    { id: "RCB", label: "CB",  x: 80, y: 74 },
    { id: "LM",  label: "LM",  x: 11, y: 48 },
    { id: "LCM", label: "CM",  x: 36, y: 48 },
    { id: "RCM", label: "CM",  x: 64, y: 48 },
    { id: "RM",  label: "RM",  x: 89, y: 48 },
    { id: "LW",  label: "LW",  x: 14, y: 20 },
    { id: "ST",  label: "ST",  x: 50, y: 10 },
    { id: "RW",  label: "RW",  x: 86, y: 20 },
  ],
  "5-3-2": [
    { id: "GK",  label: "GK",  x: 50, y: 92 },
    { id: "LCB", label: "CB",  x: 20, y: 74 },
    { id: "CB",  label: "CB",  x: 50, y: 74 },
    { id: "RCB", label: "CB",  x: 80, y: 74 },
    { id: "LWB", label: "LWB", x: 10, y: 48 },
    { id: "LCM", label: "CM",  x: 30, y: 48 },
    { id: "CM",  label: "CM",  x: 50, y: 48 },
    { id: "RCM", label: "CM",  x: 70, y: 48 },
    { id: "RWB", label: "RWB", x: 90, y: 48 },
    { id: "ST1", label: "ST",  x: 34, y: 14 },
    { id: "ST2", label: "ST",  x: 66, y: 14 },
  ],
};

// Role categories for intelligent formation remapping
const POSITION_ROLES: Record<string, string> = {
  GK: "gk",
  LB: "def", RB: "def", LCB: "def", RCB: "def", CB: "def",
  LWB: "wb", RWB: "wb",
  LDM: "dm", RDM: "dm",
  LM: "mid", RM: "mid", LCM: "mid", RCM: "mid", CM: "mid",
  LAM: "am", RAM: "am", CAM: "am",
  LW: "wing", RW: "wing",
  ST: "att", ST1: "att", ST2: "att",
};

const ROLE_FALLBACKS: Record<string, string[]> = {
  gk:   ["gk"],
  def:  ["def", "wb", "dm"],
  wb:   ["wb", "def", "mid"],
  dm:   ["dm", "mid", "def"],
  mid:  ["mid", "dm", "am"],
  am:   ["am", "mid", "wing"],
  wing: ["wing", "am", "att"],
  att:  ["att", "wing", "am"],
};

const ROLE_ORDER = ["gk", "def", "wb", "dm", "mid", "am", "wing", "att"];

function remapSlots(
  fromSlots: SlotDef[],
  toSlots: SlotDef[],
  current: Record<string, string | null>
): Record<string, string | null> {
  const toPlace: Array<{ frameId: string; role: string }> = [];
  for (const slot of fromSlots) {
    const frameId = current[slot.id];
    if (frameId) {
      toPlace.push({ frameId, role: POSITION_ROLES[slot.id] ?? "mid" });
    }
  }

  const available = toSlots.map(s => ({
    slotId: s.id,
    role: POSITION_ROLES[s.id] ?? "mid",
    taken: false,
  }));

  const result: Record<string, string | null> = {};
  const placed = new Set<string>();

  const place = (frameId: string, role: string): boolean => {
    const slot = available.find(s => !s.taken && s.role === role);
    if (!slot) return false;
    result[slot.slotId] = frameId;
    slot.taken = true;
    placed.add(frameId);
    return true;
  };

  for (const role of ROLE_ORDER) {
    for (const card of toPlace) {
      if (card.role === role && !placed.has(card.frameId)) place(card.frameId, role);
    }
  }

  for (const role of ROLE_ORDER) {
    for (const card of toPlace) {
      if (card.role !== role || placed.has(card.frameId)) continue;
      const fallbacks = ROLE_FALLBACKS[role] ?? [role, "mid"];
      for (const fbRole of fallbacks) {
        if (place(card.frameId, fbRole)) break;
      }
    }
  }

  for (const card of toPlace) {
    if (placed.has(card.frameId)) continue;
    const slot = available.find(s => !s.taken);
    if (slot) {
      result[slot.slotId] = card.frameId;
      slot.taken = true;
      placed.add(card.frameId);
    }
  }

  return result;
}

const STORAGE_KEY = "collection-squad-v1";
const FORMATION_KEY = "collection-squad-formation-v1";
const MANAGER_KEY = "collection-squad-manager-v1";

function isManagerCard(name: string | null | undefined): boolean {
  return (name ?? "").toLowerCase().includes("manager");
}

interface CardEntry {
  id: string;
  name: string;
  unlock_value: number | null;
  card_image_url?: string | null;
}

interface Props {
  progression: UserProgression | null;
  seasonRewards?: SeasonLevelReward[];
}

export default function CollectionSquad({ progression, seasonRewards }: Props) {
  const [formation, setFormation] = useState("4-3-3");
  const [slots, setSlots] = useState<Record<string, string | null>>({});
  const [managerCardId, setManagerCardId] = useState<string | null>(null);
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [dragSourceSlot, setDragSourceSlot] = useState<string | null>(null);
  const [selectedBenchCard, setSelectedBenchCard] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const level = progression?.level ?? 0;

  const unlockedSeasonCards: CardEntry[] = (seasonRewards ?? [])
    .filter(r => level >= r.level)
    .map(r => ({
      id: `season_card_${r.id}`,
      name: r.card_name ?? "Season Card",
      unlock_value: r.level,
      card_image_url: r.image_url,
    }));

  const unlockedObjectiveCards: CardEntry[] = (progression?.objectiveCards ?? []).map(c => ({
    id: c.id,
    name: c.name,
    unlock_value: null,
    card_image_url: c.card_image_url,
  }));

  const unlockedCards: CardEntry[] = [...unlockedSeasonCards, ...unlockedObjectiveCards]
    .sort((a, b) => (a.unlock_value ?? 0) - (b.unlock_value ?? 0));

  useEffect(() => {
    try {
      const f = localStorage.getItem(FORMATION_KEY);
      if (f && FORMATIONS[f]) setFormation(f);
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setSlots(JSON.parse(s));
      const m = localStorage.getItem(MANAGER_KEY);
      if (m) setManagerCardId(m);
    } catch { /* ignore */ }
  }, []);

  const persistManager = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(MANAGER_KEY, id);
      else localStorage.removeItem(MANAGER_KEY);
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback(
    (f: string, s: Record<string, string | null>) => {
      try {
        localStorage.setItem(FORMATION_KEY, f);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch { /* ignore */ }
    },
    []
  );

  const currentSlots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];

  const assignedFrameIds = new Set([
    ...(Object.values(slots).filter(Boolean) as string[]),
    ...(managerCardId ? [managerCardId] : []),
  ]);
  const benchCards = unlockedCards.filter((c) => !assignedFrameIds.has(c.id));

  const managerCard = managerCardId
    ? unlockedCards.find((c) => c.id === managerCardId) ?? null
    : null;

  const selectedCard = selectedBenchCard
    ? unlockedCards.find((c) => c.id === selectedBenchCard) ?? null
    : null;
  const selectedIsManager = selectedCard ? isManagerCard(selectedCard.name) : false;

  function changeFormation(f: string) {
    const newSlots = FORMATIONS[f] ?? FORMATIONS["4-3-3"];
    const remapped = remapSlots(currentSlots, newSlots, slots);
    setFormation(f);
    setSlots(remapped);
    persist(f, remapped);
    setSelectedBenchCard(null);
  }

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id as string;
    setActiveFrameId(id);
    setSelectedBenchCard(null);
    const src = Object.entries(slots).find(([, v]) => v === id)?.[0] ?? null;
    setDragSourceSlot(src);
  }

  function handleDragEnd(e: DragEndEvent) {
    const frameId = e.active.id as string;
    setActiveFrameId(null);
    const srcSlot = dragSourceSlot;
    setDragSourceSlot(null);

    const targetId = e.over?.id as string | undefined;
    if (!targetId) return;

    const dragged = unlockedCards.find((c) => c.id === frameId);
    const draggedIsManager = dragged ? isManagerCard(dragged.name) : false;

    if (targetId === "MANAGER") {
      if (!draggedIsManager) return;
      setSlots((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k] === frameId) { next[k] = null; changed = true; }
        }
        if (changed) persist(formation, next);
        return next;
      });
      setManagerCardId(frameId);
      persistManager(frameId);
      return;
    }

    if (!currentSlots.find((s) => s.id === targetId)) return;
    if (draggedIsManager) return;

    setSlots((prev) => {
      const next = { ...prev };
      const displacedFrameId = next[targetId] ?? null;

      if (srcSlot && displacedFrameId && srcSlot !== targetId) {
        next[targetId] = frameId;
        next[srcSlot] = displacedFrameId;
      } else {
        if (srcSlot) next[srcSlot] = null;
        next[targetId] = frameId;
      }

      persist(formation, next);
      return next;
    });
  }

  function removeFromSlot(slotId: string) {
    setSlots((prev) => {
      const next = { ...prev, [slotId]: null };
      persist(formation, next);
      return next;
    });
  }

  function handleSlotTap(slotId: string) {
    if (!selectedBenchCard) return;
    if (selectedIsManager) return;
    setSlots((prev) => {
      const next = { ...prev, [slotId]: selectedBenchCard };
      persist(formation, next);
      return next;
    });
    setSelectedBenchCard(null);
  }

  function handleManagerTap() {
    if (!selectedBenchCard) return;
    if (!selectedIsManager) return;
    setSlots((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === selectedBenchCard) { next[k] = null; changed = true; }
      }
      if (changed) persist(formation, next);
      return next;
    });
    setManagerCardId(selectedBenchCard);
    persistManager(selectedBenchCard);
    setSelectedBenchCard(null);
  }

  function removeManager() {
    setManagerCardId(null);
    persistManager(null);
  }

  function handleBenchCardTap(cardId: string) {
    setSelectedBenchCard(prev => prev === cardId ? null : cardId);
  }

  const activeCard = activeFrameId
    ? unlockedCards.find((c) => c.id === activeFrameId)
    : null;
  const activeStyle = activeCard
    ? (activeCard.card_image_url
        ? { border: "border-2 border-amber-400", shadow: "shadow-lg shadow-amber-500/30", image: activeCard.card_image_url }
        : (FRAME_STYLES[activeCard.id] ?? FRAME_STYLES.frame_default))
    : null;

  const managerStyle = managerCard
    ? (managerCard.card_image_url
        ? { border: "border-2 border-amber-400", shadow: "shadow-lg shadow-amber-500/30", image: managerCard.card_image_url }
        : (FRAME_STYLES[managerCard.id] ?? FRAME_STYLES.frame_default))
    : null;

  const activeOnBoard =
    !!activeFrameId &&
    (Object.values(slots).includes(activeFrameId) || managerCardId === activeFrameId);
  const overlaySizeClass = activeOnBoard
    ? "w-[52px] h-[70px] sm:w-[66px] sm:h-[88px] md:w-[74px] md:h-[98px]"
    : "w-14 h-[72px] sm:w-16 sm:h-[84px]";

  const allOnPitch = unlockedCards.length > 0 && benchCards.length === 0;

  return (
    <div
      className="rounded-2xl overflow-hidden max-w-[480px] mx-auto w-full"
      style={{
        background: "#070d1f",
        border: "1px solid rgba(212,175,55,0.25)",
        boxShadow: "0 0 40px rgba(212,175,55,0.06), inset 0 1px 0 rgba(212,175,55,0.08)",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h3
          className="text-lg font-black tracking-[0.25em] uppercase mb-4"
          style={{ color: "#d4af37" }}
        >
          Collection Squad
        </h3>
        {/* Formation pills */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {Object.keys(FORMATIONS).map((f) => (
            <button
              key={f}
              onClick={() => changeFormation(f)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                formation === f
                  ? "text-black"
                  : "text-white hover:border-amber-400/60 bg-transparent"
              }`}
              style={
                formation === f
                  ? { background: "#d4af37", boxShadow: "0 2px 12px rgba(212,175,55,0.35)" }
                  : { border: "1px solid rgba(212,175,55,0.3)" }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {selectedBenchCard && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs font-bold text-center"
          style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)", color: "#d4af37" }}>
          Tap a position to place · tap bench card again to deselect
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="px-5">
          {/* Manager slot */}
          <div
            className="flex items-center gap-4 px-4 py-3 rounded-xl mb-4"
            style={{ background: "#0d1529", border: "1px solid rgba(212,175,55,0.2)" }}
          >
            <ManagerSlot
              card={managerCard}
              frameStyle={managerStyle}
              hasBenchSelection={!!selectedBenchCard && selectedIsManager}
              onRemove={removeManager}
              onTap={handleManagerTap}
            />
            <div className="leading-tight">
              <p className="text-sm font-black tracking-widest uppercase mb-0.5" style={{ color: "#d4af37" }}>
                Manager
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Only manager cards fit here
              </p>
            </div>
          </div>

          {/* Pitch */}
          <div
            className="relative w-full rounded-2xl overflow-hidden"
            style={{
              paddingBottom: "128%",
              border: "1px solid rgba(212,175,55,0.35)",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
            }}
          >
            {/* Green pitch gradient */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, #1d5c1d 0%, #145214 30%, #0e3d0e 65%, #081f08 100%)",
              }}
            />

            {/* Stadium light glows top corners */}
            <div
              className="absolute top-0 left-0 w-2/5 h-1/3 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at top left, rgba(210,230,255,0.18) 0%, transparent 65%)",
              }}
            />
            <div
              className="absolute top-0 right-0 w-2/5 h-1/3 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at top right, rgba(210,230,255,0.18) 0%, transparent 65%)",
              }}
            />
            {/* Bottom fade to dark */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1/6 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, rgba(4,10,4,0.5) 0%, transparent 100%)",
              }}
            />

            {/* Pitch markings */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 200 256"
              preserveAspectRatio="none"
            >
              <g stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" fill="none">
                <rect x="5" y="4" width="190" height="248" />
                <line x1="5" y1="128" x2="195" y2="128" />
                <circle cx="100" cy="128" r="20" />
                <circle cx="100" cy="128" r="1.2" fill="rgba(255,255,255,0.22)" stroke="none" />
                {/* Top penalty area */}
                <rect x="42" y="4" width="116" height="40" />
                <rect x="72" y="4" width="56" height="16" />
                <circle cx="100" cy="31" r="1" fill="rgba(255,255,255,0.22)" stroke="none" />
                {/* Bottom penalty area */}
                <rect x="42" y="212" width="116" height="40" />
                <rect x="72" y="240" width="56" height="16" />
                <circle cx="100" cy="225" r="1" fill="rgba(255,255,255,0.22)" stroke="none" />
              </g>
            </svg>

            {/* Formation label */}
            <div
              className="absolute top-2 right-3 flex items-center gap-1.5 z-10"
            >
              <span className="text-[10px] font-black tracking-widest" style={{ color: "rgba(212,175,55,0.7)" }}>
                {formation}
              </span>
            </div>

            {/* Slot nodes */}
            {currentSlots.map((slot) => {
              const frameId = slots[slot.id] ?? null;
              const card = frameId ? unlockedCards.find((c) => c.id === frameId) : null;
              const style = frameId
                ? (card?.card_image_url
                    ? { border: "border-2 border-amber-400", shadow: "shadow-lg shadow-amber-500/30", image: card.card_image_url }
                    : (FRAME_STYLES[frameId] ?? FRAME_STYLES.frame_default))
                : null;
              return (
                <PitchSlot
                  key={slot.id}
                  slot={slot}
                  card={card ?? null}
                  frameStyle={style}
                  hasBenchSelection={!!selectedBenchCard && !selectedIsManager}
                  onRemove={() => removeFromSlot(slot.id)}
                  onTap={() => handleSlotTap(slot.id)}
                />
              );
            })}
          </div>
        </div>

        {/* All-placed bar / Bench */}
        {allOnPitch ? (
          <div
            className="mx-0 mt-0 py-3 px-5 flex items-center justify-center gap-2.5"
            style={{
              borderTop: "1px solid rgba(212,175,55,0.2)",
              background: "#0d1529",
            }}
          >
            {/* Card stack icon */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
              <rect x="2" y="5" width="14" height="18" rx="2" fill="rgba(212,175,55,0.15)" stroke="rgba(212,175,55,0.6)" strokeWidth="1.2"/>
              <rect x="5" y="2" width="14" height="18" rx="2" fill="rgba(212,175,55,0.15)" stroke="rgba(212,175,55,0.6)" strokeWidth="1.2"/>
              <rect x="8" y="4" width="14" height="17" rx="2" fill="rgba(212,175,55,0.2)" stroke="#d4af37" strokeWidth="1.2"/>
            </svg>
            <span
              className="text-xs font-black tracking-widest uppercase"
              style={{ color: "#d4af37" }}
            >
              All cards placed on pitch
            </span>
          </div>
        ) : (
          <div className="px-5 pt-4 pb-5">
            {unlockedCards.length === 0 ? (
              <p className="text-[10px] font-bold tracking-widest uppercase text-center py-2"
                style={{ color: "rgba(255,255,255,0.3)" }}>
                Unlock cards by levelling up
              </p>
            ) : (
              <>
                <p className="text-[9px] font-bold tracking-widest uppercase mb-2.5"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  Bench — drag onto a position or tap to select
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
                  {benchCards.map((card) => (
                    <BenchCard
                      key={card.id}
                      card={card}
                      selected={selectedBenchCard === card.id}
                      onTap={() => handleBenchCardTap(card.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activeCard && activeStyle ? (
            <div
              className={`${overlaySizeClass} overflow-hidden pointer-events-none`}
              style={{ transform: "rotate(3deg) scale(1.05)", filter: "drop-shadow(0 8px 24px rgba(212,175,55,0.4))" }}
            >
              {activeStyle.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeStyle.image}
                  alt={activeCard.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div
                  className={`w-full h-full rounded-xl bg-gradient-to-br ${activeStyle.gradient ?? "from-gray-700 to-gray-900"}`}
                />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function DraggablePitchCard({
  card,
  frameStyle,
  hasBenchSelection,
  onRemove,
  onTap,
}: {
  card: { id: string; name: string };
  frameStyle: { border: string; shadow: string; gradient?: string; image?: string };
  hasBenchSelection: boolean;
  onRemove: () => void;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...(hasBenchSelection ? {} : { ...listeners, ...attributes })}
      onClick={hasBenchSelection ? onTap : undefined}
      className={`group relative w-[52px] h-[70px] sm:w-[62px] sm:h-[83px] md:w-[70px] md:h-[94px] transition-all ${
        hasBenchSelection
          ? "hover:scale-105 cursor-pointer"
          : "cursor-grab active:cursor-grabbing"
      } ${isDragging ? "opacity-20 scale-95" : ""}`}
      style={
        transform && !isDragging
          ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
          : undefined
      }
    >
      {/* Card image — transparent bg so card art shows clean on the pitch */}
      {frameStyle.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frameStyle.image}
          alt={card.name}
          className="w-full h-full object-contain"
          draggable={false}
          style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.7))" }}
        />
      ) : (
        <div
          className={`w-full h-full rounded-xl bg-gradient-to-br ${frameStyle.gradient ?? "from-gray-700 to-gray-900"}`}
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.7)" }}
        />
      )}

      {/* Remove button */}
      {!hasBenchSelection && !isDragging && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove"
          className="absolute top-0 right-0 translate-x-1 -translate-y-1 w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:bg-red-600"
        >
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Tap-to-place highlight */}
      {hasBenchSelection && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(212,175,55,0.2)", borderRadius: "8px" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="#d4af37" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      )}
    </div>
  );
}

function PitchSlot({
  slot,
  card,
  frameStyle,
  hasBenchSelection,
  onRemove,
  onTap,
}: {
  slot: SlotDef;
  card: CardEntry | null;
  frameStyle: { border: string; shadow: string; gradient?: string; image?: string } | null;
  hasBenchSelection: boolean;
  onRemove: () => void;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id });

  return (
    <div
      ref={setNodeRef}
      className={`absolute z-10 transition-transform duration-150 ${isOver ? "z-20" : ""}`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: isOver
          ? "translate(-50%, -50%) scale(1.12)"
          : "translate(-50%, -50%)",
      }}
    >
      {card && frameStyle ? (
        <DraggablePitchCard
          card={{ id: card.id, name: card.name }}
          frameStyle={frameStyle}
          hasBenchSelection={hasBenchSelection}
          onRemove={onRemove}
          onTap={onTap}
        />
      ) : (
        /* Hexagonal empty slot */
        <button
          onClick={hasBenchSelection ? onTap : undefined}
          className="relative flex items-center justify-center transition-all duration-200"
          style={{ width: 44, height: 52 }}
        >
          <svg
            viewBox="0 0 44 52"
            className="absolute inset-0 w-full h-full"
            style={{ overflow: "visible" }}
          >
            <polygon
              points="22,2 42,13 42,39 22,50 2,39 2,13"
              fill={
                hasBenchSelection
                  ? "rgba(212,175,55,0.22)"
                  : isOver
                  ? "rgba(212,175,55,0.22)"
                  : "rgba(0,0,0,0.35)"
              }
              stroke={
                hasBenchSelection || isOver
                  ? "#d4af37"
                  : "rgba(212,175,55,0.45)"
              }
              strokeWidth={hasBenchSelection || isOver ? 2 : 1.2}
            />
          </svg>
          <span
            className="relative z-10 font-black leading-none text-center"
            style={{
              fontSize: 9,
              color: hasBenchSelection || isOver ? "#d4af37" : "rgba(255,255,255,0.65)",
            }}
          >
            {slot.label}
          </span>
        </button>
      )}
    </div>
  );
}

function BenchCard({
  card,
  selected,
  onTap,
}: {
  card: CardEntry;
  selected: boolean;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const manager = isManagerCard(card.name);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onTap}
      className={`flex-shrink-0 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
        isDragging ? "opacity-20 scale-95" : selected ? "scale-110" : "hover:scale-105"
      }`}
      style={
        transform && !isDragging
          ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
          : undefined
      }
    >
      <div
        className="relative w-14 h-[72px] sm:w-16 sm:h-[84px] overflow-hidden"
        style={
          selected
            ? { filter: `drop-shadow(0 0 8px ${manager ? "rgba(56,189,248,0.7)" : "rgba(212,175,55,0.7)"})` }
            : { filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }
        }
      >
        {card.card_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.card_image_url}
            alt={card.name}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full rounded-xl"
            style={{
              background: manager
                ? "linear-gradient(135deg, #0369a1, #075985)"
                : "linear-gradient(135deg, #92400e, #78350f)",
              border: `1px solid ${manager ? "rgba(56,189,248,0.4)" : "rgba(212,175,55,0.4)"}`,
            }}
          />
        )}
        {manager && (
          <span className="absolute top-0.5 left-0.5 text-[7px] font-black text-white bg-sky-600/90 rounded px-1 py-px leading-none">
            MGR
          </span>
        )}
      </div>
      <span
        className="text-[9px] font-medium text-center max-w-[64px] truncate leading-tight"
        style={{ color: selected ? (manager ? "#38bdf8" : "#d4af37") : "rgba(255,255,255,0.6)" }}
      >
        {card.name}
      </span>
    </div>
  );
}

function ManagerSlot({
  card,
  frameStyle,
  hasBenchSelection,
  onRemove,
  onTap,
}: {
  card: CardEntry | null;
  frameStyle: { border: string; shadow: string; gradient?: string; image?: string } | null;
  hasBenchSelection: boolean;
  onRemove: () => void;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "MANAGER" });

  return (
    <div
      ref={setNodeRef}
      className={`transition-transform duration-150 ${isOver ? "scale-105" : ""}`}
    >
      {card && frameStyle ? (
        <DraggablePitchCard
          card={{ id: card.id, name: card.name }}
          frameStyle={frameStyle}
          hasBenchSelection={hasBenchSelection}
          onRemove={onRemove}
          onTap={onTap}
        />
      ) : (
        <button
          onClick={hasBenchSelection ? onTap : undefined}
          className="flex items-center justify-center transition-all duration-200"
          style={{
            width: 56,
            height: 72,
            borderRadius: 10,
            border: `2px solid ${hasBenchSelection || isOver ? "#d4af37" : "rgba(212,175,55,0.35)"}`,
            background: hasBenchSelection || isOver
              ? "rgba(212,175,55,0.12)"
              : "rgba(0,0,0,0.4)",
            boxShadow: hasBenchSelection || isOver ? "0 0 16px rgba(212,175,55,0.3)" : "none",
          }}
        >
          <span
            className="text-xs font-black leading-none"
            style={{ color: hasBenchSelection || isOver ? "#d4af37" : "rgba(255,255,255,0.5)" }}
          >
            MGR
          </span>
        </button>
      )}
    </div>
  );
}
