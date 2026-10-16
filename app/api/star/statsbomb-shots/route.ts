/**
 * The real shots for /star-statsbomb-dev (TEST PAGE ONLY). Serves
 * data/statsbomb/shots.json (or ?file=leadins: leadins.json, the passes
 * before each shot) as it is; made by scripts/statsbomb/fetch_shots.py.
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("file") === "leadins" ? "leadins.json" : "shots.json";
  try {
    const text = await readFile(join(process.cwd(), "data", "statsbomb", name), "utf8");
    return new NextResponse(text, { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: `data/statsbomb/${name} is missing — run scripts/statsbomb/fetch_shots.py` }, { status: 404 });
  }
}
