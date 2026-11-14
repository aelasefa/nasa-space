// Plain-language explanations of the game's terms. Wording follows GAME_RULES.md;
// every number here is an illustrative game value, not real mission data.
export const glossary = {
  mpi: {
    term: 'Mission Performance Index (MPI)',
    short: 'Your score out of 1,000.',
    long: 'Your score out of 1,000. It rewards science returned, efficient use of budget and mass, reliability, good engineering and sensible operations. It ranks how well you did; it does not decide whether the mission succeeded.',
  },
  outcome: {
    term: 'Outcome',
    short: 'Whether the mission met its goal.',
    long: 'Success means at least 80 of 100 science points reached Earth. Partial success means some science came back, but fewer than 80 points. Failure means none came back.',
  },
  cap: {
    term: 'Outcome cap',
    short: 'The highest score your outcome allows.',
    long: 'A partial success can score at most 749 and a failure at most 249, however well the rest went. Only a successful mission can reach 1,000.',
  },
  science: {
    term: 'Science points',
    short: 'How much useful ice data you got, from 0 to 100.',
    long: 'A game measure of useful water-ice data, from 0 to 100. Points are first collected by the instrument, then sent to Earth. Only points that reach Earth count.',
  },
  bu: {
    term: 'Budget units (BU)',
    short: 'The game’s money. You have 120.',
    long: 'A made-up budget currency. Every part costs some BU, and the whole spacecraft must fit within 120 BU.',
  },
  mass: {
    term: 'Launch mass',
    short: 'How heavy the spacecraft is. The limit is 500 kg.',
    long: 'The total weight of the spacecraft, including a 120 kg base frame. The rocket can lift at most 500 kg.',
  },
  watts: {
    term: 'Power (W)',
    short: 'How much electricity is used or made at one moment.',
    long: 'Watts measure power right now: what the solar panels make in sunlight, or what an instrument draws while it runs.',
  },
  battery: {
    term: 'Usable battery (Wh)',
    short: 'Stored energy for when there is no sunlight.',
    long: 'Watt-hours measure stored energy. In the Moon’s shadow the solar panels make nothing, so the spacecraft runs on its battery. A bigger battery lets the instrument keep observing in the dark.',
  },
  margin: {
    term: 'Power margin',
    short: 'Spare power left over. Below zero is not allowed.',
    long: 'Solar power made minus power needed. A positive margin means there is power to spare; a negative one means the design cannot run that activity.',
  },
  deltaV: {
    term: 'Delta-v',
    short: 'How much the spacecraft can change its speed, a measure of fuel.',
    long: 'Delta-v (change in velocity, in m/s) is the steering and braking budget. Your propulsion must provide at least what the chosen route needs. The leftover is your maneuver reserve.',
  },
  payload: {
    term: 'Payload',
    short: 'The science instrument the spacecraft carries.',
    long: 'The instrument that does the science. Only the ice-sensitive spectrometer can look for water ice, which is this mission’s goal.',
  },
  trajectory: {
    term: 'Trajectory',
    short: 'The route from Earth to the Moon.',
    long: 'The direct route is faster but needs more delta-v. The efficient route takes longer and needs less. Both arrive at the same observation opportunity.',
  },
  downlink: {
    term: 'Downlink',
    short: 'Sending data from the spacecraft back to Earth.',
    long: 'Radio transmission from the spacecraft to Earth. The antenna limits how many science points can be sent: 60 with the basic antenna, 100 with the high-throughput one.',
  },
  baseline: {
    term: 'Baseline',
    short: 'A saved earlier design you compare against.',
    long: 'A snapshot of a design you saved. Engineers compare at least two options before choosing one, so the review needs a saved baseline and a current design that differs from it.',
  },
  tradeStudy: {
    term: 'Trade study',
    short: 'Comparing two designs and saying why you picked one.',
    long: 'A side-by-side comparison of two designs. You pick the reason your current design is better (science, mass, cost or risk) and record it.',
  },
  cml: {
    term: 'CML review gates',
    short: 'Four checkpoints your design must pass before launch.',
    long: 'Inspired by NASA’s Concept Maturity Levels, simplified for this game. 1 Charter: the instrument matches the goal. 2 Feasibility: nothing breaks a limit. 3 Trade study: you compared two designs. 4 Point design: you accepted every warning. These are game proxies, not real NASA approvals.',
  },
  warning: {
    term: 'Warnings and blockers',
    short: 'Blockers stop launch; warnings are risks you can accept.',
    long: 'A blocker (red) means the design breaks a hard limit and cannot launch until you change it. A warning (yellow) is a risk you are allowed to accept in the review.',
  },
  universe: {
    term: 'Alternate universe',
    short: 'A replay of your mission with one decision changed.',
    long: 'A copy of a finished mission where you change exactly one choice and the same model reruns it, so you can see what that single decision did.',
  },
} as const

export type TermId = keyof typeof glossary
