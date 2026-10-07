# PTP design system spec (extracted from Figma ldoemly9GNCdo4TNCfyCZH)

Extracted 2026-10-07 via get_design_context / get_metadata / get_screenshot. Screenshots are in this folder, SVGs in src/design/icons/.
Units are px. "RAW" = value in Figma not backed by a token. Shadows are given in CSS order (x y blur colour). Figma blur radius N is about CSS blur N/2 for backdrop-filter (code export uses blur-[8px] for raise, blur-[6px] for raise-s).
All node ids are Figma ids (colon form). Nothing here was invented; where a value was not returned it says "not returned".

## 0. Rules from the token pages

### The colour rule (3586:1382, the-colour-rule.png)
- Colour says what a thing is. It never says where you are, and is never decoration.
- Orange, three uses only: the tab you are on, the one main action, a confirmed source. On the map it means an open problem and nothing else.
- Green, amber, red: only on a problem's record. Events, places, notices have no state, so no state colour.
- Everything else is ink, at a strength. Never a separate grey.
- Position cannot be bought. Presence can be paid for. Nothing paid sits above the problems line.

### Type (3586:1282, type.png)
Two families. Headline for anything that behaves as a heading, Text for everything else. Nothing heavier than 400.
| token | family | weight | size / line-height | tracking |
|---|---|---|---|---|
| heading/h1 | Stack Sans Headline | Regular 400 | 27 / 32 | -0.594 (-2.2%) |
| heading/h2 | Stack Sans Headline | 400 | 23 / 28 | -0.46 (-2%) |
| heading/h3 | Stack Sans Headline | 400 | 20 / 25 | -0.36 (-1.8%) |
| heading/card | Stack Sans Headline | 400 | 19 / 25 | -0.342 (-1.8%) |
| text/body | Stack Sans Text | Light 300 | 13.5 / 21.6 | 0 |
| text/label | Stack Sans Text | Regular 400 | 13 / 18 | 0 |
| text/meta | Stack Sans Text | Light 300 | 12.5 / 16 | 0 |
| text/micro | Stack Sans Text | Light 300 | 12 / 16 | 0 |
Token page sample labels: "27 / 400", "13.5 / 300", "12 / 300" (size / weight).
Text with no matching token style seen in components (RAW sizes, see section 4): 15 Regular, 14 Regular, 14 Light, 12 Regular, 12.5 Regular, 11 Regular.

### Elevation (3586:1317, elevation.png)
"Every raised thing is a pair: a white shadow up-left and a warm dark one down-right. Pressed is the same pair, inset. Over a photograph, drop the white half."
| token | effects (CSS) | backdrop blur (Figma) |
|---|---|---|
| elevation/raise | 5px 6px 14px rgba(23,20,15,0.13), -4px -4px 10px rgba(255,255,255,0.72) | 16 (CSS 8px) |
| elevation/raise-s | 3px 4px 9px rgba(23,20,15,0.10), -2px -2px 6px rgba(255,255,255,0.62) | 12 (CSS 6px) |
| elevation/press | inset 4px 5px 9px rgba(23,20,15,0.14), inset -4px -5px 9px rgba(255,255,255,0.49) | none |
| elevation/press-s | inset 2px 3px 6px rgba(23,20,15,0.10), inset -2px -3px 6px rgba(255,255,255,0.80) | none |
| elevation/press-orange | inset 3px 4px 8px rgba(140,71,15,0.42), inset -3px -4px 8px rgba(255,255,255,0.28) | none |
| elevation/over-media | inset 3px 4px 8px rgba(23,20,15,0.22), inset -2px -2px 6px rgba(255,255,255,0.16) | none |
| elevation/marker | drop 0 4px 10px rgba(23,20,15,0.28) (code export for pin uses 0 4px 5px, same look) | none |
| focus/ring | 0 0 0 3px #E4491C (drop shadow, offset 0, blur 0, spread 3) | none |
Swatch pages use canvas fill, 120x56, radius well 18. press-orange swatch fill is accent/orange.

### Radius and spacing (3586:1340, radius-and-spacing.png)
"Card rhythm is not uniform: 9 above the title, 14 below it, 16 above the footer. Strokes are 1.5 everywhere except the rail, which is 2."
Radius: radius/screen 44, radius/sheet 28, radius/card 24, radius/media-outer 20, radius/media-inner 14 (used in cards, not on the page), radius/well 18, radius/pill 999.
Spacing: 20 margin (screen side margin); 14 card pad (all four sides of a card); 4 card inset (text rows sit in from the photograph); 18 between cards (feed gap); 44 touch min (smallest tap target).
Token page container: paper fill, 1.5 line border, radius media-outer 20, padding 28, gap 20, title heading/h3, intro text/label-size 13 Light at ink 45%.

### Colour tokens seen (hex as returned)
| token | value |
|---|---|
| colour/ink/100 | #17140F |
| colour/ink/80 | #413D38 (opaque hex) |
| colour/ink/60 | rgba(23,20,15,0.60) |
| colour/ink/45 | rgba(23,20,15,0.45) |
| colour/ink/25 | rgba(23,20,15,0.25) |
| colour/surface/paper | #FFFFFF |
| colour/surface/paper-glass | rgba(255,255,255,0.76) (with backdrop blur) |
| colour/surface/canvas | #FBF8F4 |
| colour/surface/well | #F1ECE4 |
| colour/surface/line | #E7E3DC |
| colour/surface/group | #E9E4DB (backdrop behind component sheets) |
| colour/accent/orange | #E4491C |
| colour/accent/orange-deep | #B8380F |
| colour/accent/orange-soft | #FFE7D6 |
| colour/accent/cream | #FFF6EE |
| colour/state/green | #2F9E6B |
| colour/state/green-deep | #1F6B47 |
| colour/state/green-soft | #E1F0E8 |
| colour/state/amber | #E8A33D |
| colour/state/red | referenced in descriptions ("a fix that did not hold"); value NOT returned by any node pulled |
Ink strengths are written in the design as opacity on the element (opacity-45, opacity-60, opacity-80, opacity-25) as well as tokens ink/45, ink/60, ink/25. Treat both as the same thing.

