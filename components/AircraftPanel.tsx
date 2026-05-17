"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, Plane, X } from "lucide-react";
import { useFlightStore } from "@/lib/store";
import type { AircraftMetadata, FlightRoute } from "@/lib/aerodatabox";
import type { Aircraft } from "@/lib/opensky";

const CLIENT_METADATA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLIENT_ROUTE_TTL_MS = 12 * 60 * 60 * 1000;
const QUERY_CACHE_TTL_MS = 24 * 24 * 60 * 60 * 1000;
const metadataCacheKey = (icao24: string) => `ft:aircraft:v2:${icao24.toLowerCase()}`;
const routeCacheKey = (icao24: string, callsign?: string | null) =>
  `ft:route:v1:${(callsign || icao24).toLowerCase()}`;

type MetadataErrorResponse = {
  error?: string;
};

async function fetchMetadata(icao24: string): Promise<AircraftMetadata | null> {
  const key = metadataCacheKey(icao24);
  const cached = window.localStorage.getItem(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { at: number; data: AircraftMetadata | null };
      if (Date.now() - parsed.at < CLIENT_METADATA_TTL_MS) return parsed.data;
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  const res = await fetch(`/api/aircraft/${icao24}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as MetadataErrorResponse | null;
    throw new Error(body?.error ?? "Unable to load aircraft details");
  }
  const data = (await res.json()) as AircraftMetadata | null;
  if (data?.registration || data?.model) {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } else {
    window.localStorage.removeItem(key);
  }
  return data;
}

async function fetchRoute(aircraft: Aircraft): Promise<FlightRoute | null> {
  const key = routeCacheKey(aircraft.icao24, aircraft.callsign);
  const cached = window.localStorage.getItem(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { at: number; data: FlightRoute | null };
      if (Date.now() - parsed.at < CLIENT_ROUTE_TTL_MS) return parsed.data;
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  const params = aircraft.callsign ? `?callsign=${encodeURIComponent(aircraft.callsign)}` : "";
  const res = await fetch(`/api/flight-route/${aircraft.icao24}${params}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as MetadataErrorResponse | null;
    throw new Error(body?.error ?? "Unable to load route");
  }
  const data = (await res.json()) as FlightRoute | null;
  if (data?.departure && data?.arrival) {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } else {
    window.localStorage.removeItem(key);
  }
  return data;
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-white/5 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-100 text-right">{value}</span>
    </div>
  );
}

function metersToFeet(m: number | null): string | null {
  if (m === null) return null;
  return `${Math.round(m * 3.28084).toLocaleString()} ft`;
}

function mpsToKnots(v: number | null): string | null {
  if (v === null) return null;
  return `${Math.round(v * 1.94384).toLocaleString()} kts`;
}

function formatHeading(deg: number | null): string | null {
  if (deg === null) return null;
  return `${Math.round(deg)}°`;
}

function formatUtcTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function parseAeroDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

function routeTimeLabel(label: "Departed" | "Lands", value: string | null): string | null {
  const date = parseAeroDate(value);
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  if (label === "Departed") {
    return diff <= 0 ? `Departed ${formatDurationShort(Math.abs(diff))} ago` : `Departs in ${formatDurationShort(diff)}`;
  }
  return diff <= 0 ? `Landed ${formatDurationShort(Math.abs(diff))} ago` : `Lands in ${formatDurationShort(diff)}`;
}

function formatDistance(nm: number | null, km: number | null): string | null {
  if (nm === null && km === null) return null;
  if (nm !== null) return `${Math.round(nm).toLocaleString()} nm`;
  return `${Math.round(km ?? 0).toLocaleString()} km`;
}

function haversineNm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radiusNm = 3440.065;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const deltaLat = toRad(to.latitude - from.latitude);
  const deltaLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return radiusNm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeProgress(route: FlightRoute | null | undefined, selected: Aircraft | null): number | null {
  if (!route || !selected) return null;
  const totalNm =
    route.distanceNm ??
    haversineNm(route.departure, route.arrival);
  if (!totalNm) return null;
  const remainingNm = haversineNm(selected, route.arrival);
  return Math.max(0, Math.min(100, Math.round(((totalNm - remainingNm) / totalNm) * 100)));
}

function airportCode(airport: FlightRoute["departure"]): string {
  return airport.iata ?? airport.icao ?? airport.name;
}

function airportName(airport: FlightRoute["departure"]): string {
  return airport.municipalityName ?? airport.name;
}

