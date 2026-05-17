"use client";

import { useEffect } from "react";
import { useFlightStore } from "@/lib/store";
import type { Aircraft, BBox } from "@/lib/opensky";

function bboxToQuery(bbox: BBox): string {
  return `?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
}

export function FlightStream() {
  const viewBBox = useFlightStore((s) => s.viewBBox);
  const setAircraft = useFlightStore((s) => s.setAircraft);
  const setStatus = useFlightStore((s) => s.setStatus);

  useEffect(() => {
    if (!viewBBox) return;
    setStatus("connecting");
    const url = `/api/stream${bboxToQuery(viewBBox)}`;
    const es = new EventSource(url);

    es.addEventListener("hello", () => setStatus("connecting"));
    es.addEventListener("states", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          time: number;
          aircraft: Aircraft[];
        };
        setAircraft(payload.aircraft, payload.time);
        setStatus("live");
      } catch {
        /* ignore parse errors */
      }
    });
    es.addEventListener("error", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as { message?: string };
        const message = payload.message ?? "";
        setStatus(message.toLowerCase().includes("too many requests") ? "rate-limited" : "error");
      } catch {
        if (es.readyState === EventSource.CLOSED) setStatus("error");
      }
    });
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setStatus("error");
    };

    return () => es.close();
  }, [viewBBox, setAircraft, setStatus]);

  return null;
}
