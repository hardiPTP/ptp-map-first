/**
 * Map mode (docs/DECISIONS.md). Mode A: Map ID set -> cloud style + mapId, no JSON styles.
 * Mode B: no Map ID -> JSON styles, no mapId, custom HTML markers via OverlayView
 * (Advanced Markers need a map ID: developers.google.com/maps/documentation/javascript/advanced-markers/start).
 */
export const MAP_ID: string | undefined = import.meta.env.VITE_GOOGLE_MAP_ID || undefined
export const MAP_MODE: 'A' | 'B' = MAP_ID ? 'A' : 'B'
