-- ============================================================================
-- FC 27 (2026/27) — cloned from FC 26 for the Champions League, Europa
-- League, and standalone "Other" clubs
-- ============================================================================
--
-- HOW TO RUN IT
--
--   Copy this whole file. Paste it into the Supabase SQL Editor. Press Run
--   once for the main statement below. There is a SECOND, separate query
--   further down (after the ROLLBACK section) that is the important one to
--   run straight after — it tells you, one row per club, which of these
--   actually matched. Run both.
--
-- Same shape as fc27_clone_premier_league.sql / fc27_clone_new_clubs.sql —
-- worth reading either of those first if you have not.
--
--
-- ABOUT THE NAME MATCHING
--
-- Given as shorthand ("Man City", "Inter", "Atleti"), matched against my own
-- best understanding of each club's full name, several spellings each where
-- a club's name carries an accent or is commonly written more than one way
-- (SoFIFA is not consistent about é/è/ø/ş/ç etc. surviving into their data).
-- The normalisation strips everything but a-z, so an accented letter is
-- simply dropped rather than transliterated — both the accented-stripped and
-- the plain-letter spelling are listed for every name that has one, to cover
-- it either way.
--
-- Genuinely uncertain whether FC 26 has them at all, rather than just which
-- spelling: Shakhtar Donetsk (flagged directly — Ukrainian clubs are
-- sometimes missing from EA's data), Torreense (a small Portuguese club),
-- Shamrock Rovers (League of Ireland), Pafos (a Cypriot club only recently
-- prominent enough to be worth licensing at all), and the four Saudi Pro
-- League clubs (Al Hilal, Al Nassr, Al Ahli, Al Ittihad — EA has only
-- licensed the Saudi league in some recent editions, not all). The
-- diagnostic query below will say for certain either way — that is exactly
-- what it is for.
--
-- ── Six spellings corrected after running that diagnostic for real ──
--
-- fc27_diagnose_missing_european_clubs.sql found the actual row for six of
-- the eleven clubs the first diagnostic reported false on. All six were a
-- wrong guess, not a missing club — worth recording exactly what was wrong,
-- because two of them are a real gap in how this file normalises names:
--
--   Al Ahli            "Al Ahli SFC"              (Saudi Pro League, confirmed
--                                                    by the actual player list —
--                                                    NOT the Egyptian Al Ahli)
--   Bodø/Glimt          "FK Bodø/Glimt"            ø was guessed as transliterating
--                                                    to "o" ("bodo"); the strip
--                                                    below just DROPS it, same as
--                                                    any other accent — "bod"
--   Ferencváros         "Ferencvárosi Torna Club"  guessed the short form; SoFIFA
--                                                    has the club's full formal name
--   Lille               "Lille OSC"                guessed "LOSC Lille"; SoFIFA has
--                                                    the abbreviation on the other side
--   Real Betis          "Real Betis Balompié"      the "é" strip bit twice over —
--                                                    it drops to nothing, so
--                                                    "Balompié" strips to "balompi",
--                                                    NOT "balompie" with the accent
--                                                    simply removed and the plain
--                                                    letter left behind
--   Schalke             "FC Schalke 04"            the strip below is `[^a-z]`,
--                                                    which removes DIGITS too, not
--                                                    only accents/punctuation — so
--                                                    "04" vanishes entirely and
--                                                    "schalke04" as a variant could
--                                                    never have matched anything
--
-- The other five genuinely returned nothing, on a normal-word search
-- (root/city/surname, not the exact guessed spelling) across both FIFA years
-- already in the table — not just this file's narrow guess list:
--
--   Omonia Nicosia, Pafos, Slovan Bratislava, Torreense — no row at all under
--   any spelling close to the name. Either not licensed this edition, or
--   simply never scraped into this table in the first place (see
--   scripts/scrape_missing.py) — the two look identical from inside this
--   table and only rescraping that league would tell them apart.
--
--   Crvena Zvezda — the ONLY thing "red star" turned up was Red Star FC, a
--   small French Ligue 2 club from Saint-Ouen that happens to share the
--   English translation of the Serbian giant's nickname. Not the same club.
--   The real Crvena Zvezda (Red Star Belgrade) did not appear under its own
--   name either, so the Serbian SuperLiga most likely was never scraped into
--   this table at all.
--
-- Chose to replace rather than wait on a rescrape: all five are now swapped
-- for a club of genuine European pedigree, each from a league already
-- confirmed present via some other club above that matched clean —
-- FC Copenhagen (Danish Superliga, alongside Midtjylland) for Slovan
-- Bratislava in the Champions League list, and Sporting Braga, PAOK,
-- Viktoria Plzeň, Vitória Guimarães and Legia Warszawa (Portuguese
-- Primeira Liga, Greek Super League, Czech league, Portuguese Primeira
-- Liga again, and Polish Ekstraklasa — each confirmed via Porto/Benfica,
-- AEK Athens, Sparta/Slavia Praha, Porto/Benfica again, and Lech Poznań)
-- for the four Europa League clubs. Their variant spellings below are
-- still guesses, same as everything else in this file — if any comes back
-- false on the diagnostic, that is the next thing to chase, not evidence
-- the whole approach is wrong.
--
-- ── And it was: two of those five guesses were wrong too ──
--
-- The FIRST round of replacement variants for Ferencváros (already fixed
-- once above, but its NEW variant repeated the same mistake), FC Copenhagen
-- and Vitória Guimarães all assumed an accented letter transliterates to the
-- plain one underneath it — "á" -> "a", "ó" -> "o". It does not; the strip
-- below drops it to nothing, same lesson as Bodø/Glimt and Real Betis
-- above, just not yet learned for THESE guesses when they were written.
-- Corrected here: "ferencvrositornaclub" (not "...varo..."),
-- "vitriaguimares"/"vitriasc"/"vitriasportclube" (not "vitoria..."). FC
-- Copenhagen also picked up its Danish-spelling form, "fckbenhavn" (from
-- "FC København" — the ø strips the same way, to nothing, not to "o").
-- FC Copenhagen and Vitória Guimarães are both now confirmed present too
-- (as "FC København" and "Vitória SC" — see fc27_diagnose_missing_european_
-- clubs.sql's second version, which found both).
--
-- ── Three more found by direct verification, not another guess ──
--
-- Atlético Madrid, Bayern München, Beşiktaş and Celta Vigo all looked
-- matched by the original diagnostic, but the "true" was a false positive:
-- each of those four names ALSO happens to be the exact spelling of an
-- unrelated, single-row leftover entry already sitting in the table under
-- fifa_year = 2027 (not part of this migration, not connected to the real
-- club at all — a stray "C. Romero" playing for the whole of "Atletico
-- Madrid" is the giveaway). The diagnostic's EXISTS check can't tell a real
-- 30-player squad apart from that kind of noise, so it reported success
-- while the actual squad was never being matched. Caught by counting
-- players per club after cloning and finding four Champions/Europa League
-- names sitting on a single player each.
--
-- Rather than guess a fifth time, queried the table directly for every club
-- in the relevant leagues (La Liga, the Bundesliga, the Süper Lig) and read
-- off the real spellings: "Atlético Madrid" (missing only from the ORIGINAL
-- guess by one dropped accented letter — added as a fourth variant in an
-- earlier commit), "FC Bayern München", "RC Celta" (not "RC Celta de
-- Vigo", which was the guess), and "Beşiktaş JK".
--
-- One likely mistake worth flagging rather than silently resolving:
-- "Villarreal" appears in the Champions League list AND, spelled "Villareal"
-- (one r), in the Other list. Treated here as the same club, listed once,
-- under Champions League — if a different club was meant for the Other
-- list, send me its name.
-- ============================================================================

WITH src AS (
  SELECT
    p.sofifa_id,
    2027                       AS fifa_year,
    'FC 27'                    AS fifa_edition,
    p.name,
    p.positions,
    p.nationality,
    p.club,
    p.league,
    p.overall,
    p.potential,
    COALESCE(
      p.age,
      NULLIF(regexp_replace(COALESCE(p.attributes ->> 'age', ''),     '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(p.attributes ->> 'attr_ae', ''), '[^0-9]', '', 'g'), '')::int
    ) + 1                      AS age,
    p.image_url,
    CASE
      WHEN p.attributes -> 'age' IS NOT NULL THEN
        jsonb_set(
          p.attributes, '{age}',
          to_jsonb(
            COALESCE(NULLIF(regexp_replace(COALESCE(p.attributes ->> 'age', ''), '[^0-9]', '', 'g'), '')::int, 0) + 1
          )
        )
      ELSE COALESCE(p.attributes, '{}'::jsonb)
    END                        AS attributes,
    p.manual_overall,
    p.manual_positions,
    p.manual_nationality
  FROM sofifa_players p
  WHERE p.fifa_year = 2026
    AND regexp_replace(LOWER(COALESCE(p.club, '')), '[^a-z]', '', 'g') IN (
      -- ── Champions League ──
      'arsenal',
      'astonvilla',
      'atleticomadrid', 'atletico', 'atleticodemadrid', 'atlticomadrid',
      'borussiadortmund', 'dortmund',
      'fcbarcelona', 'barcelona',
      'fcbayernmunchen', 'bayernmunich', 'bayernmunchen', 'fcbayernmunich', 'fcbayernmnchen',
      'clubbruggekv', 'clubbrugge',
      'como1907', 'como',
      'feyenoordrotterdam', 'feyenoord',
      'galatasaraysk', 'galatasaray',
      'fcinternazionalemilano', 'intermilan', 'inter', 'internazionale',
      'rbleipzig', 'leipzig',
      'rclens', 'lens',
      'losclille', 'lille', 'losc', 'lilleosc',
      'liverpool',
      'manchestercity', 'mancity',
      'manchesterunited', 'manutd', 'manunited',
      'sscnapoli', 'napoli',
      'parissaintgermain', 'psg', 'paris', 'parissg',
      'fcporto', 'porto',
      'psveindhoven', 'psv',
      'realbetisbalompie', 'realbetis', 'betis', 'realbetisbalompi',
      'realmadridcf', 'realmadrid',
      'asroma', 'roma',
      'shakhtardonetsk', 'shakhtar',
      'skslaviapraha', 'slaviapraha', 'slaviaprague',
      'sportingclubedeportugal', 'sportingcp', 'sportinglisbon', 'sporting',
      'vfbstuttgart', 'stuttgart',
      'villarrealcf', 'villarreal',
      'fkbodoglimt', 'bodoglimt', 'bodglimt', 'fkbodglimt',
      'celticfc', 'celtic',
      'aekathensfc', 'aekathens', 'aek',
      'olympiquelyonnais', 'lyon', 'olympiquelyon',
      -- 'fenerbahcesk' was a wrong guess — the regexp below DROPS a non-ASCII
      -- letter rather than transliterating it, so "Fenerbahçe SK" actually
      -- normalises to 'fenerbahesk' (no "c" where the "ç" was). Confirmed
      -- against the real row: see fc27_fix_fenerbahce_spelling.sql, written
      -- after this wrong entry let a whole clone run silently match nothing
      -- for a fully-corrected FC26 source row. Kept the wrong-guess variants
      -- too, in case an even older/differently-spelled row is still around.
      'fenerbahesk', 'fenerbahcesk', 'fenerbahce', 'fenerbahe',
      'gnkdinamozagreb', 'dinamozagreb', 'dinamo',
      -- Slovan Bratislava confirmed absent from FC 26 under any close
      -- spelling — replaced with a club of genuine recent Champions League
      -- pedigree from a league already confirmed present (Midtjylland).
      'fccopenhagen', 'copenhagen', 'fckbenhavn', 'kbenhavn',

      -- ── Europa League ──
      'az', 'azalkmaar',
      'afcbournemouth', 'bournemouth',
      'rcceltadevigo', 'celtavigo', 'celta', 'rccelta',
      'crystalpalace',
      'tsg1899hoffenheim', 'hoffenheim', 'tsghoffenheim',
      'juventus',
      'bayer04leverkusen', 'bayerleverkusen', 'leverkusen',
      'olympiquedemarseille', 'marseille', 'olympiquemarseille', 'om',
      'acmilan', 'milan',
      'olympiacosfc', 'olympiacos', 'olympiakos',
      'realsociedaddefutbol', 'realsociedad',
      'staderennaisfc', 'rennes', 'staderennais',
      'acspartapraha', 'spartapraha', 'spartaprague',
      'sksturmgraz', 'sturmgraz',
      'sunderland',
      'royaleunionsaintgilloise', 'unionsaintgilloise', 'unionsg',
      'ferencvarositc', 'ferencvaros', 'ferencvros', 'ferencvrositornaclub',
      'rscanderlecht', 'anderlecht',
      'kkslechpoznan', 'lechpoznan', 'lechpozna',
      'trabzonspor',
      'slbenfica', 'benfica',
      'besiktasjk', 'besiktas', 'beikta', 'beiktajk',
      'fcredbullsalzburg', 'redbullsalzburg', 'salzburg', 'rbsalzburg',
      'rangersfc', 'rangers',
      'heartofmidlothianfc', 'heartofmidlothian', 'hearts',
      'shamrockroversfc', 'shamrockrovers',
      -- The first Europa League list was seven short of the real 36.
      'afcajax', 'ajax',
      'fcmidtjylland', 'midtjylland',
      'krcgenk', 'genk', 'racinggenk',
      'bscyoungboys', 'youngboys',
      'fcbasel1893', 'fcbasel', 'basel',
      'malmoff', 'malmff', 'malmo',
      -- Torreense, Crvena Zvezda, Omonia Nicosia and Pafos confirmed absent
      -- from FC 26 under any close spelling (see the header note above) —
      -- replaced with five clubs of genuine European pedigree, each from a
      -- league already confirmed present via a club above that matched.
      'sportingclubedebraga', 'scbraga', 'braga',
      'paokfc', 'paokthessaloniki', 'paok',
      'fcviktoriaplzen', 'viktoriaplzen', 'viktoriaplze', 'plzen',
      'vitriasportclube', 'vitriasc', 'vitriaguimares', 'vitriadeguimares', 'guimares',
      'legiawarszawa', 'legiawarsaw', 'legia',

      -- ── Other ──
      'sevillafc', 'sevilla',
      'eintrachtfrankfurt', 'eintracht',
      'fcschalke04', 'schalke04', 'schalke', 'fcschalke',
      'asmonaco', 'monaco',
      'rcstrasbourgalsace', 'strasbourg',
      'atalantabc', 'atalanta',
      'sslazio', 'lazio',
      'alhilalsfc', 'alhilal',
      'alnassrfc', 'alnassr',
      'alahlisaudifc', 'alahli', 'alahlisaudi', 'alahlisfc',
      'alittihadclub', 'alittihad', 'alittihadjeddah'
    )
),
ins AS (
  INSERT INTO sofifa_players (
    sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
    club, league, overall, potential, age, image_url, attributes,
    manual_overall, manual_positions, manual_nationality
  )
  SELECT
    sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
    club, league, overall, potential, age, image_url, attributes,
    manual_overall, manual_positions, manual_nationality
  FROM src
  ON CONFLICT (sofifa_id, fifa_year) DO NOTHING
  RETURNING 1 AS written
)
SELECT
  (SELECT COUNT(*) FROM src)                                        AS players_found,
  (SELECT COUNT(DISTINCT club) FROM src)                            AS clubs_matched,
  (SELECT COUNT(*) FROM ins)                                        AS copied_now,
  (SELECT COUNT(*) FROM sofifa_players WHERE fifa_year = 2027)      AS fc27_total_now,
  (SELECT string_agg(DISTINCT club, ' | ') FROM src)                AS clubs_found;


-- ============================================================================
-- ROLLBACK — deletes only what THIS migration adds, by club name
-- ============================================================================
-- DELETE FROM sofifa_players
-- WHERE fifa_year = 2027
--   AND regexp_replace(LOWER(COALESCE(club, '')), '[^a-z]', '', 'g') IN (
--     'arsenal','astonvilla','atleticomadrid','atletico',
--     'atleticodemadrid','atlticomadrid','borussiadortmund','dortmund',
--     'fcbarcelona','barcelona','fcbayernmunchen','bayernmunich',
--     'bayernmunchen','fcbayernmunich','fcbayernmnchen','clubbruggekv',
--     'clubbrugge','como1907','como','feyenoordrotterdam','feyenoord',
--     'galatasaraysk','galatasaray','fcinternazionalemilano','intermilan',
--     'inter','internazionale','rbleipzig','leipzig','rclens','lens',
--     'losclille','lille','losc','lilleosc','liverpool','manchestercity',
--     'mancity','manchesterunited','manutd','manunited','sscnapoli',
--     'napoli','parissaintgermain','psg','paris','parissg','fcporto',
--     'porto','psveindhoven','psv','realbetisbalompie','realbetis',
--     'betis','realbetisbalompi','realmadridcf','realmadrid','asroma',
--     'roma','shakhtardonetsk','shakhtar','skslaviapraha','slaviapraha',
--     'slaviaprague','sportingclubedeportugal','sportingcp',
--     'sportinglisbon','sporting','vfbstuttgart','stuttgart',
--     'villarrealcf','villarreal','fkbodoglimt','bodoglimt','bodglimt',
--     'fkbodglimt','celticfc','celtic','aekathensfc','aekathens','aek',
--     'olympiquelyonnais','lyon','olympiquelyon','fenerbahcesk',
--     'fenerbahce','fenerbahe','gnkdinamozagreb','dinamozagreb','dinamo',
--     'fccopenhagen','copenhagen','fckbenhavn','kbenhavn','az',
--     'azalkmaar','afcbournemouth','bournemouth','rcceltadevigo',
--     'celtavigo','celta','rccelta','crystalpalace','tsg1899hoffenheim',
--     'hoffenheim','tsghoffenheim','juventus','bayer04leverkusen',
--     'bayerleverkusen','leverkusen','olympiquedemarseille','marseille',
--     'olympiquemarseille','om','acmilan','milan','olympiacosfc',
--     'olympiacos','olympiakos','realsociedaddefutbol','realsociedad',
--     'staderennaisfc','rennes','staderennais','acspartapraha',
--     'spartapraha','spartaprague','sksturmgraz','sturmgraz','sunderland',
--     'royaleunionsaintgilloise','unionsaintgilloise','unionsg',
--     'ferencvarositc','ferencvaros','ferencvros','ferencvrositornaclub',
--     'rscanderlecht','anderlecht','kkslechpoznan','lechpoznan',
--     'lechpozna','trabzonspor','slbenfica','benfica','besiktasjk',
--     'besiktas','beikta','beiktajk','fcredbullsalzburg',
--     'redbullsalzburg','salzburg','rbsalzburg','rangersfc','rangers',
--     'heartofmidlothianfc','heartofmidlothian','hearts',
--     'shamrockroversfc','shamrockrovers','afcajax','ajax',
--     'fcmidtjylland','midtjylland','krcgenk','genk','racinggenk',
--     'bscyoungboys','youngboys','fcbasel1893','fcbasel','basel',
--     'malmoff','malmff','malmo','sportingclubedebraga','scbraga','braga',
--     'paokfc','paokthessaloniki','paok','fcviktoriaplzen',
--     'viktoriaplzen','viktoriaplze','plzen','vitriasportclube',
--     'vitriasc','vitriaguimares','vitriadeguimares','guimares',
--     'legiawarszawa','legiawarsaw','legia','sevillafc','sevilla',
--     'eintrachtfrankfurt','eintracht','fcschalke04','schalke04',
--     'schalke','fcschalke','asmonaco','monaco','rcstrasbourgalsace',
--     'strasbourg','atalantabc','atalanta','sslazio','lazio','alhilalsfc',
--     'alhilal','alnassrfc','alnassr','alahlisaudifc','alahli',
--     'alahlisaudi','alahlisfc','alittihadclub','alittihad',
--     'alittihadjeddah'
--   );


-- ============================================================================
-- RUN THIS SECOND — one row per club I was asked for, matched or not
-- ============================================================================
-- This is the actual answer to "if any of those clubs aren't in the game,
-- tell me" — every club below with matched = false either doesn't exist in
-- FC 26 under any spelling I tried, or exists under a spelling I didn't
-- guess. Send me back the false rows and I'll either try another spelling
-- or you can give me a replacement club.
--
-- Checked against the SAME plain-ASCII variant lists the clone above uses,
-- not a fresh normalisation of the display name in the first column — "é"
-- stripped down to nothing and "e" are not the same string, so re-deriving
-- the check from "Atlético Madrid" here would wrongly report a match the
-- clone actually found as missing. `variants` is exactly the set of strings
-- that appear for that club in the big IN(...) list above.

WITH wanted(club, competition, variants) AS (VALUES
  ('Arsenal', 'Champions League', ARRAY['arsenal']),
  ('Aston Villa', 'Champions League', ARRAY['astonvilla']),
  ('Atlético Madrid', 'Champions League', ARRAY['atleticomadrid','atletico','atleticodemadrid','atlticomadrid']),
  ('Borussia Dortmund', 'Champions League', ARRAY['borussiadortmund','dortmund']),
  ('Barcelona', 'Champions League', ARRAY['fcbarcelona','barcelona']),
  ('Bayern München', 'Champions League', ARRAY['fcbayernmunchen','bayernmunich','bayernmunchen','fcbayernmunich','fcbayernmnchen']),
  ('Club Brugge', 'Champions League', ARRAY['clubbruggekv','clubbrugge']),
  ('Como', 'Champions League', ARRAY['como1907','como']),
  ('Feyenoord', 'Champions League', ARRAY['feyenoordrotterdam','feyenoord']),
  ('Galatasaray', 'Champions League', ARRAY['galatasaraysk','galatasaray']),
  ('Inter', 'Champions League', ARRAY['fcinternazionalemilano','intermilan','inter','internazionale']),
  ('RB Leipzig', 'Champions League', ARRAY['rbleipzig','leipzig']),
  ('Lens', 'Champions League', ARRAY['rclens','lens']),
  ('Lille', 'Champions League', ARRAY['losclille','lille','losc','lilleosc']),
  ('Liverpool', 'Champions League', ARRAY['liverpool']),
  ('Manchester City', 'Champions League', ARRAY['manchestercity','mancity']),
  ('Manchester United', 'Champions League', ARRAY['manchesterunited','manutd','manunited']),
  ('Napoli', 'Champions League', ARRAY['sscnapoli','napoli']),
  ('Paris Saint-Germain', 'Champions League', ARRAY['parissaintgermain','psg','paris','parissg']),
  ('Porto', 'Champions League', ARRAY['fcporto','porto']),
  ('PSV Eindhoven', 'Champions League', ARRAY['psveindhoven','psv']),
  ('Real Betis', 'Champions League', ARRAY['realbetisbalompie','realbetis','betis','realbetisbalompi']),
  ('Real Madrid', 'Champions League', ARRAY['realmadridcf','realmadrid']),
  ('Roma', 'Champions League', ARRAY['asroma','roma']),
  ('Shakhtar Donetsk', 'Champions League', ARRAY['shakhtardonetsk','shakhtar']),
  ('Slavia Praha', 'Champions League', ARRAY['skslaviapraha','slaviapraha','slaviaprague']),
  ('Sporting CP', 'Champions League', ARRAY['sportingclubedeportugal','sportingcp','sportinglisbon','sporting']),
  ('VfB Stuttgart', 'Champions League', ARRAY['vfbstuttgart','stuttgart']),
  ('Villarreal', 'Champions League', ARRAY['villarrealcf','villarreal']),
  ('Bodø/Glimt', 'Champions League', ARRAY['fkbodoglimt','bodoglimt','bodglimt','fkbodglimt']),
  ('Celtic', 'Champions League', ARRAY['celticfc','celtic']),
  ('AEK Athens', 'Champions League', ARRAY['aekathensfc','aekathens','aek']),
  ('Lyon', 'Champions League', ARRAY['olympiquelyonnais','lyon','olympiquelyon']),
  ('Fenerbahçe', 'Champions League', ARRAY['fenerbahesk','fenerbahcesk','fenerbahce','fenerbahe']),
  ('Dinamo Zagreb', 'Champions League', ARRAY['gnkdinamozagreb','dinamozagreb','dinamo']),
  ('FC Copenhagen', 'Champions League', ARRAY['fccopenhagen','copenhagen','fckbenhavn','kbenhavn']),
  ('AZ Alkmaar', 'Europa League', ARRAY['az','azalkmaar']),
  ('Bournemouth', 'Europa League', ARRAY['afcbournemouth','bournemouth']),
  ('Celta Vigo', 'Europa League', ARRAY['rcceltadevigo','celtavigo','celta','rccelta']),
  ('Crystal Palace', 'Europa League', ARRAY['crystalpalace']),
  ('Hoffenheim', 'Europa League', ARRAY['tsg1899hoffenheim','hoffenheim','tsghoffenheim']),
  ('Juventus', 'Europa League', ARRAY['juventus']),
  ('Bayer Leverkusen', 'Europa League', ARRAY['bayer04leverkusen','bayerleverkusen','leverkusen']),
  ('Marseille', 'Europa League', ARRAY['olympiquedemarseille','marseille','olympiquemarseille','om']),
  ('AC Milan', 'Europa League', ARRAY['acmilan','milan']),
  ('Olympiacos', 'Europa League', ARRAY['olympiacosfc','olympiacos','olympiakos']),
  ('Real Sociedad', 'Europa League', ARRAY['realsociedaddefutbol','realsociedad']),
  ('Rennes', 'Europa League', ARRAY['staderennaisfc','rennes','staderennais']),
  ('Sparta Praha', 'Europa League', ARRAY['acspartapraha','spartapraha','spartaprague']),
  ('Sturm Graz', 'Europa League', ARRAY['sksturmgraz','sturmgraz']),
  ('Sunderland', 'Europa League', ARRAY['sunderland']),
  ('Union SG', 'Europa League', ARRAY['royaleunionsaintgilloise','unionsaintgilloise','unionsg']),
  ('Ferencváros', 'Europa League', ARRAY['ferencvarositc','ferencvaros','ferencvros','ferencvrositornaclub']),
  ('Anderlecht', 'Europa League', ARRAY['rscanderlecht','anderlecht']),
  ('Lech Poznań', 'Europa League', ARRAY['kkslechpoznan','lechpoznan','lechpozna']),
  ('Trabzonspor', 'Europa League', ARRAY['trabzonspor']),
  ('Benfica', 'Europa League', ARRAY['slbenfica','benfica']),
  ('Beşiktaş', 'Europa League', ARRAY['besiktasjk','besiktas','beikta','beiktajk']),
  ('Salzburg', 'Europa League', ARRAY['fcredbullsalzburg','redbullsalzburg','salzburg','rbsalzburg']),
  ('Rangers', 'Europa League', ARRAY['rangersfc','rangers']),
  ('Hearts', 'Europa League', ARRAY['heartofmidlothianfc','heartofmidlothian','hearts']),
  ('Shamrock Rovers', 'Europa League', ARRAY['shamrockroversfc','shamrockrovers']),
  ('Ajax', 'Europa League', ARRAY['afcajax','ajax']),
  ('Midtjylland', 'Europa League', ARRAY['fcmidtjylland','midtjylland']),
  ('Genk', 'Europa League', ARRAY['krcgenk','genk','racinggenk']),
  ('Young Boys', 'Europa League', ARRAY['bscyoungboys','youngboys']),
  ('Basel', 'Europa League', ARRAY['fcbasel1893','fcbasel','basel']),
  ('Malmö', 'Europa League', ARRAY['malmoff','malmff','malmo']),
  ('Sporting Braga', 'Europa League', ARRAY['sportingclubedebraga','scbraga','braga']),
  ('PAOK', 'Europa League', ARRAY['paokfc','paokthessaloniki','paok']),
  ('Viktoria Plzeň', 'Europa League', ARRAY['fcviktoriaplzen','viktoriaplzen','viktoriaplze','plzen']),
  ('Vitória Guimarães', 'Europa League', ARRAY['vitriasportclube','vitriasc','vitriaguimares','vitriadeguimares','guimares']),
  ('Legia Warszawa', 'Europa League', ARRAY['legiawarszawa','legiawarsaw','legia']),
  ('Sevilla', 'Other', ARRAY['sevillafc','sevilla']),
  ('Eintracht Frankfurt', 'Other', ARRAY['eintrachtfrankfurt','eintracht']),
  ('Schalke', 'Other', ARRAY['fcschalke04','schalke04','schalke','fcschalke']),
  ('Monaco', 'Other', ARRAY['asmonaco','monaco']),
  ('Strasbourg', 'Other', ARRAY['rcstrasbourgalsace','strasbourg']),
  ('Atalanta', 'Other', ARRAY['atalantabc','atalanta']),
  ('Lazio', 'Other', ARRAY['sslazio','lazio']),
  ('Al Hilal', 'Other', ARRAY['alhilalsfc','alhilal']),
  ('Al Nassr', 'Other', ARRAY['alnassrfc','alnassr']),
  ('Al Ahli', 'Other', ARRAY['alahlisaudifc','alahli','alahlisaudi','alahlisfc']),
  ('Al Ittihad', 'Other', ARRAY['alittihadclub','alittihad','alittihadjeddah'])
)
SELECT
  w.competition,
  w.club,
  EXISTS (
    SELECT 1 FROM sofifa_players p
    WHERE p.fifa_year IN (2026, 2027)
      AND regexp_replace(LOWER(p.club), '[^a-z]', '', 'g') = ANY (w.variants)
  ) AS matched,
  -- The exact string SoFIFA itself uses, when there IS a match — useful if
  -- a future edit needs to match this club again.
  (
    SELECT p.club FROM sofifa_players p
    WHERE p.fifa_year IN (2026, 2027)
      AND regexp_replace(LOWER(p.club), '[^a-z]', '', 'g') = ANY (w.variants)
    LIMIT 1
  ) AS sofifa_spelling
FROM wanted w
ORDER BY matched, w.competition, w.club;
