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

## Phase 1: DONE (Gate 1 passed 2026-10-07)

Agents A (map), B (sheet/feed), C (data/seed), D (top bar) ran in parallel (sonnet); each passed its own gate (reports summarised in DECISIONS.md).
- A: OverlayView markers (PRD shapes/colours on Figma pin anatomy), CSS pulse ring, zoom<=13 clustering (unit tested), 800 m walk ring, area tint, locate button, long-press create entry. Filter toggles: 0 Google requests.
- B: rank.ts/pulse.ts (tested), BottomSheet peek/half/full (drag + tap + Map/List pill, --sheet-offset), header, area strip, PinCard in PRD order, feed.
- C: 32 seeded pins + 162 supports from 15 Places API (New) requests (cached; re-run = 0 calls, identical output), mock + Firestore repos, emulator seeding, support toggle transaction.
- D: masthead + area sheet, search (our pins first, Places autocomplete with one session token per session, verified by request interception), chips, account sheet (name on device only; test proves it never reaches store/DOM elsewhere).
Lead fixes at Gate 1: tidy seed times, type-chip rule, visible-band map centring + origin, quieter neighbourhood labels, live-Google e2e opt-in.

Gate 1: typecheck pass, lint pass, unit 77/77, rules 14/14 (emulator), build pass. Full-app screenshots docs/screens/g1c-{half,full,peek}-390.png looked at, compared against Figma card-update/card-event/chip-filter/sheet: same shell, depth, type families.

## Phase 2: DONE (Gate 2 passed 2026-10-07)

Agents E (create), F (map tags), G (detail) ran in parallel (sonnet); each passed its gate.
- E: "+ Pin", placing mode (fixed centre pin, nearest place on idle), type tiles, title, event day chips + time, Post as neighbour only, back at every step, long-press entry. Screens docs/screens/create-1..6 looked at.
- F: selectTags (score, zoom caps, overlap + marker-body rejection, 30% stickiness, selected always, freshness), tag content per PRD table, own overlay; recompute on idle/selection only; 20 px pan leaves the tag set identical. 23 unit tests.
- G: story-style detail (header, segments over the feed list, map window, glass sheet, poster label, action + WhatsApp + Directions), no timers, back button closes. Side-by-side with Figma docs/screens/detail-vs-figma.png looked at.
Lead at Gate 2: "just posted by this device" first in the feed (+ test); detail map window fills the media slot (docs/screens/g2-detail-390.png looked at); full-flow e2e on emulators.

Gate 2: typecheck pass, lint pass, unit 127/127 + 1 lead test, rules 14/14, build pass, e2e 9/9 on emulators (`npm run e2e:emulator`: create one of each type with postedAs neighbour verified in Firestore; support toggle persisted as pinId_uid and removed on second tap; detail open/next/close; chips; area strip share; name privacy).

## Phase 3: DONE (Gate 3 passed 2026-10-07)

- QA screenshots at 390x844 and 360x800 (docs/screens/qa/, 13 states each), text/tap-target audit (docs/screens/qa/audit.json: no text under 14 px; tap targets >= 44 px incl. hit-area extensions).
- Independent reviewer (opus, no code access) wrote docs/REVIEW.md: 92 PASS, 16 FAIL, 24 CANNOT VERIFY. Privacy PASS, all design bans PASS.
- Lead fixed 10 fails, justified 6 (DECISIONS.md), re-screenshotted (360x800 post-fix set, top-* shots), added side-by-sides with Figma (sbs-*.png). REVIEW.md section G: no unjustified fails.
- Maps Demo Key daily quota was reached during re-capture: the 390x844 qa set is partly pre-fix; the 360x800 set is post-fix.

Gate 3: typecheck, lint, unit 128/128, build pass; REVIEW.md has no unjustified fails.

## Phase 4: BLOCKED on the human (Firebase)

No VITE_FIREBASE_* values in .env and no `firebase login`. Everything is built and verified on the emulators (`npm run e2e:emulator`, 9/9). To deploy:
1. `npx firebase login`
2. Create a Firebase project (console), enable Firestore and Anonymous sign-in, add a Web app, then `npx firebase use --add` (choose the project).
3. Fill VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID in .env and set VITE_DATA_SOURCE=firebase.
4. `gcloud auth application-default login` (seed uses firebase-admin applicationDefault()), then `npm run seed -- --target=prod`.
5. `npm run deploy` (build + hosting + firestore rules).
Phase 5 (traffic automation) not started, per instructions.

## Unverified

- Real touch drag of the sheet and real touch long-press (tested with mouse pointer events).
- Granted-location flows (locate button, Near me): only the denied path was exercised in a browser.
- Selecting a live Google place suggestion end to end (unit tested with mocks only, to save the Demo Key cap).
- firestoreRepo in the running app (VITE_DATA_SOURCE=emulator); exercised through emulator rules tests only.
- No Google place photos were returned for seeded venues; place avatars show a neutral circle.
- Cluster markers and "N events" cluster tags on screen (zoom <= 13): unit tested only, not screenshotted yet.
- Six-tag case at zoom 17+ (unit tested only).
- Real Android back button for create/detail (synthetic popstate tested).
- Whether JSON `styles` are ignored when a mapId is set: no Google doc page found that says so; design avoids depending on it.
