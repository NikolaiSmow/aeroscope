export type Aircraft = {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  geoAltitude: number | null;
  squawk: string | null;
};

export type BBox = {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
};

type RawStateVector = [
  string,
  string | null,
  string,
  number | null,
  number,
  number | null,
  number | null,
  number | null,
  boolean,
  number | null,
  number | null,
  number | null,
  number[] | null,
  number | null,
  string | null,
  boolean,
  number,
  number?,
];

type RawStatesResponse = {
  time: number;
  states: RawStateVector[] | null;
};

const ENDPOINT = "https://opensky-network.org/api/states/all";
const TOKEN_ENDPOINT =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TOKEN_REFRESH_MARGIN_MS = 30_000;
const OPENSKY_TIMEOUT_MS = 15_000;

type TokenResponse = {
  access_token: string;
  expires_in?: number;
};

let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string | null> | null = null;

function timeoutSignal(signal?: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENSKY_TIMEOUT_MS);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

async function fetchAccessToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return tokenCache.token;
  }

  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    const timeout = timeoutSignal();
    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });
      const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: timeout.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`OpenSky auth ${res.status}: ${await res.text().catch(() => "")}`);
      }
      const data = (await res.json()) as TokenResponse;
      tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
      };
      return tokenCache.token;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("OpenSky auth request timed out");
      }
      throw err;
    } finally {
      timeout.clear();
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await fetchAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchStates(bbox?: BBox, signal?: AbortSignal): Promise<{ time: number; aircraft: Aircraft[] }> {
  const url = new URL(ENDPOINT);
  if (bbox) {
    url.searchParams.set("lamin", String(bbox.lamin));
    url.searchParams.set("lomin", String(bbox.lomin));
    url.searchParams.set("lamax", String(bbox.lamax));
    url.searchParams.set("lomax", String(bbox.lomax));
  }
  const timeout = timeoutSignal(signal);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", ...(await authHeader()) },
      signal: timeout.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenSky states request timed out");
    }
    throw err;
  } finally {
    timeout.clear();
  }
  if (!res.ok) {
    throw new Error(`OpenSky ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as RawStatesResponse;
  const aircraft = (data.states ?? [])
    .map(mapState)
    .filter((a): a is Aircraft => a !== null);
  return { time: data.time, aircraft };
}

function mapState(s: RawStateVector): Aircraft | null {
  const longitude = s[5];
  const latitude = s[6];
  if (longitude === null || latitude === null) return null;
  return {
    icao24: s[0],
    callsign: s[1]?.trim() || null,
    originCountry: s[2],
    timePosition: s[3],
    lastContact: s[4],
    longitude,
    latitude,
    baroAltitude: s[7],
    onGround: s[8],
    velocity: s[9],
    trueTrack: s[10],
    verticalRate: s[11],
    geoAltitude: s[13] ?? null,
    squawk: s[14],
  };
}
