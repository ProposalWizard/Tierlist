"use client";
/** components/teamRoom/roomBugs.tsx — #bugs: players' bug reports as Bug bot cards (filled in by the #bugs slice). */
export function BugList({ onOpen }: { onOpen?: (key: string) => void }) {
  void onOpen;
  return <p className="tr-muted">No bug reports yet.</p>;
}
