# PTP Map-First: implementation plan for Claude Code

You are the lead agent. You build the prototype described in docs/PRD.md, in the phases below, using parallel subagents where this plan says so. Follow CLAUDE.md at all times.

Each phase ends with a gate. Do not start the next phase until the gate passes. If a gate fails, fix it before moving on. Record every gate result in docs/PROGRESS.md.

## Inputs and human gates

Only one thing blocks the whole build: a missing Maps key. Everything else has a fallback, so keep going and list what was skipped at the end.

| Input | Where | If missing |
| --- | --- | --- |
| Google Maps Demo Key | `.env` → `VITE_GOOGLE_MAPS_API_KEY` | STOP and ask the human. Nothing else can be verified without it. |
| Custom Map ID (cloud-styled, warm muted) | `.env` → `VITE_GOOGLE_MAP_ID` | Use the fallback map mode (Phase 0, step 6). Note it in PROGRESS.md. |
| Figma MCP | `claude mcp list` shows a Figma server | Use design/tokens.json, note it in PROGRESS.md, and ask the human at the end to connect Figma for a final design pass. |
| Firebase project for deploy | `.env` → `VITE_FIREBASE_*`, plus `firebase login` | Build and test fully on the Firestore emulator with project id `demo-ptp`. Deploy is the last step and is the only part that waits for the human. |
| Stack Sans Text font | Google Fonts, or files from the team | Check Google Fonts first. If it is not there, STOP font work and ask the human for the font files. Never substitute another font. |

## Architecture contract (written in Phase 0, frozen after)

```
src/
  app/            App.tsx, layout shell, providers            (lead)
  design/         tokens.css, primitives: Pill, Chip, Card,
                  Tag, Sheet primitives                        (lead, Phase 0)
  types.ts        Pin, Support, AreaUpdate, PostedAs, etc.     (lead, Phase 0, frozen)
  store/          zustand store: filters, selection, sheet
                  height, viewport, deviceId                   (lead, Phase 0, frozen API)
  data/           repo.ts interface + firestore impl + mock    (agent C)
  lib/            geo.ts (walk minutes), rank.ts, pulse.ts,
                  tags.ts (pure, unit tested)                  (agent B: rank, pulse; agent F: tags; lead: geo)
  map/            MapView, markers, pulse ring, walk ring,
                  area tint, map tags layer                    (agent A; tags render by agent F)
  sheet/          BottomSheet, SheetHeader, AreaStrip,
                  Feed, PinCard                                (agent B)
  top/            Masthead, SearchBar, Chips, AccountSheet     (agent D)
  create/         PlacingMode, CreateSheet                     (agent E)
  detail/         StoryDetail (reuse of v1 detail view)        (agent G)
scripts/
  seed.ts         builds seed from Places API (New)            (agent C)
  traffic.ts      traffic job (Phase 5 only)                   (lead)
tests/            vitest unit tests, playwright e2e            (owner of the code under test)
docs/             PRD, IMPLEMENTATION, PROGRESS, DECISIONS     (lead only)
```

File ownership rule: an agent edits only its own folders. If it needs a change in `types.ts`, `store/` or `design/`, it does not make it. It writes the request in its final report, and the lead decides.

## Phase 0: foundation (lead only, sequential, about 20 min)

1. Read CLAUDE.md, docs/PRD.md, this file. Create docs/PROGRESS.md and docs/DECISIONS.md.
2. Check inputs from the table above. Write what is present and missing into PROGRESS.md. Stop only if the Maps key is missing.
3. Scaffold: Vite + React + TypeScript, ESLint, Vitest, Playwright, zustand, @vis.gl/react-google-maps, firebase, firebase-tools (dev). `.env.example` already exists; ensure `.env` is in `.gitignore`. `git init` and first commit.
4. Design system:
   - Load the frontend-design skill.
   - If Figma MCP is connected: load the figma-design-to-code guidance, then get_variable_defs and get_design_context on node 3552-3120, and get_screenshot of it into `docs/figma/`. Otherwise use design/tokens.json.
   - Write `src/design/tokens.css` (CSS custom properties only, names mirroring Figma: `--colour-ink-100`, `--surface-canvas`, `--radius-pill`, `--elev-sheet`, etc.) including the type override tokens.
   - Build primitives from the tokens: Pill button (with press-s on active), Chip, Card shell (matching the v1 card), Tag (symbol + short value), poster labels (Neighbour chip, Place label, PTP label). Make a `/kitchen-sink` route that shows every primitive.
