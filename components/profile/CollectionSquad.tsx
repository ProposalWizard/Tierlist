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

interface SlotDef {
  id: string;
  label: string;
  x: number; // 0-100 %
  y: number; // 0-100 %
}

const FORMATIONS: Record<string, SlotDef[]> = {
  "4-3-3": [
    { id: "GK",  label: "GK",  x: 50, y: 87 },
    { id: "LB",  label: "LB",  x: 10, y: 67 },
    { id: "LCB", label: "CB",  x: 33, y: 67 },
    { id: "RCB", label: "CB",  x: 67, y: 67 },
    { id: "RB",  label: "RB",  x: 90, y: 67 },
    { id: "LCM", label: "CM",  x: 22, y: 44 },
    { id: "CM",  label: "CM",  x: 50, y: 44 },
    { id: "RCM", label: "CM",  x: 78, y: 44 },
    { id: "LW",  label: "LW",  x: 18, y: 16 },
    { id: "ST",  label: "ST",  x: 50, y: 13 },
    { id: "RW",  label: "RW",  x: 82, y: 16 },
  ],
  "4-4-2": [
    { id: "GK",  label: "GK",  x: 50, y: 87 },
    { id: "LB",  label: "LB",  x: 10, y: 67 },
    { id: "LCB", label: "CB",  x: 33, y: 67 },
    { id: "RCB", label: "CB",  x: 67, y: 67 },
    { id: "RB",  label: "RB",  x: 90, y: 67 },
    { id: "LM",  label: "LM",  x: 12, y: 44 },
    { id: "LCM", label: "CM",  x: 37, y: 44 },
    { id: "RCM", label: "CM",  x: 63, y: 44 },
    { id: "RM",  label: "RM",  x: 88, y: 44 },
    { id: "ST1", label: "ST",  x: 35, y: 16 },
    { id: "ST2", label: "ST",  x: 65, y: 16 },
  ],
  "4-2-3-1": [
    { id: "GK",  label: "GK",  x: 50, y: 87 },
    { id: "LB",  label: "LB",  x: 10, y: 67 },
    { id: "LCB", label: "CB",  x: 33, y: 67 },
    { id: "RCB", label: "CB",  x: 67, y: 67 },
    { id: "RB",  label: "RB",  x: 90, y: 67 },
    { id: "LDM", label: "CDM", x: 34, y: 52 },
    { id: "RDM", label: "CDM", x: 66, y: 52 },
    { id: "LAM", label: "CAM", x: 18, y: 30 },
    { id: "CAM", label: "CAM", x: 50, y: 27 },
    { id: "RAM", label: "CAM", x: 82, y: 30 },
    { id: "ST",  label: "ST",  x: 50, y: 11 },
  ],
  "3-4-3": [
    { id: "GK",  label: "GK",  x: 50, y: 87 },
    { id: "LCB", label: "CB",  x: 22, y: 67 },
    { id: "CB",  label: "CB",  x: 50, y: 67 },
    { id: "RCB", label: "CB",  x: 78, y: 67 },
    { id: "LM",  label: "LM",  x: 14, y: 44 },
    { id: "LCM", label: "CM",  x: 38, y: 44 },
    { id: "RCM", label: "CM",  x: 62, y: 44 },
    { id: "RM",  label: "RM",  x: 86, y: 44 },
    { id: "LW",  label: "LW",  x: 18, y: 16 },
    { id: "ST",  label: "ST",  x: 50, y: 13 },
    { id: "RW",  label: "RW",  x: 82, y: 16 },
  ],
  "3-5-2": [
    { id: "GK",  label: "GK",  x: 50, y: 87 },
    { id: "LCB", label: "CB",  x: 22, y: 67 },
    { id: "CB",  label: "CB",  x: 50, y: 67 },
    { id: "RCB", label: "CB",  x: 78, y: 67 },
    { id: "LWB", label: "LWB", x:  8, y: 44 },
    { id: "LCM", label: "CM",  x: 30, y: 44 },
    { id: "CM",  label: "CM",  x: 50, y: 44 },
    { id: "RCM", label: "CM",  x: 70, y: 44 },
    { id: "RWB", label: "RWB", x: 92, y: 44 },
    { id: "ST1", label: "ST",  x: 35, y: 16 },
    { id: "ST2", label: "ST",  x: 65, y: 16 },
  ],
};

const STORAGE_KEY = "collection-squad-v1";
const FORMATION_KEY = "collection-squad-formation-v1";

interface Props {
  progression: UserProgression | null;
}

