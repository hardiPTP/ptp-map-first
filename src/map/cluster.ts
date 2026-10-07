// Screen-space grid clustering (PRD: clusters at zoom 13 and below). Pure: no Google objects.
// Web Mercator world pixels at a zoom: https://developers.google.com/maps/documentation/javascript/coordinates
import type { LatLng, Pin } from '../types'

/** Clusters exist at this zoom and below. */
export const CLUSTER_MAX_ZOOM = 13
/** Grid cell size in screen px. Figma cluster marker is 44; cells slightly bigger keep neighbours apart. */
export const CLUSTER_CELL_PX = 56

export interface Cluster extends LatLng {
  /** Stable while membership is unchanged: "cluster:" + sorted member ids. */
  id: string
  count: number
  pins: Pin[]
}

export interface ClusterResult {
  singles: Pin[]
  clusters: Cluster[]
}

/** World pixel of a lat/lng at a zoom (256 px tile). */
export function worldPx(p: LatLng, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom
  const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((p.lat * Math.PI) / 180)))
  return {
    x: ((p.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

/**
 * Groups pins into screen-space grid cells. Cells with two or more pins become a cluster.
 * `keepSingle` ids (e.g. the selected pin) are never absorbed.
 */
export function clusterPins(
  pins: Pin[],
  zoom: number,
  opts: { cellPx?: number; maxZoom?: number; keepSingle?: ReadonlySet<string> } = {},
): ClusterResult {
  const { cellPx = CLUSTER_CELL_PX, maxZoom = CLUSTER_MAX_ZOOM, keepSingle } = opts
  if (zoom > maxZoom) return { singles: pins, clusters: [] }
  const cells = new Map<string, Pin[]>()
  const singles: Pin[] = []
  for (const pin of pins) {
    if (keepSingle?.has(pin.id)) {
      singles.push(pin)
      continue
    }
    const { x, y } = worldPx(pin, zoom)
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`
    const list = cells.get(key)
    if (list) list.push(pin)
    else cells.set(key, [pin])
  }
  const clusters: Cluster[] = []
  for (const group of cells.values()) {
    if (group.length === 1) {
      singles.push(group[0])
      continue
    }
    const lat = group.reduce((s, p) => s + p.lat, 0) / group.length
    const lng = group.reduce((s, p) => s + p.lng, 0) / group.length
    const ids = group.map((p) => p.id).sort()
    clusters.push({ id: `cluster:${ids.join(',')}`, lat, lng, count: group.length, pins: group })
  }
  return { singles, clusters }
}
