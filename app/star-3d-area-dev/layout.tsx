import type { Metadata } from "next";
import AdminOnly from "@/components/AdminOnly";

export const metadata: Metadata = { title: "3D Test Area" };

export default function Area3dLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
