/**
 * POST /api/tester/claim  { code }  →  { outcome }
 *
 * The "Become a tester" button on /tester/[code]. Signed in: makes this user
 * a tester if the link is real and switched on (lib/testerLinks.ts). The
 * write uses the service key; no player can write user_roles themselves.
 *
 * Before tester_access.sql is run every answer is "not-ready" — never a 500.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGuestUser } from "@/lib/guest/config";
import { createServiceClient } from "@/lib/supabase/service";
import { claimTesterLink, type TesterClient } from "@/lib/testerLinks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Guests (lib/guest/config.ts) count as signed out here.
  if (!user || isGuestUser(user)) return NextResponse.json({ outcome: "signed-out" }, { status: 401 });

  let code: unknown = null;
  try {
    code = (await req.json())?.code;
  } catch {
    code = null;
  }

  try {
    const outcome = await claimTesterLink(createServiceClient() as unknown as TesterClient, code, user.id);
    return NextResponse.json({ outcome });
  } catch {
    return NextResponse.json({ outcome: "not-ready" });
  }
}
