import TesterOnly from "@/components/TesterOnly";

/** Admins and testers. Draws effect pictures and plays the real match; saves only to this browser. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
