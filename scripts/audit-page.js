// Runs inside the page (plain JS; see scripts/audit.ts).
(state) => {
  const vis = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight
  }
  const app = document.querySelector('#root')
  const texts = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const n = walker.currentNode; const t = n.textContent && n.textContent.trim(); const el = n.parentElement
    if (!t || !el || !vis(el) || el.closest('.gm-style-cc, .gmnoprint, [class^="gm-"]')) continue
    const cs = getComputedStyle(el)
    texts.push({ text: t.slice(0, 50), px: parseFloat(cs.fontSize), family: cs.fontFamily.split(',')[0], weight: cs.fontWeight })
  }
  const targets = [...document.querySelectorAll('button, a, input, [role="radio"], [role="button"]')]
    .filter((el) => vis(el) && !el.closest('.gm-style-cc, .gmnoprint'))
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { label: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }
    })
  void app
  return { state, texts, targets, smallText: texts.filter((t) => t.px < 14), smallTargets: targets.filter((t) => t.w < 44 || t.h < 44) }
}
