import { fetchAircraftMetadata } from "@/lib/aerodatabox";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ icao24: string }> }) {
  const { icao24 } = await params;
  if (!/^[0-9a-fA-F]{6}$/.test(icao24)) {
    return Response.json({ error: "invalid icao24" }, { status: 400 });
  }
  try {
    const data = await fetchAircraftMetadata(icao24);
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
