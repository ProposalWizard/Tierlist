/**
 * APPROVED SCENE EDITS (Harry, 20 Oct 2026, answers 3D-3, 3D-4, 3D-5, GEN-1, 31).
 *  - lib/star/sceneEdits/approval.ts: only an APPROVED edit is used; only where
 *    and when it says; the newer of the shared and committed copies wins; the
 *    committed file keeps approved edits and drops withdrawn ones.
 *  - lib/star/sceneEdits/walkEdit.ts: a view edit moves the camera round what
 *    it looks at (no edit = the same point); the lens blends in with the card.
 *  - lib/star/sceneEdits/kept.ts: marks and kept scenes merge (newer wins).
 *  - lib/star/sceneEdits/whenPlays.ts: one row per event kind, and "not wired"
 *    while no career screen calls the generator.
 */
import fs from "node:fs";
import path from "node:path";
import {
  PLACE_USE, appliesHere, approvedOnly, cleanApproval, defaultApproval, mergeSceneEditsFile, pickApproved, placeOf, sceneEditOf, editsFromFile,
  type SavedSceneEdit,
} from "../../lib/star/sceneEdits/approval";
import { editCamera, editFov, lensToFov, viewEdited, makeLightEditor } from "../../lib/star/sceneEdits/walkEdit";
import { allMarks, keepScene, keptScenes, markTally, recipeId, type Recipe } from "../../lib/star/sceneEdits/kept";
import { WHEN_PLAYS, EVENT_KINDS } from "../../lib/star/sceneEdits/whenPlays";
import { cutsceneList, CUT_STILL_AT } from "../../lib/star/cutscene/sceneList";
import { FIXTURES, FIXTURE_LIST } from "../../lib/star/cutscene/fixtures";
import { generateScript } from "../../lib/star/cutscene/generate";
import COMMITTED from "../../lib/star/data/sceneEdits.json";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// ── approval: who uses an edit ──
const t1 = "2026-10-20T01:00:00.000Z", t2 = "2026-10-20T02:00:00.000Z";
const signing: SavedSceneEdit = { place: "signing", shots: { talk: { lens: 50 } }, scene: { exposure: 1.2 }, approval: { approved: true, at: t1, where: ["career"], when: "always" } };
ok(appliesHere("signing", signing, { where: "career" }), "an approved signing edit is used in a career");
ok(!appliesHere("signing", signing, { where: "test" }), "…but not on the test page when only 'career' is ticked");
ok(!appliesHere("signing", { ...signing, approval: { ...signing.approval!, approved: false } }, { where: "career" }), "an unapproved edit is never used");
ok(!appliesHere("signing", { ...signing, approval: undefined }, { where: "career" }), "an edit with no approval at all is never used");
const onlyTransfer = { ...signing, approval: { ...signing.approval!, when: "transfer" } };
ok(appliesHere("signing", onlyTransfer, { where: "career", facts: ["transfer"] }), "'only a move' is used for a transfer signing");
ok(!appliesHere("signing", onlyTransfer, { where: "career", facts: ["trial"] }), "…and not for the first contract");
const garden: SavedSceneEdit = { place: "garden", views: { follow: { dist: 1.3 } }, approval: { approved: true, at: t1, where: ["career", "test"], when: "night" } };
ok(appliesHere("garden", garden, { where: "test", facts: ["night"] }) && !appliesHere("garden", garden, { where: "test", facts: ["day"] }), "garden 'only at night' follows the sky");
ok(cleanApproval("office", { approved: true, where: ["career", "moon"], when: "night" })?.when === "always", "a 'when' the place doesn't have falls back to always");
ok(JSON.stringify(cleanApproval("office", { approved: true, where: ["career", "moon", "career"], when: "always" })?.where) === '["career"]', "unknown and repeated 'where' choices are dropped");
ok(PLACE_USE.director.when.length === 19 && PLACE_USE.house.when.length === 7, "the director's 'when' lists all 18 event kinds; the house its 6 homes");
ok(defaultApproval().approved && defaultApproval().where.join() === "career", "a fresh approval: the real game, always");
ok(placeOf("shop", {}) === "shop" && placeOf("goal", {}) === "director" && placeOf("x", { place: "house" }) === "house", "place from the save id or its own place field");

// ── the newer copy wins; nothing applies → null (the scene as written) ──
const older = { ...signing, shots: { talk: { lens: 40 } } };
const newer = { ...signing, shots: { talk: { lens: 70 } }, approval: { ...signing.approval!, at: t2 } };
ok((pickApproved("signing", { signing: newer }, { signing: older }, { where: "career" })?.shots as Record<string, { lens: number }>).talk.lens === 70, "shared newer than committed: shared wins");
ok((pickApproved("signing", { signing: older }, { signing: newer }, { where: "career" })?.shots as Record<string, { lens: number }>).talk.lens === 70, "committed newer than shared: committed wins");
ok((pickApproved("signing", { signing: { ...newer, approval: { ...newer.approval!, approved: false } } }, { signing: older }, { where: "career" })?.shots as Record<string, { lens: number }>).talk.lens === 40,
  "a withdrawn shared copy falls back to the committed one");
