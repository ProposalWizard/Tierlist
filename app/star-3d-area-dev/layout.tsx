import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "3D Test Area" };

export default function Area3dLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-3d-area-dev">{children}</DevGate>;
}
