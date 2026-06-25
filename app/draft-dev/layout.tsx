import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft Dev Preview — Admin Only",
  robots: { index: false, follow: false },
};

export default function DraftDevLayout({ children }: { children: React.ReactNode }) {
  return children;
}
