"use client"

import * as React from "react"
import type { EChartsOption } from "echarts"

import {
  ChartContainer,
  ChartLegendContent,
  renderChartTooltip,
  type ChartConfig,
  type ChartCursor,
  type ChartTooltipOptions,
} from "@/components/ui/chart"
import { formatNumber, formatPercent } from "@/lib/persian"
import { cn } from "@/lib/utils"

/**
 * نمودارهای پراپ‌محور — لایه‌ای نازک روی ChartContainer.
 *
 * ChartContainer عمداً سطح‌پایین است: یک آبجکتِ کاملِ ECharts می‌گیرد و در
 * عوض هر کاری که ECharts بلد است می‌شود کرد (candlestick، gauge، دیتای
 * حجیم). بهایش این است که برای یک نمودار میله‌ایِ ساده هم باید ECharts
 * بلد باشی.
 *
 * این‌ها همان ۹۰٪ حالت‌های رایج را با پراپ می‌دهند: داده را بده، بگو کدام
 * ستون محور دسته است و کدام‌ها سری، تمام. `option` خام هم سرِ جایش می‌ماند
 * — این‌ها جایگزینش نیستند، میان‌بُرش‌اند.
 *
 * تصمیم‌هایی که اینجا از پیش گرفته شده و نباید هر بار تکرار شوند:
 *   • رنگ سری‌ها از --chart-1 تا --chart-8 می‌آید، پس با تعویض برند عوض
 *     می‌شود و کسی رنگ هاردکد نمی‌نویسد.
 *   • عددها فارسی و با جداکنندهٔ هزارگان‌اند، چون این دیزاین‌سیستم فارسی است.
 *   • شبکه و محورها از توکن‌های تم می‌آیند، پس در تم تیره هم خوانا می‌مانند.
 */

/** یک سری داده: کدام کلید از هر ردیف، با چه برچسبی. */
export type ChartSeries = {
  /** نام فیلد در هر ردیفِ data. */
  key: string
  /** برچسبِ راهنما و تولتیپ؛ نبودش یعنی خودِ key. */
  label?: string
  /** رنگ دلخواه؛ نبودش یعنی --chart-N بر اساس ترتیب. */
  color?: string
  /** آیکونِ سری در راهنما و تولتیپ؛ با داشتنِ آیکون راهنما HTML می‌شود. */
  icon?: React.ComponentType<{ className?: string }>
}

export type ChartRow = Record<string, string | number | null | undefined>

/** شکلِ خط: نرم، شکسته یا پله‌ای (برای مقدارهایی که یک‌باره عوض می‌شوند، مثل نرخ). */
export type ChartCurve = "smooth" | "linear" | "step"

// پراپ‌های مشترک با کامنتِ خطی (نه JSDoc) توضیح داده شده‌اند: در هر نمودار
// تکرار می‌شوند و توضیحشان در get_component_api فقط توکن هدر می‌داد؛
// جدولِ پراپِ مستندات توضیحِ کاملشان را دارد.
type CommonProps = {
  data: ChartRow[]
  series: ChartSeries[]
  // نام فیلدی که روی محور دسته‌ها می‌نشیند (مثلاً «ماه»).
  categoryKey: string
  // راهنمای رنگ‌ها؛ با یک سری معمولاً لازم نیست.
  showLegend?: boolean
  // خطوط شبکهٔ افقی.
  showGrid?: boolean
  // محورِ مقدار پنهان شود؛ وقتی برچسبِ روی داده یا تولتیپ کافی است.
  hideValueAxis?: boolean
  // محورِ مقدار از نزدیکِ کمینهٔ داده شروع شود نه صفر؛ برای قیمت و نرخ که تغییرِ کوچک مهم است.
  valueAxisFromData?: boolean
  // قالب‌بندی مقدار در تولتیپ و محور؛ پیش‌فرض عدد فارسی.
  valueFormatter?: (value: number) => string
  // ظاهرِ تولتیپ: indicator، hideLabel، labelFormatter، showTotal.
  tooltip?: ChartTooltipOptions
  // نشانگرِ دستهٔ زیرِ ماوس: line، band یا none.
  cursor?: ChartCursor
  // تولتیپِ این اندیس از اول باز باشد.
  defaultTooltipIndex?: number
  className?: string
}

/** هشت رنگِ نموداریِ تم، به همان ترتیبی که در توکن‌ها تعریف شده‌اند. */
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
]

function colorAt(index: number): string {
  return PALETTE[index % PALETTE.length]
}

const faNumber = (value: number) => formatNumber(value)

/** config ای که ChartContainer برای حل رنگ و راهنما لازم دارد. */
function buildConfig(series: ChartSeries[]): ChartConfig {
  const config: ChartConfig = {}
  for (const [index, item] of series.entries()) {
    config[item.label ?? item.key] = {
      label: item.label ?? item.key,
      color: item.color ?? colorAt(index),
      icon: item.icon,
    }
  }
  return config
}

/**
 * گزینه‌های تولتیپ را پایدار نگه می‌دارد. formatValue اگر هر رندر تازه ساخته
 * شود، formatter هم تازه می‌شود و echarts-for-react نمودار را از نو انیمیت می‌کند.
 */
function useTooltipOptions(
  tooltip: ChartTooltipOptions | undefined,
  valueFormatter: (value: number) => string
): ChartTooltipOptions {
  const { indicator, hideLabel, labelFormatter, showTotal, formatValue } = tooltip ?? {}
  return React.useMemo(
    () => ({
      indicator,
      hideLabel,
      labelFormatter,
      showTotal,
      formatValue: formatValue ?? ((value: string | number) => (typeof value === "number" ? valueFormatter(value) : value)),
    }),
    [indicator, hideLabel, labelFormatter, showTotal, formatValue, valueFormatter]
  )
}

