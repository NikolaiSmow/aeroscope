import { fetchStates, type Aircraft, type BBox } from "./opensky";

type Subscriber = {
  id: number;
  bbox: BBox | null;
  send: (payload: { time: number; aircraft: Aircraft[] }) => void;
  fail: (err: unknown) => void;
};

const IDLE_INTERVAL_MS = 30_000;
const ACTIVE_INTERVAL_MS = 10_000;
const WORLD_BBOX: BBox = { lamin: -85, lomin: -180, lamax: 85, lomax: 180 };

class StreamHub {
  private subscribers = new Map<number, Subscriber>();
  private nextId = 1;
  private timer: NodeJS.Timeout | null = null;
  private lastTickAt = 0;
  private lastPayload: { time: number; aircraft: Aircraft[] } | null = null;

  subscribe(bbox: BBox | null, send: Subscriber["send"], fail: Subscriber["fail"]): () => void {
    const id = this.nextId++;
    this.subscribers.set(id, { id, bbox, send, fail });
    if (this.lastPayload) send(this.lastPayload);
    this.ensureRunning();
    return () => {
      this.subscribers.delete(id);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  private ensureRunning() {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), ACTIVE_INTERVAL_MS);
  }

  private stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private unionBBox(): BBox {
    let bbox: BBox | null = null;
    for (const sub of this.subscribers.values()) {
      if (!sub.bbox) return WORLD_BBOX;
      if (!bbox) {
        bbox = { ...sub.bbox };
      } else {
        bbox.lamin = Math.min(bbox.lamin, sub.bbox.lamin);
        bbox.lomin = Math.min(bbox.lomin, sub.bbox.lomin);
        bbox.lamax = Math.max(bbox.lamax, sub.bbox.lamax);
        bbox.lomax = Math.max(bbox.lomax, sub.bbox.lomax);
      }
    }
    return bbox ?? WORLD_BBOX;
  }

  private async tick() {
    if (this.subscribers.size === 0) {
      this.stop();
      return;
    }
    const now = Date.now();
    if (now - this.lastTickAt < IDLE_INTERVAL_MS / 4) return;
    this.lastTickAt = now;
    try {
      const bbox = this.unionBBox();
      const payload = await fetchStates(bbox);
      this.lastPayload = payload;
      for (const sub of this.subscribers.values()) {
        const filtered = sub.bbox ? filterToBBox(payload.aircraft, sub.bbox) : payload.aircraft;
        sub.send({ time: payload.time, aircraft: filtered });
      }
    } catch (err) {
      for (const sub of this.subscribers.values()) sub.fail(err);
    }
  }
}

function filterToBBox(list: Aircraft[], bbox: BBox): Aircraft[] {
  return list.filter(
    (a) =>
      a.latitude >= bbox.lamin &&
      a.latitude <= bbox.lamax &&
      a.longitude >= bbox.lomin &&
      a.longitude <= bbox.lomax,
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __flightStreamHub: StreamHub | undefined;
}

export const streamHub: StreamHub = globalThis.__flightStreamHub ?? new StreamHub();
if (!globalThis.__flightStreamHub) globalThis.__flightStreamHub = streamHub;
