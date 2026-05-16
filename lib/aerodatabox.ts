import { Redis } from "@upstash/redis";

export type AircraftMetadata = {
  icao24: string;
  registration: string | null;
  model: string | null;
  manufacturer: string | null;
  airline: string | null;
  imageUrl: string | null;
  productionLine: string | null;
};

type RawAircraftResponse = {
  hexIcao?: string;
  reg?: string;
  modelCode?: string;
  model?: string;
  typeName?: string;
  airlineName?: string;
  airline?: { name?: string };
  productionLine?: string;
  image?: { url?: string };
};

const HOST = "aerodatabox.p.rapidapi.com";
const KEY_PREFIX = "ft:aircraft:";
const L1_TTL_MS = 60 * 60 * 1000;
const L2_TTL_SEC = 24 * 60 * 60;

type Envelope = { data: AircraftMetadata | null };

const l1 = new Map<string, { at: number; data: AircraftMetadata | null }>();

let redisInstance: Redis | null = null;
let redisChecked = false;
function getRedis(): Redis | null {
  if (redisChecked) return redisInstance;
  redisChecked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisInstance = new Redis({ url, token });
  return redisInstance;
}

function rapidHeaders(): Record<string, string> | null {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  return {
    "x-rapidapi-key": key,
    "x-rapidapi-host": HOST,
    Accept: "application/json",
  };
}

const EMPTY_META = (icao24: string): AircraftMetadata => ({
  icao24,
  registration: null,
  model: null,
  manufacturer: null,
  airline: null,
  imageUrl: null,
  productionLine: null,
});

async function fetchFromUpstream(icao24: string): Promise<AircraftMetadata | null> {
  const headers = rapidHeaders();
  if (!headers) return EMPTY_META(icao24);
  const url = `https://${HOST}/aircrafts/icao24/${encodeURIComponent(icao24)}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return null;
  const raw = (await res.json()) as RawAircraftResponse;
  return {
    icao24,
    registration: raw.reg ?? null,
    model: raw.model ?? raw.typeName ?? raw.modelCode ?? null,
    manufacturer: raw.productionLine ?? null,
    airline: raw.airlineName ?? raw.airline?.name ?? null,
    imageUrl: raw.image?.url ?? null,
    productionLine: raw.productionLine ?? null,
  };
}

export async function fetchAircraftMetadata(icao24: string): Promise<AircraftMetadata | null> {
  const key = icao24.toLowerCase();

  const l1Hit = l1.get(key);
  if (l1Hit && Date.now() - l1Hit.at < L1_TTL_MS) return l1Hit.data;

  const redis = getRedis();
  if (redis) {
    try {
      const envelope = await redis.get<Envelope>(KEY_PREFIX + key);
      if (envelope) {
        l1.set(key, { at: Date.now(), data: envelope.data });
        return envelope.data;
      }
    } catch {
      /* fall through to upstream on transient Redis error */
    }
  }

  const data = await fetchFromUpstream(key);

  l1.set(key, { at: Date.now(), data });
  if (redis) {
    redis
      .set(KEY_PREFIX + key, { data } satisfies Envelope, { ex: L2_TTL_SEC })
      .catch(() => {
        /* best-effort write-back */
      });
  }
  return data;
}
