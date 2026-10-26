import { APIProvider } from '@vis.gl/react-google-maps'
import { lazy, Suspense } from 'react'
import { CreateLayer, PinButton } from '../create'
import { DetailLayer } from '../detail'
import { LocateButton } from '../map/LocateButton'
import { MapView } from '../map/MapView'
import { ZoomButtons } from '../map/ZoomButtons'
import { SheetLayer } from '../sheet'
import { useStore } from '../store'
import { TopBar } from '../top'
import { useData } from './useData'
import './app.css'

const KitchenSink = lazy(() => import('../design/KitchenSink'))
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

/**
 * Layers, bottom to top: map (full bleed), top bar, sheet, floating buttons on the sheet edge,
 * create layer, detail layer. Each layer is owned by one agent (docs/IMPLEMENTATION.md).
 * Stacking comes from z-index (app.css), so the DOM order is free to follow the reading and Tab order
 * (WCAG 1.3.2, 2.4.3): search and filters, the map buttons, the list, then the map and its markers.
 */
function Home() {
  useData()
  const sheetHeight = useStore((s) => s.sheetHeight)
  const creating = useStore((s) => s.create.step !== 'idle')
  const detailOpen = useStore((s) => s.detailPinId != null)
  return (
    <APIProvider apiKey={API_KEY}>
      <div className={detailOpen ? 'app-shell has-detail' : 'app-shell'}>
        <h1 className="sr-only">Push The Pin</h1>
        <div className="app-top">
          <TopBar />
        </div>
        {sheetHeight !== 'full' && !creating && (
          <div className="app-fabs">
            <ZoomButtons />
            <LocateButton />
            <PinButton />
          </div>
        )}
        <SheetLayer />
        <div className="app-map">
          <MapView />
        </div>
        <CreateLayer />
        <DetailLayer />
      </div>
    </APIProvider>
  )
}

export function App() {
  // BASE_URL is '/' locally and '/ptp-map-first/' on GitHub Pages.
  if (location.pathname === `${import.meta.env.BASE_URL}kitchen-sink`) {
    return (
      <Suspense fallback={null}>
        <KitchenSink />
      </Suspense>
    )
  }
  return <Home />
}
