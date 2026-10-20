import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "Scene generator" };

/** The one lock (components/admin/DevGate.tsx): who may open this page comes from lib/adminRegistry.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/admin/scene-generator">{children}</DevGate>;
}
