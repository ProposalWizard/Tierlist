/** Every story file in this folder except the kit man's (arcBook.ts imports that one itself).
 *  One line per file; tests/star/lifeArcs.mts fails if a JSON file here is missing from this list. */
import type { LifeArc } from "../../types";
import a_bar_for_breakfast from "./bar-for-breakfast.json";
import a_left_back from "./left-back.json";
import a_number_nine from "./number-nine.json";
import a_pe_teacher from "./pe-teacher.json";
import a_play_through_it from "./play-through-it.json";
import a_the_crumble from "./the-crumble.json";
import a_the_lantern from "./the-lantern.json";
import a_the_sign from "./the-sign.json";
import a_the_tunnel from "./the-tunnel.json";
import a_the_watch from "./the-watch.json";

export const STORY_ARCS: LifeArc[] = [
  a_bar_for_breakfast as unknown as LifeArc,
  a_left_back as unknown as LifeArc,
  a_number_nine as unknown as LifeArc,
  a_pe_teacher as unknown as LifeArc,
  a_play_through_it as unknown as LifeArc,
  a_the_crumble as unknown as LifeArc,
  a_the_lantern as unknown as LifeArc,
  a_the_sign as unknown as LifeArc,
  a_the_tunnel as unknown as LifeArc,
  a_the_watch as unknown as LifeArc,
];