/** وقتی سری آیکون دارد، راهنمای ECharts (که آیکونِ React نمی‌فهمد) جایش را به راهنمای HTML می‌دهد. */
function hasIcons(series: ChartSeries[]) {
  return series.some((item) => item.icon)
}

function Frame({
  slot,
  config,
  htmlLegend,
  className,
  overlay,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  slot: string
  config: ChartConfig
  htmlLegend: boolean
  overlay?: React.ReactNode
}) {
  if (!htmlLegend && !overlay) return <>{children}</>
  return (
    <div data-slot={`${slot}-frame`} className={cn("flex w-full flex-col gap-3", className)} {...props}>
      <div className="relative min-h-0 flex-1">
        {children}
        {overlay}
      </div>
      {htmlLegend && <ChartLegendContent config={config} />}
    </div>
  )
}

/** عدد و برچسبِ وسطِ دونات یا نمودار شعاعی؛ HTML است تا فونت و جهتِ فارسی درست بماند. */
export type ChartCenterLabel = { value: React.ReactNode; label?: React.ReactNode }

function CenterLabel({ center, top = "50%" }: { center: ChartCenterLabel; top?: string }) {
  return (
    <div
      data-slot="chart-center-label"
      dir="rtl"
      className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 flex-col items-center text-center"
      style={{ top }}
    >
      {/* اندازه با قابِ نمودار کوچک می‌شود (cqmin)، تا عدد در حلقهٔ داخلیِ نمودارِ کوچک یا چندحلقه روی کمان‌ها نیفتد. */}
      <span className="text-[min(1.5rem,9cqmin)] leading-tight font-bold tabular-nums text-foreground">{center.value}</span>
      {center.label && <span className="text-[max(0.6875rem,min(0.75rem,5.5cqmin))] text-muted-foreground">{center.label}</span>}
    </div>
  )
}

/**
 * بخش‌های مشترکِ نمودارهای محوردار (میله/خط/ناحیه).
 *
 * جدا نگه داشته شده تا سه نمودار دقیقاً یک ظاهر داشته باشند؛ اگر هر کدام
 * option خودش را از صفر می‌ساخت، اولین تغییرِ سبک فقط روی یکی می‌نشست.
 */
function axisOption({
  categories,
  showGrid,
  showLegend,
  format,
  horizontal,
  hideValueAxis = false,
  hideCategoryAxis = false,
  boundaryGap,
  names,
  fromData = false,
}: {
  fromData?: boolean
  /** نامِ سری‌ها به ترتیب، برای چیدنِ راست‌به‌چپِ راهنما. */
  names?: string[]
  categories: string[]
  showGrid: boolean
  showLegend: boolean
  format: (value: number) => string
  horizontal: boolean
  hideValueAxis?: boolean
  hideCategoryAxis?: boolean
  boundaryGap?: boolean
}): EChartsOption {
  // دیگ راست‌به‌چپ است: دسته‌ها از راست شروع می‌شوند و محورِ مقدار سمتِ راست
  // (شروعِ خواندن) می‌نشیند. در حالتِ افقی، محورِ مقدار از راست به چپ رشد می‌کند.
  const categoryAxis = {
    type: "category" as const,
    data: categories,
    // عمودی: اولین دسته سمتِ راست. افقی: اولین دسته بالا (ECharts پیش‌فرض از پایین می‌چیند).
    inverse: true,
    position: horizontal ? ("right" as const) : undefined,
    show: !hideCategoryAxis,
    boundaryGap,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: "var(--border)" } },
    axisLabel: {
      color: "var(--muted-foreground)",
      // بدونِ فاصلهٔ لبه (ناحیه‌ای) یا با میله‌های پرشمار، برچسبِ اول و آخر وسط‌چین روی لبه می‌افتند و
      // نصفشان بیرون از کارت بریده می‌شود؛ به داخل می‌چسبانیمشان. محور وارونه
      // است، پس کمینه سمتِ راست است.
      ...((boundaryGap === false || categories.length > 12) && !horizontal ? { alignMinLabel: "right" as const, alignMaxLabel: "left" as const } : {}),
    },
  }

  const valueAxis = {
    type: "value" as const,
    inverse: horizontal,
    scale: fromData,
    position: horizontal ? undefined : ("right" as const),
    axisLabel: {
      show: !hideValueAxis,
      color: "var(--muted-foreground)",
      formatter: (value: number) => format(value),
    },
    splitLine: { show: showGrid, lineStyle: { color: "var(--border)" } },
  }

  return {
    // فضای بالا فقط وقتی لازم است که راهنما آنجا بنشیند.
    grid: {
      // سه سری یا بیشتر در کارتِ باریک دو ردیف می‌شود؛ جا برای ردیفِ دوم.
      top: showLegend ? ((names?.length ?? 0) >= 3 ? 64 : 40) : 16,
      right: 16,
      bottom: 8,
      left: 8,
      containLabel: true,
    },
    legend: legendOption(showLegend, { top: 0 }, names),
    tooltip: { trigger: "axis" },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
  }
}

/** راهنمای ECharts در RTL: نشانگرِ رنگ سمتِ راستِ متن، همان جایی که چشم شروع می‌کند. */
function legendOption(show: boolean, position: Record<string, string | number>, names?: string[]) {
  return {
    show,
    ...position,
    // ECharts راهنما را چپ‌به‌راست می‌چیند؛ وارونه می‌دهیم تا اولین سری سمتِ راست بنشیند.
    ...(names ? { data: [...names].reverse() } : {}),
    align: "right" as const,
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
    icon: "roundRect",
    textStyle: { color: "var(--muted-foreground)" },
  }
}

function categoriesOf(data: ChartRow[], key: string): string[] {
  return data.map((row) => String(row[key] ?? ""))
}

