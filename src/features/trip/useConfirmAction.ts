import { useEffect, useRef, useState } from 'react'

// Two-click confirm for a destructive action — this app has no modal/dialog
// primitive (CLAUDE.md: everything is flat/inline — pills, chips, selects),
// so this is the confirm affordance instead. First trigger() arms
// `confirming` and a timeout that auto-reverts it; a second trigger() call
// while `confirming` is true clears the timeout, runs `action`, and resets.
// Letting the window lapse reverts on its own — no outside-click handling
// needed for a window this short.
export function useConfirmAction(action: () => void, timeoutMs = 3000) {
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function trigger() {
    if (confirming) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      setConfirming(false)
      action()
    } else {
      setConfirming(true)
      timer.current = setTimeout(() => {
        timer.current = null
        setConfirming(false)
      }, timeoutMs)
    }
  }

  return { confirming, trigger }
}
