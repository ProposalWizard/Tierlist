import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Objectives",
  description: "Knowitball objectives: complete challenges across the games to earn XP and cards.",
};

export default function ObjectivesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