function valuesOf(data: ChartRow[], key: string): (number | null)[] {
  return data.map((row) => {
    const value = row[key]
    // null عمداً حفظ می‌شود: در نمودار خطی یعنی «داده نداریم» و خط را
    // می‌شکند، که با صفر گرفتنش فرق دارد و نباید بی‌صدا یکی شوند.
    return value === null || value === undefined ? null : Number(value)
  })
}

/** برچسبِ مقدار روی داده، با همان قالبِ عددِ نمودار. */
function valueLabel(format: (value: number) => string, extra: Record<string, unknown> = {}) {
  return {
    show: true,
    color: "var(--foreground)",
    fontSize: 11,
    formatter: (params: { value: unknown }) => {
      const value = Array.isArray(params.value) ? params.value.at(-1) : params.value
      return value == null ? "" : format(Number(value))
    },
    ...extra,
  }
}

export type BarChartProps = CommonProps & {
  /** سری‌ها روی هم انباشته شوند به‌جای کنار هم. */
  stacked?: boolean
  /** میله‌ها افقی شوند؛ برای برچسب‌های بلندِ فارسی خواناتر است. */
  horizontal?: boolean
  /** مقدار بالای هر میله (یا انتهای میلهٔ افقی). */
  showLabels?: boolean
  /**
   * فقط افقی: اسمِ دسته داخلِ خودِ میله می‌نشیند و محورِ دسته حذف می‌شود؛
   * برای برچسب‌های بلند جا آزاد می‌کند.
   */
  labelsInside?: boolean
  /** هر میله رنگِ خودش را بگیرد (فقط با یک سری معنا دارد). */
  colorByCategory?: boolean
  /** اندیسِ دسته‌ای که برجسته می‌شود (کادرِ خط‌چین)؛ مثلاً ماهِ جاری. */
  activeIndex?: number
  /** رنگِ مقدارهای منفی؛ پیش‌فرض --destructive. منفی‌ها لبهٔ گردِ پایین می‌گیرند. */
  negativeColor?: string
  /** کلیک روی میله؛ اندیسِ دسته و ردیفِ داده را می‌دهد. */
  onBarClick?: (index: number, row: ChartRow) => void
}

function BarChart({
  data,
  series,
  categoryKey,
  stacked = false,
  horizontal = false,
  showLabels = false,
  labelsInside = false,
  colorByCategory = false,
  activeIndex,
  negativeColor = "var(--destructive)",
  onBarClick,
  showLegend = series.length > 1,
  showGrid = true,
  hideValueAxis = false,
  valueFormatter = faNumber,
  tooltip,
  cursor,
  className,
  ...props
}: BarChartProps & Omit<React.ComponentProps<"div">, keyof BarChartProps>) {
  const tooltipOptions = useTooltipOptions(tooltip, valueFormatter)
  const htmlLegend = showLegend && hasIcons(series)
  const inside = horizontal && labelsInside
  const outerRadius = horizontal ? [4, 0, 0, 4] : [4, 4, 0, 0]
  // مقدارِ منفی به سمتِ دیگر رشد می‌کند، پس لبهٔ گردش هم برعکس است.
  const innerRadius = horizontal ? [0, 4, 4, 0] : [0, 0, 4, 4]
  const columns = series.map((item) => valuesOf(data, item.key))
  const categories = categoriesOf(data, categoryKey)
  /** اندیسِ آخرین سری‌ای که در این ردیف مقدارِ مثبت دارد (بالای ستونِ انباشته). */
  const topSeriesAt = (row: number) => {
    for (let index = columns.length - 1; index >= 0; index--) {
      const value = Number(columns[index][row] ?? 0)
      if (value > 0) return index
    }
    return -1
  }
  const option: EChartsOption = {
    ...axisOption({
      categories,
      showGrid,
      showLegend: showLegend && !htmlLegend,
      format: valueFormatter,
      horizontal,
      hideValueAxis,
      names: series.map((item) => item.label ?? item.key),
      hideCategoryAxis: inside,
    }),
    series: series.map((item, index) => {
      const values = columns[index]
      const color = item.color ?? colorAt(index)
      return {
        type: "bar" as const,
        name: item.label ?? item.key,
        // انباشته: فقط بالاترین تکهٔ هر ستون (آخرین سریِ دارای مقدار) گرد می‌شود؛
        // محلِ اتصالِ رنگ‌ها صاف می‌ماند. غیرانباشته: هر میله لبهٔ بیرونیِ گرد دارد.
        data: values.map((value, row) => {
          const negative = value != null && value < 0
          const radius = stacked ? (topSeriesAt(row) === index ? outerRadius : 0) : negative ? innerRadius : outerRadius
          const fill = negative ? negativeColor : colorByCategory ? colorAt(row) : color
          const active = activeIndex === row
          return {
            value,
            itemStyle: {
              color: fill,
              borderRadius: radius,
              ...(active ? { borderColor: "var(--foreground)", borderWidth: 2, borderType: "dashed" as const } : {}),
            },
            ...(inside
              ? {
                  label: {
                    show: true,
                    position: "insideRight" as const,
                    formatter: categories[row],
                    color: "var(--background)",
                    fontSize: 12,
                  },
                }
              : {}),
          }
        }),
        stack: stacked ? "همه" : undefined,
        barMaxWidth: 48,
        itemStyle: { color, borderRadius: stacked ? 0 : outerRadius },
        ...(showLabels && (!stacked || index === series.length - 1)
          ? {
              // ستونِ انباشته فقط یک برچسب می‌گیرد (روی آخرین سری) تا روی هم نیفتند.
              label: valueLabel(valueFormatter, {
                position: horizontal ? "left" : "top",
                ...(stacked
                  ? { formatter: (params: { dataIndex: number }) => valueFormatter(columns.reduce((sum, column) => sum + Number(column[params.dataIndex] ?? 0), 0)) }
                  : {}),
              }),
            }
          : {}),
      }
    }),
  }

  const config = buildConfig(series)
  const onEvents = React.useMemo(
    () => (onBarClick ? { click: (params: unknown) => {
      const index = (params as { dataIndex?: number }).dataIndex
      if (index !== undefined) onBarClick(index, data[index])
    } } : undefined),
    [onBarClick, data]
  )
  return (
    <Frame slot="bar-chart" config={config} htmlLegend={htmlLegend} className={className}>
      <ChartContainer
        data-slot="bar-chart"
        config={config}
        option={option}
        tooltip={tooltipOptions}
        cursor={cursor}
        onEvents={onEvents}
        className={cn("h-72 w-full", !htmlLegend && className)}
        {...props}
      />
    </Frame>
  )
}

