// Map layer screenshots (Google-sized pins with text, bubbles, tags) at zoom 15 and 17, a bubble tap into the
// detail, then claiming a place: claim sheet, team approval (dev-only mock hook), posting an offer as the place.
// Needs `npm run dev` on :5173 with mock data. One map load per run (Maps Demo Key cap).
// Usage: npx tsx scripts/layer-shots.ts [390x844]
import { mkdirSync } from 'node:fs'
import { chromium, type Page } from '@playwright/test'

const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number)
const dir = 'docs/screens/layers'
mkdirSync(dir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors: string[] = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
const wait = (ms: number) => page.waitForTimeout(ms)
const shot = (name: string) => page.screenshot({ path: `${dir}/${name}-${w}x${h}.png` })

async function census(p: Page, label: string) {
  const r = await p.evaluate(() => ({
    bubbles: [...document.querySelectorAll('.map-bubble')].map((e) => e.textContent),
    tags: document.querySelectorAll('.map-tag').length,
    text: [...document.querySelectorAll('.map-text')].map((e) => e.textContent),
  }))
  console.log(label, JSON.stringify(r))
}

async function zoomIn(steps: number) {
  // The map's keyboard control (a wheel over a marker is swallowed by the marker overlay).
  await page.locator('.app-map [tabindex="0"]').first().focus()
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('=')
    await wait(700)
  }
  await wait(1500)
}

await page.goto('http://localhost:5173/')
await page.waitForSelector('.sheet-card', { timeout: 20_000 })
await wait(3500)
await page.locator('.sheet__handle').click()
await wait(500) // full
await page.getByRole('button', { name: 'Map', exact: true }).click()
await wait(1500) // peek: the most map
await census(page, 'z15')
await shot('z15')

await zoomIn(2)
await census(page, 'z17')
await shot('z17')

// "@ Place" on a bubble: everything posted there, in the sheet.
const at = page.locator('button.map-bubble__at').first()
if (await at.count()) {
  await at.click()
  await wait(1500)
  await shot('at-place')
  await page.getByRole('button', { name: 'Back to nearby' }).click()
  await wait(1200)
}

const bubble = page.locator('.map-bubble__main').first()
if (await bubble.count()) {
  await bubble.click()
  await wait(1500)
  await shot('bubble-to-comments')
  await page.getByRole('button', { name: 'Close' }).first().click()
  await wait(1200)
}

// Places chip: real Google places as dots at any zoom; zoom out so the walk radius is in view.
await page.getByRole('button', { name: /^Places/ }).click()
await wait(800)
await page.locator('.app-map [tabindex="0"]').first().focus()
for (let i = 0; i < 2; i++) {
  await page.keyboard.press('-')
  await wait(700)
}
await wait(1500)
// The first place dot inside the visible map band (between the top bar and the sheet).
const dotIndex = await page.evaluate(() => {
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-bar-h')) || 112
  const bottom = innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-offset')) || 0)
  return [...document.querySelectorAll('.map-place')].findIndex((el) => {
    const r = el.getBoundingClientRect()
    return r.left > 20 && r.right < innerWidth - 20 && r.top > top + 10 && r.bottom < bottom - 10
  })
})
const dot = page.locator('.map-place').nth(Math.max(0, dotIndex))
if (dotIndex >= 0) {
  await dot.click()
  await wait(1500)
  await shot('place-unclaimed')
  const claim = page.getByRole('button', { name: 'Own this place? Claim it' })
  if (await claim.count()) {
    await claim.click()
    await wait(600)
    await shot('claim-sheet')
    await page.getByRole('button', { name: /^Pay \$100\/month/ }).click()
    await wait(600)
    await shot('claim-sent')
    await page.getByRole('button', { name: 'Done' }).click()
    await wait(400)
    await page.evaluate(() => (window as unknown as { ptpTeam: { approveClaim(): void } }).ptpTeam.approveClaim())
    await wait(400)
    await shot('place-claimed')
    await page.getByRole('button', { name: /^Post as / }).click()
    await wait(800)
    await page.getByRole('radio', { name: 'Offer' }).click()
    await page.getByLabel('Title').fill('20% off all evening batches this week')
    await wait(300)
    await shot('post-offer')
    await page.getByTestId('create-sheet').locator('.ptp-btn--primary').click()
    await wait(2500)
    await shot('offer-posted')
    // Places chip off: the offer on the map, a round pin with the place ring, its text and "to <day>" tag.
    // Posting selected the offer and flew the map to it; leave the camera there.
    await page.getByRole('button', { name: /^Places/ }).click()
    await wait(1500)
    await census(page, 'offer on map')
    await shot('offer-on-map')
  } else console.log('no claim link on the first place dot')
} else console.log('no place dots on screen')

console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
