/**
 * THE EVENT BOOK, as the game reads it (living world, phase 1). The data is
 * book/events.json; nothing about an event lives in code. tests/star/lifeEvents.mts
 * checks every event against the weight rules (validate.ts) before it can ship.
 */
import type { LifeChat, LifeEvent } from "./types";
import raw from "./book/events.json";

const BOOK = raw as unknown as { events: LifeEvent[]; chats: LifeChat[] };

export const EVENTS: LifeEvent[] = BOOK.events;
export const CHATS: LifeChat[] = BOOK.chats;
const BY_ID = new Map(EVENTS.map((e) => [e.id, e]));
export const eventById = (id: string): LifeEvent | undefined => BY_ID.get(id);
