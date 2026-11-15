import { afterEach } from 'vitest'

// The hub, the solo Orbiter and the crew Orbiter share one page and keep their place in
// the URL hash. Every test starts at the hub, as a first visit does.
afterEach(() => {
  if (typeof window !== 'undefined' && window.location.hash) window.history.replaceState(null, '', window.location.pathname)
})
