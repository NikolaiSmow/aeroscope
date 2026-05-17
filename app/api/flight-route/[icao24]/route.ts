import { fetchFlightRoute } from "@/lib/aerodatabox";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ icao24: string }> }) {
  const { icao24 } = await params;
  if (!/^[0-9a-fA-F]{6}$/.test(icao24)) {
    return Response.json({ error: "invalid icao24" }, { status: 400 });
  }

  const callsign = new URL(req.url).searchParams.get("callsign");
  try {
    const data = await fetchFlightRoute({ icao24, callsign });
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=43200, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: message }, { status: 502 });
  }
}
