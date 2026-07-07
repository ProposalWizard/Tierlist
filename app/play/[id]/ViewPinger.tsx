"use client";

import { useEffect, useRef } from "react";

// Fires a one-time view increment for the tierlist. Lives client-side because
// the play page is ISR-cached and a server-side increment would be throttled.
export default function ViewPinger({ tierlistId }: { tierlistId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`/api/tierlists/${tierlistId}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [tierlistId]);
  return null;
}
