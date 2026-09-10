# Star Career — Sponsorship Idea Bank (Brainstorm)

> Not implemented yet. Pure idea bank, captured so it survives context resets —
> see `CLAUDE.md` → "What Needs Improvement" for the pointer back here, the
> same way `STAR_LIFE_EVENTS.md` is for the life-events brainstorm.
> Requested: every plausible type of sponsorship a real footballer picks up —
> categories, one-off milestone deals, and the mechanics around how a deal is
> won, kept, or lost — deep enough to build against directly, not a shallow
> list.
>
> **All brand names below are invented for this document.** None of them are
> real companies — they're placeholders in the style this game already uses
> (`lib/star/sponsors.ts`'s categories are generic nouns — "Boots", "Watch",
> "Car" — not brand names at all yet). Anyone building this should keep
> inventing fictional names, never a real one.
>
> The existing system this extends is `lib/star/sponsors.ts`: a
> `SponsorRequirement` per category (`fame` floor + `extra` condition +
> `baseFee` + `describe`), a `SponsorDeal` on `CareerState.sponsors` once
> signed, and an `objective` (goals/assists/appearances/starMan/rating target)
> attached the moment it activates. Ten categories exist today: Boots, Sports
> Drink, Food, Sports Clothing, Casual Clothing, Electronics, Cosmetics,
> Watch, Jewelry, Car. Everything below is either a new CATEGORY in that same
> shape, a one-off MILESTONE deal that doesn't fit the ongoing-relationship
> model at all, or a MECHANIC idea for how deals are won/kept/lost that the
> current system doesn't have yet.

---

## Mechanic types (borrowed from `STAR_LIFE_EVENTS.md`, same meaning here)

- **[ONGOING]** — fits the existing `SponsorRequirement`/`SponsorDeal` shape
  directly: a fame floor, a real condition, a season fee, an objective.
- **[ONE-OFF]** — a single lump-sum moment tied to a specific achievement,
  not an ongoing relationship with a season fee or an objective to chase.
- **[CHOICE]** — the player picks between options with a real trade-off.
- **[WHEEL]** / **[COIN]** — same non-decision mechanics as the life-events
  doc; a sponsor offer can resolve as a spin or a flip instead of a menu.

---

## New categories — grounded, performance-first **[ONGOING]**

More brands that care what you've actually done on the pitch, same spirit
as Boots/Sports Drink today.

### Gloves — *Ironhand*
For goalkeepers specifically (currently nothing in the sponsor list is
position-gated at all). Fame low, `extra`: a clean-sheet count this season.
Fictional brand: **Ironhand Gloves**.

### Shin Pads / Base Layers — *Kinetic*
A cheap, early, almost-guaranteed first deal for anyone who's started
matches — deliberately easier than Boots, so a squad player who isn't
scoring yet still has SOMETHING to sign. Fictional brand: **Kinetic
Baselayer**.

### Headphones / Audio — *Loudline*
`extra`: a Fans relationship threshold, same family as Sports Clothing —
cares about the walk-out-tunnel image, not output. Fictional brand:
**Loudline Audio**.

### Supplements / Recovery — *Forma*
`extra`: appearances AND a fitness/energy-adjacent stat if one exists by
the time this is built (the CLAUDE.md future-work energy system would be a
natural fit: reward LOW time lost to injury/fatigue). Fictional brand:
**Forma Recovery**.

### Football Video Game — *Kickoff League*
`extra`: star rating crosses a threshold — the in-universe equivalent of
"good enough to be a cover-adjacent name," without literally naming a real
game. Fictional brand: **Kickoff League**.

---

## New categories — fame-and-lifestyle brands **[ONGOING]**

More of the vanity-brand family Cosmetics/Watch/Jewelry/Car already cover,
filling out the "how a star actually spends and is seen" picture.

### Fashion House — *Meridian*
Above Casual Clothing in fame requirement — a proper high-fashion
ambassador deal, `extra`: Fans AND a lifestyle-score floor together (the
only category currently gated on both fan approval and spending). Fictional
brand: **Meridian**.

### Fragrance / Cologne — *Solace*
Classic "your own signature scent" deal, mid-fame, `extra`: pure fame
alone (no lifestyle or stat condition) — the one category that's really
just "you're famous enough to put your face on a bottle." Fictional brand:
**Solace**.

### Airline — *Northwing*
High fame, `extra`: club ambition Title/Europe (same shape Car already
uses) — the frequent-flyer, "sponsored by the airline that flies your
club to away legs" deal. Fictional brand: **Northwing Airways**.

