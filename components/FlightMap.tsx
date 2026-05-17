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
const ALTITUDE_CATEGORIES = [
  { label: "Ground", maxFeet: 0, color: [148, 163, 184, 220], hex: "#94a3b8" },
  { label: "0-10k", maxFeet: 10_000, color: [217, 119, 6, 230], hex: "#d97706" },
  { label: "10-20k", maxFeet: 20_000, color: [101, 163, 13, 230], hex: "#65a30d" },
  { label: "20-30k", maxFeet: 30_000, color: [8, 145, 178, 230], hex: "#0891b2" },
  { label: "30k+", maxFeet: Infinity, color: [79, 70, 229, 230], hex: "#4f46e5" },
] satisfies {
  label: string;
  maxFeet: number;
  color: [number, number, number, number];
  hex: string;
}[];

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

function altitudeColor(aircraft: Aircraft): [number, number, number, number] {
  const unknownCategory = ALTITUDE_CATEGORIES[0].color;
  if (aircraft.onGround) return unknownCategory;
  const feet = altitudeFeet(aircraft);
  if (feet === null) return unknownCategory;

  return (
    ALTITUDE_CATEGORIES.slice(1).find((category) => feet <= category.maxFeet)?.color ??
    ALTITUDE_CATEGORIES[ALTITUDE_CATEGORIES.length - 1].color
  );
}

function AltitudeLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-56 rounded-md border border-white/10 bg-zinc-950/75 px-3 py-2 text-[9px] text-zinc-300 shadow-2xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-normal text-zinc-400">Altitude (ft)</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {ALTITUDE_CATEGORIES.map((category) => (
          <div key={category.label} className="h-2 rounded-sm" style={{ backgroundColor: category.hex }} />
        ))}
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1 text-center text-zinc-400">
        {ALTITUDE_CATEGORIES.map((category) => (
          <span key={category.label} className="truncate">
            {category.label}
          </span>
        ))}
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
        id: "aircraft-border",
        data: aircraft,
        pickable: false,
        iconAtlas: iconUrl,
        iconMapping: {
          plane: { x: 0, y: 0, width: 64, height: 64, mask: true, anchorX: 32, anchorY: 32 },
        },
        getIcon: () => "plane",
        sizeUnits: "pixels",
        getSize: (d) => (d.icao24 === selectedIcao24 ? 38 : 22),
        getPosition: (d) => [d.longitude, d.latitude],
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: [5, 5, 7, 230],
        updateTriggers: {
          getSize: selectedIcao24,
        },
      }),
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
        getColor: altitudeColor,
        updateTriggers: {
          getSize: selectedIcao24,
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
