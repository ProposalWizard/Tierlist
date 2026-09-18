"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import type { StarPlayer } from "@/lib/star/types";
import { type CareerDivision } from "@/lib/star/calendar";
import { ALL_NATIONALITIES, getFlagUrl } from "@/lib/nationalities";
import {
  SKIN_TONES, DEFAULT_SKIN_TONE, type SkinTone,
  DEFAULT_FOOT, type PreferredFoot,
  MIN_SQUAD_NUMBER, MAX_SQUAD_NUMBER, clampSquadNumber,
} from "@/lib/star/playerIdentity";
import PortraitPicker from "./PortraitPicker";

interface Props {
  onComplete: (player: StarPlayer, clubs: string[], division: CareerDivision) => void;
}

/**
 * ── THERE IS NO CLUB TO CHOOSE ANY MORE ──
 *
 * Removed 18 September 2026, reported three times and quoted here because the
 * contradiction is the whole reason: "Get rid of this completely." · "Still,
 * for some reason, we still got Choose Your Club." · "I've chosen a club,
 * which is silly."
 *
 * It was silly. Step 2 asked you to pick a division and a club, and then the
 * very next screen told you nobody had signed you and put you through a trial
 * to earn one. A club ARRIVES now, from `attachClub`, when a scout actually
 * offers — see app/star-dev/page.tsx's `handleProfileComplete` ("You arrive
 * with NO CLUB") and the scout-offer screen's `onAccept`.
 *
 * ── Kept written down, because it may come back in another form ──
 *
 * Said directly: "just keep it in your memory somewhere how exactly it works,
 * but we don't want that right now." Exactly how it worked, so it can be put
 * back without re-deriving any of it:
 *
 *  - A `DIVISIONS` array of `{ key: CareerDivision, clubs }` for all five real
 *    English tiers, read from lib/star/clubs.ts's `PREMIER_LEAGUE_CLUBS` /
 *    `CHAMPIONSHIP_CLUBS` / `LEAGUE_ONE_CLUBS` / `LEAGUE_TWO_CLUBS` /
 *    `NATIONAL_LEAGUE_CLUBS` — NOT from /api/draft/clubs, which answers a
 *    different question (every club that has ever been in Draft mode's idea of
 *    the Premier League, across every edition). Each list sorted
 *    alphabetically, deliberately, because a picker is scanned by letter even
 *    though the table order is the real order everywhere else.
 *  - Division tabs above a scrolling club list; `leagueNameFor` (calendar.ts)
 *    for the tab labels; switching division reset the selection to that
 *    division's first club.
 *  - A "NO SQUAD YET" badge, from a `GET /api/draft/clubs` fetch filtered to
 *    `seasons.includes(STAR_FIFA_YEAR)`, in three states — unknown / loading /
 *    loaded — because an empty `Set` is truthy and a single transient failure
 *    once locked in "not one club has data" permanently. Never a block: a club
 *    with no data was always still selectable and degraded to a generated
 *    squad.
 *  - The chosen club fed `player.club`, and `onComplete`'s `clubs` (that
 *    division's list) and `division` arguments.
 *
 * The data model is untouched: `StarPlayer.club`, `CareerDivision`, this
 * component's own `onComplete(player, clubs, division)` signature,
 * `makeIdentity` and `attachClub` all still work exactly as they did. Only the
 * FLOW lost the question.
 */

/**
 * There is nothing to choose here.
 *
 * The league step offered exactly one league — England, the Premier League,
 * this edition — as a full screen with a single un-clickable answer on it, and
 * the position step asked a sixteen-year-old to name the position he plays
 * before he has kicked a ball. Both are gone; setup is now name/nation, then
 * club. Age went the same way: every career starts a sixteen-year-old, given
 * directly rather than offered as 15/16/17 — a career already always reads
 * `career.player.age` as the sixteen-year-old prospect the rest of setup
 * (a debut season, a first pro contract) assumes he is.
 *
 * A position is still a thing a career HAS — `career.player.position` is read
 * everywhere from the team sheet to the scenario weighting — so it keeps a
 * default rather than becoming optional. Striker, which is what the picker
 * defaulted to anyway.
 */
const DEFAULT_POSITION = "ST";
const STARTING_AGE = 16;
/** Striker's shirt, to match DEFAULT_POSITION. Only a starting point — it is a
 *  preference, and the whole point of it is that it can be changed. */
const DEFAULT_PREFERRED_NUMBER = 9;

