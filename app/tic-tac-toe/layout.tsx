import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Football Tic Tac Toe — Knowitball",
  description: "Test your football knowledge in this 3x3 grid challenge. Name players that match two conditions per square!",
  alternates: { canonical: "/tic-tac-toe" },
};

export default function TicTacToeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
