// QA: map tags at zoom 17. Desktop context (mouse wheel works) at a phone-sized viewport.
// Usage: npx tsx scripts/zoom-shot.ts <w> <h> <steps>
import { chromium } from '@playwright/test'
const [w = '390', h = '844', steps = '2'] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 })
await p.goto('http://localhost:5173/'); await p.waitForSelector('.sheet-card'); await p.waitForTimeout(3500)
await p.locator('.sheet__handle').click(); await p.waitForTimeout(500)
await p.getByRole('button', { name: 'Map', exact: true }).click(); await p.waitForTimeout(900)
// Wheel events do not reach the map in headless Chromium; drag the dense area to the map's centre,
// then zoom with the keyboard (zooms around the centre).
const from = { x: +w / 2 - 20, y: 300 }
const to = { x: +w / 2, y: +h / 2 }
await p.mouse.move(from.x, from.y); await p.mouse.down()
await p.mouse.move(to.x, to.y, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(1200)
await p.locator('.app-map [tabindex="0"]').first().focus()
for (let i = 0; i < +steps; i++) { await p.keyboard.press('='); await p.waitForTimeout(600) }
await p.waitForTimeout(1800)
const z = await p.evaluate(() => document.querySelectorAll('.map-anchor').length)
await p.screenshot({ path: `docs/screens/qa/09-tags-z17-${w}x${h}.png` })
console.log('markers in DOM', z); await b.close()
