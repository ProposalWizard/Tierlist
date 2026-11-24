import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Pictures only: the 3D phone flow (RUL-UI-008); saves nothing. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-phone3d-dev">{children}</DevGate>;
}
