# Progress

## Inputs (Phase 0, step 2)

| Input | Status |
| --- | --- |
| Google Maps Demo Key | Present in `.env` (supplied by the human 2026-10-07) |
| Custom Map ID | Missing → fallback Mode B |
| Figma MCP | Connected (plugin:figma) |
| Firebase project | Missing → emulator, project id `demo-ptp`; deploy waits for the human |
| Stack Sans Text font | Available on Google Fonts (300/400/500) |
| Java (for emulator) | Was missing; portable Temurin 21 in .tools/ |

## Phase 0: DONE (Gate 0 passed 2026-10-07)

Done and verified:
- Scaffold (Vite 8, React 19, TS 6, ESLint, Vitest, Playwright, zustand, @vis.gl/react-google-maps, firebase, firebase-tools, firebase-admin). git initialised.
- Figma pulled via MCP: variables of node 3552-3120 (match design/tokens.json), design context and screenshot (docs/figma/story-3552-3120.png), icons into src/design/icons/.
- src/design/tokens.css (Figma names + type override tokens).
- src/types.ts and src/store/index.ts (frozen contracts), Repo interface in types.ts.
- src/lib/geo.ts + 6 unit tests (pass).
- firebase.json (emulators firestore 8080, auth 9099), .firebaserc (demo-ptp), firestore.rules + 9 rules tests on the emulator (pass; postedAs ptp/place rejected, support id must be pinId_uid).
- Map Mode B (no Map ID): JSON warm style, no mapId. Screenshot docs/screens/p0-map-390.png looked at: Bandra West, warm muted base, POI icons hidden, no console errors.

- Full Figma design system extracted to docs/figma/SPEC.md + 28 PNGs + ~100 SVG icons (sonnet agent).
- Primitives (src/design/primitives.tsx): Button, ShellButton, Chip, Card, Tag, poster labels, SheetSurface, Grabber, Field, Snack, Icon. /kitchen-sink screenshot docs/screens/p0-kitchen-sink.png looked at and compared to Figma button/chip-filter/card-update PNGs: match in fill, depth, radius, type.
- App integration shell with per-agent stubs; docs/AGENT_BRIEF.md.

Gate 0: typecheck pass, lint pass, unit 6/6, rules 9/9 (emulator), build pass, map + kitchen-sink screenshots looked at.

## Unverified

- Whether JSON `styles` are ignored when a mapId is set: no Google doc page found that says so; design avoids depending on it.
