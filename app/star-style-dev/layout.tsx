import DevGate from "@/components/admin/DevGate";
import LagTestHost from "@/components/star/LagTest";

/** The one lock (components/admin/DevGate.tsx): who may open this page comes from lib/adminRegistry.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  // The Lag test's last step (the cut scene) opens this page; its pill carries on here.
  return <DevGate url="/star-style-dev">{children}<LagTestHost /></DevGate>;
}
