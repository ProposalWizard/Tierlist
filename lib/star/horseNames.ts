/**
 * HORSE NAMES — every one invented (Harry's rule: no real names). The casino's race fields and your own horse's
 * rivals draw from HORSE_NAMES (components/star/Casino.tsx); the garden's stable horse is STABLE_HORSE_NAME
 * (gardenLevels.ts). 28 Nov 2026: "Bold Ruler" (a real champion racehorse), "Iron Duke" (Wellington's nickname)
 * and "Lucky Strike" (a cigarette brand) replaced. tests/star/gardenLevels.mts checks every name against
 * REAL_HORSE_BLOCKLIST. The frozen Old UI casino (components/star/legacy/) keeps its own list as it was.
 */
export const HORSE_NAMES = [
  "Thunder Bolt", "Golden Arrow", "Midnight Star", "Silver Streak", "Red Comet",
  "Wild Spirit", "Copper Kettle", "Hedge Lark", "Grey Storm", "Nimbus",
  "Blaze", "Royal Flash", "Diamond Dash", "Lucky Clover", "Storm Chaser",
];

/** Famous real racehorses (and a few real people's nicknames): never a name in the game. */
export const REAL_HORSE_BLOCKLIST = [
  "Shergar", "Frankel", "Red Rum", "Secretariat", "Seabiscuit", "Arkle", "Desert Orchid", "Kauto Star", "Enable",
  "Sea The Stars", "Nijinsky", "Mill Reef", "Brigadier Gerard", "Dancing Brave", "Galileo", "Tiger Roll", "Best Mate",
  "Golden Miller", "Phar Lap", "Winx", "Black Caviar", "Man o' War", "American Pharoah", "Justify", "Denman",
  "Bold Ruler", "Iron Duke", "Northern Dancer", "Sir Ivor", "Shirley Heights", "Baaeed", "Constitution Hill",
  "Rachel Alexandra", "Zenyatta", "Cigar", "Seattle Slew", "Affirmed", "War Admiral", "Citation", "Hyperion",
];
