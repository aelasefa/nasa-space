import type { MouseEvent, ReactNode } from 'react'

/*
 * Navigation shared by all three experiences. The hub is always one click away, in the
 * same place: the first control of the top bar.
 */

/** "Back to mission hub". A real link, so it also works with the keyboard, a middle click and a reload. */
export function HubLink({ href, onNavigate }: { href: string; onNavigate?: () => void }) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    onNavigate()
  }
  return <a className="hub-link" href={href} onClick={click} aria-label="Back to mission hub">
    <span aria-hidden="true">‹</span><span><span className="hub-link-back">Back to </span>mission hub</span>
  </a>
}

/** Top bar of the Rover and the Academy: where you are, the way back, and that page's own controls. */
export function ExperienceBar({ name, hubHref, children }: { name: string; hubHref: string; children?: ReactNode }) {
  return <header className="xp-bar">
    <HubLink href={hubHref}/>
    <p className="xp-name"><span className="wordmark xp-brand"><span aria-hidden="true">◒</span> Amanar</span> <strong>{name}</strong></p>
    {children && <div className="xp-bar-actions">{children}</div>}
  </header>
}
