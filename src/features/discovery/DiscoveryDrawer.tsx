import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setDiscoveryVisible, toggleDiscoveryGroup } from './discoverySlice'
import {
  ALL_OVERTURE_GROUPS,
  OVERTURE_GROUP_META,
} from '../../shared/constants/overturePlaceCategories'

// Discover-nearby toggle — collect from the map (Overture dots), a parallel
// path to searching. Lives in the Places tab (the collector home). Once on,
// a chip row expands underneath to narrow the discovery layer down to a
// subset of categories (styleAugmentation.ts filters discovery-dots/-labels
// on s.discovery.activeGroups).
export function DiscoveryDrawer() {
  const dispatch = useAppDispatch()
  const visible = useAppSelector((s) => s.discovery.visible)
  const activeGroups = useAppSelector((s) => s.discovery.activeGroups)

  return (
    <>
      <button
        className={`discover-toggle${visible ? ' active' : ''}`}
        aria-pressed={visible}
        aria-expanded={visible}
        aria-controls="discovery-chips-drawer"
        title="Show nearby places on the map — tap a dot to add it"
        onClick={() => dispatch(setDiscoveryVisible(!visible))}
      >
        <span className="discover-dot" aria-hidden />
        {visible ? 'Discovering nearby — tap a dot to add' : 'Discover nearby places'}
      </button>
      <div
        id="discovery-chips-drawer"
        className={`discovery-chips-drawer${visible ? ' open' : ''}`}
      >
        <div className="discovery-chips" role="group" aria-label="Filter discovery categories">
          {ALL_OVERTURE_GROUPS.map((group) => (
            <button
              key={group}
              className={`discovery-chip${activeGroups.includes(group) ? ' active' : ''}`}
              aria-pressed={activeGroups.includes(group)}
              onClick={() => dispatch(toggleDiscoveryGroup(group))}
            >
              {OVERTURE_GROUP_META[group].emoji} {OVERTURE_GROUP_META[group].label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
