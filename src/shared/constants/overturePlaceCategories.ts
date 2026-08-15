import type { PlaceCategory } from '../types/trip'

// Raw `categories.primary` values present in the filtered Overture places
// extract (spatialData/bake/cache/places_filtered.parquet). Source of truth
// for the discovery-layer category filter UI — counts are from the US +
// Europe + Asia staged extract, useful for ordering/prioritizing chips.
//
// `toPlaceCategory` maps each Overture category down to the app's existing
// SavedPlace taxonomy (see features/trip/categoryMeta.ts) for when a
// discovery-layer POI gets saved into a trip.

export type OvertureCategoryGroup =
  | 'landmarks_culture'
  | 'nature_scenic'
  | 'food_drink'
  | 'accommodation'
  | 'transit'

export interface OvertureCategoryEntry {
  category: string
  label: string
  group: OvertureCategoryGroup
  count: number
  toPlaceCategory: PlaceCategory
}

// Chip label + emoji per group. A Record, so TS enforces every member of the
// OvertureCategoryGroup union has an entry — ALL_OVERTURE_GROUPS below reads
// its keys instead of maintaining a second list, so the two can't drift out
// of sync if a group is ever added, renamed, or removed.
export const OVERTURE_GROUP_META: Record<OvertureCategoryGroup, { label: string; emoji: string }> = {
  landmarks_culture: { label: 'Landmarks', emoji: '🏛️' },
  nature_scenic: { label: 'Nature', emoji: '🌳' },
  food_drink: { label: 'Food & Drink', emoji: '🍽️' },
  accommodation: { label: 'Hotels', emoji: '🏨' },
  transit: { label: 'Transit', emoji: '🚉' },
}

// The 5 groups, in display order for the discovery-drawer chip row (object
// key order is insertion order for string keys, so this matches the literal
// order above).
export const ALL_OVERTURE_GROUPS = Object.keys(OVERTURE_GROUP_META) as OvertureCategoryGroup[]

