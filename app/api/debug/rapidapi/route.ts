import { fetchAircraftMetadata, searchFlightRoute } from "@/lib/aerodatabox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["fra1", "cdg1", "dub1"];

function isDebugEnabled() {
  return process.env.AEROSCOPE_DEBUG_API === "1";
}

export async function GET(req: Request) {
  if (!isDebugEnabled()) {
    return Response.json({ error: "Debug API disabled" }, { status: 404 });
  }

  const url = new URL(req.url);
  const started = Date.now();
  const icao24 = url.searchParams.get("icao24")?.trim();
  const q = url.searchParams.get("q")?.trim();

  if (!icao24 && !q) {
    return Response.json({ error: "Provide either ?icao24=... or ?q=..." }, { status: 400 });
  }

  try {
    if (icao24) {
      const data = await fetchAircraftMetadata(icao24);
      return Response.json({
        provider: "rapidapi-aerodatabox",
        kind: "aircraft",
        ms: Date.now() - started,
        data,
      });
    }

    const data = await searchFlightRoute(q ?? "");
    return Response.json({
      provider: "rapidapi-aerodatabox",
      kind: "flight-route",
      ms: Date.now() - started,
      data,
    });
  } catch (err) {
    return Response.json(
      {
        provider: "rapidapi-aerodatabox",
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
