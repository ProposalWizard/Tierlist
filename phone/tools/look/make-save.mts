/**
 * ONE CAREER FOR BOTH APPS (the look check). Prints JSON:
 *   { packed: {localStorage key: value}, next: {localStorage key: value} }
 * A fresh Premier League career at Arsenal, every screen open (no unlock chain,
 * no tour), the same idea as scripts/perf2d/make-save.mts.
 *  - packed: the website's own save (lib/star/storage.ts saveCareer, signed-out slot)
 *  - next:   KIB Next's save in a browser (react-native-mmkv on the web keeps
 *            "<id>\<key>" in localStorage; phone/src/game/save.ts: id
 *            "knowitball-career", key "career-v2", the plain career JSON)
 * Both apps fill in the real squads from the same packed files when they load it.
 *
 *   npx tsx phone/tools/look/make-save.mts > save.json
 */
import { makeInitialCareer } from "../../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../../lib/star/clubs";
import { saveCareer, ANON_SCOPE } from "../../../lib/star/storage";
import type { StarPlayer } from "../../../lib/star/types";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const player = {
  firstName: "Look", lastName: "Check", age: 18, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer;
const career = { ...makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]), unlocks: undefined };
saveCareer(career, ANON_SCOPE);
const packed = Object.fromEntries(store);
const next = { "knowitball-career\\career-v2": JSON.stringify(career) };
console.log(JSON.stringify({ packed, next }));
