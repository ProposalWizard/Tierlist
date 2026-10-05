import AdminOnly from "@/components/AdminOnly";

/** Admins only (Harry, 5 Oct 2026: "lock the doors"). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