export type LineChartProps = CommonProps & {
  /** شکلِ خط؛ پیش‌فرض linear. */
  curve?: ChartCurve
  /** @deprecated معادلِ curve="smooth". */
  smooth?: boolean
  /** نقطه روی هر داده؛ برای سری‌های پرنقطه خاموشش کنید. */
  showPoints?: boolean
  /** شکلِ نقطه‌ها؛ هر symbol ای که ECharts می‌شناسد (circle، rect، roundRect، diamond، triangle). */
  pointShape?: "circle" | "rect" | "roundRect" | "diamond" | "triangle" | "emptyCircle"
  /** هر نقطه رنگِ دستهٔ خودش را بگیرد؛ برای یک سری با دسته‌های معنادار. */
  colorByCategory?: boolean
  /** مقدار کنارِ هر نقطه. */
  showLabels?: boolean
}

function curveProps(curve: ChartCurve) {
  return curve === "smooth" ? { smooth: true } : curve === "step" ? { step: "middle" as const } : { smooth: false }
}

function LineChart({
  data,
  series,
  categoryKey,
  smooth,
  curve = smooth ? "smooth" : "linear",
  showPoints = true,
  pointShape = "circle",
  colorByCategory = false,
  showLabels = false,
  showLegend = series.length > 1,
  showGrid = true,
  hideValueAxis = false,
  valueAxisFromData = false,
  valueFormatter = faNumber,
  tooltip,
  cursor,
  className,
  ...props
}: LineChartProps & Omit<React.ComponentProps<"div">, keyof LineChartProps>) {
  const tooltipOptions = useTooltipOptions(tooltip, valueFormatter)
  const htmlLegend = showLegend && hasIcons(series)
  const option: EChartsOption = {
    ...axisOption({
      categories: categoriesOf(data, categoryKey),
      showGrid,
      showLegend: showLegend && !htmlLegend,
      format: valueFormatter,
      horizontal: false,
      hideValueAxis,
      fromData: valueAxisFromData,
      names: series.map((item) => item.label ?? item.key),
    }),
    series: series.map((item, index) => {
      const color = item.color ?? colorAt(index)
      const values = valuesOf(data, item.key)
      return {
        type: "line" as const,
        name: item.label ?? item.key,
        data: colorByCategory
          ? values.map((value, row) => ({ value, itemStyle: { color: colorAt(row) } }))
          : values,
        ...curveProps(curve),
        showSymbol: showPoints || showLabels,
        symbol: pointShape,
        symbolSize: pointShape === "circle" ? 6 : 9,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        ...(showLabels ? { label: valueLabel(valueFormatter, { position: "top", distance: 8 }) } : {}),
      }
    }),
  }

  const config = buildConfig(series)
  return (
    <Frame slot="line-chart" config={config} htmlLegend={htmlLegend} className={className}>
      <ChartContainer
        data-slot="line-chart"
        config={config}
        option={option}
        tooltip={tooltipOptions}
        cursor={cursor}
        className={cn("h-72 w-full", !htmlLegend && className)}
        {...props}
      />
    </Frame>
  )
}

export type AreaChartProps = Omit<LineChartProps, "colorByCategory" | "showLabels"> & {
  /** ناحیه‌ها روی هم انباشته شوند. */
  stacked?: boolean
  /** انباشتهٔ صددرصدی: هر ستون جمعاً ۱۰۰٪؛ سهمِ هر سری را نشان می‌دهد نه مقدارش را. */
  expand?: boolean
  /** پرشدگی از رنگِ سری به رنگِ پس‌زمینه محو شود. */
  gradient?: boolean
}

