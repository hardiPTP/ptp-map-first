// PTP design primitives, built from tokens.css only. Specs: docs/figma/SPEC.md.
// Frozen API after Phase 0: agents use these, they do not restyle them.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import './primitives.css'

const iconUrls = import.meta.glob('./icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

/** File name without extension, e.g. "ic-whatsapp", "verified", "ptp-mark-white". */
export type IconName = string

export function iconUrl(name: IconName): string {
  const url = iconUrls[`./icons/${name}.svg`]
  if (!url) throw new Error(`Unknown icon: ${name}`)
  return url
}

/**
 * Icon. tint=true (default) recolours the glyph to currentColor via CSS mask, which is how the
 * Figma set is meant to be used ("recoloured by stroke"); the SVG file is never edited.
 * tint=false renders the file as drawn (for glyphs with their slot colour baked in).
 */
export function Icon({ name, size = 20, tint = true, style }: { name: IconName; size?: number; tint?: boolean; style?: CSSProperties }) {
  const url = iconUrl(name)
  // Vite inlines small SVGs as data: URIs; quote them for CSS url().
  const cssUrl = `url("${url.replace(/"/g, '%22')}")`
  if (!tint) return <img className="ptp-icon" src={url} width={size} height={size} alt="" aria-hidden style={style} />
  return (
    <span
      className="ptp-icon"
      aria-hidden
      style={{ width: size, height: size, WebkitMaskImage: cssUrl, maskImage: cssUrl, ...style }}
    />
  )
}

type ButtonStyle = 'primary' | 'quiet' | 'soft'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonStyle
  size?: 'default' | 'big'
  icon?: IconName
  /** Stretch to the container width (Figma: big "is set to fill by the consumer"). */
  fill?: boolean
  /** Toggle state. Pressed = same fill pushed inward (Figma button "pressed"). */
  pressed?: boolean
}

/** Figma "button" (3647:3721): pill, raised by default, pushed inward on press. One primary per screen. */
export function Button({ variant = 'quiet', size = 'default', icon, fill, pressed, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={pressed}
      className={['ptp-btn', `ptp-btn--${variant}`, `ptp-btn--${size}`, fill && 'ptp-btn--fill', pressed && 'is-pressed', className]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <Icon name={icon} size={size === 'big' ? 19 : 18} />}
      {children != null && <span className="ptp-btn__label">{children}</span>}
    </button>
  )
}

/** Figma "shell/icon" (3539:2970): circular icon-only button, 44px default. */
export function ShellButton({
  icon,
  label,
  size = 44,
  variant = 'raised',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: 44 | 46 | 48; variant?: 'raised' | 'quiet' | 'accent' }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      className={['ptp-shell', `ptp-shell--${variant}`, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, ...rest.style }}
    >
      <Icon name={icon} size={size >= 48 ? 22 : 20} />
    </button>
  )
}

/**
 * Map chip (Figma map · resting, "mapfilters"): label plus a count badge. One may be selected at a time;
 * none selected means everything shows. Pressing the selected chip again clears it, so it is a toggle.
 */
export function Chip({
  selected,
  count,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; count?: number }) {
  return (
    <button
      type="button"
      // In a radiogroup (create flow day chips) a chip is a radio; elsewhere it is a toggle.
      {...(rest.role === 'radio' ? { 'aria-checked': !!selected } : { 'aria-pressed': !!selected })}
      {...rest}
      className={['ptp-chip', selected && 'is-selected', className].filter(Boolean).join(' ')}
    >
      {children}
      {count != null && <span className="ptp-chip__count">{count}</span>}
    </button>
  )
}

/** Card shell: Figma card/update + card/event shell. Paper-glass, radius card, raise pair, 14 pad. */
export function Card({
  children,
  edge,
  as: As = 'article',
  className,
  ...rest
}: {
  children: ReactNode
  /** "ptp" = accent orange edge for Push The Pin posts (PRD "Who posted it"). */
  edge?: 'ptp'
  as?: 'article' | 'div' | 'li'
  className?: string
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As {...rest} className={['ptp-card', edge === 'ptp' && 'ptp-card--ptp', className].filter(Boolean).join(' ')}>
      {children}
    </As>
  )
}

/**
 * Map tag: one symbol plus a short value ("12d", "+5", "in 40m"). No sentences (PRD "Map tags").
 * `symbol` is either an icon name or a custom node (e.g. the civic ring timer).
 */
export function Tag({ symbol, value, tone = 'ink' }: { symbol: IconName | ReactNode; value: string; tone?: 'ink' | 'orange' }) {
  return (
    <span className={`ptp-tag ptp-tag--${tone}`}>
      {typeof symbol === 'string' ? <Icon name={symbol} size={14} /> : symbol}
      <span className="ptp-tag__value">{value}</span>
    </span>
  )
}

/** Poster label: Neighbour. Figma "source" chip, neighbour state (ink 25% dot). Never a person's name. */
export function NeighbourLabel({ style = 'chip' }: { style?: 'chip' | 'line' }) {
  return (
    <span className={`ptp-source ptp-source--${style}`}>
      <Icon name="source-dot-ink25" size={6} tint={false} />
      Neighbour
    </span>
  )
}

/** Poster label: Place. Place name, verified mark, its Google photo as a small avatar. */
export function PlaceLabel({ name, photoUri }: { name: string; photoUri?: string | null }) {
  return (
    <span className="ptp-poster">
      {photoUri ? (
        <img className="ptp-poster__avatar" src={photoUri} alt="" width={24} height={24} referrerPolicy="no-referrer" />
      ) : (
        // No Google photo for this place: its initial, so the avatar is never a blank circle.
        <span className="ptp-poster__avatar ptp-poster__avatar--initial" aria-hidden>
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="ptp-poster__name">{name}</span>
      <Icon name="verified" size={17} tint={false} />
      <span className="sr-only">verified place</span>
    </span>
  )
}

/** PTP mark: white pin on an orange disc (Figma "logo" 4350:5532). */
export function PtpMark({ size = 20 }: { size?: number }) {
  return (
    <span className="ptp-mark" style={{ width: size, height: size }} aria-hidden>
      <Icon name="ptp-mark-white" size={Math.round(size * 0.62)} tint={false} />
    </span>
  )
}

/** Poster label: Push The Pin. PTP mark and "Push The Pin"; pair with <Card edge="ptp">. */
export function PtpLabel() {
  return (
    <span className="ptp-poster">
      <PtpMark size={20} />
      <span className="ptp-poster__name">Push The Pin</span>
    </span>
  )
}

/** Sheet surface (Figma "sheet" 3539:2980): paper-glass, top corners 34, grabber. */
export function SheetSurface({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={['ptp-sheet', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

/** Grabber bar. Rendered inside a 44px tall button by the sheet so it is tappable. */
export function Grabber() {
  return <span className="ptp-grabber" aria-hidden />
}

/** Figma "field/well" (3531:2830): placeholder is real copy, focus takes the accent. */
export function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={['ptp-field', props.className].filter(Boolean).join(' ')} />
}

/** Figma "snack" (3539:2976): ink, never orange. */
export function Snack({ children }: { children: ReactNode }) {
  return (
    <div className="ptp-snack" role="status">
      <Icon name="snack-check" size={18} tint={false} />
      <span>{children}</span>
    </div>
  )
}
