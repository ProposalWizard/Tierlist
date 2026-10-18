import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = {
  title: "Draft Dev Preview — Admin Only",
  robots: { index: false, follow: false },
};

export default function DraftDevLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/draft-dev">{children}</DevGate>;
}
