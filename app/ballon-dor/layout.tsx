import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ballon d'Or",
  description: "Win the Ballon d'Or — an admin-only prototype game mode.",
  robots: { index: false, follow: false },
};

export default function BallonDorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
