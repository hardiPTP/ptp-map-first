# Brief for builder agents (written by the lead)

Read, in this order, before writing code: `CLAUDE.md`, the PRD sections named in your task (`docs/PRD.md`), your section of `docs/IMPLEMENTATION.md`, this file, and `docs/figma/SPEC.md` (the Figma design system, extracted). Look at the relevant PNGs in `docs/figma/`.

## Hard rules (from CLAUDE.md, restated)
- Edit ONLY the files/folders you own. If you need a change in `src/types.ts`, `src/store/`, `src/design/`, `src/app/`, `package.json` or any other agent's folder, do not make it: write it as a "contract change request" in your final report. You may create new files inside your own folders and tests under `tests/unit/<yourarea>*.test.ts(x)` or `tests/e2e/<yourarea>*.spec.ts`.
- Never invent Google Maps / Places / Firebase / @vis.gl/react-google-maps API names or behaviour. Check the official docs with WebFetch first and put the doc URL in a code comment.
- Never invent places, addresses or coordinates. Unit tests may use synthetic numbers that are never displayed.
- Never print, log or commit the API key (it is in `.env`; Vite exposes it as `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`). No Google calls in render loops, in tests, or on every keystroke without a session token. Mock Google in unit tests.
- Never show any user's name in the feed, on cards or on the map. Poster labels only: Neighbour / Place / Push The Pin.
- Map tags change on map idle only. No timers, no setInterval, no auto-rotation anywhere.
- Design: tokens only (`src/design/tokens.css`). Use the primitives in `src/design/primitives.tsx` (Button, ShellButton, Chip, Card, Tag, NeighbourLabel, PlaceLabel, PtpLabel, PtpMark, SheetSurface, Grabber, Field, Snack, Icon). Icons: `<Icon name="ic-whatsapp" />` etc, file names in `src/design/icons/`. Text: use `--text-body-lg` (16) for body, `--text-meta-lg` (14) for meta, `--text-label-lg` for labels, headline tokens (`--text-card`, `--text-h2`...) for headings. Never below 14px for readable text. Touch targets at least 44px.
- Banned: purple/blue gradients, glows, Inter/Roboto/system fonts, emoji as icons, default grey cards with big soft shadows, extra glassmorphism, lorem ipsum, "Event 1" data, confetti, decorative empty states.
- Plain CSS files next to components (no Tailwind, no CSS-in-JS libraries). Class prefix per area: `map-`, `sheet-`, `top-`, `create-`, `detail-`, `data-`.

## Frozen contracts
- `src/types.ts`: Pin, Support, AreaUpdate, NewPin, Repo, Bounds, Filter, SheetHeight. All times are epoch ms.
- `src/store/index.ts`: zustand `useStore` with state + actions. Read it fully. Notably: `pins`, `supports`, `deviceId`, `filter`, `selectedPinId`, `highlightedPinId`, `selectedAreaId`, `searchPlace`, `detailPinId`, `sheetHeight`, `viewport` (set by map on idle only), `flyTo` (one-shot camera command via `requestFlyTo`), `areaMode`, `userLocation`, `locationStatus`, `create` + `startCreate/confirmSpot/cancelCreate`. Constants `BANDRA_WEST`, `AREA_NAME`, `DEFAULT_ZOOM`.
- `src/lib/geo.ts` (lead): `distanceM`, `walkMin`, `formatWalk`, `WALK_RING_M` (800).
- `src/lib/pulse.ts`, `src/lib/rank.ts`: signatures fixed, bodies by agent B.
- `src/data/index.ts` exports `repo: Repo` (agent C). App wiring (`src/app/useData.ts`) calls `repo.init()`, then `subscribePins` and `subscribeSupports` into the store. Agents read data from the store, never from the repo directly, except: `repo.toggleSupport` (cards/detail) and `repo.createPin` (create flow).
- Area updates are pins with `type: 'area'`, `postedAs: 'ptp'`. They never render as markers or feed cards.
- Origin for walking time: `userLocation` when `areaMode === 'nearMe'` and known, else the map centre (`viewport.center`).

## App layout (src/app, lead)
Layers: map full bleed (z 0), `TopBar` (z 10, absolute top), `SheetLayer` (z 20), floating buttons `LocateButton` + `PinButton` (z 25, bottom right, positioned at `bottom: calc(var(--sheet-offset) + 12px)`; hidden when sheet is full or creating), `CreateLayer` (z 30), `DetailLayer` (z 40), account/area sheets (z 50). BottomSheet must set `--sheet-offset` (px of sheet visible above the bottom edge) on `document.documentElement`.

## Running and checking
- Dev server: `http://localhost:5173` is normally already running (lead started it). Check with `curl -s -o /dev/null -w "%{http_code}" localhost:5173`. If it is down, start it with `npm run dev -- --port 5173 --strictPort` in the background. Do not start a second server on another port.
- Screenshots: `npx tsx scripts/shot.ts <path> <out.png> [w] [h] [waitMs]` (390x844 default, 2x). Save yours under `docs/screens/<area>-*.png`. You must Read (look at) every screenshot you cite. For interactive states write a small Playwright script in your own folder under `tests/e2e/` or in the scratchpad.
- Data source: `VITE_DATA_SOURCE=mock` in `.env` (in-memory mock fed by seed data). Only agent C runs the Firestore emulator (`npm run emulators`, ports 8080/9099). Others must not start emulators.
- Checks: `npm run typecheck`, `npm run lint`, `npm test` (unit), all must pass before you report.

## Final report (required format)
1. Built (files). 2. Verified, and how (commands, screenshots looked at). 3. Unverified. 4. Contract change requests (exact diff wanted). 5. Anything that conflicts with PRD/Figma.
