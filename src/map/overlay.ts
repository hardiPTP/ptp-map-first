// One OverlayView owning a container div; React portals markers into it.
// Docs: https://developers.google.com/maps/documentation/javascript/customoverlays
// (panes: overlayMouseTarget receives DOM events; getProjection().fromLatLngToDivPixel in draw()).
// OverlayView.preventMapHitsAndGesturesFrom: google.maps types (index.d.ts).
// @vis.gl/react-google-maps has no OverlayView component (checked visgl docs), so this is our own.
export interface MarkerOverlay extends google.maps.OverlayView {
  container: HTMLDivElement
  /** Container px (relative to map div) to LatLng, for long-press. */
  latLngFromContainerPx(x: number, y: number): google.maps.LatLngLiteral | null
}

export function createMarkerOverlay(map: google.maps.Map, onReady: (c: HTMLDivElement) => void): MarkerOverlay {
  class Overlay extends google.maps.OverlayView {
    container = document.createElement('div')
    constructor() {
      super()
      this.container.className = 'map-overlay'
    }
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.container)
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.container)
      onReady(this.container)
    }
    draw() {
      const proj = this.getProjection()
      if (!proj) return
      const anchors = this.container.querySelectorAll<HTMLElement>('[data-lat]')
      anchors.forEach((el) => {
        const pt = proj.fromLatLngToDivPixel(new google.maps.LatLng(Number(el.dataset.lat), Number(el.dataset.lng)))
        if (pt) el.style.transform = `translate(${pt.x}px, ${pt.y}px)`
      })
    }
    onRemove() {
      this.container.remove()
    }
    latLngFromContainerPx(x: number, y: number) {
      const ll = this.getProjection()?.fromContainerPixelToLatLng(new google.maps.Point(x, y))
      return ll ? { lat: ll.lat(), lng: ll.lng() } : null
    }
  }
  const o = new Overlay()
  o.setMap(map)
  return o
}
