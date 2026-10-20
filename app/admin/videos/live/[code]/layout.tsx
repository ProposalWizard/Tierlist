import DevGate from "@/components/admin/DevGate";

/** Live share viewer: not in lib/adminRegistry.ts, so DevGate makes it admins only. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/admin/videos/live">{children}</DevGate>;
}
