import { describe, expect, it } from 'vitest'
import {
  bubbleBox,
  bubbleBoxBelow,
  clampBubble,
  coveredPins,
  markerBox,
  mergedContent,
  pinTagBox,
  pinTextBox,
  planLayers,
  popupCap,
  textCap,
  textWithTag,
  type LayerInput,
  clusterContent,
  eventValue,
  formatAgo,
  freshness,
  nearness,
  overlaps,
  ringState,
  selectTags,
  tagContent,
  tagScore,
  zoomCap,
  type Box,
  type TagCandidate,
} from '../../src/lib/tags'
import type { Pin, Support } from '../../src/types'
import type { Cluster } from '../../src/map/cluster'

const HOUR = 3600_000
const DAY = 24 * HOUR
const ORIGIN = { lat: 19.05, lng: 72.83 }
const vp = { center: ORIGIN }

/** ~80 m per 0.00072 deg lat => 1 walk minute. */
const degForMin = (min: number) => (min * 80) / 111_195

function cand(id: string, o: { min?: number; urgency?: number; x?: number; y?: number; w?: number } = {}): TagCandidate {
  const { min = 0, urgency = 1, x = 0, y = 0, w = 50 } = o
  return {
    id,
    lat: ORIGIN.lat + degForMin(min),
    lng: ORIGIN.lng,
    urgency,
    content: { kind: 'civic-timer', symbol: 'ring', value: '1d' },
    box: { x, y, w, h: 24 },
  }
}

function pin(p: Partial<Pin> & Pick<Pin, 'type'>): Pin {
  return {
    id: 'p',
    title: 't',
    lat: ORIGIN.lat,
    lng: ORIGIN.lng,
    createdAt: 0,
    createdBy: 'd',
    postedAs: 'neighbour',
    status: 'active',
    ...p,
  }
}
const sup = (pinId: string, createdAt: number, n = 0): Support => ({ id: `${pinId}_${n}`, pinId, deviceId: `d${n}`, createdAt })

describe('score maths', () => {
  it('nearness = 1 / (1 + walkMin / 10)', () => {
    expect(nearness(0)).toBe(1)
    expect(nearness(10)).toBeCloseTo(0.5)
    expect(nearness(30)).toBeCloseTo(0.25)
  })
  it('score = urgency x nearness x freshness (interest 1)', () => {
    const c = cand('a', { min: 10, urgency: 2 })
    expect(tagScore(c, ORIGIN, {})).toBeCloseTo(2 * 0.5, 2)
    expect(tagScore(c, ORIGIN, { a: 3 })).toBeCloseTo(2 * 0.5 * 0.5, 2)
  })
  it('freshness halves only from the 3rd unseen show', () => {
    expect(freshness(0)).toBe(1)
    expect(freshness(2)).toBe(1)
    expect(freshness(3)).toBe(0.5)
    expect(freshness(9)).toBe(0.5)
  })
})

describe('urgency from content', () => {
  const now = 100 * DAY
  it('civic past 7 days = 2, fresh civic = 1, civic with fresh supports = 1.5', () => {
    expect(tagContent(pin({ type: 'civic', createdAt: now - 8 * DAY }), [], now)!.urgency).toBe(2)
    expect(tagContent(pin({ type: 'civic', createdAt: now - 2 * DAY }), [], now)!.urgency).toBe(1)
    expect(tagContent(pin({ type: 'civic', createdAt: now - 2 * DAY }), [sup('p', now - HOUR)], now)!.urgency).toBe(1.5)
    expect(tagContent(pin({ type: 'civic', createdAt: now - 2 * DAY }), [sup('p', now - 4 * HOUR)], now)!.urgency).toBe(1)
  })
  it('event within 2 h = 2, later today = 1.5, after today = 1', () => {
    const noon = new Date(2026, 9, 7, 12, 0).getTime()
    expect(eventValue(noon + HOUR, noon).urgency).toBe(2)
    expect(eventValue(new Date(2026, 9, 7, 17, 0).getTime(), noon).urgency).toBe(1.5)
    expect(eventValue(new Date(2026, 9, 10, 17, 0).getTime(), noon).urgency).toBe(1)
  })
  it('area updates get no tag', () => {
    expect(tagContent(pin({ type: 'area', postedAs: 'ptp' }), [], 0)).toBeNull()
  })
})

