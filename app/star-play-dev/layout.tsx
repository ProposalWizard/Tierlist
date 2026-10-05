import TesterOnly from "@/components/TesterOnly";

/** Admins and testers (Harry, 5 Oct 2026: "yes they should get play area but
 *  no scenario gallery"). Testers only play: Infinite Match hides its Edit /
 *  Save / Commit bar for non-admins, and the server refuses a tester's save. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
