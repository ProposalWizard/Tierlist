import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "Shopping street" };

/** Admins and testers. Only plays the 3D street; saves nothing anyone else sees. */
export default function StreetLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-street-dev">{children}</DevGate>;
}
