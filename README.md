# AeroScope

AeroScope is a Next.js web app for live aircraft tracking and lightweight flight intelligence. It combines OpenSky live state vectors with optional AeroDataBox metadata and route lookups, while keeping free-tier API usage explicit and cache-first.

## What It Provides

- Live aircraft map with MapLibre, deck.gl, altitude-based aircraft colors, and bright/dark base-map switching.
- Server-Sent Events stream that fans one cached OpenSky response out to all connected clients.
- Manual AeroDataBox lookups for aircraft details, route endpoints, airport timing, and route progress.
- Search by visible callsign/ICAO24, with a manual AeroDataBox fallback for flight callsigns or flight numbers.

## Tech Stack

- **Next.js 16 App Router** with React 19 and TypeScript
- **Tailwind CSS v4** for UI styling
- **MapLibre GL** and **deck.gl** for map rendering
- **Zustand** for client UI state
- **TanStack Query** for manual metadata/route query state
- **OpenSky Network**, **AeroDataBox**, and optional **Upstash Redis**

## Local Development

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>.

Useful checks:

```bash
npm run lint
npm run build
```

## Main Routes

| Route | Purpose |
| --- | --- |
| `/` | Map shell and aircraft tracking UI |
| `/api/stream` | SSE feed for cached OpenSky aircraft states |
| `/api/aircraft/[icao24]` | AeroDataBox aircraft metadata proxy |
| `/api/flight-route/[icao24]` | AeroDataBox route lookup by ICAO24/callsign |
| `/api/flight-search` | AeroDataBox route lookup by flight/callsign query |

## Documentation

- [Architecture](docs/architecture.md)
- [Integration/API](docs/integration.md)
- [Operations](docs/operations.md)
- [Changelog](docs/CHANGELOG.md)

## Key Files

| Path | Why it matters |
| --- | --- |
| `components/MapShell.tsx` | Top-level UI composition for map, search, status, and side panel |
| `components/FlightMap.tsx` | MapLibre/deck.gl layers, route overlay, map styles, altitude legend |
| `components/AircraftPanel.tsx` | Selected aircraft panel, manual AeroDataBox actions, route progress widget |
| `components/SearchBar.tsx` | Local aircraft search and manual route-search fallback |
| `lib/stream-hub.ts` | Singleton OpenSky polling, caching, fan-out, and rate-limit backoff |
| `lib/opensky.ts` | OpenSky client and state-vector mapping |
| `lib/aerodatabox.ts` | AeroDataBox clients, response mapping, and cache layers |
| `lib/store.ts` | Shared client state for aircraft, selection, route, map bbox, and stream status |

## Indexing

The app is non-indexable by default via `robots` metadata in `app/layout.tsx`.
