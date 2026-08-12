import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { toggleUiMode } from '../map/styleSlice'

// Floating dark/light toggle — Junro's only appearance control
// (one theme, two modes; PROJECT_PLAN.md §2 principle 2).
export function ModeToggle() {
  const dispatch = useAppDispatch()
  const mode = useAppSelector((s) => s.mapStyle.uiMode)

  return (
    <button
      className="mode-toggle"
      onClick={() => dispatch(toggleUiMode())}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {mode === 'dark' ? '☀' : '☾'}
    </button>
  )
}
