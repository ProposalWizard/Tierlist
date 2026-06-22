"use client";
import { useState, useRef } from "react";
import Link from "next/link";

const FIFA_YEARS = Array.from({ length: 20 }, (_, i) => 2007 + i);

function parseOvr(val: unknown): number | undefined {
  if (typeof val === "number") return val || undefined;
  if (typeof val === "string") {
    const n = parseInt(val, 10);
    return isNaN(n) || n === 0 ? undefined : n;
  }
  return undefined;
}

interface ScrapeResult {
  edition: string;
  scraped: number;
  saved: number;
  pages?: number;
  error?: string;
  message?: string;
}

export default function ScrapeSofifaPage() {
  const [status, setStatus] = useState<string>("");
  const [results, setResults] = useState<Map<number, ScrapeResult>>(new Map());
  const [scraping, setScraping] = useState<number | null>(null);
  const [versions, setVersions] = useState<string[] | null>(null);
  const [columnCount, setColumnCount] = useState(0);
  const [importYear, setImportYear] = useState(2020);
  const [replaceAll, setReplaceAll] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dbStats, setDbStats] = useState<
    { fifa_year: number; count: number }[] | null
  >(null);

  async function testConnection() {
    setStatus("Testing connection to SoFIFA...");
    try {
      const res = await fetch("/api/admin/football/scrape-sofifa");
      const data = await res.json();
      if (data.error) {
        setStatus(`Error: ${data.error}`);
        return;
      }
      setVersions(data.versions.map((v: { label: string }) => v.label));
      setColumnCount(data.columnCount);
      setStatus(
        `Connected! Found ${data.versions.length} FIFA editions, ${data.columnCount} data columns.`
      );
    } catch (e) {
      setStatus(`Connection failed: ${(e as Error).message}`);
    }
  }

  async function scrapeYear(year: number) {
    setScraping(year);
    setStatus(`Scraping ${year >= 2024 ? "FC" : "FIFA"} ${String(year % 100).padStart(2, "0")}...`);
    try {
      const res = await fetch("/api/admin/football/scrape-sofifa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const data = await res.json();
      setResults((prev) => {
        const next = new Map(prev);
        next.set(year, data);
        return next;
      });
      if (data.error) {
        setStatus(`Error for ${year}: ${data.error}`);
      } else {
        setStatus(
          `${data.edition}: scraped ${data.scraped} players, saved ${data.saved} (${data.pages} pages)`
        );
      }
    } catch (e) {
      setStatus(`Scrape failed for ${year}: ${(e as Error).message}`);
    }
    setScraping(null);
  }

  async function handleFileImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setStatus(`Reading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);

    let players: Record<string, unknown>[];

    try {
      const text = await file.text();
      setStatus(`Parsing ${file.name}...`);

      if (file.name.endsWith(".json")) {
        players = JSON.parse(text);
      } else {
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          setStatus("CSV file appears empty");
          return;
        }
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        players = lines.slice(1).map((line) => {
          const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h] = vals[i] ?? "";
          });
          return obj;
        });
      }
    } catch (e) {
      setStatus(`Failed to parse file: ${(e as Error).message}`);
      return;
    }

    const yy = String(importYear % 100).padStart(2, "0");
    const edition = importYear >= 2024 ? `FC ${yy}` : `FIFA ${yy}`;

    const mapped = players.map((p: Record<string, unknown>) => ({
      sofifa_id: String(
        p.sofifa_id ?? p.id ?? p.url?.toString().match(/\/player\/(\d+)/)?.[1] ?? Math.random()
      ),
      name: String(p.name ?? p.Name ?? ""),
      positions: String(p.positions ?? p.Positions ?? p.position ?? ""),
      nationality: String(p.nationality ?? p.Nationality ?? p.country ?? ""),
      club: String(p.club ?? p.Club ?? ""),
      league: String(p.league ?? p.League ?? ""),
      overall: parseOvr(p.overall ?? p.Overall ?? p.ova ?? p.attr_sort ?? p.attr_oa ?? 0),
      potential: parseOvr(p.potential ?? p.Potential ?? p.pot ?? p.attr_pt ?? 0),
      age: Number(p.age ?? p.Age ?? 0) || undefined,
      image_url: p.image_url ?? p.image ?? p.Image ?? undefined,
      attributes: p.attributes ?? p,
    }));

    setStatus(`Importing ${mapped.length} players for ${edition}...`);

    const BATCH = 500;
    let totalSaved = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalDeleted = 0;
    for (let i = 0; i < mapped.length; i += BATCH) {
      const batch = mapped.slice(i, i + BATCH);
      try {
        const res = await fetch("/api/admin/football/import-sofifa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            players: batch,
            year: importYear,
            edition,
            replaceAll: replaceAll && i === 0,
          }),
        });
        const data = await res.json();
        totalSaved += data.saved ?? 0;
        totalFailed += data.failed ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalDeleted += data.deleted ?? 0;
      } catch (e) {
        totalFailed += batch.length;
        console.error(`Batch ${i}–${i + batch.length} request failed:`, e);
      }
      const progress = Math.min(i + BATCH, mapped.length);
      setStatus(
        `Progress: ${progress.toLocaleString()}/${mapped.length.toLocaleString()} sent | ` +
        `${totalSaved.toLocaleString()} saved` +
        (totalFailed > 0 ? ` | ${totalFailed.toLocaleString()} failed` : "") +
        (totalSkipped > 0 ? ` | ${totalSkipped.toLocaleString()} skipped` : "")
      );
    }

    setStatus(
      `Done! ${totalSaved.toLocaleString()} saved out of ${mapped.length.toLocaleString()} players for ${edition}` +
      (totalDeleted > 0 ? ` (cleared ${totalDeleted.toLocaleString()} old rows first)` : "") +
      (totalFailed > 0 ? ` (${totalFailed.toLocaleString()} failed)` : "") +
      (totalSkipped > 0 ? ` (${totalSkipped.toLocaleString()} skipped — no name/id)` : "")
    );
  }

  async function loadStats() {
    setStatus("Loading database stats...");
    try {
      const res = await fetch("/api/admin/football/scrape-sofifa/stats");
      const data = await res.json();
      setDbStats(data.stats ?? []);
      setStatus(`Found data for ${data.stats?.length ?? 0} FIFA editions.`);
    } catch {
      setStatus("Could not load stats — run the migration first.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/football"
          className="text-white hover:text-white text-sm"
        >
          &larr; Football Admin
        </Link>
        <h1 className="text-2xl font-bold">SoFIFA Data Scraper</h1>
      </div>

      {/* Status bar */}
      {status && (
        <div className="bg-gray-900 border border-gray-700 rounded p-3 mb-6 text-sm font-mono">
          {status}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={testConnection}
          className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 text-sm font-medium"
        >
          Test SoFIFA Connection
        </button>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-medium"
        >
          Load DB Stats
        </button>
      </div>

      {/* Available versions */}
      {versions && (
        <div className="mb-6 text-sm text-white">
          <p className="mb-1">
            Available editions ({versions.length}): {columnCount} data columns
          </p>
          <p className="text-xs">{versions.join(", ")}</p>
        </div>
      )}

      {/* DB Stats */}
      {dbStats && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Database Coverage</h2>
          <div className="grid grid-cols-5 gap-2">
            {FIFA_YEARS.map((year) => {
              const stat = dbStats.find((s) => s.fifa_year === year);
              const count = stat?.count ?? 0;
              return (
                <div
                  key={year}
                  className={`p-2 rounded text-center text-sm ${
                    count > 0
                      ? "bg-green-900/50 border border-green-700"
                      : "bg-gray-900 border border-gray-800"
                  }`}
                >
                  <div className="font-medium">
                    {year >= 2024 ? "FC" : "FIFA"} {String(year % 100).padStart(2, "0")}
                  </div>
                  <div className={count > 0 ? "text-green-400" : "text-white"}>
                    {count > 0 ? `${count.toLocaleString()}` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrape buttons */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Scrape from SoFIFA</h2>
        <p className="text-sm text-white mb-3">
          Each edition takes 2-5 minutes (~300 pages of 60 players). Click one
          at a time.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {FIFA_YEARS.map((year) => {
            const result = results.get(year);
            const isActive = scraping === year;
            return (
              <button
                key={year}
                onClick={() => scrapeYear(year)}
                disabled={scraping !== null}
                className={`p-2 rounded text-sm font-medium transition ${
                  isActive
                    ? "bg-yellow-600 animate-pulse"
                    : result?.scraped
                      ? "bg-green-700 hover:bg-green-600"
                      : result?.error
                        ? "bg-red-700 hover:bg-red-600"
                        : "bg-gray-800 hover:bg-gray-700"
                } disabled:opacity-50`}
              >
                <div>
                  {year >= 2024 ? "FC" : "FIFA"} {String(year % 100).padStart(2, "0")}
                </div>
                {result && !result.error && (
                  <div className="text-xs mt-1 opacity-75">
                    {result.scraped?.toLocaleString()}
                  </div>
                )}
                {isActive && <div className="text-xs mt-1">Scraping...</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* CSV/JSON Import fallback */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-lg font-semibold mb-3">
          Import from File (Fallback)
        </h2>
        <p className="text-sm text-white mb-3">
          If SoFIFA blocks server requests, scrape using Google Colab or the
          Python scraper, then upload the CSV/JSON here.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={importYear}
            onChange={(e) => setImportYear(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            {FIFA_YEARS.map((y) => (
              <option key={y} value={y}>
                {y >= 2024 ? "FC" : "FIFA"} {String(y % 100).padStart(2, "0")} ({y})
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            className="text-sm text-white"
          />
          <label className="flex items-center gap-1.5 text-sm text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={replaceAll}
              onChange={(e) => setReplaceAll(e.target.checked)}
              className="accent-red-500"
            />
            Clean import (delete old data first)
          </label>
          <button
            onClick={handleFileImport}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 text-sm font-medium"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
