"use client";

/**
 * MANAGER MOMENTS IN HIS OFFICE (Harry, 6 Oct 2026, MANAGER_PLAN.md §2).
 *
 * When Settings → Look → "Talk to your manager" is "3D office" (the default),
 * a moment that already has words on screen is said to you in his office
 * (Office3D's Office3DCareer, speaker "boss") first, with a Continue button.
 * Continue does exactly what the screen did before. "Old", or a phone that
 * can't run 3D, shows the screen exactly as before.
 *
 * Only a stage: no new rules, no new text beyond what the screen already said.
 *   - Contract talks: the club's offer reason (ContractRenewal's own lines),
 *     then the negotiation as before.
 *   - Manager news: the new man in the dugout (career.managerNews), Continue
 *     = the banner's own dismiss.
 *
 * Two moments that had no screen before (7 Oct 2026; words and rules in
 * lib/star/managerMoments.ts). On Old / no 3D they are the same words on a
 * plain card:
 *   - Made captain: on Home, once (CaptainInOffice).
 *   - Dropped to the bench: on the pre-match screen (LineupIntro.tsx, via
 *     ManagerSays), before the line-up.
 */
import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { CareerState } from "@/lib/star/types";
import { useBossRoomLook } from "@/lib/star/look3d";
import { ContractRenewal } from "./SecondaryScreens";
import { captainLine } from "@/lib/star/managerMoments";
import { PressButton } from "./ui";

const Office3DCareer = dynamic(() => import("./Office3D").then((m) => m.Office3DCareer), { ssr: false });

/** The office, his words in a bubble, and one Continue. `plain` = the same
 *  words and button with no 3D (the Old look, or a phone that can't run it). */
export function OfficeMoment({ career, title, text, onContinue, onFail, continueLabel = "Continue →", plain = false }: {
  career: CareerState; title: string; text: string; onContinue: () => void; onFail: () => void; continueLabel?: string; plain?: boolean;
}) {
  const boss = career.manager?.name ?? "The manager";
  return (
    <div className={`${plain ? "flex flex-col justify-center " : ""}min-h-[100dvh] bg-[#0b1220] px-3 pb-6 pt-3 text-white`} data-office-moment={title} data-office-plain={plain ? "" : undefined}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-2 text-right text-[18px] font-black uppercase leading-none tracking-wide text-blue-300">{title}</div>
        {!plain && <Office3DCareer career={career} speaker="boss" onFail={onFail} className="mb-3 w-full" style={{ height: "46vh", borderRadius: 4 }} />}
        <div className="bg-slate-700 px-3 py-2" style={{ borderRadius: 4 }}>
          <div className="text-[11px] font-black uppercase tracking-wider text-white">{boss}</div>
          <div className="text-[15px] font-bold text-white">{text}</div>
        </div>
        <PressButton variant="primary" size="none" onClick={onContinue} className="mt-3 w-full rounded py-3 text-[14px] font-black uppercase">{continueLabel}</PressButton>
      </div>
    </div>
  );
}

/** The office is on, and hasn't failed on this phone this visit. */
function useOffice(): [boolean, () => void] {
  const room = useBossRoomLook();
  const [failed, setFailed] = useState(false);
  return [room === "3d" && !failed, () => setFailed(true)];
}

/** ContractRenewal's own reason lines (SecondaryScreens.tsx), said by him. */
export function contractOfferLine(reason: "form" | "star", club: string): string {
  return reason === "form"
    ? `Outstanding form! Your performances have been exceptional — ${club} want to lock you in with an improved deal early.`
    : "You've improved! The club recognise how much you have improved and are offering improved terms to reflect your standing.";
}

/** Contract talks. A club offer is said in his office first; then the talks as before. */
export function ContractInOffice({ career, offerReason, onComplete }: {
  career: CareerState; offerReason?: "form" | "star"; onComplete: (c: CareerState["contract"] | null) => void;
}) {
  const [office, fail] = useOffice();
  const [heard, setHeard] = useState(false);
  if (office && offerReason && !heard) {
    return <OfficeMoment career={career} title="Contract talks" text={contractOfferLine(offerReason, career.contract.club)} onContinue={() => setHeard(true)} onFail={fail} />;
  }
  return <ContractRenewal career={career} offerReason={offerReason} onComplete={onComplete} />;
}

/** Manager news on the dashboard: in his office (full screen), or the banner as before. */
export function ManagerNewsInOffice({ career, onDismiss, children }: { career: CareerState; onDismiss: () => void; children: ReactNode }) {
  const [office, fail] = useOffice();
  if (!office || !career.managerNews) return <>{children}</>;
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-[#0b1220]">
      <OfficeMoment career={career} title="In the dugout" text={career.managerNews} onContinue={onDismiss} onFail={fail} />
    </div>
  );
}

/** His words, in the office when it's on, else the same words on a plain card. */
export function ManagerSays({ career, title, text, onContinue }: {
  career: CareerState; title: string; text: string; onContinue: () => void;
}) {
  const [office, fail] = useOffice();
  return <OfficeMoment career={career} title={title} text={text} onContinue={onContinue} onFail={fail} plain={!office} />;
}

/** Made captain: on Home, full screen, once. Continue clears the flag. */
export function CaptainInOffice({ career, onDone }: { career: CareerState; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-[#0b1220]" data-captain-moment>
      <ManagerSays career={career} title="The armband" text={captainLine(career)} onContinue={onDone} />
    </div>
  );
}
