import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("nationality_flags")
    .select("nationality, flag_url");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.nationality] = row.flag_url;
  }

  return NextResponse.json(
    { flags: map },
    { headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
