"use client";

interface XPEvent {
  event_type: string;
  xp_awarded: number;
  created_at: string;
}

interface Props {
  events: XPEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  draft_complete: "Draft Season Complete",
  draft_win: "League Title Won",
  draft_invincible: "Invincible Season",
  tierlist_create: "Tierlist Created",
  tierlist_likes_10: "Tierlist Hit 10 Likes",
  vote_cast: "Vote Cast",
  streak_7: "7-Day Login Streak",
  streak_30: "30-Day Login Streak",
};

export default function RecentActivity({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
        <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
          Recent Activity
        </h3>
        <p className="text-xs text-gray-600 text-center py-4">
          No activity yet. Play a draft or create a tierlist to earn XP!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
        Recent Activity
      </h3>
      <div className="space-y-1.5">
        {events.map((event, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800/30">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-300 font-medium">
                {EVENT_LABELS[event.event_type] ?? event.event_type}
              </span>
              <span className="text-[10px] text-gray-600 ml-2">
                {formatTimeAgo(event.created_at)}
              </span>
            </div>
            <span className="text-xs font-bold text-amber-400 ml-2 flex-shrink-0">
              +{event.xp_awarded} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