5. Write `src/types.ts` exactly from the PRD data model (pins incl. type `area`, postedAs, endsAt, radiusM; supports with id `${pinId}_${deviceId}`). Write the store API (state + actions) in `src/store/`. These are frozen after this phase.
6. Map mode check. Read the current Google docs for Advanced Markers and map styling, then decide and log in DECISIONS.md:
   - Mode A (preferred): `VITE_GOOGLE_MAP_ID` set → vector map with cloud style + Advanced Markers.
   - Mode B (fallback): no Map ID → no mapId, JSON `styles` array for the warm muted look (POIs off, quiet roads, base close to canvas), custom HTML markers via OverlayView. Verify in the docs that JSON styles are ignored when a mapId is set before relying on this split.
   - Wrap both behind one `MapView` API so no other code cares which mode is active.
7. Firestore: `firebase.json` with emulator config, `firestore.rules` (types and lengths validated; clients may only write postedAs == "neighbour"; supports doc id must equal `${pinId}_${request.auth.uid}`), anonymous auth.
8. `src/lib/geo.ts`: haversine distance, walkMin = metres / 80, formatted "~6 min walk". Unit tests.

Gate 0: `npm run typecheck`, `npm test`, `npm run build` pass. The app shows a map of Bandra West (19.0596, 72.8295) in the chosen mode, screenshotted at 390×844 and looked at. Kitchen-sink screenshot looked at and compared to the Figma frame. Commit.

## Phase 1: core, 4 agents in parallel (about 35 min)

Launch agents A, B, C and D in ONE message so they run concurrently. Give each agent: CLAUDE.md, the PRD sections listed, its owned folders, the frozen contracts (types.ts, store API, design primitives), and its gate. Recommended model for subagents: sonnet. Each agent must end with a report: what was built, what was verified and how, what is unverified, any contract change requests.

Agent A, Map (owns `src/map/`). PRD: Home screen (Map row), Pin types (markers), Who posted it (map column), Area updates (tint on tap), Calls made 1 (map and feed sync).
- Markers by type and poster (civic orange square-ish, event green round, ask ink outline, place accent ring). Built from tokens.
- Pulse ring on pins posted or supported in the last 3 hours and events starting within 2 hours (use `lib/pulse.ts` from agent B; until it lands, import the signature from the store contract).
- 10 minute walk ring (800 m radius circle) around user location or map centre.
- Locate button behaviour, map idle events into the store (bounds, zoom), fly-to on selected pin, highlight on feed scroll.
- Area tint circle shown only for the area update selected in the store.
- Long-press (touch hold 500 ms) dispatches "start create at lat/lng".
- Gate A: screenshots of map with seeded mock data at zoom 14 and 17; pan updates store bounds (logged); no Google calls on re-render (check network panel count stays flat while toggling filters).

