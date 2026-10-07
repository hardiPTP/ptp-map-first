// The display name lives on this device only. It is read and written here and nowhere else.
const KEY = 'ptp.displayName'
export function loadName(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
export function saveName(v: string) {
  try {
    if (v) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the name just is not remembered */
  }
}
