// Per-device seen counts (PRD freshness rule). localStorage, always in try/catch.
const KEY = 'ptp.tagSeen'

export function loadSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : {}
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function saveSeen(seen: Record<string, number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(seen))
  } catch {
    /* private mode or blocked: the counts just reset */
  }
}
