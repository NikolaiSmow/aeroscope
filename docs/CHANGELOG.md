# Changelog

## Unreleased

- Documented AeroScope architecture, API routes, cache policy, operations workflow, and onboarding entry points.
- Split detailed architecture, integration, and operations notes out of the README into maintainable docs.

## Current Baseline

- Standalone AeroScope repository with preserved project history.
- Live aircraft map with OpenSky SSE stream, server-side cache, and rate-limit backoff.
- AeroDataBox metadata, route, and search lookups behind manual actions and cache layers.
- Route overlay, route progress widget, altitude-based aircraft coloring, and bright/dark map style switching.
