/**
 * CASTING — a role and the career's data → how the actor looks. Your player
 * wears your skin tone, hair, face picture, number, accessories and club
 * kit; team-mates your kit with their own skin and numbers; the manager and
 * chairman suits; a rival the other club's kit. Seeded by the actor's id, so
 * the same script always casts the same faces.
 */
import type { ActorLook, CareerContext, CastMember } from "./types";
import { hashStr, rng } from "./math";
import { playerModelFor } from "../people3d";
import { ALL_PRESETS, lookKey, presetById, presetLook, presetsFor, type PeoplePreset, type PersonLookResult, type PersonRole } from "../people/presets";

const SKINS = ["#c68642", "#8d5524", "#e0ac69", "#5c3a1e", "#f1c27d", "#a36a3e", "#d9a066", "#6b4226"];
const HAIRS = ["#2b1b10", "#111111", "#4a2e1c", "#1b120c", "#6b4a2a", "#0f0b08", "#8a6a3a"];
const BODIES = ["player", "player-buzz", "player", "player-long", "player-buzz"] as const;

export const DEFAULT_CLUB = { name: "Knowitball FC", short: "Knowitball", shirt: "#c8102e", trim: "#ffffff" };
export const DEFAULT_RIVAL = { name: "City Rovers", short: "Rovers", shirt: "#1d4ed8", trim: "#ffffff" };

export function castLook(m: CastMember, career?: CareerContext): Required<Pick<ActorLook, "body" | "skin">> & ActorLook {
  const R = rng(hashStr(m.id));
  const club = career?.club ?? DEFAULT_CLUB;
  const opp = career?.opponent ?? DEFAULT_RIVAL;
  const base: ActorLook = {};
  // "you" is always your player, whatever the scene calls him (the trophy lift casts him as the captain)
  switch (m.id === "you" ? "you" : m.role) {
    case "you": {
      const p = career?.player ?? {};
      Object.assign(base, {
        body: playerModelFor(p.hairStyle ?? "short"), skin: p.skin ?? "#c68642", hair: p.hair ?? "#2b1b10",
        kit: { shirt: club.shirt, trim: club.trim }, number: p.number ?? 9, face: p.face, outfit: "kit",
        accessories: m.role === "captain" ? [...(p.accessories ?? []), { slot: "armband", color: "#fbbf24" }] : p.accessories,
      });
      break;
    }
    case "manager": {
      const mg = career?.manager ?? {};
      Object.assign(base, { body: "manager", skin: mg.skin ?? "#e0ac69", hair: mg.hair ?? "#2b1d14", grey: mg.grey ?? 0.35, outfit: "suit" });
      break;
    }
    case "chairman": case "presenter": case "journalist": case "agent":
      Object.assign(base, { body: "manager", skin: R.pick(SKINS), hair: R.pick(HAIRS), grey: m.role === "chairman" ? 0.75 : R.range(0, 0.4), outfit: "suit" });
      break;
    case "mentor":
      Object.assign(base, { body: "player-buzz", skin: "#a36a3e", hair: "#1b120c", kit: { shirt: "#1b1f2a", trim: "#d4a017" }, outfit: "tracksuit" });
      break;
    case "rival":
      Object.assign(base, { body: R.pick(BODIES), skin: R.pick(SKINS), hair: R.pick(HAIRS), kit: { shirt: opp.shirt, trim: opp.trim }, number: R.int(2, 23), outfit: "kit" });
      break;
    case "keeper":
      Object.assign(base, { body: "player-buzz", skin: R.pick(SKINS), hair: R.pick(HAIRS), kit: { shirt: "#16a34a", trim: "#0b3d1d" }, number: 1, outfit: "keeper" });
      break;
    case "fan": case "family":
      Object.assign(base, { body: R.pick(BODIES), skin: R.pick(SKINS), hair: R.pick(HAIRS), kit: { shirt: club.shirt, trim: club.trim }, outfit: "casual" });
      break;
    case "physio":
      Object.assign(base, { body: "player-buzz", skin: R.pick(SKINS), hair: R.pick(HAIRS), kit: { shirt: "#1f2433", trim: "#1f2433" }, outfit: "tracksuit" });
      break;
    default: // teammate, captain
      Object.assign(base, {
        body: R.pick(BODIES), skin: R.pick(SKINS), hair: R.pick(HAIRS), kit: { shirt: club.shirt, trim: club.trim },
        number: R.int(2, 23), outfit: "kit", accessories: m.role === "captain" ? [{ slot: "armband", color: "#fbbf24" }] : undefined,
      });
  }
  const out = { ...base, ...(m.look ?? {}) } as ActorLook;
  return { ...out, body: out.body ?? "player", skin: out.skin ?? "#c68642" };
}

