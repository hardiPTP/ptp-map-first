import { APIProvider } from '@vis.gl/react-google-maps'
import { lazy, Suspense } from 'react'
import { CreateLayer, PinButton } from '../create'
import { DetailLayer } from '../detail'
import { LocateButton } from '../map/LocateButton'
import { MapView } from '../map/MapView'
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
 */
function Home() {
  useData()
  const sheetHeight = useStore((s) => s.sheetHeight)
  const creating = useStore((s) => s.create.step !== 'idle')
  return (
    <APIProvider apiKey={API_KEY}>
      <div className="app-shell">
        <div className="app-map">
          <MapView />
        </div>
        <div className="app-top">
          <TopBar />
        </div>
        <SheetLayer />
        {sheetHeight !== 'full' && !creating && (
          <div className="app-fabs">
            <LocateButton />
            <PinButton />
          </div>
        )}
        <CreateLayer />
        <DetailLayer />
      </div>
    </APIProvider>
  )
}

export function App() {
  if (location.pathname === '/kitchen-sink') {
    return (
      <Suspense fallback={null}>
        <KitchenSink />
      </Suspense>
    )
  }
  return <Home />
}
