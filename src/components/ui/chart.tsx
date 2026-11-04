"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import ReactECharts from "echarts-for-react"
import { getInstanceByDom } from "echarts"
import type { EChartsOption, CustomSeriesOption, TooltipComponentOption } from "echarts"
import { renderToStaticMarkup } from "react-dom/server"

import { cn } from "@/lib/utils"
import { toFaDigits } from "@/lib/persian"

/**
 * موتور نمودار ECharts است، نه Recharts — چون Bar/Line/Pie تنها بخشی از
 * نیاز داشبوردهای بانکی/عملیاتی است؛ candlestick، gauge، heatmap و دیتای
 * حجیم بدون افت کارایی هم لازم می‌شود. برای همین نمودار دیگ با
 * یک آبجکت `option` توصیفی ساخته می‌شود، نه با ترکیب JSX.
 */
export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
    /** رنگ ثابت یا var(--token)؛ چون رندر روی canvas است، var() اینجا در زمان اجرا محاسبه می‌شود. */
    color?: string
  }
>

type ChartContextValue = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart باید داخل <ChartContainer> استفاده شود.")
  }
  return context
}

const EXTRA_VARS = [
  "--background",
  "--border",
  "--muted",
  "--muted-foreground",
  "--destructive",
  "--primary",
  "--card",
  "--foreground",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
] as const

/** Rounded OHLC bodies using the supported ECharts custom-series renderer. */
export function roundedCandlestickSeries(data: [number, number, number, number][]): CustomSeriesOption {
  return {
    type: "custom",
    name: "قیمت",
    clip: true,
    dimensions: ["روز", "باز", "بسته", "کمینه", "بیشینه"],
    encode: { x: 0, y: [1, 2, 3, 4], tooltip: [1, 2, 3, 4] },
    data: data.map((point, index) => [index, ...point]),
    renderItem: (_params, api) => {
      const index = Number(api.value(0))
      const open = api.coord([index, api.value(1)])
      const close = api.coord([index, api.value(2)])
      const low = api.coord([index, api.value(3)])
      const high = api.coord([index, api.value(4)])
      const size = api.size?.([1, 0]) as number[] | undefined
      const width = Math.min(28, Math.abs(size?.[0] ?? 20) * 0.55)
      const height = Math.max(1, Math.abs(close[1] - open[1]))
      const color = Number(api.value(2)) >= Number(api.value(1)) ? "#22a06b" : "#e5484d"
      return { type: "group", children: [
        { type: "line", shape: { x1: low[0], y1: low[1], x2: high[0], y2: high[1] }, style: { stroke: color, lineWidth: 1.2 } },
        { type: "rect", shape: { x: open[0] - width / 2, y: Math.min(open[1], close[1]), width, height, r: Math.min(3, height / 2, width / 2) }, style: { fill: color } },
      ] }
    },
    tooltip: {
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params
        const values = item.value as number[]
        return renderChartTooltip(item.name, ["باز", "بسته", "کمینه", "بیشینه"].map((label, i) => ({ label, value: toFaDigits(values[i + 1]) })))
      },
    },
  }
}

/** کلیدِ پوستهٔ فعلی از کلاس و data-dark-theme روی <html>؛ با هر تعویض عوض می‌شود. */
function useHtmlThemeKey() {
  return React.useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-dark-theme"] })
      return () => observer.disconnect()
    },
    () =>
      `${document.documentElement.classList.contains("dark") ? "dark" : "light"}|${document.documentElement.dataset.darkTheme ?? ""}`,
    // هم‌شکلِ مقدارِ کلاینت در حالتِ پیش‌فرض؛ وگرنه بعد از hydrate کلید عوض می‌شد
    // و نمودار یک بارِ دیگر از نو ساخته و انیمیت می‌شد (دو بار لود).
    () => "light|"
  )
}

