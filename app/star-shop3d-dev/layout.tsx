import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "3D Shop" };

export default function Shop3DLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-shop3d-dev">{children}</DevGate>;
}
