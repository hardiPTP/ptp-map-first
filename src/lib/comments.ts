// Comments (DECISIONS.md 2026-10-22). Pure: no Google, no DOM, no clock (callers pass `now`).
import { COMMENT_MAX, type Comment, type LatLng } from '../types'
import { distanceM } from './geo'

/** Bubble quote length, in characters, including the closing ellipsis when cut (PRD: 60 max). */
export const QUOTE_MAX = 60
/** The map bubble's quote: 2 lines at 168 wide hold about 44 characters (DECISIONS.md 2026-10-22). */
export const BUBBLE_QUOTE_MAX = 44

/** Trimmed text, or an error for empty or over-long input. Both repos call this before writing. */
export function cleanCommentText(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) throw new Error('comment is empty')
  if (t.length > COMMENT_MAX) throw new Error(`comment is over ${COMMENT_MAX} characters`)
  return t
}

/** Newest LIVE comment per pin. under_review comments never count, even if a repo passed them in. */
export function newestLiveByPin(comments: Comment[]): Map<string, Comment> {
  const out = new Map<string, Comment>()
  for (const c of comments) {
    if (c.status !== 'live') continue
    const prev = out.get(c.pinId)
    if (!prev || c.createdAt > prev.createdAt) out.set(c.pinId, c)
  }
  return out
}

/** Live comments for one pin, newest first. */
export function liveCommentsFor(pinId: string, comments: Comment[]): Comment[] {
  return comments.filter((c) => c.pinId === pinId && c.status === 'live').sort((a, b) => b.createdAt - a.createdAt)
}

/** A quote of at most `max` characters (default 60), cut on a word where possible, then an ellipsis. No quote marks. */
export function quoteText(text: string, max = QUOTE_MAX): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  // The cut already ends a word (the next character is a space): keep that word whole.
  const space = t[max - 1] === ' ' ? cut.length : cut.lastIndexOf(' ')
  return `${(space >= max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`
}

/** Live comments per pin (the bubble's "+2" is this minus the one it quotes). */
export function liveCountByPin(comments: Comment[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of comments) if (c.status === 'live') out.set(c.pinId, (out.get(c.pinId) ?? 0) + 1)
  return out
}

/** "+2" when a pin has more live comments than the one quoted, else null. */
export function moreText(liveCount: number): string | null {
  return liveCount > 1 ? `+${liveCount - 1}` : null
}

/** "500 m away" (rounded to 50 m, at least 50 m), "1.2 km away". From the user's location, else the area centre. */
export function awayText(from: LatLng, to: LatLng): string {
  const m = distanceM(from, to)
  const r = Math.max(50, Math.round(m / 50) * 50)
  if (r < 1000) return `${r} m away`
  return `${(m / 1000).toFixed(1)} km away`
}
