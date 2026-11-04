"use client"

import * as React from "react"

let lockCount = 0
let scrollY = 0
let originalBodyStyle = {
  position: "",
  top: "",
  left: "",
  right: "",
  width: "",
  overflow: "",
}

/**
 * اسکرول body را قفل می‌کند؛ شمارنده مشترک بین همهٔ استفاده‌کننده‌هاست تا
 * چند مودال تودرتو هم درست کار کنند — فقط وقتی همه بسته شدند اسکرول
 * برمی‌گردد.
 *
 * روی موبایل، صرفِ `overflow: hidden` روی body باعث می‌شود صفحه به بالا
 * بپرد (چون مرورگرهای موبایل موقعیت اسکرول را با آن حفظ نمی‌کنند). به‌جایش
 * body را با `position: fixed` و `top` منفی به‌اندازهٔ اسکرول فعلی قفل
 * می‌کنیم و در پایان همان موقعیت را برمی‌گردانیم — بدون پرش.
 */
function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return

    if (lockCount === 0) {
      scrollY = window.scrollY
      const body = document.body
      originalBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
      }
      body.style.position = "fixed"
      body.style.top = `-${scrollY}px`
      body.style.left = "0"
      body.style.right = "0"
      body.style.width = "100%"
      body.style.overflow = "hidden"
    }
    lockCount++

    return () => {
      lockCount--
      if (lockCount === 0) {
        const body = document.body
        body.style.position = originalBodyStyle.position
        body.style.top = originalBodyStyle.top
        body.style.left = originalBodyStyle.left
        body.style.right = originalBodyStyle.right
        body.style.width = originalBodyStyle.width
        body.style.overflow = originalBodyStyle.overflow
        window.scrollTo(0, scrollY)
      }
    }
  }, [active])
}

export { useScrollLock }
