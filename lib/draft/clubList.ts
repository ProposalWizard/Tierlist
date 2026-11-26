/**
 * lib/draft/clubList.ts — the PL Draft club list, asked for once per visit.
 *
 * The draft page starts the ask as soon as it opens (prefetchDraftClubs), so
 * by the time a player has picked a mode and a formation and pressed Start,
 * the list is usually already here instead of "Loading clubs..." (24 Nov 2026:
 * the list could take 7 to 10 seconds when the server had to rebuild it).
 * A failed ask is forgotten, so the Retry button really asks again.
 */
export type DraftClub = { name: string; seasons: number[] };
export type DraftClubsAnswer = { clubs?: DraftClub[]; error?: string };

let ask: Promise<DraftClubsAnswer> | null = null;

export function loadDraftClubs(): Promise<DraftClubsAnswer> {
  if (!ask) {
    ask = fetch("/api/draft/clubs")
      .then((r) => r.json() as Promise<DraftClubsAnswer>)
      .then((d) => {
        if (!d.clubs || d.clubs.length === 0) ask = null;
        return d;
      })
      .catch((e) => {
        ask = null;
        throw e;
      });
  }
  return ask;
}

export function prefetchDraftClubs(): void {
  loadDraftClubs().catch(() => {});
}
