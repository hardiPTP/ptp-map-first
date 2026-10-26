// Comments section of the detail view (DECISIONS.md 2026-10-22). Figma card/comments (3541:2995), with two
// changes: every comment reads "Neighbour" (no names, CLAUDE.md), and no attach glyph (no photos, PRD).
// Only live comments are listed. A new comment posts as "under_review" and does not show until the team
// makes it live; the poster gets a line saying so.
import { useId, useState } from 'react'
import { Card, Field, ShellButton } from '../design/primitives'
import { repo } from '../data'
import { liveCommentsFor } from '../lib/comments'
import { ago } from '../sheet/format'
import { useStore } from '../store'
import { COMMENT_MAX } from '../types'

type SendState = 'idle' | 'sending' | 'sent' | 'failed'

export function Comments({ pinId, now, sectionRef }: { pinId: string; now: number; sectionRef?: React.Ref<HTMLElement> }) {
  const all = useStore((s) => s.comments)
  const list = liveCommentsFor(pinId, all)
  const [text, setText] = useState('')
  const [state, setState] = useState<SendState>('idle')
  const trimmed = text.trim()
  const left = COMMENT_MAX - text.length
  const leftId = useId()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed || state === 'sending') return
    setState('sending')
    repo
      .addComment({ pinId, text: trimmed })
      .then(() => {
        setText('')
        setState('sent')
      })
      .catch(() => setState('failed'))
  }

  return (
    <Card as="div" className="detail-comments">
      <section ref={sectionRef} className="detail-comments__inner" aria-labelledby="detail-comments-title">
        <div className="detail-comments__head">
          <h3 className="detail-comments__title" id="detail-comments-title">
            Comments
          </h3>
          <span className="detail-comments__count">{list.length}</span>
        </div>
        {list.length > 0 && (
          <ul className="detail-comments__list">
            {list.map((c) => (
              <li key={c.id} className="detail-comment">
                <span className="detail-comment__avatar" aria-hidden>
                  N
                </span>
                <div className="detail-comment__body">
                  <div className="detail-comment__top">
                    <span className="detail-comment__by">Neighbour</span>
                    <span className="detail-comment__when">{ago(c.createdAt, now)}</span>
                  </div>
                  <p className="detail-comment__text">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="detail-comments__composer" onSubmit={submit}>
          <Field
            className="detail-comments__field"
            placeholder="Add what you saw"
            aria-label="Add what you saw"
            aria-describedby={left <= 40 && state === 'idle' ? leftId : undefined}
            value={text}
            maxLength={COMMENT_MAX}
            onChange={(e) => {
              setText(e.target.value)
              if (state !== 'sending') setState('idle')
            }}
          />
          <ShellButton type="submit" icon="ic-send" label="Send" variant="accent" disabled={!trimmed || state === 'sending'} />
        </form>
        {left <= 40 && state === 'idle' && (
          <p className="detail-comments__note" id={leftId}>
            {left} characters left
          </p>
        )}
        {/* One live region, always rendered, so "Thanks..." and the failure line are read out when they appear (WCAG 4.1.3). */}
        <p className="detail-comments__note" role="status">
          {state === 'sent' ? 'Thanks. It shows here once it has been checked.' : state === 'failed' ? 'That did not send. Try again.' : ''}
        </p>
      </section>
    </Card>
  )
}
