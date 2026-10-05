import type { Metadata } from "next";
import AdminOnly from "@/components/AdminOnly";

export const metadata: Metadata = { title: "3D Shop" };

export default function Shop3DLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
