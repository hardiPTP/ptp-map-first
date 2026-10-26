import { describe, expect, it } from 'vitest'
import {
  awayText,
  BUBBLE_QUOTE_MAX,
  cleanCommentText,
  liveCommentsFor,
  liveCountByPin,
  moreText,
  newestLiveByPin,
  QUOTE_MAX,
  quoteText,
} from '../../src/lib/comments'
import type { Comment } from '../../src/types'

const c = (o: Partial<Comment> & Pick<Comment, 'id' | 'pinId' | 'createdAt'>): Comment => ({
  text: 'Seen it this morning', deviceId: 'device-secret-id', status: 'live', ...o,
})

describe('comment status', () => {
  it('newest LIVE comment per pin; under_review never counts', () => {
    const list = [
      c({ id: 'a', pinId: 'p1', createdAt: 1 }),
      c({ id: 'b', pinId: 'p1', createdAt: 3, status: 'under_review' }),
      c({ id: 'c', pinId: 'p1', createdAt: 2 }),
      c({ id: 'd', pinId: 'p2', createdAt: 5, status: 'under_review' }),
    ]
    const m = newestLiveByPin(list)
    expect(m.get('p1')?.id).toBe('c')
    expect(m.has('p2')).toBe(false)
    expect(liveCommentsFor('p1', list).map((x) => x.id)).toEqual(['c', 'a'])
  })
})

describe('bubble text', () => {
  it('short text is kept whole', () => expect(quoteText('Still dark last night.')).toBe('Still dark last night.'))
  it('long text is cut to at most 60 characters, on a word, with an ellipsis', () => {
    const q = quoteText('Someone put a crate over it this morning. Still not safe for bikes or for anyone walking.')
    expect(q.length).toBeLessThanOrEqual(QUOTE_MAX)
    expect(q.endsWith('…')).toBe(true)
    expect(q).toBe('Someone put a crate over it this morning. Still not safe…')
  })
  it('a single long word is still capped', () => expect(quoteText('x'.repeat(200)).length).toBe(QUOTE_MAX))
  it('the map bubble cuts sooner (2 lines)', () => {
    const q = quoteText('Happy to help on Sunday morning, no charge. My father needed two tries too.', BUBBLE_QUOTE_MAX)
    expect(q.length).toBeLessThanOrEqual(BUBBLE_QUOTE_MAX)
    expect(q).toBe('Happy to help on Sunday morning, no charge…')
  })
  it('"500 m away": rounded to 50 m, at least 50 m, km from 1 km', () => {
    const from = { lat: 19.0596, lng: 72.8295 }
    const north = (m: number) => ({ lat: from.lat + m / 111_195, lng: from.lng })
    expect(awayText(from, north(510))).toBe('500 m away')
    expect(awayText(from, north(5))).toBe('50 m away')
    expect(awayText(from, north(980))).toBe('1.0 km away')
    expect(awayText(from, north(1240))).toBe('1.2 km away')
  })
  it('"+2" counts the other LIVE comments only', () => {
    const list = [
      c({ id: 'a', pinId: 'p1', createdAt: 1 }),
      c({ id: 'b', pinId: 'p1', createdAt: 2 }),
      c({ id: 'c', pinId: 'p1', createdAt: 3 }),
      c({ id: 'd', pinId: 'p1', createdAt: 4, status: 'under_review' }),
      c({ id: 'e', pinId: 'p2', createdAt: 4 }),
    ]
    const n = liveCountByPin(list)
    expect(moreText(n.get('p1') ?? 0)).toBe('+2')
    expect(moreText(n.get('p2') ?? 0)).toBeNull()
  })
  it('cleanCommentText trims, and rejects empty or over 280', () => {
    expect(cleanCommentText('  a  b ')).toBe('a b')
    expect(() => cleanCommentText(' ')).toThrow()
    expect(() => cleanCommentText('y'.repeat(281))).toThrow()
    expect(cleanCommentText('y'.repeat(280))).toHaveLength(280)
  })
})
