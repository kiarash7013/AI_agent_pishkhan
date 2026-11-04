"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Slot } from "@/lib/primitives/slot"
import { useControllableState } from "@/lib/primitives/use-controllable-state"
import { usePresence } from "@/lib/primitives/use-presence"

type CollapsibleContextValue = {
  open: boolean
  toggle: () => void
  disabled?: boolean
  contentId: string
}

const CollapsibleContext =
  React.createContext<CollapsibleContextValue | null>(null)

function Collapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  disabled,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const contentId = React.useId()

  const context = React.useMemo<CollapsibleContextValue>(
    () => ({
      open: isOpen,
      toggle: () => setIsOpen(!isOpen),
      disabled,
      contentId,
    }),
    [isOpen, setIsOpen, disabled, contentId]
  )

  return (
    <CollapsibleContext.Provider value={context}>
      <div
        data-slot="collapsible"
        data-state={isOpen ? "open" : "closed"}
        data-disabled={disabled ? "" : undefined}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const context = React.useContext(CollapsibleContext)
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      type="button"
      data-slot="collapsible-trigger"
      aria-expanded={context?.open}
      aria-controls={context?.contentId}
      disabled={context?.disabled}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        context?.toggle()
      }}
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const context = React.useContext(CollapsibleContext)
  const { shouldRender, ref: presenceRef } = usePresence(
    Boolean(context?.open)
  )
  const [height, setHeight] = React.useState(0)
  const observerRef = React.useRef<ResizeObserver | null>(null)

  // callback ref، نه useRef+useEffect با dep خالی: چون در حالتِ پیش‌فرضِ
  // بسته، این div اصلاً وجود ندارد وقتی آن افکت یک‌بار در mount اجرا
  // می‌شود — یعنی observer هرگز attach نمی‌شد و height برای همیشه ۰
  // می‌ماند (پس انیمیشن همیشه صفر-به-صفر بود، یعنی محتوا به‌جای انیمیت‌شدن
  // یک‌دفعه ظاهر/ناپدید می‌شد). callback ref هر بار که این div واقعاً
  // mount/unmount شود صدا زده می‌شود، مستقل از اینکه شروع باز بوده یا بسته.
  // اندازه‌گیریِ اولیه هم همین‌جا (نه در یک افکتِ بعدی) انجام می‌شود تا
  // فریمِ اولِ انیمیشن مقدارِ درست را ببیند، نه صفرِ اولیهٔ state را.
  const innerRef = React.useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return

    // در React StrictMode (فقط توسعه)، ری‌اکت این callback ref را دوبار
    // پشتِ‌سرهم صدا می‌زند (شبیه‌سازیِ mount→unmount→remount) تا ناخالصی
    // را لو بدهد — و اینجا واقعاً لو داد: یک اندازه‌گیریِ همزمانِ
    // getBoundingClientRect داخلِ خودِ callback، بینِ آن دو فراخوانیِ
        // پشتِ‌سرهم، گاهی ۰ برمی‌گرداند (چون کامیتِ دومِ StrictMode هنوز
    // layout را کامل نبسته)، و آن صفر به‌عنوان آخرین state می‌ماند.
    // ResizeObserver اگر خودش را هم درست guard نکنیم همین مشکل را دارد:
    // observer قدیمی که هنوز در پروازِ callback است می‌تواند بعد از
    // reattach شدنِ observer تازه، state را با یک مقدارِ کهنه (یا ۰)
    // بازنویسی کند. observerRef.current===observer تضمین می‌کند فقط
    // نتیجهٔ آخرین observer واقعاً attach‌شده اثر بگذارد.
    const observer = new ResizeObserver((entries) => {
      if (observerRef.current !== observer) return
      setHeight(entries[0].contentRect.height)
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  React.useEffect(() => () => observerRef.current?.disconnect(), [])

  if (!shouldRender) return null

  return (
    <div
      ref={presenceRef}
      id={context?.contentId}
      data-slot="collapsible-content"
      data-state={context?.open ? "open" : "closed"}
      style={
        {
          "--collapsible-content-height": `${height}px`,
        } as React.CSSProperties
      }
      className={cn(
        "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      {...props}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
