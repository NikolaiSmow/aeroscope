import { searchFlightRoute } from "@/lib/aerodatabox";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return Response.json({ error: "query must be at least 2 characters" }, { status: 400 });
  }

  try {
    const data = await searchFlightRoute(query);
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=43200, stale-while-revalidate=3600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: message }, { status: 502 });
  }
}
