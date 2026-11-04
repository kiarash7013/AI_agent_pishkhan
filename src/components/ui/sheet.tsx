"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Dialog as Sheet,
  DialogClose as SheetClose,
  DialogContext,
  DialogDescription as SheetDescription,
  DialogPortal as SheetPortal,
  DialogTitle as SheetTitle,
  DialogTrigger as SheetTrigger,
} from "@/components/ui/dialog"
import { usePresence } from "@/lib/primitives/use-presence"
import { useFocusTrap } from "@/lib/primitives/use-focus-trap"
import { useDismissableLayer } from "@/lib/primitives/use-dismissable-layer"
import { useScrollLock } from "@/lib/primitives/use-scroll-lock"
import { XIcon } from "@/components/icons"

function SheetOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(DialogContext)
  const { shouldRender, ref } = usePresence(Boolean(context?.open))

  if (!shouldRender) return null

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="sheet-overlay"
      data-state={context?.open ? "open" : "closed"}
      className={cn(
        "fixed inset-0 z-(--z-overlay) bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "start",
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "top" | "end" | "bottom" | "start"
  /** بستن با کلیکِ بیرون همیشه فعاله؛ این فقط دکمهٔ × قابلِ‌رویتِ گوشه رو کنترل می‌کنه. */
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
    <SheetPortal>
      <SheetOverlay />
      <div
        ref={setRefs}
        role="dialog"
        aria-modal="true"
        aria-labelledby={context?.titleId}
        aria-describedby={context?.descriptionId}
        tabIndex={-1}
        data-slot="sheet-content"
        data-state={context?.open ? "open" : "closed"}
        className={cn(
          "fixed z-(--z-overlay) flex flex-col gap-4 bg-background shadow-overlay transition ease-in-out data-[state=closed]:duration-300 data-[state=closed]:animate-out data-[state=open]:duration-500 data-[state=open]:animate-in",
          side === "end" &&
            "inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm ltr:data-[state=closed]:slide-out-to-right ltr:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left",
          side === "start" &&
            "inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm ltr:data-[state=closed]:slide-out-to-left ltr:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            data-slot="sheet-close"
            onClick={() => context?.setOpen(false)}
            className="absolute top-2.5 end-2.5 flex size-10 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon className="size-4" />
            <span className="sr-only">بستن</span>
          </button>
        )}
      </div>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