// ── THE PEOPLE PRESETS (20 Nov 2026) ─────────────────────────────────────────
// Everyone in a cut scene who isn't you is cast from the people presets
// (lib/star/people/presets.ts): his own head, build, modelled hairstyle, drawn face and
// clothes, the same every time for the same id, and nobody in one scene shares a preset.

/** The Icon: an older legend, grey and receding or thinning, in a dark coat with an open collar. */
const LEGEND_IDS = ["mgr-elder-statesman", "mgr-veteran-gaffer", "mgr-old-pro"] as const;
// (he wears his preset's own tie: with the collar open, the suit head's modelled collar had nothing in it)
export const LEGEND_PRESETS: readonly PeoplePreset[] = LEGEND_IDS.map((id) => presetById(id)!);

/** The presets a cut-scene role is cast from. */
export function presetPoolFor(role: CastMember["role"]): { role: PersonRole; pool: readonly PeoplePreset[] } | null {
  switch (role) {
    case "you": return null;
    // the boss is the older man in the room: 44 and up
    case "manager": return { role: "manager", pool: presetsFor("manager").filter((p) => p.age >= 44 && p.outfit === "suit") };
    case "chairman": return { role: "staff", pool: ALL_PRESETS.filter((p) => p.outfit === "suit" && p.age >= 55 && p.roles.includes("staff")) };
    case "mentor": return { role: "staff", pool: LEGEND_PRESETS };
    // the press pack: the journalists, and anyone in a smart or casual set (agents, analysts, fans) as reporters,
    // so a full room has no two alike
    case "journalist": case "presenter": return { role: "journalist", pool: [...presetsFor("journalist"), ...ALL_PRESETS.filter((p) => (p.outfit === "smart" || p.outfit === "casual") && !p.roles.includes("journalist") && !p.roles.includes("player"))] };
    case "agent": return { role: "agent", pool: presetsFor("agent") };
    case "physio": return { role: "staff", pool: presetsFor("staff").filter((p) => p.outfit === "tracksuit") };
    case "fan": case "family": return { role: "fan", pool: presetsFor("fan") };
    default: return { role: "player", pool: presetsFor("player") };
  }
}

const hash32 = (s: string) => hashStr(s) >>> 0;

/**
 * The whole cast's looks at once. Your player: castLook as it always was. Everyone else: a people
 * preset by the hash of his id (`look.people`), moved on to his next preset while it is already
 * in the scene (or, off the pitch, while its head and coat are). The same cast gives the same looks.
 */
export function castAll(cast: readonly CastMember[], career?: CareerContext): Map<string, ReturnType<typeof castLook>> {
  const out = new Map<string, ReturnType<typeof castLook>>();
  const presets = new Set<string>(), keys = new Set<string>();
  const club = career?.club ?? DEFAULT_CLUB, opp = career?.opponent ?? DEFAULT_RIVAL;
  for (const m of cast) {
    const look = castLook(m, career);
    let P = m.look?.people === null || m.id === "you" ? null : presetPoolFor(m.role);
    // the one who asks (seen up close, his face full size): a real press preset, never a stand-in from the
    // agents and fans the back rows borrow (20 Nov 2026: the Super-agent's curls head read flat and orange)
    if (P && (m.role === "journalist" || m.role === "presenter") && (m.look?.detail ?? 1) >= 1) P = { role: "journalist", pool: presetsFor("journalist").filter((p) => p.head !== "h1") };
    if (P && P.pool.length) {
      const kit = m.role === "rival" ? { shirt: opp.shirt, trim: opp.trim } : m.role === "keeper" ? { shirt: "#16a34a", trim: "#0b3d1d" } : { shirt: club.shirt, trim: club.trim };
      const pick = (salt: number) => presetLook(P.pool[(hash32(`${m.id}#preset`) + salt * 7919) % P.pool.length], m.id, P.role, { kit });
      let L = pick(0);
      const taken = (x: PersonLookResult) => presets.has(x.preset) || (!x.kit && keys.has(lookKey(x)));
      for (let salt = 1; salt < 80 && taken(L); salt++) L = pick(salt);
      presets.add(L.preset); keys.add(lookKey(L));
      look.people = L;
      look.skin = L.skin; look.hair = L.hairColour; look.grey = L.grey;
    }
    out.set(m.id, look);
  }
  return out;
}
