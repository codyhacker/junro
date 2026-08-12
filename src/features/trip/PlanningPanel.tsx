import { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setActiveTab, type PanelTab } from '../shell/uiSlice'
import { useIsMobile, useViewportHeight } from '../../shared/hooks/useIsMobile'
import { PlacesTab } from './PlacesTab'
import { PlanTab } from './PlanTab'
import { TripTab } from './TripTab'

// The planning surface — a tabbed panel (UX_PLAN round 2). Places is the home
// (collect); Trip is config (dates, hotels, export); Plan is opt-in (organize
// into days). Order follows the flow: collect → set up → plan. Starts on Places
// so the app opens simple, and planning is never forced.
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'places', label: 'Places' },
  { id: 'trip', label: 'Trip' },
  { id: 'plan', label: 'Plan' },
]

// On mobile the panel is a draggable bottom sheet: drag the grip to resize
// (snaps to the nearest stop on release) or tap it to cycle, so the map can
// reclaim space on demand. Heights are pixels — px→px transitions animate,
// whereas dvh→dvh ones freeze in Chromium under a flex/`display:contents` chain.
type Snap = 'peek' | 'half' | 'full'
const SNAP_ORDER: Snap[] = ['peek', 'half', 'full']
const PEEK_PX = 148

export function PlanningPanel() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const active = useAppSelector(s => s.ui.activeTab)
  const selectedPlaceId = useAppSelector(s => s.tripInteraction.selectedPlaceId)
  const isMobile = useIsMobile()
  const vh = useViewportHeight()
  const [collapsed, setCollapsed] = useState(false)

  const [snap, setSnap] = useState<Snap>('half')
  const [dragH, setDragH] = useState<number | null>(null)
  const drag = useRef<{ startY: number; moved: boolean } | null>(null)
  const sheetRef = useRef<HTMLElement>(null)

  const snapPx: Record<Snap, number> = {
    peek: PEEK_PX,
    half: Math.round(vh * 0.52),
    full: Math.round(vh * 0.88),
  }

  if (!trip) return null
  // Mobile: while a place is selected its sheet takes the stage. Hide (not
  // unmount) the drawer so its snap + scroll survive the round-trip.
  const hidden = isMobile && !!selectedPlaceId

  const cycle = () => setSnap(s => SNAP_ORDER[(SNAP_ORDER.indexOf(s) + 1) % SNAP_ORDER.length])

  function onGripDown(e: React.PointerEvent) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no active pointer */ }
    drag.current = { startY: e.clientY, moved: false }
  }
  function onGripMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const dy = d.startY - e.clientY
    if (Math.abs(dy) > 4) d.moved = true
    const base = sheetRef.current?.getBoundingClientRect().height ?? snapPx[snap]
    setDragH(Math.min(snapPx.full, Math.max(snapPx.peek, base + dy)))
    d.startY = e.clientY
  }
  function onGripUp(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    if (!d.moved) { setDragH(null); cycle(); return }
    const current = sheetRef.current?.getBoundingClientRect().height ?? snapPx[snap]
    const nearest = SNAP_ORDER.reduce((a, b) =>
      Math.abs(snapPx[b] - current) < Math.abs(snapPx[a] - current) ? b : a)
    setSnap(nearest)
    setDragH(null)
  }

  // Mobile drives height in px (so it animates); desktop leaves it to the flex
  // column. During a drag the live height wins.
  const height = isMobile ? (dragH ?? snapPx[snap]) : null
  const style = height != null ? { height: `${height}px` } : undefined

  return (
    <aside
      ref={sheetRef}
      className={`scrapbook${collapsed ? ' collapsed' : ''}${dragH != null ? ' dragging' : ''}${hidden ? ' sheet-hidden' : ''}`}
      style={style}
    >
      <div
        className="sheet-grip"
        role="separator"
        aria-label="Drag to resize, tap to cycle"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
      />

      <div className="scrapbook-head">
        <div className="scrapbook-head-row">
          <button
            className="scrapbook-collapse"
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(c => !c)}
          >{collapsed ? '▸' : '▾'}</button>
          <span className="scrapbook-title">{trip.name}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="panel-tabs" role="tablist">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={active === t.id}
                className={`panel-tab${active === t.id ? ' active' : ''}`}
                onClick={() => dispatch(setActiveTab(t.id))}
              >{t.label}</button>
            ))}
          </div>

          <div className="scrapbook-body">
            {active === 'places' && <PlacesTab />}
            {active === 'trip' && <TripTab />}
            {active === 'plan' && <PlanTab />}
          </div>
        </>
      )}
    </aside>
  )
}
