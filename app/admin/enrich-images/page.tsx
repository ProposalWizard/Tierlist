"use client";

import { useState, useRef } from "react";

export default function EnrichImagesPage() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [totalChecked, setTotalChecked] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const stopRef = useRef(false);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const run = async () => {
    setRunning(true);
    stopRef.current = false;
    setLog([]);
    setTotalChecked(0);
    setTotalFound(0);

    let offset = 0;
    let batchNum = 0;

    while (!stopRef.current) {
      batchNum++;
      addLog(`Batch ${batchNum}: checking players ${offset}–${offset + 149}...`);

      try {
        const res = await fetch("/api/football/enrich-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });

        if (!res.ok) {
          const err = await res.text();
          addLog(`Error: ${err}`);
          break;
        }

        const data = await res.json();
        setTotalChecked((prev) => prev + data.checked);
        setTotalFound((prev) => prev + data.found);
        const extra = data.note ? ` (${data.note})` : "";
        addLog(`  → Checked ${data.checked}, found ${data.found} images${extra}`);

        if (data.done) {
          addLog("✅ Done! All players with career data have been checked.");
          break;
        }

        offset = data.nextOffset;

        // Small delay to avoid hammering Wikidata
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        addLog(`Network error: ${err}. Retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    if (stopRef.current) addLog("⏹ Stopped by user.");
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-2">Enrich Player Images</h1>
      <p className="text-gray-400 mb-6 max-w-xl">
        Fetches images from Wikidata for players with career data who don&apos;t have one yet.
        Uses a fast image-only query. Leave this page open — it auto-continues.
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

      <div className="mb-4 flex gap-8 text-sm">
        <div>
          <span className="text-gray-500">Players checked:</span>{" "}
          <span className="font-bold text-white">{totalChecked.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">Images found:</span>{" "}
          <span className="font-bold text-emerald-400">{totalFound.toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-2xl rounded-lg bg-gray-900 border border-gray-800 p-4 font-mono text-xs max-h-96 overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-gray-600">Click &quot;Start Enrichment&quot; to begin...</p>
        ) : (
          log.map((line, i) => (
            <div key={i} className="py-0.5 text-gray-300">{line}</div>
          ))
        )}
      </div>
    </div>
  );
}
