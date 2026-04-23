"use client";

/**
 * components/FindSearch.tsx
 * Client-side search/filter for the Find a Tierlist page.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import ImageWithFallback from "./ImageWithFallback";

export interface FindTierlist {
  id: string;
  title: string;
  category: string | null;
  additional_categories?: string[];
  cover_image_url: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  creator: string | null;
  is_live: false;
}

export interface FindVotelist {
  id: string;
  title: string;
  category: string | null;
  cover_image_url: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  creator: string | null;
  is_live: true;
}

export type FindItem = FindTierlist | FindVotelist;

interface Props {
  items: FindItem[];
  categories: string[];
  initialCategory?: string;
  likedIds: Set<string>;
}

export default function FindSearch({ items, categories, initialCategory, likedIds }: Props) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || item.title.toLowerCase().includes(q);
      const matchesCategory = !selectedCategory || item.category === selectedCategory || (!item.is_live && (item as FindTierlist).additional_categories?.includes(selectedCategory));
      return matchesQuery && matchesCategory;
    });
  }, [items, query, selectedCategory]);

  return (
    <div>
      {/* ── Search + filter controls ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tierlists…"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        {/* Category filter */}
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
      <p className="mt-4 text-xs text-gray-500">
        {filtered.length} {filtered.length === 1 ? "result" : "results"}
        {query && ` for "${query}"`}
        {selectedCategory && ` in ${selectedCategory}`}
      </p>

      {/* ── Results grid ── */}
      {filtered.length === 0 ? (
        <div className="mt-16 text-center text-gray-500">
          No tierlists found. Try a different search or category.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((item) => {
            const href = item.is_live ? `/vote/${item.id}` : `/play/${item.id}`;
            const isLiked = likedIds.has(item.id);

            return (
              <Link
                key={item.id}
                href={href}
                className={`group overflow-hidden rounded-xl border bg-gray-900 transition-colors ${
                  item.is_live
                    ? "border-purple-800/50 hover:border-purple-500"
                    : "border-gray-700 hover:border-indigo-500"
                }`}
              >
                {/* Cover */}
                <div className="flex h-32 items-center justify-center overflow-hidden bg-gray-800">
                  {item.cover_image_url ? (
                    <ImageWithFallback
                      src={item.cover_image_url}
                      alt={item.title}
                      className="h-full w-full object-contain transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-4xl">{item.is_live ? "🗳️" : "🏆"}</span>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  {item.is_live && (
                    <span className="mb-1 inline-flex items-center rounded bg-purple-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300">
                      Vote
                    </span>
                  )}
                  <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                  {item.category && (
                    <p className="mt-0.5 truncate text-[10px] text-gray-500">{item.category}</p>
                  )}
                  {item.creator && (
                    <p className="mt-0.5 truncate text-[10px] text-gray-600">by {item.creator}</p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500">
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      {isLiked && <span className="text-red-400">♥ {item.like_count}</span>}
                      {!isLiked && item.like_count > 0 && <span>♥ {item.like_count}</span>}
                      <span title="Views">👁 {item.view_count ?? 0}</span>
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
