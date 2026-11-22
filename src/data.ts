export interface PossMeta {
  id: number
  g: string
  date: string
  off: string
  de: string
  cha: boolean
  per: number
  /** game clock (seconds left in period) at the first half-court frame */
  clock: number | null
  /** offense score minus defense score */
  margin: number | null
  pts: number | null
  outcome: string
  /** short names: 5 attackers then 5 defenders */
  n: string[]
  dur: number
  /** EPV at the first half-court frame */
  e0: number | null
  ns: number
}

export interface Possession extends Omit<PossMeta, 'e0' | 'ns'> {
  /** 5 Hz frames: [x1, y1, ... x10, y10, ballx, bally]; offense attacks +x, rim at (hoop_x, 0) */
  f: number[][]
  /** ball holder per frame: 0-9 (index into n) or -1 */
  h: number[]
  /** EPV per frame (null where the model had no 2 s window) */
  e: (number | null)[]
  /** frame index of the shot release, if any */
  shot: number | null
  /** play search: window end frame -> [possession id, frame, avg feet apart, mirrored 0/1] x 8 */
  w: Record<string, [number, number, number, number][]>
}

export interface Index { possessions: PossMeta[]; hoop_x: number; epv: boolean }

const base = import.meta.env.BASE_URL
export async function loadIndex(): Promise<Index> {
  const r = await fetch(`${base}data/index.json`)
  if (!r.ok) throw new Error(`Could not load the possession index (${r.status})`)
  return r.json()
}

const cache = new Map<number, Promise<Possession>>()
export function loadPossession(id: number): Promise<Possession> {
  if (!cache.has(id)) {
    cache.set(id, fetch(`${base}data/p/${id}.json`).then(r => {
      if (!r.ok) throw new Error(`Could not load possession ${id}`)
      return r.json()
    }))
  }
  return cache.get(id)!
}

export const FPS = 5

/** builder wording -> display wording */
export function outcomeText(o: string): string {
  return o.startsWith('No shot') ? 'No shot recorded' : o
}

export function fmtClock(sec: number | null, per: number): string {
  const q = per > 4 ? `OT${per - 4}` : `Q${per}`
  if (sec == null) return q
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60)
  return `${q} ${m}:${String(s).padStart(2, '0')}`
}

export function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function lastName(n: string): string {
  const p = n.split(' ')
  return p.length > 1 ? p.slice(1).join(' ') : n
}
