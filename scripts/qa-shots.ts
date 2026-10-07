// Phase 3 QA screenshots (lead). Usage: npx tsx scripts/qa-shots.ts <w> <h>
// Against the :5173 dev server (mock data). Google calls: one map load + one searchNearby (placing).
import { chromium, type Page } from '@playwright/test'

const [w = '390', h = '844'] = process.argv.slice(2)
const dir = 'docs/screens/qa'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().replace(/key=[^&\s]+/g, 'key=<redacted>')) })
const shot = (n: string) => page.screenshot({ path: `${dir}/${n}-${w}x${h}.png` })
const wait = (ms: number) => page.waitForTimeout(ms)

async function zoomBy(p: Page, steps: number, at?: { x: number; y: number }) {
  if (at) {
    // Wheel zoom goes toward the cursor, so the dense part of the map stays in view.
    await p.mouse.move(at.x, at.y)
    for (let i = 0; i < Math.abs(steps); i++) { await p.mouse.wheel(0, steps > 0 ? -120 : 120); await wait(600) }
  } else {
    // Focus the map's keyboard target without clicking (a click could land on a marker).
    await p.locator('.app-map [tabindex="0"]').first().focus()
    for (let i = 0; i < Math.abs(steps); i++) { await p.keyboard.press(steps > 0 ? '=' : '-'); await wait(450) }
  }
  await wait(1500)
}

await page.goto('http://localhost:5173/')
await page.waitForSelector('.sheet-card', { timeout: 20_000 })
await wait(3500)
await shot('01-home-half')
await page.locator('.sheet__handle').click(); await wait(500) // full
await page.getByRole('button', { name: 'Map', exact: true }).click(); await wait(900) // peek
await shot('08-tags-z15')
const dense = await page.locator('.map-anchor').evaluateAll((els) => {
  const pts = els.map((e) => e.getBoundingClientRect()).filter((r) => r.top > 170 && r.bottom < innerHeight - 160)
  pts.sort((a, b) => a.top - b.top)
  const m = pts[Math.floor(pts.length / 2)]
  return m ? { x: m.left + m.width / 2, y: m.top + m.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 }
})
await zoomBy(page, 2, dense)
await shot('09-tags-z17')
await page.reload(); await page.waitForSelector('.sheet-card'); await wait(3500)
await page.locator('.sheet-area').screenshot({ path: `${dir}/02-area-strip-${w}x${h}.png` })
await page.locator('.sheet-area button').first().click(); await wait(700)
await shot('03-area-selected-tint')
await page.locator('.sheet-area button').first().click(); await wait(400)
await page.locator('.sheet-card').nth(0).screenshot({ path: `${dir}/04-card-${w}x${h}.png` })
await page.locator('.sheet__handle').click(); await wait(700)
await shot('05-home-full')
await page.getByRole('button', { name: 'Map', exact: true }).click(); await wait(900)
await shot('06-home-peek')

// detail
await page.getByRole('button', { name: 'List', exact: true }).click(); await wait(700)
await page.locator('.sheet-card').nth(0).click({ position: { x: 150, y: 40 } }); await wait(1000)
await shot('07-detail')
await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click(); await wait(600)
await page.getByRole('button', { name: 'Map', exact: true }).click(); await wait(900)

// clusters at 13 (default zoom 15, -2)
await zoomBy(page, -2)
await shot('10-clusters-z13')
await zoomBy(page, 2)

// create steps
await page.getByTestId('pin-button').click(); await wait(3500)
await shot('11-create-placing')
await page.getByRole('button', { name: 'Use this spot' }).click(); await wait(900)
await shot('12-create-tiles')
await page.locator('[data-testid="create-sheet"] .create-tiles [role="radio"]').nth(1).click()
await wait(500)
await page.locator('[data-testid="create-sheet"] input:not([type="date"]):not([type="time"])').first().fill('Carrom evening for seniors, bring your own striker')
await wait(300)
await shot('13-create-event-details')
console.log('errors', errors)
await browser.close()
