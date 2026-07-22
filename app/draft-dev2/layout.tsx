import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft Dev2 Preview — Admin Only",
  robots: { index: false, follow: false },
};

export default function DraftDev2Layout({ children }: { children: React.ReactNode }) {
  return children;
}
