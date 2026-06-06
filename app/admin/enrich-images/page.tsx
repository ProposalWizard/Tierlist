"use client";

import { useState, useRef } from "react";

const START_YEAR = 1960;
const END_YEAR = 2008;

export default function EnrichImagesPage() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [totalWikidata, setTotalWikidata] = useState(0);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const stopRef = useRef(false);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const run = async () => {
    setRunning(true);
    stopRef.current = false;
    setLog([]);
    setTotalMatched(0);
    setTotalWikidata(0);

    addLog(`Scanning Wikidata for footballers with images (${START_YEAR}–${END_YEAR})...`);

    for (let year = START_YEAR; year <= END_YEAR; year++) {
      if (stopRef.current) break;
      setCurrentYear(year);
      addLog(`Year ${year}...`);

      try {
        const res = await fetch("/api/football/enrich-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year }),
        });

        if (!res.ok) {
          const err = await res.text();
          addLog(`  ✗ Error: ${err}`);
          continue;
        }

        const data = await res.json();
        setTotalWikidata((prev) => prev + data.wikidataFound);
        setTotalMatched((prev) => prev + data.updated);

        if (data.updated > 0) {
          addLog(`  ✓ Wikidata: ${data.wikidataFound} with images → ${data.matched} in our DB → ${data.updated} updated`);
        } else if (data.wikidataFound > 0) {
          addLog(`  · Wikidata: ${data.wikidataFound} with images → 0 matched our DB`);
        } else {
          addLog(`  · No footballers with images found for ${year}`);
        }

        // Small delay between years to be nice to Wikidata
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        addLog(`  ✗ Network error for ${year}: ${err}. Continuing...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (stopRef.current) {
      addLog("⏹ Stopped by user.");
    } else {
      addLog("✅ Done! All years checked.");
    }
    setCurrentYear(null);
    setRunning(false);
  };

  const progress = currentYear
    ? Math.round(((currentYear - START_YEAR) / (END_YEAR - START_YEAR)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-2">Enrich Player Images</h1>
      <p className="text-gray-400 mb-6 max-w-xl">
        Queries Wikidata for all footballers with images (by birth year), then
        matches them to players in our database. Much faster than checking
        players one-by-one.
      </p>

      <div className="flex gap-3 mb-6">
        {!running ? (
          <button
            onClick={run}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold hover:bg-indigo-500"
          >
            Start Enrichment
          </button>
        ) : (
          <button
            onClick={() => { stopRef.current = true; }}
            className="rounded-lg bg-red-600 px-6 py-2.5 font-semibold hover:bg-red-500"
          >
            Stop
          </button>
        )}
      </div>

      {running && (
        <div className="mb-4 max-w-md">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Year {currentYear}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-8 text-sm">
        <div>
          <span className="text-gray-500">Found on Wikidata:</span>{" "}
          <span className="font-bold text-white">{totalWikidata.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">Matched &amp; saved:</span>{" "}
          <span className="font-bold text-emerald-400">{totalMatched.toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-2xl rounded-lg bg-gray-900 border border-gray-800 p-4 font-mono text-xs max-h-[500px] overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-gray-600">Click &quot;Start Enrichment&quot; to begin...</p>
        ) : (
          log.map((line, i) => (
            <div key={i} className={`py-0.5 ${line.includes("✓") ? "text-emerald-400" : line.includes("✗") ? "text-red-400" : "text-gray-400"}`}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
