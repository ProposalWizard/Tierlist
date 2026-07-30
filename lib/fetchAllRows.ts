/**
 * Page through a Supabase select.
 *
 * PostgREST silently caps any single select at 1000 rows regardless of
 * `.limit()` — the cap is server-side (`db-max-rows`), so asking for
 * `.limit(50000)` still returns 1000 and reports no error. Anything that needs a
 * complete set (like counts, vote tallies, club lists, backups) has to page with
 * `.range()` or it quietly computes the wrong answer as the table grows.
 *
 * Pass a builder that applies `.range(from, to)` to your query:
 *
 *   const rows = await fetchAllRows<Row>((from, to) =>
 *     service.from("tierlist_likes").select("tierlist_id").range(from, to)
 *   );
 *
 * Always include a stable `.order()` in the builder when row identity matters —
 * without one, Postgres may return overlapping or missing rows across pages.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  hardCap = 20000,
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; from < hardCap; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
