"use client";

/**
 * THE HALL OF FAME SCREEN — every retired career on this account.
 *
 * Leo, 5 Oct 2026: "You should be able to come back to it somewhere … maybe
 * there should be an area on the start screen" — and "the Hall of Fame is a
 * must-have." Opened from the title screen and from the end of a career.
 * Tap a career for its whole overview (CareerOverview), read only.
 *
 * The list is HallOfFameList (no storage), so the test page
 * (/star-retirement-dev) can show made-up careers without saving anything.
 */
import { useEffect, useState } from "react";
import { loadHall, syncHall, removeFromHall, type HallEntry, type HallCloud } from "@/lib/star/hallOfFame";
import { collectRetiredIntoHall } from "@/lib/star/storage";
import { askConfirm } from "@/lib/star/askConfirm";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import CareerOverview from "./CareerOverview";
import ClubBadge from "./ClubBadge";
import TrophyImage from "./TrophyImage";
import { ScreenShell, RiseIn, BottomBar, BarButton, clubTheme, rgba } from "./ui";
import { Rays } from "./ui/Screen";

const GOLD = "#fbbf24";
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "").replace(/^(FC|AFC)\s+/i, "");
/** "2026–46": the first season's start year to the last season's end year. */
const years = (first: number, seasons: number) => `${first}–${String(first + Math.max(1, seasons)).slice(-2)}`;

const CLOUD_LINE: Record<HallCloud, string | null> = {
  synced: null,
  "signed-out": "Kept on this device. Sign in to keep it in your account.",
  "not-set-up": "Kept on this device for now.",
  offline: "Kept on this device. It goes to your account next time.",
};

/** The Hall, with storage: loads, syncs, opens, removes. */
export default function HallOfFame({ account, onBack, backLabel = "Back" }: {
  /** The account scope (user id, or "anon" when signed out). */
  account: string;
  onBack: () => void;
  backLabel?: string;
}) {
  const [entries, setEntries] = useState<HallEntry[] | null>(null);
  const [cloud, setCloud] = useState<HallCloud | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // A career that retired before the Hall existed is still in its slot.
    try { collectRetiredIntoHall(account); } catch { /* the list still shows */ }
    setEntries(loadHall(account).entries);
    void syncHall(account).then(r => {
      if (!alive) return;
      setEntries(r.book.entries);
      setCloud(r.cloud);
    });
    return () => { alive = false; };
  }, [account]);

  const opened = open ? entries?.find(e => e.id === open) : undefined;
  if (opened) {
    return (
      <CareerOverview
        key={opened.id}
        career={opened.career}
        actions={[
          { icon: "‹", label: "Hall of Fame", onClick: () => { setOpen(null); window.scrollTo({ top: 0 }); } },
          {
            icon: "🗑", label: "Remove", onClick: () => {
              void askConfirm(`Take ${opened.card.name} out of the Hall of Fame? This can't be undone.`, "Remove").then(ok => {
                if (!ok) return;
                const book = removeFromHall(account, opened.id);
                setEntries(book.entries);
                setOpen(null);
                void syncHall(account);
              });
            },
          },
        ]}
      />
    );
  }
  return (
    <HallOfFameList
      entries={entries ?? []}
      loading={entries === null}
      note={cloud ? CLOUD_LINE[cloud] : null}
      onOpen={(id) => { setOpen(id); window.scrollTo({ top: 0 }); }}
      onBack={onBack}
      backLabel={backLabel}
    />
  );
}

