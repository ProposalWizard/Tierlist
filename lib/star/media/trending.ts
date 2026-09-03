import type { FootballEvent, StoredPost, Trend } from "./types";
import { rngFor, surname } from "./grammar";

/**
 * TRENDING
 *
 * The cheapest thing in the engine and one of the strongest signals that you are
 * looking at a platform rather than a log. Ten labels with plausible numbers
 * next to them, ranked by what the cycle actually produced.
 *
 * The volume is scaled by the reach of the accounts that posted, so a fan
 * account and a national tabloid talking about the same thing do not produce the
 * same number — which is what stops every trend reading as the same size.
 *
 * A quiet cycle can genuinely produce only one or two real trends — a real
 * platform never shows that few, it always has SOME baseline chatter. Below
 * `MIN_TRENDS`, the list is padded out with the tag labels below that didn't
 * already get a real bump this cycle, each given a modest, deterministic
 * (seeded off the same cycle rng) volume — clearly secondary, not a fabricated
 * event, just the platform's own evergreen background noise.
 */

const MIN_TRENDS = 10;

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
  form: "Form Table",
  table: "League Table",
  contract: "Contract Talk",
  award: "Awards",
  international: "Internationals",
  rumour: "Transfer Rumours",
  debut: "Debuts",
  stat: "Stat of the Day",
  milestone: "Milestone Watch",
  drama: "Talking Points",
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
    .slice(0, MIN_TRENDS);

  // A quiet cycle real-trends its way to two or three entries — pad out to
  // MIN_TRENDS with evergreen tag labels the cycle didn't already bump,
  // each a modest, clearly-secondary volume so real trends still tend to
  // lead the list.
  if (out.length < MIN_TRENDS) {
    const used = new Set(out.map(t => t.label));
    for (const [tag, label] of Object.entries(TAG_LABEL)) {
      if (out.length >= MIN_TRENDS) break;
      if (!label || used.has(label)) continue;
      out.push({
        label,
        tag: tag as Trend["tag"],
        hot: false,
        volume: Math.round((300 + rng() * 900) * (0.5 + Math.min(1.6, fame / 70))),
      });
      used.add(label);
    }
    out.sort((a, b) => b.volume - a.volume);
  }

  return out;
}

export function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M posts`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K posts`;
  return `${Math.max(1, n)} posts`;
}