Agent B, Sheet and feed (owns `src/sheet/`, `src/lib/rank.ts`, `src/lib/pulse.ts`). PRD: Home screen (Sheet row), Calls made 1 and 4, Pin types and the card, Support and ranking, Area updates (strip).
- BottomSheet with peek / half (default) / full. Drag plus tap on handle cycles heights. "Map / List" pill at full. Hide "+ Pin" and locate at full (expose sheet height in store).
- SheetHeader: "N things within a 10 min walk today" / "Showing Bandra West" / "Since last night" fallback rule.
- AreaStrip: max 3 rows, "+N more", PTP mark and accent edge, hidden when empty, tap selects the area in store, Share on WhatsApp via `https://wa.me/?text=`.
- PinCard in the exact PRD order, poster label, one action button whose label depends on type, count, WhatsApp share. Never render a user name.
- Feed filtered to map bounds and active chip, sorted by `rank.ts` (PRD formula). `pulse.ts` = window logic.
- Unit tests for rank (ordering cases: fresh vs total, event soon vs later, distance) and pulse (3 h window, under-5 fallback).
- Gate B: tests pass; screenshots at peek, half, full looked at; card screenshot compared to Figma card shell.

Agent C, Data and seed (owns `src/data/`, `scripts/seed.ts`, `firestore.rules` follow-ups via request to lead). PRD: Data model, Support and ranking rules, Who posted it, Area updates, Risks (seed).
- `repo.ts` interface: subscribePins(bounds), createPin, toggleSupport (transaction, one per device), subscribeSupports. Firestore implementation + in-memory mock with the same interface.
- `scripts/seed.ts`: uses Places API (New) Text Search (read the current docs first) with the Maps key to find REAL venues in Bandra West: queries like "community hall Bandra West Mumbai", "garden Bandra West", "gymkhana Bandra West", "church hall Bandra West", "yoga studio Bandra West", "library Bandra West". Keep placeId, displayName, location exactly as returned. Cache responses to `scripts/.cache/` so re-runs make zero Google calls.
- Generate 30 pins: about 12 events (some today, some within 2 hours, some this weekend; a few postedAs "place"), 10 civic (realistic Bandra issues on real streets: Hill Road, Linking Road, S.V. Road, Chapel Road, Carter Road; coordinates via the Places/Geocoding response, never typed by hand; spread of ages from 1 to 20 days), 8 asks. Plus 2 area updates postedAs "ptp" (a water cut tomorrow, a power cut today), with radiusM. All times computed relative to the moment the seed runs, so "today" is always today. Mark every seeded doc `seed: true`.
- Writing quality: plain, local, specific, like a real resident wrote it. No brand-new venue names, no "Event 1".
- Gate C: seed runs against the emulator twice with identical results and zero Google calls on the second run; support toggle test passes (double tap does not double count); rules test: a client write with postedAs "ptp" is rejected.

Agent D, Top bar (owns `src/top/`). PRD: Home screen (Masthead, Search bar, Chips rows), Who posted it (own name only in account).
- Masthead line "Bandra West ▾" with area switch sheet (Bandra West, Near me).
- SearchBar: our pins first (local filter), then Google suggestions via `AutocompleteSuggestion` with an `AutocompleteSessionToken` (verify names in current docs), debounced 300 ms, min 3 characters. Selecting a place flies the map there and lists pins at that placeId. Profile photo inside the right end opens AccountSheet (anonymous: "Your name" field stored on device, "My pins" list). The name appears nowhere else.
- Chips: All · Issues · Events · Asks, 44 px, one active, writes to store.
- Gate D: screenshot looked at; network check shows one session token per search session; name typed in AccountSheet does not appear on any card (test).

Gate 1 (lead): merge, run all tests, typecheck, build. Full-app screenshots at peek, half, full. Compare with the PRD wireframe description and the Figma frame. Fix contract mismatches. Commit.

## Phase 2: features, 3 agents in parallel (about 35 min)

Agent E, Create flow (owns `src/create/`). PRD: Creating a pin.
- "+ Pin" labelled pill (bottom right on the sheet edge, locate above it). Placing mode: fixed centre pin, "Move the map to the spot", nearest place name under the pin via `Place.searchNearby` with maxResultCount 1, only on map idle, debounced 600 ms. "Use this spot". Sheet with three large tiles, title field with per-type placeholder, event day chips + time picker, Post → repo.createPin with postedAs "neighbour" only. New pin pulses and appears top of Pulse as "Just now". Long-press entry skips to tiles. Back exits at any step.
- Gate E: e2e test creates one of each type on the emulator; the creation UI offers no poster choice; screenshots of every step looked at.

