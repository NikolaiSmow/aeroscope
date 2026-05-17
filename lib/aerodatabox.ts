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

export type FlightAirport = {
  icao: string | null;
  iata: string | null;
  name: string;
  municipalityName: string | null;
  latitude: number;
  longitude: number;
};

export type FlightRoute = {
  number: string | null;
  callSign: string | null;
  status: string | null;
  distanceNm: number | null;
  distanceKm: number | null;
  departure: FlightAirport;
  arrival: FlightAirport;
  departureScheduledUtc: string | null;
  departureRevisedUtc: string | null;
  departureTerminal: string | null;
  arrivalScheduledUtc: string | null;
  arrivalRevisedUtc: string | null;
  arrivalTerminal: string | null;
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

type RawFlightAirport = {
  icao?: string | null;
  iata?: string | null;
  name?: string;
  shortName?: string | null;
  municipalityName?: string | null;
  location?: { lat?: number; lon?: number };
};

type RawFlightTime = {
  utc?: string;
  local?: string;
};

type RawFlightMovement = {
  airport?: RawFlightAirport;
  scheduledTime?: RawFlightTime;
  revisedTime?: RawFlightTime;
  terminal?: string | null;
};

type RawFlightResponse = {
  greatCircleDistance?: {
    km?: number;
    nm?: number;
  };
  number?: string;
  callSign?: string | null;
  status?: string | null;
  departure?: RawFlightMovement;
  arrival?: RawFlightMovement;
};

const HOST = "aerodatabox.p.rapidapi.com";
const KEY_PREFIX = "ft:aircraft:";
const ROUTE_KEY_PREFIX = "ft:route:";
const L1_TTL_MS = 24 * 60 * 60 * 1000;
const L2_TTL_SEC = 30 * 24 * 60 * 60;
const ROUTE_TTL_MS = 12 * 60 * 60 * 1000;
const ROUTE_TTL_SEC = 12 * 60 * 60;

type Envelope = { data: AircraftMetadata | null };
type RouteEnvelope = { data: FlightRoute | null };

const l1 = new Map<string, { at: number; data: AircraftMetadata | null }>();
const routeL1 = new Map<string, { at: number; data: FlightRoute | null }>();

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
  const url = `https://${HOST}/aircrafts/Icao24/${encodeURIComponent(icao24)}?withImage=true`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`AeroDataBox ${res.status}: ${await res.text().catch(() => "")}`);
  }
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

function mapAirport(raw: RawFlightAirport | undefined): FlightAirport | null {
  const lat = raw?.location?.lat;
  const lon = raw?.location?.lon;
  if (typeof lat !== "number" || typeof lon !== "number" || !raw?.name) return null;
  return {
    icao: raw.icao ?? null,
    iata: raw.iata ?? null,
    name: raw.name,
    municipalityName: raw.municipalityName ?? null,
    latitude: lat,
    longitude: lon,
  };
}

function mapFlightRoute(raw: RawFlightResponse): FlightRoute | null {
  const departure = mapAirport(raw.departure?.airport);
  const arrival = mapAirport(raw.arrival?.airport);
  if (!departure || !arrival) return null;
  return {
    number: raw.number ?? null,
    callSign: raw.callSign ?? null,
    status: raw.status ?? null,
    distanceNm: raw.greatCircleDistance?.nm ?? null,
    distanceKm: raw.greatCircleDistance?.km ?? null,
    departure,
    arrival,
    departureScheduledUtc: raw.departure?.scheduledTime?.utc ?? null,
    departureRevisedUtc: raw.departure?.revisedTime?.utc ?? null,
    departureTerminal: raw.departure?.terminal ?? null,
    arrivalScheduledUtc: raw.arrival?.scheduledTime?.utc ?? null,
    arrivalRevisedUtc: raw.arrival?.revisedTime?.utc ?? null,
    arrivalTerminal: raw.arrival?.terminal ?? null,
  };
}

async function fetchRouteBy(searchBy: "CallSign" | "Icao24" | "Number", value: string): Promise<FlightRoute | null> {
  const headers = rapidHeaders();
  if (!headers) return null;
  const url = `https://${HOST}/flights/${searchBy}/${encodeURIComponent(value)}?withLocation=false&withAircraftImage=false`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`AeroDataBox ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const raw = (await res.json()) as RawFlightResponse[];
  return raw.map(mapFlightRoute).find((route): route is FlightRoute => route !== null) ?? null;
}

export async function fetchFlightRoute(params: {
  icao24: string;
  callsign?: string | null;
}): Promise<FlightRoute | null> {
  const key = (params.callsign || params.icao24).toLowerCase();

  const l1Hit = routeL1.get(key);
  if (l1Hit && Date.now() - l1Hit.at < ROUTE_TTL_MS) return l1Hit.data;

  const redis = getRedis();
  if (redis) {
    try {
      const envelope = await redis.get<RouteEnvelope>(ROUTE_KEY_PREFIX + key);
      if (envelope) {
        routeL1.set(key, { at: Date.now(), data: envelope.data });
        return envelope.data;
      }
    } catch {
      /* fall through to upstream on transient Redis error */
    }
  }

  const normalizedCallsign = params.callsign?.replace(/\s+/g, "");
  const data = normalizedCallsign
    ? (await fetchRouteBy("CallSign", normalizedCallsign)) ?? (await fetchRouteBy("Icao24", params.icao24))
    : await fetchRouteBy("Icao24", params.icao24);

  routeL1.set(key, { at: Date.now(), data });
  if (redis) {
    redis
      .set(ROUTE_KEY_PREFIX + key, { data } satisfies RouteEnvelope, { ex: ROUTE_TTL_SEC })
      .catch(() => {
        /* best-effort write-back */
      });
  }
  return data;
}

export async function searchFlightRoute(query: string): Promise<FlightRoute | null> {
  const normalized = query.trim().replace(/\s+/g, "");
  if (!normalized) return null;

  const key = `search:${normalized.toLowerCase()}`;
  const l1Hit = routeL1.get(key);
  if (l1Hit && Date.now() - l1Hit.at < ROUTE_TTL_MS) return l1Hit.data;

  const redis = getRedis();
  if (redis) {
    try {
      const envelope = await redis.get<RouteEnvelope>(ROUTE_KEY_PREFIX + key);
      if (envelope) {
        routeL1.set(key, { at: Date.now(), data: envelope.data });
        return envelope.data;
      }
    } catch {
      /* fall through to upstream on transient Redis error */
    }
  }

  const data = /^[0-9a-f]{6}$/i.test(normalized)
    ? await fetchRouteBy("Icao24", normalized)
    : (await fetchRouteBy("CallSign", normalized)) ?? (await fetchRouteBy("Number", normalized));

  routeL1.set(key, { at: Date.now(), data });
  if (redis) {
    redis
      .set(ROUTE_KEY_PREFIX + key, { data } satisfies RouteEnvelope, { ex: ROUTE_TTL_SEC })
      .catch(() => {
        /* best-effort write-back */
      });
  }
  return data;
}
