/**
 * /draft-dev2 was a near copy of /draft-dev with the Hero setup screen.
 * Harry, 18 Oct 2026: one Draft test page. /draft-dev now has the Hero setup;
 * this address just sends you there (rooms too).
 */
import { redirect } from "next/navigation";

export default function DraftDev2Redirect({ searchParams }: { searchParams?: { room?: string } }) {
  redirect(searchParams?.room ? `/draft-dev?room=${encodeURIComponent(searchParams.room)}` : "/draft-dev");
}
