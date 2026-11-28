import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { overLimit, slowDown, LIMITS } from "@/lib/rateLimit";

interface Props { params: Promise<{ id: string }> }

// POST /api/tierlists/[id]/view — increment the tierlist view count.
// Called client-side on the play page because that page is ISR-cached,
// so a server-render increment would only fire once per revalidation window.
export async function POST(_req: Request, { params }: Props) {
  // Too many from one person: a friendly 429, never a crash (lib/rateLimit).
  if (await overLimit(_req, LIMITS.tierlistView)) return slowDown(LIMITS.tierlistView);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const service = createServiceClient();
  try {
    await service.rpc("increment_view_count", { p_id: id });
  } catch {
    /* view counting is best-effort */
  }
  return NextResponse.json({ ok: true });
}
