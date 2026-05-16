"use client";

import { useFlightStore } from "@/lib/store";

const LABELS: Record<string, { text: string; color: string }> = {
  idle: { text: "Idle", color: "bg-zinc-500" },
  connecting: { text: "Connecting…", color: "bg-amber-400" },
  live: { text: "Live", color: "bg-emerald-400" },
  error: { text: "Connection error", color: "bg-rose-500" },
};

export function StatusBar() {
  const status = useFlightStore((s) => s.connectionStatus);
  const count = useFlightStore((s) => s.aircraft.length);
  const lastUpdate = useFlightStore((s) => s.lastUpdate);
  const meta = LABELS[status];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/80 backdrop-blur px-3 py-2 text-xs text-zinc-300">
      <span className={`inline-block h-2 w-2 rounded-full ${meta.color} animate-pulse`} />
      <span>{meta.text}</span>
      <span className="text-zinc-500">·</span>
      <span>
        <span className="text-zinc-100 font-medium">{count.toLocaleString()}</span> aircraft
      </span>
      {lastUpdate && (
        <>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">
            {new Date(lastUpdate * 1000).toLocaleTimeString()}
          </span>
        </>
      )}
    </div>
  );
}
