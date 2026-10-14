"use client";
import { useState } from "react";
import { GAMEPLAY_SWITCHES, type GameplaySwitch } from "@/lib/star/gameplayVersion";
import { LOOK_ROWS, setLookRow, useLook, type LookRowId } from "@/lib/star/lookRows";
import { LookRow, NEW_OLD } from "./DeviceSettings";
import { SetCard, SetNote, SetSection } from "./settingsKit";

/**
 * SETTINGS → UPDATES (Leo, 14 Oct 2026): "just add a tab to the settings page
 * in game called updates … when u expand that u can select these new and old
 * version settings things. so annoying going to testing pages to change a
 * setting then going back to the game."
 *
 * One folded card per update, newest first. Each opens to an All new / All old
 * pair and every New | Old row of that update. A row shared by two updates
 * (Keeper pro, Shots, Ball physics) is the same switch in both places.
 * Everything is stored on this phone only; saves are never touched.
 */

interface Update {
  id: string;
  title: string;
  date: string;
  sub: string;
  rows: LookRowId[];
  /** Rows the update was measured with: "All new" turns them on too. */
  with?: LookRowId[];
}

const has = (id: string): id is LookRowId => id in LOOK_ROWS;

/** Newest first. A row id not in LOOK_ROWS yet is skipped, so a half-merged round can't crash Settings. */
const ALL_UPDATES: Update[] = [
  {
    id: "r16", title: "Keepers, hitboxes & jumping", date: "14 Oct 2026",
    sub: "Henry finishes, top corners, chips over heads, physical jumps",
    rows: (["keeperFinish", "hitboxes"] as string[]).filter(has),
  },
  {
    id: "oct13", title: "Oct 13 gameplay update", date: "13 Oct 2026",
    sub: "Shot power, contact field, keeper feel, team-mate shots, match feel",
    rows: ["shotPower", "contactField", "keeperFeel", "mateShots", "matchFeel"] as LookRowId[],
    with: ["shotsPro", "keeperPro", "ballPhysics"] as LookRowId[],
  },
  {
    id: "v015", title: "v0.15 gameplay round", date: "12 Oct 2026",
    sub: "Keeper pro, shots, knuckleball, ball physics, match flow, radar",
    rows: ["keeperPro", "shotsPro", "knucklePower", "ballPhysics", "matchFlow", "matchRadar"] as LookRowId[],
  },
  {
    id: "base", title: "Earlier switches", date: "",
    sub: "Keepers (human), Old or New UI",
    rows: ["keepers", "ui"] as LookRowId[],
  },
];
export const UPDATES = ALL_UPDATES.filter((u) => u.rows.length > 0);

function rowNote(id: LookRowId, look: Record<LookRowId, string>): React.ReactNode {
  const g = GAMEPLAY_SWITCHES[id as GameplaySwitch] as { newText?: string; oldText?: string } | undefined;
  if (g?.newText) return look[id] === "new" ? g.newText : g.oldText;
  if (id === "matchRadar") return "New: a live mini-pitch above the commentary between your chances. Old: the commentary on its own.";
  if (id === "matchFeel") return "New: impact, hit-stop, sounds and keeper dives. Old: as before.";
  if (id === "ui") return "Old: the game as it was before v0.23, kept as a backup. Same save.";
  return undefined;
}

function stateOf(ids: LookRowId[], look: Record<LookRowId, string>): "new" | "old" | "mixed" {
  const vals = new Set(ids.map((id) => (look[id] === LOOK_ROWS[id].newValue ? "new" : "old")));
  return vals.size === 1 ? (vals.has("new") ? "new" : "old") : "mixed";
}

const PILL: Record<string, string> = { new: "bg-emerald-400 text-gray-950", old: "bg-white/15 text-white", mixed: "bg-amber-400 text-gray-950" };

export default function UpdatesPanel({ glow }: { glow: string }) {
  const look = useLook();
  const [open, setOpen] = useState<string | null>(UPDATES[0]?.id ?? null);
  const setAll = (u: Update, v: "new" | "old") => {
    for (const id of [...u.rows, ...(u.with ?? [])]) setLookRow(id, v === "new" ? LOOK_ROWS[id].newValue : LOOK_ROWS[id].oldValue);
  };
  return (
    <div data-updates-panel>
      <SetSection className="mb-1.5 mt-1">Updates</SetSection>
      <SetNote dim className="mb-2 text-[11px]">
        Each update can be switched New or Old here. Old = the game before it. It changes your real matches on this phone only.
      </SetNote>
      <div className="space-y-2">
        {UPDATES.map((u) => {
          const isOpen = open === u.id;
          const all = [...u.rows, ...(u.with ?? [])];
          const st = stateOf(all, look);
          return (
            <SetCard key={u.id} tone={glow} className="p-0" data-update={u.id}>
              <button onClick={() => setOpen(isOpen ? null : u.id)} aria-expanded={isOpen}
                className="kib-press flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                <span className="min-w-0">
                  <span className="block text-[16px] font-black leading-tight text-white">{u.title}</span>
                  <span className="block truncate text-[11px] font-semibold text-white/85">{u.date ? `${u.date} · ` : ""}{u.sub}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`px-1.5 py-0.5 text-[10px] font-black uppercase ${PILL[st]}`} data-update-state={st}>{st}</span>
                  <span className="text-[12px] font-black text-emerald-300">{isOpen ? "▾" : "▸"}</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-white/10 px-3 pb-1">
                  <div className="mt-2 flex gap-2">
                    <button className="flex-1 border-2 border-emerald-300 bg-emerald-400 px-2 py-1.5 text-[12px] font-black uppercase text-gray-950"
                      data-update-all="new" onClick={() => setAll(u, "new")}>All new</button>
                    <button className="flex-1 border-2 border-white/40 px-2 py-1.5 text-[12px] font-black uppercase text-white"
                      data-update-all="old" onClick={() => setAll(u, "old")}>All old</button>
                  </div>
                  {u.with && (
                    <SetNote dim className="mt-1 text-[10px]">
                      All new also turns on {u.with.map((id) => LOOK_ROWS[id].label).join(", ")} (it was tested with them).
                    </SetNote>
                  )}
                  {u.rows.map((id) => <LookRow key={id} id={id} look={look} tabs={NEW_OLD} note={rowNote(id, look)} />)}
                </div>
              )}
            </SetCard>
          );
        })}
      </div>
    </div>
  );
}
