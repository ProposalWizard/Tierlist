"use client";
/**
 * PEOPLE — who you know, how they feel about you, what they remember
 * (living world, phase 1). Every person: respect, bond and grudge (0-100) and
 * up to 6 memory lines. Tap a person for what he remembers and, for a
 * team-mate, the three social actions (Chat, Go for a drive, A day at the races).
 *
 * The top bars are Relationships' pair (RUL-UI-009/011): Happiness | Reputation.
 */
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { TopHud } from "@/components/star/ui";
import BackButton from "@/components/star/ui/BackButton";
import LifeFace from "./LifeFace";
import { fallOuts, lifeWeek, peek, personInfo, ROLE_GROUP, ROLE_ID, ROLE_TITLE, roleOf, teamForMatch } from "@/lib/star/life/people";
import { tagWords } from "@/lib/star/life/text";
import { SOCIAL_ICON, SOCIAL_LABEL, socialBlocked, socialCost, type SocialKind } from "@/lib/star/life/social";
import { eventById } from "@/lib/star/life/book";
import type { LifePerson } from "@/lib/star/life/types";
import "./life.css";

const GROUPS = ["Dressing room", "Club staff", "Family", "Agent", "Press"] as const;

function Bars({ p, big = false }: { p: LifePerson; big?: boolean }) {
  const cells: [string, number, string][] = [["Respect", p.r, "#60a5fa"], ["Bond", p.b, "#34d399"], ["Grudge", p.g, "#f87171"]];
  return (
    <div className="lw-bars" style={big ? { gap: 10 } : undefined}>
      {cells.map(([k, v, tone]) => (
        <div key={k} data-bar={k.toLowerCase()}>
          <div className="lw-bar-label"><span>{k}</span>{big && <span style={{ color: "#fff" }}>{v}</span>}</div>
          <div className="lw-bar" style={big ? { height: 10 } : undefined}><i style={{ width: `${v > 0 ? Math.max(2, v) : 0}%`, background: tone }} /></div>
        </div>
      ))}
    </div>
  );
}

function lastMemory(p: LifePerson): string | null {
  const m = [...p.m].sort((a, b) => b[1] - a[1])[0];
  return m ? tagWords(m[0]) : null;
}

