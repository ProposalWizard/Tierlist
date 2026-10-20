"use client";
/**
 * USE IN THE GAME — the Approve button, where and when an approved edit is
 * used, and Commit to game (Harry, 20 Oct 2026, answers 3D-3 and 3D-4: "an
 * approve button. They can still be edited, but they can be used, and we
 * could choose maybe when and where" … "if it goes into the database now, can
 * we then just push it into the repo?").
 *
 * Approve saves the edit for everyone (star_cutscene_edits) with its approval;
 * the game reads only approved edits (lib/star/sceneEdits/useApproved.ts).
 * Commit to game writes the approved edit into lib/star/data/sceneEdits.json
 * on main (needs GITHUB_TOKEN; says so plainly when it is missing).
 */
import { useState } from "react";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import { PLACE_USE, cleanApproval, type SceneApproval, type ScenePlace } from "@/lib/star/sceneEdits/approval";
import { forgetApprovedShared } from "@/lib/star/sceneEdits/useApproved";
import { commitToGame, pushShared, saveLocal } from "./store";

export default function UsePanel<E extends { approval?: SceneApproval }>({ place, scriptId, edits, onChange, gameNote }: {
  place: ScenePlace;
  /** The save id (the place, or the director scene's id). */
  scriptId: string;
  edits: E;
  /** The edits with a new approval (the page keeps them; this panel saves). */
  onChange: (e: E) => void;
  /** One line on how the game uses this place today. */
  gameNote?: string;
}) {
  const use = PLACE_USE[place];
  const a: SceneApproval = cleanApproval(place, edits.approval) ?? { approved: false, where: ["career"], when: "always" };
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  const write = async (next: SceneApproval, what: string) => {
    const e = { ...edits, approval: { ...next, at: new Date().toISOString() } } as E;
    onChange(e);
    saveLocal(scriptId, e);
    setBusy(true); setBad(false); setMsg(`${what}…`);
    const r = await pushShared(scriptId, e);
    setBusy(false);
    forgetApprovedShared();
    setBad(!r.ok);
    setMsg(r.ok ? `${what}: saved for everyone.` : r.missing ? `${what} on this device only — the shared table isn't switched on yet, so the game can't see it. Commit to game still works.` : `${what} on this device only (the game reads only edits saved for everyone or committed) — ${r.error}`);
  };
  const commit = async () => {
    setBusy(true); setBad(false); setMsg("Committing into the game…");
    const r = await commitToGame([{ scriptId, edits: edits.approval ? { ...edits, approval: a } : edits }]);
    setBusy(false);
    setBad(!r.ok);
    setMsg(r.message);
  };
  const where = (id: string, on: boolean) => write({ ...a, where: on ? [...a.where.filter((w) => w !== id), id] : a.where.filter((w) => w !== id) }, "Where changed");
  const used = a.approved && a.where.length > 0;
  const whenLabel = use.when.find((w) => w.id === a.when)?.label ?? "Always";

  return (
    <Panel title="USE IN THE GAME" note="approve, then choose where and when">
      <div className="se-use" data-use={a.approved ? "approved" : "not"}>
        <div className={`se-use-state ${a.approved ? "se-use-on" : ""}`} data-use-state>
          {a.approved
            ? used ? `APPROVED · the game uses it: ${a.where.map((w) => (w === "career" ? "in a career" : "on the test page")).join(" and ")} · ${whenLabel.toLowerCase()}` : "APPROVED · but no place ticked, so nothing uses it"
            : "NOT APPROVED · only shows in this editor"}
        </div>
        <div className="se-use-row">
          {a.approved
            ? <button className="se-small" data-unapprove disabled={busy} onClick={() => write({ ...a, approved: false }, "Approval withdrawn")}>Withdraw approval</button>
            : <button className="se-save" data-approve disabled={busy} onClick={() => write({ ...a, approved: true, where: a.where.length ? a.where : ["career"] }, "Approved")}>✓ APPROVE</button>}
          <button className="se-big" data-commit disabled={busy || !a.approved} onClick={commit} title={a.approved ? "Write this approved edit into the game's code (main branch)" : "Approve it first"}>COMMIT TO GAME</button>
        </div>
        <div className="se-use-grid">
          <div>
            <div className="se-rl">Where</div>
            {use.where.map((w) => (
              <label key={w.id} className="se-use-check">
                <input type="checkbox" data-where={w.id} checked={a.where.includes(w.id)} disabled={busy} onChange={(ev) => where(w.id, ev.target.checked)} /> {w.label}
              </label>
            ))}
          </div>
          <div>
            <div className="se-rl">When</div>
            <select className="se-sel" data-when value={a.when} disabled={busy || use.when.length < 2} onChange={(ev) => write({ ...a, when: ev.target.value }, "When changed")}>
              {use.when.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>
        </div>
        <div className={bad && msg ? "se-use-err" : "se-dim"} data-use-msg data-bad={bad ? "1" : undefined}>
          {msg || "Approve saves it for everyone. It stays editable: after a change, press SAVE FOR EVERYONE (or Commit to game) so the game gets the new copy."}
        </div>
        {gameNote && <div className="se-dim">{gameNote}</div>}
      </div>
    </Panel>
  );
}
