"use client";

import { useFlightStore } from "@/lib/store";

const LABELS: Record<string, { text: string; dotColor: string }> = {
  idle: { text: "Idle", dotColor: "oklch(0.55 0.01 250)" },
  connecting: { text: "Connecting", dotColor: "oklch(0.80 0.16 85)" },
  live: { text: "Live", dotColor: "oklch(0.75 0.18 155)" },
  "rate-limited": { text: "Rate limited", dotColor: "oklch(0.80 0.16 85)" },
  error: { text: "Error", dotColor: "oklch(0.65 0.22 25)" },
};

export function StatusBar() {
  const status = useFlightStore((s) => s.connectionStatus);
  const count = useFlightStore((s) => s.aircraft.length);
  const lastUpdate = useFlightStore((s) => s.lastUpdate);
  const meta = LABELS[status];

  return (
    <div className="overlay-surface flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: meta.dotColor,
          boxShadow: status === "live" ? `0 0 6px ${meta.dotColor}` : undefined,
        }}
      />
      <span style={{ color: "var(--text-secondary)" }}>{meta.text}</span>
      <span style={{ color: "var(--border)" }}>·</span>
      <span>
        <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>{count.toLocaleString()}</span>
        <span style={{ color: "var(--text-secondary)" }}> aircraft</span>
      </span>
      {lastUpdate && (
        <>
          <span style={{ color: "var(--border)" }}>·</span>
          <span className="tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {new Date(lastUpdate * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </>
      )}
    </div>
  );
}
