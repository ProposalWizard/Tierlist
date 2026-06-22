"use client";
import { useState, type ReactNode } from "react";

interface HowToPlayButtonProps {
  title?: string;
  children: ReactNode;
}

export default function HowToPlayButton({ title = "How to Play", children }: HowToPlayButtonProps) {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowHowToPlay(true)}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-white hover:text-white hover:border-gray-500 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {title}
      </button>

      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowHowToPlay(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900 rounded-t-2xl">
              <h2 className="text-base font-black text-white">{title}</h2>
              <button onClick={() => setShowHowToPlay(false)} className="text-white hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-5 text-sm text-white">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
