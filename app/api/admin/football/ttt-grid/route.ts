import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { buildTTTGrid } from "@/lib/wikidata";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = req.nextUrl.searchParams.getAll("row");
  const cols = req.nextUrl.searchParams.getAll("col");
  if (rows.length !== 3 || cols.length !== 3)
    return NextResponse.json({ error: "Need exactly 3 row and 3 col params" }, { status: 400 });

  try {
    const result = await buildTTTGrid(rows, cols);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Grid build failed" },
      { status: 500 },
    );
  }
}
