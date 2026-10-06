"use client";

/**
 * THE STAR PASS LAYOUT — which catalogue card (lib/star/rewardCatalogue.ts)
 * sits at which level, plus idea cards and status changes made on
 * /admin/star-pass.
 *
 * One shared answer for everyone: the `star_pass_config` row
 * (app/api/star/star-pass/route.ts). This browser keeps a copy so the Star
 * Pass opens instantly, refreshed from the shared row each time it loads. If
 * the table isn't there yet (supabase/migrations/star_pass_config.sql), the
 * layout built into the code is used, and the admin page's Save keeps
 * changes on that device only — and says so.
 */
import { useEffect, useState } from "react";
import { DEFAULT_PASS_LEVELS, fullCatalogue, type CatalogueItem, type RewardStatus } from "./rewardCatalogue";
import { isPassLevel } from "./starPassRewards";

export interface StarPassLayout {
  /** Level → catalogue card id. */
  levels: Record<number, string>;
  /** Idea cards added on the admin page. */
  ideas: CatalogueItem[];
  /** Status changes made on the admin page, by card id. */
  status: Record<string, RewardStatus>;
}

const KEY = "star-pass-layout-v1";
const EVENT = "star-pass-layout";

export function defaultLayout(): StarPassLayout {
  return { levels: { ...DEFAULT_PASS_LEVELS }, ideas: [], status: {} };
}

function clean(raw: unknown): StarPassLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<StarPassLayout>;
  if (!r.levels || typeof r.levels !== "object") return null;
  const levels: Record<number, string> = {};
  for (const [k, v] of Object.entries(r.levels)) if (typeof v === "string" && v && isPassLevel(Number(k))) levels[Number(k)] = v;
  return {
    levels,
    ideas: Array.isArray(r.ideas) ? r.ideas.filter((i) => i && typeof i.id === "string" && typeof i.name === "string") : [],
    status: r.status && typeof r.status === "object" ? r.status as Record<string, RewardStatus> : {},
  };
}

export function loadPassLayout(): StarPassLayout {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && clean(JSON.parse(raw))) || defaultLayout();
  } catch {
    return defaultLayout();
  }
}

export function cachePassLayout(layout: StarPassLayout): void {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

/** The shared layout, or null when there isn't one (or the table is missing). */
export async function fetchPassLayout(): Promise<{ layout: StarPassLayout | null; migrationMissing: boolean }> {
  try {
    const res = await fetch("/api/star/star-pass", { cache: "no-store" });
    const d = await res.json();
    return { layout: clean(d.layout), migrationMissing: !!d.migrationMissing };
  } catch {
    return { layout: null, migrationMissing: false };
  }
}

/** Save for everyone. Always keeps a copy on this device too. */
export async function savePassLayout(layout: StarPassLayout): Promise<{ shared: boolean; reason?: string }> {
  cachePassLayout(layout);
  try {
    const res = await fetch("/api/star/star-pass", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout }),
    });
    if (res.ok) return { shared: true };
    const d = await res.json().catch(() => ({}));
    return { shared: false, reason: d.error ?? `error ${res.status}` };
  } catch {
    return { shared: false, reason: "no connection" };
  }
}

/** The layout and the full catalogue, kept fresh: instant from this
 *  device's copy, then updated from the shared row. */
export function usePassLayout(): { layout: StarPassLayout; catalogue: CatalogueItem[] } {
  const [layout, setLayout] = useState<StarPassLayout>(defaultLayout);
  useEffect(() => {
    setLayout(loadPassLayout());
    const onChange = () => setLayout(loadPassLayout());
    window.addEventListener(EVENT, onChange);
    let live = true;
    fetchPassLayout().then(({ layout: shared }) => {
      if (live && shared) cachePassLayout(shared);
    });
    return () => { live = false; window.removeEventListener(EVENT, onChange); };
  }, []);
  return { layout, catalogue: fullCatalogue(layout.ideas, layout.status) };
}
