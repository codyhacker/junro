import { useEffect, useRef, useState } from 'react'
import { newSessionToken, suggest, type Suggestion } from './searchBoxApi'

// Debounced Search Box autocomplete with abort-on-supersede. One session
// token per mount-to-retrieve cycle; call `resetSession` after a retrieve.
export function useSuggest(query: string, opts: { proximity?: [number, number]; types?: string }) {
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const sessionRef = useRef(newSessionToken())
  const abortRef = useRef<AbortController | null>(null)
  // Options only matter at request time — keep a ref so the effect below
  // doesn't retrigger on every parent render (proximity arrays are unstable).
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    abortRef.current?.abort()
    if (query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await suggest(query, sessionRef.current, optsRef.current, ac.signal)
        if (!ac.signal.aborted) setResults(r)
      } catch {
        if (!ac.signal.aborted) setResults([])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [query])

  return {
    results,
    loading,
    sessionToken: () => sessionRef.current,
    resetSession: () => {
      sessionRef.current = newSessionToken()
    },
    clear: () => setResults([]),
  }
}
