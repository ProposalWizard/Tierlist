"use client";
/**
 * components/teamRoom/IdeasBoard.tsx — the idea board (Harry, 19 Oct 2026:
 * "A+C"). One switch: By stage (Idea · Doing · Done, three columns on a
 * computer, one at a time on a phone) or By person (a lane each). Tap the
 * dots to want an idea; tap the card for its notes and to move it on.
 */
import { useEffect, useState } from "react";
import { TEAM_PEOPLE, type TeamPerson } from "@/lib/teamRoom/config";
import { ideasByPerson, ideasByStage, votersOf, type IdeaStage, type TeamIdea } from "@/lib/teamRoom/logic";
import { addIdea, deleteIdea, moveIdea, toggleVote, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, NoteCount, NotesThread, RoomGate } from "./parts";

const STAGES: { key: IdeaStage; name: string }[] = [{ key: "idea", name: "Idea" }, { key: "doing", name: "Doing" }, { key: "done", name: "Done" }];
const VIEW_KEY = "kib-team-ideas-view";

export default function IdeasBoard() {
  return <div className="tr"><RoomGate><Board /></RoomGate></div>;
}

function Board() {
  const s = useTeamRoom();
  const [byPerson, setByPerson] = useState(false);
  const [stage, setStage] = useState<IdeaStage>("idea");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { try { setByPerson(localStorage.getItem(VIEW_KEY) === "person"); } catch { /* private */ } }, []);
  const pick = (p: boolean) => { setByPerson(p); try { localStorage.setItem(VIEW_KEY, p ? "person" : "stage"); } catch { /* private */ } };
  const add = async () => { const r = await addIdea(title); if (r.ok) setTitle(""); else setErr(r.error); };
  const idea = s.ideas.find((i) => i.id === open) ?? null;

  return (
    <div className="tr-ideas">
      <div className="tr-ideas-top">
        <div className="tr-seg" role="group" aria-label="Sort ideas" style={{ flex: "0 1 260px" }}>
          <button aria-pressed={!byPerson} onClick={() => pick(false)}>By stage</button>
          <button aria-pressed={byPerson} onClick={() => pick(true)}>By person</button>
        </div>
        <div className="tr-add" style={{ flex: "1 1 320px" }}>
          <input id="tr-idea-new" value={title} placeholder="A new idea, in one line…" aria-label="New idea" maxLength={140}
            onChange={(e) => { setTitle(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button className="tr-btn" onClick={add} disabled={!title.trim()}>+ Add idea</button>
        </div>
      </div>
      {err && <p className="tr-err">{err}</p>}

      {!byPerson && (
        <div className="tr-seg tr-stagetabs" role="group" aria-label="Stage">
          {STAGES.map((st) => (
            <button key={st.key} aria-pressed={stage === st.key} onClick={() => setStage(st.key)}>
              {st.name} {s.ideas.filter((i) => i.stage === st.key).length}
            </button>
          ))}
        </div>
      )}

      <div className="tr-cols" data-person={byPerson}>
        {byPerson
          ? TEAM_PEOPLE.map((p) => {
            const list = ideasByPerson(s.ideas, s.votes, p);
            return (
              <section key={p} className="tr-lane" aria-label={`${p}'s ideas`}>
                <div className="tr-lane-h"><Av p={p} />{p}<span className="tr-muted" style={{ marginLeft: "auto" }}>{list.length}</span></div>
                {list.length === 0 && <p className="tr-muted">No ideas yet.</p>}
                {list.map((i) => <IdeaCard key={i.id} idea={i} showStage onOpen={() => setOpen(i.id)} />)}
              </section>
            );
          })
          : STAGES.map((st) => {
            const list = ideasByStage(s.ideas, s.votes, st.key);
            return (
              <section key={st.key} className="tr-col" data-on={stage === st.key} aria-label={st.name}>
                <div className="tr-col-h"><span>{st.name}</span><span className="n">{list.length}</span></div>
                {list.length === 0 && <p className="tr-muted">{st.key === "idea" ? "Nothing yet. Add the first idea above." : "Nothing here yet."}</p>}
                {list.map((i) => <IdeaCard key={i.id} idea={i} onOpen={() => setOpen(i.id)} />)}
              </section>
            );
          })}
      </div>
      {idea && <IdeaSheet idea={idea} me={s.me} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Dots({ ideaId }: { ideaId: number }) {
  const s = useTeamRoom();
  const on = votersOf(s.votes, ideaId);
  const mine = !!s.me && on.includes(s.me);
  return (
    <button className="tr-votes" onClick={(e) => { e.stopPropagation(); toggleVote(ideaId); }}
      title={`${on.length ? `Wanted by ${on.join(", ")}` : "Nobody has said they want it yet"}. Tap to ${mine ? "take your dot back" : "say you want it"}.`}
      aria-label={mine ? "Take your vote back" : "I want this"} aria-pressed={mine}>
      {TEAM_PEOPLE.map((p) => <i key={p} className={`tr-v ${p}${on.includes(p) ? " on" : ""}`} />)}
    </button>
  );
}

function IdeaCard({ idea, showStage, onOpen }: { idea: TeamIdea; showStage?: boolean; onOpen: () => void }) {
  return (
    <div className="tr-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}>
      <b>{idea.title}</b>
      <span className="tr-meta">
        {showStage ? <span className={`tr-tag ${idea.stage}`}>{idea.stage.toUpperCase()}</span> : <><Av p={idea.person} sm />{idea.person}</>}
        <NoteCount kind="idea" id={idea.id} />
        <Dots ideaId={idea.id} />
      </span>
    </div>
  );
}

function IdeaSheet({ idea, me, onClose }: { idea: TeamIdea; me: TeamPerson | null; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="tr-sheet-wrap tr" onClick={onClose}>
      <div className="tr-sheet" role="dialog" aria-label="Idea" onClick={(e) => e.stopPropagation()}>
        <div className="tr-meta">
          <Av p={idea.person} sm />{idea.person} · {new Date(idea.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          <Dots ideaId={idea.id} />
          <button className="tr-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <h2>{idea.title}</h2>
        <div className="tr-stagebtns" role="group" aria-label="Move it">
          {STAGES.map((st) => (
            <button key={st.key} className={`tr-btn${idea.stage === st.key ? "" : " ghost"}`} aria-pressed={idea.stage === st.key} onClick={() => moveIdea(idea.id, st.key)}>{st.name}</button>
          ))}
          {idea.person === me && <button className="tr-btn ghost" style={{ marginLeft: "auto" }} onClick={async () => { await deleteIdea(idea.id); onClose(); }}>Delete</button>}
        </div>
        <NotesThread kind="idea" id={idea.id} owner={idea.person} />
      </div>
    </div>
  );
}