function AreaChart({
  data,
  series,
  categoryKey,
  smooth,
  curve = smooth === false ? "linear" : "smooth",
  stacked = false,
  expand = false,
  gradient = false,
  showPoints = false,
  pointShape = "circle",
  showLegend = series.length > 1,
  showGrid = true,
  hideValueAxis = false,
  valueAxisFromData = false,
  valueFormatter = faNumber,
  tooltip,
  cursor,
  className,
  ...props
}: AreaChartProps & Omit<React.ComponentProps<"div">, keyof AreaChartProps>) {
  const percent = React.useCallback((value: number) => formatPercent(value / 100), [])
  const format = expand ? percent : valueFormatter
  const tooltipOptions = useTooltipOptions(tooltip, format)
  const htmlLegend = showLegend && hasIcons(series)
  const isStacked = stacked || expand
  const columns = series.map((item) => valuesOf(data, item.key))
  const totals = data.map((_, row) => columns.reduce((sum, column) => sum + Math.max(0, Number(column[row] ?? 0)), 0))

  const option: EChartsOption = {
    ...axisOption({
      categories: categoriesOf(data, categoryKey),
      showGrid,
      showLegend: showLegend && !htmlLegend,
      format,
      horizontal: false,
      hideValueAxis,
      fromData: valueAxisFromData,
      boundaryGap: false,
      names: series.map((item) => item.label ?? item.key),
    }),
    series: series.map((item, index) => {
      const color = item.color ?? colorAt(index)
      const values = expand
        ? columns[index].map((value, row) => (value == null || !totals[row] ? null : (value / totals[row]) * 100))
        : columns[index]
      return {
        type: "line" as const,
        name: item.label ?? item.key,
        data: values,
        ...curveProps(curve),
        showSymbol: showPoints,
        symbol: pointShape,
        stack: isStacked ? "همه" : undefined,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        // پرشدگیِ ملایم تا چند ناحیهٔ روی هم همدیگر را نپوشانند. گرادیان به
        // رنگِ پس‌زمینه می‌رود، نه به شفاف، تا روی کارتِ رنگی هم درست بماند.
        areaStyle: gradient
          ? {
              color: {
                type: "linear" as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color },
                  { offset: 1, color: "var(--background)" },
                ],
              },
              opacity: isStacked ? 0.85 : 0.4,
            }
          : { color, opacity: isStacked ? 0.75 : 0.18 },
      }
    }),
  }
  if (expand) {
    option.yAxis = { ...(option.yAxis as object), max: 100 } as EChartsOption["yAxis"]
  }

  const config = buildConfig(series)
  return (
    <Frame slot="area-chart" config={config} htmlLegend={htmlLegend} className={className}>
      <ChartContainer
        data-slot="area-chart"
        config={config}
        option={option}
        tooltip={tooltipOptions}
        cursor={cursor}
        className={cn("h-72 w-full", !htmlLegend && className)}
        {...props}
      />
    </Frame>
  )
}

export type PieChartProps = {
  data: ChartRow[]
  /** فیلدِ نامِ هر برش. */
  nameKey: string
  /** فیلدِ مقدارِ هر برش. */
  valueKey: string
  /** وسطش خالی باشد (دونات). */
  donut?: boolean
  showLegend?: boolean
  /** برچسبِ برش‌ها: none (پیش‌فرض)، outside با خطِ راهنما، inside روی خودِ برش. */
  labels?: "none" | "outside" | "inside"
  /** آنچه برچسب نشان می‌دهد: مقدار، نام یا درصد. */
  labelContent?: "value" | "name" | "percent"
  /** عدد و توضیحِ وسطِ دونات؛ مثلاً جمعِ کل. */
  centerLabel?: ChartCenterLabel
  /** اندیسِ برشِ برجسته که کمی بیرون می‌زند. */
  activeIndex?: number
  /** کلیک روی برش؛ برای حالتِ تعاملی که با Select یا کلیک برش را عوض می‌کند. */
  onSliceClick?: (index: number, row: ChartRow) => void
  /** فاصلهٔ بینِ برش‌ها؛ false یعنی برش‌ها بی‌فاصله به هم بچسبند. */
  separator?: boolean
  valueFormatter?: (value: number) => string
  tooltip?: ChartTooltipOptions
  // تولتیپِ این اندیس از اول باز باشد.
  defaultTooltipIndex?: number
  className?: string
}

function PieChart({
  data,
  nameKey,
  valueKey,
  donut = false,
  showLegend = true,
  labels = "none",
  labelContent = "value",
  centerLabel,
  activeIndex,
  onSliceClick,
  separator = true,
  valueFormatter = faNumber,
  tooltip,
  className,
  ...props
}: PieChartProps & Omit<React.ComponentProps<"div">, keyof PieChartProps>) {
  const tooltipOptions = useTooltipOptions(tooltip, valueFormatter)
  const hollow = donut || !!centerLabel
  const sliceTotal = data.reduce((sum, row) => sum + Math.max(0, Number(row[valueKey] ?? 0)), 0)
  // نامِ برشِ باریک داخلش جا نمی‌شود؛ به‌جای پنهان‌کردن، همان یک برش برچسبش را
  // بیرون با خطِ راهنما می‌گیرد و بقیه داخل می‌مانند.
  const isThin = (value: number) => labels === "inside" && sliceTotal > 0 && value / sliceTotal < 0.15
  const slices = data.map((row, index) => {
    const value = Number(row[valueKey] ?? 0)
    return {
      name: String(row[nameKey] ?? ""),
      value,
      selected: activeIndex === index,
      itemStyle: { color: colorAt(index) },
      ...(isThin(value)
        ? {
            label: { position: "outside" as const, color: "var(--foreground)" },
            labelLine: { show: true, lineStyle: { color: "var(--border)" } },
          }
        : {}),
    }
  })
  const hasOutsideLabels = labels === "outside" || slices.some((slice) => isThin(slice.value))

  const config: ChartConfig = {}
  for (const [index, slice] of slices.entries()) {
    config[slice.name] = { label: slice.name, color: colorAt(index) }
  }

  const labelFormatter = (params: { name: string; value: unknown; percent?: number }) =>
    labelContent === "name"
      ? params.name
      : labelContent === "percent"
        ? formatPercent((params.percent ?? 0) / 100)
        : valueFormatter(Number(params.value))
  const centerY = showLegend ? "45%" : "50%"

  const option: EChartsOption = {
    tooltip: { trigger: "item" },
    legend: legendOption(showLegend, { bottom: 0 }, slices.map((slice) => slice.name)),
    series: [
      {
        type: "pie",
        data: slices,
        radius: hollow ? ["55%", "78%"] : hasOutsideLabels ? "62%" : "72%",
        center: ["50%", centerY],
        selectedMode: activeIndex !== undefined ? "single" : false,
        selectedOffset: 10,
        label:
          labels === "none"
            ? { show: false }
            : {
                show: true,
                position: labels,
                formatter: labelFormatter as never,
                color: labels === "inside" ? "var(--background)" : "var(--foreground)",
                fontSize: 12,
              },
        labelLine: { show: labels === "outside", lineStyle: { color: "var(--border)" } },
        // حاشیه به رنگِ پس‌زمینه، تا برش‌ها در هر دو تم از هم جدا دیده شوند.
        itemStyle: separator
          ? { borderColor: "var(--background)", borderWidth: 2 }
          : { borderWidth: 0, borderRadius: 0 },
      },
    ],
  }

  const onEvents = React.useMemo(
    () => (onSliceClick ? { click: (params: unknown) => {
      const index = (params as { dataIndex?: number }).dataIndex
      if (index !== undefined) onSliceClick(index, data[index])
    } } : undefined),
    [onSliceClick, data]
  )

  const chart = (
    <ChartContainer
      data-slot="pie-chart"
      config={config}
      option={option}
      tooltip={tooltipOptions}
      onEvents={onEvents}
      // با عددِ وسط، ارتفاع مالِ قاب است و نمودار پرش می‌کند؛ وگرنه ۵۰٪ِ قاب و
      // ۵۰٪ِ نمودار یکی نبودند و عدد از مرکزِ دونات جابه‌جا می‌افتاد.
      className={centerLabel ? "h-full w-full" : cn("h-72 w-full", className)}
      {...props}
    />
  )
  if (!centerLabel) return chart
  return (
    <div data-slot="pie-chart-frame" className={cn("relative h-72 w-full [container-type:size]", className)}>
      {chart}
      <CenterLabel center={centerLabel} top={centerY} />
    </div>
  )
}

