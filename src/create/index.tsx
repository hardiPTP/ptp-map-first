// Create flow (agent E): "+ Pin" button and the create layer (placing mode, details sheet, snack).
// Back button: entering create pushes ONE history entry; the browser/Android back button (popstate)
// steps back like the on-screen Back. Leaving create by any other route removes that entry again.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Snack } from '../design/primitives'
import { useStore } from '../store'
import { Details } from './Details'
import { Placing } from './Placing'
import './create.css'

export function PinButton() {
  return (
    <Button variant="primary" icon="ic-plus" data-testid="pin-button" onClick={() => useStore.getState().startCreate()}>
      Pin
    </Button>
  )
}

const SNACK_MS = 3500

// Did the details step come from placing (Back returns there) or from a long-press (Back exits)?
// Tracked outside React so render can read it; updated before React sees the store change.
let cameFromPlacing = false
let lastStep = useStore.getState().create.step
useStore.subscribe((s) => {
  const step = s.create.step
  if (step !== lastStep) {
    if (step === 'details') cameFromPlacing = lastStep === 'placing'
    lastStep = step
  }
})

export function CreateLayer() {
  const step = useStore((s) => s.create.step)
  const [snack, setSnack] = useState(false)
  const owned = useRef(false) // we pushed a history entry that is still on the stack

  // Back: details -> placing if it came from placing, else idle; placing -> idle.
  const back = useCallback(() => {
    const s = useStore.getState()
    if (s.create.step === 'details' && cameFromPlacing) s.startCreate({ at: s.create.at ?? undefined })
    else s.cancelCreate()
  }, [])

  useEffect(() => {
    if (step !== 'idle' && !owned.current) {
      history.pushState({ ptpCreate: true }, '')
      owned.current = true
    } else if (step === 'idle' && owned.current) {
      owned.current = false
      if (history.state?.ptpCreate) history.back()
    }
  }, [step])

  useEffect(() => {
    const onPop = () => {
      if (!owned.current) return
      owned.current = false // the browser already consumed our entry
      back()
      if (useStore.getState().create.step !== 'idle') {
        history.pushState({ ptpCreate: true }, '')
        owned.current = true
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [back])

  useEffect(() => {
    if (!snack) return
    const t = setTimeout(() => setSnack(false), SNACK_MS)
    return () => clearTimeout(t)
  }, [snack])

  return (
    <div className="create-layer">
      {step === 'placing' && <Placing onBack={back} />}
      {step === 'details' && <Details onBack={back} fromPlacing={cameFromPlacing} onPosted={() => setSnack(true)} />}
      {snack && (
        <div className="create-snack">
          <Snack>Pinned. It is at the top of Pulse.</Snack>
        </div>
      )}
    </div>
  )
}
