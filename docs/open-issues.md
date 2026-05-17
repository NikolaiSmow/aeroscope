# Open Issues

## Shared OpenSky Cache for Production Scale

For the demo version, AeroScope uses process-local memory caching in `lib/stream-hub.ts`. This works on Vercel as a best-effort cache while a function instance stays warm, but it is not shared across multiple instances or regions.

If the project grows beyond a demo, add a shared cache for the global OpenSky snapshot:

- Store the compacted `/states/all` payload in a shared cache such as Upstash Redis.
- Use a short TTL, currently 5 minutes to match `LIVE_CACHE_TTL_MS`.
- Add a refresh lock so only one function instance calls OpenSky when the cache expires.
- Keep viewport filtering in `/api/stream` so browsers only receive aircraft relevant to the visible map.

This would reduce duplicate OpenSky calls on scaled Vercel deployments and make rate-limit behavior more predictable.
