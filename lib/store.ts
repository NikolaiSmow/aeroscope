"use client";

import { create } from "zustand";
import type { Aircraft, BBox } from "./opensky";

type FlightStore = {
  aircraft: Aircraft[];
  lastUpdate: number | null;
  selectedIcao24: string | null;
  viewBBox: BBox | null;
  connectionStatus: "idle" | "connecting" | "live" | "error";
  setAircraft: (list: Aircraft[], time: number) => void;
  select: (icao24: string | null) => void;
  setBBox: (bbox: BBox | null) => void;
  setStatus: (s: FlightStore["connectionStatus"]) => void;
};

export const useFlightStore = create<FlightStore>((set) => ({
  aircraft: [],
  lastUpdate: null,
  selectedIcao24: null,
  viewBBox: null,
  connectionStatus: "idle",
  setAircraft: (list, time) => set({ aircraft: list, lastUpdate: time }),
  select: (icao24) => set({ selectedIcao24: icao24 }),
  setBBox: (bbox) => set({ viewBBox: bbox }),
  setStatus: (connectionStatus) => set({ connectionStatus }),
}));
