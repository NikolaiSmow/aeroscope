"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useFlightStore } from "@/lib/store";

export function SearchBar() {
  const [q, setQ] = useState("");
  const aircraft = useFlightStore((s) => s.aircraft);
  const select = useFlightStore((s) => s.select);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const needle = q.trim().toLowerCase();
    if (!needle) return;
    const hit = aircraft.find(
      (a) =>
        a.callsign?.toLowerCase() === needle ||
        a.callsign?.toLowerCase().startsWith(needle) ||
        a.icao24.toLowerCase() === needle,
    );
    if (hit) select(hit.icao24);
  };

  return (
    <form onSubmit={onSubmit} className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Callsign or ICAO24…"
        className="w-64 rounded-lg border border-white/10 bg-zinc-950/80 backdrop-blur pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-400/60"
      />
    </form>
  );
}
