# Operations

## Deployment Targets

AeroScope is a Next.js App Router application. It requires a Node.js runtime for all API routes:

- `/api/stream` uses short polling and a process-local singleton cache.
- AeroDataBox routes use server-side secrets and process-local memory caching.

When deploying to Vercel, use the `rumble-ai` team by default unless another team is specified. If Vercel Functions regions are configured, prefer GDPR-friendly European regions: Paris (`cdg1`), Dublin (`dub1`), and Frankfurt (`fra1`).

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENSKY_CLIENT_ID` | No | OpenSky OAuth2 API client ID for higher quota than anonymous mode |
| `OPENSKY_CLIENT_SECRET` | No | OpenSky OAuth2 API client secret |
| `RAPIDAPI_KEY` | No | AeroDataBox RapidAPI key for metadata and route lookups |

Copy `.env.example` to `.env` for local development. Next.js also supports `.env.local` for untracked machine-local overrides.

## Cache / Persistence Behavior

### OpenSky

- Cached in `lib/stream-hub.ts` for 5 minutes per Node.js process.
- One global OpenSky snapshot is fetched and fanned out to subscribers after server-side viewport filtering.
- If OpenSky returns `Too many requests`, the hub backs off for 15 minutes.
- If cached data exists during backoff, stale positions continue to be served.

Anonymous OpenSky access has a daily credit budget. With a 5-minute TTL, a continuous single-process session is roughly 288 upstream calls/day, with global `/states/all` requests charged at OpenSky's global request cost.

### AeroDataBox

- Metadata is manual-loaded from the aircraft panel and cached in the browser for 30 days.
- Route data is manual-loaded and cached in the browser for 12 hours.
- Server memory cache stores metadata for 24 hours and routes/searches for 12 hours per Node.js process.
- Failed/rate-limited upstream responses are not cached as successful metadata.

## Observability

There is no dedicated telemetry integration yet. Start with:

- Browser status pill: `Connecting`, `Live`, `OpenSky limited`, or `Connection error`.
- Dev server logs in `.next/dev/logs/next-development.log`.
- Network tab for `/api/stream` JSON responses.
- Server route responses for `502` error messages from AeroDataBox.

Useful manual checks:

```bash
curl -i 'http://localhost:3000/api/stream?lamin=45&lomin=5&lamax=55&lomax=15'
curl 'http://localhost:3000/api/flight-search?q=RAM740X'
curl 'http://localhost:3000/api/flight-route/0200eb?callsign=RAM740X'
```

## Common Maintenance Tasks

### Change OpenSky Polling / Cache Policy

1. Edit `LIVE_CACHE_TTL_MS` or `RATE_LIMIT_BACKOFF_MS` in `lib/stream-hub.ts`.
2. Update `docs/architecture.md`, `docs/operations.md`, and README cache notes.
3. Run `npm run lint` and `npm run build`.

### Add an AeroDataBox Field

1. Add the raw response shape and mapped field in `lib/aerodatabox.ts`.
2. Render it in `components/AircraftPanel.tsx` or another relevant component.
3. Keep the lookup manual unless the endpoint is free-tier safe.
4. Update `docs/integration.md` if the route response shape changes.

### Add or Change a Public Route

1. Add the route handler under `app/api`.
2. Document parameters, response shape, errors, and cache behavior in `docs/integration.md`.
3. Update README route summary if it is a primary entry point.

## Verification Checklist

Run before handing off meaningful changes:

```bash
npm run lint
npm run build
```

Manual browser checks:

- Map renders in Bright mode by default.
- Dark/Bright style toggle works.
- Altitude legend is visible and compact.
- Status pill does not overlap map zoom controls.
- Selecting an aircraft opens the panel.
- `Load details and route` remains manual and handles missing/rate-limited upstream data gracefully.

## Documentation Maintenance

Update documentation when any of these change:

- API route parameters, responses, or error behavior.
- OpenSky/AeroDataBox cache TTLs.
- Required or optional environment variables.
- Deployment target, runtime, or region assumptions.
- Public product behavior such as search, route visualization, or map controls.
