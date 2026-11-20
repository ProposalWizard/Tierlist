"use client";
/**
 * A face for anyone in the living world: a team-mate's photo (or his own
 * stable fake face), the manager's stand-in face, and a drawn role tile for
 * family, staff, the agent and the press (they have no photos yet).
 */
import type { CareerState } from "@/lib/star/types";
import { personInfo, roleOf, type LifeRole } from "@/lib/star/life/people";
import { faceOrFake, fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";

const ROLE_ICON: Partial<Record<LifeRole, string>> = {
  agent: "💼", dad: "👨", mum: "👩", brother: "🧑", physio: "🩺", kitman: "👕", tabloid: "📰", broadsheet: "🗞️",
};
const ROLE_TONE: Partial<Record<LifeRole, string>> = {
  agent: "#0ea5e9", dad: "#f59e0b", mum: "#ec4899", brother: "#a855f7", physio: "#14b8a6", kitman: "#64748b", tabloid: "#ef4444", broadsheet: "#6366f1",
};

export default function LifeFace({ career, id, size = 40 }: { career: CareerState; id: string; size?: number }) {
  const role = roleOf(id);
  const style = { width: size, height: size };
  if (id.startsWith("oneoff:")) return <div className="lw-face" style={{ ...style, fontSize: size * 0.45, background: "#1f2937" }}>❔</div>;
  if (role === "teammate" || role === "manager") {
    const info = personInfo(career, id);
    const src = role === "teammate" ? faceOrFake(info?.player?.imageUrl, id) : fakeFaceFor(`manager:${info?.name ?? "gaffer"}`);
    return (
      <div className="lw-face" style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" onError={(e) => { const im = e.currentTarget; const fb = fakeFaceFor(id) ?? DEFAULT_FAKE_FACE; if (!im.src.endsWith(encodeURI(fb))) im.src = fb; }} />
      </div>
    );
  }
  const tone = ROLE_TONE[role] ?? "#475569";
  return (
    <div className="lw-face" style={{ ...style, fontSize: size * 0.48, background: `radial-gradient(circle at 35% 30%, ${tone}, ${tone}88)` }} aria-hidden>
      {ROLE_ICON[role] ?? "🙂"}
    </div>
  );
}
