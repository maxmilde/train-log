import { useEffect, useRef } from 'react'

/**
 * Debounced auto-save hook.
 * @param {Function} saveFn - async save function
 * @param {Array} deps - values that trigger a save when changed
 * @param {number} delay - debounce delay in ms (default 700ms)
 */
export function useAutoSave(saveFn, deps, delay = 700) {
  const timer  = useRef(null)
  const fnRef  = useRef(saveFn)
  const mounted = useRef(false)

  useEffect(() => { fnRef.current = saveFn }, [saveFn])

  useEffect(() => {
    // Skip the very first render
    if (!mounted.current) { mounted.current = true; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { fnRef.current() }, delay)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