export default function PeoplePage({ career, onAction, onBack }: {
  career: CareerState;
  onAction: (kind: SocialKind, id: string) => void;
  onBack?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [allSquad, setAllSquad] = useState(false);
  const life = career.life;
  const met = (id: string) => !!life?.people[id];

  // Who to list.
  const squad = (career.squad ?? []).map((p) => p.id);
  // The ones with a story first (most memories), then the closest.
  const metMates = squad.filter(met).sort((a, b) => peek(life!, b).m.length - peek(life!, a).m.length || peek(life!, b).b - peek(life!, a).b);
  const others = squad.filter((id) => !met(id));
  const staff = [career.manager ? ROLE_ID.manager : null, ROLE_ID.physio, ROLE_ID.kitman].filter(Boolean) as string[];
  const family = [ROLE_ID.dad, ROLE_ID.mum, ROLE_ID.brother];
  const press = [ROLE_ID.tabloid, ROLE_ID.broadsheet].filter(met);
  const gone = Object.keys(life?.people ?? {}).filter((id) => roleOf(id) === "teammate" && !squad.includes(id));
  const lists: Record<(typeof GROUPS)[number], string[]> = {
    "Dressing room": [...metMates, ...(allSquad ? others : [])],
    "Club staff": staff, Family: family, Agent: [ROLE_ID.agent], Press: press,
  };
  const outs = fallOuts(life, career);
  const now = lifeWeek(career);

  return (
    <div className="lw flex min-h-full flex-col">
      <TopHud career={career} screen="relations" />
      <div className="px-3 pb-6">
        <div className="mb-2 mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          {onBack ? <BackButton onClick={onBack} /> : <span />}
          <div className="lw-title">People</div>
          <span className="w-[72px]" />
        </div>

        {/* The dressing room as one: the team bar, what the match would read, fall-outs. */}
        <div className="lw-card p-3" data-team-card>
          <div className="flex items-center justify-between">
            <div>
              <div className="lw-kicker">The dressing room</div>
              <div className="mt-0.5 text-[13px] text-white/80">How the squad feels about you</div>
            </div>
            <div className="text-right">
              <div className="text-[26px] font-black leading-none">{career.relationships.team}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Team</div>
            </div>
          </div>
          <div className="lw-bar mt-2" style={{ height: 8 }}><i style={{ width: `${career.relationships.team}%`, background: "linear-gradient(90deg,#16a34a,#4ade80)" }} /></div>
          {outs.length > 0 ? (
            <div className="mt-2 text-[12px] leading-snug text-red-200" data-fall-outs>
              Fallen out with {outs.map((id) => personInfo(career, id)?.short ?? "someone").join(", ")}. The match would read the team as {teamForMatch(career)}.
            </div>
          ) : (
            <div className="mt-2 text-[12px] leading-snug text-white/65">Fall out with one man and the whole room takes sides.</div>
          )}
          {(life?.squad.length ?? 0) > 0 && (
            <div className="lw-mem">The lads remember: {life!.squad.map(([t]) => tagWords(t)).join(" · ")}</div>
          )}
        </div>

        {GROUPS.map((g) => {
          const ids = lists[g];
          if (!ids.length && !(g === "Dressing room" && others.length)) return null;
          return (
            <div key={g} data-group={g}>
              <div className="lw-group"><span>{g}</span>{g === "Dressing room" && <span>{metMates.length} you know</span>}</div>
              <div className="lw-card overflow-hidden">
                {ids.map((id) => <PersonRow key={id} career={career} id={id} onOpen={() => setOpen(id)} />)}
                {g === "Dressing room" && others.length > 0 && (
                  <button type="button" className="lw-row justify-center text-[12px] font-black uppercase tracking-wide text-amber-300" onClick={() => setAllSquad((v) => !v)}>
                    {allSquad ? "Show only the ones you know" : `+ ${others.length} you have not got to know yet`}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {gone.length > 0 && (
          <>
            <div className="lw-group"><span>Gone, not forgotten</span></div>
            <div className="lw-card overflow-hidden">{gone.map((id) => <PersonRow key={id} career={career} id={id} onOpen={() => setOpen(id)} />)}</div>
          </>
        )}

        {(life?.log.length ?? 0) > 0 && (
          <>
            <div className="lw-group"><span>Lately</span></div>
            <div className="lw-card space-y-2 p-3 text-[12.5px] leading-snug text-white/85" data-lately>
              {[...life!.log].reverse().slice(0, 4).map((r, i) => (
                <div key={i}><span className="font-black text-amber-300">{r.e === "chat" ? "Chat" : eventById(r.e)?.title.replace(/"/g, "") ?? r.e}</span>{r.w < now ? ` · ${now - r.w} wk ago` : " · this week"}<br />{r.t}</div>
              ))}
            </div>
          </>
        )}
      </div>
      {open && <PersonSheet career={career} id={open} onClose={() => setOpen(null)} onAction={(k) => { setOpen(null); onAction(k, open); }} />}
    </div>
  );
}

function PersonRow({ career, id, onOpen }: { career: CareerState; id: string; onOpen: () => void }) {
  const info = personInfo(career, id);
  const p = peek(career.life ?? { people: {} } as never, id);
  const role = roleOf(id);
  const sub = role === "teammate" ? [info?.player?.position, info?.player?.age ? `${info.player.age}` : null].filter(Boolean).join(" · ") || "Team-mate" : ROLE_TITLE[role];
  const mem = lastMemory(p);
  return (
    <button type="button" className="lw-row" onClick={onOpen} data-person={id}>
      <LifeFace career={career} id={id} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="lw-name truncate">{info?.name ?? "Someone"}</div>
          {p.f && <span className="lw-chip" style={{ color: "#fca5a5" }}>Fallen out</span>}
        </div>
        <div className="lw-sub">{sub}{info?.outlet ? ` · ${info.outlet}` : ""}</div>
        <Bars p={p} />
        {mem && <div className="lw-mem truncate">Remembers: {mem}</div>}
      </div>
    </button>
  );
}

function PersonSheet({ career, id, onClose, onAction }: { career: CareerState; id: string; onClose: () => void; onAction: (k: SocialKind) => void }) {
  const info = personInfo(career, id);
  const p = peek(career.life ?? { people: {} } as never, id);
  const role = roleOf(id);
  const now = lifeWeek(career);
  const mems = [...p.m].sort((a, b) => b[1] - a[1]);
  return (
    <div className="lw-sheet-bg" onClick={onClose} data-person-sheet>
      <div className="lw-sheet lw" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30" />
        <div className="flex items-center gap-3">
          <LifeFace career={career} id={id} size={64} />
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-black leading-tight">{info?.name ?? "Someone"}</div>
            <div className="lw-sub">{ROLE_GROUP[role] === "Dressing room" ? `${info?.player?.position ?? ""} · ${info?.player?.age ?? ""}` : ROLE_TITLE[role]}{info?.outlet ? ` · ${info.outlet}` : ""}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[16px] font-black">✕</button>
        </div>
        <div className="mt-3"><Bars p={p} big /></div>

        <div className="lw-group"><span>What {role === "mum" || role === "physio" ? "she" : "he"} remembers</span><span>{mems.length}/6</span></div>
        <div className="lw-card space-y-1.5 p-3">
          {mems.length ? mems.map(([t, w, s]) => (
            <div key={t} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 flex-1">{tagWords(t)}</span>
              <span className="shrink-0 text-[11px] text-white/55">{now - w > 0 ? `${now - w} wk ago` : "this week"}</span>
              <span className="shrink-0 text-[11px] tracking-[2px] text-amber-300" aria-label={`strength ${s} of 3`}>{"●".repeat(s)}<span className="text-white/25">{"●".repeat(3 - s)}</span></span>
            </div>
          )) : <div className="text-[13px] text-white/60">Nothing yet. Everything you do with {role === "mum" || role === "physio" ? "her" : "him"} from now on, {role === "mum" || role === "physio" ? "she" : "he"} keeps.</div>}
        </div>

        {role === "teammate" && (
          <>
            <div className="lw-group"><span>Spend time with him</span></div>
            <div className="space-y-2">
              {(["chat", "drive", "races"] as SocialKind[]).map((k) => {
                const why = socialBlocked(career, id, k);
                return (
                  <button key={k} type="button" className="lw-act" disabled={!!why} onClick={() => onAction(k)} data-social={k}>
                    <span className="lw-act-icon">{SOCIAL_ICON[k]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-black">{SOCIAL_LABEL[k]}</span>
                      <span className="block text-[11px] text-white/65">{why ?? socialCost(k)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