Agent F, Map tags (owns `src/lib/tags.ts`, `src/map/tags/`). PRD: Map tags.
- Pure `selectTags(candidates, viewport, zoom, previous, seenCounts)` implementing: score = urgency × nearness × freshness (interest = 1), zoom caps (≤13 clusters only, 14 to 16 top 3, 17+ top 6), screen-space overlap rejection, 30% stickiness, selected pin always tagged. Unit tests for each rule.
- Render tags per the PRD table: civic ring timer that fills over 7 days and turns red past it, "+5" busy state, event countdown formats, ask helper count, cluster counts. Seen counts stored on device.
- Recompute only on map idle (300 ms). No timers anywhere.
- Gate F: tests pass; screenshots at zoom 14 and 17 looked at; panning 20 px does not change the tag set.

Agent G, Detail view (owns `src/detail/`). PRD: Home screen (last paragraph), card spec.
- Reuse the v1 story-style detail (Figma node 3552-3120): get_design_context on it if Figma is connected. Poster label instead of names, action button, WhatsApp share, Directions (Google Maps URL with placeId). Opens from card and pin tap.
- Gate G: side-by-side screenshot with the Figma frame looked at; differences listed and fixed or justified in DECISIONS.md.

Gate 2 (lead): merge, tests, typecheck, build, full flow e2e.

## Phase 3: design QA and review (about 15 min)

1. Lead runs Playwright screenshots at 390×844 (iPhone-like) and 360×800 (small Android): home peek, half, full; area strip; card; detail; each create step; map tags at two zooms.
2. Launch a fresh reviewer agent that has NOT seen the code (model: opus). Give it only the PRD, CLAUDE.md, the Figma screenshots in docs/figma/ and the app screenshots. It checks:
   - every PRD requirement, as a pass / fail checklist written to docs/REVIEW.md;
   - every design ban in CLAUDE.md;
   - no user name visible anywhere outside AccountSheet;
   - text sizes meet the override tokens; touch targets at least 44 px.
3. Lead fixes every fail, re-screenshots, and updates REVIEW.md. Repeat until no fails, or a fail is justified in DECISIONS.md.

Gate 3: docs/REVIEW.md has no unjustified fails.

## Phase 4: deploy (needs the human)

1. If `VITE_FIREBASE_*` and a Firebase login exist: seed the real project (`npm run seed -- --target=prod`), deploy rules and hosting, open the URL on a phone-sized viewport, screenshot.
2. If not: stop here. Tell the human exactly which commands to run (`npx firebase login`, `npx firebase use --add`, fill `.env`, `npm run deploy`) and that everything else is done and verified on the emulator.

## Phase 5: traffic automation (only after Phase 4, only if the human says go)

1. First, one manual call to Routes API computeRoutes with traffic-aware routing on one stretch using the demo key. Record whether it returns a traffic duration and a static duration. If not, stop and report: traffic stays manual.
2. `scripts/traffic.ts`: 5 stretches from the PRD (start and end coordinates resolved via Places, cached), ratio rule (≥1.5 twice → post, <1.2 twice → clear), writes area updates postedAs "ptp" via the Firebase Admin SDK with a service account from a GitHub secret.
3. `.github/workflows/traffic.yml`: every 15 minutes, 7 AM to 10 PM IST (cron in UTC: verify the conversion), start with 3 stretches and every 30 minutes to protect the demo key cap.

## Final report to the human

End with a short message: what was built, the local URL (and deployed URL if any), what was verified, what is unverified, which fallbacks were used (Map mode, tokens.json vs Figma, emulator vs real Firebase), and exactly what the human needs to do next.
