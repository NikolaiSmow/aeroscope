"use client";

import dynamic from "next/dynamic";
import { QueryProvider } from "@/components/QueryProvider";
import { SearchBar } from "@/components/SearchBar";
import { StatusBar } from "@/components/StatusBar";
import { AircraftPanel } from "@/components/AircraftPanel";
import { FlightStream } from "@/components/FlightStream";

const FlightMap = dynamic(() => import("@/components/FlightMap").then((m) => m.FlightMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-950" />,
});

export function MapShell() {
  return (
    <QueryProvider>
      <main className="relative h-dvh w-screen overflow-hidden bg-zinc-950 text-white">
        <FlightMap />
        <FlightStream />
        <AircraftPanel />

        <header className="pointer-events-none absolute left-0 top-0 z-10 flex w-full items-start justify-between gap-4 p-4">
          <div className="pointer-events-auto flex items-center gap-3">
            <div className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 backdrop-blur">
              <h1 className="text-sm font-semibold tracking-tight">Flight Tracker</h1>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Live aircraft positions
              </p>
            </div>
            <SearchBar />
          </div>
          <div className="pointer-events-auto">
            <StatusBar />
          </div>
        </header>
      </main>
    </QueryProvider>
  );
}
