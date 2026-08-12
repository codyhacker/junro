import type { UiMode } from './uiThemes'

// The categorical day ramp (PROJECT_PLAN.md §9 open question 2 — one ramp,
// light + dark variants). Days cycle through it by index, so consecutive days
// are always a clear hue apart.
//
// Harmonized with the Junro palette by staying *off* its two signature hues —
// vermilion (#d6583e, ~12°) and pine (#49796b, ~160°) — and off the category
// pin colors in engine/icons.ts (roasted amber ~28°, temple violet ~259°).
// The eight hues below sit in the gaps: 48, 85, 128, 178, 205, 235, 275, 335.
// `casing` is the darker outline drawn under a route line so the colored line
// separates from the basemap in either mode.

export interface DayColor {
  name: string
  light: string
  dark: string
  casing: string
}

export const DAY_COLORS: DayColor[] = [
  { name: 'harbor', light: '#2a7ba8', dark: '#5fa9d2', casing: '#12405c' },
  { name: 'gold', light: '#b8901f', dark: '#e0b64d', casing: '#5e4a0d' },
  { name: 'orchid', light: '#8b52b8', dark: '#b184d9', casing: '#472561' },
  { name: 'leaf', light: '#2f9455', dark: '#5fbd82', casing: '#154a29' },
  { name: 'rose', light: '#bf4a76', dark: '#e37ba1', casing: '#63213a' },
  { name: 'lagoon', light: '#1c8c8a', dark: '#4fb6b4', casing: '#0c4746' },
  { name: 'moss', light: '#7a9a2e', dark: '#a8c65c', casing: '#3d4d16' },
  { name: 'indigo', light: '#4a5fb5', dark: '#8492dd', casing: '#232f5e' },
]

export function dayColorAt(index: number): DayColor {
  return DAY_COLORS[((index % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length]
}

// The hex a day wears in the current mode — pins' day rings, route lines, and
// the rail's day swatches all read from here so they never drift apart.
export function dayHexAt(index: number, mode: UiMode): string {
  const c = dayColorAt(index)
  return mode === 'dark' ? c.dark : c.light
}

// The same color as an "r, g, b" triplet, for `rgb()/rgba()` in CSS — lets a
// list row tint its whole background in the day color at low alpha while hover
// / selected layer stronger alphas over it.
export function dayRgbAt(index: number, mode: UiMode): string {
  const n = parseInt(dayHexAt(index, mode).slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}
