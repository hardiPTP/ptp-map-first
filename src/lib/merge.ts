// Merging similar pins on the map (DECISIONS.md 2026-10-23). Several neighbours posting the same kind of thing at the
// same spot show as ONE marker with a "+N" tag (N = how many others posted it). Pure: no Google, no DOM, no clock.
// The feed still lists every post; only the map merges.
import type { Pin } from '../types'
import { distanceM } from './geo'

/** Same spot: within this many metres (a building frontage; GPS on a phone is often 10-20 m off). */
export const MERGE_RADIUS_M = 30

/**
 * Two pins merge only when they are the same kind of thing at the same spot: same type (an issue never merges with
 * an ask), within MERGE_RADIUS_M; events only when they also start at the same time (two events at one venue are
 * different events); offers and area updates never merge.
 */
export function canMerge(a: Pin, b: Pin): boolean {
  if (a.id === b.id || a.type !== b.type) return false
  if (a.type === 'offer' || a.type === 'area') return false
  if (a.type === 'event' && a.startsAt !== b.startsAt) return false
  return distanceM(a, b) <= MERGE_RADIUS_M
}

export interface Merged {
  /** The pins the map draws: one lead per group, plus every pin that merged with nothing. */
  pins: Pin[]
  /** Lead id -> the ids merged into it. */
  others: Map<string, string[]>
}

/**
 * Greedy, in rank order: the most important pin of a group leads it (rank: higher first). `keep` pins (the selected
 * pin) always lead, so a pin someone opened is never hidden inside another one.
 */
export function mergeSimilar(pins: Pin[], rank: (p: Pin) => number, keep: ReadonlySet<string> = new Set()): Merged {
  const order = [...pins].sort((a, b) => Number(keep.has(b.id)) - Number(keep.has(a.id)) || rank(b) - rank(a))
  const leads: Pin[] = []
  const others = new Map<string, string[]>()
  for (const p of order) {
    const lead = keep.has(p.id) ? undefined : leads.find((l) => canMerge(l, p))
    if (lead) others.set(lead.id, [...(others.get(lead.id) ?? []), p.id])
    else leads.push(p)
  }
  // Keep the input order for drawing (stacking stays stable as ranks change).
  const isLead = new Set(leads.map((p) => p.id))
  return { pins: pins.filter((p) => isLead.has(p.id)), others }
}
