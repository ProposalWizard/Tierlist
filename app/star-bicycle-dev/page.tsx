import BicycleKickTrial from "@/components/star/BicycleKickTrial";

// Standalone sandbox for prototyping a bicycle-kick shooting mechanic —
// same spirit as /star-match-dev (a fork of the match engine for trying out
// physics changes without touching real careers), just for a brand-new
// mechanic that doesn't exist in the real game at all rather than for
// tuning an existing one. Completely unlinked from any real navigation and
// touches no career/save data whatsoever — see BicycleKickTrial.tsx for the
// actual sandbox. Deliberately has no auth/admin gate (unlike
// /star-match-dev): it reads nothing and writes nothing, so there's no real
// data to protect and no Supabase round trip needed just to look at it.
export default function StarBicycleDevPage() {
  return <BicycleKickTrial />;
}
