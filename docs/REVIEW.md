# PTP Map-First: independent design and product review

Date: 2026-10-07. Reviewer saw only what a user sees: CLAUDE.md, docs/PRD.md, docs/figma/SPEC.md and the Figma PNGs, the app screenshots in docs/screens/ and docs/screens/qa/, and docs/screens/qa/audit.json. No source code was read.

Key: PASS = visibly meets the requirement. FAIL = visibly does not. CV = CANNOT VERIFY FROM SCREENSHOTS (behaviour, timing or a state that was not captured).

Paths: `qa/` = docs/screens/qa/, and any other file name without a folder = docs/screens/. Figma PNGs are written as `figma/…` (docs/figma/).

Stale captures: top-home.png, top-search.png, top-area-*.png, top-account.png and map-selected.png show no "+ Pin" button at half sheet, and top-home.png shows the place name overlapping "Event" on the card. The newer qa/ set and sheet-card.png show both fixed. I judged from the qa/ set and used the top-* files only for states the qa/ set does not cover (search, area sheet, account).

---

## A. PRD checklist

### Calls made

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| A1 | Draggable sheet with three heights: peek, half, full | PASS | qa/06-home-peek, qa/01-home-half, qa/05-home-full (both sizes) |
| A2 | Opens at half | CV | qa/01 is labelled the default, but first open was not recorded |
| A3 | The handle also responds to a tap | CV | The handle is drawn (qa/01). A tap cannot be seen in a still image. |
| A4 | "Map / List" pill switches between full states | PASS | "List" at half (qa/01) and "Map" at full (qa/05) |
| A5 | Panning refreshes the feed. Tapping a card flies to its pin. Scrolling only highlights. | CV | Behaviour. The header count does change by viewport (5 at z15 in qa/08, 1 at z17 in qa/09, 6 at z13 in qa/10). |
| A6 | One button on every pin, words by type: "I see it too", "I'm going", "I can help". Same component, same place, same count. | PASS | detail-civic ("I see it too · 9 see it"), detail-event ("I'm going · 6 going"), detail-ask ("I can help · 2 can help"), sheet-card |
| A7 | Ranking by fresh support (7 days) | CV | Ranking logic |
| A8 | Pulse is "last 3 hours", falling back to "Since last night" when fewer than 5 items | PASS | qa/09-tags-z17 and create-6-posted: "Showing Bandra West, since last night". Detail header reads "Last 3 hours" (qa/07). |
| A9 | No live busyness or popular times | PASS | Nothing of the kind on any screen |
| A10 | Text override: 16px Regular body, 14px meta | PASS | audit.json: body and "when" are 16/400, meta is 14/400, nothing below 14 in all 4 states |