function RouteProgressWidget({
  route,
  progress,
}: {
  route: FlightRoute;
  progress: number;
}) {
  const departureTime = route.departureRevisedUtc ?? route.departureScheduledUtc;
  const arrivalTime = route.arrivalRevisedUtc ?? route.arrivalScheduledUtc;
  const markerPosition = Math.max(12, Math.min(88, progress));

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-zinc-100 p-3 text-zinc-900 shadow-lg">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="min-w-0">
          <div className="truncate text-3xl font-semibold leading-none tracking-normal">{airportCode(route.departure)}</div>
          <div className="mt-1 truncate text-xs font-semibold uppercase tracking-normal text-zinc-600">
            {airportName(route.departure)}
          </div>
        </div>
        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-yellow-400 shadow-sm">
          <Plane size={26} fill="currentColor" strokeWidth={0} />
        </div>
        <div className="min-w-0 text-right">
          <div className="truncate text-3xl font-semibold leading-none tracking-normal">{airportCode(route.arrival)}</div>
          <div className="mt-1 truncate text-xs font-semibold uppercase tracking-normal text-zinc-600">
            {airportName(route.arrival)}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-2 rounded-full bg-zinc-300">
        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${progress}%` }} />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-yellow-400 shadow"
          style={{ left: `${markerPosition}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-zinc-600">
        <span className="min-w-0 truncate">{routeTimeLabel("Departed", departureTime) ?? "Departure time unknown"}</span>
        <span className="min-w-0 truncate text-right">{routeTimeLabel("Lands", arrivalTime) ?? route.status ?? "Arrival time unknown"}</span>
      </div>
    </div>
  );
}

