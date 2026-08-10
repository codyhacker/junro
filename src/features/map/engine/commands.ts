import type { EasingOptions, FitBoundsOptions, LngLatBoundsLike, AnyLayer } from 'mapbox-gl'
import type { UiMode } from '../../../shared/constants/uiThemes'
import type { AugmentationSpec } from './styleAugmentation'

export type MapCommand =
  // ── Style ─────────────────────────────────────────────────────────────────
  | { type: 'STYLE_RECONCILE'; spec: AugmentationSpec }
  | { type: 'UI_THEME_CHANGE'; mode: UiMode }   // dark/light flip: CSS vars + Standard lightPreset

  // ── Camera ────────────────────────────────────────────────────────────────
  | { type: 'FLY_TO';     options: EasingOptions }
  | { type: 'FIT_BOUNDS'; bounds: LngLatBoundsLike; options?: FitBoundsOptions }
  | { type: 'EASE_TO';    options: EasingOptions }

  // ── Data / layers (future) ────────────────────────────────────────────────
  | { type: 'UPDATE_GEOJSON';       sourceId: string; data: unknown }
  | { type: 'ADD_LAYER';            spec: AnyLayer; before?: string }
  | { type: 'REMOVE_LAYER';         layerId: string }
  | { type: 'SET_LAYER_VISIBILITY'; layerId: string; visible: boolean }
