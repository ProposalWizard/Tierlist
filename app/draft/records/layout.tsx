import type { Metadata } from "next";

// Its own name in the browser tab (it showed "PL Draft" like the Draft itself until 26 Nov 2026).
export const metadata: Metadata = { title: "PL Draft Hall of Fame", description: "The best PL Draft records: biggest points totals, goals and seasons." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
