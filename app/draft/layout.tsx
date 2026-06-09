import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PL Draft — Build Your Dream XI | Knowitball",
  description:
    "Spin for a random Premier League club and season from FIFA history, pick players, and simulate a full 38-match season.",
  openGraph: {
    title: "PL Draft — Build Your Dream XI",
    description:
      "Spin for a random PL club from FIFA history, draft 11 players, and simulate a full Premier League season.",
    siteName: "Knowitball",
  },
};

export default function DraftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