### Bank / Fintech — *Meridian Pay* (unrelated to the fashion house above
— a deliberate in-universe coincidence a flavor-text writer could use)
`extra`: lifestyle score AND at least one season with no lapsed sponsor
(cares about "financially reliable" image). Fictional brand: **Vaultline**.

### Hotel Chain — *Aurelia Collection*
`extra`: appearances in Europe specifically once continental competitions
are tracked per-competition at the sponsor layer — "the away-trip loyalty
deal." Fictional brand: **Aurelia Collection**.

### Coffee — *Roast & Co* deal
Cheap, high-fame-floor-but-low-everything-else deal explicitly designed as
a "sixth or seventh deal a genuine superstar picks up almost automatically"
— a lot of real elite players have one absurdly minor deal alongside the
huge ones. Fictional brand: **Roast & Co**.

---

## Regional / international flavor **[ONGOING / ONE-OFF]**

Real footballers' sponsor books usually include at least one deal specific
to their home country or the league they play in, which nothing here does
yet.

### Homeland Ambassador — *[Nation]'s Own*
`extra`: full international caps for your nation reach a threshold —
literally "the brand that's proud a countryman made it." Scales fee by
how big a footballing nation it is (a made-up per-nation multiplier table,
same idea as `AMBITION_FEE_MULT`). Fictional brand: a templated name like
**Cascadia Dairy** (invented per-nation, never a real one).

### League-Specific Deal **[ONGOING]**
A deal that's only ELIGIBLE while playing in a specific division — e.g. a
category that only appears in the Sponsors screen while you're in the top
flight, deactivating (not lapsing, no penalty) if you're relegated, since
its whole pitch is "faces of this league." Distinct from an existing deal
lapsing for missing an objective — this one just isn't for sale outside
that league at all.

### Transfer-Triggered Welcome Deal **[ONE-OFF]**
The moment you join a genuinely big club (ambition Title/Europe, or a
specific "superclub" tier if one gets defined), a one-off signing bonus
fires automatically — separate from any ongoing category — modeling the
real "boot deal renegotiates a signing fee the moment you move" beat.

---

## Milestone / one-off deals **[ONE-OFF]**

None of these are ongoing relationships with a season fee — each is a
single lump sum (and maybe a fame bump) the moment a real, specific thing
happens, closer in shape to a `STAR_LIFE_EVENTS.md` GUARANTEED beat than to
`signSponsor`.

- **First senior goal** — a small brand (bootmaker, local business) sends a
  one-off bonus + a framed shirt request; pure flavor money, tiny.
- **Hat-trick ball / man-of-the-match ball auctioned** — a real one-off
  payout tied to a specific match stat line, distinct from the season-long
  Boots objective.
- **Full international debut** — a bigger one-off than the domestic
  milestones above, plus unlocks the Homeland Ambassador category above if
  it wasn't eligible before.
- **Hitting a big star-rating threshold for the first time** (e.g. crossing
  into "world class" on whatever scale the game settles on) — a
  "recognition" bonus from an existing sponsor (if you have one) on top of
  unlocking new categories, modeling a real brand's kicker-clause for a
  breakout season.
- **Ballon d'Or nomination / win** (the game already has a Ballon d'Or
  engine — `lib/ballonDorEngine.ts`) — the single biggest one-off payout in
  the game, from whichever category you're already signed to if any, plus
  unlocks a "legacy" tier category that wasn't reachable before.
- **Testimonial match** — very late-career only, a genuine one-off event
  (could double as a `STAR_LIFE_EVENTS.md`-style COIN on whether it's a
  well-attended send-off or an awkward half-empty one) with a real payout
  either way.
- **Century of appearances for one club** — loyalty-flavored one-off bonus,
  deliberately NOT tied to any brand — this one's from the club itself, not
  a sponsor, as a contrast beat.
- **Top scorer in your division** — end-of-season one-off from your boot
  deal specifically if you have one active (a real Boots deal that stayed
  quiet all season suddenly pays out big), otherwise a "we should have
  signed him" news beat with no money attached.
- **Viral moment sponsorship** — after a `STAR_LIFE_EVENTS.md`-style viral
  event (a great celebration, a funny interview moment) fires, a WHEEL
  decides whether a brand actually reaches out off the back of it, and if
  so which category — modeling the "internet-famous for a day, and a brand
  noticed" beat as a genuine consequence of an unrelated system.

---

## Deal mechanics beyond fee + objective **[design ideas, various]**

