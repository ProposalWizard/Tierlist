// CANARY (clean) — a function that happens to be called `launch` and is NOT
// the engine's. The guard must NOT flag this: a false alarm blocks every
// deploy. See README.md.
export function launch(url: string): string { return url; }
