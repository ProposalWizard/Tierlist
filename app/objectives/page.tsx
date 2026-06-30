"use client";

import Link from "next/link";
import { CustomObjectivesSection } from "@/app/profile/ProfileClient";

export default function ObjectivesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/profile"
            className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Profile
          </Link>
        </div>
        <CustomObjectivesSection />
      </div>
    </div>
  );
}
