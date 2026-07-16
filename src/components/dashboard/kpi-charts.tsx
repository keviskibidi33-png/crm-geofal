"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { KpiGroup, MonthOption } from "@/hooks/use-kpis-data"

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

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
            {chartData.map((entry, idx) => (
              <Bar key={idx} dataKey="value" fill={entry.fill} radius={[0, 4, 4, 0]} />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
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
  const trend = previousValue !== undefined ? value - previousValue : undefined

  return (
    <Card className={className}>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {icon && <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>}
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
            </div>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-medium ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {Math.abs(trend)}
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
  loading?: boolean
}

export function KpiSummaryRow({ categories, loading }: KpiSummaryRowProps) {
  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 flex-1 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {categories.map((cat) => (
        <div key={cat.label} className="bg-muted/30 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">{cat.label}</p>
          <p className="text-lg font-bold tabular-nums">{cat.value}</p>
          <p className="text-[10px] text-muted-foreground">{cat.percentage}%</p>
        </div>
      ))}
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
