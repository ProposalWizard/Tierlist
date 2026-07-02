import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Force dynamic so the route is never frozen into a build-time snapshot (which
// also can't reach Supabase during build). The Cache-Control header below still
// lets the CDN/browser cache the response for a day.
export const dynamic = "force-dynamic";

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