export default function CollectionSquad({ progression }: Props) {
  const [formation, setFormation] = useState("4-3-3");
  const [slots, setSlots] = useState<Record<string, string | null>>({});
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [dragSourceSlot, setDragSourceSlot] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const unlockedCards = (progression?.rewards ?? [])
    .filter((r) => r.category === "frame" && r.unlocked)
    .sort((a, b) => (a.unlock_value ?? 0) - (b.unlock_value ?? 0));

  // Load from localStorage
  useEffect(() => {
    try {
      const f = localStorage.getItem(FORMATION_KEY);
      if (f && FORMATIONS[f]) setFormation(f);
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setSlots(JSON.parse(s));
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

  const assignedFrameIds = new Set(Object.values(slots).filter(Boolean) as string[]);
  const benchCards = unlockedCards.filter((c) => !assignedFrameIds.has(c.id));

  function changeFormation(f: string) {
    setFormation(f);
    const cleared: Record<string, string | null> = {};
    setSlots(cleared);
    persist(f, cleared);
  }

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id as string;
    setActiveFrameId(id);
    const src = Object.entries(slots).find(([, v]) => v === id)?.[0] ?? null;
    setDragSourceSlot(src);
  }

  function handleDragEnd(e: DragEndEvent) {
    const frameId = e.active.id as string;
    setActiveFrameId(null);
    setDragSourceSlot(null);

    const targetId = e.over?.id as string | undefined;
    if (!targetId) return;
    // Must be a valid slot
    if (!currentSlots.find((s) => s.id === targetId)) return;

    setSlots((prev) => {
      const next = { ...prev };
      // Clear source slot (if dragging from pitch)
      if (dragSourceSlot) next[dragSourceSlot] = null;
      // Place card in target (displaces any existing card — it returns to bench)
      next[targetId] = frameId;
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

  const activeCard = activeFrameId
    ? unlockedCards.find((c) => c.id === activeFrameId)
    : null;
  const activeStyle = activeFrameId
    ? (FRAME_STYLES[activeFrameId] ?? FRAME_STYLES.frame_default)
    : null;

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-[10px] font-bold tracking-[0.2em] text-amber-400/80 uppercase">
          Collection Squad
        </h3>
        <div className="flex gap-1.5 flex-wrap">
          {Object.keys(FORMATIONS).map((f) => (
            <button
              key={f}
              onClick={() => changeFormation(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                formation === f
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700/60"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Pitch */}
        <div className="relative w-full mx-auto rounded-xl overflow-hidden mb-5"
          style={{
            paddingBottom: "65%",
            background: "linear-gradient(180deg, #0d380d 0%, #0a2a0a 45%, #06190a 100%)",
          }}
        >
          {/* Pitch markings */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
          >
            <g stroke="white" strokeWidth="0.4" fill="none" opacity="0.12">
              <rect x="4" y="3" width="192" height="94" />
              <line x1="4" y1="50" x2="196" y2="50" />
              <circle cx="100" cy="50" r="12" />
              <circle cx="100" cy="50" r="0.8" fill="white" stroke="none" />
              <rect x="30" y="3" width="140" height="20" />
              <rect x="30" y="77" width="140" height="20" />
              <rect x="72" y="3" width="56" height="8" />
              <rect x="72" y="89" width="56" height="8" />
            </g>
          </svg>

          {/* Slot nodes */}
          {currentSlots.map((slot) => {
            const frameId = slots[slot.id] ?? null;
            const card = frameId ? unlockedCards.find((c) => c.id === frameId) : null;
            const style = frameId ? (FRAME_STYLES[frameId] ?? FRAME_STYLES.frame_default) : null;
            return (
              <PitchSlot
                key={slot.id}
                slot={slot}
                frameId={frameId}
                card={card ?? null}
                frameStyle={style}
                onRemove={() => removeFromSlot(slot.id)}
              />
            );
          })}
        </div>

        {/* Bench */}
        <div>
          <p className="text-[9px] font-bold tracking-widest text-gray-600 uppercase mb-2.5">
            {unlockedCards.length === 0
              ? "Unlock cards by levelling up"
              : benchCards.length === 0
              ? "All cards placed on pitch"
              : "Bench — drag onto a position to place"}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
            {benchCards.map((card) => (
              <BenchCard key={card.id} card={card} />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard && activeStyle ? (
            <div
              className="w-20 h-[104px] rounded-xl overflow-hidden shadow-2xl pointer-events-none ring-2 ring-amber-400/60"
              style={{ transform: "rotate(3deg) scale(1.05)" }}
            >
              {activeStyle.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeStyle.image}
                  alt={activeCard.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className={`w-full h-full bg-gradient-to-br ${activeStyle.gradient ?? "from-gray-700 to-gray-900"}`}
                />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function PitchSlot({
  slot,
  frameId,
  card,
  frameStyle,
  onRemove,
}: {
  slot: SlotDef;
  frameId: string | null;
  card: { id: string; name: string } | null;
  frameStyle: { border: string; shadow: string; gradient?: string; image?: string } | null;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id });

  return (
    <div
      ref={setNodeRef}
      className={`absolute z-10 transition-transform duration-150 ${isOver ? "scale-110 z-20" : ""}`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: isOver
          ? "translate(-50%, -50%) scale(1.12)"
          : "translate(-50%, -50%)",
      }}
    >
      {card && frameStyle ? (
        <button
          onClick={onRemove}
          title="Click to remove"
          className="group relative w-[72px] h-[96px] sm:w-[88px] sm:h-[116px] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 hover:ring-red-500/70 transition-all"
        >
          {frameStyle.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={frameStyle.image}
              alt={card.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${frameStyle.gradient ?? "from-gray-700 to-gray-900"}`}
            />
          )}
          <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </button>
      ) : (
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
            isOver
              ? "border-amber-400 bg-amber-400/25 shadow-lg shadow-amber-400/40"
              : "border-white/25 bg-black/35 hover:border-white/40"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] font-black text-white/75 leading-none text-center">
            {slot.label}
          </span>
        </div>
      )}
    </div>
  );
}

function BenchCard({
  card,
}: {
  card: { id: string; name: string; unlock_value: number | null };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const frameStyle = FRAME_STYLES[card.id] ?? FRAME_STYLES.frame_default;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex-shrink-0 flex flex-col items-center gap-1.5 cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
        isDragging ? "opacity-30 scale-95" : "hover:scale-105"
      }`}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
          : undefined
      }
    >
      <div className="w-16 h-[84px] rounded-xl overflow-hidden shadow-md ring-1 ring-white/10">
        {frameStyle.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frameStyle.image}
            alt={card.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${frameStyle.gradient ?? "from-gray-700 to-gray-900"}`}
          />
        )}
      </div>
      <span className="text-[9px] text-gray-400 font-medium text-center max-w-[64px] truncate leading-tight">
        {card.name}
      </span>
    </div>
  );
}
