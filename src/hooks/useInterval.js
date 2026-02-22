import { useEffect, useRef } from 'react'

/**
 * Reliable setInterval hook. Handles callback identity changes gracefully.
 * Pass delay=null to pause the interval.
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback)
  useEffect(() => { savedCallback.current = callback }, [callback])

  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}
