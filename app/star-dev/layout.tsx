import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Star Career — Admin Only",
  robots: { index: false, follow: false },
};

export default function StarDevLayout({ children }: { children: React.ReactNode }) {
  return children;
}
