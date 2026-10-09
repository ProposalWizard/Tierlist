/**
 * ONE ADDRESS PER VERSION OF A 3D FILE (speed job B, 9 Oct 2026: "I want
 * loading times eradicated").
 *
 * The live site serves /public files as "check with me every time"
 * (must-revalidate): a second visit to the garden still asked about each of
 * its ~38 files before it could start — a round trip each on a phone's 4G.
 * Now every three.js loader (they all use three's DefaultLoadingManager)
 * asks for /star/x.glb?v=<hash of the file>, and next.config.mjs answers any
 * /star file asked for with ?v= as immutable for a year. The hash changes
 * when the file does (scripts/perf3d/asset-versions.mjs, run by every
 * build), so nobody keeps an old copy. Same files, same picture.
 *
 * The list (./assetVersions.ts, ~4 KB packed) loads only with the 3D, never
 * with a page that has none: installAssetVersions() is called by withMeshopt
 * (every GLTFLoader comes through it) and by preloadScene.
 */
let table: Record<string, string> | null = null;
let installing: Promise<void> | null = null;

/** The address to ask for: /star/x.glb → /star/x.glb?v=<hash> (once the list is in; else unchanged). */
export function versionedUrl(url: string): string {
  if (!table || url.includes("?")) return url;
  let path = url;
  if (typeof location !== "undefined" && url.startsWith(location.origin)) path = url.slice(location.origin.length);
  if (!path.startsWith("/star/")) return url;
  const v = table[path];
  return v ? `${url}?v=${v}` : url;
}

/** Load the list and hook three's loaders (once per page). Safe to call often; never throws. */
export function installAssetVersions(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!installing) {
    // room for a long session's file list (perf.ts noteSceneFiles reads it; the default keeps 250)
    try { performance.setResourceTimingBufferSize(1500); } catch { /* fine */ }
    installing = Promise.all([import("./assetVersions"), import("three")]).then(([m, T]) => {
      table = m.ASSET_VERSIONS;
      // ?nover=1: ask for the plain addresses (to compare before/after)
      if (/[?&]nover=1/.test(location.search)) { table = null; return; }
      T.DefaultLoadingManager.setURLModifier((u: string) => versionedUrl(u));
    }).catch(() => { /* plain addresses: still works, just asks again */ });
  }
  return installing;
}
