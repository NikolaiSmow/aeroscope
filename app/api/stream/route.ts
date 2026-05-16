import { streamHub } from "@/lib/stream-hub";
import type { BBox } from "@/lib/opensky";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* connection closed */
        }
      };

      send("hello", { ok: true });

      const unsubscribe = streamHub.subscribe(
        bbox,
        (payload) => send("states", payload),
        (err) => send("error", { message: err instanceof Error ? err.message : String(err) }),
      );

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          /* connection closed */
        }
      }, 15_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
