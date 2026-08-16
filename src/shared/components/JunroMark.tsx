// The Junro mark — a compass needle hooking into a J, ringed with cardinal
// ticks. Sized via font-size (width/height are 1em) and colored via
// currentColor, so callers size/color it the same way they would a glyph —
// see .trip-gate-mark / .add-place-mark in index.css, unchanged by this
// component existing.
export function JunroMark({ className }: { className?: string }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      style={{ display: 'block' }}
    >
      <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="2" />
      <path d="M20 5 L20 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M35 20 L37 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 35 L20 37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 20 L3 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 8 L26 15 L20 19 L14 15 Z" fill="currentColor" />
      <path
        d="M20 17 L20 24 C20 28 16.5 29.5 14 27.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