ok(pickApproved("signing", {}, {}, { where: "career" }) === null, "no edit anywhere: null (as written)");
ok(pickApproved("office", { office: { place: "office", approval: { approved: true, where: ["test"], when: "always" } } }, null, { where: "career" }) === null, "approved for the test page only: the career gets null");

// ── what a scene is handed ──
const flat = sceneEditOf<Record<string, unknown>>(signing);
ok(flat.exposure === 1.2 && !("scene" in flat) && !("approval" in flat) && !("place" in flat) && !!flat.shots, "the scene gets shots + flat light dials, no bookkeeping");

// ── the API's ?approved=1 and the committed file ──
const all = { signing, office: { place: "office", approval: { approved: false, where: ["career"], when: "always" } }, "mark:gen-x": { mark: "good", recipe: {} }, "kept:gen-x": { kept: {} } };
ok(Object.keys(approvedOnly(all)).join() === "signing", "?approved=1 sends only approved edits (never marks or kept scenes)");
const m1 = mergeSceneEditsFile("", [{ scriptId: "signing", edits: signing }, { scriptId: "office", edits: all.office as SavedSceneEdit }]);
const f1 = editsFromFile(JSON.parse(m1.text));
ok(Object.keys(f1).join() === "signing" && m1.ids.join() === "signing", "commit writes the approved edit only");
const m2 = mergeSceneEditsFile(m1.text, [{ scriptId: "signing", edits: { ...signing, approval: { ...signing.approval!, approved: false } } }]);
ok(Object.keys(editsFromFile(JSON.parse(m2.text))).length === 0 && m2.ids.join() === "signing", "a withdrawn approval takes it OUT of the file");
const m3 = mergeSceneEditsFile("not json", [{ scriptId: "garden", edits: garden }]);
ok(Object.keys(editsFromFile(JSON.parse(m3.text))).join() === "garden", "a broken file is rebuilt, not crashed on");
ok(typeof (COMMITTED as { note?: string }).note === "string" && typeof (COMMITTED as { edits?: object }).edits === "object", "the committed file is in the code and has the right shape");

// ── walk views: the camera math ──
ok(editCamera([1, 2, 3], [0, 1, 0], null).join() === "1,2,3" && editCamera([1, 2, 3], [0, 1, 0], { dist: 1, turn: 0, rise: 0 }).join() === "1,2,3", "no view edit: the camera stays where the scene put it");
const back2 = editCamera([0, 1, 5], [0, 1, 0], { dist: 2 });
ok(near(back2[2], 10) && near(back2[1], 1), "distance ×2 doubles the gap to what it looks at");
const turned = editCamera([0, 1, 5], [0, 1, 0], { turn: 90 });
ok(near(Math.hypot(turned[0], turned[2]), 5) && near(Math.abs(turned[0]), 5, 1e-6), "a 90° turn keeps the distance and swings round");
ok(near(editCamera([0, 1, 5], [0, 1, 0], { rise: 0.5 })[1], 1.5), "rise lifts it");
ok(!viewEdited({ dist: 1 }) && viewEdited({ lens: 35 }), "only real changes count as edited");
ok(near(editFov(54, null, null, 0), 54) && near(editFov(54, { views: { follow: { lens: 35 } } }, null, 0), lensToFov(35)), "lens: none = the scene's own, else the walking view's");
ok(near(editFov(54, { views: { car: { lens: 24 } } }, "car", 0.5), 54 + (lensToFov(24) - 54) * 0.5), "a card's lens blends in with the card shot");

// the light: an angle turns the key light round, null puts it back
type L = { isLight?: boolean; intensity?: number; userData: Record<string, unknown> };
const key = { position: { x: 10, y: 5, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } }, intensity: 2, color: { v: "#fff", set(c: string) { this.v = c; }, copy(c: unknown) { this.v = (c as { v: string }).v; }, clone() { return { v: this.v }; } } };
const renderer = { toneMappingExposure: 1.1 };
const lights: L[] = [key as unknown as L, { isLight: true, intensity: 0.5, userData: {} }];
(key as unknown as L).isLight = true; (key as unknown as L).userData = {};
const le = makeLightEditor({ key, renderer, lookH: false, scene: { traverse: (f) => lights.forEach(f) } });
le({ keyAngle: 90, keyLight: 2, exposure: 1.5, keyColor: "#ff0000" });
ok(near(key.position.x, 0, 1e-9) && near(key.position.z, 10) && key.intensity === 4 && near(renderer.toneMappingExposure, 1.65) && key.color.v === "#ff0000", "light edit: angle, strength, exposure, colour");
le(null);
ok(near(key.position.x, 10) && key.intensity === 2 && near(renderer.toneMappingExposure, 1.1) && key.color.v === "#fff", "no edit: the light exactly as written");
const le2 = makeLightEditor({ key, renderer, lookH: true, scene: { traverse: (f) => lights.forEach(f) } });
le2({ exposure: 2 });
ok(lights[1].intensity === 1 && key.intensity === 4 && near(renderer.toneMappingExposure, 1.1), "look H: exposure scales the lights, not the tone map");
le2(null);
ok(lights[1].intensity === 0.5 && key.intensity === 2, "…and puts them back");

