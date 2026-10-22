"use client";
/**
 * The Suite page: every video in storage, newest first, grouped by video card;
 * open one and it plays in the editing suite (CutEditor). The list is read
 * from the bucket (/api/admin/marketing/media).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import CutEditor from "./CutEditor";
import { playLink, sizeLabel, suiteLink } from "@/lib/marketing/uploadClient";
import type { MediaItem } from "@/lib/marketing/r2";
import "./marketing.css";
import "./suite.css";

type Card = { id: string; title: string };

export default function SuiteBrowser({ initialKey, cards }: { initialKey: string | null; cards: Card[] }) {
  const router = useRouter();
  const [key, setKey] = useState<string | null>(initialKey);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [mode, setMode] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/marketing/media", { cache: "no-store" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setItems((j.items as MediaItem[]).filter((i) => i.kind === "video")); setMode(j.mode); setMsg(j.message ?? null);
    }).catch((e) => { setItems([]); setMsg((e as Error).message || "The list could not be read."); });
  }, []);
  useEffect(() => { setKey(initialKey); }, [initialKey]);

  const titleOf = (folder: string) => cards.find((c) => c.id === folder)?.title ?? (folder === "inbox" ? "Not linked to a card" : folder);
  const open = (k: string | null) => { setKey(k); router.push(k ? suiteLink(k) : "/admin/marketing/suite", { scroll: false }); };
  const item = items?.find((i) => i.key === key);

  if (key) {
    return <CutEditor key={key} videoKey={key} title={item ? `${titleOf(item.folder)} · ${item.name}` : key.split("/").pop() ?? key} src={playLink(key)} onBack={() => open(null)} />;
  }
  return (
    <>
      {msg && <div className="mk-store" data-on={mode === "r2" ? "true" : "false"}><b>{mode === "r2" ? "● Storage connected" : "○ Storage not connected here"}</b><span>{msg}</span></div>}
      <Panel title="Videos" note={items ? `${items.length}` : "Loading…"}>
        {items && items.length === 0 && <p className="mk-empty">No videos yet. Upload one on the Uploads page.</p>}
        <div className="mk-suite-list">
          {(items ?? []).map((it) => (
            <button key={it.key} className="mk-suite-item" onClick={() => open(it.key)}>
              <span className="mk-kind">▶</span>
              <span className="mk-file-main"><b>{titleOf(it.folder)}</b><small>{it.name} · {sizeLabel(it.size)}{it.hasNotes ? " · has notes" : ""}</small></span>
              <span className="mk-open">Open ›</span>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
