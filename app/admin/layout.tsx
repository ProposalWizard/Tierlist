/**
 * app/admin/layout.tsx
 *
 * Wraps every /admin page in `admin-touch`, which (on a phone only) makes
 * buttons finger-sized and stops iPhone zooming into text boxes — see
 * admin-touch.css. `contents` means the wrapper has no box of its own, so
 * every page lays out exactly as it did before. Adds no gate: each page keeps
 * its own admin check.
 */
import "./admin-touch.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-touch contents">{children}</div>;
}
