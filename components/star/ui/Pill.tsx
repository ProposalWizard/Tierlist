"use client";

/**
 * A POLISHED STAT PILL — a value over a small caps label.
 *
 *   <Pill gold label="Rating" value="★ 7.2" />
 *   <Pill label="Money" value="★ 185k" valueClass="text-yellow-200" />
 *
 * `gold` is the one to lead with (the rating on home). Sits in a flex row;
 * each pill takes an equal share.
 */
export default function Pill({ label, value, gold = false, valueClass = "text-white", className = "" }: {
  label: string;
  value: React.ReactNode;
  gold?: boolean;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-full px-2.5 py-1 ${gold ? "bg-gradient-to-b from-yellow-300 to-amber-500" : "bg-gradient-to-b from-white/[0.16] to-white/[0.05]"} ${className}`}
      style={{ boxShadow: gold ? "inset 0 1px 0 rgba(255,255,255,.55), 0 4px 12px -4px rgba(245,158,11,.7)" : "inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 0 1px rgba(255,255,255,.10), 0 4px 10px -6px rgba(0,0,0,.8)" }}
    >
      <div className={`truncate text-[15px] font-black leading-tight tabular-nums ${gold ? "text-gray-950" : valueClass}`}>{value}</div>
      <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${gold ? "text-gray-900/70" : "text-white/50"}`}>{label}</div>
    </div>
  );
}
