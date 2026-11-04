"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon as ChevronDown, SparklesIcon as Sparkles, SquareIcon } from "@/components/icons"

import { cn } from "@/lib/utils"
import { toFaDigits } from "@/lib/persian"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * بلوکِ «در حال فکر کردن» مدل‌های استدلال‌گر (مثل Claude/o1): تا وقتی
 * state="thinking" است زمانِ سپری‌شده را خودش می‌شمارد و تیتر می‌پرزد؛ با
 * state="done" زمان می‌ایستد و تیتر می‌شود «فکر کرد برای N ثانیه». ردیف‌های
 * داخلش (ThinkingStep) گام‌به‌گامِ استدلال را نشان می‌دهند و پیش‌فرض بسته
 * است — چون معمولاً فقط جواب نهایی مهم است، نه مسیر رسیدن به آن.
 */

type ThinkingState = "thinking" | "done" | "stopped"

type ThinkingContextValue = {
  state: ThinkingState
  elapsed: number
}

const ThinkingContext = React.createContext<ThinkingContextValue>({
  state: "done",
  elapsed: 0,
})

function useElapsedSeconds(active: boolean, resetKey: unknown): number {
  const [elapsed, setElapsed] = React.useState(0)
  const startRef = React.useRef<number | null>(null)

  // صفرکردنِ شمارنده حین رندر انجام می‌شود، نه داخل افکت. با شروعِ یک
  // فکرِ تازه، همان رندر باید «۰ ثانیه» نشان بدهد؛ اگر به افکت موکول شود
  // یک فریم عددِ دورِ قبل دیده می‌شود و بعد می‌پرد.
  const [lastRun, setLastRun] = React.useState({ active, resetKey })
  if (lastRun.active !== active || lastRun.resetKey !== resetKey) {
    setLastRun({ active, resetKey })
    if (active) setElapsed(0)
  }

  React.useEffect(() => {
    if (!active) {
      startRef.current = null
      return
    }
    startRef.current = Date.now()
    // setElapsed اینجا صدا زده نمی‌شود؛ فقط تایمر وصل می‌شود. به‌روزرسانی
    // از دلِ خودِ تایمر می‌آید که یک سیستمِ خارجی است، نه بدنهٔ افکت.
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [active, resetKey])

  return elapsed
}

type ThinkingProps = React.ComponentProps<typeof Collapsible> & {
  /** thinking یعنی هنوز در حال کار است (زمان می‌شمارد)؛ done یعنی تمام شده. */
  state?: ThinkingState
  /**
   * مدت‌زمان نهایی به ثانیه، برای وقتی خودتان زمان را بیرون از این
   * کامپوننت اندازه گرفته‌اید (مثلاً از سرور). ندادنش یعنی خودش از لحظه‌ای
   * که state روی thinking می‌نشیند می‌شمارد.
   */
  duration?: number
}

function Thinking({
  state = "done",
  duration,
  defaultOpen = false,
  className,
  children,
  ...props
}: ThinkingProps) {
  const autoElapsed = useElapsedSeconds(state === "thinking", null)
  const elapsed = duration ?? autoElapsed

  const context = React.useMemo<ThinkingContextValue>(
    () => ({ state, elapsed }),
    [state, elapsed]
  )

  return (
    <ThinkingContext.Provider value={context}>
      <Collapsible
        data-slot="thinking"
        data-state-kind={state}
        defaultOpen={defaultOpen}
        className={cn("flex flex-col gap-1", className)}
        {...props}
      >
        {children}
      </Collapsible>
    </ThinkingContext.Provider>
  )
}

function ThinkingTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
  const { state, elapsed } = React.useContext(ThinkingContext)

  return (
    <CollapsibleTrigger
      data-slot="thinking-trigger"
      className={cn(
        "group flex w-fit cursor-pointer items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      {state === "stopped" ? (
        <SquareIcon className="size-3.5 shrink-0" />
      ) : (
        <Sparkles
          className={cn(
            "size-3.5 shrink-0",
            state === "thinking" && "animate-pulse text-primary"
          )}
        />
      )}
      {children ?? (
        <span data-shimmer={state === "thinking" ? "" : undefined}>
          {state === "thinking"
            ? "در حال فکر کردن…"
            : state === "stopped"
              ? "تفکر متوقف شد"
              : `فکر کرد برای ${toFaDigits(elapsed)} ثانیه`}
        </span>
      )}
      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  )
}

function ThinkingContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent data-slot="thinking-content" {...props}>
      <div
        className={cn(
          "ms-1.5 flex flex-col gap-2 border-s ps-4 pt-2 text-sm text-muted-foreground",
          className
        )}
      >
        {props.children}
      </div>
    </CollapsibleContent>
  )
}

type ThinkingStepStatus = "pending" | "active" | "done"

function ThinkingStepIcon({ status }: { status: ThinkingStepStatus }) {
  if (status === "active") return <span className="block size-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
  if (status === "done") return <CheckIcon className="text-success" />
  return <span className="block size-3.5 rounded-full border border-dashed border-muted-foreground" />
}

function ThinkingStep({
  icon,
  status,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  /** وضعیتِ گام؛ آیکونِ مناسبش را خودش می‌گذارد. با دادنِ icon همان آیکون جایش را می‌گیرد. */
  status?: ThinkingStepStatus
}) {
  const leading = icon ?? (status ? <ThinkingStepIcon status={status} /> : null)
  return (
    <div
      data-slot="thinking-step"
      data-status={status}
      aria-current={status === "active" ? "step" : undefined}
      className={cn(
        "flex items-start gap-2 leading-6",
        status === "pending" && "text-muted-foreground",
        className
      )}
      {...props}
    >
      {leading && <span className="mt-1 shrink-0 [&>svg]:size-3.5">{leading}</span>}
      <span>{children}</span>
    </div>
  )
}

/**
 * متنِ استدلالِ خامِ مدل (مثل بلوکِ فکرِ Claude): پاراگرافِ کم‌رنگ که با
 * streaming بزرگ می‌شود. streaming روشن باشد یک نشانگرِ چشمک‌زن ته‌ش می‌ماند.
 */
function ThinkingText({
  streaming = false,
  className,
  children,
  ...props
}: React.ComponentProps<"p"> & { streaming?: boolean }) {
  return (
    <p
      data-slot="thinking-text"
      className={cn("whitespace-pre-wrap leading-7", className)}
      {...props}
    >
      {children}
      {streaming && (
        <span
          aria-hidden
          className="ms-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse rounded-full bg-primary"
        />
      )}
    </p>
  )
}

export {
  Thinking,
  ThinkingTrigger,
  ThinkingContent,
  ThinkingStep,
  ThinkingText,
  type ThinkingProps,
  type ThinkingState,
  type ThinkingStepStatus,
}
