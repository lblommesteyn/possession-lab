import type { ReactNode } from 'react'
import { lastName } from './data'

/** Half-court in feet: x from midcourt (0) to baseline (47), y across (-25..25). Drawn with the rim at the top. */
export const COURT_W = 50, COURT_H = 47
export const sx = (y: number) => y + 25
export const sy = (x: number) => 47 - x

export function CourtLines({ hoopX = 41.75 }: { hoopX?: number }) {
  const hy = sy(hoopX)
  const arcR = 23.75, cornerY = 22
  const meet = Math.sqrt(arcR * arcR - cornerY * cornerY) // feet from rim center (along x) where the arc meets the corner lines
  const arcY = hy + meet
  return (
    <g className="court-lines">
      <rect x={0} y={0} width={COURT_W} height={COURT_H} />
      <rect x={sx(-8)} y={0} width={16} height={19} />
      <circle cx={sx(0)} cy={19} r={6} />
      <path d={`M ${sx(-cornerY)} 0 V ${arcY} A ${arcR} ${arcR} 0 0 0 ${sx(cornerY)} ${arcY} V 0`} />
      <path d={`M ${sx(-4)} ${hy} A 4 4 0 0 0 ${sx(4)} ${hy}`} />
      <line x1={sx(-3)} x2={sx(3)} y1={sy(43)} y2={sy(43)} className="board" />
      <circle cx={sx(0)} cy={hy} r={0.75} className="rim" />
      <path d={`M ${sx(-6)} ${COURT_H} A 6 6 0 0 1 ${sx(6)} ${COURT_H}`} />
    </g>
  )
}

interface Props {
  frame: number[]            // interpolated frame [x1,y1,...,ballx,bally]
  trail?: number[][]         // recent frames for path tails
  holder: number
  names: string[]
  mirrored?: boolean
  labels?: boolean
  hoopX?: number
  children?: ReactNode
  small?: boolean
}

/** Players and ball at one moment. Offense: filled, first categorical hue. Defense: second hue. Ball: neutral. */
export function Court({ frame, trail, holder, names, mirrored, labels = true, hoopX, children, small }: Props) {
  const Y = (y: number) => sx(mirrored ? -y : y)
  const r = small ? 1.5 : 1.15
  return (
    <svg viewBox={`-1 -1 ${COURT_W + 2} ${COURT_H + 2}`} className={small ? 'court court-sm' : 'court'} role="img"
      aria-label="Half-court with player positions">
      <CourtLines hoopX={hoopX} />
      {trail && trail.length > 1 && Array.from({ length: 11 }, (_, p) => (
        <polyline key={`t${p}`} className={p < 5 ? 'trail off' : p < 10 ? 'trail def' : 'trail ball'}
          points={trail.map(f => `${Y(f[2 * p + 1])},${sy(f[2 * p])}`).join(' ')} />
      ))}
      {Array.from({ length: 10 }, (_, p) => {
        const cx = Y(frame[2 * p + 1]), cy = sy(frame[2 * p])
        return (
          <g key={p}>
            {p === holder && <circle cx={cx} cy={cy} r={r + 0.9} className="holder-ring" />}
            <circle cx={cx} cy={cy} r={r} className={p < 5 ? 'pl off' : 'pl def'} />
            {labels && !small && (
              <text x={cx} y={p < 5 ? cy - r - 0.7 : cy + r + 1.7} textAnchor="middle" className={p < 5 ? 'pl-label' : 'pl-label def'}>{lastName(names[p])}</text>
            )}
          </g>
        )
      })}
      <circle cx={Y(frame[21])} cy={sy(frame[20])} r={small ? 0.9 : 0.65} className="ball" />
      {children}
    </svg>
  )
}

/** Linear interpolation between 5 Hz frames for smooth playback. */
export function frameAt(f: number[][], t: number): number[] {
  const i = Math.max(0, Math.min(f.length - 1, Math.floor(t)))
  const j = Math.min(f.length - 1, i + 1), a = Math.min(1, Math.max(0, t - i))
  return f[i].map((v, k) => v + (f[j][k] - v) * a)
}
