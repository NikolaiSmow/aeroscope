"use client";

import { useEffect } from "react";
import { useFlightStore } from "@/lib/store";
import type { Aircraft, BBox } from "@/lib/opensky";

const POLL_INTERVAL_MS = 60_000;

function bboxToQuery(bbox: BBox): string {
  return `?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
}

export function FlightStream() {
  const viewBBox = useFlightStore((s) => s.viewBBox);
  const setAircraft = useFlightStore((s) => s.setAircraft);
  const setStatus = useFlightStore((s) => s.setStatus);

  useEffect(() => {
    if (!viewBBox) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const url = `/api/stream${bboxToQuery(viewBBox)}`;

    const poll = async () => {
      setStatus("connecting");
      try {
        const res = await fetch(url, { cache: "no-store" });
        const payload = (await res.json()) as {
          time: number;
          aircraft: Aircraft[];
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error ?? "Unable to load OpenSky states");
        if (cancelled) return;
        setAircraft(payload.aircraft, payload.time);
        setStatus("live");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "";
        setStatus(message.toLowerCase().includes("too many requests") ? "rate-limited" : "error");
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [viewBBox, setAircraft, setStatus]);

  return null;
}
