import { useStore } from '../store'
import type { LatLng } from '../types'

/** AGENT_BRIEF: origin = userLocation when areaMode is nearMe and known, else the map centre. */
export function useOrigin(): LatLng {
  const areaMode = useStore((s) => s.areaMode)
  const userLocation = useStore((s) => s.userLocation)
  const center = useStore((s) => s.viewport.center)
  return areaMode === 'nearMe' && userLocation ? userLocation : center
}
