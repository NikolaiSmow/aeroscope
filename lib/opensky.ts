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

function authHeader(): Record<string, string> {
  const user = process.env.OPENSKY_USER;
  const pass = process.env.OPENSKY_PASS;
  if (!user || !pass) return {};
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

export async function fetchStates(bbox?: BBox, signal?: AbortSignal): Promise<{ time: number; aircraft: Aircraft[] }> {
  const url = new URL(ENDPOINT);
  if (bbox) {
    url.searchParams.set("lamin", String(bbox.lamin));
    url.searchParams.set("lomin", String(bbox.lomin));
    url.searchParams.set("lamax", String(bbox.lamax));
    url.searchParams.set("lomax", String(bbox.lomax));
  }
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...authHeader() },
    signal,
    cache: "no-store",
  });
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
