import { describe, it, expect } from 'vitest'
import { ALL_OVERTURE_GROUPS } from '../../shared/constants/overturePlaceCategories'
import discoveryReducer, { toggleDiscoveryGroup } from './discoverySlice'

describe('toggleDiscoveryGroup', () => {
  it('removes a group that is active', () => {
    const state = { visible: true, activeGroups: [...ALL_OVERTURE_GROUPS] }
    const next = discoveryReducer(state, toggleDiscoveryGroup('food_drink'))
    expect(next.activeGroups).not.toContain('food_drink')
    expect(next.activeGroups).toHaveLength(ALL_OVERTURE_GROUPS.length - 1)
  })

  it('adds a group that is inactive', () => {
    const state = { visible: true, activeGroups: ['transit' as const] }
    const next = discoveryReducer(state, toggleDiscoveryGroup('food_drink'))
    expect(next.activeGroups).toContain('food_drink')
    expect(next.activeGroups).toHaveLength(2)
  })

  it('deselecting then reselecting every group returns to a set equal to ALL_OVERTURE_GROUPS', () => {
    let state = { visible: true, activeGroups: [...ALL_OVERTURE_GROUPS] }
    for (const group of ALL_OVERTURE_GROUPS) {
      state = discoveryReducer(state, toggleDiscoveryGroup(group))
    }
    expect(state.activeGroups).toEqual([])
    for (const group of ALL_OVERTURE_GROUPS) {
      state = discoveryReducer(state, toggleDiscoveryGroup(group))
    }
    // Order may differ from ALL_OVERTURE_GROUPS (toggled back in the same
    // sweep order, so it happens to match here), but the length/membership
    // is what the "omit filter when everything is selected" check in
    // styleAugmentation.ts actually relies on.
    expect(state.activeGroups).toHaveLength(ALL_OVERTURE_GROUPS.length)
    for (const group of ALL_OVERTURE_GROUPS) {
      expect(state.activeGroups).toContain(group)
    }
  })
})