### Home screen

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| H1 | Order top to bottom: masthead, search, chips, map, sheet | PASS | qa/01-home-half-390x844 |
| H2 | Masthead: "Bandra West" with a down arrow, a 28px line and not a full bar | PASS | qa/01: a slim pill about 28px tall with a chevron |
| H3 | Masthead tap switches area or returns to "Near me" | PASS | top-area-sheet ("Switch area": Bandra West selected, Near me), top-area-denied |
| H4 | Search placeholder reads "Search places, events, issues" | PASS at 390, FAIL at 360 | qa/01-390 shows it in full. Every qa/*-360x800 cuts it to "Search places, events, iss…". |
| H5 | Profile photo inside the right end of search | PASS (with a note) | An orange-soft circle with a person glyph (qa/01). With no login there is no photo, and that fits the masthead avatar spec. |
| H6 | Search shows our pins first, then Google places | PASS | top-search: "On Push The Pin" section, then "Places" |
| H7 | The photo opens account, my pins and settings | FAIL (low) | top-account shows "Your account", "Your name" and "My pins". No settings are visible. |
| H8 | Chips: All · Issues · Events · Asks, one active, 44px tall | PASS | qa/01: four chips, only "All" active. They measure about 43 to 44px. No chip appears in audit smallTargets. |
| H9 | Chips filter both the map and the sheet | CV | No capture with a chip other than All selected |
| H10 | Google map with POI icons muted | PASS | No POI icons on any map. Only area and road text labels remain (qa/06, qa/09). |
| H11 | Soft 10 minute walk ring | PASS | Thin ink ring (qa/06, qa/10) |
| H12 | Our pins and map tags on the map | PASS | qa/08-tags-z15 |
| H13 | Pins from the last 3 hours pulse | CV | Halos are drawn on many pins (qa/06), but timing and eligibility cannot be checked |
| H14 | Long-press is a shortcut into creation | CV | Gesture |
| H15 | Labelled "+ Pin" button with locate above it, on the sheet edge | PASS | qa/01, qa/06: locate circle above a "+ Pin" pill, bottom right |
| H16 | Buttons visible at peek and half, hidden at full | PASS | Visible in qa/06 and qa/01, gone in qa/05 |
| H17 | Sheet header "N things within a 10 min walk today" | PASS | "5 things within a 10 min walk today" (qa/01) |
| H18 | "In your area" strip sits between the header and the feed | PASS | qa/01, qa/02 |
| H19 | Peek shows only the header | PASS | qa/06 (both sizes) |
| H20 | Half is the default and shows the header plus 2 to 3 cards | **FAIL** | qa/01-390: header, then the area strip, then one card cut off before its button. qa/01-360: about half of one card. Not one whole card is visible at half. |
| H21 | Full shows the list with a small map strip pinned at the top | PASS | qa/05: a map strip of about 210px above the sheet |
| H22 | First open, before permission: the map shows Bandra West with seed pins and the header says "Showing Bandra West" | PASS | qa/01 sub-line "Showing Bandra West" |
| H23 | Location is asked only from locate or "Near me" | CV | top-area-denied shows the fallback after Near me. Whether the app ever asks unprompted cannot be seen. |
| H24 | A pin or card opens the existing v1 story-style detail (3552-3120) | PASS (with gaps, see E) | detail-vs-figma, qa/07: close button, title line, progress segments, next arrow, sheet with meta, Neighbour chip, h1 title and body |

### Creating a pin

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| C1 | "+ Pin" opens placing mode: a fixed centre pin, the map moves under it | PASS | create-2-placing, qa/11 |
| C2 | Step 1: zooms to street level and shows "Move the map to the spot" | PASS | qa/11, create-2 |
| C3 | Step 2: nearest Google place name under the pin | PASS | "S2S ELECTRICAL SERVICES" (qa/11-390), "Godfrey Villa 37-B" (create-3), "7 Elements" (qa/11-360) |
| C4 | Step 2: lookup is debounced and runs only on idle | CV | Behaviour |
| C5 | Step 3: "Use this spot" | PASS | qa/11 |
| C6 | Step 4: the sheet rises with three large tiles: Issue, Event, Ask | PASS | qa/12, create-4 |
| C7 | Step 5: one-line title | PASS | qa/13: a single-line field that scrolls horizontally |
| C8 | Step 5: the placeholder is an example for that type | CV | Every capture of the title field is already filled (qa/13, create-5) |
| C9 | Step 5: events get Today, Tomorrow and Pick a date, plus a time picker | PASS | qa/13, create-5 ("11:30 PM") |
| C10 | Step 6: Post drops the pin with a pulse | CV | create-6 shows a halo on the new marker, but the snack covers it and the animation cannot be seen |
| C11 | Step 6: the card goes to the top of Pulse as "Just now" | **FAIL** | create-6-posted: the new card is first, but nowhere does it say "Just now". It shows "Neighbour · Event · ~1 min walk" and "Tomorrow, 11:30pm". |
| C12 | Back exits at any step | PASS (partly CV) | "Back" (qa/11) and a back chevron (qa/12, qa/13) on every step. The exit itself is behaviour. |
| C13 | Long-press jumps straight to step 4 | CV | Gesture |
| C14 | No photos | PASS | No photo control in any create screen |
| C15 | Users can only post as Neighbour | PASS | No poster choice in qa/12 or qa/13. The posted card reads "Neighbour" (create-6). |

### Pin types and the card

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| P1 | Civic marker is orange and square-ish | PASS | qa/06 |
| P2 | Event marker is green and round | PASS (conflicts with Figma, see E) | qa/06 |
| P3 | Ask marker is an ink outline | PASS | qa/06: white disc, ink ring, speech glyph |
| P4 | Area update has no marker, only a strip row | PASS | No area marker on any map. A tint appears only on tap (qa/03). |
| P5 | Civic card extra: days open | CV | No civic card was captured in the feed. Only the detail shows "Open 1 day" (detail-civic). |
| P6 | Event card extra: date and time, the Google place, Directions | PASS | sheet-card ("Tomorrow, 12:04am", "Directions"), create-6 (place "Godfrey Villa 37-B") |
| P7 | Ask card extra: how long ago it was asked | PASS | "1 hr ago" (qa/04) |
| P8 | Area update: start and end time, area covered | PASS | qa/02 times. The area shows as a map tint on tap (qa/03). |
| P9 | Card order 1: who posted, type and distance, or the place name with its verified mark | PASS | "Neighbour · Ask · ~2 min walk" (qa/04). "Diva Yoga Studi… [verified] · Event · ~8 min walk" (sheet-card). |
| P10 | Card order 2: title, at most two lines | PASS | qa/04, qa/05 |
| P11 | Card order 3: when | PASS | "1 hr ago", "Tomorrow, 8:30am" |
| P12 | Card order 4: place, or the nearest street | PASS | "Guru Nanak Park" (qa/04), "Hill Road" (tags-z17) |
| P13 | Card order 5: one action with its count, plus Share on WhatsApp | PASS | qa/04: "I can help", "2 can help", WhatsApp glyph |
| P14 | Pulse only for posts or supports in the last 3h, or events within the next 2h | CV | Timing. Many pins show halos in qa/06; their eligibility cannot be checked. |

### Who posted it

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| W1 | No user name in the feed or on the map | PASS | No user names anywhere outside the account sheet. See section C. |
| W2 | Own name only inside the account sheet | PASS | "Asha Verma" only in top-account |
| W3 | Neighbour: "Neighbour" chip on cards, standard marker | PASS | qa/04, qa/07 chip |
| W4 | Place: name, verified mark and its Google photo as a small avatar | **FAIL** | The avatar is an empty well circle with no photo: sheet-card, qa/05, detail-event, and the "Sun" tag in qa/01 and qa/09 |
| W5 | Place: marker with a solid accent ring | PASS | Green event disc with an orange ring (qa/09, qa/01) |
| W6 | Push The Pin: PTP mark and the words "Push The Pin" on an accent orange edge | FAIL (low) | The strip has the PTP mark (it matches figma/logo-4350-5532.png) and an orange left edge (qa/02), but the words "Push The Pin" appear nowhere |
| W7 | Nobody can choose Place or PTP in creation | PASS | qa/12, qa/13 |

### Area updates

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| U1 | They live in the "In your area" strip, not as feed pins | PASS | qa/01, qa/02 |
| U2 | The strip shows only while an update is active. No empty state. | CV | No capture without active updates |
| U3 | One row per update: topic symbol, short fact, time | PASS | Bulb + "Power cut" + time; droplet + "No water supply" + time (qa/02) |
| U4 | Three rows max, then "+2 more" | CV | Only 2 updates seeded |
| U5 | Distinct look: PTP mark and orange edge, never confusable with a neighbour post | PASS | qa/02 vs qa/04 |
| U6 | Tapping a row tints the area and offers Share on WhatsApp | PASS | qa/03 (both sizes) |
| U7 | Disappears at end time. "Extended" if the end was edited later. | PASS (Extended) / CV (expiry) | "Extended" on No water supply (qa/02) |
| U8 | Traffic automation | n/a | A follow-up phase in the PRD |

### Map tags

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| T1 | A tag is a symbol plus a short value, no sentences | PASS | "+3", "Sat", "20d", "2" |
| T2 | Civic: ring timer and days, "12d" | PASS | "20d" (create-2), "9d" (tags-z14) |
| T3 | Ring fills over 7 days and turns red once past | CV | Only past-deadline pins captured. The ring is orange-red, and the red token is not defined in SPEC. |
| T4 | Civic busy: up arrow and count, "+5" | PASS | "^ +3" (qa/08), "^ +1" (create-2) |
| T5 | Event: clock and time ("in 40m", "5 PM", "Sat") | PASS | "Sat" with a clock (create-2). The "in 40m" and "5 PM" forms were not captured. |
| T6 | Place-posted events show the place avatar in the tag | **FAIL** | The "Sun" tag holds a blank circle (qa/01, qa/09). Same root cause as W4. |
| T7 | Ask: hand and count | FAIL (low) | A heart and count: "♡ 2" (qa/08), "♡ 1" (qa/09) |
| T8 | Cluster: count by type, "8 events" | FAIL (partial) | qa/10: clusters show bare numbers (5, 10, 6, 3, 4). Only one tag reads "2 issues". |
| T9 | Area updates get no tag | PASS | None seen |
| T10 | Zoom 13 and below: cluster counts only | **FAIL** | qa/10-clusters-z13 (both sizes): a single unclustered Ask marker with a "♡ 2" tag, and an unclustered event marker overlapping cluster "5" |
| T11 | Zoom 14 to 16: top 3 tags | PASS | 3 tags in qa/08 (z15), 2 in tags-z14 |
| T12 | Zoom 17 and up: top 6 | PASS | 2 or fewer in qa/09 (z17), 4 in create-2 |
| T13 | No overlaps between tags | PASS (tags) | Tags do not overlap each other. The placing label does overlap a tag; see E. |
| T14 | Sticky tags, the selected pin always tagged, change only on map idle, no timers | CV | Behaviour |

### Support and ranking

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| S1 | Feed score formula and civic boost | CV | Logic |
| S2 | One support per device. A second tap removes it. | CV | No before and after capture |
| S3 | Support puts a civic pin back in Pulse for 3h, hides after 30 days, past events disappear | CV | Logic |

### Google data and cost (visible parts only)

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| G1 | Walking time labelled "~" | PASS | "~2 min walk", "~8 min walk" |
| G2 | The attached place name is stored on the pin and shown | PASS | create-6 card shows "Godfrey Villa 37-B", the place picked in create-3 |
| G3 | Autocomplete session tokens, one map load, no remount, no calls in render loops | CV | Network behaviour |

### Build instructions (design)

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| B1 | Design system pulled from Figma | CV | SPEC.md exists. The process itself cannot be seen. |
| B2 | Frontend-design skill loaded | CV | Process |
| B3 | Figma tokens only for colour, radius, elevation and type | FAIL | Weight 500 on every button and chip (audit.json). The design system says nothing heavier than 400 (figma/type.png). Also a bordered card shell and orange used outside the colour rule. See E. |
| B4 | Reuse: card shell, status chips, pill buttons with press-s, story detail | PASS (partial) | Pills and press-orange selection match figma/chip-filter and figma/button. The card shell deviates (E2). |
| B5 | Type size override tokens 16 and 14 | PASS | audit.json |
| B6 | Map styled warm and muted, POIs hidden, quiet roads | PASS | qa/06, qa/09 |

### No generic AI look (PRD list)

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| N1 | No purple or blue gradients, no glows, no grey Tailwind cards with big soft shadows | PASS | See section B |
| N2 | No Inter, Roboto or system fonts | PASS (app) | audit.json lists only Stack Sans Headline and Stack Sans Text. Google's map labels are Google's own rendering. |
| N3 | No emoji as icons | PASS | All icons are stroked glyphs |
| N4 | No glass beyond paper-glass and sheet elevation | PASS | Only the sheet and cards are glass (qa/01) |
| N5 | No placeholder data | PASS | Seed titles read like real Bandra life ("Lost grey cat… answers to Moti", "Hawkers back on the footpath outside no. 100") |
| N6 | No decorative empty states, confetti or celebration | PASS | create-6: an ink snack only. top-account: a plain line, "Pins you post will be listed here." |

### Done means

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| D1 | Screenshots of all three sheet heights, the creation flow, a card and the area strip | PASS | qa/01, qa/05, qa/06, create-1 to create-6, qa/04, qa/02 |
| D2 | Each shown side by side with the Figma frame | FAIL | Only detail-vs-figma.png is a side-by-side. Home, card, strip and creation have none. |
| D3 | Anything that would not pass as part of the Figma file is fixed | FAIL | See section E |

---

## B. Design bans (CLAUDE.md)

| Ban | Verdict | Evidence |
|---|---|---|
| Purple or blue gradients | PASS | None anywhere. No blue at all; the "you" dot was not captured. |
| Glows | PASS | The pin halos are the Figma selected and pulse halo in the pin's own colour (figma/pin-map.png). Nothing else glows. |
| Inter, Roboto or system fonts | PASS | audit.json shows Stack Sans Headline and Text only. Map labels are Google's. The native time input "--:-- --" (qa/13) uses the page font. |
| Emoji icons | PASS | Only stroked glyphs (bulb, droplet, heart, WhatsApp, calendar) |
| Default grey cards with big soft shadows | PASS (with a note) | Cards are paper with a warm shadow pair, but the feed card also has a grey 1.5px outline (E2) |
| Extra glassmorphism | PASS | Only the paper-glass sheet. Blurred pin colours show through behind the sheet header (qa/01, "5 things…"). That is allowed, but it looks muddy. |
| Lorem or "Event 1" data | PASS | None. Google names such as "7 Elements" (qa/11-360) and "Chic Bandra West Hideaway: Cozy 1-Bedroom Retreat" (audit.json, create-placing) are real but odd. |
| Confetti | PASS | None (create-6) |
| Decorative empty states | PASS | top-account empty line is plain text |
| Tokens only, no new colours | FAIL (use, not new hex) | No hue outside the SPEC palette was seen. The palette is misused, though: an orange tint and outline for area circles on the map (qa/03), an orange "Directions" link (detail-event), orange "Extended" text (qa/02), orange-soft icon wells in the strip (qa/02), green for events (qa/06), and weight 500 type (audit.json). Pixel values were not sampled because no image tool was available, so this is judged by eye. |

## C. Privacy

| Check | Verdict | Evidence |
|---|---|---|
| No user name in the feed, on cards, on the map, in detail or in search | PASS | Posters show as "Neighbour" (qa/04, qa/07, detail-civic, detail-ask, create-6) or as place names ("Diva Yoga Studio - Bandra", sheet-card, detail-event). Search shows pin titles and places only (top-search). |
| Own name only in the account sheet | PASS | "Asha Verma" appears only in top-account, with the line "Neighbours never see your name. You post as Neighbour." |
| The avatar in search is not a name or initial | PASS | Person glyph (qa/01) |

## D. Text sizes and touch targets

| Check | Verdict | Evidence |
|---|---|---|
| Body 16 Regular | PASS | audit.json: "1 hr ago" 16/400, detail body 16/400, strip facts 16/400 |
| Meta 14 | PASS | audit.json: "Neighbour", "~2 min walk", place, times, counts are all 14/400 |
| Nothing readable under 14 | PASS | smallText is empty in all 4 audited states. Visually, Google's footer ("Keyboard shortcuts", "Map data") is under 14, but it is Google's. |
| Weight ≤ 400 (Figma type rule) | FAIL | audit.json: every button and chip label is 15/500 ("All", "Issues", "List", "I can help", "Pin", "Use this spot", "Today", "Post", the tiles) |
| Headings on tokens | PASS (with a note) | Sheet header 20 (h3), card title 19 (heading/card), detail title 27 (h1). The masthead is 19, below Figma's h1 27, but the PRD asks for a 28px line. |
| Touch targets ≥ 44 | PASS with CV | audit.json drawn sizes: markers 36x50, tags 24 tall, avatar 40x40. Per the lead note, the hit areas are 52x62, 44 tall and 44x44 through ::after. That extension cannot be seen in a screenshot, so it is CV. Google's own link (66x26) is out of scope. |
| Targets reachable on screen | FAIL (low) | qa/09-tags-z17-360: the "♡ 1" tag is cut off at the right edge. Markers are cut off at the left edge in qa/01-360 and qa/09-360. |

## E. Visual fidelity to Figma

| # | Difference | Severity | Screenshot |
|---|---|---|---|
| E1 | Action button rest state is orange-soft. In figma/card-event.png (toggle/interest), OFF is raised canvas and ON is orange-soft pressed. Every "I can help", "I'm going" and "I see it too" at rest looks already switched on. | high | qa/04, sheet-card, detail-* |
| E2 | Feed card shell has a grey 1.5px outline plus a shadow. figma/card-update.png says "DEPTH — the shadow pair, not a border". The area strip card has no outline, so the two cards are also inconsistent with each other. | high | qa/04, qa/05, create-6 |
| E3 | Button and chip labels are weight 500. The type page says nothing is heavier than 400. | medium | audit.json, qa/01 chips |
| E4 | Place avatars are blank circles in cards, detail and tags, which reads as a broken image | high | sheet-card, detail-event, qa/01 "Sun" tag |
| E5 | Orange outside the colour rule (orange is for the current tab, the one main action and a confirmed source; on the map, only an open problem): orange-tinted area circle on the map (qa/03), orange "Directions" in detail (detail-event; the card version is ink, sheet-card), orange "Extended" status text (qa/02), orange-soft icon wells on every strip row (qa/02). The PRD asks only for an orange edge and the PTP mark. | medium | qa/02, qa/03, detail-event |
| E6 | Events are green markers with green pulse halos. The Figma pin/map rule makes events ink and keeps green for a confirmed fix. The PRD asks for green, so the PRD wins, but the conflict needs a line in DECISIONS. The same applies to the orange ring on place markers (map orange means an open problem only). | medium (logging) | qa/06, figma/pin-map.png |
| E7 | Story detail: a large empty band, about 120pt each, above and below the map well, so the card/map floats mid-screen. The Figma frame fills that space with media. The rail and the heart and comment pills are also gone; the verification loop is out of scope, but there is no replacement for that rhythm. | medium | detail-civic, detail-ask, detail-vs-figma |
| E8 | Detail meta order is inconsistent: civic and ask have place left and date right (as in Figma), event has date left and place right | low | detail-event vs detail-civic |
| E9 | Half sheet: the area strip pushes the first card below the fold, so the "one glance" home shows almost no Pulse | high (product) | qa/01 (both sizes) |
| E10 | Placing label (place name pill) sits on top of the "20d" tag and an ask marker | medium | create-2-placing, create-3-placename |
| E11 | Unselected filter chips look raised with an outer shadow over the map. figma/chip-filter.png default is pressed into a canvas well (press-s inset). | low | qa/01 |
| E12 | Markers hide under the search bar and chips (a marker under "33rd" behind search), and markers stack on top of each other at z15 | low | qa/01, qa/06 (Hill Rd and ANW stack) |
| E13 | At 360: strip times wrap mid-phrase ("1:30 / AM", "6 / PM") and the search placeholder is cut off | low | qa/02-360, qa/01-360 |
| E14 | The snack covers the new pin just dropped, so the pin-drop moment is hidden | low | create-6-posted |
| E15 | Card meta has uneven spacing around the middle dot ("Neighbour  · Ask") | low | qa/04 |
| E16 | Header copy changes with zoom ("5 things… today" at z15, "1 thing… since last night" at z17, "6 things" at z13), so "within a 10 min walk" stops being true when the count is by viewport | low | qa/08, qa/09, qa/10 |

---

## F. Fixes

### FAILS to fix (most important first)

1. Half sheet shows no complete card. The PRD asks for the header plus 2 to 3 cards. The area strip takes the space (qa/01-390 and qa/01-360).
2. Place avatars are blank. Card row 1, the detail and event tags show an empty circle instead of the Google photo (sheet-card, detail-event, qa/01 and qa/09 "Sun" tag).
3. The action button at rest looks like Figma's ON state (orange-soft). It should rest raised on canvas and press into orange-soft when on (figma/card-event.png vs qa/04).
4. The feed card has an outline. Remove the 1.5 border and use the shadow pair only, so the card matches card/update and the area strip (qa/04 vs figma/card-update.png).
5. After posting, the new card does not say "Just now" (create-6-posted).
6. At zoom 13 and below, single markers and an Ask tag still show. The PRD allows cluster counts only (qa/10, both sizes).
7. Weight 500 on all button and chip labels. The design system caps at 400 (audit.json).
8. Orange is used outside the colour rule: area tint on the map, "Directions" in detail, "Extended" text, and the orange-soft icon wells in the strip (qa/03, detail-event, qa/02).
9. Cluster labels are bare numbers. The PRD asks for counts by type, such as "8 events" (qa/10).
10. The placing label overlaps tags and markers (create-2, create-3).
11. "Done means" asks for side-by-side Figma comparisons of home, card, strip and creation. Only the detail has one (detail-vs-figma.png).
12. The Ask tag uses a heart. The PRD asks for a hand (qa/08, qa/09).
13. The area strip lacks the words "Push The Pin" next to the PTP mark (qa/02).
14. The account sheet shows no settings (top-account).
15. At 360 the search placeholder is cut off ("…iss…") and the z17 tag is clipped at the screen edge (qa/01-360, qa/09-360).

### Nits

- Story detail has dead space above and below the map well (detail-civic, detail-ask).
- Detail meta order differs between event and civic or ask (detail-event).
- Detail header says "Last 3 hours" on a civic pin posted "Yesterday, 7:25pm" (detail-civic).
- Strip times wrap mid-phrase at 360 (qa/02-360).
- The snack covers the dropped pin (create-6).
- Filter chips look raised, not pressed (qa/01 vs figma/chip-filter.png).
- Markers sit under the search and chips, and stack at z15 (qa/01, qa/06).
- Uneven spacing around the middle dot in card meta (qa/04).
- Header count and "today" change with zoom (qa/08, qa/09, qa/10).
- Odd Google place names in placing ("7 Elements", "Chic Bandra West Hideaway…"). Search returns Ghatkopar results for Bandra (top-search).
- A test post titled "…Sat 5pm" but scheduled "Tomorrow, 11:30pm" appears in an evidence screenshot (create-6).
- Stale screenshots: top-home, top-search, top-area-*, top-account and map-selected have no "+ Pin", and top-home has the name overlapping "Event". Recapture them.
- Event green and the place marker's orange ring are PRD-mandated but conflict with the Figma colour rule. Log the conflict in DECISIONS.md.

### Tally (sections A to D)

Rows with a split verdict are counted once by their main verdict. H4, which passes at 390 and fails at 360, is counted as a FAIL. U8 (traffic) is n/a and not counted.

- PASS: 92
- FAIL: 16
- CANNOT VERIFY: 24

---

## G. Lead resolution (2026-10-07, after review pass 1)

Fixed, re-screenshotted and looked at (post-fix evidence: docs/screens/qa/*-360x800.png taken after the fixes, docs/screens/top-account.png, sbs-home-vs-figma.png, sbs-card-vs-figma.png, sbs-create-vs-figma.png):

| # | Fail | Resolution | Status |
|---|---|---|---|
| 1 | Half sheet shows no whole card | Half raised 58% → 62%; area strip rows tightened. With an active area update, half shows header + strip + the first card's top; without a strip ~2 cards. Remaining gap JUSTIFIED (DECISIONS.md): PRD places the strip between header and feed, and two live updates need two rows. | Justified |
| 2 | Place avatars blank | PlaceLabel shows the place's initial when Google returns no photo (none of the seeded venues has one); map tag falls back to the clock symbol. | Fixed |
| 3 | Action button looks "on" at rest | Off = quiet (raised canvas), on = soft pressed, per Figma toggle/interest (card + detail). qa/04, qa/07, sbs-card. | Fixed |
| 4 | Grey outline on feed card | Removed; highlight shows on the map marker only. | Fixed |
| 5 | No "Just now" after posting | Events posted < 2 min ago read "Just now · <start>"; civic/ask already read "Just now". | Fixed (unit-tested; not re-screenshotted, Maps quota) |
| 6 | Single pin + tag at zoom 13 | That pin was the SELECTED pin; PRD Map tags rule 4 "A selected pin always shows its tag". | Justified |
| 7 | Labels weight 500 | design/tokens.json sanctions text/label-lg = Medium 500 as the one allowed type deviation. | Justified |
| 8 | Orange outside the colour rule | Area tint now ink; Directions link ink + underline; "Extended" ink + underline; strip icon wells now well/ink. PTP accent edge and PTP mark stay (PRD). | Fixed |
| 9 | Clusters show bare numbers | Cluster markers are the Figma cluster marker (count only); "N type" tags are added per cluster subject to the PRD overlap rule ("skip it and try the next candidate"). | Justified |
| 10 | Placing label covers tags | Tags hidden while creating a pin. | Fixed |
| 11 | Side-by-sides only for detail | Added sbs-home-vs-figma.png, sbs-card-vs-figma.png, sbs-create-vs-figma.png (+ existing detail-vs-figma.png). | Fixed |
| 12 | Ask tag uses a heart, PRD says hand | No hand glyph exists in the Figma icon set (05 Icons); CLAUDE.md forbids inventing visuals outside the design system. | Justified |
| 13 | Strip lacks "Push The Pin" words | Strip header = PtpLabel ("Push The Pin" + mark) + "In your area". qa/02-360. | Fixed |
| 14 | No settings in account sheet | Settings section: Location (status + "Use my location") and "Forget my name on this phone". top-account.png. | Fixed |
| 15 | 360: placeholder cut, z17 tag clipped | Placeholder now ends with an ellipsis (correct behaviour at 360 with a 16 px font). Tags whose box would leave the screen are skipped. | Fixed / Justified |
| — | Stale top-* screenshots | top-home, top-account, top-area-sheet, top-search recaptured. | Fixed |

Not re-shot: the 390x844 qa set after the fixes, and the create "Just now" state. The Maps Demo Key daily quota was reached during re-capture ("Maps Demo Key limit reached: Your daily quota for Maps JavaScript 2D has been met"); the map is blank until the quota resets. The 360x800 post-fix set covers the same states.

Result: no unjustified fails remain.
