"use client";

import { useState, useCallback } from "react";

/* ── Endpoint definitions ── */

interface ParamDef {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

interface EndpointDef {
  label: string;
  path: string;
  params: ParamDef[];
}

const ENDPOINTS: EndpointDef[] = [
  {
    label: "Get Popular Leagues",
    path: "football-get-all-leagues",
    params: [],
  },
  {
    label: "Search All Players",
    path: "football-search-all-players",
    params: [
      { name: "search", label: "Search query", placeholder: "e.g. Messi", required: true },
    ],
  },
  {
    label: "Countries",
    path: "football-get-all-countries",
    params: [],
  },
  {
    label: "Seasons",
    path: "football-get-all-seasons",
    params: [],
  },
  {
    label: "Livescores",
    path: "football-get-all-livescores",
    params: [],
  },
  {
    label: "Fixtures",
    path: "football-get-all-fixtures",
    params: [
      { name: "leagueid", label: "League ID", placeholder: "e.g. 47" },
      { name: "seasonid", label: "Season ID", placeholder: "e.g. 52162" },
    ],
  },
  {
    label: "Leagues",
    path: "football-get-all-leagues",
    params: [],
  },
  {
    label: "Teams",
    path: "football-get-all-teams",
    params: [
      { name: "leagueid", label: "League ID", placeholder: "e.g. 47" },
      { name: "seasonid", label: "Season ID", placeholder: "e.g. 52162" },
    ],
  },
  {
    label: "Squad / Players",
    path: "football-get-all-players",
    params: [
      { name: "teamid", label: "Team ID", placeholder: "e.g. 9825", required: true },
    ],
  },
  {
    label: "Events / Matches",
    path: "football-get-all-events",
    params: [
      { name: "matchid", label: "Match ID", placeholder: "e.g. 1234567", required: true },
    ],
  },
  {
    label: "Odds",
    path: "football-get-all-odds",
    params: [
      { name: "matchid", label: "Match ID", placeholder: "e.g. 1234567", required: true },
    ],
  },
  {
    label: "Statistics",
    path: "football-get-all-statistics",
    params: [
      { name: "matchid", label: "Match ID", placeholder: "e.g. 1234567", required: true },
    ],
  },
  {
    label: "Lineups",
    path: "football-get-all-lineups",
    params: [
      { name: "matchid", label: "Match ID", placeholder: "e.g. 1234567", required: true },
    ],
  },
];

interface CustomParam {
  key: string;
  value: string;
}

export default function FootballApiExplorer() {
  const [selectedIdx, setSelectedIdx] = useState<number | -1>(0);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [customParams, setCustomParams] = useState<CustomParam[]>([
    { key: "", value: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const isCustom = selectedIdx === -1;
  const currentEndpoint = isCustom ? null : ENDPOINTS[selectedIdx];

  const setParam = useCallback(
    (name: string, value: string) => {
      setParamValues((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const addCustomParam = () => {
    setCustomParams((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeCustomParam = (idx: number) => {
    setCustomParams((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCustomParam = (
    idx: number,
    field: "key" | "value",
    value: string
  ) => {
    setCustomParams((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const sendRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setResponseTime(null);

    let endpoint: string;
    const queryParams = new URLSearchParams();

    if (isCustom) {
      endpoint = customEndpoint.trim();
      if (!endpoint) {
        setError("Enter an endpoint path");
        setLoading(false);
        return;
      }
      for (const cp of customParams) {
        if (cp.key.trim() && cp.value.trim()) {
          queryParams.set(cp.key.trim(), cp.value.trim());
        }
      }
    } else {
      endpoint = currentEndpoint!.path;
      for (const p of currentEndpoint!.params) {
        const val = paramValues[p.name]?.trim();
        if (val) {
          queryParams.set(p.name, val);
        } else if (p.required) {
          setError(`${p.label} is required`);
          setLoading(false);
          return;
        }
      }
    }

    queryParams.set("endpoint", endpoint);

    const start = performance.now();
    try {
      const res = await fetch(
        `/api/admin/football-api?${queryParams.toString()}`
      );
      const json = await res.json();
      const elapsed = Math.round(performance.now() - start);
      setResponseTime(elapsed);

      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        if (json.data) {
          setResponse(JSON.stringify(json.data, null, 2));
        }
      } else {
        setResponse(JSON.stringify(json.data, null, 2));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black">API Explorer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Explore the RapidAPI Free Live Football Data API. Requests are proxied
          through the server — the API key is never exposed to the browser.
        </p>
      </div>

      {/* Endpoint selector */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
          Endpoint
        </label>
        <select
          value={selectedIdx}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setSelectedIdx(v as number | -1);
            setParamValues({});
            setError(null);
          }}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-indigo-600 focus:outline-none"
        >
          {ENDPOINTS.map((ep, i) => (
            <option key={i} value={i}>
              {ep.label} — /{ep.path}
            </option>
          ))}
          <option value={-1}>Custom endpoint...</option>
        </select>
      </div>

      {/* Custom endpoint input */}
      {isCustom && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
            Endpoint path
          </label>
          <input
            type="text"
            placeholder="e.g. football-get-all-leagues"
            value={customEndpoint}
            onChange={(e) => setCustomEndpoint(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
          />
        </div>
      )}

      {/* Params for known endpoints */}
      {!isCustom && currentEndpoint && currentEndpoint.params.length > 0 && (
        <div className="mb-4 space-y-3">
          <label className="block text-xs font-bold uppercase text-gray-500">
            Parameters
          </label>
          {currentEndpoint.params.map((p) => (
            <div key={p.name}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400">{p.label}</span>
                {p.required && (
                  <span className="text-[10px] font-bold text-red-400">
                    required
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder={p.placeholder}
                value={paramValues[p.name] ?? ""}
                onChange={(e) => setParam(p.name, e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Custom params */}
      {isCustom && (
        <div className="mb-4">
          <label className="mb-2 block text-xs font-bold uppercase text-gray-500">
            Query parameters
          </label>
          <div className="space-y-2">
            {customParams.map((cp, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="key"
                  value={cp.key}
                  onChange={(e) =>
                    updateCustomParam(idx, "key", e.target.value)
                  }
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="value"
                  value={cp.value}
                  onChange={(e) =>
                    updateCustomParam(idx, "value", e.target.value)
                  }
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-600 focus:outline-none"
                />
                <button
                  onClick={() => removeCustomParam(idx)}
                  className="shrink-0 text-gray-500 hover:text-red-400 text-lg px-1"
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addCustomParam}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
          >
            + Add parameter
          </button>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={sendRequest}
        disabled={loading}
        className="mb-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors md:w-auto md:px-8"
      >
        {loading ? "Sending..." : "Send Request"}
      </button>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Response */}
      {response !== null && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500">
              Response
            </span>
            {responseTime !== null && (
              <span className="text-xs text-gray-500">{responseTime}ms</span>
            )}
          </div>
          <pre className="max-h-[600px] overflow-auto rounded-lg border border-gray-800 bg-gray-900 p-4 text-xs text-green-300 whitespace-pre-wrap break-words">
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}
