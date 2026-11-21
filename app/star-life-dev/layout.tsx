import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "Living World" };

export default function LifeDevLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-life-dev">{children}</DevGate>;
}
