"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import { useFlightStore } from "@/lib/store";
import type { Aircraft } from "@/lib/opensky";

const TILE_STYLE = "https://tiles.openfreemap.org/styles/dark";

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

export function FlightMap() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  const aircraft = useFlightStore((s) => s.aircraft);
  const selectedIcao24 = useFlightStore((s) => s.selectedIcao24);
  const select = useFlightStore((s) => s.select);
  const setBBox = useFlightStore((s) => s.setBBox);

  useEffect(() => {
    setIconUrl(buildPlaneIconDataUrl());
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: [10, 50],
      zoom: 4,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    const overlay = new MapboxOverlay({ layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay as unknown as maplibregl.IControl);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

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

  const layers = useMemo(() => {
    if (!iconUrl) return [];
    return [
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
        getSize: (d) => (d.icao24 === selectedIcao24 ? 26 : 18),
        getPosition: (d) => [d.longitude, d.latitude],
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => {
          if (d.icao24 === selectedIcao24) return [253, 224, 71, 255];
          if (d.onGround) return [148, 163, 184, 220];
          return [56, 189, 248, 240];
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
  }, [aircraft, selectedIcao24, iconUrl, select]);

  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  return <div ref={containerRef} className="h-full w-full" />;
}