## 1. Cards

### card/event (3565:3998, card-event.png)
Description (verbatim): The Gather feed card, same anatomy as the Pulse card: place with the verified glyph inline, posted date on the right, title, photograph in a pressed well, then the when row carrying the calendar glyph and the distance, then the interest control with the count beside it. Unlike a civic card this one does carry an action, which is how the prototype has it. Delete the "verified" glyph when the source is a neighbour.
Variants: state = default | interested.
- Card: w350, padding 14 all sides, fill paper-glass + backdrop blur 8, radius card 24, shadow elevation/raise. Column, no gap (spacing from child paddings).
- meta row: space-between, centre aligned. Left: place (gap 7) = place text + verified glyph 17x17 (src/design/icons/verified.svg). Right: "Posted 20 Aug". Text text/meta (12.5/16 Light) ink opacity 45. Place text fixed w120 ellipsis.
- title block: padding top 9, bottom 14; "Live jazz at Bonobo" heading/card 19/25 ink.
- mw (media well): padding 7, radius media-outer 20, fill canvas, inset elevation/press. Inside: media h180 fill width, radius media-inner 14, object-cover, inset elevation/over-media. Photo is raster (placeholder, not exported).
- when block: padding-top 16. Row space-between: left gap 9 = calendar glyph 18 (calendar-when.svg) + "Tonight, 9:00 pm" Stack Sans Text Regular 15, line-height normal, ink 100 (RAW size 15, no token). Right "400 m" text/meta ink 45.
- actions block: padding-top 16. Row space-between: toggle/interest left, "23 interested" text/meta ink 45 right.
- Icons: verified.svg, calendar-when.svg, calendar-check-off.svg (toggle off), check-circle-interested.svg (toggle on).

### toggle/interest (3675:2623, nested in card/event; screenshot is part of card-event.png)
Description (verbatim): One control, used identically on the Gather card and on the event page, because it is the same act in both places. OFF is raised on canvas. It sits up off the surface, which is what says press me. ON is the orange tint pressed inward. Depth carries the change, not colour alone, so the state is legible without reading the word. The count never lives inside this control. It sits beside it on the card and in the bar above it on the page, because the number is information and the button is an action.
- Shared: pill radius 999, padding 13 top/bottom, left 18, right 20, gap 9, icon 18, label text/label 13/18 Regular, nowrap.
- OFF "Show interest": fill canvas, elevation/raise-s (backdrop blur 6). Label ink 100. Icon calendar-check-off.svg (ink stroke).
- ON "Interested": fill orange-soft, elevation/press-s inset. Label colour orange-deep. Icon check-circle-interested.svg (orange-deep stroke).

### card/update (3576:1359, card-update.png)
Description (verbatim): The Pulse feed card. A card is a doorway: it carries no controls, the whole card is one target. HEADING BLOCK — place and date sit inside the same frame as the title, so the two move together and the 9 above the title never separates them. Place leads left, date right, no middle dot, no elapsed time. SPACING — 14 all round on the card. 4 of horizontal inset on every text row so the words sit in from the photograph rather than aligning flush with it. 9 above the title, 14 below it, 16 above the footer. SOURCE LINE — events and notices only. The 6px dot is orange when the source is confirmed, ink at 25% when it is a neighbour or an unconfirmed report. The words stay ink at 45% either way, so a feed of ten notices shows ten small dots rather than ten orange lines. Civic never uses this line; it carries the rail instead, because civic has a state and a notice does not. DEPTH — the shadow pair, not a border. The photograph sits in a pressed well with a 7px lip. ROUTING — civic to the pin, event to the event, notice to story mode at that index. Media=no covers the text-only update and the deliberately empty one.
Variants: type = civic | event | notice; media = true | false (6 shown).
- Card: w350, padding 14, paper-glass fill + blur 8, radius card 24, elevation/raise. Same shell as card/event.
- heading block: padding top 9, bottom 14, horizontal 4. meta row space-between: place "Waterfield Rd, gate 2" (w126) left, date "17 Aug, 8:20 am" right; text/meta, opacity 45. Title heading/card 19/25 ink, full width ("Deep pothole by gate 2"). Order: meta row above title. Notice+media variant centres the meta wrapper (items-center).
- mw media well: padding 7, radius 20, fill canvas, inset elevation/press; media h180, radius 14, inset elevation/over-media. (Present when media=true; for event+media the heading block sits above the well, same as others.)
- foot block: padding top 16, horizontal 4.
  - civic: shows the rail (below). event and notice: shows source line (below, state verified: orange dot, "Verified source").
  - media=false: heading block, then foot only (no well). For event/notice no-media, foot holds the source line; for civic no-media the foot holds the rail.
