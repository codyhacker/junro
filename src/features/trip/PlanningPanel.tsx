import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setActiveTab, type PanelTab } from '../shell/uiSlice'
import { PlacesTab } from './PlacesTab'
import { PlanTab } from './PlanTab'
import { TripTab } from './TripTab'

// The planning surface — a tabbed panel (UX_PLAN round 2). Places is the home
// (collect); Plan is opt-in (organize into days); Trip is config (dates,
// hotels, export). Starts on Places so the app opens simple, and planning is
// never forced.
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'places', label: 'Places' },
  { id: 'plan', label: 'Plan' },
  { id: 'trip', label: 'Trip' },
]

export function PlanningPanel() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const active = useAppSelector(s => s.ui.activeTab)
  const [collapsed, setCollapsed] = useState(false)

  if (!trip) return null

  return (
    <aside className={`scrapbook${collapsed ? ' collapsed' : ''}`}>
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
            {active === 'plan' && <PlanTab />}
            {active === 'trip' && <TripTab />}
          </div>
        </>
      )}
    </aside>
  )
}
