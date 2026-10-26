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

## Phase 4: ON HOLD (human chose local-only for now, 2026-10-07)

No VITE_FIREBASE_* values in .env and no `firebase login`. Everything is built and verified on the emulators (`npm run e2e:emulator`, 9/9). To deploy:
1. `npx firebase login`
2. Create a Firebase project (console), enable Firestore and Anonymous sign-in, add a Web app, then `npx firebase use --add` (choose the project).
3. Fill VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID in .env and set VITE_DATA_SOURCE=firebase.
4. `gcloud auth application-default login` (seed uses firebase-admin applicationDefault()), then `npm run seed -- --target=prod`.
5. `npm run deploy` (build + hosting + firestore rules).
Phase 5 (traffic automation) not started, per instructions.

## 2026-10-22: name labels, opinion bubbles, comments (PRD addendum)

Done and verified:
- types (Comment, COMMENT_MAX, Repo.subscribeComments/addComment), store (comments, detailSection), lib/comments.ts, lib/tags.ts planLayers (bubbles cap 3, tags, labels through selectTags), map layer render, detail comments card, mock + Firestore repos, firestore.rules, 6 seed comments (seed re-run: 0 Google calls; seed JSON only gained the comments).
- typecheck pass, lint pass, unit 161/161, rules 18/18 (emulator), build pass.
- Screenshots looked at: docs/screens/layers/z15-390x844.png, z17-390x844.png, bubble-to-comments-390x844.png. No console errors (a duplicate React key between PhotoWell and Comments was found this way and fixed).

Not verified / notes:
- With the seed, only 1 bubble fits at zoom 15 and 1 at zoom 17 in the default view: bubbles are large and the commented pins sit close to other markers or the screen edge, so the overlap and no-clip rules drop the rest. The cap of 3 is unit tested, not seen on screen.
- `npm run e2e:emulator` was not re-run (it makes live searchNearby calls); comments in the running app on the emulator (VITE_DATA_SOURCE=emulator) were exercised through rules tests only.
- No review UI: making a comment live needs the Admin SDK or the console.

## 2026-10-22 (round 2): round pins with text, richer bubbles, "@ Place", claims and offers

Done and verified:
- Round centre-anchored pins (24 px; selected 32 in a halo), Google-style pin text with the tag after it (relevancy cap by zoom, shortened at the right edge), bubbles with "@ Place" / quote / "500 m away" / "+N", opening below the pin or sliding inside the screen when needed, stacked pins carry no words, layers re-plan on sheet moves.
- "@ Place" on bubbles, cards and the detail opens the place's list. Claims (types, mock + Firestore repos, rules, claim row + sheet with mock checkout), posting as the place (Offer or Event) with offers ranked x0.8 and expiring at their last day. One more seed comment (seed re-run offline: 0 Google requests; only comments changed).
- typecheck pass, lint pass, unit 187/187, rules 24/24 (emulator), build pass; the dev-only `ptpTeam` hook is absent from the production bundle.
- Screenshots looked at (docs/screens/layers/, 390x844): z15 and z17 (2 bubbles each, "+2", pin text and tags), at-place, bubble-to-comments, place-unclaimed, claim-sheet, claim-sent, place-claimed, post-offer, offer-posted, offer-on-map. No console errors. Found and fixed this way: layers planned for a stale sheet height; a hidden stacked pin's "+2" beside the pin on top; a text+tag clipped at the screen edge; the claim sheet closing before its confirmation showed.

Not verified / notes:
- No real payment: the checkout is a mock (nothing charged); real billing is not built.
- Team approval of claims in the running app was done with the dev-only mock hook; on Firestore it is a console/Admin SDK edit (rules tested on the emulator).
- Pin text and bubbles do not avoid the floating locate / + Pin buttons (same as tags before); a label can sit under "+ Pin".
- Bubbles may cover a Google place name (they avoid pins, tags and each other, not place names).
- Only businesses in the nearby Google places list can be claimed; a business found through search but outside that list cannot yet.
- `npm run e2e:emulator` not re-run (live Google calls).

## 2026-10-22: zoom buttons, phone access

- "+" / "−" zoom buttons above locate (unit tested 3/3; screenshot docs/screens/layers/zoom-buttons and zoom-in-x2, 15 -> 17 about the visible centre).
- Dev server runs with `npm run dev -- --host` so a phone on the same network opens http://<mac-ip>:5173. The Maps key accepts that origin (map loaded from 192.168.0.190, no key error).
- Places Nearby Search returned 429 for the rest of the day: today's screenshot runs (fresh browsers skip the 12 h cache) used up the Demo Key's Places allowance. Place dots, the Places chip and claiming have nothing to show until it resets. The map, pins, bubbles and posting still work.
- Not verified on a real phone: location over plain http on a LAN address (browsers only allow geolocation on https or localhost, so Locate / Near me are expected to fail there).

## 2026-10-23: popups for any pin (Pulse on the map)

- Done: popups for any pin ranked by the feed's interest, cap by zoom (2/3/4/5), title popups for pins without comments, floating buttons as an obstacle. Unit 192/192, typecheck and lint pass.
- Screenshots looked at (docs/screens/popups/, made with scripts/popup-shots.ts using the zoom buttons): z14 (1 popup), z15 (3 popups), z17 zoomed onto one pin (its popup shows; the pin stays put through zoom 16 -> 17, so the buttons zoom about the visible centre).
- With the seed, the comment pins are the freshest, so they win the popups at zoom 15; title popups showed at zoom 14 in one run ("Plan to turn the Reclamation football ground...") and appear where no comment pin competes.
- Places still rate-limited (429) today; place dots and claiming not re-checked.

## 2026-10-23: merging similar pins, photos

- Done: lib/merge (same type, 30 m, events same start, offers never) used by markers and layers; "+N" merged tag replaces the civic busy tag; detail line "N more neighbours posted this here"; one more seed report (seed re-run offline, 0 Google requests). Photos: create sheet "Add photo" (shrunk on the phone), pinPhotos collection + rules, detail media well.
- Verified: unit tests (see below), rules 27/27 on the emulator (photo: poster only, JPEG only, <= 400k, no replacing; hasPhoto bool).
- Not verified on a real phone: picking from the camera (iOS HEIC conversion relies on the browser), photo size on very large camera images.

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
