import { createClient } from "@/lib/supabase/server";
import { isGuestUser } from "@/lib/guest/config";
import { listOnlineSlots, type SlotListDb } from "@/lib/star/onlineSlots";
import { NextResponse } from "next/server";

/**
 * GET /api/star/career/slots — which save slots this account holds online.
 *
 * The Saves list (components/star/SaveSlotsPanel.tsx) asks this so a slot
 * made on another device shows as a real card, never "Empty". Headline only
 * (slot, player, club, season, when, which device): never the whole save,
 * which stays behind GET /api/star/career?slot=N for when the player opens it.
 *
 * Answers:
 *   { mode: "device-only" }  signed out or a guest: saves live on this device
 *   { mode: "online", slots } the account's slots (deleted ones: live false)
 *   500 { error }            could not read: the list says "Couldn't check"
 *
 * Read only. No database change: it reads the existing star_careers columns.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || isGuestUser(user)) return NextResponse.json({ mode: "device-only" });
    const slots = await listOnlineSlots(supabase as unknown as SlotListDb, user.id);
    return NextResponse.json({ mode: "online", slots }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[star/career/slots] list failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't check your other devices" }, { status: 500 });
  }
}
