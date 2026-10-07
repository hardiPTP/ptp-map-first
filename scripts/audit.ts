// Phase 3 evidence for the reviewer: visible text font sizes/families and tap target sizes per state.
// Usage: npx tsx scripts/audit.ts  -> docs/screens/qa/audit.json
import { chromium, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const pageFn = readFileSync('scripts/audit-page.js', 'utf8').replace(/^\/\/.*\n/, '')
type Result = { state: string; texts: { px: number }[]; targets: unknown[]; smallText: unknown[]; smallTargets: unknown[] }
async function collect(page: Page, state: string): Promise<Result> {
  // Plain-JS string: tsx adds a __name helper to functions, which does not exist in the page.
  return page.evaluate(`(${pageFn})(${JSON.stringify(state)})`) as Promise<Result>
}

const out = []
await p.goto('http://localhost:5173/'); await p.waitForSelector('.sheet-card'); await p.waitForTimeout(3500)
out.push(await collect(p, 'home-half'))
await p.locator('.sheet-card').first().click({ position: { x: 150, y: 40 } }); await p.waitForTimeout(900)
out.push(await collect(p, 'detail'))
await p.getByRole('dialog').getByRole('button', { name: 'Close' }).click(); await p.waitForTimeout(500)
await p.getByTestId('pin-button').click(); await p.waitForTimeout(2500)
out.push(await collect(p, 'create-placing'))
await p.getByRole('button', { name: 'Use this spot' }).click(); await p.waitForTimeout(800)
await p.locator('[data-testid="create-sheet"] .create-tiles [role="radio"]').nth(1).click(); await p.waitForTimeout(400)
out.push(await collect(p, 'create-event-details'))
writeFileSync('docs/screens/qa/audit.json', JSON.stringify(out, null, 1))
for (const s of out) console.log(s.state, 'texts', s.texts.length, 'small text', JSON.stringify(s.smallText), 'small targets', JSON.stringify(s.smallTargets))
await b.close()
