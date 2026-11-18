"use client";

import dynamic from "next/dynamic";
import type { Tierlist } from "@/lib/types";

const AdminPanel = dynamic(() => import("@/components/AdminPanel"), { ssr: false });

export default function AdminPanelLoader({ initialTierlists }: { initialTierlists: Tierlist[] }) {
  return <AdminPanel initialTierlists={initialTierlists} />;
}
