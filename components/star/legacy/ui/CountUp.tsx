"use client";
import { useCountUp } from "@/components/star/legacy/ui/motion";

/**
 * A NUMBER THAT COUNTS TO ITS NEW VALUE instead of jumping.
 *
 *   <CountUp value={career.money} format={(n) => `★ ${formatMoney(Math.round(n))}`} />
 *   const shown = useCountUp(rating);          // the hook, when you need the number
 *
 * Starts at the real value (no count from zero on every open) and snaps for
 * a phone set to reduce motion.
 */
export default function CountUp({ value, ms = 700, format = (n) => String(Math.round(n)), className }: {
  value: number;
  ms?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const shown = useCountUp(value, ms);
  return <span className={className}>{format(shown)}</span>;
}

export { useCountUp };
