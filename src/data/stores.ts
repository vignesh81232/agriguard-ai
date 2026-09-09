import type { Crop } from "../i18n/translations";

/**
 * Mock remedy store dataset (hackathon MVP — no backend, no geolocation).
 * Stores are keyed by crop so the locator can filter by the diagnosed crop.
 * Coordinates are illustrative demo locations used for Maps directions links.
 */

export interface Store {
  id: string;
  name: string;
  /** Distance shown in the UI (km). */
  distanceKm: number;
  /** Price text for the flagged remedy, e.g. "₹340". */
  price: string;
  /** Opening hours, plain-text (not translated). */
  open: string;
  phone: string;
  coords: [number, number];
}

export const STORES_BY_CROP: Record<string, Store[]> = {
  tomato: [
    {
      id: "tl-1",
      name: "GreenLeaf Agro Store",
      distanceKm: 1.2,
      price: "₹340",
      open: "8:00–20:00",
      phone: "+91 98765 43210",
      coords: [12.9716, 77.5946],
    },
    {
      id: "tl-2",
      name: "Kisan Bhandar & Seeds",
      distanceKm: 2.8,
      price: "₹310 / packet",
      open: "9:00–19:00",
      phone: "+91 91234 56780",
      coords: [12.9784, 77.6408],
    },
    {
      id: "tl-3",
      name: "Sagar Farm Supplies",
      distanceKm: 5.4,
      price: "₹295",
      open: "8:30–18:30",
      phone: "+91 90000 11122",
      coords: [12.9352, 77.6245],
    },
  ],
  corn: [
    {
      id: "cr-1",
      name: "Harvest Agro Services",
      distanceKm: 0.9,
      price: "₹420",
      open: "8:00–19:00",
      phone: "+91 98800 22331",
      coords: [17.3850, 78.4867],
    },
    {
      id: "cr-2",
      name: "Annapurna Fertilizers",
      distanceKm: 3.6,
      price: "₹390 / 1kg",
      open: "9:00–18:30",
      phone: "+91 91234 88990",
      coords: [17.4126, 78.4749],
    },
  ],
  rice: [
    {
      id: "rb-1",
      name: "PaddyCare Store",
      distanceKm: 1.8,
      price: "₹480",
      open: "7:30–19:00",
      phone: "+91 99001 22334",
      coords: [13.3563, 77.1822],
    },
    {
      id: "rb-2",
      name: "Taluq Seed & Crop Care",
      distanceKm: 4.2,
      price: "₹450 / packet",
      open: "9:00–20:00",
      phone: "+91 98000 55667",
      coords: [13.3309, 77.1173],
    },
  ],
  potato: [
    {
      id: "pp-1",
      name: "Field First Agro",
      distanceKm: 2.1,
      price: "₹260",
      open: "8:00–19:30",
      phone: "+91 97000 88990",
      coords: [22.3072, 73.1812],
    },
    {
      id: "pp-2",
      name: "Sabji Bazaar Supplies",
      distanceKm: 4.0,
      price: "₹240 / packet",
      open: "9:00–18:00",
      phone: "+91 96000 11223",
      coords: [22.2930, 73.2482],
    },
  ],
};

/** Stores for a crop; falls back to the tomato list for unknown crops. */
export function getStoresForCrop(crop: Crop | null): Store[] {
  if (crop && STORES_BY_CROP[crop]) return STORES_BY_CROP[crop];
  return STORES_BY_CROP.tomato;
}