- rail inside card (instance of rail, 3533:2969):
  - Rail description (verbatim): Neutral public ledger of dated events and two counts. Never a verdict on ward performance, never a countdown, never elapsed time. Node 3 copy is a function of ward state and count: ward not fixed reads "Verification / Not yet open"; ward fixed and count below threshold reads "To be verified / N verified"; count at or above threshold reads "Verified / N verified". The number is full ink, the word is ink45. Threshold ships as config, not a constant. Ward state arrives from an integration or manual moderation; there is no automatic transition. Connector takes the colour of the node it runs into. Ring and connector are 2px, the one exception to the 1.5px system stroke.
  - rail/node (3529:2864) description (verbatim): Rail node. done = the step is complete. live = the step currently waiting on a person. idle = not yet open. yours = a step you personally confirmed, distinct from the road confirming it. Swap the nested "icon" instance per position: send (reported), ward, checkcircle (verification). Ring and connector weight is 2px — the one exception to the 1.5px system stroke.
  - Layout: column gap 9. nodes row (centre, full width): node 28 circle, connector h2 w119 radius 1 fill surface/line, node, connector, node. Node icons 15x15.
  - node done: fill state/green, icon rail-node-send.svg (white stroke send glyph); rail-node-done-checkcircle.svg is the done checkcircle variant (white stroke).
  - node idle: fill surface/well, icon at 15, inset shadow RAW 1.5px 2px 4px rgba(23,20,15,0.16) (not a token; between press-s and nothing). Idle icons: rail-node-ward-idle.svg (ward, ink stroke at 25% opacity), ic-checkcircle.svg (verification).
  - labels row: three equal columns (flex 1), column gap 2. Left aligned "Posted / 17 Aug, 8:20 am"; centre "Ward / Not yet acknowledged"; right aligned "Verification / Not yet open". Heading line text/label 13/18 Regular ink 100; sub line text/meta 12.5/16 Light ink/60.
- Source line (3595:10571 etc., see source component): row gap 8, dot 6x6 + text/meta opacity 45.
- Icons: rail-node-send.svg, rail-node-done-checkcircle.svg, rail-node-ward-idle.svg, ic-checkcircle.svg, source-dot-orange.svg.

