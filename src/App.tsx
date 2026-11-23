import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchField } from '@/components/arc/search-field/search-field'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Switch } from '@/components/arc/switch/switch'
import { Select } from '@/components/arc/select/select'
import type { Index, Possession } from './data'
import { loadIndex, loadPossession, fmtClock, fmtDate, FPS, outcomeText, COVERAGE, coverageLabel } from './data'
import { Court, frameAt } from './Court'
import { EpvChart } from './EpvChart'
import { Similar } from './Similar'

type Filter = 'cha-off' | 'cha-def' | 'league'
const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

function initialTheme(): 'light' | 'dark' {
  try { const s = localStorage.getItem('pl-theme'); if (s === 'light' || s === 'dark') return s } catch { /* storage blocked */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1))
  const p = h.get('p'), t = h.get('t')
  return { p: p != null ? Number(p) : null, t: t != null ? Number(t) : 0, m: h.get('m') === '1' }
}

export default function App() {
  const [idx, setIdx] = useState<Index | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('cha-off')
  const [q, setQ] = useState('')
  const [cov, setCov] = useState('any')
  const [shown, setShown] = useState(80)
  const [cur, setCur] = useState<Possession | null>(null)
  const [mirrored, setMirrored] = useState(false)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState('1')
  const [trails, setTrails] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const [back, setBack] = useState<{ id: number; t: number; m: boolean }[]>([])

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('pl-theme', theme) } catch { /* */ } }, [theme])
  useEffect(() => {
    loadIndex().then(ix => {
      setIdx(ix)
      const h = readHash()
      const first = h.p ?? ix.possessions.find(p => p.cha && p.off === 'CHA' && (p.pts ?? 0) > 0 && p.dur > 9)?.id ?? 0
      open(first, h.t, h.m, false)
    }, e => setErr(String(e)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function open(id: number, frame = 0, m = false, push = true) {
    if (push && cur) setBack(b => [...b.slice(-19), { id: cur.id, t: Math.round(t), m: mirrored }])
    loadPossession(id).then(p => {
      setCur(p); setMirrored(m); setT(Math.max(0, Math.min(p.f.length - 1, frame))); setPlaying(frame > 0)
      // single-column layout: the replay sits above the list, so bring it into view after a pick
      if (push && matchMedia('(max-width: 760px)').matches) document.querySelector('.player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, e => setErr(String(e)))
  }

  // playback
  const raf = useRef(0)
  useEffect(() => {
    if (!playing || !cur) return
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now
      setT(v => {
        const nv = v + dt * FPS * Number(speed)
        if (nv >= cur.f.length - 1) { setPlaying(false); return cur.f.length - 1 }
        return nv
      })
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, cur, speed])
  useEffect(() => {
    if (!cur) return
    const id = setTimeout(() => history.replaceState(null, '', `#p=${cur.id}&t=${Math.round(t)}${mirrored ? '&m=1' : ''}`), 300)
    return () => clearTimeout(id)
  }, [cur, t, mirrored])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, [role="combobox"]')) return
      if (e.key === ' ') { e.preventDefault(); setPlaying(v => !v) }
      if (e.key === 'ArrowRight' && cur) setT(v => Math.min(cur.f.length - 1, Math.round(v) + 1))
      if (e.key === 'ArrowLeft') setT(v => Math.max(0, Math.round(v) - 1))
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [cur])

  const list = useMemo(() => {
    if (!idx) return []
    const qq = fold(q.trim())
    return idx.possessions.filter(p =>
      (filter === 'league' ? true : filter === 'cha-off' ? p.off === 'CHA' : p.de === 'CHA') &&
      (cov === 'any' || (cov === 'none' ? !p.pc?.length : cov === 'some' ? !!p.pc?.length : !!p.pc?.includes(cov))) &&
      (qq.length < 2 || p.n.some(n => fold(n).includes(qq)) || fold(p.outcome).includes(qq) || fold(`${p.off} ${p.de}`).includes(qq)))
  }, [idx, filter, q, cov])
  useEffect(() => setShown(80), [filter, q, cov])

  if (err) return <main className="shell"><p className="error">{err}. Reload the page to try again.</p></main>
  if (!idx || !cur) return <main className="shell"><p className="muted">Loading possessions…</p></main>

  const fr = frameAt(cur.f, t)
  const ti = Math.round(t)
  const trail = trails ? cur.f.slice(Math.max(0, ti - 2 * FPS), ti + 1).concat([fr]) : undefined
  const holder = cur.h[ti] ?? -1
  const epvNow = cur.e[ti]
  const m = idx.possessions[cur.id]

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">NBA 2025-26 · player tracking</p>
          <h1>Possession lab</h1>
          <p className="lede">Replay any half-court possession with its expected points second by second, then find the plays around the league that looked most like any moment in it.</p>
        </div>
        <Switch label="Dark" checked={theme === 'dark'} onCheckedChange={v => setTheme(v ? 'dark' : 'light')} />
      </header>

      <div className="lab">
        <aside className="poss-list" aria-label="Possessions">
          <SegmentedControl label="Show" value={filter} onValueChange={v => setFilter(v as Filter)}
            options={[{ value: 'cha-off', label: 'CHA offense' }, { value: 'cha-def', label: 'CHA defense' }, { value: 'league', label: 'All' }]} />
          <SearchField label="Filter" placeholder="Player, team or result" value={q} onValueChange={setQ} />
          <Select label="Ball screen coverage" value={cov} onValueChange={setCov}
            options={[{ value: 'any', label: 'Any possession' }, { value: 'some', label: 'Any ball screen' },
              ...COVERAGE.map(c => ({ value: c.value, label: c.label })), { value: 'none', label: 'No ball screen' }]} />
          <p className="muted small num">{list.length.toLocaleString()} possessions</p>
          <ul>
            {list.slice(0, shown).map(p => (
              <li key={p.id}>
                <button className={p.id === cur.id ? 'poss on' : 'poss'} onClick={() => open(p.id)}>
                  <span className="poss-top"><b>{p.off}</b> <span className="muted">vs</span> <b>{p.de}</b>
                    <span className="muted num poss-when">{fmtDate(p.date)} · {fmtClock(p.clock, p.per)}</span></span>
                  <span className="poss-out">{outcomeText(p.outcome)}</span>
                  {!!p.pc?.length && <span className="poss-tags">{p.pc.map(c => <span key={c} className={c === cov ? 'tag on' : 'tag'}>{coverageLabel(c)}</span>)}</span>}
                  <span className="poss-pts num">{p.pts ?? '–'} pts{p.e0 != null && <span className="muted"> · {p.e0.toFixed(2)} expected at start</span>}</span>
                </button>
              </li>
            ))}
          </ul>
          {list.length > shown && <button className="more" onClick={() => setShown(s => s + 120)}>Show more</button>}
        </aside>

        <section className="player" aria-label="Replay">
          <div className="poss-head">
            <div>
              <h2>{m.off} <span className="muted">vs</span> {m.de}</h2>
              <p className="muted num">{fmtDate(m.date)} · {fmtClock(m.clock, m.per)}{m.margin != null && ` · ${m.off} ${m.margin > 0 ? 'up' : m.margin < 0 ? 'down' : 'tied'}${m.margin ? ` ${Math.abs(m.margin)}` : ''}`} · {outcomeText(m.outcome)} · {m.pts ?? '–'} pts</p>
            </div>
            {back.length > 0 && (
              <button className="ghost-btn" onClick={() => { const b = back[back.length - 1]; setBack(s => s.slice(0, -1)); open(b.id, b.t, b.m, false) }}>← Back</button>
            )}
          </div>
          <div className="court-wrap">
            <Court frame={fr} trail={trail} holder={holder} names={cur.n} mirrored={mirrored} hoopX={idx.hoop_x} />
            <div className="court-key" aria-hidden="true">
              <span><i className="key off" />{m.off} (offense)</span><span><i className="key def" />{m.de}</span><span><i className="key ball" />Ball</span>
              {mirrored && <span className="muted">Mirrored to match the search</span>}
            </div>
            {epvNow != null && <div className="epv-now"><span className="muted">Expected points</span><b className="num">{epvNow.toFixed(2)}</b></div>}
          </div>
          <div className="controls">
            <button className="play" onClick={() => { if (t >= cur.f.length - 1) setT(0); setPlaying(v => !v) }} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <svg viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
                : <svg viewBox="0 0 16 16"><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z" /></svg>}
            </button>
            <input type="range" min={0} max={cur.f.length - 1} step={0.01} value={t} aria-label="Time in possession"
              onChange={e => { setPlaying(false); setT(Number(e.target.value)) }} />
            <span className="num time">{(t / FPS).toFixed(1)}s / {((cur.f.length - 1) / FPS).toFixed(1)}s</span>
            <SegmentedControl label="Speed" value={speed} onValueChange={setSpeed}
              options={[{ value: '0.5', label: '½×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }]} />
            <Switch label="Trails" checked={trails} onCheckedChange={setTrails} />
          </div>
          {!!cur.pr?.length && (
            <div className="screens" aria-label="Ball screens">
              <span className="muted small">Ball screens</span>
              {cur.pr.map(([fr, c, act, hs, ss], i) => {
                const live = t >= fr - 2 && t <= fr + 2 * FPS
                const e0 = cur.e[fr], e2 = cur.e[Math.min(cur.e.length - 1, fr + 2 * FPS)]
                return (
                  <button key={i} className={live ? 'screen on' : 'screen'} title={COVERAGE.find(o => o.value === c)?.help}
                    onClick={() => { setPlaying(false); setT(Math.max(0, fr - FPS)) }}>
                    <b>{coverageLabel(c)}</b>
                    <span className="muted"> · {cur.n[ss]} screen for {cur.n[hs]}, {act === 'stay' ? 'screener holds' : act === 'roll' ? 'rolls' : 'pops'}</span>
                    <span className="num muted"> · {(fr / FPS).toFixed(1)}s{e0 != null && e2 != null && (d => ` · ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} expected pts over 2 s`)(Math.round((e2 - e0) * 100) / 100 || 0)}</span>
                  </button>
                )
              })}
            </div>
          )}
          {idx.epv && <EpvChart p={cur} t={t} onSeek={v => { setPlaying(false); setT(v) }} />}
          <p className="chart-note">Expected points: what an average NBA possession from this exact moment scores, predicted from the last two seconds of movement by all ten players and the ball. Dots mark passes; the biggest swings are labelled. Space plays and pauses, arrow keys step.</p>
        </section>

        <Similar idx={idx} p={cur} t={t} onOpen={(id, f, fl) => open(id, Math.max(0, f - 2 * FPS), fl)} />
      </div>

      <footer className="method">
        <h2>Method</h2>
        <p><b>Data.</b> 5 Hz optical tracking from the 2025-26 season, half-court frames only, with the offense always attacking the rim at the top. The library holds every Charlotte half-court possession of five seconds or more in the archive plus a random sample from the rest of the league.</p>
        <p><b>Expected points.</b> A transformer that reads the last two seconds of all ten players' and the ball's movement (plus shot clock, game clock and score), starting from a movement model pre-trained to redraw hidden players' paths. Trained on possession points with each shot's make-or-miss luck replaced by its expected value. Every possession shown was scored by a model that never saw its game.</p>
        <p><b>Ball screens.</b> A screen is a teammate within 4.5 ft of the ball handler's defender and 8 ft of the handler, standing nearly still while the handler moves, at least 17 ft from the rim. Who guards whom comes from a hidden-Markov assignment model. Coverage is read from the screener's defender over the next 1.6 s: blitz (both defenders on the ball), switch (the defenders trade men), drop (he stays 8 ft or more below the ball and never gets within 7 ft), show (he gets within 7 ft at the level of the screen), soft (in between). These are rules, not hand-checked labels; treat them as a search aid. Detected in 644 games: about 43 per game, roughly half of them drop.</p>
        <p><b>Play search.</b> Each second of every possession is embedded by the pre-trained movement model to shortlist 60 candidates, which are then ranked by actual distance: attackers matched to attackers and defenders to defenders, one to one, to minimise the average gap over the two seconds, plus the ball. Mirror images (same play run on the other side) count.</p>
      </footer>
    </main>
  )
}
