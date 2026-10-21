/**
 * app/admin/marketing/client/page.tsx — Knowitball as a client (Harry, 21 Oct
 * 2026; plan §3). Rendered from marketing/clients/knowitball/client.md and the
 * Brain notes it lists (tag client-kib), read at request time. To change what
 * it says: a new Brain note (never edit a live note in place), then the code
 * in the record. Admins only (the parent layout's DevGate).
 */
import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage, Panel, PanelGrid } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import { CLIENT_FILE, readClientRecord, type ClientItem } from "@/lib/marketing/clientRecord";
import { repoLink } from "@/lib/marketing/board";

export const metadata: Metadata = { title: "Marketing · Client", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function MarketingClientPage() {
  const rec = readClientRecord();
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing" group="marketing">
        <BroadcastPage title={rec ? `${rec.label} · client` : "Client"} sub="Voice, audience, rules, brand, learnings, best scripts" back={null} width={1400}>
          <MarketingTabs view="client" />
          {!rec ? (
            <Panel title="No client record"><p className="mk-intro">The file {CLIENT_FILE} could not be read.</p></Panel>
          ) : (<>
            <div className="mk-chips">
              {rec.code && <span className="mk-chip">Code {rec.code}</span>}
              {rec.status && <span className="mk-chip">{rec.status}</span>}
              <span className="mk-chip">Brain tag client-kib</span>
              <a className="mk-chip" href={repoLink(CLIENT_FILE, "main")} target="_blank" rel="noreferrer">The record file ↗</a>
            </div>
            <PanelGrid min={340}>
              {rec.sections.map((s) => (
                <Panel key={s.title} title={s.title} note={`${s.items.filter((i) => i.kind === "note").length} note${s.items.filter((i) => i.kind === "note").length === 1 ? "" : "s"}`}>
                  {s.items.map((it, i) => <Item key={i} it={it} />)}
                </Panel>
              ))}
            </PanelGrid>
          </>)}
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing/client" />
    </>
  );
}

function Item({ it }: { it: ClientItem }) {
  if (it.kind === "text") return <p className="mk-plain">{it.text}</p>;
  const n = it.note;
  if (!n) return <p className="mk-plain">{it.code}: no such Brain note.</p>;
  return (
    <div className="mk-note">
      <b>{n.summary}</b>
      {n.body && <p>{n.body}</p>}
      <small>
        <code>{n.code}</code>
        {n.status !== "live" && <span className="mk-draft">{n.status === "draft" ? "To confirm" : n.status}</span>}
        <span>from {n.source}</span>
      </small>
    </div>
  );
}
