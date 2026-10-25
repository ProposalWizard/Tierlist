/**
 * The real moments for the test pages (Real moments, Real shots, Real Goals).
 * Serves data/realmoments/ as it is (made by scripts/realmoments/, read
 * data/realmoments/README.md):
 *   ?file=shots    wyscout_shots.json  (World Cup 2018 + Euro 2016 shots, placed defenders)
 *   ?file=tracked  tracked.json        (DFL + SkillCorner shots and corners, fully real)
 *   ?file=tracks   tracks.json         (their positions over the seconds before)
 *   ?file=goals    wyscout_goals.json  (the Real Goals page's match facts)
 *   ?file=league-england|spain|italy|germany|france  wyscout_league_<x>.json (2017/18 league goals for Real Goals)
 *   ?file=bangers  bangers.json        (Real Goals' Bangers: famous goals 2010-2025 drafted by us from public record)
 * Credit: lib/star/realMoments REAL_CREDIT (data/opendata/LICENCES.md).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const FILES: Record<string, string> = {
  shots: "wyscout_shots.json", tracked: "tracked.json", tracks: "tracks.json", goals: "wyscout_goals.json",
  "league-england": "wyscout_league_england.json", "league-spain": "wyscout_league_spain.json", "league-italy": "wyscout_league_italy.json",
  "league-germany": "wyscout_league_germany.json", "league-france": "wyscout_league_france.json",
  bangers: "bangers.json",
};

export async function GET(req: NextRequest) {
  const name = FILES[req.nextUrl.searchParams.get("file") ?? "shots"];
  if (!name) return NextResponse.json({ error: "file must be shots, tracked, tracks, goals or league-<england|spain|italy|germany|france> or bangers" }, { status: 400 });
  try {
    const text = await readFile(join(process.cwd(), "data", "realmoments", name), "utf8");
    return new NextResponse(text, { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: `data/realmoments/${name} is missing — read data/realmoments/README.md` }, { status: 404 });
  }
}
