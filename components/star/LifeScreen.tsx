"use client";
import type { CareerState } from "@/lib/star/types";

interface Props {
  career: CareerState;
}

export default function LifeScreen({ career }: Props) {
  return (
    <div className="mt-2 bg-emerald-900/30 border border-emerald-700 rounded-lg p-3">
      <RelationshipRow label="Boss" value={career.relationships.boss} icon="💼" />
      <RelationshipRow label="Team" value={career.relationships.team} icon="👕" />
      <RelationshipRow label="Fans" value={career.relationships.fans} icon="🧣" />
      <RelationshipRow label="Girlfriend" value={career.relationships.girlfriend} icon="💍" locked />
      <RelationshipRow label="Sponsors" value={career.relationships.sponsors} icon="🤝" locked />

      <div className="mt-3 pt-3 border-t border-emerald-700 text-[10px] text-emerald-300 text-center">
        Higher relationships = more chances, better contracts. Play well to raise them.
      </div>
    </div>
  );
}

function RelationshipRow({ label, value, icon, locked }: { label: string; value: number | null; icon: string; locked?: boolean }) {
  const v = value ?? 0;
  const color = v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={`relative flex-1 h-9 rounded-lg overflow-hidden bg-gray-700 border border-gray-600 ${locked ? "opacity-40" : ""}`}>
        {!locked && <div className={`absolute inset-y-0 left-0 ${color} transition-all`} style={{ width: `${v}%` }} />}
        <div className="relative flex items-center justify-center h-full">
          <span className="font-black text-white text-sm">{label}</span>
          {!locked && <span className="ml-2 font-black text-white text-xs bg-black/40 rounded-full px-2">{v}</span>}
        </div>
      </div>
      <div className="w-9 h-9 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-xl">
        {icon}
      </div>
    </div>
  );
}