/** رنگ‌های config (و چند متغیر پایه‌ی محور/خط شبکه) را از CSS variable به مقدار محاسبه‌شده تبدیل می‌کند. */
function useResolvedTokens(
  config: ChartConfig,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const { resolvedTheme } = useTheme()
  const [tokens, setTokens] = React.useState<Record<string, string>>({})
  // پروژه‌ای که next-themes ندارد و فقط کلاسِ dark (یا data-dark-theme) را روی <html>
  // عوض می‌کند هم باید رنگ‌های نمودار را تازه کند؛ همان کلاس منبعِ حقیقت است.
  const htmlTheme = useHtmlThemeKey()

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const styles = getComputedStyle(node)
    const next: Record<string, string> = {}

    // getPropertyValue روی یک custom property تو‌در‌تو فقط رشته‌ای مثل
    // `var(--brand-500)` برمی‌گرداند. Canvas و محاسبهٔ رنگ emphasis در
    // ECharts به رنگ نهایی نیاز دارند؛ یک probe واقعی مرورگر تمام زنجیرهٔ
    // var()، color-mix() و فضای رنگی تم را به rgb نهایی تبدیل می‌کند.
    const colorProbe = document.createElement("span")
    colorProbe.setAttribute("aria-hidden", "true")
    colorProbe.style.cssText =
      "position:absolute;inline-size:0;block-size:0;overflow:hidden;pointer-events:none;visibility:hidden"
    node.appendChild(colorProbe)

    // مرورگرِ امروزی رنگِ oklch را به‌صورتِ lab(...) برمی‌گرداند و canvasِ
    // ECharts آن را نمی‌فهمد و سیاه می‌کشد؛ رنگ را روی یک پیکسل می‌کشیم و
    // rgbaِ همان پیکسل را می‌خوانیم که همه‌جا فهمیده می‌شود.
    const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    const toRgba = (color: string) => {
      if (!pixel || !color) return color
      pixel.clearRect(0, 0, 1, 1)
      pixel.fillStyle = color
      pixel.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data
      return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`
    }

    const resolveColor = (value: string) => {
      colorProbe.style.color = ""
      colorProbe.style.color = value
      return toRgba(getComputedStyle(colorProbe).color || value)
    }

    for (const [key, item] of Object.entries(config)) {
      if (!item.color) continue
      const color = resolveColor(item.color)
      next[key] = color
      // خودِ رشتهٔ رنگ هم کلید می‌شود تا var(--chart-3)ِ داخلِ option جایگزین شود.
      next[item.color] = color
      next[`${key}--emphasis`] = resolveColor(
        `color-mix(in srgb, ${color} 82%, black)`
      )
    }

    for (const varName of EXTRA_VARS) {
      const value = styles.getPropertyValue(varName).trim()
      next[varName] = value ? resolveColor(`var(${varName})`) : value
    }

    colorProbe.remove()

    next["fontFamily"] = styles.fontFamily
    setTokens(next)
    let disposed = false
    const syncFont = () => {
      if (disposed) return
      const fontFamily = getComputedStyle(node).fontFamily
      setTokens(previous => previous.fontFamily === fontFamily ? previous : { ...previous, fontFamily })
    }
    const observer = new MutationObserver(syncFont)
    // Font switches may live on html, body, or a scoped provider.
    for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ["class", "style", "data-font"] })
    }
    document.fonts.ready.then(syncFont)
    document.fonts.addEventListener("loadingdone", syncFont)
    return () => {
      disposed = true
      observer.disconnect()
      document.fonts.removeEventListener("loadingdone", syncFont)
    }
    // resolvedTheme فقط برای اجرای دوباره بعد از تعویض تم لازم است؛ کلاس
    // dark سنکرون با آن روی <html> عوض می‌شود و رنگ‌های CSS تازه می‌شوند.
  }, [config, resolvedTheme, htmlTheme, containerRef])

  return tokens
}

type BarTooltipParam = { seriesType?: string; seriesIndex?: number; dataIndex?: number }
type BarLayout = { x: number; y: number; width: number; height: number }

/**
 * تولتیپ ستونی باید درست بالای همان ستونی بنشیند که ماوس رویش است، نه
 * جایی که مکان‌نما هست (پیش‌فرض ECharts)؛ وگرنه روی ستون‌های کوتاه تولتیپ
 * بالای نمودار می‌پرد و روی عنوان کارت می‌افتد و معلوم نیست مال کدام ستون
 * است.
 *
 * جای واقعی ستون از layout خودِ سری خوانده می‌شود، پس برای ستون‌های
 * پشته‌ای و گروهی هم درست است: بالای بلندترین ستون و وسط گروه. فقط
 * وقتی نمودار سری ستونی دارد نصب می‌شود؛ اگر ستونی زیر مکان‌نما نبود،
 * تولتیپ کنار مکان‌نما می‌نشیند.
 */
function barTooltipPosition(
  point: number[],
  params: BarTooltipParam | BarTooltipParam[],
  dom: HTMLElement,
  _rect: unknown,
  size: { contentSize: number[]; viewSize: number[] }
): number[] {
  const nearPointer = [point[0] + 12, point[1] + 12]
  // تولتیپ HTML داخل ظرفِ خودِ نمودار ساخته می‌شود، پس نمونهٔ ECharts را
  // از همان DOM پیدا می‌کنیم؛ بدون نگه‌داشتن ref در رندر.
  const host = dom?.closest?.("[data-slot=chart]")?.querySelector<HTMLElement>(".dig-echarts")
  const chart = host ? getInstanceByDom(host) : undefined
  const bars = (Array.isArray(params) ? params : [params]).filter(
    (param) => param.seriesType === "bar" && param.seriesIndex !== undefined && param.dataIndex !== undefined
  )
  if (!chart || bars.length === 0) return nearPointer

  let top = Infinity
  let start = Infinity
  let end = -Infinity
  for (const bar of bars) {
    // getModel عمومی مستند نشده ولی پایدار است و تنها راهِ خواندن مستطیلِ
    // رسم‌شدهٔ ستون؛ اگر روزی نبود، به جای پیش‌فرض برمی‌گردیم.
    const model = (chart as unknown as {
      getModel?: () => { getSeriesByIndex: (index: number) => { getData: () => { getItemLayout: (index: number) => BarLayout | undefined } } | undefined }
    }).getModel?.()
    const layout = model?.getSeriesByIndex(bar.seriesIndex!)?.getData().getItemLayout(bar.dataIndex!)
    if (!layout || !Number.isFinite(layout.x)) continue
    top = Math.min(top, layout.y, layout.y + layout.height)
    start = Math.min(start, layout.x, layout.x + layout.width)
    end = Math.max(end, layout.x, layout.x + layout.width)
  }
  if (!Number.isFinite(top)) return nearPointer

  const [width, height] = size.contentSize
  const [viewWidth, viewHeight] = size.viewSize
  const gap = 8
  const clampX = (x: number) => Math.min(Math.max(x, 0), Math.max(viewWidth - width, 0))

  // جای اول: درست بالای ستون، وسطِ گروه.
  if (top - height - gap >= 0) {
    return [clampX((start + end) / 2 - width / 2), top - height - gap]
  }

  // ستون بلند است و بالایش جا نیست: کنارِ همان ستون، هم‌ترازِ سرش، تا
  // تولتیپ روی خودِ ستون نیفتد و آن را نپوشاند. سمتی که جا دارد انتخاب می‌شود.
  const y = Math.min(Math.max(top, 0), Math.max(viewHeight - height, 0))
  if (end + gap + width <= viewWidth) return [end + gap, y]
  if (start - gap - width >= 0) return [start - gap - width, y]
  return [clampX((start + end) / 2 - width / 2), 0]
}

/** رنگ config را روی سری‌های هم‌نام تزریق می‌کند، مگر این‌که سری خودش رنگ داشته باشد. */
/**
 * هر رشتهٔ «var(--x)» در option را با رنگِ حل‌شده عوض می‌کند. canvas متغیرِ
 * CSS نمی‌فهمد و آن را سیاه می‌کشد؛ رنگی که پریست‌ها یا مصرف‌کننده مستقیم در
 * itemStyle یا lineStyle می‌دهند هم باید از این راه رد شود.
 */
function resolveCssVars<T>(value: T, tokens: Record<string, string>): T {
  if (typeof value === "string") {
    const match = /^var\((--[\w-]+)\)$/.exec(value.trim())
    if (!match) return value
    return (tokens[value.trim()] ?? tokens[match[1]] ?? value) as T
  }
  if (Array.isArray(value)) return value.map((item) => resolveCssVars(item, tokens)) as T
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) out[key] = resolveCssVars(item, tokens)
    return out as T
  }
  return value
}

function withThemedSeries(
  option: EChartsOption,
  tokens: Record<string, string>,
  config: ChartConfig
): EChartsOption {
  const palette = Object.keys(config)
    .map((key) => tokens[key])
    .filter(Boolean)

  const series = option.series
  const hasBarSeries = (Array.isArray(series) ? series : series ? [series] : []).some(
    (s) => s.type === "bar"
  )
  const themedSeries = Array.isArray(series)
    ? series.map((s, seriesIndex) => {
        const isPie = s.type === "pie"
        const name = typeof s.name === "string" ? s.name : undefined
        const color = name ? tokens[name] : undefined
        const emphasisColor = name ? tokens[`${name}--emphasis`] : undefined
        const hasOwnColor =
          (s as { itemStyle?: { color?: unknown } }).itemStyle?.color ??
          (s as { color?: unknown }).color

        const sourceEmphasis = (s as {
          emphasis?: {
            itemStyle?: Record<string, unknown>
            lineStyle?: Record<string, unknown>
            areaStyle?: Record<string, unknown>
            [key: string]: unknown
          }
        }).emphasis

        const resolvedSeriesColor =
          typeof hasOwnColor === "string" ? hasOwnColor : color
        const resolvedEmphasisColor = emphasisColor ?? resolvedSeriesColor

        // رنگ state فعال را صریح می‌دهیم تا ECharts برای hover دوباره آن را
        // با liftColor نسازد. focus:none نیز از blur شدن داده‌های دیگر جلوگیری
        // می‌کند؛ تنظیم سفارشی مصرف‌کننده در هر style اولویت دارد.
        const emphasis = (s as { emphasis?: Record<string, unknown> }).emphasis
        const stableInteraction = {
          ...s,
          ...(s.type === "gauge" ? {
            pointer: {
              icon: "roundRect",
              width: 5,
              length: "62%",
              ...s.pointer,
            },
            anchor: { show: true, size: 9, itemStyle: { color: tokens["--foreground"] }, ...s.anchor },
            axisLine: { ...s.axisLine, roundCap: true },
            progress: { ...s.progress, roundCap: true },
            axisLabel: { formatter: (value: number) => toFaDigits(value), ...s.axisLabel },
            detail: { formatter: (value: number) => toFaDigits(value), ...s.detail },
          } : {}),
          ...(s.type === "heatmap" ? {
            label: { formatter: (params: { value: unknown }) => toFaDigits(Array.isArray(params.value) ? params.value[2] : String(params.value)), ...s.label },
          } : {}),
          ...(s.type === "line" ? { symbolSize: 7, ...s, lineStyle: { width: 2.5, ...s.lineStyle } } : {}),
          itemStyle: {
            ...(s.type === "bar" ? { borderRadius: [4, 4, 0, 0] } : {}),
            ...(s.type === "pie" ? { borderRadius: 5, borderWidth: 2, borderColor: tokens["--background"] } : {}),
            ...(s.type === "scatter" ? { opacity: 0.8, borderWidth: 1.5, borderColor: tokens["--background"] } : {}),
            ...(s as { itemStyle?: Record<string, unknown> }).itemStyle,
          },
          emphasis: {
            focus: "none" as const,
            ...(isPie ? { scale: false } : undefined),
            ...emphasis,
            itemStyle: {
              ...((isPie ? resolvedSeriesColor : resolvedEmphasisColor)
                ? {
                    color: isPie
                      ? resolvedSeriesColor
                      : resolvedEmphasisColor,
                  }
                : undefined),
              ...sourceEmphasis?.itemStyle,
            },
            lineStyle: {
              ...(resolvedEmphasisColor
                ? { color: resolvedEmphasisColor }
                : undefined),
              ...sourceEmphasis?.lineStyle,
            },
            areaStyle: {
              ...(resolvedEmphasisColor
                ? { color: resolvedEmphasisColor }
                : undefined),
              ...sourceEmphasis?.areaStyle,
            },
          },
          data: Array.isArray(s.data)
            ? s.data.map((datum, dataIndex) => {
                if (!datum || typeof datum !== "object" || Array.isArray(datum)) {
                  return datum
                }
                const dataName =
                  typeof datum.name === "string" ? datum.name : undefined
                const dataColor =
                  (dataName ? tokens[dataName] : undefined) ??
                  (palette.length
                    ? palette[(seriesIndex + dataIndex) % palette.length]
                    : undefined)
                const dataEmphasisColor =
                  (dataName ? tokens[`${dataName}--emphasis`] : undefined) ??
                  dataColor
                const datumEmphasis = (datum as {
                  emphasis?: { itemStyle?: Record<string, unknown> }
                }).emphasis

                return {
                  ...datum,
                  itemStyle: {
                    ...(datum as { itemStyle?: Record<string, unknown> })
                      .itemStyle,
                    ...(dataColor ? { color: dataColor } : undefined),
                  },
                  emphasis: {
                    ...datumEmphasis,
                    itemStyle: {
                      ...(dataEmphasisColor
                        ? { color: dataEmphasisColor }
                        : undefined),
                      ...datumEmphasis?.itemStyle,
                    },
                  },
                }
              })
            : s.data,
        } as typeof s

        if (!color || hasOwnColor) return stableInteraction
        return {
          ...stableInteraction,
          itemStyle: {
            ...(stableInteraction as { itemStyle?: object }).itemStyle,
            color,
          },
          lineStyle: s.type === "line" ? { ...(s as { lineStyle?: object }).lineStyle, color } : (s as { lineStyle?: object }).lineStyle,
        }
      })
    : series

  const axisDefaults = {
    axisLabel: { color: tokens["--muted-foreground"], formatter: (value: string | number) => toFaDigits(value) },
    axisLine: { lineStyle: { color: tokens["--border"] } },
    axisTick: { show: false, lineStyle: { color: tokens["--border"] } },
    splitLine: { lineStyle: { color: tokens["--border"], opacity: 0.45, type: "dashed" } },
  }

  const withAxisDefaults = <T,>(axis: T): T =>
    (Array.isArray(axis)
      ? axis.map((a) => ({ ...axisDefaults, ...a, axisLabel: { ...axisDefaults.axisLabel, ...a.axisLabel } }))
      : axis
        ? { ...axisDefaults, ...axis, axisLabel: { ...axisDefaults.axisLabel, ...(axis as { axisLabel?: object }).axisLabel } }
        : axis) as T

  return {
    // Preserve ECharts’ default palette when config has no colors.
    // An explicit undefined overrides that palette and hides gauge graphics.
    ...(palette.length ? { color: palette } : {}),
    // interpolation پیش‌فرض stateها گاهی بین رنگ normal و emphasis از یک
    // فریم شفاف عبور می‌کند و به‌شکل blink دیده می‌شود. تغییر رنگ مستقیم است؛
    // مصرف‌کننده در صورت نیاز می‌تواند duration دلخواه خودش را برگرداند.
    stateAnimation: { duration: 0 },
    ...option,
    textStyle: { fontFamily: tokens.fontFamily, color: tokens["--foreground"], ...option.textStyle },
    tooltip:
      option.tooltip && !Array.isArray(option.tooltip)
        ? {
            confine: true,
            enterable: false,
            transitionDuration: 0.12,
            ...(hasBarSeries
              ? { position: barTooltipPosition as unknown as TooltipComponentOption["position"] }
              : {}),
            ...option.tooltip,
            // The HTML formatter owns the only visible tooltip surface.
            renderMode: "html",
            backgroundColor: "transparent",
            borderWidth: 0,
            padding: 0,
            extraCssText: "box-shadow:none;border:0;padding:0;background:transparent;font-family:inherit;",

            // Bar series در ECharts برای axis tooltip به‌صورت پیش‌فرض یک
            // shadow pointer می‌سازند. روی تم روشن، آن سایه مثل یک نوار سفید
            // کدر روی خود ستون‌ها می‌افتد و دادهٔ hoverشده را «نامرئی» نشان
            // می‌دهد. نشانگر خطی موقعیت را حفظ می‌کند بدون اینکه داده را بپوشاند.
            axisPointer:
              option.tooltip.trigger === "axis"
                ? {
                    type: "line",
                    lineStyle: {
                      color: tokens["--border"],
                      width: 1,
                      type: "dashed",
                    },
                    ...option.tooltip.axisPointer,
                  }
                : option.tooltip.axisPointer,
          }
        : option.tooltip,
    xAxis: withAxisDefaults(option.xAxis),
    yAxis: withAxisDefaults(option.yAxis),
    series: themedSeries,
  }
}

/** شکلِ نشانگرِ رنگِ هر ردیف در تولتیپ. */
export type ChartTooltipIndicator = "dot" | "line" | "dashed" | "none"

export type ChartTooltipRow = {
  label: React.ReactNode
  value: React.ReactNode
  color?: string
  /** آیکونِ این ردیف؛ اگر باشد جای نشانگرِ رنگ می‌نشیند. */
  icon?: React.ReactNode
}

export type ChartTooltipRenderOptions = {
  indicator?: ChartTooltipIndicator
  /** ردیفِ پایانی جدا با خط، مثلاً «جمع». */
  footer?: { label: React.ReactNode; value: React.ReactNode }
}

function TooltipIndicator({ indicator, color }: { indicator: ChartTooltipIndicator; color?: string }) {
  if (indicator === "none" || !color) return null
  if (indicator === "line") return <span className="w-1 shrink-0 self-stretch rounded-[2px]" style={{ background: color }} />
  if (indicator === "dashed") return <span className="w-0 shrink-0 self-stretch border-s-[1.5px] border-dashed" style={{ borderColor: color }} />
  return <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
}

/** Shared HTML content for every Dig chart tooltip. React escapes labels and values. */
export function renderChartTooltip(title: React.ReactNode, rows: ChartTooltipRow[], options: ChartTooltipRenderOptions = {}) {
  const indicator = options.indicator ?? "dot"
  return renderToStaticMarkup(
    <div data-slot="chart-tooltip" data-indicator={indicator} dir="rtl" className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-panel">
      {title && <p className="font-medium">{title}</p>}
      {rows.map((row, index) => <div key={index} className={cn("flex gap-1.5", indicator === "line" || indicator === "dashed" ? "items-stretch" : "items-center")}>
        {row.icon ? <span className="flex size-3 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-3">{row.icon}</span> : <TooltipIndicator indicator={indicator} color={row.color} />}
        <span className="text-muted-foreground">{row.label}</span>
        <span className="ms-auto ps-3 font-medium tabular-nums">{row.value}</span>
      </div>)}
      {options.footer && <div className="mt-0.5 flex items-center gap-1.5 border-t border-border/60 pt-1.5">
        <span className="text-muted-foreground">{options.footer.label}</span>
        <span className="ms-auto ps-3 font-semibold tabular-nums">{options.footer.value}</span>
      </div>}
    </div>
  )
}

/**
 * نشانگرِ محورِ زیرِ ماوس:
 * • line: خطِ نقطه‌چینِ عمودی (پیش‌فرض)
 * • band: نوارِ پرِ کم‌رنگ پشتِ کلِ دسته؛ برای نمودار میله‌ای خواناتر است و
 *   چون پشتِ سری‌ها کشیده می‌شود، میله را نمی‌پوشاند.
 * • none: هیچ.
 */
export type ChartCursor = "line" | "band" | "none"

function cursorPointer(cursor: ChartCursor) {
  if (cursor === "none") return { type: "none" as const }
  if (cursor === "band") {
    // z پایین‌تر از سری‌ها (۲) تا نوار پشتِ میله‌ها بیفتد، نه رویشان.
    return { type: "shadow" as const, z: 0, shadowStyle: { color: "var(--muted)", opacity: 1 } }
  }
  return { type: "line" as const }
}

function ChartContainer({
  config,
  option,
  tooltip,
  cursor,
  defaultTooltipIndex,
  className,
  onChartReady,
  onEvents,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  option: EChartsOption
  /** ظاهرِ تولتیپِ پیش‌فرض؛ اگر option.tooltip.formatter خودش را بدهد، این بی‌اثر است. */
  tooltip?: ChartTooltipOptions
  /** نشانگرِ محور در تولتیپِ axis؛ نبودش یعنی همان خطِ نقطه‌چینِ پیش‌فرض. */
  cursor?: ChartCursor
  /**
   * تولتیپِ این اندیسِ داده از اول باز باشد؛ برای نمایشِ مقدارِ امروز یا
   * نمونه‌های مستندات. با اولین حرکتِ ماوس رفتارِ عادی برمی‌گردد.
   */
  defaultTooltipIndex?: number
  onChartReady?: (instance: ReturnType<ReactECharts["getEchartsInstance"]>) => void
  /** رویدادهای ECharts، مثلاً { click: (params) => … } برای انتخابِ برش یا میله. */
  onEvents?: Record<string, (params: unknown) => void>
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<ReactECharts>(null)
  const tokens = useResolvedTokens(config, containerRef)
  // با عوضِ شدنِ پوسته نمودار از نو ساخته می‌شود؛ به‌روزرسانیِ درجا گاهی بومِ خالی می‌داد.
  const themeKey = useHtmlThemeKey()

  const defaultTooltipFormatter = useChartTooltipFormatter(config, tooltip)

  const resolvedOption = React.useMemo(
    () => resolveCssVars(withThemedSeries({ ...option, tooltip: option.tooltip && !Array.isArray(option.tooltip)
      ? {
          formatter: defaultTooltipFormatter,
          ...(cursor && option.tooltip.trigger === "axis" ? { axisPointer: cursorPointer(cursor) } : {}),
          ...option.tooltip,
        } : option.tooltip }, tokens, config), tokens),
    [option, tokens, config, defaultTooltipFormatter, cursor]
  )

  React.useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance().resize()
    })
    observer.observe(node)
    const redraw = () => chartRef.current?.getEchartsInstance().resize()
    document.fonts.addEventListener("loadingdone", redraw)
    let active = true
    document.fonts.ready.then(() => { if (active) redraw() })
    return () => {
      active = false
      observer.disconnect()
      document.fonts.removeEventListener("loadingdone", redraw)
    }
  }, [])

  // وقتی option عوض می‌شود (تعویضِ سری در نمودارِ تعاملی، دادهٔ تازه، تمِ تازه)،
  // ECharts تولتیپِ باز را با اندیس‌های مدلِ قبلی دوباره نشان می‌دهد و اگر آن
  // داده دیگر نباشد، خطای getRawIndex می‌دهد. پیش از رندرِ تازه می‌بندیمش؛
  // با حرکتِ بعدیِ ماوس دوباره باز می‌شود.
  const firstOption = React.useRef(true)
  React.useLayoutEffect(() => {
    if (firstOption.current) {
      firstOption.current = false
      return
    }
    chartRef.current?.getEchartsInstance().dispatchAction({ type: "hideTip" })
  }, [resolvedOption])

  React.useEffect(() => {
    if (defaultTooltipIndex === undefined || !tokens.fontFamily) return
    // بعد از انیمیشنِ ورود، وگرنه تولتیپ جای میله‌ای که هنوز بالا نیامده می‌نشیند.
    const timer = setTimeout(() => {
      chartRef.current?.getEchartsInstance().dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: defaultTooltipIndex })
    }, 900)
    return () => clearTimeout(timer)
  }, [defaultTooltipIndex, tokens, themeKey])

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={containerRef}
        data-slot="chart"
        dir="ltr"
        className={cn(
          "h-64 w-full [&_.dig-echarts]:h-full [&_.dig-echarts]:w-full",
          className
        )}
        {...props}
      >
        <ReactECharts
          key={themeKey}
          ref={chartRef}
          className="dig-echarts"
          option={resolvedOption}
          // lazyUpdate نه: بینِ setOption و فریمِ بعد، مدلِ سریِ تازه هست ولی داده‌اش
          // هنوز پردازش نشده؛ حرکتِ ماوس در همان فاصله تولتیپ را با خطای
          // getRawIndex می‌شکست (تعویضِ سری در نمودارِ تعاملی، hot reload).
          replaceMerge={["series"]}
          style={{ height: "100%", width: "100%" }}
          onChartReady={onChartReady}
          onEvents={onEvents}
        />
      </div>
    </ChartContext.Provider>
  )
}

type TooltipParam = {
  dimensionNames?: string[]
  seriesType?: string
  seriesName?: string
  name?: string
  value?: unknown
  color?: string
  marker?: string
}

/**
 * فرمترِ تولتیپ ECharts را می‌سازد: چون تولتیپ روی یک لایهٔ DOM جدا (نه
 * درخت ری‌اکت خودمان) رندر می‌شود، به‌جای JSX یک HTML string با
 * renderToStaticMarkup تولید می‌کنیم؛ کلاس‌های Tailwind همان استایل سراسری
 * صفحه را می‌گیرند چون گلوبال‌اند، نه اسکوپ‌شده به درخت React.
 */
const defaultFormatValue = (v: string | number) => toFaDigits(v)

export type ChartTooltipOptions = {
  /** شکلِ نشانگرِ رنگ: dot (پیش‌فرض)، line، dashed یا none. */
  indicator?: ChartTooltipIndicator
  /** تیترِ تولتیپ (برچسبِ محور) پنهان شود. */
  hideLabel?: boolean
  /** تیتر را عوض می‌کند؛ مثلاً «تیر» را به «تیرِ ۱۴۰۳» یا تاریخِ کامل. */
  labelFormatter?: (label: string) => React.ReactNode
  /** قالبِ مقدارِ هر ردیف؛ پیش‌فرض عددِ فارسی. */
  formatValue?: (value: string | number, key: string) => React.ReactNode
  /** ردیفِ «جمع» در پایین؛ true یعنی برچسبِ «جمع»، رشته یعنی برچسبِ دلخواه. */
  showTotal?: boolean | string
}

function useChartTooltipFormatter(
  config: ChartConfig,
  // تابع برای سازگاری با نسخهٔ قبل (فقط formatValue)؛ آبجکت برای بقیهٔ گزینه‌ها.
  options?: ChartTooltipOptions | ((value: string | number) => React.ReactNode)
) {
  const opts: ChartTooltipOptions = typeof options === "function" ? { formatValue: options } : options ?? {}
  // ثابتِ ماژول، نه یک آروفانکشنِ تازه به‌عنوان مقدار پیش‌فرض:
  // اگر فراخواننده formatValue ندهد، رفرنسش هر رندر عوض می‌شد و useCallback
  // بی‌اثر می‌شد؛ آن‌وقت formatter هر رندر رفرنس تازه می‌گرفت و مقایسهٔ
  // deep-equal داخلیِ echarts-for-react هرگز true نمی‌شد و setOption دوباره
  // صدا زده می‌شد (انیمیشنِ ورودیِ میله‌ها نیمه‌کاره می‌ماند).
  const formatValue = opts.formatValue ?? defaultFormatValue
  const { indicator, hideLabel, labelFormatter, showTotal } = opts
  // پارامتر عمداً unknown است: تایپ رسمی ECharts برای TopLevelFormatterParams
  // از پکیج export نمی‌شود؛ unknown هم برای سازگاری با option.tooltip.formatter
  // کافی است و هم برخلاف any مجبورمان می‌کند قبل از استفاده تایپ را باریک کنیم.
  return React.useCallback(
    (params: unknown) => {
      const items: TooltipParam[] = Array.isArray(params) ? params : [params]

      // برای axis-trigger (بار/لاین)، seriesName کلید واقعیِ config است و name
      // برچسبِ محور (مثلاً «تیر») که نباید داخل config جست‌وجو شود. ولی برای
      // item-trigger (پای/دونات)، ECharts وقتی روی سری name نمی‌گذاریم یک
      // seriesName ساختگی مثل «series0» می‌سازد؛ آنجا کلید واقعی همان name
      // نقطهٔ داده است. پس هرکدام که واقعاً در config باشد برنده می‌شود.
      const resolveKey = (item: TooltipParam, index: number) => {
        if (item.seriesName && item.seriesName in config) return item.seriesName
        if (item.name && item.name in config) return item.name
        return item.seriesName ?? item.name ?? String(index)
      }

      // تیتر فقط برای axis-trigger معنا دارد (برچسب محور)؛ در item-trigger
      // تک‌آیتمی، name همان کلیدِ همان ردیف است و تکرارش فقط شلوغی است.
      const firstItem = items[0]
      const isSingleItemKey =
        items.length === 1 && !!firstItem?.name && firstItem.name in config
      const rawLabel = isSingleItemKey || hideLabel ? undefined : firstItem?.name
      const label = rawLabel && labelFormatter ? labelFormatter(rawLabel) : rawLabel

      let total = 0
      const rows = items.flatMap((item, index): ChartTooltipRow[] => {
        const key = resolveKey(item, index)
        const value = item.value
        if (Array.isArray(value)) {
          // ECharts prepends the category index to candlestick values.
          const isCandle = item.seriesType === "candlestick" || (item.seriesType === "custom" && item.dimensionNames?.[1] === "باز")
          const values = isCandle ? value.slice(-4) : value
          const labels = isCandle
            ? ["باز", "بسته", "کمینه", "بیشینه"] : values.map((_, i) => `مقدار ${toFaDigits(i + 1)}`)
          return values.map((v, i) => ({ label: labels[i], value: v == null ? "—" : formatValue(v, key), color: item.color }))
        }
        if (typeof value === "number") total += value
        const Icon = config[key]?.icon
        return [{
          label: config[key]?.label ?? key,
          value: value == null ? "—" : formatValue(value as string | number, key),
          color: typeof item.color === "string" ? item.color : config[key]?.color,
          icon: Icon ? <Icon /> : undefined,
        }]
      })

      return renderChartTooltip(label, rows, {
        indicator,
        footer: showTotal && rows.length > 1
          ? { label: typeof showTotal === "string" ? showTotal : "جمع", value: formatValue(total, "total") }
          : undefined,
      })
    },
    [config, formatValue, indicator, hideLabel, labelFormatter, showTotal]
  )
}

function ChartLegendContent({
  config,
  className,
}: {
  config: ChartConfig
  className?: string
}) {
  return (
    <div
      dir="rtl"
      className={cn("flex flex-wrap items-center justify-center gap-4", className)}
    >
      {Object.entries(config).map(([key, item]) => (
        <div key={key} className="flex items-center gap-1.5">
          {item.icon ? (
            <item.icon className="size-3 text-muted-foreground" />
          ) : (
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: item.color }}
            />
          )}
          <span className="text-sm text-muted-foreground">
            {item.label ?? key}
          </span>
        </div>
      ))}
    </div>
  )
}

export {
  ChartContainer,
  ChartLegendContent,
  useChart,
  useChartTooltipFormatter,
}
