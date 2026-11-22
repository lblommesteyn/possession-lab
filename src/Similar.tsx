import { useEffect, useState } from 'react'
import type { Index, Possession } from './data'
import { loadPossession, fmtDate, FPS, outcomeText } from './data'
import { Court } from './Court'

interface Props {
  idx: Index
  p: Possession
  t: number
  onOpen: (id: number, frame: number, mirrored: boolean) => void
}

/** The search window nearest the playhead (windows end every 1 s, each covers the previous 2 s). */
function windowAt(p: Possession, t: number): number | null {
  const ks = Object.keys(p.w).map(Number)
  if (!ks.length) return null
  return ks.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a))
}

export function Similar({ idx, p, t, onOpen }: Props) {
  const wk = windowAt(p, t)
  // one moment per possession (its closest), so a single play can't fill the list
  const hits = wk == null ? [] : p.w[String(wk)].filter(([id], i, a) => a.findIndex(h => h[0] === id) === i)
  const [loaded, setLoaded] = useState<Record<number, Possession>>({})
  useEffect(() => {
    let live = true
    hits.forEach(([id]) => { if (!loaded[id]) loadPossession(id).then(q => { if (live) setLoaded(s => ({ ...s, [id]: q })) }, () => {}) })
    return () => { live = false }
  }, [hits]) // eslint-disable-line react-hooks/exhaustive-deps
  if (wk == null) return <aside className="panel"><p className="muted">This possession is too short for play search.</p></aside>
  const meta = (id: number) => idx.possessions[id]
  const pts = hits.map(([id]) => meta(id)?.pts).filter((v): v is number => v != null)
  const avg = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null
  return (
    <aside className="panel similar" aria-label="Similar moments">
      <div>
        <p className="eyebrow">Plays like this</p>
        <p className="panel-sub">The closest 2-second moments to {(Math.max(0, wk - 9) / FPS).toFixed(0)}–{(wk / FPS).toFixed(0)}s, from other possessions.
          {avg != null && <> They scored <b className="num">{avg.toFixed(2)}</b> points on average.</>}</p>
      </div>
      <ol className="hits">
        {hits.map(([id, fr, dist, fl]) => {
          const m = meta(id), q = loaded[id]
          return (
            <li key={`${id}-${fr}`}>
              <button className="hit" onClick={() => onOpen(id, fr, fl === 1)}>
                <span className="hit-court">
                  {q ? <Court frame={q.f[Math.min(fr, q.f.length - 1)]} holder={q.h[fr] ?? -1} names={q.n} mirrored={fl === 1} small hoopX={idx.hoop_x}
                    trail={q.f.slice(Math.max(0, fr - 9), fr + 1)} /> : <span className="hit-ph" />}
                </span>
                <span className="hit-text">
                  <b>{m.off} vs {m.de}</b> <span className="muted">{fmtDate(m.date)}</span>
                  <span className="hit-out">{outcomeText(m.outcome)}</span>
                  <span className="muted num">{dist.toFixed(1)} ft · {m.pts ?? '–'} pts{fl ? ' · mirrored' : ''}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="panel-foot">Ranked by how far apart the ten players and the ball are over the two seconds, after matching each attacker and defender to their closest counterpart. Mirror images count as matches.</p>
    </aside>
  )
}
