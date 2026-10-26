# PTP Map-First: PRD v0.1

Oct 7, 2026 · Push The Pin team

## Summary

A map-first home for PTP: Google's map on top, our Pulse feed on the bottom, both live on one screen. The scope matches v1 (Pulse, civic Pins, Gather events). Only the shape of the home screen changes.

The bet: someone in Bandra West opens the app in the morning and sees, in one glance, that a lot is happening within a 10 minute walk that they did not know about. If that moment lands, the app becomes a daily habit. If it does not, a nicer map will not save it.

- Primary user: 40 to 60 year old resident, on a phone, usually standing or walking, not a heavy app user.
- Pilot area: Bandra West (Ward H-West), with seeded data so the first open is never empty.
- Build: a standalone web prototype, about 2.5 hours, using the PTP design system.

How we know it worked, in the first test: 4 of 5 people, unprompted, tap into at least one nearby thing within 60 seconds of opening, and can say what the action button does without being told.

## Calls made

1. Split view is a draggable sheet, not a fixed 50/50 split. A fixed half on a 6 inch phone leaves about 330px of map and room for two cards. A bottom sheet with three heights (peek, half, full) opens at half, which gives the split view, and lets people lean either way. Google Maps users already know it. Dragging is where older users stumble, so the handle also responds to a tap, and a "Map / List" pill switches between full states.
   - Map and feed stay in sync. Panning the map refreshes the feed to what is in view. Tapping a card flies the map to its pin. Scrolling the feed only highlights the matching pin; it never moves the map.
2. One button on every pin. The words change by type, the action does not: Civic "I see it too", Event "I'm going", Ask "I can help". Same component, same place, same count.
3. Ranking uses fresh support (last 7 days), not total support, so stale popular pins do not stay on top. The neighbour verification loop is dropped from this prototype by team decision.
4. Pulse is "last 3 hours", with a fallback. If fewer than 5 items fall in the window, it stretches back to the previous evening and the header says "Since last night".
5. Google cannot give live busyness or "popular times" through the official APIs. Traffic is handled by route checks (see Area updates).
6. Text size is raised for this audience: 16px Regular body, 14px meta, instead of the design system's 13.5px Light. Everything else stays on the design system tokens. This is the one allowed deviation, stored as named override tokens.

## Home screen

One screen, top to bottom: masthead, search, chips, map, sheet.

| Zone | What it holds | Behaviour |
| --- | --- | --- |
| Masthead (top line) | Area name, "Bandra West", with a down arrow | Tap to switch area or return to "Near me". A 28px line, not a full bar. |
| Search bar | "Search places, events, issues", with the profile photo inside its right end | Searches our pins first, then Google places. The photo opens account, my pins and settings. |
| Chips (under search) | All · Issues · Events · Asks | One active at a time. They filter both the map and the sheet. 44px tall. |
| Map (middle) | Google map with its own POI icons muted, our pins, a soft 10 minute walk ring, map tags | Pins from the last 3 hours pulse. Long-press is a shortcut into pin creation. |
| Buttons (bottom right, on the sheet edge) | A labelled "+ Pin" button, with the locate button above it | Visible at peek and half, hidden at full. Labelled, not a bare plus icon. |
| Sheet (bottom) | Header: "14 things within a 10 min walk today". Below it, the "In your area" strip when something is active, then the Pulse feed of cards. | Peek shows only the header. Half is the default and shows header plus 2 to 3 cards. Full shows the list, with a small map strip pinned at the top. |

First open, before location permission: the map shows Bandra West with seeded pins, and the sheet header says "Showing Bandra West". Location is asked only when the user taps the locate button or "Near me".

Tapping a pin or a card opens the existing v1 story-style detail view (Figma node 3552-3120, the "Since yesterday" screen). Reuse it; do not design a new one.

## Creating a pin

"+ Pin" opens a placing mode. A fixed pin sits in the middle of the screen, and the user moves the map under it, not the pin (the Swiggy / Uber pattern).

