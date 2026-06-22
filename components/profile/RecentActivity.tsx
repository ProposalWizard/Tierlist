"use client";

interface XPEvent {
  event_type: string;
  xp_awarded: number;
  created_at: string;
}

interface Props {
  events: XPEvent[];
}

const EVENT_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  draft_complete: { label: "Draft Season Complete", icon: "\u{1F3AE}", color: "text-blue-400" },
  draft_win: { label: "League Title Won", icon: "\u{1F3C6}", color: "text-amber-400" },
  draft_invincible: { label: "Invincible Season", icon: "\u{1F6E1}️", color: "text-emerald-400" },
  tierlist_create: { label: "Tierlist Created", icon: "\u{1F5BC}️", color: "text-purple-400" },
  tierlist_likes_10: { label: "Tierlist Hit 10 Likes", icon: "❤️", color: "text-pink-400" },
  vote_cast: { label: "Vote Cast", icon: "\u{1F5F3}️", color: "text-cyan-400" },
  streak_7: { label: "7-Day Login Streak", icon: "\u{1F525}", color: "text-orange-400" },
  streak_30: { label: "30-Day Login Streak", icon: "\u{1F4A5}", color: "text-red-400" },
};

export default function RecentActivity({ events }: Props) {
  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold tracking-[0.25em] text-white uppercase">
          Recent Activity
        </h3>
        {events.length > 0 && (
          <span className="text-[10px] font-bold text-white">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-3xl mb-2 opacity-30">&#9889;</div>
          <p className="text-xs text-white">
            No activity yet. Play a draft or create a tierlist to earn XP!
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((event, i) => {
            const config = EVENT_CONFIG[event.event_type];
            const icon = config?.icon ?? "\u{2753}";
            const label = config?.label ?? event.event_type;
            const color = config?.color ?? "text-white";

            return (
              <div
                key={i}
                className="group flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-gray-800/40 transition-colors"
              >
                <span className="text-base flex-shrink-0 w-6 text-center">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xs font-semibold ${color}`}>
                      {label}
                    </span>
                    <span className="text-[9px] text-white flex-shrink-0">
                      {formatTimeAgo(event.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs font-black text-amber-400">
                    +{event.xp_awarded}
                  </span>
                  <span className="text-[9px] font-bold text-amber-500/60">XP</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
