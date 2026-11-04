"use client"

import * as React from "react"
import {
  ArrowUpIcon as ArrowUp,
  PaperclipIcon as Paperclip,
  SquareIcon as Square,
} from "@/components/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * کامپوزرِ چت: textarea خودبزرگ‌شونده (field-sizing-content خودِ Textarea)
 * به‌علاوهٔ یک نوار ابزار زیرش. Enter می‌فرستد، Shift+Enter خط جدید
 * می‌گذارد — دقیقاً رفتار متداولِ کامپوزرهای چت، نه فرمِ معمولی.
 */

type PromptInputContextValue = {
  value: string
  setValue: (value: string) => void
  submit: () => void
  disabled?: boolean
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(
  null
)

type PromptInputProps = Omit<React.ComponentProps<"form">, "onSubmit"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** فرم فقط وقتی واقعاً متنی برای فرستادن هست صدا زده می‌شود (فاصلهٔ خالی حساب نمی‌شود). */
  onSubmit?: (value: string) => void
  disabled?: boolean
}

function PromptInput({
  className,
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  disabled,
  children,
  ...props
}: PromptInputProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : uncontrolled

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next)
      onValueChange?.(next)
    },
    [isControlled, onValueChange]
  )

  const submit = React.useCallback(() => {
    if (disabled || current.trim().length === 0) return
    onSubmit?.(current)
    if (!isControlled) setUncontrolled("")
  }, [current, disabled, isControlled, onSubmit])

  const context = React.useMemo<PromptInputContextValue>(
    () => ({ value: current, setValue, submit, disabled }),
    [current, setValue, submit, disabled]
  )

  return (
    <PromptInputContext.Provider value={context}>
      <form
        data-slot="prompt-input"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className={cn(
          // کادرِ بزرگِ نوشتن با فوکوسِ آرام (حاشیهٔ میانه و هالهٔ نرم)؛ خطِ دولایهٔ مشکیِ فیلدها روی این سطح خشن بود.
          "flex w-full flex-col gap-2 rounded-2xl border border-input bg-background p-2 shadow-control transition-[color,box-shadow,border-color] hover:border-[color-mix(in_oklab,var(--color-foreground)_30%,var(--color-background))] focus-within:border-[color-mix(in_oklab,var(--color-foreground)_45%,var(--color-background))] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-foreground)_7%,var(--color-background))] dark:bg-input dark:border-[color-mix(in_oklab,var(--color-foreground)_25%,var(--color-input))]",
          className
        )}
        {...props}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  )
}

function PromptInputTextarea({
  className,
  onKeyDown,
  placeholder = "پیام بنویسید…",
  ...props
}: React.ComponentProps<typeof Textarea>) {
  const context = React.useContext(PromptInputContext)

  return (
    <Textarea
      data-slot="prompt-input-textarea"
      variant="flat"
      rows={1}
      placeholder={placeholder}
      value={context?.value}
      onValueChange={context?.setValue}
      disabled={context?.disabled}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault()
          context?.submit()
        }
      }}
      className={cn(
        "max-h-48 min-h-9 resize-none border-none bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0",
        className
      )}
      {...props}
    />
  )
}

function PromptInputToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input-toolbar"
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    />
  )
}

function PromptInputTools({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prompt-input-tools"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

function PromptInputAttachButton({
  className,
  label = "پیوست فایل",
  ...props
}: Omit<React.ComponentProps<"button">, "color"> & { label?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      className={cn("rounded-full text-muted-foreground", className)}
      {...props}
    >
      <Paperclip />
    </Button>
  )
}

type PromptInputModel = { value: string; label: string }

function PromptInputModelPicker({
  models,
  value,
  onValueChange,
  className,
}: {
  models: PromptInputModel[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}) {
  const current = models.find((m) => m.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-10 gap-1 rounded-full px-3 text-sm text-muted-foreground", className)}
        >
          {current?.label ?? value}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {models.map((model) => (
            <DropdownMenuRadioItem key={model.value} value={model.value}>
              {model.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * دکمهٔ ارسال؛ وقتی streaming=true به دکمهٔ توقف (مربع) تبدیل می‌شود و
 * onStop را صدا می‌زند — همان الگوی رایج چت‌بات‌ها حین دریافت پاسخ.
 */
function PromptInputSubmitButton({
  className,
  streaming = false,
  onStop,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & {
  streaming?: boolean
  onStop?: () => void
}) {
  const context = React.useContext(PromptInputContext)
  const canSubmit = !context?.disabled && (context?.value.trim().length ?? 0) > 0

  if (streaming) {
    return (
      <Button
        type="button"
        size="icon-lg"
        aria-label="توقف"
        onClick={onStop}
        className={cn("rounded-full", className)}
        {...props}
      >
        <Square className="fill-current" />
      </Button>
    )
  }

  return (
    <Button
      type="submit"
      size="icon-lg"
      aria-label="ارسال"
      disabled={!canSubmit}
      className={cn("rounded-full", className)}
      {...props}
    >
      <ArrowUp />
    </Button>
  )
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputAttachButton,
  PromptInputModelPicker,
  PromptInputSubmitButton,
  type PromptInputProps,
  type PromptInputModel,
}
