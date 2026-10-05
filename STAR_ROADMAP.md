# Road to Ballon d'Or — revamp roadmap

Mikey, 4 Oct 2026. What still needs a revamp (or building properly), in the
order it will happen: soonest first. **Base game** comes first; the
ambitious projects come after it. Update this file whenever a revamp starts,
finishes, or changes place. Done revamps so far: economy and fame (v0.1),
energy (v0.2), training (v0.4), selection (v0.5), shop levels (v0.6), star
rating and XP (v0.7, v0.9), sponsors (v0.8), club data, the 3D garden.

## Now — the whole team

0. **The match engine** — the most urgent thing for the group. Harry and Leo
   lead it.

## Next — base game

1. **Relationships and the relationship games.** BUILT 4 Oct 2026, waiting
   for Mikey's review. Bars move slowly (6.0-6.6 moves nothing, harder near
   100, drift to the middle), happiness decides how much energy rest gives
   back, the Sponsors bar is gone, and each relationship has its own game:
   Talk to your manager, Woodwork challenge, Signing session, Day off, and
   Shoot an advert on the Sponsors screen. Plan:
   patch-notes/mikey/plans/relationships.html.
   5 Oct 2026, after Mikey's review: happiness is now the average of boss,
   team and fans (no Day off game, no row on Relations, Rest and shop items
   no longer lift it); the boss talk has a hidden mood read from his opener
   (85% / 45% / 10%), and the signing session is much harder.
2. **Transfers, for your own player.** Today you get three offers at the end of
   a season, or you stay. You can't choose a league or a club you want. Also
   the contract negotiation card game (higher or lower) can be worked on.
3. **Money balance after Sponsors.** Wages were set on 21 Sep, before weekly
   sponsor fees and the new shop prices. Check money across a whole career.
4. **Achievements and records filled out.** Add and fill them; set their XP in
   the XP Book (/admin/star-xp). Can keep growing after the base game.
5. **Star Pass rewards for every level.** Not a revamp: decide what you get at
   each level and make the rewards.
6. **Retirement and the end of a career.** Must be in the base game. Nobody
   knows how it works or looks now: look at it first, then rebuild.
7. **Awards and Ballon d'Or ceremonies** (near the end of the base game). A
   real ceremony: your player walks up, a famous player hosts and calls the
   winner up, the final three on podiums. Today it is text that pops up.
8. **International career** (near the end of the base game). A huge job: it
   was never properly added. Call-ups and caps exist; nothing else.
9. **The after-match card** — Mikey to look at it. He likes the star bar
   filling with no XP numbers.
10. **Shop pictures** — make professional pictures (Higgsfield image gen), one
    style across all 155 shop levels.

## After the base game

11. **Injuries.** Switched off on 4 Oct 2026 (`lib/star/injurySwitch.ts`,
    INJURIES_ON) until they are revamped. The old roll, countdown and
    "Injured" selection rule are kept, ready to switch back on.
12. **Ownership and Power & Politics.** Built in one sitting and never played
    on a screen; needs a proper revamp.
13. **Weather that changes the ball.** Wind that bends the ball, rain that
    makes it skid faster, normal days. Today weather is only the look.
14. **A 3D casino you walk round**, like the 3D shop and garden.
15. **Ride your horse in the garden.**
16. **Dilemmas and life events.** Switched off now. Idea bank:
    `STAR_LIFE_EVENTS.md`.
17. **Press conferences.** Switched off now; the screen still exists.
18. **Partner, family and agent.** Not in the game.

## Not needed

- **Fan mail** (`lib/star/fanmail.ts`, 7 Aug 2026): never shown on any screen
  now; the social feed replaced it. Safe to delete.
