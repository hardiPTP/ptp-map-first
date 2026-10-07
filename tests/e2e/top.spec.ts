// Top bar e2e: screenshots and the session-token network check.
// Uses the dev server on :5173 and the mock data source. At most ONE live Google search session per run.
import { expect, test } from '@playwright/test'

// Live Places Autocomplete calls count against the Demo Key cap (CLAUDE.md): opt-in only.
test.skip(!process.env.PTP_LIVE_GOOGLE, 'set PTP_LIVE_GOOGLE=1 to run the live autocomplete check')

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

test('search: one session token across the keystrokes of one search session', async ({ page }) => {
  const tokens: string[] = []
  const urls: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (/(places|maps)\.googleapis\.com/.test(u) && /autocomplete/i.test(u)) {
      urls.push(u.split('?')[0])
      const body = r.postData() ?? ''
      // The JS API posts to .../google.maps.places.v1.Places/AutocompletePlaces ($rpc); the body is a JSON array
      // whose last string is the session token.
      const m = body.match(/"([^"]{20,})"\]$/)
      if (m) tokens.push(m[1])
    }
  })
  await page.goto('/')
  await page.waitForTimeout(3000)
  const input = page.getByPlaceholder('Search places, events, issues')
  await input.click()
  await input.pressSequentially('yo')
  await page.waitForTimeout(600)
  expect(tokens.length).toBe(0) // under 3 characters: no Google call
  await input.pressSequentially('g', { delay: 50 })
  await page.waitForTimeout(900)
  await input.pressSequentially('a', { delay: 50 })
  await page.waitForTimeout(900)
  await input.pressSequentially(' stud', { delay: 40 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'docs/screens/top-search.png' })
  console.log('autocomplete requests:', tokens.length, 'urls:', [...new Set(urls)].join(','), 'tokens:', tokens.map((t) => t.slice(0, 4) + '…').join(' '))
  await expect(page.getByRole('option').first()).toBeVisible()
  expect(tokens.length).toBeGreaterThan(1)
  expect(new Set(tokens).size).toBe(1)
})
