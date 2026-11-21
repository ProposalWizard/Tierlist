/**
 * TAP → WALK UP → ONE CARD (world kit, phase 1). Every 3D place shows the
 * same card for anything you can use or anyone you can talk to: a title, a
 * line or two, and its buttons. This file decides what you tapped, where you
 * stand for it, and what the card says; the place does the 3D and the page
 * draws the card (components/star/World3D.tsx). Pure: no three.js.
 */
import type { XZ } from "../tapWalk";
import { hashId, seeded, type DayPhase } from "./routine";
import type { SmartObject } from "./smartObject";

export interface CardAction { id: string; label: string; primary?: boolean }

export interface InteractCard {
  /** What the card is about: "obj:<id>" or "person:<id>". */
  key: string;
  title: string;
  sub?: string;
  lines: string[];
  actions: CardAction[];
  /** A small change it made (bond +2), shown under the lines. */
  change?: string;
}

/** What a tap landed on, nearest first: a person, a thing, else the floor. */
export type Tapped =
  | { kind: "person"; id: string }
  | { kind: "object"; id: string }
  | { kind: "floor"; at: XZ };

/** Where you stand to talk to someone: about a metre in front of him, on your side. */
export function talkSpot(him: XZ, hisYaw: number, you: XZ, dist = 1.05): XZ {
  // in front of him if you can be; else on the line from him to you
  const f: XZ = [Math.sin(hisYaw), Math.cos(hisYaw)];
  const front: XZ = [him[0] + f[0] * dist, him[1] + f[1] * dist];
  const dx = you[0] - him[0], dz = you[1] - him[1];
  const d = Math.hypot(dx, dz) || 1;
  const toYou: XZ = [him[0] + (dx / d) * dist, him[1] + (dz / d) * dist];
  // halfway between the two keeps you facing him without walking round behind
  return [(front[0] * 2 + toYou[0]) / 3, (front[1] * 2 + toYou[1]) / 3];
}

/** The card for a thing you can use. `taken`: every seat is in use. */
export function objectCard(o: SmartObject, opts: { using?: boolean; taken?: boolean } = {}): InteractCard {
  if (opts.using) {
    return {
      key: `obj:${o.id}`, title: o.label, lines: o.effect?.text ? [o.effect.text] : [],
      actions: [{ id: "leave", label: o.kind === "seat" || o.kind === "tv" ? "Stand up" : "Done", primary: true }],
    };
  }
  return {
    key: `obj:${o.id}`, title: o.label, lines: opts.taken ? ["Someone is using it."] : (o.prompt.lines ?? []),
    // `more`: other things to do with it, first (the bed: "Sleep till morning", then "Sit on the bed")
    actions: opts.taken ? [{ id: "close", label: "OK" }] : [
      ...(o.prompt.more ?? []).map((m, i) => ({ id: m.id, label: m.label, primary: i === 0 })),
      { id: "use", label: o.prompt.verb, primary: !o.prompt.more?.length }, { id: "close", label: "Not now" },
    ],
  };
}

/** What a team-mate says when you walk up, by what he is doing and the time of day. */
const OPENERS: Record<"sat" | "drink" | "stand" | "arrive", string[]> = {
  sat: ["Pull up a seat.", "Best spot in the garden, this.", "Legs are dead after that session."],
  drink: ["Want one? The fridge is stacked.", "Needed this. Proper hot out.", "Don't tell the nutritionist."],
  stand: ["Just stretching the hamstrings out.", "Physio says keep moving.", "You up for some keepy-ups after?"],
  arrive: ["Alright! Thought I'd drop by.", "Nice place. Bigger than mine.", "Got the kettle on?"],
};
const FOLLOW: Record<DayPhase, string[]> = {
  night: ["Should be in bed really."],
  morning: ["Training's at half two, don't be late.", "Gaffer wants us in early tomorrow."],
  midday: ["Starving. What's for lunch?", "Did you see the team sheet yet?"],
  afternoon: ["Big one this weekend.", "Fancy the races on Saturday?"],
  evening: ["Early night for me.", "Watching the late game?"],
};

/** A few lines for the talk card (seeded: the same man, moment and visit say the same). */
export function smallTalk(id: string, doing: keyof typeof OPENERS, phase: DayPhase, visit = 0): string[] {
  const r = seeded(hashId(`${id}|${doing}|${phase}|${visit}`));
  const a = OPENERS[doing], b = FOLLOW[phase];
  return [a[Math.floor(r() * a.length)], b[Math.floor(r() * b.length)]];
}

/** The card for a team-mate. `chat`: the living-world chat is on (lib/star/life). */
export function personCard(o: { id: string; name: string; role?: string; lines: string[]; chat?: boolean; change?: string }): InteractCard {
  const actions: CardAction[] = [];
  if (o.chat) actions.push({ id: "chat", label: "Chat", primary: true });
  actions.push({ id: "close", label: "See you", primary: !o.chat });
  return { key: `person:${o.id}`, title: o.name, sub: o.role ?? "Team-mate", lines: o.lines, actions, change: o.change };
}
