// Shape of src/data/seed.generated.json (written by scripts/seed.ts).
// Times are offsets from "now" so "today" is always today; materialise() turns them into epoch ms.
import type { Pin } from '../types.ts'

/** Minutes from now (negative = past), or a wall-clock time on a named IST day. */
export type RelTime =
  | { min: number }
  | { day: 'today' | 'tomorrow' | 'sat' | 'sun'; h: number; m?: number }
  /** A real, fixed date and time (ISO 8601 with offset), for items taken from listings and reports. */
  | { iso: string }

export type SeedPin = Omit<Pin, 'createdAt' | 'startsAt' | 'endsAt' | 'endsAtOriginal' | 'lastSupportAt'> & {
  createdAtMin: number
  /** Fixed creation time for real items (report or listing date). Wins over createdAtMin. */
  createdAtIso?: string | null
  startsAt?: RelTime | null
  endsAt?: RelTime | null
  endsAtOriginal?: RelTime | null
}

export interface SeedSupport {
  pinId: string
  deviceId: string
  createdAtMin: number
}

export interface SeedFile {
  /** Venues/streets the seed was built from (names exactly as Places returned them). */
  source: string
  pins: SeedPin[]
  supports: SeedSupport[]
}
