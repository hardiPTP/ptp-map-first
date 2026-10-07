import type { LatLng } from '../types'

/** PRD "Google data and cost": walking time = straight-line distance / 80 m per minute, labelled "~". */
export const WALK_M_PER_MIN = 80
/** 10 minute walk ring. */
export const WALK_RING_M = 10 * WALK_M_PER_MIN

const EARTH_R_M = 6_371_008.8

/** Great-circle distance in metres (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Unrounded walking minutes; use for ranking and scores. */
export function walkMin(a: LatLng, b: LatLng): number {
  return distanceM(a, b) / WALK_M_PER_MIN
}

/** "~6 min walk". Rounded, never below 1. */
export function formatWalk(min: number): string {
  return `~${Math.max(1, Math.round(min))} min walk`
}
