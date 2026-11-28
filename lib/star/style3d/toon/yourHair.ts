/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * YOUR HAIR ON YOUR 3D PLAYER (the barber, lib/star/barber.ts; Harry, 19 Nov 2026, RUL-UI-013).
 *
 * makePerson3d calls this for YOUR player when your barber's cut is a modelled hairstyle (toonYou().hairLook.mesh):
 * the style's file is loaded (once per page, withMeshopt: RUL-3D-007) and worn with hair.ts addToonHair on the
 * close-cut head the cut is worn on. A cap you already wear presses it in under its crown (accessories.ts capPress).
 * The scalp and beard paint (fade, waves, stubble…) need no file: dressPerson3d reads toonYou().hairLook.cut.
 * Nothing per frame: the hair sits as modelled (a scene may call `yourHairOf(p)?.update(dt)` for the swing).
 */
import type { Person3D } from "../../people3d";
import { toonYou } from "./bodies";
import { toonHairFits, type ToonHair } from "./hairStyles";
import { addToonHair, loadToonHair, type ToonHairOn } from "./hair";
import { withMeshopt } from "../../three3d/meshopt";

let loaderP: Promise<any> | null = null;
function loader(): Promise<any> {
  loaderP ??= import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }: any) => withMeshopt(new GLTFLoader()));
  loaderP.catch(() => { loaderP = null; });
  return loaderP;
}

/**
 * The hair each body wears and the style last asked for (a quick run of previews: only the last one is put on).
 * Kept on the body itself, not in this module: the page and the scenes may each load their own copy of this file
 * (it is imported from both), and two copies with two lists put two heads of hair on one man.
 */
type Held = Person3D & { yourHair?: ToonHairOn | null; yourHairWant?: ToonHair | null };
const ON = { get: (p: Person3D) => (p as Held).yourHair ?? undefined, set: (p: Person3D, h: ToonHairOn) => { (p as Held).yourHair = h; }, delete: (p: Person3D) => { (p as Held).yourHair = null; } };
const WANT = { get: (p: Person3D) => (p as Held).yourHairWant, set: (p: Person3D, s: ToonHair | null) => { (p as Held).yourHairWant = s; } };
/** The hair your player wears (null before it has loaded, or with no modelled style). */
export const yourHairOf = (p: Person3D): ToonHairOn | null => ON.get(p) ?? null;

/**
 * Put a modelled style on this body (default: your barber's, toonYou().hairLook.mesh). Resolves to the hair, or
 * null (no style, or a head it does not fit). A second call with another style takes the first one off.
 */
export async function wearYourHair(T: any, p: Person3D, style: ToonHair | undefined = toonYou().hairLook?.mesh): Promise<ToonHairOn | null> {
  WANT.set(p, style ?? null);
  const had = ON.get(p);
  if (had && had.hair === style) return had;
  if (!style || !p.toonHead || !toonHairFits(p.toonHead)) { had?.dispose(); ON.delete(p); return null; }
  const g = await loadToonHair(await loader(), style, p.toonHead);
  // built again, put away, or another style asked for while it loaded
  if (!p.body.parent || WANT.get(p) !== style) return null;
  const now = ON.get(p);
  if (now && now.hair === style) return now;
  now?.dispose();
  const h = addToonHair(T, p, g, style);
  if (h) { ON.set(p, h); h.mesh.userData.yourHair = true; } else ON.delete(p);
  return h;
}
