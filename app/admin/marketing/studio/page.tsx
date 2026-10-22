/**
 * app/admin/marketing/studio/page.tsx — the Studio (Harry, 22 Oct 2026: "port over the whole studio ... and apply it
 * to our 'client' which is Knowitball"). Two top tabs, as in the original: Editing (the editing suite, in full) and
 * Statics (a placeholder: Harry said to wait on it). Admins only (the Marketing layout's DevGate, and every read and
 * save checks the admin sign-in again on the server).
 *
 *   /admin/marketing/studio                 Editing: every cut in storage, by video card
 *   /admin/marketing/studio?key=<video key> one cut in the editing suite
 *   /admin/marketing/studio?tab=statics     Statics: coming later
 */
import type { Metadata } from "next";
import Link from "next/link";
import AdminShell from "@/components/admin/shell/AdminShell";
import { BroadcastPage, Panel } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import MarketingTabs from "@/components/admin/marketing/MarketingTabs";
import { CutEditor } from "@/components/admin/studio/cut-editor";
import { parseBoard, stageName } from "@/lib/marketing/board";
import { listMedia } from "@/lib/marketing/mediaApi";
import { getStorage } from "@/lib/marketing/storage";
import { getCaller } from "@/lib/marketing/caller";
import { sizeLabel, suiteLink } from "@/lib/marketing/uploadClient";
import type { MediaItem } from "@/lib/marketing/r2";
import { readCutView } from "@/lib/studio/store";
import { tc } from "@/lib/studio/schema";
import bundledBoard from "@/marketing/board.json";
import "@/components/admin/marketing/marketing.css";
import "@/components/admin/marketing/suite.css";
import "@/components/admin/studio/studio-skin.css";

