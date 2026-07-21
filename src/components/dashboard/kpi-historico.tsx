"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { Loader2, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react"
import type { HistoricalKpis, HistoricalMonthData } from "@/hooks/use-kpis-data"

interface KpiHistoricoProps {
  data: HistoricalKpis
  loading?: boolean
}

interface KpiIndicator {
  key: keyof Omit<HistoricalMonthData, "mes" | "label" | "total">
  label: string
  format: "pct" | "num"
  color: string
}

const INDICATORS: KpiIndicator[] = [
  { key: "tasaEntrega", label: "Tasa de Entrega", format: "pct", color: "#2563eb" },
  { key: "confirmacionEnvios", label: "Confirmación Envíos OK", format: "pct", color: "#16a34a" },
  { key: "cumplimientoTiempo", label: "Cumplimiento a Tiempo", format: "pct", color: "#ca8a04" },
  { key: "serviciosEnProceso", label: "Servicios en Proceso", format: "pct", color: "#f97316" },
  { key: "recepcionesDoc", label: "Recepciones Doc.", format: "pct", color: "#dc2626" },
  { key: "tasaAnulacion", label: "Tasa de Anulación", format: "pct", color: "#8b5cf6" },
]

function getStatusBadge(current: number, previous?: number): { label: string; color: string } {
  if (previous === undefined || previous === null) return { label: "—", color: "bg-muted text-muted-foreground" }
  const diff = current - previous
  if (Math.abs(diff) < 1) return { label: "ESTABLE", color: "bg-amber-50 text-amber-700" }
  if (diff > 0) return { label: "CRECIMIENTO", color: "bg-emerald-50 text-emerald-700" }
  return { label: "RETROCESO", color: "bg-red-50 text-red-700" }
}

function getVariation(current: number, previous?: number): { text: string; icon: React.ReactNode; color: string } | null {
  if (previous === undefined || previous === null) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.1) return { text: "0", icon: <Minus className="h-3 w-3" />, color: "text-muted-foreground" }
  const sign = diff > 0 ? "+" : ""
  return {
    text: `${sign}${diff.toFixed(1)}pp`,
    icon: diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />,
    color: diff > 0 ? "text-emerald-600" : "text-red-600",
  }
}

export function KpiHistorico({ data, loading }: KpiHistoricoProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No hay datos históricos disponibles
      </div>
    )
  }

  const lastTwo = data.slice(-2)
  const currentMonth = lastTwo[lastTwo.length - 1]
  const previousMonth = lastTwo.length > 1 ? lastTwo[0] : undefined

  return (
    <div className="space-y-6">
      <KpiTable data={data} currentMonth={currentMonth} previousMonth={previousMonth} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TotalServiciosChart data={data} />
        <TasaEntregaChart data={data} />
      </div>
    </div>
  )
}

function KpiTable({ data, currentMonth, previousMonth }: { data: HistoricalKpis; currentMonth: HistoricalMonthData; previousMonth?: HistoricalMonthData }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">INDICADOR KPI — Histórico Mensual</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium w-[220px]">INDICADOR KPI</th>
                {data.map((m) => (
                  <th key={m.mes} className="text-center px-3 py-2.5 font-medium whitespace-nowrap">{m.label.split(" ")[0].substring(0, 3).toUpperCase()}<br /><span className="text-[10px] font-normal text-muted-foreground">{m.label.split(" ")[1]}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/10">
                <td className="px-4 py-2 font-semibold">Total Servicios</td>
                {data.map((m) => (
                  <td key={m.mes} className="text-center px-3 py-2 tabular-nums font-medium">{m.total}</td>
                ))}
                <td className="text-center px-3 py-2">
                  {previousMonth && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${currentMonth.total > previousMonth.total ? "bg-emerald-50 text-emerald-700" : currentMonth.total < previousMonth.total ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"}`}>
                      {currentMonth.total > previousMonth.total ? <TrendingUp className="h-3 w-3" /> : currentMonth.total < previousMonth.total ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {currentMonth.total > previousMonth.total ? "+" : ""}{((currentMonth.total - previousMonth.total) / Math.max(previousMonth.total, 1) * 100).toFixed(0)}%
                    </span>
                  )}
                </td>
              </tr>
              {INDICATORS.map((ind) => {
                const vals = data.map(m => m[ind.key] as number)
                const cur = currentMonth[ind.key] as number
                const prev = previousMonth ? (previousMonth[ind.key] as number) : undefined
                const variation = getVariation(cur, prev)
                const status = getStatusBadge(cur, prev)
                return (
                  <tr key={ind.key} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{ind.label}</td>
                    {data.map((m) => (
                      <td key={m.mes} className="text-center px-3 py-2 tabular-nums">{(m[ind.key] as number).toFixed(1)}%</td>
                    ))}
                    <td className="text-center px-3 py-2">
                      {variation && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${variation.color}`}>
                          {variation.icon}
                          {variation.text}
                        </span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2">
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function TotalServiciosChart({ data }: { data: HistoricalKpis }) {
  const chartData = data.map(m => ({ name: m.label.split(" ")[0].substring(0, 3), fullLabel: m.label, total: m.total }))

  const config: ChartConfig = { total: { label: "Total Servicios", color: "#2563eb" } }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">CANTIDAD DE SERVICIO POR MES</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent labelKey="fullLabel" />} />
            <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb" }} activeDot={{ r: 6 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function TasaEntregaChart({ data }: { data: HistoricalKpis }) {
  const chartData = data.map(m => ({
    name: m.label.split(" ")[0].substring(0, 3),
    fullLabel: m.label,
    entrega: m.tasaEntrega,
    cumpleTiempo: m.cumplimientoTiempo,
    anulacion: m.tasaAnulacion,
  }))

  const config: ChartConfig = {
    entrega: { label: "Tasa Entrega %", color: "#2563eb" },
    cumpleTiempo: { label: "Cumplimiento Tiempo %", color: "#16a34a" },
    anulacion: { label: "Tasa Anulación %", color: "#dc2626" },
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">TENDENCIA DE RATIOS POR MES</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <ChartTooltip content={<ChartTooltipContent labelKey="fullLabel" />} formatter={(value) => `${Number(value).toFixed(1)}%`} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="entrega" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cumpleTiempo" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="anulacion" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
