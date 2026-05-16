"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useFlightStore } from "@/lib/store";
import type { AircraftMetadata } from "@/lib/aerodatabox";
import type { Aircraft } from "@/lib/opensky";

async function fetchMetadata(icao24: string): Promise<AircraftMetadata | null> {
  const res = await fetch(`/api/aircraft/${icao24}`);
  if (!res.ok) return null;
  return (await res.json()) as AircraftMetadata | null;
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

export function AircraftPanel() {
  const selectedIcao24 = useFlightStore((s) => s.selectedIcao24);
  const aircraft = useFlightStore((s) => s.aircraft);
  const select = useFlightStore((s) => s.select);

  const selected: Aircraft | null = selectedIcao24
    ? aircraft.find((a) => a.icao24 === selectedIcao24) ?? null
    : null;

  const { data: meta, isLoading } = useQuery({
    queryKey: ["aircraft", selectedIcao24],
    queryFn: () => fetchMetadata(selectedIcao24 as string),
    enabled: Boolean(selectedIcao24),
  });

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
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Aircraft details</h3>
        <Row label="ICAO24" value={selectedIcao24.toUpperCase()} />
        <Row label="Origin country" value={selected?.originCountry ?? null} />
        <Row label="Registration" value={meta?.registration ?? null} />
        <Row label="Model" value={meta?.model ?? null} />
        <Row label="Manufacturer" value={meta?.productionLine ?? meta?.manufacturer ?? null} />
        {isLoading && <div className="text-xs text-zinc-500 mt-2">Loading metadata…</div>}
        {!isLoading && !meta?.model && !meta?.registration && (
          <div className="text-xs text-zinc-500 mt-2">
            {process.env.NEXT_PUBLIC_HAS_METADATA_KEY === "1"
              ? "No extended metadata available for this aircraft."
              : "Set RAPIDAPI_KEY (AeroDataBox) in .env.local to enable extended metadata."}
          </div>
        )}
      </section>
    </aside>
  );
}