export type RadarChartProps = Omit<CommonProps, "hideValueAxis" | "cursor"> & {
  /** شکلِ شبکه: چندضلعی (پیش‌فرض) یا دایره. */
  gridShape?: "polygon" | "circle"
  /** حلقه‌های شبکه یک‌درمیان رنگ بگیرند. */
  gridFill?: boolean
  /** خطوطِ شعاعیِ مرکز تا هر رأس. */
  showSpokes?: boolean
  /** نقطه روی هر رأس. */
  showPoints?: boolean
  /** ناحیهٔ هر سری پر شود؛ false یعنی فقط خط. */
  fill?: boolean
  /** مقدارِ هر رأس زیرِ نامش نوشته شود (فقط سریِ اول). */
  showValues?: boolean
  /** سقفِ مقیاس؛ نبودش یعنی بیشینهٔ داده. */
  max?: number
  /** عددهای مقیاس روی محورِ رأسِ اول؛ برای وقتی مقدارِ مطلق مهم است نه فقط شکل. */
  showScale?: boolean
}

/**
 * نمودار راداری: مقایسهٔ چند معیار (سرعت، کیفیت، قیمت…) برای یک یا چند
 * سری. هر ردیفِ data یک رأس است و categoryKey نامش.
 */
function RadarChart({
  data,
  series,
  categoryKey,
  gridShape = "polygon",
  gridFill = false,
  showGrid = true,
  showSpokes = true,
  showPoints = false,
  fill = true,
  showValues = false,
  showScale = false,
  max,
  showLegend = series.length > 1,
  valueFormatter = faNumber,
  tooltip,
  className,
  ...props
}: RadarChartProps & Omit<React.ComponentProps<"div">, keyof RadarChartProps>) {
  const tooltipOptions = useTooltipOptions(tooltip, valueFormatter)
  const htmlLegend = showLegend && hasIcons(series)
  const categories = categoriesOf(data, categoryKey)
  const columns = series.map((item) => valuesOf(data, item.key))
  const peak = max ?? Math.max(1, ...columns.flat().map((value) => Number(value ?? 0)))
  // سقف را کمی گرد می‌کنیم تا بیرونی‌ترین حلقه دقیقاً روی بیشینه نیفتد.
  const top = max ?? Math.ceil((peak * 1.1) / 10) * 10

  const option: EChartsOption = {
    legend: legendOption(showLegend && !htmlLegend, { bottom: 0 }, series.map((item) => item.label ?? item.key)),
    tooltip: {
      trigger: "item",
      // رادار مقدارها را آرایه برمی‌گرداند؛ تولتیپِ پیش‌فرض فقط «مقدار ۱، ۲…»
      // می‌نوشت. اینجا هر ردیف نامِ رأسِ خودش را می‌گیرد.
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number[]; color?: string }
        return renderChartTooltip(
          tooltipOptions.hideLabel ? undefined : item.name,
          (item.value ?? []).map((value, index) => ({
            label: categories[index],
            value: value == null ? "—" : valueFormatter(value),
            color: typeof item.color === "string" ? item.color : undefined,
          })),
          { indicator: tooltipOptions.indicator }
        )
      },
    },
    radar: {
      // RTL: رأسِ اول بالا و ترتیب ساعت‌گرد، همان جهتِ خواندنِ متن.
      startAngle: 90,
      shape: gridShape,
      center: ["50%", showLegend && !htmlLegend ? "46%" : "50%"],
      radius: "68%",
      // مقیاس فقط روی محورِ اول؛ روی همهٔ محورها عددها در هم می‌روند.
      indicator: categories.map((name, index) => ({
        name,
        max: top,
        ...(showScale && index === 0
          ? { axisLabel: { show: true, color: "var(--muted-foreground)", fontSize: 10, showMinLabel: false, formatter: (value: number) => valueFormatter(value) } }
          : {}),
      })),
      axisName: {
        color: "var(--muted-foreground)",
        fontSize: 12,
        ...(showValues
          ? {
              formatter: (name?: string) => {
                const index = categories.indexOf(name ?? "")
                const value = columns[0]?.[index]
                return `{v|${value == null ? "" : valueFormatter(value)}}\n${name}`
              },
              rich: { v: { color: "var(--foreground)", fontWeight: "bold", fontSize: 13, lineHeight: 18 } },
            }
          : {}),
      },
      splitNumber: 4,
      splitLine: { show: showGrid, lineStyle: { color: "var(--border)" } },
      splitArea: gridFill
        ? { show: true, areaStyle: { color: ["var(--muted)", "var(--background)"] } }
        : { show: false },
      axisLine: { show: showSpokes, lineStyle: { color: "var(--border)" } },
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: showPoints ? 6 : 0,
        data: series.map((item, index) => {
          const color = item.color ?? colorAt(index)
          return {
            name: item.label ?? item.key,
            value: columns[index].map((value) => value ?? 0),
            itemStyle: { color },
            lineStyle: { color, width: 2 },
            areaStyle: fill ? { color, opacity: series.length > 1 ? 0.25 : 0.45 } : undefined,
          }
        }),
      },
    ],
  }

  const config = buildConfig(series)
  return (
    <Frame slot="radar-chart" config={config} htmlLegend={htmlLegend} className={className}>
      <ChartContainer
        data-slot="radar-chart"
        config={config}
        option={option}
        className={cn("h-72 w-full", !htmlLegend && className)}
        {...props}
      />
    </Frame>
  )
}

