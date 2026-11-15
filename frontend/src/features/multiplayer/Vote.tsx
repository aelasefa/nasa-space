import { useEffect, useState } from 'react'
import type { PublicRoom } from '../../../../backend/src/multiplayer/contracts'
import { label } from '../../app/options'
import type { DownlinkAction, ObserveAction } from '../../app/contracts'
import { ActionBar, OptionCard, ScreenHeader } from '../../components/Screen'
import type { MultiplayerClient } from '../../app/multiplayer/client'

function secondsLeft(deadlineAt: string) {
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.now()) / 1000))
}

/** Team vote for observe / downlink — server resolves ties. */
export function VotePanel({ client, room }: { client: MultiplayerClient; room: PublicRoom }) {
  const vote = room.vote
  const [, tick] = useState(0)
  useEffect(() => {
    if (!vote) return
    const id = window.setInterval(() => tick(n => n + 1), 500)
    return () => window.clearInterval(id)
  }, [vote])

  if (!vote) return null
  const remaining = secondsLeft(vote.deadlineAt)
  const myId = client.playerId
  const myChoice = Object.entries(vote.tallies).find(([, ids]) => myId && ids.includes(myId))?.[0]
  const title = vote.kind === 'observe' ? 'Shadow-pass vote' : 'Downlink vote'
  const lede = vote.kind === 'observe'
    ? 'Keep the sensor running through the dark, or conserve battery?'
    : 'Prioritize science packets, or spacecraft health telemetry?'

  return <section className="panel" aria-labelledby="vote-title">
    <ScreenHeader eyebrow="Mission Control · Crew vote" title={title} lede={lede}
      aside={<p className="tag">{remaining}s left</p>}/>
    <p className="fine">Tie rule: {vote.tieRule}. Everyone’s connected vote counts; the server clocks the deadline.</p>
    <fieldset className="option-group option-row">
      <legend className="sr-only">{title}</legend>
      {vote.options.map(opt => {
        const tally = vote.tallies[opt]?.length ?? 0
        return <OptionCard key={opt} name={`vote-${vote.kind}`} id={opt}
          title={vote.kind === 'observe' ? label('observeAction', opt) : label('downlinkAction', opt)}
          checked={myChoice === opt}
          tag={`${tally} vote${tally === 1 ? '' : 's'}`}
          onChange={() => client.send({
            type: 'cast_vote',
            kind: vote.kind,
            choice: opt as ObserveAction | DownlinkAction,
            baseRevision: room.revision,
          })}/>
      })}
    </fieldset>
    <ActionBar label="Voting" status={myChoice ? `You voted · ${remaining}s remaining` : `Choose now · ${remaining}s remaining`}>
      <span className="fine">Votes sync live for the whole crew.</span>
    </ActionBar>
  </section>
}
