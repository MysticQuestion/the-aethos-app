# Aethos mobile foundation audit

November 1, 2026 (America/Los_Angeles). Development only; no production changes.

## Evidence and scope

Native source inspected at `2276a0ec49054bcbfba26cdef2601950589d461a`.
Canonical spec inspected at `3b2ea902d77ab3567ce5ba210b2e1a5dad441bbd`.
Web router inspected at tree `b853d710377705128fca38fdb4a3ee5140e828c1`.
Parent workspace gate inspected at tree `18ac7c6fbee1edb546ec0ee4551d4a5f577483f5`.

This is targeted source inspection, not a comprehensive security audit or device certification. The earlier description of wired native onboarding/screens is not supported by this checked-in tree.

## Findings

| Area | Finding | Consequence |
| --- | --- | --- |
| Native entry | package.json names expo-router/entry but no app/ or src/app/ routes are checked in; no tsconfig.json | Native journey cannot be treated as available |
| Timing | lib/astrology.ts generates event dates, aspects and intensity with seeded random selection; the chart parameter does not determine events | Not a personalized transit engine |
| Themes / daily text | Seeded scores and preset daily weather, including random void-of-course flags | Not calculated personal context |
| Intake | Provider uses date at noon UTC and missing coordinates become zero; no timezone captured in BirthData | Chart accuracy blocked |
| Canonical calculation | Ascendant/MC path adds hour after using a timestamp that already includes time; body house assignment differs from whole-sign cusp construction | Independent calculation verification and correction required |
| Settings | Returned config can name sidereal or alternative houses without corresponding calculation branches | Unsupported settings must be rejected |
| Unknown time | Canonical converter substitutes noon; schema still requires concrete angles/houses | Versioned nullable/sensitivity output needed |
| Provenance | Moshier provider uses a field named swe_version; generic build hash | Engine identification needs correction |
| Storage | Birth data and journal use AsyncStorage | Encryption and migration not implemented |
| Journal | One entry per UTC day overwrites the prior entry for that day | Append-only observation history/local-day behavior needed |
| Web | Active src/App.tsx wires only landing, generator and compatibility | Other screens are not active via that router |
| Public site | /aethos/app requires user authentication | Cannot be copied as the account-optional native flow |
| Canonical spec | Insight schema has one undifferentiated numeric confidence | Separate evidence classification and calculation quality required |

## Delivered change

`lib/birth-intake.ts` introduces a deliberately isolated mobile intake contract (1.1.0), retaining the spec's subject/date/location naming. It validates calendar dates, explicit unknown/approximate/exact time, uncertainty, finite coordinates, timezone support and separate consent settings. It resolves local time through offset candidates and exact round trips. It returns null rather than fabricating noon, UTC or coordinates.

It does not replace the legacy contract or migrate records implicitly. It is not connected to the old provider because that provider would immediately calculate unverified charts and persist plaintext data. Integration belongs after the encrypted-store and calculation gates.

`precise_houses_eligible` means only that intake prerequisites are present; it is not an engine certification or guarantee of birth-time accuracy. Approximate input remains ineligible until sensitivity analysis exists. UTC candidates use the host Intl timezone database; native parity, pinned data and reproducibility remain to be verified.

## Validation

- `npm test`: 27 passing tests using Node 24.22.1 in this workspace.
- `npm run typecheck:intake`: strict TypeScript check of the new module.
- Fixtures cover historical local date, seconds, true zero coordinates, leap day, India offset, US DST gaps/repeats, Lord Howe half-hour repeat and Apia's skipped date.
- No astronomical reference validation, native build, physical-device test, encrypted-store test or whole-app typecheck is claimed.
- Dependencies installed with lifecycle scripts disabled for these focused checks; this does not validate native installation.

## Feature status

| Feature | Status |
| --- | --- |
| Intake validation and timezone resolution module | Implemented and unit-tested; not wired into UI |
| Canonical Aethos-first decision and research reconciliation | Documented in spec development branch |
| Five-section native UI and onboarding | Blocked by missing route implementation |
| Verified chart and real timing windows | Blocked by calculation defects and missing reference validation |
| Encrypted journal, migration, offline restoration | Not implemented; blocks release |
| Export/import/correction/deletion journey | Not implemented as the required secure journey |
| Authored insight provenance and feedback controls | Pending implementation |
| Android/iOS release builds and device accessibility | Untested |
| Extra symbolic systems, audio and cloud sync | Deferred |

The app is not production-ready. Next work must replace the legacy mock-driven pipeline, implement secure persistence, then connect the five native sections to validated outputs. Do not deploy the legacy provider as a working personal intelligence engine.