export type RadialChartProps = {
  data: ChartRow[]
  /** فیلدِ نامِ هر حلقه. */
  nameKey: string
  /** فیلدِ مقدارِ هر حلقه. */
  valueKey: string
  /**
   * سقفِ هر حلقه. نبودش یعنی بیشینهٔ داده؛ برای پیشرفت (۶۸ از ۱۰۰) سقف را
   * صریح بدهید وگرنه بزرگ‌ترین حلقه همیشه کامل دیده می‌شود.
   */
  max?: number
  /** زاویهٔ کمانِ پر (۳۶۰ = دایرهٔ کامل، ۱۸۰ = نیم‌دایره). */
  sweep?: number
  /** ریلِ پس‌زمینه زیرِ هر حلقه، تا جای خالیِ تا سقف دیده شود. */
  showTrack?: boolean
  /** فهرستِ نام و مقدارِ حلقه‌ها کنارِ نمودار. */
  showLabels?: boolean
  /** عدد و توضیحِ وسط. */
  centerLabel?: ChartCenterLabel
  /**
   * انباشته: همهٔ ردیف‌ها پشتِ هم روی یک کمان؛ برای سهمِ چند بخش از یک کل
   * (مثلاً فروشِ آنلاین و حضوری). معمولاً با sweep={180}.
   */
  stacked?: boolean
  /** ضخامتِ حلقه‌ها نسبت به شعاع (۰ تا ۱). */
  thickness?: number
  showLegend?: boolean
  valueFormatter?: (value: number) => string
  tooltip?: ChartTooltipOptions
  // تولتیپِ این اندیس از اول باز باشد.
  defaultTooltipIndex?: number
  className?: string
}

/**
 * نمودار شعاعی: میله‌هایی روی کمان. برای پیشرفتِ یک یا چند هدف (حلقه‌های
 * هم‌مرکز) یا سهمِ چند بخش روی یک کمان (stacked).
 */
