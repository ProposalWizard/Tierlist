/**
 * GET /api/admin/football-api
 * Proxy route for the RapidAPI "Free API Live Football Data" API.
 *
 * Query params:
 *   - endpoint: the path after the base URL (e.g. "football-get-all-leagues")
 *   - any other params are forwarded to the upstream API
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

const BASE_URL = "https://free-api-live-football-data.p.rapidapi.com";

export async function GET(request: NextRequest) {
  // Auth check — same pattern as other admin routes
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RAPIDAPI_KEY is not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing 'endpoint' query parameter" },
      { status: 400 }
    );
  }

  // Build upstream URL with all other query params forwarded
  const upstreamUrl = new URL(`${BASE_URL}/${endpoint}`);
  searchParams.forEach((value, key) => {
    if (key !== "endpoint") {
      upstreamUrl.searchParams.set(key, value);
    }
  });

  try {
    const res = await fetch(upstreamUrl.toString(), {
      headers: {
        "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com",
        "x-rapidapi-key": apiKey,
      },
    });

    const contentType = res.headers.get("content-type") || "";
    let body: unknown;
    if (contentType.includes("application/json")) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    return NextResponse.json(
      { status: res.status, data: body },
      { status: res.ok ? 200 : 502 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upstream request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