1. Tap "+ Pin". The map zooms to street level on the user's location (or the map centre if location is denied). The line "Move the map to the spot" appears.
2. As the map moves, the nearest Google place name shows under the pin. Lookup is debounced and runs only when the map is idle.
3. Tap "Use this spot".
4. The sheet rises. Choose a type from three large tiles: Issue, Event, Ask.
5. Write a title on one line. The placeholder shows an example for that type. Events also get day chips (Today, Tomorrow, Pick a date) and a time picker.
6. Tap Post. The pin drops with a pulse, and its card goes to the top of Pulse as "Just now".

Back exits at any step. Long-press on the map jumps straight to step 4 at that spot. One optional photo per pin (Addendum 2026-10-22, 2026-10-23).

## Pin types and the card

| Type | Map marker | Example | Posted by | Button | Extra on the card |
| --- | --- | --- | --- | --- | --- |
| Civic (Pins) | Orange, square-ish | Hawkers back on the footpath outside no. 42 | Neighbour | I see it too | Days open |
| Event (Gather) | Green, round | Watercolour class for beginners, Sat 5pm | Neighbour or a place | I'm going | Date and time, the Google place, Directions |
| Ask | Ink outline | Need someone to water plants for 3 days | Neighbour | I can help | How long ago it was asked |
| Area update | None; a row in the "In your area" strip | No water, tomorrow 10 AM to 6 PM | Push The Pin team | None | Start and end time, area covered |

Every card, in this order:

1. Who posted it, type and how far: "Neighbour · Event · ~6 min walk", or the place's name with its verified mark.
2. Title, at most two lines.
3. When: "Today, 5pm" for events, "2 hrs ago" for civic and asks.
4. Place: the Google place name if there is one, otherwise the nearest street.
5. One action button with its count, plus Share on WhatsApp.

The pulse animation runs only for pins posted or supported in the last 3 hours, and events starting in the next 2 hours.

## Who posted it

No user's name is ever shown in the feed or on the map. Users see their own name and profile only inside their account sheet.

| Poster | Label on the card | On the map | Who can post as this |
| --- | --- | --- | --- |
| Neighbour | "Neighbour" chip (already on the v1 card) | Standard marker | Anyone |
| Place | Place name, verified mark, its Google photo as a small avatar | Marker with a solid accent ring | Only accounts linked to a claimed Google place |
| Push The Pin | PTP mark and "Push The Pin", on an accent orange edge | No marker; area shows only when tapped | Only the PTP team |

Nobody can choose Push The Pin in the creation flow. Place: only a device holding an active claim on that Google place (Addendum 2026-10-22, round 2). In the prototype these posts are seeded or entered by the team directly in the database. Every pin stores the posting device ID (never shown) so abuse can be traced.

## Area updates

Area-wide notices (water cut, power cut, heavy traffic now, road closure) are posted by the PTP team. They are not pins in the feed. They live in a small "In your area" strip at the top of Pulse.

- The strip sits between the sheet header and the feed, and only shows while at least one active update covers the user's location or the masthead area. No empty state.
- One row per update: topic symbol, short fact, time. E.g. water drop · "No water" · "Tomorrow, 10 AM to 6 PM". Three rows max; more collapses into "+2 more".
- Distinct look: PTP mark and accent orange edge. Never confusable with a neighbour post.
- Tapping a row tints the affected area (circle: lat, lng, radiusM) on the map and offers Share on WhatsApp.
- An update disappears at its end time. If the end time was edited later, the row shows "Extended".
- Traffic automation (follow-up phase): every 15 minutes, 7 AM to 10 PM, compare traffic-aware vs free-flow travel time on about 5 fixed stretches (S.V. Road, Hill Road, Linking Road, Turner Road, Carter Road). Ratio 1.5 or more on 2 checks in a row posts "Heavy traffic · S.V. Road · 40 min"; 2 checks under 1.2 clears it. Runs on a GitHub Actions schedule.

## Map tags

A few pins carry a small tag with one live fact. A score picks which pins get tags. The set changes only when the map stops moving, never on a timer.

A tag is a symbol plus a short value. No sentences.

