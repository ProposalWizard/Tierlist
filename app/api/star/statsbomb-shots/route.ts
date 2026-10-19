/**
 * The real shots for /star-statsbomb-dev (TEST PAGE ONLY). Serves
 * data/statsbomb/shots.json (or ?file=leadins: leadins.json, the passes
 * before each shot; ?file=goals: goals.json, the Real Goals page) as it is;
 * made by scripts/statsbomb/fetch_shots.py and fetch_real_goals.py.
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  // goals: the Real Goals page's extra facts (scripts/statsbomb/fetch_real_goals.py).
  const name = file === "leadins" ? "leadins.json" : file === "goals" ? "goals.json" : "shots.json";
  try {
    const text = await readFile(join(process.cwd(), "data", "statsbomb", name), "utf8");
    return new NextResponse(text, { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: `data/statsbomb/${name} is missing — run scripts/statsbomb/fetch_shots.py` }, { status: 404 });
  }
}
