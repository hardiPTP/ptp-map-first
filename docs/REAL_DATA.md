# Real data in the prototype (2026-10-07/08)

What the map shows now, and where each piece comes from. Nothing below is invented except the items marked demo.

## Places (live from Google)
- Google Places (New) Nearby Search through the Maps JavaScript API (`src/data/places.ts`), within 800 m (the 10 minute walk ring) of the area centre or the user.
- Three searches per centre: food (restaurant, cafe, bakery), daily needs (pharmacy, supermarket, grocery store), outdoors and community (park, library, church, temple, mosque, gym, art gallery). Up to 20 each, ranked by popularity, closed businesses dropped.
- Cached on the device for 12 hours, so a normal day costs a handful of requests against the Maps Demo Key cap.
- "Open now" is worked out from Google's opening hours in IST (Place.isOpen() is beta-only).

## Events (real listings, curated by Push The Pin)
Fixed dates and times from public listings, venues resolved through Places Text Search (cached in scripts/.cache):

| Date | Event | Venue | Source |
| --- | --- | --- | --- |
| Thu 8 Oct, 8 pm | Comedy open mic | Chimbai Village Theatre | allevents.in |
| Fri 9 Oct, 8 pm | Stand-up Virgin, Kubbra Sait and Devanshi Shah | Khar Comedy Club | allevents.in |
| Fri 9 Oct, 9 pm | Pink Moss live | Bora Bora, Waterfield Rd | allevents.in |
| Sat 10 to Sun 11 Oct, noon | SALT food and culture weekend | Corona Garden | Homegrown, Time Out |
| Sun 11 Oct, 6 am | Hill sprints | Bandra Fort | allevents.in |
| Sun 11 Oct, 8 pm | Duos, Prashasti Singh and Atul Khatri | Khar Comedy Club | allevents.in |
| Tue 13 Oct, 7:30 pm | Free philosophy intro evening | New Acropolis, 15th Rd | allevents.in |
| Sat 17 Oct, 3 pm | Bazaar and Beyond flea market | Corona Garden | allevents.in |
| Sat 17 Oct, 7 pm | Allow Me!, Rahul Dua | Bal Gandharva Rang Mandir | allevents.in |
| Sun 18 Oct, 4 pm | Out of Syllabus, Sapan Verma | Khar Comedy Club | allevents.in |

Each pin carries `sourceUrl` and `sourceLabel`; the card's source line links to it.

## Civic (real news reports, curated by Push The Pin)
- Hill Road footpath encroachment, ward inspection and notices promised (Construction World, 27 Aug 2026).
- Patwardhan Park Rs 5.1 crore revamp awaiting approval (Free Press Journal, 31 Aug 2026).
- Plan to convert the Reclamation football ground (Free Press Journal, 28 Jun 2026).

## Notices
- Navratri 11 to 19 Oct, Dussehra 20 Oct (festival dates). No current BMC water cut, Adani power shutdown or traffic advisory for Bandra West was found for this window, so none is shown. The earlier invented water and power notices were removed: a fake official-looking notice is the one thing this product cannot afford.

## Demo content (marked `seed-`)
- 2 neighbour civic posts and 3 neighbour asks, plausible but invented, to show the neighbour layer. Support counts on all items are demo interactions.

## Gaps found by the research
- Search found no current Bandra West listings for pottery, sewing, sketching, senior-citizen meetups, Joggers Park yoga or church community events. Those mostly live on Instagram and WhatsApp, which is the case for PTP: neighbours and venues posting them directly.
