import { streamHub } from "@/lib/stream-hub";
import type { BBox } from "@/lib/opensky";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["fra1", "cdg1", "dub1"];

function parseBBox(req: Request): BBox | null {
  const url = new URL(req.url);
  const lamin = url.searchParams.get("lamin");
  const lomin = url.searchParams.get("lomin");
  const lamax = url.searchParams.get("lamax");
  const lomax = url.searchParams.get("lomax");
  if (!lamin || !lomin || !lamax || !lomax) return null;
  const bbox = {
    lamin: Number(lamin),
    lomin: Number(lomin),
    lamax: Number(lamax),
    lomax: Number(lomax),
  };
  if (Object.values(bbox).some((v) => Number.isNaN(v))) return null;
  return bbox;
}

export async function GET(req: Request) {
  const bbox = parseBBox(req);
  const url = new URL(req.url);
  const anonymous = process.env.AEROSCOPE_DEBUG_API === "1" && url.searchParams.get("anonymous") === "1";
  try {
    return Response.json(await streamHub.snapshot(bbox, { anonymous }), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: message },
      {
        status: message.toLowerCase().includes("too many requests") ? 429 : 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}
