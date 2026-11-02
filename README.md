# Aethos Mobile / Backend Prototype

This repository is an early Expo / React Native / Express / Drizzle / PostgreSQL prototype for Aethos.

It is **not** the current Vercel web deployment target. The current deployable web app is:

- `MysticQuestion/aethos-your-inner-compass`

The canonical product and technical specification is:

- `MysticQuestion/aethos-v1-spec`

## Current role

Use this repository only as prototype material for future mobile, backend, or calculation-engine work. Do not connect this repo to the production Aethos web deployment unless a deliberate architecture decision is made and documented in `aethos-v1-spec`.

## Useful material to preserve

- Expo / React Native mobile structure
- Express server prototype
- Drizzle / PostgreSQL direction
- Early ephemeris package exploration
- Mobile navigation and interaction patterns

## Do not assume

- That this repo is production-ready
- That this repo is the canonical app
- That this repo should be attached to Vercel for the web app
- That the calculation layer is final or verified

## Reconciliation rule

Before reusing code from this repository, compare it against the canonical requirements in `MysticQuestion/aethos-v1-spec` and port only what supports the current Aethos V1 scope.

## November 2026 mobile foundation

The revised Aethos-first directive selects this repository for native assessment, not production deployment. See [the source audit and status report](docs/MOBILE_FOUNDATION_AUDIT.md). The new isolated intake boundary has tests (`npm test`) and a focused strict typecheck (`npm run typecheck:intake`); the existing provider and calculations remain unverified.
