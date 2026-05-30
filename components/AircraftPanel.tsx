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

/* ── Formatting helpers ── */

function metersToFeet(m: number | null): number | null {
  return m === null ? null : Math.round(m * 3.28084);
}

function mpsToKnots(v: number | null): number | null {
  return v === null ? null : Math.round(v * 1.94384);
}

function verticalRateFpm(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Math.round(v * 196.85);
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

/* ── Sub-components ── */

function Metric({ label, value, unit, span }: { label: string; value: string | number | null; unit?: string; span?: boolean }) {
  if (value === null) return null;
  return (
    <div className={span ? "col-span-2" : ""}>
      <div className="text-[10px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums leading-tight" style={{ color: "var(--text-primary)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className="font-medium text-right" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[0.08em] first:mt-0" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </div>
  );
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
    <div className="rounded-xl p-3.5" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="min-w-0">
          <div className="truncate text-2xl font-semibold leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>{airportCode(route.departure)}</div>
          <div className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            {airportName(route.departure)}
          </div>
        </div>
        <div
          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          <Plane size={18} fill="currentColor" strokeWidth={0} />
        </div>
        <div className="min-w-0 text-right">
          <div className="truncate text-2xl font-semibold leading-none tracking-tight" style={{ color: "var(--text-primary)" }}>{airportCode(route.arrival)}</div>
          <div className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            {airportName(route.arrival)}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${progress}%`, background: "var(--accent)" }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-700"
          style={{
            left: `${markerPosition}%`,
            background: "var(--accent)",
            boxShadow: `0 0 8px var(--accent), 0 0 2px var(--accent)`,
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
        <span className="min-w-0 truncate">{routeTimeLabel("Departed", departureTime) ?? "Departure unknown"}</span>
        <span className="min-w-0 truncate text-right">{routeTimeLabel("Lands", arrivalTime) ?? route.status ?? "Arrival unknown"}</span>
      </div>
    </div>
  );
}

/* ── Main panel ── */

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

  const alt = metersToFeet(selected?.geoAltitude ?? selected?.baroAltitude ?? null);
  const spd = mpsToKnots(selected?.velocity ?? null);
  const hdg = selected?.trueTrack !== null && selected?.trueTrack !== undefined ? Math.round(selected.trueTrack) : null;
  const vsi = verticalRateFpm(selected?.verticalRate);

  return (
    <aside
      className="panel-enter absolute right-0 top-0 z-10 h-full w-full max-w-sm overflow-y-auto p-5 shadow-2xl"
      style={{
        background: "oklch(0.10 0.008 250 / 0.92)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {selected?.callsign || meta?.registration || selectedIcao24.toUpperCase()}
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-sm">
            {meta?.airline && <span style={{ color: "var(--text-secondary)" }}>{meta.airline}</span>}
            {meta?.model && (
              <>
                {meta?.airline && <span style={{ color: "var(--border)" }}>·</span>}
                <span style={{ color: "var(--text-tertiary)" }}>{meta.model}</span>
              </>
            )}
            {!meta?.airline && !meta?.model && selected?.originCountry && (
              <span style={{ color: "var(--text-tertiary)" }}>{selected.originCountry}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => select(null)}
          className="shrink-0 rounded-lg p-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Aircraft image ── */}
      {meta?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.imageUrl}
          alt={meta.model ?? "Aircraft"}
          className="mt-4 w-full rounded-xl object-cover"
          style={{ border: "1px solid var(--border)", maxHeight: 160 }}
        />
      )}

      {/* ── Load data CTA ── */}
      {hasMetadataKey && (needsMetadata || needsRoute) && (
        <button
          type="button"
          onClick={() => void loadAeroData()}
          disabled={isLoadingAeroData || !selected}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 disabled:cursor-wait disabled:opacity-50"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid oklch(0.75 0.12 195 / 0.2)",
          }}
        >
          <Database size={14} />
          {isLoadingAeroData
            ? "Loading..."
            : isFetched || isRouteFetched
              ? "Load missing data"
              : "Load details and route"}
        </button>
      )}

      {/* ── Telemetry ── */}
      <SectionLabel>Live telemetry</SectionLabel>
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl p-3.5"
        style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
      >
        <Metric label="Altitude" value={alt} unit="ft" />
        <Metric label="Speed" value={spd} unit="kts" />
        <Metric label="Heading" value={hdg !== null ? `${hdg}°` : null} />
        <Metric
          label="Vertical rate"
          value={vsi}
          unit="ft/min"
        />
        <Metric label="Squawk" value={selected?.squawk ?? null} />
        <Metric label="On ground" value={selected?.onGround ? "Yes" : "No"} />
      </div>
      {selected && (
        <div className="mt-2 text-right text-[11px] font-mono tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
        </div>
      )}

      {/* ── Route ── */}
      {(route || isRouteFetching || (hasMetadataKey && isRouteFetched)) && (
        <>
          <SectionLabel>Route</SectionLabel>
          {route && progress !== null && <RouteProgressWidget route={route} progress={progress} />}
          {route && (
            <div className="mt-2.5 space-y-0">
              <Row label="Flight" value={route.number ?? route.callSign ?? null} />
              <Row label="Status" value={route.status ?? null} />
              <Row label="Distance" value={formatDistance(route.distanceNm, route.distanceKm)} />
              <Row label="Depart" value={formatUtcTime(route.departureRevisedUtc ?? route.departureScheduledUtc ?? null)} />
              <Row label="Arrive" value={formatUtcTime(route.arrivalRevisedUtc ?? route.arrivalScheduledUtc ?? null)} />
              <Row label="Terminals" value={route.departureTerminal || route.arrivalTerminal ? `${route.departureTerminal ?? "?"} → ${route.arrivalTerminal ?? "?"}` : null} />
            </div>
          )}
          {isRouteFetching && <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>Loading route...</div>}
          {hasMetadataKey && !isRouteFetching && isRouteError && (
            <div className="mt-2 text-xs" style={{ color: "oklch(0.78 0.14 85)" }}>
              {routeErrorMessage?.includes("429") ? "Rate limited. Wait before retrying." : "No route data for this flight."}
            </div>
          )}
          {hasMetadataKey && isRouteFetched && !isRouteFetching && !isRouteError && !route && (
            <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>No route found.</div>
          )}
        </>
      )}

      {/* ── Aircraft details ── */}
      <SectionLabel>Aircraft</SectionLabel>
      <div className="space-y-0">
        <Row label="ICAO24" value={selectedIcao24.toUpperCase()} />
        <Row label="Origin" value={selected?.originCountry ?? null} />
        <Row label="Registration" value={meta?.registration ?? null} />
        <Row label="Type" value={meta?.model ?? null} />
        <Row label="Manufacturer" value={meta?.productionLine ?? meta?.manufacturer ?? null} />
      </div>
      {isFetching && <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>Loading metadata...</div>}
      {hasMetadataKey && !isFetching && isError && (
        <div className="mt-2 text-xs" style={{ color: "oklch(0.78 0.14 85)" }}>
          {errorMessage?.includes("not subscribed")
            ? "API key not subscribed. Subscribe on RapidAPI."
            : errorMessage?.includes("429")
              ? "Rate limited. Wait before retrying."
              : "No details returned."}
        </div>
      )}
      {hasMetadataKey && isFetched && !isFetching && !isError && !meta?.model && !meta?.registration && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>No extended metadata available.</div>
      )}
      {!hasMetadataKey && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
          Set RAPIDAPI_KEY in .env.local for extended metadata.
        </div>
      )}

      <div className="h-6" />
    </aside>
  );
}
