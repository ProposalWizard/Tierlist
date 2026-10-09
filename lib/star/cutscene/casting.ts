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
  switch (m.role) {
    case "you": {
      const p = career?.player ?? {};
      Object.assign(base, {
        body: playerModelFor(p.hairStyle ?? "short"), skin: p.skin ?? "#c68642", hair: p.hair ?? "#2b1b10",
        kit: { shirt: club.shirt, trim: club.trim }, number: p.number ?? 9, face: p.face, accessories: p.accessories, outfit: "kit",
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
