import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <p className="text-xs text-gray-600">
          &copy; {new Date().getFullYear()} Tierlist Maker
        </p>
        <Link
          href="/legal"
          className="text-xs text-gray-500 transition-colors hover:text-gray-300"
        >
          Privacy and Terms
        </Link>
      </div>
    </footer>
  );
}
