"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Slot } from "@/lib/primitives/slot"
import { Portal } from "@/lib/primitives/portal"
import { useControllableState } from "@/lib/primitives/use-controllable-state"
import { usePresence } from "@/lib/primitives/use-presence"
import { useFocusTrap } from "@/lib/primitives/use-focus-trap"
import { useDismissableLayer } from "@/lib/primitives/use-dismissable-layer"
import { useScrollLock } from "@/lib/primitives/use-scroll-lock"
import { XIcon } from "@/components/icons"

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descriptionId: string
  dismissOnOutsideClick: boolean
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  dismissOnOutsideClick = true,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  dismissOnOutsideClick?: boolean
}) {
  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const titleId = React.useId()
  const descriptionId = React.useId()

  const context = React.useMemo<DialogContextValue>(
    () => ({
      open: isOpen,
      setOpen: setIsOpen,
      titleId,
      descriptionId,
      dismissOnOutsideClick,
    }),
    [isOpen, setIsOpen, titleId, descriptionId, dismissOnOutsideClick]
  )

  return (
    <DialogContext.Provider value={context}>{children}</DialogContext.Provider>
  )
}

function DialogTrigger({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const context = React.useContext(DialogContext)
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      type="button"
      data-slot="dialog-trigger"
      aria-haspopup="dialog"
      aria-expanded={context?.open}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        context?.setOpen(true)
      }}
      {...props}
    />
  )
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  const context = React.useContext(DialogContext)
  if (!context) return null
  return <Portal>{children}</Portal>
}

function DialogClose({
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const context = React.useContext(DialogContext)
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      type="button"
      data-slot="dialog-close"
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        context?.setOpen(false)
      }}
      {...props}
    />
  )
}

function DialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(DialogContext)
  const { shouldRender, ref } = usePresence(Boolean(context?.open))

  if (!shouldRender) return null

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="dialog-overlay"
      data-state={context?.open ? "open" : "closed"}
      className={cn(
        "fixed inset-0 z-(--z-overlay) bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const context = React.useContext(DialogContext)
  const { shouldRender, ref: presenceRef } = usePresence(
    Boolean(context?.open)
  )
  const contentRef = React.useRef<HTMLDivElement>(null)

  useFocusTrap(contentRef, Boolean(context?.open))
  // shouldRender نه context.open: تا اسکرول وسط انیمیشنِ خروج باز نشود و
  // پس‌زمینه نپرد (usePresence تا پایان واقعیِ انیمیشن true نگهش می‌دارد).
  useScrollLock(shouldRender)
  useDismissableLayer({
    ref: contentRef,
    enabled: Boolean(context?.open),
    onDismiss: () => context?.setOpen(false),
    dismissOnOutsideClick: context?.dismissOnOutsideClick ?? true,
  })

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node
      presenceRef(node)
    },
    [presenceRef]
  )

  if (!shouldRender) return null

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={setRefs}
        role="dialog"
        aria-modal="true"
        aria-labelledby={context?.titleId}
        aria-describedby={context?.descriptionId}
        tabIndex={-1}
        data-slot="dialog-content"
        data-state={context?.open ? "open" : "closed"}
        className={cn(
          "fixed top-[50%] start-[50%] z-(--z-overlay) grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] rtl:translate-x-[50%] translate-y-[-50%] gap-4 rounded-2xl border bg-background p-6 shadow-overlay duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            data-slot="dialog-close"
            onClick={() => context?.setOpen(false)}
            className="absolute top-2.5 end-2.5 flex size-10 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">بستن</span>
          </button>
        )}
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-start",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClose asChild>
          <Button variant="outline">بستن</Button>
        </DialogClose>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const context = React.useContext(DialogContext)
  return (
    <h2
      id={context?.titleId}
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const context = React.useContext(DialogContext)
  return (
    <p
      id={context?.descriptionId}
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContext,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
