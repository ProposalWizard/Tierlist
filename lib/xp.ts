// XP & Progression system utilities

// --- XP curve ---

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * level + 50 * (level - 1);
}

export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

export function levelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  xpToNext: number;
  progress: number;
} {
  let level = 1;
  let consumed = 0;
  while (true) {
    const needed = xpForLevel(level + 1);
    if (consumed + needed > totalXp) {
      const currentLevelXp = totalXp - consumed;
      return {
        level,
        currentLevelXp,
        xpToNext: needed,
        progress: needed > 0 ? currentLevelXp / needed : 1,
      };
    }
    consumed += needed;
    level++;
  }
}

// --- XP award amounts ---

export const XP_AWARDS = {
  draft_complete: 100,
  draft_win: 250,
  draft_invincible: 500,
  tierlist_create: 25,
  tierlist_likes_10: 50,
  vote_cast: 10,
  streak_7: 200,
  streak_30: 500,
} as const;

export type XPEventType = keyof typeof XP_AWARDS;

// --- Manager titles ---

export const MANAGER_TITLES: { id: string; name: string; level: number; rarity: string }[] = [
  { id: 'title_rookie', name: 'Rookie Manager', level: 1, rarity: 'bronze' },
  { id: 'title_rising', name: 'Rising Talent', level: 5, rarity: 'bronze' },
  { id: 'title_promising', name: 'Promising Coach', level: 10, rarity: 'silver' },
  { id: 'title_established', name: 'Established Pro', level: 15, rarity: 'silver' },
  { id: 'title_tactical', name: 'Tactical Genius', level: 20, rarity: 'gold' },
  { id: 'title_elite', name: 'Elite Manager', level: 25, rarity: 'gold' },
  { id: 'title_mastermind', name: 'Mastermind', level: 30, rarity: 'gold' },
  { id: 'title_world_class', name: 'World Class', level: 40, rarity: 'diamond' },
  { id: 'title_legend', name: 'Legend', level: 50, rarity: 'diamond' },
];

export function getTitleForLevel(level: number): { id: string; name: string; level: number; rarity: string } {
  let best = MANAGER_TITLES[0];
  for (const t of MANAGER_TITLES) {
    if (level >= t.level) best = t;
  }
  return best;
}

// --- Rarity colors ---

export const RARITY_COLORS = {
  bronze: { text: 'text-orange-600', border: 'border-orange-700/40', bg: 'bg-orange-900/20' },
  silver: { text: 'text-gray-300', border: 'border-gray-400/40', bg: 'bg-gray-700/20' },
  gold: { text: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-900/20' },
  diamond: { text: 'text-cyan-300', border: 'border-cyan-400/40', bg: 'bg-cyan-900/20' },
} as const;

// --- Card frame CSS styles ---

export const FRAME_STYLES: Record<string, { border: string; shadow: string; gradient?: string; image?: string }> = {
  frame_default: {
    border: 'border-2 border-gray-700',
    shadow: '',
    image: 'https://cagkgfketucousksgtbk.supabase.co/storage/v1/object/public/tierlist-images/image-b2ccc256-bac0-4053-9192-58578934c62b.png',
  },
  frame_silver: {
    border: 'border-2 border-gray-300',
    shadow: 'shadow-lg shadow-gray-400/20',
    gradient: 'bg-gradient-to-br from-gray-200 via-gray-400 to-gray-300',
    image: 'https://cagkgfketucousksgtbk.supabase.co/storage/v1/object/public/tierlist-images/ChatGPT%20Image%20Jun%2018,%202026,%2002_46_46%20AM.png',
  },
  frame_gold: {
    border: 'border-2 border-amber-400',
    shadow: 'shadow-lg shadow-amber-500/30',
    gradient: 'bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-400',
    image: 'https://cagkgfketucousksgtbk.supabase.co/storage/v1/object/public/tierlist-images/messi_legends_card_2.png',
  },
  frame_champions: {
    border: 'border-2 border-blue-500',
    shadow: 'shadow-lg shadow-blue-500/30',
    gradient: 'bg-gradient-to-br from-blue-900 via-blue-600 to-indigo-500',
  },
  frame_diamond: {
    border: 'border-2 border-cyan-400',
    shadow: 'shadow-lg shadow-cyan-400/30',
    gradient: 'bg-gradient-to-br from-cyan-300 via-teal-400 to-cyan-500',
  },
  frame_invincibles: {
    border: 'border-2 border-emerald-400',
    shadow: 'shadow-lg shadow-emerald-500/30',
    gradient: 'bg-gradient-to-br from-emerald-400 via-green-500 to-amber-400',
  },
  frame_future_stars: {
    border: 'border-2 border-purple-400',
    shadow: 'shadow-lg shadow-purple-500/30',
    gradient: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
  },
  frame_ballon_dor: {
    border: 'border-2 border-amber-300',
    shadow: 'shadow-xl shadow-amber-400/40',
    gradient: 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600',
  },
};

// --- Reward type ---

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  category: 'trophy' | 'frame' | 'title';
  rarity: 'bronze' | 'silver' | 'gold' | 'diamond';
  icon_name: string | null;
  unlock_type: 'stat' | 'level';
  unlock_stat: string | null;
  unlock_value: number | null;
  sort_order: number;
}

export interface UserProgression {
  xp: number;
  level: number;
  currentLevelXp: number;
  xpToNext: number;
  progress: number;
  stats: UserStats;
  rewards: (Reward & { unlocked: boolean; unlocked_at: string | null })[];
  equippedFrame: string;
  equippedTitle: string;
  recentXpEvents: { event_type: string; xp_awarded: number; created_at: string }[];
}

export interface UserStats {
  drafts_played: number;
  draft_wins: number;
  draft_invincibles: number;
  total_goals_scored: number;
  tierlists_created: number;
  tierlists_likes_received: number;
  votes_cast: number;
  seasons_played: number;
  longest_streak: number;
}

export function checkRewardUnlock(
  reward: Reward,
  stats: UserStats,
  level: number,
): boolean {
  if (reward.unlock_type === 'level') {
    return level >= (reward.unlock_value ?? 999);
  }
  if (reward.unlock_type === 'stat' && reward.unlock_stat) {
    const statKey = reward.unlock_stat as keyof UserStats;
    const val = stats[statKey];
    if (typeof val === 'number') {
      return val >= (reward.unlock_value ?? 999);
    }
  }
  return false;
}
