const API_KEY = process.env.API_FOOTBALL_KEY ?? "";
const API_HOST = process.env.API_FOOTBALL_HOST ?? "v3.football.api-sports.io";

export async function apiFetch<T = unknown>(
  endpoint: string,
  params?: Record<string, string>
): Promise<{ data: T[]; errors: string[] }> {
  const url = new URL(`https://${API_HOST}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`API-Football ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  if (json.errors && Object.keys(json.errors).length > 0) {
    const msgs = Object.values(json.errors) as string[];
    return { data: [], errors: msgs };
  }

  return { data: json.response ?? [], errors: [] };
}
