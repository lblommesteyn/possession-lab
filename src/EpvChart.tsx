import { useEffect, useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import type { Possession } from './data'
import { FPS, lastName } from './data'
import { useTip } from './useTip'

export interface Moment { i: number; label: string; d: number }

/** Ball-handler changes and the shot, each with the EPV change across it (1 s before -> 1 s after). */
export function moments(p: Possession): Moment[] {
  const out: Moment[] = []
  const at = (i: number) => {
    for (let k = 0; k < 6; k++) { const v = p.e[Math.min(p.e.length - 1, i + k)] ?? p.e[Math.max(0, i - k)]; if (v != null) return v }
    return null
  }
  let last = -1, lastI = 0
  p.h.forEach((h, i) => {
    if (h < 0 || h > 4 || h === last) return
    if (last >= 0 && i - lastI < 25) {
      const a = at(Math.max(0, i - FPS)), b = at(Math.min(p.e.length - 1, i + FPS))
      if (a != null && b != null) out.push({ i, label: `${lastName(p.n[last])} → ${lastName(p.n[h])}`, d: b - a })
    }
    last = h; lastI = i
  })
  if (p.shot != null && p.shot < p.f.length) {
    out.push({ i: p.shot, label: 'Shot', d: 0 })
  }
  return out
}

interface Props { p: Possession; t: number; onSeek: (t: number) => void }

export function EpvChart({ p, t, onSeek }: Props) {
  const { box, show, hide, node } = useTip()
  // draw at the container's real width so text stays at its CSS size on phones
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el); return () => ro.disconnect()
  }, [box])
  const narrow = W < 520
  const H = narrow ? 150 : 170, M = { l: 34, r: 10, t: 16, b: 26 }
  const n = p.f.length
  const x = scaleLinear().domain([0, n - 1]).range([M.l, W - M.r])
  const vals = p.e.filter((v): v is number => v != null)
  const lo = Math.min(0.6, ...vals), hi = Math.max(1.4, ...vals)
  const y = scaleLinear().domain([lo, hi]).nice(4).range([H - M.b, M.t])
  const path = useMemo(() => line<number | null>().defined(v => v != null).x((_, i) => x(i)).y(v => y(v!)).curve(curveMonotoneX)(p.e) ?? '', [p, x, y])
  const ms = useMemo(() => moments(p), [p])
  const big = [...ms].filter(m => m.label !== 'Shot').sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3)
  const seek = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(n - 1, x.invert(M.l + ((e.clientX - r.left) / r.width) * (W - M.l - M.r)))))
  }
  if (!vals.length) return <p className="chart-note">No EPV for this possession.</p>
  const cur = p.e[Math.round(t)]
  return (
    <div className="chart epv" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Expected points of the possession over time" onPointerLeave={hide}>
        {y.ticks(4).map(v => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={M.l - 8} y={y(v)} dy="0.35em" textAnchor="end" className="axis-label sm">{v.toFixed(1)}</text>
          </g>
        ))}
        {Array.from({ length: Math.floor((n - 1) / FPS / (narrow ? 4 : 2)) + 1 }, (_, k) => k * (narrow ? 4 : 2) * FPS).map(i => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="axis-label sm">{i / FPS}s</text>
        ))}
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="transparent" style={{ cursor: 'pointer' }}
          onPointerDown={seek} onPointerMove={e => { if (e.buttons) seek(e) }} />
        {p.shot != null && p.shot < n && <line x1={x(p.shot)} x2={x(p.shot)} y1={M.t} y2={H - M.b} className="shot-line" />}
        <path d={path} className="epv-line" />
        {ms.filter(m => m.label !== 'Shot').map(m => {
          const v = p.e[m.i] ?? null
          return v == null ? null : (
            <circle key={m.i} cx={x(m.i)} cy={y(v)} r={big.includes(m) ? 5 : 3.5} className={m.d >= 0 ? 'mk up' : 'mk down'}
              onPointerMove={e => show(e, <><b>{m.label}</b><span>{m.d >= 0 ? '+' : ''}{m.d.toFixed(2)} expected points across the pass</span></>)} />
          )
        })}
        {big.map(m => {
          const v = p.e[m.i]
          return v == null ? null : (
            <text key={`l${m.i}`} x={x(m.i)} y={y(v) + (m.d >= 0 ? -10 : 18)} textAnchor="middle" className="mk-label">
              {m.d >= 0 ? '+' : ''}{m.d.toFixed(2)}
            </text>
          )
        })}
        <line x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} className="playhead" pointerEvents="none" />
        {cur != null && <circle cx={x(t)} cy={y(cur)} r={4.5} className="playhead-dot" pointerEvents="none" />}
      </svg>
      {node}
    </div>
  )
}
