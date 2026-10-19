"use client";
/**
 * components/teamRoom/ChatPage.tsx — the full Team chat tab: who's here on
 * the left, the chat in the middle, pinned messages on the right. On a phone
 * it is just the chat, with the pins folded above it. While it is on screen
 * the corner bubble hides (it would open the same chat).
 */
import { useEffect } from "react";
import { TEAM_PEOPLE } from "@/lib/teamRoom/config";
import { stamp } from "@/lib/teamRoom/logic";
import { setChatPageOpen, setPinned, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, ChatThread, RoomGate } from "./parts";

export default function ChatPage() {
  useEffect(() => { setChatPageOpen(true); return () => setChatPageOpen(false); }, []);
  return <div className="tr"><RoomGate><Room /></RoomGate></div>;
}

function Room() {
  const s = useTeamRoom();
  const pins = s.messages.filter((m) => m.pinned).reverse();
  const now = Date.now();
  const pinList = pins.length === 0
    ? <p className="tr-muted">Nothing pinned. Tap a message, then 📌 Pin.</p>
    : pins.map((m) => (
      <div key={m.id} className="tr-pin">
        {m.body || "Picture"}
        <small>{m.person} · {stamp(m.created_at, now)} · <button className="tr-x" style={{ padding: 0, fontSize: 11 }} onClick={() => setPinned(m.id, false)}>Unpin</button></small>
      </div>
    ));
  return (
    <>
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
        </aside>
        <section className="ash-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }} aria-label="Team chat">
          <ChatThread />
        </section>
        <aside className="ash-panel tr-side tr-pins" aria-label="Pinned">
          <p className="tr-lbl">📌 Pinned</p>
          {pinList}
        </aside>
      </div>
    </>
  );
}
