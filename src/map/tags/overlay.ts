// The tag layer's own OverlayView (same pattern as ../overlay.ts, which belongs to the markers).
// Docs: https://developers.google.com/maps/documentation/javascript/customoverlays
// OverlayView.preventMapHitsAndGesturesFrom: google.maps types (index.d.ts).
export interface TagOverlay extends google.maps.OverlayView {
  container: HTMLDivElement
}

export function createTagOverlay(map: google.maps.Map, onReady: (c: HTMLDivElement) => void): TagOverlay {
  class Overlay extends google.maps.OverlayView {
    container = document.createElement('div')
    constructor() {
      super()
      this.container.className = 'map-overlay map-tags-layer'
    }
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.container)
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.container)
      onReady(this.container)
    }
    draw() {
      const proj = this.getProjection()
      if (!proj) return
      this.container.querySelectorAll<HTMLElement>('[data-lat]').forEach((el) => {
        const pt = proj.fromLatLngToDivPixel(new google.maps.LatLng(Number(el.dataset.lat), Number(el.dataset.lng)))
        if (pt) el.style.transform = `translate(${pt.x}px, ${pt.y}px)`
      })
    }
    onRemove() {
      this.container.remove()
    }
  }
  const o = new Overlay()
  o.setMap(map)
  return o
}
