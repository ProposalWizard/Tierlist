"use client";

/**
 * components/FindSearch.tsx
 * Client-side search/filter for the Find a Ranking page.
 * Handles regular rankings, vote rankings, and blind rankings.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import ImageWithFallback from "./ImageWithFallback";

interface BaseItem {
  id: string;
  title: string;
  category: string | null;
  cover_image_url: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  creator: string | null;
  linked_vote_id: string | null;
  linked_blind_id: string | null;
}

export interface FindTierlist extends BaseItem {
  additional_categories?: string[];
  is_live: false;
  is_blind: false;
}

export interface FindVotelist extends BaseItem {
  is_live: true;
  is_blind: false;
}

export interface FindBlindRanking extends BaseItem {
  is_live: false;
  is_blind: true;
}

export type FindItem = FindTierlist | FindVotelist | FindBlindRanking;

interface Props {
  items: FindItem[];
  categories: string[];
  initialCategory?: string;
  likedIds: Set<string>;
}

function getHref(item: FindItem): string {
  if (item.is_blind) return `/blind-rankings/${item.id}`;
  if (item.is_live) return `/vote/${item.id}`;
  if (item.linked_vote_id || item.linked_blind_id) return `/rankings/${item.id}`;
  return `/play/${item.id}`;
}

export default function FindSearch({ items, categories, initialCategory }: Props) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || item.title.toLowerCase().includes(q);
      const matchesCategory =
        !selectedCategory ||
        item.category === selectedCategory ||
        (!item.is_live && !item.is_blind &&
          (item as FindTierlist).additional_categories?.includes(selectedCategory));
      return matchesQuery && matchesCategory;
    });
  }, [items, query, selectedCategory]);

  return (
    <div>
      {/* ── Search + filter controls ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rankings…"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none sm:w-52"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* ── Results count ── */}
      <p className="mt-4 text-xs text-gray-400">
        {filtered.length} {filtered.length === 1 ? "result" : "results"}
        {query && ` for "${query}"`}
        {selectedCategory && ` in ${selectedCategory}`}
      </p>

      {/* ── Results grid ── */}
      {filtered.length === 0 ? (
        <div className="mt-16 text-center text-gray-500">
          No rankings found. Try a different search or category.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((item) => {
            const href = getHref(item);
            const isMultiFormat = !item.is_live && !item.is_blind && (item.linked_vote_id || item.linked_blind_id);
            const showRegularBadge = isMultiFormat;
            const borderClass = item.is_live
              ? "border-purple-800/50 hover:border-purple-500"
              : item.is_blind
              ? "border-amber-800/50 hover:border-amber-500"
              : isMultiFormat
              ? "border-indigo-700/60 hover:border-indigo-500"
              : "border-gray-700 hover:border-indigo-500";

            return (
              <Link
                key={item.id}
                href={href}
                className={`group relative overflow-hidden rounded-xl border bg-gray-900 transition-colors ${borderClass}`}
              >
                {/* Cover */}
                <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gray-800">
                  {item.cover_image_url ? (
                    <ImageWithFallback
                      src={item.cover_image_url}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-4xl">
                      {item.is_live ? "🗳️" : item.is_blind ? "🔲" : "🏆"}
                    </span>
                  )}

                  {/* Format badges — stacked vertically */}
                  <div className="absolute left-0 top-2 flex flex-col gap-0.5">
                    {showRegularBadge && (
                      <span className="rounded-r-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        Regular
                      </span>
                    )}
                    {(item.is_live || (!item.is_blind && (item as FindTierlist).linked_vote_id)) && (
                      <span className="rounded-r-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        Vote
                      </span>
                    )}
                    {(item.is_blind || (!item.is_live && (item as FindTierlist).linked_blind_id)) && (
                      <span className="rounded-r-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        Blind
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                  {item.category && (
                    <p className="mt-0.5 truncate text-[10px] text-gray-500">{item.category}</p>
                  )}
                  {item.creator && (
                    <p className="mt-0.5 truncate text-[10px] text-gray-500">by {item.creator}</p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500">
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      {item.like_count > 0 && <span className="text-red-400">❤ {item.like_count}</span>}
                      {item.view_count > 0 && <span>👁 {item.view_count}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