function RadialChart({
  data,
  nameKey,
  valueKey,
  max,
  sweep = 360,
  showTrack = false,
  showLabels = false,
  centerLabel,
  stacked = false,
  thickness,
  showLegend = false,
  valueFormatter = faNumber,
  tooltip,
  className,
  ...props
}: RadialChartProps & Omit<React.ComponentProps<"div">, keyof RadialChartProps>) {
  const tooltipOptions = useTooltipOptions(tooltip, valueFormatter)
  const names = categoriesOf(data, nameKey)
  const values = valuesOf(data, valueKey).map((value) => value ?? 0)
  const total = values.reduce((sum, value) => sum + value, 0)
  const ceiling = max ?? (stacked ? total : Math.max(1, ...values))
  // کمانِ ناقص: سقفِ محورِ زاویه را بزرگ‌تر می‌کنیم تا «max» دقیقاً به انتهای کمان برسد.
  const angleMax = (ceiling * 360) / Math.min(360, Math.max(10, sweep))
  const half = sweep <= 180
  // کمانِ ناقص دهانه‌اش پایین است و دو سرش قرینه: از راست شروع می‌شود و
  // پادساعت‌گرد از بالا به چپ می‌رود (همان جهتِ خواندن).
  const startAngle = sweep >= 360 ? 90 : 90 - sweep / 2
  const ringThickness = thickness ?? (stacked ? 0.28 : 0.6)
  const outer = half ? 92 : 80
  const inner = Math.round(outer * (1 - ringThickness))

  const config: ChartConfig = {}
  for (const [index, name] of names.entries()) config[name] = { label: name, color: colorAt(index) }

  const option: EChartsOption = {
    tooltip: { trigger: "item" },
    legend: legendOption(showLegend, { bottom: 0 }, names),
    polar: {
      radius: [`${inner}%`, `${outer}%`],
      center: ["50%", half ? "74%" : "50%"],
    },
    angleAxis: { type: "value", max: angleMax, startAngle, clockwise: false, show: false },
    radiusAxis: {
      type: "category",
      data: stacked ? ["کل"] : names,
      show: false,
      // حلقهٔ اول بیرونی‌ترین است، همان‌طور که در فهرست اول می‌آید.
      inverse: true,
    },
    series: stacked
      ? names.map((name, index) => ({
          type: "bar" as const,
          name,
          coordinateSystem: "polar" as const,
          stack: "کل",
          roundCap: index === 0 || index === names.length - 1,
          data: [values[index]],
          itemStyle: { color: colorAt(index) },
          barCategoryGap: "0%",
        }))
      : [
          // ریل یک سریِ جداست تا هم‌اندازهٔ کمان بماند؛ showBackgroundِ ECharts
          // همیشه دایرهٔ کامل می‌کشید، حتی وقتی کمان ۲۵۰ درجه بود.
          ...(showTrack
            ? [
                {
                  type: "bar" as const,
                  coordinateSystem: "polar" as const,
                  roundCap: true,
                  silent: true,
                  tooltip: { show: false },
                  barGap: "-100%",
                  barCategoryGap: names.length > 1 ? "30%" : "0%",
                  // عددِ خام نه آبجکتِ نام‌دار: لایهٔ تم به دادهٔ نام‌دار رنگِ پالت می‌داد.
                  data: names.map(() => ceiling),
                  itemStyle: { color: "var(--muted)" },
                  emphasis: { disabled: true },
                  z: 1,
                },
              ]
            : []),
          {
            type: "bar" as const,
            coordinateSystem: "polar" as const,
            roundCap: true,
            barGap: "-100%",
            barCategoryGap: names.length > 1 ? "30%" : "0%",
            z: 2,
            data: names.map((name, index) => ({
              name,
              value: values[index],
              itemStyle: { color: colorAt(index) },
            })),
            label: { show: false },
          },
        ],
  }

  const chart = (
    <ChartContainer
      data-slot="radial-chart"
      config={config}
      option={option}
      tooltip={tooltipOptions}
      className={centerLabel ? "h-full w-full" : cn("h-72 w-full", className)}
      {...props}
    />
  )
  // نام‌ها کنارِ حلقه‌ها در یک فهرستِ HTML، به ترتیبِ حلقه‌ها از بیرون به داخل؛
  // روی کمانِ باریک متن جا نمی‌شد و روی هم می‌افتاد.
  const labelList = showLabels && !stacked && (
    <ul data-slot="radial-chart-labels" dir="rtl" className="flex shrink-0 flex-col justify-center gap-2.5 text-sm">
      {names.map((name, index) => (
        <li key={name} className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colorAt(index) }} />
          <span className="text-muted-foreground">{name}</span>
          <span className="ms-auto ps-3 font-medium tabular-nums">{valueFormatter(values[index])}</span>
        </li>
      ))}
    </ul>
  )
  if (!centerLabel && !labelList) return chart
  return (
    <div data-slot="radial-chart-frame" className={cn("flex h-72 w-full items-center gap-4", className)}>
      {labelList}
      <div className="relative h-full min-w-0 flex-1 [container-type:size]">
        {React.cloneElement(chart, { className: "h-full w-full" })}
        {centerLabel && <CenterLabel center={centerLabel} top={half ? "60%" : "50%"} />}
      </div>
    </div>
  )
}

export type ComboChartProps = Omit<CommonProps, "series" | "valueFormatter"> & {
  /** سریِ میله‌ای، روی محورِ راست (شروعِ خواندن در RTL). */
  bar: ChartSeries
  /** سریِ خطی، روی محورِ دوم؛ برای کمیتی با واحدِ دیگر (مثلاً تعداد سفارش کنارِ مبلغِ فروش). */
  line: ChartSeries
  barFormatter?: (value: number) => string
  lineFormatter?: (value: number) => string
}

/**
 * میله و خط با دو محور؛ وقتی دو کمیت با واحدِ متفاوت باید کنارِ هم دیده
 * شوند (فروش به تومان و تعداد سفارش). هر محور قالبِ عددِ خودش را دارد.
 */
function ComboChart({
  data,
  categoryKey,
  bar,
  line,
  showLegend = true,
  showGrid = true,
  barFormatter = faNumber,
  lineFormatter = faNumber,
  className,
  ...props
}: ComboChartProps & Omit<React.ComponentProps<"div">, keyof ComboChartProps>) {
  const barColor = bar.color ?? colorAt(0)
  const lineColor = line.color ?? colorAt(1)
  const base = axisOption({
    categories: categoriesOf(data, categoryKey),
    showGrid,
    showLegend,
    format: barFormatter,
    horizontal: false,
    names: [bar.label ?? bar.key, line.label ?? line.key],
  })
  const valueAxis = {
    type: "value" as const,
    axisLabel: { color: "var(--muted-foreground)" },
  }

  const option: EChartsOption = {
    ...base,
    yAxis: [
      {
        ...valueAxis,
        // ظرفِ نمودار dir="rtl" است و ECharts چپ/راست را در آن قرینه می‌کند:
        // "left" این‌جا یعنی لبهٔ راست. محورِ اصلی (میله‌ها) سمتِ شروعِ خواندن.
        position: "left",
        axisLabel: { ...valueAxis.axisLabel, formatter: (value: number) => barFormatter(value) },
        splitLine: { show: showGrid, lineStyle: { color: "var(--border)", type: "dashed" } },
      },
      {
        ...valueAxis,
        position: "right",
        axisLabel: { ...valueAxis.axisLabel, formatter: (value: number) => lineFormatter(value) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        type: "bar" as const,
        name: bar.label ?? bar.key,
        data: valuesOf(data, bar.key),
        yAxisIndex: 0,
        barMaxWidth: 36,
        itemStyle: { color: barColor, borderRadius: [6, 6, 0, 0] },
      },
      {
        type: "line" as const,
        name: line.label ?? line.key,
        data: valuesOf(data, line.key),
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2, color: lineColor },
        itemStyle: { color: lineColor },
      },
    ],
  }

  return (
    <ChartContainer
      data-slot="combo-chart"
      config={buildConfig([
        { ...bar, color: barColor },
        { ...line, color: lineColor },
      ])}
      option={option}
      className={cn("h-72 w-full", className)}
      {...props}
    />
  )
}

export { BarChart, LineChart, AreaChart, PieChart, ComboChart, RadarChart, RadialChart }
