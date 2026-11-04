"use client"

import * as React from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isActuallyFocusable(element: HTMLElement): boolean {
  if (element.closest("[inert], [aria-hidden='true']")) return false
  if (element.hidden) return false

  let current: HTMLElement | null = element
  while (current) {
    const style = getComputedStyle(current)
    if (style.display === "none" || style.visibility === "hidden") return false
    current = current.parentElement
  }

  return true
}

/**
 * وقتی active است، فوکوس را داخل container نگه می‌دارد (Tab/Shift+Tab دور
 * می‌زند)، اول باز شدن روی اولین عنصر قابل‌فوکوس می‌گذارد، و وقتی غیرفعال
 * شود فوکوس را به عنصری که قبل از باز شدن فوکوس داشت برمی‌گرداند.
 */
function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  const previouslyFocused = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!active) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    const getFocusable = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      ).filter(isActuallyFocusable)

    const first = getFocusable()[0] ?? container
    first?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return
      const items = getFocusable()
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const activeEl = document.activeElement

      if (event.shiftKey && activeEl === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && activeEl === lastEl) {
        event.preventDefault()
        firstEl.focus()
      } else if (!container?.contains(activeEl)) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [active, containerRef])
}

export { useFocusTrap }
