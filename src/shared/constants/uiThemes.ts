// Junro has exactly one theme with a light and a dark variant (see
// PROJECT_PLAN.md §2 principle 2 — "one theme, two modes"). The UiPalette
// token architecture is inherited from silkymaps: every UI color is a CSS
// custom property written by `applyUiTheme`, and `index.css` uses only
// `var(--token)` / `rgba(var(--token-rgb), α)`. The map side of theming is
// Mapbox Standard's own day/night light presets — no custom basemap here.

export interface UiPalette {
  // Backgrounds — stored as "R, G, B" for rgba() usage in CSS
  bgDeepRgb: string
  bgRichRgb: string
  bgWarmRgb: string

  // Accent — for borders, icons, interactive chrome
  accentRgb: string
  accentHex: string

  // Active / selected states
  activeStart: string
  activeEnd: string
  activeBorder: string
  activeRgb: string // "R, G, B" for glow shadows

  // Text hierarchy
  textPrimary: string
  textSecondary: string
  textLight: string
  textMuted: string
  textMed: string

  // Slider thumb
  sliderStart: string
  sliderEnd: string
  sliderGlowRgb: string

  // Title gradient
  titleStart: string
  titleMid: string
  titleEnd: string

  // Globe glow
  globeGlowRgb: string
  globeAccentRgb: string

  // Popup tip background (full CSS value)
  popupTipColor: string

  // <select> option background (solid hex, must be opaque)
  optionBg: string

  // Mapbox navigation control icon filter
  ctrlIconFilter: string

  // Secondary accent — pine green against the vermilion primary. Used for
  // route lines / secondary affordances so they never compete with pins.
  accentWarmHex: string
  accentWarmRgb: string // "R, G, B" for rgba() usage
}

// Moss/forest green on warm paper, with a clay-terracotta secondary. Quiet
// enough to sit beside Mapbox Standard's day palette.
const JUNRO_LIGHT: UiPalette = {
  bgDeepRgb: '246, 242, 235',
  bgRichRgb: '255, 253, 248',
  bgWarmRgb: '236, 229, 218',
  accentRgb: '74, 107, 66',
  accentHex: '#4a6b42',
  activeStart: '#4a6b42',
  activeEnd: '#374f31',
  activeBorder: '#405d3a',
  activeRgb: '74, 107, 66',
  textPrimary: '#2d2823',
  textSecondary: '#6d6357',
  textLight: '#453e36',
  textMuted: '#9a9083',
  textMed: '#7e7466',
  sliderStart: '#6b8f5f',
  sliderEnd: '#405d3a',
  sliderGlowRgb: '107, 143, 95',
  titleStart: '#4a6b42',
  titleMid: '#5c7a4f',
  titleEnd: '#374f31',
  globeGlowRgb: '90, 120, 80',
  globeAccentRgb: '110, 140, 95',
  popupTipColor: 'rgba(255, 253, 248, 0.98)',
  optionBg: '#fffdf8',
  ctrlIconFilter: 'none',
  accentWarmHex: '#a8683f',
  accentWarmRgb: '168, 104, 63',
}

// Warm charcoal, deliberately NOT near-black — panels read as dark slate-brown
// so the UI has depth against the map instead of everything blending to black.
// Brighter sage-green accent keeps contrast; brighter clay secondary.
const JUNRO_DARK: UiPalette = {
  bgDeepRgb: '34, 31, 28',
  bgRichRgb: '48, 44, 39',
  bgWarmRgb: '64, 58, 51',
  accentRgb: '127, 163, 112',
  accentHex: '#7fa370',
  activeStart: '#7fa370',
  activeEnd: '#5f8052',
  activeBorder: '#6f9161',
  activeRgb: '127, 163, 112',
  textPrimary: '#ede6da',
  textSecondary: '#b5aa99',
  textLight: '#d8cfc1',
  textMuted: '#80776a',
  textMed: '#9c9182',
  sliderStart: '#94b885',
  sliderEnd: '#5f8052',
  sliderGlowRgb: '148, 184, 133',
  titleStart: '#94b885',
  titleMid: '#7fa370',
  titleEnd: '#5f8052',
  globeGlowRgb: '120, 150, 105',
  globeAccentRgb: '140, 170, 120',
  popupTipColor: 'rgba(31, 28, 25, 0.98)',
  optionBg: '#1f1c19',
  ctrlIconFilter: 'invert(0.85)',
  accentWarmHex: '#cf9159',
  accentWarmRgb: '207, 145, 89',
}

export type UiMode = 'light' | 'dark'

export function getPalette(mode: UiMode): UiPalette {
  return mode === 'dark' ? JUNRO_DARK : JUNRO_LIGHT
}

// Maps a UI mode to Mapbox Standard's lightPreset. Dark mode uses 'dusk' rather
// than 'night' — monochrome + night reads as near-black; dusk is a softer
// evening gray that stays dark without swallowing everything.
export function lightPresetFor(mode: UiMode): 'day' | 'dusk' {
  return mode === 'dark' ? 'dusk' : 'day'
}

// ─── Apply theme to DOM ───────────────────────────────────────────────────────

export function applyUiTheme(palette: UiPalette): void {
  const el = document.documentElement
  const p = palette
  el.style.setProperty('--bg-deep-rgb', p.bgDeepRgb)
  el.style.setProperty('--bg-rich-rgb', p.bgRichRgb)
  el.style.setProperty('--bg-warm-rgb', p.bgWarmRgb)
  el.style.setProperty('--accent-rgb', p.accentRgb)
  el.style.setProperty('--accent-hex', p.accentHex)
  el.style.setProperty('--active-start', p.activeStart)
  el.style.setProperty('--active-end', p.activeEnd)
  el.style.setProperty('--active-border', p.activeBorder)
  el.style.setProperty('--active-rgb', p.activeRgb)
  el.style.setProperty('--text-primary', p.textPrimary)
  el.style.setProperty('--text-secondary', p.textSecondary)
  el.style.setProperty('--text-light', p.textLight)
  el.style.setProperty('--text-muted', p.textMuted)
  el.style.setProperty('--text-med', p.textMed)
  el.style.setProperty('--slider-start', p.sliderStart)
  el.style.setProperty('--slider-end', p.sliderEnd)
  el.style.setProperty('--slider-glow-rgb', p.sliderGlowRgb)
  el.style.setProperty('--title-start', p.titleStart)
  el.style.setProperty('--title-mid', p.titleMid)
  el.style.setProperty('--title-end', p.titleEnd)
  el.style.setProperty('--globe-glow-rgb', p.globeGlowRgb)
  el.style.setProperty('--globe-accent-rgb', p.globeAccentRgb)
  el.style.setProperty('--popup-tip-color', p.popupTipColor)
  el.style.setProperty('--option-bg', p.optionBg)
  el.style.setProperty('--ctrl-icon-filter', p.ctrlIconFilter)
  el.style.setProperty('--accent-warm-hex', p.accentWarmHex)
  el.style.setProperty('--accent-warm-rgb', p.accentWarmRgb)
  // Native form controls + scrollbars follow the mode.
  el.style.setProperty('color-scheme', p === JUNRO_DARK ? 'dark' : 'light')
}
