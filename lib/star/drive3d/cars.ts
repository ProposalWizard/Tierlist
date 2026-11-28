/**
 * THE CARS THAT DRIVE (driving phase 1, 28 Nov 2026). The six generated shop cars with their
 * wheels cut out (tools/cars/cut_wheels.py): public/star/drive3d/car-<id>.glb (about 23k
 * triangles; the Family Car re-prepped from 36k) and car-<id>-lod.glb (the light copy, about
 * 4k, for Low phones and the traffic). Same pictures as the shop; no new models (0 credits).
 *
 * `paint` is the body colour the tool measured off each car's picture (sRGB): the traffic's
 * repaint swaps that colour for another and keeps the light and shade.
 */
export type DriveCarId = "hatch" | "family" | "suv" | "sports" | "classic" | "super";

export interface DriveCar { id: DriveCarId; name: string; shopId: string; length: number; paint: [number, number, number] }

export const DRIVE_CARS: Record<DriveCarId, DriveCar> = {
  hatch: { id: "hatch", name: "Hatchback", shopId: "car-2", length: 4.1, paint: [0.663, 0.082, 0.063] },
  family: { id: "family", name: "Family Car", shopId: "car-1", length: 4.3, paint: [0.196, 0.376, 0.573] },
  suv: { id: "suv", name: "Luxury SUV", shopId: "suv", length: 4.95, paint: [0.11, 0.115, 0.125] },
  sports: { id: "sports", name: "Sports Car", shopId: "car-3", length: 4.35, paint: [0.98, 0.8, 0.271] },
  classic: { id: "classic", name: "Classic Car", shopId: "classic", length: 4.5, paint: [0.082, 0.2, 0.18] },
  super: { id: "super", name: "Supercar", shopId: "car-4", length: 4.6, paint: [0.93, 0.47, 0.17] },
};

export const DRIVE_CAR_IDS = Object.keys(DRIVE_CARS) as DriveCarId[];

/** Your car: the best one you own by the shop's order, or the hatch when the career has none yet. */
export function carFromShop(owned: readonly string[]): DriveCarId {
  const order: DriveCarId[] = ["super", "sports", "suv", "classic", "family", "hatch"];
  for (const id of order) if (owned.includes(DRIVE_CARS[id].shopId)) return id;
  return "hatch";
}

export const carFile = (id: DriveCarId, lod: boolean) => `/star/drive3d/car-${id}${lod ? "-lod" : ""}.glb`;

/** sRGB 0..1 → linear (three's colour working space). */
export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
