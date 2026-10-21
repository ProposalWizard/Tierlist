"use client";
/**
 * components/teamRoom/ChatPage.tsx — the full Team chat tab: who's here and
 * "Waiting on me" on the left, the chat in the middle, pinned messages on the
 * right. On a phone it is just the chat, with "Waiting on me" and the pins
 * folded above it. While it is on screen the corner bubble hides (it would
 * open the same chat).
 *
 * The phone notifications switch sits on top (PushToggle). A buzz opens this
 * tab on its message (?tab=chat&m=<id> → `jumpTo`).
 */
import { useEffect, useState } from "react";
import { TEAM_PEOPLE } from "@/lib/teamRoom/config";
import { stamp } from "@/lib/teamRoom/logic";
import { quoteLine, waitingOnMe } from "@/lib/teamRoom/extras";
import { setChatPageOpen, setPinned, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, ChatThread, RoomGate, WaitingOnMe } from "./parts";
import PushToggle from "./PushToggle";

export default function ChatPage({ jumpTo }: { jumpTo?: number | null }) {
  useEffect(() => { setChatPageOpen(true); return () => setChatPageOpen(false); }, []);
  return <div className="tr"><RoomGate><Room first={jumpTo ?? null} /></RoomGate></div>;
}

function Room({ first }: { first: number | null }) {
  const s = useTeamRoom();
  const [jump, setJump] = useState<number | null>(first);
  const goTo = (id: number) => { setJump(null); setTimeout(() => setJump(id), 0); };
  const pins = s.messages.filter((m) => m.pinned).reverse();
  const waiting = waitingOnMe(s.messages, s.me, s.marks, s.acks).length;
  const now = Date.now();
  const pinList = pins.length === 0
    ? <p className="tr-muted">Nothing pinned. Tap a message, then 📌 Pin.</p>
    : pins.map((m) => (
      <div key={m.id} className="tr-pin">
        {quoteLine(m, 160)}
        <small>{m.person} · {stamp(m.created_at, now)} · <button className="tr-x" style={{ padding: 0, fontSize: 11 }} onClick={() => setPinned(m.id, false)}>Unpin</button></small>
      </div>
    ));
  return (
    <>
      <div className="tr-pushbar"><PushToggle /></div>
      {waiting > 0 && <details className="tr-mobile-pins" open><summary>@ Waiting on me · {waiting}</summary><div style={{ marginTop: 6 }}><WaitingOnMe onJump={goTo} /></div></details>}
      <details className="tr-mobile-pins"><summary>📌 Pinned · {pins.length}</summary><div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>{pinList}</div></details>
      <div className="tr-page">
        <aside className="ash-panel tr-side tr-here" aria-label="Who's here">
          <p className="tr-lbl"><span className={`tr-live${s.live ? " on" : ""}`} />Here now</p>
          {TEAM_PEOPLE.map((p) => (
            <div key={p} className="tr-person"><Av p={p} />{p}{p === s.me && <small>(you)</small>}
              <small style={{ marginLeft: "auto" }}>{s.online.includes(p) ? "here" : "away"}</small>
            </div>
          ))}
          {!s.live && <p className="tr-muted" style={{ marginTop: 8 }}>Live link off — checking once a minute.</p>}
          <p className="tr-lbl" style={{ marginTop: 14 }}>@ Waiting on me{waiting > 0 && <span className="tr-count">{waiting}</span>}</p>
          <WaitingOnMe onJump={goTo} />
        </aside>
        <section className="ash-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }} aria-label="Team chat">
          <ChatThread jumpTo={jump} />
        </section>
        <aside className="ash-panel tr-side tr-pins" aria-label="Pinned">
          <p className="tr-lbl">📌 Pinned</p>
          {pinList}
        </aside>
      </div>
    </>
  );
}
