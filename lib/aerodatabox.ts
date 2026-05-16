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

function authHeaders(): Record<string, string> | null {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  return {
    "x-rapidapi-key": key,
    "x-rapidapi-host": HOST,
    Accept: "application/json",
  };
}

const cache = new Map<string, { at: number; data: AircraftMetadata | null }>();
const TTL_MS = 24 * 60 * 60 * 1000;

export async function fetchAircraftMetadata(icao24: string): Promise<AircraftMetadata | null> {
  const key = icao24.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  const headers = authHeaders();
  if (!headers) {
    const empty: AircraftMetadata = {
      icao24: key,
      registration: null,
      model: null,
      manufacturer: null,
      airline: null,
      imageUrl: null,
      productionLine: null,
    };
    cache.set(key, { at: Date.now(), data: empty });
    return empty;
  }

  const url = `https://${HOST}/aircrafts/icao24/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    cache.set(key, { at: Date.now(), data: null });
    return null;
  }
  const raw = (await res.json()) as RawAircraftResponse;
  const data: AircraftMetadata = {
    icao24: key,
    registration: raw.reg ?? null,
    model: raw.model ?? raw.typeName ?? raw.modelCode ?? null,
    manufacturer: raw.productionLine ?? null,
    airline: raw.airlineName ?? raw.airline?.name ?? null,
    imageUrl: raw.image?.url ?? null,
    productionLine: raw.productionLine ?? null,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
