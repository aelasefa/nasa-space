export interface CoachStep { label: string; done: boolean; hint: string }

/** A short checklist that always names the single next thing to do. */
export function Coach({ title, steps, ready }: { title: string; steps: CoachStep[]; ready: string }) {
  const next = steps.find(step => !step.done)
  const done = steps.filter(step => step.done).length
  return <section className="panel coach" aria-label={title}>
    <div className="coach-head">
      <p className="eyebrow">{title} · {done} of {steps.length} done</p>
      <p className="coach-next" role="status"><strong>{next ? 'Next:' : 'Ready:'}</strong> {next ? next.hint : ready}</p>
    </div>
    <ol className="coach-steps">{steps.map(step => <li key={step.label} data-done={step.done || undefined}
      aria-current={step === next ? 'step' : undefined}>
      <span aria-hidden="true">{step.done ? '✓' : ''}</span>{step.label}<span className="sr-only">{step.done ? ' (done)' : ''}</span>
    </li>)}</ol>
  </section>
}
