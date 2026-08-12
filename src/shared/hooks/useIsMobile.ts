import { useSyncExternalStore } from 'react'

// True on the narrow layout (mirrors the 640px breakpoint in index.css). Used
// where behaviour — not just style — has to differ, e.g. the mobile bottom
// sheet vs. the desktop left column.
const QUERY = '(max-width: 640px)'

export function useIsMobile() {
  return useSyncExternalStore(
    cb => {
      const m = window.matchMedia(QUERY)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

// Live viewport height. The mobile bottom sheet sizes its snap stops in pixels
// (px→px transitions animate; dvh→dvh ones freeze in Chromium), so it needs the
// height to re-derive on rotation / resize.
export function useViewportHeight() {
  return useSyncExternalStore(
    cb => {
      window.addEventListener('resize', cb)
      return () => window.removeEventListener('resize', cb)
    },
    () => window.innerHeight,
    () => 812,
  )
}
