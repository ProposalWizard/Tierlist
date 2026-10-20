"use client";
/**
 * app/admin/research/page.tsx — the Research area (Harry, 20 Oct 2026). One
 * card per research write-up, newest first, each opening its page. The list
 * is lib/research.ts: new research = one line there. Studio tab, Research group.
 */
import { useMemo, useState } from "react";
import { BroadcastPage, Pill } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import { RESEARCH, researchNewestFirst, type ResearchTopic } from "@/lib/research";
import "./research.css";

const TOPIC_COLOUR: Record<ResearchTopic, string> = {
  Highlights: "#3b82f6", Design: "#a855f7", "3D": "#eab308", "Game feel": "#22c55e", Other: "#64748b",
};
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function ResearchPage() {
  const list = useMemo(() => researchNewestFirst(RESEARCH), []);
  const topics = useMemo(() => list.map((r) => r.topic).filter((t, i, a) => a.indexOf(t) === i), [list]);
  const [topic, setTopic] = useState<ResearchTopic | null>(null);
  const shown = topic ? list.filter((r) => r.topic === topic) : list;
  return (
    <>
      <BroadcastPage title="Research" sub={`${list.length} write-ups. Tap one to read it.`} width={1200}>
        {topics.length > 1 && (
          <div className="rs-pills" role="group" aria-label="Topic">
            <Pill on={!topic} onClick={() => setTopic(null)}>All {list.length}</Pill>
            {topics.map((t) => (
              <Pill key={t} on={topic === t} onClick={() => setTopic(topic === t ? null : t)}>
                {t} {list.filter((r) => r.topic === t).length}
              </Pill>
            ))}
          </div>
        )}
        <div className="rs-grid">
          {shown.map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="rs-card" style={{ ["--t" as string]: TOPIC_COLOUR[r.topic] }} title={`${r.title}: ${r.line}`}>
              <span className="rs-top"><span className="rs-topic">{r.topic}</span><span className="rs-date">{day(r.date)}</span></span>
              <b className="rs-title">{r.title}</b>
              <span className="rs-line">{r.line}</span>
              <span className="rs-foot"><span className="rs-by">By {r.by}</span><span className="rs-open">Read ↗</span></span>
            </a>
          ))}
        </div>
      </BroadcastPage>
      <PageGuide page="/admin/research" />
    </>
  );
}
