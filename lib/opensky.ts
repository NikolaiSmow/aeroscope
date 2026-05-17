import { request } from "node:https";

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

function httpsText(
  url: URL | string,
  init: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {},
): Promise<{ status: number; text: string }> {
  const target = typeof url === "string" ? new URL(url) : url;
  return new Promise((resolve, reject) => {
    const req = request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: init.method ?? "GET",
        headers: init.headers,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.setTimeout(OPENSKY_TIMEOUT_MS, () => {
      req.destroy(new Error(`OpenSky request timed out after ${OPENSKY_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);

    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy(new Error("OpenSky request aborted"));
      } else {
        init.signal.addEventListener("abort", () => req.destroy(new Error("OpenSky request aborted")), {
          once: true,
        });
      }
    }

    if (init.body) req.write(init.body);
    req.end();
  });
}

async function fetchAccessToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();
  const res = await httpsText(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OpenSky auth ${res.status}: ${res.text}`);
  }
  const data = JSON.parse(res.text) as TokenResponse;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  };
  return tokenCache.token;
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
  const res = await httpsText(url, {
    headers: { Accept: "application/json", ...(await authHeader()) },
    signal,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OpenSky ${res.status}: ${res.text}`);
  }
  const data = JSON.parse(res.text) as RawStatesResponse;
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
