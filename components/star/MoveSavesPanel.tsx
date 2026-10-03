"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  packSaves, unpackSaves, applySaves, codeSizeLabel, BIG_CODE_CHARS, MAX_CODE_CHARS,
  type CheckedPack,
} from "@/lib/star/saveTransfer";
import { listSaveSlots, type SaveSlotSummary } from "@/lib/star/storage";
import { askConfirm } from "@/lib/star/askConfirm";
import { PressButton } from "./ui";
import { SetCard, SetHead, SetNote } from "./settingsKit";

/**
 * MOVE MY SAVES (Harry, 3 Oct 2026).
 *
 * On an iPhone, the game added to the Home Screen has its own storage, apart
 * from Safari's. Saves made in Safari are still there — the app just can't
 * see them. Copy a code here, paste it there. The packing and every check on
 * a pasted code are in lib/star/saveTransfer.ts.
 *
 * Shared by the title screen's Settings and the in-career Settings.
 */

interface Props {
  /** Whose saves: the signed-in account (or the dev sandbox's local scope). */
  scope: string;
  /** Saves were written; open this slot. */
  onImported: (openSlot: number) => void;
  glow?: string;
}

type Mode = "closed" | "copy" | "paste";

function slotLine(s: SaveSlotSummary): string {
  if (s.empty) return "Empty";
  const who = s.playerName ?? "";
  return s.signed
    ? `${who} · ${s.club} · Season ${s.season} · ★${s.starRating}`
    : `${who} · No club yet · ★${s.starRating}`;
}

