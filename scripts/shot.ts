// Usage: npx tsx scripts/shot.ts <path> <out.png> [width] [height] [waitMs]
// Screenshots the local dev server at a phone viewport.
import { chromium } from '@playwright/test'

const [path = '/', out = 'docs/screens/shot.png', w = '390', h = '844', wait = '3500'] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const errors: string[] = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`http://localhost:5173${path}`)
await page.waitForTimeout(Number(wait))
await page.screenshot({ path: out })
await browser.close()
if (errors.length) console.log('console errors:\n' + errors.map((e) => e.replace(/key=[^&\s]+/g, 'key=<redacted>')).join('\n'))
console.log('saved', out)
