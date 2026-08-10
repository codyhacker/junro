import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { undo, redo } from './history'

// Undo/redo for the trip document. ⌘Z / Ctrl+Z reverses the last edit;
// ⇧⌘Z / Ctrl+Y redoes. The bar only appears once there's something to undo.
export function UndoBar() {
  const dispatch = useAppDispatch()
  const canUndo = useAppSelector(s => s.history.past.length > 0)
  const canRedo = useAppSelector(s => s.history.future.length > 0)
  const hasTrip = useAppSelector(s => s.trip.active !== null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      // Don't hijack typing in inputs.
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch(undo()) }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); dispatch(redo()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  if (!hasTrip || (!canUndo && !canRedo)) return null

  return (
    <div className="undo-bar">
      <button
        className="undo-btn"
        onClick={() => dispatch(undo())}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (⌘Z)"
      >↶</button>
      <button
        className="undo-btn"
        onClick={() => dispatch(redo())}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (⇧⌘Z)"
      >↷</button>
    </div>
  )
}
