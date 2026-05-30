"use client";

import dynamic from "next/dynamic";
import { QueryProvider } from "@/components/QueryProvider";
import { SearchBar } from "@/components/SearchBar";
import { StatusBar } from "@/components/StatusBar";
import { AircraftPanel } from "@/components/AircraftPanel";
import { FlightStream } from "@/components/FlightStream";

const FlightMap = dynamic(() => import("@/components/FlightMap").then((m) => m.FlightMap), {
  ssr: false,
  loading: () => <div className="h-full w-full" style={{ background: "var(--background)" }} />,
});

export function MapShell() {
  return (
    <QueryProvider>
      <main className="relative h-dvh w-screen overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <FlightMap />
        <FlightStream />
        <AircraftPanel />

        <header className="pointer-events-none absolute left-0 top-0 z-10 flex w-full items-start justify-between gap-4 p-3">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <div className="overlay-surface flex items-center gap-2.5 rounded-xl px-3 py-2">
              <AeroScopeMark />
              <div>
                <h1 className="text-[13px] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>AeroScope</h1>
                <p className="text-[9px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
                  Flight intelligence
                </p>
              </div>
            </div>
            <SearchBar />
          </div>
          <div className="pointer-events-auto mt-0.5 mr-11">
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
      className="h-7 w-7 shrink-0"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill="oklch(0.10 0.008 250)" />
      <path
        d="M32 9a23 23 0 1 1 0 46 23 23 0 0 1 0-46Z"
        stroke="oklch(0.25 0.008 250)"
        strokeWidth="2"
      />
      <path d="M32 8v8M32 48v8M8 32h8M48 32h8" stroke="oklch(0.32 0.01 250)" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 45 45 20" stroke="oklch(0.80 0.14 195)" strokeWidth="1.4" strokeLinecap="round" opacity=".28" />
      <path d="M32 32 50 16" stroke="url(#aeroscope-gradient)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M43.6 18.9 53.7 13.4 49.2 24.1l-2.4-4-4.4-.3Z" fill="url(#aeroscope-gradient)" />
      <circle cx="32" cy="32" r="3.2" fill="oklch(0.10 0.008 250)" stroke="oklch(0.82 0.14 160)" strokeWidth="2" />
      <defs>
        <linearGradient
          id="aeroscope-gradient"
          x1="10"
          y1="8"
          x2="54"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="oklch(0.80 0.14 195)" />
          <stop offset=".52" stopColor="oklch(0.72 0.18 155)" />
          <stop offset="1" stopColor="oklch(0.96 0.005 250)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
