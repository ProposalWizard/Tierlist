"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ObjectivesToast() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFading(true), 4000);
    const removeTimer = setTimeout(() => setVisible(false), 5000);
    return () => { clearTimeout(timer); clearTimeout(removeTimer); };
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/profile"
      className={`fixed top-20 right-4 z-40 flex flex-col items-end px-3 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-900/40 transition-all duration-1000 hover:scale-105 active:scale-95 ${
        fading ? "opacity-0 translate-x-4" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-black text-white">Objectives</span>
        <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-black text-white uppercase tracking-wider">New</span>
      </div>
      <span className="text-[9px] text-white/80 font-medium mt-0.5">Tap to view</span>
    </Link>
  );
}