/**
 * WHY STEP 1 IS TWO PANES.
 *
 * Direct product feedback added four things to this screen at once (nickname,
 * a real spread of skin tones, a preferred squad number, a permanent
 * preferred foot). All of them on one card is a wall of controls on a phone —
 * the old single-card version already ran its own Continue button off the
 * bottom of an iPhone 13 viewport before any of this was added.
 *
 * So step 1 asks two short questions instead of one long one: who he is, then
 * what he looks like and how he plays. The OUTER step machine is untouched —
 * this is still "step 1 of 2", and step 2 (an optional photo, since the
 * division and club pickers were removed) is not restructured here; only the
 * inside of step 1 has a page turn.
 */
type SetupPane = "who" | "style";

export default function ProfileSetup({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pane, setPane] = useState<SetupPane>("who");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [skin, setSkin] = useState<SkinTone>(DEFAULT_SKIN_TONE);
  const [foot, setFoot] = useState<PreferredFoot>(DEFAULT_FOOT);
  const [preferredNumber, setPreferredNumber] = useState(DEFAULT_PREFERRED_NUMBER);
  const [nationality, setNationality] = useState("England");
  const [nationalitySearch, setNationalitySearch] = useState("");
  /**
   * Whether the nationality PICKER is open, as opposed to the answer being
   * shown back.
   *
   * Starts closed, because England starts chosen. Reported directly: "when I
   * actually click on England I want it to just be selected. I don't want it
   * to just be green. It's confusing and the search box is still there, which
   * makes you think that you haven't selected." A list that stays open with a
   * tinted row in it reads as a question still being asked — so choosing one
   * closes the whole thing and the screen shows the answer with a way to
   * change it.
   */
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [portrait, setPortrait] = useState<string | undefined>(undefined);
  // Scrolled to your own default nationality once, on mount — reported
  // directly: alphabetical means "Afghanistan, Albania, Algeria..." greets
  // you first, when the one actually pre-selected (England) is several
  // screens of scrolling away. The order stays alphabetical; only the
  // starting scroll position changes.
  const nationalityListRef = useRef<HTMLDivElement>(null);
  const selectedNationalityRef = useRef<HTMLButtonElement>(null);
  const filteredNationalities = useMemo(() => {
    const q = nationalitySearch.trim().toLowerCase();
    if (!q) return ALL_NATIONALITIES;
    return ALL_NATIONALITIES.filter(n => n.toLowerCase().includes(q));
  }, [nationalitySearch]);

  // Land the nationality list on the one already picked, not on the top of
  // the alphabet — see the refs' own doc. Manual scrollTop rather than
  // `scrollIntoView`, which would also drag the whole page's scroll
  // position along with it.
  //
  // Measured off getBoundingClientRect, NOT offsetTop. `offsetTop` is relative
  // to the nearest POSITIONED ancestor, and this scroll container isn't one —
  // measured in a real browser, the button's offsetParent is the page body, so
  // England reported offsetTop 2544 when its true position inside the list was
  // 1952. The list scrolled 592px too far (its own distance down the page) and
  // landed on Greece/Grenada/Guadeloupe — meaning this whole effect, added to
  // fix "Afghanistan greets you first", had never actually worked.
  //
  // Adding `relative` to the container would also fix it, but this way the
  // maths stays correct no matter what CSS anybody later puts on the wrapper.
  //
  // Keyed to the picker OPENING rather than to mount, now that it starts
  // closed — there is no list in the DOM to scroll until then.
  useEffect(() => {
    if (!nationalityOpen) return;
    const list = nationalityListRef.current;
    const selected = selectedNationalityRef.current;
    if (!list || !selected) return;
    list.scrollTop =
      selected.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
  }, [nationalityOpen]);

  const canProceedWho = firstName.trim().length > 0 && lastName.trim().length > 0 && !nationalityOpen;

  const chooseNationality = (n: string) => {
    setNationality(n);
    // Both of these, together, are the fix: the answer is kept AND the
    // question is put away. Clearing the search matters as much as closing
    // the list — a search box still holding "eng" is the other half of what
    // read as unconfirmed.
    setNationalitySearch("");
    setNationalityOpen(false);
  };

  const bumpNumber = (delta: number) =>
    setPreferredNumber((n) => clampSquadNumber(n + delta));

  const submit = () => {
    onComplete(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: STARTING_AGE,
        skinTone: skin,
        // ── No club, because nobody has signed him ──
        //
        // The honest answer for a trialist, and the one the rest of the game
        // already expects: `hasClub` (calendar.ts) is the established test for
        // "no club yet", `kitsOf("")` hands back its own NEUTRAL green rather
        // than borrowing somebody else's colours, and `listSaveSlots`
        // (storage.ts) already refuses to print a club name for an unsigned
        // save. A real club name arrives in `attachClub`, from the offer the
        // player accepts.
        club: "",
        clubBadge: null,
        position: DEFAULT_POSITION,
        nationality,
        startYear: STAR_FIFA_YEAR,
        preferredNumber,
        preferredFoot: foot,
        // Omitted rather than stored empty, so "has no nickname" is one state
        // and not two — `displayName` only has to check truthiness.
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        ...(portrait ? { portrait } : {}),
      },
      // ── The two arguments a club used to answer, and what they mean now ──
      //
      // `clubs` was the chosen division's club list, and the only thing the
      // page does with it is `externalClubsFor(clubs)` — "fetch every squad in
      // the world EXCEPT my own division's". An unsigned player has no
      // division, so nothing is excluded: the whole world is external until a
      // club signs him, and his own division's squads are fetched properly by
      // the scout-offer screen's own `fetchLeagueSquads(clubsForDivision(...))`
      // the moment one does.
      [],
      // A placeholder, and it always was on this path: `makeIdentity` stores it
      // on a career with no league and no fixtures, and `attachClub` overwrites
      // it outright with the accepted offer's own division. "premier" is what
      // both of their own defaults already are, so this changes nothing.
      "premier",
    );
  };

  const flag = getFlagUrl(nationality);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold tracking-widest uppercase">
            Star Career
          </div>
          <h1 className="mt-1.5 text-xl font-black text-white leading-tight">
            {step === 1 ? (pane === "who" ? "Who are you?" : "Your style") : "Your photo"}
          </h1>
          <div className="mt-1 text-[11px] text-emerald-300 font-bold">
            Step {step} of 2
            {step === 1 && (
              <span className="text-emerald-400/70"> · {pane === "who" ? "your details" : "your style"}</span>
            )}
          </div>
        </div>

        {step === 1 && pane === "who" && (
          <div className="bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-600 rounded-2xl p-4 shadow-xl">
            {/* Side by side — two half-width fields instead of two full-width
                ones is a whole row of vertical space back, and a first and last
                name read as one thing anyway. */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1 text-center">First name</div>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-white text-black text-center font-bold py-2.5 rounded-lg outline-none"
                  maxLength={20}
                />
              </label>
              <label className="block">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1 text-center">Last name</div>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-white text-black text-center font-bold py-2.5 rounded-lg outline-none"
                  maxLength={20}
                />
              </label>
            </div>

            <label className="block mt-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1 text-center">
                Nickname <span className="text-emerald-400/60">· optional</span>
              </div>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="What the fans call you"
                className="w-full bg-white text-black text-center font-bold py-2.5 rounded-lg outline-none placeholder:font-normal placeholder:text-black/40"
                maxLength={20}
              />
              <div className="mt-1 text-center text-[10px] font-bold text-white/60">
                Used instead of your name on the team sheet and in commentary.
              </div>
            </label>

            <div className="mt-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1 text-center">Nationality</div>

              {!nationalityOpen && (
                /* The answer, not the question. One row: the flag, the
                   country, a tick, and an obvious way to change it. */
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 shadow-lg shadow-emerald-900/40">
                  {flag && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flag} alt="" className="h-[13px] w-5 shrink-0 rounded-[1px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-left text-base font-black text-white">{nationality}</span>
                  <span className="shrink-0 text-lg font-black text-white">✓</span>
                  <button
                    onClick={() => setNationalityOpen(true)}
                    className="shrink-0 rounded-lg bg-emerald-900/50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-emerald-900/80"
                  >
                    Change
                  </button>
                </div>
              )}

              {nationalityOpen && (
                <div>
                  <input
                    value={nationalitySearch}
                    onChange={(e) => setNationalitySearch(e.target.value)}
                    autoFocus
                    placeholder={`Search ${ALL_NATIONALITIES.length} nationalities…`}
                    className="w-full bg-white text-black text-center font-bold py-2.5 rounded-lg outline-none placeholder:font-normal placeholder:text-black/40"
                  />
                  <div ref={nationalityListRef} className="mt-1.5 max-h-44 overflow-y-auto rounded-lg bg-gray-800/60">
                    {filteredNationalities.length === 0 && (
                      <div className="px-3 py-3 text-center text-xs font-bold text-white/60">No match.</div>
                    )}
                    {filteredNationalities.map((n) => {
                      const f = getFlagUrl(n);
                      return (
                        <button
                          key={n}
                          ref={n === nationality ? selectedNationalityRef : undefined}
                          onClick={() => chooseNationality(n)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition ${
                            nationality === n ? "bg-emerald-500 text-white" : "text-white/85 hover:bg-gray-700"}`}
                        >
                          {f && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f} alt="" className="h-[11px] w-4 shrink-0 rounded-[1px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" />
                          )}
                          <span className="truncate">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => { setNationalitySearch(""); setNationalityOpen(false); }}
                    className="mt-1.5 w-full rounded-lg bg-gray-700 py-2 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-gray-600"
                  >
                    Keep {nationality}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && pane === "style" && (
          <div className="bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-600 rounded-2xl p-4 shadow-xl">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1.5 text-center">Skin tone</div>
              <div className="grid grid-cols-4 gap-2">
                {SKIN_TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSkin(t.id)}
                    aria-label={t.label}
                    title={t.label}
                    className={`h-11 rounded-lg border-2 transition ${
                      skin === t.id ? "border-white ring-2 ring-emerald-300" : "border-black/30"}`}
                    style={{ background: t.hex }}
                  >
                    {skin === t.id && <span className="text-lg font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1.5 text-center">Preferred foot</div>
              <div className="grid grid-cols-2 gap-2">
                {(["left", "right"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFoot(f)}
                    className={`rounded-xl py-3 text-sm font-black uppercase tracking-wide transition ${
                      foot === f ? "bg-emerald-500 text-white ring-2 ring-emerald-300" : "bg-gray-800 text-white/70 hover:bg-gray-700"}`}
                  >
                    {f === "left" ? "Left" : "Right"}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-center text-[10px] font-bold text-white/60">
                Permanent — you can&apos;t change this later.
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1.5 text-center">Preferred squad number</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bumpNumber(-1)}
                  disabled={preferredNumber <= MIN_SQUAD_NUMBER}
                  className="h-12 w-14 shrink-0 rounded-xl bg-gray-800 text-2xl font-black text-white transition hover:bg-gray-700 disabled:opacity-30"
                >
                  −
                </button>
                <div className="flex h-12 flex-1 items-center justify-center rounded-xl bg-white text-3xl font-black tabular-nums text-black">
                  {preferredNumber}
                </div>
                <button
                  onClick={() => bumpNumber(1)}
                  disabled={preferredNumber >= MAX_SQUAD_NUMBER}
                  className="h-12 w-14 shrink-0 rounded-xl bg-gray-800 text-2xl font-black text-white transition hover:bg-gray-700 disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <div className="mt-1 text-center text-[10px] font-bold text-white/60">
                A preference, not a promise — you&apos;ll wear what the club gives you until you&apos;ve earned it.
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 is the photo, and that is all that is left of it ──

            Checked rather than assumed: with the division tabs and the club
            list gone, this step still holds `PortraitPicker`, which is the
            single BIGGEST control in the whole of setup (a 64px treated tile,
            two buttons, a seven-face grid, and a 224px crop stage once a file
            is chosen). It is not thin enough to fold into the style pane —
            that pane already carries the skin tones, the foot and the squad
            number, and step 1 was split into two panes in the first place
            because it overflowed an iPhone 13. So the outer step machine stays
            exactly as it was, two steps; only what step 2 ASKS has changed.

            It no longer waits for a club to be picked before it appears, and
            it no longer previews against one. `kitsOf("")` is the NEUTRAL kit
            (kits.ts) — a plain green trialist's bib — which is the honest
            thing to show somebody nobody has signed. */}
        {step === 2 && (
          <div className="bg-gradient-to-b from-emerald-800 to-emerald-900 border border-emerald-600 rounded-2xl p-4 shadow-xl">
            {/* No grey header bar here. The one the club list used to sit under
                said "Choose Your Club" directly beneath a page heading reading
                "Choose your club", and the same bar saying "Your Photo" under
                "Your photo" measured 11px of the Start Career button off the
                bottom of an iPhone 13 — the exact overflow step 1 was split in
                two to avoid. */}
            <p className="mb-3 text-center text-[11px] font-bold leading-snug text-white/70">
              Optional. Nobody has signed you yet, so this is shown in a plain trialist&apos;s
              kit — you&apos;ll wear a club&apos;s colours once one comes in for you.
            </p>
            <PortraitPicker
              value={portrait}
              onChange={setPortrait}
              // No club, so no club colours. See kitsOf's NEUTRAL.
              club=""
              // The number chosen a pane ago, so the shirt preview is HIS
              // shirt rather than the hardcoded 9 this used to fall back to.
              number={preferredNumber}
            />
          </div>
        )}

        <div className="flex gap-3 mt-4">
          {(step === 2 || pane === "style") && (
            <button
              onClick={() => (step === 2 ? setStep(1) : setPane("who"))}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-black transition"
            >
              ← Back
            </button>
          )}
          {step === 1 && pane === "who" && (
            <button
              onClick={() => setPane("style")}
              disabled={!canProceedWho}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black transition disabled:opacity-40"
            >
              Continue →
            </button>
          )}
          {step === 1 && pane === "style" && (
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black transition"
            >
              Continue →
            </button>
          )}
          {step === 2 && (
            <button
              onClick={submit}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black transition"
            >
              ✓ Start Career
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
