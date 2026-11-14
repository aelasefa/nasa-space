import { luna01 } from '../missions/luna01'
import { Transmission } from './Radio'

/** The science lead's recurring voice (Dr. Chen), as a Mission Control radio caption. */
export function ScienceLead({ children }: { children: string }) {
  return <Transmission from={luna01.crew.chen}>{children}</Transmission>
}
