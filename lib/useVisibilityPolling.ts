'use client'
import { useEffect, useRef } from 'react'

/**
 * Polls a callback on an interval, but only when the tab is visible.
 * Automatically pauses when the user switches tabs and resumes on return.
 * Fires immediately on mount and when the tab becomes visible again.
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
  deps: React.DependencyList = [],
) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    function start() {
      if (timer) return
      cbRef.current()
      timer = setInterval(() => cbRef.current(), intervalMs)
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null }
    }

    function onVisibility() {
      if (document.hidden) stop()
      else start()
    }

    document.addEventListener('visibilitychange', onVisibility)

    // Start immediately if tab is visible
    if (!document.hidden) start()

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps])
}
