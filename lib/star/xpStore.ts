"use client";

/**
 * THE XP BOOK, SHARED — the copy of lib/star/xpConfig.ts that Mikey edits on
 * /admin/star-xp, saved to the shared `star_xp_config` row
 * (app/api/star/xp-config/route.ts) so every career uses the same amounts.
 *
 * This browser keeps a copy, so the game uses the right amounts from the
 * first frame; refreshXpConfig() then updates it from the shared row. If the
 * table isn't there yet (supabase/migrations/star_xp_config.sql), the
 * amounts built into the code are used, and the admin page's Save keeps
 * changes on that device only — and says so.
 */
import { DEFAULT_XP, mergeXpConfig, setXpConfig, type XpConfig } from "./xpConfig";

const KEY = "star-xp-config-v1";

export function loadCachedXp(): XpConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? mergeXpConfig(JSON.parse(raw)) : DEFAULT_XP;
  } catch {
    return DEFAULT_XP;
  }
}

function cache(config: XpConfig | null): void {
  try {
    if (config) localStorage.setItem(KEY, JSON.stringify(config));
    else localStorage.removeItem(KEY);
  } catch {}
  setXpConfig(config);
}

/** The shared XP Book, or null when there isn't one (or the table is missing). */
export async function fetchXpConfig(): Promise<{ config: XpConfig | null; migrationMissing: boolean; updatedAt: string | null }> {
  try {
    const res = await fetch("/api/star/xp-config", { cache: "no-store" });
    const d = await res.json();
    return { config: d.config ? mergeXpConfig(d.config) : null, migrationMissing: !!d.migrationMissing, updatedAt: d.updatedAt ?? null };
  } catch {
    return { config: null, migrationMissing: false, updatedAt: null };
  }
}

/** Use this device's copy now, then the shared one when it arrives. */
export function refreshXpConfig(): void {
  setXpConfig(loadCachedXp());
  fetchXpConfig().then(({ config, migrationMissing }) => {
    if (config) cache(config);
    else if (!migrationMissing) cache(null); // the row was cleared: back to the code's amounts
  });
}

/** Save for everyone. Always keeps a copy on this device too. */
export async function saveXpConfig(config: XpConfig): Promise<{ shared: boolean; reason?: string }> {
  cache(config);
  try {
    const res = await fetch("/api/star/xp-config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
    });
    if (res.ok) return { shared: true };
    const d = await res.json().catch(() => ({}));
    return { shared: false, reason: d.error ?? `error ${res.status}` };
  } catch {
    return { shared: false, reason: "no connection" };
  }
}
