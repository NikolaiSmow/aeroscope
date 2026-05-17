# Integration/API

AeroScope exposes internal browser-facing API routes. They are not designed as a stable public API, but these contracts are useful for debugging, future clients, and maintenance.

## Entry Points

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/stream` | `GET` | Server-Sent Events stream of OpenSky aircraft states |
| `/api/aircraft/[icao24]` | `GET` | Aircraft metadata by ICAO24 |
| `/api/flight-route/[icao24]` | `GET` | Flight route by ICAO24, optionally biased by callsign |
| `/api/flight-search` | `GET` | Flight route search by callsign, flight number, or ICAO24-like query |

## `/api/stream`

### Parameters

| Name | Required | Description |
| --- | --- | --- |
| `lamin` | No | South latitude bound |
| `lomin` | No | West longitude bound |
| `lamax` | No | North latitude bound |
| `lomax` | No | East longitude bound |

The upstream OpenSky request is cached globally. When all bounding box values are valid, `/api/stream` filters the cached global aircraft list to that viewport before sending `states` events. If any bounding box value is missing or invalid, the stream sends the cached global list.

### Events

Initial hello:

```text
event: hello
data: {"ok":true}
```

Aircraft payload:

```text
event: states
data: {"time":1710000000,"aircraft":[{"icao24":"0200eb","callsign":"RAM740X","latitude":48.7,"longitude":2.6}]}
```

Upstream error:

```text
event: error
data: {"message":"OpenSky 429: Too many requests"}
```

The stream also emits comment heartbeats every 15 seconds.

## `/api/aircraft/[icao24]`

### Path

| Name | Required | Description |
| --- | --- | --- |
| `icao24` | Yes | Six-character hexadecimal Mode-S address |

### Success Response

```json
{
  "icao24": "0200eb",
  "registration": "CN-RGF",
  "model": "B738",
  "manufacturer": "Boeing 737 NG",
  "airline": "Royal Air Maroc",
  "imageUrl": "https://...",
  "productionLine": "Boeing 737 NG"
}
```

May return `null` when AeroDataBox has no metadata.

### Errors

| Status | Meaning |
| --- | --- |
| `400` | Invalid `icao24` |
| `502` | AeroDataBox failed or rate-limited |

## `/api/flight-route/[icao24]`

### Parameters

| Name | Required | Description |
| --- | --- | --- |
| `icao24` | Yes | Six-character hexadecimal Mode-S address |
| `callsign` | No | Current OpenSky callsign; preferred lookup key when available |

### Example

```bash
curl 'http://localhost:3000/api/flight-route/0200eb?callsign=RAM740X'
```

### Success Response

```json
{
  "number": "AT 740",
  "callSign": "RAM740X",
  "status": "Arrived",
  "distanceNm": 1129.79,
  "distanceKm": 2092.37,
  "departure": {
    "icao": "GMMX",
    "iata": "RAK",
    "name": "Marrakech Menara",
    "municipalityName": "Marrakech",
    "latitude": 31.6069,
    "longitude": -8.036299
  },
  "arrival": {
    "icao": "LFPO",
    "iata": "ORY",
    "name": "Paris Orly",
    "municipalityName": "Paris",
    "latitude": 48.7253,
    "longitude": 2.35944
  },
  "departureScheduledUtc": "2026-05-16 15:25Z",
  "departureRevisedUtc": "2026-05-16 15:25Z",
  "departureTerminal": "1",
  "arrivalScheduledUtc": "2026-05-16 18:25Z",
  "arrivalRevisedUtc": "2026-05-16 18:47Z",
  "arrivalTerminal": "4"
}
```

May return `null` when no route is found.

## `/api/flight-search`

### Parameters

| Name | Required | Description |
| --- | --- | --- |
| `q` | Yes | Minimum two-character flight number, callsign, or ICAO24-like query |

### Example

```bash
curl 'http://localhost:3000/api/flight-search?q=RAM740X'
```

### Behavior

The server tries:

1. `Icao24` when the query looks like a six-character hex string.
2. `CallSign`.
3. `Number`.

The response shape is the same as `/api/flight-route/[icao24]`.

## Caching and Rate Limits

- `/api/stream` uses server-side in-memory global OpenSky caching, viewport filtering, and SSE headers: `Cache-Control: no-cache, no-transform`.
- `/api/aircraft/[icao24]` returns `Cache-Control: public, max-age=2592000, stale-while-revalidate=86400`.
- `/api/flight-route/[icao24]` and `/api/flight-search` return `Cache-Control: public, max-age=43200, stale-while-revalidate=3600`.
- AeroDataBox search and route calls use Tier 2 endpoints on the Basic plan. Keep them manual or cache-first.