### card/map (3675:13987, card-map.png)
Description (verbatim): Where the thing actually is, on the page about it. Pressed into the surface rather than raised, because it is a window rather than a card you can act on — tapping it opens the full map at that point. The marker is the selected variant of the real map pin, so the shape a person sees here is the shape they will look for on the map. Orange for an open problem, ink for anything without a state. The landmark sits in the bottom corner in its own raised pill, because a road name alone does not find a pothole. "By gate 2" is the part a neighbour walks to.
Variants: type = civic | event | place.
- Box: w350 h180, radius media-outer 20, overflow clip, fill surface/line, inset elevation/press.
- Map drawing (abstract roads, all fill canvas at opacity 75%, not a photo): horizontal bars h26 at top 54 and h20 at top 124 (both w390, x -20); vertical bars w24 at x74 and w18 at x236 (h220, y -20).
- Pin: pin/map selected variant, 54x68, at left 148 top 56 (pin-tip-*.svg, pin-halo-*.svg, icons).
- landmark pill: left 12, top 136; padding 8 top/bottom, left 12, right 14; fill paper, backdrop blur 6, pill radius, elevation/raise-s. Text Stack Sans Text Light 12.5/16, colour ink/80 (#413D38). Texts: civic "By gate 2", event "Patwardhan Park end", place "Waroda Rd, near the chapel".
- Pin colour: civic = orange, event/place = ink.

### card/comments (3541:2995, card-comments.png)
Description (verbatim): Comments rebuilt as a card, used on civic and event detail. The composer takes a photo as well as text: the attach glyph sits quiet inside the field, send is the one filled control. Writing is gated: an attempt while signed out routes to AU1 Sign in to post. The count sits in the header, not on a chip.
- Card: w350, padding top 16, bottom 14, sides 14, gap 16; fill paper-glass (no backdrop blur in export), border 1.5 surface/line, radius card 24. Shadow RAW: -2px -2px 6px rgba(255,255,255,0.7), 2px 4px 14px rgba(23,20,15,0.08) (not elevation/raise; flag).
- head row: space-between. "Comments" heading/card 19/25; count "4" text/label 13/18 opacity 45.
- comment row: gap 12, top aligned. Avatar: 32 circle, fill well, elevation/raise-s (blur 6), initial text/label 13/18 opacity 60 (initial letter only). Body column gap 3: top row space-between, name text/label 13/18 Regular, date "18 Aug" text/micro 12/16 opacity 45; text text/body 13.5/21.6 Light opacity 80.
- Name shown in comment rows is the commenter name in the design file; per project privacy rules do not show other users' names in the feed/map (CLAUDE.md). Treat as prototype copy.
- composer input: row gap 10, padding left 14, right 8, top/bottom 8, pill radius, fill well, inset RAW shadow: inset 3px 4px 8px rgba(23,20,15,0.16), inset -3px -4px 8px rgba(255,255,255,0.85) (not a token; same recipe as field/well and shell pressed). Placeholder "Add what you saw" text/body 13.5/21.6 Light opacity 25. Attach glyph 19x19 (attach.svg). Send button: 36 circle, fill accent/orange, elevation/raise-s, blur 6, send glyph 16x16 (send.svg).
- Icons: attach.svg, send.svg.

## 2. Chips, source, buttons, fields

### chip/status (3531:2823, chip-status.png)
Description (verbatim): The state of a problem. Sent, Acknowledged, In progress, Marked done, then Done or Not done. Problems only. An event or a place has no state, so it never takes one of these. If you are reaching for this on an event or a notice you want the "source" component instead, which says where something came from rather than what is happening to it. The dot carries the colour, the words stay black. Green is a step that has happened, amber is a step somebody owes you, red is a fix that did not hold.
Variants: sent | acknowledged | in-progress | marked-fixed | State7 ("Verified Source", dark green dot).
- Chip: fill well, pill radius, padding top/bottom 6, left 10, right 12, gap 7. No shadow.
- Dot 6x6. Label Stack Sans Text Regular 12, line-height normal, ink 100 at opacity 80 (RAW: Regular 12 is not text/micro, which is Light). Labels: "Sent", "Acknowledged", "In progress", "Marked fixed", "Verified Source".
- Dots: sent = grey (status-dot-sent.svg), acknowledged and in-progress = amber (status-dot-amber.svg), marked-fixed = green (status-dot-green.svg), State7 = dark green (status-dot-green-deep.svg). Grey dot colour is a raw SVG fill, not a named token (check the SVG).
- "Done" / "Not done" (red) variants described in text but not present in this node set.

### chip/filter (3539:2975, chip-filter.png)
Description (verbatim): Unselected chips sit in a pressed well on canvas; selected fills orange and presses inward. Matches the prototype, where selection is the accent rather than ink. FOCUS. Focus is a ring, not a fill change. A chip that looks selected when it is only focused is worse than no focus at all.
Variants: state = default | selected | focus. Label "All".
- Pill, padding 10 top/bottom, 16 sides. Label text/label 13/18 Regular nowrap.
- default: fill canvas, inset elevation/press-s, label ink 100 opacity 80.
- selected: fill orange-deep (#B8380F, NOT #E4491C), inset elevation/press-orange, label cream (#FFF6EE).
- focus: fill canvas, ring focus/ring (0 0 0 3 #E4491C), no inset; label ink 100 opacity 80.

### source (3595:1312, source.png)
Description (verbatim): Where a piece of the brief came from. Events and notices carry this; problems never do, because a problem carries the rail instead. THE DOT IS THE ONLY COLOUR. Orange when the source is confirmed — the place posted it itself, or it came from a ward notice. Ink at 25% when it did not: a neighbour said so, we are watching for something that has not been issued, or somebody checked and found nothing. The words stay grey either way, so a brief with four notices in it shows four small dots rather than four orange lines. TWO SHAPES, SAME MEANING. Line sits at the foot of a feed card. Chip sits on the story sheet, where it is on its own and needs an edge to hold it. WATCHING AND CHECKED ARE NOT ERRORS. "Watching, no notice yet" and "Checked this morning" are the brief saying it looked and found nothing. Absence is content. Do not hide a card because its source state is one of these.
Variants: state = verified | ward | neighbour | watching | checked; style = line | chip.
- Texts: verified "Verified source"; ward "Ward notice, verified"; neighbour "Neighbour"; watching "Watching, no notice yet"; checked "Checked this morning".
- Dot 6x6: verified and ward = orange (source-dot-orange.svg, fill #E4491C); neighbour, watching, checked = ink 25% (source-dot-ink25.svg).
- line: row, gap 8, no fill (w300 in the set). Text text/meta 12.5/16 Light, ink opacity 45.
- chip: row, gap 7, fill well, pill, padding 6 top/bottom, left 10, right 12. Text Stack Sans Text Regular 12, line-height normal, ink opacity 80 (RAW size/weight, same as chip/status).

### button (3647:3721, button.png)
Description (verbatim): Every button in the product. 18 variants: three styles by two sizes by three states. STYLE. primary is the one thing you came to the screen to do and is the only orange fill — one per screen, never two. quiet is everything else and sits on canvas with no border, lifted by shadow alone. soft is the orange tint, used where a control repeats down a list and a solid fill would spend the whole accent budget. SIZE. default is 14 by 20 at 13.5 and hugs its label. big is 16 by 22 at 14 and is set to fill by the consumer — used for the one action at the bottom of a screen or the top of a feed. STATE. default is raised. pressed is the same fill pushed inward, and this is the point of the whole visual language: a control does not change colour when you press it, it changes depth. primary presses into a warm orange inset, quiet and soft into the neutral one. disabled drops to canvas with everything at 25% and takes the pressed shadow, so a switched-off button reads as sunk rather than faded. LABEL. A disabled button says why it is off rather than saying Next. NOT IN THIS SET. pill/verify keeps its own component because it is an outline that fills when it toggles, and shell/icon is the icon-only button. Both follow the same press-in rule. FOCUS. A State=focus variant carries the orange ring. Every button must be reachable by keyboard and switch, and the ring sits outside the shape so it survives the pressed inset.
CONFLICT: description says default label is 13.5; the node renders default at 13 (text/label) and big at 14. The code values (13 / 14) are what is drawn.
Variants: style primary | quiet | soft; size default | big; state default | pressed | disabled; plus one extra primary/default/focus.
- Shape: pill 999, gap 9, icon then label (sample label "Report an issue"; label is Regular, line-height 18).
- Padding: default 14 top/bottom x 20 sides; big 16 x 22. Icon 18 (default) or 19 (big). Big label 14 (RAW size, no token), default label 13 (text/label).
- primary: fill orange-deep (#B8380F) default; label cream. Icon button-check-circle-cream-*.svg. Default shadow elevation/raise-s (blur 6). Pressed: same fill, inset elevation/press-orange, no outer shadow. Focus: orange-deep fill + ring focus/ring.
- quiet: fill canvas, label ink 100, icon button-check-circle-ink-*.svg. default raise-s; pressed: inset elevation/press (fill canvas).
- soft: fill orange-soft, label orange-deep, icon button-check-circle-orange-deep-*.svg. default raise-s; pressed: inset elevation/press-s.
- disabled (all styles): fill canvas, inset elevation/press-s, label and icon ink at 25% (button-check-circle-disabled-*.svg, stroke ink).
- Icon files: button-check-circle-{cream,ink,orange-deep,disabled}-{default,big}.svg.

### shell/icon (3539:2970, shell-icon.png)
Description (verbatim): Circular icon container. Six sizes, all at or above the 44px touch target once padding is counted on the smaller ones. quiet has no fill and is the default inside cards. accent is the only place a shell takes orange and it is rationed to one per surface. Swap the nested "icon" instance.
Variants: size 28 | 34 | 40 | 44 | 48 | 56; state quiet | raised | pressed | accent | disabled (30 combos; sample glyph is plus).
- Circle (pill radius), square at the size. Icon size by shell: 28 -> 13, 34 -> 16, 40 -> 18, 44 -> 20, 48 -> 22, 56 -> 26.
- quiet: no fill, no shadow, ink icon.
- raised: fill paper, shadow RAW: -3px -3px 8px rgba(255,255,255,0.8), 3px 4px 12px rgba(23,20,15,0.10) (not elevation/raise-s or raise). Ink icon.
- accent: fill accent/orange, same RAW raised shadow, white icon.
- pressed: fill well, inset RAW: inset 3px 4px 8px rgba(23,20,15,0.16), inset -3px -4px 8px rgba(255,255,255,0.85). Ink icon.
- disabled: fill well, no shadow, icon ink at reduced opacity (as exported).
- Icon files: shell-plus-{quiet,raised,accent,disabled}-28.svg (13px glyph; other sizes have their own larger SVGs, not downloaded because the glyph is the same; scale or use ic-plus.svg).

### field/well (3531:2830, field-well.png)
Description (verbatim): Fields start empty and the placeholder is real copy, not a label. The primary button stays disabled until the required field passes one character. focus is the only place a field takes the accent.
Variants: state = empty | filled | focus.
- w310, padding 17 top/bottom, 18 sides, radius well 18. Text text/body 13.5/21.6 Light.
- empty: fill well, text ink at 25% opacity, placeholder "What is going on?".
- filled: fill well, text ink 100 ("Deep pothole by gate 2").
- focus: fill paper, border 1.5 accent/orange, text ink 100.
- All three have inset RAW shadow: inset 3px 4px 8px rgba(23,20,15,0.16), inset -3px -4px 8px rgba(255,255,255,0.85) (not elevation/press; flag).

## 3. Map and shell components

### pin/map (3611:2569, pin-map.png)
Description (verbatim): A disc on a stalk with a dot at the tip, so the point on the ground is exact and the glyph is not sitting on top of it. White ring and a soft shadow keep it readable on any map tile. COLOUR. Orange is an open problem. Green is one the road has confirmed fixed. Everything without a state — events, places, notices — is ink. This is a change from the earlier rule that said orange is the only colour on the map: a fixed problem earns green because green already means a step that has happened everywhere else in the file, and a map that cannot tell open from fixed is not much use. SELECTED grows the tap area and adds a soft halo in the pin's own colour. Nothing else changes.
Sub-node "Type=pin, State=you" (3611:2570), verbatim: Where you are standing. Blue on purpose: it is the one thing on the map that is not content, and it must never be mistaken for a pin. This is the only blue in the system.
Sub-node "Type=pin, State=cluster" (3611:2573), verbatim: More than one pin in the same spot. Paper, not orange, because a cluster has no state of its own — it might hold an open problem and a bakery. Tapping it zooms in rather than opening anything. This answers the clustering gap the notes have been carrying.
Variants: type = civic-open | civic-marked-fixed | event | place | notice | pin; state = default | selected | you | cluster.
- Default marker: frame 36x50. disc 32 circle at left 2, top 0; border 2 paper; marker drop shadow (0 4 5 rgba(23,20,15,0.28) as exported); icon 16 centred. stalk 2x10 at left 17, top 35 (fill = pin colour). tip dot 5x5 at left 15.5, top 45.
- Selected marker: frame 54x68. halo 54x54 at 0,0 (SVG, pin colour at 18% opacity); disc 32 at left 11, top 11; stalk 2x10 at left 26, top 53; tip 5x5 at left 24.5, top 63.
- Colours: civic-open orange (#E4491C) disc/stalk/halo/tip; civic-marked-fixed green (#2F9E6B); event, place, notice ink (#17140F).
- Icons (16px, white stroke): civic-open pin-icon-warning.svg; civic-marked-fixed pin-icon-check.svg; event pin-icon-calendar.svg; place pin-icon-compass.svg; notice pin-icon-notice-doc.svg.
- Tip/halo SVGs: pin-tip-{orange,green,ink}.svg, pin-halo-{orange,green,ink}.svg.
- you (44x44): pin-you.svg (blue dot with soft ring). RAW VALUE, not a token: blue #296BDB inside the SVG; the description says it is the only blue in the system.
- cluster (44 circle): fill paper, border 1.5 surface/line, marker drop shadow, centred count text Stack Sans Text Regular 15 ink (RAW size 15), e.g. "7".

### peek/map (3542:2966, peek-map.png)
Description (verbatim): Map peek. Chevron handle, thumbnail, place left and distance right, title clamped to two lines. No actions in the peek — tapping it opens the item. A notice story Map jump sets mapFocus, switches to the right layer, flies to the point and opens this peek after 260ms.
Annotation in node: "No buttons. Tapping it opens the thing."
- w390; fill paper-glass; padding top 10, bottom 18, sides 20; gap 12; radius top-left and top-right 34 (RAW 34; token radius/sheet is 28); shadow RAW: drop 0 10px 13px rgba(23,20,15,0.16) as exported.
- handle: h20, centred; chevron 20x20 (chevron-up-handle.svg, ink at 25% opacity; it is the chevD glyph flipped vertically).
- row: gap 14, centre aligned. thumb 64x64, radius well 18, object cover (raster photo, not exported). Text column gap 4: meta row space-between ("Waterfield Rd, gate 2" left, "240 m" right) text/meta 12.5/16 Light opacity 45; title heading/card 19/25 ink, full width, two-line clamp.

### sheet (3539:2980, sheet.png)
Description (verbatim): Bottom sheet. 34 radius on the top corners only, 34 bottom padding to clear the home bar. Append content below the title; the sheet hugs its contents vertically.
- w390; fill paper-glass; padding top 12, bottom 34, sides 20; gap 18; items centred; radius top corners 34 (RAW 34; token radius/sheet 28); shadow RAW drop 0 -6px 14px rgba(23,20,15,0.18).
- grabber: 38x4, radius 2, fill ink/25 (the map-screen sheet frame uses a 36x4 grabber at x177 y10).
- title "Your location": heading/h2 23/28, ink. Sub "Rebello Road, Bandra West": text/body 13.5/21.6 Light, ink opacity 60. Both full width.

### masthead (3726:4181, masthead.png)
Description (verbatim): Your structure with four changes. Not applied to any screen yet. 1. NO RED, NO GREEN. Being 5 km from Ranwar is a fact, not a fault. Red means one thing in this file, a fix the road says did not hold, and spending it on distance tells a person they have done something wrong. Green means a step in the ledger that has happened, and standing in your own area is not an achievement. Both are ink45 with a neutral dot, and the words carry it. 2. NO "SHOWING HOME". The tab bar already has Home lit in orange. The line is left saying the one thing the bar cannot: where you are relative to what you are reading. 3. THE AWAY STATE IS A LINK. "5 km away, switch to Khar West" is useful where "5km Away" is only a complaint. It costs no colour: the switch is full ink and underlined, the same treatment as Terms on the consent screen. 4. NO MIDDLE DOT, sentence case throughout. Open: with the area at h1, Pins and Gather carry two headings stacked, since they already have the sort heading below. On those two the area may need to drop back to h3. THE AREA NAME hugs its text up to 120 and truncates after that. Area names run from Gorai to Mount Mary Steps, and a long one must not push the ward, the Change link or Sign in off the row. The ward and the control keep their place; only the name gives way. THE AREA NAME hugs its text up to 120 and truncates after that. Names run from Gorai to Mount Mary Steps, and a long one must not push the ward, the Change link or Sign in off the row. Only the name gives way.
(The description text is copied as returned, it contains the HTML-escaped quote artefacts replaced by plain quotes.)
Variants: location = here | away.
- Row: w390, padding top 10, bottom 12, sides 18, gap 12, centre aligned. Left column gap 2; spacer flex; right: two 44 circles, gap 12.
- area row (gap 8): area name heading/h1 27/32, ink, max-w120, ellipsis, nowrap; ward "Bandra West" text/meta 12.5/16 Light, ink/60; chevron-down 18 (masthead-chevron-down-18.svg).
- you row (gap 4): dot 6 (source-dot-ink25.svg, neutral) + text text/meta Light 12.5/16 ink/60: here "You are here"; away "5 km away" then a link " switch to current location" (Regular 13-ish: Stack Sans Text Regular, line-height 16, size 12.5 as exported, colour #17140f hex = ink/100, underlined). Space before link is ink/45.
- map button: 44 circle, fill canvas, elevation/raise-s, icon masthead-map-19.svg (19).
- avatar button: 44 circle, fill orange-soft, elevation/raise-s, initial "D" heading/card 19/25 in orange-deep. (Initial only, not a name.)

### row/area (3710:3816, row-area.png)
Description (verbatim): Picking an area. Puck and pill, same shape as the inline bar. default is any area in the list. selected turns the puck orange and swaps the mark for a tick, so the list never reflows when you choose. here is the one the phone thinks you are standing in: green puck, crosshair, and "Where you are" on the right. THE RIGHT HAND VALUE IS DISTANCE, not the ward. In a list of four Bandra West areas the ward is the same on every row and tells you nothing; how far away it is tells you whether it is yours. Metres under a kilometre, one decimal above it. When location is off there is no distance to show, so the row falls back to the ward. FOCUS. Focus rings the whole row, both puck and pill, because the whole row is the target.
Node 3650:2601 description (ic/location) also returned with this node; see icon list.
Variants: state = default | selected | here | focus.
- Row: w350, gap 4, centre aligned.
- puck: pill circle, padding 13 + icon 18 = 44. default: fill well, inset elevation/press-s, icon row-area-location.svg (stroke #413D38 = ink/80). selected: fill accent/orange, inset elevation/press-orange, icon row-area-check-selected.svg (cream stroke). here: fill state/green-soft, inset elevation/press-s, icon row-area-target-here.svg (stroke #1F6B47 = green-deep).
- pill body: flex 1, gap 10, padding 13 top/bottom, 16 sides, radius pill, fill well, inset elevation/press-s. Name "Ranwar": text/label 13/18 Regular, colour ink/80 (#413D38). Right value: text/meta 12.5/16 Light, nowrap; ink/60 ("1.2 km"); here: state/green-deep "Where you are".
- focus: same as default with focus/ring around the whole row (0 0 0 3 #E4491C).

### snack (3539:2976, snack.png)
Description (verbatim): Transient confirmation. Ink, never orange — the accent is for actions, not for reporting that an action happened.
- w350; fill ink/100; radius well 18; padding 14 top/bottom, 18 sides; gap 10; centre aligned; shadow RAW drop 0 8px 11px rgba(23,20,15,0.22).
- icon 18 (snack-check.svg, white stroke); text text/label 13/18 Regular, colour paper (white), flex 1. Sample "Brief link copied".

### heading/sort (3617:3490, heading-sort.png)
Description (verbatim): The heading is the sort. Line one is the question, line two is the answer and is the only thing on the screen you can change, which is why it takes the accent. Replaces the row of scope chips: a chip row makes you read four options to find out what you are looking at, this makes the screen say it.
- w350, column. Line one "What is on": heading/h1 27/32 ink. Line two row gap 8: "nearby" heading/h1 27/32 colour accent/orange; chevron-down 22x22 (heading-sort-chevron-down-22.svg, ink stroke).

## 4. Screens: Map section (4537:6442)
Section "Map": "What happens when you touch it. Pins are content, the map is the surface." 7 frames, each 390x844 (screen radius 44). Status bar 48 high at top (bar/status: "7:58" + icons; skipped, per instructions).
| frame | node | screenshot |
|---|---|---|
| map · resting | 4465:5893 | screen-map-resting.png (design_context pulled) |
| map · pin tapped | 4465:5923 | screen-map-pin-tapped.png |
| map · peek open | 4465:5953 | screen-map-peek-open.png |
| map · cluster tapped | 4465:5983 | screen-map-cluster-tapped.png |
| map · moved | 4465:6013 | screen-map-moved.png |
| map · radius shown | 4506:5632 | screen-map-radius-shown.png |
| map · nothing here | 4465:6043 | not screenshotted (6-screenshot cap); metadata only |
State differences (from metadata):
- pin tapped: tapped marker becomes selected size 54x68 at (150,360); peek instance 390x124 at y720 (bottom); radius ctl and locate ctl shift up (radius ctl y602, locate y658).
- peek open: sheet frame at y397, 390x447, grabber 36x4 at x177 y10, card/update instance 350x391 at (20,26); controls shift up (radius ctl y227, locate y283).
- cluster tapped: cluster replaced by 7 spread-out markers; chip counts Pins 7, Events 1, Places 4, Notices 1; mapfilters width 356.
- moved: "radius ring" ellipse 380 at (-160,60) and "radius label" "1.5 km" at (139,373) 51x22; counts Pins 2, Events 0, Places 3, Notices 0; two markers.
- radius shown: "radius ring" ellipse 300 at (52,392); label "1.5 km" at (70,637) 51x22; 7 markers as resting.
- nothing here: only the "you" pin, counts 12/0/8/2 as in resting (the chip counts not updated; likely a design inconsistency).
- Radius ring and label specs (fill/stroke) were not pulled; the ring is an ellipse and the label a 51x22 pill with "1.5 km". Pull node 4506:9151 / 4506:9152 if needed.

### map · resting (4465:5893) detail
Description from annotation: "Resting. Nothing selected. The chip counts are the only readout of what is in range, so no bottom bar is needed."
- Frame: 390x844, radius screen 44, fill surface/line, map tile is a raster image (e6033.png, an OpenStreetMap-like London tile used as placeholder; not exported). Frame shadow elevation/raise-s (canvas artefact).
- maptop (x20, y52, row gap 12, h46): back button 46 circle fill canvas, backdrop blur 8, elevation/raise, icon 20 (map-back.svg); search field flex 1, h45, padding 13 top/bottom, 18 sides, gap 10, pill, fill canvas, inset elevation/press-s, search icon 19 (map-search.svg), placeholder "Places, pins, events" Stack Sans Text Light 14 line-height normal ink opacity 45 (RAW size 14).
- mapfilters (x20, y110, row gap 6, h36). Annotation: "Orange is only ever an open problem. Everything else is black."
  - Chip h36, padding left 12, right 9, gap 6, pill, drop shadow RAW 0 2px 4px rgba(23,20,15,0.14). Label Stack Sans Text Regular 12.5, line-height normal (RAW; text/label differs).
  - selected (Pins): fill #E4491C (RAW hex, equals accent/orange), label white. Count badge: min-w18, padding 5 x 2, pill, fill white, text orange Regular 11 (RAW size 11).
  - unselected (Events, Places, Notices): fill white, border 1 accent/orange-soft, label #17140F (RAW hex = ink/100). Count badge fill #F1ECE4 (RAW hex = well), text #17140F Regular 11.
  - These map chips are NOT chip/filter: different fill (orange not orange-deep), no pressed inset, extra count badge. Flagged.
- Markers (36x50): resting positions (x,y): (70,300) civic-open, (190,250) event, (280,380) place, (120,430) notice, (240,470) civic-marked-fixed, (320,300) place, (159,374) civic-open. you pin 44 at (180,520). cluster 44 at (90,250) with "7".
- radius ctl (ctl/radius, 4505:9135; description verbatim: "Radius toggle for the map. Off shows the ring hidden, on draws the 1.5 km circle around the current location."): 46 circle at right 20, bottom 146, fill #FBF8F4 (RAW hex = canvas), shadow RAW 0 2px 8px rgba(23,20,15,0.14), no blur. Mark 20x20: outer ring 17x17 at (1.5,1.5) is a raster PNG (35a1f.png, 34px, not exported) plus inner dot 6x6 at (7,7) (map-radius-ctl-dot.svg, fill ink).
- locate ctl (mapctl): 46 circle at right 20, bottom 90, fill canvas, blur 8, elevation/raise, icon 20 (map-locate-ctl.svg).

## 5. Fonts seen
- Stack Sans Headline Regular (400): 27/32 (-0.594), 23/28 (-0.46), 20/25 (-0.36), 19/25 (-0.342).
- Stack Sans Text Light (300): 13.5/21.6, 12.5/16, 12/16; also 14/normal (map search placeholder).
- Stack Sans Text Regular (400): 13/18, 15/normal, 14/18 (button big), 12/normal (chips), 12.5/normal (map chips), 11/normal (map count badge).
- No other families seen. No weight above 400. Tracking only on Headline.
- Two Light sizes appear at a size that differs from tokens in practice: tokens say text/meta 12.5 and text/micro 12; comment date "18 Aug" uses 12 (micro).

## 6. RAW values summary (not tokens)
- Shadows: card/comments outer; input inset (comments, field/well, shell pressed); shell raised/accent outer; rail idle node inset; sheet, peek, snack drop shadows; map chip drop shadow 0 2 4; radius ctl shadow 0 2 8.
- Radius: 34 top corners on sheet and peek (token radius/sheet is 28; descriptions say 34). Rail connector radius 1; grabber radius 2; rail node 28 circle uses pill.
- Colours as raw hex in map screen: #E4491C, #F1ECE4, #FBF8F4, #17140F, white (same values as tokens, but not bound). Blue #296BDB in pin-you.svg. Grey dot fill in status-dot-sent.svg. SVG icon strokes are literal black / #17140F / white, recolour by stroke.
- Text sizes without a text token: 15, 14, 12 Regular, 12.5 Regular, 11.
- Sizes: marker 36x50 / 54x68; pin disc 32; peek thumb 64.
- Photographs/raster not exported (use real data): card media, peek thumb, map tile, radius ctl ring PNG.

## 7. Icons
SVG files in src/design/icons/. Component-embedded glyph files (kebab names) are listed per component above. The set below is "05 Icons" (3667:3846): "42 glyphs, every one the final screens depend on. Stroked, recoloured by stroke, drawn on a 24 box." Downloaded as ic-<name>.svg (41 files; ic/statusicons 3181:1836, a 46x12 phone status-bar glyph, skipped).
Stroke weights in the downloaded files: 1.6 (most), 1.8 (6 occurrences), 1.75 (ic/location). Strokes are literal black; recolour by stroke (currentColor or CSS), do not edit the files.
| name | node | file |
|---|---|---|
| bell | 3179:1738 | ic-bell.svg |
| bubble | 3196:2681 | ic-bubble.svg |
| bulb | 3188:2634 | ic-bulb.svg |
| calendar_add | 3179:1798 | ic-calendar_add.svg |
| camera | 3179:1679 | ic-camera.svg |
| check | 3179:1664 | ic-check.svg |
| checkcircle | 3179:1668 | ic-checkcircle.svg |
| chevD | 3179:1713 | ic-chevD.svg |
| chevL | 3179:1710 | ic-chevL.svg |
| chevR | 3179:1707 | ic-chevR.svg |
| clock | 3179:1704 | ic-clock.svg |
| close | 3179:1716 | ic-close.svg |
| directions | 3179:1750 | ic-directions.svg |
| doc | 3179:1689 | ic-doc.svg |
| droplet | 3188:2637 | ic-droplet.svg |
| explore | 3179:1653 | ic-explore.svg |
| footpath | 3188:2648 | ic-footpath.svg |
| gather | 3179:1649 | ic-gather.svg |
| heart | 3196:2678 | ic-heart.svg |
| home | 3196:2675 | ic-home.svg |
| image | 3179:1684 | ic-image.svg |
| info | 3179:1773 | ic-info.svg |
| lock | 3179:1758 | ic-lock.svg |
| map | 3179:1661 | ic-map.svg |
| more | 3179:1766 | ic-more.svg |
| phone | 3179:1747 | ic-phone.svg |
| pin | 3179:1645 | ic-pin.svg |
| plus | 3179:1719 | ic-plus.svg |
| pulse | 3179:1641 | ic-pulse.svg |
| refresh | 3179:1781 | ic-refresh.svg |
| search | 3179:1657 | ic-search.svg |
| send | 3179:1769 | ic-send.svg |
| settings | 3179:1734 | ic-settings.svg |
| share | 3179:1744 | ic-share.svg |
| statusicons | 3181:1836 | skipped (phone status bar) |
| story | 3347:2976 | ic-story.svg |
| target | 3179:1789 | ic-target.svg |
| trash | 3188:2643 | ic-trash.svg |
| user | 3179:1754 | ic-user.svg |
| ward | 3179:1694 | ic-ward.svg |
| warn | 3179:1777 | ic-warn.svg |
| whatsapp | 3188:2652 | ic-whatsapp.svg |
| location | 3650:2601 | ic-location.svg |
ic/location description (verbatim): The location mark: a round head on a shaft, stroked at 1.75 on a 24 box like every other glyph in the set. Same silhouette as the map marker so a road in a list and a road on the map read as the same thing, but drawn as a line rather than a solid so it sits at the same weight as the icons beside it. Recolour by stroke, not fill. Not used for the Pins tab, which keeps ic/pin.
Note: the description says 1.75 on every glyph, but the files measure mostly 1.6. Use the file values.
The component-embedded SVGs (button-check-circle-*, pin-*, rail-*, shell-plus-*, status-dot-*, source-dot-*, masthead-*, row-area-*, snack-check, heading-sort-chevron-down-22, map-*, verified, calendar-when, calendar-check-off, check-circle-interested, attach, send, chevron-up-handle) carry the exact colour for their slot baked into the stroke.
Pre-existing files in src/design/icons that were NOT created by this extraction (leave as is): arrow-right, comment, heart, close, checkcircle, rail-send-done, source-dot (and possibly other earlier files). Several duplicate extractions here (for example checkcircle.svg and ic-checkcircle.svg).

## 8. Other assets in this folder
story-3552-3120.png predates this extraction; not covered here.
