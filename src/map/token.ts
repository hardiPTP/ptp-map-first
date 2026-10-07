// Reads a CSS token at runtime for Google objects (Circle options take colour strings, not CSS vars).
export function token(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  } catch {
    return fallback
  }
}
