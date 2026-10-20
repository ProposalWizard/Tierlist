import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "3D Bench" };

/** The one lock (components/admin/DevGate.tsx): who may open this page comes from lib/adminRegistry.ts. */
export default function Bench3dLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-3d-bench-dev">{children}</DevGate>;
}