export default function MoveSavesPanel({ scope, onImported, glow = "#10b981" }: Props) {
  const [mode, setMode] = useState<Mode>("closed");

  // ── Copy ──
  const [code, setCode] = useState<{ text: string; slots: number } | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const codeBoxRef = useRef<HTMLTextAreaElement>(null);

  // Built as soon as Copy opens, so the tap that copies can do it straight
  // away — iPhone only lets a page copy inside the tap itself.
  useEffect(() => {
    if (mode !== "copy") return;
    let live = true;
    setCode(null); setCopyMsg(null); setShowCodeBox(false);
    packSaves(scope).then(r => { if (live) setCode({ text: r.code, slots: r.slots }); }).catch(() => {
      if (live) setCopyMsg("Couldn't read the saves on this device.");
    });
    return () => { live = false; };
  }, [mode, scope]);

  const copyCode = () => {
    if (!code) return;
    const fallback = () => {
      setShowCodeBox(true);
      setCopyMsg("Copy didn't work here. The code is in the box: tap it, Select All, Copy.");
      setTimeout(() => { codeBoxRef.current?.focus(); codeBoxRef.current?.select(); }, 50);
    };
    try {
      if (!navigator.clipboard?.writeText) { fallback(); return; }
      navigator.clipboard.writeText(code.text).then(
        () => setCopyMsg("Copied. Now open the game from the Home Screen icon → Settings → Move my saves → Paste save code."),
        fallback,
      );
    } catch { fallback(); }
  };

  const saveFile = async () => {
    if (!code) return;
    const name = `knowitball-saves-${new Date().toISOString().slice(0, 10)}.txt`;
    try {
      const file = new File([code.text], name, { type: "text/plain" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Knowitball saves" });
        setCopyMsg("Choose \"Save to Files\". Then in the app: Paste save code → Load from file.");
        return;
      }
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
    try {
      const url = URL.createObjectURL(new Blob([code.text], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setCopyMsg(`Saved as ${name}. In the app: Paste save code → Load from file.`);
    } catch {
      setCopyMsg("Couldn't save a file here. Use Copy save code instead.");
    }
  };

  // ── Paste ──
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<CheckedPack | null>(null);
  const [pasteMsg, setPasteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const checkSeq = useRef(0);

  const runCheck = async (value: string) => {
    const seq = ++checkSeq.current;
    setChecked(null);
    if (!value.trim()) { setPasteMsg(null); return; }
    setChecking(true);
    const res = await unpackSaves(value);
    if (seq !== checkSeq.current) return;
    setChecking(false);
    if (res.ok) { setChecked(res.pack); setPasteMsg(null); }
    else setPasteMsg({ ok: false, text: res.reason });
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setText(t.length > 2000 ? `(${codeSizeLabel(t.length)} pasted)` : t);
      void runCheck(t);
    } catch {
      setPasteMsg({ ok: false, text: "Couldn't read the clipboard. Press and hold the box below, then Paste." });
    }
  };

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_CODE_CHARS) { setPasteMsg({ ok: false, text: "That file is too big to be a save code." }); return; }
    try {
      const t = await f.text();
      setText(`(${f.name})`);
      void runCheck(t);
    } catch {
      setPasteMsg({ ok: false, text: "Couldn't open that file." });
    }
  };

  // What this device holds now — read once per checked code, not per keystroke
  // (each read opens all three saves).
  const here = useMemo(() => (checked ? listSaveSlots(scope) : []), [checked, scope]);
  const replacing = checked ? checked.slots.filter(s => here.some(h => h.slot === s.slot && !h.empty)) : [];

  const putSaves = async () => {
    if (!checked) return;
    if (replacing.length) {
      const nums = replacing.map(s => s.slot);
      const which = nums.length === 1 ? `Save ${nums[0]}`
        : `Saves ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`;
      const ok = await askConfirm(`${which} on this device will be replaced by the one${nums.length > 1 ? "s" : ""} in the code. Replace?`, "Replace");
      if (!ok) return;
    }
    const out = applySaves(scope, checked);
    if (out.failed.length && !out.written.length) {
      setPasteMsg({ ok: false, text: "This device is out of space, so nothing was moved." });
      return;
    }
    setPasteMsg({
      ok: true,
      text: out.failed.length
        ? `Moved ${out.written.map(s => `save ${s}`).join(", ")}. Save ${out.failed.join(", ")} didn't fit — this device is out of space.`
        : `Moved ${out.written.length} save${out.written.length > 1 ? "s" : ""}.`,
    });
    setChecked(null); setText("");
    onImported(out.openSlot);
  };

  const tab = (m: Mode, label: string) => (
    <PressButton
      variant={mode === m ? "primary" : "secondary"}
      size="none"
      onClick={() => setMode(mode === m ? "closed" : m)}
      className="flex-1 rounded-lg px-2.5 py-2 text-[12px] font-black"
    >
      {label}
    </PressButton>
  );

  const big = !!code && code.text.length > BIG_CODE_CHARS;

  return (
    <SetCard tone={glow} data-move-saves>
      <SetHead>Move my saves</SetHead>
      <SetNote>
        The Home Screen app can&apos;t see saves made in Safari. Copy a code here, then paste it there.
      </SetNote>

      <div className="mt-2 flex gap-2">
        {tab("copy", "Copy save code")}
        {tab("paste", "Paste save code")}
      </div>

      {mode === "copy" && (
        <div className="mt-2 rounded-lg bg-black/30 p-2.5" data-move-copy>
          {!code && !copyMsg && <SetNote className="mt-0">Packing your saves…</SetNote>}
          {code && code.slots === 0 && <SetNote className="mt-0">No saves on this device yet.</SetNote>}
          {code && code.slots > 0 && (
            <>
              <div className="text-[12px] font-black text-white">
                {code.slots} save{code.slots > 1 ? "s" : ""} · {codeSizeLabel(code.text.length)}
              </div>
              <div className="mt-2 flex gap-2">
                <PressButton variant={big ? "secondary" : "primary"} size="none" onClick={copyCode} className="flex-1 rounded-lg py-2 text-[12px] font-black" data-move-copy-btn>
                  Copy
                </PressButton>
                <PressButton variant={big ? "primary" : "secondary"} size="none" onClick={() => void saveFile()} className="flex-1 rounded-lg py-2 text-[12px] font-black">
                  Save as file
                </PressButton>
              </div>
              {big && <SetNote>This code is big. A file is safer than the clipboard.</SetNote>}
            </>
          )}
          {copyMsg && <p className="mt-2 text-[12px] font-bold leading-snug text-emerald-200" data-move-copy-msg>{copyMsg}</p>}
          {showCodeBox && code && (
            <textarea
              ref={codeBoxRef}
              readOnly
              value={code.text}
              onFocus={e => e.currentTarget.select()}
              className="mt-2 h-20 w-full resize-none rounded-md bg-black/50 p-2 font-mono text-[10px] text-white"
            />
          )}
        </div>
      )}

      {mode === "paste" && (
        <div className="mt-2 rounded-lg bg-black/30 p-2.5" data-move-paste>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); void runCheck(e.target.value); }}
            placeholder="Paste the save code here"
            className="h-16 w-full resize-none rounded-md bg-black/50 p-2 font-mono text-[11px] text-white placeholder:text-white/70"
            data-move-paste-box
          />
          <div className="mt-2 flex gap-2">
            <PressButton variant="secondary" size="none" onClick={() => void pasteFromClipboard()} className="flex-1 rounded-lg py-2 text-[12px] font-black">
              Paste
            </PressButton>
            <PressButton variant="secondary" size="none" onClick={() => fileRef.current?.click()} className="flex-1 rounded-lg py-2 text-[12px] font-black">
              Load from file
            </PressButton>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.json,text/plain,application/json"
              className="hidden"
              onChange={e => { void loadFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>

          {checking && <SetNote>Checking the code…</SetNote>}

          {checked && (
            <div className="mt-2" data-move-preview>
              <div className="text-[12px] font-black text-white">In this code:</div>
              <ul className="mt-1 space-y-1">
                {checked.slots.map(s => {
                  const willReplace = replacing.some(r => r.slot === s.slot);
                  return (
                    <li key={s.slot} className="rounded-md bg-white/5 px-2 py-1.5 text-[11.5px] font-bold leading-snug text-white">
                      <span className="font-black">Save {s.slot}</span> · {slotLine(s.summary)}
                      {willReplace && (
                        <div className="text-[10.5px] font-black text-amber-200">
                          Replaces: {slotLine(here.find(h => h.slot === s.slot) ?? { slot: s.slot, empty: true })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <PressButton variant="primary" size="none" onClick={() => void putSaves()} className="mt-2 w-full rounded-lg py-2.5 text-[13px] font-black" data-move-apply>
                Put {checked.slots.length > 1 ? "these saves" : "this save"} on this device
              </PressButton>
            </div>
          )}

          {pasteMsg && (
            <p className={`mt-2 text-[12px] font-bold leading-snug ${pasteMsg.ok ? "text-emerald-200" : "text-red-200"}`} data-move-paste-msg>
              {pasteMsg.text}
            </p>
          )}
        </div>
      )}
    </SetCard>
  );
}
