import Link from "next/link";
import FeedbackForm from "./FeedbackForm";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4">
          <FeedbackForm />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-white">
            &copy; {new Date().getFullYear()} Knowitball Tierlists
          </p>
          <Link
            href="/legal"
            className="text-xs text-white transition-colors hover:text-gray-300"
          >
            Privacy and Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
