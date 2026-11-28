// The pure parts of Marketing → Library and Results (lib/publish/library.ts).
//   npx tsx tests/star/marketingLibrary.mts
import assert from "node:assert/strict";
import { EMPTY_DETAILS, cleanDetails, fileLabel, fullCaption, isFilledIn, matchesSearch, titleFor, viewsOf } from "../../lib/publish/library.ts";

let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log("ok", name); };

ok("cleanDetails trims, caps and drops unknown keys", () => {
  const d = cleanDetails({ name: "  Top 20  ", why: "x".repeat(900), series: "S", len_label: "0:29", made_on: "2026-11-27",
    titles: { youtube: "y".repeat(150), facebook: "F", tiktok: "no" }, captions: { instagram: "ig", tiktok: "tt", bogus: "b" }, tags: { youtube: "#a" }, junk: 1 });
  assert.equal(d.name, "Top 20"); assert.equal(d.why.length, 600); assert.equal(d.titles.youtube!.length, 100);
  assert.deepEqual(Object.keys(d.titles).sort(), ["facebook", "youtube"]); assert.deepEqual(Object.keys(d.captions).sort(), ["instagram", "tiktok"]);
  assert.equal(d.made_on, "2026-11-27"); assert.equal(d.tags.youtube, "#a");
});
ok("cleanDetails survives rubbish", () => {
  assert.deepEqual(cleanDetails(null), EMPTY_DETAILS); assert.deepEqual(cleanDetails("x"), EMPTY_DETAILS);
  assert.equal(cleanDetails({ made_on: "yesterday" }).made_on, null); assert.equal(cleanDetails({ made_on: "2026-13-45" }).made_on, null);
});
ok("fullCaption joins caption and tags with a blank line", () => {
  const d = cleanDetails({ name: "a", captions: { instagram: "Hi", youtube: "Only caption" }, tags: { instagram: "#a #b" } });
  assert.equal(fullCaption(d, "instagram"), "Hi\n\n#a #b"); assert.equal(fullCaption(d, "youtube"), "Only caption"); assert.equal(fullCaption(d, "facebook"), ""); assert.equal(fullCaption(null, "instagram"), "");
});
ok("titleFor falls back across apps then the name", () => {
  assert.equal(titleFor(cleanDetails({ name: "N", titles: { facebook: "FB" } }), "youtube"), "FB");
  assert.equal(titleFor(cleanDetails({ name: "N" }), "youtube"), "N"); assert.equal(titleFor(null, "youtube"), "");
});
ok("isFilledIn needs a name and at least one caption", () => {
  assert.equal(isFilledIn(null), false); assert.equal(isFilledIn(cleanDetails({ name: "N" })), false);
  assert.equal(isFilledIn(cleanDetails({ name: "N", captions: { tiktok: "t" } })), true); assert.equal(isFilledIn(cleanDetails({ captions: { tiktok: "t" } })), false);
});
ok("matchesSearch needs every word, any case", () => {
  assert.equal(matchesSearch("", ["a"]), true); assert.equal(matchesSearch("ballon top", ["Ballon d'Or", "top 20"]), true);
  assert.equal(matchesSearch("ballon yamal", ["Ballon d'Or top 20"]), false); assert.equal(matchesSearch("x", [undefined]), false);
});
ok("fileLabel strips the storage stamp", () => {
  assert.equal(fileLabel("own:videos/football/20261127-135820-5b17-ex19-name.mp4"), "ex19-name.mp4"); assert.equal(fileLabel("plain.mp4"), "plain.mp4");
});
ok("viewsOf adds Instagram, YouTube and Facebook views (plays as a fallback)", () => {
  assert.equal(viewsOf(undefined), 0);
  assert.equal(viewsOf({ instagram: { stats: { views: 100 } }, youtube: { stats: { views: 20 } }, facebook: { stats: { plays: 7 } } }), 127);
  assert.equal(viewsOf({ facebook: { stats: { views: 3, plays: 9 } } }), 3); assert.equal(viewsOf({ instagram: {} }), 0);
});
console.log(`${n} checks passed`);
