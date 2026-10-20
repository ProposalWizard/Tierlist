import DevGate from "@/components/admin/DevGate";
import { adminHomeFor } from "@/lib/adminRegistry";

/** The one lock (components/admin/DevGate.tsx): who may open this page comes from lib/adminRegistry.ts.
 *  The Team area is the admin's home (Harry, 20 Oct 2026); a tester (no Team room) goes to theirs. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/admin/team" testerTo={adminHomeFor("tester")}>{children}</DevGate>;
}
