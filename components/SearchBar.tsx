"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Loader2, Plane, Search } from "lucide-react";
import { useFlightStore } from "@/lib/store";
import type { FlightRoute } from "@/lib/aerodatabox";
import type { Aircraft } from "@/lib/opensky";

type SearchStatus = "idle" | "searching" | "not-found" | "route-only" | "error";

type RouteSearchError = {
  error?: string;
};

function normalize(value: string): string {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

function aircraftLabel(aircraft: Aircraft): string {
  return aircraft.callsign || aircraft.icao24.toUpperCase();
}

async function searchRoute(query: string): Promise<FlightRoute | null> {
  const res = await fetch(`/api/flight-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as RouteSearchError | null;
    throw new Error(body?.error ?? "Unable to search flight");
  }
  return (await res.json()) as FlightRoute | null;
}

export function SearchBar() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const aircraft = useFlightStore((s) => s.aircraft);
  const select = useFlightStore((s) => s.select);
  const setSelectedRoute = useFlightStore((s) => s.setSelectedRoute);

  const trimmed = q.trim();
  const needle = normalize(trimmed);
  const suggestions = useMemo(() => {
    if (!needle) return [];
    return aircraft
      .filter((item) => {
        const callsign = normalize(item.callsign ?? "");
        const icao24 = normalize(item.icao24);
        return callsign.includes(needle) || icao24.includes(needle);
      })
      .sort((a, b) => aircraftLabel(a).localeCompare(aircraftLabel(b)))
      .slice(0, 6);
  }, [aircraft, needle]);

  const choose = (item: Aircraft) => {
    setQ(aircraftLabel(item));
    setStatus("idle");
    setMessage(null);
    select(item.icao24);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;

    const exact =
      suggestions.find((item) => normalize(item.callsign ?? "") === needle || normalize(item.icao24) === needle) ??
      suggestions[0];
    if (exact) {
      choose(exact);
      return;
    }

    setStatus("searching");
    setMessage(null);
    try {
      const route = await searchRoute(trimmed);
      if (!route) {
        setStatus("not-found");
        setMessage("No live flight or route found.");
        return;
      }

      const routeCallsign = normalize(route.callSign ?? "");
      const routeNumber = normalize(route.number ?? "");
      const match = aircraft.find((item) => {
        const callsign = normalize(item.callsign ?? "");
        return Boolean(callsign && (callsign === routeCallsign || callsign === routeNumber));
      });

      if (match) {
        select(match.icao24);
        setSelectedRoute(route);
        setQ(route.callSign ?? route.number ?? trimmed);
        setStatus("idle");
        return;
      }

      select(null);
      setSelectedRoute(route);
      setStatus("route-only");
      setMessage(
        `${route.number ?? trimmed}: ${route.departure.iata ?? route.departure.icao ?? route.departure.name} to ${
          route.arrival.iata ?? route.arrival.icao ?? route.arrival.name
        }, but no matching live aircraft is loaded in this map view.`,
      );
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unable to search flight.");
    }
  };

  return (
    <div className="relative w-80">
      <form onSubmit={onSubmit} className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setStatus("idle");
            setMessage(null);
          }}
          placeholder="Flight, callsign, or ICAO24..."
          className="w-full rounded-lg border border-white/10 bg-zinc-950/80 py-2 pl-9 pr-9 text-sm text-zinc-100 backdrop-blur placeholder:text-zinc-500 focus:border-orange-300/70 focus:outline-none"
        />
        {status === "searching" && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-400"
          />
        )}
      </form>

      {trimmed && suggestions.length > 0 && status !== "searching" && (
        <div className="absolute left-0 top-11 z-30 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
          {suggestions.map((item) => (
            <button
              key={item.icao24}
              type="button"
              onClick={() => choose(item)}
              className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left transition last:border-b-0 hover:bg-white/5"
            >
              <Plane size={15} className="shrink-0 text-orange-300" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{aircraftLabel(item)}</span>
                <span className="block truncate text-xs text-zinc-500">
                  {item.icao24.toUpperCase()} · {item.originCountry}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {message && (
        <div className="absolute left-0 top-11 z-30 w-full rounded-lg border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs leading-relaxed text-zinc-300 shadow-2xl backdrop-blur">
          {message}
          {status === "route-only" && (
            <div className="mt-1 text-zinc-500">Move or zoom the map to the route area, then search again.</div>
          )}
        </div>
      )}
    </div>
  );
}
