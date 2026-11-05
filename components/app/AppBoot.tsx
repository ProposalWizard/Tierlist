"use client";
/**
 * components/app/AppBoot.tsx — starts the PACKED PHONE APP.
 *
 * Takes over the game's requests (lib/app/offline.ts) BEFORE the game mounts,
 * so its very first ask for squads or settings is answered from the files
 * inside the app. Only app/page.app.tsx uses it; the website never does.
 */
import { useEffect, useState } from "react";
import { installOffline } from "@/lib/app/offline";

export default function AppBoot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { installOffline().finally(() => setReady(true)); }, []);
  if (!ready) return <div style={{ minHeight: "100vh", background: "#0b100e" }} />;
  return <>{children}</>;
}
