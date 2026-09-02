"use client";
import { useState } from "react";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, BOOTS_CATALOGUE, LIFESTYLE_ITEMS, type KibCan } from "@/lib/star/shopData";

interface Props {
  career: CareerState;
  kind: "kib" | "boots" | "lifestyle";
  onBack: () => void;
  onBuyKib: (can: KibCan) => void;
  onBuyBoot: (boot: Boot) => void;
  onBuyItem: (item: OwnedItem) => void;
}

export default function Shop({ career, kind, onBack, onBuyKib, onBuyBoot, onBuyItem }: Props) {
  const [tab, setTab] = useState<"item" | "vehicle" | "property">("item");
  const [selectedBoot, setSelectedBoot] = useState<Boot | null>(BOOTS_CATALOGUE[0]);
  const [selectedCan, setSelectedCan] = useState<KibCan | null>(KIB_CANS[0]);
  const [selectedItem, setSelectedItem] = useState<OwnedItem | null>(null);

  const title = kind === "kib" ? "KIB Cans" : kind === "boots" ? "Boots" : "Lifestyle";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="font-black text-white text-lg">{title}</div>
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-3 py-2 border border-gray-600">
            <StarIcon />
            <span className="font-black text-yellow-300">{career.money}</span>
          </div>
        </div>

        {kind === "kib" && (
          <div className="space-y-2">
            {KIB_CANS.map((c) => {
              const canBuy = career.money >= c.price;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCan(c)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition ${
                    selectedCan?.id === c.id ? "border-emerald-400 bg-gray-700" : "border-gray-700 bg-gray-800"
                  }`}
                >
                  <div className={`w-10 h-14 ${c.color} rounded-lg border-2 border-black/40 flex items-center justify-center`}>
                    <span className="text-[8px] font-black text-white">KIB</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-black text-white text-sm">{c.name}</div>
                    <div className="text-[10px] text-emerald-300 font-bold">+{c.restore} energy</div>
                    <div className="text-[10px] text-white/75">Owned: {career.kibCans[c.id]}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 font-black text-yellow-300 text-sm">
                      <StarIcon /> {c.price}
                    </div>
                    <button
                      disabled={!canBuy}
                      onClick={(e) => { e.stopPropagation(); onBuyKib(c); }}
                      className={`mt-1 px-3 py-1 rounded text-[10px] font-black ${canBuy ? "bg-emerald-500 text-white" : "bg-gray-600 text-white/75"}`}
                    >
                      Buy
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {kind === "boots" && (
          <>
            <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 mb-3">
              <div className="grid grid-cols-[1fr_40px_40px_40px_50px_40px] py-1.5 bg-gray-800 text-[10px] font-black text-center text-white">
                <div>Boot</div>
                <div>Pac</div>
                <div>Pow</div>
                <div>Tec</div>
                <div>Match</div>
                <div>★</div>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {BOOTS_CATALOGUE.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBoot(b)}
                    className={`w-full grid grid-cols-[1fr_40px_40px_40px_50px_40px] py-2 text-[10px] font-bold text-center ${
                      selectedBoot?.id === b.id ? "bg-emerald-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
                    }`}
                  >
                    <div className="text-left pl-3">{b.name}</div>
                    <div>{b.pace.toFixed(1)}</div>
                    <div>{b.power.toFixed(1)}</div>
                    <div>{b.technique.toFixed(1)}</div>
                    <div>{b.matches}</div>
                    <div className="text-yellow-300">{b.price}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600 text-center">
              <div className="text-xs text-white/85">Current boot</div>
              <div className="font-black text-white">{career.currentBoot.name} — {career.currentBoot.matches} matches left</div>
            </div>
            <button
              disabled={!selectedBoot || career.money < selectedBoot.price}
              onClick={() => selectedBoot && onBuyBoot(selectedBoot)}
              className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black disabled:opacity-40 disabled:bg-gray-600 flex items-center justify-center gap-2"
            >
              Buy {selectedBoot?.name} — ★{selectedBoot?.price}
            </button>
          </>
        )}

        {kind === "lifestyle" && (
          <>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {(["item", "vehicle", "property"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`py-2 rounded font-black text-xs uppercase transition ${tab === t ? "bg-emerald-500 text-white" : "bg-gray-700 text-white/85"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 max-h-[350px] overflow-y-auto">
              {LIFESTYLE_ITEMS.filter((i) => i.category === tab).map((i) => {
                const owned = career.ownedItems.some((o) => o.id === i.id);
                return (
                  <button
                    key={i.id}
                    onClick={() => setSelectedItem(i)}
                    className={`w-full flex items-center gap-2 p-2.5 border-b border-black/20 text-left ${
                      selectedItem?.id === i.id ? "bg-emerald-600" : owned ? "bg-gray-800" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center text-lg">
                      {i.category === "item" ? "📱" : i.category === "vehicle" ? "🚗" : "🏠"}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-white text-sm">{i.name}</div>
                      <div className="text-[10px] text-white/75">Lifestyle +{i.lifestyleValue}</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 font-black text-yellow-300 text-sm">
                        <StarIcon /> {i.price}
                      </div>
                      {owned && <div className="text-[9px] text-emerald-400 font-bold">OWNED</div>}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedItem && !career.ownedItems.some((o) => o.id === selectedItem.id) && (
              <button
                disabled={career.money < selectedItem.price}
                onClick={() => onBuyItem(selectedItem)}
                className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black disabled:opacity-40 disabled:bg-gray-600"
              >
                Buy {selectedItem.name} — ★{selectedItem.price}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
