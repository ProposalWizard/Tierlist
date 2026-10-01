"use client";
import type React from "react";
import { forwardRef } from "react";
import { KitStyles } from "@/components/star/legacy/ui/motion";
import { rgba } from "@/components/star/legacy/ui/theme";
import PressButton from "@/components/star/legacy/ui/PressButton";
import { useCountUp } from "@/components/star/legacy/ui/motion";
import { FloatText, Pop } from "@/components/star/ui/juice";

/**
 * A FULL SCREEN IN THE HOME SCREEN'S LOOK — for the screens that replace the
 * dashboard (the shop, the store, the casino): a night backdrop lit from
 * the top in your club's colour, a faint crowd, and a header with a Back
 * button, a title and whatever goes on the right (usually a WalletPill).
 *
 *   <ScreenShell glow={theme.glow} title="Boots" onBack={back} right={<WalletPill value={money} />}>…</ScreenShell>
 *
 * Renders KitStyles itself (these screens sit outside the dashboard).
 */
export default function ScreenShell({ glow, title, icon, onBack, backLabel = "Back", right, children, className = "", accent }: {
  glow: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** A second colour mixed into the backdrop (the casino's gold). */
  accent?: string;
}) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#05080f] text-white">
      <KitStyles />
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(90% 45% at 50% -8%, ${rgba(glow, 0.5)} 0%, transparent 70%)${accent ? `, radial-gradient(70% 40% at 50% 108%, ${rgba(accent, 0.28)} 0%, transparent 70%)` : ""}, linear-gradient(180deg, #0a1120 0%, #05080f 60%)` }}
        />
        <div
          className="absolute inset-x-0 top-0 h-[34%]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,.22) 0.9px, transparent 1.4px), radial-gradient(circle, ${rgba(glow, 0.55)} 0.9px, transparent 1.4px)`,
            backgroundSize: "7px 6px, 11px 9px",
            backgroundPosition: "0 0, 3px 2px",
            maskImage: "linear-gradient(180deg, #000, transparent)",
            WebkitMaskImage: "linear-gradient(180deg, #000, transparent)",
            opacity: 0.35,
          }}
        />
      </div>
      <div className={`relative mx-auto w-full max-w-md px-3 pb-10 ${className}`}>
        <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-2 px-3 pb-2 pt-3" style={{ background: "linear-gradient(180deg, rgba(5,8,15,.94) 60%, rgba(5,8,15,0))", backdropFilter: "blur(4px)" }}>
          {onBack && (
            <PressButton variant="secondary" size="none" onClick={onBack} className="flex h-9 shrink-0 items-center gap-1 rounded-full pl-2.5 pr-3 text-[12px] font-black uppercase tracking-wide">
              <span className="text-[16px] leading-none">‹</span>{backLabel}
            </PressButton>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {icon && <span className="text-[18px] leading-none">{icon}</span>}
            <div className="truncate text-[18px] font-black uppercase tracking-wide" style={{ textShadow: `0 2px 10px rgba(0,0,0,.7), 0 0 18px ${rgba(glow, 0.45)}` }}>{title}</div>
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * YOUR MONEY, in a gold pill that counts down when you spend and floats the
 * amount up off it. `spent` is a counter; `spentText` the label ("−★12k").
 * The ref is the target an item flies into when there is no better one.
 */
export const WalletPill = forwardRef<HTMLDivElement, {
  value: number;
  format: (n: number) => string;
  spent?: number;
  spentText?: string;
  spentColor?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}>(function WalletPill({ value, format, spent = 0, spentText = "", spentColor = "#fca5a5", icon, className = "", onClick }, ref) {
  const shown = useCountUp(value, 800);
  const Tag = onClick ? "button" : "div";
  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <Tag
        onClick={onClick}
        className={`${onClick ? "kib-press " : ""}flex items-center gap-1 rounded-full bg-gradient-to-b from-white/[0.16] to-white/[0.05] px-2.5 py-1.5 text-[13px] font-black tabular-nums text-yellow-200`}
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 0 1px rgba(253,224,71,.28), 0 6px 14px -8px rgba(0,0,0,.9)" }}
      >
        {icon ?? <span className="text-yellow-300">★</span>}
        <Pop value={spent} className="leading-none">{format(Math.round(shown))}</Pop>
      </Tag>
      <FloatText trigger={spent} text={spentText} color={spentColor} className="left-1/2 top-[115%]" size={15} />
    </div>
  );
});
