import { describe, it, expect } from 'vitest'
import {
  ALL_OVERTURE_GROUPS,
  OVERTURE_PLACE_CATEGORIES,
  categoriesForGroups,
} from './overturePlaceCategories'

describe('categoriesForGroups', () => {
  it('covers every category when passed every group', () => {
    expect(categoriesForGroups(ALL_OVERTURE_GROUPS)).toHaveLength(OVERTURE_PLACE_CATEGORIES.length)
  })

  it('returns nothing for an empty group list', () => {
    expect(categoriesForGroups([])).toEqual([])
  })

  it('includes only categories in the requested groups', () => {
    const foodOnly = categoriesForGroups(['food_drink'])
    expect(foodOnly).toContain('cafe')
    expect(foodOnly).not.toContain('museum')
    expect(foodOnly).not.toContain('hotel')

    const landmarksAndStays = categoriesForGroups(['landmarks_culture', 'accommodation'])
    expect(landmarksAndStays).toContain('museum')
    expect(landmarksAndStays).toContain('hotel')
    expect(landmarksAndStays).not.toContain('cafe')
  })
})
