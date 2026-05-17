"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer, LineLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import { useFlightStore } from "@/lib/store";
import type { Aircraft } from "@/lib/opensky";

const MAP_STYLES = {
  bright: {
    label: "Bright",
    url: "https://tiles.openfreemap.org/styles/bright",
  },
  dark: {
    label: "Dark",
    url: "https://tiles.openfreemap.org/styles/dark",
  },
} as const;
type MapStyleKey = keyof typeof MAP_STYLES;
const ALTITUDE_STOPS = [
  { feet: 0, color: [249, 115, 22, 240] },
  { feet: 1_000, color: [245, 158, 11, 240] },
  { feet: 4_000, color: [234, 179, 8, 240] },
  { feet: 8_000, color: [132, 204, 22, 240] },
  { feet: 10_000, color: [34, 197, 94, 240] },
  { feet: 20_000, color: [14, 165, 233, 240] },
  { feet: 30_000, color: [99, 102, 241, 240] },
  { feet: 40_000, color: [217, 70, 239, 240] },
] satisfies { feet: number; color: [number, number, number, number] }[];

function buildPlaneIconDataUrl(): string {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.lineTo(36, 28);
  ctx.lineTo(60, 40);
  ctx.lineTo(60, 46);
  ctx.lineTo(36, 40);
  ctx.lineTo(36, 52);
  ctx.lineTo(44, 58);
  ctx.lineTo(44, 60);
  ctx.lineTo(20, 60);
  ctx.lineTo(20, 58);
  ctx.lineTo(28, 52);
  ctx.lineTo(28, 40);
  ctx.lineTo(4, 46);
  ctx.lineTo(4, 40);
  ctx.lineTo(28, 28);
  ctx.closePath();
  ctx.fill();
  return canvas.toDataURL("image/png");
}

type RouteSegment = {
  from: [number, number];
  to: [number, number];
  color: [number, number, number, number];
  width: number;
};

function dashedSegments(from: [number, number], to: [number, number], count = 80): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (let i = 0; i < count; i += 2) {
    const a = i / count;
    const b = Math.min((i + 1) / count, 1);
    segments.push({
      from: [from[0] + (to[0] - from[0]) * a, from[1] + (to[1] - from[1]) * a],
      to: [from[0] + (to[0] - from[0]) * b, from[1] + (to[1] - from[1]) * b],
      color: [250, 204, 21, 220],
      width: 3,
    });
  }
  return segments;
}

function altitudeFeet(aircraft: Aircraft): number | null {
  const meters = aircraft.geoAltitude ?? aircraft.baroAltitude;
  return meters === null ? null : meters * 3.28084;
}

function mixColor(
  from: [number, number, number, number],
  to: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
    Math.round(from[3] + (to[3] - from[3]) * t),
  ];
}

function altitudeColor(aircraft: Aircraft): [number, number, number, number] {
  if (aircraft.onGround) return [148, 163, 184, 220];
  const feet = altitudeFeet(aircraft);
  if (feet === null) return [203, 213, 225, 220];

  for (let i = 0; i < ALTITUDE_STOPS.length - 1; i++) {
    const current = ALTITUDE_STOPS[i];
    const next = ALTITUDE_STOPS[i + 1];
    if (feet >= current.feet && feet <= next.feet) {
      const span = next.feet - current.feet;
      return mixColor(current.color, next.color, span ? (feet - current.feet) / span : 0);
    }
  }

  return ALTITUDE_STOPS[ALTITUDE_STOPS.length - 1].color;
}

function AltitudeLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-56 rounded-md border border-white/10 bg-zinc-950/75 px-3 py-2 text-[9px] text-zinc-300 shadow-2xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-normal text-zinc-400">Altitude (ft)</span>
      </div>
      <div className="h-2 rounded-sm bg-[linear-gradient(90deg,#f97316_0%,#f59e0b_10%,#eab308_22%,#84cc16_38%,#22c55e_50%,#0ea5e9_68%,#6366f1_84%,#d946ef_100%)]" />
      <div className="mt-1 flex justify-between text-zinc-400">
        <span>0</span>
        <span>1k</span>
        <span>4k</span>
        <span>8k</span>
        <span>10k</span>
        <span>20k</span>
        <span>30k</span>
        <span>40k+</span>
      </div>
    </div>
  );
}

