/**
 * 3D LOADING (speed job B, 9 Oct 2026: "I want loading times eradicated").
 *  - the versioned addresses (lib/star/three3d/assetUrl.ts): the content-hash
 *    list is up to date, and an address only gets ?v= when it is a known 3D file
 *  - every generated shop item has its KTX2 twin (tools/shop3d/ktx2_items.mjs),
 *    made from the current file, packed (meshopt) and holding only KTX2 maps
 *  - the early download (perf.ts prefetch3d) runs one file at a time, and a
 *    place that needs a queued file starts it at once (loadGltfCached)
 */
import fs from "node:fs";
import path from "node:path";
import { buildAssetVersions } from "../../scripts/perf3d/asset-versions.mjs";
import { ASSET_VERSIONS } from "../../lib/star/three3d/assetVersions";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const root = path.resolve(new URL(".", import.meta.url).pathname, "../..");

// ── the hash list matches the files (next.config.mjs rewrites it at every build; the committed copy should match) ──
{
  const want = buildAssetVersions();
  const have = fs.readFileSync(path.join(root, "lib/star/three3d/assetVersions.ts"), "utf8");
  check(want === have, "lib/star/three3d/assetVersions.ts is out of date: node scripts/perf3d/asset-versions.mjs");
  check(Object.keys(ASSET_VERSIONS).length > 200, `only ${Object.keys(ASSET_VERSIONS).length} 3D files listed`);
  check(!!ASSET_VERSIONS["/star/people3d/toon-p1.glb"], "the Style A heads are listed");
  check(!Object.keys(ASSET_VERSIONS).some((k) => k.startsWith("/star/shop2d/")), "the 2D shop's <img> stills are not versioned (they never ask through three)");
}

// ── versionedUrl ──
{
  const g = globalThis as unknown as { window?: unknown; location?: unknown; performance: Performance };
  g.window = globalThis;
  g.location = { origin: "https://knowitball.co.uk", search: "" };
  const { versionedUrl, installAssetVersions } = await import("../../lib/star/three3d/assetUrl");
  check(versionedUrl("/star/people3d/toon-p1.glb") === "/star/people3d/toon-p1.glb", "before the list loads, addresses are unchanged");
  await installAssetVersions();
  const v = ASSET_VERSIONS["/star/people3d/toon-p1.glb"];
  check(versionedUrl("/star/people3d/toon-p1.glb") === `/star/people3d/toon-p1.glb?v=${v}`, "a known file gets its hash");
  check(versionedUrl("https://knowitball.co.uk/star/people3d/toon-p1.glb") === `https://knowitball.co.uk/star/people3d/toon-p1.glb?v=${v}`, "a full address on this site too");
  check(versionedUrl("/star/people3d/nope.glb") === "/star/people3d/nope.glb", "an unknown file is left alone");
  check(versionedUrl("/star/people3d/toon-p1.glb?x=1") === "/star/people3d/toon-p1.glb?x=1", "an address with its own query is left alone");
  check(versionedUrl("https://cdn.sofifa.net/a.png") === "https://cdn.sofifa.net/a.png", "other sites are left alone");
  const T = await import("three");
  check(T.DefaultLoadingManager.resolveURL("/star/people3d/toon-p1.glb") === `/star/people3d/toon-p1.glb?v=${v}`, "three's loaders ask for the versioned address");
  T.DefaultLoadingManager.setURLModifier(undefined as never);
}

// ── the shop's KTX2 twins ──
{
  const dir = path.join(root, "public/star/shop3d/items");
  const hf = fs.readdirSync(dir).filter((f) => f.endsWith("-hf.glb"));
  check(hf.length >= 29, `${hf.length} generated items`);
  for (const f of hf) {
    const twin = path.join(dir, f.replace(/\.glb$/, ".ktx2.glb"));
    if (!fs.existsSync(twin)) { problems.push(`${f}: no KTX2 twin (tools/shop3d/ktx2_items.mjs)`); continue; }
    const buf = fs.readFileSync(twin);
    const jl = buf.readUInt32LE(12);
    const j = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8"));
    check(j.extensionsUsed?.includes("KHR_texture_basisu"), `${f}: twin has no KTX2 maps`);
    check(j.extensionsUsed?.includes("EXT_meshopt_compression"), `${f}: twin not packed`);
    check(!(j.extensionsUsed ?? []).includes("EXT_texture_webp"), `${f}: twin still carries WebP maps`);
    check((j.images ?? []).every((im: { mimeType?: string }) => im.mimeType === "image/ktx2"), `${f}: a map is not KTX2`);
    check(fs.statSync(twin).mtimeMs + 1000 >= fs.statSync(path.join(dir, f)).mtimeMs || !!process.env.CI, `${f}: twin older than the model (re-run the tool)`);
  }
}

// ── the early download: one at a time, a place's own need jumps the queue ──
{
  const started: string[] = [];
  const finish = new Map<string, () => void>();
  const g = globalThis as unknown as { fetch: unknown };
  g.fetch = (u: string) => {
    const url = u.split("?")[0];
    started.push(url);
    return new Promise((res) => finish.set(url, () => res({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
  };
  delete (globalThis as { window?: unknown }).window; // perf.ts's quality layer reads a real window when there is one
  const P = await import("../../lib/star/three3d/perf");
  P.prefetch3d(["/star/a.glb", "/star/b.glb", "/star/c.glb"]);
  await new Promise((r) => setTimeout(r, 0));
  check(started.join() === "/star/a.glb", `one at a time: started ${started.join()}`);
  // a place opens and needs c.glb now
  let parsed = "";
  const loader = { loadAsync: async () => ({ via: "network" }), parseAsync: async (_b: ArrayBuffer, p: string) => { parsed = p; return { via: "memory" }; } };
  const job = P.loadGltfCached<{ via: string }>(loader, "/star/c.glb");
  await new Promise((r) => setTimeout(r, 0));
  check(started.join() === "/star/a.glb,/star/c.glb", `the place's file starts at once: ${started.join()}`);
  finish.get("/star/c.glb")!();
  const got = await job;
  check(got.via === "memory" && parsed === "/star/", "the place reads the early download");
  check(started.length === 2, "b waits for a");
  finish.get("/star/a.glb")!();
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  check(started.join() === "/star/a.glb,/star/c.glb,/star/b.glb", `then b: ${started.join()}`);
  finish.get("/star/b.glb")!();
}

if (problems.length) {
  console.error(`assetLoading: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("assetLoading: versioned addresses, KTX2 twins, one-at-a-time early download — all ok");
