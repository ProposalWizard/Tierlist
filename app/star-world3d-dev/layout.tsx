import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "3D world kit" };

/** Admins and testers. Only plays the 3D places; saves nothing anyone else sees. */
export default function World3DLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-world3d-dev">{children}</DevGate>;
}
