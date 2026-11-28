import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "The drive" };

/** Admins and testers. Only plays the drive; saves nothing. */
export default function Drive3DLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-drive3d-dev">{children}</DevGate>;
}
