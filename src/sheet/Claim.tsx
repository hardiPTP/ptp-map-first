// Claiming a place (DECISIONS.md 2026-10-22). A business claims its Google place for $100 a month (mock checkout:
// nothing is charged in the prototype), the team checks the claim, then the device can post offers and events as
// the place. Offers carry an "Offer" mark and rank a little below neighbours' posts; the sheet says so up front.
import { useEffect, useRef, useState } from 'react'
import { repo } from '../data'
import { Button, Icon } from '../design/primitives'
import { claimFor } from '../lib/claims'
import { useStore } from '../store'
import { Sheet } from '../top/Sheets'
import { CLAIM_PRICE_USD, type NearbyPlace } from '../types'

type State = 'idle' | 'paying' | 'sent' | 'failed'

export function ClaimSheet({ place, onClose }: { place: NearbyPlace; onClose: () => void }) {
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  // The pay button goes away once the claim is sent: focus the confirmation, so it is read and focus is not lost.
  const sentRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (state === 'sent') sentRef.current?.focus()
  }, [state])
  const pay = () => {
    if (state === 'paying') return
    setState('paying')
    setError(null)
    repo
      .claimPlace({ placeId: place.id, placeName: place.name })
      .then(() => setState('sent'))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'something went wrong')
        setState('failed')
      })
  }
  return (
    <Sheet title={`Claim ${place.name}`} onClose={onClose}>
      {state === 'sent' ? (
        <>
          <p className="claim-lead" role="status" tabIndex={-1} ref={sentRef}>
            Claim sent. You can post as {place.name} once the team has checked it.
          </p>
          <Button variant="primary" size="big" fill onClick={onClose}>
            Done
          </Button>
        </>
      ) : (
        <>
          <p className="claim-lead">Post offers and events as {place.name}, with the verified mark.</p>
          <ul className="claim-points">
            <li>
              <Icon name="verified" size={18} tint={false} />
              <span>
                <strong>${CLAIM_PRICE_USD} a month.</strong> Post an offer, like 20% off this week, for as long as it runs.
              </span>
            </li>
            <li>
              <Icon name="ic-info" size={18} />
              <span>Offers are marked “Offer” and sit a little below neighbours’ posts, so Pulse stays about the neighbourhood.</span>
            </li>
            <li>
              <Icon name="ic-checkcircle" size={18} />
              <span>The team checks every claim before you can post.</span>
            </li>
          </ul>
          {state === 'failed' && (
            <p className="claim-error" role="alert">
              Could not claim: {error}.
            </p>
          )}
          <Button variant="primary" size="big" fill disabled={state === 'paying'} onClick={pay}>
            {state === 'paying' ? 'Claiming' : `Pay $${CLAIM_PRICE_USD}/month and claim`}
          </Button>
          <p className="top-note">Prototype: no card is asked for and nothing is charged.</p>
        </>
      )}
    </Sheet>
  )
}

/**
 * Under a picked place in the sheet header. Only for Google businesses we know (the nearby places list).
 * Not claimed: "Own this place? Claim it". Mine, checking: a note. Mine, active: "Post as <place>".
 * Someone else's: "Claimed" (active) or "Claim being checked" (pending).
 */
export function ClaimRow({ place }: { place: NearbyPlace }) {
  const [open, setOpen] = useState(false)
  // The sheet stays open after paying (the claim then exists and the row below changes), to say what happens next.
  return (
    <>
      <ClaimState place={place} onClaim={() => setOpen(true)} />
      {open && <ClaimSheet place={place} onClose={() => setOpen(false)} />}
    </>
  )
}

function ClaimState({ place, onClaim }: { place: NearbyPlace; onClaim: () => void }) {
  const claim = useStore((s) => claimFor(place.id, s.claims))
  const deviceId = useStore((s) => s.deviceId)
  const mine = !!claim && claim.deviceId === deviceId
  if (!claim)
    return (
      <button type="button" className="claim-link" onClick={onClaim} aria-haspopup="dialog">
        Own this place? Claim it
      </button>
    )
  if (mine && claim.status === 'active')
    return (
      <Button
        variant="primary"
        icon="ic-plus"
        onClick={() =>
          useStore
            .getState()
            .confirmSpot({ lat: place.lat, lng: place.lng }, { placeId: place.id, placeName: place.name }, { asPlace: true })
        }
      >
        Post as {place.name}
      </Button>
    )
  if (mine) return <p className="claim-note">Your claim is being checked by the team.</p>
  return (
    <p className="claim-note">
      {claim.status === 'active' ? (
        <>
          <Icon name="verified" size={15} tint={false} /> Claimed by the place
        </>
      ) : (
        'A claim for this place is being checked'
      )}
    </p>
  )
}
