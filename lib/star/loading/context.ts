/**
 * What the next loading screen of a section should say (the match's
 * programme, the drill's name), set by the screen that leads there. A
 * loading screen that opens before the place's own file has even arrived
 * (lib/star/lazyScreen.ts's waiting cover) reads it from here, so it can
 * already show the real fixture.
 */
import type { LoadSection } from "./pick";
import type { ProgrammeData } from "./programme";

export interface LoadContext {
  /** match: the programme. */
  programme?: ProgrammeData;
  /** training: the drill's name and one line on it. */
  drill?: { name: string; line?: string; shirt?: string };
  /** gala: the night's title and your name. */
  gala?: { title: string; name: string; season: number };
  /** Your club's colours, for the boards and magnets. */
  shirt?: string;
  trim?: string;
}

const store = new Map<LoadSection, LoadContext>();

export function setLoadContext(section: LoadSection, ctx: LoadContext) { store.set(section, ctx); }
export function loadContext(section: LoadSection): LoadContext | undefined { return store.get(section); }
