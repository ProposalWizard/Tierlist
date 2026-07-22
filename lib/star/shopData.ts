import type { Boot, OwnedItem } from "./types";

export interface NrgDrink {
  id: "basic" | "premium" | "elite";
  name: string;
  price: number;
  restore: number;
  color: string;
}

export const NRG_DRINKS: NrgDrink[] = [
  { id: "basic", name: "Basic Drink", price: 3, restore: 25, color: "bg-orange-400" },
  { id: "premium", name: "Premium Drink", price: 6, restore: 50, color: "bg-purple-400" },
  { id: "elite", name: "Elite Drink", price: 12, restore: 100, color: "bg-emerald-400" },
];

export const BOOTS_CATALOGUE: Boot[] = [
  { id: "starter", name: "NS-Pure", pace: 5, power: 5, technique: 5, matches: 3, price: 3 },
  { id: "attacker", name: "NS-Blast", pace: 10, power: 10, technique: 5, matches: 5, price: 5 },
  { id: "control", name: "NS-Control", pace: 5, power: 5, technique: 10, matches: 5, price: 5 },
  { id: "speed", name: "NS-Flash", pace: 10, power: 5, technique: 10, matches: 5, price: 10 },
  { id: "power", name: "NS-Thunder", pace: 5, power: 10, technique: 10, matches: 5, price: 10 },
  { id: "elite", name: "NS-Elite", pace: 10, power: 10, technique: 10, matches: 7, price: 15 },
  { id: "pro", name: "NS-Pro", pace: 15, power: 15, technique: 10, matches: 7, price: 15 },
  { id: "legend", name: "NS-Legend", pace: 15, power: 15, technique: 15, matches: 7, price: 25 },
];

export const LIFESTYLE_ITEMS: OwnedItem[] = [
  { id: "phone", name: "Phone", category: "item", price: 5, lifestyleValue: 3 },
  { id: "console", name: "Games Console", category: "item", price: 10, lifestyleValue: 5 },
  { id: "music", name: "Music Player", category: "item", price: 15, lifestyleValue: 6 },
  { id: "tablet", name: "Tablet", category: "item", price: 20, lifestyleValue: 8 },
  { id: "tv", name: "TV", category: "item", price: 25, lifestyleValue: 10 },
  { id: "suit", name: "Designer Suit", category: "item", price: 30, lifestyleValue: 12 },
  { id: "silver", name: "Silver Chain", category: "item", price: 35, lifestyleValue: 14 },
  { id: "gold", name: "Gold Watch", category: "item", price: 50, lifestyleValue: 20 },
  { id: "diamond", name: "Diamond Necklace", category: "item", price: 100, lifestyleValue: 40 },

  { id: "car-1", name: "Family Car", category: "vehicle", price: 15, lifestyleValue: 5 },
  { id: "car-2", name: "Hatchback", category: "vehicle", price: 40, lifestyleValue: 12 },
  { id: "car-3", name: "Sports Car", category: "vehicle", price: 100, lifestyleValue: 30 },
  { id: "car-4", name: "Supercar", category: "vehicle", price: 250, lifestyleValue: 60 },

  { id: "flat-1", name: "Studio Flat", category: "property", price: 30, lifestyleValue: 10 },
  { id: "flat-2", name: "City Apartment", category: "property", price: 80, lifestyleValue: 25 },
  { id: "house-1", name: "Suburban House", category: "property", price: 200, lifestyleValue: 55 },
  { id: "house-2", name: "Mansion", category: "property", price: 500, lifestyleValue: 100 },
];
