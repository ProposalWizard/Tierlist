import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "Loading screens" };

export default function LoadingDevLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-loading-dev">{children}</DevGate>;
}
