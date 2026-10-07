// /kitchen-sink: every primitive, for Gate 0 comparison with Figma. Copy comes from PRD examples.
import { useState } from 'react'
import {
  Button,
  Card,
  Chip,
  Field,
  Grabber,
  Icon,
  NeighbourLabel,
  PlaceLabel,
  PtpLabel,
  SheetSurface,
  ShellButton,
  Snack,
  Tag,
} from './primitives'
import './kitchen-sink.css'

export default function KitchenSink() {
  const [chip, setChip] = useState('All')
  const [going, setGoing] = useState(false)
  return (
    <main className="ks">
      <h1 className="ks-h">Kitchen sink</h1>

      <section className="ks-s">
        <h2 className="ks-sh">Buttons</h2>
        <div className="ks-row">
          <Button variant="primary" icon="ic-plus">Pin</Button>
          <Button variant="quiet" icon="ic-whatsapp">Share</Button>
          <Button variant="soft" icon="ic-checkcircle" pressed={going} onClick={() => setGoing(!going)}>
            I'm going · {going ? 13 : 12}
          </Button>
        </div>
        <div className="ks-row">
          <Button variant="primary" size="big" fill>Use this spot</Button>
        </div>
        <div className="ks-row">
          <Button variant="quiet" disabled>Write a title first</Button>
          <ShellButton icon="ic-target" label="Locate me" />
          <ShellButton icon="ic-close" label="Close" variant="quiet" />
        </div>
      </section>

      <section className="ks-s">
        <h2 className="ks-sh">Chips</h2>
        <div className="ks-row" role="radiogroup" aria-label="Filter">
          {['All', 'Issues', 'Events', 'Asks'].map((c) => (
            <Chip key={c} selected={chip === c} onClick={() => setChip(c)}>{c}</Chip>
          ))}
        </div>
      </section>

      <section className="ks-s">
        <h2 className="ks-sh">Poster labels</h2>
        <div className="ks-col">
          <NeighbourLabel />
          <NeighbourLabel style="line" />
          <PlaceLabel name="Place name from Google" />
          <PtpLabel />
        </div>
      </section>

      <section className="ks-s">
        <h2 className="ks-sh">Map tags</h2>
        <div className="ks-row">
          <Tag symbol="ic-clock" value="12d" />
          <Tag symbol="ic-clock" value="9d" tone="orange" />
          <Tag symbol="ic-clock" value="in 40m" />
          <Tag symbol="ic-heart" value="2" />
          <Tag symbol="ic-gather" value="8 events" />
        </div>
      </section>

      <section className="ks-s">
        <h2 className="ks-sh">Card shell</h2>
        <Card>
          <div className="ks-meta">
            <NeighbourLabel style="line" />
            <span>~6 min walk</span>
          </div>
          <p className="ks-title">Hawkers back on the footpath outside no. 42</p>
          <p className="ks-when">2 hrs ago · Hill Road</p>
          <div className="ks-row">
            <Button variant="soft" icon="ic-checkcircle">I see it too · 14</Button>
            <ShellButton icon="ic-whatsapp" label="Share on WhatsApp" variant="quiet" />
          </div>
        </Card>
        <div style={{ height: 18 }} />
        <Card edge="ptp">
          <div className="ks-meta"><PtpLabel /></div>
          <p className="ks-title">No water</p>
          <p className="ks-when">Tomorrow, 10 AM to 6 PM</p>
        </Card>
      </section>

      <section className="ks-s">
        <h2 className="ks-sh">Field and snack</h2>
        <div className="ks-col">
          <Field placeholder="Need someone to water plants for 3 days" />
          <Snack>Pinned. It is at the top of Pulse.</Snack>
        </div>
      </section>

      <section className="ks-s ks-s--sheet">
        <h2 className="ks-sh">Sheet surface</h2>
        <SheetSurface className="ks-sheet">
          <Grabber />
          <p className="ks-title">14 things within a 10 min walk today</p>
          <span className="ks-iconrow">
            <Icon name="ic-droplet" /> <Icon name="ic-bulb" /> <Icon name="ic-warn" /> <Icon name="ic-footpath" />
          </span>
        </SheetSurface>
      </section>
    </main>
  )
}
