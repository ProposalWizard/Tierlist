"use client";
import { useState, useEffect, useRef } from "react";

export interface LibraryCard {
  id: string;
  name: string;
  image_url: string;
  tags: string[];
}

interface Props {
  onSelect: (card: LibraryCard) => void;
  onClose: () => void;
}

export default function CardLibraryPicker({ onSelect, onClose }: Props) {
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/card-library")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setCards(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = cards.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-bold text-white">Choose from Card Library</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg font-bold leading-none">×</button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-800 shrink-0">
          <input
            type="text"
            placeholder="Search by name or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="text-center text-gray-500 text-sm py-12">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-12">
              {cards.length === 0 ? "No cards in library yet. Add some in the Cards tab." : "No cards match your search."}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filtered.map(card => (
                <button
                  key={card.id}
                  onClick={() => onSelect(card)}
                  className="group flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-700 hover:border-emerald-500 bg-gray-800 hover:bg-gray-750 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-gray-700">
                    <img
                      src={card.image_url}
                      alt={card.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <span className="text-[10px] text-gray-300 group-hover:text-white font-bold text-center leading-tight truncate w-full px-0.5 transition-colors">
                    {card.name}
                  </span>
                  {card.tags.length > 0 && (
                    <span className="text-[9px] text-gray-500 truncate w-full text-center">
                      {card.tags[0]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 shrink-0 text-[10px] text-gray-500 text-right">
          {filtered.length} card{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