export function AircraftPanel() {
  const selectedIcao24 = useFlightStore((s) => s.selectedIcao24);
  const aircraft = useFlightStore((s) => s.aircraft);
  const select = useFlightStore((s) => s.select);
  const setSelectedRoute = useFlightStore((s) => s.setSelectedRoute);

  const selected: Aircraft | null = selectedIcao24
    ? aircraft.find((a) => a.icao24 === selectedIcao24) ?? null
    : null;

  const {
    data: meta,
    isError,
    isFetched,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["aircraft", selectedIcao24],
    queryFn: () => fetchMetadata(selectedIcao24 as string),
    enabled: false,
    gcTime: QUERY_CACHE_TTL_MS,
    staleTime: QUERY_CACHE_TTL_MS,
  });

  const {
    data: route,
    isError: isRouteError,
    isFetched: isRouteFetched,
    isFetching: isRouteFetching,
    error: routeError,
    refetch: refetchRoute,
  } = useQuery({
    queryKey: ["flight-route", selectedIcao24, selected?.callsign],
    queryFn: async () => {
      if (!selected) return null;
      const data = await fetchRoute(selected);
      setSelectedRoute(data);
      return data;
    },
    enabled: false,
    gcTime: CLIENT_ROUTE_TTL_MS,
    staleTime: CLIENT_ROUTE_TTL_MS,
  });

  const hasMetadataKey = process.env.NEXT_PUBLIC_HAS_METADATA_KEY === "1";
  const errorMessage = error instanceof Error ? error.message : null;
  const routeErrorMessage = routeError instanceof Error ? routeError.message : null;
  const needsMetadata = !isFetched || isError || (!meta?.model && !meta?.registration);
  const needsRoute = !isRouteFetched || isRouteError || !route;
  const isLoadingAeroData = isFetching || isRouteFetching;
  const progress = routeProgress(route, selected);

  const loadAeroData = async () => {
    if (!selected) return;
    await Promise.allSettled([refetch(), refetchRoute()]);
  };

  if (!selectedIcao24) return null;

  return (
    <aside className="absolute right-0 top-0 z-10 h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-zinc-950/95 backdrop-blur p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Aircraft</div>
          <h2 className="text-2xl font-semibold text-white">
            {selected?.callsign || meta?.registration || selectedIcao24.toUpperCase()}
          </h2>
          {meta?.airline && <div className="text-sm text-zinc-400 mt-0.5">{meta.airline}</div>}
        </div>
        <button
          onClick={() => select(null)}
          className="text-zinc-400 hover:text-white transition rounded p-1 hover:bg-white/5"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {meta?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.imageUrl}
          alt={meta.model ?? "Aircraft"}
          className="mt-4 w-full rounded-lg border border-white/10"
        />
      )}

      {hasMetadataKey && (needsMetadata || needsRoute) && (
        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <button
            type="button"
            onClick={() => void loadAeroData()}
            disabled={isLoadingAeroData || !selected}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-wait disabled:opacity-60"
          >
            <Database size={15} />
            {isLoadingAeroData
              ? "Loading AeroDataBox data..."
              : isFetched || isRouteFetched
                ? "Load missing AeroDataBox data"
                : "Load details and route"}
          </button>
          <div className="mt-2 text-xs leading-relaxed text-zinc-500">
            Cache is checked first. Uncached route lookups use a Tier 2 request, so this stays manual for the Basic plan.
          </div>
        </div>
      )}

      <section className="mt-6">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Live position</h3>
        <Row label="Altitude" value={metersToFeet(selected?.geoAltitude ?? selected?.baroAltitude ?? null)} />
        <Row label="Speed" value={mpsToKnots(selected?.velocity ?? null)} />
        <Row label="Heading" value={formatHeading(selected?.trueTrack ?? null)} />
        <Row
          label="Vertical rate"
          value={selected?.verticalRate !== null && selected?.verticalRate !== undefined ? `${Math.round((selected.verticalRate ?? 0) * 196.85).toLocaleString()} ft/min` : null}
        />
        <Row label="On ground" value={selected?.onGround ? "Yes" : "No"} />
        <Row label="Squawk" value={selected?.squawk ?? null} />
        <Row
          label="Position"
          value={selected ? `${selected.latitude.toFixed(3)}, ${selected.longitude.toFixed(3)}` : null}
        />
      </section>

      <section className="mt-6">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Route</h3>
        {route && progress !== null && <RouteProgressWidget route={route} progress={progress} />}
        <Row label="Flight" value={route?.number ?? route?.callSign ?? null} />
        <Row
          label="From"
          value={
            route
              ? `${route.departure.iata ?? route.departure.icao ?? route.departure.name} · ${route.departure.municipalityName ?? route.departure.name}`
              : null
          }
        />
        <Row
          label="To"
          value={
            route
              ? `${route.arrival.iata ?? route.arrival.icao ?? route.arrival.name} · ${route.arrival.municipalityName ?? route.arrival.name}`
              : null
          }
        />
        <Row label="Status" value={route?.status ?? null} />
        <Row label="Distance" value={route ? formatDistance(route.distanceNm, route.distanceKm) : null} />
        <Row label="Depart" value={formatUtcTime(route?.departureRevisedUtc ?? route?.departureScheduledUtc ?? null)} />
        <Row label="Arrive" value={formatUtcTime(route?.arrivalRevisedUtc ?? route?.arrivalScheduledUtc ?? null)} />
        <Row label="Terminals" value={route?.departureTerminal || route?.arrivalTerminal ? `${route.departureTerminal ?? "?"} -> ${route.arrivalTerminal ?? "?"}` : null} />
        {isRouteFetching && <div className="text-xs text-zinc-500 mt-2">Loading route...</div>}
        {hasMetadataKey && !isRouteFetching && isRouteError && (
          <div className="text-xs text-amber-300 mt-2">
            {routeErrorMessage?.includes("429")
              ? "AeroDataBox rate-limited this route lookup. Wait before retrying to preserve the free-plan quota."
              : "AeroDataBox did not return route data for this flight."}
          </div>
        )}
        {hasMetadataKey && isRouteFetched && !isRouteFetching && !isRouteError && !route && (
          <div className="text-xs text-zinc-500 mt-2">No route found for this aircraft.</div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Aircraft details</h3>
        <Row label="ICAO24" value={selectedIcao24.toUpperCase()} />
        <Row label="Origin country" value={selected?.originCountry ?? null} />
        <Row label="Registration" value={meta?.registration ?? null} />
        <Row label="Model" value={meta?.model ?? null} />
        <Row label="Manufacturer" value={meta?.productionLine ?? meta?.manufacturer ?? null} />
        {isFetching && <div className="text-xs text-zinc-500 mt-2">Loading metadata...</div>}
        {hasMetadataKey && !isFetching && isError && (
          <div className="text-xs text-amber-300 mt-2">
            {errorMessage?.includes("not subscribed")
              ? "RapidAPI says this key is not subscribed to AeroDataBox. Open the AeroDataBox page in RapidAPI and subscribe to the Basic plan."
              : errorMessage?.includes("429")
                ? "AeroDataBox rate-limited this lookup. Wait before retrying to preserve the free-plan quota."
                : "AeroDataBox did not return details. Try again later to preserve the free-plan quota."}
          </div>
        )}
        {hasMetadataKey && isFetched && !isFetching && !isError && !meta?.model && !meta?.registration && (
          <div className="text-xs text-zinc-500 mt-2">No extended metadata available for this aircraft.</div>
        )}
        {!hasMetadataKey && (
          <div className="text-xs text-zinc-500 mt-2">
            Set RAPIDAPI_KEY (AeroDataBox) in .env.local to enable extended metadata.
          </div>
        )}
      </section>
    </aside>
  );
}
