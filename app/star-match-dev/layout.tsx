import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Star Match Engine (Dev) — Admin Only",
  robots: { index: false, follow: false },
};

export default function StarMatchDevLayout({ children }: { children: React.ReactNode }) {
  return children;
}
