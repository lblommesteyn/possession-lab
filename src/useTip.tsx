import { useCallback, useRef, useState, type ReactNode } from 'react'

/** A pointer-following tooltip positioned inside a relative container. */
export function useTip() {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null)
  const show = useCallback((e: React.PointerEvent | React.MouseEvent, content: ReactNode) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  const node = tip ? (
    <div className="tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>
  ) : null
  return { box, show, hide, node }
}