The current model (fame floor, one condition, a season fee, an objective)
is a single fixed shape. Real sponsorships have more texture than that:

### Bidding war **[CHOICE]**
Two brands in the SAME category both want you at once — a real trade-off
rather than "sign the only option": one offers more money with a harder
objective, the other less money with an easier one, or one is a young
"growth" brand offering equity-like upside (bigger LATER bonus, smaller fee
now) against an established brand's flat, safe, smaller-upside deal.

### Exclusivity clause **[design idea]**
Signing one deal in a category should arguably lock out every OTHER brand
in that category until it lapses or ends — the current code lets nothing
stop you from re-signing a fresher Boots deal the instant an old one lapses
with no cooldown or loyalty cost, which a real contract wouldn't allow.

### Rival poaching **[CHOICE, can recur]**
Mid-deal, a rival brand in the same category offers to buy you out of your
current contract — take the buyout (guaranteed money now, angry ex-sponsor,
maybe a standing hit with anyone who talks to them) or stay loyal (nothing
changes, but the loyalty could pay off later as a renewal bonus).

### Scandal-by-association **[GUARANTEED trigger, ONE-OFF penalty]**
A signed brand itself gets caught in a real-world-style scandal (nothing to
do with you) — you don't get a choice, the deal is just over, plus a small
fame hit for "being the face of that." A genuinely unfair, un-gameable beat
in the same spirit as `STAR_LIFE_EVENTS.md`'s hidden-delayed-consequence
design notes — the anxiety is that it can happen to a deal you did nothing
wrong to keep.

### Renewal roulette **[WHEEL]**
Already sketched once in `STAR_LIFE_EVENTS.md` ("Boot deal renewal
roulette") — worth cross-referencing here since it's really a SPONSOR
mechanic that document filed under events: every few seasons, an active
deal's renewal terms are randomized across a real range instead of just
reapplying `sponsorFee` — small bump, big bump, flat, or dropped entirely,
found out by watching the spin, not negotiated.

### Brand-flavored objectives **[design idea]**
`makeObjective` currently picks from the same five generic kinds
(goals/assists/appearances/starMan/rating) regardless of which brand asked
— a boots deal and a watch deal chase an identical-shaped target today.
Real brand personality could pick the kind: a boot brand cares about goals
and assists, a watch brand about a single "iconic moment" (starMan award),
a clothing brand about appearances (being SEEN, not necessarily scoring).

### Youth "growth" deal **[ONGOING, low floor by design]**
A category explicitly reachable at LOW fame — a "we're betting on you
early" deal from a brand explicitly built as a growth-stage sponsor
(smaller fee than Boots, but its own objective bonus scales unusually
steeply with your CURRENT fame at completion, rewarding whoever grew with
you rather than whoever was already big when they signed you).

### Comedic small-scale deal **[ONE-OFF, flavor]**
A tiny, funny, deliberately unglamorous local-business sponsorship —
a hometown takeaway, a local car wash — offered once as pure flavor/texture
alongside the serious brands, the sponsorship equivalent of
`STAR_LIFE_EVENTS.md`'s "smaller, high-frequency flavor events" section.
Explicitly NOT meant to be a real income category, just a moment that makes
the world feel textured.

---

## Design notes for whenever this gets built

- The current ten categories are ALL either performance-gated or
  lifestyle-gated — nothing is gated on FAN approval alone except Sports/
  Casual Clothing, and nothing is gated on NATIONALITY, LEAGUE, or POSITION
  at all. Those three axes (position, nation, league) are the biggest gap
  versus how real sponsor books actually look, and are where most of the
  new-category ideas above sit.
- `SponsorRequirement.extra` already takes the whole `CareerState`, so
  every idea above (position, nation caps, league membership, lifestyle
  combinations) is reachable without changing the interface — this is
  additive to the existing shape, not a rework of it.
- The one-off milestone deals are a genuinely different shape from
  `SponsorDeal` (no season fee, no lapsing, no ongoing objective) — closest
  existing precedent is `STAR_LIFE_EVENTS.md`'s GUARANTEED events, so
  building these as life-events that happen to pay through the sponsors
  system (rather than as new fields on `SponsorDeal`) is probably the
  smaller change.
- Recommend starting with 2-3 new ONGOING categories that use an axis the
  current ten don't (Gloves for position-gating, Homeland Ambassador for
  nation-gating) to prove the additive approach out, before tackling the
  bigger mechanic ideas (bidding wars, exclusivity, scandal-by-association)
  which touch more of the signing/lapsing flow.