describe('zoom caps', () => {
  const many = Array.from({ length: 10 }, (_, i) => cand(`c${i}`, { min: i, x: i * 100 }))
  const pick = (z: number) => selectTags(many, vp, z, new Set(), {})
  it('cap values', () => {
    expect(zoomCap(13)).toBe(Infinity)
    expect(zoomCap(14)).toBe(3)
    expect(zoomCap(16)).toBe(3)
    expect(zoomCap(17)).toBe(6)
  })
  it('14 to 16 shows the top 3, 17+ the top 6, best score first', () => {
    expect(pick(14)).toEqual(['c0', 'c1', 'c2'])
    expect(pick(16)).toHaveLength(3)
    expect(pick(17)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5'])
    expect(pick(19)).toHaveLength(6)
  })
})

describe('overlap rejection', () => {
  it('skips a lower tag that overlaps a higher one and tries the next', () => {
    const a = cand('a', { min: 0, x: 0 })
    const b = cand('b', { min: 1, x: 20 }) // overlaps a
    const c = cand('c', { min: 2, x: 200 })
    expect(selectTags([b, a, c], vp, 17, new Set(), {})).toEqual(['a', 'c'])
  })
  it('touching boxes do not overlap', () => {
    const a: Box = { x: 0, y: 0, w: 10, h: 10 }
    expect(overlaps(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
    expect(overlaps(a, { x: 9, y: 9, w: 10, h: 10 })).toBe(true)
  })
  it('skips a tag that covers another pin marker body, but not its own', () => {
    const own: Box = { x: -30, y: -30, w: 36, h: 50 }
    const a = { ...cand('a', { x: 0, y: 0 }), markerBox: own }
    const other: Box = { x: 10, y: 0, w: 36, h: 50 }
    expect(selectTags([a], vp, 17, new Set(), {}, { obstacles: [own] })).toEqual(['a'])
    expect(selectTags([a], vp, 17, new Set(), {}, { obstacles: [own, other] })).toEqual([])
  })
})

describe('stickiness (30%)', () => {
  // zoom 14: cap 3. Four tags, none overlapping. Showing: s1..s3 with equal score 1. Challenger beats one of them.
  const showing = ['s1', 's2', 's3']
  const base = [cand('s1', { min: 10, x: 0 }), cand('s2', { min: 10, x: 100 }), cand('s3', { min: 10, x: 200 })]
  it('a challenger 29% better does not displace', () => {
    const ch = cand('ch', { min: 10, x: 300, urgency: 1.29 })
    const out = selectTags([...base, ch], vp, 14, new Set(showing), {})
    expect(out).not.toContain('ch')
    expect(out).toHaveLength(3)
  })
  it('a challenger 30% better does', () => {
    const ch = cand('ch', { min: 10, x: 300, urgency: 1.3 })
    const out = selectTags([...base, ch], vp, 14, new Set(showing), {})
    expect(out).toContain('ch')
    expect(out).toHaveLength(3)
  })
  it('without history the better tag wins at once', () => {
    const ch = cand('ch', { min: 10, x: 300, urgency: 1.1 })
    expect(selectTags([...base, ch], vp, 14, new Set(), {})[0]).toBe('ch')
  })
})

describe('selected pin', () => {
  it('is always tagged, even far away, over the cap, and over an overlap', () => {
    const far = cand('far', { min: 500, x: 0 })
    const near = Array.from({ length: 6 }, (_, i) => cand(`n${i}`, { min: i, x: 100 + i * 100 }))
    const clash = cand('clash', { min: 0, x: 10 })
    const out = selectTags([...near, far, clash], vp, 14, new Set(), {}, { selectedId: 'far' })
    expect(out[0]).toBe('far')
    expect(out).not.toContain('clash')
    expect(out).toHaveLength(4) // selected + top 3
  })
})

describe('freshness halving after 3 unseen shows', () => {
  it('a tag shown 3 times without a tap loses to an otherwise equal one', () => {
    const a = cand('a', { x: 0 })
    const b = cand('b', { x: 0 }) // same box: only one fits
    expect(selectTags([a, b], vp, 17, new Set(), { a: 3 })).toEqual(['b'])
    expect(selectTags([a, b], vp, 17, new Set(), { a: 2 })).toEqual(['a'])
    // tap resets to 0
    expect(selectTags([a, b], vp, 17, new Set(), { a: 0 })).toEqual(['a'])
  })
})

describe('content formats', () => {
  const now = new Date(2026, 9, 7, 12, 0).getTime()
  it('civic "12d" with ring fill and past state', () => {
    const c = tagContent(pin({ type: 'civic', createdAt: now - 12 * DAY }), [], now)!.content
    expect(c.value).toBe('12d')
    expect(c.symbol).toBe('ring')
    expect(c.past).toBe(true)
    expect(c.ringFill).toBe(1)
  })
  it('ring fills over 7 days, red only past it', () => {
    expect(ringState(pin({ type: 'civic', createdAt: now - 3.5 * DAY }), now)).toEqual({ fill: 0.5, past: false })
    expect(ringState(pin({ type: 'civic', createdAt: now - 7 * DAY }), now)).toEqual({ fill: 1, past: false })
    expect(ringState(pin({ type: 'civic', createdAt: now - 7 * DAY - 1 }), now)).toEqual({ fill: 1, past: true })
    expect(ringState(pin({ type: 'civic', createdAt: now }), now)).toEqual({ fill: 0, past: false })
  })
  it('fresh supports no longer change a civic tag ("+N" means merged now); they still raise its rank', () => {
    const s = [0, 1, 2, 3, 4].map((i) => sup('p', now - HOUR, i))
    const t = tagContent(pin({ type: 'civic', createdAt: now - 3 * DAY }), s, now)!
    expect(t.content).toMatchObject({ kind: 'civic-timer', value: '3d' })
    expect(t.urgency).toBe(1.5)
    expect(mergedContent(2)).toEqual({ kind: 'merged', symbol: 'none', value: '+2' })
  })
  it('event "in 40m", "5 PM", "Sat"', () => {
    expect(eventValue(now + 40 * 60_000, now).value).toBe('in 40m')
    expect(eventValue(now + 90 * 60_000, now).value).toBe('in 1h 30m')
    expect(eventValue(new Date(2026, 9, 7, 17, 0).getTime(), now).value).toBe('5 PM')
    expect(eventValue(new Date(2026, 9, 7, 17, 30).getTime(), now).value).toBe('5:30 PM')
    expect(eventValue(new Date(2026, 9, 10, 17, 0).getTime(), now).value).toBe('Sat') // 10 Oct 2026 is a Saturday
  })
  it('place-posted event shows the avatar symbol', () => {
    const c = tagContent(pin({ type: 'event', postedAs: 'place', startsAt: now + 5 * HOUR }), [], now)!.content
    expect(c.symbol).toBe('avatar')
    expect(tagContent(pin({ type: 'event', startsAt: now + 5 * HOUR }), [], now)!.content.symbol).toBe('clock')
  })
  it('ask: offers count, else time since asking', () => {
    const asked = pin({ type: 'ask', createdAt: now - 3 * HOUR - 5 * 60_000 })
    expect(tagContent(asked, [], now)!.content).toMatchObject({ symbol: 'hand', value: '3h' })
    expect(tagContent(asked, [sup('p', now - 2 * DAY, 1), sup('p', now - 2 * DAY, 2)], now)!.content.value).toBe('2')
    expect(formatAgo(12 * 60_000)).toBe('12m')
    expect(formatAgo(2 * DAY)).toBe('2d')
  })
  it('cluster "8 events"', () => {
    const pins = [...Array.from({ length: 8 }, (_, i) => pin({ type: 'event', id: `e${i}` })), pin({ type: 'civic', id: 'c' })]
    const cl: Cluster = { id: 'x', lat: 0, lng: 0, count: 9, pins }
    expect(clusterContent(cl).value).toBe('8 events')
  })
})

describe('layers: bubbles, tags, pin text (planLayers)', () => {
  // Five pins 200 px apart on one row; bubbles/tags/text get boxes that never touch between pins.
  const xs = [0, 200, 400, 600, 800]
  const ids = ['a', 'b', 'c', 'd', 'e']
  const at = (i: number) => ({ x: xs[i], y: 300 })
  const withBox = (id: string, i: number, box: Box, min = i): TagCandidate => ({ ...cand(id, { min }), box, markerBox: markerBox(at(i), false) })
  const tagC = (i: number) => withBox(ids[i], i, pinTagBox(at(i), false, '12d'))
  const bubble = { place: '@ Hill Road', quote: '\u201cStill dark last night.\u201d', foot: '500 m away  +2' }
  const bubC = (i: number) => withBox(ids[i], i, bubbleBox(at(i), bubble))
  const labC = (i: number) => withBox(ids[i], i, pinTextBox(at(i), false, 'Streetlight out'))
  const empty = { tags: new Set<string>(), bubbles: new Set<string>(), labels: new Set<string>() }
  const input = (o: Partial<LayerInput>): LayerInput => ({
    tags: ids.map((_, i) => tagC(i)),
    bubbles: ids.map((_, i) => bubC(i)),
    labels: ids.map((_, i) => labC(i)),
    zoom: 15,
    viewport: vp,
    selectedId: null,
    obstacles: ids.map((_, i) => markerBox(at(i), false)),
    previous: empty,
    seenCounts: {},
    ...o,
  })

  it('bubble geometry clears its own marker and sits above it, at most 168 wide', () => {
    const b = bubbleBox({ x: 100, y: 300 }, bubble)
    expect(overlaps(b, markerBox({ x: 100, y: 300 }, false))).toBe(false)
    expect(b.y + b.h).toBe(300 - 14) // tail tip 2 px above the 24 disc
    expect(b.w).toBeLessThanOrEqual(168)
    const long = bubbleBox({ x: 100, y: 300 }, { ...bubble, quote: 'x'.repeat(200) })
    expect(long.w).toBeLessThanOrEqual(168)
    // "@ Place" adds one line; no place, a shorter bubble.
    expect(bubbleBox({ x: 100, y: 300 }, { ...bubble, place: null }).h).toBe(b.h - 18)
  })

  it('markers are round discs anchored at the centre: 24 default, 44 (halo) selected', () => {
    expect(markerBox({ x: 0, y: 0 }, false)).toEqual({ x: -12, y: -12, w: 24, h: 24 })
    expect(markerBox({ x: 0, y: 0 }, true)).toEqual({ x: -22, y: -22, w: 44, h: 44 })
    // text and tags are centred on the disc
    expect(pinTagBox({ x: 0, y: 0 }, false, '12d').y).toBe(-12)
    expect(pinTextBox({ x: 0, y: 0 }, false, 'x').y).toBe(-9)
    // the slot right of the pin starts 4 px clear of the disc (24 disc: edge at 12; selected 32 disc: edge at 16)
    expect(pinTagBox({ x: 0, y: 0 }, false, '12d').x).toBe(16)
    expect(pinTextBox({ x: 0, y: 0 }, true, 'x').x).toBe(20)
  })

  it('popups: more as you zoom in (none at cluster zooms), picked by score (nearest first here)', () => {
    expect([13, 14, 15, 16, 17, 19].map(popupCap)).toEqual([0, 2, 3, 4, 5, 5])
    expect(planLayers(input({ zoom: 14 })).bubbles).toEqual(['a', 'b'])
    expect(planLayers(input({})).bubbles).toEqual(['a', 'b', 'c'])
    expect(planLayers(input({ zoom: 17 })).bubbles).toEqual(ids)
  })

  it('zoomed in on one pin, it gets its popup', () => {
    const one = { bubbles: [bubC(2)], tags: [tagC(2)], labels: [labC(2)], obstacles: [markerBox(at(2), false)] }
    expect(planLayers(input({ ...one, zoom: 18 })).bubbles).toEqual(['c'])
  })

  it('a popup that shows the title replaces the pin text; a comment popup keeps it', () => {
    const plan = planLayers(input({ titled: new Set(['a']) }))
    expect(plan.bubbles).toContain('a')
    expect(plan.labels).not.toContain('a')
    expect(plan.labels).toContain('b') // b's popup is a comment: its title stays beside the pin
  })

  it('popup score uses the pin interest (Pulse ranking)', () => {
    const bubbles = ids.map((_, i) => ({ ...bubC(i), urgency: i === 4 ? 2 : 1 }))
    expect(planLayers(input({ bubbles })).bubbles[0]).toBe('e')
  })

  it('no bubbles at cluster zooms', () => expect(planLayers(input({ zoom: 13 })).bubbles).toEqual([]))

  it('a pin shows a tag or a bubble, never both', () => {
    const plan = planLayers(input({}))
    expect(plan.bubbles.length).toBe(3)
    for (const id of plan.bubbles) expect(plan.tags).not.toContain(id)
    expect(plan.tags).toEqual(['d', 'e'])
  })

  it('the selected pin keeps its tag and never gets a bubble', () => {
    const plan = planLayers(input({ selectedId: 'a' }))
    expect(plan.bubbles).not.toContain('a')
    expect(plan.tags[0]).toBe('a')
    expect(plan.bubbles).toEqual(['b', 'c', 'd'])
  })

  it('overlapping bubbles: the higher score wins, the next candidate is tried', () => {
    // b's bubble is moved onto a's: b is skipped and d takes the third slot.
    const bubbles = ids.map((_, i) => bubC(i))
    bubbles[1] = { ...bubbles[1], box: { ...bubbles[0].box, x: bubbles[0].box.x + 10 } }
    expect(planLayers(input({ bubbles })).bubbles).toEqual(['a', 'c', 'd'])
  })

  it('a tag that would cover a chosen bubble is skipped', () => {
    const tags = ids.map((_, i) => tagC(i))
    const aBubble = bubC(0).box
    tags[4] = { ...tags[4], box: { x: aBubble.x, y: aBubble.y, w: 50, h: 24 } }
    expect(planLayers(input({ tags })).tags).toEqual(['d'])
  })

  it('pin text by relevancy: more as you zoom in, the selected pin always', () => {
    expect([13, 14, 15, 16, 17, 19].map(textCap)).toEqual([0, 3, 5, 8, Infinity, Infinity])
    expect(planLayers(input({ zoom: 13 })).labels).toEqual([])
    expect(planLayers(input({ zoom: 13, selectedId: 'e' })).labels).toEqual(['e'])
    expect(planLayers(input({ zoom: 14 })).labels).toEqual(['a', 'b', 'c']) // nearest 3
    expect(planLayers(input({ zoom: 14, selectedId: 'e' })).labels).toEqual(['e', 'a', 'b', 'c'])
    expect(planLayers(input({ zoom: 17 })).labels.sort()).toEqual(ids)
  })

  it('a tagged pin shows its text first, then the tag after it, checked as one box', () => {
    const plan = planLayers(input({}))
    expect(plan.tags).toEqual(['d', 'e'])
    expect(plan.labels).toContain('d')
    const joined = textWithTag(labC(3).box, tagC(3).box)
    expect(joined.x).toBe(labC(3).box.x)
    expect(joined.w).toBe(labC(3).box.w + 4 + tagC(3).box.w)
  })

  it("text that would push its tag onto another pin's tag is dropped; both tags stay", () => {
    // e's tag sits just after d's text: d's text + tag would run into it.
    const tags = ids.map((_, i) => tagC(i))
    const dText = labC(3).box
    tags[4] = { ...tags[4], box: { ...tags[4].box, x: dText.x + dText.w + 10, y: dText.y } }
    const plan = planLayers(input({ tags }))
    expect(plan.tags).toEqual(['d', 'e'])
    expect(plan.labels).not.toContain('d')
    expect(plan.labels).toContain('e')
  })

  it('text near the right edge is shortened to fit with its tag; with under 48 px of room it is left out', () => {
    const e = labC(4).box
    const tagW = tagC(4).box.w
    const roomy = planLayers(input({ screenW: e.x + 60 + 4 + tagW })) // 60 px left for e's text
    expect(roomy.labels).toContain('e')
    expect(roomy.textW.e).toBe(60)
    const tight = planLayers(input({ screenW: e.x + 40 + 4 + tagW })) // 40 px: too short to read
    expect(tight.tags).toContain('e')
    expect(tight.labels).not.toContain('e')
    // the selected pin is shortened too (so its tag stays on screen), but never dropped
    const sel = planLayers(input({ screenW: e.x + 60 + 4 + tagW, selectedId: 'e' }))
    expect(sel.textW.e).toBe(60)
    expect(planLayers(input({ screenW: e.x + 20, selectedId: 'e' })).labels).toContain('e')
  })

  it('pin text never collides with each other, tags, bubbles or other markers', () => {
    const labels = ids.map((_, i) => labC(i))
    labels[1] = { ...labels[1], box: { ...labels[0].box, x: labels[0].box.x + 5 } } // onto a's label
    labels[2] = { ...labels[2], box: { ...bubC(0).box } } // onto a's bubble
    labels[3] = { ...labels[3], box: { ...markerBox(at(4), false) } } // onto e's marker body
    const plan = planLayers(input({ labels }))
    expect(plan.labels.sort()).toEqual(['a', 'e'])
  })

  it("a pin stacked under a bubbled pin cannot put its tag in that pin's tag slot", () => {
    // z is a sixth pin on the same spot as a (stacked); its tag would sit exactly where a's tag would.
    const z = { ...tagC(0), id: 'z', markerBox: { ...markerBox(at(0), false), x: markerBox(at(0), false).x + 1 } }
    const plan = planLayers(input({ tags: [...ids.map((_, i) => tagC(i)), z] }))
    expect(plan.bubbles).toContain('a')
    expect(plan.tags).not.toContain('z')
  })

  it('pin text avoids Google place names (labelObstacles), other layers do not care', () => {
    const placeName = { ...labC(1).box }
    const plan = planLayers(input({ labelObstacles: [placeName] }))
    expect(plan.labels).not.toContain('b')
    expect(plan.bubbles).toEqual(['a', 'b', 'c'])
  })

  it('a bubble whose spot above is taken opens below its pin instead; the plan says so', () => {
    // b's bubble above lands on a's: b tries below and gets in, so 4 bubbles fit where 3 spots were blocked.
    const bubbles = ids.map((_, i) => bubC(i))
    bubbles[1] = { ...bubbles[1], box: { ...bubbles[0].box, x: bubbles[0].box.x + 10 }, alts: [bubbleBoxBelow(at(1), bubble)] }
    const plan = planLayers(input({ bubbles }))
    expect(plan.bubbles).toEqual(['a', 'b', 'c'])
    expect(plan.below).toEqual(['b'])
    const low = bubbleBoxBelow(at(1), bubble)
    expect(low.y).toBeGreaterThan(at(1).y)
    expect(overlaps(low, markerBox(at(1), false))).toBe(false)
  })

  it('a bubble near the screen edge slides inside it; the tail stays within the bubble', () => {
    const b = bubbleBox({ x: 340, y: 400 }, bubble) // 180 wide around x 340 on a 390 screen: 48 px over
    const { box, dx } = clampBubble(b, 390)
    expect(box.x + box.w).toBe(382)
    expect(dx).toBeLessThan(0)
    expect(Math.abs(dx)).toBeLessThanOrEqual(b.w / 2 - 16)
    expect(clampBubble(bubbleBox({ x: 200, y: 400 }, bubble), 390).dx).toBe(0)
  })

  it('pins on the same spot: only the top one (selected, else last drawn) may carry words', () => {
    const pins = [
      { id: 'civic', at: { x: 100, y: 100 } },
      { id: 'ask', at: { x: 102, y: 101 } },
      { id: 'far', at: { x: 300, y: 100 } },
    ]
    expect([...coveredPins(pins, null)]).toEqual(['civic'])
    expect([...coveredPins(pins, 'civic')]).toEqual(['ask'])
  })

  it('stickiness applies per layer', () => {
    // e (3 min walk) scores below c (2 min) on its own, but within 30%: once showing, it keeps its slot.
    const bubbles = ids.map((_, i) => withBox(ids[i], i, bubC(i).box, i === 4 ? 3 : i))
    expect(planLayers(input({ bubbles, previous: empty })).bubbles).toEqual(['a', 'b', 'c'])
    const prev = { ...empty, bubbles: new Set(['a', 'b', 'e']) }
    expect(planLayers(input({ bubbles, previous: prev })).bubbles).toEqual(['a', 'b', 'e'])
  })
})
