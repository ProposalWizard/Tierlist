"use client";

/**
 * components/CommunityVote.tsx
 *
 * Shows the community's aggregate vote results as a tierlist.
 * Each image is placed in the tier closest to its weighted-average vote position.
 *
 * Calculation:
 *   - Each tier gets a numeric index (0 = top/best, n-1 = bottom/worst).
 *   - For each image: average = sum(tier_index * vote_count) / total_votes.
 *   - The image is placed in round(average) tier.
 *   - Images with 0 votes go into an "Unvoted" section at the bottom.
 */

import type { VoteTier } from "@/lib/types";

interface ImageData {
  id: string;
  name: string;
  image_url: string;
  vote_counts: Record<string, number>;
  total_votes: number;
}

interface Props {
  tiers: VoteTier[];
  images: ImageData[];
  onClose: () => void;
}

export default function CommunityVote({ tiers, images, onClose }: Props) {
  // Build tier index map: label → position (0-based)
  const tierIndex: Record<string, number> = {};
  tiers.forEach((t, i) => { tierIndex[t.label] = i; });

  // Compute average tier position for each image and bucket them
  const buckets: Record<string, ImageData[]> = {};
  for (const t of tiers) buckets[t.label] = [];
  const unvoted: ImageData[] = [];

  for (const img of images) {
    if (img.total_votes === 0) {
      unvoted.push(img);
      continue;
    }

    // Weighted average of tier positions
    let weightedSum = 0;
    let totalCounted = 0;
    for (const [label, count] of Object.entries(img.vote_counts)) {
      if (tierIndex[label] !== undefined) {
        weightedSum += tierIndex[label] * count;
        totalCounted += count;
      }
    }

    if (totalCounted === 0) {
      unvoted.push(img);
      continue;
    }

    const avg = weightedSum / totalCounted;
    // Round to nearest tier index, clamped to valid range
    const nearestIdx = Math.min(Math.max(Math.round(avg), 0), tiers.length - 1);
    buckets[tiers[nearestIdx].label].push(img);
  }

  // Sort images within each tier by their average (better average = earlier)
  for (const t of tiers) {
    buckets[t.label].sort((a, b) => {
      const avgA = getAverage(a, tierIndex);
      const avgB = getAverage(b, tierIndex);
      return avgA - avgB;
    });
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Community&apos;s Vote</h2>
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          Back to Voting
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Each image is placed in the tier matching its average community vote.
      </p>

      {/* Tier rows */}
      <div className="overflow-hidden rounded-xl border border-gray-800">
        {tiers.map((tier) => {
          const items = buckets[tier.label];
          return (
            <div key={tier.label} className="flex min-h-[64px] border-b border-gray-800/60 last:border-b-0">
              <div
                className="flex w-14 flex-shrink-0 flex-col items-center justify-center text-base font-black text-gray-900 select-none md:w-20 md:text-xl"
                style={{ backgroundColor: tier.color }}
              >
                <span>{tier.label}</span>
                <span className="text-[9px] font-semibold opacity-70">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-wrap items-start gap-1 p-1.5 bg-gray-900/60 flex-1 min-w-0">
                {items.map((img) => (
                  <div key={img.id} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.image_url}
                      alt={img.name}
                      title={img.name}
                      className="h-14 w-14 rounded object-cover md:h-16 md:w-16"
                    />
                    {img.name && (
                      <div className="absolute inset-x-0 bottom-0 rounded-b bg-black/70 px-0.5 py-px text-center">
                        <span className="text-[8px] text-white leading-tight line-clamp-1">
                          {img.name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <span className="flex items-center text-xs text-gray-600 italic px-2">
                    No images
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unvoted images */}
      {unvoted.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Not yet voted ({unvoted.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {unvoted.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.image_url}
                  alt={img.name}
                  title={img.name}
                  className="h-12 w-12 rounded object-cover opacity-60 md:h-14 md:w-14"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compute weighted average tier position for an image */
function getAverage(img: ImageData, tierIndex: Record<string, number>): number {
  let weightedSum = 0;
  let total = 0;
  for (const [label, count] of Object.entries(img.vote_counts)) {
    if (tierIndex[label] !== undefined) {
      weightedSum += tierIndex[label] * count;
      total += count;
    }
  }
  return total > 0 ? weightedSum / total : Infinity;
}