export const metadata: Metadata = { title: "Marketing · Studio", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const BASE = "/admin/marketing/studio";

export default async function MarketingStudioPage({ searchParams }: { searchParams: { key?: string; tab?: string } }) {
  const tab = searchParams.tab === "statics" ? "statics" : "editing";
  const key = typeof searchParams.key === "string" && searchParams.key ? searchParams.key : null;
  return (
    <>
      <AdminShell tab="home" role="admin" game="marketing" group="marketing">
        <BroadcastPage title="Studio" sub="Edit our videos: notes, cuts and changes for Claude" back={null} width={1600}>
          <MarketingTabs view="studio" />
          <nav className="studio-tabs" aria-label="Studio">
            <Link href={BASE} aria-current={tab === "editing" ? "page" : undefined}>Editing</Link>
            <Link href={`${BASE}?tab=statics`} aria-current={tab === "statics" ? "page" : undefined}>Statics <small>Soon</small></Link>
          </nav>
          {tab === "statics" ? <Statics /> : key ? <Cut videoKey={key} /> : <Editing />}
        </BroadcastPage>
      </AdminShell>
      <PageGuide page="/admin/marketing/studio" />
    </>
  );
}

function Statics() {
  return (
    <Panel title="Statics">
      <p className="mk-intro">Coming later. This is where still pictures for posts (covers, thumbnails, single-image ads) will be made and steered one version at a time, the same way the Editing tab works for video. Harry said to wait on it for now.</p>
    </Panel>
  );
}

const cards = () => parseBoard(bundledBoard);

/** Every cut in storage, grouped by its video card (board order), then the ones not linked to a card. */
async function Editing() {
  const caller = await getCaller();
  const r = await listMedia(caller, getStorage(), new Date()).catch((e) => ({ status: 502, body: { error: (e as Error).message } as Record<string, unknown> }));
  if (r.status !== 200) return <Panel title="Editing"><p className="mk-intro">{String(r.body.error ?? "The list could not be read.")}</p></Panel>;
  const items = ((r.body.items as MediaItem[]) ?? []).filter((i) => i.kind === "video");
  const mode = r.body.mode as string;
  const board = cards();
  const groups = new Map<string, MediaItem[]>();
  for (const it of items) groups.set(it.folder, [...(groups.get(it.folder) ?? []), it]);
  const order = [...board.map((c) => c.id).filter((id) => groups.has(id)), ...Array.from(groups.keys()).filter((f) => !board.some((c) => c.id === f))];
  // Cards being made or edited with no cut yet (the original's "No cut yet" placeholders).
  const waiting = board.filter((c) => (c.stage === "making" || c.stage === "edit" || c.stage === "check") && !groups.has(c.id));
  return (
    <>
      {mode !== "r2" && (
        <div className="mk-store" data-on="false" role="status"><b>○ Storage not connected here</b><span>{String(r.body.message ?? "")}</span></div>
      )}
      <p className="mk-intro">Pick a cut. Edits go to Claude, notes are for whoever cuts the video. Press Done when you have given all your edits.</p>
      {order.length === 0 && waiting.length === 0 && <Panel title="No cuts yet"><p className="mk-intro">Upload a video on the Uploads page (or Send to Marketing from the Videos recorder), then open it here.</p></Panel>}
      {order.map((f) => {
        const card = board.find((c) => c.id === f);
        return (
          <Panel key={f} title={card?.title ?? (f === "inbox" ? "Not linked to a card" : f)} note={card ? stageName(card.stage) : undefined}>
            <div className="mk-suite-list">
              {groups.get(f)!.map((it) => (
                <Link key={it.key} className="mk-suite-item" href={suiteLink(it.key)}>
                  <span className="mk-kind">▶</span>
                  <span className="mk-file-main"><b>{it.name}</b><small>{sizeLabel(it.size)}{it.uploaded ? ` · ${new Date(it.uploaded).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}{it.hasNotes ? " · has notes" : ""}</small></span>
                  <span className="mk-open">Open ›</span>
                </Link>
              ))}
            </div>
          </Panel>
        );
      })}
      {waiting.length > 0 && (
        <Panel title="No cut yet" note={`${waiting.length}`}>
          {waiting.map((c) => <p key={c.id} className="mk-intro"><b>{c.title}</b> · {stageName(c.stage)}. Upload its cut on the Uploads page, linked to this card.</p>)}
        </Panel>
      )}
    </>
  );
}

/** One cut in the editing suite. */
async function Cut({ videoKey }: { videoKey: string }) {
  const caller = await getCaller();
  const store = getStorage();
  if (!caller?.admin) return <Panel title="Admins only"><p className="mk-intro">Sign in with an admin account.</p></Panel>;
  if (store.mode === "off") return <Panel title="Storage not connected here"><p className="mk-intro">The editing suite needs the R2 storage settings in Vercel.</p></Panel>;
  if (!store.isMediaKey(videoKey)) return <Panel title="No such video"><p className="mk-intro"><Link href={BASE}>Back to every cut</Link></p></Panel>;
  const r = await listMedia(caller, store, new Date());
  const items = ((r.body.items as MediaItem[]) ?? []).filter((i) => i.kind === "video");
  const item = items.find((i) => i.key === videoKey);
  const card = item ? cards().find((c) => c.id === item.folder) : undefined;
  const title = card?.title ?? item?.name ?? videoKey.split("/").pop() ?? "Cut";
  const view = await readCutView(store, videoKey, title);
  const siblings = items.filter((i) => item && i.folder === item.folder).map((i) => ({ slug: slugOf(i.key), label: i.name, href: suiteLink(i.key) }));
  const length = view.lanes?.duration ?? view.timeline?.assets.duration ?? 0;
  return (
    <div className="studio-cut">
      <CutEditor
        slug={slugOf(videoKey)}
        videoKey={videoKey}
        backHref={BASE}
        review={view.review}
        initialEdits={view.edits}
        initialRequests={view.requests}
        initialRender={view.render}
        timeline={view.timeline}
        lanes={view.lanes}
        qc={view.qc}
        siblings={siblings}
        title={title}
        sub={[item?.name, length ? tc(length) : ""].filter(Boolean).join(" · ")}
      />
    </div>
  );
}

const slugOf = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(-100);
