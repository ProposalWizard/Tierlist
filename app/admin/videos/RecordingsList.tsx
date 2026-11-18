"use client";
/**
 * Recent recordings (Harry, 12 Nov 2026): every recording in team storage
 * (Cloudflare R2, recordings/…), newest first: who, what, length, date, Play,
 * Copy link for Claude and Keep. Recordings are deleted 30 days after they
 * arrive unless Keep is on (/api/cron/recordings).
 */
import { useCallback, useEffect, useState } from "react";
import { lengthLabel, starterFor } from "@/lib/recording";
import { listRecordings, setKeep, type RecordingList, type RecordingRow } from "@/lib/recordings/client";

const dayWord = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const leftWord = (r: RecordingRow) => (r.keep ? "Kept" : r.daysLeft === 0 ? "Goes tonight" : `${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"} left`);

export default function RecordingsList({ reloadOn }: { reloadOn: number }) {
  const [list, setList] = useState<RecordingList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => { listRecordings().then((l) => { setList(l); setError(null); }, (e) => setError((e as Error).message)); }, []);
  useEffect(load, [load, reloadOn]);

  const copy = (r: RecordingRow) => navigator.clipboard?.writeText(starterFor(r.link)).then(() => setCopied(r.key), () => setCopied(null));
  const keep = (r: RecordingRow) => {
    const on = !r.keep;
    // Show it at once; put it back if the save fails.
    const flip = (v: boolean) => setList((l) => l && { ...l, recordings: l.recordings.map((x) => (x.key === r.key ? { ...x, keep: v } : x)) });
    flip(on);
    setKeep(r.key, on).then(load, (e) => { flip(!on); setError((e as Error).message); });
  };

  const days = list?.keptDays ?? 30;
  return (
    <section className="ash-panel vt-card">
      <div className="rl-head">
        <p className="vt-label">Recent recordings</p>
        <span className="rl-kept" title={`A recording is deleted ${days} days after it is saved, unless Keep is on`}>kept {days} days</span>
      </div>
      {error && <p className="vt-err">{error}</p>}
      {!list && !error && <p className="vt-hint">Loading…</p>}
      {list && !list.connected && <p className="vt-hint">Team storage is not connected on this site, so there is no list here. Recordings go to Drive or download.</p>}
      {list?.connected && list.recordings.length === 0 && <p className="vt-hint">No recordings yet. The next one you stop shows up here.</p>}
      {list?.connected && list.recordings.length > 0 && (
        <ul className="rl">
          {list.recordings.map((r) => (
            <li key={r.key} className="rl-row">
              <div className="rl-what">
                <b>{r.about}</b>
                <span>{r.who} · {lengthLabel(r.seconds)} · {dayWord(r.uploaded)} · <i data-keep={r.keep}>{leftWord(r)}</i></span>
              </div>
              <div className="rl-acts">
                <button className="ash-btn ghost rl-btn" aria-pressed={playing === r.key} onClick={() => setPlaying(playing === r.key ? null : r.key)}>{playing === r.key ? "Close" : "Play"}</button>
                <button className="ash-btn ghost rl-btn" onClick={() => copy(r)} title={`Copies "${starterFor("<link>")}" to paste into a Claude chat`}>{copied === r.key ? "Copied" : "Copy link for Claude"}</button>
                <label className="rl-keep" title={`On: never deleted. Off: deleted ${days} days after it was saved.`}>
                  <span>Keep</span>
                  <button className="ash-pill-sw" role="switch" aria-checked={r.keep} aria-label={`Keep ${r.about}`} onClick={() => keep(r)} />
                </label>
              </div>
              {playing === r.key && <video className="vt-video" src={r.link} controls autoPlay playsInline />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
