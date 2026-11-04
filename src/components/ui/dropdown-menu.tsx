"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Slot } from "@/lib/primitives/slot"
import { Portal } from "@/lib/primitives/portal"
import { useControllableState } from "@/lib/primitives/use-controllable-state"
import { usePresence } from "@/lib/primitives/use-presence"
import { useDismissableLayer } from "@/lib/primitives/use-dismissable-layer"
import { useFloatingPosition } from "@/lib/primitives/use-floating-position"
import {
  transformOriginFor,
  type Align,
  type Side,
} from "@/lib/primitives/positioning"
import {
  createSelectEvent,
  focusFirstItemOnceReady,
  handleMenuKeyDown,
  useMenuTypeahead,
  type MenuSelectEvent,
} from "@/lib/primitives/menu"
import { CheckIcon, ChevronLeftIcon, CircleIcon } from "@/components/icons"

type DropdownMenuContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  setTrigger: (node: HTMLElement | null) => void
}

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null)

function DropdownMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const setTrigger = React.useCallback((node: HTMLElement | null) => {
    triggerRef.current = node
  }, [])

  const context = React.useMemo<DropdownMenuContextValue>(
    () => ({ open: isOpen, setOpen: setIsOpen, triggerRef, setTrigger }),
    [isOpen, setIsOpen, setTrigger]
  )

  return (
    <DropdownMenuContext.Provider value={context}>
      {children}
    </DropdownMenuContext.Provider>
  )
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <Portal>{children}</Portal>
}

function DropdownMenuTrigger({
  asChild = false,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const context = React.useContext(DropdownMenuContext)
  const Comp = asChild ? Slot : "button"

  const setRef = React.useCallback(
    (node: HTMLElement | null) => context?.setTrigger(node),
    [context]
  )

  return (
    <Comp
      ref={setRef as never}
      type="button"
      data-slot="dropdown-menu-trigger"
      aria-haspopup="menu"
      aria-expanded={context?.open}
      data-state={context?.open ? "open" : "closed"}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        context?.setOpen(!context.open)
      }}
      onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault()
          context?.setOpen(true)
        }
      }}
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: Side
  align?: Align
  sideOffset?: number
}) {
  const context = React.useContext(DropdownMenuContext)
  const { shouldRender, ref: presenceRef } = usePresence(
    Boolean(context?.open)
  )
  const contentRef = React.useRef<HTMLDivElement>(null)
  const typeahead = useMenuTypeahead()

  const position = useFloatingPosition(
    context?.triggerRef ?? contentRef,
    contentRef,
    Boolean(context?.open),
    { side, align, sideOffset }
  )

  useDismissableLayer({
    ref: contentRef,
    enabled: Boolean(context?.open),
    onDismiss: (reason) => {
      context?.setOpen(false)
      if (reason === "escape") context?.triggerRef.current?.focus()
    },
  })

  React.useEffect(() => {
    if (!context?.open) return
    // فوکوس برگرداندن به trigger عمداً اینجا نیست: افکت‌ها در dev دوبار
    // mount/cleanup می‌شوند و یک cleanup زودهنگام فوکوسِ تازه‌گرفته‌شده روی
    // آیتم را فوری پس می‌گرفت. برگشت فوکوس را همان‌جایی انجام می‌دهیم که
    // واقعاً منو را می‌بندیم (dismiss یا انتخاب آیتم).
    return focusFirstItemOnceReady(() => contentRef.current)
  }, [context?.open])

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node
      presenceRef(node)
    },
    [presenceRef]
  )

  if (!shouldRender) return null

  const finalSide = position?.side ?? side
  const finalAlign = position?.align ?? align

  return (
    <Portal>
      <div
        ref={setRefs}
        role="menu"
        tabIndex={-1}
        data-slot="dropdown-menu-content"
        data-state={context?.open ? "open" : "closed"}
        data-side={finalSide}
        onKeyDown={(event) => {
          if (event.key === "Escape") return
          handleMenuKeyDown(event, contentRef.current, typeahead)
        }}
        style={
          {
            position: "fixed",
            top: position ? position.y : 0,
            left: position ? position.x : 0,
            visibility: position ? "visible" : "hidden",
            "--dropdown-menu-content-transform-origin":
              transformOriginFor(finalSide, finalAlign),
            "--dropdown-menu-content-available-height": "min(24rem, 90vh)",
          } as React.CSSProperties
        }
        className={cn(
          "z-(--z-overlay) max-h-(--dropdown-menu-content-available-height) min-w-[8rem] origin-(--dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-panel data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </Portal>
  )
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<"div">) {
  return <div role="group" data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  disabled,
  asChild = false,
  onSelect,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
  variant?: "default" | "destructive"
  disabled?: boolean
  asChild?: boolean
  /** با کلیک یا Enter/Space صدا زده می‌شود؛ preventDefault کنید تا منو باز بماند. */
  onSelect?: (event: MenuSelectEvent) => void
}) {
  const context = React.useContext(DropdownMenuContext)
  const Comp = asChild ? Slot : "div"

  function select() {
    if (disabled) return
    if (onSelect) {
      const event = createSelectEvent()
      onSelect(event)
      if (event.defaultPrevented) return
    }
    context?.setOpen(false)
    context?.triggerRef.current?.focus()
  }

  return (
    <Comp
      role="menuitem"
      tabIndex={-1}
      data-slot="dropdown-menu-item"
      data-disabled={disabled ? "" : undefined}
      aria-disabled={disabled}
      data-inset={inset ? "" : undefined}
      data-variant={variant}
      onClick={(event: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return
        onClick?.(event)
        if (event.defaultPrevented) return
        select()
      }}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || disabled) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          select()
        }
      }}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:text-placeholder data-[inset]:ps-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive-subtle data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  disabled,
  onSelect,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<"div"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  onSelect?: (event: MenuSelectEvent) => void
}) {
  const context = React.useContext(DropdownMenuContext)

  function select() {
    if (disabled) return
    onCheckedChange?.(!checked)
    if (onSelect) {
      const event = createSelectEvent()
      onSelect(event)
      if (event.defaultPrevented) return
    }
    context?.setOpen(false)
    context?.triggerRef.current?.focus()
  }

  return (
    <div
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      data-slot="dropdown-menu-checkbox-item"
      data-disabled={disabled ? "" : undefined}
      onClick={(event) => {
        if (disabled) return
        onClick?.(event)
        if (event.defaultPrevented) return
        select()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || disabled) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          select()
        }
      }}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md py-1.5 pe-2 ps-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:text-placeholder [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute start-2 flex size-3.5 items-center justify-center">
        {checked && <CheckIcon className="size-4" />}
      </span>
      {children}
    </div>
  )
}

