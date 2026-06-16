export interface FormationSlot {
  position: string;
  label: string;
  x: number; // 0-100 percentage on pitch
  y: number; // 0-100 percentage on pitch
  compatiblePositions: string[];
}

export interface Formation {
  name: string;
  slots: FormationSlot[];
}

export const FORMATIONS: Formation[] = [
  {
    name: "4-4-2",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 92, compatiblePositions: ["GK"] },
      { position: "RB", label: "RB", x: 85, y: 72, compatiblePositions: ["RB", "RWB"] },
      { position: "CB", label: "CB", x: 62, y: 75, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 38, y: 75, compatiblePositions: ["CB"] },
      { position: "LB", label: "LB", x: 15, y: 72, compatiblePositions: ["LB", "LWB"] },
      { position: "RM", label: "RM", x: 85, y: 48, compatiblePositions: ["RM", "RW", "RWB"] },
      { position: "CM", label: "CM", x: 62, y: 52, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "CM", label: "CM", x: 38, y: 52, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "LM", label: "LM", x: 15, y: 48, compatiblePositions: ["LM", "LW", "LWB"] },
      { position: "ST", label: "ST", x: 62, y: 22, compatiblePositions: ["ST", "CF", "RW", "LW"] },
      { position: "ST", label: "ST", x: 38, y: 22, compatiblePositions: ["ST", "CF", "RW", "LW"] },
    ],
  },
  {
    name: "4-3-3",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 92, compatiblePositions: ["GK"] },
      { position: "RB", label: "RB", x: 85, y: 72, compatiblePositions: ["RB", "RWB"] },
      { position: "CB", label: "CB", x: 62, y: 75, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 38, y: 75, compatiblePositions: ["CB"] },
      { position: "LB", label: "LB", x: 15, y: 72, compatiblePositions: ["LB", "LWB"] },
      { position: "CDM", label: "CDM", x: 50, y: 55, compatiblePositions: ["CDM", "CM"] },
      { position: "CM", label: "CM", x: 70, y: 45, compatiblePositions: ["CM", "CAM", "CDM"] },
      { position: "CM", label: "CM", x: 30, y: 45, compatiblePositions: ["CM", "CAM", "CDM"] },
      { position: "RW", label: "RW", x: 82, y: 22, compatiblePositions: ["RW", "RM", "ST", "CF"] },
      { position: "ST", label: "ST", x: 50, y: 18, compatiblePositions: ["ST", "CF"] },
      { position: "LW", label: "LW", x: 18, y: 22, compatiblePositions: ["LW", "LM", "ST", "CF"] },
    ],
  },
  {
    name: "4-2-3-1",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 92, compatiblePositions: ["GK"] },
      { position: "RB", label: "RB", x: 85, y: 72, compatiblePositions: ["RB", "RWB"] },
      { position: "CB", label: "CB", x: 62, y: 75, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 38, y: 75, compatiblePositions: ["CB"] },
      { position: "LB", label: "LB", x: 15, y: 72, compatiblePositions: ["LB", "LWB"] },
      { position: "CDM", label: "CDM", x: 60, y: 58, compatiblePositions: ["CDM", "CM"] },
      { position: "CDM", label: "CDM", x: 40, y: 58, compatiblePositions: ["CDM", "CM"] },
      { position: "RW", label: "RW", x: 78, y: 38, compatiblePositions: ["RW", "RM", "CAM", "CM"] },
      { position: "CAM", label: "CAM", x: 50, y: 35, compatiblePositions: ["CAM", "CM", "CF"] },
      { position: "LW", label: "LW", x: 22, y: 38, compatiblePositions: ["LW", "LM", "CAM", "CM"] },
      { position: "ST", label: "ST", x: 50, y: 18, compatiblePositions: ["ST", "CF"] },
    ],
  },
  {
    name: "3-5-2",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 92, compatiblePositions: ["GK"] },
      { position: "CB", label: "CB", x: 72, y: 75, compatiblePositions: ["CB", "RB"] },
      { position: "CB", label: "CB", x: 50, y: 78, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 28, y: 75, compatiblePositions: ["CB", "LB"] },
      { position: "RWB", label: "RWB", x: 88, y: 50, compatiblePositions: ["RWB", "RB", "RM", "RW"] },
      { position: "CM", label: "CM", x: 65, y: 52, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "CM", label: "CM", x: 50, y: 55, compatiblePositions: ["CM", "CDM"] },
      { position: "CM", label: "CM", x: 35, y: 52, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "LWB", label: "LWB", x: 12, y: 50, compatiblePositions: ["LWB", "LB", "LM", "LW"] },
      { position: "ST", label: "ST", x: 60, y: 22, compatiblePositions: ["ST", "CF", "RW"] },
      { position: "ST", label: "ST", x: 40, y: 22, compatiblePositions: ["ST", "CF", "LW"] },
    ],
  },
  {
    name: "3-4-3",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 92, compatiblePositions: ["GK"] },
      { position: "CB", label: "CB", x: 72, y: 75, compatiblePositions: ["CB", "RB"] },
      { position: "CB", label: "CB", x: 50, y: 78, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 28, y: 75, compatiblePositions: ["CB", "LB"] },
      { position: "RM", label: "RM", x: 85, y: 48, compatiblePositions: ["RM", "RW", "RWB"] },
      { position: "CM", label: "CM", x: 62, y: 52, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "CM", label: "CM", x: 38, y: 52, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "LM", label: "LM", x: 15, y: 48, compatiblePositions: ["LM", "LW", "LWB"] },
      { position: "RW", label: "RW", x: 78, y: 22, compatiblePositions: ["RW", "RM", "ST", "CF"] },
      { position: "ST", label: "ST", x: 50, y: 18, compatiblePositions: ["ST", "CF"] },
      { position: "LW", label: "LW", x: 22, y: 22, compatiblePositions: ["LW", "LM", "ST", "CF"] },
    ],
  },
  {
    name: "4-1-4-1",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 92, compatiblePositions: ["GK"] },
      { position: "RB", label: "RB", x: 85, y: 72, compatiblePositions: ["RB", "RWB"] },
      { position: "CB", label: "CB", x: 62, y: 75, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 38, y: 75, compatiblePositions: ["CB"] },
      { position: "LB", label: "LB", x: 15, y: 72, compatiblePositions: ["LB", "LWB"] },
      { position: "CDM", label: "CDM", x: 50, y: 58, compatiblePositions: ["CDM", "CM"] },
      { position: "RM", label: "RM", x: 82, y: 40, compatiblePositions: ["RM", "RW", "CAM"] },
      { position: "CM", label: "CM", x: 62, y: 44, compatiblePositions: ["CM", "CAM", "CDM"] },
      { position: "CM", label: "CM", x: 38, y: 44, compatiblePositions: ["CM", "CAM", "CDM"] },
      { position: "LM", label: "LM", x: 18, y: 40, compatiblePositions: ["LM", "LW", "CAM"] },
      { position: "ST", label: "ST", x: 50, y: 18, compatiblePositions: ["ST", "CF"] },
    ],
  },
  {
    name: "5-3-2",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 92, compatiblePositions: ["GK"] },
      { position: "RWB", label: "RWB", x: 88, y: 65, compatiblePositions: ["RWB", "RB", "RM"] },
      { position: "CB", label: "CB", x: 68, y: 78, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 50, y: 80, compatiblePositions: ["CB"] },
      { position: "CB", label: "CB", x: 32, y: 78, compatiblePositions: ["CB"] },
      { position: "LWB", label: "LWB", x: 12, y: 65, compatiblePositions: ["LWB", "LB", "LM"] },
      { position: "CM", label: "CM", x: 65, y: 48, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "CM", label: "CM", x: 50, y: 50, compatiblePositions: ["CM", "CDM"] },
      { position: "CM", label: "CM", x: 35, y: 48, compatiblePositions: ["CM", "CDM", "CAM"] },
      { position: "ST", label: "ST", x: 60, y: 22, compatiblePositions: ["ST", "CF"] },
      { position: "ST", label: "ST", x: 40, y: 22, compatiblePositions: ["ST", "CF"] },
    ],
  },
];

