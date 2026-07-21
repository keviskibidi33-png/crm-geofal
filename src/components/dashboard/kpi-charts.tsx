"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, ChevronLeft, ChevronRight, BarChart3, PieChart as PieChartIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { KpiGroup, MonthOption } from "@/hooks/use-kpis-data"

const PIE_COLORS = ["#2563eb", "#f59e0b", "#f97316", "#ef4444", "#8b5cf6", "#06b6d4"]

interface KpiPieChartProps {
  data: KpiGroup
  loading?: boolean
  className?: string
}

export function KpiPieChart({ data, loading, className }: KpiPieChartProps) {
  const chartData = React.useMemo(
    () => data.categories.map((c, i) => ({ ...c, fill: PIE_COLORS[i % PIE_COLORS.length] })),
    [data.categories]
  )

  const config: ChartConfig = React.useMemo(
    () => Object.fromEntries(data.categories.map((c, i) => [c.label, { label: c.label, color: PIE_COLORS[i % PIE_COLORS.length] }])),
    [data.categories]
  )

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-[250px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{data.title}</CardTitle>
        <p className="text-xs text-muted-foreground">Total: {data.total}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[200px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={chartData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent payload={[]} />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

interface KpiBarChartProps {
  data: KpiGroup
  loading?: boolean
  className?: string
}

export function KpiBarChart({ data, loading, className }: KpiBarChartProps) {
  const chartData = React.useMemo(() => data.categories.map((c, i) => ({ ...c, fill: PIE_COLORS[i % PIE_COLORS.length] })), [data.categories])

  const config: ChartConfig = React.useMemo(
    () => Object.fromEntries(data.categories.map((c, i) => [c.label, { label: c.label, color: PIE_COLORS[i % PIE_COLORS.length] }])),
    [data.categories]
  )

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-[250px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{data.title}</CardTitle>
        <p className="text-xs text-muted-foreground">Total: {data.total}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[200px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" />
            <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

interface KpiChartCardProps {
  data: KpiGroup
  loading?: boolean
  className?: string
}

export function KpiChartCard({ data, loading, className }: KpiChartCardProps) {
  const [chartType, setChartType] = React.useState<"bar" | "pie">("bar")

  return (
    <Card className={className}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-medium">{data.title}</CardTitle>
          <p className="text-xs text-muted-foreground">Total: {data.total}</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant={chartType === "bar" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setChartType("bar")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={chartType === "pie" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setChartType("pie")}
          >
            <PieChartIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : chartType === "bar" ? (
          <BarChartInner data={data} />
        ) : (
          <PieChartInner data={data} />
        )}
      </CardContent>
    </Card>
  )
}

function BarChartInner({ data }: { data: KpiGroup }) {
  const chartData = React.useMemo(() => data.categories.map((c, i) => ({ ...c, fill: PIE_COLORS[i % PIE_COLORS.length] })), [data.categories])
  const config: ChartConfig = React.useMemo(
    () => Object.fromEntries(data.categories.map((c, i) => [c.label, { label: c.label, color: PIE_COLORS[i % PIE_COLORS.length] }])),
    [data.categories]
  )

  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" />
        <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function PieChartInner({ data }: { data: KpiGroup }) {
  const chartData = React.useMemo(() => data.categories.map((c, i) => ({ ...c, fill: PIE_COLORS[i % PIE_COLORS.length] })), [data.categories])
  const config: ChartConfig = React.useMemo(
    () => Object.fromEntries(data.categories.map((c, i) => [c.label, { label: c.label, color: PIE_COLORS[i % PIE_COLORS.length] }])),
    [data.categories]
  )

  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={chartData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent payload={[]} />} />
      </PieChart>
    </ChartContainer>
  )
}

interface KpiCardProps {
  title: string
  value: number
  previousValue?: number
  icon?: React.ReactNode
  loading?: boolean
  className?: string
}

export function KpiCard({ title, value, previousValue, icon, loading, className }: KpiCardProps) {
  const delta = previousValue !== undefined ? value - previousValue : undefined

  return (
    <Card className={`border shadow-sm hover:shadow-md transition-shadow ${className ?? ""}`}>
      <CardContent className="p-5">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {icon && <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
              <p className="text-3xl font-bold tabular-nums mt-1">{value.toLocaleString()}</p>
            </div>
            {delta !== undefined && delta !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${delta > 0 ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {delta > 0 ? "+" : ""}{delta}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface KpiSummaryRowProps {
  categories: { label: string; value: number; percentage: number }[]
  previousCategories?: { label: string; value: number; percentage: number }[]
  loading?: boolean
  title?: string
}

export function KpiSummaryRow({ categories, previousCategories, loading, title }: KpiSummaryRowProps) {
  if (loading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const total = categories.reduce((s, c) => s + c.value, 0)

  return (
    <div className="border border-l-4 border-l-yellow-400 rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b">
        <p className="text-sm font-semibold">{title ?? "ANALISIS CANTIDAD POR TIPO DE SERVICIO"}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-4 py-2 font-medium">Categoría</th>
            <th className="text-center px-4 py-2 font-medium">Cant.</th>
            <th className="text-center px-4 py-2 font-medium">variación</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const prev = previousCategories?.find(p => p.label === cat.label)
            const delta = prev ? cat.value - prev.value : undefined
            const hasDelta = delta !== undefined && delta !== 0
            return (
              <tr key={cat.label} className={`border-b last:border-b-0 ${hasDelta && delta! > 0 ? "bg-emerald-50/60" : hasDelta && delta! < 0 ? "bg-red-50/60" : ""}`}>
                <td className="px-4 py-2 font-medium">{cat.label}</td>
                <td className="text-center px-4 py-2 tabular-nums">{cat.value}</td>
                <td className="text-center px-4 py-2 tabular-nums">
                  {hasDelta ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${delta! > 0 ? "text-emerald-700 bg-emerald-100" : "text-red-700 bg-red-100"}`}>
                      {delta! > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {delta! > 0 ? "+" : ""}{delta}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{cat.percentage}%</span>
                  )}
                </td>
              </tr>
            )
          })}
          <tr className="bg-muted/30 font-semibold">
            <td className="px-4 py-2">TOTAL</td>
            <td className="text-center px-4 py-2 tabular-nums">{total}</td>
            <td className="text-center px-4 py-2">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

interface MonthSelectorProps {
  availableMonths: MonthOption[]
  selectedMonth: string
  selectedYear: number
  onMonthChange: (month: string, year?: number) => void
  loading?: boolean
}

export function MonthSelector({ availableMonths, selectedMonth, selectedYear, onMonthChange, loading }: MonthSelectorProps) {
  const currentDate = availableMonths.find(m => m.month === parseInt(selectedMonth) && m.year === selectedYear)
  const currentLabel = currentDate?.label || "Seleccionar mes"

  const goToPreviousMonth = () => {
    const currentIndex = availableMonths.findIndex(m => m.value === `${selectedYear}-${String(parseInt(selectedMonth)).padStart(2, "0")}`)
    if (currentIndex < availableMonths.length - 1) {
      const prev = availableMonths[currentIndex + 1]
      onMonthChange(String(prev.month), prev.year)
    }
  }

  const goToNextMonth = () => {
    const currentIndex = availableMonths.findIndex(m => m.value === `${selectedYear}-${String(parseInt(selectedMonth)).padStart(2, "0")}`)
    if (currentIndex > 0) {
      const next = availableMonths[currentIndex - 1]
      onMonthChange(String(next.month), next.year)
    }
  }

  const isFirstMonth = availableMonths.findIndex(m => m.value === `${selectedYear}-${String(parseInt(selectedMonth)).padStart(2, "0")}`) === availableMonths.length - 1
  const isLastMonth = availableMonths.findIndex(m => m.value === `${selectedYear}-${String(parseInt(selectedMonth)).padStart(2, "0")}`) === 0

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={goToPreviousMonth}
        disabled={loading || isFirstMonth}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select
        value={`${selectedYear}-${String(parseInt(selectedMonth)).padStart(2, "0")}`}
        onValueChange={(value) => {
          const [year, month] = value.split("-")
          onMonthChange(month, parseInt(year))
        }}
        disabled={loading}
      >
        <SelectTrigger className="w-[180px] h-8">
          <SelectValue placeholder="Seleccionar mes">
            {currentLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availableMonths.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={goToNextMonth}
        disabled={loading || isLastMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
