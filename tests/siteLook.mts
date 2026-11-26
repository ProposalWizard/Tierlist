// The New look preview: off = Tailwind's own colours; scope; the boot script matches the functions.
import assert from "node:assert/strict";
import twColors from "tailwindcss/colors";
import { normalVars, lightVars, darkVars, triplet, lightShade, solidRules } from "../lib/siteLook/palette";
import { scopeOf, lookFromCookie, BOOT_SCRIPT } from "../lib/siteLook/look";

const n = normalVars();
assert.equal(n["--k-gray-950"], triplet((twColors as any).gray[950]));
assert.equal(n["--k-indigo-600"], triplet((twColors as any).indigo[600]));
assert.equal(n["--k-white"], "255 255 255");
assert.equal(lightShade("400"), "600"); assert.equal(lightShade("600"), "600"); assert.equal(lightShade("900"), "100");
const l = lightVars();
assert.equal(l["--k-gray-950"], triplet("#f4efe2"), "light page = the home's cream");
assert.equal(l["--k-indigo-600"], triplet("#0a7a3d"), "indigo button = Play-now green");
assert.equal(darkVars()["--k-purple-600"], triplet("#0a7a3d"));
assert.ok(Object.keys(solidRules())[0].includes(".bg-emerald-600"));
assert.equal(scopeOf("/"), "page"); assert.equal(scopeOf("/draft/records"), "page");
assert.equal(scopeOf("/admin"), "admin"); assert.equal(scopeOf("/admin/new-look"), "admin");
assert.equal(scopeOf("/road-to-the-golden-ball"), "game"); assert.equal(scopeOf("/star-gallery-dev"), "game");
assert.deepEqual(lookFromCookie("a=1; kib_look=v2; kib_theme=dark"), { on: true, theme: "dark" });
assert.deepEqual(lookFromCookie("kib_look=v22"), { on: false, theme: "light" });
// Boot script, run against fake documents.
function boot(cookie: string, path: string) {
  const ds: Record<string, string> = {};
  new Function("document", "location", BOOT_SCRIPT)({ cookie, documentElement: { dataset: ds } }, { pathname: path });
  return ds;
}
assert.deepEqual(boot("", "/draft"), {});
assert.deepEqual(boot("kib_look=v2", "/draft"), { look: "v2", theme: "light", scope: "page" });
assert.deepEqual(boot("kib_look=v2; kib_theme=dark", "/admin/x"), { look: "v2", theme: "dark", scope: "admin" });
assert.equal(boot("kib_look=v2", "/road-to-the-golden-ball").scope, "game");
console.log("siteLook: ok");