type DropdownMenuRadioGroupContextValue = {
  value: string | undefined
  setValue: (value: string) => void
}
const DropdownMenuRadioGroupContext =
  React.createContext<DropdownMenuRadioGroupContextValue | null>(null)

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string
  onValueChange?: (value: string) => void
}) {
  const context = React.useMemo<DropdownMenuRadioGroupContextValue>(
    () => ({ value, setValue: (v) => onValueChange?.(v) }),
    [value, onValueChange]
  )
  return (
    <div role="group" data-slot="dropdown-menu-radio-group" {...props}>
      <DropdownMenuRadioGroupContext.Provider value={context}>
        {children}
      </DropdownMenuRadioGroupContext.Provider>
    </div>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  disabled,
  onSelect,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<"div"> & {
  value: string
  disabled?: boolean
  onSelect?: (event: MenuSelectEvent) => void
}) {
  const context = React.useContext(DropdownMenuContext)
  const radioGroup = React.useContext(DropdownMenuRadioGroupContext)
  const checked = radioGroup?.value === value

  function select() {
    if (disabled) return
    radioGroup?.setValue(value)
    if (onSelect) {
      const event = createSelectEvent()
      onSelect(event)
      if (event.defaultPrevented) return
    }
    context?.setOpen(false)
    context?.triggerRef.current?.focus()
  }

  return (
    <div
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      data-slot="dropdown-menu-radio-item"
      data-disabled={disabled ? "" : undefined}
      onClick={(event) => {
        if (disabled) return
        onClick?.(event)
        if (event.defaultPrevented) return
        select()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || disabled) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          select()
        }
      }}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md py-1.5 pe-2 ps-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:text-placeholder [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute start-2 flex size-3.5 items-center justify-center">
        {checked && <CircleIcon className="size-2 fill-current" />}
      </span>
      {children}
    </div>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset ? "" : undefined}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:ps-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ms-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

type DropdownMenuSubContextValue = {
  open: boolean
  triggerRef: React.RefObject<HTMLElement | null>
  setTrigger: (node: HTMLElement | null) => void
  openNow: () => void
  scheduleClose: () => void
  closeNow: () => void
}
const DropdownMenuSubContext =
  React.createContext<DropdownMenuSubContextValue | null>(null)

function DropdownMenuSub({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const setTrigger = React.useCallback((node: HTMLElement | null) => {
    triggerRef.current = node
  }, [])
  const timerRef = React.useRef<number | undefined>(undefined)

  const context = React.useMemo<DropdownMenuSubContextValue>(
    () => ({
      open: isOpen,
      triggerRef,
      setTrigger,
      openNow: () => {
        window.clearTimeout(timerRef.current)
        setIsOpen(true)
      },
      scheduleClose: () => {
        window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setIsOpen(false), 150)
      },
      closeNow: () => {
        window.clearTimeout(timerRef.current)
        setIsOpen(false)
      },
    }),
    [isOpen, setIsOpen, setTrigger]
  )

  return (
    <DropdownMenuSubContext.Provider value={context}>
      {children}
    </DropdownMenuSubContext.Provider>
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  const sub = React.useContext(DropdownMenuSubContext)

  return (
    <div
      ref={sub?.setTrigger as never}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={sub?.open}
      tabIndex={-1}
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset ? "" : undefined}
      data-state={sub?.open ? "open" : "closed"}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)
        sub?.openNow()
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event)
        sub?.scheduleClose()
      }}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        sub?.openNow()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        const isRtl = event.currentTarget.closest('[dir="rtl"]') !== null
        const openKey = isRtl ? "ArrowLeft" : "ArrowRight"
        if (event.key === openKey || event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          sub?.openNow()
        }
      }}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:ps-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      {/* زیرمنو با side="right" منطقی باز می‌شود که در RTL خودکار به چپ
          می‌چرخد (resolvePhysicalSide در positioning.ts)؛ پس این فلش هم باید
          برعکسِ قبل بچرخد: در LTR (باز شدن به راست) چرخیده و به راست، در
          RTL (باز شدن به چپ) بدون چرخش و به چپ. */}
      <ChevronLeftIcon className="ms-auto size-4 rotate-180 rtl:rotate-0" />
    </div>
  )
}

function DropdownMenuSubContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const rootMenu = React.useContext(DropdownMenuContext)
  const sub = React.useContext(DropdownMenuSubContext)
  const { shouldRender, ref: presenceRef } = usePresence(Boolean(sub?.open))
  const contentRef = React.useRef<HTMLDivElement>(null)
  const typeahead = useMenuTypeahead()

  const position = useFloatingPosition(
    sub?.triggerRef ?? contentRef,
    contentRef,
    Boolean(sub?.open),
    { side: "right", align: "start", sideOffset: 2 }
  )

  React.useEffect(() => {
    if (!sub?.open) return
    return focusFirstItemOnceReady(() => contentRef.current)
  }, [sub?.open])

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node
      presenceRef(node)
    },
    [presenceRef]
  )

  if (!shouldRender) return null

  const finalSide = position?.side ?? "right"
  const finalAlign = position?.align ?? "start"

  return (
    <Portal>
      <div
        ref={setRefs}
        role="menu"
        tabIndex={-1}
        data-slot="dropdown-menu-sub-content"
        data-state={sub?.open ? "open" : "closed"}
        data-side={finalSide}
        onMouseEnter={() => sub?.openNow()}
        onMouseLeave={() => sub?.scheduleClose()}
        onKeyDown={(event) => {
          const isRtl = event.currentTarget.closest('[dir="rtl"]') !== null
          const closeKey = isRtl ? "ArrowRight" : "ArrowLeft"
          if (event.key === closeKey) {
            event.preventDefault()
            sub?.closeNow()
            sub?.triggerRef.current?.focus()
            return
          }
          // Escape کل زنجیرهٔ منو را می‌بندد، نه فقط همین تراز.
          if (event.key === "Escape") {
            event.preventDefault()
            rootMenu?.setOpen(false)
            return
          }
          handleMenuKeyDown(event, contentRef.current, typeahead)
        }}
        style={
          {
            position: "fixed",
            top: position ? position.y : 0,
            left: position ? position.x : 0,
            visibility: position ? "visible" : "hidden",
            "--dropdown-menu-content-transform-origin":
              transformOriginFor(finalSide, finalAlign),
          } as React.CSSProperties
        }
        className={cn(
          "z-(--z-overlay) min-w-[8rem] origin-(--dropdown-menu-content-transform-origin) overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-overlay data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