| Pin | Tag | What it shows |
| --- | --- | --- |
| Civic | Ring timer + days, "12d" | Days open. The ring fills over the 7 day deadline and turns red once past. |
| Civic, busy | Up arrow + count, "+5" | New supports in the last 3 hours. Replaces the timer while busy. |
| Event | Clock + time | "in 40m" within 2 hours, "5 PM" later today, "Sat" after today. Place-posted events show the place avatar. |
| Ask | Hand + count, "2" | Offers of help; if none, time since asking, "3h". |
| Cluster | Count by type, "8 events" | When pins merge at wider zoom. |

Area updates get no map tag.

Tag score = interest × urgency × nearness × freshness

- Interest: 1 in this build (personal-history interest is cut from this build).
- Urgency: 2 for a civic pin past its 7 day deadline or an event starting within 2 hours; 1.5 for fresh supports or an event later today; otherwise 1.
- Nearness: 1 / (1 + walkMin / 10).
- Freshness: halved once a tag has been shown 3 times without a tap (per device).

On each map idle (300ms debounce):

1. Cap by zoom: 13 and below, cluster counts only; 14 to 16, top 3 tags; 17+, top 6.
2. No overlaps: if a tag's screen box overlaps a higher-scoring tag, skip it and try the next candidate.
3. Sticky: a tag already showing stays unless a new candidate beats it by 30% or more.
4. A selected pin always shows its tag.

## Support and ranking

Feed score = (1 + supports7d) / ((1 + walkMin / 10) × (1 + hoursOld / 6))

For events, hoursOld is replaced by hours until start. Civic pins with 3+ fresh supports get a small boost.

- One support per device per pin (anonymous ID). A second tap removes it.
- Supporting a civic pin puts it back in Pulse for 3 hours.
- Civic pins with no fresh support for 30 days are hidden.
- Past events disappear 2 hours after they end. Area updates disappear at their end time.

## Google data and cost

We run on the Maps Demo Key: no billing account, an unpublished daily cap, usage pauses for the day once hit.

| What | Google product | Used for | Rule |
| --- | --- | --- | --- |
| Base map, markers | Maps JavaScript API | Map, muted POIs, custom markers | One map load per session. Never remount the map on filter change. |
| Place picker / search | Places Autocomplete (New) | Attaching a pin to a real place; search | Session tokens, so a search counts as one session. |
| Place details | Places API (New) | Name and address of the attached place | Fetch once at pin creation; store placeId and placeName on the pin. |
| Traffic | Routes API (computeRoutes) | Automated traffic rows | Follow-up phase only. |
| Walking time | None | "~6 min walk" | Straight-line distance / 80 m per minute. Labelled "~". |

## Data model and stack

| Collection | Fields |
| --- | --- |
| pins | id, type (civic, event, ask, area), title, body, lat, lng, placeId, placeName, startsAt (events), endsAt and radiusM (area), createdAt, createdBy (device ID), lastSupportAt, postedAs (neighbour, place, ptp), status (active, hidden) |
| supports | pinId, deviceId, createdAt. Document id = `${pinId}_${deviceId}` so double taps cannot count twice. |

supports7d is computed in the client. Fine for 30 to 200 pins.

Stack: React + Vite + TypeScript, Maps JavaScript API via @vis.gl/react-google-maps, Firestore with anonymous auth, Firebase Hosting.

## Build instructions (design)

1. Pull the design system from the Figma file "Push the pin" (fileKey ldoemly9GNCdo4TNCfyCZH) via the Figma MCP before writing UI. Reference frame: node 3552-3120. If the Figma MCP is not available, use design/tokens.json in this folder and say so.
2. Load the frontend-design skill before building UI.
3. Figma tokens only, for colour, radius, elevation and type. No new colours, no new shadows.
4. Reuse: card shell, status chips, pill buttons with press-s, the story-style detail view. New components (map tags, placing pin, sheet header, area strip) are built from the same tokens.
5. Type size override tokens: 16px Regular body, 14px meta.
6. Style the map to the system: warm muted base close to canvas, POI icons hidden, quiet roads.

