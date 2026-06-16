import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Football Manager Draft | Knowitball",
  description: "Build your squad with a transfer budget and manage them through the season.",
};

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
