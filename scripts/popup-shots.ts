// Popups (Pulse on the map) at zoom 14, 15 and 17, using the zoom buttons. One map load per run (Demo Key cap).
// Needs `npm run dev`. Usage: npx tsx scripts/popup-shots.ts [390x844]
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number)
const dir = 'docs/screens/popups'
mkdirSync(dir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors: string[] = []
page.on('console', (m) => m.type() === 'error' && !m.text().includes('429') && errors.push(m.text()))
const wait = (ms: number) => page.waitForTimeout(ms)
const census = async (label: string) =>
  console.log(label, JSON.stringify(await page.evaluate(() => ({
    popups: [...document.querySelectorAll('.map-bubble')].map((e) => e.textContent),
    text: [...document.querySelectorAll('.map-text')].map((e) => e.textContent),
    tags: document.querySelectorAll('.map-tag').length,
  }))))

await page.goto('http://localhost:5173/')
await page.waitForSelector('.sheet-card', { timeout: 20_000 })
await wait(3500)
await page.locator('.sheet__handle').click()
await wait(500)
await page.getByRole('button', { name: 'Map', exact: true }).click() // peek
await wait(1500)
await page.getByRole('button', { name: 'Zoom out' }).click()
await wait(1800)
await census('z14')
await page.screenshot({ path: `${dir}/z14-${w}x${h}.png` })
await page.getByRole('button', { name: 'Zoom in' }).click()
await wait(1800)
await census('z15')
await page.screenshot({ path: `${dir}/z15-${w}x${h}.png` })

// Zoom onto one pin: drag the map so the Chapel Road ask sits in the middle of the view, then zoom in twice.
const pin = await page.locator('.map-mk[aria-label^="Reliable electrician"]').boundingBox()
if (pin) {
  const top = 112
  const bottom = h - (await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-offset')) || 0))
  const from = { x: pin.x + pin.width / 2 + 40, y: pin.y + pin.height / 2 } // grab the map beside the marker
  const to = { x: w / 2 + 40, y: (top + bottom) / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 40 })
  await wait(400) // hold still before letting go, so the map does not fling on
  await page.mouse.up()
  await wait(1500)
}
for (const z of [16, 17]) {
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await wait(2200)
  await census(`z${z}`)
  const b = await page.locator('.map-mk[aria-label^="Reliable electrician"]').boundingBox()
  console.log('  pin at', b && [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)])
}
await page.screenshot({ path: `${dir}/z17-one-pin-${w}x${h}.png` })
console.log('console errors (429s from the Places quota left out):', errors.length ? errors : 'none')
await browser.close()