No generic AI look:

- No purple or blue gradients, no glows, no default Tailwind grey cards with big soft shadows.
- No Inter, Roboto or system fonts.
- No emoji as icons.
- No glass or blur beyond paper-glass and sheet elevation.
- No placeholder data ("Community Event 1", lorem ipsum). Seed data reads like real Bandra West life.
- No decorative empty states, confetti or celebratory animation.

Done means: screenshots of home at all three sheet heights, the creation flow, a card and the area strip, side by side with the Figma frame; anything that would not pass as part of the Figma file is fixed.

## Addendum 2026-10-22: name labels and opinion bubbles

Asked for by the team after v0.1; details in docs/DECISIONS.md (2026-10-22).

- Name labels: the place name under each pin at zoom 16+, and always on the selected pin. text/micro, ink-80, white halo. Labels never collide (same overlap check as tags). Never a person's name.
- Comments: { id, pinId, text (max 280), createdAt, deviceId (never shown), status live | under_review }. New comments post as under_review; only live comments show.
- Opinion bubbles: a small speech bubble above a pin with its newest live comment, "quote" (60 characters max), then "Neighbour, 2h". At most 3 on screen, picked by tag score, recomputed on map idle only, no timers. A pin shows a tag or a bubble, never both. Tapping a bubble opens the detail view at its comments, with an "Add what you saw" field.

Round 2 (same day, asked for by the team; details in docs/DECISIONS.md 2026-10-22 round 2):

- Pins: Google-sized round discs (24 px, no stem), anchored at the centre; the selected pin is a 32 px disc in a halo.
- Pin text replaces name labels: the post's title right of the pin, Google style, then its tag. The most relevant pins get text first and more appear as you zoom in (only the selected pin at zoom 13 and below).
- Opinion bubbles: "@ Place" on top (tap: everything posted at that place), the quote, then "500 m away" and "+2" when there are more comments. Several can show at once (still at most 3); a bubble opens below its pin when the spot above is taken.
- Merging (2026-10-23): neighbours posting the same kind of thing at the same spot (within 30 m; an issue never merges with an ask) show as one marker with "+N", N = how many others posted it. This replaces the civic "busy" tag (up arrow + count).
- Photos (2026-10-23): one optional photo per pin, shrunk on the phone, shown in the detail view straight away.
- Popups (2026-10-23): Pulse on the map. Any pin can get a popup, the most important and recent first (the feed's ranking, near the middle of the view), more as you zoom in (2 at zoom 14 up to 5 at 17+, none at cluster zooms); zoomed in on one pin, it shows its popup. A pin with comments shows its newest comment; any other pin shows its title, with the time for events and the last day for offers.
- "@ Place" on cards and the detail view opens the same place list.
- Claimed places: a business claims its Google place for $100 a month (mock checkout in the prototype, nothing charged). The team checks each claim. With an active claim the device can post as the place: an Offer ("20% off this week", with a last day) or an Event. Offers are marked "Offer" and rank a little below neighbours' posts (x0.8). Everyone else keeps posting as Neighbour.

## Out of scope

Neighbour verification loop, login, photo review (photos show straight away), notifications, moderation tools (comments wait as under_review; making them live is done by the team in the database), Listing / Moment pins (Deal pins: see Offers, Addendum 2026-10-22), real billing for claims, outside event feeds, personal-history interest scoring. Traffic automation is a follow-up phase.

## Risks

- Maps Demo Key daily cap is unpublished; hitting it blanks the map until the next day.
- The demo project may not allow a custom Map ID; the warm map style then needs a fallback (see IMPLEMENTATION.md).
- Anyone can post without login; Firestore rules check types and lengths only.
- Seed data decides the first impression.
- Drag gestures for older users: covered by tap-to-expand and the Map / List pill; watch in testing.

## Test

5 Bandra West residents aged 45 to 60, own phones, 15 minutes each. Watch, do not explain. Tasks: "What's happening near you today?", "Find something you might go to this weekend", "There's a broken streetlight on your road, tell your neighbours".