function MapStyleControl({
  value,
  onChange,
}: {
  value: MapStyleKey;
  onChange: (value: MapStyleKey) => void;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-20 left-4 z-20 flex overflow-hidden rounded-md border border-white/15 bg-zinc-950/75 p-0.5 text-xs shadow-2xl backdrop-blur">
      {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded px-3 py-1.5 font-medium transition ${
            value === key
              ? "bg-white text-zinc-950"
              : "text-zinc-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          {MAP_STYLES[key].label}
        </button>
      ))}
    </div>
  );
}

export function FlightMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("bright");
  const iconUrl = useMemo(() => {
    if (typeof document === "undefined") return null;
    return buildPlaneIconDataUrl();
  }, []);

  const aircraft = useFlightStore((s) => s.aircraft);
  const selectedIcao24 = useFlightStore((s) => s.selectedIcao24);
  const selectedRoute = useFlightStore((s) => s.selectedRoute);
  const select = useFlightStore((s) => s.select);
  const setBBox = useFlightStore((s) => s.setBBox);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES.bright.url,
      center: [10, 50],
      zoom: 4,
      attributionControl: false,
    });
    mapRef.current = map;

    const overlay = new MapboxOverlay({ layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay as unknown as maplibregl.IControl);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    const publishBBox = () => {
      const b = map.getBounds();
      setBBox({
        lamin: b.getSouth(),
        lomin: b.getWest(),
        lamax: b.getNorth(),
        lomax: b.getEast(),
      });
    };
    map.on("load", publishBBox);
    map.on("moveend", publishBBox);

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, [setBBox]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAP_STYLES[mapStyle].url);
  }, [mapStyle]);

  const layers = useMemo(() => {
    if (!iconUrl) return [];
    const selectedAircraft = selectedIcao24
      ? aircraft.find((item) => item.icao24 === selectedIcao24)
      : null;
    const routeLayers =
      selectedRoute && selectedAircraft
        ? [
            new LineLayer<RouteSegment>({
              id: "route-traveled",
              data: [
                {
                  from: [selectedRoute.departure.longitude, selectedRoute.departure.latitude],
                  to: [selectedAircraft.longitude, selectedAircraft.latitude],
                  color: [34, 197, 94, 220],
                  width: 4,
                },
              ],
              getSourcePosition: (d) => d.from,
              getTargetPosition: (d) => d.to,
              getColor: (d) => d.color,
              getWidth: (d) => d.width,
              widthUnits: "pixels",
            }),
            new LineLayer<RouteSegment>({
              id: "route-remaining",
              data: dashedSegments(
                [selectedAircraft.longitude, selectedAircraft.latitude],
                [selectedRoute.arrival.longitude, selectedRoute.arrival.latitude],
              ),
              getSourcePosition: (d) => d.from,
              getTargetPosition: (d) => d.to,
              getColor: (d) => d.color,
              getWidth: (d) => d.width,
              widthUnits: "pixels",
            }),
          ]
        : [];
    return [
      ...routeLayers,
      new IconLayer<Aircraft>({
        id: "aircraft",
        data: aircraft,
        pickable: true,
        iconAtlas: iconUrl,
        iconMapping: {
          plane: { x: 0, y: 0, width: 64, height: 64, mask: true, anchorX: 32, anchorY: 32 },
        },
        getIcon: () => "plane",
        sizeUnits: "pixels",
        getSize: (d) => (d.icao24 === selectedIcao24 ? 32 : 18),
        getPosition: (d) => [d.longitude, d.latitude],
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => {
          if (d.icao24 === selectedIcao24) return [37, 99, 235, 255];
          return altitudeColor(d);
        },
        updateTriggers: {
          getSize: selectedIcao24,
          getColor: selectedIcao24,
        },
        onClick: (info) => {
          const d = info.object as Aircraft | undefined;
          if (d) select(d.icao24);
        },
      }),
    ];
  }, [aircraft, selectedIcao24, selectedRoute, iconUrl, select]);

  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MapStyleControl value={mapStyle} onChange={setMapStyle} />
      <AltitudeLegend />
    </div>
  );
}