export const DEFAULT_PL_TEAMS: { name: string; strength: number }[] = [
  { name: "Manchester City", strength: 85 },
  { name: "Arsenal", strength: 84 },
  { name: "Liverpool", strength: 83 },
  { name: "Chelsea", strength: 80 },
  { name: "Manchester United", strength: 78 },
  { name: "Tottenham Hotspur", strength: 78 },
  { name: "Newcastle United", strength: 77 },
  { name: "Aston Villa", strength: 76 },
  { name: "Brighton & Hove Albion", strength: 75 },
  { name: "West Ham United", strength: 74 },
  { name: "Crystal Palace", strength: 73 },
  { name: "Fulham", strength: 73 },
  { name: "Brentford", strength: 72 },
  { name: "Everton", strength: 72 },
  { name: "Bournemouth", strength: 71 },
  { name: "Wolverhampton Wanderers", strength: 71 },
  { name: "Nottingham Forest", strength: 70 },
  { name: "Leicester City", strength: 69 },
  { name: "Ipswich Town", strength: 68 },
  { name: "Southampton", strength: 67 },
];

export function getPositionColor(pos: string): string {
  const p = pos.toUpperCase();
  if (p === "GK") return "bg-yellow-500";
  if (["CB", "RB", "LB", "RWB", "LWB"].includes(p)) return "bg-blue-500";
  if (["CDM", "CM", "CAM", "RM", "LM"].includes(p)) return "bg-green-500";
  return "bg-red-500";
}

export function getPositionTextColor(pos: string): string {
  const p = pos.toUpperCase();
  if (p === "GK") return "text-yellow-400";
  if (["CB", "RB", "LB", "RWB", "LWB"].includes(p)) return "text-blue-400";
  if (["CDM", "CM", "CAM", "RM", "LM"].includes(p)) return "text-green-400";
  return "text-red-400";
}
