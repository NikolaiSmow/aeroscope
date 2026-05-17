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
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 backdrop-blur">
              <AeroScopeMark />
              <div>
                <h1 className="text-sm font-semibold tracking-tight">AeroScope</h1>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Live aircraft intelligence
                </p>
              </div>
            </div>
            <SearchBar />
          </div>
          <div className="pointer-events-auto mr-12">
            <StatusBar />
          </div>
        </header>
      </main>
    </QueryProvider>
  );
}

function AeroScopeMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8 shrink-0"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill="#09090b" />
      <path
        d="M32 9a23 23 0 1 1 0 46 23 23 0 0 1 0-46Z"
        stroke="#27272a"
        strokeWidth="2"
      />
      <path d="M32 8v8M32 48v8M8 32h8M48 32h8" stroke="#3f3f46" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 45 45 20" stroke="#67e8f9" strokeWidth="1.4" strokeLinecap="round" opacity=".32" />
      <path d="M32 32 50 16" stroke="url(#aeroscope-gradient)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M43.6 18.9 53.7 13.4 49.2 24.1l-2.4-4-4.4-.3Z" fill="url(#aeroscope-gradient)" />
      <circle cx="32" cy="32" r="3.2" fill="#09090b" stroke="#a7f3d0" strokeWidth="2" />
      <defs>
        <linearGradient
          id="aeroscope-gradient"
          x1="10"
          y1="8"
          x2="54"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#67e8f9" />
          <stop offset=".52" stopColor="#22c55e" />
          <stop offset="1" stopColor="#f8fafc" />
        </linearGradient>
      </defs>
    </svg>
  );
}
