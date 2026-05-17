import { fetchStates, type Aircraft, type BBox } from "./opensky";

type Subscriber = {
  id: number;
  bbox: BBox | null;
  send: (payload: { time: number; aircraft: Aircraft[] }) => void;
  fail: (err: unknown) => void;
};

const LIVE_CACHE_TTL_MS = 5 * 60_000;
const ACTIVE_INTERVAL_MS = LIVE_CACHE_TTL_MS;
const RATE_LIMIT_BACKOFF_MS = 15 * 60_000;
const STREAM_HUB_VERSION = "opensky-global-cache-v1";

class StreamHub {
  private subscribers = new Map<number, Subscriber>();
  private nextId = 1;
  private timer: NodeJS.Timeout | null = null;
  private lastFetchAt = 0;
  private lastRateLimitAt = 0;
  private lastPayload: { time: number; aircraft: Aircraft[] } | null = null;
  private inFlight: Promise<void> | null = null;

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
    void this.tick();
    this.timer = setInterval(() => this.tick(), ACTIVE_INTERVAL_MS);
  }

  private stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.inFlight) return this.inFlight;
    if (this.subscribers.size === 0) {
      this.stop();
      return;
    }
    const now = Date.now();
    if (this.lastPayload && now - this.lastFetchAt < LIVE_CACHE_TTL_MS) {
      this.publish(this.lastPayload);
      return;
    }
    if (this.lastPayload && now - this.lastRateLimitAt < RATE_LIMIT_BACKOFF_MS) {
      this.publish(this.lastPayload);
      this.notifyError(new Error("Too many requests: serving cached OpenSky data"));
      return;
    }

    this.inFlight = (async () => {
      try {
        const payload = await fetchStates();
        this.lastFetchAt = Date.now();
        this.lastPayload = payload;
        this.publish(payload);
      } catch (err) {
        if (isRateLimitError(err)) this.lastRateLimitAt = Date.now();
        if (this.lastPayload) this.publish(this.lastPayload);
        this.notifyError(err);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  private publish(payload: { time: number; aircraft: Aircraft[] }) {
    for (const sub of this.subscribers.values()) {
      const filtered = sub.bbox ? filterToBBox(payload.aircraft, sub.bbox) : payload.aircraft;
      sub.send({ time: payload.time, aircraft: filtered });
    }
  }

  private notifyError(err: unknown) {
    for (const sub of this.subscribers.values()) sub.fail(err);
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

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes("too many requests");
}

declare global {
  var __flightStreamHub: StreamHub | undefined;
  var __flightStreamHubVersion: string | undefined;
}

if (globalThis.__flightStreamHubVersion !== STREAM_HUB_VERSION) {
  globalThis.__flightStreamHub = new StreamHub();
  globalThis.__flightStreamHubVersion = STREAM_HUB_VERSION;
}

export const streamHub: StreamHub = globalThis.__flightStreamHub ?? new StreamHub();
if (!globalThis.__flightStreamHub) globalThis.__flightStreamHub = streamHub;
