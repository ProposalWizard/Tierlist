import type { FootballEvent, StoredPost, Trend } from "./types";
import { rngFor, surname } from "./grammar";

/**
 * TRENDING
 *
 * The cheapest thing in the engine and one of the strongest signals that you are
 * looking at a platform rather than a log. Six labels with plausible numbers
 * next to them, ranked by what the cycle actually produced.
 *
 * The volume is scaled by the reach of the accounts that posted, so a fan
 * account and a national tabloid talking about the same thing do not produce the
 * same number — which is what stops every trend reading as the same size.
 */

const TAG_LABEL: Partial<Record<string, string>> = {
  derby: "Derby Day",
  title: "Title Race",
  relegation: "Relegation",
  transfer: "Transfer News",
  trophy: "Trophy",
  manager: "Manager",
  record: "Records",
  streak: "The Run",
  europe: "European Nights",
  cup: "Cup Football",
};

export function buildTrends(
  events: FootballEvent[],
  posts: StoredPost[],
  cycleId: string,
  fame: number,
): Trend[] {
  const rng = rngFor("trend", cycleId);
  const scores = new Map<string, { volume: number; tag: Trend["tag"]; importance: number }>();

  const bump = (label: string, tag: Trend["tag"], importance: number, reach: number) => {
    const cur = scores.get(label) ?? { volume: 0, tag, importance: 0 };
    cur.volume += reach;
    cur.importance = Math.max(cur.importance, importance);
    scores.set(label, cur);
  };

  // What people are talking about: the subject of every event that mattered.
  for (const e of events) {
    const importance = e.importance ?? e.baseImportance;
    if (importance < 25) continue;
    const reach = posts.filter(p => p.eventId === e.id).reduce((s, p) => s + p.metrics.likes, 0);
    const weight = Math.max(reach, importance * 40);

    const name = e.subject.kind === "you" || e.subject.kind === "teammate"
      ? surname(e.subject.name)
      : e.subject.name;
    bump(name, e.tags[0] ?? "table", importance, weight);

    for (const t of e.tags) {
      const label = TAG_LABEL[t];
      if (label) bump(label, t, importance, weight * 0.6);
    }
  }

  const out: Trend[] = Array.from(scores.entries())
    .map(([label, v]) => ({
      label,
      tag: v.tag,
      hot: v.importance >= 70,
      // A plausible number: reach, scaled by how well known you are, with a
      // little noise so two trends of equal weight do not read as a tie.
      volume: Math.round(v.volume * (0.5 + Math.min(1.6, fame / 70)) * (0.8 + rng() * 0.5)),
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  return out;
}

export function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M posts`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K posts`;
  return `${Math.max(1, n)} posts`;
}
