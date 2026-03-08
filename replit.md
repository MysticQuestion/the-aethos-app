# Aethos - Astrology Intelligence Platform

## Overview
Aethos is an astrology-native intelligence mobile app built with Expo React Native. It provides timing intelligence, theme scores, and psychological measurement through daily journaling — treating astrology as structured data rather than horoscope generation.

## Architecture

### Frontend (Expo React Native)
- **Framework**: Expo SDK 54 with Expo Router (file-based routing)
- **State**: React Context (AethosContext) + AsyncStorage for persistence
- **Styling**: StyleSheet with dark cosmic theme (deep navy/midnight, gold accents)
- **Navigation**: 4-tab layout (Today, Timeline, Journal, Chart) with liquid glass support

### Backend (Express)
- **Server**: Express on port 5000, serves landing page and API routes
- **API**: `POST /api/calc/canonical` — accepts GoldenInput schema, returns full CanonicalOutput
- **Frontend Dev**: Expo dev server on port 8081

## Key Files

### App Screens
- `app/onboarding.tsx` - 3-step birth data capture (name, date/time, location)
- `app/(tabs)/index.tsx` - Today dashboard: cosmic weather, theme scores, active transits
- `app/(tabs)/timeline.tsx` - Timeline of upcoming transit event windows with filtering
- `app/(tabs)/journal.tsx` - EMA-style daily check-in (mood, energy, focus, connection, confidence)
- `app/(tabs)/profile.tsx` - Natal chart with planetary positions (degrees, dignities, aspects, houses)
- `app/transit/[id].tsx` - Transit event detail with interpretation, opportunity, lab mode

### Core Libraries
- `lib/canonical-types.ts` - Full v1.0.0 schema TypeScript types including TZ policy types (TzInvalidTimePolicy, TzAmbiguousTimePolicy, TzResolution)
- `lib/canonical-calculator.ts` - Canonical ephemeris calculator: IANA timezone→UTC via Intl.DateTimeFormat with DST gap/overlap detection, Moshier analytical ephemeris, whole-sign houses, 6 aspect types (incl. quincunx), dignity system, angularity, speed via finite difference, reliability flags, geo longitude in LST for ASC/MC. `generateSimpleChart(date, birthHour, geoLat, geoLon)` — birthHour is fractional (e.g. 17.717 for 17:43)
- `lib/astrology.ts` - Thin compatibility wrapper around canonical calculator; `generateNatalChart(date, fractionalHour, geoLat, geoLon)`
- `contexts/AethosContext.tsx` - Central state: birth data (with minutes, geoLat/geoLon from Nominatim geocoding), chart, transits, journal, theme scores
- `constants/colors.ts` - Dark theme color system with planet-specific colors

### Canonical Schema v1.0.0
- **Birth Record (Option A)**: naive local components (date+time+IANA timezone) + computed UTC absolute timestamp
- **DST Policy Disclosure**: `tz_invalid_time_policy` (normalize_forward), `tz_ambiguous_time_policy` (prefer_earliest), `tz_resolution` (ok/ambiguous/invalid/time_unknown)
- **Bodies**: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron (11 bodies)
- **PlanetState**: lon, lat, distance_au, speed_lon/lat/dist (finite difference), retrograde, sign, house
- **Aspects**: conjunction/opposition/trine/square/sextile/quincunx with exact_angle, separation, orb, applying, strength
- **Houses**: Whole-sign (12 houses with sign assignments and cusps)
- **Dignities**: domicile, exaltation, detriment, fall, peregrine
- **Angularity**: angular, succedent, cadent
- **Reliability**: flags for uncertain birth times (HOUSES_UNRELIABLE, ANGLES_UNRELIABLE, etc.)
- **Provenance**: calculator_version, ephemeris provider, generated timestamp, config_hash

### Testing & Validation Infrastructure
- `schemas/canonical/` - JSON Schema (Draft 2020-12) files for all canonical output types
- `schemas/input/` - Calculator request input schema
- `goldens/inputs/` - 20 golden input files (DST edge cases, leap day, midnight boundaries, high latitudes, southern hemisphere, half-hour offset timezones, time unknown)
- `goldens/outputs/` - Generated golden expected outputs
- `tools/validation/golden-runner.ts` - TypeScript golden test runner with wrap-safe angle diffs, birth_record UTC/TZ assertions, orb tolerance, reliability flag checks: `npx tsx tools/validation/golden-runner.ts generate|test`

### Aethos Concepts
- **Theme Scores**: 5 normalized dimensions (Agency, Relational, Structure, Expression, Inner Life)
- **Transit Events**: Planetary aspect windows with start/peak/end dates, themes, intensity
- **EMA Check-ins**: Daily mood/energy/focus/connection/confidence (1-10 scale) for calibration
- **Cosmic Weather**: Daily headline, summary, moon phase, void-of-course status

## Design System
- Background: #060812 (deep space)
- Surface: #0D1229, #131A38
- Gold accent: #C9A84C
- Theme colors: Agency=#E8C96A, Relational=#E88080, Structure=#8A8FA8, Expression=#6B8AFF, Inner Life=#9B7FE8
- Font: Inter (400/500/600/700)
