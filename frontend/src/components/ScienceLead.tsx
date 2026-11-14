import type { ReactNode } from 'react'
import { scienceLead } from '../app/story'

/** The mission's one recurring voice. */
export function ScienceLead({ children }: { children: ReactNode }) {
  return <figure className="lead">
    <span className="lead-avatar" aria-hidden="true">{scienceLead.initials}</span>
    <div>
      <blockquote>{children}</blockquote>
      <figcaption>{scienceLead.name} · {scienceLead.role}</figcaption>
    </div>
  </figure>
}
