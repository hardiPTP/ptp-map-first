// Zoom in / out buttons, stacked above the locate button. Zooms about the centre of the VISIBLE map band (between the
// top bar and the sheet), through the same fly-to command as everything else, so what you look at stays put.
// useMap outside <Map> returns the page's only map: https://visgl.github.io/react-google-maps/docs/api-reference/hooks/use-map
import { useMap } from '@vis.gl/react-google-maps'
import { ShellButton } from '../design/primitives'
import { DEFAULT_ZOOM, useStore } from '../store'

export const MIN_ZOOM = 3
export const MAX_ZOOM = 21

export function ZoomButtons() {
  const map = useMap()
  const zoom = useStore((s) => s.viewport.zoom)
  const step = (d: number) => {
    // The map's live zoom, so quick repeated taps add up before the map settles.
    const now = map?.getZoom() ?? zoom ?? DEFAULT_ZOOM
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(now) + d))
    if (next === now) return
    const s = useStore.getState()
    s.requestFlyTo({ ...s.viewport.center, zoom: next })
  }
  return (
    <div className="app-zoom" role="group" aria-label="Zoom">
      <ShellButton icon="ic-plus" label="Zoom in" size={46} disabled={zoom >= MAX_ZOOM} onClick={() => step(1)} />
      <ShellButton icon="ic-minus" label="Zoom out" size={46} disabled={zoom <= MIN_ZOOM} onClick={() => step(-1)} />
    </div>
  )
}