// ── the generator's marks and kept scenes ──
const r: Recipe = { kind: "scored", emotion: "joy", stakes: 0.8, intensity: 0.7, seed: 3 };
ok(recipeId(r) === "gen-scored-joy-80-70-3", "one id per recipe");
const s1 = generateScript({ kind: "scored", emotion: "joy", stakes: 0.8, intensity: 0.7, home: true }, 3);
const k1 = keepScene(s1, r, new Date(t1)), k2 = { ...keepScene(s1, r, new Date(t2)), name: "newer" };
const ks = keptScenes({ [`kept:${k1.id}`]: { kept: k1 }, "mark:x": { mark: "good" } }, [k2]);
ok(ks.length === 1 && ks[0].name === "newer" && ks[0].script.tracks.length > 0, "kept scenes merge by id; the newer wins");
ok(JSON.stringify({ kept: k1 }).length < 50_000, "a kept scene fits the shared table's size limit");
const marks = allMarks({ [`mark:${recipeId(r)}`]: { mark: "bad", recipe: r, at: t1 } }, { [recipeId(r)]: { mark: "good", recipe: r, at: t2 } });
ok(marks[recipeId(r)].mark === "good" && markTally(marks).scored.good === 1, "marks: the newer wins; the tally counts them");

// ── when does a generated scene play? ──
ok(WHEN_PLAYS.length === 18 && new Set(EVENT_KINDS).size === 18, "one row for each of the 18 event kinds");
ok(WHEN_PLAYS.every((w) => w.moment.length > 10 && w.today.length > 3), "every row says the moment and what plays today");
// honest: while no career screen calls the generator, nothing may say "wired"
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const careerFiles: string[] = [];
const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(tsx?|mts)$/.test(f.name)) careerFiles.push(p); } };
walk(path.join(ROOT, "app/star-dev"));
walk(path.join(ROOT, "components/star"));
const testOnly = new Set(["CutsceneDirector.tsx", "StyleTest3D.tsx"]);
const callers = careerFiles.filter((f) => !testOnly.has(path.basename(f)) && !f.includes("media-lab") && /generateScript\s*\(/.test(fs.readFileSync(f, "utf8")));
const anyWired = WHEN_PLAYS.some((w) => w.wired);
ok(callers.length > 0 || !anyWired, `no career screen calls the generator (${callers.length} found), so no row says "wired"`);
console.log(`generator callers in the career: ${callers.length ? callers.map((f) => path.relative(ROOT, f)).join(", ") : "none"}; rows wired: ${WHEN_PLAYS.filter((w) => w.wired).length} of ${WHEN_PLAYS.length}`);

// THE ONE CUT-SCENE LIST (Harry, 21 Oct 2026: the admin's 3D pages and the Scene Editor showed
// different cut scenes). Both read lib/star/cutscene/sceneList.ts: every hand-made scene, each with a
// still on disk and a still time, then every kept scene, each opening in the editor.
{
  const ROOT2 = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const k = keepScene({ ...FIXTURES.goal(), id: "x" }, { kind: "scored", emotion: "joy", stakes: 0.8, intensity: 0.7, seed: 3 });
  const list = cutsceneList([k]);
  ok(list.length === FIXTURE_LIST.length + 1, "the list is every hand-made scene plus every kept one");
  ok(FIXTURE_LIST.every((f) => list.some((c) => c.id === f.id && c.kind === "hand")), "every hand-made scene is in the list");
  ok(list.some((c) => c.id === k.id && c.kind === "kept" && c.href.includes(`scene=${k.id}`)), "a kept scene is in the list and opens in the editor");
  for (const f of FIXTURE_LIST) {
    ok(typeof CUT_STILL_AT[f.id] === "number", `${f.id}: has a still time`);
    ok(fs.existsSync(path.join(ROOT2, "public/admin/3d-area", `cut-${f.id}.webp`)), `${f.id}: its card still exists (node scripts/admin3d/stills.mjs --only=cuts ${f.id})`);
  }
  ok(!fs.existsSync(path.join(ROOT2, "app/star-style-dev")), "the Art styles page stays deleted");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
if (fails) process.exit(1);