/** The list itself: no storage, no network. */
export function HallOfFameList({ entries, loading = false, note, onOpen, onBack, backLabel = "Back" }: {
  entries: HallEntry[];
  loading?: boolean;
  /** One line under the title when the Hall is not in the account yet. */
  note?: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
  backLabel?: string;
}) {
  const goals = entries.reduce((n, e) => n + e.card.goals, 0);
  const trophies = entries.reduce((n, e) => n + e.card.trophies, 0);
  return (
    <ScreenShell
      glow={GOLD}
      title=""
      bare
      tone="calm"
      bottomBar={(
        <BottomBar>
          <BarButton icon="‹" label={backLabel} onClick={onBack} />
        </BottomBar>
      )}
    >
      <div data-hall-of-fame>
        <RiseIn>
          <div className="relative mx-auto mt-4 grid h-[96px] place-items-center text-center">
            <Rays color="#fde68a" size={250} />
            <div className="relative">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-200">Your careers</div>
              <h1 className="mt-1 text-[40px] uppercase leading-none text-white" style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,.7))" }}>
                Hall of <span className="text-amber-300">Fame</span>
              </h1>
            </div>
          </div>
        </RiseIn>
        {entries.length > 0 && (
          <RiseIn index={1}>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
              {[["Careers", entries.length], ["Goals", goals], ["Trophies", trophies]].map(([l, v]) => (
                <div key={l as string} className="py-1.5" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                  <div className="sk-num text-[22px] leading-none tabular-nums text-white">{v}</div>
                  <div className="mt-0.5 text-[9.5px] font-black uppercase tracking-wider text-white/70">{l}</div>
                </div>
              ))}
            </div>
          </RiseIn>
        )}
        {note && <div className="mt-2 text-center text-[11.5px] font-bold text-amber-200/90" data-hall-note>{note}</div>}

        <div className="mt-3 space-y-2">
          {entries.map((e, k) => <RiseIn key={e.id} index={k + 2}><HallCardRow entry={e} onOpen={() => onOpen(e.id)} /></RiseIn>)}
          {/* Empty places are blacked out, not hidden (house rule). */}
          {!loading && entries.length < 3 && Array.from({ length: 3 - entries.length }, (_, k) => (
            <div key={`empty-${k}`} className="flex h-[78px] items-center justify-center" style={{ background: "rgba(0,0,0,.55)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
              {k === 0 && <span className="text-[12px] font-black uppercase tracking-wider text-white/45">Retire a career to fill this</span>}
            </div>
          ))}
        </div>
        <div className="h-4" />
      </div>
    </ScreenShell>
  );
}

function HallCardRow({ entry, onOpen }: { entry: HallEntry; onOpen: () => void }) {
  const c = entry.card;
  const th = clubTheme(c.mainClub);
  return (
    <button
      onClick={onOpen}
      className="kib-press relative block w-full overflow-hidden text-left"
      style={{ background: `linear-gradient(120deg, ${rgba(th.glow, 0.45)}, ${rgba(th.glow, 0.1)} 50%, rgba(5,8,15,.92))`, boxShadow: `inset 3px 0 0 ${GOLD}, inset 0 0 0 1px ${rgba(th.glow, 0.5)}` }}
      data-hall-entry={entry.id}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="grid h-[52px] w-[52px] shrink-0 place-items-center" style={{ background: `radial-gradient(closest-side, ${rgba(th.glow, 0.6)}, transparent)` }}>
          <ClubBadge club={c.mainClub} kit={kitsOf(c.mainClub).home} size={44} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] uppercase leading-tight text-white sk-display">{c.name}</div>
          <div className="truncate text-[11px] font-black uppercase tracking-wide text-amber-200">{c.title}</div>
          <div className="truncate text-[11px] font-bold text-white/75">{short(c.mainClub)} · {years(c.firstYear, c.seasons)} · {c.seasons} seasons</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="sk-num text-[24px] leading-none tabular-nums text-white">{c.goals}</div>
          <div className="text-[9px] font-black uppercase tracking-wider text-white/65">goals</div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] font-black tabular-nums text-amber-200">
            {c.ballonDors > 0 && <span className="flex items-end gap-0.5"><TrophyImage name="Ballon d'Or" height={14} />{c.ballonDors}</span>}
            <span>🏆 {c.trophies}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
