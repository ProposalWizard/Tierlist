/**
 * Filling an event's lines: {mate.short}, {hack.outlet}, {you.short} and
 * {if source}…{/if} (living world, phase 1).
 */
import type { CareerState } from "../types";
import { personInfo } from "./people";
import { holds, type CondCtx } from "./cond";

export const PLACEHOLDER_KEYS = ["name", "short", "age", "outlet", "club", "position", "initial", "signoff", "from"] as const;
export const YOU_KEYS = ["name", "short", "club", "number", "horse", "age"] as const;

export function fillLine(src: string, c: CareerState, cast: Record<string, string>, ctx: CondCtx): string {
  // {if X}…{/if}: X is a cast slot (filled?) or any condition.
  let s = src.replace(/\{if ([^}]+)\}([\s\S]*?)\{\/if\}/g, (_, cond: string, body: string) => {
    const k = cond.trim();
    const slot = /^(!?)([a-z]+)$/.exec(k);
    const ok = slot ? (slot[1] ? !cast[slot[2]] : !!cast[slot[2]]) : holds(k, ctx);
    return ok ? body : "";
  });
  s = s.replace(/\{([a-z]+)\.([a-zA-Z]+)\}/g, (all, slot: string, key: string) => {
    // Events v2: what the story keeps and the game just played.
    if (slot === "arc") { const v = ctx.v2?.arc?.v[key]; return v === undefined ? all : String(v); }
    if (slot === "activity") { const a = ctx.v2?.activity as unknown as Record<string, number> | undefined; return a && a[key] !== undefined ? String(a[key]) : all; }
    if (slot === "you") {
      const p = c.player;
      if (key === "name") return `${p.firstName} ${p.lastName}`;
      if (key === "short") return p.lastName || p.firstName;
      if (key === "club") return p.club;
      if (key === "number") return String(c.squadNumber ?? 9);
      if (key === "horse") return c.horse?.name ?? "your horse";
      if (key === "age") return String(p.age);
      return all;
    }
    const id = cast[slot];
    if (!id) return "someone";
    if (id.startsWith("oneoff:")) return key === "name" ? "A number you do not know" : "him";
    const info = personInfo(c, id);
    if (!info) return "someone";
    if (key === "name") return info.name;
    if (key === "short") return info.short;
    if (key === "outlet") return info.outlet ?? "the papers";
    if (key === "age") return String(info.player?.age ?? info.pool?.age ?? "");
    if (key === "initial") return info.short.replace(/^(Mr|Mrs) /, "").charAt(0);
    if (key === "signoff") return info.pool?.signoff ?? info.short;
    if (key === "from") return info.pool?.from ?? "round here";
    if (key === "club") return c.player.club;
    if (key === "position") return info.player?.position ?? "";
    return all;
  });
  return s.replace(/\s{2,}/g, " ").trim();
}

/** "you-snubbed-him" → "you snubbed him": how a memory reads on the People page. */
export function tagWords(tag: string): string {
  return tag.replace(/-/g, " ");
}
