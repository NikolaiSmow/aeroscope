# Flight Tracker

Live global flight tracking — a Flightradar24-style web app built on free aviation APIs.

## Stack

- **Next.js 15 (App Router)** + TypeScript + Tailwind v4
- **MapLibre GL** + **deck.gl** `IconLayer` for GPU-accelerated aircraft rendering
- **Server-Sent Events** route handler with a singleton poll loop (one OpenSky request fan-out to all clients)
- **Zustand** for UI state, **TanStack Query** for metadata caching

## Data sources

- **OpenSky Network** — live state vectors (`/api/states/all`, bbox-filtered). Anonymous = 10s resolution / 400 daily credits per IP. Auth = 5s / 4 000 credits.
- **AeroDataBox** (RapidAPI) — on-demand aircraft metadata (model, airline, image). Free trial 300–600 calls/month. Optional.

## Run locally

```bash
cp .env.local.example .env.local   # (optional) add OpenSky + RapidAPI keys
npm install
npm run dev
```

Open <http://localhost:3000>.

## Project layout

```
app/
  page.tsx                   Map + UI shell (client-rendered map via next/dynamic)
  api/stream/route.ts        SSE endpoint, subscribes to stream-hub
  api/aircraft/[icao24]/     Metadata proxy → AeroDataBox (cached)
components/
  FlightMap.tsx              MapLibre + deck.gl IconLayer
  FlightStream.tsx           EventSource client; updates the store
  AircraftPanel.tsx          Side panel on selection
  SearchBar.tsx              Callsign / ICAO24 lookup
  StatusBar.tsx              Connection + count + last-update indicator
lib/
  opensky.ts                 Typed client + state-vector → Aircraft mapper
  stream-hub.ts              Singleton poll loop, viewport-union, subscriber fan-out
  aerodatabox.ts             Metadata client with in-memory TTL cache
  store.ts                   Zustand store
```

## Roadmap

- PWA service worker + `next-pwa`
- Bubblewrap TWA → Android Play Store wrap
- Historical playback (paid OpenSky tier or self-hosted Postgres ingestion)
- Airport overlays + scheduled-flight lookup
