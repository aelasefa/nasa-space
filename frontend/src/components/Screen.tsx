import type { ReactNode, Ref } from 'react'

/*
 * Shared screen furniture. Every phase uses the same header, telemetry readout, radio
 * card and action bar, so the game reads as one console from briefing to debrief.
 */

export function ScreenHeader({ eyebrow, title, lede, aside, headingRef }: {
  eyebrow: string; title: string; lede?: ReactNode; aside?: ReactNode; headingRef?: Ref<HTMLHeadingElement>
}) {
  return <header className="screen-head">
    <div className="screen-head-main">
      <p className="eyebrow"><span className="builder-signal" aria-hidden="true"/>{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </div>
    {aside && <div className="screen-head-aside">{aside}</div>}
  </header>
}

/** The screen's one primary action, pinned to the bottom of the viewport on long screens. */
export function ActionBar({ label, status, children }: { label: string; status?: ReactNode; children: ReactNode }) {
  return <div className="action-bar" role="group" aria-label={label}>
    {status && <p className="action-bar-status">{status}</p>}
    <div className="action-bar-buttons">{children}</div>
  </div>
}

export function Readout({ label, value, unit, tone, hint }: {
  label: ReactNode; value: ReactNode; unit?: string; tone?: 'good' | 'warn' | 'bad'; hint?: ReactNode
}) {
  return <div className="readout" data-tone={tone}>
    <dt>{label}</dt>
    <dd>{value}{unit && <small> {unit}</small>}</dd>
    {hint && <dd className="readout-hint">{hint}</dd>}
  </div>
}

/** A real radio input styled as a card. `children` describe the option and are linked by aria-describedby. */
export function OptionCard({ name, id, checked, onChange, title, tag, tone, disabled, children }: {
  name: string; id: string; checked: boolean; onChange: () => void; title: string
  tag?: ReactNode; tone?: 'warn' | 'bad'; disabled?: boolean; children?: ReactNode
}) {
  const inputId = `${name}-${id}`
  return <div className="option-card" data-selected={checked || undefined} data-tone={tone}>
    <div className="option-card-name">
      <input type="radio" id={inputId} name={name} checked={checked} disabled={disabled}
        aria-describedby={children ? `${inputId}-details` : undefined} onChange={onChange}/>
      <label htmlFor={inputId}>{title}</label>
      {tag}
    </div>
    {children && <div className="option-card-body" id={`${inputId}-details`}>{children}</div>}
  </div>
}
