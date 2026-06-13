-- Clean up positions in sofifa_players:
-- CF → ST (if player doesn't already have ST), otherwise remove CF
-- Remove RAM, LAM, RF, LF, SW entirely

-- Step 1: CF → ST for players who don't already have ST
UPDATE sofifa_players
SET positions = trim(both ',' from replace(',' || positions || ',', ',CF,', ',ST,'))
WHERE positions LIKE '%CF%' AND positions NOT LIKE '%ST%';

-- Step 2: Remove CF for players who already have ST
UPDATE sofifa_players
SET positions = trim(both ',' from replace(',' || positions || ',', ',CF,', ','))
WHERE positions LIKE '%CF%';

-- Step 3: Remove RAM, LAM, RF, LF, SW
UPDATE sofifa_players
SET positions = trim(both ',' from replace(',' || positions || ',', ',RAM,', ','))
WHERE positions LIKE '%RAM%';

UPDATE sofifa_players
SET positions = trim(both ',' from replace(',' || positions || ',', ',LAM,', ','))
WHERE positions LIKE '%LAM%';

UPDATE sofifa_players
SET positions = trim(both ',' from replace(',' || positions || ',', ',RF,', ','))
WHERE positions LIKE '%RF%';

UPDATE sofifa_players
SET positions = trim(both ',' from replace(',' || positions || ',', ',LF,', ','))
WHERE positions LIKE '%LF%';

UPDATE sofifa_players
SET positions = trim(both ',' from replace(',' || positions || ',', ',SW,', ','))
WHERE positions LIKE '%SW%';