export const OVERTURE_PLACE_CATEGORIES: OvertureCategoryEntry[] = [
  // landmarks & culture
  { category: 'landmark_and_historical_building', label: 'Landmark',            group: 'landmarks_culture', count: 615602, toPlaceCategory: 'sight' },
  { category: 'church_cathedral',                 label: 'Church / Cathedral',  group: 'landmarks_culture', count: 565029, toPlaceCategory: 'sight' },
  { category: 'buddhist_temple',                  label: 'Buddhist Temple',     group: 'landmarks_culture', count: 106700, toPlaceCategory: 'sight' },
  { category: 'art_gallery',                      label: 'Art Gallery',         group: 'landmarks_culture', count: 103950, toPlaceCategory: 'sight' },
  { category: 'hindu_temple',                     label: 'Hindu Temple',        group: 'landmarks_culture', count: 78767,  toPlaceCategory: 'sight' },
  { category: 'mosque',                           label: 'Mosque',              group: 'landmarks_culture', count: 87517,  toPlaceCategory: 'sight' },
  { category: 'topic_concert_venue',              label: 'Concert Venue',       group: 'landmarks_culture', count: 78711,  toPlaceCategory: 'sight' },
  { category: 'attractions_and_activities',       label: 'Attraction',          group: 'landmarks_culture', count: 68034,  toPlaceCategory: 'sight' },
  { category: 'stadium_arena',                    label: 'Stadium / Arena',     group: 'landmarks_culture', count: 63968,  toPlaceCategory: 'sight' },
  { category: 'museum',                           label: 'Museum',              group: 'landmarks_culture', count: 59649,  toPlaceCategory: 'sight' },
  { category: 'tours',                            label: 'Tours',               group: 'landmarks_culture', count: 54277,  toPlaceCategory: 'sight' },
  { category: 'theatre',                          label: 'Theatre',             group: 'landmarks_culture', count: 36271,  toPlaceCategory: 'sight' },
  { category: 'monument',                         label: 'Monument',            group: 'landmarks_culture', count: 34991,  toPlaceCategory: 'sight' },
  { category: 'music_venue',                      label: 'Music Venue',         group: 'landmarks_culture', count: 33816,  toPlaceCategory: 'sight' },
  { category: 'cultural_center',                  label: 'Cultural Center',     group: 'landmarks_culture', count: 32521,  toPlaceCategory: 'sight' },
  { category: 'amusement_park',                   label: 'Amusement Park',      group: 'landmarks_culture', count: 31315,  toPlaceCategory: 'sight' },
  { category: 'history_museum',                   label: 'History Museum',      group: 'landmarks_culture', count: 29516,  toPlaceCategory: 'sight' },
  { category: 'casino',                           label: 'Casino',              group: 'landmarks_culture', count: 24285,  toPlaceCategory: 'sight' },
  { category: 'castle',                           label: 'Castle',              group: 'landmarks_culture', count: 13518,  toPlaceCategory: 'sight' },
  { category: 'performing_arts',                  label: 'Performing Arts',     group: 'landmarks_culture', count: 13412,  toPlaceCategory: 'sight' },
  { category: 'art_museum',                       label: 'Art Museum',          group: 'landmarks_culture', count: 10863,  toPlaceCategory: 'sight' },
  { category: 'water_park',                       label: 'Water Park',          group: 'landmarks_culture', count: 9171,   toPlaceCategory: 'sight' },
  { category: 'botanical_garden',                 label: 'Botanical Garden',    group: 'landmarks_culture', count: 7673,   toPlaceCategory: 'sight' },
  { category: 'zoo',                              label: 'Zoo',                 group: 'landmarks_culture', count: 6992,   toPlaceCategory: 'sight' },
  { category: 'synagogue',                        label: 'Synagogue',           group: 'landmarks_culture', count: 6129,   toPlaceCategory: 'sight' },
  { category: 'palace',                           label: 'Palace',              group: 'landmarks_culture', count: 4804,   toPlaceCategory: 'sight' },
  { category: 'aquarium',                         label: 'Aquarium',            group: 'landmarks_culture', count: 4253,   toPlaceCategory: 'sight' },
  { category: 'religious_destination',            label: 'Religious Site',      group: 'landmarks_culture', count: 3951,   toPlaceCategory: 'sight' },
  { category: 'science_museum',                   label: 'Science Museum',      group: 'landmarks_culture', count: 2418,   toPlaceCategory: 'sight' },
  { category: 'observatory',                      label: 'Observatory',         group: 'landmarks_culture', count: 2286,   toPlaceCategory: 'sight' },
  { category: 'fort',                             label: 'Fort',                group: 'landmarks_culture', count: 2146,   toPlaceCategory: 'sight' },
  { category: 'childrens_museum',                 label: "Children's Museum",   group: 'landmarks_culture', count: 1279,   toPlaceCategory: 'sight' },
  { category: 'planetarium',                      label: 'Planetarium',         group: 'landmarks_culture', count: 1044,   toPlaceCategory: 'sight' },
  { category: 'temple',                           label: 'Temple',              group: 'landmarks_culture', count: 432,    toPlaceCategory: 'sight' },
  { category: 'ruin',                             label: 'Ruin',                group: 'landmarks_culture', count: 27,     toPlaceCategory: 'sight' },

  // nature & scenic
  { category: 'park',                             label: 'Park',                group: 'nature_scenic', count: 358575, toPlaceCategory: 'sight' },
  { category: 'lake',                             label: 'Lake',                group: 'nature_scenic', count: 161938, toPlaceCategory: 'sight' },
  { category: 'beach',                            label: 'Beach',               group: 'nature_scenic', count: 123017, toPlaceCategory: 'sight' },
  { category: 'mountain',                         label: 'Mountain',            group: 'nature_scenic', count: 105879, toPlaceCategory: 'sight' },
  { category: 'river',                            label: 'River',               group: 'nature_scenic', count: 82764,  toPlaceCategory: 'sight' },
  { category: 'hiking_trail',                     label: 'Hiking Trail',        group: 'nature_scenic', count: 28268,  toPlaceCategory: 'sight' },
  { category: 'national_park',                    label: 'National Park',       group: 'nature_scenic', count: 18982,  toPlaceCategory: 'sight' },
  { category: 'nature_reserve',                   label: 'Nature Reserve',      group: 'nature_scenic', count: 16599,  toPlaceCategory: 'sight' },
  { category: 'beach_resort',                     label: 'Beach Resort',        group: 'nature_scenic', count: 5852,   toPlaceCategory: 'sight' },
  { category: 'waterfall',                        label: 'Waterfall',           group: 'nature_scenic', count: 5812,   toPlaceCategory: 'sight' },
  { category: 'visitor_center',                   label: 'Visitor Center',      group: 'nature_scenic', count: 5242,   toPlaceCategory: 'sight' },
  { category: 'cave',                             label: 'Cave',                group: 'nature_scenic', count: 3230,   toPlaceCategory: 'sight' },
  { category: 'lighthouse',                       label: 'Lighthouse',          group: 'nature_scenic', count: 2703,   toPlaceCategory: 'sight' },
  { category: 'island',                           label: 'Island',              group: 'nature_scenic', count: 1576,   toPlaceCategory: 'sight' },
  { category: 'state_park',                       label: 'State Park',          group: 'nature_scenic', count: 133,    toPlaceCategory: 'sight' },
  { category: 'canyon',                           label: 'Canyon',              group: 'nature_scenic', count: 11,     toPlaceCategory: 'sight' },

  // food & drink
  { category: 'cafe',                             label: 'Cafe',                group: 'food_drink', count: 495123, toPlaceCategory: 'cafe' },
  { category: 'coffee_shop',                      label: 'Coffee Shop',         group: 'food_drink', count: 439928, toPlaceCategory: 'cafe' },
  { category: 'bar',                              label: 'Bar',                 group: 'food_drink', count: 372726, toPlaceCategory: 'restaurant' },
  { category: 'pub',                              label: 'Pub',                 group: 'food_drink', count: 113464, toPlaceCategory: 'restaurant' },
  { category: 'winery',                           label: 'Winery',              group: 'food_drink', count: 58574,  toPlaceCategory: 'sight' },
  { category: 'cocktail_bar',                     label: 'Cocktail Bar',        group: 'food_drink', count: 35211,  toPlaceCategory: 'restaurant' },
  { category: 'brewery',                          label: 'Brewery',             group: 'food_drink', count: 35067,  toPlaceCategory: 'sight' },
  { category: 'distillery',                       label: 'Distillery',          group: 'food_drink', count: 7434,   toPlaceCategory: 'sight' },

  // accommodation
  { category: 'hotel',                            label: 'Hotel',               group: 'accommodation', count: 834715, toPlaceCategory: 'other' },
  { category: 'accommodation',                    label: 'Accommodation',       group: 'accommodation', count: 307821, toPlaceCategory: 'other' },
  { category: 'bed_and_breakfast',                label: 'Bed & Breakfast',     group: 'accommodation', count: 122249, toPlaceCategory: 'other' },
  { category: 'holiday_rental_home',               label: 'Holiday Rental',      group: 'accommodation', count: 119345, toPlaceCategory: 'other' },
  { category: 'resort',                           label: 'Resort',              group: 'accommodation', count: 87804,  toPlaceCategory: 'other' },
  { category: 'hostel',                           label: 'Hostel',              group: 'accommodation', count: 36006,  toPlaceCategory: 'other' },
  { category: 'inn',                              label: 'Inn',                 group: 'accommodation', count: 20762,  toPlaceCategory: 'other' },
  { category: 'guest_house',                      label: 'Guest House',         group: 'accommodation', count: 3928,   toPlaceCategory: 'other' },

  // transit
  { category: 'train_station',                    label: 'Train Station',       group: 'transit', count: 87905, toPlaceCategory: 'other' },
  { category: 'bus_station',                      label: 'Bus Station',         group: 'transit', count: 40363, toPlaceCategory: 'other' },
  { category: 'airport',                          label: 'Airport',             group: 'transit', count: 34972, toPlaceCategory: 'other' },
  { category: 'metro_station',                    label: 'Metro Station',       group: 'transit', count: 2607,  toPlaceCategory: 'other' },
]

const BY_CATEGORY = new Map(OVERTURE_PLACE_CATEGORIES.map(e => [e.category, e]))

// Map a raw Overture `categories.primary` down to the app's SavedPlace
// taxonomy. Unknown categories fall back to 'other'.
export function overtureToPlaceCategory(category: string): PlaceCategory {
  return BY_CATEGORY.get(category)?.toPlaceCategory ?? 'other'
}

// Human label for a raw Overture category (falls back to the raw value).
export function overtureLabel(category: string): string {
  return BY_CATEGORY.get(category)?.label ?? category
}

// Raw category strings for every entry whose group is in `groups` — feeds the
// discovery layer's category-chip filter expression.
export function categoriesForGroups(groups: OvertureCategoryGroup[]): string[] {
  return OVERTURE_PLACE_CATEGORIES.filter(e => groups.includes(e.group)).map(e => e.category)
}
