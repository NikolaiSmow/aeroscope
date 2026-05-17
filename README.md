# Flight Tracker

Live global flight tracking — a Flightradar24-style web app built on free aviation APIs.

## Stack

- **Next.js 15 (App Router)** + TypeScript + Tailwind v4
- **MapLibre GL** + **deck.gl** `IconLayer` for GPU-accelerated aircraft rendering
- **Server-Sent Events** route handler with a singleton poll loop (one OpenSky request fan-out to all clients)
- **Zustand** for UI state, **TanStack Query** for metadata caching

## Data sources

- **OpenSky Network** — live state vectors (`/api/states/all`, bbox-filtered). Anonymous = 10s resolution / 400 daily credits per IP. Auth = 5s / 4 000 credits.
- **AeroDataBox** (RapidAPI) — manually-loaded aircraft metadata and flight route lookups. Basic plan is treated as scarce quota: 600 API units/month and 2 400 requests/month hard limits. Optional.

## Caching

Live positions are cached server-side for 5 minutes in the singleton SSE loop. The stream fans one OpenSky response out to all clients, reuses cached data across reconnects/map moves, and backs off for 15 minutes if OpenSky rate-limits anonymous access. AeroDataBox calls are intentionally manual-only: selecting a plane does not spend RapidAPI quota. The details panel only calls AeroDataBox after clicking **Load details and route**.

- **OpenSky live cache — in-memory singleton**, 5 min TTL, per-process. Keeps anonymous continuous use below the 400 credits/day budget.
- **AeroDataBox browser cache — `localStorage`**, 30 d TTL, avoids repeat lookups from the same browser.
- **AeroDataBox HTTP cache — route response**, 30 d TTL with 1 d stale-while-revalidate.
- **AeroDataBox L1 — in-memory `Map`**, 24 h TTL, per-process. Hot path for repeated clicks on the same aircraft.
- **AeroDataBox L2 — Upstash Redis** (optional, free tier), 30 d TTL, shared across instances and survives restarts. Configured via `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Falls back to L1/browser-only if not set.

Negative results (AeroDataBox returns nothing for the ICAO24) are cached the same way to avoid burning quota on military/private aircraft repeatedly.

Flight routes use AeroDataBox Flight Status by callsign/ICAO24 (Tier 2). They are cached for 12 h because flight status changes during the day.

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
