// @ts-expect-error — a plain .mjs script with no type file
import { buildManifest } from "../../scripts/assets3d-manifest.mjs";
import { ASSETS_3D } from "../../lib/star/assets3dManifest";
import { SCENES_3D } from "../../lib/star/area3d";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * 3D TEST AREA (/star-3d-area-dev): the asset store lists exactly the files on
 * disk (re-run scripts/assets3d-manifest.mjs after adding a render), and every
 * scene card's picture is a real file.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const disk = buildManifest() as { id: string; files: { path: string; bytes: number }[] }[];
check(disk.length === ASSETS_3D.length, `folder count ${ASSETS_3D.length} in the list vs ${disk.length} on disk`);
for (const f of disk) {
  const listed = ASSETS_3D.find((a) => a.id === f.id);
  const want = f.files.map((x) => x.path).join("|");
  const have = (listed?.files ?? []).map((x) => x.path).join("|");
  check(want === have, `folder "${f.id}" is out of date — run: node scripts/assets3d-manifest.mjs`);
}
const all = ASSETS_3D.flatMap((f) => f.files.map((x) => x.path));
check(new Set(all).size === all.length, "a file is listed in two folders");
check(ASSETS_3D.find((f) => f.id === "icons")!.files.length >= 5, "the top-bar icons folder is short");

const ROOT = join(process.cwd(), "public");
for (const s of SCENES_3D) {
  if (s.thumb) check(existsSync(join(ROOT, s.thumb)), `scene "${s.id}" picture ${s.thumb} is missing`);
}
check(new Set(SCENES_3D.map((s) => s.id)).size === SCENES_3D.length, "two scenes share an id");

if (problems.length) {
  console.error("assets3d FAILED:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`assets3d OK: ${all.length} files in ${ASSETS_3D.length} folders, ${SCENES_3D.length} scenes`);
